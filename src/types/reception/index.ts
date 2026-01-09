export type TicketStatus =
  | "WAITING"
  | "CALLED"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "SKIPPED";
export type TicketType = "REGISTRATION" | "CONSULTATION" | "SERVICE";
export type TicketSource = "ONLINE" | "WALKIN";

export interface QueueTicket {
  ticket_id?: string;
  room_id?: number;
  ticket_type?: TicketType;
  display_number?: number;
  status?: TicketStatus;
  source?: TicketSource;
  encounter_id?: string | null;
  service_ids?: number[];
  created_at: string;
  called_at?: string;
  started_at?: string;
  completed_at?: string;
  room?: any;
  encounter?: any;
}

export interface PatientForm {
  fullName: string;
  gender: string;
  yob: string;
  address: string;
  phone: string;
  reason: string;
  targetRoomId: number | null;
}

export type GetWaitingTicketsQuery = {
  ticket_type?: TicketType;
  source?: TicketSource;
};

export type CreateTicketPayload = {
  room_id: number;
  ticket_type: "REGISTRATION" | "CONSULTATION" | "SERVICE";
  encounter_id?: string;
  source?: "WALKIN" | "APPOINTMENT";
  service_ids?: number[];
};

export type UpdateTicketPayload = {
  status?: TicketStatus;
  service_ids?: number[];
};
