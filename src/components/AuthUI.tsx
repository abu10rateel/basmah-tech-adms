/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { db } from '../supabaseClient';
import { 
  KeyRound, 
  Mail, 
  Building, 
  AlertCircle, 
  LogIn, 
  UserPlus, 
  Info, 
  ShieldCheck, 
  Check, 
  User, 
  Phone, 
  MessageSquare, 
  ExternalLink,
  Fingerprint,
  CheckCircle2,
  Sparkles
} from 'lucide-react';
import BrandLogo from './BrandLogo';
import BiometricKioskShowcase from './BiometricKioskShowcase';

interface AuthUIProps {
  onSuccess: (user: any) => void;
}

export default function AuthUI({ onSuccess }: AuthUIProps) {
  const [isRegistering, setIsRegistering] = useState(false);
  
  // Registration Form State
  const [companyName, setCompanyName] = useState('');
  const [address, setAddress] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [employeePackage, setEmployeePackage] = useState('الباقة الأساسية حتى 20 موظف - تجريبية مجانية');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPendingScreen, setShowPendingScreen] = useState(false);
  const [showSuspendedScreen, setShowSuspendedScreen] = useState(false);
  const [showExpiredScreen, setShowExpiredScreen] = useState(false);
  const [registrationSuccess, setRegistrationSuccess] = useState(false);
  const [loginSuccessUser, setLoginSuccessUser] = useState<any | null>(null);
  const [kioskStatus, setKioskStatus] = useState<'idle' | 'verifying' | 'success' | 'error'>('idle');
  
  // Forgot Password State
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetSuccess, setResetSuccess] = useState(false);

  // Token Password Reset Flow State
  const [resetToken, setResetToken] = useState<string | null>(null);
  const [isVerifyingToken, setIsVerifyingToken] = useState(false);
  const [tokenValid, setTokenValid] = useState<boolean | null>(null);
  const [tokenErrorMsg, setTokenErrorMsg] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [resetCompleted, setResetCompleted] = useState(false);

  React.useEffect(() => {
    const checkTokenFromUrl = async () => {
      let token: string | null = null;
      const urlParams = new URLSearchParams(window.location.search);
      token = urlParams.get('token') || urlParams.get('reset_token');

      if (!token && window.location.hash) {
        const hash = window.location.hash;
        const paramPart = hash.includes('?') ? hash.split('?')[1] : hash.replace(/^#\/?/, '');
        const hashParams = new URLSearchParams(paramPart);
        token = hashParams.get('token') || hashParams.get('reset_token');
      }

      if (token) {
        setResetToken(token);
        setIsVerifyingToken(true);
        setError(null);
        try {
          const res = await db.verifyResetToken(token);
          if (res.valid) {
            setTokenValid(true);
            setResetEmail(res.email || '');
          } else {
            setTokenValid(false);
            setTokenErrorMsg(res.message || 'رابط إعادة التعيين غير صالح أو انتهت صلاحيته (15 دقيقة). يرجى طلب رابط جديد.');
          }
        } catch (err: any) {
          setTokenValid(false);
          setTokenErrorMsg('حدث خطأ أثناء التحقق من الرابط.');
        } finally {
          setIsVerifyingToken(false);
        }
      }
    };

    checkTokenFromUrl();
  }, []);

  const handleExecutePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!newPassword || !confirmPassword) {
      setError('يرجى إدخال كلمة المرور وتأكيدها.');
      return;
    }

    if (newPassword.length < 6) {
      setError('كلمة المرور يجب أن تتكون من 6 خانات على الأقل.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('كلمتا المرور غير متطابقتين.');
      return;
    }

    if (!resetToken) {
      setError('رمز التوثيق مفقود.');
      return;
    }

    setLoading(true);

    try {
      const res = await db.executePasswordReset(resetToken, newPassword);
      if (res.success) {
        setResetCompleted(true);
        if (window.history.pushState) {
          window.history.pushState(null, '', window.location.pathname);
        }
      } else {
        setError(res.error?.message || 'فشل تحديث كلمة المرور.');
      }
    } catch (err: any) {
      setError(err.message || 'حدث خطأ غير متوقع أثناء حفظ كلمة المرور.');
    } finally {
      setLoading(false);
    }
  };

  const whatsappUrl = `https://wa.me/966557538856?text=${encodeURIComponent('مرحباً، لقد سجلت في منصة بصمة تك وأرغب بتفعيل اشتراكي.')}`;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (isRegistering) {
      // Tenant Registration flow
      if (!companyName || !address || !email || !phone || !password || !employeePackage) {
        setError('يرجى ملء كافة الحقول المطلوبة لتقديم طلب الاشتراك.');
        return;
      }

      // Phone format validation (05xxxxxxxx or 9665xxxxxxxx)
      const cleanPhone = phone.trim();
      const phoneRegex = /^(05|9665)\d{8}$/;
      if (!phoneRegex.test(cleanPhone)) {
        setError('يرجى إدخال رقم جوال سعودي صحيح يبدأ بـ 05 أو 9665 ويتكون من الأرقام المناسبة (مثال: 0557538856).');
        return;
      }

      setLoading(true);

      try {
        const res = await db.registerTenant({
          company_name: companyName,
          manager_name: companyName, // fall back to company_name
          email,
          phone: cleanPhone,
          password,
          address,
          employee_package: employeePackage
        });

        if (res.error) {
          setError(res.error.message || 'فشل تقديم طلب التسجيل.');
        } else {
          setRegistrationSuccess(true);
          // Redirect immediately to WhatsApp
          window.location.href = whatsappUrl;
        }
      } catch (err: any) {
        setError(err.message || 'حدث خطأ في الاتصال بالخادم.');
      } finally {
        setLoading(false);
      }
    } else {
      // Login flow (Normal Tenant OR Super Admin)
      if (!email || !password) {
        setError('يرجى إدخال البريد الإلكتروني وكلمة المرور.');
        setKioskStatus('error');
        return;
      }

      setLoading(true);
      setKioskStatus('verifying');
      setError(null);

      try {
        // Step 1: Call API with skipNotify to prevent immediate App.tsx state change
        const { data, error: err } = await db.signIn(email, password, { skipNotify: true });
        
        if (err) {
          setKioskStatus('error');
          setLoading(false);
          if (err.is_pending) {
            // Account is pending, show custom pending screen!
            setShowPendingScreen(true);
          } else if (err.is_suspended) {
            // Account is suspended, show custom suspended screen!
            setShowSuspendedScreen(true);
          } else if (err.is_expired) {
            // Account is expired, show custom expired screen!
            setShowExpiredScreen(true);
          } else {
            setError(err.message || 'فشل تسجيل الدخول. يرجى التحقق من صحة البيانات.');
          }
        } else if (data?.user) {
          // Step 2: Set success state for kiosk animation & full overlay
          setKioskStatus('success');
          setLoginSuccessUser(data.user);

          // Step 3: Wait exactly 5 seconds (5000ms) with Promise so animation plays completely
          await new Promise((resolve) => setTimeout(resolve, 5000));

          // Step 4: Commit session and redirect user to dashboard
          const userData = { ...data.user, password };
          db.commitAuthSession(userData);
          onSuccess(userData);
        } else {
          setKioskStatus('error');
          setError('فشل تسجيل الدخول. يرجى التحقق من بيانات الاعتماد.');
          setLoading(false);
        }
      } catch (err: any) {
        setKioskStatus('error');
        setError(err.message || 'حدث خطأ غير متوقع.');
        setLoading(false);
      }
    }
  };

  const handleRequestReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!resetEmail) {
      setError('يرجى إدخال البريد الإلكتروني للشركة.');
      return;
    }
    setLoading(true);
    try {
      const res = await db.requestPasswordReset(resetEmail);
      if (res.success) {
        setResetSuccess(true);
      } else {
        setError(res.error?.message || 'فشل إرسال طلب استعادة كلمة المرور.');
      }
    } catch (err: any) {
      setError(err.message || 'حدث خطأ في الاتصال بالخادم.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div id="auth-ui" className="min-h-screen w-full bg-slate-950 flex flex-col items-center justify-center p-4 lg:p-8 relative overflow-y-auto pt-24 sm:pt-28 pb-16">
      {/* Dynamic Background Design */}
      <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-emerald-500/20 to-transparent" />
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-teal-500/5 rounded-full blur-3xl pointer-events-none" />

      {/* Top Branded Header (Visible from Outside/Before Login) */}
      <header className="absolute top-0 left-0 right-0 p-4 sm:p-6 z-20 border-b border-slate-900/40 bg-slate-950/60 backdrop-blur-md">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          {/* Logo and App Title */}
          <div className="flex items-center gap-2">
            <BrandLogo size="sm" animated={true} />
          </div>

          {/* Connection status */}
          <div className="flex items-center gap-2 bg-slate-900/60 border border-slate-800 px-3 py-1.5 rounded-full text-[10px] text-slate-400 font-medium">
            <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
            <span className="font-sans">البوابة السحابية الموحدة v3.0 • نشط وآمن</span>
          </div>
        </div>
      </header>

      {/* Main Container - Dual-Panel Design */}
      <div className="w-full max-w-6xl grid grid-cols-1 lg:grid-cols-12 gap-8 items-center z-10 mt-2">
        
        {/* Left Panel: Beautiful Interactive Visual Showcase (Hidden on Mobile) */}
        <motion.div 
          initial={{ opacity: 0, x: -30 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
          className="hidden lg:flex lg:col-span-6 flex-col justify-center space-y-6 text-right pr-6"
        >
          <div className="inline-flex items-center gap-2 self-start bg-emerald-500/10 border border-emerald-500/20 px-3 py-1.5 rounded-full text-[11px] font-bold text-emerald-400">
            <ShieldCheck className="w-4 h-4" />
            <span>نظام معتمد لإدارة الحضور والمطابقة البيومترية السحابية</span>
          </div>

          <h2 className="text-3xl xl:text-4xl font-black text-slate-100 leading-snug">
            المنصة الذكية لمطابقة <br/>
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-teal-300">بصمات الموظفين والشيفتات</span>
          </h2>

          <p className="text-slate-400 text-sm leading-relaxed max-w-lg font-sans">
            يوفر نظام <span className="text-emerald-400 font-bold">بصمة تك</span> حلاً سحابياً متكاملاً للمؤسسات لمراقبة الحضور والانصراف، وجدولة الورديات المعقدة، ورفع تقارير الأداء الفورية بدقة لا متناهية.
          </p>

          {/* Interactive Feature Cards */}
          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 bg-slate-900/60 border border-slate-800 rounded-xl space-y-2">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-400 font-bold text-xs">01</div>
              <h3 className="text-xs font-bold text-slate-200">تشفير بيومترات ثنائي</h3>
              <p className="text-[10px] text-slate-500 leading-normal">تشفير وتخزين بصمات الأصابع السحابي لضمان حماية هوية الموظف بالكامل.</p>
            </div>

            <div className="p-4 bg-slate-900/60 border border-slate-800 rounded-xl space-y-2">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-400 font-bold text-xs">02</div>
              <h3 className="text-xs font-bold text-slate-200">مزامنة سحابية مرنة</h3>
              <p className="text-[10px] text-slate-500 leading-normal">تحديث تلقائي فوري وسلس يدعم العمل في أصعب ظروف الشبكات والاتصال.</p>
            </div>

            <div className="p-4 bg-slate-900/60 border border-slate-800 rounded-xl space-y-2">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-400 font-bold text-xs">03</div>
              <h3 className="text-xs font-bold text-slate-200">الشيفتات والورديات</h3>
              <p className="text-[10px] text-slate-500 leading-normal">توزيع وتخصيص ساعات العمل مع احتساب تلقائي للمطابقة وساعات التأخر.</p>
            </div>

            <div className="p-4 bg-slate-900/60 border border-slate-800 rounded-xl space-y-2">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-400 font-bold text-xs">04</div>
              <h3 className="text-xs font-bold text-slate-200">لوحة تقارير تفاعلية</h3>
              <p className="text-[10px] text-slate-500 leading-normal">تصدير فوري لكشوف الغيابات واليوميات بملفات مهيأة للطباعة والمشاركة.</p>
            </div>
          </div>

          <div className="flex items-center gap-3 text-slate-500 text-xs">
            <span className="flex items-center gap-1">
              <Check className="w-3.5 h-3.5 text-emerald-500" /> خادم معزول لكل مستأجر
            </span>
            <span className="w-1 h-1 bg-slate-800 rounded-full" />
            <span className="flex items-center gap-1">
              <Check className="w-3.5 h-3.5 text-emerald-500" /> نسخ احتياطي ذكي
            </span>
          </div>
        </motion.div>

        {/* Right Panel: Polished Dual-Role Login/Register Card */}
        <div className="lg:col-span-6 flex justify-center w-full">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden p-6 sm:p-8"
          >
            {/* ----------------- SUCCESS REGISTRATION SCREEN ----------------- */}
            {registrationSuccess ? (
              <div className="text-center space-y-5 py-6">
                <div className="w-16 h-16 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded-full flex items-center justify-center mx-auto text-2xl font-black">
                  ✓
                </div>
                <div className="space-y-2">
                  <h3 className="text-lg font-black text-slate-200">تم تسجيل طلبك بنجاح!</h3>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    شكراً لتسجيلك في منصة <span className="text-emerald-400 font-bold">بصمة تك</span> السحابية. تم إرسال معلوماتك للإدارة بنجاح وهي قيد المراجعة الفورية لتنشيط حسابك.
                  </p>
                </div>

                <div className="bg-slate-950 p-4 rounded-xl text-right text-xs space-y-1.5 border border-slate-800">
                  <div className="text-slate-400">الشركة: <span className="text-slate-200 font-bold">{companyName}</span></div>
                  <div className="text-slate-400">البريد الإلكتروني: <span className="text-slate-200 font-mono font-bold">{email}</span></div>
                  <div className="text-slate-400">رقم الجوال: <span className="text-slate-200 font-mono">{phone}</span></div>
                </div>

                <div className="pt-2">
                  <a
                    href={whatsappUrl}
                    target="_blank"
                    referrerPolicy="no-referrer"
                    rel="noopener noreferrer"
                    className="w-full py-3 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black rounded-xl text-xs flex items-center justify-center gap-2 transition duration-200 shadow-lg shadow-emerald-500/10"
                  >
                    <MessageSquare className="w-4 h-4" />
                    <span>تفعيل الاشتراك السريع عبر الواتساب</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setRegistrationSuccess(false);
                    setIsRegistering(false);
                    setCompanyName('');
                    setPhone('');
                    setEmail('');
                    setPassword('');
                  }}
                  className="text-xs text-slate-500 hover:text-slate-300 transition"
                >
                  العودة لشاشة الدخول
                </button>
              </div>
            ) : showPendingScreen ? (
              /* ----------------- PENDING ACCOUNT SCREEN ----------------- */
              <div className="text-center space-y-5 py-6">
                <div className="w-16 h-16 bg-amber-500/10 border border-amber-500/30 text-amber-400 rounded-full flex items-center justify-center mx-auto text-xl font-bold animate-pulse">
                  ⚠
                </div>
                <div className="space-y-2">
                  <h3 className="text-lg font-black text-slate-200">الحساب بانتظار التنشيط</h3>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    عذراً، طلب الاشتراك الخاص بشركتك تم تسجيله ولكنه حالياً <span className="text-amber-400 font-bold">بانتظار مراجعة وتفعيل المشرف العام</span>.
                  </p>
                </div>

                <div className="p-3 bg-slate-950 border border-slate-800 rounded-lg text-right text-[11px] text-slate-400 leading-relaxed">
                  بمجرد أن يقوم المشرف العام بتنشيط وتحديد باقة الاشتراك والمدينة الخاصة بكم، ستتمكن من تسجيل الدخول مباشرة بكامل الصلاحيات.
                </div>

                <div className="pt-2">
                  <a
                    href={whatsappUrl}
                    target="_blank"
                    referrerPolicy="no-referrer"
                    rel="noopener noreferrer"
                    className="w-full py-3 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black rounded-xl text-xs flex items-center justify-center gap-2 transition duration-200 shadow-lg shadow-emerald-500/10"
                  >
                    <MessageSquare className="w-4 h-4" />
                    <span>تواصل مع الإدارة للتفعيل الآن</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>

                <button
                  type="button"
                  onClick={() => setShowPendingScreen(false)}
                  className="text-xs text-slate-500 hover:text-slate-300 transition"
                >
                  العودة للمحاولة مجدداً
                </button>
              </div>
            ) : showSuspendedScreen ? (
              /* ----------------- SUSPENDED ACCOUNT SCREEN ----------------- */
              <div className="text-center space-y-5 py-6">
                <div className="w-16 h-16 bg-rose-500/10 border border-rose-500/30 text-rose-400 rounded-full flex items-center justify-center mx-auto text-xl font-bold">
                  🛇
                </div>
                <div className="space-y-2">
                  <h3 className="text-lg font-black text-rose-400">تم إيقاف حسابك مؤقتاً</h3>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    تم إيقاف حسابك من قبل الإدارة، يرجى التواصل مع الدعم الفني لحل المشكلة وإعادة تنشيط الخدمة.
                  </p>
                </div>

                <div className="p-3 bg-slate-950 border border-slate-800 rounded-lg text-right text-[11px] text-slate-400 leading-relaxed">
                  الحساب حالياً في حالة "موقوف". جميع بيانات الحضور والموظفين والشيفتات آمنة ومحفوظة تماماً، ولكن الوصول معطل حتى زوال سبب التعليق من قبل الإدارة.
                </div>

                <div className="pt-2">
                  <a
                    href="https://wa.me/966557538856?text=%D9%85%D8%B1%D8%AD%D8%A8%D8%A7%D9%80%D8%8C%20%D8%AA%D9%85%20%D8%A5%D9%8A%D9%82%D8%A7%D9%81%20%D8%AD%D8%B3%D8%A7%D8%A8%D9%82%D9%85%20%D9%81%D9%82%D8%AF%20%D8%AA%D9%85%20%D8%AA%D8%B9%D9%84%D9%8A%D9%82%D9%87%20%D9%88%D9%86%D8%B1%D8%AC%D9%88%20%D8%A7%D9%84%D8%AA%D9%88%D8%A7%D8%B5%D9%84%20%D9%84%D9%84%D8%AA%D9%81%D8%B9%D9%8A%D9%84"
                    target="_blank"
                    referrerPolicy="no-referrer"
                    rel="noopener noreferrer"
                    className="w-full py-3 bg-rose-500 hover:bg-rose-400 text-slate-950 font-black rounded-xl text-xs flex items-center justify-center gap-2 transition duration-200 shadow-lg shadow-rose-500/10"
                  >
                    <MessageSquare className="w-4 h-4" />
                    <span>تواصل مع الدعم الفني (واتساب)</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>

                <button
                  type="button"
                  onClick={() => setShowSuspendedScreen(false)}
                  className="text-xs text-slate-500 hover:text-slate-300 transition"
                >
                  العودة لشاشة الدخول
                </button>
              </div>
            ) : showExpiredScreen ? (
              /* ----------------- EXPIRED SUBSCRIPTION SCREEN ----------------- */
              <div className="text-center space-y-5 py-6">
                <div className="w-16 h-16 bg-rose-500/10 border border-rose-500/30 text-rose-400 rounded-full flex items-center justify-center mx-auto text-xl font-bold animate-pulse">
                  ⚠
                </div>
                <div className="space-y-2">
                  <h3 className="text-lg font-black text-rose-400">عذراً، انتهى اشتراكك!</h3>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    تم انتهاء الاشتراك، يرجى التواصل مع الدعم الفني للتجديد واستعادة الوصول للنظام.
                  </p>
                </div>

                <div className="p-3 bg-slate-950 border border-slate-800 rounded-lg text-right text-[11px] text-slate-400 leading-relaxed">
                  البيانات والموظفون مسجلون ومحفوظون بشكل كامل وبأمان تام، ولكن لا يمكن استخدام لوحة التحكم في الوقت الحالي إلا بعد التجديد.
                </div>

                <div className="pt-2">
                  <a
                    href="https://wa.me/966557538856?text=%D9%85%D8%B1%D8%AD%D8%A8%D8%A7%D9%80%D8%8C%20%D8%A7%D9%86%D8%AA%D9%87%D9%89%20%D8%A7%D8%B4%D8%AA%D8%B1%D8%A7%D9%83%D9%86%D8%A7%20%D9%81%D9%82%D8%AF%20%D8%AA%D9%85%20%D8%A5%D9%8A%D9%82%D8%A7%D9%81%20%D8%A7%D9%84%D9%86%D8%B8%D8%A7%D9%85%20%D9%88%D9%86%D8%B1%D8%AC%D9%88%20%D8%A7%D9%84%D8%AA%D9%88%D8%A7%D8%B5%D9%84%20%D9%84%D9%84%D8%AA%D8%AC%D8%AF%D9%8A%D8%AF"
                    target="_blank"
                    referrerPolicy="no-referrer"
                    rel="noopener noreferrer"
                    className="w-full py-3 bg-rose-500 hover:bg-rose-400 text-slate-950 font-black rounded-xl text-xs flex items-center justify-center gap-2 transition duration-200 shadow-lg shadow-rose-500/10 cursor-pointer"
                  >
                    <MessageSquare className="w-4 h-4" />
                    <span>تواصل لتجديد الاشتراك (واتساب)</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>

                <button
                  type="button"
                  onClick={() => setShowExpiredScreen(false)}
                  className="text-xs text-slate-500 hover:text-slate-300 transition"
                >
                  العودة لشاشة الدخول
                </button>
              </div>
            ) : resetToken ? (
              /* ----------------- TOKEN PASSWORD RESET SCREEN ----------------- */
              <div className="space-y-5 text-right py-2">
                <div className="text-center mb-5">
                  <div className="flex flex-col items-center justify-center mb-3">
                    <BrandLogo size="lg" animated={true} />
                  </div>
                  <h2 className="text-lg font-extrabold text-slate-200 mt-2">
                    تعيين كلمة المرور الجديدة
                  </h2>
                  <p className="text-slate-400 text-xs mt-1 font-sans leading-relaxed">
                    أدخل كلمة المرور الجديدة لحساب الشركة لإتمام عملية التحديث وتسجيل الدخول.
                  </p>
                </div>

                {isVerifyingToken ? (
                  <div className="py-8 text-center space-y-3">
                    <span className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin block mx-auto" />
                    <p className="text-xs text-slate-400">جاري التحقق من صلاحية رابط استعادة كلمة المرور...</p>
                  </div>
                ) : tokenValid === false ? (
                  <div className="space-y-4 text-center py-2">
                    <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs space-y-2 text-right">
                      <div className="flex items-center gap-2 font-bold text-rose-400">
                        <AlertCircle className="w-4 h-4 shrink-0" />
                        <span>رابط غير صالح أو منتهي الصلاحية</span>
                      </div>
                      <p className="leading-relaxed text-slate-300">
                        {tokenErrorMsg || 'انتهت صلاحية هذا الرابط (15 دقيقة) أو تم استخدامه من قبل. يرجى طلب رابط جديد.'}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setResetToken(null);
                        setShowForgotPassword(true);
                        setTokenValid(null);
                        setError(null);
                      }}
                      className="w-full py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black rounded-lg text-xs transition duration-200 cursor-pointer shadow-lg shadow-emerald-500/10"
                    >
                      طلب رابط استعادة جديد
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setResetToken(null);
                        setShowForgotPassword(false);
                        setTokenValid(null);
                        setError(null);
                      }}
                      className="text-xs text-slate-400 hover:text-slate-300 transition underline cursor-pointer bg-transparent border-none"
                    >
                      العودة لشاشة الدخول الرئيسية
                    </button>
                  </div>
                ) : resetCompleted ? (
                  <div className="space-y-4 text-center py-4">
                    <div className="w-12 h-12 rounded-full bg-emerald-500/10 text-emerald-400 flex items-center justify-center mx-auto text-lg border border-emerald-500/30">
                      <Check className="w-6 h-6 text-emerald-400" />
                    </div>
                    <div className="space-y-2">
                      <h4 className="text-sm font-bold text-emerald-400">تم تغيير كلمة المرور بنجاح!</h4>
                      <p className="text-xs text-slate-300 leading-relaxed px-2">
                        تم تحديث كلمة المرور الخاصة بحسابك بنجاح. يمكنك الآن تسجيل الدخول مباشرة باستخدام كلمة المرور الجديدة.
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setResetToken(null);
                        setResetCompleted(false);
                        setShowForgotPassword(false);
                        setError(null);
                      }}
                      className="w-full py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black rounded-lg text-xs transition duration-200 mt-2 cursor-pointer shadow-lg shadow-emerald-500/10"
                    >
                      الانتقال لتسجيل الدخول
                    </button>
                  </div>
                ) : (
                  <form onSubmit={handleExecutePasswordReset} className="space-y-4 text-right">
                    {error && (
                      <motion.div
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex gap-2 items-center justify-start text-right"
                      >
                        <AlertCircle className="w-4 h-4 shrink-0" />
                        <span>{error}</span>
                      </motion.div>
                    )}

                    {resetEmail && (
                      <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-400 text-xs flex items-center justify-between">
                        <span className="text-emerald-400 font-mono font-bold">{resetEmail}</span>
                        <span className="text-slate-500">حساب الشركة:</span>
                      </div>
                    )}

                    {/* New Password Input */}
                    <div className="space-y-1">
                      <label className="block text-xs font-semibold text-slate-300">كلمة المرور الجديدة</label>
                      <div className="relative">
                        <input
                          type="password"
                          required
                          minLength={6}
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          placeholder="••••••••"
                          className="w-full pl-3 pr-10 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 placeholder-slate-600 focus:outline-none focus:border-emerald-500 text-xs text-right font-sans"
                        />
                        <KeyRound className="absolute top-1/2 right-3 -translate-y-1/2 w-4 h-4 text-slate-500" />
                      </div>
                    </div>

                    {/* Confirm Password Input */}
                    <div className="space-y-1">
                      <label className="block text-xs font-semibold text-slate-300">تأكيد كلمة المرور الجديدة</label>
                      <div className="relative">
                        <input
                          type="password"
                          required
                          minLength={6}
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          placeholder="••••••••"
                          className="w-full pl-3 pr-10 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 placeholder-slate-600 focus:outline-none focus:border-emerald-500 text-xs text-right font-sans"
                        />
                        <KeyRound className="absolute top-1/2 right-3 -translate-y-1/2 w-4 h-4 text-slate-500" />
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={loading}
                      className="w-full py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black rounded-lg text-xs flex items-center justify-center gap-2 transition duration-200 mt-2 cursor-pointer disabled:opacity-50 shadow-lg shadow-emerald-500/10"
                    >
                      {loading ? (
                        <span className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <span>حفظ كلمة المرور الجديدة</span>
                      )}
                    </button>
                  </form>
                )}
              </div>
            ) : showForgotPassword ? (
              /* ----------------- FORGOT PASSWORD SCREEN ----------------- */
              <div className="space-y-5 text-right py-2">
                <div className="text-center mb-5">
                  <div className="flex flex-col items-center justify-center mb-3">
                    <BrandLogo size="lg" animated={true} />
                  </div>
                  <h2 className="text-lg font-extrabold text-slate-200 mt-2">
                    طلب استعادة كلمة المرور
                  </h2>
                  <p className="text-slate-400 text-xs mt-1 font-sans leading-relaxed">
                    أدخل بريدك الإلكتروني وسيتم إرسال رابط آمن ومباشر لإعادة تعيين كلمة المرور فوراً عبر البريد الإلكتروني.
                  </p>
                </div>

                {error && (
                  <motion.div
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex gap-2 items-center justify-start text-right"
                  >
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{error}</span>
                  </motion.div>
                )}

                {resetSuccess ? (
                  <div className="space-y-4 text-center py-3">
                    <div className="w-12 h-12 rounded-full bg-emerald-500/10 text-emerald-400 flex items-center justify-center mx-auto text-lg border border-emerald-500/30">
                      <Check className="w-6 h-6 text-emerald-400" />
                    </div>
                    <div className="space-y-2">
                      <h4 className="text-sm font-bold text-emerald-400">تم إرسال الطلب بنجاح</h4>
                      <p className="text-xs text-emerald-200/90 leading-relaxed px-3 py-3 bg-emerald-950/50 border border-emerald-500/30 rounded-xl text-right font-medium">
                        إذا كان البريد الإلكتروني مسجلاً بالنظام، فقد تم إرسال رابط إعادة تعيين كلمة المرور إلى صندوق الوارد الخاص بك. يرجى تفقد بريدك الإلكتروني.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setShowForgotPassword(false);
                        setResetSuccess(false);
                        setError(null);
                      }}
                      className="text-xs text-emerald-400 hover:text-emerald-300 underline font-bold mt-2 cursor-pointer bg-transparent border-none"
                    >
                      العودة لصفحة تسجيل الدخول
                    </button>
                  </div>
                ) : (
                  <form onSubmit={handleRequestReset} className="space-y-4 text-right">
                    {/* Reset Email */}
                    <div className="space-y-1">
                      <label className="block text-xs font-semibold text-slate-300">البريد الإلكتروني للشركة</label>
                      <div className="relative">
                        <input
                          type="email"
                          required
                          value={resetEmail}
                          onChange={(e) => setResetEmail(e.target.value)}
                          placeholder="manager@company.com"
                          className="w-full pl-3 pr-10 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 placeholder-slate-600 focus:outline-none focus:border-emerald-500 text-xs text-right font-sans"
                        />
                        <Mail className="absolute top-1/2 right-3 -translate-y-1/2 w-4 h-4 text-slate-500" />
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={loading}
                      className="w-full py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black rounded-lg text-xs flex items-center justify-center gap-2 transition duration-200 mt-2 cursor-pointer disabled:opacity-50 shadow-lg shadow-emerald-500/10"
                    >
                      {loading ? (
                        <span className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <span>إرسال رابط إعادة التعيين</span>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setShowForgotPassword(false);
                        setError(null);
                      }}
                      className="w-full py-2 text-xs text-slate-400 hover:text-slate-300 transition text-center cursor-pointer bg-transparent border-none"
                    >
                      إلغاء والعودة للدخول
                    </button>
                  </form>
                )}
              </div>
            ) : (
              /* ----------------- STANDARD LOGIN / REGISTER FORM ----------------- */
              <>
                <div className="text-center mb-5">
                  <BiometricKioskShowcase status={kioskStatus} />
                  <div className="flex flex-col items-center justify-center mb-4 mt-2">
                    <BrandLogo size="md" animated={true} />
                  </div>
                  <h2 className="text-lg font-extrabold text-slate-200 mt-2">
                    {isRegistering 
                      ? 'تسجيل مستأجر جديد بالنظام' 
                      : 'بوابة تسجيل الدخول للنظام'
                    }
                  </h2>
                  <p className="text-slate-400 text-xs mt-1 font-sans">
                    {isRegistering 
                      ? 'أنشئ حساب مستأجر جديد معزول ومحمي بالكامل' 
                      : 'أدخل بيانات الاعتماد لإدارة شيفتات وحضور موظفيك بسلاسة'
                    }
                  </p>
                </div>

                {/* Error Block */}
                {error && (
                  <motion.div
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="mb-5 p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex gap-2 items-center text-right justify-start"
                  >
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{error}</span>
                  </motion.div>
                )}

                <form onSubmit={handleSubmit} className="space-y-3.5 text-right">
                  
                  {/* 1. Company Name (For registration) */}
                  {isRegistering && (
                    <div className="space-y-1">
                      <label className="block text-xs font-semibold text-slate-300">اسم المنشأة / الشركة (اسم شركتك الرسمي)</label>
                      <div className="relative">
                        <input
                          type="text"
                          required
                          value={companyName}
                          onChange={(e) => setCompanyName(e.target.value)}
                          placeholder="مثال: شركة الخليج للحلول الرقمية"
                          className="w-full pl-3 pr-10 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 placeholder-slate-600 focus:outline-none focus:border-emerald-500 text-xs text-right animate-none"
                        />
                        <Building className="absolute top-1/2 right-3 -translate-y-1/2 w-4 h-4 text-slate-500" />
                      </div>
                    </div>
                  )}

                  {/* 2. Address (For registration) */}
                  {isRegistering && (
                    <div className="space-y-1">
                      <label className="block text-xs font-semibold text-slate-300">عنوان أو المقر الرئيسي</label>
                      <div className="relative">
                        <input
                          type="text"
                          required
                          value={address}
                          onChange={(e) => setAddress(e.target.value)}
                          placeholder="مثال: برج الفيصلية، طريق الملك فهد، الرياض"
                          className="w-full pl-3 pr-10 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 placeholder-slate-600 focus:outline-none focus:border-emerald-500 text-xs text-right"
                        />
                        <Building className="absolute top-1/2 right-3 -translate-y-1/2 w-4 h-4 text-slate-500" />
                      </div>
                    </div>
                  )}

                  {/* 3. Email (For login/registration) */}
                  <div className="space-y-1">
                    <label className="block text-xs font-semibold text-slate-300">
                      {isRegistering ? 'البريد الإلكتروني للشركة' : 'البريد الإلكتروني'}
                    </label>
                    <div className="relative">
                      <input
                        type="email"
                        required
                        value={email}
                        onChange={(e) => {
                          setEmail(e.target.value);
                          if (kioskStatus !== 'idle' && kioskStatus !== 'verifying') setKioskStatus('idle');
                          if (error) setError(null);
                        }}
                        placeholder="manager@company.com"
                        className="w-full pl-3 pr-10 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 placeholder-slate-600 focus:outline-none focus:border-emerald-500 text-xs text-right font-sans"
                      />
                      <Mail className="absolute top-1/2 right-3 -translate-y-1/2 w-4 h-4 text-slate-500" />
                    </div>
                  </div>

                  {/* 4. Phone (For registration) */}
                  {isRegistering && (
                    <div className="space-y-1">
                      <label className="block text-xs font-semibold text-slate-300">رقم الجوال للتواصل (05xxxxxxxx)</label>
                      <div className="relative">
                        <input
                          type="text"
                          required
                          value={phone}
                          onChange={(e) => setPhone(e.target.value)}
                          placeholder="مثال: 0557538856"
                          className="w-full pl-3 pr-10 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 placeholder-slate-600 focus:outline-none focus:border-emerald-500 text-xs text-right font-sans"
                        />
                        <Phone className="absolute top-1/2 right-3 -translate-y-1/2 w-4 h-4 text-slate-500" />
                      </div>
                    </div>
                  )}

                  {/* 5. Password */}
                  <div className="space-y-1">
                    <label className="block text-xs font-semibold text-slate-300">
                      {isRegistering ? 'كلمة المرور المطلوبة لحسابك (سجل كلمة مرور قوية)' : 'كلمة المرور'}
                    </label>
                    <div className="relative">
                      <input
                        type="password"
                        required
                        value={password}
                        onChange={(e) => {
                          setPassword(e.target.value);
                          if (kioskStatus !== 'idle' && kioskStatus !== 'verifying') setKioskStatus('idle');
                          if (error) setError(null);
                        }}
                        placeholder="••••••••"
                        className="w-full pl-3 pr-10 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 placeholder-slate-600 focus:outline-none focus:border-emerald-500 text-xs text-right font-sans"
                      />
                      <KeyRound className="absolute top-1/2 right-3 -translate-y-1/2 w-4 h-4 text-slate-500" />
                    </div>
                  </div>

                  {/* Forgot Password Link (Only for normal login) */}
                  {!isRegistering && (
                    <div className="text-left mt-1">
                      <button
                        type="button"
                        onClick={() => {
                          setShowForgotPassword(true);
                          setError(null);
                          setResetSuccess(false);
                          setResetEmail('');
                        }}
                        className="text-[11px] text-emerald-400 hover:text-emerald-300 font-bold transition duration-150 cursor-pointer bg-transparent border-none"
                      >
                        نسيت الرقم السري؟
                      </button>
                    </div>
                  )}

                  {/* 6. Employee Package (For registration) */}
                  {isRegistering && (
                    <div className="space-y-1">
                      <label className="block text-xs font-semibold text-slate-300">باقة حجم الموظفين</label>
                      <div className="relative">
                        <select
                          required
                          value={employeePackage}
                          onChange={(e) => setEmployeePackage(e.target.value)}
                          className="w-full pl-3 pr-10 py-2.5 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 placeholder-slate-600 focus:outline-none focus:border-emerald-500 text-xs text-right appearance-none cursor-pointer"
                        >
                          <option value="الباقة الأساسية حتى 20 موظف - تجريبية مجانية">الباقة الأساسية حتى 20 موظف - تجريبية مجانية</option>
                          <option value="الباقة المتقدمة حتى 100 موظف">الباقة المتقدمة حتى 100 موظف</option>
                          <option value="باقة الشركات غير المحدودة">باقة الشركات غير المحدودة</option>
                        </select>
                        <Building className="absolute top-1/2 left-3 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
                      </div>
                    </div>
                  )}

                  {/* Submit Button */}
                  <button
                    type="submit"
                    disabled={loading || kioskStatus === 'verifying' || kioskStatus === 'success'}
                    className="w-full py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black rounded-lg text-xs flex items-center justify-center gap-2 transition duration-200 mt-5 shadow-lg shadow-emerald-500/10 cursor-pointer disabled:opacity-50"
                  >
                    {kioskStatus === 'verifying' ? (
                      <span className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                    ) : kioskStatus === 'success' ? (
                      <>
                        <CheckCircle2 className="w-3.5 h-3.5 stroke-[3]" />
                        <span>تمت البصمة بنجاح! جاري التوجيه...</span>
                      </>
                    ) : isRegistering ? (
                      <>
                        <UserPlus className="w-3.5 h-3.5" />
                        <span>إرسال الطلب</span>
                      </>
                    ) : (
                      <>
                        <LogIn className="w-3.5 h-3.5" />
                        <span>دخول النظام</span>
                      </>
                    )}
                  </button>
                </form>

                {/* Footer Switcher Options */}
                <div className="mt-5 flex flex-col gap-2.5 text-center border-t border-slate-800/60 pt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setIsRegistering(!isRegistering);
                      setError(null);
                      setKioskStatus('idle');
                    }}
                    className="text-emerald-400 hover:text-emerald-300 text-xs font-sans transition duration-150 cursor-pointer font-bold"
                  >
                    {isRegistering 
                      ? 'لديك حساب بالفعل؟ سجل الدخول الآن' 
                      : 'ليس لديك حساب؟ سجل كمستأجر جديد الآن'
                    }
                  </button>
                </div>
              </>
            )}
          </motion.div>
        </div>

      </div>

      {/* Floating Technical Support Button */}
      <a
        href="https://wa.me/966557538856?text=%D9%85%D8%B1%D8%AD%D8%A8%D8%A7%20%D9%81%D8%B1%D9%8A%D9%82%20%D8%A7%D9%84%D8%AF%D8%B9%D9%85%20%D8%A7%D9%84%D9%81%D9%86%D9%8A%20%D8%A8%D8%B5%D9%85%D8%A9%20%D8%AA%D9%83%20%D8%A7%D8%AD%D8%AA%D8%A7%D8%AC%20%D8%A7%D9%84%D9%85%D8%B3%D8%A7%D8%B9%D8%AF%D9%87"
        target="_blank"
        referrerPolicy="no-referrer"
        rel="noopener noreferrer"
        className="fixed bottom-6 right-6 z-50 flex items-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black px-4 py-3 rounded-full shadow-2xl transition-all duration-300 cursor-pointer border border-emerald-400/20 group hover:scale-105 active:scale-95"
      >
        {/* Pulse effect */}
        <span className="absolute inset-0 rounded-full bg-emerald-500/30 animate-ping pointer-events-none group-hover:animate-none" />
        
        {/* WhatsApp Icon SVG */}
        <svg 
          className="w-5 h-5 fill-current text-slate-950" 
          viewBox="0 0 24 24"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946C.06 5.348 5.397.01 12.008.01c3.202.001 6.212 1.246 8.477 3.513 2.266 2.268 3.507 5.28 3.505 8.484-.004 6.657-5.34 11.997-11.953 11.997-2.005-.001-3.973-.502-5.731-1.456L0 24zm6.59-4.846c1.6.95 3.188 1.449 4.825 1.451 5.436 0 9.86-4.37 9.864-9.799.002-2.63-1.023-5.101-2.885-6.963C16.488 1.981 14.03 1.06 11.4 1.061 5.964 1.061 1.543 5.432 1.54 10.862c-.001 1.702.453 3.361 1.314 4.816L1.87 21.082l5.777-1.488c1.424.779 2.946 1.19 4.5 1.19a9.78 9.78 0 00-.001-.001zm10.741-7.291c-.296-.147-1.748-.862-2.023-.962-.274-.1-.474-.148-.674.149-.2.298-.774.962-.949 1.16-.174.2-.35.223-.646.074-.296-.147-1.25-.46-2.382-1.469-.881-.784-1.474-1.753-1.647-2.05-.174-.298-.018-.46.131-.607.135-.133.298-.347.446-.52.149-.174.198-.298.298-.497.1-.2.05-.373-.025-.521-.075-.148-.674-1.623-.924-2.22-.243-.584-.488-.504-.674-.513-.174-.008-.374-.01-.574-.01s-.524.074-.798.373c-.274.298-1.048 1.023-1.048 2.493 0 1.47 1.073 2.885 1.223 3.084.149.2 2.11 3.221 5.112 4.516.714.308 1.272.492 1.707.63.717.228 1.37.196 1.885.119.574-.085 1.748-.713 1.998-1.402.249-.689.249-1.278.174-1.402-.075-.124-.274-.198-.57-.347z" />
        </svg>

        <span className="text-xs font-black tracking-wide">الدعم الفني</span>
      </a>

      {/* ----------------- LOGIN SUCCESS GLOWING OVERLAY ----------------- */}
      <AnimatePresence>
        {loginSuccessUser && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-slate-950/95 backdrop-blur-2xl flex items-center justify-center p-4 text-slate-100 font-sans"
          >
            {/* Glowing Background Glow Effects */}
            <div className="absolute w-[500px] h-[500px] bg-emerald-500/20 rounded-full blur-3xl pointer-events-none animate-pulse" />
            <div className="absolute w-[300px] h-[300px] bg-teal-500/10 rounded-full blur-2xl pointer-events-none" />

            <motion.div
              initial={{ scale: 0.85, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              transition={{ type: 'spring', damping: 20, stiffness: 280 }}
              className="relative w-full max-w-md bg-slate-900/95 border-2 border-emerald-500/60 rounded-3xl p-8 text-center space-y-6 shadow-[0_0_60px_rgba(16,185,129,0.4)] backdrop-blur-xl"
            >
              {/* Glowing Fingerprint & Check Icon */}
              <div className="relative w-28 h-28 mx-auto flex items-center justify-center">
                {/* Ping rings */}
                <div className="absolute inset-0 rounded-full border-2 border-emerald-400/40 animate-ping" />
                <div className="absolute -inset-2 rounded-full border border-emerald-500/20 animate-pulse" />
                
                <div className="w-24 h-24 rounded-2xl bg-gradient-to-tr from-slate-950 via-slate-900 to-emerald-950 border-2 border-emerald-400/80 flex items-center justify-center shadow-2xl shadow-emerald-500/50">
                  <Fingerprint className="w-14 h-14 text-emerald-400 filter drop-shadow-[0_0_12px_rgba(52,211,153,0.8)] animate-pulse" />
                </div>
                <div className="absolute -bottom-1 -right-1 bg-emerald-400 text-slate-950 p-2 rounded-full shadow-xl border-2 border-slate-950">
                  <CheckCircle2 className="w-6 h-6 stroke-[3]" />
                </div>
              </div>

              {/* Text & Branding */}
              <div className="space-y-2">
                <div className="inline-flex items-center gap-1.5 bg-emerald-500/10 border border-emerald-500/30 px-3 py-1 rounded-full text-[11px] font-bold text-emerald-400">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>تم المصادقة البيومترية بنجاح</span>
                </div>

                <h3 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-emerald-300 via-teal-100 to-emerald-400 filter drop-shadow-[0_0_10px_rgba(16,185,129,0.4)]">
                  تمت البصمة بنجاح!
                </h3>
                <p className="text-xs text-slate-300 font-sans leading-relaxed">
                  أهلاً بك في بوابة بصمة تك السحابية
                  <br />
                  جاري توجيهك بأمان إلى لوحة التحكم الخاصة بك...
                </p>
              </div>

              {/* Animated Progress Bar */}
              <div className="w-full bg-slate-950 rounded-full h-2.5 overflow-hidden border border-emerald-500/30 p-0.5">
                <motion.div
                  initial={{ width: '0%' }}
                  animate={{ width: '100%' }}
                  transition={{ duration: 4.8, ease: 'linear' }}
                  className="h-full bg-gradient-to-r from-emerald-500 via-teal-300 to-emerald-400 rounded-full shadow-[0_0_15px_#34d399]"
                />
              </div>

              <div className="text-[10px] font-mono text-emerald-400/90 tracking-widest">
                AUTHENTICATED • REDIRECTING IN PROGRESS
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
