import axiosInstance from "@/lib/http/client";
import { CompleteConsultationPayload, CreateEncounterPayload, QueryEncounterPayload, StartConsultationPayload, UpdateEncounterPayload } from "@/types";
import { PageQueryDto } from "@/types/pagination";

export const postCreateEncounter = async (dto: CreateEncounterPayload) => {
  try {
    const response = await axiosInstance.post("clinical/encounters", dto);
    return response.data.data;
  } catch (error) {
    console.error("Create medical encounter for Patient error:", error);
    throw error;
  }
};

// Lấy encounter theo ID (có kèm relations: patient, doctor, assigned_room, final_icd)
export const getEncounterById = async (encounterId: string) => {
  try {
    const response = await axiosInstance.get(
      `clinical/encounters/${encounterId}`
    );
    return response.data.data;
  } catch (error) {
    console.error("Get encounter by ID error:", error);
    throw error;
  }
};

// Lấy các encouter thuộc phòng đó
export const getEncounterByRoomId = async (assigned_room_id: number) => {
  try {
    const payload: QueryEncounterPayload = {
      assigned_room_id: assigned_room_id,
    };
    const response = await axiosInstance.get("clinical/encounters", {
      params: payload,
    });
    return response.data.data;
  } catch (error) {
    console.error("Get encounters by assigned room id error:", error);
    throw error;
  }
};

// Start consultation
export const postStartConsultation = async (
  id: string,
  dto: StartConsultationPayload
) => {
  try {
    const response = await axiosInstance.post(
      `clinical/encounters/${id}/start-consultation`,
      dto
    );
    return response.data.data;
  } catch (error) {
    console.error("Start consulation error:", error);
    throw error;
  }
};

// Complete consultation
export const postCompleteConsultation = async (
  id: string,
  body: CompleteConsultationPayload
) => {
  try {
    const response = await axiosInstance.post(
      `clinical/encounters/${id}/complete-consultation`,
      body
    );
    return response.data.data;
  } catch (error) {
    console.error("Complete consulation error:", error);
    throw error;
  }
};

export const patchUpdateConsultation = async (
  id: string,
  dto: UpdateEncounterPayload
) => {
  try {
    const response = await axiosInstance.patch(
      `clinical/encounters/${id}`,
      dto
    );
    return response.data.data;
  } catch (error) {
    console.error("Update consulation error:", error);
    throw error;
  }
};
