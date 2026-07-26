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
 * Ensures any time string (e.g. "05:00 PM", "5:00 م", "17:00", "17:00:00") is formatted as 24-hour HH:MM.
 */
export function formatTo24Hour(timeStr?: string | null): string {
  if (!timeStr) return '—';
  let str = timeStr.trim();
  if (!str || str === '—') return '—';

  const isPM = /pm|م|مساء/i.test(str);
  const isAM = /am|ص|صباح/i.test(str);
  str = str.replace(/am|pm|ص|م|صباحاً|مساءً|صباح|مساء/gi, '').trim();

  const parts = str.split(':');
  if (parts.length >= 2) {
    let hours = parseInt(parts[0], 10);
    const minutes = parseInt(parts[1], 10);
    if (isNaN(hours) || isNaN(minutes)) return timeStr;

    if (isPM && hours < 12) hours += 12;
    if (isAM && hours === 12) hours = 0;

    const hStr = String(hours).padStart(2, '0');
    const mStr = String(minutes).padStart(2, '0');
    return `${hStr}:${mStr}`;
  }

  return timeStr;
}

/**
 * Helper to add/subtract minutes from HH:MM string.
 */
export function addMinutesToTimeStr(timeStr: string, minutesToAdd: number): string {
  const mins = timeToMinutes(timeStr);
  const total = (mins + minutesToAdd + 1440 * 10) % 1440;
  return minutesToTime(total);
}

export interface ProcessedShiftResult {
  shift1_check_in: string | null;
  shift1_check_out: string | null;
  shift2_check_in: string | null;
  shift2_check_out: string | null;
}

/**
 * Window-based punch pairing for shift calculation.
 * Strictly adheres to Check-In and Check-Out windows.
 * - Any punch inside check-in window = Check-In candidate (takes FIRST punch)
 * - Any punch inside check-out window = Check-Out candidate (takes LAST punch)
 * - Outside punches are ignored.
 * - Cross-midnight/overnight shifts use continuous relative timeline (DateTime).
 * - NEVER swaps Check-In and Check-Out.
 */
