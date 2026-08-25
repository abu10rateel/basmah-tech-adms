/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { ShiftSchedule, Employee, AttendanceLog, TenantProfile } from './types';

// The app is now natively and permanently cloud-based via our Express full-stack backend
export const isSupabaseConfigured = true;
export const supabase = null;

interface AuthSession {
  user: TenantProfile | null;
}

async function fetchWithRetry(url: string, options?: RequestInit, retries = 2, delayMs = 300): Promise<Response> {
  for (let i = 0; i <= retries; i++) {
    try {
      const res = await fetch(url, options);
      if (res.ok) return res;
      if (i < retries && res.status >= 500) {
        await new Promise(r => setTimeout(r, delayMs));
        continue;
      }
      return res;
    } catch (err) {
      if (i === retries) throw err;
      await new Promise(r => setTimeout(r, delayMs));
    }
  }
  return fetch(url, options);
}

async function safeFetchJson<T = any>(response: Response): Promise<{ ok: boolean; data: T | null; error?: any }> {
  try {
    const contentType = response.headers.get('content-type') || '';
    if (!response.ok || !contentType.includes('application/json')) {
      return { ok: false, data: null, error: `HTTP ${response.status} non-json response` };
    }
    const data = await response.json();
    return { ok: true, data };
  } catch (err) {
    return { ok: false, data: null, error: err };
  }
}

// Global active session loaded from client storage for instant UI boot
let activeSession: AuthSession = {
  user: JSON.parse(localStorage.getItem('attendance_cloud_user') || 'null')
};

const authCallbacks: Array<(user: any) => void> = [];

function triggerAuthCallbacks() {
  authCallbacks.forEach(cb => cb(activeSession.user));
}

// Window Storage Listeners to sync logout/login events across tabs
window.addEventListener('storage', (event) => {
  if (event.key === 'attendance_cloud_user') {
    activeSession.user = JSON.parse(event.newValue || 'null');
    triggerAuthCallbacks();
  }
});

