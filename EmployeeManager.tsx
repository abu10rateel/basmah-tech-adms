/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import SplashScreen from './components/SplashScreen';
import AuthUI from './components/AuthUI';
import EmployeeManager from './components/EmployeeManager';
import ShiftManager from './components/ShiftManager';
import AttendanceRegister from './components/AttendanceRegister';
import ReportingEngine from './components/ReportingEngine';
import SuperAdminDashboard from './components/SuperAdminDashboard';
import PWAInstallPrompt from './components/PWAInstallPrompt';
import { db } from './supabaseClient';
import { LogOut, UserCheck, Users, Clock, BarChart3, Database, Building2, Calendar, AlertTriangle, ShieldAlert, AlertCircle, MessageSquare, ExternalLink } from 'lucide-react';
import BrandLogo from './components/BrandLogo';

export default function App() {
  const [showSplash, setShowSplash] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'attendance' | 'reports' | 'employees' | 'shifts'>('attendance');

  useEffect(() => {
    // Listen to session state change (Handles both Supabase and Local fallback modes seamlessly)
    const unsubscribe = db.onAuthStateChange((currentUser) => {
      setUser(currentUser);
      setAuthLoading(false);
    });

    return () => {
      unsubscribe();
    };
  }, []);

  const handleSignOut = async () => {
    if (window.confirm('هل أنت متأكد من رغبتك في تسجيل الخروج؟')) {
      await db.signOut();
      if (typeof window !== 'undefined' && (window.location.pathname === '/admin/dashboard' || window.location.pathname.includes('admin'))) {
        window.history.replaceState(null, '', '/');
      }
    }
  };

  const getSubscriptionStatus = () => {
    if (!user || user.is_super_admin) return { status: 'active', days: 999, isExpired: false };
    
    const expiryDateStr = user.expiry_date;
    if (!expiryDateStr) {
      return { status: 'active', days: 90, isExpired: false }; // Safe default if not set
    }
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Parse YYYY-MM-DD
    const parts = expiryDateStr.split('-');
    let expiry: Date;
    if (parts.length === 3) {
      const year = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      const day = parseInt(parts[2], 10);
      expiry = new Date(year, month, day);
    } else {
      expiry = new Date(expiryDateStr);
    }
    expiry.setHours(0, 0, 0, 0);
    
    const diffTime = expiry.getTime() - today.getTime();
    const days = Math.round(diffTime / (1000 * 60 * 60 * 24));
    
    if (days < 0) {
      return { status: 'expired', days, isExpired: true };
    } else if (days <= 10) {
      return { status: 'warning', days, isExpired: false };
    } else {
      return { status: 'active', days, isExpired: false };
    }
  };

  const subStatus = getSubscriptionStatus();

  // If splash is running, display it
  if (showSplash) {
    return <SplashScreen onComplete={() => setShowSplash(false)} />;
  }

  // If checking authentication
  if (authLoading) {
    return (
      <div id="loading" className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-400 font-sans text-sm">
        <div className="text-center space-y-3">
          <span className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin block mx-auto" />
          <span>جاري مراجعة جلسة الدخول النشطة للشركة...</span>
        </div>
      </div>
    );
  }

  // If not logged in, show Auth Screen
  if (!user) {
    return <AuthUI onSuccess={(loggedInUser) => setUser(loggedInUser)} />;
  }

  // If logged in as Super Admin, show Super Admin Dashboard
  if (user.is_super_admin) {
    if (typeof window !== 'undefined' && window.location.pathname !== '/admin/dashboard' && !window.location.hash.includes('admin')) {
      window.history.replaceState(null, '', '/admin/dashboard');
    }
    return <SuperAdminDashboard user={user} onSignOut={handleSignOut} />;
  }

  // Subscription Box Variables
  const getSubscriptionVisuals = () => {
    switch (subStatus.status) {
      case 'warning':
        return {
          colors: 'bg-amber-500/10 border-amber-500/20 text-amber-400 animate-pulse shadow-lg shadow-amber-950/5',
          icon: AlertTriangle,
          label: `تنبيه: اشتراكك ينتهي قريباً - متبقي ${subStatus.days} يوم`
        };
      case 'expired':
        return {
          colors: 'bg-rose-500/10 border-rose-500/20 text-rose-400 shadow-lg shadow-rose-950/5',
          icon: ShieldAlert,
          label: 'عذراً، اشتراكك منتهي - يرجى التجديد'
        };
      case 'active':
      default:
        return {
          colors: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400 shadow-lg shadow-emerald-950/5',
          icon: Calendar,
          label: `الاشتراك نشط - متبقي ${subStatus.days} يوم`
        };
    }
  };

  const subVisuals = getSubscriptionVisuals();
  const IconComponent = subVisuals.icon;

  return (
    <div id="main-layout" className="h-full h-[100dvh] w-full bg-slate-950 text-slate-100 flex flex-col font-sans overflow-hidden selection:bg-emerald-500 selection:text-slate-950">
      
      {/* PWA App Install Banner */}
      <PWAInstallPrompt />

      {/* Top Professional Header (Operational Business View) */}
      <header className="bg-slate-900 border-b border-slate-800 shrink-0 px-3 sm:px-6 py-2.5 sm:py-3.5 print:hidden z-30">
        <div className="w-full max-w-7xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-2.5 sm:gap-4">
          
          {/* Brand/Tenant Identity */}
          <div className="flex items-center gap-2.5 sm:gap-3 order-last sm:order-first text-right w-full sm:w-auto justify-between sm:justify-start">
            <div className="flex items-center gap-2 sm:gap-3">
              <BrandLogo size="sm" animated={true} />
              <div className="h-7 w-[1px] bg-slate-800 hidden sm:block mx-1" />
              <div>
                <h1 className="text-xs sm:text-sm md:text-base font-extrabold text-slate-100 leading-tight">
                  {user.company_name || 'بوابة الحضور والمطابقة'}
                </h1>
                <p className="text-[10px] sm:text-xs text-slate-400 font-medium mt-0.5">
                  حساب المستأجر: <span className="font-semibold text-slate-300 font-sans">{user.email}</span>
                </p>
              </div>
            </div>
          </div>

          {/* Dynamic Subscription Expiry Box */}
          <div className={`w-full sm:w-auto px-3.5 sm:px-4 py-2 rounded-xl border flex items-center gap-2.5 text-right transition-all duration-300 max-w-full sm:max-w-sm ${subVisuals.colors}`}>
            <IconComponent className="w-4 h-4 sm:w-5 sm:h-5 shrink-0" />
            <div className="leading-tight flex-1">
              <span className="text-[10px] sm:text-xs block font-black">{subVisuals.label}</span>
              <span className="text-[9px] sm:text-[10px] block opacity-75 font-semibold mt-0.5">
                تاريخ انتهاء الاشتراك: <span className="font-mono font-bold">{user.expiry_date || 'غير محدد'}</span>
              </span>
            </div>
          </div>

          {/* Operations Controls & Logout */}
          <div className="flex items-center gap-2 self-end sm:self-auto">
            
            {/* Cloud Connected Badge */}
            <div className="px-2.5 sm:px-3 py-1.5 rounded-lg text-[10px] sm:text-xs font-bold flex items-center gap-1.5 border bg-emerald-500/10 border-emerald-500/30 text-emerald-400">
              <Database className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
              <span>البوابة السحابية الموحدة</span>
            </div>

            {/* Logout */}
            <button
              onClick={handleSignOut}
              className="p-2 bg-slate-950 border border-rose-950 hover:bg-rose-950/20 text-rose-400 rounded-lg transition cursor-pointer"
              title="تسجيل الخروج"
            >
              <LogOut className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
            </button>
          </div>
        </div>
      </header>

      {/* Navigation Tabs (Operational Views only) */}
      {!subStatus.isExpired && (
        <nav className="bg-slate-900/95 border-b border-slate-800 px-2 sm:px-4 py-2 print:hidden shrink-0 z-20 backdrop-blur-md shadow-sm">
          <div className="max-w-7xl mx-auto flex items-center justify-start md:justify-end gap-1.5 sm:gap-2 overflow-x-auto scrollbar-none no-scrollbar py-0.5 px-1 touch-pan-x scroll-smooth">
            
            <button
              onClick={() => setActiveTab('reports')}
              className={`px-3.5 sm:px-4 py-2 rounded-xl text-xs font-black transition-all duration-200 flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap flex-shrink-0 shrink-0 ${
                activeTab === 'reports'
                  ? 'bg-emerald-500 text-slate-950 shadow-lg shadow-emerald-500/20 ring-1 ring-emerald-400/50'
                  : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/60 bg-slate-950/40 border border-slate-800/60'
              }`}
            >
              <BarChart3 className={`w-3.5 h-3.5 shrink-0 transition-transform ${activeTab === 'reports' ? 'text-slate-950 scale-110' : 'text-emerald-400'}`} />
              <span>التقارير التراكمية</span>
            </button>

            <button
              onClick={() => setActiveTab('attendance')}
              className={`px-3.5 sm:px-4 py-2 rounded-xl text-xs font-black transition-all duration-200 flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap flex-shrink-0 shrink-0 ${
                activeTab === 'attendance'
                  ? 'bg-emerald-500 text-slate-950 shadow-lg shadow-emerald-500/20 ring-1 ring-emerald-400/50'
                  : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/60 bg-slate-950/40 border border-slate-800/60'
              }`}
            >
              <UserCheck className={`w-3.5 h-3.5 shrink-0 transition-transform ${activeTab === 'attendance' ? 'text-slate-950 scale-110' : 'text-emerald-400'}`} />
              <span>تحضير اليوميات</span>
            </button>

            <button
              onClick={() => setActiveTab('employees')}
              className={`px-3.5 sm:px-4 py-2 rounded-xl text-xs font-black transition-all duration-200 flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap flex-shrink-0 shrink-0 ${
                activeTab === 'employees'
                  ? 'bg-emerald-500 text-slate-950 shadow-lg shadow-emerald-500/20 ring-1 ring-emerald-400/50'
                  : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/60 bg-slate-950/40 border border-slate-800/60'
              }`}
            >
              <Users className={`w-3.5 h-3.5 shrink-0 transition-transform ${activeTab === 'employees' ? 'text-slate-950 scale-110' : 'text-emerald-400'}`} />
              <span>ملفات الموظفين</span>
            </button>

            <button
              onClick={() => setActiveTab('shifts')}
              className={`px-3.5 sm:px-4 py-2 rounded-xl text-xs font-black transition-all duration-200 flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap flex-shrink-0 shrink-0 ${
                activeTab === 'shifts'
                  ? 'bg-emerald-500 text-slate-950 shadow-lg shadow-emerald-500/20 ring-1 ring-emerald-400/50'
                  : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/60 bg-slate-950/40 border border-slate-800/60'
              }`}
            >
              <Clock className={`w-3.5 h-3.5 shrink-0 transition-transform ${activeTab === 'shifts' ? 'text-slate-950 scale-110' : 'text-emerald-400'}`} />
              <span>أوقات العمل والورديات</span>
            </button>

          </div>
        </nav>
      )}

      {/* Main Content Stage with scroll protection */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-3 sm:p-4 md:p-6 space-y-6 overflow-y-auto overflow-x-hidden scroll-smooth">
        {subStatus.isExpired ? (
          <div className="max-w-xl mx-auto py-12 px-6">
            <div className="bg-slate-900 border border-rose-500/20 rounded-2xl p-8 text-center space-y-6 shadow-xl shadow-rose-950/10">
              <div className="w-20 h-20 bg-rose-500/10 border border-rose-500/30 text-rose-400 rounded-full flex items-center justify-center mx-auto text-3xl font-bold animate-bounce">
                🛇
              </div>
              <div className="space-y-3">
                <h3 className="text-2xl font-black text-rose-400">عذراً، اشتراكك منتهي!</h3>
                <p className="text-sm text-slate-400 leading-relaxed">
                  لقد انتهت فترة الاشتراك الخاصة بمؤسستكم في نظام "بصمة تك". يرجى تجديد الاشتراك للاستمرار في استخدام المنظومة ومتابعة حضور وانصراف الموظفين والتقارير.
                </p>
              </div>

              <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl text-right text-xs text-slate-400 leading-relaxed space-y-2">
                <p>• تفاصيل الحساب: <span className="font-bold text-slate-300">{user.company_name}</span></p>
                <p>• تاريخ انتهاء الاشتراك السابق: <span className="font-mono font-bold text-rose-400">{user.expiry_date || 'غير محدد'}</span></p>
                <p>• حالة البيانات: <span className="text-emerald-400 font-bold">محفوظة بالكامل وآمنة</span>، وسيتم تفعيل النظام فوراً بعد السداد والاشتراك.</p>
              </div>

              <div className="pt-4">
                <a
                  href={`https://wa.me/966557538856?text=${encodeURIComponent('مرحباً، انتهى اشتراك شركة ' + user.company_name + ' بريد: ' + user.email + ' ونود التجديد.')}`}
                  target="_blank"
                  referrerPolicy="no-referrer"
                  rel="noopener noreferrer"
                  className="w-full py-4 bg-rose-500 hover:bg-rose-400 text-slate-950 font-black rounded-xl text-sm flex items-center justify-center gap-2 transition duration-200 shadow-lg shadow-rose-500/10 cursor-pointer"
                >
                  <MessageSquare className="w-5 h-5" />
                  <span>تواصل لتجديد الاشتراك (واتساب)</span>
                  <ExternalLink className="w-4 h-4" />
                </a>
              </div>
            </div>
          </div>
        ) : (
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              {activeTab === 'attendance' && <AttendanceRegister />}
              {activeTab === 'reports' && <ReportingEngine />}
              {activeTab === 'employees' && <EmployeeManager />}
              {activeTab === 'shifts' && <ShiftManager />}
            </motion.div>
          </AnimatePresence>
        )}
      </main>

      {/* Footer copyright */}
      <footer className="py-4 sm:py-5 border-t border-slate-900 text-center text-[10px] text-slate-600 font-medium font-sans shrink-0 print:hidden">
        <span>جميع الحقوق محفوظة لمستأجر البوابة © 2026 بصمة تك • تصميم مؤسسي معزول بالكامل بقوانين الحماية السحابية</span>
      </footer>
    </div>
  );
}
