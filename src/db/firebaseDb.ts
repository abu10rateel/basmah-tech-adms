/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import fs from 'fs';
import path from 'path';
import { initializeApp } from 'firebase/app';
import {
  getFirestore,
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  writeBatch,
  limit
} from 'firebase/firestore';

// Load config
const configPath = path.join(process.cwd(), 'firebase-applet-config.json');
let firebaseConfig: any = {};
if (fs.existsSync(configPath)) {
  try {
    firebaseConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  } catch (err) {
    console.error('Failed to parse firebase-applet-config.json:', err);
  }
}

// Initialize Firebase App and Firestore using client-side SDK on the server
const app = initializeApp(firebaseConfig);
const db = getFirestore(app, firebaseConfig.firestoreDatabaseId || '(default)');

export const firebaseDb = {
  // --- TENANTS ---
  async getTenantByEmail(email: string) {
    try {
      const q = query(
        collection(db, 'tenants'),
        where('email', '==', email.trim().toLowerCase())
      );
      const snap = await getDocs(q);
      if (snap.empty) return null;
      const docSnap = snap.docs[0];
      return { id: docSnap.id, ...docSnap.data() } as any;
    } catch (err) {
      console.error('getTenantByEmail error:', err);
      throw err;
    }
  },

  async getTenantByResetToken(token: string) {
    try {
      if (!token) return null;
      const q = query(
        collection(db, 'tenants'),
        where('reset_token', '==', token)
      );
      const snap = await getDocs(q);
      if (snap.empty) return null;
      const docSnap = snap.docs[0];
      return { id: docSnap.id, ...docSnap.data() } as any;
    } catch (err) {
      console.error('getTenantByResetToken error:', err);
      throw err;
    }
  },

  async getTenantById(id: string) {
    try {
      const docRef = doc(db, 'tenants', id);
      const snap = await getDoc(docRef);
      if (!snap.exists()) return null;
      return { id: snap.id, ...snap.data() } as any;
    } catch (err) {
      console.error('getTenantById error:', err);
      throw err;
    }
  },

  async saveTenant(tenant: any) {
    try {
      const docRef = doc(db, 'tenants', tenant.id);
      await setDoc(docRef, {
        status: 'active', // Default for legacy or if not specified
        ...tenant,
        email: tenant.email.trim().toLowerCase()
      });
      return tenant;
    } catch (err) {
      console.error('saveTenant error:', err);
      throw err;
    }
  },

  async getAllTenants() {
    try {
      const snap = await getDocs(collection(db, 'tenants'));
      return snap.docs.map(d => ({ id: d.id, ...d.data() })) as any[];
    } catch (err) {
      console.error('getAllTenants error:', err);
      throw err;
    }
  },

  async updateTenant(id: string, updates: any) {
    try {
      const docRef = doc(db, 'tenants', id);
      await updateDoc(docRef, updates);
      return { id, ...updates };
    } catch (err) {
      console.error('updateTenant error:', err);
      throw err;
    }
  },

  async deleteTenant(id: string) {
    try {
      const docRef = doc(db, 'tenants', id);
      await deleteDoc(docRef);
      return { id, success: true };
    } catch (err) {
      console.error('deleteTenant error:', err);
      throw err;
    }
  },

  // --- SHIFTS ---
  async getShifts(userId: string) {
    try {
      const q = query(
        collection(db, 'shifts'),
        where('user_id', '==', userId)
      );
      const snap = await getDocs(q);
      return snap.docs.map(d => ({ id: d.id, ...d.data() })) as any[];
    } catch (err) {
      console.error('getShifts error:', err);
      throw err;
    }
  },

  async saveShift(shift: any) {
    try {
      const docRef = doc(db, 'shifts', shift.id);
      await setDoc(docRef, shift);
      return shift;
    } catch (err) {
      console.error('saveShift error:', err);
      throw err;
    }
  },

  async deleteShift(id: string) {
    try {
      const docRef = doc(db, 'shifts', id);
      await deleteDoc(docRef);
    } catch (err) {
      console.error('deleteShift error:', err);
      throw err;
    }
  },

  // --- EMPLOYEES ---
  async getEmployees(userId: string) {
    try {
      const q = query(
        collection(db, 'employees'),
        where('user_id', '==', userId)
      );
      const snap = await getDocs(q);
      return snap.docs.map(d => ({ id: d.id, ...d.data() })) as any[];
    } catch (err) {
      console.error('getEmployees error:', err);
      throw err;
    }
  },

  async getEmployeeByEmpId(userId: string, empId: string) {
    try {
      const q = query(
        collection(db, 'employees'),
        where('user_id', '==', userId),
        where('emp_id', '==', empId)
      );
      const snap = await getDocs(q);
      if (snap.empty) return null;
      const docSnap = snap.docs[0];
      return { id: docSnap.id, ...docSnap.data() } as any;
    } catch (err) {
      console.error('getEmployeeByEmpId error:', err);
      throw err;
    }
  },

  async saveEmployee(employee: any) {
    try {
      const docRef = doc(db, 'employees', employee.id);
      await setDoc(docRef, employee);
      return employee;
    } catch (err) {
      console.error('saveEmployee error:', err);
      throw err;
    }
  },

  async deleteEmployee(id: string) {
    try {
      const docRef = doc(db, 'employees', id);
      await deleteDoc(docRef);
    } catch (err) {
      console.error('deleteEmployee error:', err);
      throw err;
    }
  },

  // --- ATTENDANCE LOGS ---
  async getAttendanceLogs(userId: string) {
    try {
      const q = query(
        collection(db, 'attendance_logs'),
        where('user_id', '==', userId)
      );
      const snap = await getDocs(q);
      return snap.docs.map(d => ({ id: d.id, ...d.data() })) as any[];
    } catch (err) {
      console.error('getAttendanceLogs error:', err);
      throw err;
    }
  },

  async findAttendanceLog(employeeId: string, date: string) {
    try {
      const q = query(
        collection(db, 'attendance_logs'),
        where('employee_id', '==', employeeId),
        where('date', '==', date)
      );
      const snap = await getDocs(q);
      if (snap.empty) return null;
      const docSnap = snap.docs[0];
      return { id: docSnap.id, ...docSnap.data() } as any;
    } catch (err) {
      console.error('findAttendanceLog error:', err);
      throw err;
    }
  },

  async saveAttendanceLog(log: any) {
    try {
      const docRef = doc(db, 'attendance_logs', log.id);
      await setDoc(docRef, log);
      return log;
    } catch (err) {
      console.error('saveAttendanceLog error:', err);
      throw err;
    }
  },

  async deleteAttendanceLog(id: string) {
    try {
      const docRef = doc(db, 'attendance_logs', id);
      await deleteDoc(docRef);
    } catch (err) {
      console.error('deleteAttendanceLog error:', err);
      throw err;
    }
  },

  // --- DEVICES ---
  async getDevices(userId: string) {
    try {
      const q = query(
        collection(db, 'devices'),
        where('user_id', '==', userId)
      );
      const snap = await getDocs(q);
      return snap.docs.map(d => ({ id: d.id, ...d.data() })) as any[];
    } catch (err) {
      console.error('getDevices error:', err);
      throw err;
    }
  },

  async getDeviceBySerialNumber(serialNumber: string) {
    try {
      const q = query(
        collection(db, 'devices'),
        where('serial_number', '==', serialNumber.trim().toUpperCase())
      );
      const snap = await getDocs(q);
      if (snap.empty) return null;
      const docSnap = snap.docs[0];
      return { id: docSnap.id, ...docSnap.data() } as any;
    } catch (err) {
      console.error('getDeviceBySerialNumber error:', err);
      throw err;
    }
  },

  async saveDevice(device: any) {
    try {
      const docRef = doc(db, 'devices', device.id);
      await setDoc(docRef, device);
      return device;
    } catch (err) {
      console.error('saveDevice error:', err);
      throw err;
    }
  },

  async deleteDevice(id: string) {
    try {
      const docRef = doc(db, 'devices', id);
      await deleteDoc(docRef);
    } catch (err) {
      console.error('deleteDevice error:', err);
      throw err;
    }
  },

  // --- ZK RAW LOGS ---
  async checkRawLogExists(sn: string, pin: string, timestamp: string) {
    try {
      const q = query(
        collection(db, 'zk_raw_logs'),
        where('sn', '==', sn),
        where('pin', '==', pin),
        where('timestamp', '==', timestamp)
      );
      const snap = await getDocs(q);
      return !snap.empty;
    } catch (err) {
      console.error('checkRawLogExists error:', err);
      throw err;
    }
  },

  async saveRawLog(log: any) {
    try {
      const docRef = doc(db, 'zk_raw_logs', log.id);
      await setDoc(docRef, log);
      return log;
    } catch (err) {
      console.error('saveRawLog error:', err);
      throw err;
    }
  },

  async getRawLogsBySerialNumbers(sns: string[]) {
    try {
      if (sns.length === 0) return [];
      const results: any[] = [];
      const chunks: string[][] = [];
      for (let i = 0; i < sns.length; i += 10) {
        chunks.push(sns.slice(i, i + 10));
      }

      for (const chunk of chunks) {
        const q = query(
          collection(db, 'zk_raw_logs'),
          where('sn', 'in', chunk)
        );
        const snap = await getDocs(q);
        snap.docs.forEach(d => results.push({ id: d.id, ...d.data() }));
      }
      return results;
    } catch (err) {
      console.error('getRawLogsBySerialNumbers error:', err);
      throw err;
    }
  },

  async markRawLogsSynced(ids: string[]) {
    try {
      if (ids.length === 0) return;
      const chunks: string[][] = [];
      for (let i = 0; i < ids.length; i += 500) {
        chunks.push(ids.slice(i, i + 500));
      }

      for (const chunk of chunks) {
        const batch = writeBatch(db);
        chunk.forEach(id => {
          const docRef = doc(db, 'zk_raw_logs', id);
          batch.update(docRef, { synced: true });
        });
        await batch.commit();
      }
    } catch (err) {
      console.error('markRawLogsSynced error:', err);
      throw err;
    }
  },

  async createPasswordRequest(email: string, tenantId: string) {
    try {
      const id = `req_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
      const docRef = doc(db, 'password_requests', id);
      const reqDoc = {
        id,
        email: email.trim().toLowerCase(),
        uid: tenantId,
        status: 'pending',
        requested_at: new Date().toISOString()
      };
      await setDoc(docRef, reqDoc);
      return reqDoc;
    } catch (err) {
      console.error('createPasswordRequest error:', err);
      throw err;
    }
  },

  async getPendingPasswordRequests() {
    try {
      const q = query(
        collection(db, 'password_requests'),
        where('status', '==', 'pending')
      );
      const snap = await getDocs(q);
      return snap.docs.map(d => ({ id: d.id, ...d.data() })) as any[];
    } catch (err) {
      console.error('getPendingPasswordRequests error:', err);
      throw err;
    }
  },

  async updatePasswordRequestStatus(id: string, status: string) {
    try {
      const docRef = doc(db, 'password_requests', id);
      await updateDoc(docRef, { status });
      return { id, status };
    } catch (err) {
      console.error('updatePasswordRequestStatus error:', err);
      throw err;
    }
  },

  // --- DEVICE COMMANDS ---
  async createDeviceCommand(data: { deviceSn: string; command?: string; time: string; userId?: string }) {
    try {
      const id = `cmd_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
      const docRef = doc(db, 'device_commands', id);
      const cmdDoc = {
        id,
        deviceSn: data.deviceSn.trim().toUpperCase(),
        command: data.command || 'ALL_FORMATS',
        time: data.time,
        userId: data.userId || null,
        createdAt: new Date().toISOString(),
        status: 'pending', // 'pending' | 'delivered' | 'success' | 'failed'
        sent: false,
        deliveredAt: null,
        confirmedAt: null,
        returnCode: null,
        resultText: 'بانتظار اتصال جهاز البصمة للبدء'
      };
      await setDoc(docRef, cmdDoc);
      return cmdDoc;
    } catch (err) {
      console.error('createDeviceCommand error:', err);
      throw err;
    }
  },

  async getPendingDeviceCommands(deviceSn: string) {
    try {
      const q = query(
        collection(db, 'device_commands'),
        where('deviceSn', '==', deviceSn.trim().toUpperCase()),
        where('status', '==', 'pending')
      );
      const snap = await getDocs(q);
      return snap.docs.map(d => Object.assign({ id: d.id }, d.data())) as any[];
    } catch (err) {
      console.error('getPendingDeviceCommands error:', err);
      throw err;
    }
  },

  async markDeviceCommandDelivered(id: string) {
    try {
      const docRef = doc(db, 'device_commands', id);
      await updateDoc(docRef, {
        status: 'delivered',
        deliveredAt: new Date().toISOString(),
        resultText: 'تم تسليم الأمر للجهاز (بانتظار تأكيد شاشة الجهاز)'
      });
    } catch (err) {
      console.error('markDeviceCommandDelivered error:', err);
      throw err;
    }
  },

  async updateDeviceCommandResult(id: string, returnCode: string | number, rawPayload?: string) {
    try {
      const docRef = doc(db, 'device_commands', id);
      const isSuccess = String(returnCode) === '0';

      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const currentData = docSnap.data();
        if (currentData.status === 'success' && !isSuccess) {
          console.log(`[DeviceCommandResult] Command ${id} already succeeded. Ignoring returnCode ${returnCode} from secondary variant.`);
          return;
        }
      }

      await updateDoc(docRef, {
        status: isSuccess ? 'success' : 'failed',
        sent: true,
        returnCode: String(returnCode),
        confirmedAt: new Date().toISOString(),
        rawResult: rawPayload || null,
        resultText: isSuccess 
          ? 'تم تأكيد وتحديث وقت جهاز البصمة بنجاح (Return=0)' 
          : `رفض جهاز البصمة الأمر (Return=${returnCode})`
      });
    } catch (err) {
      console.error('updateDeviceCommandResult error:', err);
      throw err;
    }
  },

  async getDeviceCommands(userId?: string, deviceSn?: string) {
    try {
      const snap = await getDocs(collection(db, 'device_commands'));
      let list = snap.docs.map(d => Object.assign({ id: d.id }, d.data())) as any[];

      if (userId) {
        // Get serial numbers belonging to this tenant's devices
        const tenantDevices = await this.getDevices(userId);
        const userSns = new Set(tenantDevices.map(d => (d.serial_number || '').trim().toUpperCase()));

        list = list.filter(cmd => {
          if (cmd.userId && cmd.userId === userId) return true;
          if (cmd.deviceSn && userSns.has(cmd.deviceSn.trim().toUpperCase())) return true;
          return false;
        });
      }

      if (deviceSn) {
        const targetSn = deviceSn.trim().toUpperCase();
        list = list.filter(cmd => (cmd.deviceSn || '').trim().toUpperCase() === targetSn);
      }

      return list;
    } catch (err) {
      console.error('getDeviceCommands error:', err);
      throw err;
    }
  },

  async deleteDeviceCommand(id: string) {
    try {
      const docRef = doc(db, 'device_commands', id);
      await deleteDoc(docRef);
    } catch (err) {
      console.error('deleteDeviceCommand error:', err);
      throw err;
    }
  },

  // --- PUSH NOTIFICATION SUBSCRIPTIONS ---
  async savePushSubscription(data: {
    id?: string;
    userId: string;
    endpoint?: string;
    fcmToken?: string;
    subscriptionJson?: string;
    userAgent?: string;
    deviceName?: string;
  }) {
    try {
      // Find existing subscription with same endpoint or fcmToken to avoid duplicate records
      const identifier = data.endpoint || data.fcmToken;
      const subId = data.id || (identifier 
        ? `sub_${Buffer.from(identifier).toString('base64').replace(/[^a-zA-Z0-9]/g, '').substring(0, 32)}`
        : `sub_${Date.now()}_${Math.floor(Math.random() * 1000)}`);
      
      const docRef = doc(db, 'push_subscriptions', subId);
      const subDoc = {
        id: subId,
        userId: data.userId,
        endpoint: data.endpoint || '',
        fcmToken: data.fcmToken || '',
        subscriptionJson: data.subscriptionJson || '',
        userAgent: data.userAgent || '',
        deviceName: data.deviceName || 'Admin Device',
        lastActive: new Date().toISOString(),
        createdAt: new Date().toISOString()
      };
      await setDoc(docRef, subDoc, { merge: true });
      return subDoc;
    } catch (err) {
      console.error('savePushSubscription error:', err);
      throw err;
    }
  },

  async getPushSubscriptions(userId?: string) {
    try {
      let q;
      if (userId) {
        q = query(collection(db, 'push_subscriptions'), where('userId', '==', userId));
      } else {
        q = collection(db, 'push_subscriptions');
      }
      const snap = await getDocs(q);
      return snap.docs.map(d => ({ id: d.id, ...(d.data() as Record<string, any>) })) as any[];
    } catch (err) {
      console.error('getPushSubscriptions error:', err);
      return [];
    }
  },

  async deletePushSubscription(id: string) {
    try {
      const docRef = doc(db, 'push_subscriptions', id);
      await deleteDoc(docRef);
    } catch (err) {
      console.error('deletePushSubscription error:', err);
    }
  },

  async deletePushSubscriptionByIdentifier(identifier: string) {
    try {
      const snap = await getDocs(collection(db, 'push_subscriptions'));
      const batch = writeBatch(db);
      let count = 0;
      snap.docs.forEach(docSnap => {
        const data = docSnap.data();
        if (data.endpoint === identifier || data.fcmToken === identifier) {
          batch.delete(docSnap.ref);
          count++;
        }
      });
      if (count > 0) {
        await batch.commit();
      }
    } catch (err) {
      console.error('deletePushSubscriptionByIdentifier error:', err);
    }
  }
};
