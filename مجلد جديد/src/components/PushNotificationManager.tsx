/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Bell, BellRing, BellOff, CheckCircle2, AlertTriangle, Smartphone, Volume2, Sparkles, X, ShieldCheck, RefreshCw, Send, Check } from 'lucide-react';
import { pushClient, PushStatus } from '../lib/pushClient';
import { playNotificationSound } from '../lib/audioService';

interface PushNotificationManagerProps {
  user: any;
  isOpen: boolean;
  onClose: () => void;
}

export default function PushNotificationManager({ user, isOpen, onClose }: PushNotificationManagerProps) {
  const [status, setStatus] = useState<PushStatus>({
    supported: true,
    permission: 'default',
    subscribed: false
  });
  const [loading, setLoading] = useState(false);
  const [testSending, setTestSending] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const checkPush = async () => {
    const s = await pushClient.checkStatus();
    setStatus(s);
  };

  useEffect(() => {
    checkPush();
  }, [isOpen]);

  const handleSubscribe = async () => {
    if (!user || !user.id) return;
    setLoading(true);
    setMessage(null);
    try {
      const res = await pushClient.subscribe(user.id);
      if (res.success) {
        setMessage({ type: 'success', text: 'تم تفعيل الإشعارات الفورية بنجاح على هذا الجهاز! 🎉' });
        await checkPush();
      } else {
        setMessage({ type: 'error', text: res.error || 'فشل تفعيل الإشعارات' });
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'حدث خطأ غير متوقع' });
    } finally {
      setLoading(false);
    }
  };

  const handleUnsubscribe = async () => {
    if (!user || !user.id) return;
    if (!window.confirm('هل تريد بالتأكيد إيقاف استقبال الإشعارات الفورية على هذا الجهاز؟')) return;
    setLoading(true);
    setMessage(null);
    try {
      await pushClient.unsubscribe(user.id);
      setMessage({ type: 'success', text: 'تم إيقاف الإشعارات على هذا الجهاز.' });
      await checkPush();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'فشل إيقاف الإشعارات' });
    } finally {
      setLoading(false);
    }
  };

  const handleSendTest = async () => {
    if (!user || !user.id) return;
    setTestSending(true);
    setMessage(null);
    try {
      const res = await pushClient.sendTestNotification(user.id);
      if (res.success) {
        setMessage({ type: 'success', text: res.message });
      } else {
        setMessage({ type: 'error', text: res.message });
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'فشل إرسال الإشعار التجريبي' });
    } finally {
      setTestSending(false);
    }
  };

  const handleTestSound = () => {
    playNotificationSound();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden text-right font-sans"
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-slate-800 bg-slate-950/50">
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-100 hover:bg-slate-800 rounded-lg transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2.5">
            <div>
              <h3 className="text-base sm:text-lg font-black text-slate-100 flex items-center gap-2">
                <span>الإشعارات الفورية للبصمة (Push Notifications)</span>
                <span className="p-1 bg-emerald-500/10 text-emerald-400 rounded-md">
                  <BellRing className="w-4 h-4" />
                </span>
              </h3>
              <p className="text-xs text-slate-400 font-medium">وصول فوري لإشعار بصمة الدخول والخروج لهاتفك ومتصفحك</p>
            </div>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-5 sm:p-6 space-y-5 max-h-[75vh] overflow-y-auto">
          {/* Status Card */}
          <div className={`p-4 rounded-xl border flex items-center justify-between gap-3 ${
            status.subscribed
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
              : status.permission === 'denied'
              ? 'bg-rose-500/10 border-rose-500/30 text-rose-300'
              : 'bg-amber-500/10 border-amber-500/30 text-amber-300'
          }`}>
            <div className="flex items-center gap-3">
              <div className={`w-3 h-3 rounded-full ${
                status.subscribed ? 'bg-emerald-400 animate-ping' : status.permission === 'denied' ? 'bg-rose-400' : 'bg-amber-400 animate-pulse'
              }`} />
              <div>
                <span className="text-xs sm:text-sm font-bold block">
                  {status.subscribed
                    ? 'الإشعارات الفورية مفعلة ونشطة على هذا الجهاز'
                    : status.permission === 'denied'
                    ? 'الإشعارات محظورة من إعدادات المتصفح'
                    : 'الإشعارات غير مفعلة على هذا الجهاز حالياً'}
                </span>
                <span className="text-[11px] opacity-80 block mt-0.5 font-medium">
                  {status.subscribed
                    ? 'سيرسل النظام إشعاراً فورياً لهاتفك عند تسجيل أي موظف لبصمة دخول أو خروج'
                    : status.permission === 'denied'
                    ? 'يرجى السماح بالإشعارات من إعدادات المتصفح أو القفل بجانب شريط العنوان'
                    : 'اضغط على زر التفعيل أدناه لبدء استقبال الإشعارات'}
                </span>
              </div>
            </div>
            {status.subscribed && <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />}
            {status.permission === 'denied' && <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0" />}
          </div>

          {/* Feedback Message */}
          {message && (
            <div className={`p-3.5 rounded-xl border text-xs font-semibold flex items-center gap-2 ${
              message.type === 'success'
                ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300'
                : 'bg-rose-500/15 border-rose-500/30 text-rose-300'
            }`}>
              {message.type === 'success' ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertTriangle className="w-4 h-4 shrink-0" />}
              <span>{message.text}</span>
            </div>
          )}

          {/* Features Highlights */}
          <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-4 space-y-3">
            <h4 className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
              <span>مميزات نظام الإشعارات الفورية في بصمة تك:</span>
            </h4>
            <ul className="text-xs text-slate-400 space-y-2 leading-relaxed">
              <li className="flex items-start gap-2">
                <span className="text-emerald-400 font-bold mt-0.5">•</span>
                <span><strong>إشعار فوري حقيقي:</strong> يصل لهاتفك أو شاشتك في غضون ثانية واحدة من وضع العامل لبصمته على جهاز ZKTeco.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-emerald-400 font-bold mt-0.5">•</span>
                <span><strong>يعمل والتطبيق مغلق:</strong> تصلك الإشعارات حتى وإن كان المتصفح أو التطبيق مغلقاً تماماً في الخلفية.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-emerald-400 font-bold mt-0.5">•</span>
                <span><strong>تفاصيل كاملة باللغة العربية:</strong> يتضمن الإشعار اسم الموظف، القسم، نوع البصمة (دخول/خروج)، الوقت الدقيق، واسم جهاز البصمة.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-emerald-400 font-bold mt-0.5">•</span>
                <span><strong>نغمة تنبيه مميزة:</strong> صوت تنبيه واهتزاز واضح لتمييز حركة الحضور والانصراف فوراً.</span>
              </li>
            </ul>
          </div>

          {/* Action Buttons */}
          <div className="space-y-2.5">
            {!status.subscribed ? (
              <button
                onClick={handleSubscribe}
                disabled={loading}
                className="w-full py-3.5 px-4 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black rounded-xl text-sm flex items-center justify-center gap-2 transition duration-200 shadow-lg shadow-emerald-500/20 cursor-pointer disabled:opacity-50"
              >
                {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <BellRing className="w-4 h-4" />}
                <span>{loading ? 'جاري طلب الإذن والتفعيل...' : 'تفعيل الإشعارات الفورية على هذا الجهاز'}</span>
              </button>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <button
                  onClick={handleSendTest}
                  disabled={testSending}
                  className="py-3 px-4 bg-emerald-500/20 border border-emerald-500/40 hover:bg-emerald-500/30 text-emerald-300 font-bold rounded-xl text-xs sm:text-sm flex items-center justify-center gap-2 transition cursor-pointer disabled:opacity-50"
                >
                  {testSending ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  <span>{testSending ? 'جاري الإرسال...' : 'إرسال إشعار تجريبي لهاتفي'}</span>
                </button>

                <button
                  onClick={handleTestSound}
                  className="py-3 px-4 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold rounded-xl text-xs sm:text-sm flex items-center justify-center gap-2 transition cursor-pointer"
                >
                  <Volume2 className="w-4 h-4 text-emerald-400" />
                  <span>تجربة نغمة التنبيه</span>
                </button>
              </div>
            )}

            {status.subscribed && (
              <div className="pt-2 text-center">
                <button
                  onClick={handleUnsubscribe}
                  disabled={loading}
                  className="text-xs text-rose-400/80 hover:text-rose-400 hover:underline transition cursor-pointer font-medium"
                >
                  إلغاء تفعيل الإشعارات على هذا الجهاز
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-950 border-t border-slate-800 text-center text-xs text-slate-500">
          متوافق مع هواتف Android و iPhone (عبر تثبيت التطبيق PWA) والمتصفحات الحديثة.
        </div>
      </motion.div>
    </div>
  );
}

/**
 * Floating In-App Live Toast for Push Notifications arriving while tab is in foreground
 */
export function LivePunchToast() {
  const [livePunch, setLivePunch] = useState<{
    title: string;
    body: string;
    time: string;
    data?: any;
  } | null>(null);

  useEffect(() => {
    const unsubscribe = pushClient.onForegroundMessage((payload) => {
      console.log('[Toast] Live punch arrived in foreground:', payload);
      setLivePunch({
        title: payload.title || 'إشعار بصمة جديد',
        body: payload.body || 'تم تسجيل بصمة جديدة',
        time: new Date().toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        data: payload.data
      });

      // Auto dismiss after 6 seconds
      const timer = setTimeout(() => {
        setLivePunch(null);
      }, 6000);

      return () => clearTimeout(timer);
    });

    return () => {
      unsubscribe();
    };
  }, []);

  if (!livePunch) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -20, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -20, scale: 0.95 }}
        className="fixed top-4 left-1/2 -translate-x-1/2 z-50 w-full max-w-md px-4 pointer-events-auto font-sans text-right"
      >
        <div className="bg-slate-900/95 border-2 border-emerald-500/80 rounded-2xl p-4 shadow-2xl backdrop-blur-md text-slate-100 flex items-start gap-3.5 shadow-emerald-950/30">
          <div className="p-2.5 bg-emerald-500/20 text-emerald-400 rounded-xl shrink-0 mt-0.5">
            <BellRing className="w-5 h-5 animate-bounce" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] text-emerald-400 font-mono font-bold bg-emerald-950/60 px-2 py-0.5 rounded-full border border-emerald-800/40">
                {livePunch.time}
              </span>
              <h4 className="text-xs sm:text-sm font-black text-slate-100 truncate">{livePunch.title}</h4>
            </div>
            <p className="text-xs text-slate-300 font-medium mt-1 leading-relaxed">{livePunch.body}</p>
          </div>
          <button
            onClick={() => setLivePunch(null)}
            className="text-slate-400 hover:text-slate-100 p-1 rounded-lg hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
