/**
 * DEFAULT NEXUSMAIL TEMPLATES
 * 
 * Default email templates for QR Gear.
 * These can be seeded to Firestore on first run.
 */

import { NexusMailTemplate } from '../../../shared/nexusmail';

export const DEFAULT_TEMPLATES: NexusMailTemplate[] = [
  {
    slug: 'order_confirmation',
    version: '1.0.0',
    active: true,
    subject: 'Order Confirmed - #{{order_number}}',
    htmlBody: `
<h1 style="color: #333; margin: 0 0 16px;">Order Confirmed!</h1>
<p style="color: #666; font-size: 16px; line-height: 1.6; margin: 0 0 24px;">
  Thank you for your order, {{customer_name}}. We're excited to create your custom QR products!
</p>

<div style="background: #f5f5f5; padding: 16px; border-radius: 6px; margin-bottom: 24px;">
  <p style="margin: 0; font-family: monospace; font-size: 14px; color: #333;">
    <strong>Order #{{order_number}}</strong>
  </p>
</div>

<h3 style="color: #333; margin: 24px 0 12px;">Order Details</h3>
<div style="background: #fafafa; padding: 16px; border-radius: 6px; border-left: 4px solid #2563eb;">
  <pre style="margin: 0; font-family: inherit; white-space: pre-wrap; color: #666;">{{order_items}}</pre>
</div>

<p style="margin: 24px 0 0; font-size: 18px; font-weight: 600; color: #333;">
  Total: \${{order_total}}
</p>

<p style="color: #666; margin: 24px 0 0; font-size: 14px;">
  We'll send you another email with tracking information once your order ships.
</p>
`,
    textBody: `
Order Confirmed!

Thank you for your order, {{customer_name}}. We're excited to create your custom QR products!

Order #{{order_number}}

Order Details:
{{order_items}}

Total: \${{order_total}}

We'll send you another email with tracking information once your order ships.
`,
    requiredVars: ['order_number', 'customer_name', 'order_total', 'order_items'],
    category: 'orders',
  },

  {
    slug: 'order_shipped',
    version: '1.0.0',
    active: true,
    subject: 'Your Order Has Shipped - #{{order_number}}',
    htmlBody: `
<h1 style="color: #333; margin: 0 0 16px;">Your Order Has Shipped!</h1>
<p style="color: #666; font-size: 16px; line-height: 1.6; margin: 0 0 24px;">
  Great news, {{customer_name}}! Your QR Gear order is on its way.
</p>

<div style="background: #f5f5f5; padding: 16px; border-radius: 6px; margin-bottom: 24px;">
  <p style="margin: 0 0 8px; font-family: monospace; font-size: 14px; color: #333;">
    <strong>Order #{{order_number}}</strong>
  </p>
  <p style="margin: 0; font-size: 14px; color: #666;">
    Carrier: {{carrier}}
  </p>
</div>

<h3 style="color: #333; margin: 24px 0 12px;">Tracking Information</h3>
<div style="background: #e8f4fd; padding: 16px; border-radius: 6px; border-left: 4px solid #2563eb;">
  <p style="margin: 0 0 8px; font-size: 14px; color: #333;">
    <strong>Tracking Number:</strong> {{tracking_number}}
  </p>
  <p style="margin: 0; font-size: 14px;">
    <a href="{{tracking_url}}" style="color: #2563eb; text-decoration: underline;">Track Your Package</a>
  </p>
</div>

<p style="color: #666; margin: 24px 0 0; font-size: 14px;">
  Delivery times vary based on your location and shipping method. If you have any questions about your order, please don't hesitate to reach out.
</p>
`,
    textBody: `
Your Order Has Shipped!

Great news, {{customer_name}}! Your QR Gear order is on its way.

Order #{{order_number}}
Carrier: {{carrier}}

Tracking Information:
Tracking Number: {{tracking_number}}
Track Your Package: {{tracking_url}}

Delivery times vary based on your location and shipping method. If you have any questions about your order, please don't hesitate to reach out.
`,
    requiredVars: ['order_number', 'customer_name', 'tracking_number', 'carrier'],
    category: 'orders',
  },

  {
    slug: 'password_reset',
    version: '1.0.0',
    active: true,
    subject: 'Reset Your Password',
    htmlBody: `
<h1 style="color: #333; margin: 0 0 16px;">Reset Your Password</h1>
<p style="color: #666; font-size: 16px; line-height: 1.6; margin: 0 0 24px;">
  Hi {{recipient_name}}, we received a request to reset your password for your QR Gear account.
</p>

<div style="text-align: center; margin: 32px 0;">
  <a href="{{reset_url}}" style="display: inline-block; background: #2563eb; color: white; padding: 14px 32px; border-radius: 6px; text-decoration: none; font-weight: 600; font-size: 16px;">
    Reset Password
  </a>
</div>

<p style="color: #666; font-size: 14px; margin: 24px 0 0;">
  This link will expire in {{expiry_time}}. If you didn't request a password reset, you can safely ignore this email.
</p>

<p style="color: #999; font-size: 12px; margin: 24px 0 0;">
  If the button doesn't work, copy and paste this link into your browser:<br>
  <a href="{{reset_url}}" style="color: #2563eb;">{{reset_url}}</a>
</p>
`,
    textBody: `
Reset Your Password

Hi {{recipient_name}}, we received a request to reset your password for your QR Gear account.

Reset your password here: {{reset_url}}

This link will expire in {{expiry_time}}. If you didn't request a password reset, you can safely ignore this email.
`,
    requiredVars: ['recipient_name', 'reset_url', 'expiry_time'],
    category: 'auth',
  },

  {
    slug: 'generic_notification',
    version: '1.0.0',
    active: true,
    subject: '{{notification_title}}',
    htmlBody: `
<h1 style="color: #333; margin: 0 0 16px;">{{notification_title}}</h1>
<p style="color: #666; font-size: 16px; line-height: 1.6; margin: 0 0 24px;">
  Hi {{recipient_name}},
</p>
<div style="color: #333; line-height: 1.8;">
  {{notification_body}}
</div>
`,
    textBody: `
{{notification_title}}

Hi {{recipient_name}},

{{notification_body}}
`,
    requiredVars: ['recipient_name', 'notification_title', 'notification_body'],
    category: 'notifications',
  },
];

/**
 * Seed default templates to Firestore.
 */
export async function seedDefaultTemplates(
  templateStore: { upsert: (template: NexusMailTemplate) => Promise<void> }
): Promise<number> {
  let seeded = 0;
  for (const template of DEFAULT_TEMPLATES) {
    try {
      await templateStore.upsert(template);
      seeded++;
      console.log(`[NexusMail] Seeded template: ${template.slug}`);
    } catch (error: any) {
      console.error(`[NexusMail] Failed to seed template ${template.slug}:`, error?.message);
    }
  }
  return seeded;
}
