# QR Gear — QR-Linked Product & Experience Platform

> **Agent reference:** [`replit.md`](./replit.md) is the canonical system reference. It contains architecture, API routes, deploy commands, standing rules, naming standards, session rules, and Firestore collection constants. Always read it first.
> **Strategic reference:** [`METHODOLOGY.md`](./METHODOLOGY.md) contains design principles, architectural decisions, and product vision. Read it for the "why and what."

---

## Live Site

**Production:** https://qrgear-c1ffd.web.app

---

## Production-Only Mode

**The dev server is DISABLED.** All work deploys directly to Firebase production. The `server/` directory exists only as a build dependency — never run it. All API route changes go into `functions/src/routes/`.

---

## What QR Gear Is

QR Gear links physical products to living digital experiences through QR codes. A shirt, mug, or hat carries a QR code that resolves to a digital surface the owner controls — images, video, rotating content. The physical product is the doorway. The digital layer is the platform.

**One-line pitch:** "QR Gear lets you own moments, move them between products, and control what people see when they scan — anytime."

---

## QR Product Tiers

| Tier | QR State | What It Does |
|---|---|---|
| **QR Basic** | Static | QR encodes a direct URL or text. No server. No hosting. Permanently fixed destination. |
| **QR Plus** | Static | Same as Basic but header/footer text is composed around the QR on the product graphic. Still permanent destination. |
| **QR Canvas** | Fixed | QR links to a custom full-screen image landing page (creator-set). Hosting required. |
| **QR Play** | Fixed | QR links to a video player page. Creator uploads video. Hosting required. |
| **QR Compose** | Living | QR cycles through a rotating playlist of Canvas + Play items on a schedule. Member configures the rotation. Hosting required. |
| **QR Dynamics** *(future)* | Living | Post-purchase buyer dashboard. Owner controls their instance — swaps content, reorders rotation, renews term. Buyer-side companion to Compose. |

**QR States:**
- **Static** — Destination is permanent. Encoded directly. No hosting needed.
- **Fixed** — Single rich destination (image or video). Creator-set. Requires hosting.
- **Living** — Destination rotates through content over time. Requires hosting + resolver engine.

> **Naming note:** "QR Compose" = the member wizard process of stitching items together. "QR Dynamics" = the resulting stitched item that rotates content. The member dashboard tab is labeled "QR Dynamics" and shows items built via QR Compose.

---

## Five Distribution Layers

QR Gear is one engine with five revenue paths — all feeding the same core system (packets, instances, ownership, dynamic control):

| Layer | Name | Engine | Revenue |
|---|---|---|---|
| 1 | Member / Creator | Affiliate Engine — members build + sell, earn 25% of profit | 75% to QR Gear |
| 2 | Direct Buyer / Buyer-Creator | House Revenue Engine — visitor builds + buys directly on qrgear.com | 100% to QR Gear |
| 3 | Owner / QR Dynamic | Retention Engine — buyer claims item, controls content post-purchase | Subscription revenue |
| 4 | API / Embedded Mini-Stores | Network Engine — partner sites embed QR Gear UX; orders route through QR Gear | Revenue share |
| 5 | External Marketplaces | Acquisition Engine — Etsy/eBay/Amazon listings drive buyers to QR Gear platform | Net after fees |

**Growth Flywheel:** Visitor → Builder → Buyer → Owner → Member → Distributor

---

## Four Store Types

| Type | Who Controls It | Revenue Model |
|---|---|---|
| **Internal** | QR Gear admin (e.g. USA 250 channel) | 100% to QR Gear |
| **Marketplace** | Admin pushes listings; marketplace (Etsy/eBay/Amazon) handles checkout | QR Gear keeps net after fees |
| **Partner** | Partner embeds QR Gear UX; QR Gear powers the backend | Revenue split |
| **Member** | Individual member stores via wizard system | 25% to member, 75% to QR Gear |

---

## Domain Hierarchy

The canonical domain hierarchy is defined in `shared/domainModel.ts`:

