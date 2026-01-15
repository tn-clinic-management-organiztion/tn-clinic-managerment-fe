import axiosInstance from "@/lib/http/client";

export const uploadResultImage = async (
  file: File,
  uploadedBy: string,
  resultId?: string
) => {
  const { width, height } = await getImageSize(file);

  const formData = new FormData();
  formData.append("file", file);
  formData.append("uploaded_by", uploadedBy);
  formData.append("image_width", String(width));
  formData.append("image_height", String(height));

  if (resultId) formData.append("result_id", resultId);

  const res = await axiosInstance.post(`results/images/upload`, formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });

  return res.data;
};

export const getImageSize = (
  file: File
): Promise<{ width: number; height: number }> => {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith("image/")) {
      reject(new Error("File không phải ảnh"));
      return;
    }

    const url = URL.createObjectURL(file);
    const img = new Image();

    img.onload = () => {
      const size = { width: img.naturalWidth, height: img.naturalHeight };
      URL.revokeObjectURL(url);
      resolve(size);
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Không đọc được ảnh"));
    };

    img.src = url;
  });
};
