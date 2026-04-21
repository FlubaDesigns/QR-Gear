# QR Gear — Admin Section Guide

Last updated: April 21, 2026 (rev 11)

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

## Known Issues & Next Steps

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
