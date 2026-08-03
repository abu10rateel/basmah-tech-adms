import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  // معرّف فريد للتطبيق (نفس الصيغة دي بتتطلبها Google Play وApp Store)
  appId: 'com.basmatech.attendance',

  // اسم التطبيق اللي هيظهر تحت الأيقونة
  appName: 'بصمة تك',

  // مجلد ملفات الويب المبنية (مش هيتستخدم فعليًا لأننا شغالين بـ server.url،
  // لكن Capacitor بيطلبه كـ fallback)
  webDir: 'dist/public',

  server: {
    url: 'https://basmah-tech.onrender.com',
    cleartext: false,
  },

  android: {
    allowMixedContent: false,
  },
  ios: {
    contentInset: 'automatic',
  },
};

export default config;
