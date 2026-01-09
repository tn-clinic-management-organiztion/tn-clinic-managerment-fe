"use client";

import React, { useEffect, useState } from "react";
import {
  Activity,
  CheckCircle,
  Clock,
  Phone,
  MapPin,
  Play,
  Search,
  X,
  XCircle,
} from "lucide-react";
import { useSession } from "next-auth/react";

import {
  QueueTicket,
  Patient,
  Gender,
  Room,
  CreateTicketPayload,
  CreatePatientPayload,
  UpdatePatientPayload,
  UpdateTicketPayload,
} from "@/types";
import { RoomType } from "@/types/rooms";

import { getAllRooms } from "@/services/rooms";
import {
  getSearchPatient,
  postCreatePatient,
  putUpdatePatient,
} from "@/services/patients";
import { postCreateEncounter } from "@/services/encounters";
import { getAllServices } from "@/services/services";
import {
  getAllTicketReception,
  patchUpdateTicket,
  postCallSpecific,
  postQueueTicketConsultation,
  postQueueTicketWalkin,
  postSkipTicket,
  postStartTicket,
} from "@/services/reception";

import { toast } from "react-toastify";

export default function ReceptionPage() {
  // Toastify
  const notifySuccess = (content: string) => toast.success(content);
  const notifyError = (content: string) => toast.error(content);

  // =========================
  // 1) SESSION
  // =========================
  const { data: session, status } = useSession();

  // =========================
  // 2) STATE - QUEUE / TAB
  // =========================
  const [tickets, setTickets] = useState<QueueTicket[]>([]);
  const [activeTicket, setActiveTicket] = useState<QueueTicket | null>(null);
  const [activeTab, setActiveTab] = useState<"RECEPTION" | "KIOSK_DEMO">(
    "RECEPTION"
  );

  // =========================
  // 3) STATE - ROOMS (PHÂN LUỒNG)
  // =========================
  const [rooms, setRooms] = useState<Room[]>([]);
  const [isLoadingRooms, setIsLoadingRooms] = useState(false);
  const [selectedTargetRoom, setSelectedTargetRoom] = useState<number | null>(
    null
  );

  // =========================
  // 4) STATE - SERVICES (CHỌN DỊCH VỤ)
  // =========================
  const [showServiceModal, setShowServiceModal] = useState(false);
  const [services, setServices] = useState<any[]>([]);
  const [servicePage, setServicePage] = useState(1);
  const [totalServicePages, setTotalServicePages] = useState(1);
  const [isLoadingServices, setIsLoadingServices] = useState(false);
  const [serviceSearch, setServiceSearch] = useState("");
  const [selectedServiceId, setSelectedServiceId] = useState<number | null>(
    null
  );
  // Lưu object để hiển thị tên/giá sau khi chọn
  const [selectedService, setSelectedService] = useState<any | null>(null);

  // =========================
  // 5) STATE - PATIENT SEARCH / MODAL
  // =========================
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<Patient[]>([]);
  const [showSearchModal, setShowSearchModal] = useState(false);

  // =========================
  // 6) STATE - PATIENT FORM
  // =========================
  const [patientForm, setPatientForm] = useState<Patient>({
    patient_id: "",
    full_name: "",
    dob: "",
    gender: Gender.NAM,
    phone: "",
    cccd: "",
    address: "",
    medical_history: "",
    allergy_history: "",
  });

  // =========================
  // 7) HELPERS
  // =========================
  const renderRequiredMark = () => (
    <span className="text-error-500 font-bold ml-1">*</span>
  );

  const getStatusColor = (status: string) => {
    switch (status) {
      case "WAITING":
        return "bg-secondary-200 text-secondary-600 border-secondary-300";
      case "CALLED":
        return "bg-warning-100 text-warning-800 border-warning-500";
      case "IN_PROGRESS":
        return "bg-primary-100 text-primary-800 border-primary-500";
      default:
        return "bg-secondary-100 text-secondary-400";
    }
  };

  const formatVND = (value: number | string) =>
    new Intl.NumberFormat("vi-VN", {
      style: "currency",
      currency: "VND",
    }).format(Number(value));

  const resetReceptionForm = () => {
    setPatientForm({
      patient_id: "",
      full_name: "",
      dob: "",
      gender: Gender.NAM,
      phone: "",
      cccd: "",
      address: "",
      medical_history: "",
      allergy_history: "",
    });
    setSelectedServiceId(null);
    setSelectedService(null);
    setSelectedTargetRoom(null);
    setSearchQuery("");
  };

  // =========================
  // 8) EFFECTS - FETCH ROOMS
  // =========================
  useEffect(() => {
    const fetchClinicRooms = async () => {
      setIsLoadingRooms(true);
      try {
        const data = await getAllRooms({
          room_type: RoomType.CLINIC,
          is_active: true,
          page: 1,
          limit: 100,
        });
        setRooms(Array.isArray(data) ? data : []);
      } catch (error) {
        notifyError("Không tải được danh sách phòng khám (CLINIC)");
        setRooms([]);
      } finally {
        setIsLoadingRooms(false);
      }
    };

    fetchClinicRooms();
  }, []);

  // =========================
  // 9) EFFECTS - FETCH SERVICES
  // =========================
  useEffect(() => {
    if (!showServiceModal) return;

    const fetchServices = async () => {
      setIsLoadingServices(true);
      try {
        const res: any = await getAllServices({
          page: servicePage,
          limit: 10,
          search: serviceSearch || undefined,
        });

        // Hỗ trợ cả 2 kiểu:
        // - API trả thẳng array
        // - API trả { data: [], meta: {...} }
        const list = Array.isArray(res)
          ? res
          : Array.isArray(res?.data)
          ? res.data
          : [];
        setServices(list);

        const total = res?.meta?.total_pages || res?.meta?.last_page || 1;
        setTotalServicePages(total);
      } catch (e) {
        console.error(e);
        setServices([]);
        setTotalServicePages(1);
      } finally {
        setIsLoadingServices(false);
      }
    };

    const timer = setTimeout(fetchServices, 300);
    return () => clearTimeout(timer);
  }, [showServiceModal, serviceSearch, servicePage]);

  const handleServiceSearchChange = (val: string) => {
    setServiceSearch(val);
    setServicePage(1);
  };

  // =========================
  // 10) TICKETS - REFRESH LIST (đồng bộ WAITING từ backend)
  // =========================
  const refreshTickets = async () => {
    const roomId = session?.user?.assigned_room_id;
    if (!roomId) return;

    const data = await getAllTicketReception(roomId, {
      ticket_type: "REGISTRATION",
      source: "WALKIN",
    });

    const fetchedWaiting = Array.isArray(data) ? data : [];

    setTickets((prev) => {
      const keep = prev.filter(
        (t) =>
          t.status !== "WAITING" &&
          t.status !== "COMPLETED" &&
          t.status !== "SKIPPED"
      );

      const map = new Map<string, QueueTicket>();
      keep.forEach((t) => t.ticket_id && map.set(t.ticket_id, t));
      fetchedWaiting.forEach((t) => t.ticket_id && map.set(t.ticket_id, t));

      return Array.from(map.values());
    });
  };

  useEffect(() => {
    if (status !== "authenticated") return;
    refreshTickets().catch(console.error);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, session?.user?.assigned_room_id]);

  // =========================
  // 11) KIOSK DEMO - RÚT SỐ
  // =========================
  const handleKioskTicket = async () => {
    const roomId = session?.user?.assigned_room_id;
    if (!roomId) {
      notifyError("Không xác định được phòng tiếp đón (assigned_room_id).");
      return;
    }

    const payload: CreateTicketPayload = {
      ticket_type: "REGISTRATION",
      source: "WALKIN",
      room_id: roomId,
    };

    try {
      const result = await postQueueTicketWalkin(payload);
      setTickets((prev) => [...prev, result]);
      notifySuccess(`Đã rút số: ${result.display_number ?? ""}`);
    } catch (e) {
      console.error(e);
      notifyError("Rút số thất bại");
    }
  };

  // =========================
  // 12) ACTIONS - CALL / START / SKIP
  // =========================
  const handleTicketAction = async (
    ticketId: string | undefined,
    action: "CALL" | "START" | "SKIP"
  ) => {
    if (!ticketId) return;

    try {
      let updated: QueueTicket;

      if (action === "CALL") updated = await postCallSpecific(ticketId);
      else if (action === "START") updated = await postStartTicket(ticketId);
      else updated = await postSkipTicket(ticketId);

      setTickets((prev) =>
        prev.map((t) => (t.ticket_id === ticketId ? updated : t))
      );

      // START => mở form tiếp đón (activeTicket) và reset dữ liệu nhập
      if (action === "START") {
        setActiveTicket(updated);
        resetReceptionForm();
      }

      // SKIP nếu đang phục vụ vé này
      if (action === "SKIP" && activeTicket?.ticket_id === ticketId) {
        setActiveTicket(null);
      }

      await refreshTickets();
    } catch (e) {
      console.error(e);
      notifyError(`${action} thất bại`);
    }
  };

  const handleSkipActiveTicket = async () => {
    if (!activeTicket?.ticket_id) return;

    try {
      await postSkipTicket(activeTicket.ticket_id);
      setTickets((prev) =>
        prev.map((t) =>
          t.ticket_id === activeTicket.ticket_id
            ? { ...t, status: "SKIPPED" }
            : t
        )
      );
      setActiveTicket(null);
      notifySuccess("Đã bỏ qua vé");
    } catch (e) {
      notifyError("Bỏ qua vé thất bại");
    }
  };

  // =========================
  // 13) PATIENT - SEARCH (SĐT / CCCD / Tên)
  // =========================
  const handleSearchPatient = async () => {
    const q = searchQuery.trim();
    if (!q) return;

    setIsSearching(true);
    try {
      const isPhone = /^\d{10,11}$/.test(q);
      const isCccd = /^\d{12}$/.test(q);

      const searchDto = {
        phone: isPhone ? q : undefined,
        cccd: isCccd ? q : undefined,
        full_name: !isPhone && !isCccd ? q : undefined,
      };

      const data = await getSearchPatient(searchDto);
      const list: Patient[] = Array.isArray(data) ? data : [];

      if (list.length === 0) {
        // CASE 0: Không thấy -> chuẩn bị tạo mới (prefill dữ liệu search)
        notifyError("Không tìm thấy bệnh nhân. Vui lòng tạo mới.");
        setPatientForm((prev) => ({
          ...prev,
          patient_id: "", // đảm bảo là tạo mới
          full_name: !isPhone && !isCccd ? q.toUpperCase() : prev.full_name,
          phone: isPhone ? q : prev.phone,
          cccd: isCccd ? q : prev.cccd,
        }));
      } else {
        // CASE >1: Trùng tên -> show modal cho chọn đúng người
        setSearchResults(list);
        setShowSearchModal(true);
      }
    } catch (error) {
      console.error(error);
      notifyError("Có lỗi xảy ra khi tìm kiếm");
    } finally {
      setIsSearching(false);
    }
  };

  const handleSelectFromModal = (patient: Patient) => {
    setPatientForm((prev) => ({ ...prev, ...patient }));
    setShowSearchModal(false);
    setSearchResults([]);
  };

  // =========================
  // 14) SUBMIT - LƯU & TẠO PHIẾU KHÁM (Encounter + Ticket Consultation)
  // =========================
  const handleSaveAndCreateEncounter = async () => {
    if (!activeTicket) return;

    // Validation
    if (
      !patientForm.full_name ||
      !patientForm.phone ||
      !patientForm.dob ||
      !selectedTargetRoom
    ) {
      notifyError("Vui lòng nhập đầy đủ các trường bắt buộc (*)");
      return;
    }
    if (!selectedServiceId) {
      notifyError("Vui lòng chọn dịch vụ khám");
      return;
    }

    try {
      let finalPatientId = patientForm.patient_id;

      // B1) PATIENT: tạo mới hoặc cập nhật
      if (!finalPatientId) {
        const newPatient = await postCreatePatient({
          cccd: patientForm.cccd,
          full_name: patientForm.full_name,
          dob: patientForm.dob,
          gender: patientForm.gender,
          phone: patientForm.phone,
          address: patientForm.address,
          medical_history: patientForm.medical_history,
          allergy_history: patientForm.allergy_history,
        });
        finalPatientId = newPatient?.patient_id || newPatient?.id;

        if (!finalPatientId)
          throw new Error("Không lấy được ID bệnh nhân sau khi tạo mới.");
      } else {
        await putUpdatePatient(finalPatientId, {
          cccd: patientForm.cccd,
          full_name: patientForm.full_name,
          dob: patientForm.dob,
          gender: patientForm.gender,
          phone: patientForm.phone,
          address: patientForm.address,
          medical_history: patientForm.medical_history,
          allergy_history: patientForm.allergy_history,
        });
      }

      // B2) ENCOUNTER: tạo phiếu khám
      const newEncounter = await postCreateEncounter({
        patient_id: finalPatientId,
        assigned_room_id: selectedTargetRoom,
      });
      const encounterId = newEncounter?.encounter_id || newEncounter?.id;
      if (!encounterId)
        throw new Error("Không tạo được phiếu khám (Encounter).");

      // 3. CREAT SERVICE REQUEST FOR CONSULTATION
      // Gọi API tạo service_request với service_id của dịch vụ khám
      await fetch(
        `${process.env.NEXT_PUBLIC_SERVER_URL}/service-orders/create-initial`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            encounterId: encounterId,
            serviceId: selectedServiceId,
            requestedBy: session?.user?.id,
          }),
        }
      );

      // B4) CONSULTATION TICKET: tạo vé cho bác sĩ
      await postQueueTicketConsultation({
        room_id: selectedTargetRoom,
        ticket_type: "CONSULTATION",
        encounter_id: encounterId,
        service_ids: [selectedServiceId],
      });

      // B5) COMPLETE REGISTRATION TICKET
      await patchUpdateTicket(activeTicket.ticket_id || "", {
        status: "COMPLETED",
      });

      setTickets((prev) =>
        prev.map((t) =>
          t.ticket_id === activeTicket.ticket_id
            ? { ...t, status: "COMPLETED" }
            : t
        )
      );

      setActiveTicket(null);
      resetReceptionForm();
      notifySuccess(
        `Đã tạo phiếu khám thành công!\n📋 Mã phiếu khám: ${encounterId}\n\n`
      );
    } catch (error: any) {
      console.error("Lỗi quy trình tiếp đón:", error);
      const errorMessage =
        error?.response?.data?.message || error?.message || "Có lỗi xảy ra.";

      notifyError(`Thất bại: ${errorMessage}`);
    }
  };

  // =========================
  // 15) UI - KIOSK DEMO
  // =========================
  if (activeTab === "KIOSK_DEMO") {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-bg-content p-10 font-montserrat">
        <div className="bg-white p-10 rounded-large shadow-xl text-center max-w-lg w-full border border-secondary-200 rounded-2xl">
          <h1 className="text-2xl-2 font-bold text-primary-900 mb-4">
            Kiosk Lấy Số
          </h1>

          <button
            onClick={handleKioskTicket}
            className="w-full bg-primary-600 hover:bg-primary-800 text-white font-bold py-4 px-6 rounded-large flex items-center justify-center gap-3 text-xl shadow-lg active:scale-95 rounded-2xl"
          >
            LẤY SỐ
          </button>

          <button
            onClick={() => setActiveTab("RECEPTION")}
            className="mt-6 text-sm text-information-600"
          >
            Quay lại
          </button>
        </div>
      </div>
    );
  }

  // =========================
  // 16) UI - MAIN RECEPTION
  // =========================
  return (
    <div className="flex flex-col h-screen bg-bg-white font-montserrat text-sm text-secondary-800 relative">
      {/* =========================
          MODAL: CHỌN BỆNH NHÂN (khi trùng tên)
         ========================= */}
      {showSearchModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-secondary-900/50 backdrop-blur-sm p-4 rounded-2xl">
          <div className="bg-white shadow-2xl w-full max-w-3xl overflow-hidden flex flex-col max-h-[80vh] animate-[fadeIn_0.4s_ease-out] rounded-2xl">
            <div className="bg-primary-900 text-white p-4 flex justify-between items-center shrink-0">
              <span className="text-lg font-bold">
                Kết quả tìm kiếm ({searchResults.length})
              </span>
              <button
                onClick={() => setShowSearchModal(false)}
                className="p-1 hover:bg-primary-800 rounded-full transition-colors"
              >
                <X size={24} />
              </button>
            </div>

            <div className="overflow-y-auto p-4 bg-bg-content flex-1">
              <div className="space-y-3">
                {searchResults.map((p, index) => (
                  <div
                    key={p.patient_id || index}
                    onClick={() => handleSelectFromModal(p)}
                    className="bg-white p-4 rounded-md border border-secondary-200 shadow-sm hover:border-primary-500 hover:shadow-md cursor-pointer group transition-all"
                  >
                    <div className="flex justify-between items-center">
                      <div>
                        <h3 className="font-bold text-lg text-primary-900 group-hover:text-primary-600">
                          {p.full_name}
                        </h3>

                        <div className="flex gap-4 text-xs text-secondary-500 mt-1">
                          <span>
                            <span className="font-semibold">Năm sinh:</span>{" "}
                            {p.dob ? new Date(p.dob).getFullYear() : "--"}
                          </span>
                          <span>
                            <span className="font-semibold">Giới tính:</span>{" "}
                            {p.gender}
                          </span>
                        </div>

                        <div className="mt-2 text-xs text-secondary-600 flex flex-col gap-1">
                          <div className="flex items-center gap-2">
                            <Phone size={12} /> {p.phone}
                          </div>
                          <div className="flex items-center gap-2">
                            <MapPin size={12} />{" "}
                            {p.address || "Chưa cập nhật địa chỉ"}
                          </div>
                        </div>
                      </div>

                      <button className="bg-white border border-primary-600 text-primary-600 px-4 py-2 rounded-md font-bold text-xs group-hover:bg-primary-600 group-hover:text-white transition-colors">
                        CHỌN
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =========================
          MODAL: CHỌN DỊCH VỤ
         ========================= */}
      {showServiceModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-secondary-900/50 backdrop-blur-sm p-4">
          <div className="bg-white shadow-2xl w-full max-w-2xl flex flex-col max-h-[85vh] rounded-2xl animate-[fadeIn_0.3s_ease-out]">
            <div className="bg-primary-800 text-white p-4 flex justify-between items-center rounded-t-2xl shrink-0">
              <span className="text-lg font-bold">CHỌN DỊCH VỤ KHÁM</span>
              <button
                onClick={() => setShowServiceModal(false)}
                className="p-1 hover:bg-primary-700 rounded-full transition-colors"
              >
                <X size={24} />
              </button>
            </div>

            <div className="p-4 border-b border-secondary-100 bg-bg-content">
              <div className="relative">
                <input
                  type="text"
                  className="w-full border border-secondary-300 rounded-lg pl-10 pr-4 py-2.5 focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
                  placeholder="Nhập tên dịch vụ để tìm kiếm..."
                  value={serviceSearch}
                  onChange={(e) => handleServiceSearchChange(e.target.value)}
                  autoFocus
                />
                <Search
                  className="absolute left-3 top-3 text-secondary-400"
                  size={18}
                />
              </div>
            </div>

            <div className="overflow-y-auto p-2 flex-1 bg-secondary-50">
              {isLoadingServices ? (
                <div className="flex flex-col items-center justify-center h-32 text-secondary-500 gap-2">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-600" />
                  <span>Đang tải dữ liệu...</span>
                </div>
              ) : services.length === 0 ? (
                <div className="text-center p-8 text-secondary-500">
                  Không tìm thấy dịch vụ nào.
                </div>
              ) : (
                <div className="space-y-2">
                  {services.map((s) => (
                    <div
                      key={s.service_id}
                      onClick={() => {
                        setSelectedServiceId(s.service_id);
                        setSelectedService(s);
                        setShowServiceModal(false);
                        setServiceSearch("");
                      }}
                      className="bg-white p-3 rounded-lg border border-secondary-200 hover:border-primary-500 hover:shadow-md cursor-pointer transition-all flex justify-between items-center group"
                    >
                      <div>
                        <div className="font-bold text-secondary-900 group-hover:text-primary-700">
                          {s.service_name}
                        </div>
                        <div className="text-xs text-secondary-500 mt-1">
                          <span className="bg-secondary-100 px-2 py-0.5 rounded">
                            {s.category?.category_name || "Dịch vụ"}
                          </span>
                        </div>
                      </div>
                      <div className="text-right font-bold text-primary-600">
                        {formatVND(s.unit_price)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="p-3 border-t border-secondary-200 bg-white rounded-b-2xl flex justify-between items-center">
              <span className="text-xs text-secondary-500 font-semibold">
                Trang {servicePage} / {totalServicePages}
              </span>
              <div className="flex gap-2">
                <button
                  disabled={servicePage <= 1}
                  onClick={() => setServicePage((prev) => prev - 1)}
                  className="px-3 py-1.5 rounded border border-secondary-300 text-xs font-bold hover:bg-secondary-100 disabled:opacity-50"
                >
                  Trước
                </button>
                <button
                  disabled={servicePage >= totalServicePages}
                  onClick={() => setServicePage((prev) => prev + 1)}
                  className="px-3 py-1.5 rounded bg-primary-600 text-white text-xs font-bold hover:bg-primary-700 disabled:opacity-50"
                >
                  Sau
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =========================
          HEADER
         ========================= */}
      <header className="h-12 bg-primary-800 text-primary-0 flex items-center justify-between px-4 shadow-md shrink-0">
        <div className="font-semibold text-lg flex items-center gap-2">
          <span>TIẾP ĐÓN BỆNH NHÂN</span>
        </div>
        <button
          onClick={() => setActiveTab("KIOSK_DEMO")}
          className="px-3 py-1 bg-warning-500 hover:bg-warning-600 text-secondary-900 rounded-md text-xs font-bold"
        >
          MỞ KIOSK ẢO
        </button>
      </header>

      {/* =========================
          BODY (LEFT FORM + RIGHT QUEUE)
         ========================= */}
      <div className="flex flex-1 overflow-hidden">
        {/* ========== LEFT: FORM TIẾP ĐÓN ========== */}
        <div className="w-3/4 flex flex-col border-r border-secondary-200 bg-white overflow-y-auto">
          {/* Status Bar */}
          <div className="bg-bg-content p-3 border-b border-secondary-200 flex justify-between items-center sticky top-0 z-10">
            <span className="font-bold text-secondary-700 uppercase flex items-center gap-2">
              {activeTicket ? (
                <>
                  Đang phục vụ số:{" "}
                  <span className="text-xl font-bold text-primary-700">
                    {activeTicket.display_number}
                  </span>
                </>
              ) : (
                "Chưa chọn bệnh nhân"
              )}
            </span>

            {activeTicket && (
              <span
                className={`px-3 py-1 rounded-full border text-xs font-semibold ${
                  patientForm.patient_id
                    ? "bg-primary-100 text-primary-700 border-primary-200"
                    : "bg-success-100 text-success-700 border-success-200"
                }`}
              >
                {patientForm.patient_id
                  ? "CẬP NHẬT BỆNH NHÂN CŨ"
                  : "TẠO BỆNH NHÂN MỚI"}
              </span>
            )}
          </div>

          <div
            className={`p-6 transition-opacity duration-200 pb-20 ${
              !activeTicket ? "opacity-40 pointer-events-none grayscale" : ""
            }`}
          >
            {/* Search patient */}
            <div className="mb-6 flex gap-2">
              <div className="flex-1 relative">
                <input
                  type="text"
                  className="w-full border-2 border-information-200 rounded-md pl-10 pr-4 py-2 focus:outline-none focus:border-information-500 focus:ring-1 focus:ring-information-500"
                  placeholder="Nhập SĐT, Tên hoặc CCCD..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSearchPatient()}
                />
                <Search
                  className="absolute left-3 top-2.5 text-information-500"
                  size={18}
                />
              </div>
              <button
                onClick={handleSearchPatient}
                disabled={isSearching}
                className="bg-information-600 hover:bg-information-700 text-white px-6 py-2 rounded-md font-bold flex items-center gap-2"
              >
                {isSearching ? "Đang tìm..." : "Tìm kiếm"}
              </button>
            </div>

            {/* Thông tin hành chính */}
            <div className="border border-secondary-300 rounded-large p-5 relative mt-2 mb-6">
              <span className="absolute -top-3 left-4 bg-white px-2 text-primary-700 font-bold text-xs uppercase tracking-wider">
                Thông tin hành chính
              </span>

              <div className="grid grid-cols-12 gap-5">
                <div className="col-span-6">
                  <label className="block text-secondary-500 text-xs font-semibold mb-1.5">
                    HỌ VÀ TÊN {renderRequiredMark()}
                  </label>
                  <input
                    type="text"
                    className="w-full border border-secondary-300 rounded-md px-3 py-2 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 uppercase font-bold text-secondary-900"
                    value={patientForm.full_name}
                    onChange={(e) =>
                      setPatientForm({
                        ...patientForm,
                        full_name: e.target.value,
                      })
                    }
                  />
                </div>

                <div className="col-span-3">
                  <label className="block text-secondary-500 text-xs font-semibold mb-1.5">
                    NGÀY SINH {renderRequiredMark()}
                  </label>
                  <input
                    type="date"
                    className="w-full border border-secondary-300 rounded-md px-3 py-2 focus:border-primary-500"
                    value={patientForm.dob}
                    onChange={(e) =>
                      setPatientForm({ ...patientForm, dob: e.target.value })
                    }
                  />
                </div>

                <div className="col-span-3">
                  <label className="block text-secondary-500 text-xs font-semibold mb-1.5">
                    GIỚI TÍNH {renderRequiredMark()}
                  </label>
                  <select
                    className="w-full border border-secondary-300 rounded-md px-3 py-2 focus:border-primary-500 bg-white"
                    value={patientForm.gender}
                    onChange={(e) =>
                      setPatientForm({
                        ...patientForm,
                        gender: e.target.value as Gender,
                      })
                    }
                  >
                    <option value={Gender.NAM}>Nam</option>
                    <option value={Gender.NU}>Nữ</option>
                    <option value={Gender.KHAC}>Khác</option>
                  </select>
                </div>

                <div className="col-span-4">
                  <label className="block text-secondary-500 text-xs font-semibold mb-1.5">
                    SỐ ĐIỆN THOẠI {renderRequiredMark()}
                  </label>
                  <input
                    type="text"
                    className="w-full border border-secondary-300 rounded-md px-3 py-2 focus:border-primary-500 font-medium"
                    value={patientForm.phone}
                    onChange={(e) =>
                      setPatientForm({ ...patientForm, phone: e.target.value })
                    }
                  />
                </div>

                <div className="col-span-4">
                  <label className="block text-secondary-500 text-xs font-semibold mb-1.5">
                    CCCD / CMND
                  </label>
                  <input
                    type="text"
                    className="w-full border border-secondary-300 rounded-md px-3 py-2 focus:border-primary-500"
                    value={patientForm.cccd}
                    maxLength={12}
                    onChange={(e) =>
                      setPatientForm({ ...patientForm, cccd: e.target.value })
                    }
                  />
                </div>

                <div className="col-span-4">
                  <label className="block text-secondary-500 text-xs font-semibold mb-1.5">
                    ĐỊA CHỈ
                  </label>
                  <input
                    type="text"
                    className="w-full border border-secondary-300 rounded-md px-3 py-2 focus:border-primary-500"
                    value={patientForm.address}
                    onChange={(e) =>
                      setPatientForm({
                        ...patientForm,
                        address: e.target.value,
                      })
                    }
                  />
                </div>
              </div>
            </div>

            {/* Thông tin y tế + Đăng ký khám */}
            <div className="grid grid-cols-12 gap-6">
              <div className="col-span-8 border border-secondary-300 rounded-large p-5 relative">
                <span className="absolute -top-3 left-4 bg-white px-2 text-primary-700 font-bold text-xs uppercase tracking-wider">
                  Thông tin y tế bổ sung
                </span>

                <div className="space-y-4">
                  <div>
                    <label className="block text-secondary-500 text-xs font-semibold mb-1.5">
                      TIỀN SỬ BỆNH (MEDICAL HISTORY)
                    </label>
                    <textarea
                      className="w-full border border-secondary-300 rounded-md px-3 py-2 focus:border-primary-500 h-16 resize-none text-xs"
                      placeholder="Ví dụ: Cao huyết áp, tiểu đường..."
                      value={patientForm.medical_history}
                      onChange={(e) =>
                        setPatientForm({
                          ...patientForm,
                          medical_history: e.target.value,
                        })
                      }
                    />
                  </div>

                  <div>
                    <label className="block text-secondary-500 text-xs font-semibold mb-1.5">
                      TIỀN SỬ DỊ ỨNG
                    </label>
                    <textarea
                      className="w-full border border-error-200 bg-error-100 rounded-md px-3 py-2 focus:border-error-500 h-16 resize-none text-xs text-error-900"
                      placeholder="Ví dụ: Dị ứng thuốc kháng sinh, hải sản..."
                      value={patientForm.allergy_history}
                      onChange={(e) =>
                        setPatientForm({
                          ...patientForm,
                          allergy_history: e.target.value,
                        })
                      }
                    />
                  </div>
                </div>
              </div>

              <div className="col-span-4 border border-secondary-300 rounded-large p-5 relative bg-primary-50">
                <span className="absolute -top-3 left-4 bg-white px-2 text-primary-700 font-bold text-xs uppercase tracking-wider">
                  Đăng ký khám
                </span>

                {/* Chọn dịch vụ */}
                <div className="mt-2">
                  <label className="block text-secondary-500 text-xs font-semibold mb-1.5">
                    DỊCH VỤ KHÁM {renderRequiredMark()}
                  </label>

                  <div
                    onClick={() => setShowServiceModal(true)}
                    className={`w-full border rounded-md px-3 py-3 cursor-pointer transition-all flex justify-between items-center bg-white ${
                      selectedServiceId
                        ? "border-primary-500 ring-1 ring-primary-200"
                        : "border-secondary-300 hover:border-primary-400"
                    }`}
                  >
                    {selectedServiceId && selectedService ? (
                      <div className="flex-1">
                        <div className="font-bold text-primary-900 text-sm">
                          {selectedService.service_name}
                        </div>
                        <div className="text-xs text-secondary-500 mt-0.5 flex justify-between pr-2">
                          <span>{selectedService.category?.category_name}</span>
                          <span className="font-semibold text-primary-700">
                            {formatVND(selectedService.unit_price)}
                          </span>
                        </div>
                      </div>
                    ) : (
                      <span className="text-secondary-400 text-sm italic">
                        -- Nhấn để chọn dịch vụ --
                      </span>
                    )}
                  </div>

                  {selectedServiceId && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedServiceId(null);
                        setSelectedService(null);
                      }}
                      className="text-[10px] text-error-600 hover:underline mt-1 ml-1"
                    >
                      Xóa chọn
                    </button>
                  )}
                </div>

                <div className="my-4 border-t border-secondary-200" />

                {/* Chọn phòng khám */}
                <div>
                  <label className="block text-secondary-500 text-xs font-semibold mb-1.5">
                    CHỌN PHÒNG KHÁM {renderRequiredMark()}
                  </label>

                  <div className="space-y-2 max-h-44 overflow-y-auto">
                    {isLoadingRooms && (
                      <div className="text-xs text-secondary-500">
                        Đang tải danh sách phòng...
                      </div>
                    )}
                    {!isLoadingRooms && rooms.length === 0 && (
                      <div className="text-xs text-error-600">
                        Không có phòng khám
                      </div>
                    )}

                    {rooms.map((room) => (
                      <label
                        key={room.room_id}
                        className={`flex items-center p-3 rounded-md border cursor-pointer transition-all ${
                          selectedTargetRoom === room.room_id
                            ? "bg-primary-600 border-primary-600 text-white shadow-md"
                            : "bg-white border-secondary-200 hover:border-primary-400"
                        }`}
                      >
                        <input
                          type="radio"
                          name="targetRoom"
                          className="hidden"
                          value={room.room_id}
                          checked={selectedTargetRoom === room.room_id}
                          onChange={() => setSelectedTargetRoom(room.room_id)}
                        />
                        <div className="flex-1 text-sm font-semibold">
                          {room.room_name}
                        </div>
                        {selectedTargetRoom === room.room_id && (
                          <CheckCircle size={16} />
                        )}
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex justify-between items-center mt-8 border-t border-secondary-100 pt-6">
              <div className="flex gap-3">
                <button
                  onClick={handleSkipActiveTicket}
                  disabled={!activeTicket}
                  className="flex items-center gap-2 px-5 py-2.5 bg-secondary-200 hover:bg-secondary-300 text-secondary-700 rounded-md font-bold disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Bỏ qua
                </button>

                <button
                  onClick={handleSaveAndCreateEncounter}
                  disabled={!activeTicket}
                  className="flex items-center gap-2 px-6 py-2.5 bg-primary-600 hover:bg-primary-700 text-primary-0 rounded-md font-bold shadow-md hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {patientForm.patient_id
                    ? "LƯU & TẠO PHIẾU"
                    : "TẠO MỚI & TẠO PHIẾU"}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* ========== RIGHT: DANH SÁCH CHỜ ========== */}
        <div className="w-1/4 bg-bg-content flex flex-col border-l border-secondary-200">
          <div className="bg-bg-content text-secondary-900 p-3 font-bold text-xs uppercase flex justify-between items-center shadow-sm z-10">
            <span>Danh sách chờ</span>
            <span className="px-2 py-0.5 rounded text-xs">
              SL:{" "}
              {
                tickets.filter(
                  (t) => t.status === "WAITING" || t.status === "CALLED"
                ).length
              }
            </span>
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-3">
            {tickets
              .filter((t) => t.status !== "COMPLETED" && t.status !== "SKIPPED")
              .sort((a, b) => (a.display_number ?? 0) - (b.display_number ?? 0))
              .map((ticket) => (
                <div
                  key={ticket.ticket_id}
                  className={`p-4 rounded-large shadow-sm border-l-[6px] transition-all bg-bg-content ${getStatusColor(
                    ticket.status ?? ""
                  )} border-l-current bg-opacity-10`}
                >
                  <div className="flex justify-between items-start mb-3">
                    <span className="text-2xl font-bold text-secondary-900 block leading-none">
                      {ticket.display_number}
                    </span>

                    <div className="text-right flex flex-col items-end">
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
                          ticket.status === "WAITING"
                            ? "bg-secondary-100 border-secondary-200 text-secondary-600"
                            : ticket.status === "CALLED"
                            ? "bg-warning-100 border-warning-200 text-warning-800"
                            : "bg-primary-100 border-primary-200 text-primary-800"
                        }`}
                      >
                        {ticket.status}
                      </span>
                      <div className="text-[10px] text-secondary-400 mt-1 flex items-center gap-1">
                        <Clock size={10} />
                        {ticket.created_at
                          ? new Date(ticket.created_at).toLocaleTimeString(
                              "vi-VN",
                              {
                                hour: "2-digit",
                                minute: "2-digit",
                              }
                            )
                          : "--:--"}
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    {ticket.status === "WAITING" && (
                      <button
                        onClick={() =>
                          handleTicketAction(ticket.ticket_id, "CALL")
                        }
                        className="col-span-2 flex items-center justify-center gap-1 bg-primary-600 hover:bg-primary-900 text-white text-xs py-2 rounded-md font-bold transition-colors shadow-sm"
                      >
                        GỌI LOA
                      </button>
                    )}

                    {ticket.ticket_id && ticket.status === "CALLED" && (
                      <>
                        <button
                          onClick={() =>
                            handleTicketAction(ticket.ticket_id, "START")
                          }
                          className="flex items-center justify-center gap-1 bg-success-600 hover:bg-success-700 text-white text-xs py-2 rounded-md font-bold shadow-sm"
                        >
                          <Play size={14} /> TIẾP ĐÓN
                        </button>

                        <button
                          onClick={() =>
                            handleTicketAction(ticket.ticket_id, "SKIP")
                          }
                          className="flex items-center justify-center gap-1 bg-secondary-200 hover:bg-secondary-300 text-secondary-700 text-xs py-2 rounded-md font-bold"
                        >
                          <XCircle size={14} /> BỎ QUA
                        </button>
                      </>
                    )}

                    {ticket.status === "IN_PROGRESS" && (
                      <div className="col-span-2 text-center text-xs text-primary-700 font-bold border border-primary-200 bg-primary-50 py-2 rounded-md flex items-center justify-center gap-2">
                        <Activity size={14} className="animate-pulse" /> Đang xử
                        lý...
                      </div>
                    )}
                  </div>
                </div>
              ))}
          </div>
        </div>
      </div>
    </div>
  );
}
