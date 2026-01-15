"use client";

import React, { useEffect, useMemo, useState } from "react";
import { RefreshCcw, CheckCircle2, Clock, Eye, Edit } from "lucide-react";
import { useSession } from "next-auth/react";

import { Field, SquareButton, TabButton, cn } from "@/components/ui/square";

import {
  getQueueTicketsTodayByRoomId,
  postCallSpecific,
  postStartTicket,
  postSkipTicket,
  postCompleteTicket,
} from "@/services/reception";

import { getRequestItemsByEncouter } from "@/services/services";
import { getFindResultByRequestItemId } from "@/services/results";
import { getAllServices } from "@/services/services";
import ResultReportModal from "@/app/(protected)/results/CreateResultReportModal.modal";
import ShowResultReportModal from "@/app/(protected)/results/ShowResultReportModal.modal";
import UpdateResultReportModal from "@/app/(protected)/results/UpdateResultReportModal.modal";
import {
  QueueTicket,
  TicketStatus,
  Patient,
  MedicalEncounter,
  ServiceRequestItem,
  ServiceResult,
  Service,
} from "@/types";
import { useQueueSocket } from "@/hook/useQueueSocket";
import { notifyError } from "@/components/toast";

// ===== Helpers =====
const fmt = (v?: string | null) => {
  if (!v) return "--";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return "--";
  return d.toLocaleString("vi-VN");
};

const waitingBucket = (s: TicketStatus) => s === "WAITING";
const inProgressBucket = (s: TicketStatus) =>
  s === "CALLED" || s === "IN_PROGRESS";

