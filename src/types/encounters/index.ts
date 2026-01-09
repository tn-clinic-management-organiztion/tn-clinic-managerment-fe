import { RefIcd10 } from "@/types";
import { Patient } from "@/types";
import { PageQueryDto } from "@/types/pagination";

export enum EncounterStatus {
  REGISTERED = "REGISTERED",
  AWAITING_PAYMENT = "AWAITING_PAYMENT",
  IN_CONSULTATION = "IN_CONSULTATION",
  AWAITING_CLS = "AWAITING_CLS",
  IN_CLS = "IN_CLS",
  CLS_COMPLETED = "CLS_COMPLETED",
  RESULTS_READY = "RESULTS_READY",
  COMPLETED = "COMPLETED",
}

export interface MedicalEncounter {
  encounter_id: string;
  visit_date: string;
  current_status: EncounterStatus;

  patient_id?: string | null;
  doctor_id?: string | null;
  assigned_room_id?: number | null;

  final_icd_code?: string | null;
  icd_ref?: RefIcd10 | null;

  patient?: Patient | null;

  initial_symptoms?: string | null;

  weight?: number | null;
  height?: number | null;
  bmi?: number | null;
  temperature?: number | null;
  pulse?: number | null;
  respiratory_rate?: number | null;
  bp_systolic?: number | null;
  bp_diastolic?: number | null;
  sp_o2?: number | null;

  doctor_conclusion?: string | null;
};

export interface CreateEncounterPayload {
  patient_id?: string;
  doctor_id?: string;
  assigned_room_id?: number;
  initial_symptoms?: string;
  weight?: number; // Cân nặng (kg)
  height?: number; // Chiều cao (cm)
  bmi?: number; // BMI
  temperature?: number; // Nhiệt độ
  pulse?: number; // Mạch
  respiratory_rate?: number; // Nhịp thở
  bp_systolic?: number; // Huyết áp tâm thu
  bp_diastolic?: number; // Huyết áp tâm trương
  sp_o2?: number; // SpO2
}

export interface UpdateEncounterPayload extends CreateEncounterPayload {
  current_status?: EncounterStatus;
  final_icd_code?: string | null;
  doctor_conclusion?: string;
}

export interface QueryEncounterPayload extends PageQueryDto {
  patient_id?: string;
  doctor_id?: string;
  assigned_room_id?: number;
  current_status?: EncounterStatus;
}

export interface StartConsultationPayload {
  doctor_id: string;
  assigned_room_id?: number;
}

export interface CompleteConsultationPayload {
  final_icd_code: string;
  doctor_conclusion: string;
}