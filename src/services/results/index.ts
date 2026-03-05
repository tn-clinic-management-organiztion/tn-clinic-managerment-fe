import axiosInstance from "@/lib/http/client";

export interface CreateResultPayload {
  request_item_id: string;
  technician_id: string;
  main_conclusion?: string;
  report_body_html?: string;
  is_abnormal?: boolean;
}

export interface UpdateResultPayload {
  technician_id: string;
  main_conclusion?: string;
  report_body_html?: string;
  is_abnormal?: boolean;
}

export const postCreateServiceResult = async (payload: CreateResultPayload) => {
  try {
    const response = await axiosInstance.post("/paraclinical/results", payload);
    return response.data.data;
  } catch (error) {
    console.error("Create result service error: ", error);
    throw error;
  }
};

export const patchUpdateServiceResult = async (
  resultId: string,
  payload: UpdateResultPayload,
) => {
  try {
    const response = await axiosInstance.patch(
      `/paraclinical/results/${resultId}`,
      payload,
    );
    return response.data.data;
  } catch (error) {
    console.error("Update result service error:", error);
    throw error;
  }
};

export const deleteRemoveResultImage = async (image_id: string) => {
  try {
    const response = await axiosInstance.delete(
      `/paraclinical/results/images/${image_id}`,
    );
    return response.data.data;
  } catch (error) {
    console.error("Create result service error: ", error);
    throw error;
  }
};

export const getFindResultByRequestItemId = async (request_item_id: string) => {
  try {
    const response = await axiosInstance.get("/paraclinical/results", {
      params: { request_item_id: request_item_id },
    });
    return response.data.data;
  } catch (error) {
    console.error("Get service result by request_item_id error: ", error);
    throw error;
  }
};

export const getTicketItems = async (ticketId: string) => {
  try {
    const response = await axiosInstance.get(
      `/queue/tickets/${ticketId}/items`,
    );
    console.log("data getTicketItems: ", response);
    return response.data.data;
  } catch (error) {
    console.error("Get ticket items error:", error);
    throw error;
  }
};