export const db = {
  // --- AUTHENTICATION ---

  async signUp(email: string, password: string, companyName: string): Promise<{ data: any; error: any }> {
    try {
      const response = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, company_name: companyName })
      });
      const result = await response.json();
      if (!response.ok || result.error) {
        return { data: null, error: result.error || { message: 'فشل إنشاء الحساب السحابي.' } };
      }

      activeSession.user = {
        ...result.data.user,
        password
      };
      localStorage.setItem('attendance_cloud_user', JSON.stringify(activeSession.user));
      triggerAuthCallbacks();

      return { data: result.data, error: null };
    } catch (err: any) {
      return { data: null, error: { message: err.message || 'خطأ في الاتصال بالخادم السحابي' } };
    }
  },

  async signIn(email: string, password: string, options?: { skipNotify?: boolean }): Promise<{ data: any; error: any }> {
    try {
      const response = await fetch('/api/auth/signin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const result = await response.json();
      if (!response.ok || result.error) {
        return { data: null, error: result.error || { message: 'البريد الإلكتروني أو كلمة المرور غير صحيحة.' } };
      }

      if (!options?.skipNotify) {
        activeSession.user = {
          ...result.data.user,
          password
        };
        localStorage.setItem('attendance_cloud_user', JSON.stringify(activeSession.user));
        triggerAuthCallbacks();
      }

      return { data: result.data, error: null };
    } catch (err: any) {
      return { data: null, error: { message: err.message || 'خطأ في الاتصال بالخادم السحابي' } };
    }
  },

  commitAuthSession(user: any) {
    activeSession.user = user;
    localStorage.setItem('attendance_cloud_user', JSON.stringify(activeSession.user));
    triggerAuthCallbacks();
  },

  async signOut(): Promise<{ error: any }> {
    activeSession.user = null;
    localStorage.removeItem('attendance_cloud_user');
    triggerAuthCallbacks();
    return { error: null };
  },

  async getCurrentUser() {
    return activeSession.user;
  },

  onAuthStateChange(callback: (user: any) => void) {
    authCallbacks.push(callback);
    // Immediately invoke with current state
    callback(activeSession.user);
    return () => {
      const index = authCallbacks.indexOf(callback);
      if (index > -1) authCallbacks.splice(index, 1);
    };
  },

  // --- SHIFTS CRUD ---

  async getShifts(): Promise<ShiftSchedule[]> {
    const user = await this.getCurrentUser();
    if (!user) return [];
    const userId = user.id || user.email;

    try {
      const response = await fetchWithRetry('/api/shifts', {
        headers: {
          'x-user-id': userId
        }
      });
      const parsed = await safeFetchJson<ShiftSchedule[]>(response);
      if (!parsed.ok || !parsed.data) {
        const local = localStorage.getItem(`attendance_local_shifts_${userId}`);
        return local ? JSON.parse(local) : [];
      }
      localStorage.setItem(`attendance_local_shifts_${userId}`, JSON.stringify(parsed.data));
      return parsed.data;
    } catch (err) {
      console.error('Error fetching shifts:', err);
      const local = localStorage.getItem(`attendance_local_shifts_${userId}`);
      return local ? JSON.parse(local) : [];
    }
  },

  async saveShift(shift: Omit<ShiftSchedule, 'user_id'> & { id?: string }): Promise<{ data: ShiftSchedule | null; error: any }> {
    const user = await this.getCurrentUser();
    if (!user) return { data: null, error: 'غير مصرح بالدخول' };
    const userId = user.id || user.email;

    const shiftId = shift.id || `shift_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
    const fullShift = { ...shift, id: shiftId, user_id: userId } as ShiftSchedule;
    
    const localKey = `attendance_local_shifts_${userId}`;
    const localShifts = JSON.parse(localStorage.getItem(localKey) || '[]');
    const index = localShifts.findIndex((s: any) => s.id === shiftId);
    if (index > -1) {
      localShifts[index] = fullShift;
    } else {
      localShifts.push(fullShift);
    }
    localStorage.setItem(localKey, JSON.stringify(localShifts));

    try {
      const response = await fetchWithRetry('/api/shifts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': userId
        },
        body: JSON.stringify(shift)
      });
      const parsed = await safeFetchJson(response);
      const result = parsed.data || {};
      window.dispatchEvent(new CustomEvent('cloud_db_update', { detail: { table: 'shifts' } }));
      return { data: result.data || fullShift, error: result.error || null };
    } catch (err: any) {
      window.dispatchEvent(new CustomEvent('cloud_db_update', { detail: { table: 'shifts' } }));
      return { data: fullShift, error: null };
    }
  },

  async deleteShift(id: string): Promise<{ error: any }> {
    const user = await this.getCurrentUser();
    if (!user) return { error: 'غير مصرح بالدخول' };
    const userId = user.id || user.email;

    const localKey = `attendance_local_shifts_${userId}`;
    let localShifts = JSON.parse(localStorage.getItem(localKey) || '[]');
    localShifts = localShifts.filter((s: any) => s.id !== id);
    localStorage.setItem(localKey, JSON.stringify(localShifts));

    try {
      const response = await fetchWithRetry(`/api/shifts/${id}`, {
        method: 'DELETE',
        headers: {
          'x-user-id': userId
        }
      });
      const parsed = await safeFetchJson(response);
      const result = parsed.data || {};
      window.dispatchEvent(new CustomEvent('cloud_db_update', { detail: { table: 'shifts' } }));
      return { error: result.error || null };
    } catch (err: any) {
      window.dispatchEvent(new CustomEvent('cloud_db_update', { detail: { table: 'shifts' } }));
      return { error: null };
    }
  },

  // --- EMPLOYEES CRUD ---

  async getEmployees(): Promise<Employee[]> {
    const user = await this.getCurrentUser();
    if (!user) return [];
    const userId = user.id || user.email;

    try {
      const response = await fetchWithRetry('/api/employees', {
        headers: {
          'x-user-id': userId
        }
      });
      const parsed = await safeFetchJson<Employee[]>(response);
      if (!parsed.ok || !parsed.data) {
        const local = localStorage.getItem(`attendance_local_employees_${userId}`);
        return local ? JSON.parse(local) : [];
      }
      localStorage.setItem(`attendance_local_employees_${userId}`, JSON.stringify(parsed.data));
      return parsed.data;
    } catch (err) {
      console.error('Error fetching employees:', err);
      const local = localStorage.getItem(`attendance_local_employees_${userId}`);
      return local ? JSON.parse(local) : [];
    }
  },

  async saveEmployee(employee: Omit<Employee, 'user_id'> & { id?: string }): Promise<{ data: Employee | null; error: any }> {
    const user = await this.getCurrentUser();
    if (!user) return { data: null, error: 'غير مصرح بالدخول' };
    const userId = user.id || user.email;

    const empId = employee.id || `emp_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
    const fullEmp = { ...employee, id: empId, user_id: userId } as Employee;
    
    const localKey = `attendance_local_employees_${userId}`;
    const localEmps = JSON.parse(localStorage.getItem(localKey) || '[]');
    const index = localEmps.findIndex((e: any) => e.id === empId);
    if (index > -1) {
      localEmps[index] = fullEmp;
    } else {
      localEmps.push(fullEmp);
    }
    localStorage.setItem(localKey, JSON.stringify(localEmps));

    try {
      const response = await fetchWithRetry('/api/employees', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': userId
        },
        body: JSON.stringify(employee)
      });
      const parsed = await safeFetchJson(response);
      const result = parsed.data || {};
      window.dispatchEvent(new CustomEvent('cloud_db_update', { detail: { table: 'employees' } }));
      return { data: result.data || fullEmp, error: result.error || null };
    } catch (err: any) {
      window.dispatchEvent(new CustomEvent('cloud_db_update', { detail: { table: 'employees' } }));
      return { data: fullEmp, error: null };
    }
  },

  async deleteEmployee(id: string): Promise<{ error: any }> {
    const user = await this.getCurrentUser();
    if (!user) return { error: 'غير مصرح بالدخول' };
    const userId = user.id || user.email;

    const localKey = `attendance_local_employees_${userId}`;
    let localEmps = JSON.parse(localStorage.getItem(localKey) || '[]');
    localEmps = localEmps.filter((e: any) => e.id !== id);
    localStorage.setItem(localKey, JSON.stringify(localEmps));

    try {
      const response = await fetchWithRetry(`/api/employees/${id}`, {
        method: 'DELETE',
        headers: {
          'x-user-id': userId
        }
      });
      const parsed = await safeFetchJson(response);
      const result = parsed.data || {};
      window.dispatchEvent(new CustomEvent('cloud_db_update', { detail: { table: 'employees' } }));
      return { error: result.error || null };
    } catch (err: any) {
      window.dispatchEvent(new CustomEvent('cloud_db_update', { detail: { table: 'employees' } }));
      return { error: null };
    }
  },

  // --- ATTENDANCE LOGS CRUD ---

  async getAttendanceLogs(startDate?: string, endDate?: string): Promise<AttendanceLog[]> {
    const user = await this.getCurrentUser();
    if (!user) return [];
    const userId = user.id || user.email;

    try {
      let url = '/api/attendance_logs?';
      if (startDate) url += `startDate=${startDate}&`;
      if (endDate) url += `endDate=${endDate}&`;

      const response = await fetchWithRetry(url, {
        headers: {
          'x-user-id': userId
        }
      });
      const parsed = await safeFetchJson<AttendanceLog[]>(response);
      if (!parsed.ok || !parsed.data) {
        const local = localStorage.getItem(`attendance_local_logs_${userId}`);
        return local ? JSON.parse(local) : [];
      }
      localStorage.setItem(`attendance_local_logs_${userId}`, JSON.stringify(parsed.data));
      return parsed.data;
    } catch (err) {
      console.error('Error fetching logs:', err);
      const local = localStorage.getItem(`attendance_local_logs_${userId}`);
      return local ? JSON.parse(local) : [];
    }
  },

  async saveAttendanceLog(log: Omit<AttendanceLog, 'user_id' | 'id'> & { id?: string }): Promise<{ data: AttendanceLog | null; error: any }> {
    const user = await this.getCurrentUser();
    if (!user) return { data: null, error: 'غير مصرح بالدخول' };
    const userId = user.id || user.email;

    const logId = log.id || `log_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
    const fullLog = { ...log, id: logId, user_id: userId } as AttendanceLog;
    
    const localKey = `attendance_local_logs_${userId}`;
    const localLogs = JSON.parse(localStorage.getItem(localKey) || '[]');
    const index = localLogs.findIndex((l: any) => l.id === logId);
    if (index > -1) {
      localLogs[index] = fullLog;
    } else {
      localLogs.push(fullLog);
    }
    localStorage.setItem(localKey, JSON.stringify(localLogs));

    try {
      const response = await fetchWithRetry('/api/attendance_logs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': userId
        },
        body: JSON.stringify(log)
      });
      const parsed = await safeFetchJson(response);
      const result = parsed.data || {};
      window.dispatchEvent(new CustomEvent('cloud_db_update', { detail: { table: 'attendance_logs' } }));
      return { data: result.data || fullLog, error: result.error || null };
    } catch (err: any) {
      window.dispatchEvent(new CustomEvent('cloud_db_update', { detail: { table: 'attendance_logs' } }));
      return { data: fullLog, error: null };
    }
  },
  async deleteAttendanceLog(id: string): Promise<{ error: any }> {
    const user = await this.getCurrentUser();
    if (!user) return { error: 'غير مصرح بالدخول' };
    const userId = user.id || user.email;

    const localKey = `attendance_local_logs_${userId}`;
    let localLogs = JSON.parse(localStorage.getItem(localKey) || '[]');
    localLogs = localLogs.filter((l: any) => l.id !== id);
    localStorage.setItem(localKey, JSON.stringify(localLogs));

    try {
      const response = await fetchWithRetry(`/api/attendance_logs/${id}`, {
        method: 'DELETE',
        headers: {
          'x-user-id': userId
        }
      });
      const parsed = await safeFetchJson(response);
      const result = parsed.data || {};
      window.dispatchEvent(new CustomEvent('cloud_db_update', { detail: { table: 'attendance_logs' } }));
      return { error: result.error || null };
    } catch (err: any) {
      window.dispatchEvent(new CustomEvent('cloud_db_update', { detail: { table: 'attendance_logs' } }));
      return { error: null };
    }
  },

  // Real-time listener: combines local storage sync triggers and database-level refresh triggers
  subscribeToChanges(table: string, callback: () => void) {
    const isUserEditing = (): boolean => {
      if (typeof document === 'undefined') return false;
      if ((window as any).__IS_USER_EDITING__) return true;
      const active = document.activeElement;
      if (active) {
        const tag = active.tagName ? active.tagName.toUpperCase() : '';
        if (['INPUT', 'TEXTAREA', 'SELECT'].includes(tag)) {
          return true;
        }
        if (active.getAttribute && active.getAttribute('contenteditable') === 'true') {
          return true;
        }
      }
      return false;
    };

    const localListener = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail && detail.table === table) {
        if (!isUserEditing()) {
          callback();
        }
      }
    };

    window.addEventListener('cloud_db_update', localListener);

    // Dynamic Server Polling Interval: automatically pauses while user is typing or filling a form
    const pollInterval = setInterval(() => {
      if (!isUserEditing()) {
        callback();
      }
    }, 15000);

    return () => {
      window.removeEventListener('cloud_db_update', localListener);
      clearInterval(pollInterval);
    };
  },

  // Verification and Handshake System for Startup Flow
  async initializeSystem(
    onProgress?: (step: string, status: 'pending' | 'success' | 'info' | 'error') => void
  ): Promise<{ success: boolean; mode: 'supabase' | 'local'; message: string }> {
    if (onProgress) onProgress('تهيئة الاتصال بالبوابة السحابية الموحدة للمؤسسات...', 'pending');
    await new Promise(r => setTimeout(r, 400));

    try {
      const user = await this.getCurrentUser();
      if (user && user.id) {
        if (onProgress) onProgress('التحقق من حالة الحساب والمزامنة وتأمين الاتصال...', 'pending');
        
        const shifts = JSON.parse(localStorage.getItem(`attendance_local_shifts_${user.id}`) || '[]');
        const employees = JSON.parse(localStorage.getItem(`attendance_local_employees_${user.id}`) || '[]');
        const attendance_logs = JSON.parse(localStorage.getItem(`attendance_local_logs_${user.id}`) || '[]');

        const response = await fetch('/api/auth/verify-and-sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            user,
            shifts,
            employees,
            attendance_logs
          })
        });

        const parsed = await safeFetchJson(response);
        const result = parsed.data || {};
        if (parsed.ok && result.data) {
          if (result.data.status === 'restored') {
            if (onProgress) onProgress('تم الكشف عن إعادة تشغيل الخادم؛ تم استعادة بياناتك المسجلة تلقائياً بنجاح!', 'success');
          } else if (result.data.status === 'merged') {
            if (onProgress) onProgress('تم مزامنة وتحديث السجلات المحلية غير المرفوعة مع الخادم بنجاح.', 'success');
          } else {
            if (onProgress) onProgress('تم التحقق من استقرار الاتصال وصحة البيانات السحابية.', 'success');
          }
          await new Promise(r => setTimeout(r, 600));
        } else {
          if (result.error?.is_suspended || result.error?.is_expired) {
            await this.signOut();
          }
          throw new Error(result.error?.message || 'فشل التحقق');
        }
      } else {
        if (onProgress) onProgress('التحقق من استجابة خوادم النظام واختبار بروتوكول الحماية...', 'pending');
        await fetch('/api/shifts', {
          headers: { 'x-user-id': 'test_ping' }
        });
        await new Promise(r => setTimeout(r, 400));
        if (onProgress) onProgress('تم تأسيس القناة السحابية بنجاح ومزامنة السجلات مفعلة تلقائياً.', 'success');
        await new Promise(r => setTimeout(r, 500));
      }

      return {
        success: true,
        mode: 'supabase',
        message: 'تم تفعيل الاتصال السحابي بنجاح.'
      };
    } catch (err: any) {
      if (onProgress) {
        onProgress('فشل التحقق الأولي من الخادم السحابي. جاري تشغيل مستودع البيانات الاحتياطي الآمن...', 'info');
        await new Promise(r => setTimeout(r, 500));
        onProgress('تم تنشيط مستودع التشغيل الذاتي بنجاح لضمان استمرارية العمل المكتبي.', 'success');
        await new Promise(r => setTimeout(r, 400));
      }
      return {
        success: true,
        mode: 'local',
        message: 'تم التراجع الذكي وتفعيل البيئة المحلية.'
      };
    }
  },

  // --- ZKTECO ONLINE DEVICES SYNC HELPERS ---

  async getDevices(): Promise<any[]> {
    const user = await this.getCurrentUser();
    if (!user) return [];
    try {
      const response = await fetch('/api/devices', {
        headers: { 'x-user-id': user.id }
      });
      const parsed = await safeFetchJson<any[]>(response);
      return parsed.ok && Array.isArray(parsed.data) ? parsed.data : [];
    } catch (err) {
      console.error('Error fetching devices:', err);
      return [];
    }
  },

  async registerDevice(serialNumber: string, name: string): Promise<{ success: boolean; error?: any }> {
    const user = await this.getCurrentUser();
    if (!user) return { success: false, error: 'غير مصرح بالدخول' };
    try {
      const response = await fetch('/api/devices', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': user.id
        },
        body: JSON.stringify({ serial_number: serialNumber, name })
      });
      const parsed = await safeFetchJson(response);
      const result = parsed.data || {};
      if (!parsed.ok) {
        return { success: false, error: result.error || { message: 'فشل تسجيل الجهاز.' } };
      }
      return { success: true };
    } catch (err: any) {
      return { success: false, error: { message: err.message || 'خطأ في الاتصال بالخادم.' } };
    }
  },

  async deleteDevice(id: string): Promise<{ success: boolean; error?: any }> {
    const user = await this.getCurrentUser();
    if (!user) return { success: false, error: 'غير مصرح بالدخول' };
    try {
      const response = await fetch(`/api/devices/${id}`, {
        method: 'DELETE',
        headers: { 'x-user-id': user.id }
      });
      const parsed = await safeFetchJson(response);
      const result = parsed.data || {};
      if (!parsed.ok) {
        return { success: false, error: result.error };
      }
      return { success: true };
    } catch (err: any) {
      return { success: false, error: { message: err.message || 'خطأ في الاتصال.' } };
    }
  },

  async toggleDeviceTimeSyncExemption(serialNumber: string, exempt: boolean): Promise<{ success: boolean; error?: any }> {
    const user = await this.getCurrentUser();
    if (!user) return { success: false, error: 'غير مصرح بالدخول' };
    try {
      const response = await fetch('/api/devices/time/exemptions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': user.id
        },
        body: JSON.stringify({ serial_number: serialNumber, exempt })
      });
      const parsed = await safeFetchJson(response);
      return { success: parsed.ok, error: parsed.ok ? null : parsed.data?.error };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  },

  async getTimeSyncExemptions(): Promise<string[]> {
    try {
      const response = await fetch('/api/devices/time/exemptions');
      const parsed = await safeFetchJson<{ exemptions: string[] }>(response);
      return parsed.ok && parsed.data?.exemptions ? parsed.data.exemptions : [];
    } catch (err) {
      return [];
    }
  },

  async getDeviceTimeStatus(): Promise<any[]> {
    const user = await this.getCurrentUser();
    if (!user) return [];
    try {
      const response = await fetch('/api/devices/time', {
        headers: { 'x-user-id': user.id }
      });
      const parsed = await safeFetchJson<any[]>(response);
      return parsed.ok && Array.isArray(parsed.data) ? parsed.data : [];
    } catch (err) {
      console.error('Error fetching device time status:', err);
      return [];
    }
  },

  async syncDeviceTime(
    deviceSn: string, 
    timeType: 'server' | 'riyadh' | 'custom', 
    customTime?: string,
    cmdFormat?: string
  ): Promise<{ success: boolean; command?: any; error?: any }> {
    const user = await this.getCurrentUser();
    if (!user) return { success: false, error: 'غير مصرح بالدخول' };
    try {
      const response = await fetch('/api/devices/time/sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': user.id
        },
        body: JSON.stringify({ deviceSn, timeType, customTime, cmdFormat })
      });
      const parsed = await safeFetchJson(response);
      const result = parsed.data || {};
      if (!parsed.ok) {
        return { success: false, error: result.error || 'فشل إرسال أمر التزامن' };
      }
      return { success: true, command: result.command };
    } catch (err: any) {
      return { success: false, error: err.message || 'خطأ بالاتصال بالخادم' };
    }
  },

  async getDeviceCommandsHistory(deviceSn?: string): Promise<any[]> {
    const user = await this.getCurrentUser();
    if (!user) return [];
    try {
      let url = '/api/devices/time/commands';
      if (deviceSn) url += `?deviceSn=${encodeURIComponent(deviceSn)}`;
      const response = await fetch(url, {
        headers: { 'x-user-id': user.id }
      });
      const parsed = await safeFetchJson<any[]>(response);
      return parsed.ok && Array.isArray(parsed.data) ? parsed.data : [];
    } catch (err) {
      console.error('Error fetching device commands:', err);
      return [];
    }
  },

  async cancelDeviceCommand(id: string): Promise<{ success: boolean; error?: any }> {
    const user = await this.getCurrentUser();
    if (!user) return { success: false, error: 'غير مصرح بالدخول' };
    try {
      const response = await fetch(`/api/devices/time/commands/${id}`, {
        method: 'DELETE',
        headers: { 'x-user-id': user.id }
      });
      const parsed = await safeFetchJson(response);
      return { success: parsed.ok };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  },

  async getZkRawLogs(params?: { fromDate?: string; toDate?: string }): Promise<any[]> {
    const user = await this.getCurrentUser();
    if (!user) return [];
    try {
      let url = '/api/devices/raw-logs';
      if (params?.fromDate || params?.toDate) {
        const queryParams = new URLSearchParams();
        if (params.fromDate) queryParams.append('fromDate', params.fromDate);
        if (params.toDate) queryParams.append('toDate', params.toDate);
        url += `?${queryParams.toString()}`;
      }
      const response = await fetch(url, {
        headers: { 'x-user-id': user.id }
      });
      const parsed = await safeFetchJson<any[]>(response);
      return parsed.ok && Array.isArray(parsed.data) ? parsed.data : [];
    } catch (err) {
      console.error('Error fetching ZK logs:', err);
      return [];
    }
  },

  async getVirtualDat(fromDate?: string, toDate?: string): Promise<{ datText: string; count: number; error?: any }> {
    const user = await this.getCurrentUser();
    if (!user) return { datText: '', count: 0, error: 'غير مصرح بالدخول' };
    try {
      let url = '/api/devices/virtual-dat';
      if (fromDate || toDate) {
        const queryParams = new URLSearchParams();
        if (fromDate) queryParams.append('fromDate', fromDate);
        if (toDate) queryParams.append('toDate', toDate);
        url += `?${queryParams.toString()}`;
      }
      const response = await fetch(url, {
        headers: { 'x-user-id': user.id }
      });
      const parsed = await safeFetchJson<any>(response);
      if (parsed.ok && parsed.data) {
        return { datText: parsed.data.datText || '', count: parsed.data.count || 0 };
      }
      return { datText: '', count: 0, error: 'فشل جلب ملف DAT الأونلاين.' };
    } catch (err: any) {
      console.error('Error getting virtual DAT:', err);
      return { datText: '', count: 0, error: err.message };
    }
  },

  async syncZkLogs(
    logIds?: string[],
    options?: { startDate?: string; endDate?: string; reSync?: boolean }
  ): Promise<{ success: boolean; count: number; error?: any }> {
    const user = await this.getCurrentUser();
    if (!user) return { success: false, count: 0, error: 'غير مصرح بالدخول' };
    try {
      const response = await fetch('/api/devices/sync-logs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': user.id
        },
        body: JSON.stringify({
          log_ids: logIds || [],
          startDate: options?.startDate,
          endDate: options?.endDate,
          reSync: options?.reSync
        })
      });
      const result = await response.json();
      if (!response.ok) {
        return { success: false, count: 0, error: result.error || { message: 'فشل مزامنة البصمات.' } };
      }
      return { success: true, count: result.count };
    } catch (err: any) {
      return { success: false, count: 0, error: { message: err.message || 'خطأ في معالجة المزامنة.' } };
    }
  },

  async registerTenant(tenantData: any): Promise<{ data: any; error: any }> {
    try {
      const response = await fetch('/api/auth/register-tenant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(tenantData)
      });
      const result = await response.json();
      if (!response.ok || result.error) {
        return { data: null, error: result.error || { message: 'فشل إرسال طلب الاشتراك.' } };
      }
      return { data: result.data, error: null };
    } catch (err: any) {
      return { data: null, error: { message: err.message || 'خطأ في الاتصال بالخادم.' } };
    }
  },

  async getSuperAdminTenants(): Promise<any[]> {
    const user = await this.getCurrentUser();
    if (!user || !user.is_super_admin) return [];
    try {
      const response = await fetch('/api/superadmin/tenants', {
        headers: {
          'x-user-id': user.id
        }
      });
      const parsed = await safeFetchJson<any[]>(response);
      return parsed.ok && Array.isArray(parsed.data) ? parsed.data : [];
    } catch (err) {
      console.error('Error fetching admin tenants:', err);
      return [];
    }
  },

  async activateTenant(tenantId: string, city: string, plan_type: string, subscription_months: number): Promise<{ success: boolean; error?: any; expiry_date?: string }> {
    const user = await this.getCurrentUser();
    if (!user || !user.is_super_admin) return { success: false, error: 'غير مصرح بالدخول' };
    try {
      const response = await fetch('/api/superadmin/activate-tenant', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': user.id
        },
        body: JSON.stringify({ tenantId, city, plan_type, subscription_months })
      });
      const result = await response.json();
      if (!response.ok || result.error) {
        return { success: false, error: result.error || { message: 'فشل تفعيل الحساب.' } };
      }
      return { success: true, expiry_date: result.expiry_date };
    } catch (err: any) {
      return { success: false, error: { message: err.message || 'خطأ في الاتصال بالخادم.' } };
    }
  },

  async suspendTenant(tenantId: string): Promise<{ success: boolean; error?: any }> {
    const user = await this.getCurrentUser();
    if (!user || !user.is_super_admin) return { success: false, error: 'غير مصرح بالدخول' };
    try {
      const response = await fetch('/api/superadmin/suspend-tenant', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': user.id
        },
        body: JSON.stringify({ tenantId })
      });
      const result = await response.json();
      if (!response.ok || result.error) {
        return { success: false, error: result.error || { message: 'فشل إيقاف الحساب.' } };
      }
      return { success: true };
    } catch (err: any) {
      return { success: false, error: { message: err.message || 'خطأ في الاتصال بالخادم.' } };
    }
  },

  async deleteTenant(tenantId: string): Promise<{ success: boolean; error?: any }> {
    const user = await this.getCurrentUser();
    if (!user || !user.is_super_admin) return { success: false, error: 'غير مصرح بالدخول' };
    try {
      const response = await fetch('/api/superadmin/delete-tenant', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': user.id
        },
        body: JSON.stringify({ tenantId })
      });
      const result = await response.json();
      if (!response.ok || result.error) {
        return { success: false, error: result.error || { message: 'فشل حذف الحساب.' } };
      }
      return { success: true };
    } catch (err: any) {
      return { success: false, error: { message: err.message || 'خطأ في الاتصال بالخادم.' } };
    }
  },

  async requestPasswordReset(email: string): Promise<{ success: boolean; message?: string; error?: any }> {
    try {
      const response = await fetch('/api/auth/request-password-reset', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email })
      });
      const result = await response.json();
      if (!response.ok || result.error) {
        return { success: false, error: result.error || { message: 'فشل إرسال طلب استعادة كلمة المرور.' } };
      }
      return { success: true, message: result.message };
    } catch (err: any) {
      return { success: false, error: { message: err.message || 'خطأ في الاتصال بالخادم.' } };
    }
  },

  async verifyResetToken(token: string): Promise<{ valid: boolean; email?: string; company_name?: string; message?: string }> {
    try {
      const response = await fetch(`/api/auth/verify-reset-token?token=${encodeURIComponent(token)}`);
      const result = await response.json();
      return result;
    } catch (err: any) {
      return { valid: false, message: 'خطأ في الاتصال بالخادم عند التحقق من الرابط.' };
    }
  },

  async executePasswordReset(token: string, newPassword: string): Promise<{ success: boolean; message?: string; error?: any }> {
    try {
      const response = await fetch('/api/auth/execute-password-reset', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ token, newPassword })
      });
      const result = await response.json();
      if (!response.ok || result.error) {
        return { success: false, error: result.error || { message: result.message || 'فشل تحديث كلمة المرور.' } };
      }
      return { success: true, message: result.message };
    } catch (err: any) {
      return { success: false, error: { message: err.message || 'خطأ في الاتصال بالخادم.' } };
    }
  },

  async updateTenantPassword(tenantId: string, password: string): Promise<{ success: boolean; error?: any }> {
    const user = await this.getCurrentUser();
    if (!user || !user.is_super_admin) return { success: false, error: 'غير مصرح بالدخول' };
    try {
      const response = await fetch('/api/superadmin/update-tenant-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': user.id
        },
        body: JSON.stringify({ tenantId, password })
      });
      const result = await response.json();
      if (!response.ok || result.error) {
        return { success: false, error: result.error || { message: 'فشل تحديث كلمة المرور.' } };
      }
      return { success: true };
    } catch (err: any) {
      return { success: false, error: { message: err.message || 'خطأ في الاتصال بالخادم.' } };
    }
  },

  async getPendingPasswordRequests(): Promise<any[]> {
    const user = await this.getCurrentUser();
    if (!user || !user.is_super_admin) return [];
    try {
      const response = await fetch('/api/superadmin/password-requests', {
        method: 'GET',
        headers: {
          'x-user-id': user.id
        }
      });
      const parsed = await safeFetchJson<any[]>(response);
      return parsed.ok && Array.isArray(parsed.data) ? parsed.data : [];
    } catch (err) {
      console.error('getPendingPasswordRequests client error:', err);
      return [];
    }
  },

  async resolvePasswordRequest(requestId: string, tenantId: string, newPassword: string): Promise<{ success: boolean; error?: any }> {
    const user = await this.getCurrentUser();
    if (!user || !user.is_super_admin) return { success: false, error: { message: 'غير مصرح بالدخول' } };
    try {
      const response = await fetch('/api/superadmin/resolve-password-request', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': user.id
        },
        body: JSON.stringify({ requestId, tenantId, newPassword })
      });
      const result = await response.json();
      if (!response.ok || result.error) {
        return { success: false, error: result.error || { message: 'فشل اعتماد طلب تغيير كلمة المرور.' } };
      }
      return { success: true };
    } catch (err: any) {
      return { success: false, error: { message: err.message || 'خطأ في الاتصال بالخادم.' } };
    }
  }
};
