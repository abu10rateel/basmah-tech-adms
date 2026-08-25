/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import webpush from 'web-push';
import { initializeApp, getApps, App } from 'firebase-admin/app';
import { getMessaging } from 'firebase-admin/messaging';
import { firebaseDb } from '../db/firebaseDb';

// Stable, high-security VAPID keypair for Web Push & PWA Push Notifications
// These allow browser PushManager subscriptions to work natively across Chrome, Android PWA, iOS 16.4+ Safari PWA, Edge, Firefox
export const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || 'BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8U';
export const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || 'UUxI4qQpXwQ8kXkXv3YJ-b44c6-u6yM6Xm3i3pC5tU4';
export const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:admin@basmahtech.com';

// Configure web-push
try {
  webpush.setVapidDetails(
    VAPID_SUBJECT,
    VAPID_PUBLIC_KEY,
    VAPID_PRIVATE_KEY
  );
} catch (err) {
  console.warn('[PushService] Warning configuring webpush VAPID:', err);
}

// Configure Firebase Admin Messaging if not already initialized
let firebaseAdminApp: App | null = null;
try {
  const currentApps = getApps();
  if (currentApps && currentApps.length > 0) {
    firebaseAdminApp = currentApps[0]!;
  } else {
    firebaseAdminApp = initializeApp({
      projectId: process.env.FIREBASE_PROJECT_ID || 'wise-octagon-vwjkk'
    });
  }
} catch (err) {
  console.warn('[PushService] Firebase Admin app init note:', err);
}

export interface PushPayload {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  sound?: string;
  tag?: string;
  data?: Record<string, any>;
  actions?: Array<{ action: string; title: string }>;
}

