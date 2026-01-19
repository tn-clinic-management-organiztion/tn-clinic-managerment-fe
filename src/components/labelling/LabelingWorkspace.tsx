"use client";

import React, { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import {
  Save,
  CheckCircle,
  Info,
  MousePointer2,
  Square,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Trash2,
  ArrowLeft,
  Eye,
  EyeOff,
  AlertTriangle,
  User,
  Calendar,
  FileImage,
  History,
  Grid2X2,
  XCircle,
  Edit,
  MoreVertical,
  Clock,
  AlertCircle,
  Plus,
  Search,
} from "lucide-react";
import {
  TransformWrapper,
  TransformComponent,
  ReactZoomPanPinchRef,
} from "react-zoom-pan-pinch";
import { Menu } from "@headlessui/react";

import {
  getResultImageDetail,
  saveHumanAnnotation,
  approveHumanAnnotation,
  rejectHumanAnnotation,
  setAnnotationDeprecated,
} from "@/services/ai-core.api";
import { useSession } from "next-auth/react";
import { notifyError, notifySuccess } from "@/components/toast";

// --- CONFIG ---
const DEFAULT_CLASSES = [
  { id: 0, name: "nodule", color: "#ef4444" },
  { id: 1, name: "liver tumor", color: "#f97316" },
  { id: 2, name: "Brain tumor", color: "#eab308" },
  { id: 3, name: "Glioma", color: "#84cc16" },
  { id: 4, name: "Meningioma", color: "#22c55e" },
  { id: 5, name: "Pituitary", color: "#06b6d4" },
  { id: 6, name: "prostate cancer", color: "#3b82f6" },
  { id: 7, name: "Lung Opacity", color: "#a855f7" },
  { id: 8, name: "Tuberculosis", color: "#ec4899" },
];

// Hàm tạo màu ngẫu nhiên
const generateRandomColor = () => {
  const colors = [
    "#ef4444",
    "#f97316",
    "#eab308",
    "#84cc16",
    "#22c55e",
    "#06b6d4",
    "#3b82f6",
    "#8b5cf6",
    "#a855f7",
    "#ec4899",
    "#f43f5e",
    "#d946ef",
    "#0ea5e9",
    "#14b8a6",
    "#10b981",
  ];
  return colors[Math.floor(Math.random() * colors.length)];
};

interface Props {
  imageId: string;
}

interface ClassItem {
  id: number;
  name: string;
  color: string;
}

interface BoxUI {
  x: number;
  y: number;
  w: number;
  h: number;
  labelId: number;
  color: string;
}

interface AnnotationSet {
  id: string;
  labeledBy: string;
  status: string;
  createdAt: string;
  isDeprecated: boolean;
  rejectReason?: string;
  deprecationReason?: string;
  data: any[];
  isVisible: boolean;
  source: string;
}

interface ConfirmModalState {
  isOpen: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
  confirmLabel?: string;
  isDanger?: boolean;
}

const LabelingWorkspace = ({ imageId }: Props) => {
  const { data: session, status } = useSession();
  const router = useRouter();

  // --- CLASSES STATE ---
  const [availableClasses, setAvailableClasses] =
    useState<ClassItem[]>(DEFAULT_CLASSES);
  const [showAddClass, setShowAddClass] = useState(false);
  const [newClassName, setNewClassName] = useState("");

  // --- STATE ---
  const [loading, setLoading] = useState(true);
  const [imgMeta, setImgMeta] = useState({
    url: "",
    fileName: "",
    uploader: "",
    date: "",
  });
  const [annotationSets, setAnnotationSets] = useState<AnnotationSet[]>([]);
  const [currentBoxes, setCurrentBoxes] = useState<BoxUI[]>([]);
  const [currentStatus, setCurrentStatus] = useState("UNLABELED");
  const [isEditing, setIsEditing] = useState(false);

  const isReadOnly =
    (currentStatus === "APPROVED" || currentStatus === "SUBMITTED") &&
    !isEditing;
  const canDraw =
    isEditing ||
    ["UNLABELED", "IN_PROGRESS", "REJECTED"].includes(currentStatus);

  // Tools
  const [activeTool, setActiveTool] = useState<"SELECT" | "RECT">("SELECT");
  const [selectedClassId, setSelectedClassId] = useState(0);
  const [isDrawing, setIsDrawing] = useState(false);
  const [startPos, setStartPos] = useState({ x: 0, y: 0 });
  const [tempBox, setTempBox] = useState<BoxUI | null>(null);

  const [reasonPopup, setReasonPopup] = useState<{
    show: boolean;
    title: string;
    reason: string;
    author?: string;
    type: "REJECT" | "DEPRECATE";
  } | null>(null);

  const [showRejectInput, setShowRejectInput] = useState(false);
  const [rejectReasonInput, setRejectReasonInput] = useState("");

  const [confirmModal, setConfirmModal] = useState<ConfirmModalState>({
    isOpen: false,
    title: "",
    message: "",
    onConfirm: () => {},
  });

  const transformRef = useRef<ReactZoomPanPinchRef | null>(null);
  const imageContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (imageId) fetchDetail();
  }, [imageId]);

  const closeConfirm = () =>
    setConfirmModal((prev) => ({ ...prev, isOpen: false }));

  // --- CLASS MANAGEMENT ---
  const handleAddNewClass = () => {
    const trimmed = newClassName.trim();
    if (!trimmed) {
      toast.warning("Vui lòng nhập tên lớp");
      return;
    }

    // Check duplicate
    const exists = availableClasses.find(
      (c) => c.name.toLowerCase() === trimmed.toLowerCase(),
    );
    if (exists) {
      toast.warning("Lớp này đã tồn tại");
      return;
    }

    const newId = Math.max(...availableClasses.map((c) => c.id), -1) + 1;
    const newClass: ClassItem = {
      id: newId,
      name: trimmed,
      color: generateRandomColor(),
    };

    setAvailableClasses([...availableClasses, newClass]);
    setSelectedClassId(newId);
    setNewClassName("");
    setShowAddClass(false);
    toast.success(`Đã thêm lớp "${trimmed}"`);
  };

  // --- CONVERT DATA ---
  const convertDataToUI = (data: any[]): BoxUI[] => {
    return (data || []).map((item: any) => {
      const clsId = item.class?.id ?? 0;
      const cls =
        availableClasses.find((c) => c.id === clsId) || availableClasses[0];
      return {
        x: item.bbox?.x1 || item.x,
        y: item.bbox?.y1 || item.y,
        w: item.bbox?.width || item.w,
        h: item.bbox?.height || item.h,
        labelId: clsId,
        color: cls.color,
      };
    });
  };

  // --- FETCH DATA ---
  const fetchDetail = async () => {
    setLoading(true);
    try {
      const res = await getResultImageDetail(imageId);

      setImgMeta({
        url: res.image_info.original_image_url,
        fileName: res.image_info.file_name || "Không tên",
        uploader: res.image_info.uploaded_by_name || "Hệ thống",
        date: res.image_info.uploaded_at,
      });

      const history: AnnotationSet[] = (res.annotation_history || []).map(
        (h: any) => ({
          id: h.annotation_id,
          labeledBy: h.labeled_by_name || "Ẩn danh",
          status: h.status,
          createdAt: h.created_at,
          isDeprecated: h.status === "DEPRECATED",
          rejectReason: h.rejection_reason,
          deprecationReason: h.deprecation_reason,
          data: h.annotation_data,
          isVisible: false,
          source: "HUMAN",
        }),
      );

      if (res.ai_reference) {
        history.push({
          id: "AI_REF",
          labeledBy: `AI (${res.ai_reference.model})`,
          status: "AI",
          createdAt: new Date().toISOString(),
          isDeprecated: false,
          data: res.ai_reference.data,
          isVisible: false,
          source: "AI",
        });
      }
      setAnnotationSets(history);

      const allClasses = new Map<number, ClassItem>();

      // Thêm các class mặc định trước
      DEFAULT_CLASSES.forEach((cls) => {
        allClasses.set(cls.id, cls);
      });

      // Quét qua tất cả annotation history và thêm class mới
      history.forEach((annotation) => {
        (annotation.data || []).forEach((item: any) => {
          const classId = item.class?.id;
          const className = item.class?.name;

          if (classId !== undefined && className && !allClasses.has(classId)) {
            allClasses.set(classId, {
              id: classId,
              name: className,
              color: generateRandomColor(),
            });
          }
        });
      });

      // Cập nhật lại availableClasses với tất cả class đã phát hiện
      setAvailableClasses(Array.from(allClasses.values()));

      const workflowAnnotation = history.find(
        (h) =>
          h.source === "HUMAN" &&
          !h.isDeprecated &&
          (h.status === "IN_PROGRESS" || h.status === "SUBMITTED"),
      );

      if (workflowAnnotation) {
        setCurrentStatus(workflowAnnotation.status);
        setCurrentBoxes(convertDataToUI(workflowAnnotation.data));
        setIsEditing(workflowAnnotation.status === "IN_PROGRESS");
        return;
      }

      const concludedAnnotation = history.find(
        (h) =>
          h.source === "HUMAN" &&
          !h.isDeprecated &&
          (h.status === "APPROVED" || h.status === "REJECTED"),
      );

      if (concludedAnnotation) {
        setCurrentStatus(concludedAnnotation.status);

        if (concludedAnnotation.status === "REJECTED") {
          setCurrentBoxes([]);
          setIsEditing(true);
          toast.info("Annotation bị từ chối. Hãy label lại từ đầu.", {
            autoClose: 5000,
          });
        } else {
          setCurrentBoxes(convertDataToUI(concludedAnnotation.data));
          setIsEditing(false);
        }
        return;
      }

      setCurrentStatus("UNLABELED");
      setCurrentBoxes([]);
      setIsEditing(true);
    } catch (error) {
      notifyError("Lỗi tải dữ liệu");
    } finally {
      setLoading(false);
    }
  };

  const toggleSetVisibility = (id: string) => {
    setAnnotationSets((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, isVisible: !item.isVisible } : item,
      ),
    );
  };

  // --- ACTIONS ---
  const handleManualDeprecate = (item: AnnotationSet) => {
    if (item.id === "AI_REF") return;
    setConfirmModal({
      isOpen: true,
      title: "Đánh dấu Lạc hậu?",
      message:
        'Hành động này sẽ chuyển trạng thái bản ghi sang "Lỗi thời" (Deprecated) và không thể hoàn tác trực tiếp.',
      confirmLabel: "Xác nhận",
      isDanger: true,
      onConfirm: async () => {
        try {
          await setAnnotationDeprecated(
            item.id,
            "Đánh dấu thủ công bởi bác sĩ",
          );
          notifySuccess("Đã đánh dấu bản ghi là Lạc hậu");
          fetchDetail();
        } catch (error) {
          notifyError("Thao tác thất bại");
        } finally {
          closeConfirm();
        }
      },
    });
  };

  const handleEditApprovedClick = () => {
    setConfirmModal({
      isOpen: true,
      title: "Chỉnh sửa lại?",
      message:
        "Bạn muốn sửa bản ghi ĐÃ DUYỆT? Khi bạn Lưu kết quả mới, bản ghi cũ sẽ tự động chuyển thành Lạc hậu (Deprecated).",
      confirmLabel: "Đồng ý sửa",
      onConfirm: () => {
        setIsEditing(true);
        toast.info("Đã mở khóa. Hãy chỉnh sửa và bấm Lưu.");
        closeConfirm();
      },
    });
  };

  const handleApproveClick = () => {
    setConfirmModal({
      isOpen: true,
      title: "Duyệt kết quả",
      message: "Xác nhận kết quả này là chính xác?",
      confirmLabel: "Duyệt ngay",
      onConfirm: async () => {
        try {
          await approveHumanAnnotation(imageId, {
            approved_by: session?.user.id,
          });
          notifySuccess("Đã duyệt thành công!");
          fetchDetail();
        } catch (e) {
          notifyError("Lỗi khi duyệt.");
        } finally {
          closeConfirm();
        }
      },
    });
  };

  const handleSaveResult = async () => {
    try {
      const formatted = currentBoxes.map((b) => {
        const cls =
          availableClasses.find((c) => c.id === b.labelId) ||
          availableClasses[0];
        return {
          bbox: {
            x1: b.x,
            y1: b.y,
            width: b.w,
            height: b.h,
            x2: b.x + b.w,
            y2: b.y + b.h,
            area: b.w * b.h,
          },
          class: { id: cls.id, name: cls.name },
          confidence: 1.0,
        };
      });

      await saveHumanAnnotation(imageId, {
        annotation_data: formatted,
        labeled_by: session?.user.id,
        annotation_status: "SUBMITTED",
      });
      notifySuccess("Đã lưu và nộp kết quả thành công!");
      setIsEditing(false);
      fetchDetail();
    } catch (e) {
      notifyError("Lỗi khi lưu kết quả");
    }
  };

  const handleRejectSubmit = async () => {
    if (!rejectReasonInput.trim()) {
      toast.warning("Vui lòng nhập lý do");
      return;
    }
    try {
      if (!session?.user.id) return;
      await rejectHumanAnnotation(imageId, {
        rejected_by: session?.user.id,
        reason: rejectReasonInput,
      });
      setShowRejectInput(false);
      setRejectReasonInput("");
      notifySuccess("Đã từ chối kết quả");
      fetchDetail();
    } catch (e) {
      notifyError("Lỗi khi từ chối");
    }
  };

  // --- DRAWING HANDLERS ---
  const handleMouseDown = (e: React.MouseEvent) => {
    if (activeTool !== "RECT" || !canDraw) return;
    if (imageContainerRef.current) {
      const rect = imageContainerRef.current.getBoundingClientRect();
      const scale = transformRef.current?.instance.transformState.scale || 1;
      const x = (e.clientX - rect.left) / scale;
      const y = (e.clientY - rect.top) / scale;
      setStartPos({ x, y });
      setIsDrawing(true);
      const cls =
        availableClasses.find((c) => c.id === selectedClassId) ||
        availableClasses[0];
      setTempBox({ x, y, w: 0, h: 0, labelId: cls.id, color: cls.color });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDrawing || !tempBox || !imageContainerRef.current) return;
    const rect = imageContainerRef.current.getBoundingClientRect();
    const scale = transformRef.current?.instance.transformState.scale || 1;
    const w = (e.clientX - rect.left) / scale - startPos.x;
    const h = (e.clientY - rect.top) / scale - startPos.y;
    setTempBox({
      ...tempBox,
      w: Math.abs(w),
      h: Math.abs(h),
      x: w > 0 ? startPos.x : startPos.x + w,
      y: h > 0 ? startPos.y : startPos.y + h,
    });
  };

  const handleMouseUp = () => {
    if (isDrawing && tempBox && tempBox.w > 5)
      setCurrentBoxes([...currentBoxes, tempBox]);
    setIsDrawing(false);
    setTempBox(null);
  };

  const handleDeleteBox = (index: number) => {
    if (!canDraw) return;
    const newBoxes = [...currentBoxes];
    newBoxes.splice(index, 1);
    setCurrentBoxes(newBoxes);
  };

  if (loading)
    return (
      <div className="h-full flex items-center justify-center text-gray-500 font-medium">
        Đang tải dữ liệu...
      </div>
    );

  return (
    <div className="flex h-full bg-gray-100 overflow-hidden select-none relative">
      <ToastContainer
        position="top-right"
        autoClose={3000}
        theme="colored"
        hideProgressBar={false}
      />

      {/* LEFT TOOLBAR */}
      <div className="w-16 bg-white border-r flex flex-col items-center py-4 gap-4 z-20 shadow-sm shrink-0">
        <div
          onClick={() => router.push("/annotations")}
          className="p-3 mb-2 rounded-full bg-gray-100 text-gray-600 hover:bg-gray-200 cursor-pointer"
          title="Quay lại"
        >
          <ArrowLeft size={20} />
        </div>
        <div
          onClick={() => setActiveTool("SELECT")}
          className={`p-3 rounded-lg cursor-pointer ${
            activeTool === "SELECT"
              ? "bg-indigo-100 text-indigo-600"
              : "text-gray-500 hover:bg-gray-100"
          }`}
          title="Chọn / Di chuyển"
        >
          <MousePointer2 size={24} />
        </div>
        <div
          onClick={() => !isReadOnly && setActiveTool("RECT")}
          className={`p-3 rounded-lg cursor-pointer ${
            activeTool === "RECT"
              ? "bg-indigo-100 text-indigo-600"
              : "text-gray-500 hover:bg-gray-100"
          } ${!canDraw ? "opacity-50 cursor-not-allowed" : ""}`}
          title="Vẽ vùng bệnh"
        >
          <Square size={24} />
        </div>
        <div className="border-t w-8 my-2"></div>
        <div
          onClick={() => transformRef.current?.zoomIn()}
          className="p-2 text-gray-500 hover:text-indigo-600 cursor-pointer"
        >
          <ZoomIn size={20} />
        </div>
        <div
          onClick={() => transformRef.current?.zoomOut()}
          className="p-2 text-gray-500 hover:text-indigo-600 cursor-pointer"
        >
          <ZoomOut size={20} />
        </div>
        <div
          onClick={() => transformRef.current?.resetTransform()}
          className="p-2 text-gray-500 hover:text-indigo-600 cursor-pointer"
        >
          <RotateCcw size={20} />
        </div>
      </div>

      {/* CENTER CANVAS */}
      <div className="flex-1 bg-gray-900 overflow-auto p-4">
        <div
          className={`grid ${
            1 + annotationSets.filter((s) => s.isVisible).length === 1
              ? "grid-cols-1"
              : 1 + annotationSets.filter((s) => s.isVisible).length === 2
                ? "grid-cols-2"
                : "grid-cols-2 md:grid-cols-3"
          } gap-4 w-full h-full`}
        >
          {/* MAIN VIEW */}
          <div className="relative bg-black/50 border border-indigo-500/50 rounded-lg overflow-hidden flex flex-col">
            <div className="absolute top-2 left-2 z-10 bg-indigo-600 text-white text-xs px-2 py-1 rounded shadow opacity-80 font-medium">
              {canDraw ? "Vùng làm việc chính" : "Chế độ xem (Read-only)"}
            </div>
            <div className="flex-1 relative overflow-hidden">
              <TransformWrapper
                ref={transformRef}
                disabled={activeTool === "RECT"}
              >
                <TransformComponent
                  wrapperStyle={{ width: "100%", height: "100%" }}
                >
                  <div
                    ref={imageContainerRef}
                    className="relative"
                    onMouseDown={handleMouseDown}
                    onMouseMove={handleMouseMove}
                    onMouseUp={handleMouseUp}
                    style={{
                      cursor:
                        activeTool === "RECT" && canDraw ? "crosshair" : "grab",
                    }}
                  >
                    <img
                      src={imgMeta.url}
                      alt="Main"
                      className="block pointer-events-none"
                      style={{ maxWidth: "100%", maxHeight: "80vh" }}
                    />
                    {currentBoxes.map((box, idx) => (
                      <div
                        key={idx}
                        className="absolute border-2 group hover:bg-white/10"
                        style={{
                          left: box.x,
                          top: box.y,
                          width: box.w,
                          height: box.h,
                          borderColor: box.color,
                        }}
                      >
                        <span
                          className="absolute -top-6 left-0 text-[10px] px-1.5 py-0.5 text-white font-bold rounded shadow"
                          style={{ backgroundColor: box.color }}
                        >
                          {
                            availableClasses.find((c) => c.id === box.labelId)
                              ?.name
                          }
                        </span>
                        {activeTool === "SELECT" && canDraw && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteBox(idx);
                            }}
                            className="absolute -top-3 -right-3 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center opacity-0 group-hover:opacity-100 z-10 text-[10px]"
                          >
                            <Trash2 size={12} />
                          </button>
                        )}
                      </div>
                    ))}
                    {tempBox && (
                      <div
                        className="absolute border-2 border-dashed border-white bg-white/20"
                        style={{
                          left: tempBox.x,
                          top: tempBox.y,
                          width: tempBox.w,
                          height: tempBox.h,
                        }}
                      />
                    )}
                  </div>
                </TransformComponent>
              </TransformWrapper>
            </div>
          </div>

          {/* REFERENCE VIEWS */}
          {annotationSets
            .filter((s) => s.isVisible)
            .map((set) => (
              <div
                key={set.id}
                className="relative bg-black/30 border border-gray-600 rounded-lg overflow-hidden flex flex-col"
              >
                <div className="absolute top-2 left-2 z-10 bg-gray-700 text-white text-xs px-2 py-1 rounded shadow opacity-80 flex items-center gap-1">
                  <History size={10} /> {set.labeledBy} ({set.status})
                </div>
                <div className="flex-1 flex items-center justify-center overflow-auto">
                  <div className="relative">
                    <img
                      src={imgMeta.url}
                      alt="Ref"
                      className="block max-w-full max-h-[80vh] opacity-80"
                    />
                    {convertDataToUI(set.data).map((box, idx) => (
                      <div
                        key={idx}
                        className="absolute border-2"
                        style={{
                          left: box.x,
                          top: box.y,
                          width: box.w,
                          height: box.h,
                          borderColor: box.color,
                        }}
                      >
                        <span
                          className="absolute -top-6 left-0 text-[10px] px-1.5 py-0.5 text-white font-bold rounded shadow"
                          style={{ backgroundColor: box.color }}
                        >
                          {
                            availableClasses.find((c) => c.id === box.labelId)
                              ?.name
                          }
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))}
        </div>
      </div>

      {/* RIGHT SIDEBAR */}
      <div className="w-80 bg-white border-l flex flex-col h-full shadow-xl z-20 shrink-0">
        <div className="p-4 border-b bg-gray-50 shrink-0">
          <h2 className="text-xs font-bold text-gray-500 uppercase mb-3 flex items-center gap-1">
            <Info size={14} /> Thông tin ảnh
          </h2>
          <div className="space-y-2 text-xs">
            <div className="flex items-center gap-2">
              <FileImage size={14} className="text-indigo-500" />
              <span className="font-semibold truncate w-48">
                {imgMeta.fileName}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <User size={14} className="text-gray-400" />
              <span>
                Upload:{" "}
                <span className="font-medium text-gray-700">
                  {imgMeta.uploader}
                </span>
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Calendar size={14} className="text-gray-400" />
              <span>
                Ngày: {new Date(imgMeta.date).toLocaleDateString("vi-VN")}
              </span>
            </div>
          </div>
        </div>

        {/* HISTORY LIST */}
        <div className="flex-1 overflow-y-auto p-4 min-h-0">
          <h3 className="flex items-center gap-2 font-semibold text-gray-700 mb-3 text-xs uppercase">
            <Grid2X2 size={14} /> Các lớp Label (Layers)
          </h3>
          <div className="space-y-3 pb-4">
            <div className="border border-indigo-200 bg-indigo-50 rounded p-2 mb-4">
              <div className="flex justify-between items-center mb-1">
                <span className="text-xs font-bold text-indigo-700">
                  Trạng thái
                </span>
                <span
                  className={`text-[10px] px-2 py-0.5 rounded font-bold 
                        ${
                          currentStatus === "APPROVED"
                            ? "bg-green-100 text-green-700"
                            : currentStatus === "SUBMITTED"
                              ? "bg-purple-100 text-purple-700"
                              : currentStatus === "REJECTED"
                                ? "bg-red-100 text-red-700"
                                : "bg-gray-200 text-gray-700"
                        }`}
                >
                  {currentStatus}
                </span>
              </div>
              {!canDraw ? (
                <div className="text-[10px] text-gray-500 italic">
                  Đang chờ duyệt hoặc đã xong.
                </div>
              ) : (
                <div className="text-[10px] text-green-600 font-medium">
                  Bạn có thể chỉnh sửa.
                </div>
              )}
            </div>

            {annotationSets.map((set) => {
              let statusText = "Chờ duyệt";
              let statusColor = "text-purple-600";
              let isDeprecatedItem = false;

              if (set.status === "APPROVED") {
                statusText = "Đã duyệt";
                statusColor = "text-green-600";
              } else if (set.status === "REJECTED") {
                statusText = "Bị từ chối";
                statusColor = "text-red-600";
              } else if (set.status === "IN_PROGRESS") {
                statusText = "Đang làm";
                statusColor = "text-orange-600";
              } else if (set.status === "DEPRECATED") {
                statusText = "Lạc hậu";
                statusColor = "text-gray-400 line-through";
                isDeprecatedItem = true;
              } else if (set.status === "AI") {
                statusText = "Gợi ý AI";
                statusColor = "text-blue-500";
              }

              return (
                <div
                  key={set.id}
                  className={`border rounded p-2 transition-all ${
                    isDeprecatedItem
                      ? "bg-gray-100 opacity-70"
                      : "bg-white hover:border-indigo-300"
                  } ${set.isVisible ? "ring-1 ring-indigo-500" : ""}`}
                >
                  <div className="flex justify-between items-start">
                    <div className="flex gap-2 items-start w-full">
                      <button
                        onClick={() => toggleSetVisibility(set.id)}
                        className="mt-0.5 text-gray-400 hover:text-indigo-600"
                        title="Bật/Tắt Layer"
                      >
                        {set.isVisible ? (
                          <Eye size={16} className="text-indigo-600" />
                        ) : (
                          <EyeOff size={16} />
                        )}
                      </button>

                      <div className="flex-1">
                        <div className="flex justify-between items-center">
                          <div className="text-xs font-bold text-gray-700">
                            {set.labeledBy}
                          </div>

                          <div className="flex items-center gap-1">
                            {set.status === "REJECTED" && (
                              <button
                                onClick={() =>
                                  setReasonPopup({
                                    show: true,
                                    type: "REJECT",
                                    reason: set.rejectReason || "Chưa có lý do",
                                    title: "Lý do Từ chối",
                                    author: set.labeledBy,
                                  })
                                }
                                className="text-red-500 hover:bg-red-50 p-1 rounded"
                                title="Xem lý do từ chối"
                              >
                                <AlertTriangle size={14} />
                              </button>
                            )}

                            {set.status === "DEPRECATED" && (
                              <button
                                onClick={() =>
                                  setReasonPopup({
                                    show: true,
                                    type: "DEPRECATE",
                                    reason:
                                      set.deprecationReason ||
                                      "Phiên bản cũ đã bị thay thế",
                                    title: "Lý do Lạc hậu",
                                  })
                                }
                                className="text-gray-400 hover:bg-gray-200 p-1 rounded"
                                title="Xem lý do lỗi thời"
                              >
                                <Clock size={14} />
                              </button>
                            )}

                            {set.status === "APPROVED" && (
                              <Menu
                                as="div"
                                className="relative inline-block text-left"
                              >
                                <Menu.Button className="text-gray-400 hover:text-gray-600 p-1">
                                  <MoreVertical size={12} />
                                </Menu.Button>
                                <Menu.Items className="absolute right-0 mt-1 w-32 bg-white rounded shadow-lg border z-50 focus:outline-none">
                                  <div className="p-1">
                                    <Menu.Item>
                                      {({ active }) => (
                                        <button
                                          onClick={() =>
                                            handleManualDeprecate(set)
                                          }
                                          className={`${
                                            active ? "bg-indigo-50" : ""
                                          } text-[10px] w-full text-left px-2 py-1.5 rounded flex items-center gap-1`}
                                        >
                                          <History size={10} /> Đánh dấu Lạc hậu
                                        </button>
                                      )}
                                    </Menu.Item>
                                  </div>
                                </Menu.Items>
                              </Menu>
                            )}
                          </div>
                        </div>
                        <div
                          className={`text-[10px] font-medium ${statusColor} mt-0.5`}
                        >
                          {statusText}
                        </div>
                        <div className="text-[9px] text-gray-400 mt-0.5">
                          {new Date(set.createdAt).toLocaleString("vi-VN")}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* CLASS SELECTOR & ACTIONS */}
        <div className="p-4 border-t bg-gray-50 space-y-3 shrink-0 z-30 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)]">
          {canDraw && (
            <div>
              <label className="text-[10px] font-bold text-gray-500 uppercase mb-1 block flex items-center justify-between">
                <span>Chọn loại bệnh</span>
                <button
                  onClick={() => {
                    setShowAddClass(!showAddClass);
                    if (!showAddClass) {
                      // Khi mở form thêm mới, xóa input cũ
                      setNewClassName("");
                    }
                  }}
                  className={`p-1.5 rounded transition-colors ${
                    showAddClass
                      ? "bg-indigo-600 text-white hover:bg-indigo-700"
                      : "bg-gray-100 text-indigo-600 hover:bg-gray-200"
                  }`}
                  title={showAddClass ? "Quay lại danh sách" : "Thêm lớp mới"}
                >
                  {showAddClass ? <ArrowLeft size={14} /> : <Plus size={14} />}
                </button>
              </label>

              {/* Add New Class Form - Only show when toggled */}
              {showAddClass ? (
                <div className="space-y-2">
                  <div className="flex gap-1">
                    <input
                      type="text"
                      value={newClassName}
                      onChange={(e) => setNewClassName(e.target.value)}
                      onKeyDown={(e) =>
                        e.key === "Enter" && handleAddNewClass()
                      }
                      placeholder="Nhập tên bệnh mới..."
                      className="flex-1 text-xs p-2 border rounded focus:ring-2 focus:ring-indigo-500 outline-none"
                      autoFocus
                    />
                  </div>
                  <button
                    onClick={handleAddNewClass}
                    className="w-full px-3 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 text-xs font-medium"
                  >
                    Thêm vào danh sách
                  </button>
                </div>
              ) : (
                /* Class Dropdown - Only show when not in add mode */
                <>
                  <select
                    value={selectedClassId}
                    onChange={(e) => setSelectedClassId(Number(e.target.value))}
                    className="w-full text-xs p-2 border rounded bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
                  >
                    {availableClasses.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </>
              )}
            </div>
          )}

          {canDraw && (
            <button
              onClick={handleSaveResult}
              className="w-full bg-indigo-600 text-white py-2.5 rounded text-xs font-bold hover:bg-indigo-700 flex justify-center gap-1 items-center transition shadow-sm"
            >
              <Save size={14} /> Lưu kết quả (Nộp bài)
            </button>
          )}

          {!isEditing && currentStatus === "SUBMITTED" && (
            <div className="flex gap-2">
              <button
                onClick={() => setShowRejectInput(true)}
                className="flex-1 bg-red-100 text-red-700 py-2.5 rounded text-xs font-bold hover:bg-red-200 flex justify-center gap-1 items-center transition"
              >
                <XCircle size={14} /> Từ chối
              </button>
              <button
                onClick={handleApproveClick}
                className="flex-1 bg-green-600 text-white py-2.5 rounded text-xs font-bold hover:bg-green-700 flex justify-center gap-1 items-center transition shadow-sm"
              >
                <CheckCircle size={14} /> Duyệt
              </button>
            </div>
          )}

          {!isEditing && currentStatus === "APPROVED" && (
            <button
              onClick={handleEditApprovedClick}
              className="w-full bg-white border border-indigo-600 text-indigo-600 py-2.5 rounded text-xs font-bold hover:bg-indigo-50 flex justify-center gap-1 items-center transition"
            >
              <Edit size={14} /> Chỉnh sửa lại
            </button>
          )}
        </div>
      </div>

      {/* CONFIRM MODAL */}
      {confirmModal.isOpen && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-sm animate-fade-in-up overflow-hidden">
            <div className="p-5">
              <div className="flex items-center gap-2 mb-3">
                <AlertCircle
                  className={`w-6 h-6 ${
                    confirmModal.isDanger ? "text-red-500" : "text-indigo-500"
                  }`}
                />
                <h3 className="font-bold text-lg text-gray-800">
                  {confirmModal.title}
                </h3>
              </div>
              <p className="text-sm text-gray-600 leading-relaxed">
                {confirmModal.message}
              </p>
            </div>
            <div className="bg-gray-50 px-5 py-3 flex justify-end gap-2 border-t">
              <button
                onClick={closeConfirm}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-100 transition"
              >
                Hủy bỏ
              </button>
              <button
                onClick={confirmModal.onConfirm}
                className={`px-4 py-2 text-sm font-medium text-white rounded transition shadow-sm ${
                  confirmModal.isDanger
                    ? "bg-red-600 hover:bg-red-700"
                    : "bg-indigo-600 hover:bg-indigo-700"
                }`}
              >
                {confirmModal.confirmLabel || "Xác nhận"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* REJECT INPUT */}
      {showRejectInput && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white p-6 rounded-lg shadow-xl w-96 animate-fade-in-up">
            <div className="flex items-center gap-2 text-red-600 font-bold mb-4">
              <XCircle size={20} /> Từ chối kết quả
            </div>
            <textarea
              className="w-full border p-2 rounded mb-4 text-sm h-24 focus:ring-2 focus:ring-red-500 outline-none"
              placeholder="Nhập lý do từ chối..."
              value={rejectReasonInput}
              onChange={(e) => setRejectReasonInput(e.target.value)}
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowRejectInput(false)}
                className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded"
              >
                Hủy
              </button>
              <button
                onClick={handleRejectSubmit}
                className="px-4 py-2 text-sm bg-red-600 text-white hover:bg-red-700 rounded font-medium"
              >
                Xác nhận
              </button>
            </div>
          </div>
        </div>
      )}

      {/* REASON POPUP */}
      {reasonPopup && reasonPopup.show && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white p-6 rounded-lg shadow-xl w-96 animate-fade-in-up">
            <div
              className={`flex items-center gap-2 font-bold mb-2 ${
                reasonPopup.type === "REJECT" ? "text-red-600" : "text-gray-500"
              }`}
            >
              {reasonPopup.type === "REJECT" ? (
                <AlertTriangle size={20} />
              ) : (
                <History size={20} />
              )}
              {reasonPopup.title}
            </div>

            {reasonPopup.author && (
              <p className="text-sm text-gray-600 mb-2">
                Bác sĩ <b>{reasonPopup.author}</b>:
              </p>
            )}

            <div
              className={`p-3 rounded text-sm border italic ${
                reasonPopup.type === "REJECT"
                  ? "bg-red-50 text-gray-800 border-red-100"
                  : "bg-gray-100 text-gray-700 border-gray-200"
              }`}
            >
              "{reasonPopup.reason}"
            </div>
            <div className="mt-4 text-right">
              <button
                onClick={() => setReasonPopup(null)}
                className="px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded text-sm font-medium"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LabelingWorkspace;
