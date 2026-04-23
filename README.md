# QR Gear — QR-Linked Product & Experience Platform

> **Agent reference:** The canonical system reference for this project is [`replit.md`](./replit.md). It contains the full architecture, API routes, deploy commands, standing rules, naming standards, and session rules. Always read it first.

QR Gear links physical products and digital artifacts through QR codes. Artifacts are organized into channels and collections, then stitched together into Mosaic experiences using QR Dynamics.

## Live Site

**Production:** https://qrgear-c1ffd.web.app

## Core Concepts

### Domain Hierarchy

```
Store → Channel → Collection → Artifact
                                   ↓
                            QR Dynamics stitches
                            artifacts into a Mosaic
```

| Concept       | Definition                                                        |
|---------------|-------------------------------------------------------------------|
| **Store**     | Top-level brand or platform surface (e.g. `qr-gear`)             |
| **Channel**   | A thematic feed or domain inside a store (e.g. `usa250`, `faith`)|
| **Collection**| A curated grouping inside a channel (e.g. `signature-series`)    |
| **Artifact**  | An individual content item or QR-linked object                   |
| **Mosaic**    | A stitched interactive experience created from artifacts          |
| **QR Dynamics**| The engine that stitches artifacts together into a Mosaic        |

### Example Structure

```
QR Gear (Store)
  Channel: USA250
    Collection: Signature Series
      Mosaic: The Forefathers
        Artifacts:
          - Lexington Stand
          - Tree of Liberty
          - Declaration of Independence
          - Government of Laws
```

## Product Architecture

### Layer 1 — Product Catalog
Printify and Printful product blanks synchronized to Firestore. Admin curates blanks into named catalogs assigned to sections (Member, Public, External, Marketplace, Platform). Good/Better/Best tier system for product display.

### Layer 2 — Artifact Content
Members create QR-linked products through wizards (Quick Create, Advanced, Studio). Each creation becomes an artifact that can be published to channels and organized into collections.

### Layer 3 — Mosaic / QR Dynamics
QR Dynamics stitches multiple artifacts into a single scannable Mosaic experience. Each scan resolves through the QR resolver to display the stitched content.

### Layer 4 — Widget Embed System
External sites embed QR Gear experiences via JWT-authenticated widget tokens. Supports channel products, program series, and create-product views.

## Technical Architecture

### Stack

- **Frontend:** React 18, TypeScript, Vite, TailwindCSS, Shadcn UI
- **Backend:** Express.js, TypeScript (Cloud Functions)
- **Database:** Firestore (primary), PostgreSQL (relational commerce data)
- **Storage:** Firebase Storage
- **Auth:** Firebase Authentication
- **Payments:** Stripe
- **Email:** Resend
- **Deployment:** Firebase Hosting + Cloud Functions

### Source of Truth

- **Firestore** owns artifact, content, catalog, and channel data
- **PostgreSQL** owns relational commerce data (orders, users, carts)
- Dual-write adapters synchronize where needed

### UI Architecture (Canon)

```
Domain (shared models / truth)
  → Controllers (logic + permissions + save targets)
    → Viewer (mount point — dumb)
      → Views (layout only — 5 canonical views)
        → Skins (visual interaction only)
          → Pages (composition only — no business logic)
```

**Canonical View Set (5 only):** SingleView, ScrollGridView, ScrollVerticalView, ScrollHorizontalView, ModalView.

### Canonical Description Cascade

Three-layer description system:
1. `providerDescription` — from Printify/Printful (immutable)
2. `adminCatalogDescription` — admin override
3. `memberPacketDescription` — member customization

Resolution: `memberPacketDescription ?? adminCatalogDescription ?? providerDescription`

### Key Files

| File | Purpose |
|------|---------|
| `shared/domainModel.ts` | Canonical domain interfaces |
| `shared/descriptionLayers.ts` | Description resolution functions |
| `shared/wizardProduct.ts` | Wizard product normalizer |
| `shared/blankKeys.ts` | Canonical blank key derivation |
| `server/lib/domain-mappers.ts` | Legacy → canonical record mappers |
| `server/lib/channelItemsService.ts` | Channel artifact CRUD |
| `ARCHITECTURE_VIEWER.md` | Binding viewer/view/skin canon |
| `ARCHITECTURE_IDENTITY.md` | Canonical product identity canon |

