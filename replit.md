# QR Gear

## Overview
QR Gear is an e-commerce platform for personalized promotional merchandise, focusing on apparel and products featuring custom QR codes. It integrates with Printify for print-on-demand fulfillment of USA-made items. The platform allows users to generate and customize QR codes (text or image-based) and apply them to various products. QR Gear targets B2B sales, particularly small businesses for marketing purposes, with plans for integration into the Kingdom Connects business directory. The platform offers four distinct QR product lines, including the innovative "QR Dynamics™" for changeable digital content, aiming to establish recurring revenue streams.

## User Preferences
Preferred communication style: Simple, everyday language.
Documentation: Keep ADMIN_MANUAL.md updated as admin features evolve.
Accessibility: User has CIDP (limited hand mobility) - agent should be fully autonomous.

## System Architecture

### Frontend
- **Framework**: React with TypeScript, bundled with Vite
- **UI Components**: shadcn/ui with Radix UI
- **Styling**: Tailwind CSS (dark/light modes)
- **State Management**: TanStack React Query
- **Forms**: React Hook Form with Zod validation
- **Payments**: Stripe React integration

### Backend
- **Runtime**: Node.js with Express
- **Language**: TypeScript with ES modules
- **API Pattern**: RESTful endpoints under `/api/`

### Database
- **Primary Database**: PostgreSQL via Neon serverless
- **ORM**: Drizzle ORM with drizzle-kit for migrations
- **Schema**: `shared/schema.ts`
- **Secondary Data Store**: Firebase Firestore for dynamic categories.

### Core Features
- Server-side QR code generation with customization options.
- Five QR product lines (standardized naming December 2025):
  1. **QR Basics** - Text, URL, or contact info encoded directly (permanent)
  2. **QR Plus** - QR with header/footer text printed on product
  3. **QR Canvas** - Custom background image on scan destination page + optional text
  4. **QR Play** - Video playback when scanned + optional text
  5. **QR Dynamics™** - Updateable destination, subscription-based, analytics
- Multi-Provider Orchestration System for publishing products to various print providers and marketplaces (Printify, Printful, Apliiq, Etsy, eBay, Amazon).
- Shopping cart and order processing.
- Embeddable widget system for partners.
- Admin UI for managing products, channels, and health, designed with mobile-first accessibility.
- Automated Printify cost sync system for extracting real production costs.
- SVG text rendering pipeline for print-ready images with text warp effects.
- Per-placement artwork mode for product customization.

### Admin Expansion (December 2025)
- **Dashboard** (`/admin/dashboard`): KPI metrics - revenue, orders, customers, product health.
- **Customers** (`/admin/customers`): Customer list with stats, search, order history modal.
- **Promo Codes** (`/admin/coupons`): CRUD for discount codes with Stripe sync.
- **System Health** (`/admin/health`): Provider status monitoring (Printify, Stripe).
- Updated admin navigation with 13 sections including Orders, Gifts.

### Recent Fixes (December 27, 2025)
- **Color Hex Value Sync**: Upgraded color sync to use Printify Catalog API (`syncProductVariants`) instead of placeholder product extraction to get proper hex values. Colors now include `{name, hex}` format for UI display.
- **Expanded Color Hex Map**: Added 150+ color mappings including heathers, solids, and intelligent keyword-based fallbacks (checks "navy", "heather", "solid" prefixes).
- **Color Hex Refresh Script**: New `scripts/refresh-color-hex.ts` to backfill hex values for all 580+ providers.
- **Color Fallback to Printify API**: New `getProviderColorsWithFallback()` function that:
  1. Checks local database first (`printify_print_providers` table)
  2. If colors missing or no hex values, automatically calls Printify API
  3. Saves fetched colors to local database for future use
  4. Returns colors with hex values - "digital handshake" with Printify as fallback
- **Dual-Color QR Artwork**: Generates both black and white QR code versions. Uses luminance-based color detection (`isColorDark` with sRGB formula <0.5 = dark) to auto-select appropriate artwork based on shirt hex color.
- **Mockup Generation Flow**: Both admin and public mockup endpoints now:
  1. Get colors with automatic Printify fallback
  2. Select correct artwork (black/white QR) based on shirt color luminance
  3. Upload artwork to Printify
  4. Create temporary Printify product with QR graphic on shirt
  5. Poll for and save mockup images locally
