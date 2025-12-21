# QR Gear Email Module - For Kingdom Connects Integration

## Overview

QR Gear uses **Resend** for transactional email delivery. The integration is designed to handle order confirmations, hosting expiration reminders, and can be extended for sales/marketing campaigns.

## Architecture

### Core File: `server/lib/email.ts`

The email module:
- Lazily fetches Resend API credentials from Replit Connectors
- Creates a Resend client instance per send
- Exports reusable email functions with HTML templates

### Current Email Types

#### 1. Order Confirmation Email
**Function:** `sendOrderConfirmationEmail()`
**Triggered:** After successful order placement in `POST /api/orders`
**Contains:**
- Order number and date
- Customer billing details
- Item table (product name, quantity, price)
- Order total with breakdown
- Fulfillment timeline expectations
- Support contact info

#### 2. Hosting Expiration Reminder
**Function:** `sendHostingExpirationReminder()`
**Triggered:** By cron job scanning `hostingReminders` table
**Tiered Urgency:**
- 30 days before: "Friendly reminder"
- 7 days before: "Action needed soon"
- Day of expiration: "Expires today!"
**Contains:**
- QR code identifier
- Expiration date
- Renewal CTA button
- Link to customer dashboard

## How Emails Are Triggered

### Transactional (Real-time)
```
User places order
  → POST /api/orders
    → Save order to database
    → Submit to Printify
    → await sendOrderConfirmationEmail()
```

### Scheduled (Cron Jobs)
```
server/lib/cron-jobs.ts → startCronJobs()
  → Runs on server startup
  → Hourly scan of hostingReminders table
  → Finds items expiring in 30/7/0 days
  → Sends appropriate reminder email
  → Marks reminder as sent
```

## Database Tables Involved

### `orders` / `orderItems`
- Customer email, order details for confirmation emails

### `hostingReminders`
- `qrDesignId`: Links to the QR design
- `reminderType`: "30_day" | "7_day" | "expiration"
- `sentAt`: Timestamp when sent (null = pending)
- `scheduledFor`: When to send

### `customGifts`
- `hostingExpiresAt`: Expiration date for hosted images
- `hostingTier`: 1yr, 3yr, 5yr, permanent

## Extending for Sales/Marketing

To add sales campaign emails to Kingdom Connects businesses:

### Needed Components:
1. **Campaign Model** - Store campaign content, segments, schedule
2. **Audience Segments** - Target by purchase history, category interest
3. **Consent Management** - Track email preferences, unsubscribe handling
4. **Batched Sending** - Use Resend's broadcast API for large lists

### Potential API Endpoints:
```
POST /api/admin/campaigns - Create campaign
POST /api/admin/campaigns/:id/send - Launch campaign
GET /api/campaigns/:id/unsubscribe - Handle unsubscribe
```

### Integration Points with Kingdom Connects:
- KC can send business promo requests via API
- QR Gear sends promotional emails featuring KC business QR products
- Shared customer consent database
- Co-branded email templates

## Environment Variables

Required for email functionality:
- Resend API key (managed via Replit Connectors)
- `VITE_APP_URL`: Base URL for links in emails

## Example: Sending an Order Confirmation

```typescript
import { sendOrderConfirmationEmail } from "./lib/email";

// After order is saved
await sendOrderConfirmationEmail({
  to: order.customerEmail,
  orderNumber: order.id,
  orderDate: order.createdAt,
  items: orderItems.map(item => ({
    name: item.productName,
    quantity: item.quantity,
    price: item.price
  })),
  total: order.total,
  customerName: order.customerName
});
```

## For KC Integration

When a Kingdom Connects business orders promotional QR products:
1. Order confirmation includes KC business branding
2. Follow-up emails can feature "Your KC Business QR is Ready!"
3. Hosting reminders reference the KC business listing URL
4. Sales campaigns can target KC business owners specifically

---

*Document created for cross-AI communication between QR Gear and Kingdom Connects platforms.*