```
Store → Channel → Collection → Artifact
                                    ↓
                             QR Dynamics stitches
                             artifacts into a Mosaic
```

- **StoreRecord** — Top-level brand surface (e.g. `qr-gear`)
- **ChannelRecord** — Thematic feed inside a store (e.g. `usa250`, `faith`)
- **CollectionRecord** — Curated grouping inside a channel (e.g. `armed-forces`, `monuments`)
- **ArtifactRecord** — Individual content item or QR-linked object
- **MosaicRecord** — Stitched interactive experience from artifacts (via QR Dynamics)

**Current internal store:**
```
qrgear (Store)
  Channel: usa250
    Collection: armed-forces
    Collection: monuments
    Collection: founding-fathers
```

**Platform constant:** `PLATFORM_STORE_ID = 'qr-gear'`. Legacy store `kingdom_connects` = `LEGACY_STORE_ID` (backward-compat queries only).

---

## Technical Architecture

### Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, TypeScript, Vite, TailwindCSS, shadcn/ui |
| Backend | Node.js, Express, TypeScript — Firebase Cloud Functions |
| Database | Firestore (exclusively) |
| File Storage | Firebase Storage |
| Auth | Firebase Authentication |
| Payments | Stripe |
| Email | Resend (via NexusMail system) |
| Fulfillment | Printful (default), Printify (alternative) |
| Deployment | Firebase Hosting + Cloud Functions (`qrgear-c1ffd`) |
| Frontend state | TanStack Query v5 |

### API Route Architecture

The Cloud Function entry point is `functions/src/index.ts` (~94 lines of wiring). All logic lives in 48 modular route files.

**Production flow:** Frontend on `qrgear-c1ffd.web.app` → Firebase Hosting rewrites `/api/*` to Cloud Function → CF strips `/api` prefix → routes handle `/admin/*`, `/public/*`, `/members/*`, etc. **The strip removes only `/api`, not `/api/admin` — so `/api/admin/foo` becomes `/admin/foo` in CF.**

| Route prefix | Files | Auth |
|---|---|---|
| `/admin/*` | admin-build-sessions.ts, admin-catalog-instances.ts, admin-misc.ts, admin-orders.ts, admin-products.ts, admin-settings.ts, admin-stores.ts, am-crud.ts, am-sync.ts, am-utility.ts, master-catalog.ts, member-catalog-instances.ts, orchestration.ts, print-placements.ts | `requireAdmin` |
| `/master-catalog`, `/master-catalog/joint` | pp-catalog-browse.ts | **Public** (no auth) — call as `/api/master-catalog`, NOT `/api/admin/master-catalog` |
| `/pp/*` | pp-builder.ts, pp-catalog.ts, pp-pricing-packets.ts | varies |
| `/members/*` | members.ts, members-library.ts, member-files.ts | `requireAuth` |
| `/public/*` | public.ts, public-stores.ts, external-sites-public.ts, products-page.ts, seo.ts | Public |
| other | auth.ts, brain.ts, catalog.ts, categories.ts, checkout.ts, claims.ts, core-routes.ts, designs.ts, dynamics.ts, file-routes.ts, gifts.ts, images.ts, marketplace.ts, mockup-routes.ts, packets.ts, partner.ts, referral.ts, store-files.ts, stripe-webhooks.ts, tiers.ts, widget.ts | varies |

### Canonical Six-Step Architecture

All six architecture steps are built and deployed. See `ARCHITECTURE_VIEWER.md` and `ARCHITECTURE_IDENTITY.md` for the full binding canon.

**Architecture flow:**
```
Domain (shared models / truth)
  → Controllers (logic + permissions + save targets)
    → Viewer (mount point — dumb)
      → Views (layout only)
        → Skins (visual interaction only)
          → Pages (composition only — no business logic)
```

**Canon View Set (5 only):** `SingleView`, `ScrollGridView`, `ScrollVerticalView`, `ScrollHorizontalView`, `ModalView`. Never create new view types.