## Firebase Deployment

```bash
# Frontend (Hosting)
npm run build
firebase deploy --only hosting --project qrgear-c1ffd

# Backend (Cloud Functions)
cd functions && npm run build && cd ..
firebase deploy --only functions --project qrgear-c1ffd
```

## Admin Interface

The admin panel is organized into five sections accessible from the **Run** dashboard (`/admin`):

| Section | Route | Purpose |
|---------|-------|---------|
| **Run** | `/admin` | Operating cockpit — live metrics grid, in-progress drafts, quick actions |
| **Build** | `/admin/products` | Product builder, templates, library, blanks, dynamics |
| **Place** | `/admin/store-builder` | Store builder, store library, partners, marketplaces |
| **Sell** | `/admin/orders` | Orders, customers, pricing, coupons, gifts |
| **System** | `/admin/settings` | Settings, health, email, manual |

### Section Sub-Nav & Mode Labels

Every admin page displays a mode label eyebrow (`BUILD` / `PLACE` / `SELL` / `SYSTEM`) in its header, auto-detected from the current URL via `getModeForPath()` in `adminNavConfig.ts`. A horizontal sub-nav strip is now **sticky** and appears on every secondary and hub page, providing one-click navigation to peer pages within the same mode. All subnavs are sourced from the single central config in `client/src/components/admin/adminNavConfig.ts`. The `BUILD` subnav now includes Categories and Tags. The bottom nav uses `getModeForPath()` for all active-state detection (no more hardcoded URL arrays). `AdminShell` gained a `hideBack` prop used by the Run page.

The `/admin` path is the canonical Run URL. `/admin/run` and `/admin/dashboard` are registered aliases. The bottom nav **Run** button links to `/admin` and only highlights on those three paths.

### Draft Save / Resume

The product builder supports named in-progress drafts. When a build session is active, a **Save Draft** button appears in the builder's sticky bar. Named drafts surface on the Run dashboard under "In Progress" with a one-click **Resume** button that restores the full builder state.

- Draft names are stored on the `admin_build_sessions` Firestore document (`draftName` field)
- Resume navigates to `/admin/products?resume=<sessionId>` — the builder detects the param, fetches the session + linked packet, resolves the catalog product, and calls `loadFromPacketData`

## Production Route Audit (2026-04-19)

End-to-end audit of all Cloud Functions route files revealed **10 route files existed in `functions/src/routes/` but were never registered in `functions/src/index.ts`**, causing these admin pages to silently 404 in production:

| Previously Broken | Root Cause |
|---|---|
| `admin-run.tsx` — metrics dashboard | `am-crud.ts` unregistered |
| `admin-customers.tsx` — all data | `am-crud.ts` unregistered |
| `admin-email-templates.tsx` — all data | `am-crud.ts` unregistered |
| `admin-orchestration.tsx` — master-products + channel-configs | `am-crud.ts` unregistered |
| `admin-fonts.tsx` — font management | `am-sync.ts` unregistered |
| `admin-settings.tsx` — api-keys section | `am-sync.ts` unregistered |
| `admin-health.tsx` — health check | `am-utility.ts` unregistered |
| Product builder draft save/resume | `admin-build-sessions` missing from functions |

**All 10 route files now registered** (`am-crud`, `am-sync`, `am-utility`, `members-library`, `core-routes-checkout`, `external-sites-public`, `pp-builder`, `pp-catalog`, `pp-catalog-browse`, `pp-pricing-packets`). A new `admin-build-sessions.ts` was also created for functions (ported from dev server) and registered.

**Orphaned files removed:** `admin-backgrounds.tsx` (re-export of LibraryPage with no route) and `admin-dashboard.tsx` (route was already removed).

## Admin Resources

- **Admin Guide:** `client/src/features/adminProducts/ADMIN_README.md`
- **Admin Manual:** `/ADMIN_MANUAL.md`
- **Firebase Schema:** `/FIREBASE_SCHEMA.md`
- **Architecture Canon:** `/ARCHITECTURE_VIEWER.md`, `/ARCHITECTURE_IDENTITY.md`

## License

Proprietary — All rights reserved.
