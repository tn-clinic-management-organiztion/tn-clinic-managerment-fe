import axiosInstance from "@/lib/http/client";
import { CreateServiceRequestPayload } from "@/types";
import { PageQueryDto } from "@/types/pagination";

export interface QueryServiceDto extends PageQueryDto {
  category_id?: number | null;
}

export interface QueryCategoryDto extends PageQueryDto {
  parent_id?: number;
  is_system_root?: boolean;
}

export const getAllServices = async (query: QueryServiceDto) => {
  try {
    const response = await axiosInstance.get("/services", {
      params: query,
    });
    return response.data.data;
  } catch (error: any) {
    console.error("Find services error: ", error);
    throw error;
  }
};

export const getAllServiceCategories = async (dto: QueryCategoryDto) => {
  try {
    const response = await axiosInstance.get("/services/categories", {
      params: dto,
    });
    return response.data.data;
  } catch (error) {
    console.error("Find service categories error: ", error);
    throw error;
  }
};

export const getRoomsForService = async (serviceId: string) => {
  try {
    const response = await axiosInstance.get(
      `/services/room-service/${serviceId}/rooms`
    );
    return response.data.data;
  } catch (error) {
    console.error("Find room for service error: ", error);
    throw error;
  }
};

export const getAssignedServicesByEncounter = async (encounterId: string) => {
  try {
    const res = await axiosInstance.get(
      `/services/encounters/${encounterId}/assigned-services`
    );
    return res.data.data;
  } catch (error) {
    console.error("Get assigned services by encounter error: ", error);
    throw error;
  }
};

export const postCreateServiceRequestsByDoctor = async (
  dto: CreateServiceRequestPayload
) => {
  try {
    const response = await axiosInstance.post(`service-orders`, dto);
    return response.data.data;
  } catch (error) {
    console.error("Create service requests by doctor  error: ", error);
    throw error;
  }
};

export const gettRequestItemsByEncouter = async (id: string) => {
  try {
    const response = await axiosInstance.get(
      `service-orders/encounter/${id}/items`
    );
    return response.data.data;
  } catch (error) {
    console.error("Get request ticket by encouterId error: ", error);
    throw error;
  }
};
