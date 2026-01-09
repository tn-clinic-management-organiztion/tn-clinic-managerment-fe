"use client";

import React, { useEffect, useMemo, useState } from "react";
import { X, Eye, CheckCircle2, Clock, FileText } from "lucide-react";
import { cn, SquareButton } from "@/components/ui/square";
import ShowResultReportModal from "./ShowResultReportModal.modal";

import { gettRequestItemsByEncouter } from "@/services/services";
import { getFindResultByRequestItemId } from "@/services/results";
import { getAllServices } from "@/services/services";
import { ModalShell } from "@/components/modal/ModalShell";
import { useSession } from "next-auth/react";
import { getQueueTicketConsultationByEncounterIdAndTicketType } from "@/services/reception";
import { Service, ServiceRequestItem, ServiceResult } from "@/types";

type Props = {
  open: boolean;
  onClose: () => void;
  encounterId: string | null;
};

// ===== Helpers =====
const normalizeList = <T,>(raw: any): T[] => {
  if (Array.isArray(raw)) return raw;
  if (Array.isArray(raw?.data)) return raw.data;
  return [];
};

const fmt = (v?: string | null) => {
  if (!v) return "--";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return "--";
  return d.toLocaleString("vi-VN");
};

// ===== Main Component =====
export default function ResultsModal(props: Props) {
  const { data: session, status } = useSession();

  const [requestItems, setRequestItems] = useState<ServiceRequestItem[]>([]);
  const [loadingItems, setLoadingItems] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Service results map: item_id -> ServiceResult
  const [resultsMap, setResultsMap] = useState<Map<string, ServiceResult>>(
    new Map()
  );

  // Service name map
  const [serviceMap, setServiceMap] = useState<Map<number, string>>(new Map());

  // Show modal state (giống KTV)
  const [openShowModal, setOpenShowModal] = useState(false);
  const [showModalResult, setShowModalResult] =
    useState<ServiceResult | null>(null);
  const [showModalServiceLabel, setShowModalServiceLabel] =
    useState<string>("");

  // Load service catalog
  useEffect(() => {
    if (!props.open) return;

    (async () => {
      try {
        const raw = await getAllServices({ page: 1, limit: 100 } as any);
        const list = normalizeList<Service>(raw);
        const m = new Map<number, string>();
        list.forEach((s) => m.set(s.service_id, s.service_name));
        setServiceMap(m);
      } catch (e) {
        console.error("load services map error:", e);
      }
    })();
  }, [props.open]);

  // Load results for items
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
        } catch (e) {
          // Item chưa có result, bỏ qua
        }
      })
    );

    setResultsMap(newMap);
  };

  // Load request items + results
  useEffect(() => {
    const loadData = async () => {
      if (!props.open || !props.encounterId) return;

      setLoadingItems(true);
      setError(null);
      setRequestItems([]);
      setResultsMap(new Map());

      try {
        // 1. Load request items
        const res = await gettRequestItemsByEncouter(props.encounterId);
        const queueTicketEncounter =
          await getQueueTicketConsultationByEncounterIdAndTicketType(
            props.encounterId
          );
        const serviceIdConsultation = queueTicketEncounter[0]?.service_ids[0];
        const items = normalizeList<ServiceRequestItem>(res);
        const items_filter = items.filter(
          (i) => i.service_id != serviceIdConsultation
        );
        setRequestItems(items_filter ?? []);

        // 2. Load results for all items
        if (items && items.length > 0) {
          await loadResultsForItems(items);
        }
      } catch (e: any) {
        console.error("load data error:", e);
        setError(e?.message ?? "Không thể tải danh sách kết quả");
        setRequestItems([]);
      } finally {
        setLoadingItems(false);
      }
    };

    loadData();
  }, [props.open, props.encounterId]);

  // Count completed/pending
  const completedCount = useMemo(() => {
    return requestItems.filter((it) => resultsMap.has(it.item_id)).length;
  }, [requestItems, resultsMap]);

  const pendingCount = requestItems.length - completedCount;

  // Open show modal
  const openShowReport = (
    item: ServiceRequestItem,
    result: ServiceResult
  ) => {
    const name =
      serviceMap.get(item.service_id) ?? `Dịch vụ #${item.service_id}`;
    setShowModalServiceLabel(`${item.service_id} • ${name}`);
    setShowModalResult(result);
    setOpenShowModal(true);
  };

  return (
    <>
      <ModalShell
        open={props.open}
        onClose={props.onClose}
        title="Kết quả cận lâm sàng"
        widthClass="max-w-6xl"
      >
        <div className="bg-white border border-secondary-200 rounded-[2px]">
          {/* Header info */}
          <div className="p-3 border-b border-secondary-200 bg-bg-content flex items-center justify-between">
            <div className="text-xs font-bold uppercase text-secondary-700">
              Encounter: {props.encounterId ?? "--"}
            </div>
            <div className="flex items-center gap-4 text-xs">
              <span className="text-warning-700">
                <Clock size={14} className="inline mr-1" />
                Chờ: <b>{pendingCount}</b>
              </span>
              <span className="text-success-700">
                <CheckCircle2 size={14} className="inline mr-1" />
                Hoàn thành: <b>{completedCount}</b>
              </span>
              <span className="text-secondary-600">
                Tổng: <b>{requestItems.length}</b>
              </span>
            </div>
          </div>

          {/* Content */}
          <div className="h-[530px] overflow-auto bg-white">
            {loadingItems ? (
              <div className="h-full flex items-center justify-center">
                <div className="text-center">
                  <div className="text-sm text-secondary-500 mb-2">
                    Đang tải danh sách...
                  </div>
                  <div className="w-8 h-8 border-2 border-primary-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
                </div>
              </div>
            ) : error ? (
              <div className="h-full flex items-center justify-center">
                <div className="text-center text-error-700 bg-error-50 border border-error-200 rounded-[2px] p-6 max-w-md">
                  <div className="text-sm font-semibold mb-1">
                    Có lỗi xảy ra
                  </div>
                  <div className="text-xs">{error}</div>
                </div>
              </div>
            ) : requestItems.length === 0 ? (
              <div className="h-full flex items-center justify-center">
                <div className="text-center text-secondary-500">
                  <FileText size={48} className="mx-auto mb-3 opacity-30" />
                  <div className="text-sm font-semibold">Chưa có dữ liệu</div>
                  <div className="text-xs mt-1">
                    Chưa có chỉ định CLS nào cho encounter này
                  </div>
                </div>
              </div>
            ) : (
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-bg-content border-b border-secondary-200">
                  <tr className="text-left">
                    <th className="p-2 w-10">#</th>
                    <th className="p-2 w-24">ID</th>
                    <th className="p-2">Tên dịch vụ</th>
                    <th className="p-2 w-48">Kết luận</th>
                    <th className="p-2 w-32">Trạng thái</th>
                    <th className="p-2 w-36">Thời gian</th>
                    <th className="p-2 w-24 text-center">Hành động</th>
                  </tr>
                </thead>
                <tbody>
                  {requestItems.map((item, idx) => {
                    const name =
                      serviceMap.get(item.service_id) ??
                      `Dịch vụ #${item.service_id}`;
                    const result = resultsMap.get(item.item_id);
                    const done = !!result;

                    return (
                      <tr
                        key={item.item_id}
                        className={cn(
                          "border-b border-secondary-100 hover:bg-secondary-50",
                          result?.is_abnormal && "bg-error-50/30"
                        )}
                      >
                        <td className="p-2 text-secondary-500">{idx + 1}</td>

                        <td className="p-2">
                          <span className="font-mono font-semibold text-secondary-700">
                            {item.service_id}
                          </span>
                        </td>

                        <td className="p-2">
                          <div className="font-semibold text-secondary-900">
                            {name}
                          </div>
                        </td>

                        <td className="p-2">
                          {done && result ? (
                            <div className="text-secondary-700 line-clamp-2 text-[11px]">
                              {result.main_conclusion ?? "--"}
                            </div>
                          ) : (
                            <span className="text-secondary-400 text-[11px]">
                              --
                            </span>
                          )}
                        </td>

                        <td className="p-2">
                          <span
                            className={cn(
                              "inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-semibold",
                              done
                                ? result?.is_abnormal
                                  ? "bg-error-50 text-error-700 border-error-200"
                                  : "bg-success-50 text-success-700 border-success-200"
                                : "bg-warning-50 text-warning-700 border-warning-200"
                            )}
                          >
                            {done ? (
                              <>
                                <CheckCircle2 size={10} />
                                {result?.is_abnormal
                                  ? "Bất thường"
                                  : "Bình thường"}
                              </>
                            ) : (
                              <>
                                <Clock size={10} />
                                Chưa có KQ
                              </>
                            )}
                          </span>
                        </td>

                        <td className="p-2 text-secondary-500 text-[11px]">
                          {done && result ? fmt(result.result_time) : "--"}
                        </td>

                        <td className="p-2 text-center">
                          {done && result ? (
                            <SquareButton
                              className="bg-primary-600 hover:bg-primary-700 border-primary-700 text-white"
                              onClick={() => openShowReport(item, result)}
                            >
                              <span className="inline-flex items-center gap-1">
                                <Eye size={12} />
                                Xem
                              </span>
                            </SquareButton>
                          ) : (
                            <span className="text-[10px] text-secondary-400">
                              Chưa có
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          {/* Footer */}
          <div className="p-2 border-t border-secondary-200 bg-bg-white flex justify-end">
            <SquareButton
              className="bg-secondary-100 hover:bg-secondary-200 border-secondary-200 text-secondary-800"
              onClick={props.onClose}
            >
              Đóng
            </SquareButton>
          </div>
        </div>
      </ModalShell>

      {/* Show Result Modal */}
      <ShowResultReportModal
        open={openShowModal}
        onClose={() => {
          setOpenShowModal(false);
          setShowModalResult(null);
        }}
        result={showModalResult}
        serviceLabel={showModalServiceLabel}
      />
    </>
  );
}
