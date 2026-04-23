# QR Gear — QR-Linked Product & Experience Platform

> **Agent reference:** The canonical system reference for this project is [`replit.md`](./replit.md). It contains the full architecture, API routes, deploy commands, standing rules, naming standards, and session rules. Always read it first.
> **Strategic reference:** [`METHODOLOGY.md`](./METHODOLOGY.md) contains all design principles, architectural decisions, and the product vision. Read it for the "why and what."

---

## Live Site

**Production:** https://qrgear-c1ffd.web.app

---

## What QR Gear Is

QR Gear links physical products to living digital experiences through QR codes. A shirt, mug, or hat carries a QR code that resolves to a digital surface the owner controls — images, video, rotating content. The physical product is the doorway. The digital layer is the platform.

**One-line pitch:** "QR Gear lets you own moments, move them between products, and control what people see when they scan — anytime."

---

## QR Product Tiers

| Tier | QR State | What It Does |
|---|---|---|
| **QR Basic** | Static | QR encodes a direct URL or text. No server. No hosting. Permanently dumb. |
| **QR Plus** | Static | Same as Basic but with header/footer text composed around the QR on the product graphic. Gets a bridge URL — upgradeable. |
| **QR Canvas** | Fixed | QR links to a custom full-screen image landing page (creator-set, does not change). Hosting required. |
| **QR Play** | Fixed | QR links to a video player page. Creator uploads video. Hosting required. |
| **QR Compose** | Living | QR cycles through a playlist of Canvas + Play moments on a schedule. Member configures the rotation. |
| **QR Dynamics** | Living | Post-purchase buyer dashboard. Owner controls content rotation, swaps moments, manages schedule. |

**QR States:**
- **Static** — Destination is permanent. Encoded directly. No hosting needed.
- **Fixed** — Single rich destination (image or video). Creator-set. Requires hosting.
- **Living** — Destination rotates through content over time. Requires hosting + resolver engine.

---

## Five Distribution Layers

QR Gear is one engine with five revenue paths — all feeding the same core system (packets, instances, ownership, dynamic control):

| Layer | Name | Description | Revenue |
|---|---|---|---|
| 1 | Member / Creator | Members build + sell products, earn 25% of profit | 75% to QR Gear |
| 2 | Direct Buyer | Visitor builds + buys directly on qrgear.com | 100% to QR Gear |
| 3 | Owner / QR Dynamic | Buyer claims item, controls content post-purchase | Subscription revenue |
| 4 | API / Embedded Stores | Partner sites embed QR Gear UX; orders route through QR Gear | Revenue share |
| 5 | Marketplaces | Etsy/eBay/Amazon listings drive buyers back to QR Gear platform | Listing revenue |

**Growth Flywheel:** Visitor → Builder → Buyer → Owner → Member → Distributor

---

## Four Store Types

| Type | Who Controls It | Revenue Model |
|---|---|---|
| **Internal** | QR Gear admin (e.g. USA 250 channel) | 100% to QR Gear |
| **Marketplace** | Admin pushes listings; marketplace handles checkout | QR Gear keeps net after fees |
| **Partner** | Partner embeds QR Gear UX; QR Gear powers the backend | Revenue split |
| **Member** | Individual member stores via wizard system | 25% to member, 75% to QR Gear |

---

## Domain Hierarchy

```
Store → Channel → Collection → Product (Catalog Instance)
                                        ↓
                              QR Dynamics stitches
                              moments into a living surface
```

**Current internal store structure:**
```
qrgear (Store — internal)
  Channel: usa250
    Collection: armed-forces
    Collection: monuments
    Collection: founding-fathers
```

---

## Technical Architecture

### Stack

- **Frontend:** React 18, TypeScript, Vite, TailwindCSS, Shadcn UI
- **Backend:** Node.js, Express, TypeScript (Firebase Cloud Functions)
- **Database:** Firestore (all data)
- **Storage:** Firebase Storage
- **Auth:** Firebase Authentication
- **Payments:** Stripe
- **Email:** Resend / NexusMail
- **Deployment:** Firebase Hosting + Cloud Functions (`qrgear-c1ffd`)

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

