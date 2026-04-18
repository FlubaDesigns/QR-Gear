import { Resend } from 'resend';

let connectionSettings: any;

async function getCredentials() {
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY 
    ? 'repl ' + process.env.REPL_IDENTITY 
    : process.env.WEB_REPL_RENEWAL 
    ? 'depl ' + process.env.WEB_REPL_RENEWAL 
    : null;

  if (!xReplitToken) {
    throw new Error('X_REPLIT_TOKEN not found for repl/depl');
  }

  connectionSettings = await fetch(
    'https://' + hostname + '/api/v2/connection?include_secrets=true&connector_names=resend',
    {
      headers: {
        'Accept': 'application/json',
        'X_REPLIT_TOKEN': xReplitToken
      }
    }
  ).then(res => res.json()).then(data => data.items?.[0]);

  if (!connectionSettings || (!connectionSettings.settings.api_key)) {
    throw new Error('Resend not connected');
  }
  return {
    apiKey: connectionSettings.settings.api_key, 
    fromEmail: connectionSettings.settings.from_email
  };
}

async function getResendClient() {
  const { apiKey } = await getCredentials();
  return {
    client: new Resend(apiKey),
    fromEmail: connectionSettings.settings.from_email
  };
}

interface OrderEmailData {
  orderId: string;
  customerEmail: string;
  customerName: string;
  items: Array<{
    productId: string;
    quantity: number;
    price: number;
  }>;
  totalAmount: number;
  orderDate: Date;
}

interface HostingReminderData {
  customerEmail: string;
  customerName: string;
  imageId: string;
  imageTitle: string;
  expirationDate: Date;
  daysRemaining: number;
  renewalUrl: string;
}

export async function sendOrderConfirmationEmail(data: OrderEmailData): Promise<boolean> {
  try {
    const { client, fromEmail } = await getResendClient();
    
    const itemsHtml = data.items.map(item => `
      <tr>
        <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">Product #${item.productId.slice(0, 8)}</td>
        <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: center;">${item.quantity}</td>
        <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: right;">$${item.price.toFixed(2)}</td>
      </tr>
    `).join('');

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 0; background-color: #f9fafb;">
        <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
          <div style="background-color: white; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); padding: 32px;">
            <div style="text-align: center; margin-bottom: 32px;">
              <h1 style="color: #111827; margin: 0 0 8px;">Order Confirmed!</h1>
              <p style="color: #6b7280; margin: 0;">Thank you for your purchase, ${data.customerName}!</p>
            </div>
            
            <div style="background-color: #f3f4f6; border-radius: 6px; padding: 16px; margin-bottom: 24px;">
              <p style="margin: 0; color: #374151;"><strong>Order Number:</strong> ${data.orderId.slice(0, 8).toUpperCase()}</p>
              <p style="margin: 8px 0 0; color: #374151;"><strong>Order Date:</strong> ${data.orderDate.toLocaleDateString()}</p>
            </div>
            
            <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px;">
              <thead>
                <tr style="background-color: #f9fafb;">
                  <th style="padding: 12px; text-align: left; border-bottom: 2px solid #e5e7eb;">Product</th>
                  <th style="padding: 12px; text-align: center; border-bottom: 2px solid #e5e7eb;">Qty</th>
                  <th style="padding: 12px; text-align: right; border-bottom: 2px solid #e5e7eb;">Price</th>
                </tr>
              </thead>
              <tbody>
                ${itemsHtml}
              </tbody>
              <tfoot>
                <tr>
                  <td colspan="2" style="padding: 16px 12px; text-align: right; font-weight: bold;">Total:</td>
                  <td style="padding: 16px 12px; text-align: right; font-weight: bold; font-size: 18px;">$${data.totalAmount.toFixed(2)}</td>
                </tr>
              </tfoot>
            </table>
            
            <div style="border-top: 1px solid #e5e7eb; padding-top: 24px;">
              <h3 style="color: #111827; margin: 0 0 12px;">What happens next?</h3>
              <ol style="color: #6b7280; margin: 0; padding-left: 20px;">
                <li style="margin-bottom: 8px;">Your order is being sent to our production partner</li>
                <li style="margin-bottom: 8px;">Your custom QR products will be printed and quality checked</li>
                <li style="margin-bottom: 8px;">You'll receive shipping updates via email</li>
                <li>Typical delivery time is 5-7 business days</li>
              </ol>
            </div>
          </div>
          
          <div style="text-align: center; margin-top: 24px; color: #9ca3af; font-size: 14px;">
            <p>Questions? Reply to this email or contact support.</p>
            <p>&copy; ${new Date().getFullYear()} QR Gear. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    await client.emails.send({
      from: fromEmail || 'QR Gear <noreply@qrgear.com>',
      to: data.customerEmail,
      subject: `Order Confirmed - #${data.orderId.slice(0, 8).toUpperCase()}`,
      html,
    });

    console.log(`Order confirmation email sent to ${data.customerEmail}`);
    return true;
  } catch (error) {
    console.error('Failed to send order confirmation email:', error);
    return false;
  }
}

