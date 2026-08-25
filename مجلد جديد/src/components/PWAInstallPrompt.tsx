import React, { useState, useEffect } from 'react';
import { Smartphone, Download, CheckCircle2, X, Info, ExternalLink, ShieldCheck, RefreshCw } from 'lucide-react';

export default function PWAInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isStandalone, setIsStandalone] = useState<boolean>(false);
  const [showBanner, setShowBanner] = useState<boolean>(true);
  const [showGuideModal, setShowGuideModal] = useState<boolean>(false);
  const [isIframe, setIsIframe] = useState<boolean>(false);
  const [isResetting, setIsResetting] = useState<boolean>(false);

  useEffect(() => {
    // Check if running inside an iframe
    const inIframe = window.self !== window.top;
    setIsIframe(inIframe);

    // Check if app is already running in standalone PWA mode
    const isStandaloneMode = 
      window.matchMedia('(display-mode: standalone)').matches || 
      (window.navigator as any).standalone || 
      document.referrer.includes('android-app://');
    
    setIsStandalone(isStandaloneMode);

    // Listen for Chrome / Android beforeinstallprompt
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowBanner(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // Listen for appinstalled
    const handleAppInstalled = () => {
      setDeferredPrompt(null);
      setIsStandalone(true);
      setShowBanner(false);
      console.log('[PWA] App successfully installed!');
    };

    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        console.log('[PWA] User accepted the install prompt');
        setDeferredPrompt(null);
        setShowBanner(false);
      }
    } else {
      setShowGuideModal(true);
    }
  };

  const handleResetPWA = async () => {
    setIsResetting(true);
    try {
      if ('serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        for (const reg of registrations) {
          await reg.unregister();
        }
      }
      if ('caches' in window) {
        const keys = await caches.keys();
        for (const key of keys) {
          await caches.delete(key);
        }
      }
      setTimeout(() => {
        window.location.reload();
      }, 500);
    } catch (err) {
      console.error('[PWA Reset Error]:', err);
      window.location.reload();
    }
  };

  // If already installed or running as PWA standalone app, don't show prompt
  if (isStandalone) return null;

  return (
    <>
      {/* Persistent PWA Install Header Banner */}
      {showBanner && (
        <div className="bg-gradient-to-r from-emerald-950 via-slate-900 to-teal-950 border-b border-emerald-500/30 px-3 py-2 text-slate-100 flex items-center justify-between gap-3 text-xs z-40 relative shadow-md">
          <div className="flex items-center gap-2.5 overflow-hidden">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center shrink-0">
              <Smartphone className="w-4 h-4 text-emerald-400 animate-pulse" />
            </div>
            <div className="leading-tight">
              <div className="font-extrabold text-slate-100 text-xs flex items-center gap-1.5">
                <span>تثبيت تطبيق بصمة تك الرسمي</span>
                <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[9px] px-1.5 py-0.2 rounded font-mono font-bold">PWA App</span>
              </div>
              <p className="text-[10px] text-slate-300 truncate">
                {isIframe 
                  ? 'افتح الموقع في تبويب مستقل لتفعيل التثبيت المباشر على الجوال' 
                  : 'احصل على تجربة تطبيق كاملة بدون أشرطة متصفح وبدعم أوفلاين'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={handleInstallClick}
              className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black rounded-lg text-xs transition flex items-center gap-1.5 cursor-pointer shadow-sm shadow-emerald-500/20"
            >
              <Download className="w-3.5 h-3.5" />
              <span>{deferredPrompt ? 'تثبيت التطبيق الآن' : 'تعليمات التثبيت'}</span>
            </button>
            <button
              onClick={() => setShowBanner(false)}
              className="p-1 hover:bg-slate-800 text-slate-400 hover:text-slate-200 rounded transition cursor-pointer"
              title="إغلاق"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Installation Instructions Guide Modal */}
      {showGuideModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 text-right space-y-5 shadow-2xl relative">
            <button
              onClick={() => setShowGuideModal(false)}
              className="absolute top-4 left-4 p-1.5 text-slate-400 hover:text-slate-200 bg-slate-800 rounded-lg transition"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-3">
              <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-400">
                <Smartphone className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-extrabold text-slate-100">تثبيت تطبيق بصمة تك (PWA)</h3>
                <p className="text-xs text-slate-400">إعادة تعيين البيانات وتفعيل التثبيت الرسمي</p>
              </div>
            </div>

            {/* Quick Reset Action */}
            <div className="bg-slate-950/80 border border-emerald-500/30 rounded-xl p-3.5 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-extrabold text-xs text-emerald-400 flex items-center gap-1.5">
                  <RefreshCw className={`w-3.5 h-3.5 ${isResetting ? 'animate-spin' : ''}`} />
                  مسح ذاكرة التخزين وإعادة التسجيل
                </span>
              </div>
              <p className="text-[11px] text-slate-300 leading-relaxed">
                إذا ظهر لك خيار "إنشاء اختصار" في متصفح كروم، اضغط الزر أدناه لمسح النسخة الكاش القديمة ثم أعد تحميل الصفحة ليقوم كروم ببدء التثبيت كتطبيق مستقل.
              </p>
              <button
                onClick={handleResetPWA}
                disabled={isResetting}
                className="w-full mt-1 py-2 bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-black rounded-lg text-xs transition flex items-center justify-center gap-2 shadow-md cursor-pointer disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isResetting ? 'animate-spin' : ''}`} />
                <span>{isResetting ? 'جاري مسح الذاكرة وتحديث التطبيق...' : 'إعادة تحديث بيانات التثبيت الآن'}</span>
              </button>
            </div>

            {isIframe && (
              <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-3 text-amber-300 text-xs space-y-2">
                <div className="flex items-center gap-1.5 font-bold">
                  <Info className="w-4 h-4 shrink-0 text-amber-400" />
                  <span>ملاحظة هامة (معاينة داخلية):</span>
                </div>
                <p className="leading-relaxed text-[11px] text-amber-200">
                  متصفح جوجل كروم يمنع التثبيت المباشر داخل إطار المعاينة الداخلية (iFrame). يرجى فتح الموقع أولاً في تبويب متصفح مستقل، ثم الضغط على زر التثبيت.
                </p>
                <a
                  href={window.location.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 bg-amber-500 text-slate-950 font-bold px-3 py-1.5 rounded-lg text-xs mt-1 hover:bg-amber-400 transition"
                >
                  <span>فتح في نافذة/تبويب جديد</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            )}

            <div className="space-y-3 pt-1 text-xs text-slate-300">
              <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-3 space-y-1.5">
                <div className="font-bold text-emerald-400 flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4" />
                  <span>خطوات التثبيت في Google Chrome (Android):</span>
                </div>
                <ol className="list-decimal list-inside space-y-1 text-slate-300 text-[11px] pr-1">
                  <li>افتح الرابط في متصفح Chrome الأصلي.</li>
                  <li>اضغط على زر <strong>"تثبيت التطبيق الآن"</strong> الموجود في الشريط في أعلى الصفحة.</li>
                  <li>أو من قائمة كروم (⋮) اختر <strong>"تثبيت التطبيق / Install App"</strong>.</li>
                  <li>إذا اخترت "إنشاء اختصار"، تأكد من تفعيل خيار <strong>"فتح كـ نافذة مستقلة (Open as window)"</strong>.</li>
                </ol>
              </div>

              <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-3 space-y-1.5">
                <div className="font-bold text-sky-400 flex items-center gap-1.5">
                  <Smartphone className="w-4 h-4" />
                  <span>أجهزة آيفون (iOS Safari):</span>
                </div>
                <ol className="list-decimal list-inside space-y-1 text-slate-300 text-[11px] pr-1">
                  <li>افتح الموقع عبر متصفح Safari.</li>
                  <li>اضغط زر المشاركة (Share) ثم <strong>"إضافة إلى الشاشة الرئيسية"</strong>.</li>
                </ol>
              </div>
            </div>

            <button
              onClick={() => setShowGuideModal(false)}
              className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold rounded-xl text-xs transition"
            >
              إغلاق
            </button>
          </div>
        </div>
      )}
    </>
  );
}
