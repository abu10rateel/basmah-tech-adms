/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { db } from '../supabaseClient';
import { 
  ShieldAlert, 
  LogOut, 
  Users, 
  Activity, 
  MapPin, 
  Layers, 
  Calendar, 
  CheckCircle, 
  Clock, 
  Building2, 
  Phone, 
  Mail, 
  User, 
  Check, 
  X, 
  AlertCircle,
  TrendingUp,
  Search,
  ExternalLink,
  KeyRound,
  Trash2
} from 'lucide-react';
import BrandLogo from './BrandLogo';

interface SuperAdminDashboardProps {
  user: any;
  onSignOut: () => void;
}

export default function SuperAdminDashboard({ user, onSignOut }: SuperAdminDashboardProps) {
  const [tenants, setTenants] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Selected tenant for activation/details
  const [selectedTenant, setSelectedTenant] = useState<any | null>(null);
  
  // Activation Form State
  const [city, setCity] = useState('الرياض');
  const [planType, setPlanType] = useState('الأساسية');
  const [durationMonths, setDurationMonths] = useState('12');
  const [submitting, setSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  
  // Suspension State
  const [tenantToSuspend, setTenantToSuspend] = useState<any | null>(null);
  const [suspending, setSuspending] = useState(false);

  // Deletion State
  const [tenantToDelete, setTenantToDelete] = useState<any | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Password Reset State
  const [customPassword, setCustomPassword] = useState('');
  const [updatingPassword, setUpdatingPassword] = useState(false);
  const [passwordRequests, setPasswordRequests] = useState<any[]>([]);
  const [requestPasswords, setRequestPasswords] = useState<{[key: string]: string}>({});

  const loadTenants = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await db.getSuperAdminTenants();
      setTenants(data);
      const reqs = await db.getPendingPasswordRequests();
      setPasswordRequests(reqs);
    } catch (err: any) {
      setError('فشل تحميل بيانات المستأجرين من السحابة.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTenants();
  }, []);

  const handleActivate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTenant) return;

    setSubmitting(true);
    setError(null);
    setSuccessMsg(null);

    try {
      const res = await db.activateTenant(
        selectedTenant.id,
        city,
        planType,
        parseInt(durationMonths, 10)
      );

      if (res.success) {
        setSuccessMsg(`تم تفعيل حساب (${selectedTenant.company_name}) بنجاح حتى تاريخ ${res.expiry_date}!`);
        setSelectedTenant(null);
        await loadTenants();
      } else {
        setError(res.error?.message || 'فشل تفعيل الحساب.');
      }
    } catch (err: any) {
      setError(err.message || 'حدث خطأ غير متوقع.');
    } finally {
      setSubmitting(false);
    }
  };

  const confirmSuspend = async () => {
    if (!tenantToSuspend) return;
    setSuspending(true);
    setError(null);
    setSuccessMsg(null);
    try {
      const res = await db.suspendTenant(tenantToSuspend.id);
      if (res.success) {
        setSuccessMsg(`تم إيقاف حساب (${tenantToSuspend.company_name}) فورياً وحظر دخوله للنظام.`);
        setTenantToSuspend(null);
        await loadTenants();
      } else {
        setError(res.error?.message || 'فشل إيقاف الحساب.');
      }
    } catch (err: any) {
      setError(err.message || 'حدث خطأ غير متوقع.');
    } finally {
      setSuspending(false);
    }
  };

  const confirmDelete = async () => {
    if (!tenantToDelete) return;
    setDeleting(true);
    setError(null);
    setSuccessMsg(null);
    try {
      const res = await db.deleteTenant(tenantToDelete.id);
      if (res.success) {
        setSuccessMsg(`تم حذف حساب (${tenantToDelete.company_name}) نهائياً من النظام وتنظيف كافة سجلاته.`);
        setTenantToDelete(null);
        await loadTenants();
      } else {
        setError(res.error?.message || 'فشل حذف الحساب.');
      }
    } catch (err: any) {
      setError(err.message || 'حدث خطأ غير متوقع.');
    } finally {
      setDeleting(false);
    }
  };

  const formatRegistrationDate = (dateVal: any) => {
    if (!dateVal) return 'قديماً';
    try {
      let dateObj: Date | null = null;
      
      if (typeof dateVal === 'object') {
        if (typeof dateVal.toDate === 'function') {
          dateObj = dateVal.toDate();
        } else if (typeof dateVal.seconds === 'number') {
          dateObj = new Date(dateVal.seconds * 1000);
        } else if (typeof dateVal._seconds === 'number') {
          dateObj = new Date(dateVal._seconds * 1000);
        }
      }
      
      if (!dateObj) {
        const parsed = new Date(dateVal);
        if (!isNaN(parsed.getTime())) {
          dateObj = parsed;
        }
      }
      
      if (dateObj) {
        const day = String(dateObj.getDate()).padStart(2, '0');
        const month = String(dateObj.getMonth() + 1).padStart(2, '0');
        const year = dateObj.getFullYear();
        return `${day}-${month}-${year}`;
      }
    } catch (err) {
      console.error('Error formatting registration date:', err);
    }
    return 'قديماً';
  };

  const handleUpdatePassword = async (tenantId: string, passwordToSet: string, companyName: string) => {
    if (!passwordToSet) {
      setError('يرجى إدخال كلمة المرور الجديدة.');
      return;
    }
    setUpdatingPassword(true);
    setError(null);
    setSuccessMsg(null);
    try {
      const res = await db.updateTenantPassword(tenantId, passwordToSet);
      if (res.success) {
        setSuccessMsg(`تم تحديث كلمة المرور للشركة (${companyName}) بنجاح.`);
        setCustomPassword('');
        // If we are currently editing this tenant, update selectedTenant's cached state
        if (selectedTenant && selectedTenant.id === tenantId) {
          setSelectedTenant({ ...selectedTenant, reset_password_requested: false, requested_new_password: null });
        }
        await loadTenants();
      } else {
        setError(res.error?.message || 'فشل تحديث كلمة المرور.');
      }
    } catch (err: any) {
      setError(err.message || 'حدث خطأ غير متوقع.');
    } finally {
      setUpdatingPassword(false);
    }
  };

  const handleResolveRequest = async (requestId: string, tenantId: string, email: string) => {
    const pwd = requestPasswords[requestId];
    if (!pwd || pwd.trim().length < 4) {
      setError('يرجى كتابة كلمة مرور جديدة صالحة (4 أحرف على الأقل).');
      return;
    }
    setUpdatingPassword(true);
    setError(null);
    setSuccessMsg(null);
    try {
      const res = await db.resolvePasswordRequest(requestId, tenantId, pwd);
      if (res.success) {
        setSuccessMsg(`تم تحديث كلمة المرور للحساب (${email}) بنجاح.`);
        const updatedPwds = { ...requestPasswords };
        delete updatedPwds[requestId];
        setRequestPasswords(updatedPwds);
        await loadTenants();
      } else {
        setError(res.error?.message || 'فشل تفعيل كلمة المرور الجديدة.');
      }
    } catch (err: any) {
      setError(err.message || 'حدث خطأ في الاتصال بالخادم.');
    } finally {
      setUpdatingPassword(false);
    }
  };

  // Live calculation of subscription expiry date
  const getCalculatedExpiryDate = () => {
    const months = parseInt(durationMonths, 10) || 12;
    const d = new Date();
    d.setMonth(d.getMonth() + months);
    return d.toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' });
  };

  // Statistics
  const totalCount = tenants.length;
  const pendingCount = tenants.filter(t => t.status === 'pending').length;
  const activeCount = tenants.filter(t => t.status === 'active').length;

  const filteredTenants = tenants.filter(t => {
    const q = searchQuery.toLowerCase();
    return (
      t.company_name?.toLowerCase().includes(q) ||
      t.email?.toLowerCase().includes(q) ||
      t.manager_name?.toLowerCase().includes(q) ||
      t.phone?.toLowerCase().includes(q)
    );
  });

  const resetRequests = tenants.filter(t => t.reset_password_requested === true);

  return (
    <div id="super-admin-layout" className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-emerald-500 selection:text-slate-950">
      
      {/* Top Banner Header */}
      <header className="bg-slate-900 border-b border-slate-800 sticky top-0 z-30 px-4 py-3">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-3">
          {/* Logo & Super Admin Identity */}
          <div className="flex items-center gap-3 order-last sm:order-first text-right">
            <BrandLogo size="sm" animated={true} />
            <div className="h-8 w-[1px] bg-slate-800 hidden sm:block mx-1" />
            <div>
              <div className="flex items-center gap-2">
                <span className="px-1.5 py-0.5 rounded text-[8px] font-black bg-rose-500/15 text-rose-400 border border-rose-500/25 tracking-wide">
                  مشرف عام
                </span>
                <h1 className="text-sm font-extrabold text-slate-100 leading-tight">
                  لوحة تحكم مدير النظام الموحد
                </h1>
              </div>
              <p className="text-[10px] text-slate-400 font-medium mt-0.5 font-sans">
                بصمة تك • المشرف المسؤول: <span className="text-slate-300 font-semibold">{user.email}</span>
              </p>
            </div>
          </div>

          {/* Quick Stats & Signout */}
          <div className="flex items-center gap-3">
            <div className="px-3 py-1.5 rounded-lg text-[10px] font-bold flex items-center gap-1.5 border bg-rose-500/10 border-rose-500/20 text-rose-400">
              <ShieldAlert className="w-3.5 h-3.5" />
              <span>نظام الرقابة المركزي والتحكم بالسحابة</span>
            </div>

            <button
              onClick={onSignOut}
              className="p-2 bg-slate-950 border border-rose-950 hover:bg-rose-950/20 text-rose-400 rounded-lg transition cursor-pointer"
              title="تسجيل الخروج"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Stage */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 md:p-6 space-y-6">
        
        {/* Statistics Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl relative overflow-hidden text-right">
            <div className="absolute top-4 left-4 bg-blue-500/10 p-2 rounded-lg text-blue-400">
              <Building2 className="w-5 h-5" />
            </div>
            <span className="block text-xs font-semibold text-slate-400 leading-none">إجمالي الشركات المسجلة</span>
            <span className="text-2xl font-black text-slate-200 block mt-2 font-mono">{totalCount}</span>
            <span className="text-[10px] text-slate-500 block mt-1">مشتركون ومقدمو طلبات</span>
          </div>

          <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl relative overflow-hidden text-right">
            <div className="absolute top-4 left-4 bg-emerald-500/10 p-2 rounded-lg text-emerald-400">
              <CheckCircle className="w-5 h-5" />
            </div>
            <span className="block text-xs font-semibold text-slate-400 leading-none">الحسابات النشطة والمفعلة</span>
            <span className="text-2xl font-black text-emerald-400 block mt-2 font-mono">{activeCount}</span>
            <span className="text-[10px] text-emerald-500/80 block mt-1">تمتلك صلاحية استخدام كاملة</span>
          </div>

          <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl relative overflow-hidden text-right">
            <div className="absolute top-4 left-4 bg-amber-500/10 p-2 rounded-lg text-amber-400">
              <Clock className="w-5 h-5" />
            </div>
            <span className="block text-xs font-semibold text-slate-400 leading-none">طلبات الاشتراك بانتظار التفعيل</span>
            <span className="text-2xl font-black text-amber-400 block mt-2 font-mono animate-pulse">{pendingCount}</span>
            <span className="text-[10px] text-amber-500 block mt-1">بحاجة لمراجعة وتفعيل يدوي</span>
          </div>
        </div>

        {/* Global Notifications Panel */}
        {successMsg && (
          <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 rounded-xl text-xs text-right flex justify-between items-center">
            <span>{successMsg}</span>
            <button onClick={() => setSuccessMsg(null)} className="text-emerald-400 hover:text-emerald-300">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {error && (
          <div className="p-4 bg-rose-500/10 border border-rose-500/20 text-rose-300 rounded-xl text-xs text-right flex justify-between items-center">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
            <button onClick={() => setError(null)} className="text-rose-400 hover:text-rose-300">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Instant Suspension Warning Modal */}
        <AnimatePresence>
          {tenantToSuspend && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="p-5 bg-rose-500/10 border-2 border-rose-500/30 text-rose-200 rounded-2xl text-right space-y-4"
            >
              <div className="flex items-center gap-2 text-rose-400 font-black">
                <ShieldAlert className="w-5 h-5 shrink-0" />
                <h4 className="text-sm">تأكيد الإيقاف الفوري اللحظي للمستأجر</h4>
              </div>
              <p className="text-xs leading-relaxed text-slate-300">
                أنت على وشك تفعيل وضع <span className="text-rose-400 font-extrabold">"إيقاف فوري"</span> لحساب الشركة <span className="text-white font-extrabold">({tenantToSuspend.company_name})</span>. سيؤدي هذا الإجراء لإغلاق وحظر وصول الشركة وموظفيها للنظام فورياً ولحظياً في نفس الثانية.
              </p>
              <div className="flex items-center gap-3 justify-end pt-1">
                <button
                  type="button"
                  onClick={() => setTenantToSuspend(null)}
                  disabled={suspending}
                  className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-slate-300 font-bold rounded-lg text-xs transition cursor-pointer"
                >
                  تراجع وإلغاء
                </button>
                <button
                  type="button"
                  onClick={confirmSuspend}
                  disabled={suspending}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white font-black rounded-lg text-xs flex items-center gap-2 transition cursor-pointer shadow-lg shadow-rose-600/10"
                >
                  {suspending ? (
                    <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <span>تأكيد الإيقاف الفوري الآن</span>
                  )}
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Account Deletion Warning Modal */}
        <AnimatePresence>
          {tenantToDelete && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="p-5 bg-rose-950/40 border-2 border-rose-600/30 text-rose-200 rounded-2xl text-right space-y-4"
            >
              <div className="flex items-center gap-2 text-rose-400 font-black">
                <Trash2 className="w-5 h-5 shrink-0" />
                <h4 className="text-sm">تأكيد حذف حساب المستأجر نهائياً</h4>
              </div>
              <p className="text-xs leading-relaxed text-slate-300">
                هل أنت متأكد من حذف حساب هذا المستأجر <span className="text-white font-extrabold">({tenantToDelete.company_name})</span> نهائياً؟ لا يمكن التراجع عن هذه الخطوة. سيتم إرسال طلب حذف يقوم بمسح وثيقة العميل بالكامل من النظام فوراً.
              </p>
              <div className="flex items-center gap-3 justify-end pt-1">
                <button
                  type="button"
                  onClick={() => setTenantToDelete(null)}
                  disabled={deleting}
                  className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-slate-300 font-bold rounded-lg text-xs transition cursor-pointer"
                >
                  تراجع وإلغاء
                </button>
                <button
                  type="button"
                  onClick={confirmDelete}
                  disabled={deleting}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white font-black rounded-lg text-xs flex items-center gap-2 transition cursor-pointer shadow-lg shadow-rose-600/10"
                >
                  {deleting ? (
                    <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <span>تأكيد حذف الحساب نهائياً</span>
                  )}
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Unified Password Reset Requests Section */}
        {(resetRequests.length > 0 || passwordRequests.length > 0) && (
          <div className="bg-slate-900 border border-amber-500/20 rounded-xl p-4 text-right space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 font-mono">
                قيد الانتظار ({resetRequests.length + passwordRequests.length})
              </span>
              <div className="flex items-center gap-2 text-amber-400 font-extrabold">
                <KeyRound className="w-4 h-4 shrink-0" />
                <h3 className="text-xs">طلبات استعادة كلمة المرور النشطة للعملاء</h3>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Render Firestore Collection Requests */}
              {passwordRequests.map((request) => {
                const tenant = tenants.find(t => t.email?.toLowerCase() === request.email?.toLowerCase());
                const companyName = tenant ? tenant.company_name : 'مستأجر/عميل غير نشط';
                return (
                  <div key={request.id} className="p-3 bg-slate-950 border border-slate-800 rounded-lg space-y-3 relative">
                    <div className="flex justify-between items-start">
                      <span className="text-[9px] font-mono text-slate-500">
                        {request.requested_at ? new Date(request.requested_at).toLocaleString('ar-EG') : 'قيد الانتظار'}
                      </span>
                      <div className="font-extrabold text-xs text-slate-200">
                        {companyName}
                      </div>
                    </div>
                    
                    <div className="text-[11px] text-slate-400 space-y-1">
                      <div>البريد الإلكتروني للعميل: <span className="font-mono text-slate-300 select-all">{request.email}</span></div>
                      <div className="text-[10px] text-amber-500/80">الحالة: بانتظار تعيين كلمة مرور جديدة</div>
                    </div>

                    <div className="space-y-2 pt-1">
                      <div className="flex gap-2">
                        <input
                          type="text"
                          placeholder="اكتب كلمة المرور الجديدة"
                          value={requestPasswords[request.id] || ''}
                          onChange={(e) => setRequestPasswords({ ...requestPasswords, [request.id]: e.target.value })}
                          className="flex-1 px-3 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-slate-100 placeholder-slate-600 focus:outline-none focus:border-emerald-500 text-xs text-right font-sans"
                        />
                        <button
                          type="button"
                          disabled={updatingPassword}
                          onClick={() => handleResolveRequest(request.id, tenant?.id || '', request.email)}
                          className="py-1.5 px-3 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black rounded-lg text-[10px] flex items-center justify-center gap-1 transition duration-150 cursor-pointer disabled:opacity-50 shrink-0"
                        >
                          {updatingPassword ? (
                            <span className="w-3.5 h-3.5 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                          ) : (
                            <span>تعيين كلمة المرور</span>
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}

              {/* Backwards compatible older requests */}
              {resetRequests.map((tenant) => (
                <div key={tenant.id} className="p-3 bg-slate-950 border border-slate-800 rounded-lg space-y-3 relative">
                  <div className="flex justify-between items-start">
                    <span className="text-[9px] font-mono text-slate-500">
                      {tenant.reset_requested_at ? new Date(tenant.reset_requested_at).toLocaleString('ar-EG') : 'قيد الانتظار'}
                    </span>
                    <div className="font-extrabold text-xs text-slate-200">
                      {tenant.company_name}
                    </div>
                  </div>
                  
                  <div className="text-[11px] text-slate-400 space-y-1">
                    <div>البريد: <span className="font-mono text-slate-300 select-all">{tenant.email}</span></div>
                    <div>الرقم المطلوب: <span className="font-mono text-amber-400 font-bold">{tenant.requested_new_password}</span></div>
                  </div>

                  <div className="flex items-center gap-2 pt-1">
                    <button
                      type="button"
                      disabled={updatingPassword}
                      onClick={() => handleUpdatePassword(tenant.id, tenant.requested_new_password, tenant.company_name)}
                      className="flex-1 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black rounded-lg text-[10px] flex items-center justify-center gap-1 transition duration-150 cursor-pointer disabled:opacity-50"
                    >
                      {updatingPassword ? (
                        <span className="w-3.5 h-3.5 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <>
                          <Check className="w-3 h-3" />
                          <span>اعتماد وتغيير الرقم السري</span>
                        </>
                      )}
                    </button>
                    
                    <button
                      type="button"
                      disabled={updatingPassword}
                      onClick={async () => {
                        try {
                          setError(null);
                          setSuccessMsg(null);
                          await db.updateTenantPassword(tenant.id, tenant.password || '');
                          setSuccessMsg(`تم رفض طلب تعديل الرقم السري للشركة (${tenant.company_name}) بنجاح.`);
                          await loadTenants();
                        } catch (err: any) {
                          setError(err.message || 'فشل رفض الطلب.');
                        }
                      }}
                      className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 font-bold rounded-lg text-[10px] transition duration-150 cursor-pointer"
                    >
                      رفض الطلب
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Selected Tenant Activation Form Drawer / Container */}
        <AnimatePresence>
          {selectedTenant && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="bg-slate-900 border border-emerald-500/20 rounded-2xl overflow-hidden p-5 space-y-4"
            >
              <div className="flex justify-between items-center border-b border-slate-800 pb-3">
                <button 
                  onClick={() => setSelectedTenant(null)}
                  className="p-1 hover:bg-slate-800 rounded-lg text-slate-400 transition"
                >
                  <X className="w-4 h-4" />
                </button>
                <h3 className="text-sm font-black text-emerald-400 flex items-center gap-2">
                  <Activity className="w-4 h-4" />
                  <span>تفعيل وتحديث اشتراك: {selectedTenant.company_name}</span>
                </h3>
              </div>

              <form onSubmit={handleActivate} className="grid grid-cols-1 sm:grid-cols-4 gap-4 text-right">
                
                {/* City Input */}
                <div className="space-y-1.5 col-span-1">
                  <label className="block text-xs font-semibold text-slate-300">المدينة</label>
                  <div className="relative">
                    <select
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      className="w-full pl-3 pr-10 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 placeholder-slate-600 focus:outline-none focus:border-emerald-500 text-xs text-right font-sans"
                    >
                      <option value="الرياض">الرياض</option>
                      <option value="جدة">جدة</option>
                      <option value="الدمام">الدمام</option>
                      <option value="مكة المكرمة">مكة المكرمة</option>
                      <option value="المدينة المنورة">المدينة المنورة</option>
                      <option value="الخبر">الخبر</option>
                      <option value="خميس مشيط">خميس مشيط</option>
                      <option value="أبها">أبها</option>
                      <option value="تبوك">تبوك</option>
                      <option value="جازان">جازان</option>
                      <option value="أخرى">أخرى</option>
                    </select>
                    <MapPin className="absolute top-1/2 right-3 -translate-y-1/2 w-4 h-4 text-slate-500" />
                  </div>
                </div>

                {/* Plan Type Selection */}
                <div className="space-y-1.5 col-span-1">
                  <label className="block text-xs font-semibold text-slate-300">نوع الباقة</label>
                  <div className="relative">
                    <select
                      value={planType}
                      onChange={(e) => setPlanType(e.target.value)}
                      className="w-full pl-3 pr-10 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 placeholder-slate-600 focus:outline-none focus:border-emerald-500 text-xs text-right font-sans"
                    >
                      <option value="الأساسية">الباقة الأساسية</option>
                      <option value="المتقدمة">الباقة المتقدمة</option>
                      <option value="الشركات">باقة الشركات</option>
                    </select>
                    <Layers className="absolute top-1/2 right-3 -translate-y-1/2 w-4 h-4 text-slate-500" />
                  </div>
                </div>

                {/* Duration Months */}
                <div className="space-y-1.5 col-span-1">
                  <label className="block text-xs font-semibold text-slate-300">مدة الاشتراك بالأشهر</label>
                  <div className="relative">
                    <select
                      value={durationMonths}
                      onChange={(e) => setDurationMonths(e.target.value)}
                      className="w-full pl-3 pr-10 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 placeholder-slate-600 focus:outline-none focus:border-emerald-500 text-xs text-right font-sans font-mono"
                    >
                      <option value="1">شهر واحد (1)</option>
                      <option value="3">3 أشهر</option>
                      <option value="6">6 أشهر</option>
                      <option value="12">سنة كاملة (12 شهر)</option>
                      <option value="24">سنتين (24 شهر)</option>
                      <option value="36">3 سنوات (36 شهر)</option>
                    </select>
                    <Calendar className="absolute top-1/2 right-3 -translate-y-1/2 w-4 h-4 text-slate-500" />
                  </div>
                </div>

                {/* Submit & Calculate */}
                <div className="col-span-1 flex flex-col justify-end">
                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-full py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black rounded-lg text-xs flex items-center justify-center gap-2 transition duration-200 cursor-pointer disabled:opacity-50"
                  >
                    {submitting ? (
                      <span className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <>
                        <Check className="w-4 h-4" />
                        <span>تفعيل وتحديث الحساب</span>
                      </>
                    )}
                  </button>
                </div>

                {/* Expiry Date feedback */}
                <div className="col-span-1 sm:col-span-4 bg-slate-950/40 border border-slate-800 rounded-lg p-2.5 flex items-center justify-between text-[11px] text-slate-400">
                  <span className="text-emerald-400 font-bold">{getCalculatedExpiryDate()}</span>
                  <span>تاريخ انتهاء الاشتراك المحسوب تلقائياً بناءً على تاريخ التفعيل الحالي:</span>
                </div>
              </form>

              {/* Dedicated Password Manager for selectedTenant */}
              <div className="border-t border-slate-850 pt-4 mt-2">
                <h4 className="text-xs font-bold text-slate-300 flex items-center gap-1.5 justify-end">
                  <span>تحديث كلمة المرور للعميل يدوياً</span>
                  <KeyRound className="w-3.5 h-3.5 text-slate-500" />
                </h4>
                <div className="mt-3 flex flex-col sm:flex-row gap-3 justify-end items-end">
                  <button
                    type="button"
                    disabled={updatingPassword}
                    onClick={() => handleUpdatePassword(selectedTenant.id, customPassword, selectedTenant.company_name)}
                    className="w-full sm:w-auto px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold rounded-lg text-xs transition duration-150 cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1.5"
                  >
                    {updatingPassword ? (
                      <span className="w-3.5 h-3.5 border-2 border-slate-400 border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <>
                        <Check className="w-3.5 h-3.5" />
                        <span>تغيير كلمة المرور الآن</span>
                      </>
                    )}
                  </button>

                  <div className="w-full sm:w-64 space-y-1 text-right">
                    <label className="block text-[11px] text-slate-400">كلمة المرور الجديدة</label>
                    <div className="relative">
                      <input
                        type="text"
                        value={customPassword}
                        onChange={(e) => setCustomPassword(e.target.value)}
                        placeholder="أدخل كلمة المرور الجديدة"
                        className="w-full pl-3 pr-10 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 placeholder-slate-600 focus:outline-none focus:border-emerald-500 text-xs text-right font-sans"
                      />
                      <KeyRound className="absolute top-1/2 right-3 -translate-y-1/2 w-4 h-4 text-slate-500" />
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Registered Tenants List */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden p-4">
          
          <div className="flex flex-col sm:flex-row justify-between items-center gap-3 border-b border-slate-800 pb-4 mb-4">
            
            {/* Search Input */}
            <div className="relative w-full sm:w-72 order-last sm:order-first">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="ابحث باسم الشركة، البريد، الجوال..."
                className="w-full pl-3 pr-10 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 placeholder-slate-600 focus:outline-none focus:border-emerald-500 text-xs text-right"
              />
              <Search className="absolute top-1/2 right-3 -translate-y-1/2 w-4 h-4 text-slate-600" />
            </div>

            <div className="text-right w-full sm:w-auto">
              <h3 className="text-sm font-extrabold text-slate-200">سجل طلبات الشركات ومستأجري النظام</h3>
              <p className="text-[10px] text-slate-500 mt-0.5">مراقبة وتفعيل الاشتراكات السحابية لحظة بلحظة</p>
            </div>
          </div>

          {loading ? (
            <div className="py-20 text-center text-slate-500 space-y-3">
              <span className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin block mx-auto" />
              <span className="text-xs">جاري سحب طلبات الشركات المسجلة على السحابة...</span>
            </div>
          ) : filteredTenants.length === 0 ? (
            <div className="py-20 text-center text-slate-500">
              <Building2 className="w-10 h-10 text-slate-800 mx-auto mb-3" />
              <p className="text-xs">لا توجد طلبات شركات مسجلة تطابق فلترة البحث حالياً.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 bg-slate-950/20">
                    <th className="py-3 px-4 font-bold">الشركة المستأجرة</th>
                    <th className="py-3 px-4 font-bold">البريد الإلكتروني</th>
                    <th className="py-3 px-4 font-bold">المسؤول عن النظام</th>
                    <th className="py-3 px-4 font-bold">رقم الجوال</th>
                    <th className="py-3 px-4 font-bold">تاريخ التقديم</th>
                    <th className="py-3 px-4 font-bold">الحالة الافتراضية</th>
                    <th className="py-3 px-4 font-bold">تفاصيل الاشتراك</th>
                    <th className="py-3 px-4 font-bold text-center">الإجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-850">
                  {filteredTenants.map((tenant) => {
                    const isPending = tenant.status === 'pending';
                    return (
                      <tr key={tenant.id} className="hover:bg-slate-950/40 transition">
                        {/* Company Name */}
                        <td className="py-3 px-4 font-extrabold text-slate-200">
                          <div className="flex items-center gap-2 justify-end">
                            <span>{tenant.company_name}</span>
                            <Building2 className="w-3.5 h-3.5 text-slate-500" />
                          </div>
                        </td>

                        {/* Email */}
                        <td className="py-3 px-4 font-mono text-slate-300 text-right">
                          <div className="flex items-center gap-1.5 justify-end">
                            <span>{tenant.email}</span>
                            <Mail className="w-3.5 h-3.5 text-slate-600" />
                          </div>
                        </td>

                        {/* Manager Name */}
                        <td className="py-3 px-4 text-slate-300">
                          <div className="flex items-center gap-1.5 justify-end">
                            <span>{tenant.manager_name || 'غير معروف'}</span>
                            <User className="w-3.5 h-3.5 text-slate-600" />
                          </div>
                        </td>

                        {/* Phone */}
                        <td className="py-3 px-4 font-mono text-slate-300 text-right">
                          <div className="flex items-center gap-1.5 justify-end">
                            <span dir="ltr">{tenant.phone || '—'}</span>
                            <Phone className="w-3.5 h-3.5 text-slate-600" />
                          </div>
                        </td>

                        {/* Registration Date */}
                        <td className="py-3 px-4 text-slate-400 font-mono text-right">
                          {formatRegistrationDate(tenant.created_at || tenant.createdAt)}
                        </td>

                        {/* Status badge */}
                        <td className="py-3 px-4 text-right">
                          {tenant.status === 'suspended' ? (
                            <span className="inline-flex items-center gap-1 bg-rose-500/10 text-rose-400 border border-rose-500/20 px-2 py-0.5 rounded text-[10px] font-bold">
                              <span className="w-1.5 h-1.5 bg-rose-500 rounded-full" />
                              موقوف فورياً
                            </span>
                          ) : isPending ? (
                            <span className="inline-flex items-center gap-1 bg-amber-500/10 text-amber-400 border border-amber-500/20 px-2 py-0.5 rounded text-[10px] font-bold">
                              <span className="w-1.5 h-1.5 bg-amber-500 rounded-full animate-ping" />
                              بانتظار التفعيل
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded text-[10px] font-bold">
                              <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />
                              نشط ومفعل
                            </span>
                          )}
                        </td>

                        {/* Plan Meta */}
                        <td className="py-3 px-4 text-right">
                          {tenant.status === 'suspended' ? (
                            <div className="space-y-0.5 text-[10px]">
                              <span className="text-rose-400 font-bold">محظور ومغلق</span>
                              <div className="text-slate-500 font-mono text-[9px]">
                                انتهاء: {tenant.expiry_date || 'غير محدد'}
                              </div>
                            </div>
                          ) : !isPending ? (
                            <div className="space-y-0.5 text-[10px]">
                              <div className="text-slate-300">
                                الباقة: <span className="font-extrabold text-emerald-400">{tenant.plan_type || 'الأساسية'}</span> ({tenant.city || '—'})
                              </div>
                              <div className="text-slate-500 font-mono text-[9px]">
                                انتهاء: {tenant.expiry_date || 'غير محدد'}
                              </div>
                            </div>
                          ) : (
                            <span className="text-slate-600 font-mono">—</span>
                          )}
                        </td>

                        {/* Actions */}
                        <td className="py-3 px-4 text-center">
                          {isPending ? (
                            <div className="flex items-center gap-2 justify-center">
                              <button
                                onClick={() => {
                                  setSelectedTenant(tenant);
                                  setCity('الرياض');
                                  setPlanType('الأساسية');
                                  setDurationMonths('12');
                                  // Scroll to form smoothly
                                  window.scrollTo({ top: 0, behavior: 'smooth' });
                                }}
                                className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold rounded-lg text-[10px] transition cursor-pointer"
                              >
                                مراجعة وتنشيط
                              </button>
                              <button
                                onClick={() => {
                                  setTenantToDelete(tenant);
                                  window.scrollTo({ top: 0, behavior: 'smooth' });
                                }}
                                className="px-3 py-1.5 bg-rose-950/60 hover:bg-rose-900 border border-rose-800/40 text-rose-200 hover:text-rose-100 font-bold rounded-lg text-[10px] transition cursor-pointer flex items-center gap-1"
                              >
                                <Trash2 className="w-3.5 h-3.5 shrink-0" />
                                <span>حذف الحساب</span>
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2 justify-center">
                              <button
                                onClick={() => {
                                  setSelectedTenant(tenant);
                                  setCity(tenant.city || 'الرياض');
                                  setPlanType(tenant.plan_type || 'الأساسية');
                                  setDurationMonths(String(tenant.subscription_months || 12));
                                  window.scrollTo({ top: 0, behavior: 'smooth' });
                                }}
                                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 rounded-lg text-[10px] transition cursor-pointer"
                              >
                                تعديل
                              </button>
                              {tenant.status !== 'suspended' && (
                                <button
                                  onClick={() => {
                                    setTenantToSuspend(tenant);
                                    window.scrollTo({ top: 0, behavior: 'smooth' });
                                  }}
                                  className="px-3 py-1.5 bg-rose-600/90 hover:bg-rose-500 text-white font-bold rounded-lg text-[10px] transition cursor-pointer"
                                >
                                  إيقاف فوري
                                </button>
                              )}
                              <button
                                onClick={() => {
                                  setTenantToDelete(tenant);
                                  window.scrollTo({ top: 0, behavior: 'smooth' });
                                }}
                                className="px-3 py-1.5 bg-rose-950/60 hover:bg-rose-900 border border-rose-800/40 text-rose-200 hover:text-rose-100 font-bold rounded-lg text-[10px] transition cursor-pointer flex items-center gap-1"
                              >
                                <Trash2 className="w-3.5 h-3.5 shrink-0" />
                                <span>حذف الحساب</span>
                              </button>
                            </div>
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

      </main>

      {/* Footer */}
      <footer className="py-6 border-t border-slate-900 text-center text-[10px] text-slate-600 font-medium font-sans mt-auto">
        <span>جميع الحقوق محفوظة لوحة تحكم مدير النظام الموحد المركزي © 2026 بصمة تك</span>
      </footer>
    </div>
  );
}