export function pairPunchesByWindows(
  shiftDate: string, // YYYY-MM-DD
  schedule: ShiftSchedule,
  punches: { time: string; date?: string; dateTimeObj?: Date }[]
): ProcessedShiftResult {
  const result: ProcessedShiftResult = {
    shift1_check_in: null,
    shift1_check_out: null,
    shift2_check_in: null,
    shift2_check_out: null,
  };

  if (!schedule || !punches || punches.length === 0) return result;

  const baseParts = shiftDate.split('-').map(Number);
  const baseDateObj = new Date(baseParts[0], baseParts[1] - 1, baseParts[2], 0, 0, 0, 0);
  const baseMs = baseDateObj.getTime();

  // Convert each punch to relative minutes from baseDateObj (shift date 00:00:00)
  const parsedPunches = punches.map((p) => {
    let pMs: number;
    if (p.dateTimeObj) {
      pMs = p.dateTimeObj.getTime();
    } else if (p.date) {
      const pParts = p.date.split('-').map(Number);
      const pTimeMins = timeToMinutes(p.time);
      const pDateObj = new Date(pParts[0], pParts[1] - 1, pParts[2], 0, 0, 0, 0);
      pMs = pDateObj.getTime() + pTimeMins * 60 * 1000;
    } else {
      const pTimeMins = timeToMinutes(p.time);
      pMs = baseMs + pTimeMins * 60 * 1000;
    }

    const relMin = (pMs - baseMs) / (1000 * 60);
    return {
      time: p.time,
      relMin,
      pMs,
    };
  });

  const resolveShiftWindows = (
    sStartStr: string,
    sEndStr: string,
    ciStartStr?: string,
    ciEndStr?: string,
    coStartStr?: string,
    coEndStr?: string
  ) => {
    const sStart = timeToMinutes(sStartStr || '08:00');
    const rawEnd = timeToMinutes(sEndStr || '16:00');
    const isOvernight = rawEnd <= sStart;

    const defaultCiStart = addMinutesToTimeStr(sStartStr || '08:00', -120);
    const defaultCiEnd = addMinutesToTimeStr(sStartStr || '08:00', 180);
    const defaultCoStart = addMinutesToTimeStr(sEndStr || '16:00', -120);
    const defaultCoEnd = addMinutesToTimeStr(sEndStr || '16:00', 240);

    const ciStartMin = timeToMinutes(ciStartStr || defaultCiStart);

    const adjustTime = (min: number) => {
      return min < ciStartMin ? min + 1440 : min;
    };

    const ciEndMin = adjustTime(timeToMinutes(ciEndStr || defaultCiEnd));
    const coStartMin = adjustTime(timeToMinutes(coStartStr || defaultCoStart));
    const coEndMin = adjustTime(timeToMinutes(coEndStr || defaultCoEnd));

    return { sStart, ciStartMin, ciEndMin, coStartMin, coEndMin };
  };

  // Shift 1
  const w1 = resolveShiftWindows(
    schedule.shift1_start,
    schedule.shift1_end,
    schedule.checkin_start,
    schedule.checkin_end,
    schedule.checkout_start,
    schedule.checkout_end
  );

  // Candidates for Shift 1 Check-In (strictly inside w1.ciStartMin .. w1.ciEndMin)
  const s1Ci = parsedPunches.filter((p) => p.relMin >= w1.ciStartMin && p.relMin <= w1.ciEndMin);
  // Candidates for Shift 1 Check-Out (strictly inside w1.coStartMin .. w1.coEndMin)
  const s1Co = parsedPunches.filter((p) => p.relMin >= w1.coStartMin && p.relMin <= w1.coEndMin);

  let s1InRelMin: number | null = null;
  let s1OutRelMin: number | null = null;

  if (s1Ci.length > 0) {
    s1Ci.sort((a, b) => a.relMin - b.relMin);
    // Take FIRST punch in Check-In window
    result.shift1_check_in = s1Ci[0].time;
    s1InRelMin = s1Ci[0].relMin;
  }

  if (s1Co.length > 0) {
    s1Co.sort((a, b) => a.relMin - b.relMin);
    // Take LAST punch in Check-Out window
    result.shift1_check_out = s1Co[s1Co.length - 1].time;
    s1OutRelMin = s1Co[s1Co.length - 1].relMin;
  }

  // Fallback if window matching gave nothing or only one punch for shift 1
  if (!result.shift1_check_in && !result.shift1_check_out && parsedPunches.length > 0) {
    const sorted = [...parsedPunches].sort((a, b) => a.relMin - b.relMin);
    result.shift1_check_in = sorted[0].time;
    s1InRelMin = sorted[0].relMin;
    if (sorted.length > 1) {
      result.shift1_check_out = sorted[sorted.length - 1].time;
      s1OutRelMin = sorted[sorted.length - 1].relMin;
    }
  }

  // Ensure shift1_check_in is chronologically BEFORE or equal to shift1_check_out using exact relMin
  if (result.shift1_check_in && result.shift1_check_out && s1InRelMin !== null && s1OutRelMin !== null) {
    if (s1InRelMin > s1OutRelMin) {
      const tempTime = result.shift1_check_in;
      result.shift1_check_in = result.shift1_check_out;
      result.shift1_check_out = tempTime;

      const tempRel = s1InRelMin;
      s1InRelMin = s1OutRelMin;
      s1OutRelMin = tempRel;
    }
  }

  // Shift 2
  if (schedule.type === 'dual' && schedule.shift2_start && schedule.shift2_end) {
    const w2 = resolveShiftWindows(
      schedule.shift2_start,
      schedule.shift2_end,
      schedule.checkin2_start,
      schedule.checkin2_end,
      schedule.checkout2_start,
      schedule.checkout2_end
    );

    const s2Ci = parsedPunches.filter((p) => p.relMin >= w2.ciStartMin && p.relMin <= w2.ciEndMin);
    const s2Co = parsedPunches.filter((p) => p.relMin >= w2.coStartMin && p.relMin <= w2.coEndMin);

    let s2InRelMin: number | null = null;
    let s2OutRelMin: number | null = null;

    if (s2Ci.length > 0) {
      s2Ci.sort((a, b) => a.relMin - b.relMin);
      result.shift2_check_in = s2Ci[0].time;
      s2InRelMin = s2Ci[0].relMin;
    }

    if (s2Co.length > 0) {
      s2Co.sort((a, b) => a.relMin - b.relMin);
      result.shift2_check_out = s2Co[s2Co.length - 1].time;
      s2OutRelMin = s2Co[s2Co.length - 1].relMin;
    }

    // Ensure shift2_check_in is chronologically BEFORE or equal to shift2_check_out using exact relMin
    if (result.shift2_check_in && result.shift2_check_out && s2InRelMin !== null && s2OutRelMin !== null) {
      if (s2InRelMin > s2OutRelMin) {
        const tempTime2 = result.shift2_check_in;
        result.shift2_check_in = result.shift2_check_out;
        result.shift2_check_out = tempTime2;

        const tempRel2 = s2InRelMin;
        s2InRelMin = s2OutRelMin;
        s2OutRelMin = tempRel2;
      }
    }
  }

  return result;
}

