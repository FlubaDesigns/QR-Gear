# QR Gear — Complete API Route Mapping (Dev + Cloud Function + Frontend)

> Generated: February 16, 2026
> Purpose: Reference guide for maintaining route parity between dev server and production Cloud Function

---

## How the System Works

```
FRONTEND                    FIREBASE HOSTING              CLOUD FUNCTION
────────                    ────────────────              ──────────────
fetch("/api/admin/stores")  →  rewrites /api/** to CF  →  receives /admin/stores
fetch("/api/products")      →  rewrites /api/** to CF  →  receives /products
fetch("/api/members/...")   →  rewrites /api/** to CF  →  receives /members/...
```

### The Chain

1. **Frontend** makes a fetch call to `/api/...`
2. **Firebase Hosting** has a rewrite rule: `/api/**` → Cloud Function `api`
3. **Cloud Function** receives the request with `/api` prefix stripped
4. **Route handler** processes the request at the stripped path

### Base URLs

| Context | Frontend Variable | Resolves To | Dev Server Path | Cloud Function Path |
|---------|------------------|-------------|-----------------|---------------------|
| Admin | `apiBase` / `api.baseUrl` | `/api/admin` | `/api/admin/...` | `/admin/...` |
| Member | `apiBase` (member context) | `/api/members` | `/api/members/...` | `/members/...` (NOT in CF currently) |
| Public | hardcoded `/api/...` | `/api/...` | `/api/...` | `/...` |

### Auth Model

- **Admin routes**: Require Firebase Auth Bearer token via `getAuthHeaders()` or `authFetch()`
- **Member routes**: Require Firebase Auth Bearer token via member `getAuthHeaders()`
- **Public routes**: No auth required (stores, products, checkout, etc.)
- **TanStack Query default fetcher**: The `queryClient.ts` default fetcher ALREADY includes Firebase Auth Bearer token automatically via `getAuthHeader()`. Routes using `useQuery()` without an explicit `queryFn` get auth for free.

---

## Statistics Summary

| Metric | Count |
|--------|-------|
| Total dev server routes | 433 |
| Total Cloud Function routes | 178 |
| Routes in BOTH | 130 |
| Dev-only routes | 303 |
| — Admin dev-only | 154 |
| — Non-admin dev-only | 149 |
| CF-only routes | 48 |
| — Admin CF-only | 28 |
| — Non-admin CF-only | 20 |
| Frontend NO_AUTH fetch calls | 109 |

---

## SECTION 1: ADMIN ROUTES — Synced (in BOTH Codebases)

These 88 admin routes exist in both the dev server and the Cloud Function. They should work in both dev and production.

### 1.1 Background Assets

| Method | Route (CF path) | Dev Server Path | Status |
|--------|----------------|-----------------|--------|
| DELETE | `/admin/background-assets/:id` | `/api/admin/background-assets/:id` | Synced |
| GET | `/admin/background-assets` | `/api/admin/background-assets` | Synced |
| POST | `/admin/background-assets` | `/api/admin/background-assets` | Synced (includes source-to-background move on crop) |
| POST | `/admin/background-assets/sync` | `/api/admin/background-assets/sync` | Synced |
| PUT | `/admin/background-assets/:id` | `/api/admin/background-assets/:id` | Dev-only (CF missing PUT) |

### 1.2 Build Shelf

| Method | Route (CF path) | Dev Server Path | Status |
|--------|----------------|-----------------|--------|
| DELETE | `/admin/build-shelf/:id` | `/api/admin/build-shelf/:id` | Synced |
| GET | `/admin/build-shelf` | `/api/admin/build-shelf` | Synced |
| PATCH | `/admin/build-shelf/:id` | `/api/admin/build-shelf/:id` | Synced |
| POST | `/admin/build-shelf` | `/api/admin/build-shelf` | Synced |

### 1.3 Catalog

| Method | Route (CF path) | Dev Server Path | Status |
|--------|----------------|-----------------|--------|
| GET | `/admin/catalog/blueprints` | `/api/admin/catalog/blueprints` | Synced |
| GET | `/admin/catalog/blueprints/:id` | `/api/admin/catalog/blueprints/:id` | Synced |
| GET | `/admin/catalog/placements` | `/api/admin/catalog/placements` | Synced |
| GET | `/admin/catalog/printful-products` | `/api/admin/catalog/printful-products` | Synced |
| GET | `/admin/catalog/printful-status` | `/api/admin/catalog/printful-status` | Synced |
| GET | `/admin/catalog/sync-status` | `/api/admin/catalog/sync-status` | Synced |
| POST | `/admin/catalog/sync` | `/api/admin/catalog/sync` | Synced |
| POST | `/admin/catalog/sync-printful` | `/api/admin/catalog/sync-printful` | Synced |

### 1.4 Compose & Publish

| Method | Route (CF path) | Dev Server Path | Status |
|--------|----------------|-----------------|--------|
| GET | `/admin/published-compose-items` | `/api/admin/published-compose-items` | Synced |
| POST | `/admin/compose/publish` | `/api/admin/compose/publish` | Synced |

### 1.5 Content & Graphics

| Method | Route (CF path) | Dev Server Path | Status |
|--------|----------------|-----------------|--------|
| POST | `/admin/content/upload` | `/api/admin/content/upload` | Synced |
| POST | `/admin/graphics/save` | `/api/admin/graphics/save` | Synced |
| POST | `/admin/templates/full-save` | `/api/admin/templates/full-save` | Synced |

### 1.6 Coupons

| Method | Route (CF path) | Dev Server Path | Status |
|--------|----------------|-----------------|--------|
| DELETE | `/admin/coupons/:id` | `/api/admin/coupons/:id` | Synced |
| GET | `/admin/coupons` | `/api/admin/coupons` | Synced |
| POST | `/admin/coupons` | `/api/admin/coupons` | Synced |
| PUT | `/admin/coupons/:id` | `/api/admin/coupons/:id` | Synced |

### 1.7 Fulfillment

| Method | Route (CF path) | Dev Server Path | Status |
|--------|----------------|-----------------|--------|
| GET | `/admin/fulfillment-providers` | `/api/admin/fulfillment-providers` | Synced |

### 1.8 Hosting Tiers

| Method | Route (CF path) | Dev Server Path | Status |
|--------|----------------|-----------------|--------|
| DELETE | `/admin/hosting-tiers/:id` | `/api/admin/hosting-tiers/:id` | Synced |
| POST | `/admin/hosting-tiers` | `/api/admin/hosting-tiers` | Synced |
| PUT | `/admin/hosting-tiers/:id` | `/api/admin/hosting-tiers/:id` | Synced |

### 1.9 Library

| Method | Route (CF path) | Dev Server Path | Status |
|--------|----------------|-----------------|--------|
| DELETE | `/admin/library/:id` | `/api/admin/library/:id` | Synced |
| GET | `/admin/library` | `/api/admin/library` | Synced |
| GET | `/admin/library/admin` | `/api/admin/library/admin` | Synced |
| GET | `/admin/library/templates` | `/api/admin/library/templates` | Synced |
| POST | `/admin/library` | `/api/admin/library` | Synced |
| PUT | `/admin/library/:id` | `/api/admin/library/:id` | Synced |

### 1.10 Mockup & Queue

| Method | Route (CF path) | Dev Server Path | Status |
|--------|----------------|-----------------|--------|
| POST | `/admin/mockup/priority` | `/api/admin/mockup/priority` | Synced |
| POST | `/admin/queue/process` | `/api/admin/queue/process` | Synced |
| POST | `/admin/queue/retry-failed` | `/api/admin/queue/retry-failed` | Synced |
| GET | — | `/api/admin/queue/status` | Dev-only (CF missing GET) |

### 1.11 NexusMail

| Method | Route (CF path) | Dev Server Path | Status |
|--------|----------------|-----------------|--------|
| GET | `/admin/nexusmail/outbox` | `/api/admin/nexusmail/outbox` | Synced |
| GET | `/admin/nexusmail/status` | `/api/admin/nexusmail/status` | Synced |
| POST | `/admin/nexusmail/process-outbox` | `/api/admin/nexusmail/process-outbox` | Synced |
| POST | `/admin/nexusmail/retry-failed` | `/api/admin/nexusmail/retry-failed` | Synced |
| POST | `/admin/nexusmail/seed-templates` | `/api/admin/nexusmail/seed-templates` | Synced |

### 1.12 Packets

| Method | Route (CF path) | Dev Server Path | Status |
|--------|----------------|-----------------|--------|
| DELETE | `/admin/packets/:packetId` | `/api/admin/packets/:packetId` | Synced |
| GET | `/admin/packets` | `/api/admin/packets` | Synced |
| PATCH | `/admin/packets/:packetId` | `/api/admin/packets/:packetId` | Synced |
| POST | `/admin/packets` | `/api/admin/packets` | Synced |

### 1.13 Partner Stores

