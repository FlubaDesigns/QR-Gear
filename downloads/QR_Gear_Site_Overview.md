# QR Gear — Full Site Overview & Architecture Reference

**Last Updated:** April 19, 2026  
**Live Site:** https://qrgear-c1ffd.web.app  
**Project ID:** qrgear-c1ffd  

---

## Table of Contents

1. [What Is QR Gear](#what-is-qr-gear)
2. [Site Sections — Public](#site-sections--public)
3. [Site Sections — Member](#site-sections--member)
4. [Site Sections — Admin](#site-sections--admin)
5. [Firebase Architecture](#firebase-architecture)
6. [Cloud Functions — Route Map](#cloud-functions--route-map)
7. [Firestore Collections](#firestore-collections)
8. [Firebase Storage Structure](#firebase-storage-structure)
9. [Product Creation Flow](#product-creation-flow)
10. [Template System](#template-system)
11. [Store & Channel System](#store--channel-system)
12. [Payments — Stripe](#payments--stripe)
13. [Print Fulfillment — Printify & Printful](#print-fulfillment--printify--printful)
14. [Email — Resend / NexusMail](#email--resend--nexusmail)
15. [Authentication](#authentication)
16. [Deployment Guide](#deployment-guide)
17. [Environment Variables](#environment-variables)
18. [Recent Changes Log](#recent-changes-log)

---

## What Is QR Gear

QR Gear is a Firebase-hosted platform for creating, selling, and managing QR-code-integrated physical products (apparel, mugs, etc.). Each product embeds a scannable QR code that links to a custom digital experience — a landing page, media player, dynamic rotating content (Mosaic), or a simple redirect.

**Core Concepts:**

| Concept | Definition |
|---------|------------|
| **Packet** | The core unit — one QR-linked digital experience tied to a product |
| **Store** | Top-level brand surface (e.g. `qr-gear`, a partner brand) |
| **Channel** | A themed feed within a store (e.g. `usa250`, `faith`, `custom`) |
| **Collection** | A curated grouping inside a channel |
| **Artifact** | An individual QR-linked content item |
| **Mosaic** | A stitched multi-artifact experience (QR Dynamics) |
| **Template** | A saved builder state that can be reused for new products |

---

## Site Sections — Public

### Home (`/`)
Landing page with hero, feature highlights, and product category navigation.  
**File:** `client/src/pages/home.tsx`

### Shop — Store Page (`/shop/:storeType/:storeName`)
Public-facing product listing page for a specific store or channel. Shows product cards with graphics, colors, sizes, and pricing.  
**File:** `client/src/pages/shop-segment.tsx`  
**API:** `GET /api/store/:storeType/:storeName` → `functions/src/routes/store-files.ts`

Product image priority order (as of April 19, 2026 fix):
1. `mockupUrl` — Printify/Printful realistic mockup (best, available after job processing)
2. `packet.priorityMockupUrl` — stored on the packet after mockup generation
3. `packet.landingPageSnapshotUrl` — rendered landing page with background + content
4. `packet.productGraphicUrl` — QR overlay graphic (uploaded PNG)
5. `compositeUrl` — transparent QR overlay (fallback only)
6. `qrOnlyUrl` — bare QR code image (last resort)

### Shop — Single Product (`/shop/product/:linkId`)
Detail page for a single store product link. Color/size selection, add to cart.  
**File:** `client/src/pages/shop-product.tsx`  
**API:** `GET /api/store/product/:linkId` → `functions/src/routes/store-files.ts`

### Member Landing Page (`/m/:slug`)
The scanned QR code resolves here. Shows the custom experience the admin/member created — canvas, play (video), compose, or basics mode.

### Gallery (`/gallery`)
Public gallery of available designs.

### Earn (`/earn`)
Referral / affiliate program page.

---

## Site Sections — Member

Members are authenticated users (customers who purchased a QR product or created an account).

### Member Dashboard (`/member`)
Overview of owned packets, QR links, and purchase history.  
**File:** `client/src/pages/member.tsx`

### My Item (`/my-item`)
View and edit the digital content linked to a purchased QR product.

### Account (`/account`)
Profile, subscription, and billing management.

### QR History (`/qr-history`)
Scan history and analytics for member's QR codes.

### Member Builder
Members can create QR-linked products through wizard flows:
- **Quick Create** — Simple wizard, minimal steps
- **Advanced** — Full control over text, layout, QR position
- **Studio (Owner)** — Full studio with live graphic preview

---

## Site Sections — Admin

All admin routes are protected by `requireAdmin` middleware. Access via `/admin`.

| Route | Purpose | Key File |
|-------|---------|---------|
| `/admin` | Dashboard hub | `pages/admin-dashboard.tsx` |
| `/admin/products` | Product Builder + catalog | `pages/admin-products.tsx` |
| `/admin/library` | Image/background/template library | `pages/admin-library.tsx` |
| `/admin/store-builder` | Configure stores, channels, collections | `pages/admin-store-builder.tsx` |
| `/admin/store-library` | Browse existing store product links | `pages/admin-store-library.tsx` |
| `/admin/pricing` | Markup, tier, and pricing rules | `pages/admin-pricing.tsx` |
| `/admin/orders` | Order management and fulfillment | `pages/admin-orders.tsx` |
| `/admin/customers` | Registered member management | `pages/admin-customers.tsx` |
| `/admin/categories` | Product category management | `pages/admin-categories.tsx` |
| `/admin/orchestration` | Bulk publishing and profit reporting | `pages/admin-orchestration.tsx` |
| `/admin/settings` | Global platform settings, email, Stripe | `pages/admin-settings.tsx` |
| `/admin/manual` | In-app admin manual | `pages/admin-manual.tsx` |

### Admin Product Builder
The core admin workflow for creating QR products:

1. **Select Product** — Choose a blank (shirt, mug, etc.) from the synced Printify/Printful catalog
2. **Configure QR** — Set QR content, layout mode (Zone / Freeform), position, size
3. **Add Text** — Header, footer, sub-bottom text with font/color controls
4. **Choose Background** — Upload or pick from image library
5. **Preview** — Live graphic preview on the product
6. **Save Packet** — Creates a Packet, Template, and optionally a Store Product Link

**Key Files:**
- `client/src/features/adminProducts/builder/` — Builder UI
- `client/src/features/adminProducts/builder/modules/useCreatePacket.ts` — Save orchestration
- `client/src/features/adminProducts/builder/modules/LoadTemplateModule.tsx` — Template picker

### Admin Store Library
Browse products assigned to any store/channel. Supports:
- Grid, list, and swipe views
- Delete from store (with confirmation)  
**File:** `client/src/features/adminProducts/storeLibrary/modules/ProductGridModule.tsx`

---

## Firebase Architecture

### How Frontend → Cloud Function Calls Work

```
Frontend fetch("/api/admin/stores")
    ↓
Firebase Hosting rewrites /api/** → Cloud Function "api"
    ↓
Cloud Function receives request at /admin/stores (prefix stripped)
    ↓
Route handler in functions/src/routes/ processes request
    ↓
Reads/writes to Firestore, Firebase Storage, or external APIs
```

### Dev vs Production

| Context | Dev Server | Production (Cloud Functions) |
|---------|------------|------------------------------|
| Frontend calls | `fetch("/api/...")` | Same — Firebase Hosting rewrites |
| Backend | `server/routes/` (Express) | `functions/src/routes/` (separate code) |
| Database | Firestore (same project) | Firestore (same project) |
| Storage | Firebase Storage (same) | Firebase Storage (same) |

> **Important:** Dev server (`server/`) and Cloud Functions (`functions/src/`) are **separate codebases**. Changes to one do NOT automatically apply to the other. Both must be updated when fixing backend logic.

### Cloud Functions Entry Point

**File:** `functions/src/index.ts`  
**Build ID constant:** Updated on each deploy to force change detection  
**Function:** `export const api = onRequest({ timeoutSeconds: 540, memory: '1GiB', ... }, app)`  
**Region:** `us-central1`

---

## Cloud Functions — Route Map

All routes are registered in `functions/src/routes/` and mounted on the Express `app` in `functions/src/index.ts`. Firebase Hosting rewrites `/api/**` to this function, stripping the `/api` prefix.

### Authentication Middleware

| Middleware | Used For |
|------------|---------|
| `requireAdmin` | All `/admin/*` routes |
| `requireAuth` | Member-facing write routes |
| `verifyMemberAuthCF` | Member URL-param routes |

### Route Files & Responsibilities

| File | Routes Covered |
|------|---------------|
| `am-sync.ts` | `GET/POST/PUT/DELETE /admin/templates`, `/admin/product-categories`, `/admin/template-categories` |
| `admin-products.ts` | `/admin/qr-templates`, `/admin/product-configs`, `/admin/catalog-instances` |
| `admin-stores.ts` | `/admin/stores`, `/admin/channels`, store management |
| `admin-settings.ts` | `/admin/settings`, `/admin/nexusmail/*` email templates |
| `admin-orders.ts` | `/admin/orders`, order fulfillment, tracking |
| `file-routes.ts` | `/admin/templates/full-save`, `/admin/images`, `/library-files/:file` |
| `pp-catalog.ts` | `/admin/store-product-links` (CRUD + DELETE), `/admin/stores/:id/channels/:id/products` |
| `pp-pricing-packets.ts` | `/admin/packets`, pricing packet CRUD, cascade delete |
| `store-files.ts` | `GET /store/:storeType/:storeName`, `GET /store/product/:linkId`, add-to-cart |
| `public-stores.ts` | `/stores/:storeId/channels/:channelId/products` (public channel products) |
| `dynamics.ts` | `/dynamics/*` — Mosaic/QR Dynamics stitching engine |
| `auth.ts` | `/auth/login`, `/auth/logout`, `/auth/verify` |
| `members.ts` | `/member/*` — member packet, library, profile routes |
| `checkout.ts` | `/checkout`, `/checkout/complete`, Stripe session creation |
| `stripe-webhooks.ts` | `/stripe/webhook` — payment event processing |
| `packets.ts` | `/packets`, `/packets/:id` — packet CRUD |
| `images.ts` | `/images/upload`, `/images/*` — image management |
| `mockup-routes.ts` | `/mockups/*` — Printify/Printful mockup generation |
| `brain.ts` | `/brain/*` — AI/orchestration endpoints |
| `referral.ts` | `/referral/*` — referral and affiliate tracking |
| `tiers.ts` | `/tiers/*` — product tier management |
| `catalog.ts` | `/catalog/*` — product catalog sync |
| `claims.ts` | `/claims/*` — QR code ownership claims |

### Key Admin Endpoints (Frequently Changed)

```
GET  /admin/templates              → am-sync.ts: reads productTemplates collection, returns { templates } with reconstructed packet object
POST /admin/templates/full-save   → file-routes.ts: saves to productTemplates collection with all snapshot fields
GET  /admin/store-product-links   → pp-catalog.ts: list all store product links
POST /admin/store-product-links   → pp-catalog.ts: create store product link
DELETE /admin/store-product-links/:linkId → pp-catalog.ts: delete a link (admin only)
GET  /admin/stores/:storeId/channels/:channelId/products → pp-catalog.ts: products in a channel
```

---

## Firestore Collections

| Collection | Purpose | Key Fields |
|------------|---------|-----------|
| `packets` | Core QR-linked digital experiences | `qrContent`, `compositeUrl`, `productGraphicUrl`, `landingPageSnapshotUrl`, `priorityMockupUrl`, `packetId`, `productId`, `storeId` |
| `productTemplates` | Saved admin builder states | `name`, `packetId`, `qrContent`, `headerText`, `footerText`, `headerStyle`, `footerStyle`, `backgroundUrl`, `qrSizePercent`, `qrPositionX`, `qrPositionY`, `graphicLayoutMode`, `qrProductState`, `subBottom*`, `areaImage*` |
| `storeProductLinks` | Products assigned to store channels | `storeId`, `channel`, `collection`, `packetId`, `templateId`, `compositeUrl`, `qrOnlyUrl`, `mockupUrl`, `productName`, `enabledColors`, `enabledSizes`, `pricing` |
| `stores` | Store definitions | `name`, `roleType`, `ownerId` |
| `storeChannels` | Channels within a store | `storeId`, `name`, `description` |
| `products` | Printify/Printful blank catalog | `blueprintId`, `printProviderId`, `availableColors`, `availableSizes`, `mockupsByColor`, `basePrice` |
| `mockup_jobs` | Queued mockup generation jobs | `templateId`, `colorName`, `colorHex`, `placement`, `qrSize`, `status` |
| `templates` | Legacy template collection (pre-April 2026) | Now superseded by `productTemplates` |
| `users` | Registered members | `email`, `firebaseUid`, `referrerId`, `role` |
| `orders` | Customer orders | `packetId`, `productId`, `fulfillmentProvider`, `status`, `stripeSessionId` |
| `graphics` | Saved design graphics | `compositeUrl`, `qrOnlyUrl`, `packetId`, `name` |
| `admin_images` | Admin image library | `storageUrl`, `folder`, `isActive` |
| `admin_settings` | Platform-wide settings | `markupPercent`, `markupFixed`, `textLineUpcharge`, `hostingTiers` |
| `product_categories` | Product category labels | `name`, `slug`, `isActive`, `sortOrder` |
| `productPackets` | Pricing packet definitions | `name`, `price`, `features`, `isActive` |
| `mosaicTemplates` | QR Dynamics Mosaic configurations | `surfaceId`, `storeId`, `channelId`, `items` |
| `qrDynamicsInstances` | Active Mosaic instances | `mosaicId`, `activeIndex`, `rotationInterval` |

---

## Firebase Storage Structure

```
Firebase Storage (qrgear-c1ffd.firebasestorage.app)
├── library/
│   ├── backgrounds/
│   │   ├── raw/          — original uploaded backgrounds
│   │   └── cropped/      — admin-cropped versions
│   ├── images/           — admin image library
│   ├── templates/        — saved template files
│   └── designs/          — saved design files
├── custom-designs/       — member custom design uploads
├── packets/
│   └── {packetId}/
│       ├── product-graphic.png    — QR overlay graphic (transparent PNG)
│       ├── landing-snapshot.png   — full landing page render
│       └── play-media.*           — video/GIF for QR Play products
├── mockups/              — Printify/Printful generated mockup images
└── uploads/              — temporary upload staging area
```

### Image URL Priority (Store Display)
When showing a product on the public store page, the system uses:
1. `storeProductLink.mockupUrl` — full Printify mockup (set after mockup job completes)
2. `packet.priorityMockupUrl` — best mockup URL stored on the packet
3. `packet.landingPageSnapshotUrl` — rendered landing page with background
4. `packet.productGraphicUrl` — the QR overlay PNG (transparent — appears garbled on white)
5. `storeProductLink.compositeUrl` — same transparent overlay (legacy field name)
6. `storeProductLink.qrOnlyUrl` — bare QR code (last resort)

---

## Product Creation Flow

When an admin saves a new product in the builder, this sequence happens:

```
1. POST /api/packets
   → Creates a Packet in Firestore packets collection
   → Returns packetId

2. (If play mode) POST /api/content/upload
   → Uploads video/GIF to Firebase Storage
   → Returns publicUrl → stored on packet

3. Render product graphic (client-side canvas)
   → renderProductGraphic() generates transparent PNG
   → POST /api/content/upload → uploads to Storage
   → PATCH /api/packets/:id → stores productGraphicUrl + compositeUrl

4. Render landing page snapshot (client-side canvas)
   → renderLandingPage() generates full-background PNG
   → POST /api/content/upload → uploads to Storage
   → PATCH /api/packets/:id → stores landingPageSnapshotUrl

5. POST /api/graphics/save
   → Saves graphic record to graphics collection

6. POST /api/templates/full-save
   → Saves to productTemplates collection with all snapshot fields
   → Queues mockup_jobs for each color × placement × QR size
   → Returns { templateId, jobsQueued }

7. (If store selected) POST /api/store-product-links
   → Creates link in storeProductLinks collection
   → Stores templateId, packetId, compositeUrl, qrOnlyUrl, pricing
```

### Mockup Job Processing
After step 6, mockup jobs queue in `mockup_jobs`. A background processor (Cloud Function trigger or queue worker) picks them up and generates Printify/Printful mockups. When complete, `priorityMockupUrl` is updated on the packet and the store product link's `mockupUrl` is set.

---

## Template System

Templates save the full admin builder state so it can be reloaded later. As of April 19, 2026:

### Saving a Template
- Endpoint: `POST /api/templates/full-save`
- Collection: `productTemplates` (Cloud Functions) / `qrTemplates` (dev server)
- Fields stored: `name`, `packetId`, `qrContent`, `headerText`, `footerText`, `headerStyle`, `footerStyle`, `subBottomEnabled/Text/FontFamily/FontSize/FontWeight/Color`, `backgroundUrl`, `qrProductState`, `areaImageUrl/Mode/OffsetX/OffsetY/Scale`, `graphicLayoutMode`, `qrSizePercent`, `qrPositionX/Y`, `productName`, `blueprintId`, `printProviderId`, `fulfillmentProvider`, `artworkUrl`, `thumbnailUrl`, `pricing`, `placementConfig`

### Loading a Template
- Endpoint: `GET /api/admin/templates`
- Returns: `{ templates: [{ id, name, packetId, packet: { ...all snapshot fields } }] }`
- The `packet` object is reconstructed from stored template fields
- Templates saved before April 19, 2026 will have `packet: null` (old format)

### Template Picker UI
- **File:** `client/src/features/adminProducts/builder/modules/LoadTemplateModule.tsx`
- Calls `GET /api/admin/templates`
- Displays a picker list with template names
- On select: restores full builder state (QR position, text, background, layout mode, etc.)

---

## Store & Channel System

### Creating a Store
Admin creates a store via Store Builder. Stores have a `roleType` (e.g. `Internal`, `Partner`, `Member`).

### Adding a Channel
Channels belong to a store. A channel is a themed product feed (e.g. `usa250`, `faith`).

### Assigning Products to a Channel
When the admin saves a product in the builder with a store + channel selected:
- A `storeProductLink` document is created in Firestore
- The link holds: `storeId`, `channel`, `packetId`, `templateId`, `compositeUrl`, `qrOnlyUrl`, `productName`, `enabledColors`, `enabledSizes`, `pricing`

### Deleting a Product from a Store/Channel (Admin)
- Admin-only feature in the Store Library admin section
- Hover over a product card → trash icon appears
- Confirmation dialog prevents accidental delete
- Calls: `DELETE /api/admin/store-product-links/:linkId`
- Cloud Function route: `pp-catalog.ts`

---

## Payments — Stripe

Stripe handles all customer payments.

### Flow
1. Customer selects product + color/size → "Add to Cart"
2. Cart accumulates items (`/api/cart`)
3. Checkout creates a Stripe Checkout Session (`/api/checkout`)
4. Customer pays on Stripe-hosted page
5. Stripe webhook (`/api/stripe/webhook`) fires `checkout.session.completed`
6. Backend creates Order in Firestore, triggers fulfillment

### Key Files
- `functions/src/routes/checkout.ts` — session creation
- `functions/src/routes/stripe-webhooks.ts` — event handling
- Environment: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`

---

## Print Fulfillment — Printify & Printful

### Printify
Primary fulfillment provider. Used for most t-shirts, hoodies, and basic apparel.
- Product catalog synced via `GET /api/catalog/sync` → stored in `products` collection
- Orders submitted via Printify API after payment confirmed
- Mockups generated via Printify mockup API → stored in Firebase Storage

### Printful
Secondary provider. Used for premium items and embroidery.
- Similar sync and order flow
- Mockup generation via Printful API

### Mockup Generation
When a template is saved (full-save), mockup jobs are queued for each color × placement combination. The background processor generates realistic product mockups and stores them:
- `products/{productId}/mockupsByColor` — color-keyed mockup URLs
- `packets/{packetId}/priorityMockupUrl` — best available mockup for the packet
- `storeProductLinks/{linkId}/mockupUrl` — mockup URL for store display

---

## Email — Resend / NexusMail

Email is sent via Resend. The admin panel has a NexusMail system for managing email templates.

### Email Templates
- Stored in Firestore: `nexusmailTemplates` collection
- Seed defaults: `POST /api/admin/nexusmail/seed-templates`
- Supported template types: order confirmation, welcome, renewal reminder, etc.

### Environment
- `RESEND_API_KEY` — Resend API credentials
- From address: configured in admin settings

---

## Authentication

Firebase Authentication handles all user identity.

### Admin Authentication
- Firebase ID token verification in Cloud Function middleware
- `requireAdmin` middleware checks `ADMIN_USER_IDS` allowlist
- Admin UI uses `AdminAuthContext` which provides `getAuthHeaders()` for all API calls

### Member Authentication
- Firebase ID token in request headers
- `requireAuth` middleware verifies token
- `verifyMemberAuthCF` — stricter check for member URL-param routes (UID must match)

### Public Routes
- Store pages, product detail pages, landing pages (`/m/:slug`) — no auth required

---

## Deployment Guide

### Prerequisites
- Firebase CLI installed
- Service account key available at `/tmp/sa-key.json` or via `GOOGLE_APPLICATION_CREDENTIALS`
- Node.js 20

### Full Deploy (Hosting + Functions)

```bash
# 1. Build frontend
npm run build

# 2. Deploy frontend to Firebase Hosting
GOOGLE_APPLICATION_CREDENTIALS=/tmp/sa-key.json \
  npx firebase deploy --only hosting --project qrgear-c1ffd

# 3. Build Cloud Functions
cd functions && npm run build && cd ..

# 4. Deploy Cloud Functions
GOOGLE_APPLICATION_CREDENTIALS=/tmp/sa-key.json \
  npx firebase deploy --only functions --project qrgear-c1ffd
```

### Restoring the Service Account Key
The key is stored in the `FIREBASE_SERVICE_ACCOUNT_KEY` environment variable:

```bash
echo "$FIREBASE_SERVICE_ACCOUNT_KEY" > /tmp/sa-key.json
```

### Forcing Cloud Function Redeploy
Firebase v2 functions use config-based change detection. To force redeploy when source changes aren't detected, update the `labels` field in `functions/src/index.ts`:

```typescript
export const api = onRequest(
  {
    timeoutSeconds: 540,
    memory: '1GiB',
    cors: true,
    labels: { 'build-id': '20260419-v3' },  // ← bump this value
  },
  app
);
```

Then rebuild and redeploy functions.

### Dev Server (Local Only)
The dev server (`server/`) is a separate Express app used for local development only. It mirrors the Cloud Functions routes but is NOT the same code. Changes made to `server/routes/` do not affect production — you must also update the corresponding file in `functions/src/routes/`.

```bash
npm run dev   # starts both frontend (Vite) and backend (Express) on port 5000
```

---

## Environment Variables

| Variable | Where Used | Purpose |
|----------|-----------|---------|
| `FIREBASE_SERVICE_ACCOUNT_KEY` | Backend (both) | Firebase Admin SDK credentials |
| `FIREBASE_API_KEY` | Frontend | Firebase client config |
| `VITE_FIREBASE_API_KEY` | Frontend | Firebase client (Vite-exposed) |
| `VITE_FIREBASE_AUTH_DOMAIN` | Frontend | Firebase auth domain |
| `VITE_FIREBASE_PROJECT_ID` | Frontend | Firebase project ID |
| `VITE_FIREBASE_STORAGE_BUCKET` | Frontend | Firebase Storage bucket |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | Frontend | Firebase messaging |
| `VITE_FIREBASE_APP_ID` | Frontend | Firebase app ID |
| `STRIPE_SECRET_KEY` | Cloud Functions | Stripe payment processing |
| `STRIPE_WEBHOOK_SECRET` | Cloud Functions | Stripe webhook validation |
| `RESEND_API_KEY` | Cloud Functions | Email sending |
| `PRINTIFY_API_KEY` | Cloud Functions | Printify catalog + orders |
| `PRINTFUL_API_KEY` | Cloud Functions | Printful catalog + orders |
| `DATABASE_URL` | Dev server only | PostgreSQL connection string |
| `FIREBASE_STORAGE_BUCKET` | Backend | Storage bucket name |

---

## Recent Changes Log

### April 19, 2026 — Store Graphic Fix + Delete from Store + Template Save Chain

#### Store Page Graphic Fix
The public store page (`/shop/:storeType/:storeName`) was showing a garbled transparent PNG instead of a proper product image.

**Root cause:** `storeProductLinks.compositeUrl` is a transparent QR overlay PNG (no shirt background). When shown on a white card background it appeared as bare text/QR with no product context.

**Fix:** All three store fetch endpoints in `functions/src/routes/store-files.ts` now cross-reference the packet record and use this priority order:
`mockupUrl → packet.priorityMockupUrl → packet.landingPageSnapshotUrl → packet.productGraphicUrl → compositeUrl → qrOnlyUrl`

The `landingPageSnapshotUrl` is a fully-rendered PNG with background + content layers, which displays correctly on store cards immediately after product creation (before Printify mockups are generated).

#### Delete Items from a Store (Admin Only)
- Hover trash icon on product cards in the Store Library admin section
- AlertDialog confirmation prevents accidental deletion
- `DELETE /api/admin/store-product-links/:linkId` — protected by `requireAdmin` in Cloud Functions

#### Template Save/Load Chain — 5 Fixes
1. **GET `/admin/templates` collection mismatch** — was reading `templates`, now reads `productTemplates`
2. **GET `/admin/templates` missing packet data** — now reconstructs full `packet` object from stored template fields
3. **full-save key whitelist** — expanded to include all snapshot fields (headerText, footerText, headerStyle, footerStyle, subBottom*, backgroundUrl, qrProductState, areaImage*, etc.)
4. **LoadTemplateModule URL** — fixed double `/admin/` prefix
5. **templateId extraction** — now handles both `{ template: { id } }` (dev server) and `{ templateId }` (Cloud Functions) response shapes

#### Files Changed
| File | Change |
|------|--------|
| `functions/src/routes/store-files.ts` | Graphic URL enriched from packet in all 3 store endpoints |
| `functions/src/routes/am-sync.ts` | GET `/admin/templates` reads `productTemplates` + builds packet object |
| `functions/src/routes/file-routes.ts` | full-save key whitelist expanded |
| `client/.../useCreatePacket.ts` | templateId handles both response shapes |
| `client/.../LoadTemplateModule.tsx` | URL prefix fixed |
| `client/.../StoreProductSkin.tsx` | onDelete prop + hover trash button |
| `client/.../ProductGridModule.tsx` | Delete mutation + AlertDialog |

### April 8, 2026 — Security & Trust-Boundary Pass
- Member routes hardened with `requireAuth` + UID matching
- Upload MIME type allowlists enforced (PNG, JPEG, WebP, GIF, SVG)
- 25MB size limit on all image upload endpoints
- `referrerId` validation against `users` collection on checkout

### April 8, 2026 — Layout Mode & Legacy Cleanup
- `'structured'` layout mode renamed to `'zone'` across client and Cloud Functions
- `replace-qr` QR safety status removed
- `LayoutModeChoiceStep` component added to wizard flows
- `graphicLayoutMode` state threaded through all wizard variants

### April 7, 2026 — QR Layout & Favicon
- Product graphic renderer zone sizing improvements
- QR slider UX: range 40–85, preset buttons S/M/L/XL
- Favicon added (multi-size QR Gear "Q" logo)
- Folder persistence improvements in image library

### March 2026 — Builder Family Unification
- Admin and member builders unified into shared harness/context pattern
- Shared wizard steps across admin and member flows
- QR safety meter added
- Store builder restructured with channel/catalog/assignment modules
