/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { db } from '../supabaseClient';
import { Employee, ShiftSchedule } from '../types';
import { UserPlus, Edit2, Trash2, Check, X, Users, Save, ShieldAlert, Phone, Briefcase, Hash, Info, Layers, AlertCircle } from 'lucide-react';
import { getPlanInfo, validateEmployeeCountLimit } from '../utils/plans';

export default function EmployeeManager() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [shifts, setShifts] = useState<ShiftSchedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  
  // Form States
  const [editId, setEditId] = useState<string | null>(null);
  const [empId, setEmpId] = useState('');
  const [name, setName] = useState('');
  const [department, setDepartment] = useState('');
  const [phone, setPhone] = useState('');
  const [shiftScheduleId, setShiftScheduleId] = useState('');
  const [isDualShift, setIsDualShift] = useState(false);

  const [currentUserPlan, setCurrentUserPlan] = useState<string>('الأساسية');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Sync global editing state so background refresh pauses when form is open
  useEffect(() => {
    (window as any).__IS_USER_EDITING__ = showForm;
    return () => {
      (window as any).__IS_USER_EDITING__ = false;
    };
  }, [showForm]);

  const loadData = async () => {
    setLoading(true);
    const [empData, shiftData, user] = await Promise.all([
      db.getEmployees(),
      db.getShifts(),
      db.getCurrentUser()
    ]);
    setEmployees(empData);
    setShifts(shiftData);
    if (user?.plan_type || user?.employee_package) {
      setCurrentUserPlan(user.plan_type || user.employee_package);
    }
    
    // Set default shift selection only if adding new and not yet selected
    if (shiftData.length > 0 && !shiftScheduleId) {
      setShiftScheduleId(shiftData[0].id);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadData();

    // Subscribe to employees and shifts for real-time updates
    const unsubscribeEmployees = db.subscribeToChanges('employees', () => {
      loadData();
    });
    const unsubscribeShifts = db.subscribeToChanges('shifts', () => {
      loadData();
    });

    return () => {
      unsubscribeEmployees();
      unsubscribeShifts();
    };
  }, []);

  const handleEdit = (emp: Employee) => {
    setEditId(emp.id);
    setEmpId(emp.emp_id);
    setName(emp.name);
    setDepartment(emp.department);
    setPhone(emp.phone);
    setShiftScheduleId(emp.shift_schedule_id);
    setIsDualShift(emp.is_dual_shift);
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('هل أنت متأكد من رغبتك في حذف هذا الموظف؟ سيتم حذف جميع بيانات الحضور المرتبطة به نهائياً.')) {
      return;
    }
    
    const { error: err } = await db.deleteEmployee(id);
    if (err) {
      setError('فشل في حذف سجل الموظف.');
    } else {
      setSuccess('تم حذف سجل الموظف بنجاح.');
      loadData();
      setTimeout(() => setSuccess(null), 3000);
    }
  };

  const resetForm = () => {
    setEditId(null);
    setEmpId('');
    setName('');
    setDepartment('');
    setPhone('');
    if (shifts.length > 0) {
      setShiftScheduleId(shifts[0].id);
    } else {
      setShiftScheduleId('');
    }
    setIsDualShift(false);
    setShowForm(false);
    setError(null);
  };

  // Automatically adjust Single/Dual based on selected shift type if changed
  useEffect(() => {
    const selectedShift = shifts.find(s => s.id === shiftScheduleId);
    if (selectedShift) {
      setIsDualShift(selectedShift.type === 'dual');
    }
  }, [shiftScheduleId, shifts]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!empId.trim() || !name.trim() || !department.trim() || !shiftScheduleId) {
      setError('يرجى ملء جميع الحقول الإلزامية وتحديد وردية العمل.');
      return;
    }

    const validation = validateEmployeeCountLimit(employees.length, currentUserPlan, !!editId);
    if (!validation.allowed) {
      setError(validation.message || 'عذراً، تجاوزت الحد الأقصى للموظفين المسموح به للباقة.');
      return;
    }

    const payload: Omit<Employee, 'user_id'> & { id?: string } = {
      id: editId || undefined,
      emp_id: empId.trim(),
      name: name.trim(),
      department: department.trim(),
      phone: phone.trim(),
      shift_schedule_id: shiftScheduleId,
      is_dual_shift: isDualShift
    };

    const { error: err } = await db.saveEmployee(payload);
    if (err) {
      setError(err.message || 'فشل في حفظ الموظف. قد يكون الرقم الوظيفي مكرراً.');
    } else {
      setSuccess(editId ? 'تم تعديل ملف الموظف بنجاح.' : 'تم تسجيل الموظف الجديد بنجاح.');
      loadData();
      resetForm();
      setTimeout(() => setSuccess(null), 3000);
    }
  };

  const activePlan = getPlanInfo(currentUserPlan);
  const planCheck = validateEmployeeCountLimit(employees.length, currentUserPlan, false);

  return (
    <div id="employee-manager" className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-center gap-4 bg-slate-900 p-6 rounded-2xl border border-slate-800 text-right">
        <div className="space-y-2 text-center sm:text-right">
          <div className="flex items-center gap-2 justify-center sm:justify-start flex-wrap">
            <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
              <Users className="w-5 h-5 text-emerald-400" />
              <span>إدارة الموظفين</span>
            </h2>

            {/* Plan Badge */}
            <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-500/10 border border-emerald-500/30 rounded-full text-xs font-bold text-emerald-400">
              <Layers className="w-3.5 h-3.5" />
              <span>{activePlan.name} ({activePlan.rangeText})</span>
              <span className="text-slate-400 font-mono font-normal">
                • {employees.length} / {activePlan.maxEmployees === Infinity ? '∞' : activePlan.maxEmployees} عامل
              </span>
            </div>
          </div>
          <p className="text-slate-400 text-xs">
            أضف الموظفين، واربطهم بالورديات الفردية أو الثنائية، وتابع بياناتهم الأساسية بحماية RLS كاملة.
          </p>
        </div>
        {!showForm && (
          <div className="flex items-center gap-2">
            {!planCheck.allowed ? (
              <div className="flex items-center gap-2 bg-rose-500/10 border border-rose-500/30 text-rose-400 px-4 py-2 rounded-xl text-xs font-bold">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                <span>وصلت للحد الأقصى للباقة ({activePlan.maxEmployees} عامل)</span>
              </div>
            ) : (
              <button
                onClick={() => { resetForm(); setShowForm(true); }}
                className="px-5 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-lg text-xs flex items-center gap-2 transition duration-150 cursor-pointer shadow-lg shadow-emerald-500/5"
              >
                <UserPlus className="w-4 h-4 stroke-[2.5]" />
                <span>إضافة موظف جديد</span>
              </button>
            )}
          </div>
        )}
      </div>

      {success && (
        <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs rounded-lg text-right">
          {success}
        </div>
      )}

      {error && (
        <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs rounded-lg text-right flex gap-2 items-center justify-start">
          <ShieldAlert className="w-4 h-4 text-rose-400 flex-shrink-0" />
          <span>{error}</span>
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
                  {editId ? 'تعديل ملف الموظف' : 'تسجيل موظف جديد'}
                </h3>
                <button
                  type="button"
                  onClick={resetForm}
                  className="p-1 hover:bg-slate-800 text-slate-500 hover:text-slate-300 rounded-lg transition"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {shifts.length === 0 && (
                <div className="p-4 bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs rounded-xl flex items-start gap-2 justify-start leading-relaxed">
                  <ShieldAlert className="w-5 h-5 flex-shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold">ملاحظة مهمة:</span> لا توجد أية ورديات عمل مدخلة بالنظام حالياً. يرجى التوجه لعلامة تبويب <span className="underline">أوقات العمل</span> وتهيئة وردية واحدة على الأقل أولاً لربط الموظفين بها.
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Employee ID (Sequential or custom, unique inside user_id) */}
                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-slate-300 flex items-center gap-1 justify-start">
                    <Hash className="w-3.5 h-3.5 text-slate-500" />
                    <span>الرقم الوظيفي <span className="text-rose-500">*</span></span>
                  </label>
                  <input
                    type="text"
                    required
                    value={empId}
                    onChange={(e) => setEmpId(e.target.value)}
                    placeholder="مثال: EMP-2026-05"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 placeholder-slate-700 focus:outline-none focus:border-emerald-500 text-xs text-right font-sans"
                  />
                  <span className="block text-[10px] text-slate-500 mt-1">
                    رقم فريد لكل موظف بمؤسستك (مستند لقانون RLS Composite)
                  </span>
                </div>

                {/* Name */}
                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-slate-300 flex items-center gap-1 justify-start">
                    <Users className="w-3.5 h-3.5 text-slate-500" />
                    <span>اسم الموظف بالكامل <span className="text-rose-500">*</span></span>
                  </label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="مثال: أحمد عبد الله الهاشمي"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 placeholder-slate-700 focus:outline-none focus:border-emerald-500 text-xs text-right"
                  />
                </div>

                {/* Department */}
                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-slate-300 flex items-center gap-1 justify-start">
                    <Briefcase className="w-3.5 h-3.5 text-slate-500" />
                    <span>القسم أو الإدارة <span className="text-rose-500">*</span></span>
                  </label>
                  <input
                    type="text"
                    required
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                    placeholder="مثال: إدارة تقنية المعلومات"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 placeholder-slate-700 focus:outline-none focus:border-emerald-500 text-xs text-right"
                  />
                </div>

                {/* Phone */}
                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-slate-300 flex items-center gap-1 justify-start">
                    <Phone className="w-3.5 h-3.5 text-slate-500" />
                    <span>رقم الهاتف الجوال</span>
                  </label>
                  <input
                    type="text"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="مثال: +966 50 000 0000"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 placeholder-slate-700 focus:outline-none focus:border-emerald-500 text-xs text-right font-sans"
                  />
                </div>

                {/* Linked Shift Schedule */}
                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-slate-300">وردية الدوام المرتبطة</label>
                  <select
                    required
                    value={shiftScheduleId}
                    onChange={(e) => setShiftScheduleId(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 focus:outline-none focus:border-emerald-500 text-xs text-right"
                  >
                    <option value="" disabled>اختر الوردية المناسبة...</option>
                    {shifts.map(s => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.type === 'dual' ? 'شفتين' : 'شفت واحد'})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Shift Allocation Policy Display */}
                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-slate-300">ألية احتساب الحضور اليومي</label>
                  <div className="p-3 bg-slate-950 border border-slate-850 rounded-lg text-xs flex justify-between items-center h-[38px]">
                    <span className="text-slate-400">نمط تفعيل شفتين (مزدوج):</span>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      isDualShift 
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' 
                        : 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                    }`}>
                      {isDualShift ? 'مزدوج - شفتين باليوم' : 'فردي - شفت واحد باليوم'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Informational banner */}
              <div className="p-3 bg-slate-950 border border-slate-850 rounded-xl text-[10px] text-slate-400 flex items-start gap-2 justify-start">
                <Info className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                <span>
                  نظام التصفية والتقرير التراكمي يتبع تلقائياً نمط هذا الموظف. في حال ربطه بـ "شفتين"، سيقوم المحرك بتحليل فترتي التوقيع لليوم ومطابقتهما معاً لجمع الساعات وحساب التأخير والوقت الإضافي.
                </span>
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
                  disabled={shifts.length === 0}
                  className="px-5 py-2 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 rounded-lg text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>حفظ الموظف</span>
                </button>
              </div>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Employees Grid list */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden p-6 space-y-4 text-right">
        <h3 className="text-sm font-bold text-slate-200">سجل الموظفين المسجلين</h3>
        
        {loading ? (
          <div className="py-12 flex flex-col items-center justify-center text-slate-500 space-y-2">
            <span className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
            <span className="text-xs">جاري تحميل سجل الموظفين...</span>
          </div>
        ) : employees.length === 0 ? (
          <div className="py-12 text-center text-slate-500 text-xs">
            لا يوجد موظفون مسجلون حالياً. يرجى إضافة موظف جديد لتفعيل البصمات والتقارير.
          </div>
        ) : (
          <div className="overflow-auto max-h-[500px] border border-slate-800 rounded-xl relative scrollbar-thin scrollbar-thumb-slate-800">
            <table className="w-full text-xs text-right text-slate-300 min-w-[700px] border-collapse">
              <thead className="text-slate-400 text-[11px] uppercase">
                <tr>
                  <th scope="col" className="sticky top-0 right-0 bg-slate-950 z-30 px-4 py-3 border-b border-slate-850 border-l border-slate-800 text-emerald-400 font-extrabold text-right">اسم الموظف</th>
                  <th scope="col" className="sticky top-0 bg-slate-950 z-20 px-4 py-3 border-b border-slate-850 text-right">الرقم الوظيفي</th>
                  <th scope="col" className="sticky top-0 bg-slate-950 z-20 px-4 py-3 border-b border-slate-850 text-right">القسم / الإدارة</th>
                  <th scope="col" className="sticky top-0 bg-slate-950 z-20 px-4 py-3 border-b border-slate-850 text-right">الهاتف الجوال</th>
                  <th scope="col" className="sticky top-0 bg-slate-950 z-20 px-4 py-3 border-b border-slate-850 text-right">الوردية المرتبطة</th>
                  <th scope="col" className="sticky top-0 bg-slate-950 z-20 px-4 py-3 border-b border-slate-850 text-right">نظام العمل</th>
                  <th scope="col" className="sticky top-0 bg-slate-950 z-20 px-4 py-3 border-b border-slate-850 text-left">التحكم</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {employees.map((emp) => {
                  const linkedShift = shifts.find(s => s.id === emp.shift_schedule_id);
                  return (
                    <tr key={emp.id} className="group hover:bg-slate-950/40 transition-colors">
                      <td className="sticky right-0 bg-slate-900 group-hover:bg-slate-950/90 transition-colors z-10 px-4 py-3.5 font-bold text-slate-100 border-l border-slate-800/80 shadow-[2px_0_5px_rgba(0,0,0,0.2)] text-right">{emp.name}</td>
                      <td className="px-4 py-3.5 font-mono font-bold text-slate-300 text-right">{emp.emp_id}</td>
                      <td className="px-4 py-3.5 text-right">{emp.department}</td>
                      <td className="px-4 py-3.5 font-mono text-slate-400 text-right">{emp.phone || '—'}</td>
                      <td className="px-4 py-3.5 text-emerald-400 font-semibold text-right">{linkedShift?.name || 'غير محدد'}</td>
                      <td className="px-4 py-3.5 text-right">
                        <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
                          emp.is_dual_shift 
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' 
                            : 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                        }`}>
                          {emp.is_dual_shift ? 'شفتين' : 'شفت واحد'}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-left">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleEdit(emp)}
                            className="p-1.5 bg-slate-950 border border-slate-800 hover:border-emerald-500/40 text-slate-400 hover:text-emerald-400 rounded transition cursor-pointer"
                            title="تعديل بيانات الموظف"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDelete(emp.id)}
                            className="p-1.5 bg-slate-950 border border-slate-800 hover:border-rose-500/40 text-slate-400 hover:text-rose-400 rounded transition cursor-pointer"
                            title="حذف الموظف"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
