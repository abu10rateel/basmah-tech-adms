/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { playNotificationSound } from './audioService';

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export interface PushStatus {
  supported: boolean;
  permission: NotificationPermission;
  subscribed: boolean;
  endpoint?: string;
}

let foregroundListeners: Array<(payload: any) => void> = [];

if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
  navigator.serviceWorker.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'PUSH_NOTIFICATION_RECEIVED') {
      console.log('[PushClient] Foreground push notification message received:', event.data.payload);
      // Play audio chime
      playNotificationSound();
      // Notify UI listeners
      foregroundListeners.forEach(fn => fn(event.data.payload));
    }
  });
}

export const pushClient = {
  /**
   * Check if push notifications are supported and permitted on this device
   */
  async checkStatus(): Promise<PushStatus> {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator) || !('Notification' in window)) {
      return { supported: false, permission: 'default', subscribed: false };
    }

    const permission = Notification.permission;
    let subscribed = false;
    let endpoint: string | undefined;

    try {
      const reg = await navigator.serviceWorker.getRegistration('/firebase-messaging-sw.js') 
        || await navigator.serviceWorker.getRegistration('/');
      if (reg && 'pushManager' in reg) {
        const sub = await reg.pushManager.getSubscription();
        if (sub) {
          subscribed = true;
          endpoint = sub.endpoint;
        }
      }
    } catch (e) {
      console.warn('[PushClient] Error checking push subscription:', e);
    }

    return {
      supported: true,
      permission,
      subscribed,
      endpoint
    };
  },

  /**
   * Request permission and subscribe the admin's device
   */
  async subscribe(userId: string): Promise<{ success: boolean; error?: string }> {
    try {
      if (!('serviceWorker' in navigator) || !('Notification' in window) || !('PushManager' in window)) {
        return { success: false, error: 'المتصفح أو الجهاز الحالي لا يدعم ميزة الإشعارات الفورية المباشرة.' };
      }

      // 1. Request permission
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        return { success: false, error: 'تم رفض إذن الإشعارات من قبل المستخدم. يرجى تفعيل الإذن من إعدادات المتصفح.' };
      }

      // 2. Register Service Worker
      let registration: ServiceWorkerRegistration;
      try {
        registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js', { scope: '/' });
        await navigator.serviceWorker.ready;
      } catch {
        registration = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
        await navigator.serviceWorker.ready;
      }

      // 3. Fetch VAPID Public Key from backend
      const keyRes = await fetch('/api/notifications/vapid-key');
      const keyData = await keyRes.json();
      const vapidPublicKey = keyData.publicKey;

      if (!vapidPublicKey) {
        throw new Error('تعذر استرداد مفتاح التشفير من الخادم.');
      }

      // 4. Subscribe via PushManager
      let subscription = await registration.pushManager.getSubscription();
      if (!subscription) {
        const convertedVapidKey = urlBase64ToUint8Array(vapidPublicKey);
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: convertedVapidKey
        });
      }

      // 5. Send subscription to backend
      const subJson = JSON.stringify(subscription);
      const subObj = subscription.toJSON ? subscription.toJSON() : null;

      const deviceName = /iPhone|iPad|iPod/i.test(navigator.userAgent) 
        ? 'iPhone / iOS PWA'
        : /Android/i.test(navigator.userAgent)
        ? 'هاتف Android'
        : /Macintosh/i.test(navigator.userAgent)
        ? 'جهاز Mac'
        : /Windows/i.test(navigator.userAgent)
        ? 'كمبيوتر Windows'
        : 'متصفح ويب';

      const saveRes = await fetch('/api/notifications/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          endpoint: subscription.endpoint,
          subscriptionJson: subJson,
          keys: subObj?.keys || null,
          userAgent: navigator.userAgent,
          deviceName
        })
      });

      if (!saveRes.ok) {
        throw new Error('فشل حفظ تسجيل الإشعارات في قاعدة البيانات.');
      }

      // Play activation chime
      playNotificationSound();

      return { success: true };
    } catch (err: any) {
      console.error('[PushClient] Subscribe error:', err);
      return { success: false, error: err.message || 'حدث خطأ أثناء تفعيل الإشعارات' };
    }
  },

  /**
   * Unsubscribe this device from push notifications
   */
  async unsubscribe(userId: string): Promise<{ success: boolean; error?: string }> {
    try {
      if ('serviceWorker' in navigator) {
        const reg = await navigator.serviceWorker.getRegistration('/firebase-messaging-sw.js') 
          || await navigator.serviceWorker.getRegistration('/');
        if (reg && 'pushManager' in reg) {
          const sub = await reg.pushManager.getSubscription();
          if (sub) {
            const endpoint = sub.endpoint;
            await sub.unsubscribe();
            await fetch('/api/notifications/unsubscribe', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ userId, endpoint })
            });
          }
        }
      }
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || 'فشل إلغاء الاشتراك' };
    }
  },

  /**
   * Send a live test notification to verify delivery on this device
   */
  async sendTestNotification(userId: string): Promise<{ success: boolean; message: string }> {
    try {
      const res = await fetch('/api/notifications/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'فشل إرسال الإشعار التجريبي');
      }
      return { success: true, message: data.message || 'تم إرسال الإشعار التجريبي بنجاح!' };
    } catch (err: any) {
      return { success: false, message: err.message || 'خطأ في إرسال الإشعار التجريبي' };
    }
  },

  /**
   * Register a foreground message listener
   */
  onForegroundMessage(callback: (payload: any) => void) {
    foregroundListeners.push(callback);
    return () => {
      foregroundListeners = foregroundListeners.filter(fn => fn !== callback);
    };
  }
};