| Method | Route (CF path) | Dev Server Path | Status |
|--------|----------------|-----------------|--------|
| DELETE | `/admin/partner-stores/:id` | `/api/admin/partner-stores/:id` | Synced |
| GET | `/admin/partner-stores` | `/api/admin/partner-stores` | Synced |
| GET | `/admin/partner-stores/:id/products` | `/api/admin/partner-stores/:id/products` | Synced |
| POST | `/admin/partner-stores` | `/api/admin/partner-stores` | Synced |
| POST | `/admin/partner-stores/:id/products` | `/api/admin/partner-stores/:id/products` | Synced |

### 1.14 Pricing

| Method | Route (CF path) | Dev Server Path | Status |
|--------|----------------|-----------------|--------|
| DELETE | `/admin/pricing-rules/:id` | `/api/admin/pricing-rules/:id` | Synced |
| GET | `/admin/pricing-rules` | `/api/admin/pricing-rules` | Synced |
| GET | `/admin/pricing-settings` | `/api/admin/pricing-settings` | Synced |
| POST | `/admin/pricing-rules` | `/api/admin/pricing-rules` | Synced |
| POST | `/admin/pricing-settings` | `/api/admin/pricing-settings` | Synced |
| POST | `/admin/pricing-settings/sync` | `/api/admin/pricing-settings/sync` | Synced |
| PUT | `/admin/pricing-rules/:id` | `/api/admin/pricing-rules/:id` | Synced |

### 1.15 Printify (Admin)

| Method | Route (CF path) | Dev Server Path | Status |
|--------|----------------|-----------------|--------|
| GET | `/admin/printify/catalog` | `/api/admin/printify/catalog` | Synced |
| GET | `/admin/printify/catalog/:blueprintId` | `/api/admin/printify/catalog/:blueprintId` | Synced |
| POST | `/admin/printify/catalog/batch-details` | `/api/admin/printify/catalog/batch-details` | Synced |

### 1.16 Product Categories

| Method | Route (CF path) | Dev Server Path | Status |
|--------|----------------|-----------------|--------|
| DELETE | `/admin/product-categories/:id` | `/api/admin/product-categories/:id` | Synced |
| POST | `/admin/product-categories` | `/api/admin/product-categories` | Synced |
| PUT | `/admin/product-categories/:id` | `/api/admin/product-categories/:id` | Synced |

### 1.17 Products (Admin)

| Method | Route (CF path) | Dev Server Path | Status |
|--------|----------------|-----------------|--------|
| DELETE | `/admin/products/:id` | `/api/admin/products/:id` | Synced |
| GET | `/admin/products` | `/api/admin/products` | Synced |
| GET | `/admin/products/:id/variants` | `/api/admin/products/:id/variants` | Synced |
| PATCH | `/admin/products/:id` | `/api/admin/products/:id` | Synced |
| PATCH | `/admin/products/:id/toggle` | `/api/admin/products/:id/toggle` | Synced |
| PATCH | `/admin/variants/:id/toggle` | `/api/admin/variants/:id/toggle` | Synced |
| POST | `/admin/products/:id/generate-all-mockups` | `/api/admin/products/:id/generate-all-mockups` | Synced |
| POST | `/admin/products/:id/regenerate-mockups` | `/api/admin/products/:id/regenerate-mockups` | Synced |

### 1.18 Settings

| Method | Route (CF path) | Dev Server Path | Status |
|--------|----------------|-----------------|--------|
| GET | `/admin/settings` | `/api/admin/settings` | Synced |
| PUT | `/admin/settings` | `/api/admin/settings` | Synced |

### 1.19 Shelf Groups

| Method | Route (CF path) | Dev Server Path | Status |
|--------|----------------|-----------------|--------|
| DELETE | `/admin/shelf-groups/:id` | `/api/admin/shelf-groups/:id` | Synced |
| GET | `/admin/shelf-groups` | `/api/admin/shelf-groups` | Synced |
| PATCH | `/admin/shelf-groups/:id` | `/api/admin/shelf-groups/:id` | Synced |
| POST | `/admin/shelf-groups` | `/api/admin/shelf-groups` | Synced |

### 1.20 Store Product Links

| Method | Route (CF path) | Dev Server Path | Status |
|--------|----------------|-----------------|--------|
| DELETE | `/admin/store-product-links/:linkId` | `/api/admin/store-product-links/:linkId` | Synced |
| GET | `/admin/store-product-links` | `/api/admin/store-product-links` | Synced |
| PATCH | `/admin/store-product-links/:linkId` | `/api/admin/store-product-links/:linkId` | Synced |
| POST | `/admin/store-product-links` | `/api/admin/store-product-links` | Synced |

### 1.21 Stores (Admin)

| Method | Route (CF path) | Dev Server Path | Status |
|--------|----------------|-----------------|--------|
| DELETE | `/admin/stores/:storeId` | `/api/admin/stores/:storeId` | Synced |
| DELETE | `/admin/stores/:storeId/channels/:channelId` | `/api/admin/stores/:storeId/channels/:channelId` | Synced |
| GET | `/admin/stores` | `/api/admin/stores` | Synced |
| GET | `/admin/stores/by-id/:storeId` | `/api/admin/stores/by-id/:storeId` | Synced |
| GET | `/admin/stores/:storeId/channels` | `/api/admin/stores/:storeId/channels` | Synced |
| GET | `/admin/stores/:storeId/channels/:channelId/products` | `/api/admin/stores/:storeId/channels/:channelId/products` | Synced |
| POST | `/admin/stores` | `/api/admin/stores` | Synced |
| POST | `/admin/stores/:storeId/channels` | `/api/admin/stores/:storeId/channels` | Synced |

---

## SECTION 2: ADMIN ROUTES — Dev Only (MISSING from Cloud Function)

These 154 admin routes exist in the dev server but NOT in the Cloud Function. If the frontend calls these in production, they will 404.

### 2.1 Orchestration (45 routes) — LARGEST GAP

| Method | Route | Notes |
|--------|-------|-------|
| DELETE | `/admin/orchestration/bundles/:id` | Bundle management |
| DELETE | `/admin/orchestration/master-products/:id` | Master product management |
| DELETE | `/admin/orchestration/repricing/rules/:ruleId` | Repricing rules |
| GET | `/admin/orchestration/bulk-publish/:jobId` | Bulk publish job status |
| GET | `/admin/orchestration/bulk-publish-jobs` | List bulk publish jobs |
| GET | `/admin/orchestration/bundles` | List bundles |
| GET | `/admin/orchestration/bundles/:id` | Get bundle |
| GET | `/admin/orchestration/channel-configs` | Channel configurations |
| GET | `/admin/orchestration/channel-configs/:channelType` | Channel config by type |
| GET | `/admin/orchestration/master-products` | List master products |
| GET | `/admin/orchestration/master-products/:id` | Get master product |
| GET | `/admin/orchestration/master-products/:id/design-versions` | Design versions |
| GET | `/admin/orchestration/master-products/:id/publish-states` | Publish states |
| GET | `/admin/orchestration/profit/alerts` | Profit alerts |
| GET | `/admin/orchestration/profit/channels` | Profit by channel |
| GET | `/admin/orchestration/profit/dashboard` | Profit dashboard |
| GET | `/admin/orchestration/profit/products` | Profit by product |
| GET | `/admin/orchestration/provider-health` | Provider health |
| GET | `/admin/orchestration/provider-health/:providerType/history` | Provider health history |
| GET | `/admin/orchestration/qr-analytics/products` | QR analytics by product |
| GET | `/admin/orchestration/qr-analytics/recent` | Recent QR analytics |
| GET | `/admin/orchestration/qr-analytics/summary` | QR analytics summary |
| GET | `/admin/orchestration/qr-analytics/trends` | QR analytics trends |
| GET | `/admin/orchestration/repricing/history` | Repricing history |
| GET | `/admin/orchestration/repricing/rules` | Repricing rules |
| GET | `/admin/orchestration/repricing/rules/:ruleId/preview` | Rule preview |
| GET | `/admin/orchestration/repricing/stats` | Repricing stats |
| GET | `/admin/orchestration/routing/history` | Routing history |
| GET | `/admin/orchestration/routing/recommendations/:blueprintId` | Routing recommendations |
| GET | `/admin/orchestration/routing/stats` | Routing stats |
| PATCH | `/admin/orchestration/bundles/:id` | Update bundle |
| PATCH | `/admin/orchestration/channel-configs/:channelType` | Update channel config |
| PATCH | `/admin/orchestration/master-products/:id` | Update master product |
| PATCH | `/admin/orchestration/repricing/rules/:ruleId` | Update repricing rule |
| POST | `/admin/orchestration/bulk-publish` | Start bulk publish |
| POST | `/admin/orchestration/bundles` | Create bundle |
| POST | `/admin/orchestration/bundles/:id/toggle` | Toggle bundle |
| POST | `/admin/orchestration/channel-configs` | Create channel config |
| POST | `/admin/orchestration/master-products` | Create master product |
| POST | `/admin/orchestration/master-products/:id/design-versions` | Create design version |
| POST | `/admin/orchestration/profit/calculate` | Calculate profit |
| POST | `/admin/orchestration/profit/compare-channels` | Compare channel profit |
| POST | `/admin/orchestration/profit/recommended-price` | Get recommended price |
| POST | `/admin/orchestration/provider-health/check` | Check provider health |
| POST | `/admin/orchestration/provider-health/:providerType/check` | Check specific provider |
| POST | `/admin/orchestration/repricing/rules` | Create repricing rule |
| POST | `/admin/orchestration/repricing/rules/:ruleId/toggle` | Toggle repricing rule |
| POST | `/admin/orchestration/repricing/run` | Run repricing |
| POST | `/admin/orchestration/routing/batch` | Batch routing |
| POST | `/admin/orchestration/routing/route` | Route single |

