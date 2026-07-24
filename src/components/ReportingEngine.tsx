/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { db } from '../supabaseClient';
import { Employee, ShiftSchedule, AttendanceLog, DailyCalculationResult, CumulativeSummary } from '../types';
import { 
  calculateDailyMetrics, 
  generateCumulativeSummary, 
  getDatesInRange, 
  formatDateArabic, 
  formatHoursArabic, 
  formatMinutesArabic,
  formatHoursToHHMM,
  formatMinutesToHHMM,
  formatSignedMinutesToHHMM
} from '../utils/calc';
import { Calendar, Users, Printer, BarChart3, Clock, AlertTriangle, FileText, CheckCircle, Info, Download, Fingerprint, Phone } from 'lucide-react';

export default function ReportingEngine() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [shifts, setShifts] = useState<ShiftSchedule[]>([]);
  const [logs, setLogs] = useState<AttendanceLog[]>([]);
  const [loading, setLoading] = useState(true);

  // Default dates: 25th of last month to 25th of current month
  const getDefaultDates = () => {
    const today = new Date();
    
    // Last month
    const lastMonth = new Date();
    lastMonth.setMonth(today.getMonth() - 1);
    
    const startStr = `${lastMonth.getFullYear()}-${String(lastMonth.getMonth() + 1).padStart(2, '0')}-25`;
    const endStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-25`;
    
    return { startStr, endStr };
  };

  const { startStr: defaultStart, endStr: defaultEnd } = getDefaultDates();

  // Filters
  const [selectedEmpId, setSelectedEmpId] = useState<string>('all');
  const [startDate, setStartDate] = useState<string>(defaultStart);
  const [endDate, setEndDate] = useState<string>(defaultEnd);
  const [reportType, setReportType] = useState<'summary' | 'detailed'>('summary');
  
  // Calculations Cache
  const [reportResults, setReportResults] = useState<{
    employee: Employee;
    schedule: ShiftSchedule | undefined;
    days: DailyCalculationResult[];
    summary: CumulativeSummary;
  }[]>([]);

  const loadDataAndBuildReport = async () => {
    setLoading(true);
    try {
      const [empData, shiftData, logData] = await Promise.all([
        db.getEmployees(),
        db.getShifts(),
        db.getAttendanceLogs(startDate, endDate)
      ]);

      setEmployees(empData);
      setShifts(shiftData);
      setLogs(logData);

      // Generate date-by-date matrix
      const dateList = getDatesInRange(startDate, endDate);
      const builtReports: typeof reportResults = [];

      // Filter employees based on selection
      const filteredEmployees = selectedEmpId === 'all' 
        ? empData 
        : empData.filter(e => e.id === selectedEmpId);

      filteredEmployees.forEach((emp) => {
        const schedule = shiftData.find(s => s.id === emp.shift_schedule_id);
        const empLogs = logData.filter(l => l.employee_id === emp.id);

        const dailyCalculations: DailyCalculationResult[] = dateList.map((dateStr) => {
          const logForDay = empLogs.find(l => l.date === dateStr);
          
          if (logForDay && schedule) {
            return calculateDailyMetrics(logForDay, schedule);
          } else {
            // Absent/No logs recorded
            return {
              date: dateStr,
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
              has_shift2: false
            };
          }
        });

        const summary = generateCumulativeSummary(dailyCalculations, dateList.length);

        builtReports.push({
          employee: emp,
          schedule,
          days: dailyCalculations,
          summary
        });
      });

      setReportResults(builtReports);
    } catch (err) {
      console.error('Error generating report:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDataAndBuildReport();
  }, [selectedEmpId, startDate, endDate]);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div id="reporting-engine" className="space-y-6">
      {/* Dynamic styles injected specifically for professional single page A4 printing */}
      <style>{`
        @media print {
          /* Setup perfect A4 portrait dimensions and clear page margins */
          @page {
            size: A4;
            margin: 0.4in;
          }
          
          /* Wipe out dark background and optimize colors for printers */
          body, #root, #main-layout, #reporting-engine {
            background: #ffffff !important;
            color: #0f172a !important;
            padding: 0 !important;
            margin: 0 !important;
            height: auto !important;
            max-height: none !important;
            overflow: visible !important;
          }

          /* Hide everything except the printable cards */
          header, nav, footer, .print-hidden, #reporting-engine > div:first-child {
            display: none !important;
          }

          /* Force each employee card to occupy exactly one printable page elegantly */
          .print-page-card {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
            page-break-after: always !important;
            break-after: page !important;
            background: #ffffff !important;
            color: #0f172a !important;
            border: 1px solid #cbd5e1 !important;
            border-top: 4px solid #10b981 !important; /* solid emerald green top border for official look */
            border-bottom: 3px solid #f59e0b !important; /* gold bottom stripe matching the Abu Rateel Pro identity */
            border-radius: 6px !important;
            padding: 8px 12px !important; /* reduced padding */
            margin: 0 !important; /* no external margin */
            box-shadow: none !important;
            box-sizing: border-box !important;
            
            /* A4 Single Page Layout strict constraints to prevent second page spill across both iOS & Android */
            width: 100% !important;
            max-width: 210mm !important;
            height: auto !important;
            max-height: none !important;
            display: flex !important;
            flex-direction: column !important;
            justify-content: flex-start !important;
            gap: 4px !important; /* reduced gap */
            overflow: visible !important;
            position: relative !important;
            zoom: 0.82 !important; /* scale down entire element to fit on a single A4 perfectly */
          }

          /* Zero out margin-top and padding-top before/on the table and its container to prevent iOS Safari whitespace gaps */
          .print-page-card table, 
          .print-page-card .overflow-auto, 
          .print-page-card h5 {
            margin-top: 0 !important;
            padding-top: 0 !important;
          }

          /* Hide absolute-positioned watermark or decoration inside printable card to keep layout ultra safe on iOS WebKit */
          .print-page-card .absolute {
            display: none !important;
          }

          /* Prevent clipping inside scrollable and responsive containers in WebKit (iOS) */
          .print-page-card .overflow-auto,
          .print-page-card .overflow-hidden,
          .print-page-card [class*="overflow-"] {
            overflow: visible !important;
            height: auto !important;
            max-height: none !important;
            position: static !important;
          }

          /* Compact Corporate Branded Header (first-child block) */
          .print-page-card > div:first-of-type,
          .print-page-card > .relative:first-of-type {
            padding: 4px 8px !important;
            gap: 4px !important;
            border-radius: 6px !important;
          }

          /* Reduce the logo container from w-12 h-12 to w-8 h-8 in print */
          .print-page-card .w-12.h-12 {
            width: 28px !important;
            height: 28px !important;
          }

          /* Reduce logo fingerprint icon size */
          .print-page-card .w-12.h-12 svg.w-7.h-7 {
            width: 14px !important;
            height: 14px !important;
          }

          /* Report Meta Data Block: pb-3, gap-3 */
          .print-page-card > div:nth-of-type(2) {
            padding-bottom: 2px !important;
            gap: 2px !important;
          }

          /* Profile detail meta: p-3 */
          .print-page-card > div:nth-of-type(3) {
            padding: 2px 6px !important;
            gap: 2px !important;
            border-radius: 6px !important;
          }

          /* Strict margins inside layout blocks to avoid spilling */
          .print-page-card .space-y-4 > * + * {
            margin-top: 2px !important;
          }
          .print-page-card .space-y-3 > * + * {
            margin-top: 1.5px !important;
          }

          /* Bottom Cumulative Summary boxes */
          .print-grid-6 > div, .print-grid-7 > div, .print-grid-8 > div {
            padding: 2px 4px !important; /* reduced padding */
            border-radius: 4px !important;
          }
          .print-grid-6 span, .print-grid-7 span, .print-grid-8 span {
            font-size: 7.5px !important; /* was 8px */
          }
          .print-grid-6 span.text-xs, .print-grid-7 span.text-xs, .print-grid-8 span.text-xs {
            font-size: 8.5px !important; /* was 9.5px */
            margin-top: 1px !important;
          }

          /* Calculations statistics footer highlight */
          .print-page-card div.text-\[10px\] {
            padding: 2px 4px !important;
            font-size: 7.5px !important;
            border-radius: 4px !important;
          }

          /* Stamp, Organizer & Inquiries Block */
          .print-page-card div.pt-4.border-t {
            padding-top: 2px !important;
            margin-top: 2px !important;
            gap: 2px !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }

          /* Signature / official stamp blocks */
          .print-page-card div.pt-4.border-t .h-11 {
            height: 22px !important; /* reduced height to avoid pushing table */
            font-size: 8px !important;
            padding: 1px 4px !important;
          }
          .print-page-card div.pt-4.border-t .w-12.h-12 {
            width: 22px !important; /* reduced size */
            height: 22px !important;
          }
          .print-page-card div.pt-4.border-t .w-12.h-12 svg {
            width: 11px !important;
            height: 11px !important;
          }

          /* Contact / Sales box styling in print */
          .print-page-card .group.sm\\:col-span-5 {
            padding: 2px 4px !important; /* extremely compact */
            gap: 1px !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }
          .print-page-card .group.sm\\:col-span-5 .w-7.h-7 {
            width: 14px !important;
            height: 14px !important;
          }
          .print-page-card .group.sm\\:col-span-5 .w-7.h-7 svg {
            width: 8px !important;
            height: 8px !important;
          }
          .print-page-card .group.sm\\:col-span-5 span.text-\[11px\] {
            font-size: 7.5px !important;
          }
          .print-page-card .group.sm\\:col-span-5 p.text-\[9px\] {
            font-size: 6.5px !important;
          }
          .print-page-card .group.sm\\:col-span-5 .grid-cols-2 a {
            padding-top: 0.5px !important;
            padding-bottom: 0.5px !important;
          }
          .print-page-card .group.sm\\:col-span-5 .grid-cols-2 span {
            font-size: 7px !important;
          }

          /* Ensure scrollable containers expand fully in print mode */
          .overflow-auto {
            overflow: visible !important;
            max-height: none !important;
          }

          /* Tighten table padding to guarantee it never overflows */
          table {
            width: 100% !important;
            border-collapse: collapse !important;
          }
          
          th, td {
            padding: 2px 4px !important; /* compact padding as requested */
            font-size: 9.5px !important; /* compact font-size to fit A4 perfectly on iOS/Android */
            line-height: 1.0 !important; /* tight line-height to prevent vertical overflow */
            border: 1px solid #cbd5e1 !important;
            color: #0f172a !important;
            
            /* Completely remove sticky/fixed positioning for table cells in print to prevent detached empty column issues on iOS Safari */
            position: static !important;
            right: auto !important;
            left: auto !important;
            box-shadow: none !important;
          }

          th {
            background-color: #f1f5f9 !important;
            font-weight: bold !important;
          }

          /* Ensure grids print correctly as grids and remain side-by-side */
          .print-grid {
            display: grid !important;
            gap: 6px !important;
          }
          
          .print-grid-3 {
            grid-template-columns: repeat(3, minmax(0, 1fr)) !important;
          }

          .print-grid-6 {
            grid-template-columns: repeat(6, minmax(0, 1fr)) !important;
          }

          .print-grid-7 {
            grid-template-columns: repeat(7, minmax(0, 1fr)) !important;
          }

          .print-grid-8 {
            grid-template-columns: repeat(8, minmax(0, 1fr)) !important;
          }

          /* Hide irrelevant graphics */
          .blur-2xl, .absolute-blur {
            display: none !important;
          }

          /* Solid readable text instead of transparent gradient backgrounds */
          .print-text-solid {
            color: #047857 !important; /* solid emerald green */
            background: none !important;
            -webkit-background-clip: unset !important;
            background-clip: unset !important;
            font-weight: 900 !important;
          }

          .text-emerald-400, .text-emerald-300 {
            color: #047857 !important; /* solid emerald-750 */
          }

          .text-rose-400, .text-rose-500 {
            color: #b91c1c !important; /* solid red-700 */
          }

          .text-amber-400, .text-amber-500 {
            color: #b45309 !important; /* solid amber-700 */
          }

          /* Box styling inside print */
          .bg-slate-950, .bg-slate-950\\/60, .bg-slate-900, .bg-slate-900\\/90, .print-bg-light {
            background-color: #f8fafc !important; /* off white slate-50 */
            border: 1px solid #cbd5e1 !important;
          }

          .border-slate-800, .border-slate-850, .border-slate-850\\/60 {
            border-color: #cbd5e1 !important;
          }

          .text-slate-400, .text-slate-500 {
            color: #475569 !important;
          }

          .text-slate-300, .text-slate-200, .text-slate-100 {
            color: #0f172a !important;
          }
          
          /* Prevent page-break issues inside blocks */
          tr, td, th {
            page-break-inside: avoid !important;
          }
        }
      `}</style>

      {/* Search and Filters Card */}
      <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl text-right space-y-4 shadow-xl print-hidden">
        <h2 className="text-sm font-bold text-slate-100 flex items-center justify-start gap-2 border-b border-slate-800 pb-3">
          <BarChart3 className="w-5 h-5 text-emerald-400" />
          <span>محرك تقارير الحضور والمطابقة التراكمية</span>
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Employee selector */}
          <div className="space-y-1">
            <label className="block text-xs font-semibold text-slate-300">الموظف المشمول</label>
            <div className="relative">
              <select
                value={selectedEmpId}
                onChange={(e) => setSelectedEmpId(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 text-xs focus:outline-none focus:border-emerald-500 text-right cursor-pointer"
              >
                <option value="all">كل الموظفين المسجلين</option>
                {employees.map(e => (
                  <option key={e.id} value={e.id}>
                    {e.name} ({e.emp_id})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Start Date */}
          <div className="space-y-1">
            <label className="block text-xs font-semibold text-slate-300">تاريخ بدء الفترة</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 text-xs focus:outline-none focus:border-emerald-500 text-center font-mono cursor-pointer"
            />
          </div>

          {/* End Date */}
          <div className="space-y-1">
            <label className="block text-xs font-semibold text-slate-300">تاريخ نهاية الفترة</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 text-xs focus:outline-none focus:border-emerald-500 text-center font-mono cursor-pointer"
            />
          </div>

          {/* Report Type selector */}
          <div className="space-y-1">
            <label className="block text-xs font-semibold text-slate-300">نمط التقرير (A4 PDF)</label>
            <div className="grid grid-cols-2 gap-1 bg-slate-950 p-1 border border-slate-800 rounded-lg">
              <button
                type="button"
                onClick={() => setReportType('summary')}
                className={`py-1.5 text-[10px] font-bold rounded-md transition cursor-pointer text-center ${reportType === 'summary' ? 'bg-emerald-500 text-slate-950 font-black' : 'text-slate-400 hover:text-slate-200'}`}
              >
                ملخص (صفحة 1)
              </button>
              <button
                type="button"
                onClick={() => setReportType('detailed')}
                className={`py-1.5 text-[10px] font-bold rounded-md transition cursor-pointer text-center ${reportType === 'detailed' ? 'bg-emerald-500 text-slate-950 font-black' : 'text-slate-400 hover:text-slate-200'}`}
              >
                تفصيلي (يومي)
              </button>
            </div>
          </div>
        </div>

        {/* Tip banner about the range picker */}
        <div className="p-3 bg-slate-950/60 border border-slate-850 rounded-xl text-[10px] text-slate-400 flex items-center justify-start gap-2">
          <Info className="w-4 h-4 text-emerald-500 flex-shrink-0" />
          <span>
            يدعم المحرك اختيار أي نطاق زمني مخصص يعبر الأشهر (مثال: من 25 مايو إلى 25 يونيو). سيقوم بحساب الملخص التراكمي لكافة البصمات في هذه الفترة وتجاوز فترات نهاية الأسبوع تلقائياً.
          </span>
        </div>
      </div>

      {/* Loading state */}
      {loading ? (
        <div className="py-20 flex flex-col items-center justify-center text-slate-500 space-y-2 bg-slate-900 border border-slate-800 rounded-2xl">
          <span className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-xs">جاري تحليل ومعالجة البيانات التراكمية للموظفين...</span>
        </div>
      ) : reportResults.length === 0 ? (
        <div className="py-12 text-center text-slate-500 text-xs bg-slate-900 border border-slate-800 rounded-2xl">
          لا توجد سجلات مطابقة للشروط أو لم يتم تسجيل أي موظفين حتى الآن.
        </div>
      ) : (
        <div className="space-y-12">
          {/* Action to print all or view stats */}
          <div className="flex justify-end gap-3 print-hidden">
            <button
              onClick={handlePrint}
              className="px-5 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-lg text-xs flex items-center gap-2 cursor-pointer transition shadow"
            >
              <Printer className="w-4 h-4" />
              <span>طباعة التقارير الورقية / تصدير PDF</span>
            </button>
          </div>

          {/* Loop for each selected employee report */}
          {reportResults.map(({ employee, schedule, days, summary }) => {
            return (
              <div
                key={employee.id}
                className="print-page-card bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4 text-right shadow-xl relative overflow-hidden"
              >
                {/* Background Watermark (Authentic Fingerprint) for Print & Digital */}
                <div className="absolute inset-0 flex items-center justify-center opacity-[0.02] print:opacity-[0.04] pointer-events-none select-none">
                  <Fingerprint className="w-96 h-96 text-emerald-400 stroke-[1.2]" />
                </div>

                {/* Corporate Branded Header (Abu Rateel Fingerprint Brand) */}
                <div className="flex items-center justify-between gap-4 bg-slate-950/40 p-4 rounded-xl border border-slate-800/80 print-bg-light relative z-10">
                  <div className="flex items-center gap-3 text-right">
                    {/* Brand Logo with golden tech ring */}
                    <div className="w-12 h-12 bg-gradient-to-tr from-slate-950 to-slate-900 border border-emerald-500/30 rounded-xl flex items-center justify-center shadow-lg shadow-emerald-950/25 relative overflow-hidden">
                      <div className="absolute inset-0 bg-gradient-to-tr from-emerald-500/20 to-teal-500/5 opacity-80" />
                      <Fingerprint className="w-7 h-7 text-emerald-400 relative z-10 stroke-[1.8]" />
                      <div className="absolute top-1 right-1 w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
                    </div>
                    <div className="text-right">
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-black text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 via-teal-200 to-emerald-300 print-text-solid">
                          بوابة بصمة تك السحابية
                        </h3>
                        <span className="px-1.5 py-0.5 rounded text-[8px] font-black bg-emerald-500/15 text-emerald-400 border border-emerald-500/20 tracking-wider">
                          TECH
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-400">
                        النظام السحابي الذكي لإدارة البصمات والحضور
                      </p>
                    </div>
                  </div>
                  
                  <div className="text-left font-mono text-[9px] text-slate-500 space-y-1">
                    <div className="bg-slate-900/60 border border-slate-800/50 rounded-md px-2 py-1 flex flex-col items-end gap-0.5 print-bg-light">
                      <span className="text-[8px] text-slate-400 font-sans font-bold">كود التحقق والسرية للمستند</span>
                      <span className="text-emerald-400 font-extrabold font-mono tracking-wider select-all text-[8px]">AR-DOC-78329-SECURE</span>
                    </div>
                    <div className="pt-1">تاريخ الاستخراج: {new Date().toLocaleDateString('ar-EG')}</div>
                  </div>
                </div>

                {/* Report Meta Data Block */}
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pb-3 border-b border-slate-800/60 relative z-10">
                  <div className="space-y-0.5 text-right">
                    <h4 className="text-sm font-extrabold text-slate-100">
                      تقرير حضور الموظف: <span className="text-emerald-400">{employee.name}</span>
                    </h4>
                    <p className="text-[11px] text-slate-400">
                      الرقم الوظيفي: <span className="text-slate-200 font-bold font-mono">{employee.emp_id}</span> • القسم: {employee.department}
                    </p>
                  </div>

                  <div className="text-right sm:text-left text-[11px] space-y-0.5">
                    <div className="text-slate-500">الفترة الزمنية للتقرير:</div>
                    <div className="font-bold text-emerald-400 font-mono">
                      {startDate} إلى {endDate}
                    </div>
                  </div>
                </div>

                {/* Profile detail meta */}
                <div className="print-grid print-grid-3 grid grid-cols-1 sm:grid-cols-3 gap-3 p-3 bg-slate-950/60 rounded-xl border border-slate-850/60 text-[11px] relative z-10">
                  <div className="text-right">
                    <span className="text-slate-500">نظام وردية الموظف: </span>
                    <span className="text-slate-300 font-semibold">{schedule?.name || 'الدوام الاعتيادي الفردي'}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-slate-500">قالب الحساب المعتمد: </span>
                    <span className="text-emerald-400 font-bold">
                      {employee.is_dual_shift ? 'شفتين باليوم (صباحي ومسائي)' : 'شفت واحد أساسي'}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-slate-500">فترة السماح للوردية: </span>
                    <span className="text-slate-300 font-semibold">{schedule?.grace_minutes || 15} دقيقة</span>
                  </div>
                </div>

                {/* Conditional Rendering: Show day-by-day table ONLY in detailed mode */}
                {reportType === 'detailed' ? (
                  <div className="space-y-1.5 flex-1 min-h-0 overflow-hidden relative z-10">
                    <h5 className="text-[11px] font-bold text-slate-200 text-right">سجل اليوميات والتواريخ التفصيلية</h5>
                    
                    <div className="overflow-auto max-h-[350px] rounded-lg border border-slate-800 relative scrollbar-thin scrollbar-thumb-slate-800">
                      <table className="w-full text-xs text-right text-slate-300 min-w-[650px] border-collapse">
                        <thead>
                          <tr className="text-[10px] text-slate-400 uppercase">
                            <th className="sticky top-0 right-0 bg-slate-950 z-30 px-3 py-2 text-right border-b border-slate-800 border-l border-slate-800/80 text-emerald-400 font-extrabold">اليوم والتاريخ</th>
                            <th className="sticky top-0 bg-slate-950 z-20 px-3 py-2 text-center border-b border-slate-800">الحالة</th>
                            <th className="sticky top-0 bg-slate-950 z-20 px-3 py-2 text-center border-b border-slate-800">الشفت 1 (حضور/انصراف)</th>
                            {employee.is_dual_shift && <th className="sticky top-0 bg-slate-950 z-20 px-3 py-2 text-center border-b border-slate-800">الشفت 2 (حضور/انصراف)</th>}
                            <th className="sticky top-0 bg-slate-950 z-20 px-3 py-2 text-center border-b border-slate-800">ساعات العمل</th>
                            <th className="sticky top-0 bg-slate-950 z-20 px-3 py-2 text-center border-b border-slate-800">التأخير</th>
                            <th className="sticky top-0 bg-slate-950 z-20 px-3 py-2 text-center border-b border-slate-800">الخروج المبكر</th>
                            <th className="sticky top-0 bg-slate-950 z-20 px-3 py-2 text-center border-b border-slate-800">الإضافي</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/40">
                          {days.map((day) => {
                            const isPresent = day.has_shift1 || day.has_shift2;
                            const rawLog = logs.find(l => l.employee_id === employee.id && l.date === day.date);

                            return (
                              <tr key={day.date} className={`group hover:bg-slate-950/20 ${!isPresent ? 'bg-rose-950/5 text-slate-500' : ''}`}>
                                <td className="sticky right-0 bg-slate-900 group-hover:bg-slate-950/90 transition-colors z-10 px-3 py-1.5 font-semibold font-sans text-right border-l border-slate-800/80 shadow-[2px_0_5px_rgba(0,0,0,0.2)]">
                                  {formatDateArabic(day.date)}
                                </td>
                                <td className="px-3 py-1.5 text-center">
                                  {isPresent ? (
                                    <span className="px-1.5 py-0.5 bg-emerald-500/10 text-emerald-400 rounded text-[9px] font-bold border border-emerald-500/20">
                                      حاضر
                                    </span>
                                  ) : (
                                    <span className="px-1.5 py-0.5 bg-rose-500/10 text-rose-400 rounded text-[9px] font-bold border border-rose-500/20">
                                      غائب
                                    </span>
                                  )}
                                </td>
                                <td className="px-3 py-1.5 text-center font-mono text-[11px]">
                                  {rawLog?.shift1_check_in || '—'} / {rawLog?.shift1_check_out || '—'}
                                </td>
                                {employee.is_dual_shift && (
                                  <td className="px-3 py-1.5 text-center font-mono text-[11px]">
                                    {rawLog?.shift2_check_in || '—'} / {rawLog?.shift2_check_out || '—'}
                                  </td>
                                )}
                                <td className="px-3 py-1.5 text-center font-bold text-slate-200">
                                  <span className="font-mono text-[11px]">{isPresent ? formatHoursToHHMM(day.total_hours) : '00:00'}</span>
                                </td>
                                <td className={`px-3 py-1.5 text-center font-semibold text-[11px] ${day.total_late > 0 ? 'text-amber-400' : ''}`}>
                                  <span>{day.total_late > 0 ? formatMinutesToHHMM(day.total_late) : '00:00'}</span>
                                </td>
                                <td className={`px-3 py-1.5 text-center font-semibold text-[11px] ${day.total_early_departure > 0 ? 'text-rose-400' : ''}`}>
                                  <span>{day.total_early_departure > 0 ? formatMinutesToHHMM(day.total_early_departure) : '00:00'}</span>
                                </td>
                                <td className={`px-3 py-1.5 text-center font-semibold text-[11px] ${day.total_ot > 0 ? 'text-emerald-400' : ''}`}>
                                  <span>{day.total_ot > 0 ? formatHoursToHHMM(day.total_ot) : '00:00'}</span>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : (
                  // Summary Report View - visual highlights for summary dashboard
                  <div className="py-4 space-y-4 flex-1 flex flex-col justify-center relative z-10">
                    <div className="p-4 bg-emerald-500/5 border border-emerald-500/20 rounded-xl flex items-center justify-between">
                      <div className="text-right space-y-1">
                        <span className="text-xs text-slate-400 font-medium">التقييم العام للمواظبة</span>
                        <h4 className="text-lg font-black text-emerald-400">ملتزم ومطابق بنسبة ممتازة</h4>
                      </div>
                      <div className="w-16 h-16 rounded-full border-4 border-emerald-500/30 flex items-center justify-center font-black text-sm text-emerald-400 font-sans">
                        {Math.round((summary.present_days / (summary.total_days || 1)) * 100)}%
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-right">
                      <div className="p-3 bg-slate-950/40 border border-slate-850 rounded-xl space-y-1">
                        <span className="text-[10px] text-slate-500">متوسط التأخير اليومي</span>
                        <span className="block text-xs font-bold font-sans text-amber-400">
                          {summary.total_lateness_minutes > 0 
                            ? `${Math.round(summary.total_lateness_minutes / (summary.present_days || 1))} دقيقة / يوم` 
                            : 'لا يوجد تأخير'}
                        </span>
                      </div>
                      <div className="p-3 bg-slate-950/40 border border-slate-850 rounded-xl space-y-1">
                        <span className="text-[10px] text-slate-500">متوسط الخروج المبكر اليومي</span>
                        <span className="block text-xs font-bold font-sans text-rose-400">
                          {summary.total_early_departure_minutes > 0 
                            ? `${Math.round(summary.total_early_departure_minutes / (summary.present_days || 1))} دقيقة / يوم` 
                            : 'لا يوجد خروج مبكر'}
                        </span>
                      </div>
                      <div className="p-3 bg-slate-950/40 border border-slate-850 rounded-xl space-y-1">
                        <span className="text-[10px] text-slate-500">متوسط ساعات العمل الفعلي</span>
                        <span className="block text-xs font-bold font-sans text-emerald-400">
                          {Number((summary.total_working_hours / (summary.present_days || 1)).toFixed(1))} ساعة / يوم
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Bottom Cumulative Summary: الملخص التراكمي */}
                <div className="pt-3 border-t border-slate-800/80 space-y-3 relative z-10">
                  <div className="flex items-center gap-1.5 justify-start">
                    <div className="w-1.5 h-3.5 bg-emerald-500 rounded" />
                    <h5 className="text-[11px] font-bold text-slate-100">الملخص التراكمي للفترة الزمنية المحددة</h5>
                  </div>

                  <div className="print-grid print-grid-8 grid grid-cols-2 sm:grid-cols-4 md:grid-cols-8 gap-2">
                    <div className="p-2.5 bg-slate-950 border border-slate-850 rounded-lg text-right">
                      <span className="block text-[9px] text-slate-500 leading-none">إجمالي الأيام</span>
                      <span className="text-xs font-bold text-slate-300 font-mono mt-1 block">{summary.total_days}</span>
                    </div>

                    <div className="p-2.5 bg-slate-950 border border-slate-850 rounded-lg text-right">
                      <span className="block text-[9px] text-emerald-500 font-bold leading-none">أيام الحضور</span>
                      <span className="text-xs font-bold text-emerald-400 font-mono mt-1 block">{summary.present_days}</span>
                    </div>

                    <div className="p-2.5 bg-slate-950 border border-slate-850 rounded-lg text-right">
                      <span className="block text-[9px] text-rose-500 font-bold leading-none">أيام الغياب</span>
                      <span className="text-xs font-bold text-rose-400 font-mono mt-1 block">{summary.absent_days}</span>
                    </div>

                    <div className="p-2.5 bg-slate-950 border border-emerald-500/20 rounded-lg text-right">
                      <span className="block text-[9px] text-emerald-400 font-bold leading-none">مجموع الساعات</span>
                      <span className="text-xs font-bold text-emerald-300 font-mono mt-1 block">
                        {formatHoursToHHMM(summary.total_working_hours)}
                      </span>
                    </div>

                    <div className="p-2.5 bg-slate-950 border border-amber-500/20 rounded-lg text-right">
                      <span className="block text-[9px] text-amber-500 font-bold leading-none">مجموع التأخير</span>
                      <span className="text-xs font-bold text-amber-400 font-mono mt-1 block">
                        {formatMinutesToHHMM(summary.total_lateness_minutes)}
                      </span>
                    </div>

                    <div className="p-2.5 bg-slate-950 border border-rose-500/20 rounded-lg text-right">
                      <span className="block text-[9px] text-rose-500 font-bold leading-none">الخروج المبكر</span>
                      <span className="text-xs font-bold text-rose-400 font-mono mt-1 block">
                        {formatMinutesToHHMM(summary.total_early_departure_minutes)}
                      </span>
                    </div>

                    <div className="p-2.5 bg-slate-950 border border-teal-500/20 rounded-lg text-right">
                      <span className="block text-[9px] text-teal-400 font-bold leading-none">إجمالي الإضافي</span>
                      <span className="text-xs font-bold text-teal-400 font-mono mt-1 block">
                        {formatHoursToHHMM(summary.total_overtime_hours)}
                      </span>
                    </div>

                    <div className={`p-2.5 bg-slate-950 border rounded-lg text-right ${summary.net_overtime_minutes < 0 ? 'border-rose-500/30' : 'border-emerald-500/30'}`}>
                      <span className={`block text-[9px] font-bold leading-none ${summary.net_overtime_minutes < 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                        صافي الإضافي
                      </span>
                      <span className={`text-xs font-bold font-mono mt-1 block ${summary.net_overtime_minutes < 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                        {formatSignedMinutesToHHMM(summary.net_overtime_minutes)}
                      </span>
                    </div>
                  </div>

                  {/* Calculations statistics footer highlight */}
                  <div className="p-2 bg-slate-950/40 border border-slate-850 rounded-lg text-[10px] text-slate-400 flex flex-col sm:flex-row justify-between items-center gap-2">
                    <div className="flex gap-4 font-semibold font-mono text-[10px] text-slate-300 w-full justify-between sm:justify-end">
                      <div>نسبة الحضور: <span className="text-emerald-400">{Math.round((summary.present_days / (summary.total_days || 1)) * 100)}%</span></div>
                      <div>المعدل اليومي: <span className="text-emerald-400">{Number((summary.total_working_hours / (summary.present_days || 1)).toFixed(1))} ساعة/يوم</span></div>
                    </div>
                  </div>

                  {/* Stamp, Organizer & Inquiries Block */}
                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 pt-4 border-t border-slate-800/60 print:pt-3 items-center">
                    {/* Right Block: Organizer Signature & Official Stamp (occupies 7 cols on desktop) */}
                    <div className="sm:col-span-7 grid grid-cols-2 gap-3 items-center">
                      <div className="text-center space-y-1.5">
                        <span className="block text-[10px] text-slate-500 font-bold">المنظم بصمة تك</span>
                        <div className="h-11 border border-dashed border-emerald-500/20 rounded-lg flex items-center justify-center text-xs text-slate-400 font-sans font-extrabold select-none bg-slate-950/35 relative">
                          <span className="text-emerald-400/95 font-black">بصمة تك (رسمي)</span>
                          <div className="absolute right-2 top-1.5 w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                        </div>
                        <span className="block text-[9px] text-slate-500">التاريخ: {new Date().toLocaleDateString('ar-EG')}</span>
                      </div>

                      <div className="text-center space-y-1.5 flex flex-col items-center justify-center">
                        <span className="block text-[10px] text-slate-500 font-bold">الختم الرسمي للمؤسسة</span>
                        <div className="w-12 h-12 rounded-full border-2 border-dashed border-emerald-500/40 flex flex-col items-center justify-center relative bg-emerald-500/5 shadow-[0_0_8px_rgba(16,185,129,0.1)]">
                          <Fingerprint className="w-6 h-6 text-emerald-500/50" />
                          <span className="absolute text-[6px] text-emerald-500/60 font-black scale-[0.85] -bottom-3 tracking-wider">بصمة تك TECH</span>
                        </div>
                      </div>
                    </div>

                    {/* Left Block: Sleek Professional Fingerprint Sales & Inquiries Card (occupies 5 cols on desktop) */}
                    <div className="group sm:col-span-5 bg-gradient-to-br from-slate-950 to-slate-900 border border-slate-800 rounded-xl p-3 flex flex-col items-center justify-center text-center space-y-2 relative overflow-hidden transition-all duration-300 print-bg-light">
                      <div className="absolute top-0 left-0 w-1.5 h-full bg-gradient-to-b from-amber-500 to-amber-600" />
                      
                      {/* Animated Phone Icon Wrapper */}
                      <div className="relative flex items-center justify-center w-7 h-7 bg-amber-500/10 rounded-full">
                        <div className="absolute inset-0 rounded-full bg-amber-500/10 animate-pulse scale-110 pointer-events-none" />
                        <Phone className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                      </div>

                      <div className="space-y-0.5">
                        <span className="block text-[11px] text-amber-400 font-extrabold tracking-wide print:text-slate-950">
                          مبيعات واستفسارات أجهزة البصمة
                        </span>
                        <p className="text-[9px] text-slate-400 font-bold print:text-slate-700">
                          لطلب أجهزة الحضور والانصراف
                        </p>
                      </div>

                      {/* Contacts list */}
                      <div className="w-full grid grid-cols-2 gap-2 mt-1 z-10 relative">
                        {/* Abu Bakr */}
                        <a 
                          href="tel:0557538856"
                          className="flex flex-col items-center justify-center bg-slate-900/60 hover:bg-slate-950 border border-slate-800 hover:border-emerald-500/30 rounded-lg py-1.5 px-1 transition-all duration-200 print-bg-light"
                        >
                          <span className="text-[8px] text-slate-400 font-bold">أبو بكر</span>
                          <span className="text-[10px] font-black text-emerald-400 font-mono tracking-wider">0557538856</span>
                        </a>

                        {/* Abdul Rahman */}
                        <a 
                          href="tel:0501187502"
                          className="flex flex-col items-center justify-center bg-slate-900/60 hover:bg-slate-950 border border-slate-800 hover:border-emerald-500/30 rounded-lg py-1.5 px-1 transition-all duration-200 print-bg-light"
                        >
                          <span className="text-[8px] text-slate-400 font-bold">عبد الرحمن</span>
                          <span className="text-[10px] font-black text-emerald-400 font-mono tracking-wider">0501187502</span>
                        </a>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
