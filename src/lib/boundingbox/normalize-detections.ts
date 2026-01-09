import { NormalizedDetection } from "@/types/ai";

export function normalizeDetections(apiResponse: any): NormalizedDetection[] {
  let annotation_data: any[] = [];
  // Trường hợp 1: response là mảng detections luôn
  if (Array.isArray(apiResponse)) {
    annotation_data = apiResponse;
  }
  // Trường hợp 2: có .data.detections
  else if (
    apiResponse?.data?.detections &&
    Array.isArray(apiResponse.data.detections)
  ) {
    annotation_data = apiResponse.data.detections;
  }
  // Trường hợp 3: có .detections trực tiếp
  else if (apiResponse?.detections && Array.isArray(apiResponse.detections)) {
    annotation_data = apiResponse.detections;
  }

  return annotation_data
    .map((d: any) => {
      const b = d?.bbox;
      if (!b) return null;

      const x1 = Number(b.x1 ?? b[0]);
      const y1 = Number(b.y1 ?? b[1]);
      const x2 = Number(b.x2 ?? b[2]);
      const y2 = Number(b.y2 ?? b[3]);

      if (![x1, y1, x2, y2].every(Number.isFinite)) return null;
      return {
        x1,
        y1,
        x2,
        y2,
        label: d?.class?.name ?? d?.class_name ?? "Unknown",
        confidence: Number(d?.confidence ?? d?.class?.score ?? 0),
        classId: Number(d?.class?.id ?? -1),
      } as NormalizedDetection;
    })
    .filter(Boolean) as NormalizedDetection[];
}