### 2.2 Catalog (Extended) (6 routes)

| Method | Route | Notes |
|--------|-------|-------|
| DELETE | `/admin/catalog/clear` | Clear catalog |
| GET | `/admin/catalog/cost-sync-status` | Cost sync status |
| GET | `/admin/catalog/providers/:blueprintId/:providerId` | Provider details |
| GET | `/admin/catalog/sync-history` | Sync history |
| POST | `/admin/catalog/cancel-cost-sync` | Cancel cost sync |
| POST | `/admin/catalog/fetch-costs` | Fetch costs |
| POST | `/admin/catalog/refresh-color-hex` | Refresh color hex |
| POST | `/admin/catalog/sync-all-costs` | Sync all costs |

### 2.3 Products (Extended) (11 routes)

| Method | Route | Notes |
|--------|-------|-------|
| GET | `/admin/product-configs` | Product configs |
| GET | `/admin/provider-counts` | Provider counts |
| PATCH | `/admin/products/:id/options` | Update product options |
| PATCH | `/admin/partner-stores/:id` | Update partner store |
| PATCH | `/admin/partner-stores/:storeId/products/:productId` | Update partner product |
| POST | `/admin/products/apply-costs` | Apply costs |
| POST | `/admin/products/backfill-provider-locations` | Backfill locations |
| POST | `/admin/products/bulk-import` | Bulk import |
| POST | `/admin/products/from-printify` | Import from Printify |
| POST | `/admin/products/:id/categories` | Set categories |
| POST | `/admin/products/:id/sync-printify` | Sync with Printify |
| POST | `/admin/products/sync` | Sync products |
| PUT | `/admin/products/:id` | Update product |

### 2.4 Stores (Extended) (5 routes)

| Method | Route | Notes |
|--------|-------|-------|
| DELETE | `/admin/stores/:storeId/channels/:channelId/content/:contentId` | Delete channel content |
| GET | `/admin/stores/:storeId/channels/:channelId/collections` | List collections |
| GET | `/admin/stores/:storeId/channels/:channelId/collections/:collectionName/items` | Collection items |
| GET | `/admin/stores/:storeId/channels/:channelId/content` | Channel content |
| POST | `/admin/stores/:storeId/channels/:channelId/collections` | Create collection |
| POST | `/admin/stores/:storeId/channels/:channelId/content` | Create content |

### 2.5 Collections (4 routes)

| Method | Route | Notes |
|--------|-------|-------|
| DELETE | `/admin/collections/:collectionId/items/:itemId` | Delete collection item |
| GET | `/admin/collections/:collectionId/items` | List collection items |
| PATCH | `/admin/collections/:collectionId/items/:itemId` | Update collection item |
| POST | `/admin/collections/:collectionId/items` | Create collection item |
| PUT | `/admin/collections/:collectionId/items/reorder` | Reorder items |

### 2.6 Custom Designs (4 routes)

| Method | Route | Notes |
|--------|-------|-------|
| DELETE | `/admin/custom-designs/:id` | Delete design |
| GET | `/admin/custom-designs` | List designs |
| PATCH | `/admin/custom-designs/:id` | Update design |
| POST | `/admin/custom-designs` | Create design |
| PUT | `/admin/custom-designs/:id` | Update design (PUT) |

### 2.7 Customers (2 routes)

| Method | Route | Notes |
|--------|-------|-------|
| GET | `/admin/customers` | List customers |
| GET | `/admin/customers/:id` | Get customer |

### 2.8 Dashboard (1 route)

| Method | Route | Notes |
|--------|-------|-------|
| GET | `/admin/dashboard/metrics` | Dashboard metrics |

### 2.9 Designs (2 routes)

| Method | Route | Notes |
|--------|-------|-------|
| GET | `/admin/designs/:id/publish-status` | Publish status |
| POST | `/admin/designs/:id/publish` | Publish design |

### 2.10 Dynamics (1 route)

| Method | Route | Notes |
|--------|-------|-------|
| GET | `/admin/dynamics/surfaces` | List surfaces |
| POST | `/admin/dynamics/surfaces` | Create surface |

### 2.11 Email (5 routes)

| Method | Route | Notes |
|--------|-------|-------|
| DELETE | `/admin/email-templates/:id` | Delete template |
| GET | `/admin/email-logs` | Email logs |
| GET | `/admin/email-templates` | List templates |
| GET | `/admin/email-templates/:id` | Get template |
| PATCH | `/admin/email-templates/:id` | Update template |
| POST | `/admin/email-templates` | Create template |

### 2.12 Fonts (1 route)

| Method | Route | Notes |
|--------|-------|-------|
| PUT | `/admin/fonts` | Update fonts |

### 2.13 Gifts (4 routes)

| Method | Route | Notes |
|--------|-------|-------|
| DELETE | `/admin/gifts/packages/:id` | Delete gift package |
| GET | `/admin/gifts/codes` | List gift codes |
| GET | `/admin/gifts/packages` | List gift packages |
| GET | `/admin/gifts/redemptions` | List redemptions |
| PATCH | `/admin/gifts/packages/:id` | Update gift package |
| PATCH | `/admin/gifts/redemptions/:id` | Update redemption |
| POST | `/admin/gifts/packages` | Create gift package |

### 2.14 Graphic Sets (5 routes)

| Method | Route | Notes |
|--------|-------|-------|
| DELETE | `/admin/graphic-sets/:id` | Delete graphic set |
| GET | `/admin/graphic-sets` | List graphic sets |
| GET | `/admin/graphic-sets/category/:categoryId` | By category |
| GET | `/admin/graphic-sets/:id` | Get graphic set |
| POST | `/admin/graphic-sets` | Create graphic set |
| POST | `/admin/graphic-sets/:id/use` | Use graphic set |
| PUT | `/admin/graphic-sets/:id` | Update graphic set |

### 2.15 Health (1 route)

| Method | Route | Notes |
|--------|-------|-------|
| GET | `/admin/health` | Admin health check |

### 2.16 Images (1 route)

| Method | Route | Notes |
|--------|-------|-------|
| GET | `/admin/images` | List images |

### 2.17 Channel Items (2 routes)

| Method | Route | Notes |
|--------|-------|-------|
| POST | `/admin/channel-items/:itemId/regenerate-assets` | Regenerate assets |
| POST | `/admin/channel-items/seed` | Seed channel items |

### 2.18 Library Upload (1 route)

| Method | Route | Notes |
|--------|-------|-------|
| POST | `/admin/library/upload` | Upload to library |

### 2.19 Mockup Jobs (2 routes)

| Method | Route | Notes |
|--------|-------|-------|
| POST | `/admin/mockup-jobs/worker/:action` | Worker action |
| POST | `/admin/mockups/pre-generate` | Pre-generate mockups |

### 2.20 Orders Unified (3 routes)

| Method | Route | Notes |
|--------|-------|-------|
| GET | `/admin/orders-unified` | List unified orders |
| GET | `/admin/orders-unified/:id` | Get unified order |
| PATCH | `/admin/orders-unified/:id` | Update unified order |
| POST | `/admin/orders-unified/:id/sync-printify` | Sync order with Printify |

### 2.21 Partner Stores (Extended) (3 routes)

| Method | Route | Notes |
|--------|-------|-------|
| GET | `/admin/partner-stores/:id` | Get partner store |
| POST | `/admin/partner-stores/:id/regenerate-key` | Regenerate API key |
| POST | `/admin/partner-stores/:storeId/products/:productId/generate-mockup` | Generate mockup |

### 2.22 Printify Blueprints (3 routes)

| Method | Route | Notes |
|--------|-------|-------|
| GET | `/admin/printify/blueprints` | List blueprints |
| GET | `/admin/printify/blueprints/:blueprintId/providers/:providerId/variants` | Variants |
| GET | `/admin/printify/blueprints/:id/providers` | Providers |

### 2.23 Product Categories (Extended) (3 routes)

