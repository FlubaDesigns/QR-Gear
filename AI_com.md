# QR Gear - Kingdom Connects Integration Documentation

**Last Updated:** December 24, 2025  
**Purpose:** Cross-project coordination between QR Gear and Kingdom Connects agents

---

## Project Overview

**QR Gear** is a custom promotional merchandise e-commerce platform specializing in personalized apparel and products featuring QR codes. It integrates with Printify for print-on-demand fulfillment.

**Kingdom Connects** is a faith-based business directory that will embed QR Gear's widget to allow businesses to order custom promotional products with QR codes linking back to their KC listings.

---

## Widget Integration System

### How Kingdom Connects Embeds QR Gear

Kingdom Connects can embed the QR Gear product widget on business listing pages. The widget displays featured products that businesses can customize with QR codes linking to their KC listing.

### Authentication Flow

1. **KC Backend** calls QR Gear's `/api/widget/token` endpoint with business details
2. **QR Gear** returns a signed JWT token (1-hour expiry)
3. **KC Frontend** loads the widget iframe with the token
4. **Widget** calls `/api/widget/session` to get products and generate QR code

### Required Environment Variables (QR Gear side)

```
WIDGET_JWT_SECRET=<shared-secret-for-jwt-signing>
WIDGET_API_KEY=<api-key-for-token-generation>
ALLOWED_WIDGET_ORIGINS=https://kingdomconnects.com,https://staging.kingdomconnects.com
QRGEAR_BASE_URL=https://qrgear.app
```

### API Endpoints for Kingdom Connects

#### 1. Generate Widget Token
```
POST /api/widget/token
Headers:
  X-API-Key: <WIDGET_API_KEY>
  Content-Type: application/json

Body:
{
  "businessId": "kc-business-123",
  "businessName": "Joe's Plumbing & Heating",
  "businessLogoUrl": "https://kingdomconnects.com/logos/joes-plumbing.png",
  "kcListingUrl": "https://kingdomconnects.com/business/joes-plumbing"
}

Response:
{
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "expiresIn": 3600
}
```

#### 2. Widget Session (called by embedded widget)
```
GET /api/widget/session?token=<jwt-token>

Response:
{
  "businessName": "Joe's Plumbing & Heating",
  "businessLogoUrl": "https://...",
  "kcListingUrl": "https://kingdomconnects.com/business/joes-plumbing",
  "qrCodeDataUrl": "data:image/png;base64,...",
  "products": [
    {
      "id": "prod-123",
      "name": "Custom Hat",
      "imageUrl": "https://...",
      "basePrice": "24.99",
      "category": "hats"
    }
  ]
}
```

### Embedding the Widget (KC Frontend)

```html
<iframe 
  src="https://qrgear.app/widget?token=YOUR_TOKEN_HERE"
  width="100%"
  height="600"
  frameborder="0"
  allow="payment"
></iframe>
```

Or use the JavaScript embed:

```html
<div id="qrgear-widget" 
     data-business-id="kc-business-123"
     data-business-name="Joe's Plumbing"
     data-listing-url="https://kingdomconnects.com/business/joes-plumbing">
</div>
<script src="https://qrgear.app/embed.js"></script>
```

---

## Library Asset System (NEW - Dec 2025)

QR Gear now has an organized library system for storing backgrounds and videos that display on scanned QR code webpages.

### Key Concepts

- **Physical products** print only: Header text + QR code + Footer text
- **QR webpage** (when scanned) can display: Background images, videos, links, and dynamic content
- **Library assets** are organized by season (spring, summer, fall, winter) and events (Christmas, Easter, etc.)

### Text Overlay System (PLANNED)

The QR landing page will support text overlays on background images:

```
+---------------------------+
|     [Title Text]          |  <- Customizable title overlay
|                           |
|   [Background Image]      |  <- Library background image
|                           |
|   [Description Text]      |  <- Customizable description overlay
+---------------------------+
```

**Use Case:** Customer selects a background image from the library, then adds custom title/description text that displays ON TOP of the background when someone scans the QR code.

This creates truly custom branded content for each product while using reusable library assets as the foundation.

### Library Asset Schema

