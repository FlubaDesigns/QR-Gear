# QR Gear — Admin Routes

> Actual routes only — verified against `client/src/App.tsx`. Do not document routes that are not registered here.

Last verified: May 6, 2026

---

## Frontend Admin Routes (App.tsx)

### RUN

| Route | Component | Notes |
|-------|-----------|-------|
| `/admin` | `AdminRun` | Canonical Run dashboard |
| `/admin/run` | → redirect | Alias for `/admin` |
| `/admin/dashboard` | → redirect | Alias for `/admin` |

### BUILD

| Route | Component | Notes |
|-------|-----------|-------|
| `/admin/products` | `AdminProducts` | BUILD cockpit — product graphic builder |
| `/admin/blanks` | `AdminBlanks` | Blank catalog curation, QRG assignment |
| `/admin/library` | `LibraryPage` | Images, backgrounds (tab), templates, graphics, assemblies |
| `/admin/videos` | `AdminVideos` | Video content |
| `/admin/categories` | `AdminCategories` | Product categories |
| `/admin/tags` | `AdminTags` | Tags |
| `/admin/fonts` | `FontManagement` | Custom fonts |

### PLACE

| Route | Component | Notes |
|-------|-----------|-------|
| `/admin/store-planner` | `StorePlanner` | PLACE cockpit |
| `/admin/store-builder` | `AdminStoreBuilder` | Storefront configuration |
| `/admin/store-library` | `AdminStoreLibrary` | Browse stores and channels |
| `/admin/partners` | `AdminPartners` | Partner / referral management |
| `/admin/external-sites` | `AdminExternalSites` | Embedded product widgets |
| `/admin/marketplaces` | `AdminMarketplaces` | eBay, Etsy, Amazon integrations |
| `/admin/sales/build` | `StoreBuild` | Sales build flow |

### SELL

| Route | Component | Notes |
|-------|-----------|-------|
| `/admin/orders` | `AdminOrders` | Order management |
| `/admin/customers` | `AdminCustomers` | Registered members |
| `/admin/pricing` | `AdminPricing` | Pricing rules and margins |
| `/admin/orchestration` | `AdminOrchestration` | Bulk ops, analytics, routing |
| `/admin/gifts` | `AdminGifts` | Gift cards |
| `/admin/coupons` | `AdminCoupons` | Coupons |

### SYSTEM

| Route | Component | Notes |
|-------|-----------|-------|
| `/admin/settings` | `AdminSettings` | Platform settings |
| `/admin/health` | `AdminHealth` | System health |
| `/admin/email-templates` | `AdminEmailTemplates` | Email configuration |
| `/admin/email-health` | `AdminEmailHealth` | Email delivery monitoring |
| `/admin/manual` | `AdminManual` | Admin manual |

---

## Routes NOT in App.tsx (do not document as active)

| Route | Status | Where it actually lives |
|-------|--------|------------------------|
| `/admin/dynamics` | NOT REGISTERED | Public page at `/qr-dynamics` |
| `/admin/backgrounds` | NOT REGISTERED | Tab inside `/admin/library` → BackgroundsTab |

---

## Backend Route Modules

### Production (Firebase Cloud Functions — `functions/src/routes/`)

| Module file | Domain |
|-------------|--------|
| `admin-build-sessions.ts` | Build sessions CRUD, autosave, commit |
| `bld.ts` | BLD CRUD |
| `assemblies.ts` | Assembly CRUD |
| `admin-products.ts` | Admin product management |
| `admin-catalog-instances.ts` | Committed product instances |
| `admin-dashboard.ts` | Dashboard metrics |
| `admin-misc.ts` | Miscellaneous admin ops |
| `admin-orders.ts` | Order management |
| `admin-settings.ts` | Platform settings |
| `admin-stores.ts` | Store management |
| `am-crud.ts` | Asset manager CRUD |
| `am-sync.ts` | Asset manager sync |
| `am-utility.ts` | Asset manager utilities |
| `catalog.ts` | Catalog operations |
| `categories.ts` | Category management |
| `checkout.ts` | Checkout flow |
| `claims.ts` | Claim codes |
| `connect.ts` | OAuth connection management |
| `core-routes.ts` | Core platform routes |
| `core-routes-checkout.ts` | Core checkout routes |
| `designs.ts` | Design management |
| `dynamics.ts` | QR dynamics content |
| `external-sites.ts` | External site management (admin) |
| `external-sites-public.ts` | External site widgets (public) |
| `file-routes.ts` | File serving |
| `gifts.ts` | Gift management |
| `images.ts` | Image management |
| `marketplace.ts` | Marketplace operations |
| `master-catalog.ts` | Master blank catalog sync |
| `member-catalog-instances.ts` | Member catalog instances |
| `member-files.ts` | Member file management |
| `members.ts` | Member accounts |
| `members-library.ts` | Member library |
| `mockup-routes.ts` | Mockup generation |
| `orchestration.ts` | Orchestration engine |
| `packets.ts` | Packet management |
| `partner.ts` | Partner/referral |
| `pp-builder.ts` | Print provider builder |
| `pp-catalog.ts` | Print provider catalog |
| `pp-catalog-browse.ts` | Catalog browse + master-catalog endpoint |
| `pp-pricing-packets.ts` | Print provider pricing |
| `print-placements.ts` | Print placement data |
| `products-page.ts` | Products page rendering |
| `public.ts` | Public-facing routes |
| `public-stores.ts` | Public store routes |
| `referral.ts` | Referral system |
| `seo.ts` | SEO routes |
| `store-files.ts` | Store file serving |
| `stripe-webhooks.ts` | Stripe payment webhooks |
| `tiers.ts` | Tier management |
| `widget.ts` | Widget routes |
| `amazon-oauth.ts` / `ebay-oauth.ts` / `etsy-oauth.ts` | Marketplace OAuth |
| `auth.ts` | Authentication |
| `brain.ts` | Brain/AI operations |

### Dev Server Only (`server/routes/` — not production)

Dev server mirrors the production functions routes for local development. Any route added to `functions/src/routes/` must also be added to the matching file in `server/routes/`. Changes to `server/` only do NOT affect production.