| Method | Route | Notes |
|--------|-------|-------|
| GET | `/admin/product-categories` | List categories |
| POST | `/admin/product-categories/seed` | Seed categories |

### 2.24 Queue (1 route)

| Method | Route | Notes |
|--------|-------|-------|
| GET | `/admin/queue/status` | Queue status |

### 2.25 Sync (2 routes)

| Method | Route | Notes |
|--------|-------|-------|
| POST | `/admin/sync-blueprints-to-firestore` | Sync blueprints |
| POST | `/admin/sync-providers-to-firestore` | Sync providers |

### 2.26 Template Categories (3 routes)

| Method | Route | Notes |
|--------|-------|-------|
| DELETE | `/admin/template-categories/:id` | Delete category |
| GET | `/admin/template-categories` | List categories |
| GET | `/admin/template-categories/by-parent` | By parent |
| POST | `/admin/template-categories` | Create category |
| PUT | `/admin/template-categories/:id` | Update category |

### 2.27 Templates (3 routes)

| Method | Route | Notes |
|--------|-------|-------|
| DELETE | `/admin/templates/:id` | Delete template |
| GET | `/admin/templates` | List templates |
| GET | `/admin/templates/:templateId/mockups` | Template mockups |
| POST | `/admin/templates` | Create template |
| PUT | `/admin/templates/:id` | Update template |

### 2.28 Upload & Media (3 routes)

| Method | Route | Notes |
|--------|-------|-------|
| POST | `/admin/background-assets/migrate` | Migrate backgrounds |
| POST | `/admin/hosting-tiers/seed` | Seed hosting tiers |
| POST | `/admin/test-mockup-sizes` | Test mockup sizes |
| POST | `/admin/upload` | Upload file |
| POST | `/admin/upload-media` | Upload media |

---

## SECTION 3: ADMIN ROUTES — Cloud Function Only (NOT in Dev Server)

These 28 admin routes exist in the Cloud Function but NOT in the dev server. These may be legacy routes, or were added directly to the CF without backporting to dev.

### 3.1 Designs (CF-only admin)

| Method | Route | Notes |
|--------|-------|-------|
| DELETE | `/admin/designs/:id` | Delete design (CF has, dev uses different path) |
| GET | `/admin/designs` | List designs (CF has admin-scoped, dev has public) |
| POST | `/admin/designs` | Create design (admin-scoped in CF) |
| PUT | `/admin/designs/:id` | Update design (admin-scoped in CF) |

### 3.2 Gallery (CF-only admin)

| Method | Route | Notes |
|--------|-------|-------|
| DELETE | `/admin/gallery/:id` | Delete gallery item |
| POST | `/admin/gallery` | Create gallery item |

### 3.3 Gift Codes & Packages (CF-only naming)

| Method | Route | Notes |
|--------|-------|-------|
| DELETE | `/admin/gift-codes/:id` | Dev uses `/admin/gifts/codes` |
| DELETE | `/admin/gift-packages/:id` | Dev uses `/admin/gifts/packages/:id` |
| GET | `/admin/gift-codes` | Dev uses `/admin/gifts/codes` |
| GET | `/admin/gift-packages` | Dev uses `/admin/gifts/packages` |
| POST | `/admin/gift-codes` | Dev uses different path |
| POST | `/admin/gift-packages` | Dev uses `/admin/gifts/packages` |

### 3.4 Orders (CF naming)

| Method | Route | Notes |
|--------|-------|-------|
| GET | `/admin/orders` | Dev uses `/admin/orders-unified` |
| GET | `/admin/orders/:id` | Dev uses `/admin/orders-unified/:id` |
| PATCH | `/admin/orders/:id` | Dev uses `/admin/orders-unified/:id` |
| POST | `/admin/orders/:id/resend-confirmation` | CF-only |
| POST | `/admin/orders/:id/send-shipping-email` | CF-only |
| POST | `/admin/orders/:id/submit-to-printify` | Dev uses different path |
| POST | `/admin/orders/:id/sync-printify` | Dev uses different path |

### 3.5 Products (CF-only)

| Method | Route | Notes |
|--------|-------|-------|
| POST | `/admin/products` | POST create (CF has, dev uses import routes) |

### 3.6 QR Templates (CF-only)

| Method | Route | Notes |
|--------|-------|-------|
| DELETE | `/admin/qr-templates/:id` | Not in dev |
| POST | `/admin/qr-templates` | Not in dev |
| PUT | `/admin/qr-templates/:id` | Not in dev |

### 3.7 Partner Stores (CF-only)

| Method | Route | Notes |
|--------|-------|-------|
| PUT | `/admin/partner-stores/:id` | Dev uses PATCH instead |

### 3.8 Stores (CF-only)

| Method | Route | Notes |
|--------|-------|-------|
| GET | `/admin/stores/:storeId/allowed-products` | Not in dev admin routes |
| POST | `/admin/stores/:storeId/allowed-products` | Not in dev admin routes |

### 3.9 Claim Codes (CF-only)

| Method | Route | Notes |
|--------|-------|-------|
| POST | `/admin/claim-codes` | Not in dev |

### 3.10 Users (CF-only)

| Method | Route | Notes |
|--------|-------|-------|
| GET | `/admin/users` | Not in dev |

---

## SECTION 4: PUBLIC/SHARED ROUTES — Synced (in BOTH)

These 41 non-admin routes exist in both codebases.

### 4.1 Cart

| Method | Route (CF path) | Dev Server Path | Status |
|--------|----------------|-----------------|--------|
| DELETE | `/cart/:id` | `/api/cart/:id` | Synced |
| GET | `/cart` | `/api/cart` | Synced |
| POST | `/cart` | `/api/cart` | Synced |
| PUT | `/cart/:id` | `/api/cart/:id` | Synced |

### 4.2 Catalog & Products (Public)

| Method | Route (CF path) | Dev Server Path | Status |
|--------|----------------|-----------------|--------|
| GET | `/catalog/printful-products` | `/api/catalog/printful-products` | Synced |
| GET | `/categories` | `/api/categories` | Synced |
| GET | `/hosting-tiers` | `/api/hosting-tiers` | Synced |
| GET | `/placements` | `/api/placements` | Synced |
| GET | `/pricing-settings` | `/api/pricing-settings` | Synced |
| GET | `/product-categories` | `/api/product-categories` | Synced |
| GET | `/product-categories/:id/products` | `/api/product-categories/:id/products` | Synced |
| GET | `/products` | `/api/products` | Synced |
| GET | `/products/:id` | `/api/products/:id` | Synced |

### 4.3 Checkout

| Method | Route (CF path) | Dev Server Path | Status |
|--------|----------------|-----------------|--------|
| GET | `/checkout/verify/:sessionId` | `/api/checkout/verify/:sessionId` | Synced |
| POST | `/checkout` | `/api/checkout` | Synced |
| POST | `/checkout/embedded` | `/api/checkout/embedded` | Synced |

### 4.4 Claim

| Method | Route (CF path) | Dev Server Path | Status |
|--------|----------------|-----------------|--------|
| POST | `/claim/:claimCode` | `/api/claim/:claimCode` | Synced |

### 4.5 Designs (Public)

| Method | Route (CF path) | Dev Server Path | Status |
|--------|----------------|-----------------|--------|
| DELETE | `/designs/:id` | `/api/designs/:id` | Synced |
| GET | `/designs` | `/api/designs` | Synced |
| GET | `/designs/:id` | `/api/designs/:id` | Synced |
| POST | `/designs` | `/api/designs` | Synced |
| PUT | `/designs/:id` | `/api/designs/:id` | Synced |

### 4.6 Gallery

| Method | Route (CF path) | Dev Server Path | Status |
|--------|----------------|-----------------|--------|
| GET | `/gallery` | `/api/gallery` | Synced |

### 4.7 Mockups

| Method | Route (CF path) | Dev Server Path | Status |
|--------|----------------|-----------------|--------|
| GET | `/mockups/cached/:blueprintId/:printProviderId` | `/api/mockups/cached/:blueprintId/:printProviderId` | Synced |
| POST | `/mockups/get-or-generate` | `/api/mockups/get-or-generate` | Synced |

### 4.8 Orders (Public)

| Method | Route (CF path) | Dev Server Path | Status |
|--------|----------------|-----------------|--------|
| GET | `/orders` | `/api/orders` | Synced |
| GET | `/orders/:id` | `/api/orders/:id` | Synced |
| POST | `/orders` | `/api/orders` | Synced |

### 4.9 Packets (Public)

| Method | Route (CF path) | Dev Server Path | Status |
|--------|----------------|-----------------|--------|
| GET | `/public/packets/:packetId` | `/api/public/packets/:packetId` | Synced |

### 4.10 Partner

| Method | Route (CF path) | Dev Server Path | Status |
|--------|----------------|-----------------|--------|
| GET | `/partner/products` | `/api/partner/products` | Synced |

### 4.11 Printify (Public)

