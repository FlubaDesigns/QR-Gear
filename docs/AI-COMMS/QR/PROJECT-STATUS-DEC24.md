# QR Gear Project Status - December 24, 2025
**Comprehensive summary for cross-AI collaboration**

---

## Project Overview

QR Gear is a custom promotional merchandise e-commerce platform specializing in personalized apparel and products featuring QR codes. It integrates with Printify for print-on-demand fulfillment of USA-made items.

---

## Four QR Product Lines

### 1. Simple Text QR (Tier 1)
- User-entered URL/text encoded in QR
- No hosting required
- One-time purchase, no recurring costs

### 2. Featured Collections (Tier 2)
- Admin-curated templates with pre-designed QR codes
- QR links to hosted images
- Seasonal/event-based themes

### 3. Fully Custom QR Gifts (Tier 3)
- User uploads image, adds header/footer text
- Tiered hosting options (1yr, 3yr, 5yr, lifetime)
- QR links to user's hosted content page

### 4. QR Dynamics™ (Tier 4 - Subscription)
- Permanent QR code on physical product
- Content behind QR is changeable via user dashboard
- Subscription model (recurring revenue)
- Examples: daily verse rotation, updatable business promo, memorial pages

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 18 + TypeScript + Vite |
| UI | Tailwind CSS + shadcn/ui + Radix UI |
| State | TanStack React Query |
| Forms | React Hook Form + Zod validation |
| Backend | Node.js + Express |
| Database | PostgreSQL (Neon serverless) |
| ORM | Drizzle ORM + drizzle-kit migrations |
| Auth | Replit Auth |
| Storage | Replit Object Storage |
| Payments | Stripe (checkout + subscriptions) |
| Email | Resend |
| Fulfillment | Printify API |

---

## Database Schema (Key Tables)

### Core Tables
- `users` - Replit Auth users with roles
- `products` - Product catalog
- `productVariants` - Size/color variants with Printify IDs
- `cartItems` - Shopping cart
- `orders` - Order history

### Printify Sync Tables
- `printifyBlueprints` - Cached blueprint catalog
- `printifyPrintProviders` - Providers with cached minCost/maxCost
- `printifyCostSync` - Background sync progress tracking

### QR & Customization Tables
- `qrDesigns` - User's QR customizations (header, footer, URL, background)
- `qrTemplates` - Admin-created templates
- `customGifts` - Custom gift configurations
- `hostingTiers` - Pricing for hosting durations

### Library System (NEW - Dec 24)
- `libraryAssets` - Backgrounds, designs, videos
  - Fields: `id`, `ownerType`, `userId`, `assetType`, `mediaType`, `name`, `storageUrl`, `publicUrl`, `season`, `event`, `isActive`, `createdAt`

### Partner Integration
- `partnerStores` - External partner stores (KC integration)
- `pricingRules` - Dynamic pricing configuration
- `adminSettings` - Global admin settings

---

## Library Asset System (Implemented Dec 24)

### Purpose
Organized storage for backgrounds and videos used in QR landing pages (not printed on products).

### Storage Structure
```
library/
├── admin/
│   ├── backgrounds/   # Admin-uploaded background images
│   ├── designs/       # Pre-made design templates
│   └── videos/        # Video backgrounds
└── users/
    └── {userId}/
        ├── backgrounds/
        └── videos/
```

### Categorization
Each asset can be tagged with:
- **Season**: spring, summer, fall, winter
- **Event**: christmas, easter, thanksgiving, valentines, mothers-day, fathers-day, independence-day, new-year, halloween, graduation, birthday, wedding, anniversary

### Admin UI
- `/admin/backgrounds` - Tabbed interface:
  - **Templates Tab**: QR templates management
  - **Library Tab**: Background images with season/event filters
- `/admin/videos` - Video library management

### API Endpoints
```
GET    /api/admin/library/admin?assetType=background&season=winter
POST   /api/admin/library/upload  (multipart form)
PUT    /api/admin/library/:id
DELETE /api/admin/library/:id
```

---

## Printify Cost Sync System (Implemented Dec 23)

### Problem
Printify's catalog API doesn't expose production costs. We need costs for pricing.

### Solution
Background job creates temporary placeholder products in Printify to extract real variant costs.

### Key Components
- `server/lib/printify-cost-sync.ts` - Background job module
- `printifyCostSync` table - Tracks sync progress
- Rate limiting: 3s delay between requests
- Resume capability from paused syncs
- Cleanup in finally block prevents orphaned products

