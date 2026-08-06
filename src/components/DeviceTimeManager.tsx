/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { db } from '../supabaseClient';
import { 
  Clock, 
  Wifi, 
  WifiOff, 
  RefreshCw, 
  CheckCircle2, 
  AlertTriangle, 
  Plus, 
  Trash2, 
  Send, 
  Sliders, 
  Calendar, 
  History, 
  Info, 
  Cpu, 
  ShieldCheck,
  Check,
  X
} from 'lucide-react';

interface DeviceItem {
  id: string;
  serial_number: string;
  name: string;
  last_ping: string | null;
  is_online: boolean;
  estimated_time: string;
  pending_command?: any;
}

export default function DeviceTimeManager() {
  const [devices, setDevices] = useState<DeviceItem[]>([]);
  const [commandsHistory, setCommandsHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Sync Modal State
  const [selectedDevice, setSelectedDevice] = useState<DeviceItem | null>(null);
  const [timeOption, setTimeOption] = useState<'riyadh' | 'server' | 'custom'>('riyadh');
  const [cmdFormat, setCmdFormat] = useState<'DATA_OPTION' | 'SET_OPTION' | 'SET_TIME_EQUAL' | 'DIRECT_SET_TIME' | 'SET_TIME_CAPS'>('DATA_OPTION');
  const [customDateTime, setCustomDateTime] = useState<string>(() => {
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const hh = String(d.getHours()).padStart(2, '0');
    const min = String(d.getMinutes()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}T${hh}:${min}`;
  });
  const [submitting, setSubmitting] = useState(false);

  // Register Device Modal State
  const [showAddDevice, setShowAddDevice] = useState(false);
  const [newSn, setNewSn] = useState('');
  const [newName, setNewName] = useState('');
  const [registering, setRegistering] = useState(false);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [devList, cmdList] = await Promise.all([
        db.getDeviceTimeStatus(),
        db.getDeviceCommandsHistory()
      ]);
      setDevices(devList);
      setCommandsHistory(cmdList);
    } catch (err) {
      setError('تعذر تحميل بيانات الأجهزة والأوامر.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    // Auto refresh every 10 seconds to monitor live ping status
    const interval = setInterval(loadData, 10000);
    return () => clearInterval(interval);
  }, []);

  const handleOpenSyncModal = (dev: DeviceItem) => {
    setSelectedDevice(dev);
    setTimeOption('riyadh');
    setCmdFormat('DATA_OPTION');
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const hh = String(d.getHours()).padStart(2, '0');
    const min = String(d.getMinutes()).padStart(2, '0');
    setCustomDateTime(`${yyyy}-${mm}-${dd}T${hh}:${min}`);
    setSuccess(null);
    setError(null);
  };

  const handleSendSyncCommand = async () => {
    if (!selectedDevice) return;
    setSubmitting(true);
    setError(null);
    setSuccess(null);

    let formattedCustomTime: string | undefined = undefined;
    if (timeOption === 'custom') {
      if (!customDateTime) {
        setError('يرجى اختيار التاريخ والوقت اليدوي.');
        setSubmitting(false);
        return;
      }
      // Convert "YYYY-MM-DDTHH:mm" to "YYYY-MM-DD HH:mm:00"
      formattedCustomTime = customDateTime.replace('T', ' ') + ':00';
    }

    try {
      const result = await db.syncDeviceTime(
        selectedDevice.serial_number,
        timeOption,
        formattedCustomTime,
        cmdFormat
      );

      if (result.success) {
        setSuccess(`تم إنشاء أمر تغيير الوقت بنجاح للجهاز ${selectedDevice.name} (${selectedDevice.serial_number}). سيتم تجربة إرسال جميع الصيغ فور قيام الجهاز بالطلب.`);
        setSelectedDevice(null);
        await loadData();
      } else {
        setError(result.error || 'فشل إرسال أمر المزامنة.');
      }
    } catch (err: any) {
      setError('حدث خطأ أثناء معالجة الطلب.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRegisterDevice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSn.trim() || !newName.trim()) return;

    setRegistering(true);
    setError(null);
    try {
      const res = await db.registerDevice(newSn.trim(), newName.trim());
      if (res.success) {
        setSuccess(`تم تسجيل الجهاز ${newName} بالرقم التسلسلي ${newSn} بنجاح.`);
        setNewSn('');
        setNewName('');
        setShowAddDevice(false);
        await loadData();
      } else {
        setError(typeof res.error === 'string' ? res.error : res.error?.message || 'فشل تسجيل الجهاز');
      }
    } catch (err) {
      setError('حدث خطأ أثناء إضافة الجهاز.');
    } finally {
      setRegistering(false);
    }
  };

  const handleCancelCommand = async (cmdId: string) => {
    if (!window.confirm('هل أنت متأكد من إلغاء هذا الأمر المعلق؟')) return;
    try {
      await db.cancelDeviceCommand(cmdId);
      setSuccess('تم إلغاء الأمر بنجاح.');
      await loadData();
    } catch (err) {
      setError('فشل إلغاء الأمر.');
    }
  };

  const getRiyadhTimePreview = () => {
    const riyadhDateStr = new Date().toLocaleString('en-US', { timeZone: 'Asia/Riyadh' });
    const d = new Date(riyadhDateStr);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const hh = String(d.getHours()).padStart(2, '0');
    const min = String(d.getMinutes()).padStart(2, '0');
    const ss = String(d.getSeconds()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd} ${hh}:${min}:${ss}`;
  };

  const getServerTimePreview = () => {
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const hh = String(d.getHours()).padStart(2, '0');
    const min = String(d.getMinutes()).padStart(2, '0');
    const ss = String(d.getSeconds()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd} ${hh}:${min}:${ss}`;
  };

  const formatLastPing = (pingStr: string | null) => {
    if (!pingStr) return 'لم يتصل بعد';
    const pingDate = new Date(pingStr);
    const now = new Date();
    const diffSec = Math.floor((now.getTime() - pingDate.getTime()) / 1000);

    if (diffSec < 60) return 'منذ بضع ثوانٍ';
    if (diffSec < 3600) return `منذ ${Math.floor(diffSec / 60)} دقيقة`;
    if (diffSec < 86400) return `منذ ${Math.floor(diffSec / 3600)} ساعة`;
    return pingDate.toLocaleString('ar-SA');
  };

  return (
    <div className="space-y-6 text-right font-sans">
      
      {/* Page Header */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 sm:p-6 shadow-xl backdrop-blur-md">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2.5">
              <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl">
                <Clock className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-xl sm:text-2xl font-black text-slate-100">
                  إدارة وقت الأجهزة (ZKTeco Time Control)
                </h2>
                <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
                  تحكم كامل بمزامنة أوقات أجهزة البصمة بأمان وبدون أي تغيير تلقائي
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2.5 self-start md:self-auto">
            <button
              onClick={loadData}
              disabled={loading}
              className="px-3.5 py-2.5 bg-slate-950 border border-slate-800 hover:border-slate-700 text-slate-300 hover:text-slate-100 text-xs font-bold rounded-xl flex items-center gap-2 transition cursor-pointer"
            >
              <RefreshCw className={`w-4 h-4 text-emerald-400 ${loading ? 'animate-spin' : ''}`} />
              <span>تحديث البيانات</span>
            </button>

            <button
              onClick={() => setShowAddDevice(true)}
              className="px-4 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-black rounded-xl flex items-center gap-2 shadow-lg shadow-emerald-500/10 transition cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>تسجيل جهاز جديد</span>
            </button>
          </div>
        </div>

        {/* Informational Policy Banner */}
        <div className="mt-4 p-3.5 bg-slate-950/80 border border-emerald-500/20 rounded-xl flex items-start gap-3 text-xs text-slate-300 leading-relaxed">
          <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
          <p>
            <strong className="text-emerald-400 font-bold">حماية وتأمين الوقت:</strong> تم إلغاء أي تغيير تلقائي للوقت عبر الاستجابات التلقائية للسيرفر. الوقت يظل ثابتاً كما تم ضبطه، وعند المزامنة يتم إرسال أمر المزامنة <span className="font-mono font-bold text-emerald-300 text-[11px]">SET TIME</span> للجهاز مرة واحدة فقط فور اتصاله وتأكيده.
          </p>
        </div>
      </div>

      {/* Messages */}
      {error && (
        <div className="p-4 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-400 text-xs sm:text-sm font-semibold flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-400 text-xs sm:text-sm font-semibold flex items-center gap-2">
          <CheckCircle2 className="w-5 h-5 shrink-0" />
          <span>{success}</span>
        </div>
      )}

      {/* Connected Devices Grid */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-base sm:text-lg font-black text-slate-100 flex items-center gap-2">
            <Cpu className="w-5 h-5 text-emerald-400" />
            <span>الأجهزة المسجلة والمتصلة بالمنظومة ({devices.length})</span>
          </h3>
        </div>

        {devices.length === 0 ? (
          <div className="p-8 text-center bg-slate-900/60 border border-slate-800 rounded-2xl text-slate-400 space-y-3">
            <Clock className="w-12 h-12 text-slate-600 mx-auto" />
            <p className="text-sm font-semibold">لا توجد أجهزة مسجلة حالياً.</p>
            <button
              onClick={() => setShowAddDevice(true)}
              className="px-4 py-2 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-bold rounded-xl hover:bg-emerald-500/20 transition cursor-pointer"
            >
              + إضافة جهاز ZKTeco جديد
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {devices.map((dev) => (
              <div 
                key={dev.id} 
                className={`bg-slate-900 border rounded-2xl p-5 space-y-4 transition-all duration-300 relative overflow-hidden ${
                  dev.is_online 
                    ? 'border-emerald-500/30 shadow-lg shadow-emerald-950/10' 
                    : 'border-slate-800 opacity-90'
                }`}
              >
                {/* Device Title & Status */}
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <h4 className="text-base font-extrabold text-slate-100 flex items-center gap-2">
                      <span>{dev.name}</span>
                    </h4>
                    <p className="text-xs text-slate-400 font-mono font-semibold">
                      SN: <span className="text-emerald-400">{dev.serial_number}</span>
                    </p>
                  </div>

                  {/* Online Badge */}
                  <div className={`px-2.5 py-1 rounded-full text-[11px] font-bold flex items-center gap-1.5 border shrink-0 ${
                    dev.is_online 
                      ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' 
                      : 'bg-rose-500/10 border-rose-500/20 text-rose-400'
                  }`}>
                    {dev.is_online ? (
                      <>
                        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                        <span>متصل الآن</span>
                      </>
                    ) : (
                      <>
                        <WifiOff className="w-3 h-3" />
                        <span>غير متصل</span>
                      </>
                    )}
                  </div>
                </div>

                {/* Details list */}
                <div className="p-3 bg-slate-950/80 border border-slate-800/80 rounded-xl space-y-2 text-xs">
                  <div className="flex justify-between items-center text-slate-400">
                    <span>آخر اتصال بالخادم:</span>
                    <span className="font-semibold text-slate-200">{formatLastPing(dev.last_ping)}</span>
                  </div>

                  <div className="flex justify-between items-center text-slate-400">
                    <span>التوقيت المتوقع حالياً:</span>
                    <span className="font-mono font-semibold text-emerald-400 text-[11px] dir-ltr">{dev.estimated_time}</span>
                  </div>

                  {dev.pending_command ? (
                    <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-amber-400 text-[11px] font-bold">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5 animate-spin" />
                        أمر تغيير الوقت معلق:
                      </span>
                      <span className="font-mono text-slate-200">{dev.pending_command.time}</span>
                    </div>
                  ) : null}
                </div>

                {/* Action Button */}
                <div className="pt-1">
                  <button
                    onClick={() => handleOpenSyncModal(dev)}
                    className="w-full py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-black rounded-xl flex items-center justify-center gap-2 transition duration-200 shadow-md shadow-emerald-500/10 cursor-pointer"
                  >
                    <Sliders className="w-4 h-4" />
                    <span>مزامنة الوقت الآن</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Commands Queue & History */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 sm:p-6 space-y-4 shadow-xl">
        <h3 className="text-base sm:text-lg font-black text-slate-100 flex items-center gap-2">
          <History className="w-5 h-5 text-emerald-400" />
          <span>سجل أوامر الوقت وحالة التنفيذ من أجهزة البصمة (device_commands)</span>
        </h3>

        {commandsHistory.length === 0 ? (
          <p className="text-xs text-slate-500 text-center py-6">لا يوجد سجل أية أوامر سابقة.</p>
        ) : (
          <div className="overflow-x-auto border border-slate-800 rounded-xl">
            <table className="w-full text-right text-xs text-slate-300">
              <thead className="bg-slate-950 text-slate-400 font-bold border-b border-slate-800 text-[11px]">
                <tr>
                  <th className="p-3">الرقم التسلسلي (SN)</th>
                  <th className="p-3">صيغة الأمر</th>
                  <th className="p-3">الوقت الموجه للجهاز</th>
                  <th className="p-3">تاريخ الإنشاء</th>
                  <th className="p-3">حالة التنفيذ الحقيقية</th>
                  <th className="p-3 text-center">إجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-medium">
                {commandsHistory.map((cmd) => {
                  const status = cmd.status || (cmd.sent ? 'success' : 'pending');
                  return (
                    <tr key={cmd.id} className="hover:bg-slate-800/40 transition">
                      <td className="p-3 font-mono font-bold text-emerald-400">{cmd.deviceSn}</td>
                      <td className="p-3 font-mono text-[11px] text-slate-300">{cmd.command || 'ALL_FORMATS'}</td>
                      <td className="p-3 font-mono dir-ltr font-bold text-slate-100">{cmd.time}</td>
                      <td className="p-3 text-slate-400">
                        {cmd.createdAt ? new Date(cmd.createdAt).toLocaleString('ar-SA') : '-'}
                      </td>
                      <td className="p-3">
                        {status === 'success' ? (
                          <div className="space-y-0.5">
                            <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 inline-flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3" />
                              <span>تم تأكيد التحديث بنجاح (Return=0)</span>
                            </span>
                            {cmd.confirmedAt && (
                              <p className="text-[10px] text-slate-500 font-mono">
                                تأكيد الجهاز: {new Date(cmd.confirmedAt).toLocaleTimeString('ar-SA')}
                              </p>
                            )}
                          </div>
                        ) : status === 'failed' ? (
                          <div className="space-y-0.5">
                            <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-rose-500/10 border border-rose-500/30 text-rose-400 inline-flex items-center gap-1">
                              <AlertTriangle className="w-3 h-3" />
                              <span>رفض الجهاز الأمر (Return={cmd.returnCode || '-1'})</span>
                            </span>
                            <p className="text-[10px] text-rose-400/80">الصيغة غير مدعومة في هذه الفيرموير</p>
                          </div>
                        ) : status === 'delivered' ? (
                          <div className="space-y-0.5">
                            <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-sky-500/10 border border-sky-500/30 text-sky-400 inline-flex items-center gap-1">
                              <RefreshCw className="w-3 h-3 animate-spin" />
                              <span>تم تسليم الأمر للجهاز (بانتظار شاشة التأكيد)</span>
                            </span>
                            {cmd.deliveredAt && (
                              <p className="text-[10px] text-slate-500 font-mono">
                                التسليم: {new Date(cmd.deliveredAt).toLocaleTimeString('ar-SA')}
                              </p>
                            )}
                          </div>
                        ) : (
                          <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-500/10 border border-amber-500/30 text-amber-400 inline-flex items-center gap-1 animate-pulse">
                            <Clock className="w-3 h-3" />
                            <span>معلق (بانتظار طلب الجهاز بالخادم)</span>
                          </span>
                        )}
                      </td>
                      <td className="p-3 text-center">
                        {status === 'pending' ? (
                          <button
                            onClick={() => handleCancelCommand(cmd.id)}
                            className="p-1.5 bg-rose-500/10 border border-rose-500/30 text-rose-400 hover:bg-rose-500/20 rounded-lg transition cursor-pointer"
                            title="إلغاء الأمر"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        ) : (
                          <span className="text-slate-600 text-[10px]">-</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Sync Modal */}
      <AnimatePresence>
        {selectedDevice && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-lg w-full space-y-5 shadow-2xl text-right max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <Clock className="w-5 h-5 text-emerald-400" />
                  <h3 className="text-base font-extrabold text-slate-100">
                    مزامنة وقت الجهاز: {selectedDevice.name}
                  </h3>
                </div>
                <button
                  onClick={() => setSelectedDevice(null)}
                  className="p-1.5 text-slate-400 hover:text-slate-100 rounded-lg transition cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl text-xs space-y-1">
                <p className="text-slate-400">
                  الرقم التسلسلي: <span className="font-mono font-bold text-emerald-400">{selectedDevice.serial_number}</span>
                </p>
                <p className="text-slate-400">
                  حالة الاتصال: <span className={selectedDevice.is_online ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>
                    {selectedDevice.is_online ? 'متصل الآن' : 'غير متصل'}
                  </span>
                </p>
              </div>

              {/* Time Source Selector */}
              <div className="space-y-3">
                <label className="text-xs font-bold text-slate-200 block">
                  1. اختر الوقت المراد ضبط جهاز البصمة عليه:
                </label>

                {/* Option 1: Asia/Riyadh */}
                <div 
                  onClick={() => setTimeOption('riyadh')}
                  className={`p-3.5 rounded-xl border cursor-pointer transition flex items-center justify-between ${
                    timeOption === 'riyadh' 
                      ? 'bg-emerald-500/10 border-emerald-500 text-slate-100 shadow-md shadow-emerald-950/20' 
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  <div className="space-y-0.5">
                    <p className="text-xs font-extrabold text-emerald-400">توقيت مكة المكرمة / الرياض (Asia/Riyadh)</p>
                    <p className="text-[11px] font-mono text-slate-300 dir-ltr">{getRiyadhTimePreview()}</p>
                  </div>
                  <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                    timeOption === 'riyadh' ? 'border-emerald-400 bg-emerald-500' : 'border-slate-600'
                  }`}>
                    {timeOption === 'riyadh' && <Check className="w-3 h-3 text-slate-950" />}
                  </div>
                </div>

                {/* Option 2: Render Server Time */}
                <div 
                  onClick={() => setTimeOption('server')}
                  className={`p-3.5 rounded-xl border cursor-pointer transition flex items-center justify-between ${
                    timeOption === 'server' 
                      ? 'bg-emerald-500/10 border-emerald-500 text-slate-100 shadow-md shadow-emerald-950/20' 
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  <div className="space-y-0.5">
                    <p className="text-xs font-extrabold text-slate-200">توقيت سيرفر Render الحالي</p>
                    <p className="text-[11px] font-mono text-slate-300 dir-ltr">{getServerTimePreview()}</p>
                  </div>
                  <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                    timeOption === 'server' ? 'border-emerald-400 bg-emerald-500' : 'border-slate-600'
                  }`}>
                    {timeOption === 'server' && <Check className="w-3 h-3 text-slate-950" />}
                  </div>
                </div>

                {/* Option 3: Custom Manual Datetime */}
                <div 
                  onClick={() => setTimeOption('custom')}
                  className={`p-3.5 rounded-xl border cursor-pointer transition space-y-2 ${
                    timeOption === 'custom' 
                      ? 'bg-emerald-500/10 border-emerald-500 text-slate-100 shadow-md shadow-emerald-950/20' 
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-extrabold text-amber-400">تحديد تاريخ ووقت يدوي مخصص</p>
                    <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                      timeOption === 'custom' ? 'border-emerald-400 bg-emerald-500' : 'border-slate-600'
                    }`}>
                      {timeOption === 'custom' && <Check className="w-3 h-3 text-slate-950" />}
                    </div>
                  </div>

                  {timeOption === 'custom' && (
                    <div className="pt-2">
                      <input
                        type="datetime-local"
                        value={customDateTime}
                        onChange={(e) => setCustomDateTime(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-100 text-xs font-mono focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* Protocol Command Format Selector */}
              <div className="space-y-2 pt-2 border-t border-slate-800">
                <label className="text-xs font-bold text-slate-200 block">
                  2. اختر صيغة بروتوكول ZKTeco ADMS لتغيير الوقت:
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  <button
                    type="button"
                    onClick={() => setCmdFormat('DATA_OPTION')}
                    className={`p-2.5 rounded-xl border text-right transition ${
                      cmdFormat === 'DATA_OPTION'
                        ? 'bg-emerald-500/10 border-emerald-500 text-emerald-300 font-bold'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <p className="text-[11px] font-black">DATA OPTION SetTIME=... (موصى به)</p>
                    <p className="text-[9px] text-slate-400">الصيغة القياسية الرسمية لبروتوكول ZK ADMS Push</p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setCmdFormat('SET_OPTION')}
                    className={`p-2.5 rounded-xl border text-right transition ${
                      cmdFormat === 'SET_OPTION'
                        ? 'bg-emerald-500/10 border-emerald-500 text-emerald-300 font-bold'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <p className="text-[11px] font-black">SET OPTION SetTIME=...</p>
                    <p className="text-[9px] text-slate-400">صيغة إعدادات النظام للنماذج القديمة</p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setCmdFormat('SET_TIME_EQUAL')}
                    className={`p-2.5 rounded-xl border text-right transition ${
                      cmdFormat === 'SET_TIME_EQUAL'
                        ? 'bg-emerald-500/10 border-emerald-500 text-emerald-300 font-bold'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <p className="text-[11px] font-black">SetTIME=YYYY-MM-DD...</p>
                    <p className="text-[9px] text-slate-400">صيغة إسناد القيمة المباشرة بـ (=)</p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setCmdFormat('DIRECT_SET_TIME')}
                    className={`p-2.5 rounded-xl border text-right transition ${
                      cmdFormat === 'DIRECT_SET_TIME'
                        ? 'bg-emerald-500/10 border-emerald-500 text-emerald-300 font-bold'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <p className="text-[11px] font-black">SetTIME YYYY-MM-DD...</p>
                    <p className="text-[9px] text-slate-400">صيغة الأمر المباشر بمسافة</p>
                  </button>
                </div>
              </div>

              {/* Protocol Command Format Preview */}
              <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl space-y-1">
                <span className="text-[11px] font-bold text-slate-400 block">الأمر البرمجي المصدر للجهاز (ADMS Protocol Command):</span>
                <code className="text-emerald-400 font-mono text-[11px] block dir-ltr whitespace-pre-wrap">
                  {cmdFormat === 'DATA_OPTION' ? (
                    `C:<cmdId>:DATA OPTION SetTIME=${
                      timeOption === 'custom' 
                        ? (customDateTime ? customDateTime.replace('T', ' ') + ':00' : 'YYYY-MM-DD HH:mm:ss')
                        : (timeOption === 'server' ? getServerTimePreview() : getRiyadhTimePreview())
                    }`
                  ) : cmdFormat === 'SET_OPTION' ? (
                    `C:<cmdId>:SET OPTION SetTIME=${
                      timeOption === 'custom' 
                        ? (customDateTime ? customDateTime.replace('T', ' ') + ':00' : 'YYYY-MM-DD HH:mm:ss')
                        : (timeOption === 'server' ? getServerTimePreview() : getRiyadhTimePreview())
                    }`
                  ) : cmdFormat === 'SET_TIME_EQUAL' ? (
                    `C:<cmdId>:SetTIME=${
                      timeOption === 'custom' 
                        ? (customDateTime ? customDateTime.replace('T', ' ') + ':00' : 'YYYY-MM-DD HH:mm:ss')
                        : (timeOption === 'server' ? getServerTimePreview() : getRiyadhTimePreview())
                    }`
                  ) : (
                    `C:<cmdId>:SetTIME ${
                      timeOption === 'custom' 
                        ? (customDateTime ? customDateTime.replace('T', ' ') + ':00' : 'YYYY-MM-DD HH:mm:ss')
                        : (timeOption === 'server' ? getServerTimePreview() : getRiyadhTimePreview())
                    }`
                  )}
                </code>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-3 pt-2">
                <button
                  onClick={handleSendSyncCommand}
                  disabled={submitting}
                  className="flex-1 py-3 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black rounded-xl text-xs flex items-center justify-center gap-2 transition duration-200 cursor-pointer shadow-lg shadow-emerald-500/10"
                >
                  <Send className="w-4 h-4" />
                  <span>{submitting ? 'جاري الإنشاء...' : 'إرسال أمر المزامنة للجهاز'}</span>
                </button>

                <button
                  onClick={() => setSelectedDevice(null)}
                  className="px-4 py-3 bg-slate-950 border border-slate-800 text-slate-400 hover:text-slate-100 font-bold rounded-xl text-xs transition cursor-pointer"
                >
                  إلغاء
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Add Device Modal */}
      <AnimatePresence>
        {showAddDevice && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-md w-full space-y-4 shadow-2xl text-right"
            >
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <h3 className="text-base font-extrabold text-slate-100 flex items-center gap-2">
                  <Plus className="w-5 h-5 text-emerald-400" />
                  <span>تسجيل جهاز ZKTeco جديد</span>
                </h3>
                <button
                  onClick={() => setShowAddDevice(false)}
                  className="p-1.5 text-slate-400 hover:text-slate-100 rounded-lg transition cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleRegisterDevice} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-300 block">
                    الرقم التسلسلي للجهاز (Serial Number / SN):
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="مثال: M2000123456"
                    value={newSn}
                    onChange={(e) => setNewSn(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 text-xs font-mono uppercase focus:outline-none focus:border-emerald-500"
                  />
                  <p className="text-[10px] text-slate-500">موجود على ملصق الجهاز الخلفي أو في شاشة معلومات الجهاز.</p>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-300 block">
                    اسم الجهاز / الموقع:
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="مثال: بصمة المدخل الرئيسي - M2000"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 text-xs focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div className="flex items-center gap-3 pt-3">
                  <button
                    type="submit"
                    disabled={registering}
                    className="flex-1 py-3 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black rounded-xl text-xs flex items-center justify-center gap-2 transition cursor-pointer"
                  >
                    <Check className="w-4 h-4" />
                    <span>{registering ? 'جاري الحفظ...' : 'حفظ الجهاز'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowAddDevice(false)}
                    className="px-4 py-3 bg-slate-950 border border-slate-800 text-slate-400 hover:text-slate-100 font-bold rounded-xl text-xs transition cursor-pointer"
                  >
                    إلغاء
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
