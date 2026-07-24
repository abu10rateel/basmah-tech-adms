/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { ShiftSchedule, AttendanceLog, DailyCalculationResult, CumulativeSummary } from '../types';

/**
 * Parses time string (HH:MM) to total minutes from 00:00.
 */
export function timeToMinutes(timeStr: string): number {
  const [hours, minutes] = timeStr.split(':').map(Number);
  if (isNaN(hours) || isNaN(minutes)) return 0;
  return hours * 60 + minutes;
}

/**
 * Formats minutes from 00:00 into string (HH:MM).
 */
export function minutesToTime(minutes: number): string {
  const normMin = (minutes % 1440 + 1440) % 1440;
  const hrs = Math.floor(normMin / 60);
  const mins = normMin % 60;
  return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
}

/**
 * Formats decimal hours into HH:MM string.
 */
export function formatHoursToHHMM(hours: number): string {
  if (!hours || hours <= 0) return '00:00';
  const totalMinutes = Math.round(hours * 60);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/**
 * Formats minutes into HH:MM string.
 */
export function formatMinutesToHHMM(minutes: number): string {
  if (!minutes || minutes <= 0) return '00:00';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/**
 * Formats minutes (can be negative) into ±HH:MM string.
 */
export function formatSignedMinutesToHHMM(minutes: number): string {
  if (!minutes || minutes === 0) return '00:00';
  const absoluteMinutes = Math.abs(minutes);
  const h = Math.floor(absoluteMinutes / 60);
  const m = absoluteMinutes % 60;
  const sign = minutes < 0 ? '-' : '';
  return `${sign}${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/**
 * Formats decimal hours into descriptive Arabic text (e.g., "5 ساعات و 30 دقيقة").
 */
export function formatHoursArabic(hours: number): string {
  if (!hours || hours <= 0) return '0 ساعة';
  const totalMinutes = Math.round(hours * 60);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;

  if (h === 0) {
    return `${m} دقيقة`;
  } else if (m === 0) {
    if (h === 1) return 'ساعة واحدة';
    if (h === 2) return 'ساعتان';
    if (h >= 3 && h <= 10) return `${h} ساعات`;
    return `${h} ساعة`;
  } else {
    let hStr = '';
    if (h === 1) hStr = 'ساعة';
    else if (h === 2) hStr = 'ساعتان';
    else if (h >= 3 && h <= 10) hStr = `${h} ساعات`;
    else hStr = `${h} ساعة`;
    
    return `${hStr} و ${m} دقيقة`;
  }
}

/**
 * Formats lateness minutes into descriptive Arabic text.
 */
export function formatMinutesArabic(minutes: number): string {
  if (!minutes || minutes <= 0) return 'لا يوجد تأخير';
  if (minutes === 1) return 'دقيقة واحدة';
  if (minutes === 2) return 'دقيقتان';
  if (minutes >= 3 && minutes <= 10) return `${minutes} دقائق`;
  return `${minutes} دقيقة`;
}

/**
 * Calculates metrics for a single shift check-in/out event.
 * Handles midnight cross logic gracefully.
 */
export function calculateSingleShiftMetrics(
  schedStartStr: string,
  schedEndStr: string,
  actualStartStr: string | null,
  actualEndStr: string | null,
  graceMinutes: number,
  overtimeThresholdMinutes: number
): { hours: number; late: number; ot: number; early: number } {
  if (!actualStartStr || !actualEndStr) {
    return { hours: 0, late: 0, ot: 0, early: 0 };
  }

  const schedStart = timeToMinutes(schedStartStr);
  let schedEnd = timeToMinutes(schedEndStr);
  if (schedEnd < schedStart) {
    // Midnight cross in schedule (e.g. 22:00 to 06:00)
    schedEnd += 1440;
  }
  const schedDuration = schedEnd - schedStart;

  let actStart = timeToMinutes(actualStartStr);
  let actEnd = timeToMinutes(actualEndStr);
  
  if (actStart < schedStart - 480) {
    actStart += 1440;
  }
  if (actEnd < actStart) {
    // Midnight cross in actual attendance (e.g. check-in 22:15, check-out 05:45)
    actEnd += 1440;
  }
  const actDuration = actEnd - actStart;

  // 1. Lateness (التأخير)
  // If actual check-in is after scheduled start + grace minutes
  let lateMinutes = 0;
  if (actStart > schedStart + graceMinutes) {
    lateMinutes = actStart - schedStart;
  }

  // 2. Actual hours worked
  const hoursWorked = actDuration / 60;

  // 3. Overtime (الوقت الإضافي)
  // Overtime is calculated if actual duration exceeds scheduled duration + threshold
  let otHours = 0;
  if (actDuration > schedDuration + overtimeThresholdMinutes) {
    otHours = (actDuration - schedDuration) / 60;
  }

  // 4. Early Departure (الخروج المبكر)
  let earlyDepartureMinutes = 0;
  if (actEnd < schedEnd) {
    earlyDepartureMinutes = schedEnd - actEnd;
  }

  return {
    hours: Math.max(0, hoursWorked),
    late: Math.max(0, lateMinutes),
    ot: Math.max(0, otHours),
    early: Math.max(0, earlyDepartureMinutes),
  };
}

/**
 * Process a single attendance log to calculate daily breakdown.
 */
export function calculateDailyMetrics(
  log: AttendanceLog,
  schedule: ShiftSchedule
): DailyCalculationResult {
  const result: DailyCalculationResult = {
    date: log.date,
    shift1_hours: 0,
    shift1_late: 0,
    shift1_ot: 0,
    shift1_early_departure: 0,
    shift2_hours: 0,
    shift2_late: 0,
    shift2_ot: 0,
    shift2_early_departure: 0,
    total_hours: 0,
    total_late: 0,
    total_ot: 0,
    total_early_departure: 0,
    has_shift1: false,
    has_shift2: false,
  };

  // Shift 1 Processing
  if (log.shift1_check_in && log.shift1_check_out) {
    result.has_shift1 = true;
    const s1 = calculateSingleShiftMetrics(
      schedule.shift1_start,
      schedule.shift1_end,
      log.shift1_check_in,
      log.shift1_check_out,
      schedule.grace_minutes,
      schedule.overtime_threshold_minutes
    );
    result.shift1_hours = s1.hours;
    result.shift1_late = s1.late;
    result.shift1_ot = s1.ot;
    result.shift1_early_departure = s1.early;
  }

  // Shift 2 Processing (Only if schedule is dual AND employee is dual, and logs exist)
  if (
    schedule.type === 'dual' &&
    schedule.shift2_start &&
    schedule.shift2_end &&
    log.shift2_check_in &&
    log.shift2_check_out
  ) {
    result.has_shift2 = true;
    const s2 = calculateSingleShiftMetrics(
      schedule.shift2_start,
      schedule.shift2_end,
      log.shift2_check_in,
      log.shift2_check_out,
      schedule.grace_minutes,
      schedule.overtime_threshold_minutes
    );
    result.shift2_hours = s2.hours;
    result.shift2_late = s2.late;
    result.shift2_ot = s2.ot;
    result.shift2_early_departure = s2.early;
  }

  // Combined calculations
  result.total_hours = result.shift1_hours + result.shift2_hours;
  result.total_late = result.shift1_late + result.shift2_late;
  result.total_ot = result.shift1_ot + result.shift2_ot;
  result.total_early_departure = result.shift1_early_departure + result.shift2_early_departure;

  return result;
}

/**
 * Aggregates logs across a date range to generate a Cumulative Summary (الملخص التراكمي)
 */
export function generateCumulativeSummary(
  dailyResults: DailyCalculationResult[],
  totalDaysInRange: number
): CumulativeSummary {
  let presentDays = 0;
  let totalHours = 0;
  let totalLate = 0;
  let totalOt = 0;
  let totalEarly = 0;

  dailyResults.forEach((res) => {
    if (res.has_shift1 || res.has_shift2) {
      presentDays++;
    }
    totalHours += res.total_hours;
    totalLate += res.total_late;
    totalOt += res.total_ot;
    totalEarly += res.total_early_departure;
  });

  const absentDays = Math.max(0, totalDaysInRange - presentDays);
  const netOvertimeMinutes = Math.round(totalOt * 60) - totalLate - totalEarly;

  return {
    total_days: totalDaysInRange,
    present_days: presentDays,
    absent_days: absentDays,
    total_working_hours: Number(totalHours.toFixed(2)),
    total_lateness_minutes: totalLate,
    total_overtime_hours: Number(totalOt.toFixed(2)),
    total_early_departure_minutes: totalEarly,
    net_overtime_minutes: netOvertimeMinutes,
  };
}

/**
 * Helper to get list of dates between start and end date (inclusive)
 */
export function getDatesInRange(startStr: string, endStr: string): string[] {
  const dates: string[] = [];
  const start = new Date(startStr);
  const end = new Date(endStr);
  
  if (isNaN(start.getTime()) || isNaN(end.getTime())) return [];
  
  const current = new Date(start);
  while (current <= end) {
    dates.push(current.toISOString().split('T')[0]);
    current.setDate(current.getDate() + 1);
  }
  
  return dates;
}

/**
 * Formats standard date to beautiful Arabic long date format.
 * (e.g., "الجمعة، 28 يونيو 2026")
 */
export function formatDateArabic(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString('ar-EG', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

export interface BioTimeShiftConfig {
  shift_in: string;        // e.g., "19:00"
  checkin_start: string;   // e.g., "17:00"
  checkin_end: string;     // e.g., "22:00"
  shift_out: string;       // e.g., "03:00"
  checkout_start: string;  // e.g., "01:00"
  checkout_end: string;    // e.g., "06:00"
}

export interface BioTimePunch {
  id: string;
  timestamp: string; // "YYYY-MM-DD HH:MM"
  timeOnly: string;  // "HH:MM"
  dateOnly: string;  // "YYYY-MM-DD"
}

export interface BioTimeResult {
  shiftDate: string; // The active operational date (e.g., date of check-in)
  isOvernight: boolean;
  checkInPunch: string | null;  // Approved check-in time (HH:MM)
  checkOutPunch: string | null; // Approved check-out time (HH:MM)
  checkInTimestamp: string | null; // Full approved check-in timestamp
  checkOutTimestamp: string | null; // Full approved check-out timestamp
  workingHours: number; // calculated working hours
  latenessMinutes: number; // calculated lateness minutes
  allPunchesProcessed: {
    id: string;
    timestamp: string;
    type: 'check_in' | 'check_out' | 'ignored';
    reason: string;
  }[];
}

/**
 * BioTime-style processing for a single shift on a given operational date.
 * Matches punches against flexible Check-In/Check-Out allowances, 
 * handles overnight shifts, and automatically deduplicates multiple worker punches.
 */
export function processBioTimeShift(
  shiftDate: string, // YYYY-MM-DD
  config: BioTimeShiftConfig,
  punches: BioTimePunch[]
): BioTimeResult {
  // Parse config times to minutes
  const shift_in_min = timeToMinutes(config.shift_in);
  const checkin_start_min = timeToMinutes(config.checkin_start);
  
  // Apply golden rule: any configured time value < checkin_start_min belongs to the next day
  const adjustTime = (min: number) => {
    return min < checkin_start_min ? min + 1440 : min;
  };

  const checkin_end_min = adjustTime(timeToMinutes(config.checkin_end));
  const shift_out_min = adjustTime(timeToMinutes(config.shift_out));
  const checkout_start_min = adjustTime(timeToMinutes(config.checkout_start));
  const checkout_end_min = adjustTime(timeToMinutes(config.checkout_end));

  const isOvernight = shift_out_min > 1440;

  // Analyze all punches relative to shiftDate (Day D 00:00)
  const baseParts = shiftDate.split('-').map(Number);
  const baseDate = new Date(baseParts[0], baseParts[1] - 1, baseParts[2], 0, 0, 0);
  
  const checkInCandidates: { punch: BioTimePunch; relMin: number }[] = [];
  const checkOutCandidates: { punch: BioTimePunch; relMin: number }[] = [];
  const allPunchesProcessed: BioTimeResult['allPunchesProcessed'] = [];

  punches.forEach((punch) => {
    const punchParts = punch.dateOnly.split('-').map(Number);
    const punchDate = new Date(punchParts[0], punchParts[1] - 1, punchParts[2], 0, 0, 0);
    const diffDays = Math.round((punchDate.getTime() - baseDate.getTime()) / (1000 * 60 * 60 * 24));
    
    const punchTimeMin = timeToMinutes(punch.timeOnly);
    const relMin = diffDays * 1440 + punchTimeMin;

    // Check if it fits Check-In range
    const isCheckInCandidate = relMin >= checkin_start_min && relMin <= checkin_end_min;
    // Check if it fits Check-Out range
    const isCheckOutCandidate = relMin >= checkout_start_min && relMin <= checkout_end_min;

    if (isCheckInCandidate && isCheckOutCandidate) {
      // Overlap case: typically in very short shifts or large grace periods.
      // BioTime defaults to Check-In if no check-in exists yet.
      if (checkInCandidates.length === 0) {
        checkInCandidates.push({ punch, relMin });
        allPunchesProcessed.push({
          id: punch.id,
          timestamp: punch.timestamp,
          type: 'check_in',
          reason: 'تقع البصمة في فترة الدخول (الترجيح كحضور أول)'
        });
      } else {
        checkOutCandidates.push({ punch, relMin });
        allPunchesProcessed.push({
          id: punch.id,
          timestamp: punch.timestamp,
          type: 'check_out',
          reason: 'تقع البصمة في فترة الخروج (الترجيح كانصراف لاحق)'
        });
      }
    } else if (isCheckInCandidate) {
      checkInCandidates.push({ punch, relMin });
      allPunchesProcessed.push({
        id: punch.id,
        timestamp: punch.timestamp,
        type: 'check_in',
        reason: 'تقع البصمة في فترة الدخول المعتمدة'
      });
    } else if (isCheckOutCandidate) {
      checkOutCandidates.push({ punch, relMin });
      allPunchesProcessed.push({
        id: punch.id,
        timestamp: punch.timestamp,
        type: 'check_out',
        reason: 'تقع البصمة في فترة الخروج المعتمدة'
      });
    } else {
      allPunchesProcessed.push({
        id: punch.id,
        timestamp: punch.timestamp,
        type: 'ignored',
        reason: 'خارج فترات السماح المحددة للوردية'
      });
    }
  });

  // Apply BioTime rules for duplicate punches:
  // - For Check-In: adoption of the FIRST punch, ignore subsequent.
  let selectedCheckIn: typeof checkInCandidates[0] | null = null;
  if (checkInCandidates.length > 0) {
    checkInCandidates.sort((a, b) => a.relMin - b.relMin);
    selectedCheckIn = checkInCandidates[0];
    
    checkInCandidates.slice(1).forEach((c) => {
      const idx = allPunchesProcessed.findIndex(p => p.id === c.punch.id);
      if (idx !== -1) {
        allPunchesProcessed[idx] = {
          ...allPunchesProcessed[idx],
          type: 'ignored',
          reason: 'تم تجاهل البصمة لتكرار الحضور (يتم اعتماد البصمة الأولى فقط)'
        };
      }
    });
  }

  // - For Check-Out: adoption of the LAST punch, ignore previous.
  let selectedCheckOut: typeof checkOutCandidates[0] | null = null;
  if (checkOutCandidates.length > 0) {
    checkOutCandidates.sort((a, b) => a.relMin - b.relMin);
    selectedCheckOut = checkOutCandidates[checkOutCandidates.length - 1];
    
    checkOutCandidates.slice(0, checkOutCandidates.length - 1).forEach((c) => {
      const idx = allPunchesProcessed.findIndex(p => p.id === c.punch.id);
      if (idx !== -1) {
        allPunchesProcessed[idx] = {
          ...allPunchesProcessed[idx],
          type: 'ignored',
          reason: 'تم تجاهل البصمة لتكرار الانصراف (يتم اعتماد البصمة الأخيرة فقط)'
        };
      }
    });
  }

  // Calculate hours worked & lateness
  let workingHours = 0;
  let latenessMinutes = 0;

  if (selectedCheckIn) {
    if (selectedCheckIn.relMin > shift_in_min) {
      latenessMinutes = selectedCheckIn.relMin - shift_in_min;
    }
    
    if (selectedCheckOut) {
      const duration = selectedCheckOut.relMin - selectedCheckIn.relMin;
      workingHours = Number((Math.max(0, duration) / 60).toFixed(2));
    }
  }

  return {
    shiftDate,
    isOvernight,
    checkInPunch: selectedCheckIn ? selectedCheckIn.punch.timeOnly : null,
    checkOutPunch: selectedCheckOut ? selectedCheckOut.punch.timeOnly : null,
    checkInTimestamp: selectedCheckIn ? selectedCheckIn.punch.timestamp : null,
    checkOutTimestamp: selectedCheckOut ? selectedCheckOut.punch.timestamp : null,
    workingHours,
    latenessMinutes,
    allPunchesProcessed
  };
}