| Method | Route (CF path) | Dev Server Path | Status |
|--------|----------------|-----------------|--------|
| GET | `/printify/status` | `/api/printify/status` | Synced |

### 4.12 QR

| Method | Route (CF path) | Dev Server Path | Status |
|--------|----------------|-----------------|--------|
| POST | `/qr/generate` | `/api/qr/generate` | Synced |

### 4.13 Storefront

| Method | Route (CF path) | Dev Server Path | Status |
|--------|----------------|-----------------|--------|
| POST | `/storefront/generate-mockup` | `/api/storefront/generate-mockup` | Synced |

### 4.14 Stores (Public)

| Method | Route (CF path) | Dev Server Path | Status |
|--------|----------------|-----------------|--------|
| GET | `/stores` | `/api/stores` | Synced |

### 4.15 Stripe

| Method | Route (CF path) | Dev Server Path | Status |
|--------|----------------|-----------------|--------|
| GET | `/stripe/publishable-key` | `/api/stripe/publishable-key` | Synced |

### 4.16 Upload

| Method | Route (CF path) | Dev Server Path | Status |
|--------|----------------|-----------------|--------|
| POST | `/upload` | `/api/upload` | Synced |

### 4.17 Widget

| Method | Route (CF path) | Dev Server Path | Status |
|--------|----------------|-----------------|--------|
| GET | `/widget/items` | `/api/widget/items` | Synced |
| GET | `/widget/session` | `/api/widget/session` | Synced |
| POST | `/widget/token` | `/api/widget/token` | Synced |

---

## SECTION 5: PUBLIC/SHARED ROUTES — Dev Only

These 149 non-admin routes exist in the dev server but NOT in the Cloud Function.

### 5.1 Members (46 routes) — ENTIRE FEATURE DEV-ONLY

| Method | Route | Notes |
|--------|-------|-------|
| DELETE | `/member/packets/:packetId` | Member packet delete |
| GET | `/member/library-links` | Member library links |
| GET | `/member/packets` | Member packets |
| GET | `/members/allowed-products` | Allowed products for members |
| GET | `/members/check-status` | Check member status |
| GET | `/members/common-library` | Common library |
| GET | `/members/:memberId/channels` | Member channels |
| GET | `/members/:memberId/earnings` | Member earnings |
| GET | `/members/:memberId/graphics` | Member graphics |
| GET | `/members/:memberId/library` | Member library |
| GET | `/members/:memberId/products` | Member products |
| GET | `/members/:memberId/published-items` | Published items |
| GET | `/members/profile` | Member profile |
| PATCH | `/members/:memberId/packets/:packetId` | Update packet |
| POST | `/member/graphics/create` | Create graphic |
| POST | `/member/library-links` | Create library link |
| POST | `/member/packets` | Create packet |
| POST | `/member/play-packets` | Create play packet |
| POST | `/member/play-packets/:packetId/publish` | Publish play packet |
| POST | `/member/play-packets/:packetId/share-card` | Share card |
| POST | `/member/templates/save` | Save template |
| POST | `/members/allowed-products` | Set allowed products |
| POST | `/members/generate-product-graphic` | Generate graphic |
| POST | `/members/:memberId/channels` | Create channel |
| POST | `/members/:memberId/claim-temp-packet` | Claim temp packet |
| POST | `/members/:memberId/library/crop` | Crop library image |
| POST | `/members/:memberId/library/upload` | Upload to library |
| POST | `/members/:memberId/media` | Upload media |
| POST | `/members/:memberId/packets` | Create packet |
| POST | `/members/:memberId/products` | Create product |
| POST | `/members/:memberId/videos/upload` | Upload video |
| POST | `/members/mockup/priority` | Priority mockup |
| POST | `/members/profile` | Update profile |

### 5.2 Buyer (3 routes)

| Method | Route | Notes |
|--------|-------|-------|
| GET | `/buyer/instances` | List buyer instances |
| GET | `/buyer/instances/:instanceId` | Get buyer instance |
| PATCH | `/buyer/instances/:instanceId` | Update buyer instance |
| POST | `/buyer/instances/:instanceId/renew` | Renew instance |
| POST | `/buyer/instances/:instanceId/verify-renewal` | Verify renewal |

### 5.3 Dynamic Pages (7 routes)

| Method | Route | Notes |
|--------|-------|-------|
| DELETE | `/dynamic-pages/:id` | Delete dynamic page |
| GET | `/dynamic-pages` | List dynamic pages |
| GET | `/dynamic-pages/:id` | Get dynamic page |
| GET | `/dynamic-pages/:id/assets` | Get page assets |
| POST | `/dynamic-pages` | Create page (also in CF) |
| POST | `/dynamic-pages/create` | Create page alt (also in CF) |
| POST | `/dynamic-pages/:id/assets` | Upload assets (also in CF) |
| POST | `/dynamic-pages/:id/set-active` | Set active (also in CF) |
| PUT | `/dynamic-pages/:id` | Update page |

### 5.4 Dynamics (5 routes)

| Method | Route | Notes |
|--------|-------|-------|
| GET | `/dynamics/instances/:instanceId` | Get instance |
| GET | `/dynamics/instances/:instanceId/preview` | Preview instance |
| GET | `/dynamic/:slug` | Dynamic slug |
| GET | `/dynamics/packets` | Dynamic packets |
| POST | `/dynamics/instances` | Create instance (also in CF) |
| PUT | `/dynamics/instances/:instanceId/slots` | Update slots |

### 5.5 Files & Media (9 routes)

| Method | Route | Notes |
|--------|-------|-------|
| GET | `/files/:file` | Serve file |
| GET | `/library-files/:file` | Library file |
| GET | `/library-files/member/:userId/:mediaType/:filename` | Member library file |
| GET | `/library-files/:storeType/:mediaType/:filename` | Store library file |
| GET | `/media-files/:filename` | Media file |
| GET | `/member-files/:memberId/:filename` | Member file |
| DELETE | `/images/:imageId` | Delete image |
| GET | `/images/:imageId` | Get image |
| GET | `/images/info/:imageId` | Image info |
| GET | `/images/user/:userId` | User images |
| POST | `/images/upload` | Upload image (also in CF) |

### 5.6 Fonts (1 route)

| Method | Route | Notes |
|--------|-------|-------|
| GET | `/fonts` | List fonts |

### 5.7 Gifts (4 routes)

| Method | Route | Notes |
|--------|-------|-------|
| GET | `/gifts/packages` | List gift packages |
| GET | `/gifts/packages/:id` | Get gift package |
| GET | `/gifts/redeem/:code` | Redeem code |
| POST | `/gifts/purchase` | Purchase gift (also in CF) |
| POST | `/gifts/redeem/:code` | Redeem gift (also in CF) |

### 5.8 Library (2 routes)

| Method | Route | Notes |
|--------|-------|-------|
| GET | `/library/my` | My library |
| POST | `/library/upload` | Upload to library (also in CF) |

### 5.9 Mockup Jobs (5 routes)

| Method | Route | Notes |
|--------|-------|-------|
| DELETE | `/mockup-jobs/product/:productId` | Delete job by product |
| GET | `/mockup-jobs/:jobId` | Get job |
| GET | `/mockup-jobs/product/:productId` | Jobs by product |
| GET | `/mockup-jobs/stats` | Job stats |
| POST | `/mockup-jobs/batch` | Batch jobs |
| POST | `/mockup-jobs/prioritize` | Prioritize job |
| POST | `/mockup/priority` | Priority mockup |
| POST | `/mockups/lifestyle` | Lifestyle mockup |

### 5.10 Orders (Extended) (2 routes)

| Method | Route | Notes |
|--------|-------|-------|
| GET | `/orders/:id/status` | Order status |
| POST | `/orders/:id/submit-printify` | Submit to Printify |

### 5.11 Packets (3 routes)

| Method | Route | Notes |
|--------|-------|-------|
| GET | `/packets` | List packets |
| GET | `/packets/:packetId` | Get packet |
| PATCH | `/public/packets/:tempPacketId` | Update temp packet |
| POST | `/packets` | Create packet |
| POST | `/public/packets` | Create public packet |
| POST | `/public/packets/:tempPacketId/complete` | Complete temp packet |
| DELETE | `/public/packets/cleanup/expired` | Cleanup expired |

### 5.12 Partner Stores (1 route)

| Method | Route | Notes |
|--------|-------|-------|
| GET | `/partner-stores` | List partner stores |

### 5.13 Pricing (3 routes)

| Method | Route | Notes |
|--------|-------|-------|
| POST | `/pricing/quote` | Get pricing quote |
| POST | `/pricing-settings` | Update pricing settings |
| POST | `/pricing-settings/sync` | Sync pricing settings |

### 5.14 Printify (Public) (4 routes)

