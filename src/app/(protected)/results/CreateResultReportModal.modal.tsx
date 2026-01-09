import TextEditor from "@/components/editor/TextEditor";
import { uploadResultImage } from "@/services/results_image.api";
import {
  postAiDetectFromFile,
  postAiSaveAnnotation,
} from "@/services/ai-core.api";
import { Input, SquareButton } from "@/components/ui/square";
import React, { useEffect, useState } from "react";
import { postCreateServiceResults } from "@/services/results";
import { cn } from "@/lib/utils";
import { FileUp, X } from "lucide-react";
import { AIModel, NormalizedDetection } from "@/types/ai";
import { SingleSelected } from "@/components/select/SingleSelected";
import { BBoxPreview } from "@/components/bb-preview/BBoxPreview";


// ---------- modal ----------
export default function CreateResultReportModal(props: {
  open: boolean;
  onClose: () => void;

  serviceLabel: string;
  itemId: string | null;

  technicianId: string | null;

  // save callback
  onSaved: (resultId: string) => void;
}) {
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [mainConclusion, setMainConclusion] = useState("");
  const reportBodyRef = React.useRef<string>("");
  useEffect(() => {
    if (!props.open) return;
    reportBodyRef.current = "<p>Mẫu báo cáo...</p>";
  }, [props.open]);
  const [isAbnormal, setIsAbnormal] = useState(false);

  // images state: preview + ai dets + uploaded info
  type ImgState = {
    file: File;
    previewUrl: string;
    aiLoading?: boolean;
    detections?: any[];
    model_name?: string;
    uploaded?: {
      image_id: string;
      original_image_url: string;
      public_id?: string;
      file_name?: string;
      file_size?: string;
      mime_type?: string;
    };
  };

  const [images, setImages] = useState<ImgState[]>([]);
  const [activeIdx, setActiveIdx] = useState<number>(-1); // ảnh đang xem bbox
  const [zoomIdx, setZoomIdx] = useState<number | null>(null); // overlay phóng to

  useEffect(() => {
    if (!props.open) return;
    setErr(null);
    setSaving(false);
    setMainConclusion("");
    setIsAbnormal(false);
    setImages([]);
    setActiveIdx(-1);
    setZoomIdx(null);
  }, [props.open]);

  // 1. Thêm useRef để lưu trữ danh sách URL cần cleanup
  const previewUrlsRef = React.useRef<string[]>([]);

  // 2. Mỗi khi images thay đổi, cập nhật ref (để dành cho lúc unmount thì xóa)
  useEffect(() => {
    previewUrlsRef.current = images.map((img) => img.previewUrl);
  }, [images]);

  // 3. Cleanup CHỈ KHI component unmount (tắt hẳn Modal)
  useEffect(() => {
    return () => {
      previewUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
    };
  }, []);
  const pickFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = Array.from(e.target.files ?? []);
    if (!picked.length) return;

    setImages((prev) => [
      ...prev,
      ...picked.map((f) => ({
        file: f,
        previewUrl: URL.createObjectURL(f),
        detections: undefined,
      })),
    ]);

    if (activeIdx === -1) setActiveIdx(0);
    e.target.value = "";
  };

  const removeImage = (idx: number) => {
    // 1. Lấy ảnh cần xóa và revoke URL ngay lập tức
    const imgToRemove = images[idx];
    if (imgToRemove) {
      URL.revokeObjectURL(imgToRemove.previewUrl);
    }

    // 2. Cập nhật state sau khi đã revoke
    setImages((prev) => prev.filter((_, i) => i !== idx));

    // 3. Xử lý index active
    setActiveIdx((p) => {
      if (p === idx) return -1;
      if (p > idx) return p - 1;
      return p;
    });
  };

  // State models
  const [selectedModel, setSelectedModel] = useState<string>(AIModel.YOLOV12M);

  const runAI = async (idx: number) => {
    const img = images[idx];
    if (!img) return;

    setImages((prev) =>
      prev.map((x, i) => (i === idx ? { ...x, aiLoading: true } : x))
    );
    try {
      const res = await postAiDetectFromFile(img.file, selectedModel, 0.25);
      console.log("AI detect result: ", res);
      const dets = res?.detections ?? res?.data?.detections ?? [];
      setImages((prev) =>
        prev.map((x, i) =>
          i === idx
            ? {
                ...x,
                detections: dets,
                aiLoading: false,
                model_name: selectedModel,
              }
            : x
        )
      );
      setActiveIdx(idx); // mở panel bbox
    } catch (e: any) {
      console.error(e);
      setImages((prev) =>
        prev.map((x, i) => (i === idx ? { ...x, aiLoading: false } : x))
      );
      setErr(e?.message ?? "AI detect thất bại.");
    }
  };

  const save = async () => {
    if (!props.itemId) return setErr("Thiếu request_item_id.");
    if (!props.technicianId)
      return setErr("Thiếu technician_id trong session.");

    setSaving(true);
    setErr(null);

    try {
      // 1) create service_results
      const dto = {
        request_item_id: props.itemId,
        technician_id: props.technicianId,
        main_conclusion: mainConclusion.trim() || undefined,
        report_body_html: reportBodyRef.current || undefined,
        is_abnormal: isAbnormal,
      };

      const created = await postCreateServiceResults(dto as any);
      const resultId = created?.result_id ?? created?.id ?? String(created);

      // 2) upload images -> có image_id + original_image_url
      const uploaded = await Promise.all(
        images.map(async (img) => {
          const up = await uploadResultImage(
            img.file,
            props.technicianId!,
            resultId
          );
          const payload = up?.data ?? up;
          return { img, payload };
        })
      );

      // 3) save annotation to DB (không rerun AI)
      // nếu ảnh chưa run AI thì detections = []
      await Promise.all(
        uploaded.map(async ({ img, payload }) => {
          const imageId = payload?.image_id ?? payload?.data?.image_id;
          if (!imageId) return;

          const dets = img.detections ?? [];

          await postAiSaveAnnotation({
            image_id: imageId,
            detections: dets,
            model_name: img.model_name,
          });
        })
      );

      props.onSaved(resultId);
      props.onClose();
    } catch (e: any) {
      console.error(e);
      setErr(
        e?.response?.data?.message ?? e?.message ?? "Lưu báo cáo thất bại."
      );
    } finally {
      setSaving(false);
    }
  };

  if (!props.open) return null;

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
            Báo cáo kết quả • {props.serviceLabel}
          </div>
          <button
            className="p-2 hover:bg-white/10 rounded-[2px]"
            onClick={props.onClose}
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
                          key={`${img.file.name}-${idx}`}
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
                  onClick={props.onClose}
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
