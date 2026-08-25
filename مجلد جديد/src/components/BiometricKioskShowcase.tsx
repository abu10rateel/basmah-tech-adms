import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Fingerprint, CheckCircle2, Sparkles, Shield, Zap, AlertCircle } from 'lucide-react';
import kioskHeroImg from '../assets/images/basma_tech_kiosk_1784742238740.jpg';

interface BiometricKioskShowcaseProps {
  status?: 'idle' | 'verifying' | 'success' | 'error';
  companyName?: string;
}

export default function BiometricKioskShowcase({
  status = 'idle'
}: BiometricKioskShowcaseProps) {
  return (
    <div className="relative w-full rounded-2xl overflow-hidden border border-emerald-500/30 bg-slate-950 shadow-2xl shadow-emerald-950/40 my-3 text-slate-100 font-sans group">
      {/* Photorealistic Background Image with Dark Overlay */}
      <div className="relative h-56 sm:h-60 w-full overflow-hidden">
        <img
          src={kioskHeroImg}
          alt="Basma Tech Cyber Biometric Kiosk"
          className="w-full h-full object-cover object-center filter brightness-90 saturate-125 transition-all duration-700"
        />

        {/* Cyberpunk Grid & Gradient Overlays */}
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/70 to-transparent" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-emerald-500/15 via-transparent to-slate-950/80" />

        {/* Scan Lines Overlay */}
        <div className="absolute inset-0 bg-[linear-gradient(rgba(16,185,129,0.06)_1px,transparent_1px)] bg-[size:100%_4px] pointer-events-none" />

        {/* Floating Cyber Tech HUD Accents */}
        <div className="absolute top-3 right-3 flex items-center gap-2 px-2.5 py-1 rounded-full bg-slate-900/80 border border-emerald-500/40 backdrop-blur-md text-[10px] font-mono text-emerald-400 shadow-lg">
          <span className={`w-2 h-2 rounded-full ${status === 'success' ? 'bg-emerald-400 animate-ping' : status === 'verifying' ? 'bg-amber-400 animate-ping' : 'bg-emerald-500/80'}`} />
          <span>CYBER-LOCK v3.4 // {status === 'success' ? 'VERIFIED' : status === 'verifying' ? 'SCANNING...' : 'READY'}</span>
        </div>

        {/* Dynamic Center Interactive HUD */}
        <div className="absolute inset-0 flex items-center justify-center p-4">
          <AnimatePresence mode="wait">
            {/* IDLE STATE: Default Standby when user opens page */}
            {status === 'idle' && (
              <motion.div
                key="idle"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 1.05 }}
                className="flex flex-col items-center text-center gap-2 bg-slate-950/85 p-4 sm:p-5 rounded-2xl border border-emerald-500/30 backdrop-blur-md max-w-xs shadow-xl"
              >
                <div className="relative w-12 h-12 rounded-2xl bg-slate-900 border border-emerald-500/40 flex items-center justify-center shadow-lg shadow-emerald-500/10">
                  <Fingerprint className="w-7 h-7 text-emerald-400/90 animate-pulse" />
                  <div className="absolute inset-0 rounded-2xl border border-emerald-400/20" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-200">جهاز البصمة في وضع الاستعداد</h4>
                  <p className="text-[11px] text-slate-400 mt-0.5">في انتظار إدخال البيانات...</p>
                </div>
              </motion.div>
            )}

            {/* VERIFYING STATE: Clicking Login / API Request Pending */}
            {status === 'verifying' && (
              <motion.div
                key="verifying"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 1.05 }}
                className="relative flex flex-col items-center text-center gap-2.5 bg-slate-950/90 p-5 rounded-2xl border-2 border-emerald-400 shadow-[0_0_30px_rgba(16,185,129,0.3)] backdrop-blur-md"
              >
                {/* Neon Laser Beam Effect */}
                <div className="relative w-14 h-14 rounded-2xl bg-slate-900 border border-emerald-500/60 flex items-center justify-center overflow-hidden">
                  <Fingerprint className="w-9 h-9 text-emerald-400" />
                  <motion.div
                    animate={{ top: ['0%', '100%', '0%'] }}
                    transition={{ repeat: Infinity, duration: 1.1, ease: 'easeInOut' }}
                    className="absolute left-0 right-0 h-1 bg-emerald-400 shadow-[0_0_12px_#34d399]"
                  />
                  <div className="absolute inset-0 bg-emerald-500/10" />
                </div>

                <div className="flex items-center gap-1.5">
                  <Zap className="w-3.5 h-3.5 text-emerald-400 animate-bounce" />
                  <span className="text-xs font-bold text-emerald-300 tracking-wide font-mono">جاري مطابقة ومصادقة البصمة...</span>
                </div>
              </motion.div>
            )}

            {/* SUCCESS STATE: Login Success 200 */}
            {status === 'success' && (
              <motion.div
                key="success"
                initial={{ opacity: 0, scale: 0.85, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                transition={{ type: 'spring', damping: 16 }}
                className="flex flex-col items-center text-center gap-2 bg-slate-950/95 p-5 rounded-2xl border-2 border-emerald-400 shadow-[0_0_50px_rgba(16,185,129,0.5)] backdrop-blur-xl"
              >
                <div className="relative flex items-center justify-center">
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-slate-900 to-emerald-950 border border-emerald-400 flex items-center justify-center shadow-lg shadow-emerald-500/40">
                    <Fingerprint className="w-9 h-9 text-emerald-400 filter drop-shadow-[0_0_10px_rgba(52,211,153,0.8)]" />
                  </div>
                  <div className="absolute -bottom-1 -right-1 bg-emerald-400 text-slate-950 p-1 rounded-full shadow-md">
                    <CheckCircle2 className="w-4 h-4 stroke-[3]" />
                  </div>
                </div>

                <div className="space-y-0.5">
                  <div className="inline-flex items-center gap-1 text-[10px] font-extrabold text-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 rounded-full border border-emerald-500/30">
                    <Sparkles className="w-3 h-3" />
                    <span>تمت البصمة بنجاح!</span>
                  </div>
                  <h3 className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-emerald-300 via-teal-100 to-emerald-400 filter drop-shadow-[0_0_10px_rgba(16,185,129,0.5)]">
                    بصمة تك
                  </h3>
                </div>
              </motion.div>
            )}

            {/* ERROR STATE: Invalid Credentials */}
            {status === 'error' && (
              <motion.div
                key="error"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                className="flex flex-col items-center text-center gap-1.5 bg-red-950/80 p-4 rounded-2xl border border-red-500/40 backdrop-blur-md max-w-xs"
              >
                <div className="w-10 h-10 rounded-full bg-red-500/20 border border-red-500/60 flex items-center justify-center text-red-400">
                  <AlertCircle className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-red-300">فشل المصادقة</h4>
                  <p className="text-[10px] text-red-200 mt-0.5">يرجى التأكد من صحة بيانات الدخول</p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Footer Info Strip */}
      <div className="px-4 py-2 bg-slate-900/90 border-t border-emerald-500/20 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-300">
        <div className="flex items-center gap-1.5 text-emerald-400 font-bold">
          <Shield className="w-3.5 h-3.5 shrink-0" />
          <span>نظام الاتصال والتحقق السحابي البيومتري</span>
        </div>
        <div className="text-[10px] text-slate-400 font-mono">
          STATUS: {status.toUpperCase()}
        </div>
      </div>
    </div>
  );
}
