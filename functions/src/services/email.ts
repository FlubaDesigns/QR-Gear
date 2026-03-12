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

  export { getResendApiKey, getResendClient, QR_GEAR_FROM_EMAIL };
  export type { OrderEmailData, ShippingEmailData };
  