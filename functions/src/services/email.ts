import { Resend } from 'resend';

  // ============ EMAIL SERVICE (QR Gear - Separate from KC) ============

function getResendApiKey(): string {
  return process.env.QR_RESEND_API_KEY || '';
}

function getResendClient(): Resend | null {
  const apiKey = getResendApiKey();
  if (!apiKey || apiKey.length < 10) {
    return null;
  }
  return new Resend(apiKey);
}

const QR_GEAR_FROM_EMAIL = 'QR Gear <noreply@qrgear.com>';

interface OrderEmailData {
  orderId: string;
  customerEmail: string;
  customerName: string;
  items: Array<{
    productName: string;
    quantity: number;
    price: string;
  }>;
  totalAmount: string;
  shippingAddress?: {
    address1: string;
    address2?: string;
    city: string;
    region: string;
    zip: string;
    country: string;
  };
}

interface ShippingEmailData {
  orderId: string;
  customerEmail: string;
  customerName: string;
  trackingNumber: string;
  trackingUrl?: string;
  carrier: string;
}

interface ActivationEmailData {
  customerEmail: string;
  customerName: string;
  activationCode: string;
  productName: string;
  previewImageUrl?: string | null;
  orderId: string;
}

async function sendActivationEmail(data: ActivationEmailData): Promise<boolean> {
  const { customerEmail, customerName, activationCode, productName, previewImageUrl, orderId } = data;
  const client = getResendClient();
  if (!client) {
    console.warn('[Email] Resend client not configured — skipping activation email');
    return false;
  }
  const baseUrl = 'https://qrgear-c1ffd.web.app';
  const activationUrl = `${baseUrl}/claim/${activationCode}`;

  const html = `
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
    <body style="margin:0;padding:0;background:#0f172a;font-family:Arial,sans-serif;color:#e2e8f0;">
      <div style="max-width:560px;margin:0 auto;padding:32px 16px;">
        <div style="text-align:center;margin-bottom:32px;">
          <h1 style="color:#ffffff;font-size:24px;margin:0;">QR Gear</h1>
          <p style="color:#94a3b8;margin:4px 0 0;">Your item is ready to activate</p>
        </div>
        <div style="background:#1e293b;border-radius:12px;padding:32px;margin-bottom:24px;">
          <p style="color:#94a3b8;margin:0 0 8px;">Hello ${customerName},</p>
          <p style="color:#e2e8f0;margin:0 0 24px;line-height:1.6;">
            Your <strong>${productName}</strong> is on its way. When it arrives, scan the QR code on your item and enter your activation code below to start your hosting.
          </p>
          ${previewImageUrl ? `<div style="text-align:center;margin-bottom:24px;"><img src="${previewImageUrl}" alt="${productName}" style="max-width:200px;border-radius:8px;" /></div>` : ''}
          <div style="background:#0f172a;border:1px solid #334155;border-radius:8px;padding:24px;text-align:center;margin-bottom:24px;">
            <p style="color:#64748b;font-size:12px;text-transform:uppercase;letter-spacing:1px;margin:0 0 8px;">Your Activation Code</p>
            <p style="color:#ffffff;font-size:32px;font-weight:700;font-family:monospace;letter-spacing:4px;margin:0;">${activationCode}</p>
          </div>
          <div style="background:#164e63;border-radius:8px;padding:16px;margin-bottom:24px;">
            <p style="color:#7dd3fc;font-size:13px;margin:0 0 8px;font-weight:600;">How to activate:</p>
            <ol style="color:#bae6fd;font-size:13px;margin:0;padding-left:20px;line-height:1.8;">
              <li>Scan the QR code on your ${productName}</li>
              <li>Tap <strong>"Activate My Item"</strong> on the page that opens</li>
              <li>Enter your activation code above</li>
              <li>Your 1 year of free hosting starts the moment you activate</li>
            </ol>
          </div>
          <div style="text-align:center;">
            <a href="${activationUrl}" style="display:inline-block;background:#2563eb;color:#ffffff;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:600;font-size:16px;">Activate Now</a>
            <p style="color:#64748b;font-size:11px;margin:12px 0 0;">Or paste this link: ${activationUrl}</p>
          </div>
        </div>
        <div style="text-align:center;">
          <p style="color:#475569;font-size:12px;margin:0;">Order #${orderId.slice(0, 8).toUpperCase()}</p>
          <p style="color:#334155;font-size:11px;margin:4px 0 0;">Keep this email — your activation code is only valid once.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  try {
    await client.emails.send({
      from: QR_GEAR_FROM_EMAIL,
      to: customerEmail,
      subject: `Your QR Activation Code — ${productName}`,
      html,
    });
    console.log(`[Email] Activation email sent to ${customerEmail} with code ${activationCode}`);
    return true;
  } catch (err) {
    console.error('[Email] Failed to send activation email:', err);
    return false;
  }
}

  export { getResendApiKey, getResendClient, QR_GEAR_FROM_EMAIL, sendActivationEmail };
  export type { OrderEmailData, ShippingEmailData, ActivationEmailData };
  