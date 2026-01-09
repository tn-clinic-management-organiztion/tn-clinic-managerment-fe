export enum Gender {
  NAM = 'NAM',
  NU = 'NU',
  KHAC = 'KHAC'
}

export interface Patient {
  patient_id: string;
  cccd?: string;
  full_name: string;
  dob: string;
  gender: Gender;
  phone: string;
  address?: string;
  medical_history?: string;
  allergy_history?: string;
}

export interface CreatePatientPayload {
  cccd?: string;
  full_name: string;
  dob: string;
  gender: Gender;
  phone: string;
  address?: string;
  medical_history?: string;
  allergy_history?: string;
}

export interface UpdatePatientPayload {
  cccd?: string;
  full_name: string;
  dob: string;
  gender: Gender;
  phone: string;
  address?: string;
  medical_history?: string;
  allergy_history?: string;
}