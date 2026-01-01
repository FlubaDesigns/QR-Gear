# QR Gear - System Reference Guide

## Overview
QR Gear is an e-commerce platform for personalized promotional merchandise with custom QR codes. Uses Printify for print-on-demand fulfillment.

## User Preferences
- **Communication**: Simple, everyday language
- **Accessibility**: User has CIDP (limited hand mobility) - agent must be fully autonomous
- **Documentation**: Keep ADMIN_MANUAL.md updated as admin features evolve

---

## CRITICAL: DO NOT CHANGE THESE SYSTEMS

### 1. Pricing System (WORKING - DO NOT RECALCULATE)
**Source of truth**: `products.customer_price` column

| What | Where | Notes |
|------|-------|-------|
| Admin sets price | `/admin/products` page | Saves to `customer_price` |
| API returns price | `/api/products?featured=true` | Uses `customerPrice` directly |
| Frontend displays | `FeaturedProducts.tsx` | Shows `product.retailPrice` |

**NEVER** recalculate prices from base costs. The admin-configured `customerPrice` IS the final price.

### 2. Mockup System (WORKING - Printful for Rendering)
**Location**: `server/lib/mockup-service.ts`, `server/lib/printful.ts`, `server/lib/mockup-job-queue.ts`

**Printful-First Architecture**:
- **Printful**: Used for mockup rendering
- **Printify**: Used for order fulfillment
- Mockups include **lifestyle images** (person wearing the shirt)
- QR sizes: small (25%), medium (45%), large (65%) of print area

**CRITICAL WORKFLOW**:
1. **Save to Store/Template/Both** → Auto-queues ALL mockups (all colors × 3 sizes)
2. **Click Generate later** → ONLY retrieves from database, NEVER regenerates
3. Background job queue processes mockups at Printful's rate limit

**Generation Flow**:
1. Product saved → `mockupJobQueue.createBatchJobs()` queues all colors × sizes
2. Worker processes jobs one at a time respecting rate limits
3. Each job: Call Printful API → Download images → Store in Object Storage → Update product.mockupsByColor
4. Generate endpoint only retrieves from database (returns "pending" if not ready)

**Current Product Mapping**:
- Blueprint 6 (Bella+Canvas 3001) → Printful Product 71
- Colors: Black, White, Sport Grey → Athletic Heather

**Mockup Storage** (`products.mockups_by_color`):
```json
{
  "Black": {
    "front": "/api/files/mockup-printful-6-black-flat.jpg",
    "lifestyle": "/api/files/mockup-printful-6-black-lifestyle.jpg"
  }
}
```

**Frontend Priority**: Lifestyle mockups displayed over flat mockups

**API Endpoint**: `POST /api/storefront/generate-mockup`
```json
Request: { "productId": "custom_hello-world", "color": "Black" }
Response: { "success": true, "mockupUrl": "...", "lifestyleMockupUrl": "...", "fromCache": false }
```

### 3. Printify Local Catalog (WORKING - DO NOT CALL API FOR COLORS/SIZES)
**Source of truth**: `printify_print_providers` table

| Column | Type | Purpose |
|--------|------|---------|
| `blueprint_id` | int | Printify blueprint ID |
| `provider_id` | int | Print provider ID |
| `min_cost` | int | Minimum cost in cents |
| `max_cost` | int | Maximum cost in cents |
| `available_colors` | jsonb | `[{name, hex}, ...]` |
| `available_sizes` | text[] | `["S", "M", "L", ...]` |

**Synced weekly** via cron job in `server/lib/cron-jobs.ts`

---

## Database Schema Reference

### products table
| Column | Type | Purpose |
|--------|------|---------|
| `id` | varchar | Primary key (e.g., `custom_hello-world`) |
| `customer_price` | decimal | **Admin-configured retail price** - USE THIS |
| `base_price` | decimal | Printify production cost (internal only) |
| `blueprint_id` | int | Printify blueprint ID |
| `print_provider_id` | int | Printify provider ID |
| `mockups_by_color` | jsonb | `{"White": {"front": "url", "lifestyle": "url"}}` |
| `available_colors` | jsonb | `[{name, hex}, ...]` |
| `is_featured` | boolean | Show on home page |
| `is_enabled` | boolean | Product is active |

### mockup_cache table
| Column | Type | Purpose |
|--------|------|---------|
| `id` | uuid | Primary key |
| `blueprint_id` | int | Product blueprint |
| `print_provider_id` | int | Print provider |
| `color_name` | text | Color name |
| `canonical_placement_id` | text | e.g., "FRONT_CHEST" |
| `mockup_url` | text | Flat product mockup URL |
| `lifestyle_mockup_url` | text | Model wearing product URL |
| `artwork_variant` | text | "black" or "white" QR |

### custom_designs table
| Column | Type | Purpose |
|--------|------|---------|
| `id` | varchar | Design ID |
| `placement_images` | jsonb | `{"front-chest": "url", "front-chest-white": "url"}` |
| `mockups_by_color` | jsonb | Cached mockups per color |

