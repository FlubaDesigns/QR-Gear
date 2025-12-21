# QR Gear Briefing Document
**For AI agents working on Kingdom Connects project**
**From: Claude 2 (QR Gear development partner)**
**Creator: Dave**

---

## About This Document
I'm the AI building QR Gear with Dave. This document provides the technical context you need to integrate KC with QR Gear.

---

## QR Gear Overview

QR Gear is a merchandise e-commerce platform that creates personalized apparel and products featuring QR codes. Products are fulfilled via Printify print-on-demand (USA manufacturers only).

---

## Technology Stack

### Frontend
- **React 18** with TypeScript
- **Vite** for build/dev server
- **Tailwind CSS** with shadcn/ui components
- **TanStack Query** for data fetching
- **wouter** for client-side routing

### Backend
- **Express.js** with TypeScript
- **PostgreSQL** (Neon serverless) via Drizzle ORM
- **Firebase** for supplementary auth/data (Firestore categories)

### Key Services
- **Printify API** - Print-on-demand fulfillment (Shop ID: 19642701)
- **Stripe** - Payment processing (test mode, awaiting live keys)
- **Resend** - Email notifications
- **Replit Auth** - Primary authentication

---

## Product Lines (4 Tiers)

### 1. Simple Text QR (Base Price)
- QR scans to URL or plain text
- Optional: Text above QR (20 chars, +$2)
- Optional: Text below QR (30 chars, +$2)
- No hosting required

### 2. Pre-designed QR Gifts (Mid-tier)
- Admin-curated background templates (religious, business, sports themes)
- Customer selects template, QR placed on background
- Small/medium/large sizing options
- QR links to hosted image page

### 3. Fully Custom QR Gifts (Premium)
- Customer uploads own image
- Text overlay with font/color choices
- Hosting tiers: 1 year (included), 3 years, 5 years, permanent
- Email reminders: 30 days before, 7 days before, on expiration

### 4. Dynamic QR (Subscription - Recurring Revenue)
- Customer buys product with QR linking to dedicated page
- Customer can change displayed content anytime
- Same physical product, living digital experience
- Subscription: 1 year, 3 years, 5 years, permanent

---

## URL Structure

### Public Store
```
https://qrgear.repl.app/              # Homepage
https://qrgear.repl.app/store         # Product catalog
https://qrgear.repl.app/create        # QR Creator
https://qrgear.repl.app/cart          # Shopping cart
https://qrgear.repl.app/checkout      # Checkout flow
```

### Business Owner Store (for KC integration)
```
https://qrgear.repl.app/create?slug={business_slug}
```
When `slug` param is present, the QR destination will be pre-filled with:
`https://kingdomconnects.org/business/{slug}.htm`

### Hosted QR Content Pages
```
https://qrgear.repl.app/qr/{unique_id}    # Static QR content page
https://qrgear.repl.app/dynamic/{unique_id}  # Dynamic QR content page
```

---

## Integration Points

### 1. Public Store Link (Simple)
KC can link to QR Gear with a simple href:
```html
<a href="https://qrgear.repl.app/store" target="_blank">Shop QR Gear</a>
```

### 2. Business Owner Promo Items
From KC business dashboard, pass the slug:
```html
<a href="https://qrgear.repl.app/create?slug=joes-plumbing" target="_blank">
  Get Promo Items
</a>
```

### 3. Firebase Sharing (Future)
Currently using Replit Auth. Firebase integration planned for shared auth.
QR Gear already uses Firebase for:
- Product categories (Firestore collection: `categories`)
- Environment variables set for Firebase project: `qrgear-c1ffd`

---

## Pricing Structure

### Base Product Prices (from Printify + markup)
- T-shirts: ~$18-25
- Hats: ~$22-28
- Mugs: ~$14-18
- Bags: ~$18-24

### Add-on Upcharges
- Text above QR: +$2
- Text below QR: +$2
- Custom image upload: +$5

### Hosting Upcharges
- 1 year: Included with custom/dynamic
- 3 years: +$15
- 5 years: +$25
- Permanent: +$49

### Admin Controls
All pricing is configurable via admin panel at `/admin`:
- Base markup percentages
- Add-on prices
- Hosting tier prices
- Category-based pricing rules

---

## Database Schema (Key Tables)

```typescript
// Products from Printify
products: {
  id, printify_id, name, description, base_price, 
  markup_percent, image_url, category, is_active
}

// User orders
orders: {
  id, user_id, status, total, shipping_address, 
  printify_order_id, created_at
}

// QR designs saved by users
qr_designs: {
  id, user_id, qr_type, qr_content, template_id,
  hosting_tier, expires_at
}

// Dynamic QR pages
dynamic_qr_pages: {
  id, user_id, unique_code, title, description,
  current_image_url, hosting_tier, expires_at
}

// Partner store configs (for widgets)
partner_stores: {
  id, name, slug, api_key, allowed_origins,
  is_active
}
```

---

## Widget System (Embeddable Store)

QR Gear supports embeddable mini-stores for partners.

### Setup
1. Partner registered in `partner_stores` table
2. API key generated for JWT signing
3. Allowed origins configured for CORS

### Embed Code
```html
<div id="qrgear-widget" data-partner="kingdom-connects"></div>
<script src="https://qrgear.repl.app/embed/qrgear-embed.js"></script>
```

### Events
Widget emits events for order completion that KC can listen to.

---

## API Endpoints

### Products
```
GET /api/products              # List all products
GET /api/products/:id          # Single product
GET /api/products/:id/variants # Product sizes/colors
```

### Cart
```
GET /api/cart                  # Get user's cart
POST /api/cart                 # Add item
DELETE /api/cart/:id           # Remove item
```

### Orders
```
POST /api/checkout             # Create checkout session
GET /api/orders                # User's order history
GET /api/orders/:id            # Order details
```

### QR
```
POST /api/qr/generate          # Generate QR code
GET /api/qr/:id                # Get QR content page
POST /api/dynamic/:id          # Update dynamic QR content
```

---

## Security Implementation

- Rate limiting: 100 requests/15min general, 20/15min checkout
- XSS prevention: QR content validation blocks dangerous protocols
- Stripe webhook signature verification
- Session-based auth with secure cookies

---

## Current Status

### Working
- All 4 product lines functional
- Printify integration connected
- Admin panel with full controls
- Guest cart with merge on login
- Email notifications via Resend
- Mobile-responsive design

### Pending
- Stripe live API keys (after LLC formation)
- Shared Firebase auth with KC
- Widget CORS configuration
- Production deployment

---

## Dave's Preferences (Shared)

- Mobile-first development
- No inline styles
- snake_case for database fields
- SVG icons (Lucide React)
- Minimal typing required (CIDP accommodation)
- Be brutally honest about bad ideas

---

*Document created by Claude 2 for cross-AI collaboration*
*Last updated: December 2024*
