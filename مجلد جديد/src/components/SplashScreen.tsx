/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { Clock, ShieldCheck, Database, Loader2, CheckCircle2, AlertTriangle, Info } from 'lucide-react';
import { db } from '../supabaseClient';
import BrandLogo from './BrandLogo';

interface SplashScreenProps {
  onComplete: () => void;
}

interface LogEntry {
  text: string;
  status: 'pending' | 'success' | 'info' | 'error';
}

export default function SplashScreen({ onComplete }: SplashScreenProps) {
  const [history, setHistory] = useState<LogEntry[]>([]);
  const [currentLog, setCurrentLog] = useState<LogEntry | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function startInitialization() {
      try {
        const result = await db.initializeSystem((step, status) => {
          if (!isMounted) return;
          const entry = { text: step, status };
          setCurrentLog(entry);
          setHistory(prev => {
            // Keep unique list of steps or update state
            const existsIndex = prev.findIndex(item => item.text === step);
            if (existsIndex > -1) {
              const next = [...prev];
              next[existsIndex] = entry;
              return next;
            }
            return [...prev, entry];
          });
        });

        if (!isMounted) return;

        // Give the user a moment to see the success state
        setTimeout(() => {
          if (isMounted) onComplete();
        }, 1000);
      } catch (err) {
        console.error('Initialization error:', err);
        if (isMounted) onComplete();
      }
    }

    startInitialization();

    return () => {
      isMounted = false;
    };
  }, [onComplete]);

  return (
    <div id="splash-screen" className="fixed inset-0 bg-slate-950 text-white flex flex-col items-center justify-center z-50 overflow-hidden">
      {/* Background ambient glowing circles */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl" />
      
      <div className="text-center space-y-6 max-w-lg w-full px-6 relative z-10">
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
          className="mx-auto flex flex-col items-center justify-center"
        >
          <BrandLogo size="xl" animated={true} />
        </motion.div>

        {/* Real-time automated verification console log */}
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="bg-slate-900/90 border border-slate-800/80 rounded-xl p-4 text-right space-y-2.5 max-w-md mx-auto"
        >
          <div className="flex items-center gap-2 pb-1.5 border-b border-slate-850 justify-between">
            <span className="text-[10px] text-slate-500 font-mono font-bold uppercase tracking-wider">Startup Handshake Engine v2.0</span>
            <span className="flex items-center gap-1.5 text-[10px] font-bold text-emerald-400">
              <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-ping" />
              <span>فحص فوري للاتصال</span>
            </span>
          </div>

          <div className="space-y-1.5 text-xs text-slate-300 font-mono text-right max-h-[140px] overflow-y-auto pr-1">
            {history.map((h, idx) => (
              <div key={idx} className="flex items-start gap-2 justify-start leading-relaxed animate-fadeIn">
                {h.status === 'pending' && <Loader2 className="w-3.5 h-3.5 text-emerald-400 animate-spin mt-0.5 flex-shrink-0" />}
                {h.status === 'success' && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 mt-0.5 flex-shrink-0" />}
                {h.status === 'info' && <Info className="w-3.5 h-3.5 text-amber-400 mt-0.5 flex-shrink-0" />}
                {h.status === 'error' && <AlertTriangle className="w-3.5 h-3.5 text-rose-500 mt-0.5 flex-shrink-0" />}
                <span className={`text-[11px] ${h.status === 'error' ? 'text-rose-400' : h.status === 'success' ? 'text-emerald-400 font-bold' : h.status === 'info' ? 'text-amber-400 font-bold' : 'text-slate-300'}`}>
                  {h.text}
                </span>
              </div>
            ))}
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6, duration: 0.5 }}
          className="pt-2 flex items-center justify-center gap-2 text-[10px] text-slate-500"
        >
          <ShieldCheck className="w-4 h-4 text-emerald-500" />
          <span>تطبيق رسمي مشفر • عزل مستأجرين RLS مفعّل تلقائياً</span>
        </motion.div>
      </div>
    </div>
  );
}