export default function ResultsPage() {
  const { data: session, status: sessionStatus } = useSession();

  const roomIdFromSession = (session?.user as any)?.assigned_room_id as
    | number
    | undefined;
  const technicianId = (session?.user as any)?.id as string | undefined;

  const { isConnected, tickets, lastEvent, joinRoom } = useQueueSocket({
    roomId: session?.user.assigned_room_id,
    autoConnect: true,
  });

  useEffect(() => {
    if (!lastEvent) return;

    switch (lastEvent.type) {
      case "ticket:created":
        setQueue((q) => [...q, lastEvent.ticket]);
        break;

      default:
        break;
    }
  }, [lastEvent]);

  // Queue state
  const [tab, setTab] = useState<"WAITING" | "IN_PROGRESS">("WAITING");
  const [queue, setQueue] = useState<QueueTicket[]>([]);
  const [loadingQueue, setLoadingQueue] = useState(false);

  // Selected ticket + data
  const [currentTicket, setCurrentTicket] = useState<QueueTicket | null>(null);
  const [requestItems, setRequestItems] = useState<ServiceRequestItem[]>([]);
  const [loadingItems, setLoadingItems] = useState(false);

  // Service results map: item_id -> ServiceResultDto
  const [resultsMap, setResultsMap] = useState<Map<string, ServiceResult>>(
    new Map()
  );

  // Service name map
  const [serviceMap, setServiceMap] = useState<Map<number, string>>(new Map());

  // ===== CREATE MODAL STATE =====
  const [openCreateModal, setOpenCreateModal] = useState(false);
  const [createModalItemId, setCreateModalItemId] = useState<string | null>(null);
  const [createModalServiceLabel, setCreateModalServiceLabel] = useState<string>("");

  // ===== SHOW MODAL STATE =====
  const [openShowModal, setOpenShowModal] = useState(false);
  const [showModalResult, setShowModalResult] = useState<ServiceResult | null>(null);
  const [showModalServiceLabel, setShowModalServiceLabel] = useState<string>("");

  // ===== UPDATE MODAL STATE (RIÊNG BIỆT) =====
  const [openUpdateModal, setOpenUpdateModal] = useState(false);
  const [updateModalResult, setUpdateModalResult] = useState<ServiceResult | null>(null);
  const [updateModalServiceLabel, setUpdateModalServiceLabel] = useState<string>("");
  const [updateModalItemId, setUpdateModalItemId] = useState<string | null>(null);

  const normalizeList = <T,>(raw: any): T[] => {
    if (Array.isArray(raw)) return raw;
    if (Array.isArray(raw?.data)) return raw.data;
    return [];
  };

  // ===== Load queue =====
  const loadQueue = async () => {
    if (!roomIdFromSession) return;
    setLoadingQueue(true);
    try {
      const res = await getQueueTicketsTodayByRoomId(roomIdFromSession);
      const list = normalizeList<QueueTicket>(res);
      setQueue(list ?? []);
    } catch (e) {
      console.error("loadQueue error:", e);
      notifyError("Lỗi get ticket cho roomID");
      setQueue([]);
    } finally {
      setLoadingQueue(false);
    }
  };

  useEffect(() => {
    if (sessionStatus !== "authenticated") return;
    if (!roomIdFromSession) return;
    loadQueue();
  }, [sessionStatus, roomIdFromSession]);

  // Load service catalog
  useEffect(() => {
    if (sessionStatus !== "authenticated") return;

    (async () => {
      try {
        const raw = await getAllServices({ page: 1, limit: 50 } as any);
        const list = normalizeList<Service>(raw);
        const m = new Map<number, string>();
        list.forEach((s) => m.set(s.service_id, s.service_name));
        setServiceMap(m);
      } catch (e) {
        console.error("load services map error:", e);
      }
    })();
  }, [sessionStatus]);

  const waitingList = useMemo(
    () => queue.filter((x) => waitingBucket(x.status as TicketStatus)),
    [queue]
  );
  const inProgressList = useMemo(
    () => queue.filter((x) => inProgressBucket(x.status as TicketStatus)),
    [queue]
  );

  // ===== Load results for items =====
  const loadResultsForItems = async (items: ServiceRequestItem[]) => {
    const newMap = new Map<string, ServiceResult>();

    await Promise.all(
      items.map(async (item) => {
        try {
          const results = await getFindResultByRequestItemId(item.item_id);
          // API trả về array, lấy result đầu tiên (hoặc mới nhất)
          if (results && results.length > 0) {
            newMap.set(item.item_id, results[0]);
          }
          console.log("result[0]: ", results[0]);
        } catch (e) {
          // Item chưa có result, bỏ qua
        }
      })
    );

    setResultsMap(newMap);
  };

  // ===== When select a ticket: load request items + results =====
  const openTicket = async (t: QueueTicket) => {
    setCurrentTicket(t);
    setRequestItems([]);
    setResultsMap(new Map());

    if (!t.encounter_id) return;

    setLoadingItems(true);
    try {
      const res = await getRequestItemsByEncouter(t.encounter_id);
      const items = normalizeList<ServiceRequestItem>(res);
      setRequestItems(items ?? []);

      // Load results cho tất cả items
      if (items && items.length > 0) {
        await loadResultsForItems(items);
      }
    } catch (e) {
      console.error("load request items error:", e);
      setRequestItems([]);
    } finally {
      setLoadingItems(false);
    }
  };

  // ===== Filter items by ticket.service_ids =====
  const itemsForThisTicket = useMemo(() => {
    if (!currentTicket) return [];
    const svcs = new Set<number>((currentTicket.service_ids ?? []) as number[]);
    if (svcs.size === 0) return [];
    return requestItems.filter((it) => svcs.has(it.service_id));
  }, [currentTicket, requestItems]);

  // Check if all items have results
  const allReported = useMemo(() => {
    if (!itemsForThisTicket.length) return false;
    return itemsForThisTicket.every((it) => resultsMap.has(it.item_id));
  }, [itemsForThisTicket, resultsMap]);

  // Count completed reports
  const completedCount = useMemo(() => {
    return itemsForThisTicket.filter((it) => resultsMap.has(it.item_id)).length;
  }, [itemsForThisTicket, resultsMap]);

  // ===== Queue actions =====
  const callTicket = async (ticketId: string) => {
    try {
      await postCallSpecific(ticketId);
      await loadQueue();
    } catch (e) {
      console.error(e);
    }
  };

  const startTicket = async (ticketId: string) => {
    try {
      await postStartTicket(ticketId);
      await loadQueue();
      setTab("IN_PROGRESS");
    } catch (e) {
      console.error(e);
    }
  };

  const skipTicket = async (ticketId: string) => {
    try {
      await postSkipTicket(ticketId);
      await loadQueue();
      setCurrentTicket(null);
      setRequestItems([]);
      setResultsMap(new Map());
    } catch (e) {
      console.error(e);
    }
  };

  const completeTicket = async (ticketId: string) => {
    try {
      await postCompleteTicket(ticketId);
      await loadQueue();
      setCurrentTicket(null);
      setRequestItems([]);
      setResultsMap(new Map());
    } catch (e) {
      console.error(e);
    }
  };

  // ===== MODAL HANDLERS =====
  
  // Mở modal tạo báo cáo mới
  const openCreateReport = (item: ServiceRequestItem) => {
    const name = serviceMap.get(item.service_id) ?? `Dịch vụ #${item.service_id}`;
    setCreateModalServiceLabel(`${item.service_id} • ${name}`);
    setCreateModalItemId(item.item_id);
    setOpenCreateModal(true);
  };

  // Mở modal xem báo cáo (read-only)
  const openShowReport = (item: ServiceRequestItem, result: ServiceResult) => {
    const name = serviceMap.get(item.service_id) ?? `Dịch vụ #${item.service_id}`;
    setShowModalServiceLabel(`${item.service_id} • ${name}`);
    setShowModalResult(result);
    setOpenShowModal(true);
  };

  // Mở modal sửa báo cáo
  const openUpdateReport = (item: ServiceRequestItem, result: ServiceResult) => {
    const name = serviceMap.get(item.service_id) ?? `Dịch vụ #${item.service_id}`;
    setUpdateModalServiceLabel(`${item.service_id} • ${name}`);
    setUpdateModalResult(result);
    setUpdateModalItemId(item.item_id);
    setOpenUpdateModal(true);
  };

  // ===== Reload current ticket data after saving =====
  const reloadCurrentTicketData = async () => {
    if (!currentTicket?.encounter_id) return;

    try {
      const res = await getRequestItemsByEncouter(currentTicket.encounter_id);
      const items = normalizeList<ServiceRequestItem>(res);
      setRequestItems(items ?? []);

      if (items && items.length > 0) {
        await loadResultsForItems(items);
      }
    } catch (e) {
      console.error("reload data error:", e);
    }
  };

  return (
    <div className="h-screen flex flex-col bg-bg-white font-montserrat text-secondary-800">
      <div className="flex flex-1 overflow-hidden">
        {/* LEFT 3/4 */}
        <div className="w-3/4 border-r border-secondary-200 bg-white overflow-hidden">
          {/* Top bar */}
          <div className="h-12 bg-bg-content border-b border-secondary-200 px-3 flex items-center justify-between">
            <div className="min-w-0">
              <div className="text-xs font-bold uppercase text-secondary-600">
                Báo cáo CLS
              </div>
              <div className="text-sm font-bold text-primary-900 truncate">
                {currentTicket
                  ? `Phiếu #${currentTicket.display_number} • ${currentTicket.ticket_id}`
                  : "Chưa chọn phiếu"}
              </div>
            </div>

            <div className="flex items-center gap-2">
              {currentTicket && itemsForThisTicket.length > 0 && (
                <div className="px-3 py-1 bg-primary-50 border border-primary-200 rounded-[2px] text-xs font-semibold text-primary-800">
                  {completedCount}/{itemsForThisTicket.length} báo cáo
                </div>
              )}

              <button
                className="p-2 border border-secondary-200 rounded-[2px] bg-white hover:bg-secondary-100"
                onClick={loadQueue}
                disabled={loadingQueue || !roomIdFromSession}
                title="Tải lại hàng đợi"
              >
                <RefreshCcw
                  size={16}
                  className={cn(
                    "text-secondary-700",
                    loadingQueue && "animate-spin"
                  )}
                />
              </button>

              {currentTicket && (
                <>
                  <SquareButton
                    className="bg-secondary-100 hover:bg-secondary-200 border-secondary-200 text-secondary-900"
                    onClick={() => {
                      if (currentTicket.ticket_id) {
                        skipTicket(currentTicket.ticket_id);
                      }
                    }}
                  >
                    Bỏ qua
                  </SquareButton>

                  <SquareButton
                    className="bg-success-600 hover:bg-success-700 border-success-700 text-white"
                    onClick={() => {
                      if (currentTicket.ticket_id) {
                        completeTicket(currentTicket.ticket_id);
                      }
                    }}
                    disabled={!allReported}
                    title={
                      !allReported
                        ? "Cần báo cáo xong tất cả dịch vụ"
                        : undefined
                    }
                  >
                    Hoàn tất phiếu
                  </SquareButton>
                </>
              )}
            </div>
          </div>

          {/* Main content */}
          <div className="h-[calc(100%-48px)] overflow-auto p-3">
            {!currentTicket ? (
              <div className="h-full border border-secondary-200 rounded-[2px] bg-white grid place-items-center">
                <div className="text-center text-secondary-400">
                  <Clock size={64} className="mx-auto mb-3 opacity-50" />
                  <p className="text-lg font-semibold">Chọn phiếu để bắt đầu</p>
                </div>
              </div>
            ) : (
              <div className="border border-secondary-200 rounded-[2px] bg-white overflow-hidden">
                <div className="h-10 bg-primary-800 text-white px-3 flex items-center justify-between">
                  <div className="text-xs font-bold uppercase tracking-wide">
                    Danh sách dịch vụ cần báo cáo
                  </div>
                </div>

                <div className="p-3 space-y-3">
                  <div className="grid grid-cols-12 gap-3">
                    <Field className="col-span-5" label="Bệnh nhân">
                      <b>
                        {currentTicket.encounter?.patient?.full_name ?? "–"}
                      </b>
                    </Field>
                    <Field className="col-span-3" label="Giới tính">
                      {currentTicket.encounter?.patient?.gender ?? "–"}
                    </Field>
                    <Field className="col-span-4" label="Ngày khám">
                      {fmt(currentTicket.encounter?.visit_date ?? null)}
                    </Field>
                  </div>

                  <div className="border border-secondary-200 rounded-[2px] overflow-hidden">
                    <table className="w-full text-xs">
                      <thead className="bg-bg-content border-b border-secondary-200">
                        <tr className="text-left">
                          <th className="p-2 w-24">ID dịch vụ</th>
                          <th className="p-2">Tên dịch vụ</th>
                          <th className="p-2 w-40">Trạng thái</th>
                          <th className="p-2 w-44 text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {loadingItems ? (
                          <tr>
                            <td
                              colSpan={4}
                              className="p-8 text-center text-secondary-500"
                            >
                              Đang tải request items...
                            </td>
                          </tr>
                        ) : itemsForThisTicket.length === 0 ? (
                          <tr>
                            <td
                              colSpan={4}
                              className="p-8 text-center text-secondary-500"
                            >
                              Không tìm thấy request-items khớp với service_ids
                              của ticket này.
                            </td>
                          </tr>
                        ) : (
                          itemsForThisTicket.map((it) => {
                            const name =
                              serviceMap.get(it.service_id) ??
                              `Dịch vụ #${it.service_id}`;
                            const result = resultsMap.get(it.item_id);
                            const done = !!result;

                            return (
                              <tr
                                key={it.item_id}
                                className="border-b border-secondary-100 hover:bg-secondary-50"
                              >
                                <td className="p-2 font-semibold text-secondary-700">
                                  {it.service_id}
                                </td>
                                <td className="p-2">
                                  <div className="font-semibold text-secondary-800">
                                    {name}
                                  </div>
                                  {done && result && (
                                    <div className="text-[11px] text-secondary-500 mt-0.5">
                                      {result.main_conclusion && (
                                        <span className="line-clamp-1">
                                          KL: {result.main_conclusion}
                                        </span>
                                      )}
                                      <span className="text-[10px]">
                                        {fmt(result.result_time)}
                                      </span>
                                    </div>
                                  )}
                                </td>
                                <td className="p-2">
                                  <span
                                    className={cn(
                                      "inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[11px] font-semibold",
                                      done
                                        ? "bg-success-50 text-success-700 border-success-200"
                                        : "bg-warning-50 text-warning-700 border-warning-200"
                                    )}
                                  >
                                    {done ? (
                                      <>
                                        <CheckCircle2 size={12} />
                                        Đã báo cáo
                                      </>
                                    ) : (
                                      <>
                                        <Clock size={12} />
                                        Chưa báo cáo
                                      </>
                                    )}
                                  </span>
                                </td>
                                <td className="p-2 text-right">
                                  <div className="flex items-center justify-end gap-2">
                                    {done && result ? (
                                      <>
                                        <SquareButton
                                          className="bg-primary-100 hover:bg-primary-200 border-primary-200 text-primary-800"
                                          onClick={() =>
                                            openShowReport(it, result)
                                          }
                                          title="Xem báo cáo"
                                        >
                                          <Eye size={14} />
                                        </SquareButton>
                                        <SquareButton
                                          className="bg-secondary-100 hover:bg-secondary-200 border-secondary-200 text-secondary-900"
                                          onClick={() => openUpdateReport(it, result)}
                                          disabled={!technicianId}
                                          title="Sửa báo cáo"
                                        >
                                          <Edit size={14} />
                                        </SquareButton>
                                      </>
                                    ) : (
                                      <SquareButton
                                        className="bg-primary-600 hover:bg-primary-700 border-primary-700 text-white"
                                        onClick={() => openCreateReport(it)}
                                        disabled={!technicianId}
                                        title={
                                          !technicianId
                                            ? "Thiếu technician_id trong session"
                                            : undefined
                                        }
                                      >
                                        Báo cáo
                                      </SquareButton>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* RIGHT 1/4 – Queue */}
        <div className="w-1/4 bg-bg-content overflow-hidden flex flex-col">
          <div className="h-12 bg-bg-content border-b border-secondary-200 px-2 flex items-end">
            <TabButton
              active={tab === "WAITING"}
              onClick={() => setTab("WAITING")}
            >
              Đang chờ ({waitingList.length})
            </TabButton>
            <TabButton
              active={tab === "IN_PROGRESS"}
              onClick={() => setTab("IN_PROGRESS")}
            >
              Đang làm ({inProgressList.length})
            </TabButton>
          </div>

          <div className="flex-1 overflow-auto p-2 space-y-2">
            {(tab === "WAITING" ? waitingList : inProgressList).map((t) => {
              const patientName =
                t.encounter?.patient?.full_name ?? t.encounter_id ?? "–";

              return (
                <div
                  key={t.ticket_id}
                  className={cn(
                    "border border-secondary-200 bg-white rounded-[2px] transition-all",
                    currentTicket?.ticket_id === t.ticket_id &&
                      "ring-2 ring-primary-200 shadow-sm"
                  )}
                >
                  <div className="p-2 border-b border-secondary-100">
                    <div className="text-xs font-bold uppercase truncate">
                      {patientName}
                    </div>
                    <div className="text-[11px] text-secondary-500">
                      {t.status} • {fmt(t.created_at)}
                    </div>
                    <div className="text-[11px] text-secondary-500">
                      Phiếu #{t.display_number} • {t.ticket_type}
                    </div>
                  </div>

                  <div className="p-2 grid grid-cols-2 gap-2">
                    {t.status === "WAITING" ? (
                      <SquareButton
                        className="col-span-2 bg-primary-600 hover:bg-primary-700 border-primary-700 text-white"
                        onClick={() => {
                          if (t.ticket_id) {
                            callTicket(t.ticket_id);
                          }
                        }}
                        disabled={loadingQueue}
                      >
                        Gọi
                      </SquareButton>
                    ) : (
                      <SquareButton
                        className="col-span-2 bg-primary-100 hover:bg-primary-200 border-primary-200 text-primary-800"
                        onClick={() => {
                          if (t.status === "CALLED") {
                            if (t.ticket_id) {
                              startTicket(t.ticket_id);
                            }
                          }
                          openTicket(t);
                        }}
                        disabled={loadingQueue}
                      >
                        {t.status === "CALLED"
                          ? "Bắt đầu & Mở"
                          : "Mở ca đang làm"}
                      </SquareButton>
                    )}
                  </div>
                </div>
              );
            })}

            {(tab === "WAITING" ? waitingList : inProgressList).length ===
              0 && (
              <div className="border border-secondary-200 bg-white rounded-[2px] p-6 text-center text-secondary-500 text-sm">
                Không có phiếu.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modal tạo báo cáo mới */}
      <ResultReportModal
        open={openCreateModal}
        onClose={() => setOpenCreateModal(false)}
        serviceLabel={createModalServiceLabel}
        itemId={createModalItemId}
        technicianId={technicianId ?? null}
        onSaved={async (resultId) => {
          await reloadCurrentTicketData();
        }}
      />

      {/* Modal xem báo cáo (read-only) */}
      <ShowResultReportModal
        open={openShowModal}
        onClose={() => setOpenShowModal(false)}
        result={showModalResult}
        serviceLabel={showModalServiceLabel}
      />

      {/* Modal sửa báo cáo */}
      <UpdateResultReportModal
        open={openUpdateModal}
        onClose={() => setOpenUpdateModal(false)}
        result={updateModalResult}
        serviceLabel={updateModalServiceLabel}
        itemId={updateModalItemId}
        technicianId={technicianId ?? null}
        onSaved={async (resultId) => {
          await reloadCurrentTicketData();
        }}
      />
    </div>
  );
}