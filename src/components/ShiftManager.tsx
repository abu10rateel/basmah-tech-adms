/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { db } from '../supabaseClient';
import { ShiftSchedule } from '../types';
import { Calendar, Plus, Edit2, Trash2, Check, X, Clock, HelpCircle, Save, Sparkles, Copy, FileCode, Terminal, ArrowRightLeft, UserX, AlertTriangle, Fingerprint } from 'lucide-react';

export default function ShiftManager() {
  const [shifts, setShifts] = useState<ShiftSchedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  
  // Form States
  const [editId, setEditId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [type, setType] = useState<'single' | 'dual'>('single');
  const [shift1Start, setShift1Start] = useState('08:00');
  const [shift1End, setShift1End] = useState('16:00');
  const [shift2Start, setShift2Start] = useState('17:00');
  const [shift2End, setShift2End] = useState('21:00');
  const [graceMinutes, setGraceMinutes] = useState(15);
  const [overtimeThreshold, setOvertimeThreshold] = useState(30);
  
  // BioTime Custom Windows State
  const [checkinStart, setCheckinStart] = useState('06:00');
  const [checkinEnd, setCheckinEnd] = useState('11:00');
  const [checkoutStart, setCheckoutStart] = useState('14:00');
  const [checkoutEnd, setCheckoutEnd] = useState('20:00');

  // BioTime Custom Windows State for Shift 2
  const [checkin2Start, setCheckin2Start] = useState('15:00');
  const [checkin2End, setCheckin2End] = useState('19:00');
  const [checkout2Start, setCheckout2Start] = useState('20:00');
  const [checkout2End, setCheckout2End] = useState('23:59');

  // Helper to add/subtract minutes from HH:MM
  const addMinutesToTimeStr = (timeStr: string, mins: number): string => {
    try {
      const parts = timeStr.split(':');
      if (parts.length !== 2) return timeStr;
      const total = (parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10) + mins + 1440) % 1440;
      const h = Math.floor(total / 60);
      const m = total % 60;
      return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    } catch (e) {
      return timeStr;
    }
  };

  // Live Auto-Defaults when adding new shift
  useEffect(() => {
    if (!editId) {
      setCheckinStart(addMinutesToTimeStr(shift1Start, -120));
      setCheckinEnd(addMinutesToTimeStr(shift1Start, 180));
    }
  }, [shift1Start, editId]);

  useEffect(() => {
    if (!editId) {
      setCheckoutStart(addMinutesToTimeStr(shift1End, -120));
      setCheckoutEnd(addMinutesToTimeStr(shift1End, 240));
    }
  }, [shift1End, editId]);

  useEffect(() => {
    if (!editId && type === 'dual') {
      setCheckin2Start(addMinutesToTimeStr(shift2Start, -120));
      setCheckin2End(addMinutesToTimeStr(shift2Start, 180));
    }
  }, [shift2Start, editId, type]);

  useEffect(() => {
    if (!editId && type === 'dual') {
      setCheckout2Start(addMinutesToTimeStr(shift2End, -120));
      setCheckout2End(addMinutesToTimeStr(shift2End, 240));
    }
  }, [shift2End, editId, type]);
  
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);



  // Sync global editing state so background refresh pauses when shift form is open
  useEffect(() => {
    (window as any).__IS_USER_EDITING__ = showForm;
    return () => {
      (window as any).__IS_USER_EDITING__ = false;
    };
  }, [showForm]);

  // Fetch shifts
  const fetchShifts = async () => {
    setLoading(true);
    const data = await db.getShifts();
    setShifts(data);
    setLoading(false);
  };

  useEffect(() => {
    fetchShifts();
    
    // Subscribe to changes for Real-time hydration
    const unsubscribe = db.subscribeToChanges('shifts', () => {
      fetchShifts();
    });
    
    return () => {
      unsubscribe();
    };
  }, []);

  const handleEdit = (shift: ShiftSchedule) => {
    setEditId(shift.id);
    setName(shift.name);
    setType(shift.type);
    setShift1Start(shift.shift1_start);
    setShift1End(shift.shift1_end);
    setShift2Start(shift.shift2_start || '17:00');
    setShift2End(shift.shift2_end || '21:00');
    setGraceMinutes(shift.grace_minutes);
    setOvertimeThreshold(shift.overtime_threshold_minutes);
    setCheckinStart(shift.checkin_start || addMinutesToTimeStr(shift.shift1_start, -120));
    setCheckinEnd(shift.checkin_end || addMinutesToTimeStr(shift.shift1_start, 180));
    setCheckoutStart(shift.checkout_start || addMinutesToTimeStr(shift.shift1_end, -120));
    setCheckoutEnd(shift.checkout_end || addMinutesToTimeStr(shift.shift1_end, 240));
    setCheckin2Start(shift.checkin2_start || addMinutesToTimeStr(shift.shift2_start || '17:00', -120));
    setCheckin2End(shift.checkin2_end || addMinutesToTimeStr(shift.shift2_start || '17:00', 180));
    setCheckout2Start(shift.checkout2_start || addMinutesToTimeStr(shift.shift2_end || '21:00', -120));
    setCheckout2End(shift.checkout2_end || addMinutesToTimeStr(shift.shift2_end || '21:00', 240));
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('هل أنت متأكد من رغبتك في حذف وردية العمل هذه؟ قد يؤثر هذا على الموظفين المرتبطين بها.')) {
      return;
    }
    
    const { error: err } = await db.deleteShift(id);
    if (err) {
      setError('فشل في حذف وردية العمل.');
    } else {
      setSuccess('تم حذف وردية العمل بنجاح.');
      fetchShifts();
      setTimeout(() => setSuccess(null), 3000);
    }
  };

  const resetForm = () => {
    setEditId(null);
    setName('');
    setType('single');
    setShift1Start('08:00');
    setShift1End('16:00');
    setShift2Start('17:00');
    setShift2End('21:00');
    setGraceMinutes(15);
    setOvertimeThreshold(30);
    setCheckinStart('06:00');
    setCheckinEnd('11:00');
    setCheckoutStart('14:00');
    setCheckoutEnd('20:00');
    setCheckin2Start('15:00');
    setCheckin2End('19:00');
    setCheckout2Start('20:00');
    setCheckout2End('23:59');
    setShowForm(false);
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!name.trim()) {
      setError('الرجاء إدخال اسم وردية العمل.');
      return;
    }

    // Basic time validations
    if (type === 'dual') {
      if (!shift2Start || !shift2End) {
        setError('الرجاء تحديد مواعيد الشفت الثاني بالكامل.');
        return;
      }
    }

    const payload: Omit<ShiftSchedule, 'user_id'> & { id?: string } = {
      id: editId || undefined,
      name: name.trim(),
      type,
      shift1_start: shift1Start,
      shift1_end: shift1End,
      shift2_start: type === 'dual' ? shift2Start : undefined,
      shift2_end: type === 'dual' ? shift2End : undefined,
      grace_minutes: Number(graceMinutes),
      overtime_threshold_minutes: Number(overtimeThreshold),
      checkin_start: checkinStart,
      checkin_end: checkinEnd,
      checkout_start: checkoutStart,
      checkout_end: checkoutEnd,
      checkin2_start: type === 'dual' ? checkin2Start : undefined,
      checkin2_end: type === 'dual' ? checkin2End : undefined,
      checkout2_start: type === 'dual' ? checkout2Start : undefined,
      checkout2_end: type === 'dual' ? checkout2End : undefined,
    };

    const { error: err } = await db.saveShift(payload);
    if (err) {
      setError(typeof err === 'string' ? err : err.message || 'فشل في حفظ وردية العمل.');
    } else {
      setSuccess(editId ? 'تم تحديث الوردية بنجاح.' : 'تم إضافة الوردية بنجاح.');
      fetchShifts();
      resetForm();
      setTimeout(() => setSuccess(null), 3000);
    }
  };

  return (
    <div id="shift-manager" className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-center gap-4 bg-slate-900 p-6 rounded-2xl border border-slate-800 text-right">
        <div className="space-y-1 text-center sm:text-right">
          <h2 className="text-xl font-bold text-slate-100 flex items-center justify-center sm:justify-start gap-2">
            <Clock className="w-5 h-5 text-emerald-400" />
            <span>إدارة مواعيد العمل والورديات</span>
          </h2>
          <p className="text-slate-400 text-xs">
            قم بتهيئة الشيفتات الفردية والمزدوجة، وفترات السماح، وقواعد احتساب الوقت الإضافي بدقة.
          </p>
        </div>
        {!showForm && (
          <button
            onClick={() => { resetForm(); setShowForm(true); }}
            className="px-5 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-lg text-xs flex items-center gap-2 transition duration-150 cursor-pointer shadow-lg shadow-emerald-500/5"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span>إضافة وردية جديدة</span>
          </button>
        )}
      </div>

      {success && (
        <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs rounded-lg text-right">
          {success}
        </div>
      )}

      {error && (
        <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs rounded-lg text-right">
          {error}
        </div>
      )}

      {/* Form Section */}
      <AnimatePresence>
        {showForm && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <form onSubmit={handleSubmit} className="bg-slate-900 border border-slate-800 p-6 rounded-2xl space-y-6 text-right">
              <div className="flex justify-between items-center pb-4 border-b border-slate-800">
                <h3 className="text-sm font-bold text-slate-200">
                  {editId ? 'تعديل وردية العمل' : 'إضافة وردية عمل جديدة'}
                </h3>
                <button
                  type="button"
                  onClick={resetForm}
                  className="p-1 hover:bg-slate-800 text-slate-500 hover:text-slate-300 rounded-lg transition"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Shift Name */}
                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-slate-300">اسم الوردية</label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="مثال: الوردية الإدارية العامة"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 placeholder-slate-700 focus:outline-none focus:border-emerald-500 text-xs text-right"
                  />
                </div>

                {/* Shift Type Toggle */}
                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-slate-300">نوع نظام العمل باليوم</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setType('single')}
                      className={`py-2 px-3 rounded-lg text-xs font-bold transition border cursor-pointer ${
                        type === 'single'
                          ? 'bg-emerald-500/10 border-emerald-500 text-emerald-400'
                          : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-300'
                      }`}
                    >
                      شفت واحد (فردي)
                    </button>
                    <button
                      type="button"
                      onClick={() => setType('dual')}
                      className={`py-2 px-3 rounded-lg text-xs font-bold transition border cursor-pointer ${
                        type === 'dual'
                          ? 'bg-emerald-500/10 border-emerald-500 text-emerald-400'
                          : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-300'
                      }`}
                    >
                      شفتين (مزدوج)
                    </button>
                  </div>
                </div>
              </div>

              {/* Timings Section */}
              <div className="space-y-4 pt-2 border-t border-slate-800/60">
                <h4 className="text-xs font-bold text-slate-300 flex items-center gap-1.5 justify-start">
                  <Calendar className="w-3.5 h-3.5 text-emerald-500" />
                  <span>تحديد مواقيت العمل الرسمية</span>
                </h4>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Shift 1 */}
                  <div className="p-4 bg-slate-950 border border-slate-850 rounded-xl space-y-3">
                    <div className="text-xs font-bold text-emerald-400 border-b border-slate-800 pb-1.5">
                      {type === 'dual' ? 'الشفت الأول (صباحي)' : 'الشيفت العام'}
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="block text-[10px] text-slate-400">بداية البصمة</label>
                        <input
                          type="time"
                          required
                          value={shift1Start}
                          onChange={(e) => setShift1Start(e.target.value)}
                          className="w-full px-2 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-slate-100 text-xs focus:outline-none focus:border-emerald-500 text-center font-mono"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="block text-[10px] text-slate-400">نهاية البصمة</label>
                        <input
                          type="time"
                          required
                          value={shift1End}
                          onChange={(e) => setShift1End(e.target.value)}
                          className="w-full px-2 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-slate-100 text-xs focus:outline-none focus:border-emerald-500 text-center font-mono"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Shift 2 (Conditional) */}
                  {type === 'dual' ? (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="p-4 bg-slate-950 border border-slate-850 rounded-xl space-y-3"
                    >
                      <div className="text-xs font-bold text-emerald-400 border-b border-slate-800 pb-1.5">
                        الشفت الثاني (مسائي)
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <label className="block text-[10px] text-slate-400">بداية البصمة</label>
                          <input
                            type="time"
                            required
                            value={shift2Start}
                            onChange={(e) => setShift2Start(e.target.value)}
                            className="w-full px-2 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-slate-100 text-xs focus:outline-none focus:border-emerald-500 text-center font-mono"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="block text-[10px] text-slate-400">نهاية البصمة</label>
                          <input
                            type="time"
                            required
                            value={shift2End}
                            onChange={(e) => setShift2End(e.target.value)}
                            className="w-full px-2 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-slate-100 text-xs focus:outline-none focus:border-emerald-500 text-center font-mono"
                          />
                        </div>
                      </div>
                    </motion.div>
                  ) : (
                    <div className="p-4 bg-slate-950/40 border border-slate-900 border-dashed rounded-xl flex items-center justify-center text-slate-600 text-xs text-center py-8">
                      الشفت الثاني غير مفعل في هذا النظام الفردي.
                    </div>
                  )}
                </div>
              </div>

              {/* Policy Settings */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-slate-800/60">
                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-slate-300">
                    فترة السماح (دقائق التأخير المسموح بها)
                  </label>
                  <div className="relative flex items-center">
                    <input
                      type="number"
                      min="0"
                      required
                      value={graceMinutes}
                      onChange={(e) => setGraceMinutes(Math.max(0, Number(e.target.value)))}
                      className="w-full pl-12 pr-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 focus:outline-none focus:border-emerald-500 text-xs text-right"
                    />
                    <span className="absolute left-3 text-[10px] font-bold text-slate-500 font-sans">دقيقة</span>
                  </div>
                  <span className="block text-[10px] text-slate-500 mt-1">
                    لن يتم احتساب الموظف متأخراً إذا سجل حضوره خلال هذه الدقائق بعد موعد البدء.
                  </span>
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-slate-300">
                    الحد الأدنى لاحتساب الوقت الإضافي
                  </label>
                  <div className="relative flex items-center">
                    <input
                      type="number"
                      min="0"
                      required
                      value={overtimeThreshold}
                      onChange={(e) => setOvertimeThreshold(Math.max(0, Number(e.target.value)))}
                      className="w-full pl-12 pr-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 focus:outline-none focus:border-emerald-500 text-xs text-right"
                    />
                    <span className="absolute left-3 text-[10px] font-bold text-slate-500 font-sans">دقيقة</span>
                  </div>
                  <span className="block text-[10px] text-slate-500 mt-1">
                    يتم احتساب الساعات الإضافية للموظف فقط إذا زادت ساعات عمله عن المدة الرسمية بهذا المقدار.
                  </span>
                </div>
              </div>

              {/* BioTime Punch Windows Customization */}
              <div className="space-y-4 pt-4 border-t border-slate-800/60 text-right">
                <div className="flex items-center gap-2">
                  <Fingerprint className="w-4 h-4 text-emerald-400" />
                  <h4 className="text-xs font-bold text-slate-200">إعدادات نافذة التبصيم الفريدة للوردية (خوارزمية BioTime الذكية)</h4>
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  تسمح لك هذه النوافذ بالتحكم بدقة متى يبدأ وينتهي وقت قبول بصمات الحضور والانصراف لهذه الوردية تحديداً. يساعد هذا في منع تداخل البصمات وتوجيه كل بصمة للوردية المناسبة بشكل منفصل تلقائياً.
                </p>

                <div className="space-y-6">
                  {/* Shift 1 Windows */}
                  <div className="space-y-3">
                    {type === 'dual' && (
                      <div className="text-xs font-bold text-slate-300 border-r-2 border-emerald-500 pr-2">
                        الشفت الأول (صباحي)
                      </div>
                    )}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Check-In Window Card */}
                      <div className="p-4 bg-slate-950/60 border border-slate-850 rounded-xl space-y-3">
                        <div className="text-xs font-bold text-emerald-400 flex items-center gap-1.5 border-b border-slate-850 pb-2">
                          <Clock className="w-3.5 h-3.5" />
                          <span>نافذة بصمة الحضور (Check-In Window)</span>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <label className="block text-[10px] text-slate-400">بداية قبول الحضور</label>
                            <input
                              type="time"
                              required
                              value={checkinStart}
                              onChange={(e) => setCheckinStart(e.target.value)}
                              className="w-full px-2 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-slate-100 text-xs focus:outline-none focus:border-emerald-500 text-center font-mono"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="block text-[10px] text-slate-400">نهاية قبول الحضور</label>
                            <input
                              type="time"
                              required
                              value={checkinEnd}
                              onChange={(e) => setCheckinEnd(e.target.value)}
                              className="w-full px-2 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-slate-100 text-xs focus:outline-none focus:border-emerald-500 text-center font-mono"
                            />
                          </div>
                        </div>
                        <span className="block text-[9px] text-slate-500 leading-normal">
                          البصمات المسجلة في هذه الفترة ستعتبر محاولة لتسجيل الحضور للوردية الأولى. يتم اقتراحها تلقائياً حسب موعد بدء الوردية.
                        </span>
                      </div>

                      {/* Check-Out Window Card */}
                      <div className="p-4 bg-slate-950/60 border border-slate-850 rounded-xl space-y-3">
                        <div className="text-xs font-bold text-rose-400 flex items-center gap-1.5 border-b border-slate-850 pb-2">
                          <Clock className="w-3.5 h-3.5" />
                          <span>نافذة بصمة الانصراف (Check-Out Window)</span>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <label className="block text-[10px] text-slate-400">بداية قبول الانصراف</label>
                            <input
                              type="time"
                              required
                              value={checkoutStart}
                              onChange={(e) => setCheckoutStart(e.target.value)}
                              className="w-full px-2 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-slate-100 text-xs focus:outline-none focus:border-rose-500 text-center font-mono"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="block text-[10px] text-slate-400">نهاية قبول الانصراف</label>
                            <input
                              type="time"
                              required
                              value={checkoutEnd}
                              onChange={(e) => setCheckoutEnd(e.target.value)}
                              className="w-full px-2 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-slate-100 text-xs focus:outline-none focus:border-rose-500 text-center font-mono"
                            />
                          </div>
                        </div>
                        <span className="block text-[9px] text-slate-500 leading-normal">
                          البصمات المسجلة في هذه الفترة ستعتبر محاولة لتسجيل الانصراف للوردية الأولى. يتم اقتراحها تلقائياً حسب موعد انصراف الوردية.
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Shift 2 Windows (Conditional) */}
                  {type === 'dual' && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="space-y-3 pt-2"
                    >
                      <div className="text-xs font-bold text-slate-300 border-r-2 border-amber-500 pr-2">
                        الشفت الثاني (مسائي)
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Check-In Window Card Shift 2 */}
                        <div className="p-4 bg-slate-950/60 border border-slate-850 rounded-xl space-y-3">
                          <div className="text-xs font-bold text-emerald-400 flex items-center gap-1.5 border-b border-slate-850 pb-2">
                            <Clock className="w-3.5 h-3.5" />
                            <span>نافذة بصمة الحضور الشفت الثاني (Check-In 2)</span>
                          </div>

                          <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1">
                              <label className="block text-[10px] text-slate-400">بداية قبول الحضور</label>
                              <input
                                type="time"
                                required={type === 'dual'}
                                value={checkin2Start}
                                onChange={(e) => setCheckin2Start(e.target.value)}
                                className="w-full px-2 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-slate-100 text-xs focus:outline-none focus:border-emerald-500 text-center font-mono"
                              />
                            </div>
                            <div className="space-y-1">
                              <label className="block text-[10px] text-slate-400">نهاية قبول الحضور</label>
                              <input
                                type="time"
                                required={type === 'dual'}
                                value={checkin2End}
                                onChange={(e) => setCheckin2End(e.target.value)}
                                className="w-full px-2 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-slate-100 text-xs focus:outline-none focus:border-emerald-500 text-center font-mono"
                              />
                            </div>
                          </div>
                          <span className="block text-[9px] text-slate-500 leading-normal">
                            البصمات المسجلة في هذه الفترة ستعتبر محاولة لتسجيل الحضور للوردية الثانية. يتم اقتراحها تلقائياً حسب موعد بدء الوردية.
                          </span>
                        </div>

                        {/* Check-Out Window Card Shift 2 */}
                        <div className="p-4 bg-slate-950/60 border border-slate-850 rounded-xl space-y-3">
                          <div className="text-xs font-bold text-rose-400 flex items-center gap-1.5 border-b border-slate-850 pb-2">
                            <Clock className="w-3.5 h-3.5" />
                            <span>نافذة بصمة الانصراف الشفت الثاني (Check-Out 2)</span>
                          </div>

                          <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1">
                              <label className="block text-[10px] text-slate-400">بداية قبول الانصراف</label>
                              <input
                                type="time"
                                required={type === 'dual'}
                                value={checkout2Start}
                                onChange={(e) => setCheckout2Start(e.target.value)}
                                className="w-full px-2 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-slate-100 text-xs focus:outline-none focus:border-rose-500 text-center font-mono"
                              />
                            </div>
                            <div className="space-y-1">
                              <label className="block text-[10px] text-slate-400">نهاية قبول الانصراف</label>
                              <input
                                type="time"
                                required={type === 'dual'}
                                value={checkout2End}
                                onChange={(e) => setCheckout2End(e.target.value)}
                                className="w-full px-2 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-slate-100 text-xs focus:outline-none focus:border-rose-500 text-center font-mono"
                              />
                            </div>
                          </div>
                          <span className="block text-[9px] text-slate-500 leading-normal">
                            البصمات المسجلة في هذه الفترة ستعتبر محاولة لتسجيل الانصراف للوردية الثانية. يتم اقتراحها تلقائياً حسب موعد انصراف الوردية.
                          </span>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </div>
              </div>

              {/* Buttons */}
              <div className="flex justify-end gap-3 pt-4 border-t border-slate-800/60">
                <button
                  type="button"
                  onClick={resetForm}
                  className="px-4 py-2 bg-slate-950 border border-slate-800 hover:bg-slate-800 text-slate-300 rounded-lg text-xs font-bold transition cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 rounded-lg text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>حفظ وردية العمل</span>
                </button>
              </div>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Shifts List Table / Cards */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden p-6 space-y-4 text-right">
        <h3 className="text-sm font-bold text-slate-200">الورديات المسجلة حالياً</h3>
        
        {loading ? (
          <div className="py-12 flex flex-col items-center justify-center text-slate-500 space-y-2">
            <span className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
            <span className="text-xs">جاري تحميل بيانات الورديات...</span>
          </div>
        ) : shifts.length === 0 ? (
          <div className="py-12 text-center text-slate-500 text-xs">
            لا توجد أية ورديات عمل مسجلة حتى الآن. انقر على الزر بالأعلى لإضافة واحدة.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {shifts.map((shift) => (
              <div
                key={shift.id}
                className="bg-slate-950 border border-slate-850 p-5 rounded-xl space-y-4 flex flex-col justify-between"
              >
                <div>
                  <div className="flex justify-between items-start gap-2">
                    {/* Action buttons */}
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => handleEdit(shift)}
                        className="p-1.5 bg-slate-900 border border-slate-800 hover:border-emerald-500/40 text-slate-400 hover:text-emerald-400 rounded-lg transition cursor-pointer"
                        title="تعديل الوردية"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDelete(shift.id)}
                        className="p-1.5 bg-slate-900 border border-slate-800 hover:border-rose-500/40 text-slate-400 hover:text-rose-400 rounded-lg transition cursor-pointer"
                        title="حذف الوردية"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div className="space-y-1 text-right">
                      <h4 className="text-xs font-bold text-slate-200">{shift.name}</h4>
                      <span className={`inline-block px-2 py-0.5 rounded-full text-[9px] font-bold ${
                        shift.type === 'dual' 
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          : 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                      }`}>
                        {shift.type === 'dual' ? 'نظام شفتين (مزدوج)' : 'نظام شفت واحد (فردي)'}
                      </span>
                    </div>
                  </div>

                  {/* Timings summary */}
                  <div className="grid grid-cols-2 gap-2 mt-4 text-xs font-mono">
                    <div className="p-2.5 bg-slate-900/60 rounded-lg border border-slate-900">
                      <div className="text-[9px] text-slate-500 text-right mb-1">
                        {shift.type === 'dual' ? 'الشفت الصباحي' : 'فترة الدوام'}
                      </div>
                      <div className="text-slate-200 text-center text-xs tracking-wider">
                        {shift.shift1_start} - {shift.shift1_end}
                      </div>
                    </div>

                    {shift.type === 'dual' ? (
                      <div className="p-2.5 bg-slate-900/60 rounded-lg border border-slate-900">
                        <div className="text-[9px] text-slate-500 text-right mb-1">الشفت المسائي</div>
                        <div className="text-slate-200 text-center text-xs tracking-wider">
                          {shift.shift2_start} - {shift.shift2_end}
                        </div>
                      </div>
                    ) : (
                      <div className="p-2.5 bg-slate-900/10 rounded-lg border border-slate-900 border-dashed flex items-center justify-center text-[10px] text-slate-600">
                        شفت ثانٍ مغلق
                      </div>
                    )}
                  </div>

                  {/* BioTime Punch Windows on Card */}
                  <div className="mt-3 pt-3 border-t border-slate-900/40 text-[10px] text-slate-400 space-y-2 text-right">
                    <div className="font-bold text-slate-300 flex items-center gap-1">
                      <Fingerprint className="w-3 h-3 text-emerald-400" />
                      <span>نوافذ التبصيم الفردية للوردية (BioTime):</span>
                    </div>

                    <div className="p-2 bg-slate-900/30 rounded-lg space-y-1 border border-slate-900">
                      <div className="text-[9px] font-bold text-slate-400">
                        {shift.type === 'dual' ? 'الشفت الأول:' : 'الشيفت العام:'}
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-[10px]">
                        <div>
                          <span className="text-slate-500">الحضور:</span>{' '}
                          <span className="text-emerald-400 font-mono">
                            {shift.checkin_start || addMinutesToTimeStr(shift.shift1_start, -120)} - {shift.checkin_end || addMinutesToTimeStr(shift.shift1_start, 180)}
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-500">الانصراف:</span>{' '}
                          <span className="text-rose-400 font-mono">
                            {shift.checkout_start || addMinutesToTimeStr(shift.shift1_end, -120)} - {shift.checkout_end || addMinutesToTimeStr(shift.shift1_end, 240)}
                          </span>
                        </div>
                      </div>
                    </div>

                    {shift.type === 'dual' && (
                      <div className="p-2 bg-slate-900/30 rounded-lg space-y-1 border border-slate-900">
                        <div className="text-[9px] font-bold text-slate-400">الشفت الثاني:</div>
                        <div className="grid grid-cols-2 gap-2 text-[10px]">
                          <div>
                            <span className="text-slate-500">الحضور:</span>{' '}
                            <span className="text-emerald-400 font-mono">
                              {shift.checkin2_start || addMinutesToTimeStr(shift.shift2_start || '17:00', -120)} - {shift.checkin2_end || addMinutesToTimeStr(shift.shift2_start || '17:00', 180)}
                            </span>
                          </div>
                          <div>
                            <span className="text-slate-500">الانصراف:</span>{' '}
                            <span className="text-rose-400 font-mono">
                              {shift.checkout2_start || addMinutesToTimeStr(shift.shift2_end || '21:00', -120)} - {shift.checkout2_end || addMinutesToTimeStr(shift.shift2_end || '21:00', 240)}
                            </span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Grace/OT Meta info */}
                <div className="pt-3 border-t border-slate-900 flex justify-between items-center text-[10px] text-slate-400">
                  <div>فترة السماح: <span className="text-slate-200 font-sans font-semibold">{shift.grace_minutes} دقيقة</span></div>
                  <div>الوقت الإضافي بعد: <span className="text-slate-200 font-sans font-semibold">{shift.overtime_threshold_minutes} دقيقة</span></div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