export async function sendHostingExpirationReminder(data: HostingReminderData): Promise<boolean> {
  try {
    const { client, fromEmail } = await getResendClient();
    
    const urgencyText = data.daysRemaining === 0 
      ? 'expires today' 
      : data.daysRemaining === 1 
        ? 'expires tomorrow'
        : `expires in ${data.daysRemaining} days`;

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 0; background-color: #f9fafb;">
        <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
          <div style="background-color: white; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); padding: 32px;">
            <div style="text-align: center; margin-bottom: 32px;">
              <h1 style="color: #111827; margin: 0 0 8px;">Image Hosting Reminder</h1>
              <p style="color: #6b7280; margin: 0;">Hi ${data.customerName}, your hosted image ${urgencyText}!</p>
            </div>
            
            <div style="background-color: ${data.daysRemaining <= 7 ? '#fef2f2' : '#fffbeb'}; border-radius: 6px; padding: 16px; margin-bottom: 24px; border: 1px solid ${data.daysRemaining <= 7 ? '#fecaca' : '#fde68a'};">
              <p style="margin: 0; color: #374151;"><strong>Image:</strong> ${data.imageTitle || 'Your QR Image'}</p>
              <p style="margin: 8px 0 0; color: #374151;"><strong>Expiration Date:</strong> ${data.expirationDate.toLocaleDateString()}</p>
            </div>
            
            <p style="color: #6b7280; line-height: 1.6;">
              When your image hosting expires, the QR code on your products will no longer display your image. 
              To keep your image accessible, please renew your hosting before the expiration date.
            </p>
            
            <div style="text-align: center; margin: 32px 0;">
              <a href="${data.renewalUrl}" style="display: inline-block; background-color: #2563eb; color: white; text-decoration: none; padding: 14px 28px; border-radius: 6px; font-weight: 600;">
                Renew Now
              </a>
            </div>
            
            <p style="color: #9ca3af; font-size: 14px; text-align: center;">
              If you no longer need this image hosted, you can ignore this email.
            </p>
          </div>
          
          <div style="text-align: center; margin-top: 24px; color: #9ca3af; font-size: 14px;">
            <p>&copy; ${new Date().getFullYear()} QR Gear. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    await client.emails.send({
      from: fromEmail || 'QR Gear <noreply@qrgear.com>',
      to: data.customerEmail,
      subject: data.daysRemaining === 0 
        ? `URGENT: Your QR image hosting expires today!`
        : `Your QR image hosting ${urgencyText}`,
      html,
    });

    console.log(`Hosting reminder email sent to ${data.customerEmail}`);
    return true;
  } catch (error) {
    console.error('Failed to send hosting reminder email:', error);
    return false;
  }
}

interface InstanceReminderData {
  customerEmail: string;
  instanceId: string;
  daysRemaining: number;
  renewalUrl: string;
  expirationDate: Date;
}

export async function sendInstanceExpirationReminder(data: InstanceReminderData): Promise<boolean> {
  try {
    const { client, fromEmail } = await getResendClient();
    
    const urgencyText = data.daysRemaining === 1 
      ? 'expires tomorrow' 
      : data.daysRemaining === 0
        ? 'expires today'
        : `expires in ${data.daysRemaining} days`;

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 0; background-color: #f9fafb;">
        <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
          <div style="background-color: white; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); padding: 32px;">
            <div style="text-align: center; margin-bottom: 32px;">
              <h1 style="color: #111827; margin: 0 0 8px;">QR Hosting Renewal</h1>
              <p style="color: #6b7280; margin: 0;">Your QR hosting ${urgencyText}!</p>
            </div>
            
            <div style="background-color: ${data.daysRemaining <= 7 ? '#fef2f2' : '#fffbeb'}; border-radius: 6px; padding: 16px; margin-bottom: 24px; border: 1px solid ${data.daysRemaining <= 7 ? '#fecaca' : '#fde68a'};">
              <p style="margin: 0; color: #374151;"><strong>Expiration Date:</strong> ${data.expirationDate.toLocaleDateString()}</p>
            </div>
            
            <p style="color: #6b7280; line-height: 1.6;">
              When your QR hosting expires, scanning your QR code will show a renewal page instead of your content.
              Renew for just <strong>$4.99</strong> to extend your hosting for another 3 years.
            </p>
            
            <div style="text-align: center; margin: 32px 0;">
              <a href="${data.renewalUrl}" style="display: inline-block; background-color: #2563eb; color: white; text-decoration: none; padding: 14px 28px; border-radius: 6px; font-weight: 600;">
                Renew for $4.99
              </a>
            </div>
            
            <p style="color: #9ca3af; font-size: 14px; text-align: center;">
              Questions? Reply to this email and we'll help you out.
            </p>
          </div>
          
          <div style="text-align: center; margin-top: 24px; color: #9ca3af; font-size: 14px;">
            <p>&copy; ${new Date().getFullYear()} QR Gear. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    await client.emails.send({
      from: fromEmail || 'QR Gear <noreply@qrgear.com>',
      to: data.customerEmail,
      subject: data.daysRemaining <= 1 
        ? `URGENT: Your QR hosting ${urgencyText}!`
        : `Your QR hosting ${urgencyText}`,
      html,
    });

    console.log(`Instance expiration reminder sent to ${data.customerEmail}`);
    return true;
  } catch (error) {
    console.error('Failed to send instance expiration reminder:', error);
    return false;
  }
}

