import { RefIcd10 } from "./icd10/index";
import {
  ImageResult,
  ServiceResult,
  ServiceRequestItem,
  Service,
  ServiceCategory,
  ChooseServiceRequestItem,
  CreateServiceRequestPayload,
  UpdateServiceRequestPayload,
} from "./service/index";
import { Room, AssignedRoom } from "./rooms/index";
import {
  Patient,
  Gender,
  CreatePatientPayload,
  UpdatePatientPayload,
} from "./patient/index";
import {
  QueueTicket,
  PatientForm,
  TicketType,
  TicketStatus,
  GetWaitingTicketsQuery,
  CreateTicketPayload,
  UpdateTicketPayload,
} from "./reception/index";

import {
  CompleteConsultationPayload,
  StartConsultationPayload,
  QueryEncounterPayload,
  UpdateEncounterPayload,
  CreateEncounterPayload,
  EncounterStatus,
  MedicalEncounter,
} from "./encounters/index";

export { Gender, EncounterStatus };

export type {
  QueueTicket,
  PatientForm,
  TicketType,
  TicketStatus,
  Patient,
  Room,
  AssignedRoom,
  GetWaitingTicketsQuery,
  CreateTicketPayload,
  CreatePatientPayload,
  UpdatePatientPayload,
  UpdateTicketPayload,
  ImageResult,
  ServiceResult,
  ServiceRequestItem,
  Service,
  ServiceCategory,
  RefIcd10,
  CompleteConsultationPayload,
  StartConsultationPayload,
  QueryEncounterPayload,
  UpdateEncounterPayload,
  CreateEncounterPayload,
  MedicalEncounter,
  ChooseServiceRequestItem,
  CreateServiceRequestPayload,
  UpdateServiceRequestPayload,
};
