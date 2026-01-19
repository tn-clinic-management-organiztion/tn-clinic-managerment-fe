"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  Activity,
  BadgeCheck,
  ClipboardList,
  FlaskConical,
  Pill,
  RefreshCcw,
  Search,
} from "lucide-react";
import { useSession } from "next-auth/react";

import {
  Field,
  Input,
  SquareButton,
  TabButton,
  Textarea,
  cn,
} from "@/components/ui/square";

import ServiceOrderModal from "./ServiceOrderModal.modal";
import ResultsModal from "./ResultsModal.modal";

// ====== encounters services ======
import {
  getEncounterById,
  patchUpdateConsultation,
  postCompleteConsultation,
  postStartConsultation,
} from "@/services/encounters";
import { getAllIcd10 } from "@/services/icd10";
import { useDebounce } from "@/hook/useDebounce";
import { notifyError, notifySuccess } from "@/components/toast";
import { useQueueSocket } from "@/hook/useQueueSocket";
import { getQueueTicketsTodayByRoomId } from "@/services/reception";
import {
  EncounterStatus,
  MedicalEncounter,
  UpdateEncounterPayload,
} from "@/types";
import { RefIcd10 } from "@/types/icd10";
import { toast } from "react-toastify";

// ====== Helpers ======
const calcBMI = (w?: number | null, h?: number | null) => {
  if (!w || !h) return null;
  const m = h / 100;
  const bmi = w / (m * m);
  if (!Number.isFinite(bmi)) return null;
  return Math.round(bmi * 100) / 100;
};

const inConsultationBucket = (s: EncounterStatus) =>
  [
    EncounterStatus.IN_CONSULTATION,
    EncounterStatus.AWAITING_CLS,
    EncounterStatus.IN_CLS,
    EncounterStatus.CLS_COMPLETED,
    EncounterStatus.RESULTS_READY,
  ].includes(s);

const waitingBucket = (s: EncounterStatus) =>
  [EncounterStatus.REGISTERED, EncounterStatus.AWAITING_PAYMENT].includes(s);

