export type DoctorStatus = 'available' | 'busy' | 'offline';
export type AppointmentStatus = 'scheduled' | 'checked_in' | 'in_progress' | 'completed' | 'cancelled' | 'no_show';
export type TokenStatus = 'waiting' | 'serving' | 'completed' | 'skipped';
export type GenderType = 'male' | 'female' | 'other';

export interface Department {
  id: string;
  name: string;
  description: string | null;
  icon: string | null;
  created_at: string;
}

export interface Doctor {
  id: string;
  user_id: string | null;
  name: string;
  department_id: string;
  specialization: string | null;
  qualification: string | null;
  experience_years: number;
  status: DoctorStatus;
  avg_consultation_time: number;
  room_number: string | null;
  created_at: string;
  updated_at: string;
  department?: Department;
}

export interface Patient {
  id: string;
  user_id: string;
  name: string;
  mobile: string;
  age: number | null;
  gender: GenderType | null;
  address: string | null;
  blood_group: string | null;
  emergency_contact: string | null;
  created_at: string;
  updated_at: string;
}

export interface TimeSlot {
  id: string;
  doctor_id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  max_patients: number;
  is_active: boolean;
  created_at: string;
}

export interface Appointment {
  id: string;
  appointment_id: string;
  patient_id: string;
  doctor_id: string;
  department_id: string;
  appointment_date: string;
  slot_time: string;
  status: AppointmentStatus;
  symptoms: string | null;
  is_emergency: boolean;
  predicted_wait_time: number | null;
  actual_wait_time: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  doctor?: Doctor;
  department?: Department;
  patient?: Patient;
}

export interface QueueToken {
  id: string;
  token_number: number;
  appointment_id: string;
  doctor_id: string;
  queue_date: string;
  status: TokenStatus;
  position: number;
  is_emergency: boolean;
  check_in_time: string | null;
  called_time: string | null;
  completed_time: string | null;
  created_at: string;
  updated_at: string;
  appointment?: Appointment;
  doctor?: Doctor;
}

export interface Notification {
  id: string;
  patient_id: string;
  appointment_id: string | null;
  title: string;
  message: string;
  type: string;
  is_read: boolean;
  sent_at: string;
  created_at: string;
}

export interface ChatMessage {
  id: string;
  user_id: string;
  role: 'user' | 'assistant';
  content: string;
  language: string;
  created_at: string;
}