**Six steps:**
1. **Canonical Blank Identity** (`shared/blankKeys.ts`) — `getCanonicalBlankKey()` is the only way to derive product keys
2. **Description Layers** (`shared/descriptionLayers.ts`) — three canonical field names: `providerDescription`, `adminCatalogDescription`, `memberPacketDescription`
3. **Wizard Product Contract** (`shared/wizardProduct.ts`) — `normalizeWizardProduct()` is the single normalizer for all wizard product objects
4. **Wizard Surface Split** — Three surfaces: IMAGE (Canvas), VIDEO (Play), DOCUMENT (future)
5. **Skin System** — 44 skin files in `client/src/features/shared/components/skins/`. Skins render visible controls only — no business logic
6. **Controller Layer** — 6 controller hooks: `useAdminBlanksController`, `useWizardController`, `useStoreController`, `useLibraryController`, `useMembersLibraryController`, `usePacketController`

### Builder → Storefront Display Contract

Every storefront product API response includes three structured fields (translated in `functions/src/routes/store-files.ts`):

- **`options[]`** — Structured color/size options with hex codes (100+ color map), availability flags, and WCAG luminance-based swatch contrast
- **`cardMode`** — `browseOnly` (has both colors + sizes) or `quickAdd` (single dimension)
- **`media`** — Hero image strategy: `heroStrategy: "mockupFirst"` — QR composite mockup always takes priority over plain product photos

### Multi-Placement Mockup Gallery

When a product is built with more than one print placement (e.g. front + back, or front + left sleeve), the store product gallery shows a separate flat mockup image for each placement, in addition to the lifestyle/model shot.

**Gallery order:** lifestyle → front flat → back flat → left sleeve → right sleeve

**How it works:**
- At build time, `selectedPlacements[]` is sent to the mockup generation endpoint instead of a single `placement` string
- The endpoint calls `getMockupWithFallback` once per placement and stores all results as `placementMockupUrls: { front: url, back: url, left_sleeve: url }` on the packet
- `functions/src/routes/store-files.ts` reads `placementMockupUrls` from both the packet and the storeProductLink (link overrides packet), then appends each extra placement view to the `images[]` array
- Printful's `variant_printfiles` API data is used to resolve the correct print-area dimensions per placement so sleeve graphics are sized for the sleeve canvas, not the chest

**Endpoints that support `selectedPlacements[]`:**
| Endpoint | Used by |
|---|---|
| `POST /api/public/generate-mockup` | Public / owner wizard |
| `POST /api/mockup/priority` | Member wizard, admin tools |

**Key files:**
- `server/lib/mockup-service.ts` — printfile dimension lookup via `variant_printfiles`
- `server/routes/member-public-wizard.routes.ts` — public generate-mockup handler
- `server/routes/misc/store-product-links.routes.ts` — priority mockup handler
- `client/src/features/owner/useOwnerWizardState.ts` — owner wizard sends full `selectedPlacements`
- `client/src/features/members/MembersContext.tsx` — `MockupParams.selectedPlacements` + `MockupResult.placementMockupUrls`
- `functions/src/routes/store-files.ts` — gallery assembly from `placementMockupUrls`

### Description Cascade (Canonical)

```
memberPacketDescription ?? adminCatalogDescription ?? providerDescription
```

Implemented in `shared/descriptionLayers.ts`. Old field names (`originalDescription`, `adminDescription`, `customDescription`) are fully purged from all client code.

### First-Scan Activation System

1. Buyer pays → unique activation code generated (`XXXX-XXXX` format) → activation email sent via NexusMail
2. Buyer scans product QR → sees product landing page → enters code in activation panel
3. 1-year hosting starts from **claim moment** (NOT purchase date)

**Key files:** `server/lib/claimService.ts` (code generation), `functions/src/routes/checkout.ts` (wired post-order), `client/src/pages/claim.tsx` (claim flow), `client/src/pages/my-item.tsx` (instance dashboard), `client/src/pages/account.tsx` (My QR Items tab)

