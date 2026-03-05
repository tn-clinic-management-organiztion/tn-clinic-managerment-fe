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
    const response = await axiosInstance.get("system/services", {
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
    const response = await axiosInstance.get("system/services/categories", {
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
      `system/services/room-service/${serviceId}/rooms`
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
      `system/services/encounters/${encounterId}/assigned-services`
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
    const response = await axiosInstance.post(`paraclinical/service-requests`, dto);
    return response.data.data;
  } catch (error) {
    console.error("Create service requests by doctor  error: ", error);
    throw error;
  }
};

export const getRequestItemsByEncouter = async (id: string) => {
  try {
    const response = await axiosInstance.get(
      `paraclinical/service-requests/encounter/${id}/items`
    );
    return response.data.data;
  } catch (error) {
    console.error("Get request ticket by encouterId error: ", error);
    throw error;
  }
};

export const getClsItemsByEncounter = async (encounterId: string) => {
  try {
    const response = await axiosInstance.get(
      `paraclinical/service-requests/encounter/${encounterId}/cls-items`
    );
    return response.data;
  } catch (error) {
    console.error("Get CLS items error:", error);
    throw error;
  }
};