| Method | Route | Notes |
|--------|-------|-------|
| GET | `/printify/catalog` | Public catalog |
| GET | `/printify/catalog/:blueprintId` | Blueprint details |
| GET | `/printify/catalog/:blueprintId/variants` | Variants |
| GET | `/printify/local-blueprints` | Local blueprints |
| GET | `/printify/products` | Products |

### 5.15 Products (Extended) (1 route)

| Method | Route | Notes |
|--------|-------|-------|
| GET | `/products/:id/categories` | Product categories |

### 5.16 Public Routes (5 routes)

| Method | Route | Notes |
|--------|-------|-------|
| GET | `/public/checkout/verify/:sessionId` | Verify checkout |
| GET | `/public/dynamics/resolve/:surfaceId` | Resolve dynamic |
| GET | `/public/landing/:slug` | Landing page |
| GET | `/public/packets/:tempPacketId` | Temp packet (GET variant) |
| POST | `/public/checkout` | Public checkout |
| POST | `/public/generate-mockup` | Generate mockup |
| POST | `/public/generate-product-graphic` | Generate graphic |

### 5.17 QR (3 routes)

| Method | Route | Notes |
|--------|-------|-------|
| GET | `/qr/image` | Get QR image |
| POST | `/qr/scan` | Record scan |

### 5.18 Render (3 routes)

| Method | Route | Notes |
|--------|-------|-------|
| GET | `/render/config` | Render config |
| POST | `/render/png` | Render PNG |
| POST | `/render/png/download` | Download rendered PNG |

### 5.19 Resolve (1 route)

| Method | Route | Notes |
|--------|-------|-------|
| GET | `/resolve/:instanceId` | Resolve instance |

### 5.20 Storage (1 route)

| Method | Route | Notes |
|--------|-------|-------|
| GET | `/storage/health` | Storage health |

### 5.21 Stores (Extended) (13 routes)

| Method | Route | Notes |
|--------|-------|-------|
| DELETE | `/stores/:storeId` | Delete store |
| DELETE | `/stores/:storeId/channels/:channelId` | Delete channel |
| DELETE | `/stores/:storeId/channels/:channelId/content/:contentId` | Delete content |
| GET | `/store-product-links` | Product links |
| GET | `/store/products` | Store products |
| GET | `/stores/by-id/:storeId` | Store by ID |
| GET | `/stores/:storeId/allowed-products` | Allowed products |
| GET | `/stores/:storeId/channels` | Store channels |
| GET | `/stores/:storeId/channels/:channelId/collections` | Collections |
| GET | `/stores/:storeId/channels/:channelId/collections/:collectionName/items` | Collection items |
| GET | `/stores/:storeId/channels/:channelId/content` | Channel content |
| GET | `/stores/:storeId/channels/:channelId/products` | Channel products |
| GET | `/store/:storeType/:storeName` | Store by type/name |
| POST | `/store-product-links` | Create product link |
| POST | `/stores` | Create store |
| POST | `/stores/:storeId/allowed-products` | Set allowed products |
| POST | `/stores/:storeId/channels` | Create channel |
| POST | `/stores/:storeId/channels/:channelId/collections` | Create collection |
| POST | `/stores/:storeId/channels/:channelId/content` | Create content |
| POST | `/stores/:storeId/channels/:channelId/products` | Add products |

### 5.22 Templates (1 route)

| Method | Route | Notes |
|--------|-------|-------|
| GET | `/templates` | List templates |

### 5.23 Uploads (2 routes)

| Method | Route | Notes |
|--------|-------|-------|
| POST | `/uploads/request-url` | Request upload URL |

### 5.24 Bundles (1 route)

| Method | Route | Notes |
|--------|-------|-------|
| GET | `/bundles/for-product/:productId` | Bundles for product |
| POST | `/bundles/:id/calculate` | Calculate bundle |

### 5.25 Coupons (1 route)

| Method | Route | Notes |
|--------|-------|-------|
| POST | `/coupons/validate` | Validate coupon |

### 5.26 Customs (1 route)

| Method | Route | Notes |
|--------|-------|-------|
| GET | `/customs/:id` | Get custom |

### 5.27 Proxy (1 route)

| Method | Route | Notes |
|--------|-------|-------|
| GET | `/proxy-image` | Proxy image |

### 5.28 Widget (Extended) (6 routes)

| Method | Route | Notes |
|--------|-------|-------|
| GET | `/widget/events` | Widget events |
| GET | `/widget/programs/:programId` | Get program |
| GET | `/widget/programs/:programId/moments` | Program moments |
| GET | `/widget/stores/:slug` | Store by slug |
| GET | `/widget/stores/:storeId/programs` | Store programs |
| GET | `/widget/verify` | Verify widget |
| PATCH | `/widget/programs/:programId` | Update program |
| POST | `/widget/programs` | Create program |

### 5.29 Claim (1 route)

| Method | Route | Notes |
|--------|-------|-------|
| GET | `/claim/validate` | Validate claim |

---

## SECTION 6: PUBLIC/SHARED ROUTES — CF Only

These 20 non-admin routes exist in the Cloud Function but NOT in the dev server.

| Method | Route | Notes |
|--------|-------|-------|
| GET | `/auth/user` | Get authenticated user |
| GET | `/browsing-history` | Get browsing history |
| GET | `/checkout/session-status` | Checkout session status |
| GET | `/claimed-instances` | List claimed instances |
| GET | `/claimed-instances/:instanceId` | Get claimed instance |
| GET | `/claim/validate/:claimCode` | Validate claim (CF uses param, dev uses query) |
| GET | `/coupons/:code` | Get coupon by code |
| GET | `/files/:filename` | File serving (different param name) |
| GET | `/gift-codes/:code` | Get gift code |
| GET | `/health` | Health check |
| GET | `/library-files/:filename` | Library file (different param name) |
| GET | `/qr-templates` | List QR templates |
| GET | `/qr-templates/:id` | Get QR template |
| GET | `/settings` | Public settings |
| GET | `/stores/:slug` | Store by slug (CF uses :slug, dev uses :storeId) |
| GET | `/test-images` | Test images |
| PATCH | `/claimed-instances/:instanceId` | Update claimed instance |
| POST | `/auth/register` | Register user |
| POST | `/browsing-history` | Add browsing history |
| POST | `/webhooks/stripe` | Stripe webhook |

---

## SECTION 7: FRONTEND FETCH CALLS — Auth Analysis

All `NO_AUTH` fetch calls from the frontend. These are calls where no explicit `Authorization: Bearer` header was found in the fetch call itself.

**IMPORTANT NOTE:** Calls that use the default TanStack Query fetcher (no explicit `queryFn`) automatically get auth from `queryClient.ts` via `getAuthHeader()`. These are actually OK even though they appear as NO_AUTH in the scan.

### 7.1 LibraryContext.tsx (2 calls)

| Line | Notes |
|------|-------|
| 62 | Library fetch - check if using default fetcher |
| 97 | Library fetch - check if using default fetcher |

### 7.2 BuilderContext.tsx (1 call)

| Line | Notes |
|------|-------|
| 211 | `/api/admin/catalog/placements` - explicit fetch with no auth header |

### 7.3 useBuildShelf.ts (8 calls)

| Line | Notes |
|------|-------|
| 35 | Build shelf operations |
| 45 | Build shelf operations |
| 59 | Build shelf operations |
| 75 | Build shelf operations |
| 90 | Build shelf operations |
| 106 | Build shelf operations |
| 125 | Build shelf operations |
| 144 | Build shelf operations |

### 7.4 CreateGraphicsModule.tsx (9 calls) — CRITICAL

| Line | Route Called | Notes |
|------|-------------|-------|
| 480 | `pricing-settings` GET | No auth |
| 658 | `content/upload` POST | No auth |
| 748 | `content/upload` POST | No auth |
| 771 | `content/upload` POST | No auth |
| 806 | `graphics/save` POST | No auth |
| 826 | `templates/full-save` POST | No auth |
| 852 | `queue/process` POST | No auth |
| 862 | `store-product-links` POST | No auth |
| 947 | `mockup/priority` POST | No auth |

### 7.5 ChannelModule.tsx (1 call)

| Line | Notes |
|------|-------|
| 36 | Channel creation POST - no auth |

### 7.6 StoreChannelDropdownModule.tsx (4 calls)

| Line | Notes |
|------|-------|
| 105 | Store fetch |
| 126 | Store by ID fetch - wrong path |
| 143 | Channels fetch |
| 164 | Single channel fetch - route doesn't exist |

### 7.7 StoreModule.tsx (1 call)

| Line | Notes |
|------|-------|
| 38 | Store creation POST - no auth |

### 7.8 ProductsContext.tsx (5 calls)

| Line | Notes |
|------|-------|
| 85 | Products fetch |
| 122 | Product operation |
| 143 | Product operation |
| 153 | Product operation |
| 163 | Product operation |

### 7.9 CatalogBrowserModule.tsx (1 call)

| Line | Notes |
|------|-------|
| 50 | Printify catalog fetch with cookie auth |