**Firestore collections:** `claimCodes` (status: unclaimed/claimed/expired), `claimedInstances` (hostingExpiresAt)

**API endpoints:** `GET /api/claimed-instances`, `GET /api/claimed-instances/:instanceId`, `POST /api/claim/:claimCode`

### QRG Numbering System

All 1,612 `master_catalog` products are assigned `QRG-CCC-SSS` IDs. Category codes: 100=Tees, 200=Hoodies, 300=Hats, 400=Drinkware, etc. Fields: `qrgId`, `qrgCategory`, `qrgSequence`. Returned by `GET /api/master-catalog`.

### Catalog Management System

Everything runs through named catalogs. Admin creates catalogs (curated subsets of blanks), assigns them to 5 sections (Member, Public, External, Marketplace, Platform). Managed from `admin-blanks.tsx`. Data stored in `catalogs`, `systemSettings/catalog-assignments`, `systemSettings/catalog-defaults` Firestore collections.

**Good/Better/Best Tier System:** Products tagged with tiers. Stored as `blankTiers: { blankId: "good"|"better"|"best" }` on catalog docs. `TierPickerStep` shows tier cards in wizards; falls back to flat list when no tiers configured.

### Cart Architecture

Single React Context (`client/src/contexts/CartContext.tsx`) wraps the entire app. One shared instance per session. localStorage is persistence-only (cross-tab sync via storage events). Deduplication: same productId+color+size increments quantity. `mergeGuestCartOnLogin` fires once per login session. Guest items remain visible during merge (no empty-cart flicker).

### Wizard System

Four wizard tiers with progressive unlock:
- **SuperSimple** — Tutorial cards, guest-first flow (sign-in gate at preview-to-mockup)
- **Simple** — Standard guided flow
- **Advanced** — Unlocks after 1st publish: Quick Start, font slider, offset controls
- **Studio** — Unlocks after 2nd publish: streamlined Quick Publish

Builder capabilities declared in `client/src/features/shared/builder-capabilities.ts` (`BuilderCapabilities` type with presets per wizard tier).

### Shared Product Engine (Core Unification — rev 24)

Three wizard tiers (SuperSimple / Simple / Advanced) remain distinct UIs. The underlying data contract, color resolution, and storefront option-building are unified via two shared modules:

| Module | Purpose |
|---|---|
| `shared/colorUtils.ts` | Canonical `COLOR_HEX_MAP` — single source of truth for all color-to-hex resolution. Exports `getColorHexByName`, `getColorHex`, `resolveColorHex`. |
| `shared/storefrontTypes.ts` | Canonical `StoreProduct` + `ProductOption` types, `buildStructuredOptions`, `deriveCardMode`. All consumer files re-export or import from here. |

Consumer files that now import from shared (do not define local copies):
- `client/src/features/storeBuilder/store-builder-types.ts`
- `client/src/features/storefront/types.ts`
- `functions/src/routes/store-files.ts`
- `client/src/features/storefront-shared/buildProductGallery.ts`
- `client/src/components/FeaturedProducts.tsx`

### Key Firestore Collections (from `functions/src/constants.ts`)

| Constant | Collection Name |
|---|---|
| `PRODUCT_PACKETS_COLLECTION` | `productPackets` (legacy camelCase — grandfathered) |
| `CHANNEL_ITEMS_COLLECTION` | `channel_items` |
| `MOSAICS_COLLECTION` | `site_programs` |
| `MOSAIC_TEMPLATES_COLLECTION` | `dynamicsCollections` |
| `QR_DYNAMICS_INSTANCES_COLLECTION` | `qr_dynamics_instances` |
| `MASTER_CATALOG_COLLECTION` | `master_catalog` |
| `PRINTFUL_PRODUCTS_COLLECTION` | `printful_products` |
| `MARKETPLACE_ACCOUNTS_COLLECTION` | `marketplaceAccounts` |
| `BUILDER_SESSIONS_COLLECTION` | `builderSessions` |
| `PRICING_POLICIES_COLLECTION` | `pricingPolicies` |