export async function sendShippingUpdateEmail(
  customerEmail: string,
  customerName: string,
  orderId: string,
  trackingNumber: string,
  carrier: string
): Promise<boolean> {
  try {
    const { client, fromEmail } = await getResendClient();
    
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 0; background-color: #f9fafb;">
        <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
          <div style="background-color: white; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); padding: 32px;">
            <div style="text-align: center; margin-bottom: 32px;">
              <h1 style="color: #111827; margin: 0 0 8px;">Your Order Has Shipped!</h1>
              <p style="color: #6b7280; margin: 0;">Great news, ${customerName}! Your QR Gear order is on its way.</p>
            </div>
            
            <div style="background-color: #ecfdf5; border-radius: 6px; padding: 16px; margin-bottom: 24px; border: 1px solid #a7f3d0;">
              <p style="margin: 0; color: #374151;"><strong>Order Number:</strong> ${orderId.slice(0, 8).toUpperCase()}</p>
              <p style="margin: 8px 0 0; color: #374151;"><strong>Carrier:</strong> ${carrier}</p>
              <p style="margin: 8px 0 0; color: #374151;"><strong>Tracking Number:</strong> ${trackingNumber}</p>
            </div>
            
            <p style="color: #6b7280; line-height: 1.6;">
              You can track your package using the tracking number above. Most orders arrive within 5-7 business days.
            </p>
          </div>
          
          <div style="text-align: center; margin-top: 24px; color: #9ca3af; font-size: 14px;">
            <p>&copy; ${new Date().getFullYear()} QR Gear. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    await client.emails.send({
      from: fromEmail || 'QR Gear <noreply@qrgear.com>',
      to: customerEmail,
      subject: `Your QR Gear Order Has Shipped! - #${orderId.slice(0, 8).toUpperCase()}`,
      html,
    });

    console.log(`Shipping update email sent to ${customerEmail}`);
    return true;
  } catch (error) {
    console.error('Failed to send shipping update email:', error);
    return false;
  }
}

interface ActivationEmailData {
  customerEmail: string;
  customerName: string;
  activationCode: string;
  productName: string;
  previewImageUrl?: string | null;
  orderId: string;
}

export async function sendActivationEmail(data: ActivationEmailData): Promise<boolean> {
  const { customerEmail, customerName, activationCode, productName, previewImageUrl, orderId } = data;
  try {
    const { client, fromEmail } = await getResendClient();
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

            ${previewImageUrl ? `
            <div style="text-align:center;margin-bottom:24px;">
              <img src="${previewImageUrl}" alt="${productName}" style="max-width:200px;border-radius:8px;" />
            </div>
            ` : ''}

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
              <a href="${activationUrl}" style="display:inline-block;background:#2563eb;color:#ffffff;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:600;font-size:16px;">
                Activate Now
              </a>
              <p style="color:#64748b;font-size:11px;margin:12px 0 0;">Or paste this link in your browser:<br/>${activationUrl}</p>
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

    await client.emails.send({
      from: fromEmail || 'QR Gear <noreply@qrgear.com>',
      to: customerEmail,
      subject: `Your QR Activation Code — ${productName}`,
      html,
    });

    console.log(`[Email] Activation email sent to ${customerEmail} with code ${activationCode}`);
    return true;
  } catch (error) {
    console.error('[Email] Failed to send activation email:', error);
    return false;
  }
}
