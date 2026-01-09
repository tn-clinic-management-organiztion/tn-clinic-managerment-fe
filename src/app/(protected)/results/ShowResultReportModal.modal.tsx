import React, { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { X, ZoomIn, CheckCircle2, AlertCircle } from "lucide-react";
import { SquareButton } from "@/components/ui/square";
import { BBoxPreview } from "@/components/bb-preview/BBoxPreview";
import { ServiceResult } from "@/types";

// ---------- Modal ----------
export default function ShowResultReportModal(props: {
  open: boolean;
  onClose: () => void;
  result: ServiceResult | null;
  serviceLabel: string;
}) {
  const [activeIdx, setActiveIdx] = useState<number>(-1);
  const [zoomIdx, setZoomIdx] = useState<number | null>(null);
  useEffect(() => {
    if (!props.open) {
      setActiveIdx(-1);
      setZoomIdx(null);
    }
  }, [props.open]);

  if (!props.open || !props.result) return null;

  const { result } = props;
  const images = result.images ?? [];
  const hasImages = images.length > 0;

  // Tìm ảnh có annotation để hiển thị panel
  const imageWithAnnotation = activeIdx >= 0 ? images[activeIdx] : null;
  // annotation đầu tiên trong mảng
  const firstAnnotation = imageWithAnnotation?.annotations?.[0];

  const showAiPanel =
    firstAnnotation?.annotation_data &&
    firstAnnotation.annotation_data.length > 0;

  const fmt = (v?: string | null) => {
    if (!v) return "--";
    const d = new Date(v);
    if (Number.isNaN(d.getTime())) return "--";
    return d.toLocaleString("vi-VN");
  };

  return (
    <div className="fixed inset-0 z-[80] bg-black/40 flex items-center justify-center p-4">
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
            Kết quả báo cáo • {props.serviceLabel}
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
            {/* LEFT AI VISUALIZER */}
            {showAiPanel && imageWithAnnotation && (
              <div className="col-span-5">
                <div className="text-[11px] uppercase font-bold text-secondary-500 mb-2">
                  AI Annotation
                </div>
                <BBoxPreview
                  imageUrl={imageWithAnnotation.original_image_url}
                  detections={
                    imageWithAnnotation.annotations?.[0].annotation_data ?? []
                  }
                />
                <div className="mt-2 space-y-1">
                  <div className="text-[11px] text-secondary-500">
                    Model:{" "}
                    {imageWithAnnotation.annotations?.[0]?.ai_model_name ?? "N/A"}
                  </div>
                  <div className="text-[11px] text-secondary-500">
                    Detections:{" "}
                    {imageWithAnnotation.annotations?.[0].annotation_data?.length ??
                      0}{" "}
                    objects
                  </div>
                </div>
              </div>
            )}

            {/* RIGHT CONTENT */}
            <div
              className={cn(
                showAiPanel ? "col-span-7" : "col-span-12",
                "space-y-3"
              )}
            >
              {/* Thông tin cơ bản */}
              <div className="border border-secondary-200 rounded-[2px] bg-bg-content p-3">
                <div className="text-xs font-bold uppercase text-secondary-600 mb-2">
                  Thông tin báo cáo
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex items-start gap-2">
                    <span className="text-secondary-500 min-w-[100px]">
                      Thời gian:
                    </span>
                    <span className="font-semibold text-secondary-800">
                      {fmt(result.result_time)}
                    </span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="text-secondary-500 min-w-[100px]">
                      Trạng thái:
                    </span>
                    <span
                      className={cn(
                        "inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[11px] font-semibold",
                        result.is_abnormal
                          ? "bg-error-50 text-error-700 border-error-200"
                          : "bg-success-50 text-success-700 border-success-200"
                      )}
                    >
                      {result.is_abnormal ? (
                        <>
                          <AlertCircle size={12} />
                          Bất thường
                        </>
                      ) : (
                        <>
                          <CheckCircle2 size={12} />
                          Bình thường
                        </>
                      )}
                    </span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="text-secondary-500 min-w-[100px]">
                      Result ID:
                    </span>
                    <span className="font-mono text-xs text-secondary-600">
                      {result.result_id}
                    </span>
                  </div>
                </div>
              </div>

              {/* Kết luận chính */}
              {result.main_conclusion && (
                <div className="border border-secondary-200 rounded-[2px] bg-white p-3">
                  <div className="text-[11px] uppercase font-bold text-secondary-500 mb-2">
                    Kết luận chính
                  </div>
                  <div className="text-sm text-secondary-800">
                    {result.main_conclusion}
                  </div>
                </div>
              )}

              {/* Mô tả chi tiết */}
              {result.report_body_html && (
                <div className="border border-secondary-200 rounded-[2px] bg-white p-3">
                  <div className="text-[11px] uppercase font-bold text-secondary-500 mb-2">
                    Mô tả chi tiết
                  </div>
                  <div
                    className="prose prose-sm max-w-none text-secondary-800"
                    dangerouslySetInnerHTML={{
                      __html: result.report_body_html,
                    }}
                  />
                </div>
              )}

              {/* Hình ảnh */}
              {hasImages && (
                <div className="border border-secondary-200 rounded-[2px] bg-bg-content p-3">
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-xs font-bold uppercase text-secondary-600">
                      Hình ảnh ({images.length})
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    {images.map((img, idx) => {
                      const hasAnnotation =
                        img.annotations?.[0].annotation_data &&
                        img.annotations[0].annotation_data.length > 0;

                      return (
                        <div
                          key={img.image_id}
                          className={cn(
                            "border border-secondary-200 bg-white rounded-[2px] overflow-hidden cursor-pointer transition-all",
                            idx === activeIdx && "ring-2 ring-primary-200",
                            hasAnnotation && "ring-1 ring-success-300"
                          )}
                          onClick={() => {
                            setActiveIdx(idx);
                            if (hasAnnotation) {
                              // Nếu có annotation, chỉ active để hiển thị panel
                              // Không zoom ngay
                            }
                          }}
                        >
                          <div className="relative">
                            <img
                              src={img.original_image_url}
                              alt={img.file_name ?? `Image ${idx + 1}`}
                              className="w-full h-28 object-cover"
                            />
                            {hasAnnotation && (
                              <div className="absolute top-1 right-1 bg-success-600 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full">
                                AI
                              </div>
                            )}
                          </div>

                          <div className="p-2 flex items-center justify-between">
                            <div className="text-[10px] text-secondary-500 truncate flex-1">
                              {img.file_name ?? `Image ${idx + 1}`}
                            </div>
                            <button
                              className="ml-2 p-1 hover:bg-secondary-100 rounded-[2px]"
                              onClick={(e) => {
                                e.stopPropagation();
                                setZoomIdx(idx);
                              }}
                              title="Phóng to"
                            >
                              <ZoomIn
                                size={12}
                                className="text-secondary-600"
                              />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Nút đóng */}
              <div className="flex justify-end">
                <SquareButton
                  className="bg-secondary-100 hover:bg-secondary-200 border-secondary-200 text-secondary-900"
                  onClick={props.onClose}
                >
                  Đóng
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
                  {images[zoomIdx].file_name ?? `Image ${zoomIdx + 1}`}
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
                  imageUrl={images[zoomIdx].original_image_url}
                  detections={
                    images[zoomIdx].annotations?.[0].annotation_data ?? []
                  }
                />
                {images[zoomIdx].annotations?.[0].annotation_data &&
                  images[zoomIdx].annotations![0].annotation_data.length > 0 && (
                    <div className="mt-2 text-xs text-secondary-600">
                      Model: {images[zoomIdx].annotations?.[0].ai_model_name ?? "N/A"}{" "}
                      • {images[zoomIdx].annotations![0].annotation_data.length}{" "}
                      detections
                    </div>
                  )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