---

## Firebase Deployment

### Frontend (Hosting)

```bash
npm run build
echo "$FIREBASE_SERVICE_ACCOUNT_KEY" > /tmp/firebase-sa.json
export GOOGLE_APPLICATION_CREDENTIALS=/tmp/firebase-sa.json
firebase deploy --only hosting --project qrgear-c1ffd
rm /tmp/firebase-sa.json
```

### Backend (Cloud Functions)

```bash
cd functions && npm run build && cd ..
echo "$FIREBASE_SERVICE_ACCOUNT_KEY" > /tmp/firebase-sa.json
export GOOGLE_APPLICATION_CREDENTIALS=/tmp/firebase-sa.json
firebase deploy --only functions --project qrgear-c1ffd
rm /tmp/firebase-sa.json
```

### Post-Deploy Verification

```bash
curl -s -o /dev/null -w "%{http_code}" https://qrgear-c1ffd.web.app/
curl -s -o /dev/null -w "%{http_code}" https://qrgear-c1ffd.web.app/shop
curl -s https://us-central1-qrgear-c1ffd.cloudfunctions.net/api/api/health
```

> **If Firebase says "No changes detected":** add a timestamp comment to `functions/src/index.ts`, rebuild, and redeploy — this forces a new package hash.

---

## Admin Interface

The admin panel is organized into four nav modes plus a landing dashboard (`/admin`):

| Mode | Root Route | Nav Items |
|------|-----------|-----------|
| **Dashboard** | `/admin` | Landing page — live metrics, in-progress drafts, quick actions |
| **Build** | `/admin/products` | Products, Library, Blanks, Dynamics, Videos, Fonts, Categories, Tags |
| **Place** | `/admin/store-builder` | Store Builder, Library, Partners, External Sites, Marketplaces |
| **Sell** | `/admin/orders` | Orders, Customers, Pricing, Coupons, Gifts, Orchestration |
| **System** | `/admin/settings` | Settings, Health, Email, Email Health, Manual |

### Pre-Launch Checklist

**Route:** `/admin/launch` (Quick Action: "Pre-Launch" on the `/admin` dashboard)

A production-readiness checklist that combines live environment-variable checks with static code-level advisories. Shows a GO / NO-GO banner and groups items into three tiers:

| Tier | Contents |
|------|----------|
| **Hard Blockers** | Missing Stripe live key, missing Resend key, missing webhook secret, ADMIN_BYPASS flag, unregistered Stripe webhook endpoint, undeployed Firebase Functions |
| **Risk Items** | Test-mode Stripe key, partial marketplace credentials, hardcoded admin UIDs, no inventory check at cart, semi-manual Printify order submission |
| **Connected** | All env vars currently returning OK |

Each item is expandable — tap to see the fix and a deep link to the relevant admin section. A Firebase Functions config snippet at the bottom shows the exact `firebase functions:config:set` command needed.

**Source:** `client/src/pages/admin-launch.tsx` — consumes `/api/admin/dashboard/setup` for live env status; static `ADVISORIES` array for code-level risks.

### Admin UI Architecture

- **AdminShell** (`client/src/components/AdminShell.tsx`) — Shared layout shell used by all admin pages: top bar, section tabs, optional sticky bar
- **Shared admin components** in `client/src/components/admin/`: `AdminSectionTabs`, `AdminSectionCard`, `StickyActionBar`, `PreviewDrawer`, `MobileCardList`, `AdminBottomNav`
- **Mobile-first design:** All touch targets min 44px, card-based layouts, section tabs replace wizard flows
- **Bottom navigation** (mobile only): Products, Collections, Channels, Orders, Store — shown on primary admin pages

### Store Builder — Catalog Tab

Products in the store are managed as **catalog instances** (`admin_catalog_instances` Firestore collection). Each instance references a product packet, has enabled colors/sizes, pricing, and a folder path (store/channel/collection). Admin can toggle colors/sizes, move items between collections, and delete items directly from each card.