- **Mockup Generation Fix**: Safe JSON.parse for `placementImages` field with try-catch and type checking for both string and object formats.
- **Color/Size Extraction Fix**: Fixed `extractColorsAndSizes` function in `printify.ts` that was incorrectly storing sizes in the colors column. Added explicit size pattern filtering to ensure sizes like "S", "M", "L", "XL" are properly separated from colors. Title parsing now iterates all parts and classifies each as size or color.

### Recent Fixes (December 26, 2025)
- **SEO Landing Pages**: All 5 product type landing pages (/qr-static, /qr-static-plus, /qr-url, /qr-video, /qr-dynamics) now show actual content instead of auto-redirecting. Include practical examples, feature lists, and SEO metadata.
- **Static QR Page**: Added real-world examples (coffee mug, gym bag, networking polo, medical alert) and emphasized 2,000 character encoding capacity.
- **Custom Backgrounds Rename**: Changed "Gift Backgrounds" to "Custom Backgrounds" with clearer explanation that the background shows on the destination webpage (not the shirt).
- **Image Cropper Component**: New `ImageCropper.tsx` component using react-image-crop for uploading custom background images with optional 9:16 mobile crop or full-image mode.
- **ScrollToTop Component**: Added `ScrollToTop.tsx` to reset scroll position on route navigation.
- **Click Feedback**: Added active:scale-[0.98] press-down effect on ActionCards for tactile feedback.
- **Removed Redundant CTAs**: Removed CTA buttons from landing pages since entire card is now clickable.
- **Auto-Sync Variants from Local Catalog**: Products now auto-populate sizes/colors from `printifyPrintProviders` table without Printify API calls. Uses reusable `autoSyncVariantsFromLocalCatalog` helper function.
- **Metadata Preservation**: Auto-sync now merges metadata instead of overwriting (preserves Kingdom Connects data, etc.)
- **Placeholder Variant ID Flagging**: Added `variantIdsArePlaceholders: true` flag in metadata for products needing real Printify variant IDs during fulfillment
- **Admin Products Step Wizard**: Fixed store/segment lookup with case-insensitive, whitespace-trimmed name comparison and fallback to partnerStoresData
- **Segment Creation**: Fixed prefix normalization issue where "Internal:/External:" prefixes prevented store lookup during segment addition
- **Store Type Filter**: Fixed isInternal filter to use strict equality (=== true) to correctly classify stores with null/undefined values
- **DOM Nesting**: Fixed Badge component inside p tag causing console warnings on Creator page
- **Creator Store Product Filtering**: Added `getProductsForStore(storeSlug, segment)` method to storage layer. Creator page now fetches products via `partner_store_products` table join with proper store/segment filtering. Supports partial slug matching for timestamp-suffixed store slugs.

### Printify Local Catalog Architecture (CRITICAL - DO NOT FORGET)

**PRINCIPLE: All product data comes from LOCAL DATABASE, NOT live Printify API calls.**

#### Data Flow:
1. **Source Table**: `printify_print_providers` stores all Printify catalog data locally
   - `available_colors` (JSON array with name/hex)
   - `available_sizes` (text array)
   - `min_cost`, `max_cost` (production costs in cents)
   - Keyed by `blueprint_id` + `provider_id`

2. **Weekly Cron Job**: Syncs entire Printify catalog to local table
   - Runs in `server/lib/cron-jobs.ts` via `startCostSync`
   - Creates temp placeholder products on Printify to extract real costs/colors
   - Populates `printify_print_providers.available_colors` and `available_sizes`
   - **MUST refresh colors even if costs already exist** (forceRefresh or null check)

3. **UI Reads ONLY from Local Database**:
   - Admin Products API enriches products with provider colors/sizes
   - Store Builder displays colors from `printify_print_providers` (fallback to `products.available_colors`)
   - **NEVER call Printify API for colors/sizes in UI**

4. **Allowed Live Printify API Calls**:
   - **Availability checks**: Before order fulfillment
   - **Mockup generation**: Creating product with our QR graphic on it (star tap → mockup)
   - **Order submission**: Sending orders to Printify