const toNumberOrNull = (v: string) => {
  if (v.trim() === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

const toIntOrNull = (v: string) => {
  const n = toNumberOrNull(v);
  if (n === null) return null;
  return Math.trunc(n);
};

const round = (n: number, digits: number) => {
  const p = 10 ** digits;
  return Math.round(n * p) / p;
};

const normalizeVitals = (e: MedicalEncounter): MedicalEncounter => {
  const next = { ...e };

  // numeric scale
  if (next.weight != null) next.weight = round(next.weight, 2);
  if (next.height != null) next.height = round(next.height, 2);
  if (next.bmi != null) next.bmi = round(next.bmi, 2);
  if (next.temperature != null) next.temperature = round(next.temperature, 1);
  if (next.sp_o2 != null) next.sp_o2 = round(next.sp_o2, 2);

  // int
  if (next.pulse != null) next.pulse = Math.trunc(next.pulse);
  if (next.respiratory_rate != null)
    next.respiratory_rate = Math.trunc(next.respiratory_rate);
  if (next.bp_systolic != null) next.bp_systolic = Math.trunc(next.bp_systolic);
  if (next.bp_diastolic != null)
    next.bp_diastolic = Math.trunc(next.bp_diastolic);

  // auto BMI nếu thiếu
  const autoBmi = calcBMI(next.weight, next.height);
  if (next.bmi == null && autoBmi != null) next.bmi = autoBmi;

  return next;
};

export default function DoctorPage() {
  const { data: session } = useSession();
  const { isConnected, tickets, lastEvent, joinRoom } = useQueueSocket({
    roomId: session?.user.assigned_room_id,
    autoConnect: true,
  });

  useEffect(() => {
    if (!lastEvent) return;

    switch (lastEvent.type) {
      case "ticket:created":
        setQueue((q) => [...q, lastEvent.ticket.encounter]);
        break;

      default:
        break;
    }
  }, [lastEvent]);

  const doctorId = (session?.user as any)?.id as string | undefined;
  const roomIdFromSession = (session?.user as any)?.assigned_room_id as
    | number
    | undefined;

  // Right list (queue)
  const [tab, setTab] = useState<"WAITING" | "IN_PROGRESS">("WAITING");
  const [queue, setQueue] = useState<MedicalEncounter[]>([]);
  const [loading, setLoading] = useState(false);

  // Current encounter
  const [current, setCurrent] = useState<MedicalEncounter | null>(null);

  // ICD10 search
  const [icdQuery, setIcdQuery] = useState("");
  const [icdList, setIcdList] = useState<RefIcd10[]>([]);
  const [icdLoading, setIcdLoading] = useState(false);
  const [icdOpen, setIcdOpen] = useState(false);
  const [icdActiveIndex, setIcdActiveIndex] = useState(-1);

  const icdBoxRef = React.useRef<HTMLDivElement | null>(null);
  const abortRef = React.useRef<AbortController | null>(null);
  const suppressNextSearchRef = React.useRef(false);
  const cacheRef = React.useRef(new Map<string, RefIcd10[]>());

  const debouncedIcdQuery = useDebounce(icdQuery, 250);

  // đóng dropdown khi click ra ngoài
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (!icdBoxRef.current) return;
      if (!icdBoxRef.current.contains(e.target as Node)) {
        setIcdOpen(false);
        setIcdActiveIndex(-1);
      }
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  // auto call API
  useEffect(() => {
    const q = debouncedIcdQuery.trim();

    // nếu vừa chọn item thì bỏ qua 1 lần search
    if (suppressNextSearchRef.current) {
      suppressNextSearchRef.current = false;
      return;
    }

    // rule: min 1 ký tự
    if (q.length < 1) {
      abortRef.current?.abort();
      setIcdList([]);
      setIcdOpen(false);
      setIcdLoading(false);
      setIcdActiveIndex(-1);
      return;
    }

    // cache
    const cached = cacheRef.current.get(q);
    if (cached) {
      setIcdList(cached);
      setIcdOpen(true);
      setIcdActiveIndex(cached.length ? 0 : -1);
      return;
    }

    // cancel request cũ
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;

    setIcdLoading(true);

    (async () => {
      try {
        const res = await getAllIcd10(
          { search: q, page: 1, limit: 20 },
          ac.signal,
        );
        const list = (res?.data ?? []) as RefIcd10[];

        // lưu cache
        cacheRef.current.set(q, list);

        setIcdList(list);
        setIcdOpen(true);
        setIcdActiveIndex(list.length ? 0 : -1);
      } catch (e: any) {
        if (e?.name === "CanceledError" || e?.code === "ERR_CANCELED") return;
        console.error("searchIcd error:", e);
        setIcdList([]);
        setIcdOpen(true);
        setIcdActiveIndex(-1);
      } finally {
        setIcdLoading(false);
      }
    })();

    return () => ac.abort();
  }, [debouncedIcdQuery]);

  const selectIcd = (x: RefIcd10) => {
    setCurrent((p) =>
      p
        ? {
            ...p,
            final_icd_code: x.icd_code,
            icd_ref: x,
          }
        : p,
    );

    suppressNextSearchRef.current = true;
    setIcdQuery(`${x.icd_code} - ${x.name_vi}`);
    setIcdOpen(false);
    setIcdList([]);
    setIcdActiveIndex(-1);
  };

  // Modals
  const [openOrder, setOpenOrder] = useState(false);
  const [openResults, setOpenResults] = useState(false);

  // ===== Load queue =====
  const loadQueue = async () => {
    setLoading(true);
    try {
      if (roomIdFromSession) {
        const data: any[] =
          await getQueueTicketsTodayByRoomId(roomIdFromSession);
        const dataEncounter = data.map(
          (x) => x.encounter,
        ) as MedicalEncounter[];
        setQueue(dataEncounter ?? []);
      }
    } catch (e) {
      console.error("loadQueue error:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadQueue();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomIdFromSession]);

  const waitingList = useMemo(
    () => queue.filter((x) => waitingBucket(x.current_status)),
    [queue],
  );
  const inProgressList = useMemo(
    () => queue.filter((x) => inConsultationBucket(x.current_status)),
    [queue],
  );

  // ===== Open encounter detail =====
  const openEncounter = async (encounterId: string) => {
    setLoading(true);
    try {
      const detail = await getEncounterById(encounterId);
      console.log("Detail: ", detail);
      setCurrent(detail);
      setTab("IN_PROGRESS");
    } catch (e) {
      console.error("openEncounter error:", e);
    } finally {
      setLoading(false);
    }
  };

  // ===== Start consultation =====
  const startConsultation = async (encounter: MedicalEncounter) => {
    if (!doctorId) {
      notifyError("Thiếu doctor_id trong session (session.user.id).");
      return;
    }

    setLoading(true);
    try {
      await postStartConsultation(encounter.encounter_id, {
        doctor_id: doctorId,
        assigned_room_id:
          encounter.assigned_room_id ?? roomIdFromSession ?? undefined,
      });

      await loadQueue();
      await openEncounter(encounter.encounter_id);
    } catch (e) {
      console.error("startConsultation error:", e);
    } finally {
      setLoading(false);
    }
  };

const validateVitals = (e: MedicalEncounter) => {
  const errs: string[] = [];

  // not negative =====
  const notNegative = (label: string, v: number | null | undefined) => {
    if (v == null) return;
    if (!Number.isFinite(v)) errs.push(`${label} không hợp lệ`);
    else if (v < 0) errs.push(`${label} không được âm`);
  };

  notNegative("Cân nặng", e.weight);
  notNegative("Chiều cao", e.height);
  notNegative("BMI", e.bmi);
  notNegative("Nhiệt độ", e.temperature);
  notNegative("Mạch", e.pulse);
  notNegative("Nhịp thở", e.respiratory_rate);
  notNegative("HA tâm thu", e.bp_systolic);
  notNegative("HA tâm trương", e.bp_diastolic);
  notNegative("SpO2", e.sp_o2);

  // ===== Numeric (precision/scale)  =====
  const maxByNumeric = (precision: number, scale: number) => {
    // max = 10^(p-s) - 10^(-s)
    return Math.pow(10, precision - scale) - Math.pow(10, -scale);
  };

  const hasTooManyDecimals = (v: number, scale: number) => {
    const p = Math.pow(10, scale);
    return Math.round(v * p) !== v * p;
  };

  const checkNumeric = (
    label: string,
    v: number | null | undefined,
    precision: number,
    scale: number,
  ) => {
    if (v == null) return;
    if (!Number.isFinite(v)) {
      errs.push(`${label} không hợp lệ`);
      return;
    }

    // check scale
    if (hasTooManyDecimals(v, scale)) {
      errs.push(`${label} chỉ được tối đa ${scale} chữ số thập phân`);
    }

    // check max theo precision
    const max = maxByNumeric(precision, scale);
    if (Math.abs(v) > max) {
      errs.push(`${label} vượt quá giới hạn lưu (${max})`);
    }
  };

  // entity numeric:
  checkNumeric("Cân nặng", e.weight, 5, 2);
  checkNumeric("Chiều cao", e.height, 5, 2);
  checkNumeric("BMI", e.bmi, 4, 2);
  checkNumeric("Nhiệt độ", e.temperature, 4, 1);
  checkNumeric("SpO2", e.sp_o2, 5, 2);

  const MAX_INT = 2147483647;

  const checkInt = (label: string, v: number | null | undefined) => {
    if (v == null) return;
    if (!Number.isFinite(v)) {
      errs.push(`${label} không hợp lệ`);
      return;
    }
    if (!Number.isInteger(v)) errs.push(`${label} phải là số nguyên`);
    if (v > MAX_INT) errs.push(`${label} vượt quá giới hạn lưu (${MAX_INT})`);
  };

  checkInt("Mạch", e.pulse);
  checkInt("Nhịp thở", e.respiratory_rate);
  checkInt("HA tâm thu", e.bp_systolic);
  checkInt("HA tâm trương", e.bp_diastolic);

  if (
    e.bp_systolic != null &&
    e.bp_diastolic != null &&
    Number.isFinite(e.bp_systolic) &&
    Number.isFinite(e.bp_diastolic) &&
    e.bp_systolic <= e.bp_diastolic
  ) {
    errs.push("HA tâm thu phải lớn hơn HA tâm trương");
  }

  if (e.sp_o2 != null && e.sp_o2 > 100) errs.push("SpO2 không được > 100");

  return errs;
};


  // ===== Save vitals + conclusion + final ICD =====
  const saveEncounter = async () => {
    if (!current) return;
    const normalized = normalizeVitals(current);
    const errs = validateVitals(normalized);
    if (errs.length) {
      notifyError(errs.join("\n"));
      return;
    }
    setCurrent(normalized);
    setLoading(true);
    try {
      const bmi =
        normalized.bmi ?? calcBMI(normalized.weight, normalized.height);

      const payload: UpdateEncounterPayload = {
        initial_symptoms: normalized.initial_symptoms ?? undefined,

        weight: normalized.weight ?? undefined,
        height: normalized.height ?? undefined,
        bmi: bmi ?? undefined,
        temperature: normalized.temperature ?? undefined,
        pulse: normalized.pulse ?? undefined,
        respiratory_rate: normalized.respiratory_rate ?? undefined,
        bp_systolic: normalized.bp_systolic ?? undefined,
        bp_diastolic: normalized.bp_diastolic ?? undefined,
        sp_o2: normalized.sp_o2 ?? undefined,

        final_icd_code: normalized.final_icd_code ?? null,
        doctor_conclusion: normalized.doctor_conclusion ?? undefined,
      };

      await patchUpdateConsultation(normalized.encounter_id, payload);
      await openEncounter(normalized.encounter_id);
      await loadQueue();
    } catch (e) {
      notifyError(`Lưu thông tin khám bệnh thất bại: ${e}`);
      console.error("saveEncounter error:", e);
    } finally {
      setLoading(false);
    }
  };

  // ===== Complete =====
  const completeEncounter = async () => {
    if (!current) return;

    const finalIcd = (current.final_icd_code ?? "").trim();
    const conclusion = (current.doctor_conclusion ?? "").trim();
    if (!finalIcd || !conclusion) {
      console.log("Gọi notifyError!");
      notifyError(
        "Cần nhập ICD10 (chẩn đoán cuối) và Kết luận bác sĩ trước khi hoàn thành.",
      );
      return;
    }

    const normalized = current ? normalizeVitals(current) : null;
    if (normalized) {
      const errs = validateVitals(normalized);
      if (errs.length) {
        notifyError(errs.join("\n"));
        return;
      }
    }

    setLoading(true);
    try {
      await postCompleteConsultation(current.encounter_id, {
        final_icd_code: finalIcd,
        doctor_conclusion: conclusion,
      });
      notifySuccess("Hoàn thành ca khám bệnh");
      setIcdQuery("");
      setCurrent(null);
      await loadQueue();
      setTab("WAITING");
    } catch (e) {
      console.error("completeEncounter error:", e);
      notifyError("Đơn Khám chưa hoàn hành");
    } finally {
      setLoading(false);
    }
  };

  // Chỉ định / Service đã được chỉ định
  const [viewTab, setViewTab] = useState<"PICK" | "ASSIGNED">("PICK");

  const [assigned, setAssigned] = useState<any[]>([]);
  const [loadingAssigned, setLoadingAssigned] = useState(false);

  return (
    <div className="h-screen flex flex-col bg-bg-white font-montserrat text-secondary-800">
      {/* Split */}
      <div className="flex flex-1 overflow-hidden">
        {/* LEFT 3/4 */}
        <div className="w-3/4 border-r border-secondary-200 bg-white overflow-hidden">
          {/* Encounter bar (buttons nằm đây) */}
          <div className="h-12 bg-bg-content border-b border-secondary-200 px-3 flex items-center justify-between">
            <div className="min-w-0">
              <div className="text-xs font-bold uppercase text-secondary-600 inline-flex items-center gap-2">
                <Activity size={14} className="text-secondary-500" />
                Encounter
              </div>
              <div className="text-sm font-bold text-primary-900 truncate">
                {current
                  ? `${current.encounter_id} • ${
                      current.patient?.full_name ?? "--"
                    }`
                  : "Chưa chọn bệnh nhân"}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <SquareButton
                className="bg-secondary-100 hover:bg-secondary-200 border-secondary-200 text-secondary-900"
                onClick={saveEncounter}
                disabled={!current || loading}
              >
                Lưu
              </SquareButton>

              <SquareButton
                className="bg-primary-600 hover:bg-primary-700 border-primary-700 text-white"
                onClick={() => setOpenResults(true)}
                disabled={!current}
              >
                <span className="inline-flex items-center gap-2">
                  <ClipboardList size={16} /> Xem kết quả
                </span>
              </SquareButton>

              <SquareButton
                className="bg-warning-500 hover:bg-warning-600 border-warning-600 text-secondary-900"
                onClick={() => setOpenOrder(true)}
                disabled={!current}
              >
                <span className="inline-flex items-center gap-2">
                  <FlaskConical size={16} /> Chỉ định CLS
                </span>
              </SquareButton>

              <SquareButton
                className="bg-primary-600 hover:bg-primary-700 border-primary-700 text-white"
                onClick={completeEncounter}
                disabled={!current}
              >
                <span className="inline-flex items-center gap-2">
                  <BadgeCheck size={16} /> Hoàn thành
                </span>
              </SquareButton>

              <button
                className="p-2 border border-secondary-200 rounded-[2px] bg-white hover:bg-secondary-100"
                onClick={loadQueue}
                disabled={loading || !roomIdFromSession}
                title="Tải lại hàng đợi"
              >
                <RefreshCcw
                  size={16}
                  className={cn(
                    "text-secondary-700",
                    loading && "animate-spin",
                  )}
                />
              </button>
            </div>
          </div>

          <div
            className={cn(
              "h-[calc(100%-48px)] overflow-auto p-3",
              !current && "opacity-40 pointer-events-none",
            )}
          >
            <div className="border border-secondary-200 rounded-[2px] bg-white overflow-hidden">
              <div className="h-10 bg-primary-800 text-white px-3 flex items-center justify-between">
                <div className="text-xs font-bold uppercase tracking-wide">
                  Khám hỏi bệnh
                </div>
                <div className="text-[11px] opacity-90">
                  Status: {current?.current_status ?? "--"}
                </div>
              </div>

              <div className="p-3 grid grid-cols-12 gap-3">
                <Field className="col-span-4" label="Họ tên">
                  <b>{current?.patient?.full_name ?? "--"}</b>
                </Field>
                <Field className="col-span-3" label="SĐT">
                  {current?.patient_phone ?? "--"}
                </Field>
                <Field className="col-span-5" label="Ngày khám">
                  {current?.visit_date
                    ? new Date(current.visit_date).toLocaleString("vi-VN")
                    : "--"}
                </Field>

                {/* Symptoms */}
                <div className="col-span-12">
                  <div className="text-[11px] uppercase font-bold text-secondary-500">
                    Triệu chứng ban đầu
                  </div>
                  <Textarea
                    rows={3}
                    value={current?.initial_symptoms ?? ""}
                    onChange={(e) =>
                      setCurrent((prev) =>
                        prev
                          ? { ...prev, initial_symptoms: e.target.value }
                          : prev,
                      )
                    }
                  />
                </div>

                {/* Vitals */}
                <div className="col-span-12 border-t border-secondary-200 pt-3 grid grid-cols-12 gap-3">
                  <div className="col-span-3">
                    <div className="text-[11px] font-bold text-secondary-600">
                      Cân nặng (kg)
                    </div>
                    <Input
                      type="number"
                      value={current?.weight ?? ""}
                      onChange={(e) =>
                        setCurrent((p) =>
                          p
                            ? { ...p, weight: toNumberOrNull(e.target.value) }
                            : p,
                        )
                      }
                    />
                  </div>

                  <div className="col-span-3">
                    <div className="text-[11px] font-bold text-secondary-600">
                      Chiều cao (cm)
                    </div>
                    <Input
                      type="number"
                      value={current?.height ?? ""}
                      onChange={(e) =>
                        setCurrent((p) =>
                          p
                            ? { ...p, height: toNumberOrNull(e.target.value) }
                            : p,
                        )
                      }
                    />
                  </div>

                  <div className="col-span-3">
                    <div className="text-[11px] font-bold text-secondary-600">
                      BMI
                    </div>
                    <Input
                      type="number"
                      value={
                        current?.bmi ??
                        calcBMI(current?.weight, current?.height) ??
                        ""
                      }
                      onChange={(e) =>
                        setCurrent((p) =>
                          p ? { ...p, bmi: toNumberOrNull(e.target.value) } : p,
                        )
                      }
                    />
                  </div>

                  <div className="col-span-3">
                    <div className="text-[11px] font-bold text-secondary-600">
                      SpO2 (%)
                    </div>
                    <Input
                      type="number"
                      value={current?.sp_o2 ?? ""}
                      onChange={(e) =>
                        setCurrent((p) =>
                          p
                            ? { ...p, sp_o2: toNumberOrNull(e.target.value) }
                            : p,
                        )
                      }
                    />
                  </div>

                  <div className="col-span-3">
                    <div className="text-[11px] font-bold text-secondary-600">
                      Nhiệt độ (°C)
                    </div>
                    <Input
                      type="number"
                      step="0.1"
                      value={current?.temperature ?? ""}
                      onChange={(e) =>
                        setCurrent((p) =>
                          p
                            ? {
                                ...p,
                                temperature: toNumberOrNull(e.target.value),
                              }
                            : p,
                        )
                      }
                    />
                  </div>

                  <div className="col-span-3">
                    <div className="text-[11px] font-bold text-secondary-600">
                      Mạch (lần/phút)
                    </div>
                    <Input
                      type="number"
                      value={current?.pulse ?? ""}
                      onChange={(e) =>
                        setCurrent((p) =>
                          p ? { ...p, pulse: toIntOrNull(e.target.value) } : p,
                        )
                      }
                    />
                  </div>

                  <div className="col-span-3">
                    <div className="text-[11px] font-bold text-secondary-600">
                      Nhịp thở
                    </div>
                    <Input
                      type="number"
                      value={current?.respiratory_rate ?? ""}
                      onChange={(e) =>
                        setCurrent((p) =>
                          p
                            ? {
                                ...p,
                                respiratory_rate: toIntOrNull(e.target.value),
                              }
                            : p,
                        )
                      }
                    />
                  </div>

                  <div className="col-span-3">
                    <div className="text-[11px] font-bold text-secondary-600">
                      Huyết áp (SYS/DIA)
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <Input
                        type="number"
                        placeholder="SYS"
                        value={current?.bp_systolic ?? ""}
                        onChange={(e) =>
                          setCurrent((p) =>
                            p
                              ? {
                                  ...p,
                                  bp_systolic: toIntOrNull(e.target.value),
                                }
                              : p,
                          )
                        }
                      />
                      <Input
                        type="number"
                        placeholder="DIA"
                        value={current?.bp_diastolic ?? ""}
                        onChange={(e) =>
                          setCurrent((p) =>
                            p
                              ? {
                                  ...p,
                                  bp_diastolic: toIntOrNull(e.target.value),
                                }
                              : p,
                          )
                        }
                      />
                    </div>
                  </div>
                </div>

                {/* ICD10 */}
                <div className="col-span-12 border-t border-secondary-200 pt-3 grid grid-cols-12 gap-3">
                  <div className="col-span-5" ref={icdBoxRef}>
                    <div className="text-[11px] uppercase font-bold text-secondary-500">
                      ICD10 (chẩn đoán cuối)
                    </div>

                    <div className="relative">
                      <div className="flex gap-2">
                        <Input
                          value={icdQuery}
                          onChange={(e) => {
                            setIcdQuery(e.target.value);
                            setIcdOpen(true);
                          }}
                          onFocus={() => {
                            if (icdList.length > 0) setIcdOpen(true);
                          }}
                          placeholder="Nhập mã hoặc tên ICD10..."
                          onKeyDown={(e) => {
                            if (
                              !icdOpen &&
                              (e.key === "ArrowDown" || e.key === "ArrowUp")
                            ) {
                              setIcdOpen(true);
                              return;
                            }

                            if (e.key === "Escape") {
                              setIcdOpen(false);
                              setIcdActiveIndex(-1);
                            }

                            if (e.key === "ArrowDown") {
                              e.preventDefault();
                              setIcdActiveIndex((i) =>
                                Math.min(
                                  i + 1,
                                  Math.max(icdList.length - 1, 0),
                                ),
                              );
                            }

                            if (e.key === "ArrowUp") {
                              e.preventDefault();
                              setIcdActiveIndex((i) => Math.max(i - 1, 0));
                            }

                            if (e.key === "Enter") {
                              e.preventDefault();
                              const pick = icdList[icdActiveIndex];
                              if (pick) selectIcd(pick);
                            }
                          }}
                        />

                        <SquareButton
                          className="bg-primary-600 hover:bg-primary-700 border-primary-700 text-white"
                          onClick={() => setIcdOpen((v) => !v)}
                          disabled={icdLoading}
                          title="Mở danh sách ICD"
                        >
                          <Search size={16} />
                        </SquareButton>
                      </div>

                      {/* Dropdown */}
                      {icdOpen && (
                        <div className="absolute z-50 mt-2 w-full border border-secondary-200 bg-white rounded-[2px] max-h-56 overflow-auto shadow-sm">
                          {icdLoading && (
                            <div className="px-2 py-2 text-sm text-secondary-500">
                              Đang tìm...
                            </div>
                          )}

                          {!icdLoading &&
                            icdList.length === 0 &&
                            icdQuery.trim().length >= 1 && (
                              <div className="px-2 py-2 text-sm text-secondary-500">
                                Không tìm thấy ICD phù hợp.
                              </div>
                            )}

                          {!icdLoading &&
                            icdList.map((x, idx) => (
                              <button
                                key={x.icd_code}
                                type="button"
                                className={cn(
                                  "w-full text-left px-2 py-2 border-b border-secondary-100 text-sm",
                                  "hover:bg-primary-0",
                                  idx === icdActiveIndex && "bg-primary-100/60",
                                )}
                                onMouseEnter={() => setIcdActiveIndex(idx)}
                                onMouseDown={(e) => e.preventDefault()} // giữ focus input
                                onClick={() => selectIcd(x)}
                              >
                                <b>{x.icd_code}</b> — {x.name_vi}
                              </button>
                            ))}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="col-span-7">
                    <div className="text-[11px] uppercase font-bold text-secondary-500">
                      Kết luận bác sĩ
                    </div>
                    <Textarea
                      rows={4}
                      value={current?.doctor_conclusion ?? ""}
                      onChange={(e) =>
                        setCurrent((p) =>
                          p ? { ...p, doctor_conclusion: e.target.value } : p,
                        )
                      }
                      placeholder="Nhập kết luận, hướng dẫn, dặn dò..."
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT 1/4 */}
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
              Đang khám ({inProgressList.length})
            </TabButton>
          </div>

          <div className="flex-1 overflow-auto p-2 space-y-2">
            {(tab === "WAITING" ? waitingList : inProgressList).map((e) => (
              <div
                key={e.encounter_id}
                className="border border-secondary-400 bg-white rounded-[3px]"
              >
                <div className="flex flex-col p-2 border-b border-secondary-100 gap-1">
                  <div className="text-sm font-bold uppercase truncate">
                    {e.patient?.full_name ?? e.patient_id ?? "—"}
                  </div>
                  <div className="text-xs text-secondary-500">
                    {e.current_status} •{" "}
                    {e.visit_date
                      ? new Date(e.visit_date).toLocaleString("vi-VN")
                      : "--"}
                  </div>
                </div>

                <div className="p-2 grid gap-2">
                  {waitingBucket(e.current_status) ? (
                    <>
                      <SquareButton
                        className="bg-primary-600 hover:bg-primary-700 border-primary-700 text-white"
                        onClick={() => startConsultation(e)}
                        disabled={loading}
                      >
                        Bắt đầu khám
                      </SquareButton>
                    </>
                  ) : (
                    <SquareButton
                      className="col-span-2 bg-primary-100 hover:bg-primary-200 border-primary-200 text-primary-800"
                      onClick={() => openEncounter(e.encounter_id)}
                      disabled={loading}
                    >
                      Mở ca đang khám
                    </SquareButton>
                  )}
                </div>
              </div>
            ))}

            {(tab === "WAITING" ? waitingList : inProgressList).length ===
              0 && (
              <div className="border border-secondary-200 bg-white rounded-[2px] p-6 text-center text-secondary-500 text-sm">
                Không có bệnh nhân.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ===== Modals ===== */}
      <ServiceOrderModal
        open={openOrder}
        onClose={() => setOpenOrder(false)}
        encounterId={current?.encounter_id ?? null}
        onCreated={async () => {
          notifySuccess("Tạo chị định Cận lâm sàng thành công");
          if (current?.encounter_id) await openEncounter(current.encounter_id);
          await loadQueue();
        }}
      />

      <ResultsModal
        open={openResults}
        onClose={() => setOpenResults(false)}
        encounterId={current?.encounter_id ?? null}
      />
    </div>
  );
}
