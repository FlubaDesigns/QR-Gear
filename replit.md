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

### 2. Mockup System (WORKING - Uses Printify Native)
**Location**: `server/lib/mockup-service.ts`

**Flow**:
1. Check `mockup_cache` table first (database-first)
2. On cache miss → Create temp Printify product
3. Upload QR artwork (black or white based on shirt color luminance)
4. Get mockup images from Printify
5. Cache results, delete temp product

**API Endpoint**: `POST /api/storefront/generate-mockup`
```json
Request: { "productId": "custom_hello-world", "color": "White" }
Response: { "success": true, "mockupUrl": "...", "fromCache": true }
```

**FeaturedProducts Issue**: Currently only reads preloaded `mockupsByColor`. Needs to call `/api/storefront/generate-mockup` on color swatch click.

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
| `server/lib/mockup-service.ts` | Printify mockup generation & caching |
| `server/lib/printify.ts` | Printify API wrapper |
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

## Resolved Issues (December 27, 2025)

### FeaturedProducts Color Switching - FIXED
Color swatch clicks now call `/api/storefront/generate-mockup` to fetch Printify native mockups.
Mockups are cached in `mockup_cache` table for instant subsequent loads.

### Pricing Display - FIXED
Home page now shows `customerPrice` set by admin, not recalculated from base costs.

---

## Stack Summary
- **Frontend**: React, TypeScript, Vite, TanStack Query, shadcn/ui
- **Backend**: Node.js, Express, TypeScript
- **Database**: PostgreSQL (Neon), Drizzle ORM
- **External**: Printify, Stripe, Firebase, Resend