---

## Canon Rules for Future Agents

1. **NEVER** add `originalDescription`, `adminDescription`, or `customDescription` to client code
2. **NEVER** create a second viewer system — use `SharedViewer` with canon views and skins
3. **NEVER** put business logic in viewers, views, or skins — controllers own authority
4. **NEVER** invent new view types — compose from the 5 canon views
5. **NEVER** use `collectionTag` — it has been fully removed; use `collectionId`
6. **ALWAYS** use `canonicalBlankKey` for product identity; never reconstruct from raw IDs
7. **ALWAYS** use `resolveDescription()` or `resolvePublicDescription()` for description resolution
8. **ALWAYS** use `normalizeWizardProduct()` when building wizard product objects
9. **ALWAYS** import collection names from `functions/src/constants.ts` — never redefine locally
10. **ALWAYS** deploy to production after every change; update the ZIP

---

## Test Coverage

Run with: `npx vitest run --config vite.config.ts --root . shared/__tests__/`

| Test File | Tests | What It Covers |
|---|---|---|
| `qrDynamicsResolver.test.ts` | 13 | Slot resolution, cycle wrap, boundary conditions, time remaining |
| `blankKeys.test.ts` | 15 | Canonical key derivation, provider detection, prefix handling |
| `descriptionLayers.test.ts` | 11 | Three-level cascade, public resolution, snapshot builder |
| `domainMappers.test.ts` | 14 | All 5 domain mapper functions, collectionId mapping, legacy fields |

---

## Admin Resources

| File | Purpose |
|---|---|
| `replit.md` | Canonical system reference — architecture, routes, deploy, rules |
| `METHODOLOGY.md` | Strategic decisions, product vision, architectural principles |
| `ADMIN_MANUAL.md` | Admin user guide |
| `FIREBASE_SCHEMA.md` | Firestore schema reference |
| `ARCHITECTURE_VIEWER.md` | Binding viewer/view/skin canon |
| `ARCHITECTURE_IDENTITY.md` | Canonical product identity canon |
| `docs/SYSTEM_TRUTH_SHEET.md` | Official product model, storage ownership, legacy translation map |
| `docs/WEBSITE_ZIP_GUIDE.md` | ZIP update procedure |
| `client/src/features/adminProducts/ADMIN_README.md` | Admin products feature guide |

---

## Naming Standards

All conventions (files, folders, components, Firestore collections, CSS classes, route paths) are defined in **`replit.md` → "Naming Standards — Project Law"**.

Quick reference:
| Layer | Convention | Example |
|---|---|---|
| Files — pages & routes | `kebab-case` | `admin-store-builder.tsx` |
| Files — components | `PascalCase.tsx` | `StoreManagerTab.tsx` |
| React components & types | `PascalCase` | `InstanceCard`, `AdminInstance` |
| Variables & functions | `camelCase` | `getAuthHeaders()` |
| Constants | `SCREAMING_SNAKE_CASE` | `COLOR_HEX_MAP` |
| Firestore collections (new) | `snake_case` | `admin_catalog_instances` |
| Firestore document fields | `camelCase` | `currentPacketId` |
| CSS custom classes | `kebab-case` + BEM `--` | `qr-btn--primary` |
| API route paths | `kebab-case` | `/api/catalog-instances` |

**Key rule:** Existing camelCase collections (`productPackets`, `memberLibrary`, etc.) are grandfathered — do NOT rename live collections.

---

## External Dependencies

| Service | Purpose |
|---|---|
| Printful | Product mockup generation + default fulfillment |
| Printify | Alternative fulfillment |
| Stripe | Payment processing |
| Firebase | Hosting, Firestore, Storage, Cloud Functions, Auth |
| Resend | Email delivery (via NexusMail system) |
| TanStack Query | Frontend data fetching |
| shadcn/ui | UI component library |
| Fluba Brain | AI governance gateway |

---

## License

Proprietary — All rights reserved.