#### Key Files:
- `server/lib/printify-cost-sync.ts`: Weekly sync logic
- `server/lib/cron-jobs.ts`: Schedules the sync
- `server/routes.ts`: Admin products endpoint enriches with provider data
- `shared/schema.ts`: `printifyPrintProviders` table definition

### Mockup Caching Architecture (December 2025)

**PRINCIPLE: Database-first mockups with Printify fallback - "digital handshake" pattern.**

#### Data Flow:
1. **Source Table**: `mockup_cache` stores pre-generated mockup URLs
   - Keyed by `blueprint_id`, `print_provider_id`, `color_name`, `canonical_placement_id`
   - Also tracks `artwork_url`, `artwork_variant` (black/white), `mockup_url`
   - Supports multi-provider architecture

2. **Canonical Placements**: Provider-agnostic placement system
   - `canonical_placements` table: 15 standard placements (FRONT_CHEST, FRONT_CENTER, BACK_FULL, etc.)
   - `pod_providers` table: POD provider registry (Printify active, Printful/Gooten/SPOD inactive)
   - `provider_placement_mappings` table: Translates canonical → provider-specific placement keys
   - `product_placement_availability` table: Which placements available per product

3. **Mockup Generation Flow** (`server/lib/mockup-service.ts`):
   - Step 1: Check `mockup_cache` for existing mockup
   - Step 2: If not found, generate via Printify API (temporary product → poll for images → delete product)
   - Step 3: Save result to `mockup_cache` for future requests
   - Supports automatic black/white QR artwork selection based on shirt color luminance

4. **API Endpoints**:
   - `GET /api/mockups/cached?blueprintId=X&printProviderId=Y` - Get all cached mockups
   - `POST /api/mockups/get-or-generate` - Database-first with fallback
   - `GET /api/placements?category=apparel` - Get canonical placements
   - `POST /api/admin/mockups/pre-generate` - Pre-generate all color mockups for a product

#### Key Files:
- `server/lib/mockup-service.ts`: Core mockup caching logic with `getMockupWithFallback()`
- `shared/schema.ts`: `mockupCache`, `canonicalPlacements`, `podProviders`, `providerPlacementMappings`
- `client/src/hooks/useMockupWithFallback.ts`: Frontend hooks for mockup fetching

### Auto-Sync Architecture (Legacy Notes)
- **Product Creation**: Auto-seeds variants from local catalog data (no API calls needed)
- **Limitation**: Variant IDs are placeholders - real Printify variant IDs fetched during fulfillment or manual sync
- **Custom Designs**: Auto-sync doesn't apply yet (no printProviderId captured in custom design flow)
- **Extensible**: Helper function designed for future POD providers (Printful, etc.) when connected

### AI Communication System
- Cross-AI collaboration folder: `docs/AI-COMMS/`
- KC (Kingdom Connects) agent shares CSS patterns and integration specs
- QR agent prepares widget endpoints for KC embedding
- Shared JWT secret required: `WIDGET_JWT_SECRET`

### Design System
- **Typography**: Inter (body), Space Grotesk (headings).
- **Layout**: Mobile-first responsive, `max-w-7xl` containers.
- **Components**: Card-based, consistent styling with `h-12` touch targets for accessibility.

## External Dependencies

### Third-Party Services
- **Printify API**: Print-on-demand fulfillment.
- **Stripe**: Payment processing (checkout, subscriptions).
- **Firebase/Firestore**: Secondary data store for categories and real-time features.
- **Neon Database**: PostgreSQL hosting.
- **Resend**: Email delivery.

### Key NPM Packages
- `@neondatabase/serverless`: PostgreSQL connectivity.
- `drizzle-orm` / `drizzle-kit`: ORM and migrations.
- `@stripe/stripe-js` / `@stripe/react-stripe-js`: Stripe integration.
- `qrcode`: QR code generation.
- `jsonwebtoken`: Widget authentication.
- `@tanstack/react-query`: Data fetching.
- `zod`: Schema validation.
- `express-rate-limit`: API rate limiting.
- `@resvg/resvg-js`: SVG to PNG conversion.