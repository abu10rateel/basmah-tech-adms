import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import nodemailer from 'nodemailer';

export async function generateInvoicePdf(data: {
  companyName: string;
  email: string;
  activationDate: string;
  expiryDate: string;
  planType: string;
  months: number;
  planPrice: string;
}): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([600, 800]);
  const { width, height } = page.getSize();

  // Helvetica works flawlessly for English text in pdf-lib
  const font = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const regularFont = await pdfDoc.embedFont(StandardFonts.Helvetica);

  // Draw header bar (Navy Slate Color)
  page.drawRectangle({
    x: 0,
    y: height - 120,
    width: width,
    height: 120,
    color: rgb(0.05, 0.1, 0.2),
  });

  // Logo / Title text (Emerald Green Theme)
  page.drawText('BASMA TECH - CLOUD ATTENDANCE', {
    x: 40,
    y: height - 55,
    size: 18,
    font: font,
    color: rgb(0.1, 0.8, 0.5),
  });

  page.drawText('Official Activation & Welcome Letter', {
    x: 40,
    y: height - 80,
    size: 12,
    font: regularFont,
    color: rgb(1, 1, 1),
  });

  page.drawText('بصمة تك - تفعيل الاشتراك والفاتورة', {
    x: 40,
    y: height - 102,
    size: 10,
    font: font,
    color: rgb(0.8, 0.9, 0.8),
  });

  // Title: Invoice Details
  page.drawText('INVOICE & SUBSCRIPTION DETAILS / تفاصيل الفاتورة والاشتراك', {
    x: 40,
    y: height - 180,
    size: 12,
    font: font,
    color: rgb(0.05, 0.1, 0.2),
  });

  // Separator Line
  page.drawLine({
    start: { x: 40, y: height - 190 },
    end: { x: width - 40, y: height - 190 },
    thickness: 1.5,
    color: rgb(0.1, 0.8, 0.5),
  });

  const drawRow = (labelEn: string, labelAr: string, value: string, yPos: number) => {
    // English label
    page.drawText(`${labelEn} (${labelAr})`, {
      x: 40,
      y: yPos,
      size: 10,
      font: font,
      color: rgb(0.3, 0.3, 0.3),
    });
    // Value
    page.drawText(value, {
      x: 300,
      y: yPos,
      size: 10,
      font: regularFont,
      color: rgb(0.1, 0.1, 0.1),
    });
  };

  let currentY = height - 230;
  drawRow('Company Name', 'اسم الشركة', data.companyName, currentY);
  currentY -= 30;
  drawRow('Client Email', 'البريد الإلكتروني', data.email, currentY);
  currentY -= 30;
  drawRow('Subscription Plan', 'باقة الاشتراك', data.planType, currentY);
  currentY -= 30;
  drawRow('Duration (Months)', 'مدة الاشتراك', `${data.months} Months`, currentY);
  currentY -= 30;
  drawRow('Activation Date', 'تاريخ التفعيل', data.activationDate, currentY);
  currentY -= 30;
  drawRow('Subscription Expiry', 'تاريخ انتهاء الاشتراك', data.expiryDate, currentY);
  currentY -= 30;
  drawRow('Total Plan Price', 'قيمة الباقة', data.planPrice, currentY);

  // Line Separator
  currentY -= 25;
  page.drawLine({
    start: { x: 40, y: currentY },
    end: { x: width - 40, y: currentY },
    thickness: 1,
    color: rgb(0.8, 0.8, 0.8),
  });

  // Welcome Text Header
  currentY -= 35;
  page.drawText('WELCOME TO THE FUTURE OF ATTENDANCE MANAGEMENT', {
    x: 40,
    y: currentY,
    size: 12,
    font: font,
    color: rgb(0.05, 0.1, 0.2),
  });

  currentY -= 20;
  const messageEn = [
    'Your Basma Tech account is now fully active! We are thrilled to have you onboard.',
    'This invoice confirms the successful receipt and processing of your subscription.',
    'You can now log in to manage shifts, register employees, connect devices,',
    'and download attendance logs in real time through our secure cloud system.',
    '',
    'For any inquiries or technical support, please contact us at: info@basmatech.sa'
  ];

  for (const line of messageEn) {
    if (line !== '') {
      page.drawText(line, {
        x: 40,
        y: currentY,
        size: 9,
        font: regularFont,
        color: rgb(0.2, 0.2, 0.2),
      });
    }
    currentY -= 18;
  }

  // Draw Arabic Welcome Text as fallback (using latin letters for security to never crash pdf-lib font mappings)
  currentY -= 15;
  page.drawText('MARHABAN BIKUM FI BASMA TECH', {
    x: 40,
    y: currentY,
    size: 11,
    font: font,
    color: rgb(0.1, 0.8, 0.5),
  });
  
  currentY -= 18;
  page.drawText('Hesabukum mofaal an wa jahiz lil estethmar fi monasatek.', {
    x: 40,
    y: currentY,
    size: 9,
    font: regularFont,
    color: rgb(0.3, 0.3, 0.3),
  });

  // Footer bar (Light Gray)
  page.drawRectangle({
    x: 0,
    y: 0,
    width: width,
    height: 50,
    color: rgb(0.95, 0.95, 0.95),
  });

  page.drawText('Basma Tech Inc. - Call Support: +966557538856 - https://basmatech.sa', {
    x: 40,
    y: 20,
    size: 8,
    font: regularFont,
    color: rgb(0.5, 0.5, 0.5),
  });

  return await pdfDoc.save();
}

