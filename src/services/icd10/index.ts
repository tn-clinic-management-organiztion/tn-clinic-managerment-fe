import axiosInstance from "@/lib/http/client";

export const getAllIcd10 = async (
  params: { search?: string; page?: number; limit?: number },
  signal?: AbortSignal
) => {
  try {
    const response = await axiosInstance.get("/system/icd10", {
      params,
      signal
    });
    return response.data;
  } catch (error) {
    console.error("Lấy danh sách thuốc lỗi!");
    throw error;
  }
};
