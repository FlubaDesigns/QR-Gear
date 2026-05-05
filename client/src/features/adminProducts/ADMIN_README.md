# QR Gear — Admin Section Guide

Last updated: May 5, 2026 (rev 34)

---

## Table of Contents

1. [Platform Overview](#platform-overview)
2. [Admin Dashboard](#admin-dashboard)
3. [Product Builder](#product-builder)
4. [QR Code System](#qr-code-system)
5. [Image Library](#image-library)
6. [Store Builder](#store-builder)
7. [Orchestration & Pricing](#orchestration--pricing)
8. [Email System (NexusMail)](#email-system-nexusmail)
9. [External Sites & Embeds](#external-sites--embeds)
10. [Member Management](#member-management)
11. [Orders & Fulfillment](#orders--fulfillment)
12. [File & Folder Structure](#file--folder-structure)
13. [Storage & Database](#storage--database)
14. [Deploy Commands](#deploy-commands)
15. [Rebuild From This Zip](#rebuild-from-this-zip)
16. [Recent Changes Log](#recent-changes-log)
17. [Known Issues & Next Steps](#known-issues--next-steps)

---

## Platform Overview

QR Gear is a Firebase-hosted e-commerce platform for creating and selling QR-code-integrated apparel and products. The admin panel controls product creation, image management, store configuration, pricing, fulfillment routing, and member management.

**Live site:** https://qrgear-c1ffd.web.app

**Architecture:**
- **Frontend:** React + Vite + TypeScript (client/)
- **Backend API:** Firebase Cloud Functions (functions/)
- **Database:** Firestore (NoSQL)
- **Storage:** Firebase Storage (images, media)
- **Payments:** Stripe
- **Print fulfillment:** Printify, Printful, Apliiq
- **Email:** Resend (via NexusMail)

---

## Admin Dashboard

**Route:** `/admin` → **Run** dashboard

The admin panel is organized into five top-level sections. `/admin` lands on the **Run** dashboard — your operating cockpit with quick actions, in-progress drafts, and section links.

| Section | Route | Purpose |
|---------|-------|---------|
| **Run** | `/admin` | Dashboard — quick actions, in-progress drafts, section navigation |
| **Build** | `/admin/products` | Product builder, templates, library, blanks, dynamics |
| **Place** | `/admin/store-builder` | Store builder, store library, partners, marketplaces |
| **Sell** | `/admin/orders` | Orders, customers, pricing, coupons, gifts |
| **System** | `/admin/settings` | Settings, health, email, manual |

### Build section routes

| Route | Purpose |
|-------|---------|
| `/admin/products` | Create/edit product graphics and manage catalog |
| `/admin/library` | Manage uploaded images, backgrounds, templates |
| `/admin/dynamics` | Configure QR dynamic content |
| `/admin/categories` | Organize products into categories |
| `/admin/backgrounds` | Background image management |
| `/admin/fonts` | Custom font management |
| `/admin/videos` | Video content management |

### Place section routes

| Route | Purpose |
|-------|---------|
| `/admin/store-builder` | Configure storefronts and assign products |
| `/admin/store-library` | Browse existing stores and channels |
| `/admin/partners` | Partner/referral management |
| `/admin/external-sites` | Manage embedded product widgets |

### Sell section routes

| Route | Purpose |
|-------|---------|
| `/admin/orders` | View and manage customer orders |
| `/admin/customers` | View registered members |
| `/admin/pricing` | Set pricing rules and margins |
| `/admin/gifts` | Gift card and gift flow management |
| `/admin/orchestration` | Bulk operations, analytics, routing |

### System section routes

| Route | Purpose |
|-------|---------|
| `/admin/settings` | Platform-wide settings |
| `/admin/health` | System health monitoring |
| `/admin/email-templates` | Configure automated emails |

---

## Product Builder

**Route:** `/admin/products` → click a product → Builder opens
**Key files:**
- `client/src/features/adminProducts/builder/BuilderContext.tsx` — State management for the builder
- `client/src/features/adminProducts/builder/BuilderHarness.tsx` — Main builder container
- `client/src/features/adminProducts/builder/modules/` — All builder modules

### Save Draft

When a build session is active a **Save Draft** button (bookmark icon) appears in the sticky bar at the top of the builder. Click it, type a name, press Save or Enter. The name is stored against the session in Firestore (`draftName` field on `admin_build_sessions`).

Named drafts appear on the **Run** dashboard (`/admin`) under **In Progress**, showing draft name, product title, and time since last activity. Clicking **Resume** navigates to `/admin/products?resume=<sessionId>`. The builder detects that URL param on load, fetches the session and its linked packet, resolves the catalog product, and restores the full builder state via `loadFromPacketData`.

**Key files:**
- `client/src/features/adminProducts/builder/modules/BuilderStickyBar.tsx` — Save Draft button + inline name input
- `client/src/features/adminProducts/builder/modules/DraftResumeHandler.tsx` — URL param detection + state restore
- `client/src/pages/admin-run.tsx` — In Progress section on the Run dashboard
- `server/routes/admin-build-sessions.routes.ts` — PATCH now accepts `draftName` at top level
- `server/routes/packets.routes.ts` — `GET /api/admin/packets/:packetId` (new admin single-packet endpoint)

### How It Works

1. **Basics** (`BasicsContentModule.tsx`) — Set product name, description, category
2. **Compose** (`ComposeContentModule.tsx`) — Choose background, images, text zones
3. **Text** (`ProductGraphicTextModule.tsx`) — Configure header/footer text, fonts, colors, images
4. **QR Code** — Size slider (40–85%), position slider, preset buttons (S/M/L/XL)
5. **Placement** (`PlacementModule.tsx`) — Choose print areas on the blank product
6. **Products** (`ProductsModule.tsx`) — Select which blank products to apply the design to
7. **State** (`StateModule.tsx`) — Manage product lifecycle (draft → active → archived)
8. **Play** (`PlayContentModule.tsx`) — Preview the product graphic

### Product Graphic Renderer

**File:** `client/src/features/shared/graphics/productGraphicRenderer.ts`

This is the core engine that draws the product graphic on a canvas. It uses a content-aware zone layout:

- **Canvas size:** 1200 x 1800 pixels
- **Header zone:** Active when top text/image is enabled. Currently ~20% of canvas height
- **Footer zone:** Active when bottom text/image is enabled. Currently ~16% of canvas height
- **Middle zone:** Gets all remaining space — this is where the QR code goes
- **Sub-bottom zone:** Active when sub-bottom text is enabled
- Inactive zones collapse to 0 height, giving more space to the QR code

### QR Size Controls

- **Slider range:** 40–85 (step 2)
- **Preset buttons:** S (48), M (56), L (64), XL (72)
- **Semantic labels:** "Tiny" / "Small" / "Medium" / "Large" / "X-Large" / "Huge"
- **Default size:** 42%
- **Reset button:** Returns to qrSizePercent=42, qrPositionY=0

The QR size percentage is applied as `min(regionWidth, regionHeight) * percent / 100` inside the middle zone.

---

## QR Code System

QR Gear's core feature is embedding QR codes into product graphics.

### QR Dynamics

**Route:** `/admin/dynamics`
**Spec:** `docs/QR_DYNAMICS_SPEC.md`

Each QR code can link to dynamic content that changes after the product is printed:
- Videos
- URLs
- Images
- Text messages
- Contact cards

The QR dynamics resolver (`shared/qrDynamicsResolver.ts`) determines what content to show when a QR code is scanned.

### QR Safety

**File:** `client/src/features/adminProducts/shared/qrSafety.ts`

A safety meter in the builder warns when QR codes might not scan well:
- Too small
- Low contrast against background
- Overlapping with text or images

---

## Image Library

**Route:** `/admin/library`
**Key files:**
- `client/src/features/adminLibrary/LibraryPage.tsx` — Main library page
- `client/src/features/adminLibrary/tabs/ImagesTab.tsx` — Image management tab
- `client/src/features/adminLibrary/tabs/BackgroundsTab.tsx` — Background images
- `client/src/features/adminLibrary/tabs/TemplatesTab.tsx` — Saved templates

### Folder System

Images are organized into folders. Folders are persisted in Firestore under the `admin_image_folders` collection.

**How folders work:**
1. Create a folder via the "New Folder" button
2. Server validates: max 80 characters, case-insensitive duplicate detection
3. Folder is saved with a `normalizedName` field for duplicate checking
4. On success, the client refetches the canonical folder list from the server
5. On failure, an inline error message appears (no more silent failures)

**Folder API:**
- `GET /admin/images/folders` — Returns merged list from collection + image folder fields
- `POST /admin/images/folders` — Creates a new folder with validation

**Storage paths:** `library/images/{folderName}/{timestamp}-{safeName}.{ext}`

---

## Store Builder

**Route:** `/admin/store-builder`
**Key files:**
- `client/src/features/adminProducts/storeBuilder/StoreBuilderHarness.tsx` — Container
- `client/src/features/adminProducts/storeBuilder/StoreBuilderContext.tsx` — State
- `client/src/features/adminProducts/storeBuilder/modules/` — Builder modules

### How It Works

1. **Store Picker** — Select or create a storefront
2. **Channel Picker** — Choose sales channels (web, marketplace, external site)
3. **Catalog Browser** — Browse available products to add
4. **Product Configure** — Set pricing, variants, availability per product
5. **Assignment** — Assign products to specific positions/categories in the store

---

## Orchestration & Pricing

**Route:** `/admin/orchestration`
**Tabs:**
- **Analytics** — Sales and performance metrics
- **Bulk Publish** — Publish multiple products at once
- **Bundles** — Product bundle management
- **Health** — System health checks
- **Profit** — Margin and profit calculations
- **Repricing** — Automated price adjustments
- **Routing** — Fulfillment provider routing rules

**Pricing files:**
- `server/services/auto-repricer.ts` — Automated repricing engine
- `server/services/profit-calculator.ts` — Margin calculations
- `functions/src/services/pricing.ts` — Cloud function pricing logic

---

## Email System (NexusMail)

**Files:**
- `shared/nexusmail/` — Shared types and contracts
- `functions/src/nexusmail/` — Cloud function implementation

NexusMail handles automated emails:
- Order confirmations
- Shipping notifications
- Claim code delivery
- Welcome emails

Uses Resend as the email provider with QR Gear branding templates.

---

## External Sites & Embeds

**Route:** `/admin/external-sites`
**Key files:**
- `functions/src/routes/external-sites.ts` — API routes
- `functions/src/services/embed-validation.ts` — Security validation

External sites can embed QR Gear product widgets on their pages. The system validates embed contexts and manages trust boundaries for cross-origin content.

---

## Member Management

**Route:** `/admin/customers`

Members are users who have registered accounts. They can:
- Create custom products via the member builder
- Manage their QR dynamic content
- Build their own storefronts
- Upload media (images, videos)

### Description Cascade

Product descriptions follow a priority cascade:
```
memberPacketDescription ?? adminCatalogDescription ?? providerDescription
```

Members can override descriptions via `PATCH /members/:memberId/packets/:packetId/description`

---

## Orders & Fulfillment

**Route:** `/admin/orders`
**Key files:**
- `functions/src/services/order-service.ts` — Order processing
- `functions/src/routes/checkout.ts` — Checkout flow
- `server/routes/cart-checkout.routes.ts` — Cart management

Orders flow through:
1. Cart → Checkout (Stripe) → Order created in Firestore
2. Fulfillment routed to appropriate print provider (Printify/Printful/Apliiq)
3. Tracking info updated when available
4. Order status webhooks from Stripe

---

## File & Folder Structure

```
project/
├── client/                          # React frontend
│   ├── index.html                   # Entry HTML (favicon refs here)
│   ├── public/                      # Static assets
│   │   ├── favicon.ico              # Multi-size favicon
│   │   ├── favicon.png              # PNG favicon
│   │   ├── apple-touch-icon.png     # iOS home screen icon (180x180)
│   │   ├── logo.svg                 # Full logo
│   │   ├── logo-dark.svg            # Dark mode logo
│   │   ├── og-image.png             # Social sharing image
│   │   └── sitemap.xml              # SEO sitemap
│   └── src/
│       ├── App.tsx                   # Route definitions
│       ├── main.tsx                  # React entry point
│       ├── features/                # Feature modules
│       │   ├── adminProducts/       # Admin product builder
│       │   │   ├── builder/         # Product graphic builder
│       │   │   ├── storeBuilder/    # Store builder
│       │   │   ├── storeLibrary/    # Store library browser
│       │   │   └── modules/         # Shared admin modules
│       │   ├── adminLibrary/        # Image & asset library
│       │   ├── shared/              # Cross-feature shared code
│       │   │   ├── graphics/        # Canvas renderers
│       │   │   ├── components/      # Shared components
│       │   │   └── constants/       # Zone layout, placement types
│       │   ├── members/             # Member-facing features
│       │   ├── owner/               # Owner/member wizard
│       │   ├── sites/               # External site widgets
│       │   ├── store/               # Store display
│       │   └── storeBuilder/        # Member store builder
│       ├── components/              # Global components
│       │   └── ui/                  # Shadcn UI primitives
│       ├── lib/                     # Utilities and services
│       ├── pages/                   # Route page components
│       └── hooks/                   # React hooks
├── functions/                       # Firebase Cloud Functions
│   ├── src/
│   │   ├── index.ts                 # Function entry (_BUILD_ID here)
│   │   ├── routes/                  # API route handlers
│   │   ├── services/                # Business logic
│   │   ├── nexus/                   # Orchestration engine
│   │   └── nexusmail/               # Email service
│   └── package.json                 # Functions dependencies (version here)
├── server/                          # Express backend (dev server)
│   ├── index.ts                     # Server entry
│   ├── routes/                      # API routes
│   ├── routes.ts                    # Route registration
│   ├── lib/                         # Server utilities
│   ├── services/                    # Backend services
│   ├── storage/                     # Data access layer
│   └── storage.ts                   # Storage interface
├── shared/                          # Code shared across all layers
│   ├── schema.ts                    # Main DB schema
│   ├── schema-*.ts                  # Domain-specific schemas
│   ├── domainModel.ts               # Domain logic
│   ├── constants.ts                 # Shared constants
│   ├── nexus/                       # Orchestration types
│   └── nexusmail/                   # Email types
├── docs/                            # Specifications and documentation
├── migrations/                      # Database migrations
├── scripts/                         # Utility scripts
├── firebase.json                    # Firebase config
├── firestore.rules                  # Firestore security rules
└── package.json                     # Root dependencies
```

---

## Storage & Database

### Firestore Collections

| Collection | Purpose |
|------------|---------|
| `admin_products` | Product definitions and graphics |
| `admin_images` | Image metadata (name, folder, storageUrl) |
| `admin_image_folders` | Persisted folder names with normalizedName |
| `admin_stores` | Store configurations |
| `members` | Member accounts |
| `member_packets` | Member product customizations |
| `orders` | Customer orders |
| `dynamics` | QR dynamic content entries |
| `claims` | Claim codes for products |
| `gifts` | Gift configurations |
| `categories` | Product categories |
| `admin_settings` | Platform settings |
| `admin_build_sessions` | In-progress builder sessions (status, working state, draftName, linked packetId) |
| `admin_catalog_instances` | Committed product instances — one per Build→Save cycle. Fields: storeId, channelId, collectionName, currentPacketId, enabledColors[], enabledSizes[], resolved (title, images[], colors[], sizes[], pricing.customerPrice), createdAt |
| `stores` | Top-level store documents (storeId = doc ID, e.g. `qr-gear`) |
| `storeChannels` | Channel documents (channelId = doc ID, e.g. `usa250`). Fields: storeId, name. Used by the public store route to map channel URL slug → store |

### Firebase Storage Paths

| Path | Content |
|------|---------|
| `library/images/{folder}/{file}` | Admin uploaded images |
| `library/backgrounds/raw/` | Raw background images |
| `library/backgrounds/cropped/` | Cropped backgrounds |
| `library/member/{userId}/` | Member uploaded media |
| `mockups/` | Generated product mockups |

---

## Deploy Commands

### Frontend (Hosting)

```bash
npm run build && \
echo "$FIREBASE_SERVICE_ACCOUNT_KEY" > /tmp/firebase-sa.json && \
export GOOGLE_APPLICATION_CREDENTIALS=/tmp/firebase-sa.json && \
firebase deploy --only hosting --project qrgear-c1ffd && \
rm /tmp/firebase-sa.json
```

### Backend (Cloud Functions)

Before deploying functions, you MUST:
1. Bump `_BUILD_ID` in `functions/src/index.ts`
2. Bump `version` in `functions/package.json`

```bash
echo "$FIREBASE_SERVICE_ACCOUNT_KEY" > /tmp/firebase-sa.json && \
export GOOGLE_APPLICATION_CREDENTIALS=/tmp/firebase-sa.json && \
timeout 100 firebase deploy --only functions --project qrgear-c1ffd && \
rm /tmp/firebase-sa.json
```

### Full Deploy (Both)

```bash
npm run build && \
echo "$FIREBASE_SERVICE_ACCOUNT_KEY" > /tmp/firebase-sa.json && \
export GOOGLE_APPLICATION_CREDENTIALS=/tmp/firebase-sa.json && \
firebase deploy --project qrgear-c1ffd && \
rm /tmp/firebase-sa.json
```

---

## Rebuild From This Zip

1. Extract `QR_Gear_Full_Website.zip`
2. Run `npm install` in the root directory
3. Run `cd functions && npm install`
4. Set up Firebase:
   - Create a Firebase project or use existing `qrgear-c1ffd`
   - Download service account key JSON
   - Set as `FIREBASE_SERVICE_ACCOUNT_KEY` environment variable
5. Set up Stripe:
   - Set `STRIPE_SECRET_KEY` environment variable
   - Configure webhook endpoint for `/api/stripe-webhooks`
6. Set up Resend (for email):
   - Set `RESEND_API_KEY` environment variable
7. Configure `functions/.env` with all required keys
8. Build and deploy:
   ```bash
   npm run build
   firebase deploy --project qrgear-c1ffd
   ```
9. Upload library images through the admin UI at `/admin/library`

### Required Environment Variables

| Variable | Purpose |
|----------|---------|
| `FIREBASE_SERVICE_ACCOUNT_KEY` | Firebase admin credentials (JSON) |
| `STRIPE_SECRET_KEY` | Stripe payment processing |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook validation |
| `RESEND_API_KEY` | Email sending via Resend |
| `VITE_FIREBASE_*` | Frontend Firebase config (apiKey, authDomain, etc.) |

---

## Recent Changes Log

### May 5, 2026 — QRG Identity Enforcement on Catalog Writes (rev 35)

Enforced `qrg_STNNN` as the sole canonical key for all catalog blank identity. Provider IDs (`py_`, `pf_`, `pf:`, plain numeric) are now accepted as input but resolved to canonical keys before any Firestore write. The "QRG Blank ID System" section updated to reflect STNNN format.

**Backend (`server/routes/admin-catalogs-shelf.routes.ts`):**
- Added `resolveCatalogBlankId()` — single resolution path accepting any provider key, returning canonical `qrg_STNNN` or null (pending), throwing on unresolvable IDs
- `POST /catalogs/:id/blanks` — resolves each input blankId before persisting; pending IDs skipped (not stored)
- `DELETE /catalogs/:id/blanks` — cleans all nine overlay maps (`blankIds`, `blankTiers`, `blankDescriptions`, `blankTitles`, `blankMakers`, `blankModels`, `blankProviders`, `blankImages`, `blankPrimaryImages`); removes both raw and resolved keys for backward compat with legacy stored IDs
- `POST /catalogs/:id/bulk-copy` — resolves each blankId before persisting
- `PUT /catalogs/:id/blank-tier`, `blank-description`, `blank-title`, `blank-images` — all resolve blankId to canonical key before writing overlay maps
- `POST /catalogs/:id/duplicate` — copies all nine overlay maps (was: only five)
- `POST /catalogs` (create) — initializes all nine overlay maps to `{}` (was: only five)

**Frontend (`useAdminBlanksController.ts`):**
- `onAddToCatalog` — sends `product.docId` (qrg_STNNN) when available, instead of falling through to `resolveBlankKey` which could return a provider key
- `addBlanksMutation.onSuccess` toast — fixed `data.count` → `data.total` (field that actually exists on the response)

**Tests (`shared/__tests__/blankKeys.test.ts`):**
- Added `getCanonicalBlankKey` cases proving `docId=qrg_STNNN` takes priority over provider key fallback
- Added `isQRGBlankId` suite: valid STNNN cases return true; legacy 4-digit (`qrg_1101`), 3-digit (`qrg_101`), provider keys, and empty string all return false
- Added `isValidQRGBlankNumber` and `isPendingBlankId` suites

**Documentation:**
- `ADMIN_README.md` "QRG Blank ID System" section rewritten: current `qrg_STNNN` format documented, stale 4-digit and 3-digit references removed, provider IDs described as lookup/reference only

---

### May 5, 2026 — Three-Schema Integrity Audit + Control System Audit (rev 34)

Full end-to-end audit of the QRG → BLD → GRF → Assembly → Packet chain, followed by a full audit of the control system documents (REPLIT.md, README.md, SKILLS.md, NAMING_STANDARDS.md, BLD.md, GRF.md, ASSEMBLY.md, QRG.md). 18 code findings fixed and 6 documentation findings corrected.

**Code fixes (functions/src/):**
- QRG blank ID validation consolidated into shared `isValidQrgBlankId()` utility across all entry points
- Legacy `qrgPacketCode` fallback now logs a `[LEGACY_FIELD]` warning instead of silently resolving
- Assembly POST validates `qrgId` format before writing
- BLD create blocks U-context + Z/P layout cross-contamination
- BLD POST enforces required `qrgBlankId`
- BLD DELETE cascades to sub-collection instances and blocks deletion if any Assembly references the BLD
- GRF existence + active status validated against `grf_assets` before Assembly writes
- GRF type/slot compatibility enforced (qrc → type 04, img → type 02/03/05)
- BLD slot cross-validation added to Assembly POST
- Auto-created Assembly mappings carry `grfIdPending: true` flag; validator allows pending slots
- Assembly DELETE cleans `assemblyId` from all linked Packet documents
- Assembly PATCH blocks `qrgId`/`bldId` changes when live Packets are linked (returns 409)
- Packet `assemblyId` sync made atomic via Firestore transaction (was two sequential writes)
- Packet PATCH blocks publish (`status: published`) when `assemblyId` is missing
- GRF save-grf route checks for pre-existing document before writing (counter integrity guard)
- `functions/src/services/qrgVariantMappings.ts` deleted — server-side duplicate of `shared/qrgVariantMappings.ts`. Both importers redirected to the shared canonical version.

**Documentation fixes:**
- QRG.md: restored correct `shared/` paths for `providerQrgMapper.ts` and `qrgVariantMappings.ts`; added drift-risk warning on the (now-deleted) server-side duplicate
- BLD.md: fixed malformed example ID `BLD-SZ8002` → `BLD-SZ8-002`
- ASSEMBLY.md: added PATCH and DELETE to the API section with immutability and cleanup rules
- SKILLS.md: added GRF.md, ASSEMBLY.md, QRG.md, NAMING_STANDARDS.md to the Skill 7 zip export include list

#### Files Changed

| File | Change |
|------|--------|
| `functions/src/routes/admin-build-sessions.ts` | Shared QRG validation utility wired |
| `functions/src/services/qrg-resolver.ts` | Legacy field warning log added |
| `functions/src/routes/assemblies.ts` | Fixes 3, 8, 9, 10, 11, 12, 14 |
| `functions/src/routes/bld.ts` | Fixes 4, 5, 6, 7 |
| `functions/src/services/bld-builder.ts` | grfIdPending flag on auto-created mappings |
| `functions/src/routes/pp-pricing-packets.ts` | Atomic packetIds sync + publish guard |
| `functions/src/routes/file-routes.ts` | GRF counter integrity existence check |
| `functions/src/services/master-catalog.ts` | Import redirected to shared/qrgVariantMappings |
| `functions/src/routes/master-catalog.ts` | Import redirected to shared/qrgVariantMappings |
| `functions/src/services/qrgVariantMappings.ts` | **Deleted** — consolidated into shared/ |
| `QRG.md` | Source file table corrected + drift warning |
| `BLD.md` | Example ID typo fixed |
| `ASSEMBLY.md` | PATCH + DELETE API entries added |
| `SKILLS.md` | Authority files added to zip export list |

### May 4, 2026 — master_catalog as Single Source of Truth for Print Placements (rev 33)

The builder no longer calls live carrier APIs (Printify / Printful) to fetch print placements at selection time. Instead, placements are stored directly on each `master_catalog` document as `printifyPlacements` and `printfulPlacements` arrays. The `/public/catalog/placements` API checks `master_catalog` first and only falls back to live APIs if placements have not yet been backfilled. Three new top-level queryable fields (`printifyBlueprintId`, `printifyPrintProviderId`, `printfulProductId`) were added to every sync write path so Firestore queries can locate docs by carrier ID without scanning the nested `providerMappings` array. A "Backfill Placements" button was added to the admin Sync panel; it calls `POST /api/admin/master-catalog/backfill-placements` which iterates all 1,749 `master_catalog` docs, fetches variant placeholders from Printify and printfiles from Printful, and stores the results. A focused Node.js backfill script (`scripts/backfill-qrg.cjs`) handles the 1,071 `qrg_*` docs in production with batch=3 concurrency and exponential back-off on Printful 429s.

#### New Firestore Fields on `master_catalog`

| Field | Type | Set By |
|---|---|---|
| `printifyBlueprintId` | number | sync + backfill endpoint |
| `printifyPrintProviderId` | number | sync + backfill endpoint |
| `printfulProductId` | number | sync + backfill endpoint |
| `printifyPlacements` | `{position, label, width, height}[]` | backfill endpoint / script |
| `printfulPlacements` | `{position, label, width, height}[]` | backfill endpoint / script |
| `lastPlacementSyncAt` | timestamp | backfill endpoint / script |

#### Files Changed

| File | Change |
|---|---|
| `functions/src/services/master-catalog.ts` | Both sync write paths (Printify+Printful match, Printful-only) now write `printifyBlueprintId`, `printifyPrintProviderId`, `printfulProductId` as top-level fields |
| `functions/src/routes/master-catalog.ts` | Added `POST /admin/master-catalog/backfill-placements` endpoint; added imports for `printifyClient`, `printfulClient`, `isEmbroideryPlacement` |
| `functions/src/routes/pp-catalog-browse.ts` | `GET /public/catalog/placements` now queries `master_catalog` first by `printifyBlueprintId` or `printfulProductId`; falls back to live API only when placements not stored |
| `client/src/features/adminProducts/builder/types.ts` | Added `CarrierPlacement`, `CarrierSubData` types; added `printify` / `printful` carrier sub-object fields to `CatalogProduct` |
| `client/src/features/adminProducts/builder/BuilderContext.tsx` | `selectProduct` now resolves placements from stored carrier sub-objects, normalizes `CarrierPlacement[]`, skips live API call when placements already stored |
| `client/src/features/adminProducts/modules/SyncModule.tsx` | Added "Backfill Placements" button — calls `POST /api/admin/master-catalog/backfill-placements` |
| `scripts/backfill-placements.cjs` | Full backfill script (all 1,749 docs); timed out at 604 on Printful 429s — use `backfill-qrg.cjs` for targeted runs |
| `scripts/backfill-qrg.cjs` | Focused backfill for `qrg_*` docs (1,071 docs); batch=3, 350ms Printify delay, 400ms Printful delay, exponential retry on 429, silently skips Printful 400s |

#### Architecture Note

The previous flow called `GET /public/catalog/placements?blueprintId=X&printProviderId=Y` (Printify) or `GET /public/catalog/placements?printfulProductId=Z` (Printful) at product-select time in the builder, hitting live carrier APIs on every selection. The new flow stores placements once at sync/backfill time and serves them from Firestore — zero carrier API calls for placement data during normal builder use.

---

### April 25, 2026 — Storefront UX & Product Page Messaging Overhaul (rev 29)

Rebuilt the public-facing product page messaging to position QR Gear products as digital experiences, not apparel. Also fixed navigation, breadcrumbs, and empty collection display across the storefront.

#### Files Changed
| File | Change |
|------|--------|
| `client/src/pages/shop-product.tsx` | Restructured right column: added "Scan it. It opens something real." hook, "What You're Holding" section, conditional "Where it takes you" snapshot panel, moved description to physical layer, replaced benefit bullets, updated CTA context line to "You're buying access, not just fabric.", removed "Sold by" line. Color selector now always renders as a dropdown. Added `landingPageSnapshotUrl` to `StoreProduct` interface. |
| `client/src/components/Navbar.tsx` | "Shop" nav link now goes to `/shop/internal/qrgear` (QR Gear store) instead of `/gallery` (admin panel). |
| `client/src/components/BreadcrumbTrail.tsx` | Added proper labels for `qrgear`, `usa250`, `monuments`, `armed-forces`, `founding-fathers` — prevents raw slug capitalization artifacts like "Usa250". |
| `client/src/features/storefront/ChannelHubView.tsx` | Collections with zero products are now hidden from the channel hub grid. Empty-state card shown only when no collections have products. |

### April 25, 2026 — URL Landing Text Block Change Detection Fix (rev 28)

Added `landingTextBlocks` to the baseline snapshot and change-detection logic in `BuilderContext.tsx`. Previously, adding, editing, moving, or deleting URL landing text blocks did not trigger dirty-state, which could silently suppress autosave, template save confidence, and reload expectations.

**What changed:**
- Added `normalizeLandingTextBlocks()` module-level helper that maps every `TextStyleConfig` field (`text`, `enabled`, `fontFamily`, `fontSize`, `fontWeight`, `color`, `warpPreset`, `letterSpacing`, `strokeColor`, `strokeWidth`, `verticalOffset`, `horizontalOffset`, `mode`, `imageUrl`, `imageScale`) to stable normalized values so `undefined`/`null`/empty don't cause false positives.
- `buildBaselineSnapshot()` now includes `landingTextBlocks: normalizeLandingTextBlocks(content.landingTextBlocks)` in the serialized baseline JSON.
- `hasChangesFromBaseline()` now includes the same normalized blocks in the current-state JSON for comparison.
- Existing packets with no `landingTextBlocks` field load safely as `[]` — no false positives on old data.

#### Files Changed
| File | Change |
|------|--------|
| `client/src/features/adminProducts/builder/BuilderContext.tsx` | Added `normalizeLandingTextBlocks`, added key to `buildBaselineSnapshot` and `hasChangesFromBaseline` |

---

### April 25, 2026 — Member Mockup Write-Back + Frontend Storefront Gallery (rev 27)

Completed the storefront gallery fix. The CF member mockup priority endpoint now accepts an optional `packetId` and writes the generated mockup URL back to the packet in Firestore (tries `productPackets` first, falls back to `memberPackets`). The admin builder's `useCreatePacket` write-back to `storeProductLinks` (so the storefront gallery can dynamically append the digital markup at the end of catalog images) was deployed to Firebase Hosting. Both changes were in `server/` routes (dead code in production) and have now been ported to the live Cloud Functions layer.

#### Files Changed
| File | Change |
|------|--------|
| `functions/src/routes/members-library.ts` | `/members/mockup/priority` now accepts `packetId` and writes mockup URL back to Firestore packet after generation |
| `client/src/features/adminProducts/builder/modules/useCreatePacket.ts` | Deployed to hosting — storeProductLink write-back after priority mockup generates |

---

### April 25, 2026 — Delete Button for Resume List (rev 26)

Added a working DELETE route so the trash icon on each saved build session card in the "Resume a Saved Build" modal actually removes the session from Firestore. Previously the button was rendered in the UI but silently failed with a 404 because the backend route was missing.

#### Files Changed
| File | Change |
|------|--------|
| `functions/src/routes/admin-build-sessions.ts` | Added `DELETE /admin/build-sessions/:id` route — permanently removes the session document from Firestore |

---

### April 23, 2026 — Pre-Launch Checklist Page (rev 25)

Added a dedicated `/admin/launch` page that gives a GO / NO-GO readiness verdict before accepting real orders. The page combines live environment-variable checks (pulled from the existing `/api/admin/dashboard/setup` endpoint) with a static list of code-level advisories that env checks alone cannot catch.

#### Files Changed
| File | Change |
|------|--------|
| `client/src/pages/admin-launch.tsx` | New page — pre-launch checklist with expandable items, Firebase config snippet, GO/NO-GO banner |
| `client/src/App.tsx` | Registered route `/admin/launch` → `AdminLaunch` |
| `client/src/pages/admin.tsx` | Replaced "System" quick action with "Pre-Launch" (Zap icon, `/admin/launch`) |

**Hard Blockers surfaced:** Missing Stripe live key, missing Resend key, missing webhook secret, ADMIN_BYPASS flag check, unregistered Stripe webhook endpoint reminder, Firebase Functions deploy reminder.

**Risk Items surfaced:** Test-mode Stripe key, partial marketplace credentials, hardcoded admin UIDs on client, no cart-level inventory check, semi-manual Printify order submission.

---

### April 23, 2026 — Core Product System Unification: Shared Layer (rev 24)

Unified the product data contract, color resolution, and storefront option-building across all three wizard tiers (SuperSimple / Simple / Advanced), admin, storefront, and marketplace into a single shared engine. The wizard UIs remain distinct; only the underlying contract and pipeline are unified.

**New shared modules:**
- `shared/colorUtils.ts` — canonical `COLOR_HEX_MAP` merging all frontend and backend color definitions (previously 3 separate maps). Exports `getColorHexByName`, `getColorHex`, `resolveColorHex`.
- `shared/storefrontTypes.ts` — canonical `StoreProduct`, `ProductOption` types plus `buildStructuredOptions` and `deriveCardMode` helpers. Previously duplicated across `client/src/features/storeBuilder/store-builder-types.ts`, `client/src/features/storefront/types.ts`, and `functions/src/routes/store-files.ts`.

**Files updated to import from shared:**
- `client/src/features/storeBuilder/store-builder-types.ts` — re-exports from shared (no local types remain)
- `client/src/features/storefront/types.ts` — re-exports from shared
- `functions/src/routes/store-files.ts` — removed 140-line local `COLOR_HEX` + `buildStructuredOptions` + `deriveCardMode` block; imports from shared
- `client/src/features/storefront-shared/buildProductGallery.ts` — enhanced with normalized color matching (strips `Solid`/`Heather` prefixes before matching mockup keys)
- `client/src/components/FeaturedProducts.tsx` — removed 40-line local `getCurrentMockup()` from ProductCard; replaced with `buildProductGallery()` from shared gallery builder

### April 23, 2026 — Etsy OAuth 2.0 (PKCE) + Listings API Push (rev 23)

Full Etsy Sell API integration following the same pattern as Amazon and eBay. Uses OAuth 2.0 with PKCE (Proof Key for Code Exchange) — the code_verifier is temporarily stored in a Firestore `oauth_pkce_state` collection during the OAuth round-trip and deleted immediately after exchange. The Listings API push creates a draft, uploads images (fetched from surface image URLs and multipart-posted to Etsy), then activates the listing.

**Accounts section — Etsy connect/disconnect:**
- Etsy accounts now show an **OAuth Connected** badge when linked and the shop name, or a **Not Connected** badge when not
- **Connect** button starts the PKCE OAuth flow: opens a new tab → seller approves on etsy.com → Etsy redirects back → access + refresh tokens, userId, shopId, shopName stored on the account document
- **Disconnect** button removes all stored Etsy credentials
- On return from Etsy OAuth, the page detects `?etsy_connect=success/error` query params and shows a result toast

**Surfaces section — Push to Etsy button:**
- Any surface with "etsy" in `enabledPlatforms` or `supportsEtsy=true` shows a **Push** (Etsy) button
- Clicking it opens a dialog to select account and fill in Etsy-required fields: Taxonomy ID (category), Shipping Profile ID, optional Return Policy ID, Who Made, When Made, and optional SKU override
- Backend creates a draft listing, uploads up to 10 images from the surface's `images` array, then activates the listing (or leaves it as draft if image upload fails)
- Push result (success, listingId, state, imagesUploaded, any warnings) is stored in `etsyPushHistory` on the surface document

**One-time server setup required before connecting:**
Three environment variables must be set in the Firebase Functions environment (register the app at developers.etsy.com first):
| Variable | Description |
|---|---|
| `ETSY_KEYSTRING` | API key / Client ID from Etsy developer portal |
| `ETSY_SHARED_SECRET` | Shared Secret from Etsy developer portal (kept for reference; PKCE flow doesn't need it at runtime) |
| `ETSY_REDIRECT_URI` | Callback URL: `https://qrgear.com/api/marketplace/etsy/oauth/callback` |

#### Files Changed
| File | Change |
|------|--------|
| `functions/src/services/etsy-api.ts` | **NEW** — Etsy service: PKCE helpers (verifier + challenge), OAuth URL builder, token exchange, token refresh, getEtsyShopInfo, pushListingToEtsy (create draft → upload images → activate) |
| `functions/src/routes/etsy-oauth.ts` | **NEW** — OAuth routes: start (PKCE state → Firestore), callback (exchange + shop fetch + store creds), disconnect |
| `functions/src/routes/marketplace.ts` | Added `POST /admin/surfaces/:surfaceId/push-to-etsy` endpoint |
| `functions/src/index.ts` | Registered registerEtsyOAuth; bumped BUILD_ID to `20260423-etsy-oauth-listings-api-v1` |
| `client/src/pages/marketplaces-accounts.tsx` | Added Etsy OAuth fields on MarketplaceAccount, connect/disconnect mutations + UI, PushToEtsyDialog (with taxonomy/shipping/policy/who_made/when_made fields), Etsy Push button on surfaces |

---

### April 23, 2026 — eBay OAuth + Inventory API Listing Push (rev 22)

Full eBay Sell API integration following the same pattern as Amazon. Uses the OAuth 2.0 Authorization Code flow and the eBay Inventory API (3-step: create inventory item → create/update offer → publish offer).

**Accounts section — eBay connect/disconnect:**
- eBay accounts now show an **OAuth Connected** badge when linked and the seller's eBay username, or a **Not Connected** badge when not
- **Connect** button starts the eBay OAuth flow: opens a new tab → seller approves → eBay redirects back → refresh token + userId + username stored on the account document
- **Disconnect** button removes stored credentials
- On return from eBay OAuth, the page detects `?ebay_connect=success/error` query params and shows a result toast

**Surfaces section — Push to eBay button:**
- Any surface with "ebay" in `enabledPlatforms` or `supportsEbay=true` shows a **Push** button
- Clicking it opens a dialog to confirm the target eBay account and optionally override the SKU
- Backend executes the 3-step Inventory API push using fields from the surface's `ebay` sub-object: categoryId, conditionId, listingFormat, shippingPolicyId, paymentPolicyId, returnsPolicyId, itemSpecifics, priceOverride, quantity, brand, upc, ean, mpn, subtitle
- Push result (success, offerId, listingId) is stored in `ebayPushHistory` on the surface document

**One-time server setup required before connecting:**
Four environment variables must be set in the Firebase Functions environment (register the app at developer.ebay.com first):
| Variable | Description |
|---|---|
| `EBAY_APP_ID` | Application ID (Client ID) from eBay developer portal |
| `EBAY_CERT_ID` | Cert ID (Client Secret) from eBay developer portal |
| `EBAY_RUNAME` | RuName — the name eBay assigned to your registered redirect URI |
| `EBAY_REDIRECT_URI` | Actual callback URL: `https://qrgear.com/api/marketplace/ebay/oauth/callback` |

#### Files Changed
| File | Change |
|------|--------|
| `functions/src/services/ebay-api.ts` | **NEW** — eBay service: OAuth URL builder, token exchange, refresh, pushListingToEbay (3-step Inventory API), getUserInfo |
| `functions/src/routes/ebay-oauth.ts` | **NEW** — OAuth routes: start, callback, disconnect |
| `functions/src/routes/marketplace.ts` | Added `POST /admin/surfaces/:surfaceId/push-to-ebay` endpoint |
| `functions/src/index.ts` | Registered registerEbayOAuth; bumped BUILD_ID |
| `client/src/pages/marketplaces-accounts.tsx` | Added eBay OAuth fields, connect/disconnect mutations + UI, PushToEbayDialog, eBay Push button on surfaces |

---

### April 23, 2026 — Amazon SP-API OAuth Connection + Listing Push (rev 21)

Full Amazon Selling Partner API integration for marketplace accounts and surfaces.

**Accounts section — Amazon connect/disconnect:**
- Amazon accounts now show an **SP-API Connected** badge when linked, or a **Not Connected** badge when not
- **Connect** button starts the Seller Central OAuth flow: opens a new tab → admin approves → Amazon redirects back → refresh token + seller ID stored on the account document
- **Disconnect** button removes stored credentials
- On return from Amazon OAuth, the page detects `?amazon_connect=success/error` query params and shows a result toast

**Surfaces section — Push to Amazon button:**
- Any surface with "amazon" in its `enabledPlatforms` shows a **Push** button
- Clicking it opens a dialog to confirm the target Amazon account (auto-selects if only one connected) and optionally override the SKU
- Backend maps the surface's title, description, bullet points, tags, images, and price to the SP-API Listings Items API (PUT /listings/2021-08-01/items/{sellerId}/{sku})
- Push result (success, issues, submission ID) is stored in `amazonPushHistory` on the surface document

**One-time server setup required before connecting:**
Four environment variables must be set in the Firebase Functions environment:
| Variable | Purpose |
|---|---|
| `AMAZON_SP_APP_ID` | Seller Central App ID (amzn1.sellerapps.app.XXX) — from Seller Central Dev Console |
| `AMAZON_SP_CLIENT_ID` | LWA Client ID for the QR Gear SP-API application |
| `AMAZON_SP_CLIENT_SECRET` | LWA Client Secret |
| `AMAZON_SP_REDIRECT_URI` | `https://qrgear.com/api/marketplace/amazon/oauth/callback` |

Register QR Gear as a developer app at: `sellercentral.amazon.com → Apps & Services → Develop Apps`

| File | Change |
|---|---|
| `functions/src/services/amazon-sp-api.ts` | NEW — LWA token exchange, `pushListingToAmazon`, `buildOAuthUrl`, `getSellerIdFromToken` |
| `functions/src/routes/amazon-oauth.ts` | NEW — OAuth start, callback, disconnect routes |
| `functions/src/routes/marketplace.ts` | `POST /admin/surfaces/:id/push-to-amazon` endpoint added |
| `functions/src/index.ts` | Registered `registerAmazonOAuth`, bumped build ID |
| `client/src/pages/marketplaces-accounts.tsx` | `MarketplaceAccount` type extended; Connect/Disconnect buttons; `PushToAmazonDialog`; Push button on surface cards |

### April 23, 2026 — Surface Auto-Generation from Built Product Pipeline (rev 20)

Surfaces can now be auto-populated from a committed catalog instance via the product pipeline (`product → packet → admin_catalog_instance → normalized product → Surface draft`).

**New "Generate from Product" button** appears next to "Create Surface" in the Surfaces section header. Clicking it opens a dialog where you:
1. Select a committed built product (loaded from `admin_catalog_instances` — shows title and folder path)
2. Choose a target marketplace (eBay, Etsy, or Amazon)
3. Click **Generate Surface** → a draft Surface is created and the editor opens for review

**What is auto-filled:**
- Title, description (cascade: instance → packet → master), images
- Price (MSRP from packet data), available sizes + colors
- Auto-generated bullet points and tags from product attributes
- eBay-specific: itemSpecifics (brand, material, color, size), department derivation
- SKU: `QRG-[STNNN]-[C]-[NNNNNN]` (e.g. `QRG-11101-I-000001`) — sourced from instance `qrgBaseCode`, never invented
- Fields requiring external lookup (eBay category ID, shipping/payment/return policy IDs) are left blank for manual entry

| File | Change |
|------|--------|
| `functions/src/services/surface-generator.ts` | NEW — `NormalizedProduct` type, `normalizeProductForPublishing()`, `createSurfaceDraftFromNormalizedProduct()` |
| `functions/src/routes/marketplace.ts` | `POST /admin/surfaces/generate-from-instance` endpoint added |
| `client/src/pages/marketplaces-accounts.tsx` | `GenerateFromProductDialog` component, `showGenerate` state, "Generate from Product" button in Surfaces header |

### April 21, 2026 — Change: Commit always creates a new catalog instance

**Previous behavior:** If a session had already been committed before (i.e. it had a `committedInstanceId`), committing again would overwrite the existing catalog instance. Only the first commit from a fresh session created a new instance.

**New behavior:** Every commit always creates a brand-new `admin_catalog_instance`, regardless of whether the session was previously committed or reopened. The old `committedInstanceId` on the session is replaced with the new instance ID for tracking, but no existing instance is ever mutated by the commit path.

This means: every time you change options and save, a new instance appears in the catalog list.

| File | Change |
|------|--------|
| `functions/src/routes/admin-build-sessions.ts` | Removed `if (committedInstanceId) { UPDATE } else { CREATE }` branch — always takes CREATE path |
| `functions/src/index.ts` | Bumped `_BUILD_ID` to `20260421-always-create-instance-v2` to force function redeploy |

---

### April 21, 2026 — Fix: "No changes detected" blocks save after loading graphic/template

**Root cause:** `hasChangesFromBaseline()` only compared a narrow set of content fields (URL, text labels, color, QR position, background). It did NOT track the loaded graphic image or template image. When a user loaded a template and then swapped the graphic — which is the primary thing to change — the comparison still returned "identical" and blocked packet creation with "No changes detected."

**Fix:** Removed the `hasChangesFromBaseline` guard from `handleCreatePacket` entirely. The guard was never reliable (too narrow to cover all meaningful changes) and was blocking legitimate saves. The user clicking "Create Packet" is already an intentional action; the guard added friction without meaningful protection.

| File | Change |
|------|--------|
| `client/src/features/adminProducts/builder/modules/useCreatePacket.ts` | Removed `hasChangesFromBaseline` guard and unused import from `handleCreatePacket` |

---

### April 21, 2026 — Fix: "Starting…" forever + "No changes detected" after template load

**Bug 1 — "Starting…" spinner never resolves after loading a template**
`loadFromPacketData` populates the builder state including `selectedProduct`, but never called `from-master` to create a build session. The sticky bar badge showed "Starting…" indefinitely and autosave/commit were blocked with no session to write to.

**Fix:** `LoadTemplateModule.handleSelect` now calls `POST /build-sessions/from-master` after `loadFromPacketData` (when a product was resolved). The returned `sessionId` is immediately registered via `setActiveSession`, so the sticky bar shows "In progress" and autosave begins normally.

**Bug 2 — "No changes detected" blocks packet creation on reopened committed sessions**
After committing a session and reopening it via "Update Saved Item", `templateBaseline` remained set from the original template load. Creating a new packet then triggered the baseline comparison which returned "no changes" — even if the user had actually made edits — because the working state was restored to match the baseline.

**Fix:** The `hasChangesFromBaseline` guard in `useCreatePacket` now skips the block when `state.committedInstanceId` is set. A session with an existing committed instance is explicitly being updated; the intent is clear and the guard adds no value there.

#### Files Changed
| File | Change |
|------|--------|
| `client/src/features/adminProducts/builder/modules/LoadTemplateModule.tsx` | Added `setActiveSession` to context destructure; `handleSelect` calls `from-master` after `loadFromPacketData` to auto-create a session |
| `client/src/features/adminProducts/builder/modules/useCreatePacket.ts` | Baseline check now includes `&& !state.committedInstanceId` so reopened committed sessions are not blocked |

---

### April 21, 2026 — Fix: "Template has no packet data" error on Load Template

**Root cause:** Templates are stored with an optional `packetSnapshot` embedded in their `textStyle` field. Templates saved before this snapshot field was introduced (or through paths that didn't write it) have `packet: null`. The `handleSelect` handler hard-failed with "Template has no packet data" rather than falling back to fetching the packet live.

**Fix:** When `item.packet` is null but `item.packetId` is present, `handleSelect` now fetches the packet directly from `${apiBase}/packets/:packetId`, normalises the response shape (`data.landingPage || data.packet || data`), and proceeds with `loadFromPacketData` exactly as if the snapshot had been present. The error toast is now only shown if the live fetch also fails to return usable data.

#### Files Changed
| File | Change |
|------|--------|
| `client/src/features/adminProducts/builder/modules/LoadTemplateModule.tsx` | `handleSelect` fetches packet live when `packetSnapshot` is absent; `setSelecting(true)` moved before the fetch so the spinner shows immediately |

---

### April 21, 2026 — Fix: Committed packet not shown on session resume

**Root cause:** The auto-restore `useEffect` in `CreateGraphicsModule` guarded on `sessionStatus !== 'artifact_ready'`, so when resuming a committed session (status = `'committed'`) the `PacketResultDisplay` was never populated — the viewer appeared empty even though all data was intact in Firestore.

**Fix:** Widened the condition to allow both `'artifact_ready'` and `'committed'` statuses.

#### Files Changed
| File | Change |
|------|--------|
| `client/src/features/adminProducts/builder/modules/CreateGraphicsModule.tsx` | Auto-restore effect now fires for both `artifact_ready` and `committed` session statuses |

---

### April 21, 2026 — Crash fix: `setActivePacketId is not defined` in ProductsModule

**Root cause:** `setActivePacketId` was used inside `handleCardSelect` and listed in its dependency array in `ProductsModule.tsx`, but was never included in the `useBuilderContext()` destructuring on that component. This caused a `ReferenceError` at runtime, caught by the nearest error boundary (labeled "StateModule").

**Fix:** Added `setActivePacketId` to the `useBuilderContext()` destructure in `ProductsModule`.

#### Files Changed
| File | Change |
|------|--------|
| `client/src/features/adminProducts/builder/modules/ProductsModule.tsx` | Added `setActivePacketId` to `useBuilderContext()` destructuring |

---

### April 21, 2026 — Feature: Phase 1+2 save/reload loop — Update Saved Item & Save as New

Completes the admin product build loop: **BUILD → SAVE → RELOAD → MODIFY → SCALE**.

**Phase 1 — Persist committed sessions across reload:**
- Backend: `GET /build-sessions/from-committed` lists sessions with status `committed`, filtered by product/role/store/channel. Returns `committedInstanceId`.
- Backend: `POST /build-sessions/:sessionId/reopen` sets session status back to `working` so the builder autosave and generate-artifact flows resume.
- Backend: `POST /build-sessions/clone` duplicates an existing session (all fields) as a fresh `working` session with no `committedInstanceId`.
- Backend: `generate-artifact` now accepts an optional `previewImageUrl` and stores it on the session for display in load lists.
- Backend: `commit` detects whether the session has an existing `committedInstanceId` and **updates** the existing `admin_catalog_instance` rather than always creating a new one.

**Phase 2 — UI buttons in `CreateGraphicsModule`:**
- After a session is committed, two buttons appear beneath the green confirmation strip:
  - **Update Saved Item** — calls `/reopen`, restores the session to `working` state in-place. User can then regenerate a packet and commit again to overwrite the same catalog instance.
  - **Save as New** — calls `/clone`, then does a full-page redirect to `/admin/products?resume=<newSessionId>`. The cloned session has no `committedInstanceId`, so committing it creates a brand-new catalog instance.

**Phase 2 — `LoadSavedModule`:**
- New module that appears below `LoadTemplateModule` in the builder harness.
- Fetches committed sessions for the selected product/role/store/channel combination and renders a list of resumable saved builds (thumbnail, product name, date).
- Clicking a saved build sets the session context and re-fetches its packet result to restore the `PacketResultDisplay`.

#### Files Changed
| File | Change |
|------|--------|
| `functions/src/routes/admin-build-sessions.ts` | Added `clone`, `reopen`, `from-committed` routes; `previewImageUrl` on generate-artifact; update-vs-create logic in commit |
| `functions/src/index.ts` | Bumped `_BUILD_ID` to force functions redeploy |
| `client/src/features/adminProducts/builder/modules/CreateGraphicsModule.tsx` | Added `useToast`, `useLocation`, `setActiveSession`; `isReopening`/`isCloningSession` state; `handleUpdateSaved`/`handleSaveAsNew` handlers; Phase 2 buttons in committed section |
| `client/src/features/adminProducts/builder/modules/LoadSavedModule.tsx` | New module — lists and resumes committed sessions |
| `client/src/features/adminProducts/builder/BuilderHarness.tsx` | Mounts `LoadSavedModule` below `LoadTemplateModule` |
| `client/src/features/adminProducts/builder/modules/useCreatePacket.ts` | Passes `previewImageUrl` (composite URL) to generate-artifact |

---

### April 20, 2026 — Crash fix: "mockupImageUrl is not defined" in product image viewer

**Root cause:** `mockupImageUrl` was added to `PreviewModal`'s JSX usage and used throughout its body (for `displayImages`, `isMockupIndex`, thumbnail badges, and delete guard) but was never added to `PreviewModal`'s own parameter destructuring or inline TypeScript type. The variable was therefore undefined in that function's scope, causing a `ReferenceError` crash whenever the image viewer opened inside the builder.

**Fix:** Added `mockupImageUrl?: string | null` to both the destructured parameter list and the inline prop type of `PreviewModal`.

#### Files Changed
| File | Change |
|------|--------|
| `client/src/features/shared/components/skins/ProductSelectCardSkin.tsx` | Added `mockupImageUrl` to `PreviewModal` parameter destructuring and its inline type |

---

### April 20, 2026 — Feature: Mockup image shown first in product image viewer

The selected product's image viewer (preview modal) now shows the generated mockup as the very first image, before all catalog photos. A "Mockup" badge appears in the top-right of the main image area and a "Mockup" label strip appears on the first thumbnail. The delete button is hidden when viewing the mockup (it is a generated image, not a catalog image that can be removed). Non-selected product cards are unaffected. The mockup only appears once a graphic has been generated in the builder.

#### Files Changed
| File | Change |
|------|--------|
| `client/src/features/shared/components/skins/ProductSelectCardSkin.tsx` | Added `mockupImageUrl` prop; `PreviewModal` prepends mockup to display images, adds badge, disables delete on mockup |
| `client/src/features/adminProducts/builder/modules/ProductsModule.tsx` | Passes `state.loadedGraphic?.compositeUrl` as `mockupImageUrl` to the selected product card only |

---

### April 20, 2026 — Fix: Autosave now persists through tab close and immediate navigation

Two gaps in the flush-on-leave autosave path were closed. (1) Auth headers were only cached after the first successful 1.5-second debounce save — if the user navigated away in under 1.5 seconds the flush had no token and silently dropped. Fixed by eagerly calling `getAuthHeaders()` the moment a session becomes active. (2) No `beforeunload` listener existed for browser tab close / full-page refresh. Fixed by adding a `window.addEventListener('beforeunload', ...)` that calls the same `flushSaveRef` flush already used for in-app unmount.

#### Files Changed
| File | Change |
|------|--------|
| `client/src/features/adminProducts/builder/BuilderContext.tsx` | Added eager auth-header cache effect on `activeSessionId` change; added `beforeunload` window listener that fires the keepalive flush |

---

### April 20, 2026 — Fix: Provider, category, origin/gender filters, and source type now restore on resume

**Root cause:** `loadFromWorkingState` was reading `fulfillmentProvider`, `category`, `originFilter`, `genderFilter`, and `sourceType` from the saved metadata but never writing them back to builder state on restore. These are all first-class `BuilderState` fields that the autosave correctly captures, but the restore path silently ignored them.

**Why the individual setters could not be used:** Each setter has destructive side effects — `setFulfillmentProvider` clears `category`, `setCategory` clears `selectedProduct`, `setOriginFilter` / `setGenderFilter` clear `selectedProduct`, and `setSourceType` wipes templates/graphics/provider/category. Calling them in sequence would have corrupted the restored state.

**Fix:** The five missing fields are now written directly into the single `setState` merge inside `loadFromWorkingState`, bypassing setter side effects. This applies to both the product-card flow (`ProductsModule.handleCardSelect → from-master`) and the URL-param resume flow (`DraftResumeHandler`) since both call the same function.

#### Fields now fully restored on resume
| Field | Saved in | Restored to |
|-------|----------|-------------|
| `fulfillmentProvider` | `metadata.fulfillmentProvider` | `state.fulfillmentProvider` |
| `category` | `metadata.category` | `state.category` |
| `originFilter` | `metadata.originFilter` | `state.originFilter` |
| `genderFilter` | `metadata.genderFilter` | `state.genderFilter` |
| `sourceType` | `metadata.sourceType` | `state.sourceType` |

#### Files Changed
| File | Change |
|------|--------|
| `client/src/features/adminProducts/builder/BuilderContext.tsx` | Added 5 missing metadata fields to `loadFromWorkingState` setState merge |

---

### April 20, 2026 — Fix: Store, channel, collection, and catalog filter now save and restore correctly

**Root cause:** The autosave debounce `useEffect` only re-fired when builder content changed (`state.content`, `state.loadedBackground`, etc.). Selecting a store, channel, or collection — without touching any content — never triggered a re-fire, so those values were captured as stale nulls in the closure. `selectedCatalogId` had the same problem.

**Fix:** Added `selectedStore`, `selectedChannel`, `selectedCollection`, and `state.selectedCatalogId` to the autosave dep array. Any change to those values now triggers the 1.5-second debounce save, and they are correctly written into `session.working.metadata` in Firestore.

#### Files Changed
| File | Change |
|------|--------|
| `client/src/features/adminProducts/builder/BuilderContext.tsx` | Added `selectedStore`, `selectedChannel`, `selectedCollection`, `state.selectedCatalogId` to autosave `useEffect` dep array |

---

### May 3, 2026 — Feature: QRG BBB Master Blank Catalog Architecture

Full rebuild of the master blank catalog to use QRG BBB numbering as the master identity layer. Provider bridges (Printify + Printful) now resolve to a single canonical `qrg_NNN` record per blank type instead of separate per-provider docs.

**What changed:**

1. **QRG BBB sequential numbering** — Each blank type gets a permanent `qrg_NNN` Firestore doc ID (e.g. `qrg_101` = first Tee, `qrg_201` = first Hoodie). Numbers auto-assign at sync time in sequential order per category. Unclassified products fall back to `pending_py_*` or `pending_pf_*`.

2. **Provider bridge** — When both Printify and Printful carry the same brand+model blank, they are merged into one `qrg_NNN` record via `providerMappings[]` array. `availableVia` field lists which providers stock the blank.

3. **Separate images per provider** — `printifyImages[]` and `printfulImages[]` store images from each source. `images[]` holds the combined de-duped set. Avoids Printify images contaminating Printful-exclusive blanks and vice versa.

4. **QRG categories on the API** — `GET /api/master-catalog` now groups items into QRG categories (Tees 101–199, Hoodies 201–299, Hats 301–399, Drinkware 401–499, Unclassified). `categorySource: "qrg"|"pending"` distinguishes classified vs. unclassified records.

5. **Provider badge on admin blank cards** — Each blank card in the Admin Blanks page shows a colored badge: **Printify** (orange), **Printful** (sky blue), **Both** (violet). Badge reads from `availableVia[]` on the product map.

6. **QRG category filter labels** — The category filter dropdown now shows QRG range labels: "Tees (101–199)", "Hoodies (201–299)", "Hats (301–399)", "Drinkware (401–499)" instead of raw strings.

7. **Backward compat** — `fulfillmentProvider` field retained on API responses so older code paths still work. `getProductKey()` helper abstracts key lookup. `expandBlankIdSet()` passes `qrg_*` and `pending_*` IDs through without expansion.

**Firestore schema for `master_catalog`:**
| Field | Description |
|---|---|
| `qrgBlankId` | Doc ID (`qrg_101`, `pending_py_12`, …) |
| `qrgCategory` | Tees / Hoodies / Hats / Drinkware / Unclassified |
| `categorySource` | `qrg` or `pending` |
| `availableVia` | `["Printify"]`, `["Printful"]`, or both |
| `providerMappings` | `[{ provider, blueprintId/productId, title, printProviderId }]` |
| `canonicalTitle` / `brand` / `model` | Display identity |
| `originCountry` | e.g. `USA`, `Nicaragua` |
| `printifyImages[]` / `printfulImages[]` / `images[]` | Per-provider + combined images |

#### Files Changed
| File | Change |
|------|--------|
| `functions/src/services/master-catalog.ts` | Rewritten: full QRG sync engine with sequential BBB numbering, provider bridge, separate image arrays |
| `functions/src/routes/pp-catalog-browse.ts` | Updated: `/master-catalog` endpoint serves QRG categories, adds `qrgBlankId`/`availableVia`/`providerMappings` to response |
| `shared/blankKeys.ts` | Added `isQRGBlankId()`, `isPendingBlankId()`, `getQRGBlankNumber()` helpers |
| `client/src/features/adminProducts/controllers/useAdminBlanksController.ts` | Rewritten: `isAvailableVia()` replaces direct provider check; `allProductMap` indexed by `docId`; `getProductKey()` helper |
| `client/src/pages/admin-blanks.tsx` | Provider badge (Printify/Printful/Both) on blank cards; QRG range labels in category filter dropdown |

---

### April 20, 2026 — Fix: Pre-packet (pre-save) builder resume now restores all saved work

**Root cause:** When the user selected a master product in the Product Builder, the client called `POST /api/admin/build-sessions/from-master`, which correctly returned the existing `working` session (including title, description, graphics, QR config, layout, and store/channel/collection) from Firestore. However, the client only called `setActiveSession(...)` to register the session ID and **never called `loadFromWorkingState(...)`** to hydrate the builder UI. So every re-entry appeared blank even though the work was fully saved.

**Fix:** After `from-master` returns `isExisting: true` with a non-empty `working` object, `loadFromWorkingState(data.session.working, entry.catalog)` is now called immediately. A "Draft resumed" toast confirms the restore so the admin knows their work was not lost.

**Scope:** Frontend-only change. No Cloud Function changes needed — the `from-master` endpoint already returned the complete `session.working` payload. Only the client was ignoring it.

#### Files Changed
| File | Change |
|------|--------|
| `client/src/features/adminProducts/builder/modules/ProductsModule.tsx` | Added `loadFromWorkingState` to `useBuilderContext` destructure; call it after `from-master` returns existing session; show "Draft resumed" toast; added to `handleCardSelect` deps |

---

### April 19, 2026 — Fix: Pre-existing TypeScript errors cleared

Four pre-existing type errors that did not affect runtime but caused the type checker to fail:

1. **`TextStyleConfig` missing `fontWeight`** — `subBottomStyle` initializer used `fontWeight` but the interface didn't declare it. Added `fontWeight?: string` to `TextStyleConfig`.
2. **`admin-blanks.tsx` — `showCreate` out of scope** — The "New Catalog" button in `AdminBlanks`'s header referenced `showCreate`/`setShowCreate` that were only declared inside the `CatalogsTab` sub-component. Lifted the state up to `AdminBlanks` and passed it down as props.
3. **`admin-catalogs-shelf.routes.ts` — function declaration in strict-mode block** — The `classifyCategory` helper was declared with `function` syntax inside a block, which is disallowed in ES module strict mode. Converted to a `const` arrow function.
4. **`qr-templates.routes.ts` — `number | null | undefined` vs `number`** — `data.printProviderId` (nullable/optional from Zod schema) was passed directly to `mockupJobQueue.createBatchJobs` which requires `number`. Added `?? 39` fallback (consistent with the existing `template.printProviderId || 39` pattern elsewhere in the same file).

#### Files Changed
| File | Change |
|------|--------|
| `client/src/features/adminProducts/builder/types.ts` | Added `fontWeight?: string` to `TextStyleConfig` |
| `client/src/pages/admin-blanks.tsx` | Lifted `showCreate` state to `AdminBlanks`, passed as props to `CatalogsTab` |
| `server/routes/admin-catalogs-shelf.routes.ts` | Converted `function classifyCategory` to const arrow function |
| `server/routes/misc/qr-templates.routes.ts` | Added `?? 39` fallback to both `printProviderId` usages |

---

### April 19, 2026 — Feature: Save and restore store, channel, collection, and catalog selection

The autosave working snapshot now includes the full store, channel, collection, and catalog filter selections. On resume, all four are restored in the correct dependency order (store → channel → collection → catalog) so the builder reappears exactly as it was when you stopped.

**What changed:**
- `selectedCatalogId` lifted from local `useState` in `ProductsModule` into `BuilderState` so it flows through the autosave mechanism
- `buildWorkingSnapshot` now accepts context and saves `selectedStore`, `selectedChannel`, `selectedCollection` (full objects), and `selectedCatalogId`
- `loadFromWorkingState` restores store, channel, collection via `ProductsContext` setters and `selectedCatalogId` via `BuilderState`
- `ProductsModule` reads `selectedCatalogId` from `BuilderContext` instead of owning it locally

#### Files Changed
| File | Change |
|------|--------|
| `client/src/features/adminProducts/builder/types.ts` | Added `selectedCatalogId: string` to `BuilderState` |
| `client/src/features/adminProducts/builder/BuilderContext.tsx` | Added `BuilderSnapshotContext`, updated snapshot/restore, added `setSelectedCatalogId`, lifted catalog state |
| `client/src/features/adminProducts/builder/modules/ProductsModule.tsx` | Replaced local `selectedCatalogId` state with context value |

---

### April 19, 2026 — Fix: Save product docId in working snapshot

The working snapshot was saving `selectedProductId` (numeric Printify blueprint ID, identical to `selectedProductBlueprintId`) and nothing else for product identity. The Firestore doc ID (`docId`, e.g. `"gildan-5000"`) — the only reliable string key for catalog lookup — was never saved. Replaced the redundant `selectedProductId` field with `selectedProductDocId` in `metadata`. The resume handler now uses `selectedProductDocId` as a second fallback (after `session.sourceMasterId`, before the numeric `selectedProductBlueprintId`), so a product can be resolved from the snapshot alone even if `sourceMasterId` is missing on the session doc.

**Resolution order in MODE 2 (prepacket) is now:**
1. `session.sourceMasterId` → `p.docId`
2. `working.metadata.selectedProductDocId` → `p.docId`
3. `working.metadata.selectedProductBlueprintId` → `p.blueprintId` (numeric)
4. `working.qrConfig.templateProductHint` → `p.blueprintId` (numeric, last resort)

#### Files Changed
| File | Change |
|------|--------|
| `client/src/features/adminProducts/builder/BuilderContext.tsx` | Replaced `selectedProductId` with `selectedProductDocId` (`p.docId`) in snapshot metadata |
| `client/src/features/adminProducts/builder/modules/DraftResumeHandler.tsx` | Added `snapshotDocId` as second fallback in MODE 2 resolution chain |

---

### April 19, 2026 — Rewrite: Prepacket Resume / Pre-saved Project Restore

Complete redesign of the draft resume logic in `DraftResumeHandler.tsx` to cleanly separate two distinct restore modes and fix the root cause of pre-saved project restore failures.

**Root cause:** The old code used a single shared product resolution path that treated `session.working.metadata.selectedProductId` (the catalog `p.id` field — a numeric blueprint ID) as though it were interchangeable with `session.sourceMasterId` (a Firestore document ID string). These are fundamentally different identifiers and should never be compared the same way.

**MODE 1 — Packet-backed restore** (packet exists):
- Product resolved via `packetData.blueprintId` + `fulfillmentProvider` matched against `p.blueprintId`
- Falls back to `sourceMasterId → p.docId` if packet has no blueprintId
- Calls `loadFromPacketData`

**MODE 2 — Prepacket working-state restore** (no packet yet):
- Product resolved via `session.sourceMasterId → p.docId` (Firestore doc ID match, always set at session creation — primary key)
- Falls back to `session.working.metadata.selectedProductBlueprintId` (numeric, safe)
- Last resort: `session.working.qrConfig.templateProductHint` (numeric hint)
- `selectedProductId` is never used as a blueprint identifier
- Calls `loadFromWorkingState`

**Logging added:** Every step emits a `[DraftResumeHandler]` console log — mode detected, identifier tried, resolution result, restore function called.

**`BuilderContext` snapshot updated:** `buildWorkingSnapshot` now also saves `templateProductHint` in the `metadata` block (alongside `selectedProductBlueprintId`), so all fallback keys are persisted on every autosave.

#### Files Changed
| File | Change |
|------|--------|
| `client/src/features/adminProducts/builder/modules/DraftResumeHandler.tsx` | Full rewrite — two clean restore modes, `resolveByDocId` / `resolveByBlueprintId` helpers, detailed logging |
| `client/src/features/adminProducts/builder/BuilderContext.tsx` | `buildWorkingSnapshot` metadata now includes `templateProductHint` |

---

### April 19, 2026 — Fix: Product resolution on draft resume + delete button on Run panel

**Root cause of "product not found" on resume:** `DraftResumeHandler` and `LoadTemplateModule` were fetching the catalog via `${apiBase}/master-catalog` = `/api/admin/master-catalog`. On production Cloud Functions, the middleware strips only `/api` — leaving `/admin/master-catalog`. But the grouped catalog is registered at `/master-catalog` (no admin prefix, public endpoint in `pp-catalog-browse.ts`). So the catalog fetch was hitting a dead endpoint, returning no data, and product resolution always failed silently. Fixed: both components now call `/api/master-catalog` directly.

**Secondary fix — ID matching:** Even if the catalog had returned, the prior matcher was comparing `session.sourceMasterId` (a Firestore doc ID string like `"gildan-5000"`) against `p.id` (the numeric Printify blueprint ID like `12`). Those never match. The catalog items also carry `p.docId` (the Firestore string). The matcher now tries `p.docId === sourceMasterId` first, then falls back to numeric blueprint ID and a blueprint ID stored in the working snapshot.

**Delete button on Run panel:** Each "In Progress" draft card now has a trash icon. Clicking it shows an inline "Delete? / Yes / No" confirmation. Confirming calls the existing `abandon` endpoint which removes the session from the working list immediately.

#### Files Changed
| File | Change |
|------|--------|
| `client/src/features/adminProducts/builder/modules/DraftResumeHandler.tsx` | Catalog fetch changed to `/api/master-catalog`; ID matcher now uses `p.docId` for Firestore string match |
| `client/src/features/adminProducts/builder/modules/LoadTemplateModule.tsx` | Catalog fetch changed to `/api/master-catalog` |
| `client/src/features/adminProducts/builder/BuilderContext.tsx` | Working snapshot now also saves `selectedProductBlueprintId` as a numeric fallback |
| `client/src/pages/admin-run.tsx` | Added trash icon + inline confirm/cancel to each session row in `InProgressSection` |

---

### April 19, 2026 — Fix: Double /admin/ URL bug across all build-session & packet calls

Root cause: `apiBase` is already `/api/admin`, so any path built as `${apiBase}/admin/...` resolves to `/api/admin/admin/...` — a 404 on every call. This was silently causing autosave, draft resume, packet generation, and commit to all fail in production. Fixed all 7 affected fetch calls across 4 files by removing the redundant `/admin/` segment from each URL.

#### Files Changed
| File | Change |
|------|--------|
| `client/src/features/adminProducts/builder/BuilderContext.tsx` | Fixed autosave PATCH (`/admin/build-sessions/`) and packet sync PATCH (`/admin/packets/`) |
| `client/src/features/adminProducts/builder/modules/DraftResumeHandler.tsx` | Fixed session GET (`/admin/build-sessions/`) and packet GET (`/admin/packets/`) |
| `client/src/features/adminProducts/builder/modules/BuilderStickyBar.tsx` | Fixed "Name draft" PATCH (`/admin/build-sessions/`) |
| `client/src/features/adminProducts/builder/modules/useCreatePacket.ts` | Fixed generate-artifact POST and commit POST (`/admin/build-sessions/...`) |

### April 19, 2026 — Build Sessions: Index-Free Query + Autosave Failure Indicator + Draft Resume Hardening

Three targeted fixes to the Product Builder admin flow:

1. **`GET /admin/build-sessions` no longer requires Firestore composite indexes.** The query now uses a single equality filter (`ownerAdminId`) — which Firestore auto-indexes — and performs `status`, `sourceMasterId` filtering plus `updatedAt` descending sort entirely in code. Previously the query required a composite index that was still building, causing 500 errors on the Run dashboard and builder resume flow.

2. **Autosave failure is now visible in the sticky bar.** When a PATCH to the build session fails, `BuilderContext` sets `autoSaveFailed: true` (exposed through context). `BuilderStickyBar` replaces the "In progress" badge with a red "Save failed" badge (with `AlertTriangle` icon) so the admin knows their work isn't being persisted.

3. **DraftResumeHandler is explicit about empty or broken drafts.** If the session has no restorable state (no packet and no `working` snapshot), it shows a destructive toast and returns early instead of silently loading nothing. If `working` state exists but the source product can't be resolved, it loads the snapshot and shows a warning toast prompting the admin to re-select the product.

#### Files Changed
| File | Change |
|------|--------|
| `server/routes/admin-build-sessions.routes.ts` | Removed `orderBy` from Firestore query; added in-code filter + sort + slice |
| `functions/src/routes/admin-build-sessions.ts` | Same refactor as server route |
| `client/src/features/adminProducts/builder/BuilderContext.tsx` | Added `autoSaveFailed` state; set true on PATCH failure, false on success; exposed via context interface |
| `client/src/features/adminProducts/builder/modules/BuilderStickyBar.tsx` | Added "Save failed" badge using `autoSaveFailed` from context |
| `client/src/features/adminProducts/builder/modules/DraftResumeHandler.tsx` | Early return with toast on empty session; warning toast when product can't be resolved |

### April 19, 2026 — Admin Cockpit Polish: 10-Item Fix Pass

Second polish pass on the admin cockpit. Run page now wrapped in AdminShell with a live metrics grid (revenue, orders, customers) replacing the redundant Sections panel. AdminBottomNav simplified to use `getModeForPath()` instead of hardcoded URL arrays. Categories and Tags added to BUILD_SUBNAV so they appear in the section strip. AdminShell gained a `hideBack` prop (used on Run). AdminSectionSubNav is now sticky (`sticky top-0 z-40`) and hub-page tabs adjusted to `top-9` offset so both coexist cleanly. admin-fonts.tsx refactored from `glass-card` / `glass-title` to standard Card components. admin-pricing.tsx collapsed its duplicate loading-state AdminShell into a single shell with an inline `{isLoading && ...}` guard.

#### Files Changed
| File | Change |
|------|--------|
| `client/src/pages/admin-run.tsx` | Rewritten: wrapped in AdminShell (`hideBack`), live metrics grid from `/api/admin/dashboard/metrics`, InProgressSection for drafts, Quick Actions, Reference links |
| `client/src/components/AdminShell.tsx` | Added `hideBack` prop; tab sticky offset now `top-9` when `sectionNav` is present, `top-0` otherwise |
| `client/src/components/admin/AdminBottomNav.tsx` | Simplified: removed `match` arrays, now uses `getModeForPath()` for all `isActive` checks |
| `client/src/components/admin/adminNavConfig.ts` | Added `Categories` and `Tags` to `BUILD_SUBNAV`; added `Folder` + `Hash` imports |
| `client/src/components/admin/AdminSectionSubNav.tsx` | Added `sticky top-0 z-40` so the strip sticks below the scrolled-away admin bar |
| `client/src/pages/admin-fonts.tsx` | Replaced `glass-card` / `glass-title` divs with Card + CardHeader + CardContent |
| `client/src/pages/admin-pricing.tsx` | Collapsed dual-AdminShell pattern into single AdminShell with `{isLoading && ...}` guard |

### April 19, 2026 — Admin Cockpit Consistency: Mode Labels + Universal Section Sub-Nav

Every admin page now shows a mode label eyebrow (`BUILD` / `PLACE` / `SELL` / `SYSTEM`) in its `AdminShell` header, auto-detected from the current URL via `getModeForPath()`. All secondary pages (videos, fonts, dynamics, blanks, categories, tags, orchestration, pricing, customers, gifts, coupons, partners, external sites, marketplaces, health, email health, email templates, manual) now render a horizontal section sub-nav strip sourced from the single central `adminNavConfig.ts`. Hub pages (products, store-builder, store-library, orders, settings) were also updated to consume the same central config instead of maintaining their own local subnav arrays — ensuring every mode's nav is consistent everywhere. The `/admin` route is the canonical Run URL; `/admin/run` and `/admin/dashboard` are aliases. The bottom-nav Run button only highlights on those three paths (fixed `isActive` logic). The duplicate unreachable `/admin/dashboard` → `AdminDashboard` route was removed from `App.tsx`.

#### Files Changed
| File | Change |
|------|--------|
| `client/src/components/admin/adminNavConfig.ts` | Added `Layers` import; added Orchestration to `SELL_SUBNAV` |
| `client/src/components/admin/AdminBottomNav.tsx` | Fixed `isActive` — Run uses exact-match list, not `startsWith` |
| `client/src/App.tsx` | Removed duplicate/unreachable `/admin/dashboard` → `AdminDashboard` route; removed unused import |
| `client/src/pages/admin-videos.tsx` | Added `sectionNav={<AdminSectionSubNav items={BUILD_SUBNAV} />}` |
| `client/src/pages/admin-fonts.tsx` | Added `sectionNav` |
| `client/src/pages/admin-dynamics.tsx` | Added `sectionNav` |
| `client/src/pages/admin-blanks.tsx` | Added `sectionNav` |
| `client/src/pages/admin-categories.tsx` | Added `sectionNav` |
| `client/src/pages/admin-tags.tsx` | Added `sectionNav` |
| `client/src/pages/admin-orchestration.tsx` | Added `sectionNav={<AdminSectionSubNav items={SELL_SUBNAV} />}` |
| `client/src/pages/admin-pricing.tsx` | Added `sectionNav` |
| `client/src/pages/admin-customers.tsx` | Added `sectionNav` |
| `client/src/pages/admin-gifts.tsx` | Added `sectionNav` |
| `client/src/pages/admin-coupons.tsx` | Added `sectionNav` |
| `client/src/pages/admin-partners.tsx` | Added `sectionNav={<AdminSectionSubNav items={PLACE_SUBNAV} />}` |
| `client/src/pages/admin-external-sites.tsx` | Added `sectionNav` |
| `client/src/pages/admin-marketplaces.tsx` | Added `sectionNav` |
| `client/src/pages/admin-health.tsx` | Added `sectionNav={<AdminSectionSubNav items={SYSTEM_SUBNAV} />}` |
| `client/src/pages/admin-email-health.tsx` | Added `sectionNav` |
| `client/src/pages/admin-email-templates.tsx` | Added `sectionNav` |
| `client/src/pages/admin-manual.tsx` | Added `sectionNav` |
| `client/src/pages/admin-products.tsx` | Switched from local `BUILD_SUBNAV` to central config import |
| `client/src/pages/admin-store-builder.tsx` | Switched from local `PLACE_SUBNAV` (2 items) to central config (5 items) |
| `client/src/pages/admin-store-library.tsx` | Switched from local `PLACE_SUBNAV` to central config |
| `client/src/pages/admin-orders.tsx` | Switched from local `SELL_SUBNAV` to central config |
| `client/src/pages/admin-settings.tsx` | Switched from local `SYSTEM_SUBNAV` (had wrong Customers entry) to central config |

---

### April 19, 2026 — Draft Save/Resume + Admin Cockpit Reorganization

#### Admin Cockpit — RUN/BUILD/PLACE/SELL/SYSTEM Structure
The admin panel was restructured into five named sections. `/admin` now routes to a new **Run** dashboard (was a bare redirect). A global nav spine wraps all admin routes via `AdminRoute` in `App.tsx`. Section sub-navs added to hub pages (products, store-builder, store-library, orders, settings). `AdminShell` extended with a `sectionNav` prop.

#### Draft Save/Resume System
Admins can now name and save in-progress builds as drafts, list them on the Run dashboard, and resume them with one click.

- **Save Draft button** — bookmark icon in the builder's sticky bar. Inline name input, saves `draftName` to `admin_build_sessions` via `PATCH /api/admin/build-sessions/:id` (endpoint extended to accept top-level `draftName`).
- **In Progress section** — Run dashboard fetches `GET /api/admin/build-sessions?status=working` and shows cards for any sessions that have a `draftName`, with product title, last-active time, and a Resume button.
- **Resume flow** — Resume navigates to `/admin/products?resume=<sessionId>`. `DraftResumeHandler` (new component inside `BuilderHarness`) detects the URL param, fetches the session and linked packet via the new `GET /api/admin/packets/:packetId` endpoint, resolves the catalog product from the master catalog using `blueprintId`, calls `loadFromPacketData` to restore full builder state, and clears the param from the URL.

#### Files Changed
| File | Change |
|------|--------|
| `server/routes/admin-build-sessions.routes.ts` | PATCH accepts top-level `draftName` |
| `server/routes/packets.routes.ts` | New `GET /api/admin/packets/:packetId` admin endpoint |
| `client/src/features/adminProducts/builder/modules/BuilderStickyBar.tsx` | Save Draft button with inline name input |
| `client/src/features/adminProducts/builder/modules/DraftResumeHandler.tsx` | New — resume-from-URL handler |
| `client/src/features/adminProducts/builder/BuilderHarness.tsx` | Mounts DraftResumeHandler |
| `client/src/pages/admin-run.tsx` | New Run dashboard with In Progress section + quick actions + section links |
| `functions/src/index.ts` | Build ID bumped |

---

### April 19, 2026 — Store Page Graphic Fix + Admin UX: Delete from Store + Template Save/Load Chain

#### Store Page — Correct Graphic Display
The public store page (`/shop/:storeType/:storeName`) was showing a garbled/transparent image for products. Root cause: `storeProductLinks` stores `compositeUrl` which is a **transparent PNG overlay** (just the QR design, no shirt behind it). When rendered on the store card's white background, it appeared as bare text/QR on a white box with no context.

**Fix:** All three store product fetch paths in the public API now enrich `imageUrl` from the packet record:
- Priority order: `mockupUrl → packet.priorityMockupUrl → packet.landingPageSnapshotUrl → packet.productGraphicUrl → compositeUrl → qrOnlyUrl`
- `landingPageSnapshotUrl` is the rendered landing page snapshot (background + content layered) — much better visual than the raw transparent overlay
- `priorityMockupUrl` is the Printify-generated shirt mockup (best option, available after mockup jobs process)
- All three endpoints fixed: `GET /store/product/:linkId`, channel-type store path, and regular store type path (all in `functions/src/routes/store-files.ts`)



#### Delete Items from a Store/Collection (Admin Only)
- **`StoreProductSkin`** — Added optional `onDelete` prop; a trash-can icon button appears on hover over any product card, visible only inside the admin UI.
- **`ProductGridModule`** — Wired `onDelete` with a `useMutation` → `DELETE /api/admin/store-product-links/:linkId`. An `AlertDialog` confirmation prevents accidental removal. Query cache is invalidated on success so the grid refreshes instantly.
- Delete is admin-only by both UI placement (lives inside the admin Store Library section) and server-side enforcement (`requireAdmin` on the Cloud Function route).

#### Template Save/Load Chain — 5-Bug Fix
The auto-template-creation on item save was writing corrupt/partial data, and the template picker was showing garbled items or failing silently. Fixed in five places:

1. **`GET /admin/templates` collection mismatch (Cloud Functions)** — `am-sync.ts` was reading from the `templates` collection but `full-save` writes to `productTemplates`. Fixed: GET now reads from `productTemplates`.
2. **`GET /admin/templates` missing packet data (Cloud Functions)** — The GET now reconstructs a full `packet` object from the stored template fields (`qrContent`, `headerText`, `footerText`, `headerStyle`, `footerStyle`, `qrSizePercent`, `qrPositionX`, `qrPositionY`, `graphicLayoutMode`, `backgroundUrl`, `areaImageUrl`, `areaImageMode`, `qrProductState`, sub-bottom fields, etc.) so the `LoadTemplateModule` can restore the builder state correctly.
3. **`full-save` key whitelist too narrow (Cloud Functions)** — `file-routes.ts` was only persisting a small set of fields. Expanded whitelist to include all snapshot fields: `productName`, `headerText`, `footerText`, `headerStyle`, `footerStyle`, `subBottom*`, `backgroundUrl`, `qrProductState`, `areaImageUrl`, `areaImage*`, so templates can be fully restored.
4. **`LoadTemplateModule` URL fix (client)** — Was calling `${apiBase}/admin/templates` (double `/admin/` prefix); corrected to `/api/admin/templates`.
5. **`templateId` extraction dual-format support (client)** — `useCreatePacket.ts` now resolves `templateData.template?.id || templateData.templateId || null` to handle both the dev-server response shape (`{ template: { id } }`) and the Cloud Functions response shape (`{ templateId }`).

**Note:** Templates saved before this fix will have null packet data and show "Template has no packet data" when loaded — only newly saved templates will be fully restorable.

#### Files Changed
| File | Change |
|------|--------|
| `functions/src/routes/am-sync.ts` | GET `/admin/templates` reads `productTemplates` + builds `packet` object |
| `functions/src/routes/file-routes.ts` | `full-save` key whitelist expanded with all snapshot fields |
| `client/src/features/adminProducts/builder/modules/useCreatePacket.ts` | `templateId` resolved from both response formats |
| `client/src/features/adminProducts/builder/modules/LoadTemplateModule.tsx` | URL corrected (no double `/admin/` prefix) |
| `client/src/features/shared/components/skins/StoreProductSkin.tsx` | `onDelete` prop + hover trash button |
| `client/src/features/adminProducts/storeLibrary/modules/ProductGridModule.tsx` | Delete mutation + AlertDialog confirmation |

---

### April 21, 2026 — Store Builder: Catalog Tab + Instance Management (rev 19)

A new **Catalog** tab is now the default landing tab on the Store Builder page. It provides a full management view for every product instance across all stores, channels, and collections.

**Role → Store dropdowns**
Picking a role (Internal / External / Member) narrows the store list. Selecting a store loads the channel tree.

**Channel + Collection tree (left panel)**
All channels for the selected store are listed. Each channel has an expand arrow — clicking it lazily fetches and shows the collections underneath. Clicking a channel or collection loads the matching instances in the right panel.

**Instance grid (right panel)**
Each card shows:
- Product thumbnail, title, and full folder path breadcrumb
- Base cost range from the master snapshot (`minPrice`–`maxPrice`)
- **Color swatches** — all available colors rendered as circles. Click to toggle enabled/disabled per listing. Saves immediately.
- **Size chips** — all available sizes rendered as tags. Click to toggle. Saves immediately.
- **Customer price** input — editable override, saves on blur or Enter.
- **Delete** with a two-step confirm.
- **Move to…** — opens an inline store / channel / collection picker. Confirm updates the instance's folder fields atomically (`storeId`, `channelId`, `collectionName`, `folderPath`).

**Backend changes**
- `GET /api/admin/catalog-instances` now accepts `storeId`, `channelId`, `collectionName`, and `folderPath` query params for server-side filtering. When folder filters are active, `orderBy` is dropped to avoid requiring Firestore composite indexes; results are sorted in memory.
- `PATCH /api/admin/catalog-instances/:id` now accepts top-level `enabledColors`, `enabledSizes`, `customerPrice`, and a `folderUpdate` object (allowlisted keys: `storeId`, `storeName`, `channelId`, `channelName`, `collectionId`, `collectionName`, `folderPath`). These are stored at the top level of the instance document, not in `overrides`.
- `DELETE /api/admin/catalog-instances/:id` — new route.

| File | Change |
|------|--------|
| `server/routes/admin-catalog-instances.routes.ts` | `GET` — added `storeId`, `channelId`, `collectionName`, `folderPath` filters; `PATCH` — added `enabledColors`, `enabledSizes`, `customerPrice`, `folderUpdate` top-level update support; `DELETE` — new route |
| `client/src/features/adminProducts/storeManager/StoreManagerTab.tsx` | New component — full role/store/channel/collection/instance management UI |
| `client/src/pages/admin-store-builder.tsx` | Added `Catalog` tab (default); imports `StoreManagerTab` |

---

### April 21, 2026 — Folder Path Naming (rev 18)

- **`selectedCollection` exposed in BuilderContext** — Added `selectedCollection: Collection | null` to `BuilderContextValue` interface and the `useMemo` return value so any module can read the selected folder.
- **Auto-title from folder path** — `CreateGraphicsModule` now uses a `useEffect` to auto-set `content.title` to the full folder path (`"StoreName / ChannelName / CollectionName"`) when the title is empty. This title flows into the graphic name, template name, and landing page slug for every packet created from that session.
- **`canCreate` gated on collection** — The Create Packet button is disabled (with a clear validation message) until a collection is selected, ensuring every packet has a meaningful folder path name.
- **`collectionId`, `collectionName`, `folderPath` in packet payload** — `useCreatePacket` now sends all three fields alongside the existing `storeId`/`storeName`/`channelId`/`channelName`.
- **`folderPath` on committed instance (CF)** — The Cloud Functions commit handler (`admin-build-sessions.ts`) reads `session.working.metadata.selectedStore/Channel/Collection`, composes the `folderPath` string, and stores `storeId`, `storeName`, `channelId`, `channelName`, `collectionId`, `collectionName`, and `folderPath` on every new `admin_catalog_instance` document. This enables Firestore queries like `.where('folderPath', '==', 'USA250 / Armed Forces')`.
- **Slug unchanged** — `landingPageSlug` remains `slugify(folderPath) + '-' + timestamp36` — human-readable path prefix with a unique hash suffix.
- **CF build ID** — `20260421-folder-path-on-instance-v3`

| File | Change |
|------|--------|
| `client/src/features/adminProducts/builder/BuilderContext.tsx` | `selectedCollection` added to interface + useMemo return |
| `client/src/features/adminProducts/builder/modules/CreateGraphicsModule.tsx` | useEffect auto-titles from full folder path; `canCreate` gated on collection; passes `selectedCollection` to `useCreatePacket` |
| `client/src/features/adminProducts/builder/modules/useCreatePacket.ts` | `selectedCollection` arg added; `collectionId`, `collectionName`, `folderPath` added to packet payload |
| `functions/src/routes/admin-build-sessions.ts` | Commit handler extracts folder context from `session.working.metadata`; stores 7 new fields on instance |

---

### May 2, 2026 — "Scan This → Go Here" section on product detail page

The shop product detail page now shows a visual "Scan this" section when a product has a built composite image and/or QR code. The section shows:
- The **composite graphic** (the image built in the wizard — QR + text, the correct one with content) as the main large image
- The **QR code** as a small overlay, positioned off-center to the right at the bottom
- A "→ Opens this" label
- If a `landingPageSnapshotUrl` also exists, a secondary "Goes here" preview below

The API was updated to return two new fields from the `productPackets` document for catalog instance products:
- `compositeUrl` — `pkt.compositeUrl || pkt.productGraphicUrl`
- `qrCodeUrl` — `pkt.qrOnlyUrl`

Previously `qrCodeUrl` was hardcoded `null` for catalog instance products and `compositeUrl` was never returned.

#### Files Changed
| File | Change |
|------|--------|
| `functions/src/routes/store-files.ts` | Read `pkt.compositeUrl`, `pkt.productGraphicUrl`, `pkt.qrOnlyUrl` from packet; return as `compositeUrl` + `qrCodeUrl` in catalog instance API response |
| `client/src/pages/shop-product.tsx` | Added `compositeUrl` to `StoreProduct` interface; replaced "Where it takes you" section with new "Scan this → go here" layout |
| `functions/src/index.ts` | Build ID bumped to `20260502-scan-this-composite-v3` |

---

### May 2, 2026 — Routing & Breadcrumb Fix (Shop → public storefront)

The breadcrumb "Shop" link was pointing to `/store` — the internal admin product config page — instead of the public storefront. Any public user clicking that crumb (or the footer "All Products" link, post-checkout "Back to Store" buttons, etc.) would land on an admin page. Fixed:

- `BreadcrumbTrail.tsx` — `/shop` override changed from `/store` → `/shop/internal/qrgear`
- `Footer.tsx`, `ActionCards.tsx`, `checkout-success.tsx`, `packet-success.tsx`, `customs.tsx` — all `/store` hrefs updated to `/shop/internal/qrgear`
- `App.tsx` — `/store` route wrapped in `AdminRoute` so it is no longer publicly accessible

Also added `landingPageSnapshotUrl` to the public store product API response (`store-files.ts`) so the "Where it takes you" section on the product detail page now displays the QR destination preview image stored on the packet.

#### Files Changed
| File | Change |
|------|--------|
| `client/src/components/BreadcrumbTrail.tsx` | `hrefOverrides["/shop"]` → `/shop/internal/qrgear` |
| `client/src/components/Footer.tsx` | "All Products" link → `/shop/internal/qrgear` |
| `client/src/components/ActionCards.tsx` | "View Store" link → `/shop/internal/qrgear` |
| `client/src/pages/checkout-success.tsx` | "Back to Store" → `/shop/internal/qrgear` |
| `client/src/pages/packet-success.tsx` | "Back to Store" → `/shop/internal/qrgear` |
| `client/src/pages/customs.tsx` | "Shop Now" → `/shop/internal/qrgear` |
| `client/src/App.tsx` | `/store` route wrapped in `AdminRoute` |
| `functions/src/routes/store-files.ts` | Reads `pkt.landingPageSnapshotUrl` and returns it as `landingPageSnapshotUrl` in catalog instance API response |
| `functions/src/index.ts` | `_BUILD_ID` bumped to `20260502-landing-snapshot-passthrough-v2` |

---

### May 2, 2026 — Mockup Image Write-Back Fix (per-color swatches)

When a new catalog instance item is added and mockup jobs are queued with `productId: 'packet_xxx'`, the background queue processor now writes the full `mockupsByColor` 3-level structure (`{ colorKey: { placementKey: { sizeKey: url, lifestyle: url } } }`) back to the `productPackets` document after each job completes. Previously only `priorityMockupUrl` (a single URL) was written, so per-color mockup swatches never appeared in the public store. Now `store-files.ts`'s `extractPacketMockups()` reads the correct data and serves per-color images to the storefront. A new `POST /admin/catalog-instances/:id/requeue-mockups` endpoint was also added to re-queue jobs for existing instances (e.g. Navy) that were created before this fix.

#### Files Changed
| File | Change |
|------|--------|
| `functions/src/routes/file-routes.ts` | `processQueueInBackground()` — after generating a mockup for a `packet_xxx` job, now also writes `mockupsByColor.{colorKey}.{placementKey}.{sizeKey}` and `.lifestyle` to `productPackets` doc |
| `functions/src/routes/admin-catalog-instances.ts` | New `POST /admin/catalog-instances/:id/requeue-mockups` endpoint — re-queues mockup generation jobs for all (or specified) colors on an existing instance's packet |
| `functions/src/index.ts` | `_BUILD_ID` and `labels['build-id']` bumped to `20260502-mockup-color-writeback-v1` to force Cloud Run redeployment |

---

### April 8, 2026 — Security & Trust-Boundary Pass (Task #9)

- **Member route auth hardened** — All `/member/*` body-based routes now use `requireAuth` middleware + UID match (`packets`, `graphics/create`, `templates/save`, `library-links`, `play-packets`, `publish`, `share-card`). All `/members/:memberId/*` URL-param routes now use `verifyMemberAuthCF` JWT check (`packets`, `library`, `library/upload`, `library/crop`, `videos/upload`).
- **Upload constraints added** — MIME type allowlists enforced on `POST /images/upload` (PNG, JPEG, WebP, GIF, SVG), `POST /uploads/request-url` (images + video), and member library uploads. 25MB size limit on all image upload endpoints. Filename sanitization on `uploads/request-url`.
- **referrerId validation** — `POST /public/packet-checkout` now validates `referrerId` against the `users` collection before accepting it; invalid values are silently dropped with a server warning log.
- **CF deployed** — All fixes verified on production (`qrgear-c1ffd`): unauthenticated requests to `/images/upload`, `/member/packets`, `/uploads/request-url` all return 401.

### April 8, 2026 — Layout Mode & Legacy Cleanup

- **"Structured" renamed to "Zone"** — All references to `'structured'` layout mode renamed to `'zone'` across client and Cloud Functions (`composite-image.ts`). No backward compatibility shim; clean rename only.
- **"replace-qr" mode removed** — The legacy `replace-qr` QR safety status has been fully removed from all client code (`ProductGraphicTextModule.tsx`, wizard files, context types).
- **Layout Mode Choice step added** — New `LayoutModeChoiceStep` component in `TextSteps.tsx` lets users pick between Zone (30/40/30 bands) and Freeform (full safe rect) layout modes. Wired into all 4 wizard files: `SimpleWizardProductSteps`, `AdvancedWizardProductSteps`, `wizard-steps-product`, `OwnerWizardStepContent`.
- **`graphicLayoutMode` state threaded** — Added to `WizardContext`, `wizard-context-types`, `useOwnerWizardState`, and `OwnerWizard`. Passed through to `HeaderTextEditStep`, `FooterTextEditStep`, `ShirtPreviewStep`, and all `GraphicPreviewView` call sites.
- **Wizard flow updated** — `generate` → `layout-mode` → `text-choice` → text editing. The `'layout-mode'` step added to `SimpleWizardStep` type and all step arrays.
- **CF deployed** — Cloud Functions redeployed to Firebase production (`qrgear-c1ffd`) with zone rename.

### April 7, 2026 — QR Layout & Favicon

- **Product graphic renderer** — Zones now size to 0 when inactive (header/footer/sub-bottom); QR middle zone gets all remaining space; sub-bottom text renders in its own zone below QR
- **QR slider UX** — Range 40–85, step 2; preset buttons S(48)/M(56)/L(64)/XL(72); semantic labels; default 70%
- **Favicon** — QR Gear "Q" logo as favicon.ico (multi-size), favicon.png, apple-touch-icon.png (180x180)
- **Folder persistence** — Both `handleCreateFolder` functions check `res.ok`, refetch from server on success, show inline error on failure; Cloud Functions folder endpoint has case-insensitive duplicate detection, normalizedName field, 80-char max validation

### May 2, 2026 — Member Library Instance UI (Item #3)

Built the complete member-facing library UI on top of the already-finished backend.

#### Files Changed
| File | Change |
|------|--------|
| `client/src/pages/member-library.tsx` | New page at `/members/library` — grid of pushed library items, slide-in edit panel, auth guard, empty/error states |
| `client/src/App.tsx` | Added `/members/library` route (ProtectedRoute, requireAdmin: false) |
| `client/src/features/members/member-index-view.tsx` | Added "My Library" indigo CTA strip linking to `/members/library`; added `Library` + `useLocation` imports |

#### Key Design Decisions
- Uses `memberApiFetch` (inline helper) calling `/api/member/library-instances` directly — not `memberFetch` which would incorrectly prepend `/api/members`
- Edit panel is a fixed right-side drawer with backdrop; member edits title + description; overrides merged server-side via `resolveInstance`; master catalog and admin instance never touched
- "Personalized" badge on any item that has at least one override saved
- Reset button appears only when the item has active overrides; clears them back to the admin-resolved defaults
- Dark tech theme matches existing member hub (slate-900 bg, slate-800/50 cards, blue accents)

### May 2, 2026 — Phone Mockup Experience Card + Deploy Infrastructure

Replaced the static "Scan this / Goes here" section on the store product page with a polished two-phone animated card. Also hardened the Firebase deploy process with three-step scripts and consistent skill documentation.

#### Files Changed
| File | Change |
|------|--------|
| `client/src/components/PhoneMockupCard.tsx` | New component — two overlapping phone frames (small QR phone + large destination phone), animated entrance, color-coded glow per product type, scan-line animation, video/cycling-image/snapshot support |
| `client/src/pages/shop-product.tsx` | Replaced "Scan this → Goes here" block with `<PhoneMockupCard>`, added `playMediaUrl` and `composeImages` to `StoreProduct` interface, removed unused `ArrowRight` import |
| `deploy/1-build.sh` | New script — bumps `_BUILD_ID` with timestamp+random, builds frontend and functions |
| `deploy/2-functions.sh` | New script — deploys Cloud Functions only (90s timeout budget) |
| `deploy/3-hosting.sh` | New script — deploys Firebase Hosting only (60s timeout budget) |
| `.agents/skills/always-deploy/SKILL.md` | Updated to three-step methodology with deploy scripts |
| `.agents/skills/ask-before-starting/SKILL.md` | Removed broken combined deploy command, referenced always-deploy skill |
| `REPLIT.md` | Added READ SKILLS FIRST banner at top, updated deploy instructions throughout |
| `README.md` | Updated Firebase Deployment section to three-step scripts |

### May 3, 2026 — QRG Model Number on Store Product Page (Item #6)

Surfaces the QRG model number (e.g. `QRG-11101-I-000001`) directly on the store product page below the product title. The model number is written to Firestore at commit time via the shared allocator — this wires it through the API response and renders it as small mono muted text with a `data-testid="text-model-number"` attribute.

#### Files Changed
| File | Change |
|------|--------|
| `functions/src/routes/store-files.ts` | Added `qrgBaseCode: resolved.qrgBaseCode \|\| null` to catalog-instances product API response |
| `client/src/pages/shop-product.tsx` | Added `qrgBaseCode?` to `StoreProduct` interface; conditional `Model: {qrgBaseCode}` render below title |

---

### May 2, 2026 — Variant Selection Enforcement + QRG Barcode Suffix (Item #5)

Enforces that customers must select both color and size before adding to cart. On attempt without a selection, the missing selector gets a red ring and inline error text; the page scrolls to the first missing one. Clears automatically on pick. Also introduces the QRG variant suffix (`{X}{CC}`) attached to every cart item for fulfillment barcode generation.

#### Files Changed
| File | Change |
|------|--------|
| `shared/qrgCodes.ts` | New — `SIZE_DIGIT_MAP` (S=3 … 2XL=7), `COLOR_CODE_MAP` (01–99 for all platform colors), `buildVariantSuffix(size, color)` helper |
| `client/src/pages/shop-product.tsx` | `colorError`/`sizeError` state + refs; validation in `handleAddToCart`; error ring + inline label text on color/size selectors; `onSizePick` clears `sizeError`; `variantSuffix` attached to cart customization |

---

### May 3, 2026 — Brand + Model Subtitle Display + Master Catalog Enrichment Attempts

#### Overview

Two goals were pursued in this session:
1. **Brand + model subtitle on admin Blanks page** — DONE and deployed to production.
2. **Master catalog enrichment** — populate `printPositions`, `printSizes`, `colors`, `sizes`, and `prices` on all 1,592 Firestore `master_catalog` docs by calling Printful and Printify provider APIs — **BLOCKED by Printful API hangs**. Status as of end of session: 2 docs enriched out of 304 T-Shirts attempted. Full explanation of what was tried is below.

---

#### Goal 1: Brand + Model Subtitle Display (COMPLETED + DEPLOYED)

**Problem:** The admin Blanks page (`/admin/blanks`) showed product cards with only a generic category title (e.g. "T-Shirt"). Admins could not tell at a glance which specific blank they were looking at — a Bella+Canvas 3001 and a Gildan 5000 both just said "T-Shirt".

**Fix:** Added brand + model as a subtitle line under the product title on both the scroll/browse card view and the admin catalog skin view. Also added manufacturer to the product detail modal.

**What changed exactly:**
- `NormalizedSourceBlank` interface in the controller got a new `model` field.
- `normalizeSourceBlank()` maps `doc.model` → `model` on the interface.
- `scrollItems` subtitle computation now joins `brand + " " + model` (e.g. `"Bella+Canvas 3001"`).
- `ProductSelectCardSkin` renders the subtitle as a small gray line below the title, and the modal's "Manufacturer" row now shows brand + model together.
- `AdminCatalogBlankSkin` renders the subtitle below the title in a smaller muted color.
- `catalogItems` mapping in the controller passes `subtitle` through to the skin.

**Files changed:**
| File | Change |
|------|--------|
| `client/src/features/adminProducts/controllers/useAdminBlanksController.ts` | Added `model` to `NormalizedSourceBlank`, set in `normalizeSourceBlank`, joined brand+model into `subtitle` for `scrollItems` and `catalogItems` |
| `client/src/features/shared/components/skins/ProductSelectCardSkin.tsx` | Added `model` prop, renders brand+model subtitle line below title, updated modal manufacturer row |
| `client/src/features/shared/components/skins/AdminCatalogBlankSkin.tsx` | Added `subtitle` prop, renders it below title |

**Deployed:** Yes — full three-step Firebase deploy (build → functions → hosting) completed successfully.

---

#### Goal 2: Master Catalog Enrichment (IN PROGRESS — BLOCKED)

**What enrichment means:** Each of the 1,592 `master_catalog` Firestore documents has `providerMappings[]` (which tells us which Printful product ID or Printify blueprint ID maps to this blank). Enrichment means calling each provider's API to fetch real `printPositions`, `printSizes` (canvas dimensions per placement), `colors`, `sizes`, and price ranges — and writing them back to Firestore so the admin UI and product builder have accurate data without hitting the provider APIs at build time.

---

#### Attempt 1: Simple background task, single category

**What was tried:** Initial enrichment route spawned a background `setImmediate` loop that processed T-Shirts (304 docs) in batches of 8 concurrent docs, calling Printful's `getPrintfiles()` and Printify's blueprint printproviders API per doc.

**What happened:** The Cloud Function default timeout (60 seconds) killed the job before it could finish even one batch. Confirmed: function timed out with 0 docs enriched.

**Fix attempted:** Raised Cloud Function `timeoutSeconds` to 540 seconds in `functions/src/index.ts`.

---

#### Attempt 2: Raised timeout to 540s, loop all 32 categories

**What was tried:** Route now starts a background task that loops all 32 categories sequentially, writing `currentCategory` / `categoryIndex` progress back to Firestore after each category finishes, so progress is observable without polling the CF directly. Timeout raised from 60s → 540s.

**What happened:** Job `kciHBJth5NnomOEDPhTL` — still stalled on T-Shirts. Root cause identified: `printfulClient.request()` calls `fetch()` with no timeout option. Node.js `fetch` has no built-in timeout. Printful's API was hanging with zero response — the `fetch` call would sit open indefinitely. With BURST_SIZE=8 concurrent docs and each one waiting forever on Printful, the burst never resolved and the entire job froze. Only 2 docs enriched in 10+ minutes.

---

#### Attempt 3: Per-call 25s timeout + 3 retries with backoff

**What was tried:** Wrapped every provider API call in a `withTimeout(25_000)` helper using `Promise.race([apiCall(), new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 25000))])`. Added `fetchWithRetry` with 3 retries and exponential backoff (2s → 4s → 8s). Also raised `timeoutSeconds` to 3600 (1 hour) in `functions/src/index.ts` and deployed updated functions.

**What happened:** New job `HcCJcMBtQTQeI3YgajeP` triggered at 23:17:42 UTC. Monitored at 2-minute and 4-minute marks:
- At 2 min: still on category 1 (T-Shirts), `categoryIndex: 1`
- At 4 min: still on T-Shirts, **only 2 docs enriched** (confirmed via Firestore query filtering `lastEnrichedAt > job start time`)

**Root cause analysis:** With 3 retries × 25s timeout + exponential backoff, a doc where Printful hangs every time costs: `25 + 2 + 25 + 4 + 25 + 8 = 89 seconds` before being skipped. With BURST_SIZE=8 concurrent docs and nearly all hanging, each burst takes ~89 seconds and yields close to zero enriched docs. T-Shirts has 304 docs → at this rate the T-Shirts category alone would take ~3,400 seconds (nearly an hour) and the full 1,592 docs would take many hours.

**The underlying Printful problem:** The `getPrintfiles()` endpoint (`/mockup-generator/printfiles/:productId`) appears to respond extremely slowly or not at all from the Cloud Run environment. This is not a rate-limit error (which would return an HTTP response) — it is a network-level hang where the connection opens but no bytes are returned within 25 seconds. Whether this is a GCP egress issue, a Printful API change, or an environment-specific block is unknown.

---

#### What Files Were Touched for the Enrichment Work

| File | What Changed |
|------|-------------|
| `functions/src/index.ts` | `timeoutSeconds` raised from default → 540 → 3600; `_BUILD_ID` bumped each deploy |
| `functions/src/services/master-catalog.ts` | Added `QRG_TOP_LEVEL_CATEGORIES`, `QRG_BLANK_CATEGORIES` (full 32-category 4-digit scheme); added `withTimeout()` helper; rewrote `fetchWithRetry()` with per-call 25s timeout + 3 retries + exponential backoff; `enrichMasterCatalog()` accepts `categoryFilter` param to limit scope |
| `functions/src/routes/master-catalog.ts` | `POST /admin/master-catalog/enrich` route now spawns a background task that loops all 32 categories sequentially; writes `currentCategory` / `categoryIndex` / `categoryTotal` progress fields to `master_catalog_syncs` Firestore doc after each category; job status (`running` / `completed` / `failed`) tracked in same doc |
| `scripts/enrich-by-category.cjs` | Standalone monitoring script (Node.js CJS) — mints a Firebase custom token, exchanges it for an ID token, hits the enrich endpoint, and polls the Firestore job doc every 30 seconds printing progress. Not used in production — was an interim debugging tool before the server-side loop approach was adopted. |

---

#### Jobs Run (All Cancelled / Timed Out Except Current)

| Job ID | Status | Notes |
|--------|--------|-------|
| `kciHBJth5NnomOEDPhTL` | `timed_out` | Attempt 1 — no per-call timeout, function timed out at 540s |
| `BqO2tvEPQm6piXxBpaT3` | `cancelled` | Cancelled manually after confirmed stall |
| `KHuPDRFzjoFoAIQ1jsVE` | `cancelled` | Cancelled manually after confirmed stall |
| `EnGTdCwd0uVIeK9S3L4G` | `cancelled` | Cancelled manually after confirmed stall |
| `HcCJcMBtQTQeI3YgajeP` | `running` | Current — 3600s timeout, 25s per-call timeout, 3 retries; still on T-Shirts at 4min mark, only 2 docs enriched |

---

#### Current State

- Job `HcCJcMBtQTQeI3YgajeP` is still running (Cloud Function timeout = 3600s so it has up to 1 hour).
- Printful `getPrintfiles()` API is hanging on nearly every call even with the 25s timeout guard.
- **Net enrichment: 2 out of 304 T-Shirt docs** as of 23:22 UTC May 3, 2026.
- The enrichment infrastructure (background task, sequential category loop, progress tracking, retry logic) is all in place and deployed — the bottleneck is exclusively the Printful API response time.

---

#### Recommended Next Steps for Enrichment

1. **Skip Printful entirely for `printPositions`/`printSizes`** — use only Printify's blueprint API (which does respond) and populate those fields from Printify data only.
2. **Or use cached `printful_products` Firestore collection** — if a prior sync already stored variant/printfile data in `printful_products`, query that collection directly instead of hitting the live Printful API.
3. **Or reduce BURST_SIZE to 1** and add a 2-second delay between docs to stay well under any rate limit, accepting that enrichment takes hours but runs reliably.
4. **Check Cloud Run → Printful network path** — it is possible GCP Cloud Run cannot reach Printful's mockup-generator endpoints without a proxy or VPC connector.

---

### May 2, 2026 — Live Color Mockup Swap on Store Product Page (Item #4)

When a customer picks a color from the store product page dropdown, the gallery now swaps immediately if that color's mockup is cached, or shows a spinner overlay while fetching a fresh mockup on demand.

#### Files Changed
| File | Change |
|------|--------|
| `functions/src/routes/store-files.ts` | New public `POST /store/product/:linkId/mockup-for-color` endpoint — cache check (3-level mockupsByColor → placement → size) → on miss, generates via `generateMockupFromPrintful` using packet fields, writes result back to packet |
| `client/src/pages/shop-product.tsx` | `localMockupsByColor` state seeded from API, enriched on-demand; `handleColorChange` replaces bare `setSelectedColor`; `mockupFetching` spinner overlay on gallery Card; `galleryImages` useMemo uses local cache |

---

### March 2026 — Builder Family Unification (Task #7)

- Unified admin builder and member builder into shared harness/context pattern
- Shared wizard steps across admin and member flows
- QR safety meter added to builder
- Description cascade system implemented
- Store builder restructured with channel/catalog/assignment modules

### Earlier — Tasks #2–#6

- Order & checkout unification
- External sites transaction closure with embed validation
- Client-side file splits for performance
- Admin UX shell adoption (Shadcn sidebar)
- Store builder restructure

---

## QRG Blank ID System (STNNN Catalog Identity)

Every blank product in the `master_catalog` Firestore collection is identified by a canonical **Firestore doc ID** in the format `qrg_STNNN` (e.g. `qrg_11001`). This is the permanent, provider-agnostic identity for a blank type — the physical product before any design is applied. It is separate from the QRG product serial number system (which tracks customer-owned items).

### Current Format: qrg_STNNN

```
qrg_ S  T  N  N  N
     │  │  └──┴──┴── Item number within type (001–999)
     │  └──────────── Product type within super-category (1–9)
     └─────────────── Super-category (1–6)
```

**Example:** `qrg_11001` = super-category 1 (Apparel), type 1 (T-Shirts), item 001

**Valid range:** `qrg_11001` – `qrg_69999`

**Validation:** `isValidMasterCatalogDocId()` in `shared/qrgCodes.ts` and `isQRGBlankId()` in `shared/blankKeys.ts`

**Top-level super-categories (S digit):**

| S | Super-Category |
|---|----------------|
| 1 | Apparel |
| 2 | Houseware |
| 3 | Print & Display |
| 4 | Accessories |
| 5 | Pet Products |
| 6 | Holiday & Seasonal |

**Product type ranges (ST prefix — first two digits of STNNN):**

| ST | Subcategory |
|----|-------------|
| 11 | T-Shirts |
| 12 | Hoodies & Sweatshirts |
| 13 | Bottoms & Active |
| 14 | Hats & Caps |
| 15 | Footwear & Socks |
| 16 | Sleepwear & Underwear |
| 17 | Baby & Kids |
| 21 | Drinkware |
| 22 | Barware |
| 23 | Drinkware Accessories |
| 24 | Kitchen & Dining |
| 25 | Bedding & Textiles |
| 26 | Home Décor |
| 31 | Wall Art & Prints |
| 32 | Stickers & Magnets |
| 33 | Stationery & Paper |
| 34 | Signs & Display |
| 35 | Books & Photo |
| 36 | Pins & Patches |
| 37 | Tags |
| 38 | Puzzles & Games |
| 39 | Novelty |
| 41 | Bags & Pouches |
| 42 | Jewelry |
| 43 | Phone & Tech Cases |
| 44 | Travel Accessories |
| 45 | Small Accessories |
| 51 | Pet Apparel |
| 52 | Pet Accessories |
| 61 | Holiday Apparel |
| 62 | Holiday Décor |
| 63 | Seasonal Items |

### Firestore Fields

Each `master_catalog` document stores:
- Doc ID — `qrg_STNNN` string (e.g. `qrg_11001`) — this IS the blank identity
- `qrgBlankId` — the STNNN number as a string (e.g. `"11001"`) for field queries
- `qrgCategory` — human-readable subcategory name, e.g. `"T-Shirts"`
- `qrgParentCategory` — parent name, e.g. `"Apparel"`

### Provider IDs: Lookup/Reference Only

Provider IDs (`py_NNN`, `pf_NNN`, `pf:NNN`, plain numeric) identify blanks within Printify or Printful's systems. They are **lookup/reference metadata only** and must never be stored as catalog identity:

- `catalog.blankIds` must contain only `qrg_STNNN` doc IDs
- All overlay submaps (`blankTiers`, `blankDescriptions`, `blankTitles`, `blankMakers`, `blankModels`, `blankProviders`, `blankImages`, `blankPrimaryImages`) must use the same `qrg_STNNN` keys as `blankIds`
- The `resolveCatalogBlankId()` helper in `server/routes/admin-catalogs-shelf.routes.ts` accepts any provider key as input and returns the canonical `qrg_STNNN` before any write

Provider IDs may still be used in the frontend product map for display lookups and to index into `allProductMap` for rendering — they just cannot be persisted as catalog identity.

### Legacy Formats (Invalid)

The following formats are **not valid** under the current STNNN law:
- `qrg_NNN` (3-digit, e.g. `qrg_101`) — earliest scheme, predates categories
- `qrg_STNN` (4-digit, e.g. `qrg_1101`) — intermediate scheme, only 99 items per type

Both return `false` from `isQRGBlankId()`. Existing Firestore catalog documents containing these legacy keys require a separate migration (not auto-migrated).

### How It Relates to the QRG Serial Number System

These are two different systems that share the "QRG" prefix:

| System | Purpose | Example |
|--------|---------|---------|
| **Blank doc ID** (`qrg_STNNN`) | Identifies the *type* of printable blank in master_catalog | `qrg_11001` = "Bella+Canvas 3001 T-Shirt" |
| **QRG base code** (`QRG-[STNNN]-[C]-[NNNNNN]`) | Identifies a specific *built product* with design + context | `QRG-11001-I-000001` = internal catalog instance |
| **QRG full code** (`QRG-[STNNN]-[C]-[NNNNNN]-[SSCC]`) | Adds size+color variant suffix | `QRG-11001-I-000001-0502` = Large/White |

The blank doc ID is the catalog key. The serial number is the product identity key. They are related but distinct.

---

## QRG Identity Schema — Full Stack Enforcement (May 4, 2026)

### What was enforced and why

The QRG law defines two canonical code formats:

```
Base:  QRG-[STNNN]-[C]-[NNNNNN]
Full:  QRG-[STNNN]-[C]-[NNNNNN]-[SSCC]
```

Allowed contexts: `I` = Internal, `M` = Member, `E` = External, `O` = Owner.

No DDD segments. No buildStr. No provider IDs embedded in the code. No fake or pending codes invented by any layer of the stack.

Every violation below was introduced when an earlier iteration of the builder tried to allocate or display QRG codes client-side, copy stale codes from packet to instance, or invent placeholder codes when no real identity existed. The fixes below remove all of those paths and enforce a single authoritative flow: the shared server-side allocator is the only source of QRG identity.

---

### Completed fixes — backend

#### `functions/src/services/qrg-instance-allocator.ts` (NEW)
Single shared atomic allocator. Every instance creation path — admin commit, member push, owner registration, external claim — calls this one function. It validates `qrgBlankId`, increments the Firestore counter in a transaction, and returns `{ qrgBlankId, qrgContext, instanceNumber, qrgBaseCode, variantCode, qrgFullCode }`. Nothing else in the stack generates QRG codes.

**Why:** Previously each route had its own inline allocator or counter increment, producing inconsistent field names and stale codes leaking between instances.

#### `functions/src/routes/admin-catalog-instances.ts`
- Removed local `allocateQrgInstanceNumber` function entirely
- Both admin instance creation (context `I`) and push-to-member (context `M`) now delegate to the shared allocator
- Renamed `qrgPacketCode` → `qrgBaseCode` everywhere; added `variantCode` and `qrgFullCode`
- Fail-loud (HTTP 400) when `qrgBlankId` is missing — no silent skip
- `backfill-all-images` and `rebuild-images` routes: read `pkt.qrgBaseCode || pkt.qrgPacketCode` (backward compat for existing docs), write `resolved.qrgBaseCode`, return `qrgBaseCode` in response

**Why:** Old code copied `pkt.qrgId` (stale, wrong field name) into `resolved.qrgId` on new instances, letting prior-run packet codes bleed across instance boundaries.

#### `functions/src/routes/admin-build-sessions.ts`
- Removed the `packetQrgId` read block that read `pkt.qrgId` from the prior packet and stamped it into `resolved.qrgId` on the new instance
- The commit route already allocates a fresh `qrgBaseCode` via the shared allocator (written at the top level of the Firestore document). The stale copy was overwriting it with the wrong field name.
- `/admin/qrg/allocate` HTTP endpoint delegates to the shared allocator and returns `qrgBaseCode`

**Why:** Every build session commit was creating a new instance with a correct top-level `qrgBaseCode` but then also writing a stale `resolved.qrgId` from the previous packet, which downstream readers (store API, marketplace push) would find first.

#### `functions/src/services/surface-generator.ts`
- `deriveSkuFromInstance()` reads `qrgBaseCode` first, then `qrgPacketCode` (backward compat), then reconstructs from `qrgBlankId + qrgContext + instanceNumber` if all three are present
- Throws loudly with a descriptive error if none of those paths yield a valid code
- Removed all `QRG-PENDING` / `QRG-UNASSIGNED` fallbacks

**Why:** The old generator silently returned a fake sentinel code (`QRG-UNASSIGNED-*`) rather than failing. This let malformed instances reach the marketplace push layer and produce invalid SKUs.

#### `functions/src/routes/marketplace.ts`
- Amazon, eBay, and Etsy push endpoints all return HTTP 400 if no valid QRG code or SKU exists
- No invented codes

**Why:** Old push routes would construct a placeholder SKU from the surfaceId when no real code existed, publishing garbage to live marketplaces.

#### `functions/src/routes/store-files.ts`
- Product detail API response field renamed: `qrgId` → `qrgBaseCode: resolved.qrgBaseCode || resolved.qrgPacketCode`

**Why:** The storefront was reading `qrgId` which was only written by the old stale-copy path. New instances written by the allocator only have `qrgBaseCode` at the top level.

---

### Completed fixes — client (admin/products builder flow)

#### `client/src/features/adminProducts/builder/BuilderContext.tsx`
- `fetchOptionsForProduct` calls `GET /api/admin/master-catalog/products/:docId/options`
- Hydrates `selectedProduct` with `qrgBlankId`, `qrgVariants`, `printLocations`, `placements`, `providerMappings`, `optionsLoaded` from the response
- No call to `/catalog/placements` anywhere in the builder
- Race-guarded by `docId` so navigating products quickly never applies stale options

**Why:** An earlier version called the Printify-facing `/catalog/placements` endpoint directly, which returns provider blueprint placements rather than QRG-native print locations. This caused the packet to carry the wrong placement geometry and provider IDs.

#### `client/src/features/adminProducts/builder/modules/useCreatePacket.ts`
Packet payload now includes:

| Field | Source |
|-------|--------|
| `sourceMasterId` | `selectedProduct.docId` |
| `qrgBlankId` | `selectedProduct.qrgBlankId` |
| `qrgVariants` | `selectedProduct.qrgVariants` |
| `placements` | `selectedProduct.printLocations \|\| selectedProduct.placements` |
| `selectedPlacements` | `state.selectedPlacements` (user's chosen subset) |
| `availableSizes` | `selectedProduct.availableSizes` |
| `availableColors` | `selectedProduct.availableColors` |

Packet payload does **not** generate: `qrgBaseCode`, `qrgFullCode`, `instanceNumber`. Those belong exclusively to the server-side allocator.

**Why:** Old code had `placements: state.selectedPlacements` (the user's subset, not the product's capabilities) and was missing `qrgVariants` entirely, so the backend commit route had no variant map to work with.

#### `client/src/features/adminProducts/builder/modules/ProductsModule.tsx`
- Removed `qrgId={rawProduct.qrgId}` prop pass to `ProductSelectCardSkin`

**Why:** Master catalog products have no QRG instance identity — only committed instances do. The prop was reading a field that doesn't exist on master products and passing it to a skin that didn't render it.

#### `client/src/features/shared/components/skins/ProductSelectCardSkin.tsx`
- Removed `qrgId?: string` from the props interface and function destructuring

**Why:** The prop was accepted but never rendered. Removing it closes the door on callers passing stale codes that would silently go nowhere.

#### `client/src/pages/shop-product.tsx`
- `StoreProduct.qrgId` → `StoreProduct.qrgBaseCode`
- Render: `Model: {product.qrgBaseCode}`

#### `client/src/pages/my-item.tsx`
- `ClaimedInstance.qrgId` → `ClaimedInstance.qrgBaseCode`

#### `client/src/pages/account.tsx`
- Renders `instance.qrgBaseCode` with a fallback to `instance.qrgId` for Firestore documents written before the migration

#### `client/src/pages/marketplaces-accounts.tsx`
- Removed all three `placeholder={\`Auto: QRG-${surfaceId.slice(0, 8)}\`}` patterns across Amazon, eBay, and Etsy push dialogs
- Replaced with `"Leave blank to auto-assign from surface SKU"`

**Why:** The placeholder was constructing a fake QRG-prefixed string from a Firestore document ID, which has nothing to do with the QRG schema. It would mislead operators into thinking a real code had been assigned.

---

### Acceptance test results (live production — build 20260504-155213-3294)

| Test | Result |
|------|--------|
| Context I (Internal) allocation | `QRG-11101-I-000003` ✓ |
| Context M (Member) allocation | `QRG-11101-M-000001` ✓ |
| Context O (Owner) allocation | `QRG-11101-O-000001` ✓ |
| Context E (External) allocation | `QRG-11101-E-000001` ✓ |
| `/catalog/placements` called from builder | Not called ✓ |
| `QRG_BLUEPRINT_BLANK_CODES` in useCreatePacket | Absent ✓ |
| `/qrg/allocate` called from client | Not called ✓ |
| `qrgBaseCode` in packet payload | Present ✓ |
| `qrgVariants` in packet payload | Present ✓ |
| `qrgBaseCode` generated client-side | Never ✓ |
| `QRG-PENDING` / `QRG-UNASSIGNED` in surface-generator | Absent — throws instead ✓ |
| Marketplace push invents QRG from surfaceId | Never — HTTP 400 instead ✓ |

---

## Known Issues & Next Steps

### Legacy Blank ID Migration — resolved (May 2026)

Catalog documents written before Task #25's enforcement of `qrg_STNNN` identity may still contain provider-style blank IDs (`py_NNN`, `pf_NNN`, plain numerics) in `blankIds` and the eight overlay maps. A one-click migration tool is now available at **System → Settings → Catalog ID Migration**. Running it once will resolve and re-key all documents. IDs that cannot be resolved to a `master_catalog` entry are flagged in the report for manual review and are never silently dropped.

### Draft Resume: "Product not resolved" on sessions saved before April 19, 2026

Sessions created before the double-`/admin/` URL fix (April 19, 2026) never successfully autosaved their working state to Firestore — those PATCH calls were 404ing. When those sessions are resumed, the product resolution now works correctly (the catalog URL and ID-matching bugs are fixed), but if a session's `working` snapshot is empty and the packet data is also absent, the builder has nothing to restore and may still show the warning toast.

**Workaround:** Delete the old session from the Run panel (trash icon → confirm) and start a fresh session from the same product in the builder. Going forward, autosave and resume work correctly.

### QR Layout Proportions
The content-aware renderer works but the zone proportions (header 20%, footer 16%) may still be larger than desired. The user's preferred values are header 13%, footer 9%, with a max QR clamp of 82%.

### UnifiedGraphic.tsx Stale Imports
`UnifiedGraphic.tsx` still imports `ZONE_LAYOUT` and references `QR_MARGIN_PERCENT`/`QR_AREA_PERCENT` — these are pre-existing references that don't break the build but should be cleaned up.

### Remaining Tasks
- **Task #8:** Marketplace Domain Hardening
- **Task #9:** Security & Trust-Boundary Pass
- **Task #10:** Test Coverage Expansion
- **Task #11:** Legacy Naming & Compatibility Cleanup (partially done — "structured" → "zone" rename and "replace-qr" removal completed April 8)

### Marketplace Surfaces — Next Candidates

The following marketplace integrations are queued for future builds, in rough priority order. Each follows the same OAuth + push pattern already used by Amazon, eBay, and Etsy.

| Priority | Marketplace | Why it fits | API notes |
|---|---|---|---|
| 1 | **TikTok Shop** | Fastest-growing channel; Gen Z audience overlaps well with custom/novelty QR apparel; high viral potential | Full Seller API with OAuth + product listing push |
| 2 | **Walmart Marketplace** | Second-largest US marketplace; similar REST + OAuth pattern to Amazon SP-API; reaches buyers who avoid Amazon | Seller Center API; requires approval to sell |
| 3 | **Google Shopping (Merchant Center)** | High-intent traffic across Search, Shopping tab, and YouTube; broad reach | Content API v2.1; feed-based rather than OAuth; no per-listing push — syncs a product catalog feed |
| 4 | **Meta Commerce (Facebook + Instagram Shops)** | Single API surfaces products on both platforms; strong for visual products and retargeting; Instagram well-suited for apparel | Commerce Manager API; OAuth; catalog-based |
| 5 | **Pinterest Shopping** | Discovery-mode audience skews toward apparel, accessories, and gifts; Catalogs API | Feed-based catalog push; Pinterest Ads API for boosting |
| 6 | **Redbubble / Teepublic** | POD marketplaces with their own built-in audiences; since Printify/Printful already handle fulfillment, designs can be pushed to their storefronts too | Limited/unofficial APIs; may require partner agreement |