```typescript
interface LibraryAsset {
  id: string;
  ownerType: 'admin' | 'user';
  userId: string | null;
  assetType: 'background' | 'design' | 'template';
  mediaType: 'image' | 'video';
  name: string;
  originalName: string;
  description: string | null;
  fileName: string;
  storageUrl: string;
  publicUrl: string;
  category: string | null;
  season: 'spring' | 'summer' | 'fall' | 'winter' | null;
  event: 'christmas' | 'easter' | 'thanksgiving' | 'valentines' | 
         'mothers-day' | 'fathers-day' | 'independence-day' | 
         'new-year' | 'halloween' | 'graduation' | 'birthday' | 
         'wedding' | 'anniversary' | null;
  tags: string | null;
  sortOrder: number;
  usageCount: number;
  isActive: boolean;
  isFeatured: boolean;
  createdAt: string;
  updatedAt: string;
}
```

### Library API Endpoints (Admin Only)

```
GET /api/admin/library/admin?assetType=background&mediaType=image&season=winter&event=christmas
POST /api/admin/library/upload (multipart form with file)
PUT /api/admin/library/:id
DELETE /api/admin/library/:id
```

### Storage Structure

```
library/
├── admin/
│   ├── backgrounds/     # Admin-uploaded background images
│   ├── designs/         # Pre-designed templates
│   └── videos/          # Video backgrounds for QR pages
└── users/
    └── {userId}/
        ├── backgrounds/
        └── videos/
```

---

## Four QR Product Lines

1. **Simple Text QR** - User enters URL/text, applied to any Printify product
2. **Featured Collections** - Admin-curated templates with pre-designed QR codes
3. **Fully Custom QR Gifts** - User uploads image, adds text, tiered hosting options
4. **QR Dynamics™** - Subscription product with changeable digital content

---

## Printify Integration

QR Gear syncs with Printify for print-on-demand fulfillment:

- **Local caching** of Printify catalog in PostgreSQL (printifyBlueprints, printifyPrintProviders tables)
- **Automated cost sync** extracts real production costs weekly
- Products are created in Printify only when orders are placed

---

## Database Schema Highlights

Key tables that Kingdom Connects integrations may reference:

```
users                  - User accounts (Replit auth)
products              - Product catalog
productVariants       - Size/color variants with prices
qrDesigns             - User-created QR code designs
qrTemplates           - Admin-curated background templates
libraryAssets         - Organized media library (NEW)
cartItems             - Shopping cart
orders                - Order history
partnerStores         - External store configurations
hostingTiers          - QR hosting subscription tiers
```

---

## Shared Secrets Needed

For KC integration to work, both systems need these shared configurations:

| Secret Name | Where Used | Notes |
|-------------|------------|-------|
| WIDGET_JWT_SECRET | Both | Same value for JWT signing/verification |
| WIDGET_API_KEY | KC only | Used to authenticate token generation requests |
| STRIPE_SECRET_KEY | QR Gear | For payment processing |
| STRIPE_PUBLISHABLE_KEY | Both | Public Stripe key for frontend |

---

## Next Integration Steps

1. **KC Backend**: Implement `/api/qrgear/token` endpoint that calls QR Gear's token API
2. **KC Frontend**: Embed widget iframe on business listing pages
3. **Shared Branding**: Pass business logo and colors to widget
4. **Order Notifications**: Webhook from QR Gear to KC when orders are placed

---

## Contact Points

- QR Gear base URL: `https://qrgear.app` (or current Replit deployment)
- Widget embed path: `/widget?token=<jwt>`
- API base: `/api/widget/*`

---

## Recent Changes Log

- **Dec 24, 2025**: Added library asset system with season/event categorization
- **Dec 24, 2025**: Documented text overlay feature for QR landing pages (title/description on backgrounds)
- **Dec 23, 2025**: Implemented automated Printify cost sync system
- **Dec 22, 2025**: Added Printify catalog sync with local caching

---

## Planned Features

1. **Text Overlay on QR Landing Pages** - Add title/description text on top of background images
2. **Product Page Library Integration** - Select backgrounds from library during product customization
3. **User-uploaded library assets** - Allow customers to save their own backgrounds/videos