/**
 * Calculates metrics for a single shift check-in/out event.
 * Handles midnight cross (night shift) logic gracefully for any shift times.
 */
export function calculateSingleShiftMetrics(
  schedStartStr: string,
  schedEndStr: string,
  actualStartStr: string | null,
  actualEndStr: string | null,
  graceMinutes?: number,
  overtimeThresholdMinutes?: number
): { hours: number; late: number; ot: number; early: number } {
  if (!actualStartStr && !actualEndStr) {
    return { hours: 0, late: 0, ot: 0, early: 0 };
  }

  const grace = typeof graceMinutes === 'number' && !isNaN(graceMinutes) ? graceMinutes : 15;
  const otThreshold = typeof overtimeThresholdMinutes === 'number' && !isNaN(overtimeThresholdMinutes) ? overtimeThresholdMinutes : 30;

  const schedStart = timeToMinutes(schedStartStr || '08:00');
  const rawSchedEnd = timeToMinutes(schedEndStr || '16:00');
  const isOvernight = rawSchedEnd <= schedStart;
  const schedEnd = isOvernight ? rawSchedEnd + 1440 : rawSchedEnd;
  const schedDuration = schedEnd - schedStart;

  const getRelativeMin = (tStr: string) => {
    let m = timeToMinutes(tStr);
    if (isOvernight) {
      const cutoff = Math.min(schedStart - 180, Math.floor(schedStart / 2));
      if (m < cutoff || (m < schedStart && m <= rawSchedEnd + 240)) {
        m += 1440;
      }
    }
    return m;
  };

  let actStart: number | null = null;
  let actEnd: number | null = null;

  if (actualStartStr) {
    actStart = getRelativeMin(actualStartStr);
  }

  if (actualEndStr) {
    let min = getRelativeMin(actualEndStr);
    if (actStart !== null && min < actStart) {
      min += 1440;
    }
    actEnd = min;
  }

  // 1. Lateness (التأخير)
  let lateMinutes = 0;
  if (actStart !== null) {
    if (actStart > schedStart + grace) {
      lateMinutes = actStart - schedStart;
    }
  }

  // 2. Early Departure (الخروج المبكر)
  let earlyDepartureMinutes = 0;
  if (actEnd !== null) {
    if (actEnd < schedEnd) {
      earlyDepartureMinutes = schedEnd - actEnd;
    }
  }

  // 3. Working hours & Overtime
  let hoursWorked = 0;
  let otMinutes = 0;

  if (actStart !== null && actEnd !== null && actEnd > actStart) {
    const actDuration = actEnd - actStart;
    hoursWorked = actDuration / 60;

    if (actEnd > schedEnd) {
      const extraEndMins = actEnd - schedEnd;
      if (extraEndMins >= otThreshold) {
        otMinutes = Math.max(otMinutes, extraEndMins);
      }
    }

    if (actDuration > schedDuration) {
      const extraDurationMins = actDuration - schedDuration;
      if (extraDurationMins >= otThreshold) {
        otMinutes = Math.max(otMinutes, extraDurationMins);
      }
    }
  }

  return {
    hours: Math.max(0, Number(hoursWorked.toFixed(2))),
    late: Math.max(0, Math.round(lateMinutes)),
    ot: Math.max(0, Number((otMinutes / 60).toFixed(2))),
    early: Math.max(0, Math.round(earlyDepartureMinutes)),
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

  // Shift 1 Processing: Consider present if check-in OR check-out exists
  if (log.shift1_check_in || log.shift1_check_out) {
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

  // Shift 2 Processing (Only if schedule is dual AND log has shift2 check-in/out)
  if (
    schedule.type === 'dual' &&
    schedule.shift2_start &&
    schedule.shift2_end &&
    (log.shift2_check_in || log.shift2_check_out)
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
  result.total_hours = Number((result.shift1_hours + result.shift2_hours).toFixed(2));
  result.total_late = result.shift1_late + result.shift2_late;
  result.total_ot = Number((result.shift1_ot + result.shift2_ot).toFixed(2));
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
