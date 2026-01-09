import { Service } from "@/types/service";

export enum RoomType {
  CLINIC = 'CLINIC',
  PARACLINICAL = 'PARACLINICAL',
  PHARMACY = 'PHARMACY',
  CASHIER = 'CASHIER',
  ADMIN = 'ADMIN',
}

export interface Room {
  room_id: number;
  room_name: string;
  room_type: string; // 'CLINIC', 'IMAGING', etc.
  is_active?: boolean;
}

export interface AssignedRoom {
  room_id: number;
  room_name?: string;
  display_number?: number;
  services: Array<
    Service & {
      category_name?: string;
    }
  >;
};