/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface TenantProfile {
  id: string; // matches auth.uid() in Supabase
  email: string;
  company_name: string;
  manager_name?: string;
  phone?: string;
  city?: string;
  plan_type?: string;
  employee_package?: string;
  status?: string;
  expiry_date?: string;
}

export interface ShiftSchedule {
  id: string;
  user_id: string; // Tenant Context
  name: string; // Name of schedule, e.g., "الدوام العام"
  type: 'single' | 'dual';
  
  // Shift 1
  shift1_start: string; // HH:MM
  shift1_end: string; // HH:MM
  
  // Shift 2 (Only if type is dual)
  shift2_start?: string; // HH:MM
  shift2_end?: string; // HH:MM
  
  grace_minutes: number; // فترة السماح بالدقائق
  overtime_threshold_minutes: number; // احتساب الإضافي بعد x دقيقة
  
  // BioTime Custom Punch Windows
  checkin_start?: string; // HH:MM
  checkin_end?: string; // HH:MM
  checkout_start?: string; // HH:MM
  checkout_end?: string; // HH:MM
  
  // BioTime Custom Punch Windows for Shift 2
  checkin2_start?: string; // HH:MM
  checkin2_end?: string; // HH:MM
  checkout2_start?: string; // HH:MM
  checkout2_end?: string; // HH:MM
  
  created_at?: string;
}

export interface Employee {
  id: string; // uuid
  user_id: string; // Tenant Context
  emp_id: string; // الرقم الوظيفي (Must be unique within same user_id)
  name: string; // اسم الموظف
  department: string; // القسم
  phone: string; // رقم الهاتف
  shift_schedule_id: string; // FK to ShiftSchedule
  is_dual_shift: boolean; // Use dual shifts logic
  created_at?: string;
}

export interface AttendanceLog {
  id: string; // uuid
  user_id: string; // Tenant Context
  employee_id: string; // FK to Employee.id
  date: string; // YYYY-MM-DD
  
  // Shift 1 Check-in / Check-out
  shift1_check_in: string | null; // HH:MM
  shift1_check_out: string | null; // HH:MM
  
  // Shift 2 Check-in / Check-out
  shift2_check_in: string | null; // HH:MM
  shift2_check_out: string | null; // HH:MM
  
  notes: string;
  created_at?: string;
}

export interface DailyCalculationResult {
  date: string;
  shift1_hours: number;
  shift1_late: number; // in minutes
  shift1_ot: number; // in hours
  shift1_early_departure: number; // in minutes
  
  shift2_hours: number;
  shift2_late: number; // in minutes
  shift2_ot: number; // in hours
  shift2_early_departure: number; // in minutes
  
  total_hours: number;
  total_late: number; // in minutes
  total_ot: number; // in hours
  total_early_departure: number; // in minutes
  
  has_shift1: boolean;
  has_shift2: boolean;
}

export interface CumulativeSummary {
  total_days: number;
  present_days: number;
  absent_days: number;
  total_working_hours: number;
  total_lateness_minutes: number;
  total_overtime_hours: number;
  total_early_departure_minutes: number;
  net_overtime_minutes: number;
}
