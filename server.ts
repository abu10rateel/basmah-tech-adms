/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from 'express';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { createServer as createViteServer } from 'vite';
import { firebaseDb } from './src/db/firebaseDb';
import { generateInvoicePdf, sendEmailWithAttachment, sendHtmlEmail, generatePasswordResetEmailHtml } from './src/lib/mailService';

const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

async function startServer() {
  const app = express();
  app.use(express.json());

  // ADMS & System Middleware - Bypass CORS and force plain/text headers for ZKTeco hardware
  app.use((req, res, next) => {
    const lowerPath = req.path.toLowerCase();
    const isAdms =
      lowerPath === '/' ||
      lowerPath.startsWith('/iclock') ||
      lowerPath.startsWith('/cdata') ||
      lowerPath.startsWith('/adms') ||
      lowerPath.startsWith('/lnk') ||
      lowerPath.startsWith('/link') ||
      lowerPath.startsWith('/getrequest') ||
      lowerPath.startsWith('/devicecmd') ||
      lowerPath === '/1';

    if (isAdms) {
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, DELETE');
      res.setHeader('Access-Control-Allow-Headers', '*');
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      if (req.method === 'OPTIONS') {
        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        return res.status(200).send('OK');
      }
    }
    next();
  });

  // Log requests
  app.use((req, res, next) => {
    console.log(`[${req.method}] ${req.url}`);
    next();
  });

  // Root route - Always delegate to SPA HTML handler so Chrome PWA installability audit receives index.html with 200 OK
  app.get('/', (req, res, next) => {
    // If request is explicitly asking for ADMS text ping via query param, respond with text, otherwise pass to SPA
    if (req.query.ping === 'adms' || req.query.adms === 'true') {
      res.status(200);
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      return res.send('OK - ZKTeco ADMS Server is Running');
    }
    next();
  });

  // Explicit PWA Static Endpoints for Service Worker, Manifest, and Icons
  app.get('/sw.js', (req, res) => {
    const swPath = path.join(process.cwd(), 'public', 'sw.js');
    const distSwPath = path.join(process.cwd(), 'dist', 'sw.js');
    const targetPath = fs.existsSync(distSwPath) ? distSwPath : swPath;

    res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
    res.setHeader('Service-Worker-Allowed', '/');
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    if (fs.existsSync(targetPath)) {
      res.sendFile(targetPath);
    } else {
      res.status(404).send('Service Worker not found');
    }
  });

  app.get('/manifest.json', (req, res) => {
    const manifestPath = path.join(process.cwd(), 'public', 'manifest.json');
    const distManifestPath = path.join(process.cwd(), 'dist', 'manifest.json');
    const targetPath = fs.existsSync(distManifestPath) ? distManifestPath : manifestPath;

    res.setHeader('Content-Type', 'application/manifest+json; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    if (fs.existsSync(targetPath)) {
      res.sendFile(targetPath);
    } else {
      res.status(404).send('Manifest not found');
    }
  });

  // Ensure /icons directory is served reliably across environments
  app.use('/icons', express.static(path.join(process.cwd(), 'public', 'icons')));
  app.use('/icons', express.static(path.join(process.cwd(), 'dist', 'icons')));

  // --- API ROUTES FIRST ---

  // Auth: Sign Up
  app.post('/api/auth/signup', async (req, res) => {
    try {
      const { email, password, company_name } = req.body;
      if (!email || !password || !company_name) {
        return res.status(400).json({ error: { message: 'جميع الحقول مطلوبة.' } });
      }

      const cleanEmail = email.trim().toLowerCase();
      const existing = await firebaseDb.getTenantByEmail(cleanEmail);
      if (existing) {
        return res.status(400).json({ error: { message: 'هذا البريد الإلكتروني مسجل بالفعل.' } });
      }

      const hash = crypto.createHash('md5').update(cleanEmail).digest('hex');
      const tenantId = `tenant_${hash}`;

      const newTenant = {
        id: tenantId,
        email: cleanEmail,
        password,
        company_name
      };

      await firebaseDb.saveTenant(newTenant);

      // Initialize default shifts for the new tenant
      const defaultShift = {
        id: `shift_${Date.now()}_1`,
        user_id: tenantId,
        name: 'الدوام الاعتيادي الفردي',
        type: 'single',
        shift1_start: '08:00',
        shift1_end: '16:00',
        grace_minutes: 15,
        overtime_threshold_minutes: 30
      };
      const defaultDualShift = {
        id: `shift_${Date.now()}_2`,
        user_id: tenantId,
        name: 'الدوام المزدوج الصباحي/المسائي',
        type: 'dual',
        shift1_start: '08:00',
        shift1_end: '12:00',
        shift2_start: '16:00',
        shift2_end: '20:00',
        grace_minutes: 15,
        overtime_threshold_minutes: 30
      };

      await firebaseDb.saveShift(defaultShift);
      await firebaseDb.saveShift(defaultDualShift);

      res.json({
        data: {
          user: {
            id: tenantId,
            email: cleanEmail,
            company_name
          }
        },
        error: null
      });
    } catch (err: any) {
      console.error('Signup API error:', err);
      res.status(500).json({ error: { message: 'حدث خطأ في إنشاء الحساب.' } });
    }
  });

  function isSubscriptionExpired(expiryDateStr?: string): boolean {
    if (!expiryDateStr) return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
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
    
    return expiry.getTime() < today.getTime();
  }

  // Auth: Sign In
  app.post('/api/auth/signin', async (req, res) => {
    try {
      const { email, password } = req.body;
      if (!email || !password) {
        return res.status(400).json({ error: { message: 'يرجى إدخال البريد الإلكتروني وكلمة المرور.' } });
      }

      const cleanEmail = email.trim().toLowerCase();

      // 1. Check if login request is for Super Admin
      if (cleanEmail === 'ba10rke@gmail.com' && password === 'Abu10omar') {
        return res.json({
          data: {
            user: {
              id: 'super_admin',
              email: 'ba10rke@gmail.com',
              company_name: 'بصمة تك - مدير النظام الموحد',
              is_super_admin: true
            }
          },
          error: null
        });
      }

      let tenant = await firebaseDb.getTenantByEmail(cleanEmail);

      if (!tenant) {
        return res.status(400).json({ error: { message: 'بيانات الاعتماد غير صحيحة. يرجى مراجعة البريد الإلكتروني وكلمة المرور.' } });
      }

      if (tenant.password !== password) {
        return res.status(400).json({ error: { message: 'بيانات الاعتماد غير صحيحة. يرجى مراجعة كلمة المرور.' } });
      }

      // Check if tenant is suspended
      if (tenant.status === 'suspended') {
        return res.status(403).json({
          error: {
            message: 'تم إيقاف حسابك من قبل الإدارة، يرجى التواصل مع الدعم الفني.',
            is_suspended: true
          }
        });
      }

      // Check if subscription has expired
      if (isSubscriptionExpired(tenant.expiry_date)) {
        return res.status(403).json({
          error: {
            message: 'تم انتهاء الاشتراك ارجو التواصل مع الدعم الفني.',
            is_expired: true
          }
        });
      }

      // Block pending tenants
      if (tenant.status === 'pending') {
        return res.status(403).json({
          error: {
            message: 'حسابك معلق حالياً وبانتظار التفعيل من قبل الإدارة.',
            is_pending: true
          }
        });
      }

      res.json({
        data: {
          user: {
            id: tenant.id,
            email: tenant.email,
            company_name: tenant.company_name,
            manager_name: tenant.manager_name,
            phone: tenant.phone,
            status: tenant.status,
            city: tenant.city,
            plan_type: tenant.plan_type,
            subscription_months: tenant.subscription_months,
            expiry_date: tenant.expiry_date
          }
        },
        error: null
      });
    } catch (err: any) {
      console.error('Signin API error:', err);
      res.status(500).json({ error: { message: 'حدث خطأ في تسجيل الدخول.' } });
    }
  });

  // Auth: Register Tenant
  app.post('/api/auth/register-tenant', async (req, res) => {
    try {
      const { company_name, manager_name, email, phone, password, address, employee_package } = req.body;
      if (!company_name || !email || !phone || !password) {
        return res.status(400).json({ error: { message: 'جميع الحقول مطلوبة لتسجيل الحساب الجديد.' } });
      }

      const cleanEmail = email.trim().toLowerCase();
      const existing = await firebaseDb.getTenantByEmail(cleanEmail);
      if (existing) {
        return res.status(400).json({ error: { message: 'هذا البريد الإلكتروني مسجل بالفعل.' } });
      }

      const hash = crypto.createHash('md5').update(cleanEmail).digest('hex');
      const tenantId = `tenant_${hash}`;

      const newTenant = {
        id: tenantId,
        email: cleanEmail,
        company_name,
        manager_name: manager_name || company_name,
        phone,
        password,
        address: address || '',
        employee_package: employee_package || 'الباقة الأساسية حتى 20 موظف - تجريبية مجانية',
        plan_type: employee_package || 'الباقة الأساسية حتى 20 موظف - تجريبية مجانية',
        status: 'pending',
        created_at: new Date().toISOString()
      };

      await firebaseDb.saveTenant(newTenant);

      res.json({
        data: {
          tenant: {
            id: tenantId,
            email: cleanEmail,
            company_name
          }
        },
        error: null
      });
    } catch (err: any) {
      console.error('Register Tenant error:', err);
      res.status(500).json({ error: { message: 'حدث خطأ أثناء إرسال طلب الاشتراك.' } });
    }
  });

  // Auth: Request Password Reset (Automated & OWASP Compliant - Anti User Enumeration)
  app.post('/api/auth/request-password-reset', async (req, res) => {
    try {
      const { email } = req.body;
      if (!email) {
        return res.status(400).json({ error: { message: 'البريد الإلكتروني مطلوب.' } });
      }

      const cleanEmail = email.trim().toLowerCase();
      const tenant = await firebaseDb.getTenantByEmail(cleanEmail);

      const genericResponse = {
        success: true,
        message: 'إذا كان البريد الإلكتروني مسجلاً بالنظام، فقد تم إرسال رابط إعادة تعيين كلمة المرور إلى صندوق الوارد الخاص بك.'
      };

      if (!tenant) {
        // OWASP Recommendation: Prevent user enumeration by returning identical generic response when account is not found
        return res.json(genericResponse);
      }

      // Generate a cryptographically secure token & 15-minute expiration
      const resetToken = crypto.randomBytes(32).toString('hex');
      const resetExpires = Date.now() + 15 * 60 * 1000; // 15 minutes

      // Store token & expiration on tenant record in database
      await firebaseDb.updateTenant(tenant.id, {
        reset_token: resetToken,
        reset_token_expires: resetExpires,
        reset_token_used: false,
        reset_requested_at: new Date().toISOString()
      });

      // Construct reset URL based on FRONTEND_URL, APP_URL, or request origin/host
      const frontendUrl = process.env.FRONTEND_URL || process.env.APP_URL;
      const origin = frontendUrl || req.get('origin') || req.get('referer') || `http://${req.get('host')}`;
      const baseUrl = origin.replace(/\/$/, '');
      const resetUrl = `${baseUrl}/#reset-password?token=${resetToken}`;

      // Build HTML Email & send via automated mail service
      const emailHtml = generatePasswordResetEmailHtml(resetUrl, tenant.company_name);
      sendHtmlEmail(cleanEmail, 'إعادة تعيين كلمة المرور - بصمة تك', emailHtml).catch(err => {
        console.error('[PasswordReset] Failed to send email:', err);
      });

      res.json(genericResponse);
    } catch (err: any) {
      console.error('Request password reset error:', err);
      res.status(500).json({ error: { message: 'حدث خطأ أثناء إرسال طلب استعادة كلمة المرور.' } });
    }
  });

  // Auth: Verify Password Reset Token
  app.get('/api/auth/verify-reset-token', async (req, res) => {
    try {
      const token = (req.query.token as string) || (req.body?.token as string);
      if (!token) {
        return res.status(400).json({ valid: false, message: 'رمز التوثيق مطلوب.' });
      }

      const tenant = await firebaseDb.getTenantByResetToken(token);
      if (!tenant) {
        return res.json({ valid: false, message: 'رابط إعادة التعيين غير صالح أو تم استخدامه سابقاً.' });
      }

      if (tenant.reset_token_used) {
        return res.json({ valid: false, message: 'تم استخدام هذا الرابط من قبل. يرجى طلب رابط جديد.' });
      }

      if (!tenant.reset_token_expires || Date.now() > Number(tenant.reset_token_expires)) {
        return res.json({ valid: false, message: 'انتهت صلاحية رابط إعادة التعيين (15 دقيقة). يرجى طلب رابط جديد.' });
      }

      return res.json({
        valid: true,
        email: tenant.email,
        company_name: tenant.company_name
      });
    } catch (err: any) {
      console.error('Verify reset token error:', err);
      res.status(500).json({ valid: false, message: 'حدث خطأ أثناء التحقق من الرابط.' });
    }
  });

  // Auth: Execute Password Reset
  app.post('/api/auth/execute-password-reset', async (req, res) => {
    try {
      const { token, newPassword } = req.body;
      if (!token || !newPassword) {
        return res.status(400).json({ error: { message: 'جميع البيانات مطلوبة لإتمام إعادة التعيين.' } });
      }

      if (newPassword.length < 6) {
        return res.status(400).json({ error: { message: 'كلمة المرور يجب أن تتكون من 6 خانات على الأقل.' } });
      }

      const tenant = await firebaseDb.getTenantByResetToken(token);
      if (!tenant || tenant.reset_token_used) {
        return res.status(400).json({ error: { message: 'رابط إعادة التعيين غير صالح أو تم استخدامه سابقاً.' } });
      }

      if (!tenant.reset_token_expires || Date.now() > Number(tenant.reset_token_expires)) {
        return res.status(400).json({ error: { message: 'انتهت صلاحية رابط إعادة التعيين (15 دقيقة). يرجى طلب رابط جديد.' } });
      }

      // Update tenant password & invalidate reset token
      await firebaseDb.updateTenant(tenant.id, {
        password: newPassword,
        reset_token: null,
        reset_token_expires: null,
        reset_token_used: true,
        reset_password_requested: false,
        requested_new_password: null,
        password_updated_at: new Date().toISOString()
      });

      return res.json({
        success: true,
        message: 'تم إعادة تعيين كلمة المرور بنجاح! يمكنك الآن تسجيل الدخول باستخدام كلمة المرور الجديدة.'
      });
    } catch (err: any) {
      console.error('Execute password reset error:', err);
      res.status(500).json({ error: { message: 'حدث خطأ أثناء حفظ كلمة المرور الجديدة.' } });
    }
  });

  // Super Admin: Get all tenants
  app.get('/api/superadmin/tenants', async (req, res) => {
    try {
      const userHeader = req.headers['x-user-id'];
      if (userHeader !== 'super_admin') {
        return res.status(403).json({ error: { message: 'غير مصرح لك بالوصول لمستوى المشرف العام.' } });
      }
      const tenants = await firebaseDb.getAllTenants();
      res.json(tenants);
    } catch (err: any) {
      console.error('Superadmin get tenants error:', err);
      res.status(500).json({ error: { message: 'حدث خطأ أثناء تحميل المستأجرين.' } });
    }
  });

  // Super Admin: Activate Tenant
  app.post('/api/superadmin/activate-tenant', async (req, res) => {
    try {
      const userHeader = req.headers['x-user-id'];
      if (userHeader !== 'super_admin') {
        return res.status(403).json({ error: { message: 'غير مصرح لك بالوصول لمستوى المشرف العام.' } });
      }

      const { tenantId, city, plan_type, subscription_months } = req.body;
      if (!tenantId || !city || !plan_type || !subscription_months) {
        return res.status(400).json({ error: { message: 'جميع الحقول مطلوبة لتفعيل الاشتراك.' } });
      }

      const months = parseInt(subscription_months, 10);
      const expiry = new Date();
      expiry.setMonth(expiry.getMonth() + months);
      const expiry_date = expiry.toISOString().split('T')[0]; // YYYY-MM-DD

      const updates = {
        city,
        plan_type,
        subscription_months: months,
        expiry_date,
        status: 'active',
        activated_at: new Date().toISOString()
      };

      await firebaseDb.updateTenant(tenantId, updates);

      // Fetch full tenant details to generate personalized invoice & welcome letter PDF + Email
      let emailSent = false;
      let emailPreviewUrl = undefined;
      const tenant = await firebaseDb.getTenantById(tenantId);
      if (tenant && tenant.email) {
        try {
          // Calculate pricing based on plan type and months
          let monthlyPrice = 150;
          if (plan_type === 'المتقدمة') {
            monthlyPrice = 300;
          } else if (plan_type === 'الشركات') {
            monthlyPrice = 600;
          }
          const totalVal = monthlyPrice * months;
          const planPrice = `${totalVal} SAR (ريال سعودي)`;

          // Generate the PDF
          const pdfBuffer = await generateInvoicePdf({
            companyName: tenant.company_name || 'عميل بصمة تك',
            email: tenant.email,
            activationDate: new Date().toISOString().split('T')[0],
            expiryDate: expiry_date,
            planType: plan_type,
            months: months,
            planPrice: planPrice
          });

          // Compose Arabic HTML welcoming email
          const emailHtml = `
            <div style="direction: rtl; text-align: right; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff; color: #1e293b;">
              <div style="background-color: #0b1329; padding: 20px; border-radius: 8px 8px 0 0; text-align: center;">
                <h1 style="color: #10b981; margin: 0; font-size: 24px;">بصمة تك - Basma Tech</h1>
                <p style="color: #ffffff; margin: 5px 0 0 0; font-size: 14px;">أنظمة الحضور والانصراف السحابية الذكية</p>
              </div>
              <div style="padding: 20px;">
                <h2 style="color: #0b1329; font-size: 18px; margin-top: 0;">أهلاً بك في عائلة بصمة تك! 🎉</h2>
                <p style="font-size: 14px; line-height: 1.6;">يسرنا إعلامك بأنه قد تم تفعيل اشتراكك بنجاح في المنصة. حسابك الآن نشط وبكامل الصلاحيات للبدء في استخدام كافة مميزات النظام وإدارة الحضور والانصراف لمنشأتك بكل ذكاء وسهولة.</p>
                
                <table style="width: 100%; border-collapse: collapse; margin: 20px 0; font-size: 13px;">
                  <tr style="background-color: #f8fafc;">
                    <td style="padding: 8px; border: 1px solid #e2e8f0; font-weight: bold; width: 40%;">اسم المنشأة/العميل:</td>
                    <td style="padding: 8px; border: 1px solid #e2e8f0;">${tenant.company_name || 'عميلنا العزيز'}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px; border: 1px solid #e2e8f0; font-weight: bold;">الباقة المفعلة:</td>
                    <td style="padding: 8px; border: 1px solid #e2e8f0;">${plan_type}</td>
                  </tr>
                  <tr style="background-color: #f8fafc;">
                    <td style="padding: 8px; border: 1px solid #e2e8f0; font-weight: bold;">مدة الاشتراك:</td>
                    <td style="padding: 8px; border: 1px solid #e2e8f0;">${months} أشهر</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px; border: 1px solid #e2e8f0; font-weight: bold;">تاريخ التفعيل:</td>
                    <td style="padding: 8px; border: 1px solid #e2e8f0;">${new Date().toISOString().split('T')[0]}</td>
                  </tr>
                  <tr style="background-color: #f8fafc;">
                    <td style="padding: 8px; border: 1px solid #e2e8f0; font-weight: bold;">تاريخ الانتهاء:</td>
                    <td style="padding: 8px; border: 1px solid #e2e8f0; color: #ef4444; font-weight: bold;">${expiry_date}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px; border: 1px solid #e2e8f0; font-weight: bold;">إجمالي قيمة الباقة:</td>
                    <td style="padding: 8px; border: 1px solid #e2e8f0; color: #10b981; font-weight: bold;">${planPrice}</td>
                  </tr>
                </table>

                <p style="font-size: 14px; line-height: 1.6;">لقد أرفقنا لك مع هذا الإيميل نسخة من <strong>فاتورة الاشتراك الرسمية وخطاب الترحيب (PDF)</strong> للتوثيق والاحتفاظ بها بملفاتكم.</p>
                
                <div style="background-color: #f0fdf4; border-right: 4px solid #10b981; padding: 12px; margin: 20px 0; border-radius: 4px;">
                  <p style="margin: 0; font-size: 13px; color: #166534; font-weight: bold;">💡 للبدء الآن:</p>
                  <p style="margin: 5px 0 0 0; font-size: 12px; line-height: 1.5; color: #166534;">توجه إلى موقع المنصة، وقم بتسجيل الدخول بحسابك لتبدأ بإضافة الموظفين، تحديد فترات الدوام والشفتات، وربط أجهزة البصمة الذكية الخاصة بك.</p>
                </div>

                <p style="font-size: 14px; margin-bottom: 5px;">أطيب التحيات،</p>
                <p style="font-size: 14px; font-weight: bold; margin-top: 0; color: #0b1329;">فريق خدمات المشتركين - بصمة تك</p>
              </div>
              <div style="background-color: #f8fafc; padding: 15px; border-radius: 0 0 8px 8px; text-align: center; font-size: 11px; color: #64748b; border-top: 1px solid #e2e8f0;">
                هذا البريد الإلكتروني مرسل تلقائياً من سيرفر بصمة تك. يرجى عدم الرد المباشر عليه.<br/>
                للدعم الفني والاستفسارات: <a href="mailto:info@basmatech.sa" style="color: #10b981; text-decoration: none;">info@basmatech.sa</a> | هاتف الدعم: <a href="tel:+966557538856" style="color: #10b981; text-decoration: none;">+966557538856</a>
              </div>
            </div>
          `;

          const emailSubject = `تم تفعيل اشتراكك بنجاح في منصة بصمة تك - ${tenant.company_name || ''}`;
          const mailRes = await sendEmailWithAttachment(
            tenant.email,
            emailSubject,
            emailHtml,
            pdfBuffer,
            `Invoice_BasmaTech_${tenantId}.pdf`
          );
          
          emailSent = true;
          if (mailRes && mailRes.previewUrl) {
            emailPreviewUrl = mailRes.previewUrl;
          }
        } catch (mailErr) {
          console.error('[Email Activation Error]: Failed to send activation email or generate PDF:', mailErr);
        }
      }

      // Initialize default shifts for this tenant if they don't have them
      const defaultShift = {
        id: `shift_${Date.now()}_1`,
        user_id: tenantId,
        name: 'الدوام الاعتيادي الفردي',
        type: 'single',
        shift1_start: '08:00',
        shift1_end: '16:00',
        grace_minutes: 15,
        overtime_threshold_minutes: 30
      };
      const defaultDualShift = {
        id: `shift_${Date.now()}_2`,
        user_id: tenantId,
        name: 'الدوام المزدوج الصباحي/المسائي',
        type: 'dual',
        shift1_start: '08:00',
        shift1_end: '12:00',
        shift2_start: '16:00',
        shift2_end: '20:00',
        grace_minutes: 15,
        overtime_threshold_minutes: 30
      };

      try {
        await firebaseDb.saveShift(defaultShift);
        await firebaseDb.saveShift(defaultDualShift);
      } catch (err) {
        console.log('Shifts default initialization skipped.');
      }

      res.json({ success: true, expiry_date, emailSent, emailPreviewUrl });
    } catch (err: any) {
      console.error('Superadmin activate tenant error:', err);
      res.status(500).json({ error: { message: 'حدث خطأ أثناء تفعيل حساب العميل.' } });
    }
  });

  // Super Admin: Suspend Tenant
  app.post('/api/superadmin/suspend-tenant', async (req, res) => {
    try {
      const userHeader = req.headers['x-user-id'];
      if (userHeader !== 'super_admin') {
        return res.status(403).json({ error: { message: 'غير مصرح لك بالوصول لمستوى المشرف العام.' } });
      }

      const { tenantId } = req.body;
      if (!tenantId) {
        return res.status(400).json({ error: { message: 'معرّف الشركة مطلوب لإيقاف الحساب.' } });
      }

      await firebaseDb.updateTenant(tenantId, { status: 'suspended' });
      res.json({ success: true });
    } catch (err: any) {
      console.error('Superadmin suspend tenant error:', err);
      res.status(500).json({ error: { message: 'حدث خطأ أثناء إيقاف حساب العميل.' } });
    }
  });

  // Super Admin: Delete Tenant Entirely
  app.delete('/api/superadmin/delete-tenant', async (req, res) => {
    try {
      const userHeader = req.headers['x-user-id'];
      if (userHeader !== 'super_admin') {
        return res.status(403).json({ error: { message: 'غير مصرح لك بالوصول لمستوى المشرف العام.' } });
      }

      const tenantId = req.body?.tenantId || req.query?.tenantId;
      if (!tenantId) {
        return res.status(400).json({ error: { message: 'معرّف الشركة مطلوب لحذف الحساب.' } });
      }

      await firebaseDb.deleteTenant(tenantId as string);
      res.json({ success: true });
    } catch (err: any) {
      console.error('Superadmin delete tenant error:', err);
      res.status(500).json({ error: { message: 'حدث خطأ أثناء حذف حساب العميل من قاعدة البيانات.' } });
    }
  });

  // Super Admin: Update/Approve Tenant Password Reset
  app.post('/api/superadmin/update-tenant-password', async (req, res) => {
    try {
      const userHeader = req.headers['x-user-id'];
      if (userHeader !== 'super_admin') {
        return res.status(403).json({ error: { message: 'غير مصرح لك بالوصول لمستوى المشرف العام.' } });
      }

      const { tenantId, password } = req.body;
      if (!tenantId || !password) {
        return res.status(400).json({ error: { message: 'معرّف الشركة وكلمة المرور الجديدة مطلوبة.' } });
      }

      const updates = {
        password: password,
        reset_password_requested: false,
        requested_new_password: null,
        reset_requested_at: null
      };

      await firebaseDb.updateTenant(tenantId, updates);
      res.json({ success: true });
    } catch (err: any) {
      console.error('Superadmin update tenant password error:', err);
      res.status(500).json({ error: { message: 'حدث خطأ أثناء تحديث كلمة مرور العميل.' } });
    }
  });

  // Super Admin: Get Pending Password Reset Requests
  app.get('/api/superadmin/password-requests', async (req, res) => {
    try {
      const userHeader = req.headers['x-user-id'];
      if (userHeader !== 'super_admin') {
        return res.status(403).json({ error: { message: 'غير مصرح لك بالوصول لمستوى المشرف العام.' } });
      }

      const requests = await firebaseDb.getPendingPasswordRequests();
      res.json(requests);
    } catch (err: any) {
      console.error('Superadmin get password requests error:', err);
      res.status(500).json({ error: { message: 'حدث خطأ أثناء جلب طلبات تعيين كلمة المرور.' } });
    }
  });

  // Super Admin: Resolve Password Reset Request
  app.post('/api/superadmin/resolve-password-request', async (req, res) => {
    try {
      const userHeader = req.headers['x-user-id'];
      if (userHeader !== 'super_admin') {
        return res.status(403).json({ error: { message: 'غير مصرح لك بالوصول لمستوى المشرف العام.' } });
      }

      const { requestId, tenantId, newPassword } = req.body;
      if (!tenantId || !newPassword) {
        return res.status(400).json({ error: { message: 'معرّف الشركة وكلمة المرور الجديدة مطلوبة.' } });
      }

      // Update tenant password and reset flags
      const updates = {
        password: newPassword,
        reset_password_requested: false,
        requested_new_password: null,
        reset_requested_at: null
      };
      await firebaseDb.updateTenant(tenantId, updates);

      // If requestId is provided, mark that request as resolved in Firestore
      if (requestId) {
        await firebaseDb.updatePasswordRequestStatus(requestId, 'resolved');
      } else {
        // Fallback: If no requestId is provided but we have tenantId, find and resolve all pending requests for this tenant email
        const tenant = await firebaseDb.getTenantById(tenantId);
        if (tenant) {
          const pending = await firebaseDb.getPendingPasswordRequests();
          const tenantRequests = pending.filter(r => r.email === tenant.email || r.uid === tenantId);
          for (const reqDoc of tenantRequests) {
            await firebaseDb.updatePasswordRequestStatus(reqDoc.id, 'resolved');
          }
        }
      }

      res.json({ success: true });
    } catch (err: any) {
      console.error('Superadmin resolve password request error:', err);
      res.status(500).json({ error: { message: 'حدث خطأ أثناء اعتماد طلب كلمة المرور.' } });
    }
  });

  // Auth: Verify and Sync (Self-Healing Recovery system)
  app.post('/api/auth/verify-and-sync', async (req, res) => {
    try {
      const { user, shifts, employees, attendance_logs } = req.body;
      if (!user || !user.id || !user.email) {
        return res.status(400).json({ error: { message: 'بيانات غير مكتملة للتحقق.' } });
      }

      let tenant = await firebaseDb.getTenantById(user.id);
      if (!tenant) {
        tenant = await firebaseDb.getTenantByEmail(user.email);
      }

      if (tenant && tenant.status === 'suspended') {
        return res.status(403).json({
          error: {
            message: 'تم إيقاف حسابك من قبل الإدارة، يرجى التواصل مع الدعم الفني.',
            is_suspended: true
          }
        });
      }

      if (tenant && isSubscriptionExpired(tenant.expiry_date)) {
        return res.status(403).json({
          error: {
            message: 'تم انتهاء الاشتراك ارجو التواصل مع الدعم الفني.',
            is_expired: true
          }
        });
      }

      let status = 'ok';
      let message = 'تم التحقق من الحساب.';

      if (!tenant) {
        console.log(`[Sync] Tenant ${user.email} not found. Restoring tenant and related records...`);
        tenant = {
          id: user.id,
          email: user.email.trim().toLowerCase(),
          password: user.password || '',
          company_name: user.company_name || 'بوابة مسار'
        };

        await firebaseDb.saveTenant(tenant);

        if (Array.isArray(shifts)) {
          for (const s of shifts) {
            if (s.user_id === user.id) {
              await firebaseDb.saveShift(s);
            }
          }
        }

        if (Array.isArray(employees)) {
          for (const e of employees) {
            if (e.user_id === user.id) {
              await firebaseDb.saveEmployee(e);
            }
          }
        }

        if (Array.isArray(attendance_logs)) {
          for (const l of attendance_logs) {
            if (l.user_id === user.id) {
              await firebaseDb.saveAttendanceLog(l);
            }
          }
        }

        status = 'restored';
        message = 'تم استعادة البيانات المفقودة تلقائياً من النسخة الاحتياطية المتوفرة.';
      } else {
        let updated = false;

        if (Array.isArray(shifts)) {
          const currentShifts = await firebaseDb.getShifts(user.id);
          for (const s of shifts) {
            if (s.user_id === user.id && !currentShifts.some((existing: any) => existing.id === s.id)) {
              await firebaseDb.saveShift(s);
              updated = true;
            }
          }
        }

        if (Array.isArray(employees)) {
          const currentEmployees = await firebaseDb.getEmployees(user.id);
          for (const e of employees) {
            if (e.user_id === user.id && !currentEmployees.some((existing: any) => existing.id === e.id)) {
              await firebaseDb.saveEmployee(e);
              updated = true;
            }
          }
        }

        if (Array.isArray(attendance_logs)) {
          const currentLogs = await firebaseDb.getAttendanceLogs(user.id);
          for (const l of attendance_logs) {
            if (l.user_id === user.id && !currentLogs.some((existing: any) => existing.id === l.id)) {
              await firebaseDb.saveAttendanceLog(l);
              updated = true;
            }
          }
        }

        if (updated) {
          status = 'merged';
          message = 'تمت مزامنة البيانات المتوفرة محلياً مع الخادم بنجاح.';
        }
      }

      res.json({
        data: {
          user: {
            id: tenant.id,
            email: tenant.email,
            company_name: tenant.company_name
          },
          status,
          message
        },
        error: null
      });
    } catch (err: any) {
      console.error('Verify-and-sync API error:', err);
      res.status(500).json({ error: { message: 'حدث خطأ في مزامنة البيانات.' } });
    }
  });

  // Shifts: Get
  app.get('/api/shifts', async (req, res) => {
    try {
      const userId = req.headers['x-user-id'] as string;
      if (!userId) {
        return res.status(401).json({ error: 'غير مصرح بالدخول' });
      }

      const tenantShifts = await firebaseDb.getShifts(userId);
      res.json(tenantShifts);
    } catch (err) {
      console.error('Get shifts API error:', err);
      res.status(500).json({ error: 'حدث خطأ في جلب بيانات الورديات.' });
    }
  });

  // Shifts: Save (Upsert)
  app.post('/api/shifts', async (req, res) => {
    try {
      const userId = req.headers['x-user-id'] as string;
      if (!userId) {
        return res.status(401).json({ error: 'غير مصرح بالدخول' });
      }

      const shift = req.body;
      const payload = {
        ...shift,
        id: shift.id || `shift_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
        user_id: userId
      };

      await firebaseDb.saveShift(payload);
      res.json({ data: payload, error: null });
    } catch (err) {
      console.error('Save shift API error:', err);
      res.status(500).json({ error: 'حدث خطأ في حفظ الوردية.' });
    }
  });

  // Shifts: Delete
  app.delete('/api/shifts/:id', async (req, res) => {
    try {
      const userId = req.headers['x-user-id'] as string;
      const { id } = req.params;
      if (!userId) {
        return res.status(401).json({ error: 'غير مصرح بالدخول' });
      }

      await firebaseDb.deleteShift(id);
      res.json({ error: null });
    } catch (err) {
      console.error('Delete shift API error:', err);
      res.status(500).json({ error: 'حدث خطأ في حذف الوردية.' });
    }
  });

  // Employees: Get
  app.get('/api/employees', async (req, res) => {
    try {
      const userId = req.headers['x-user-id'] as string;
      if (!userId) {
        return res.status(401).json({ error: 'غير مصرح بالدخول' });
      }

      const tenantEmployees = await firebaseDb.getEmployees(userId);
      res.json(tenantEmployees);
    } catch (err) {
      console.error('Get employees API error:', err);
      res.status(500).json({ error: 'حدث خطأ في جلب بيانات الموظفين.' });
    }
  });

  // Employees: Save (Upsert with Composite Unique constraint)
  app.post('/api/employees', async (req, res) => {
    try {
      const userId = req.headers['x-user-id'] as string;
      if (!userId) {
        return res.status(401).json({ error: 'غير مصرح بالدخول' });
      }

      const employee = req.body;
      const payload = {
        ...employee,
        id: employee.id || `emp_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
        user_id: userId
      };

      // Check composite unique user_id + emp_id
      const duplicate = await firebaseDb.getEmployeeByEmpId(userId, payload.emp_id);
      if (duplicate && duplicate.id !== payload.id) {
        return res.status(400).json({ error: { message: `الرقم الوظيفي (${payload.emp_id}) مستخدم بالفعل في هذه المؤسسة.` } });
      }

      await firebaseDb.saveEmployee(payload);
      res.json({ data: payload, error: null });
    } catch (err) {
      console.error('Save employee API error:', err);
      res.status(500).json({ error: 'حدث خطأ في حفظ الموظف.' });
    }
  });

  // Employees: Delete
  app.delete('/api/employees/:id', async (req, res) => {
    try {
      const userId = req.headers['x-user-id'] as string;
      const { id } = req.params;
      if (!userId) {
        return res.status(401).json({ error: 'غير مصرح بالدخول' });
      }

      await firebaseDb.deleteEmployee(id);
      res.json({ error: null });
    } catch (err) {
      console.error('Delete employee API error:', err);
      res.status(500).json({ error: 'حدث خطأ في حذف الموظف.' });
    }
  });

  // Attendance Logs: Get
  app.get('/api/attendance_logs', async (req, res) => {
    try {
      const userId = req.headers['x-user-id'] as string;
      const { startDate, endDate } = req.query;
      if (!userId) {
        return res.status(401).json({ error: 'غير مصرح بالدخول' });
      }

      let tenantLogs = await firebaseDb.getAttendanceLogs(userId);
      if (startDate) {
        tenantLogs = tenantLogs.filter((l: any) => l.date >= (startDate as string));
      }
      if (endDate) {
        tenantLogs = tenantLogs.filter((l: any) => l.date <= (endDate as string));
      }

      // Sort by date ascending
      tenantLogs.sort((a: any, b: any) => a.date.localeCompare(b.date));
      res.json(tenantLogs);
    } catch (err) {
      console.error('Get attendance logs API error:', err);
      res.status(500).json({ error: 'حدث خطأ في جلب سجلات الحضور.' });
    }
  });

  // Attendance Logs: Save (Upsert)
  app.post('/api/attendance_logs', async (req, res) => {
    try {
      const userId = req.headers['x-user-id'] as string;
      if (!userId) {
        return res.status(401).json({ error: 'غير مصرح بالدخول' });
      }

      const log = req.body;
      const payload = {
        ...log,
        id: log.id || `log_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
        user_id: userId
      };

      // Ensure daily record is unique per employee
      const existing = await firebaseDb.findAttendanceLog(payload.employee_id, payload.date);
      if (existing) {
        payload.id = existing.id; // overwrite id to update existing doc
      }

      await firebaseDb.saveAttendanceLog(payload);
      res.json({ data: payload, error: null });
    } catch (err) {
      console.error('Save attendance log API error:', err);
      res.status(500).json({ error: 'حدث خطأ في حفظ سجل الحضور.' });
    }
  });

  // Attendance Logs: Delete
  app.delete('/api/attendance_logs/:id', async (req, res) => {
    try {
      const userId = req.headers['x-user-id'] as string;
      const { id } = req.params;
      if (!userId) {
        return res.status(401).json({ error: 'غير مصرح بالدخول' });
      }

      await firebaseDb.deleteAttendanceLog(id);
      res.json({ error: null });
    } catch (err) {
      console.error('Delete attendance log API error:', err);
      res.status(500).json({ error: 'حدث خطأ في حذف سجل الحضور.' });
    }
  });

  // ==============================================
  // --- INTERNAL URL SHORTENER & PROXY ROUTING ---
  // ==============================================

  // 1. Endpoint to dynamically generate/retrieve a shortened URL for the current host (direct local proxy)
  app.get('/api/short-url', async (req, res) => {
    try {
      const host = req.get('host') || req.headers.host || 'basmah-tech.onrender.com';
      const protocol = req.secure || req.headers['x-forwarded-proto'] === 'https' ? 'https' : 'http';
      
      // Directly return the official ADMS URL
      const shortUrl = `${protocol}://${host}/adms`;
      console.log(`[URL Shortener] Generated direct local/internal URL: ${shortUrl}`);
      
      return res.json({ shortUrl, success: true });
    } catch (err) {
      console.error('[URL Shortener] Error generating shortened URL:', err);
      const host = req.get('host') || req.headers.host || 'basmah-tech.onrender.com';
      res.json({ shortUrl: `https://${host}/adms`, success: false });
    }
  });

  // 2. Intelligent Dynamic Redirection Forwarding Middleware (Silent Reverse Proxy / Request Forwarding)
  // Transparently forwards incoming shortened-url/proxy ADMS traffic to ZK endpoints instantly in-process without any 301/302 redirects
  app.all(['/link', '/adms', '/lnk', '/1', '/link/*', '/adms/*', '/lnk/*', '/1/*'], async (req, res, next) => {
    const originalPath = req.path;
    console.log(`[ZK ADMS Redirect Control] Transparently forwarding incoming packet from path: ${originalPath}`);

    // If it is a deeper path, we map it to the respective /iclock/ standard endpoints
    const queryStr = req.originalUrl.split('?')[1] ? '?' + req.originalUrl.split('?')[1] : '';
    
    if (originalPath.includes('/iclock/getrequest')) {
      req.url = '/iclock/getrequest' + queryStr;
    } else if (originalPath.includes('/iclock/devicecmd')) {
      req.url = '/iclock/devicecmd' + queryStr;
    } else if (originalPath.includes('/iclock/cdata.aspx')) {
      req.url = '/iclock/cdata.aspx' + queryStr;
    } else if (originalPath.includes('/iclock/cdata')) {
      req.url = '/iclock/cdata' + queryStr;
    } else {
      // Default fallback for root-like paths /adms, /1, etc.
      req.url = '/iclock/cdata' + queryStr;
    }

    console.log(`[ZK ADMS Redirect Control] Internally forwarded & rewritten to standard endpoint: ${req.url}`);
    next();
  });

  // ==========================================
  // --- ZKTECO ADMS COMPATIBILITY PROTOCOL ---
  // ==========================================
  
  // Custom middleware to handle plain/text payloads for ADMS protocol
  const rawTextParser = express.text({ type: ['text/*', 'application/octet-stream', 'application/x-www-form-urlencoded'], limit: '15mb' });

  const updateDevicePing = async (sn: string) => {
    if (!sn) return;
    try {
      const device = await firebaseDb.getDeviceBySerialNumber(sn);
      if (device) {
        device.last_ping = new Date().toISOString();
        await firebaseDb.saveDevice(device);
      }
    } catch (err) {
      console.error('Failed to update device ping:', err);
    }
  };

  // Handle GET and POST for ZKTeco ADMS device data transmission across all path variations including /iclock/*, /adms*, etc.
  app.all(
    [
      '/iclock/*',
      '/iclock',
      '/adms/*',
      '/adms',
      '/cdata*',
      '/getrequest*',
      '/devicecmd*'
    ],
    rawTextParser,
    async (req, res) => {
      try {
        const payloadText = typeof req.body === 'string' ? req.body : '';
        let sn = (req.query.SN || req.query.sn || req.headers['x-sn'] || req.headers['sn']) as string;
        if (!sn && payloadText) {
          const match = payloadText.match(/SN=([A-Za-z0-9_]+)/i);
          if (match) sn = match[1];
        }

        const pathLower = req.path.toLowerCase();
        console.log(`[ZK ADMS] ${req.method} request to ${req.path} from SN: ${sn || 'Unknown'}`);

        if (sn) {
          await updateDevicePing(sn);
        }

        // Handle keep-alive / command polling endpoints (/iclock/getrequest, /iclock/devicecmd, etc.)
        if (
          pathLower.includes('getrequest') ||
          pathLower.includes('devicecmd') ||
          pathLower.includes('registry') ||
          pathLower.includes('ping') ||
          pathLower.includes('push')
        ) {
          res.status(200);
          res.setHeader('Content-Type', 'text/plain; charset=utf-8');
          return res.send('OK');
        }

        // GET request: Return standard ZKTeco ADMS handshake config options ending with OK
        if (req.method === 'GET') {
          const responseConfig =
            `GET OPTION FROM: ${sn || 'device'}\r\n` +
            `Stamp=9999\r\n` +
            `OpStamp=9999\r\n` +
            `PhotoStamp=9999\r\n` +
            `ErrorDelay=60\r\n` +
            `Delay=30\r\n` +
            `TransInterval=10\r\n` +
            `TransFlag=1111111111\r\n` +
            `Realtime=1\r\n` +
            `Encrypt=0\r\n` +
            `OK\r\n`;

          res.status(200);
          res.setHeader('Content-Type', 'text/plain; charset=utf-8');
          return res.send(responseConfig);
        }

        // POST request: Parse incoming attendance punches (ATTLOG)
        if (req.method === 'POST') {
          if (!payloadText || !payloadText.trim()) {
            res.status(200);
            res.setHeader('Content-Type', 'text/plain; charset=utf-8');
            return res.send('OK');
          }

          const lines = payloadText.split(/\r?\n/);
          let count = 0;

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('//')) continue;

            const upperLine = trimmed.toUpperCase();
            // Discard system command and operation logs
            if (
              upperLine.includes('OPLOG') ||
              upperLine.includes('CMD') ||
              upperLine.includes('SETTING') ||
              upperLine.startsWith('USER') ||
              upperLine.startsWith('FP')
            ) {
              continue;
            }

            let parts = trimmed.split(/[\t,;]/);
            if (parts.length < 2) {
              parts = trimmed.split(/\s+/);
            }
            parts = parts.map(p => p.trim()).filter(Boolean);
            if (parts.length < 2) continue;

            let pin = parts[0];

            // Validate numeric Emp_ID to discard header lines like "table=ATTLOG"
            if (!/^\d+$/.test(pin)) {
              continue;
            }

            let timestamp = '';
            let status = 0;

            // Extract timestamp with pattern YYYY-MM-DD HH:MM:SS
            const timeRegex = /\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2}/;
            const matchedTime = trimmed.match(timeRegex);
            if (matchedTime) {
              timestamp = matchedTime[0];
            } else {
              const datePart = parts.find(p => p.match(/^\d{4}-\d{2}-\d{2}$/));
              const timePart = parts.find(p => p.match(/^\d{2}:\d{2}:\d{2}$/) || p.match(/^\d{2}:\d{2}$/));
              if (datePart && timePart) {
                timestamp = `${datePart} ${timePart}`;
              }
            }

            // Detect check-in / check-out status
            const statusIdx = parts.findIndex((p, idx) => idx > 0 && (p === '0' || p === '1' || p === '2' || p === '3' || p === '4'));
            if (statusIdx > -1) {
              status = parseInt(parts[statusIdx], 10);
            }

            if (pin && timestamp) {
              const isDup = await firebaseDb.checkRawLogExists(sn || 'UNKNOWN_SN', pin, timestamp);
              if (!isDup) {
                await firebaseDb.saveRawLog({
                  id: `zk_log_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
                  sn: sn || 'UNKNOWN_SN',
                  pin,
                  timestamp,
                  status,
                  created_at: new Date().toISOString(),
                  synced: false
                });
                count++;
              }
            }
          }

          if (count > 0) {
            console.log(`[ZK ADMS] Registered ${count} new raw punches from device SN: ${sn}`);
          }

          res.status(200);
          res.setHeader('Content-Type', 'text/plain; charset=utf-8');
          return res.send(`OK: ${count}\n`);
        }

        // Fallback response for any other HTTP method
        res.status(200);
        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        res.send('OK');
      } catch (err) {
        console.error('[ZK ADMS] Endpoint error:', err);
        res.status(200);
        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        res.send('OK');
      }
    }
  );

  // Catch-all safety for any remaining /iclock/* or /adms/* queries
  app.all(['/iclock/*', '/adms/*'], async (req, res) => {
    try {
      const sn = (req.query.SN || req.query.sn) as string;
      if (sn) {
        await updateDevicePing(sn);
      }
    } catch (err) {
      // ignore
    }
    res.status(200);
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.send('OK');
  });

  // ===================================
  // --- DEVICES MANAGEMENT REST API ---
  // ===================================

  // Get tenant devices with status information
  app.get('/api/devices', async (req, res) => {
    try {
      const userId = req.headers['x-user-id'] as string;
      if (!userId) {
        return res.status(401).json({ error: 'غير مصرح بالدخول' });
      }

      const tenantDevices = await firebaseDb.getDevices(userId);
      const sns = tenantDevices.map((d: any) => d.serial_number);
      const devLogs = await firebaseDb.getRawLogsBySerialNumbers(sns);

      // Enrich device info with statistics from raw logs
      const enriched = tenantDevices.map((device: any) => {
        const matchingLogs = devLogs.filter((l: any) => l.sn.toUpperCase() === device.serial_number.toUpperCase());
        let lastPing = device.last_ping || device.created_at || new Date().toISOString();
        if (matchingLogs.length > 0) {
          matchingLogs.sort((a: any, b: any) => b.timestamp.localeCompare(a.timestamp));
          const lastLogTime = matchingLogs[0].created_at || matchingLogs[0].timestamp;
          if (new Date(lastLogTime) > new Date(lastPing)) {
            lastPing = lastLogTime;
          }
        }
        return {
          ...device,
          last_ping: lastPing,
          total_pushed_logs: matchingLogs.length,
          pending_logs: matchingLogs.filter((l: any) => !l.synced).length
        };
      });

      res.json(enriched);
    } catch (err) {
      console.error('Get devices API error:', err);
      res.status(500).json({ error: 'حدث خطأ في جلب بيانات الأجهزة.' });
    }
  });

  // Register or edit device serial number
  app.post('/api/devices', async (req, res) => {
    try {
      const userId = req.headers['x-user-id'] as string;
      if (!userId) {
        return res.status(401).json({ error: 'غير مصرح بالدخول' });
      }

      const { serial_number, name } = req.body;
      if (!serial_number || !name) {
        return res.status(400).json({ error: { message: 'الرقم التسلسلي واسم الجهاز مطلوبين.' } });
      }

      const snClean = serial_number.trim().toUpperCase();
      const nameClean = name.trim();

      const existing = await firebaseDb.getDeviceBySerialNumber(snClean);
      if (existing) {
        if (existing.user_id !== userId) {
          return res.status(400).json({ error: { message: 'عذراً، هذا الرقم التسلسلي مسجل بالفعل تحت حساب مؤسسة أخرى.' } });
        }
        existing.name = nameClean;
        await firebaseDb.saveDevice(existing);
      } else {
        const newDevice = {
          id: `device_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
          user_id: userId,
          serial_number: snClean,
          name: nameClean,
          created_at: new Date().toISOString()
        };
        await firebaseDb.saveDevice(newDevice);
      }

      res.json({ success: true });
    } catch (err) {
      console.error('Save device API error:', err);
      res.status(500).json({ error: 'حدث خطأ في تسجيل الجهاز.' });
    }
  });

  // Delete/Unregister a device
  app.delete('/api/devices/:id', async (req, res) => {
    try {
      const userId = req.headers['x-user-id'] as string;
      const { id } = req.params;
      if (!userId) {
        return res.status(401).json({ error: 'غير مصرح بالدخول' });
      }

      await firebaseDb.deleteDevice(id);
      res.json({ error: null });
    } catch (err) {
      console.error('Delete device API error:', err);
      res.status(500).json({ error: 'حدث خطأ في حذف الجهاز.' });
    }
  });

  // Get unsynced raw logs pushed from ZK devices for this tenant
  app.get('/api/devices/raw-logs', async (req, res) => {
    try {
      const userId = req.headers['x-user-id'] as string;
      if (!userId) {
        return res.status(401).json({ error: 'غير مصرح بالدخول' });
      }

      const { fromDate, toDate, startDate, endDate } = req.query as any;
      const start = fromDate || startDate;
      const end = toDate || endDate;

      const tenantDevices = await firebaseDb.getDevices(userId);
      const tenantSNs = tenantDevices.map((d: any) => d.serial_number.toUpperCase());

      let rawLogs = await firebaseDb.getRawLogsBySerialNumbers(tenantSNs);

      // Filter by date range if provided
      if (start || end) {
        rawLogs = rawLogs.filter((l: any) => {
          const logDate = l.timestamp ? l.timestamp.split(' ')[0] : (l.created_at ? l.created_at.split('T')[0] : '');
          if (start && logDate < start) return false;
          if (end && logDate > end) return false;
          return true;
        });
      }

      const unsynced = rawLogs.filter((l: any) => !l.synced);

      const tenantEmployees = await firebaseDb.getEmployees(userId);
      const enriched = unsynced.map((l: any) => {
        const emp = tenantEmployees.find(
          (e: any) => e.emp_id.trim().toLowerCase() === l.pin.trim().toLowerCase()
        ) || null;

        return {
          ...l,
          matchedEmployee: emp
        };
      });

      res.json(enriched);
    } catch (err) {
      console.error('Get raw-logs API error:', err);
      res.status(500).json({ error: 'حدث خطأ في جلب البصمات غير المزامنة.' });
    }
  });

  // Convert online device logs to in-memory Virtual DAT string for the Smart Engine
  app.get('/api/devices/virtual-dat', async (req, res) => {
    try {
      const userId = req.headers['x-user-id'] as string;
      if (!userId) {
        return res.status(401).json({ error: 'غير مصرح بالدخول' });
      }

      const { fromDate, toDate, startDate, endDate } = req.query as any;
      const start = fromDate || startDate;
      const end = toDate || endDate;

      const tenantDevices = await firebaseDb.getDevices(userId);
      const tenantSNs = tenantDevices.map((d: any) => d.serial_number.toUpperCase());

      let rawLogs = await firebaseDb.getRawLogsBySerialNumbers(tenantSNs);

      // Filter by date range if specified
      if (start || end) {
        rawLogs = rawLogs.filter((l: any) => {
          const logDate = l.timestamp ? l.timestamp.split(' ')[0] : (l.created_at ? l.created_at.split('T')[0] : '');
          if (start && logDate < start) return false;
          if (end && logDate > end) return false;
          return true;
        });
      }

      // Convert raw logs in memory to standard DAT format: PIN\tYYYY-MM-DD HH:MM:SS\t1\t0
      const datLines = rawLogs.map((l: any) => {
        const pin = (l.pin || '0').trim();
        const ts = (l.timestamp || '').trim();
        const status = l.status !== undefined ? l.status : 1;
        return `${pin}\t${ts}\t${status}\t0`;
      }).filter(line => line.length > 5);

      const datText = datLines.join('\r\n');

      res.json({
        datText,
        count: datLines.length,
        period: { fromDate: start || null, toDate: end || null }
      });
    } catch (err) {
      console.error('Virtual DAT API error:', err);
      res.status(500).json({ error: 'حدث خطأ في تحويل بصمات الجهاز أونلاين بالذاكرة.' });
    }
  });

  // Pull and sync online logs into actual tenant attendance logs
  app.post('/api/devices/sync-logs', async (req, res) => {
    try {
      const userId = req.headers['x-user-id'] as string;
      if (!userId) {
        return res.status(401).json({ error: 'غير مصرح بالدخول' });
      }

      const { log_ids } = req.body;
      if (!Array.isArray(log_ids)) {
        return res.status(400).json({ error: { message: 'بيانات غير مكتملة.' } });
      }

      const tenantDevices = await firebaseDb.getDevices(userId);
      const tenantSNs = tenantDevices.map((d: any) => d.serial_number.toUpperCase());

      const rawLogs = await firebaseDb.getRawLogsBySerialNumbers(tenantSNs);
      const targetLogs = rawLogs.filter((l: any) => log_ids.includes(l.id) && !l.synced);

      if (targetLogs.length === 0) {
        return res.json({ success: true, count: 0 });
      }

      const tenantEmployees = await firebaseDb.getEmployees(userId);
      const grouping: Record<string, { employee: any; date: string; times: string[] }> = {};

      targetLogs.forEach((l: any) => {
        const emp = tenantEmployees.find(
          (e: any) => e.emp_id.trim().toLowerCase() === l.pin.trim().toLowerCase()
        );
        if (!emp) return; // skip if not registered employee

        const [datePart, timePart] = l.timestamp.split(' ');
        if (!datePart || !timePart) return;

        const key = `${emp.id}_${datePart}`;
        if (!grouping[key]) {
          grouping[key] = {
            employee: emp,
            date: datePart,
            times: []
          };
        }
        const [h, m] = timePart.split(':');
        const cleanTime = `${h.padStart(2, '0')}:${m.padStart(2, '0')}`;
        grouping[key].times.push(cleanTime);
      });

      let countMerged = 0;

      for (const key of Object.keys(grouping)) {
        const { employee, date, times } = grouping[key];
        const sortedTimes = Array.from(new Set(times)).sort();

        let logRecord = await firebaseDb.findAttendanceLog(employee.id, date);
        if (!logRecord) {
          logRecord = {
            id: `log_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
            user_id: userId,
            employee_id: employee.id,
            date: date,
            shift1_check_in: null,
            shift1_check_out: null,
            shift2_check_in: null,
            shift2_check_out: null,
            notes: 'مزامنة جهاز البصمة أونلاين'
          };
        }

        const isDual = employee.is_dual_shift;
        const combinedTimesSet = new Set<string>();
        if (logRecord.shift1_check_in) combinedTimesSet.add(logRecord.shift1_check_in);
        if (logRecord.shift1_check_out) combinedTimesSet.add(logRecord.shift1_check_out);
        if (logRecord.shift2_check_in) combinedTimesSet.add(logRecord.shift2_check_in);
        if (logRecord.shift2_check_out) combinedTimesSet.add(logRecord.shift2_check_out);
        sortedTimes.forEach(t => combinedTimesSet.add(t));

        const finalSortedTimes = Array.from(combinedTimesSet).sort();

        if (finalSortedTimes.length > 0) {
          if (isDual) {
            logRecord.shift1_check_in = finalSortedTimes[0] || null;
            if (finalSortedTimes.length === 2) {
              logRecord.shift1_check_out = finalSortedTimes[1] || null;
            } else if (finalSortedTimes.length === 3) {
              logRecord.shift1_check_out = finalSortedTimes[1] || null;
              logRecord.shift2_check_in = finalSortedTimes[2] || null;
            } else if (finalSortedTimes.length >= 4) {
              logRecord.shift1_check_out = finalSortedTimes[1] || null;
              logRecord.shift2_check_in = finalSortedTimes[2] || null;
              logRecord.shift2_check_out = finalSortedTimes[finalSortedTimes.length - 1] || null;
            }
          } else {
            logRecord.shift1_check_in = finalSortedTimes[0] || null;
            if (finalSortedTimes.length > 1) {
              logRecord.shift1_check_out = finalSortedTimes[finalSortedTimes.length - 1] || null;
            }
          }
        }

        logRecord.notes = 'تم سحب البصمة أونلاين من السحابة بنجاح';

        await firebaseDb.saveAttendanceLog(logRecord);
        countMerged++;
      }

      // Mark the processed raw logs as synced
      await firebaseDb.markRawLogsSynced(targetLogs.map((l: any) => l.id));

      res.json({ success: true, count: countMerged });
    } catch (err) {
      console.error('Sync logs API error:', err);
      res.status(500).json({ error: 'حدث خطأ في مزامنة سجلات الأجهزة.' });
    }
  });

  // --- VITE DEV MIDDLEWARE OR PRODUCTION SERVING ---

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath, {
      setHeaders: (res, filePath) => {
        if (filePath.endsWith('sw.js')) {
          res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
          res.setHeader('Service-Worker-Allowed', '/');
          res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        } else if (filePath.endsWith('manifest.json')) {
          res.setHeader('Content-Type', 'application/manifest+json; charset=utf-8');
        }
      }
    }));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Server] Live and listening at http://localhost:${PORT}`);
  });
}

startServer();