### Admin Endpoints
```
POST /api/admin/catalog/sync-all-costs  - Start sync
GET  /api/admin/catalog/cost-sync-status - Check progress
POST /api/admin/catalog/cancel-cost-sync - Cancel sync
```

### Staleness
Costs older than 24 hours show amber "Stale" badge in admin UI.

---

## Custom Product Builder (Implemented Dec 23)

### Features
1. **Font Preview**: Each font selection shows live sample
2. **Composite Image Generator**: Server-side generation of print-ready images
   - Header text + QR code + Footer text on white background
   - Stored in `printifyCompositeUrl` for Printify submission
3. **Multi-placement Support**: `placements` stored as text array

### Physical vs Digital
- **Physical Product Prints**: Header + QR + Footer ONLY (no backgrounds)
- **QR Landing Page**: Shows background image/video + overlay text

---

## Recently Implemented Features

### Text Overlay (IMPLEMENTED Dec 24)
- Title and description text overlay on QR landing pages
- Position control: top or bottom of page
- Font family selection from available fonts
- Color picker for text color
- Admin UI section in Custom Builder for configuration
- NOT printed on physical products - only displayed when QR scanned

### Widget Integration (For KC)
- JWT-based iframe embedding
- Token contains: businessId, businessName, businessLogoUrl, kcListingUrl
- Pre-populates QR destination with KC business URL

---

## Product Flow Steps (LOCKED - Do Not Change)

1. Store Type (Internal/External)
2. Select Store
3. Store Locations (switches for each segment)
4. Store Occasion (Featured/Seasonal switches)
5. Product Source (Library/Custom)
6. Product Type (for Library) or Custom Builder (for Custom)

---

## Key Files

### Schema & Storage
- `shared/schema.ts` - All database table definitions
- `server/storage.ts` - IStorage interface and implementation

### API Routes
- `server/routes.ts` - All Express API endpoints

### Printify Integration
- `server/lib/printify.ts` - Printify API client
- `server/lib/printify-cost-sync.ts` - Cost sync background job
- `server/lib/printify-orders.ts` - Order submission

### Image Processing
- `server/lib/image-upload.ts` - Object storage uploads
- `server/lib/qr-generator.ts` - QR code generation
- `server/lib/composite-generator.ts` - Print-ready image composition

### Admin Pages
- `client/src/pages/admin-backgrounds.tsx` - Templates + Library tabs
- `client/src/pages/admin-videos.tsx` - Video management
- `client/src/pages/admin-products.tsx` - Product catalog management

---

## Environment Variables Required

### Printify
- `PRINTIFY_API_TOKEN` - API access
- `PRINTIFY_SHOP_ID` - Shop identifier

### Stripe
- `STRIPE_SECRET_KEY` - Server-side payments
- `VITE_STRIPE_PUBLIC_KEY` - Client-side Stripe.js

### Widget Integration (For KC)
- `WIDGET_API_KEY` - Authenticates token requests
- `WIDGET_JWT_SECRET` - Signs/verifies widget tokens
- `ALLOWED_WIDGET_ORIGINS` - CORS whitelist

### Email
- `RESEND_API_KEY` - Email delivery

---

## Integration Points with Kingdom Connects

### Widget Embedding
```html
<iframe 
  src="https://qrgear.app/widget?token=YOUR_JWT_TOKEN"
  width="100%"
  height="600"
></iframe>
```

### Token Payload
```typescript
{
  businessId: string;      // KC's internal ID
  businessName: string;    // Display name
  businessLogoUrl?: string; // Optional logo
  kcListingUrl: string;    // URL QR points to
}
```

### QR Destination Format
`https://kingdomconnects.org/business/{slug}.htm`

---

## Questions for KC Agent

1. What fields does KC store for business_listings? Need to map to widget payload.
2. Can KC pass business logo URL in the widget token? Useful for personalization.
3. Is there a webhook/callback URL for KC to receive order notifications?

---

## User Preferences (Dave)

- **CIDP**: Limited hand mobility - agent must be fully autonomous
- **No Emojis**: Never use emojis
- **snake_case**: For all database fields
- **Mobile-first**: Primary development on Samsung S21
- **Brutal honesty**: If an idea is bad, say so
- **No feature removal**: NEVER remove existing features without explicit request

---

*Last updated: December 24, 2025*
*For AI agents: Use this to understand QR Gear's current state*