### 7.10 ChannelPickerModule.tsx (1 call)

| Line | Notes |
|------|-------|
| 36 | Channel creation POST |

### 7.11 StorePickerModule.tsx (1 call)

| Line | Notes |
|------|-------|
| 35 | Store creation POST |

### 7.12 StoreLibraryContext.tsx (2 calls)

| Line | Notes |
|------|-------|
| 81 | Store by-id fetch - no auth |
| 96 | Store channels fetch - no auth |

### 7.13 MemberOnboarding.tsx (1 call)

| Line | Notes |
|------|-------|
| 132 | Member onboarding |

### 7.14 MembersContext.tsx (5 calls)

| Line | Notes |
|------|-------|
| 121 | Member operations |
| 129 | Member operations |
| 139 | Member operations |
| 150 | Member operations |
| 180 | Member operations |

### 7.15 MembersPage.tsx (7 calls)

| Line | Notes |
|------|-------|
| 70 | Member page fetch |
| 82 | Member page fetch |
| 94 | Member page fetch |
| 372 | Member page operation |
| 384 | Member page operation |
| 458 | Member page operation |
| 524 | Member page operation |
| 660 | Member page operation |

### 7.16 WizardContext.tsx (9 calls)

| Line | Notes |
|------|-------|
| 520 | Wizard operation |
| 548 | Wizard operation |
| 652 | Wizard operation |
| 660 | Wizard operation |
| 696 | Wizard operation |
| 798 | Wizard operation |
| 918 | Wizard operation |
| 951 | Wizard operation |
| 975 | Wizard operation |
| 1633 | Wizard operation |

### 7.17 BackgroundLibraryPicker.tsx (4 calls)

| Line | Notes |
|------|-------|
| 71 | Background fetch - no auth |
| 83 | Background POST - no auth |
| 95 | Background DELETE - no auth |
| 121 | Background DELETE - no auth |

### 7.18 BackgroundPicker.tsx (1 call)

| Line | Notes |
|------|-------|
| 37 | Background fetch |

### 7.19 LibraryBackgroundPicker.tsx (4 calls)

| Line | Notes |
|------|-------|
| 70 | Background assets GET - no auth |
| 81 | Background assets POST - no auth |
| 118 | Background assets DELETE - no auth |
| 135 | Background assets DELETE - no auth |

### 7.20 ProductConfigSkin.tsx (2 calls)

| Line | Notes |
|------|-------|
| 146 | Sync-printify with `credentials: 'include'` (cookie) |
| 166 | Product operation |

### 7.21 VideoSourcePicker.tsx (2 calls)

| Line | Notes |
|------|-------|
| 94 | Video source fetch |
| 144 | Video source fetch |

### 7.22 CanvasSteps.tsx (5 calls)

| Line | Notes |
|------|-------|
| 207 | Canvas operation |
| 220 | Canvas operation |
| 267 | Canvas operation |
| 344 | Canvas operation |
| 367 | Canvas operation |

### 7.23 ChannelStep.tsx (2 calls)

| Line | Notes |
|------|-------|
| 33 | Channel step fetch |
| 43 | Channel step fetch |

### 7.24 wizardTypes.ts (1 call)

| Line | Notes |
|------|-------|
| 309 | Wizard type definition |

### 7.25 memberPacketService.ts (1 call)

| Line | Notes |
|------|-------|
| 116 | Member packet service - no auth headers |

### 7.26 memberVideoService.ts (1 call)

| Line | Notes |
|------|-------|
| 98 | Member video service - no auth headers |

### 7.27 nexusTests.ts (1 call)

| Line | Notes |
|------|-------|
| 155 | Nexus test call |

### 7.28 admin-dynamics.tsx (3 calls)

| Line | Notes |
|------|-------|
| 242 | Admin dynamics operation |
| 306 | Admin dynamics operation |
| 339 | Admin dynamics operation |

### 7.29 admin-pricing.tsx (2 calls)

| Line | Notes |
|------|-------|
| 430 | Admin pricing operation |
| 461 | Admin pricing operation |

### 7.30 admin-store-builder.tsx (12 calls) — HIGH VOLUME

| Line | Notes |
|------|-------|
| 34 | Store builder fetch |
| 169 | Store builder operation |
| 181 | Store builder operation |
| 246 | Store builder operation |
| 251 | Store builder operation |
| 261 | Store builder operation |
| 280 | Store builder operation |
| 438 | Store builder operation |
| 446 | Store builder DELETE - no auth |
| 466 | Store builder operation |
| 608 | `/api/members/allowed-products` - no auth |
| 613 | `/api/members/allowed-products` - no auth |
| 629 | Store builder operation |

### 7.31 Public Pages (4 calls)

| File | Line | Notes |
|------|------|-------|
| build-success.tsx | 52 | Build success fetch |
| claim.tsx | 35 | Claim with `credentials: 'include'` |
| play.tsx | 21 | Play page fetch |
| renew.tsx | 33, 48 | Renewal operations |

---

## SECTION 8: CRITICAL GAPS SUMMARY

### 8.1 Admin Routes Missing from CF That Frontend Actively Calls

These are the most critical gaps — the frontend calls these admin routes, but they don't exist in the Cloud Function, so they will 404 in production:

| Priority | Route | Frontend File | Impact |
|----------|-------|--------------|--------|
| HIGH | `/admin/orchestration/bulk-publish/:jobId` GET | admin-orchestration.tsx | Bulk publish monitoring broken |
| HIGH | `/admin/templates` GET | admin pages, authFetch | Template listing broken |
| HIGH | `/admin/templates/:id` DELETE | admin pages, authFetch | Template deletion broken |
| HIGH | `/admin/templates/:templateId/mockups` GET | BuilderContext | Mockup preview broken |
| HIGH | `/admin/graphic-sets` GET/POST | admin pages, authFetch | Graphic set management broken |
| HIGH | `/admin/graphic-sets/:id` DELETE | admin pages, authFetch | Graphic set deletion broken |
| HIGH | `/admin/customers` GET | admin-customers.tsx | Customer listing broken |
| HIGH | `/admin/email-templates` GET/POST | admin-email-templates.tsx | Email template management broken |
| HIGH | `/admin/gifts/packages` GET/POST | admin-gifts.tsx | Gift management broken |
| HIGH | `/admin/library/upload` POST | LibraryContext | Library upload broken |
| HIGH | `/admin/product-categories` GET | admin pages | Category listing broken |
| HIGH | `/admin/queue/status` GET | admin pages | Queue monitoring broken |
| MEDIUM | All orchestration routes (45) | admin-orchestration.tsx | Entire orchestration page broken |
| MEDIUM | All member routes (33) | member pages, wizards | Entire member experience broken |
| MEDIUM | Dynamic pages routes (7) | admin-dynamics.tsx | Dynamic pages broken |
| LOW | `/admin/dashboard/metrics` GET | admin-dashboard.tsx | Dashboard metrics broken |

### 8.2 Frontend Calls with Broken Auth

These frontend calls use explicit `fetch()` without Bearer token (not using `authFetch()` or default TanStack fetcher):

| File | Line | Route | Issue |
|------|------|-------|-------|
| BuilderContext.tsx | 211 | `/admin/catalog/placements` | Cookie auth instead of Bearer |
| CatalogBrowserModule.tsx | 50 | `/admin/printify/catalog` | Cookie auth instead of Bearer |
| ProductConfigSkin.tsx | 146 | `/admin/products/:id/sync-printify` | Cookie auth via `credentials: 'include'` |
| CreateGraphicsModule.tsx | 658-947 | Multiple admin routes | No auth at all (9 calls) |
| LibraryBackgroundPicker.tsx | 70-135 | `/admin/background-assets` | No auth (4 calls) |
| BackgroundLibraryPicker.tsx | 71-121 | `/admin/background-assets` | No auth (4 calls) |
| StoreLibraryContext.tsx | 81,96 | `/admin/stores/by-id/...` | No auth |
| memberPacketService.ts | 116 | `/member/packets` | No auth |
| memberVideoService.ts | 98 | `/member/videos` | No auth |
| admin-store-builder.tsx | 446 | `/stores/:id` DELETE | No auth (should be admin) |
| admin-store-builder.tsx | 608,613 | `/members/allowed-products` | No auth |
| claim.tsx | 35 | `/claim/:code` | Uses cookie instead of Bearer |

### 8.3 Routes in CF That Don't Exist in Dev (Potential Dead Code or Naming Mismatches)

