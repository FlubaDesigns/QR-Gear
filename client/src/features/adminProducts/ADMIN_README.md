# QR Gear — Admin Section Guide

Last updated: April 8, 2026

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

**Route:** `/admin`

The dashboard is the central hub. From here you can access:

| Section | Route | Purpose |
|---------|-------|---------|
| Products | `/admin/products` | Create/edit product graphics and manage catalog |
| Library | `/admin/library` | Manage uploaded images, backgrounds, templates |
| Store Builder | `/admin/store-builder` | Configure storefronts and assign products |
| Store Library | `/admin/store-library` | Browse existing stores and channels |
| Orders | `/admin/orders` | View and manage customer orders |
| Customers | `/admin/customers` | View registered members |
| Pricing | `/admin/pricing` | Set pricing rules and margins |
| Categories | `/admin/categories` | Organize products into categories |
| Dynamics | `/admin/dynamics` | Configure QR dynamic content |
| Settings | `/admin/settings` | Platform-wide settings |
| Health | `/admin/health` | System health monitoring |
| Orchestration | `/admin/orchestration` | Bulk operations, analytics, routing |
| External Sites | `/admin/external-sites` | Manage embedded product widgets |
| Email Templates | `/admin/email-templates` | Configure automated emails |
| Gifts | `/admin/gifts` | Gift card and gift flow management |
| Partners | `/admin/partners` | Partner/referral management |
| Videos | `/admin/videos` | Video content management |
| Fonts | `/admin/fonts` | Custom font management |
| Backgrounds | `/admin/backgrounds` | Background image management |

---

## Product Builder

**Route:** `/admin/products` → click a product → Builder opens
**Key files:**
- `client/src/features/adminProducts/builder/BuilderContext.tsx` — State management for the builder
- `client/src/features/adminProducts/builder/BuilderHarness.tsx` — Main builder container
- `client/src/features/adminProducts/builder/modules/` — All builder modules

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

### QR Layout Proportions
The content-aware renderer works but the zone proportions (header 20%, footer 16%) may still be larger than desired. The user's preferred values are header 13%, footer 9%, with a max QR clamp of 82%.

### UnifiedGraphic.tsx Stale Imports
`UnifiedGraphic.tsx` still imports `ZONE_LAYOUT` and references `QR_MARGIN_PERCENT`/`QR_AREA_PERCENT` — these are pre-existing references that don't break the build but should be cleaned up.

### Remaining Tasks
- **Task #8:** Marketplace Domain Hardening
- **Task #9:** Security & Trust-Boundary Pass
- **Task #10:** Test Coverage Expansion
- **Task #11:** Legacy Naming & Compatibility Cleanup (partially done — "structured" → "zone" rename and "replace-qr" removal completed April 8)
