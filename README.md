# QR Gear — QR-Linked Product & Experience Platform

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

## Admin Resources

- **Admin Manual:** `/ADMIN_MANUAL.md`
- **Firebase Schema:** `/FIREBASE_SCHEMA.md`
- **Architecture Canon:** `/ARCHITECTURE_VIEWER.md`, `/ARCHITECTURE_IDENTITY.md`

## License

Proprietary — All rights reserved.
