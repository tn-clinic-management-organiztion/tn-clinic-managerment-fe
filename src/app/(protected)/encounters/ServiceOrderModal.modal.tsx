"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Search, Trash2, RefreshCcw } from "lucide-react";
import { cn, Input, SquareButton, Select } from "@/components/ui/square";
import {
  getAllServices,
  getAssignedServicesByEncounter,
  getRoomsForService,
  postCreateServiceRequestsByDoctor,
} from "@/services/services";
import { getAllServiceCategories } from "@/services/services";
import { ModalShell } from "@/components/modal/ModalShell";
import { postCreateTicketForCLS } from "@/services/reception";
import { CreateTicketPayload, Service, ServiceCategory, TicketStatus, AssignedRoom, Room, CreateServiceRequestPayload } from "@/types";
import { useSession } from "next-auth/react";
import { notifySuccess } from "@/components/toast";

type Props = {
  open: boolean;
  onClose: () => void;
  encounterId: string | null;
  onCreated?: () => void;
};


const safeMoney = (v?: string) => {
  const n = v ? Number(v) : 0;
  return Number.isFinite(n) ? n : 0;
};

// normalize vì BE hay trả { data, meta }
const normalizeList = <T,>(raw: any): T[] => {
  if (Array.isArray(raw)) return raw;
  if (Array.isArray(raw?.data)) return raw.data;
  return [];
};

const statusBadgeClass = (st?: TicketStatus) => {
  const base =
    "inline-flex items-center px-2 py-0.5 rounded-full border text-[11px] font-semibold whitespace-nowrap";
  switch (st) {
    case "WAITING":
      return `${base} bg-secondary-50 text-secondary-700 border-secondary-200`;
    case "CALLED":
      return `${base} bg-warning-50 text-warning-700 border-warning-200`;
    case "IN_PROGRESS":
      return `${base} bg-primary-50 text-primary-700 border-primary-200`;
    case "COMPLETED":
      return `${base} bg-success-50 text-success-700 border-success-200`;
    case "SKIPPED":
      return `${base} bg-error-50 text-error-700 border-error-200`;
    default:
      return `${base} bg-bg-content text-secondary-700 border-secondary-200`;
  }
};