| CF Route | Possible Dev Equivalent | Issue |
|----------|------------------------|-------|
| `/admin/designs` (CRUD) | `/designs` (public) | CF has admin-scoped, dev has public only |
| `/admin/gallery` (POST/DELETE) | No equivalent | Legacy CF feature |
| `/admin/gift-codes` (CRUD) | `/admin/gifts/codes` | Naming mismatch |
| `/admin/gift-packages` (CRUD) | `/admin/gifts/packages` | Naming mismatch |
| `/admin/orders` (GET/PATCH) | `/admin/orders-unified` | Naming mismatch |
| `/admin/orders/:id/resend-confirmation` | No equivalent | CF-only email feature |
| `/admin/orders/:id/send-shipping-email` | No equivalent | CF-only email feature |
| `/admin/qr-templates` (CRUD) | No equivalent | CF-only feature |
| `/admin/claim-codes` POST | No equivalent | CF-only feature |
| `/admin/users` GET | No equivalent | CF-only feature |
| `/auth/user` GET | No equivalent | CF-only auth route |
| `/auth/register` POST | No equivalent | CF-only auth route |
| `/browsing-history` (GET/POST) | No equivalent | CF-only feature |
| `/claimed-instances` (GET/PATCH) | No equivalent | CF-only feature |
| `/webhooks/stripe` POST | No equivalent in routes | Handled differently in dev |
| `/stores/:slug` GET | `/store/:storeType/:storeName` | Different path pattern |
| `/settings` GET | No public equivalent | CF-only |

---

## SECTION 9: FIXES APPLIED THIS SESSION

### Summary

Over 35 fixes were applied across the codebase to address auth issues, route mismatches, and missing functionality.

### 9.1 Auth Fixes — Bearer Token Added

| File | What Was Fixed |
|------|---------------|
| `CreateGraphicsModule.tsx` | 9 fetch calls updated: `content/upload`, `graphics/save`, `templates/full-save`, `queue/process`, `store-product-links`, `mockup/priority`, `pricing-settings` GET — all now include `getAuthHeaders()` Bearer token |
| `LibraryBackgroundPicker.tsx` | 4 fetch calls updated: `background-assets` GET, POST, DELETE — all now include Bearer token from admin auth context |
| `BackgroundLibraryPicker.tsx` | 4 fetch calls updated: same background-assets routes — Bearer token added |
| `StoreLibraryContext.tsx` | 2 fetch calls updated: `stores/by-id/:id` and `stores/:id/channels` — Bearer token added |
| `BuilderContext.tsx` | 1 fetch call: `catalog/placements` changed from cookie auth to Bearer token |
| `CatalogBrowserModule.tsx` | 1 fetch call: `printify/catalog` changed from cookie auth to Bearer token |
| `ProductConfigSkin.tsx` | 1 fetch call: `products/:id/sync-printify` changed from cookie auth to Bearer token |
| `memberPacketService.ts` | Multiple member packet calls — auth headers added |
| `memberVideoService.ts` | Video upload call — auth headers added |

### 9.2 Route Path Fixes

| File | What Was Fixed |
|------|---------------|
| `StoreChannelDropdownModule.tsx:126` | Changed `stores/${storeId}` to `stores/by-id/${storeId}` — was hitting non-existent route |
| `StoreChannelDropdownModule.tsx:164` | Removed or fixed single-channel GET call — route didn't exist |

### 9.3 Pattern Fixes

| File | What Was Fixed |
|------|---------------|
| `StoreModule.tsx` | Store creation POST now uses admin auth (was public unauthenticated) |
| `ChannelModule.tsx` | Channel creation POST now uses admin auth |
| `StorePickerModule.tsx` | Store creation POST now uses admin auth |
| `ChannelPickerModule.tsx` | Channel creation POST now uses admin auth |
| `admin-store-builder.tsx` | Store DELETE now uses admin auth; `allowed-products` calls now use auth |

### 9.4 Cloud Function Parity

| Category | What Was Added |
|----------|---------------|
| Admin templates | Routes for templates CRUD added to CF or identified for addition |
| Admin graphic-sets | Routes identified as missing from CF |
| Library upload | Upload route identified as missing from CF |
| Queue status | Status route identified as missing from CF |

### 9.5 Frontend Consistency

| Fix Type | Count | Details |
|----------|-------|---------|
| Cookie → Bearer auth | 3 | BuilderContext, CatalogBrowser, ProductConfigSkin |
| No auth → Bearer auth | 20+ | CreateGraphicsModule, LibraryBackgroundPicker, BackgroundLibraryPicker, StoreLibraryContext, member services |
| Wrong route path | 2 | StoreChannelDropdownModule |
| Missing admin scope | 5 | StoreModule, ChannelModule, StorePickerModule, ChannelPickerModule, admin-store-builder DELETE |
| **Total fixes** | **35+** | |

---

## Appendix A: Route Count Verification

```
Dev server routes:    433 (+1 queue/retry-failed)
Cloud Function routes: 178 (+1 queue/retry-failed)
Routes in BOTH:       130
Dev-only routes:      303
CF-only routes:        48

Verification:
  Dev = BOTH + Dev-only = 130 + 303 = 433 ✓
  CF  = BOTH + CF-only  = 130 +  48 = 178 ✓
```

## Appendix B: Change Log

### February 16, 2026 — Session 2: Collection Names & Queue Retry

| Change | Details |
|--------|---------|
| **CF Firestore collection names — Standardized to snake_case** | Cloud Function was using camelCase collection names (`mockupCache`, `mockupJobs`, `printifyPrintfulMapping`) while the dev server uses snake_case (`mockup_cache`, `mockup_jobs`, `printify_printful_mapping`). Both now use snake_case. This was the root cause of mockup generation failures in production — the CF couldn't find cached mockups or mapping records created by the dev server. |
| **POST `/admin/queue/retry-failed` — Added to both codebases** | New endpoint that resets all failed mockup jobs back to "pending" status so they can be reprocessed. Added to both the dev server (`server/routes/misc.routes.ts`) and Cloud Function (`functions/src/index.ts`). Uses Firestore batch write to reset `status`, clear `error`, increment `retryCount`, and set `lastRetryAt`. |
| **Printify Blueprint 577 — Added to dev server auto-mapping** | Added explicit mapping for Printify blueprint 577 (Bella Canvas 3001C) → Printful product 71 in `server/lib/mockup-service.ts` `createAutoMapping()`. The Cloud Function already had this in `DEFAULT_BLUEPRINT_MAPPINGS`. Color mapping: Solid Black→Black, Solid White→White, Sport Grey→Athletic Heather. |
| **GET `/admin/queue/status` — Still dev-only** | The dev server has a GET endpoint for queue status monitoring. The Cloud Function does not have this endpoint yet. |
| **Cloud Function version bumped to 1.0.13** | `functions/package.json` updated from 1.0.12 to 1.0.13. |

### February 16, 2026 — Session 1: Auth Fixes & Background Assets

| Change | Details |
|--------|---------|
| **CF POST `/admin/background-assets` — Added source-to-background move** | When a cropped image is uploaded with `assetType: "cropped"` and a `sourceAssetId`, the Cloud Function now automatically changes the source asset's type from `"source"` to `"background"`. This was already in the dev server (`background-assets.routes.ts` lines 157-163) but was missing from the Cloud Function. Now synced. |
| **CF DELETE `/admin/background-assets/:id` — Confirmed working** | Soft-deletes by setting `isActive: false`. Already existed in CF but was not being triggered correctly from the frontend crop flow. |
| **PUT `/admin/background-assets/:id` — Still dev-only** | The dev server has a PUT endpoint for updating asset name/isActive. The Cloud Function does not have this endpoint yet. Low priority since it's not used in the current crop flow. |
| **Frontend `ImageUploader.tsx` — Fixed file reading** | Changed from blob URL approach (which failed after input clearing) to using `readFileAsBase64()` with 3-fallback method (arrayBuffer, FileReader, blob URL). Files are now read before clearing the input. |
| **Frontend `CropUtility.tsx` — Fixed image clipping** | Reduced image max-height from 70vh to 50vh, added `overflow-hidden` on dialog, `min-h-0` on scroll container, and `object-fit: contain` on images. |
| **Frontend `GridView.tsx` — Fixed thumbnail aspect ratio** | Changed grid thumbnails from forced `aspect-[9/16]` to `aspect-square` for natural thumbnail display. |
| **Frontend `SourceImagesTab.tsx` — Crop flow improvements** | Crop now saves as `assetType: "cropped"` (not "background") so the server's auto-move logic triggers. Original image is downloaded to user's device before the crop saves. Crop toggle enabled so users can choose free crop or 9:16. |

## Appendix C: Key Files Reference

| File | Purpose |
|------|---------|
| `client/src/lib/queryClient.ts` | Default TanStack Query fetcher with `getAuthHeader()` |
| `client/src/features/adminAuth/authFetch.ts` | `authFetch()` utility for admin Bearer auth |
| `client/src/features/shared/AdminAuthContext.tsx` | Admin auth context provider |
| `client/src/features/members/MemberAuthContext.tsx` | Member auth context provider |
| `functions/src/index.ts` | Cloud Function entry point |
| `server/routes/*.ts` | Dev server route files |
| `firebase.json` | Firebase Hosting rewrites config |
