export type HoldStatus = 'HELD' | 'CONFIRMED' | 'EXPIRED' | 'CANCELLED';

export interface SchoolClass {
  id: string;
  name: string;
  totalSeats: number;
  heldSeats: number;
  confirmedSeats: number;
  availableSeats: number;
}

export interface CreateClassResponse {
  id: string;
  name: string;
  totalSeats: number;
}

export interface HoldItem {
  holdId: string;
  classId: string;
  className?: string;
  studentId?: string;
  status: HoldStatus;
  expiresAt: string;
  serverTime?: string;
}

export interface ConfirmHoldResponse {
  holdId: string;
  status: HoldStatus;
  classId?: string;
  expiresAt?: string;
  confirmedAt?: string | null;
  serverTime?: string;
}

export interface ApiErrorBody {
  code?: string;
  message?: string;
}