function createNodemailerTransporter(user?: string, pass?: string) {
  const host = process.env.SMTP_HOST;
  const port = parseInt(process.env.SMTP_PORT || '465', 10);

  if (user && pass) {
    if (host && host !== 'smtp.gmail.com') {
      console.log(`[Email] Using custom SMTP configuration: ${host}:${port} (${user})`);
      return nodemailer.createTransport({
        host,
        port,
        secure: port === 465 || port === 587,
        auth: { user, pass },
      });
    } else {
      console.log(`[Email] Using Gmail Nodemailer transport with user: ${user}`);
      return nodemailer.createTransport({
        service: 'gmail',
        auth: { user, pass },
      });
    }
  }

  return null;
}

export async function sendEmailWithAttachment(
  to: string,
  subject: string,
  htmlContent: string,
  pdfBuffer: Uint8Array,
  fileName: string
) {
  try {
    let transporter: nodemailer.Transporter | null = null;
    const user = process.env.EMAIL_USER || process.env.SMTP_USER;
    const pass = process.env.EMAIL_PASS || process.env.SMTP_PASS;

    transporter = createNodemailerTransporter(user, pass);

    if (!transporter) {
      console.log('[Email] No EMAIL_USER/EMAIL_PASS credentials found. Creating automated Ethereal Test Account...');
      const testAccount = await nodemailer.createTestAccount();
      transporter = nodemailer.createTransport({
        host: testAccount.smtp.host,
        port: testAccount.smtp.port,
        secure: testAccount.smtp.secure,
        auth: {
          user: testAccount.user,
          pass: testAccount.pass,
        },
      });
      console.log(`[Email] Generated Ethereal Test Credentials: ${testAccount.user}`);
    }

    const mailOptions = {
      from: `"${process.env.SMTP_FROM_NAME || 'بصمة تك - Basma Tech'}" <${user || 'no-reply@basmatech.sa'}>`,
      to,
      subject,
      html: htmlContent,
      attachments: [
        {
          filename: fileName,
          content: Buffer.from(pdfBuffer),
          contentType: 'application/pdf',
        },
      ],
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('[Email] Email sent successfully! Message ID:', info.messageId);

    const previewUrl = nodemailer.getTestMessageUrl(info);
    if (previewUrl) {
      console.log('[Email] Ethereal Preview URL:', previewUrl);
      return { success: true, messageId: info.messageId, previewUrl };
    }

    return { success: true, messageId: info.messageId };
  } catch (err) {
    console.error('[Email] Error inside sendEmailWithAttachment:', err);
    throw err;
  }
}

export function generatePasswordResetEmailHtml(resetUrl: string, companyName?: string): string {
  const company = companyName ? ` (${companyName})` : '';
  return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>إعادة تعيين كلمة المرور - بصمة تك</title>
</head>
<body style="margin: 0; padding: 0; background-color: #0f172a; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; direction: rtl; text-align: right; color: #f8fafc;">
  <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #0f172a; padding: 40px 10px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 600px; background-color: #1e293b; border-radius: 16px; border: 1px solid #334155; overflow: hidden; box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5);">
          <!-- Header Bar -->
          <tr>
            <td style="background: linear-gradient(135deg, #0284c7 0%, #0d9488 100%); padding: 32px 24px; text-align: center;">
              <h1 style="margin: 0; color: #ffffff; font-size: 26px; font-weight: 800; letter-spacing: -0.5px;">بصمة تك | BASMA TECH</h1>
              <p style="margin: 8px 0 0 0; color: #e0f2fe; font-size: 14px; opacity: 0.95;">نظام إدارة الحضور والانصراف السحابي الذكي</p>
            </td>
          </tr>
          
          <!-- Content Body -->
          <tr>
            <td style="padding: 36px 32px; color: #cbd5e1;">
              <h2 style="margin: 0 0 16px 0; color: #f8fafc; font-size: 20px; font-weight: 700;">أهلاً بك${company} 👋</h2>
              <p style="margin: 0 0 20px 0; font-size: 15px; line-height: 1.7; color: #94a3b8;">
                تلقينا طلباً لإعادة تعيين كلمة المرور الخاصة بحسابك في منصة <strong style="color: #38bdf8;">بصمة تك</strong>. يمكنك إنشاء كلمة مرور جديدة فوراً بالنقر على الزر أدناه:
              </p>

              <!-- Reset Button -->
              <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="margin: 28px 0;">
                <tr>
                  <td align="center">
                    <a href="${resetUrl}" target="_blank" style="display: inline-block; background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: #ffffff; text-decoration: none; font-size: 16px; font-weight: 700; padding: 14px 36px; border-radius: 12px; box-shadow: 0 10px 15px -3px rgba(16, 185, 129, 0.3); border: 1px solid #34d399;">
                      إعادة تعيين كلمة المرور
                    </a>
                  </td>
                </tr>
              </table>

              <!-- Security Notice Callout -->
              <div style="background-color: #0f172a; border-right: 4px solid #10b981; border-radius: 8px; padding: 16px; margin: 24px 0;">
                <p style="margin: 0; font-size: 13px; line-height: 1.6; color: #a7f3d0;">
                  🔒 <strong>ملاحظة أمنية مهمة:</strong> هذا الرابط صلاحيته <strong>15 دقيقة فقط</strong> ومخصص للاستخدام مرة واحدة لضمان أمان حسابك.
                </p>
                <p style="margin: 6px 0 0 0; font-size: 12px; color: #94a3b8;">
                  إذا لم تقم بطلب إعادة تعيين كلمة المرور، فيمكنك تجاهل هذا البريد بأمان وسيبقى حسابك محميًا.
                </p>
              </div>

              <!-- Fallback Direct URL Link -->
              <p style="margin: 24px 0 8px 0; font-size: 13px; color: #64748b;">
                إذا لم يعمل الزر أعلى، يمكنك نسخ الرابط التالي ولصقه في متصفحك مباشرة:
              </p>
              <div style="background-color: #090d16; padding: 12px; border-radius: 8px; word-break: break-all; border: 1px solid #1e293b; font-family: monospace; font-size: 12px; color: #38bdf8; direction: ltr; text-align: left;">
                ${resetUrl}
              </div>
            </td>
          </tr>

          <!-- Footer Bar -->
          <tr>
            <td style="background-color: #0f172a; padding: 24px; text-align: center; border-top: 1px solid #1e293b;">
              <p style="margin: 0 0 8px 0; font-size: 13px; color: #64748b; font-weight: 600;">بصمة تك - Basma Tech Inc.</p>
              <p style="margin: 0; font-size: 12px; color: #475569;">
                الدعم الفني: <a href="mailto:info@basmatech.sa" style="color: #38bdf8; text-decoration: none;">info@basmatech.sa</a> | هاتف: +966557538856
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export async function sendHtmlEmail(
  to: string,
  subject: string,
  htmlContent: string
) {
  try {
    let transporter: nodemailer.Transporter | null = null;
    const user = process.env.EMAIL_USER || process.env.SMTP_USER;
    const pass = process.env.EMAIL_PASS || process.env.SMTP_PASS;

    transporter = createNodemailerTransporter(user, pass);

    if (!transporter) {
      console.log('[Email] No EMAIL_USER/EMAIL_PASS credentials found. Creating automated Ethereal Test Account...');
      const testAccount = await nodemailer.createTestAccount();
      transporter = nodemailer.createTransport({
        host: testAccount.smtp.host,
        port: testAccount.smtp.port,
        secure: testAccount.smtp.secure,
        auth: {
          user: testAccount.user,
          pass: testAccount.pass,
        },
      });
      console.log(`[Email] Generated Ethereal Test Credentials: ${testAccount.user}`);
    }

    const mailOptions = {
      from: `"${process.env.SMTP_FROM_NAME || 'بصمة تك - Basma Tech'}" <${user || 'no-reply@basmatech.sa'}>`,
      to,
      subject,
      html: htmlContent,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('[Email] Password reset email sent successfully! Message ID:', info.messageId);

    const previewUrl = nodemailer.getTestMessageUrl(info);
    if (previewUrl) {
      console.log('[Email] Ethereal Preview URL:', previewUrl);
      return { success: true, messageId: info.messageId, previewUrl };
    }

    return { success: true, messageId: info.messageId };
  } catch (err) {
    console.error('[Email] Error inside sendHtmlEmail:', err);
    return { success: false, error: err };
  }
}
