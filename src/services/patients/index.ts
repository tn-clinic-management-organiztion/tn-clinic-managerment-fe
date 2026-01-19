import axiosInstance from "@/lib/http/client";
import { CreatePatientPayload, UpdatePatientPayload } from "@/types";

export class PatientSearchDto {
  phone?: string;
  full_name?: string;
  cccd?: string;
}

export const getSearchPatient = async (search: PatientSearchDto) => {
  try {
    const response = await axiosInstance.get("/patients/search", {
      params: search,
    });
    return response.data.data;
  } catch (error: any) {
    console.error("Search Patient error: ", error);
    throw error;
  }
};

export const postCreatePatient = async (createPatientPayload: CreatePatientPayload) => {
  try {
    const response = await axiosInstance.post("/patients", createPatientPayload);
    return response.data.data;
  } catch (error) {
    console.error("Create Patient error: ", error);
    throw error;
  }
};

export const putUpdatePatient = async (
  patientId: string,
  updatePatientPayload: UpdatePatientPayload
) => {
  try {
    const response = await axiosInstance.put(
      `/patients/${patientId}`,
      updatePatientPayload
    );
    return response.data.data;
  } catch (error) {
    console.error("Update Patient error: ", error);
    throw error;
  }
};