export const pushService = {
  getVapidPublicKey() {
    return VAPID_PUBLIC_KEY;
  },

  /**
   * Save an admin device push subscription or FCM token
   */
  async subscribeAdmin(data: {
    userId: string;
    endpoint?: string;
    fcmToken?: string;
    subscriptionJson?: string;
    userAgent?: string;
    deviceName?: string;
  }) {
    return firebaseDb.savePushSubscription(data);
  },

  /**
   * Remove a push subscription
   */
  async unsubscribeAdmin(identifier: string) {
    return firebaseDb.deletePushSubscriptionByIdentifier(identifier);
  },

  /**
   * Send push notification to a specific tenant's admin devices
   */
  async sendNotificationToUser(userId: string, payload: PushPayload) {
    const subscriptions = await firebaseDb.getPushSubscriptions(userId);
    if (!subscriptions || subscriptions.length === 0) {
      console.log(`[PushService] No registered push subscriptions for user ${userId}`);
      return { sentCount: 0, total: 0 };
    }

    console.log(`[PushService] Dispatching push notification to ${subscriptions.length} devices for user ${userId}: "${payload.title}"`);
    let successCount = 0;

    const promises = subscriptions.map(async (sub) => {
      // 1. Try FCM Token if present
      if (sub.fcmToken && firebaseAdminApp) {
        try {
          await getMessaging(firebaseAdminApp).send({
            token: sub.fcmToken,
            notification: {
              title: payload.title,
              body: payload.body,
              imageUrl: payload.icon || '/icon-192.png'
            },
            data: {
              ...(payload.data ? Object.fromEntries(Object.entries(payload.data).map(([k, v]) => [k, String(v)])) : {}),
              title: payload.title,
              body: payload.body,
              sound: payload.sound || '/notification.mp3',
              tag: payload.tag || 'basma-punch'
            },
            webpush: {
              notification: {
                title: payload.title,
                body: payload.body,
                icon: payload.icon || '/icon-192.png',
                badge: payload.badge || '/favicon.png',
                tag: payload.tag || 'basma-punch',
                renotify: true,
                requireInteraction: true
              },
              fcmOptions: {
                link: payload.data?.url || '/'
              }
            }
          });
          successCount++;
          return;
        } catch (fcmErr: any) {
          console.warn(`[PushService] FCM send error for token:`, fcmErr.message);
          if (fcmErr.code === 'messaging/registration-token-not-registered' || fcmErr.code === 'messaging/invalid-registration-token') {
            await firebaseDb.deletePushSubscription(sub.id);
          }
        }
      }

      // 2. Try Standard Web Push (via subscriptionJson or endpoint)
      if (sub.subscriptionJson || sub.endpoint) {
        try {
          let pushSubObj: any = null;
          if (sub.subscriptionJson) {
            pushSubObj = typeof sub.subscriptionJson === 'string' ? JSON.parse(sub.subscriptionJson) : sub.subscriptionJson;
          } else if (sub.endpoint) {
            pushSubObj = { endpoint: sub.endpoint };
          }

          if (pushSubObj && pushSubObj.endpoint) {
            const pushData = JSON.stringify({
              title: payload.title,
              body: payload.body,
              icon: payload.icon || '/icon-192.png',
              badge: payload.badge || '/favicon.png',
              sound: payload.sound || '/notification.mp3',
              tag: payload.tag || 'basma-punch',
              data: {
                url: payload.data?.url || '/',
                timestamp: Date.now(),
                ...payload.data
              },
              actions: payload.actions || [
                { action: 'open_app', title: 'عرض السجلات' }
              ]
            });

            await webpush.sendNotification(pushSubObj, pushData, {
              TTL: 86400,
              urgency: 'high'
            });
            successCount++;
          }
        } catch (webPushErr: any) {
          console.warn(`[PushService] WebPush send error for sub ${sub.id}:`, webPushErr.message);
          if (webPushErr.statusCode === 404 || webPushErr.statusCode === 410) {
            // Subscription has expired or user revoked permissions
            console.log(`[PushService] Removing expired subscription ${sub.id}`);
            await firebaseDb.deletePushSubscription(sub.id);
          }
        }
      }
    });

    await Promise.allSettled(promises);
    return { sentCount: successCount, total: subscriptions.length };
  },

  /**
   * Broadcast push notification to ALL registered admins (or for a device)
   */
  async sendNotificationToAllAdmins(payload: PushPayload) {
    const allSubs = await firebaseDb.getPushSubscriptions();
    if (!allSubs || allSubs.length === 0) {
      console.log('[PushService] No admin devices registered for push notifications.');
      return { sentCount: 0, total: 0 };
    }

    const userIds = Array.from(new Set(allSubs.map(s => s.userId).filter(Boolean)));
    let totalSent = 0;
    for (const uId of userIds) {
      const res = await this.sendNotificationToUser(uId, payload);
      totalSent += res.sentCount;
    }
    return { sentCount: totalSent, total: allSubs.length };
  },

  /**
   * Process a raw biometric punch from ZKTeco device and send instant push notification to the device owner (Admin)
   */
  async sendPunchPushNotification(params: {
    sn: string;
    pin: string;
    timestamp: string;
    status: number | string;
  }) {
    try {
      const { sn, pin, timestamp, status } = params;
      console.log(`[PushService] Processing biometric punch for push notification: SN=${sn}, PIN=${pin}, Time=${timestamp}, Status=${status}`);

      // 1. Identify device and tenant user
      const device = await firebaseDb.getDeviceBySerialNumber(sn);
      const userId = device?.user_id;
      const deviceName = device?.name || `جهاز (${sn})`;

      let employeeName = `الموظف (${pin})`;
      let department = '';

      // 2. Lookup employee details if user_id is known
      if (userId) {
        try {
          const emp = await firebaseDb.getEmployeeByEmpId(userId, pin);
          if (emp) {
            employeeName = emp.name || employeeName;
            department = emp.department || '';
          }
        } catch (e) {
          console.warn('[PushService] Error querying employee for push:', e);
        }
      }

      // 3. Determine punch status in Arabic
      const statusCode = Number(status);
      let punchLabel = 'تسجيل بصمة ⏱️';
      if (statusCode === 0) {
        punchLabel = 'تسجيل دخول 🟢';
      } else if (statusCode === 1) {
        punchLabel = 'تسجيل خروج 🔴';
      } else if (statusCode === 2) {
        punchLabel = 'استراحة - خروج ☕';
      } else if (statusCode === 3) {
        punchLabel = 'استراحة - عودة 💼';
      } else if (statusCode === 4) {
        punchLabel = 'وقت إضافي - دخول ⏳';
      } else if (statusCode === 5) {
        punchLabel = 'وقت إضافي - خروج 🏁';
      }

      // Format time
      let timeFormatted = timestamp;
      try {
        const timeParts = timestamp.split(' ');
        if (timeParts.length > 1) {
          timeFormatted = timeParts[1];
        }
      } catch {}

      const notificationTitle = `بصمة تك: ${punchLabel} - ${employeeName}`;
      const notificationBody = `سجل ${employeeName}${department ? ` (${department})` : ''} بصمة ${punchLabel} في الساعة ${timeFormatted} عبر ${deviceName}`;

      const payload: PushPayload = {
        title: notificationTitle,
        body: notificationBody,
        icon: '/icon-192.png',
        badge: '/favicon.png',
        sound: '/notification.mp3',
        tag: `punch-${pin}-${Date.now()}`,
        data: {
          url: '/',
          sn,
          pin,
          employeeName,
          punchType: punchLabel,
          timestamp,
          deviceName,
          type: 'BIOMETRIC_PUNCH'
        }
      };

      if (userId) {
        return await this.sendNotificationToUser(userId, payload);
      } else {
        // Broadcast to all admin devices as fallback
        return await this.sendNotificationToAllAdmins(payload);
      }
    } catch (err) {
      console.error('[PushService] Error sending punch push notification:', err);
      return { sentCount: 0, total: 0 };
    }
  }
};
