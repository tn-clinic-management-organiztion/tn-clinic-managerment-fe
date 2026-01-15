import TextEditor from "@/components/editor/TextEditor";
import { uploadResultImage } from "@/services/results_image.api";
import {
  patchUpdateAiSaveAnnotation,
  postAiDetectFromFile,
  postAiSaveAnnotation,
} from "@/services/ai-core.api";
import { Input, SquareButton } from "@/components/ui/square";
import React, { useEffect, useRef, useState } from "react";
import {
  deleteRemoveResultImage,
  patchUpdateServiceResult,
  postCreateServiceResult,
  UpdateResultPayload,
} from "@/services/results";
import { cn } from "@/lib/utils";
import { FileUp, X } from "lucide-react";
import { AIModel } from "@/types/ai";
import { SingleSelected } from "@/components/select/SingleSelected";
import { BBoxPreview } from "@/components/bb-preview/BBoxPreview";
import { ServiceResult } from "@/types";
import { notifySuccess } from "@/components/toast";

type ImgState = {
  file?: File;
  previewUrl: string;
  aiLoading?: boolean;
  detections?: any[];
  model_name?: string;
  isExisting: boolean;
  image_id?: string;
};

export default function UpdateResultReportModal({
  open,
  onClose,
  serviceLabel,
  itemId,
  result,
  technicianId,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  serviceLabel: string;
  itemId: string | null;
  result: ServiceResult | null;
  technicianId: string | null;
  onSaved: (resultId: string) => void;
}) {
  // --- States ---
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [mainConclusion, setMainConclusion] = useState("");
  const [isAbnormal, setIsAbnormal] = useState(false);
  const [images, setImages] = useState<ImgState[]>([]);
  const [deletedImageIds, setDeletedImageIds] = useState<string[]>([]);
  const [activeIdx, setActiveIdx] = useState<number>(-1);
  const [zoomIdx, setZoomIdx] = useState<number | null>(null);
  const [selectedModel, setSelectedModel] = useState<string>(AIModel.YOLOV12M);

  const reportBodyRef = useRef<string>("");
  const previewUrlsToCleanup = useRef<string[]>([]);

  // --- 1. Load dữ liệu khi mở modal ---
  useEffect(() => {
    if (!open || !result) return;

    setErr(null);
    setSaving(false);
    setDeletedImageIds([]); 
    setMainConclusion(result.main_conclusion ?? "");
    setIsAbnormal(result.is_abnormal ?? false);
    reportBodyRef.current = result.report_body_html ?? "";

    const existingImgs: ImgState[] = (result.images ?? []).map((img) => ({
      image_id: img.image_id,
      previewUrl: img.original_image_url,
      isExisting: true,
      detections: img.annotations?.[0]?.annotation_data ?? [],
      model_name: img.annotations?.[0]?.ai_model_name ?? "yolov12n",
    }));

    setImages(existingImgs);
    setActiveIdx(existingImgs.length > 0 ? 0 : -1);
  }, [open, result]);

  // --- 2. Cleanup Blob URLs khi unmount hoặc đóng modal ---
  useEffect(() => {
    return () => {
      previewUrlsToCleanup.current.forEach((url) => URL.revokeObjectURL(url));
      previewUrlsToCleanup.current = [];
    };
  }, []);

  // --- 3. Handler: Chọn file mới ---
  const pickFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = Array.from(e.target.files ?? []);
    if (!picked.length) return;

    const newImgs: ImgState[] = picked.map((f) => {
      const url = URL.createObjectURL(f);
      previewUrlsToCleanup.current.push(url);
      return {
        file: f,
        previewUrl: url,
        isExisting: false,
        detections: undefined,
      };
    });

    setImages((prev) => [...prev, ...newImgs]);

    // Nếu chưa có ảnh nào được chọn, set activeIdx = ảnh đầu tiên trong danh sách mới
    if (activeIdx === -1 && images.length === 0) {
      setActiveIdx(0);
    }

    e.target.value = "";
  };

  // --- 4. Handler: Xóa ảnh ---
  const removeImage = (idx: number) => {
    const target = images[idx];

    if (target.isExisting && target.image_id) {
      // Ảnh cũ: Thêm vào danh sách chờ xóa
      setDeletedImageIds((prev) => [...prev, target.image_id!]);
    } else if (target.previewUrl.startsWith("blob:")) {
      // Ảnh mới: Revoke blob URL ngay
      URL.revokeObjectURL(target.previewUrl);
      previewUrlsToCleanup.current = previewUrlsToCleanup.current.filter(
        (url) => url !== target.previewUrl
      );
    }

    // Cập nhật danh sách ảnh
    setImages((prev) => prev.filter((_, i) => i !== idx));

    // Điều chỉnh activeIdx
    setActiveIdx((prevIdx) => {
      const newLength = images.length - 1;
      if (newLength === 0) return -1; // Không còn ảnh nào
      if (prevIdx === idx) {
        // Nếu đang xem ảnh bị xóa, chuyển sang ảnh trước đó hoặc ảnh đầu tiên
        return idx > 0 ? idx - 1 : 0;
      }
      if (prevIdx > idx) return prevIdx - 1; // Điều chỉnh index
      return prevIdx;
    });
  };

  // --- 5. Handler: Chạy AI ---
  const runAI = async (idx: number) => {
    const img = images[idx];

    // Kiểm tra xem có thể fetch được ảnh không
    if (!img.file && !img.previewUrl) {
      setErr("Không thể chạy AI: Thiếu file hoặc URL ảnh");
      return;
    }

    setImages((prev) =>
      prev.map((x, i) => (i === idx ? { ...x, aiLoading: true } : x))
    );

    try {
      let detections;

      if (img.file) {
        // Ảnh mới: Dùng file trực tiếp
        const res = await postAiDetectFromFile(img.file, selectedModel, 0.25);
        detections = res?.detections ?? res?.data?.detections ?? [];
      } else {
        // Ảnh cũ: Fetch từ URL rồi chuyển thành File
        const response = await fetch(img.previewUrl);
        const blob = await response.blob();
        const file = new File([blob], "temp-image.jpg", { type: blob.type });

        const res = await postAiDetectFromFile(file, selectedModel, 0.25);
        detections = res?.detections ?? res?.data?.detections ?? [];
      }

      setImages((prev) =>
        prev.map((x, i) =>
          i === idx
            ? { ...x, detections, aiLoading: false, model_name: selectedModel }
            : x
        )
      );

      setActiveIdx(idx);
    } catch (e: any) {
      setErr("AI Detect lỗi: " + (e.message || "Unknown error"));
      setImages((prev) =>
        prev.map((x, i) => (i === idx ? { ...x, aiLoading: false } : x))
      );
    }
  };

  // --- 6. Handler: Lưu ---
  const save = async () => {
    if (!result?.result_id) return;
    setSaving(true);
    setErr(null);

    try {
      const resId = result.result_id;

      // Bước A: Cập nhật thông tin cơ bản
      const updatePayload: UpdateResultPayload = {
        technician_id: technicianId!,
        main_conclusion: mainConclusion.trim(),
        report_body_html: reportBodyRef.current,
        is_abnormal: isAbnormal,
      };
      await patchUpdateServiceResult(resId, updatePayload);

      // Bước B: Xóa ảnh đã đánh dấu
      if (deletedImageIds.length > 0) {
        await Promise.all(
          deletedImageIds.map((id) => deleteRemoveResultImage(id))
        );
      }

      // Bước C: Xử lý ảnh (upload mới + update annotation cũ)
      await Promise.all(
        images.map(async (img) => {
          if (!img.isExisting && img.file) {
            const upRes = await uploadResultImage(
              img.file,
              technicianId!,
              resId
            );
            const newImgId = upRes?.data?.image_id ?? upRes?.image_id;

            if (newImgId && img.detections) {
              await postAiSaveAnnotation({
                image_id: newImgId,
                detections: img.detections,
                model_name: img.model_name || selectedModel,
              });
            }
          } else if (img.isExisting && img.image_id && img.detections) {
            // Cập nhật annotation cho ảnh cũ
            await patchUpdateAiSaveAnnotation({
              image_id: img.image_id,
              detections: img.detections,
              model_name: img.model_name,
            });
          }
        })
      );
      notifySuccess("Cập nhật báo cáo thành công!");
      onSaved(resId);
      onClose();
    } catch (e: any) {
      console.error(e);
      setErr(
        e.response?.data?.message || e.message || "Lỗi khi cập nhật báo cáo."
      );
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  const showAiPanel = activeIdx >= 0 && !!images[activeIdx]?.detections?.length;

  return (
    <div className="fixed inset-0 z-[55] bg-black/40 flex items-center justify-center p-4">
      <div
        className={cn(
          "w-full bg-white border border-secondary-200 rounded-[2px] overflow-hidden flex flex-col",
          showAiPanel ? "max-w-6xl" : "max-w-3xl"
        )}
        style={{ maxHeight: "calc(100vh - 4rem)" }}
      >
        {/* Header */}
        <div className="h-12 bg-primary-800 text-white px-3 flex items-center justify-between">
          <div className="text-xs font-bold uppercase tracking-wide">
            Báo cáo kết quả • {serviceLabel}
          </div>
          <button
            className="p-2 hover:bg-white/10 rounded-[2px]"
            onClick={onClose}
          >
            <X size={16} />
          </button>
        </div>
        {/* Body */}
        <div className="overflow-y-auto">
          <div
            className={cn(
              "p-3 grid gap-3",
              showAiPanel ? "grid-cols-12" : "grid-cols-12"
            )}
          >
            {err && (
              <div
                className={cn(
                  "text-xs text-error-700 bg-error-50 border border-error-200 p-2 rounded-[2px]",
                  showAiPanel ? "col-span-12" : "col-span-12"
                )}
              >
                {err}
              </div>
            )}

            {/* LEFT AI VISUALIZER */}
            {showAiPanel && (
              <div className="col-span-5">
                <div className="text-[11px] uppercase font-bold text-secondary-500 mb-2">
                  AI Visualize
                </div>
                <BBoxPreview
                  imageUrl={images[activeIdx].previewUrl}
                  detections={images[activeIdx].detections ?? []}
                />
                <div className="mt-2 text-[11px] text-secondary-500">
                  Detections: {images[activeIdx].detections?.length ?? 0} -
                  Model: {images[activeIdx].model_name}
                </div>
              </div>
            )}

            {/* RIGHT FORM */}
            <div
              className={cn(
                showAiPanel ? "col-span-7" : "col-span-12",
                "overflow-y-auto"
              )}
            >
              {/* UPLOAD AREA */}
              <div className="border border-secondary-200 rounded-[2px] bg-bg-content p-3">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-bold uppercase text-secondary-600">
                    Ảnh kết quả
                  </div>
                  <label className="inline-flex items-center gap-2 text-xs cursor-pointer">
                    <FileUp size={14} />
                    <span className="font-semibold">Chọn ảnh</span>
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      className="hidden"
                      onChange={pickFiles}
                    />
                  </label>
                </div>

                {images.length === 0 ? (
                  <div className="mt-2 text-xs text-secondary-500">
                    Chưa chọn ảnh.
                  </div>
                ) : (
                  <div className="flex flex-col w-full gap-3">
                    <div className="w-full mt-3 grid grid-cols-3 gap-2">
                      {images.map((img, idx) => (
                        <div
                          key={`${img.previewUrl}-${idx}`}
                          className={cn(
                            "border border-secondary-200 bg-white rounded-[2px] overflow-hidden",
                            idx === activeIdx && "ring-2 ring-primary-200"
                          )}
                          onClick={() => {
                            setActiveIdx(idx);
                          }}
                        >
                          <button
                            className="w-full"
                            onClick={() => {
                              setActiveIdx(idx);
                              setZoomIdx(idx);
                            }}
                            title="Click để phóng to"
                          >
                            <img
                              src={img.previewUrl}
                              alt="thumb"
                              className="w-full h-28 object-cover"
                            />
                          </button>

                          <div className="p-2 flex items-center gap-2">
                            <SquareButton
                              className="bg-primary-600 hover:bg-primary-700 border-primary-700 text-white"
                              onClick={() => runAI(idx)}
                              disabled={!!img.aiLoading}
                              title="Chạy AI detect"
                            >
                              {img.aiLoading ? "AI..." : "AI"}
                            </SquareButton>

                            <SquareButton
                              className="bg-secondary-100 hover:bg-secondary-200 border-secondary-200 text-secondary-900"
                              onClick={() => removeImage(idx)}
                              title="Xóa ảnh"
                            >
                              Xóa
                            </SquareButton>

                            <div className="ml-auto text-[11px] text-secondary-500">
                              {img.detections
                                ? `${img.detections.length} box`
                                : "chưa AI"}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                    <div>
                      <SingleSelected
                        className="border-secondary-900"
                        selection={Object.values(AIModel)}
                        value={selectedModel}
                        onValueChange={setSelectedModel}
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Kết luận */}
              <div className="mt-3">
                <div className="text-[11px] uppercase font-bold text-secondary-500">
                  Kết luận chính
                </div>
                <Input
                  value={mainConclusion}
                  onChange={(e) => setMainConclusion(e.target.value)}
                  placeholder="Kết luận chính..."
                />
              </div>

              {/* Body (TinyMCE) */}
              <div className="mt-3">
                <div className="text-[11px] uppercase font-bold text-secondary-500">
                  Mô tả
                </div>
                <TextEditor
                  initialValue={reportBodyRef.current}
                  onChange={(html) => {
                    reportBodyRef.current = html;
                  }}
                />
              </div>

              <div className="mt-3 flex items-center gap-3">
                <label className="inline-flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={isAbnormal}
                    onChange={(e) => setIsAbnormal(e.target.checked)}
                  />
                  <span className="font-semibold text-secondary-700">
                    Kết quả bất thường
                  </span>
                </label>
              </div>

              <div className="mt-4 flex justify-end gap-2">
                <SquareButton
                  className="bg-secondary-100 hover:bg-secondary-200 border-secondary-200 text-secondary-900"
                  onClick={onClose}
                  disabled={saving}
                >
                  Hủy
                </SquareButton>

                <SquareButton
                  className="bg-primary-600 hover:bg-primary-700 border-primary-700 text-white"
                  onClick={save}
                  disabled={saving}
                >
                  {saving ? "Đang lưu..." : "Lưu báo cáo"}
                </SquareButton>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ZOOM OVERLAY */}
      {zoomIdx != null && images[zoomIdx] && (
        <div
          className="fixed inset-0 z-[90] bg-black/70 flex items-center justify-center p-6"
          onClick={() => setZoomIdx(null)}
        >
          <div
            className="max-w-5xl w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-white border border-secondary-200 rounded-[2px] overflow-hidden">
              <div className="p-2 bg-bg-content border-b border-secondary-200 flex justify-between items-center">
                <div className="text-xs font-bold uppercase text-secondary-700">
                  Preview ảnh
                </div>
                <button
                  className="p-2 hover:bg-secondary-100 border border-secondary-200 rounded-[2px]"
                  onClick={() => setZoomIdx(null)}
                >
                  <X size={16} />
                </button>
              </div>
              <div className="p-3">
                <BBoxPreview
                  imageUrl={images[zoomIdx].previewUrl}
                  detections={images[zoomIdx].detections ?? []}
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
