# دليل نشر سيرفر Express لربط أجهزة البصمة (ZKTeco ADMS)

تتيح لك هذه الإعدادات نشر السيرفر على منصة سحابية مستقلة (مثل Render أو Railway أو Google Cloud Run أو VPS) للحصول على رابط مباشر وحقيقي مفتوح 100% لأجهزة البصمة بدون أي قيود على مستوى المتصفح أو الـ Proxy.

---

## الخيار الأول: النشر السريع المجاني على Render.com (موصى به)

1. **ارفع الكود إلى حسابك في GitHub**:
   - قم بتصدير المشروع أو رفعه إلى مستودع جديد في GitHub.
2. **افتح موقع Render**:
   - سجل الدخول إلى [Render.com](https://render.com).
3. **أنشئ Web Service جديدة**:
   - اضغط **New +** ثم اختر **Web Service**.
   - اختر مستودع GitHub الخاص بهذا المشروع.
4. **تعبئة البيانات**:
   - **Name**: `basmah-tech-adms`
   - **Environment**: `Node`
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm run start`
   - **Free Plan**: اختر الخطة المجانية.
5. **اضغط Create Web Service**:
   - خلال دقيقتين سيعطيك Render رابطاً مباشراً مثل: `https://basmah-tech-adms.onrender.com`
6. **ضبط جهاز البصمة**:
   - **Server Address**: `basmah-tech-adms.onrender.com/adms` (أو بدون /adms)
   - **Server Port**: `80` أو `443`
   - **Enable Domain Name**: `On`

---

## الخيار الثاني: النشر على Railway.app

1. سجل الدخول إلى [Railway.app](https://railway.app).
2. اضغط **New Project** -> **Deploy from GitHub repo**.
3. حدد المستودع الخاص بك.
4. سيكتشف Railway تلقائياً أومر البناء والنشر من `package.json` (`npm run build` و `npm run start`).
5. قم بتوليد **Domain** مجاني من إعدادات الخدمة في Railway.

---

## الخيار الثالث: النشر عبر Dockerfile على Google Cloud Run / VPS

الملف `Dockerfile` جاهز وموجود في المجلد الرئيسي للمشروع.

1. **بناء الصورة وتشغيلها محلياً أو على VPS**:
   ```bash
   docker build -t basmah-adms-server .
   docker run -d -p 80:3000 --name adms-server basmah-adms-server
   ```
2. **أو النشر على Cloud Run مستقلاً**:
   ```bash
   gcloud builds submit --tag gcr.io/YOUR_PROJECT_ID/adms-server
   gcloud run deploy adms-server --image gcr.io/YOUR_PROJECT_ID/adms-server --platform managed --allow-unauthenticated --port 3000
   ```

---

## التأكد من جاهزية السيرفر

عند زيارة الرابط الخاص بك (مثلاً `https://YOUR-APP.onrender.com/adms` أو `/iclock/cdata`):
- سيرد السيرفر فوراً برمز **200 OK** وإعدادات ADMS مباشرة.
- تدعم جميع المسارات استقبال بيانات الحضور من أجهزة ZKTeco وتسجيلها في قاعدة بيانات Firebase تلقائياً.
