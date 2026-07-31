import { TimeInput24 } from './TimeInput24';
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { db } from '../supabaseClient';
import { Employee, ShiftSchedule, AttendanceLog, DailyCalculationResult } from '../types';
import { calculateDailyMetrics, formatDateArabic, formatHoursArabic, formatMinutesArabic } from '../utils/calc';
import { Calendar, Save, Trash2, Clock, AlertTriangle, CheckCircle2, UserCheck, RefreshCw, Eye, Edit3, Upload } from 'lucide-react';
import FingerprintUploader from './FingerprintUploader';

export default function AttendanceRegister() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [shifts, setShifts] = useState<ShiftSchedule[]>([]);
  const [logs, setLogs] = useState<AttendanceLog[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Controls
  const [selectedDate, setSelectedDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  
  // Status feedback
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isUploaderOpen, setIsUploaderOpen] = useState<boolean>(false);

  // Loaded map for inline logging edits
  const [logEdits, setLogEdits] = useState<Record<string, Partial<AttendanceLog>>>({});

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [empData, shiftData, logData] = await Promise.all([
        db.getEmployees(),
        db.getShifts(),
        db.getAttendanceLogs(selectedDate, selectedDate) // Load specifically for this date
      ]);
      setEmployees(empData);
      setShifts(shiftData);
      setLogs(logData);

      // Merge new data while preserving user's active unsaved local inputs
      setLogEdits(prevEdits => {
        const editsMap: Record<string, Partial<AttendanceLog> & { _isDirty?: boolean }> = {};
        empData.forEach((emp) => {
          const existingLog = logData.find((l) => l.employee_id === emp.id);
          const prev = prevEdits[emp.id];
          if (prev && prev._isDirty) {
            // User is currently editing this row, preserve their unsaved typing!
            editsMap[emp.id] = prev;
          } else if (existingLog) {
            editsMap[emp.id] = { ...existingLog };
          } else {
            editsMap[emp.id] = {
              employee_id: emp.id,
              date: selectedDate,
              shift1_check_in: '',
              shift1_check_out: '',
              shift2_check_in: '',
              shift2_check_out: '',
              notes: ''
            };
          }
        });
        return editsMap;
      });
    } catch (err: any) {
      setError('تعذر تحميل سجلات الحضور لليوم.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();

    // Subscribe to attendance logs, employees, and shifts
    const unsubscribeLogs = db.subscribeToChanges('attendance_logs', () => {
      loadData();
    });
    
    return () => {
      unsubscribeLogs();
    };
  }, [selectedDate]);

  // Handle value change for an employee's daily log
  const handleTimeChange = (empId: string, field: keyof AttendanceLog, value: string) => {
    (window as any).__IS_USER_EDITING__ = true;
    setLogEdits(prev => ({
      ...prev,
      [empId]: {
        ...prev[empId],
        [field]: value || null,
        _isDirty: true
      }
    }));
  };

  // Quick Stamp current time (e.g., 08:32)
  const handleQuickStamp = (empId: string, field: 'shift1_check_in' | 'shift1_check_out' | 'shift2_check_in' | 'shift2_check_out') => {
    const now = new Date();
    const formatted = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    handleTimeChange(empId, field, formatted);
  };

  // Reset/Clear a single log
  const handleClearTimes = async (empId: string) => {
    const edit = logEdits[empId];
    if (!edit || !edit.id) {
      // Just clear local state if not saved to db yet
      setLogEdits(prev => ({
        ...prev,
        [empId]: {
          employee_id: empId,
          date: selectedDate,
          shift1_check_in: '',
          shift1_check_out: '',
          shift2_check_in: '',
          shift2_check_out: '',
          notes: ''
        }
      }));
      return;
    }

    if (!window.confirm('هل أنت متأكد من مسح وإلغاء بصمات اليوم بالكامل لهذا الموظف؟')) {
      return;
    }

    const { error: err } = await db.deleteAttendanceLog(edit.id);
    if (err) {
      setError('تعذر مسح بيانات البصمة.');
    } else {
      setSuccess('تم مسح وإلغاء البصمة بنجاح.');
      loadData();
      setTimeout(() => setSuccess(null), 3000);
    }
  };

  // Save/Upsert a single log
  const handleSaveLog = async (empId: string) => {
    setError(null);
    setSuccess(null);
    const edit = logEdits[empId];
    if (!edit) return;

    // Check if there is any input at least
    const hasData = edit.shift1_check_in || edit.shift1_check_out || edit.shift2_check_in || edit.shift2_check_out || edit.notes;
    if (!hasData) {
      setError('لا توجد بيانات بصمة لحفظها. يرجى إدخال ساعة حضور أو انصراف أولاً.');
      return;
    }

    const payload: Omit<AttendanceLog, 'user_id'> & { id?: string } = {
      id: edit.id || undefined,
      employee_id: empId,
      date: selectedDate,
      shift1_check_in: edit.shift1_check_in || null,
      shift1_check_out: edit.shift1_check_out || null,
      shift2_check_in: edit.shift2_check_in || null,
      shift2_check_out: edit.shift2_check_out || null,
      notes: edit.notes || ''
    };

    const { error: err } = await db.saveAttendanceLog(payload);
    if (err) {
      setError('فشل في حفظ سجل البصمة.');
    } else {
      setSuccess('تم حفظ بصمة اليوم بنجاح للموظف.');
      (window as any).__IS_USER_EDITING__ = false;
      setLogEdits(prev => ({
        ...prev,
        [empId]: {
          ...prev[empId],
          _isDirty: false
        }
      }));
      loadData();
      setTimeout(() => setSuccess(null), 3000);
    }
  };

  return (
    <div id="attendance-register" className="space-y-6">
      {/* Header controls */}
      <div className="flex flex-col sm:flex-row justify-between items-center gap-4 bg-slate-900 p-6 rounded-2xl border border-slate-800 text-right">
        <div className="space-y-1 text-center sm:text-right">
          <h2 className="text-xl font-bold text-slate-100 flex items-center justify-center sm:justify-start gap-2">
            <UserCheck className="w-5 h-5 text-emerald-400" />
            <span>تسجيل حضور وانصراف اليوم</span>
          </h2>
          <p className="text-slate-400 text-xs">
            اختر تاريخ اليوم، ثم سجل وحدث تواقيت بصمات الموظفين بدقة متناهية.
          </p>
        </div>

        {/* Actions & Date Selector */}
        <div className="flex flex-col sm:flex-row items-center gap-3">
          <button
            onClick={() => setIsUploaderOpen(true)}
            className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-xl text-xs transition flex items-center gap-2 cursor-pointer shadow shadow-emerald-500/15"
          >
            <Upload className="w-4 h-4" />
            <span>رفع ملف بصمات الجهاز (DAT/TXT/CSV)</span>
          </button>

          <div className="flex items-center gap-2 bg-slate-950 border border-slate-800 p-2 rounded-xl">
            <Calendar className="w-4 h-4 text-emerald-400 font-sans" />
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="bg-transparent text-slate-100 text-xs font-bold font-sans focus:outline-none border-none text-right cursor-pointer"
            />
          </div>
        </div>
      </div>

      {/* Date display banner */}
      <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs rounded-xl flex justify-between items-center text-right font-sans">
        <span className="font-bold">التاريخ المختار للتحضير:</span>
        <span className="font-semibold">{formatDateArabic(selectedDate)}</span>
      </div>

      {success && (
        <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs rounded-lg text-right flex gap-2 items-center">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>{success}</span>
        </div>
      )}

      {error && (
        <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs rounded-lg text-right flex gap-2 items-center">
          <AlertTriangle className="w-4 h-4 text-rose-400" />
          <span>{error}</span>
        </div>
      )}

      {/* Register Matrix */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4 text-right">
        <div className="flex justify-between items-center border-b border-slate-800 pb-3">
          <h3 className="text-sm font-bold text-slate-200">سجل البصمات والمطابقة اليومية</h3>
          <button
            onClick={loadData}
            className="p-1.5 bg-slate-950 border border-slate-850 hover:border-emerald-500/30 text-slate-400 hover:text-emerald-400 rounded-lg transition"
            title="تحديث البيانات"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>

        {loading ? (
          <div className="py-16 flex flex-col items-center justify-center text-slate-500 space-y-2">
            <span className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
            <span className="text-xs">جاري تحميل مصفوفة الموظفين...</span>
          </div>
        ) : employees.length === 0 ? (
          <div className="py-12 text-center text-slate-500 text-xs">
            لم يتم تسجيل أي موظف في النظام بعد. يرجى الذهاب لتبويب <span className="underline">الموظفين</span> أولاً.
          </div>
        ) : (
          <div className="space-y-6">
            {employees.map((emp) => {
              const edit = logEdits[emp.id] || {};
              const schedule = shifts.find((s) => s.id === emp.shift_schedule_id) || shifts[0];
              
              // Local preview calculation on-the-fly
              let calcResult: DailyCalculationResult | null = null;
              if (schedule) {
                const tempLog: AttendanceLog = {
                  id: edit.id || '',
                  user_id: '',
                  employee_id: emp.id,
                  date: selectedDate,
                  shift1_check_in: edit.shift1_check_in || null,
                  shift1_check_out: edit.shift1_check_out || null,
                  shift2_check_in: edit.shift2_check_in || null,
                  shift2_check_out: edit.shift2_check_out || null,
                  notes: edit.notes || ''
                };
                calcResult = calculateDailyMetrics(tempLog, schedule);
              }

              return (
                <div
                  key={emp.id}
                  className="bg-slate-950 border border-slate-850 rounded-xl p-5 hover:border-slate-700/80 transition space-y-4"
                >
                  {/* Row Top Header */}
                  <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3 pb-3 border-b border-slate-900">
                    <div className="space-y-1 text-right">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 bg-slate-900 border border-slate-800 text-[10px] font-mono text-slate-400 rounded">
                          {emp.emp_id}
                        </span>
                        <h4 className="text-xs font-bold text-slate-200">{emp.name}</h4>
                      </div>
                      <p className="text-[10px] text-slate-400">
                        القسم: {emp.department} • الوردية: <span className="text-emerald-400 font-semibold">{schedule?.name || 'غير محدد'}</span>
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                        emp.is_dual_shift 
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' 
                          : 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                      }`}>
                        {emp.is_dual_shift ? 'نظام شفتين' : 'نظام شفت واحد'}
                      </span>
                      
                      {edit.id ? (
                        <span className="text-[10px] bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded border border-emerald-500/20 font-bold">
                          بصمة محفوظة
                        </span>
                      ) : (
                        <span className="text-[10px] bg-slate-900 text-slate-500 px-2 py-0.5 rounded border border-slate-800 font-bold">
                          غائب / لم يسجل
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Input fields according to shift policy */}
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-center">
                    {/* Shift 1 Fields */}
                    <div className="lg:col-span-5 grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="block text-[10px] text-slate-400">
                          {emp.is_dual_shift ? 'الشفت الأول: حضور' : 'بصمة الحضور'}
                        </label>
                        <div className="flex gap-1.5">
                          <TimeInput24 value={edit.shift1_check_in || ''} onChange={(v) => handleTimeChange(emp.id, 'shift1_check_in', v)} />
                          <button
                            type="button"
                            onClick={() => handleQuickStamp(emp.id, 'shift1_check_in')}
                            className="px-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 rounded-lg text-[10px] cursor-pointer"
                            title="بصم الآن"
                          >
                            الآن
                          </button>
                        </div>
                      </div>

                      <div className="space-y-1">
                        <label className="block text-[10px] text-slate-400">
                          {emp.is_dual_shift ? 'الشفت الأول: انصراف' : 'بصمة الانصراف'}
                        </label>
                        <div className="flex gap-1.5">
                          <TimeInput24 value={edit.shift1_check_out || ''} onChange={(v) => handleTimeChange(emp.id, 'shift1_check_out', v)} />
                          <button
                            type="button"
                            onClick={() => handleQuickStamp(emp.id, 'shift1_check_out')}
                            className="px-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 rounded-lg text-[10px] cursor-pointer"
                            title="بصم الآن"
                          >
                            الآن
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Shift 2 Fields (Conditional) */}
                    <div className="lg:col-span-5 grid grid-cols-2 gap-3">
                      {emp.is_dual_shift ? (
                        <>
                          <div className="space-y-1">
                            <label className="block text-[10px] text-slate-400">الشفت الثاني: حضور</label>
                            <div className="flex gap-1.5">
                              <TimeInput24 value={edit.shift2_check_in || ''} onChange={(v) => handleTimeChange(emp.id, 'shift2_check_in', v)} />
                              <button
                                type="button"
                                onClick={() => handleQuickStamp(emp.id, 'shift2_check_in')}
                                className="px-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 rounded-lg text-[10px] cursor-pointer"
                                title="بصم الآن"
                              >
                                الآن
                              </button>
                            </div>
                          </div>

                          <div className="space-y-1">
                            <label className="block text-[10px] text-slate-400">الشفت الثاني: انصراف</label>
                            <div className="flex gap-1.5">
                              <TimeInput24 value={edit.shift2_check_out || ''} onChange={(v) => handleTimeChange(emp.id, 'shift2_check_out', v)} />
                              <button
                                type="button"
                                onClick={() => handleQuickStamp(emp.id, 'shift2_check_out')}
                                className="px-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 rounded-lg text-[10px] cursor-pointer"
                                title="بصم الآن"
                              >
                                الآن
                              </button>
                            </div>
                          </div>
                        </>
                      ) : (
                        <div className="col-span-2 p-3 bg-slate-900/40 border border-slate-900 border-dashed rounded-lg flex items-center justify-center text-[10px] text-slate-600 h-[48px] self-end mb-0.5">
                          نظام عمل أحادي الشفت • الشفت الثاني معطل تلقائياً
                        </div>
                      )}
                    </div>

                    {/* Quick Control Actions */}
                    <div className="lg:col-span-2 flex lg:flex-col justify-end gap-2 pt-2 lg:pt-0">
                      <button
                        type="button"
                        onClick={() => handleSaveLog(emp.id)}
                        className="flex-1 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-lg text-[10px] flex items-center justify-center gap-1 cursor-pointer transition shadow shadow-emerald-500/5"
                      >
                        <Save className="w-3.5 h-3.5" />
                        <span>حفظ البصمة</span>
                      </button>
                      
                      <button
                        type="button"
                        onClick={() => handleClearTimes(emp.id)}
                        className="p-1.5 bg-slate-900 border border-slate-800 hover:border-rose-500/30 text-slate-500 hover:text-rose-400 rounded-lg cursor-pointer transition"
                        title="إلغاء البصمة لليوم"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Realtime Calc Result Preview */}
                  {calcResult && (calcResult.has_shift1 || calcResult.has_shift2) && (
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-3 border-t border-slate-900 text-center">
                      <div className="p-2 bg-slate-900/60 rounded-lg border border-slate-900">
                        <span className="block text-[9px] text-slate-500">ساعات العمل الفعلية</span>
                        <span className="text-xs font-bold text-slate-200">
                          {formatHoursArabic(calcResult.total_hours)}
                        </span>
                      </div>

                      <div className="p-2 bg-slate-900/60 rounded-lg border border-slate-900">
                        <span className="block text-[9px] text-slate-500">دقائق التأخير</span>
                        <span className={`text-xs font-bold ${
                          calcResult.total_late > 0 ? 'text-amber-400' : 'text-slate-400'
                        }`}>
                          {calcResult.total_late > 0 
                            ? formatMinutesArabic(calcResult.total_late) 
                            : 'لا يوجد تأخير'
                          }
                        </span>
                      </div>

                      <div className="p-2 bg-slate-900/60 rounded-lg border border-slate-900">
                        <span className="block text-[9px] text-slate-500">الخروج المبكر</span>
                        <span className={`text-xs font-bold ${
                          calcResult.total_early_departure > 0 ? 'text-rose-400' : 'text-slate-400'
                        }`}>
                          {calcResult.total_early_departure > 0 
                            ? formatMinutesArabic(calcResult.total_early_departure) 
                            : 'لا يوجد خروج مبكر'
                          }
                        </span>
                      </div>

                      <div className="p-2 bg-slate-900/60 rounded-lg border border-slate-900">
                        <span className="block text-[9px] text-slate-500">الوقت الإضافي</span>
                        <span className={`text-xs font-bold ${
                          calcResult.total_ot > 0 ? 'text-emerald-400' : 'text-slate-400'
                        }`}>
                          {calcResult.total_ot > 0 
                            ? formatHoursArabic(calcResult.total_ot) 
                            : 'لا يوجد وقت إضافي'
                          }
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Notes & Extra info */}
                  <div className="space-y-1">
                    <input
                      type="text"
                      placeholder="أضف ملاحظة خاصة بيوم التحضير (مثال: عذر طبي، تأخير موافقة إدارية)"
                      value={edit.notes || ''}
                      onChange={(e) => handleTimeChange(emp.id, 'notes', e.target.value)}
                      className="w-full px-3 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-slate-300 placeholder-slate-700 focus:outline-none focus:border-emerald-500 text-[10px] text-right"
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Fingerprint Devices Logs Uploader wizard */}
      <FingerprintUploader 
        isOpen={isUploaderOpen} 
        onClose={() => setIsUploaderOpen(false)} 
        employees={employees}
        shifts={shifts}
        onUploadSuccess={() => {
          loadData();
        }}
      />
    </div>
  );
}