### Builder → Storefront Display Contract

Every product API response includes three structured fields so the frontend never guesses rendering intent:

- **`options[]`** — Structured color/size options with hex codes, availability flags, and contrast-aware swatch rendering
- **`cardMode`** — `browseOnly` (has both colors + sizes) or `quickAdd` (single dimension)
- **`media`** — Hero image strategy (`mockupFirst` — QR composite mockup takes priority over plain product photos)

### Canonical Description Cascade

```
memberPacketDescription ?? adminCatalogDescription ?? providerDescription
```

### Key Files

| File | Purpose |
|------|---------|
| `replit.md` | Canonical system reference — architecture, routes, deploy, rules |
| `METHODOLOGY.md` | Strategic decisions, product vision, architectural principles |
| `shared/descriptionLayers.ts` | Description resolution functions |
| `shared/wizardProduct.ts` | Wizard product normalizer |
| `shared/blankKeys.ts` | Canonical blank key derivation |
| `functions/src/routes/store-files.ts` | Storefront API + display contract translation layer |
| `functions/src/constants.ts` | Centralized platform constants |
| `ARCHITECTURE_VIEWER.md` | Binding viewer/view/skin canon |
| `ARCHITECTURE_IDENTITY.md` | Canonical product identity canon |

---

## Firebase Deployment

```bash
# Frontend (Hosting)
npm run build
export GOOGLE_APPLICATION_CREDENTIALS=/tmp/sa-key.json
firebase deploy --only hosting --project qrgear-c1ffd

# Backend (Cloud Functions)
cd functions && npm run build && cd ..
export GOOGLE_APPLICATION_CREDENTIALS=/tmp/sa-key.json
firebase deploy --only functions --project qrgear-c1ffd
```

---

## Admin Interface

The admin panel is organized into five sections accessible from the **Run** dashboard (`/admin`):

| Section | Route | Purpose |
|---------|-------|---------|
| **Run** | `/admin` | Operating cockpit — live metrics, in-progress drafts, quick actions |
| **Build** | `/admin/products` | Product builder, templates, library, blanks, dynamics |
| **Place** | `/admin/store-builder` | Catalog, channels, stores, partners, library |
| **Sell** | `/admin/orders` | Orders, customers, pricing, coupons, gifts |
| **System** | `/admin/settings` | Settings, health, email, manual |

### Store Builder — Catalog Tab

Products in the store are managed as **catalog instances** (`admin_catalog_instances` Firestore collection). Each instance references a product packet, has enabled colors/sizes, pricing, and a folder path (store/channel/collection). The admin can toggle colors and sizes on/off, move items between collections, and delete items directly from each card.

---

## Admin Resources

- **Canonical System Reference:** `replit.md`
- **Strategic & Design Decisions:** `METHODOLOGY.md`
- **Admin Guide:** `client/src/features/adminProducts/ADMIN_README.md`
- **Admin Manual:** `ADMIN_MANUAL.md`
- **Firebase Schema:** `FIREBASE_SCHEMA.md`
- **Architecture Canon:** `ARCHITECTURE_VIEWER.md`, `ARCHITECTURE_IDENTITY.md`
- **ZIP Guide:** `docs/WEBSITE_ZIP_GUIDE.md`

---

## Naming Standards

All conventions (files, folders, components, Firestore collections, CSS classes, route paths) are defined in **`replit.md` → "Naming Standards — Project Law"**.

Quick reference:
- Files/routes: `kebab-case`
- Components: `PascalCase`
- Variables/functions: `camelCase`
- Firestore collections (new): `snake_case`
- CSS custom classes: `kebab-case` + BEM `--`

---

## License

Proprietary — All rights reserved.
