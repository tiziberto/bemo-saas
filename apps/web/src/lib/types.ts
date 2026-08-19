// Formas que devuelve la API (snake_case tal cual viene de Postgres).

export interface Professional {
  id: string;
  full_name: string;
}

export interface Room {
  id: string;
  name: string;
}

export interface Slot {
  start: string;
  end: string;
  /** Consultorio del bloque de horario que generó el hueco. Null en aperturas puntuales. */
  roomId?: string | null;
  /** Ya hay un turno encima. Sólo viene si se pidieron los ocupados (sobreturno). */
  taken?: boolean;
}

export interface Appointment {
  id: string;
  starts_at: string;
  ends_at: string;
  status: string;
  reason: string | null;
  professional_id: string;
  room_id: string | null;
  /** Para abrir la historia del paciente desde el turno. */
  person_id: string;
  first_name: string;
  last_name: string;
  dni: string;
  phone: string | null;
}

export interface Patient {
  id: string;
  dni: string;
  first_name: string;
  last_name: string;
  phone: string | null;
  owned: boolean;
}

export interface ClinicalEntry {
  id: string;
  entry_date: string;
  type: string;
  content: string;
  author_professional_id?: string;
}

export interface TeamUser {
  id: string;
  email: string;
  full_name: string;
  is_active?: boolean;
  roles: string[];
}

export interface AvailabilityBlock {
  id: string;
  professional_id: string;
  room_id: string | null;
  weekday: number;
  start_time: string;
  end_time: string;
  slot_minutes: number;
  valid_from?: string | null;
  valid_to?: string | null;
}

export interface Attachment {
  id: string;
  person_id: string;
  filename: string;
  mime: string;
  size_bytes: string;
  note: string | null;
  created_at: string;
  uploaded_by: string;
}

export interface ProfessionalReport {
  professional_id: string;
  full_name: string;
  total: number;
  completed: number;
  confirmed: number;
  scheduled: number;
  cancelled: number;
  no_show: number;
  no_show_rate: number;
  booked_minutes: number;
  available_minutes: number;
  occupancy_rate: number;
  new_patients: number;
}

export interface DailyPoint {
  date: string;
  total: number;
  no_show: number;
}