---

## Key API Endpoints

### Public
| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/products` | GET | List products (add `?featured=true` for home page) |
| `/api/products/:id` | GET | Get single product |
| `/api/storefront/generate-mockup` | POST | Generate Printify mockup for color |
| `/api/cart` | GET/POST/DELETE | Shopping cart operations |

### Admin
| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/admin/products` | GET/POST/PUT | Manage products |
| `/api/admin/settings` | GET/PUT | Global settings |

---

## Key Files Reference

| File | Purpose |
|------|---------|
| `shared/schema.ts` | Database schema definitions |
| `server/routes.ts` | All API endpoints |
| `server/storage.ts` | Database operations |
| `server/lib/mockup-service.ts` | Mockup generation & caching (uses Printful) |
| `server/lib/printful.ts` | Printful API wrapper (mockup generation) |
| `server/lib/printify.ts` | Printify API wrapper (order fulfillment) |
| `server/lib/qr-generator.ts` | QR code generation |
| `server/lib/cron-jobs.ts` | Weekly catalog sync |
| `client/src/components/FeaturedProducts.tsx` | Home page product grid |

---

## Architecture Decisions

### QR Artwork Selection (Automatic)
- **Dark shirts** (luminance < 0.5) → White QR code
- **Light shirts** (luminance >= 0.5) → Black QR code
- Artwork stored in `custom_designs.placement_images` as both variants

### Mockup Priority
1. `lifestyle_mockup_url` - Model wearing product (preferred)
2. `mockup_url` - Flat product shot (fallback)

---

## Resolved Issues (December 30, 2025)

### Printify Mockup Limitation - SOLVED
Printify cannot render mockups for unpublished/draft products. Solution: Use Printful's Mockup Generator API instead.

**Dual-Provider Approach**:
- Printful for mockup rendering (dedicated API, no publishing required)
- Printify for order fulfillment (unchanged)
- Mockups stored permanently in Object Storage: `/api/files/mockup-printful-*.jpg`

### QR Artwork Selection - WORKING
- `isColorDark()` correctly detects luminance
- White QR for dark shirts (Solid Black = #000000)
- Black QR for light shirts (Solid White = #FFFFFF)
- Logs confirm: `needsWhiteQR=true` for dark shirts

### Pricing Display - WORKING
Home page shows `customerPrice` set by admin correctly.

---

## Stack Summary
- **Frontend**: React, TypeScript, Vite, TanStack Query, shadcn/ui
- **Backend**: Node.js, Express, TypeScript
- **Database**: PostgreSQL (Neon), Drizzle ORM + Firestore (dual-write capable)
- **External**: Printify (fulfillment), Printful (mockups), Stripe, Firebase, Resend

---

## Dual Storage System (Firebase Migration)

### Architecture
The system supports three storage modes controlled by `STORAGE_MODE` environment variable:

| Mode | Reads From | Writes To | Use Case |
|------|------------|-----------|----------|
| `postgres-only` | Postgres | Postgres | Default, Replit development |
| `dual-write` | Postgres | Postgres + Firestore | Migration testing |
| `firestore-only` | Firestore | Firestore | Firebase deployment |

### Key Files
| File | Purpose |
|------|---------|
| `server/lib/storage-factory.ts` | Storage mode switching |
| `server/lib/firestore-adapter.ts` | Firestore implementation of IStorage |
| `server/lib/dual-write-adapter.ts` | Writes to both backends |
| `server/lib/firebase-admin.ts` | Firebase Admin SDK initialization |
| `docs/FIRESTORE_DATA_MODEL.md` | Firestore collection mapping |

### Environment Variables
| Variable | Purpose | Default |
|----------|---------|---------|
| `STORAGE_MODE` | Storage backend mode | `postgres-only` |
| `VITE_FIREBASE_PROJECT_ID` | Firebase project ID | `qrgear-c1ffd` |
| `FIREBASE_SERVICE_ACCOUNT_KEY` | Service account JSON (for server) | Required for Firestore |

### Enabling Dual-Write (Beta Testing)
1. Set `STORAGE_MODE=dual-write` in environment
2. Provide `FIREBASE_SERVICE_ACCOUNT_KEY` secret (JSON stringified)
3. Restart the application
4. All product/design/order writes will sync to Firestore

### Core Methods Implemented in FirestoreAdapter
- Products: CRUD, getEnabled, toggleEnabled
- Custom Designs: CRUD, getForLibrary, getByStoreSegment
- Orders: CRUD, getByUser, getByStatus, getByStripeSession
- Users: CRUD, getByEmail, upsert
- Admin Settings: get, upsert

### Data Portability
- JSON blob fields (mockupsByColor, graphicsConfig, placementImages) transfer directly
- Timestamps convert from Postgres to Firestore Timestamp
- IDs preserved for cross-system references