export default function ServiceOrderModal(props: Props) {
  const { data: session } = useSession();

  const [view, setView] = useState<"PICK" | "ASSIGNED">("PICK");

  // assigned
  const [assignedRooms, setAssignedRooms] = useState<AssignedRoom[]>([]);
  const [loadingAssigned, setLoadingAssigned] = useState(false);
  const [assignedError, setAssignedError] = useState<string | null>(null);

  // categories
  const [categories, setCategories] = useState<ServiceCategory[]>([]);
  const [loadingCat, setLoadingCat] = useState(false);

  // query services
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const limit = 20;

  const [categoryId, setCategoryId] = useState<number | undefined>(undefined);

  const [services, setServices] = useState<Service[]>([]);
  const [loadingSvc, setLoadingSvc] = useState(false);

  // selected services
  const [selected, setSelected] = useState<
    Array<{ svc: Service; qty: number }>
  >([]);

  // Get all categories
  useEffect(() => {
    if (!props.open) return;

    (async () => {
      setLoadingCat(true);
      try {
        const raw = await getAllServiceCategories({
          page: 1,
          limit: 100,
          parent_id: null,
        } as any);
        setCategories(normalizeList<ServiceCategory>(raw));
      } catch (e) {
        console.error("Load categories error:", e);
        setCategories([]);
      } finally {
        setLoadingCat(false);
      }
    })();
  }, [props.open]);

  useEffect(() => {
    if (!props.open) return;

    (async () => {
      setLoadingSvc(true);
      try {
        const raw = await getAllServices({
          page,
          limit,
          search: q || undefined,
          category_id: categoryId,
        } as any);

        setServices(normalizeList<Service>(raw));
      } catch (e) {
        console.error("Load services error:", e);
        setServices([]);
      } finally {
        setLoadingSvc(false);
      }
    })();
  }, [props.open, page, q, categoryId]);

  const total = selected.reduce(
    (sum, s) => sum + safeMoney(String(s.svc.unit_price)) * s.qty,
    0
  );

  const toggleSelect = (svc: Service) => {
    setSelected((prev) => {
      const idx = prev.findIndex((x) => x.svc.service_id === svc.service_id);
      if (idx >= 0)
        return prev.filter((x) => x.svc.service_id !== svc.service_id);
      return [...prev, { svc, qty: 1 }];
    });
  };

  const setQty = (serviceId: number, qty: number) => {
    const safe = Math.max(1, Math.min(99, Number.isFinite(qty) ? qty : 1));
    setSelected((prev) =>
      prev.map((x) =>
        x.svc.service_id === serviceId ? { ...x, qty: safe } : x
      )
    );
  };

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const submit = async () => {
    if (!props.encounterId) return;

    setSubmitting(true);
    setSubmitError(null);

    try {
      const serviceIds = selected.map((x) => x.svc.service_id);

      if (!serviceIds.length) {
        setSubmitError("Bạn chưa chọn dịch vụ nào.");
        return;
      }
      // const requestingDoctorId = session?.user?.id;
      const requestingDoctorId = (session as any)?.user?.id;
      if (!requestingDoctorId) {
        setSubmitError(
          "Thiếu requesting_doctor_id (id bác sĩ/người chỉ định)."
        );
        return;
      }

      // room_id -> set(service_id)
      const roomToServices = new Map<number, Set<number>>();

      // gọi rooms cho từng service
      for (const sid of serviceIds) {
        const rooms = (await getRoomsForService(String(sid))) as Room[];

        if (!rooms || rooms.length === 0) {
          console.warn(`Service ${sid} chưa map vào phòng nào.`);
          continue;
        }

        for (const r of rooms) {
          if (!roomToServices.has(r.room_id))
            roomToServices.set(r.room_id, new Set());
          roomToServices.get(r.room_id)!.add(sid);
        }
      }

      if (roomToServices.size === 0) {
        setSubmitError(
          "Không tìm thấy phòng tương ứng cho các dịch vụ đã chọn."
        );
        return;
      }

      // Tạo ticket + service_request theo từng phòng
      for (const [room_id, setSvc] of roomToServices.entries()) {
        const serviceIdsForRoom = Array.from(setSvc);

        // 1) create queue_ticket
        const payloadTicket: CreateTicketPayload = {
          room_id,
          encounter_id: props.encounterId,
          service_ids: serviceIdsForRoom,
          ticket_type: "SERVICE",
        };

        await postCreateTicketForCLS(payloadTicket);

        // 2) create service_request
        const payloadServiceRequest: CreateServiceRequestPayload = {
          encounter_id: props.encounterId,
          requesting_doctor_id: requestingDoctorId,
          notes: undefined,
          items: serviceIdsForRoom.map((id) => ({ service_id: id })),
        };

        await postCreateServiceRequestsByDoctor(payloadServiceRequest);
      }
      setSelected([]);
      notifySuccess("Lưu chỉ định thành công");
      props.onCreated?.();
      props.onClose();
    } catch (err: any) {
      console.error("Create CLS tickets/service_requests error:", err);
      setSubmitError(err?.message ?? "Tạo chỉ định CLS thất bại.");
    } finally {
      setSubmitting(false);
    }
  };

  const rootOptions = useMemo(() => categories, [categories]);
  const loadAssignedServices = async () => {
    if (!props.encounterId) return;

    setLoadingAssigned(true);
    setAssignedError(null);

    try {
      const raw = await getAssignedServicesByEncounter(props.encounterId);

      const list = normalizeList<any>(raw);

      if (list.length > 0 && Array.isArray(list[0]?.services)) {
        setAssignedRooms(list as AssignedRoom[]);
      } else {
        // fallback
        setAssignedRooms([
          {
            room_id: 0,
            room_name: "Dịch vụ đã chỉ định",
            services: normalizeList<Service>(raw) as any,
          },
        ]);
      }
    } catch (e: any) {
      console.error("Load assigned services error:", e);
      setAssignedRooms([]);
      setAssignedError(
        e?.response?.data?.message ??
          e?.message ??
          "Không tải được dịch vụ đã chỉ định."
      );
    } finally {
      setLoadingAssigned(false);
    }
  };

  useEffect(() => {
    if (!props.open) return;
    if (!props.encounterId) return;
    loadAssignedServices();
  }, [props.open, props.encounterId]);

  // flatten room -> rows
  const assignedRows = useMemo(() => {
    return (assignedRooms ?? []).flatMap((room) => {
      return (room.services ?? []).map((svc) => ({
        service_id: svc.service_id,
        service_name: svc.service_name,
        category_name:
          (svc as any).category_name ?? svc.category?.category_name ?? "—",
        unit_price: svc.unit_price,
        room_id: room.room_id,
        room_name: room.room_name ?? `Phòng #${room.room_id}`,
        display_number: room.display_number,
      }));
    });
  }, [assignedRooms]);

  return (
    <ModalShell
      open={props.open}
      onClose={props.onClose}
      title="Chỉ định cận lâm sàng"
      widthClass="max-w-6xl"
    >
      <div className="bg-white border border-secondary-200 rounded-[2px]">
        {/* Tabs */}
        <div className="flex items-center gap-2 p-2 border-b border-secondary-200 bg-bg-white">
          <SquareButton
            className={cn(
              "border-secondary-200",
              view === "PICK"
                ? "bg-primary-600 hover:bg-primary-700 text-white border-primary-700"
                : "bg-secondary-100 hover:bg-secondary-200 text-secondary-900"
            )}
            onClick={() => setView("PICK")}
          >
            Chọn dịch vụ
          </SquareButton>

          <SquareButton
            className={cn(
              "border-secondary-200",
              view === "ASSIGNED"
                ? "bg-primary-600 hover:bg-primary-700 text-white border-primary-700"
                : "bg-secondary-100 hover:bg-secondary-200 text-secondary-900"
            )}
            onClick={() => setView("ASSIGNED")}
            disabled={!props.encounterId}
            title={!props.encounterId ? "Chưa có encounterId" : undefined}
          >
            Dịch vụ đã chỉ định
          </SquareButton>

          {view === "ASSIGNED" && (
            <button
              className="ml-auto p-2 border border-secondary-200 rounded-[2px] bg-white hover:bg-secondary-100"
              onClick={loadAssignedServices}
              disabled={loadingAssigned || !props.encounterId}
              title="Tải lại"
            >
              <RefreshCcw size={16} className="text-secondary-700" />
            </button>
          )}
        </div>

        {/* VIEW: ASSIGNED (BẢNG ĐƠN GIẢN) */}
        {view === "ASSIGNED" ? (
          <div className="p-2">
            {assignedError && (
              <div className="mb-2 text-xs text-error-700 bg-error-50 border border-error-200 p-2 rounded-[2px]">
                {assignedError}
              </div>
            )}

            <div className="h-[520px] overflow-auto bg-white border border-secondary-200 rounded-[2px]">
              {loadingAssigned ? (
                <div className="p-8 text-center text-secondary-500 text-sm">
                  Đang tải...
                </div>
              ) : assignedRows.length === 0 ? (
                <div className="p-10 text-center text-secondary-500 text-sm">
                  Chưa có dịch vụ nào được chỉ định.
                </div>
              ) : (
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-bg-content border-b border-secondary-200">
                    <tr className="text-left">
                      <th className="p-2 w-16">ID</th>
                      <th className="p-2">Tên dịch vụ</th>
                      <th className="p-2 w-56">Danh mục</th>
                      <th className="p-2 w-56">Phòng</th>
                      <th className="p-2 w-28 text-right">Giá</th>
                    </tr>
                  </thead>

                  <tbody>
                    {assignedRows.map((row, index) => (
                      <tr
                        key={`${row.room_id}-${row.service_id}-${index}`}
                        className="border-b border-secondary-100 hover:bg-primary-0"
                      >
                        <td className="p-2 font-semibold text-secondary-700">
                          {row.service_id}
                        </td>

                        <td className="p-2 font-semibold text-secondary-800">
                          {row.service_name}
                        </td>

                        <td className="p-2 text-secondary-600">
                          {row.category_name || "—"}
                        </td>

                        <td className="p-2 text-secondary-700">
                          <div className="font-semibold">{row.room_name}</div>
                          {row.display_number != null && (
                            <div className="text-[11px] text-secondary-500">
                              Phiếu: {row.display_number}
                            </div>
                          )}
                        </td>

                        <td className="p-2 text-right font-semibold text-primary-700">
                          {safeMoney(String(row.unit_price)).toLocaleString("vi-VN")}đ
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        ) : (
          // VIEW: PICK (GIỮ NGUYÊN)
          <div className="grid grid-cols-12">
            {/* LEFT list */}
            <div className="col-span-5 border-r border-secondary-200">
              <div className="p-2 bg-bg-content border-b border-secondary-200 space-y-2">
                <div className="relative">
                  <Input
                    value={q}
                    onChange={(e) => {
                      setQ(e.target.value);
                      setPage(1);
                    }}
                    placeholder="Tìm theo tên dịch vụ..."
                    className="pl-8"
                  />
                  <Search
                    size={16}
                    className="absolute left-2 top-2.5 text-secondary-400"
                  />
                </div>

                <div className="grid grid-cols-12 gap-2">
                  <div className="col-span-12">
                    <Select
                      value={categoryId ?? ""}
                      onChange={(e) => {
                        setCategoryId(
                          e.target.value ? Number(e.target.value) : undefined
                        );
                        setPage(1);
                      }}
                      disabled={loadingCat}
                    >
                      <option value="">-- Tất cả nhóm dịch vụ --</option>
                      {rootOptions.map((c) => (
                        <option key={c.category_id} value={c.category_id}>
                          {c.category_name}
                        </option>
                      ))}
                    </Select>
                  </div>
                </div>

                <div className="text-[11px] text-secondary-500">
                  {loadingSvc ? "Đang tải dịch vụ..." : `Trang ${page}`}
                </div>
              </div>

              <div className="h-[420px] overflow-auto bg-white">
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-bg-content border-b border-secondary-200">
                    <tr className="text-left">
                      <th className="p-2 w-10"></th>
                      <th className="p-2 w-16">ID</th>
                      <th className="p-2">Tên dịch vụ</th>
                      <th className="p-2 w-24 text-right">Giá</th>
                    </tr>
                  </thead>
                  <tbody>
                    {services.map((svc) => {
                      const checked = selected.some(
                        (x) => x.svc.service_id === svc.service_id
                      );
                      return (
                        <tr
                          key={svc.service_id}
                          className={cn(
                            "border-b border-secondary-100 hover:bg-primary-0 cursor-pointer",
                            checked && "bg-primary-100/60"
                          )}
                          onClick={() => toggleSelect(svc)}
                        >
                          <td className="p-2">
                            <input type="checkbox" checked={checked} readOnly />
                          </td>
                          <td className="p-2 font-semibold text-secondary-700">
                            {svc.service_id}
                          </td>
                          <td className="p-2">
                            <div className="font-semibold text-secondary-800">
                              {svc.service_name}
                            </div>
                            <div className="text-[11px] text-secondary-500">
                              {svc.category?.category_name ?? "—"}
                            </div>
                          </td>
                          <td className="p-2 text-right font-semibold text-primary-700">
                            {safeMoney(String(svc.unit_price)).toLocaleString("vi-VN")}đ
                          </td>
                        </tr>
                      );
                    })}

                    {!loadingSvc && services.length === 0 && (
                      <tr>
                        <td
                          colSpan={4}
                          className="p-8 text-center text-secondary-500"
                        >
                          Không có dịch vụ.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              <div className="p-2 border-t border-secondary-200 bg-bg-white flex justify-between">
                <SquareButton
                  className="bg-secondary-100 hover:bg-secondary-200 border-secondary-200 text-secondary-800"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1 || loadingSvc}
                >
                  Trang trước
                </SquareButton>
                <SquareButton
                  className="bg-secondary-100 hover:bg-secondary-200 border-secondary-200 text-secondary-800"
                  onClick={() => setPage((p) => p + 1)}
                  disabled={loadingSvc}
                >
                  Trang sau
                </SquareButton>
              </div>
            </div>

            {/* RIGHT selected */}
            <div className="col-span-7">
              <div className="p-2 bg-bg-content border-b border-secondary-200 flex items-center justify-between">
                <div className="text-xs font-bold uppercase text-secondary-700">
                  Dịch vụ đã chọn
                </div>
                <div className="text-xs text-secondary-600">
                  Tổng:{" "}
                  <span className="font-bold text-primary-800">
                    {total.toLocaleString("vi-VN")}đ
                  </span>
                </div>
              </div>

              <div className="h-[420px] overflow-auto bg-white">
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-bg-content border-b border-secondary-200">
                    <tr className="text-left">
                      <th className="p-2 w-10">#</th>
                      <th className="p-2">Tên dịch vụ</th>
                      <th className="p-2 w-20 text-center">SL</th>
                      <th className="p-2 w-10"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {selected.map((s, idx) => (
                      <tr
                        key={s.svc.service_id}
                        className="border-b border-secondary-100"
                      >
                        <td className="p-2">{idx + 1}</td>
                        <td className="p-2 font-semibold">
                          {s.svc.service_name}
                        </td>
                        <td className="p-2">
                          <Input
                            type="number"
                            min={1}
                            max={99}
                            value={s.qty}
                            onChange={(e) =>
                              setQty(s.svc.service_id, Number(e.target.value))
                            }
                            className="text-center py-1"
                          />
                        </td>
                        <td className="p-2">
                          <button
                            onClick={() =>
                              setSelected((prev) =>
                                prev.filter(
                                  (x) => x.svc.service_id !== s.svc.service_id
                                )
                              )
                            }
                            className="p-1 border border-secondary-200 hover:bg-error-100 rounded-[2px]"
                            title="Xóa"
                          >
                            <Trash2 size={14} className="text-error-600" />
                          </button>
                        </td>
                      </tr>
                    ))}

                    {selected.length === 0 && (
                      <tr>
                        <td
                          colSpan={4}
                          className="p-10 text-center text-secondary-500"
                        >
                          Chưa chọn dịch vụ.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              <div className="p-2 border-t border-secondary-200 bg-bg-white flex justify-end gap-2">
                <SquareButton
                  className="bg-secondary-100 hover:bg-secondary-200 border-secondary-200 text-secondary-800"
                  onClick={() => setSelected([])}
                  disabled={selected.length === 0}
                >
                  Xóa hết
                </SquareButton>

                <SquareButton
                  className="bg-primary-600 hover:bg-primary-700 border-primary-700 text-white"
                  onClick={submit}
                  disabled={
                    selected.length === 0 || !props.encounterId || submitting
                  }
                >
                  {submitting ? "Đang lưu..." : "Lưu chỉ định"}
                </SquareButton>
              </div>

              {submitError && (
                <div className="p-2 text-xs text-error-700">{submitError}</div>
              )}
            </div>
          </div>
        )}
      </div>
    </ModalShell>
  );
}
