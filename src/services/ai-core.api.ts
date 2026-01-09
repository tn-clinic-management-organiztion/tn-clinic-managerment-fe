import axiosInstance from "@/lib/http/client";

// 1. Get List Result Images
export const getListResultImages = async (
  page = 1,
  limit = 8,
  statusFilter = "",
  search = ""
) => {
  const params: any = { page, limit };
  if (statusFilter) {
    params.status = statusFilter;
  }

  if (search) {
    params.search = search;
  }
  try {
    const res = await axiosInstance.get(`/ai-core/result-images`, { params });
    
    const body = res.data || {};
    return body.data ? body.data : body;
  } catch (error) {
    console.error("Error fetching list:", error);
    return { items: [], meta: { total_pages: 1, total_items: 0 } };
  }
};

// 2. Get Detail
export const getResultImageDetail = async (image_id: string) => {
  try {
    const res = await axiosInstance.get(`/ai-core/result-images/${image_id}`);
    const body = res.data || {};
    return body.data ? body.data : body;
  } catch (error) {
    console.error("Error get detail:", error);
    throw error;
  }
};

// 3. Save / Upsert (Tạo bản ghi mới hoặc update draft)
export const saveHumanAnnotation = async (image_id: string, payload: any) => {
  try {
    const res = await axiosInstance.post(
      `/ai-core/result-images/${image_id}/human-annotations`,
      payload
    );
    return res.data;
  } catch (error) {
    console.error("Error save:", error);
    throw error;
  }
};

// 4. Approve
export const approveHumanAnnotation = async (
  image_id: string,
  payload: any
) => {
  try {
    const res = await axiosInstance.patch(
      `/ai-core/result-images/${image_id}/approve`,
      payload
    );
    return res.data;
  } catch (error) {
    console.error("Error approve:", error);
    throw error;
  }
};

// 5. Reject (Lưu lý do reject)
export const rejectHumanAnnotation = async (
  image_id: string,
  payload: { rejected_by: string; reason: string }
) => {
  try {
    const res = await axiosInstance.patch(
      `/ai-core/result-images/${image_id}/reject`,
      payload
    );
    return res.data;
  } catch (error) {
    console.error("Error reject:", error);
    throw error;
  }
};

// 6. Deprecate
// Dùng khi muốn đánh dấu thủ công 1 bản ghi Approved là lỗi thời
export const setAnnotationDeprecated = async (
  annotation_id: string,
  reason: string
) => {
  try {
    const res = await axiosInstance.patch(
      `/ai-core/annotations/${annotation_id}/deprecate`,
      { reason }
    );
    return res.data;
  } catch (error) {
    console.error("Error deprecate:", error);
    throw error;
  }
};

// ========================== Sử dụng để demo
export const postAiDetectFromFile = async (
  file: File,
  model_name = "yolov12n",
  confidence = 0.25
) => {
  const fd = new FormData();
  fd.append("file", file);
  fd.append("model_name", model_name);
  fd.append("confidence", String(confidence));

  const res = await axiosInstance.post("ai-core/detect/image", fd, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return res.data; // { detections, image_info, ... }
};

export const postAiSaveAnnotation = async (payload: {
  image_id: string;
  detections: any;
  model_name?: string;
}) => {
  const res = await axiosInstance.post("ai-core/annotations", payload);
  return res.data;
};

export const postDownloadAnnotation = async (dto: any) => {
  try {
    const res = await axiosInstance.post(
      "/ai-core/export/yolo.zip",
      dto,
      {
        responseType: "blob",
      }
    );

    // filename từ header
    const disposition = res.headers["content-disposition"] || "";
    const match = disposition.match(/filename="(.+?)"/);
    const filename = match?.[1] ?? "yolo_export.zip";

    // tạo file download
    const blob = new Blob([res.data], { type: "application/zip" });
    const url = window.URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();

    window.URL.revokeObjectURL(url);
  } catch (error) {
    console.error("Tải annotation thất bại: ", error);
    throw error;
  }
};
