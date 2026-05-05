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
| `POST /api/admin/partner-stores/:storeId/products/:productId/generate-mockup` | Partner store admin |

**Partner store endpoint notes:**
- Previously used a direct Printify product-creation loop (no caching, slow, front-only)
- Migrated to use `getMockupWithFallback` — same path as all other builders
- Auto-detects placements from the design's `placementImages` map and maps them to canonical IDs
- Stores results in `mockupsByColor[color].placementMockupUrls` and a top-level `placementMockupUrls` field on the partner store product

**Key files:**
- `server/lib/mockup-service.ts` — printfile dimension lookup via `variant_printfiles`
- `server/routes/member-public-wizard.routes.ts` — public generate-mockup handler
- `server/routes/misc/store-product-links.routes.ts` — priority mockup handler
- `server/routes/admin-content.routes.ts` — partner store mockup handler (migrated)
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

Every packet, owner instance, and physical item is identified by a single unified schema. Each layer adds digits only when that layer exists.

#### Full Schema

```
QRG - [STNNN] - [C] - [NNNNNN] - [SSCC]
         ↑       ↑        ↑          ↑
       blank   source  instance   variant (barcode only)
```

| Segment | Width | Description |
|---------|-------|-------------|
| `QRG` | 3 | Brand prefix — always present |
| Blank `[STNNN]` | 5 digits | Product identity — S=super-category (1–6), T=product-type (1–9), NNN=item number (101–999) |
| Context `[C]` | 1 letter | `I`=Internal (admin-built), `M`=Member (user-built), `E`=External (API/embedded), `O`=Owner (post-purchase) |
| Instance `[NNNNNN]` | 6 digits | Unique per produced item — ownership + tracking (000001–999999) |
| Variant `[SSCC]` | 4 digits | **Barcode only** — SS=2-digit size + CC=2-digit color, never in URL |

> **Design is not part of identity.** Design/build data lives as a separate Firestore field, linked asset, or QR payload — never embedded in the QRG code.

**Full example:** `QRG-11101-I-000001-0501` = Apparel/T-Shirt #101, Internal, Instance 1, Size L (05), Color Black (01)

#### Product Identity (STNNN)

Structure: `S` = super-category (1–6), `T` = product type (1–9), `NNN` = item number (101–999) — up to 899 items per type. Items 001–100 reserved for admin assignment.

| Range | Category |
|-------|----------|
| 11101–11999 | T-Shirts |
| 12101–12999 | Hoodies & Sweatshirts |
| 13101–13999 | Hats |
| 14101–14999 | Tank Tops |
| 15101–15999 | Long Sleeve |
| 16101–16999 | Youth/Kids |
| 17101–17999 | Women's |
| 18101–18999 | Specialty Apparel |
| 21101–21999 | Drinkware |
| 22101–22999 | Barware |
| 23101–23999 | Drinkware Accessories |
| 24101–24999 | Kitchen & Dining |
| 25101–25999 | Bedding & Textiles |
| 26101–26999 | Home Décor |
| 31101–31999 | Wall Art & Prints |
| 32101–32999 | Stickers & Magnets |
| 41101–41999 | Bags & Pouches |
| 51101–51999 | Pet Apparel |
| 52101–52999 | Pet Accessories |
| 61101–61999 | Ornaments & Décor |
| 62101–62999 | Stockings & Gifting |
| 63101–63999 | Seasonal Apparel |

#### Size Digit (barcode only)

`01`=XXS, `02`=XS, `03`=S, `04`=M, `05`=L, `06`=XL, `07`=2XL, `08`=3XL, `09`=4XL, `10`=5XL, `00`=One Size

#### Color Code (barcode only)

`01`=Black, `02`=White, `03`=Navy, `04`=Red, `05`=Royal Blue — full map in `shared/qrgCodes.ts`.

#### What Gets What

| Thing | Identifier | Example |
|-------|-----------|---------|
| **Product/Blank** | `QRG-[STNNN]-[C]` | `QRG-11101-I` |
| **Owner URL** | `qrgear.com/QRG-[STNNN]-[C]-[NNNNNN]` | `qrgear.com/QRG-11101-I-000001` |
| **Barcode** | `QRG-[STNNN]-[C]-[NNNNNN]-[SSCC]` | `QRG-11101-I-000001-0401` |

> Design/colorway is stored as a linked field or asset — never appended to the QRG code.

#### Examples — T-Shirt #101 (first T-Shirt blank)

- Product identifier → `QRG-11101-I`
- First owner's URL → `qrgear.com/QRG-11101-I-000001`
- Their physical medium/black shirt barcode → `QRG-11101-I-000001-0401` (M=04, Black=01)

#### Key Properties

- **URL IS the key** — the owner URL is the Firestore path and Storage key; no slug lookup table needed
- **QR code never changes** — owner content updates at the same address; the printed shirt is never broken
- **Design is data, not identity** — different designs on the same blank share the same STNNN; design lives in a linked field
- **Barcode-only digits** — size and color (3 digits) appear only on the physical barcode, never in the URL or packet name
- **Build sequence groups designs** — all builds under `QRG-I-101` are the same blank, different designs; groupable and stitchable
- **Multi-brand ready** — `QRG/` is the namespace; `KC/`, `USA/` etc. use the same engine

**Two scan experiences on every product:**
- **QR code** → `qrgear.com/QRG-I-101-001-000001` — customer-facing dynamic landing page
- **Barcode** → `QRG-I-101-001-000001-402` — full item verification / admin lookup

**Firestore fields on `master_catalog`:** Each document uses `qrg_NNN` (or `pending_py_*` / `pending_pf_*`) as its doc ID.

| Field | Type | Description |
|---|---|---|
| `qrgBlankId` | number | QRG blank number — e.g. `11001` |
| `qrgCategory` | string | `T-Shirts` \| `Hoodies & Sweatshirts` \| `Hats & Caps` \| etc. |
| `qrgParentCategory` | string | Top-level: `Apparel` \| `Houseware` \| `Accessories` \| etc. |
| `categorySource` | string | `mapped` (classified) \| `inferred` \| `manual` (admin override) |
| `availableVia` | string[] | `["printify"]`, `["printful"]`, or both |
| `providerMappings` | object[] | `[{ provider, blueprintId/productId, brand, model, printProviderId, originCountry, isUSA }]` |
| `printifyBlueprintId` | number | **Top-level** Printify blueprint ID — queryable, set by sync + backfill |
| `printifyPrintProviderId` | number | **Top-level** Printify print provider ID — set by sync + backfill |
| `printfulProductId` | number | **Top-level** Printful catalog product ID — queryable, set by sync + backfill |
| `canonicalTitle` | string | Display name (brand + model) |
| `brand` | string | e.g. `Bella+Canvas` |
| `model` | string | e.g. `3001` |
| `originCountry` | string | e.g. `USA`, `Nicaragua` |
| `printifyImages` | string[] | Image URLs from Printify sync |
| `printfulImages` | string[] | Image URLs from Printful sync |
| `images` | string[] | Combined de-duped image set |
| `colors` | object[] | `{ name, hex }` from Printful (preferred) or Printify |
| `sizes` | string[] | Union of all provider sizes |
| `minPrice` / `maxPrice` | number | Lowest/highest variant price (USD) |
| `printPositions` | string[] | Raw position strings — e.g. `["front","back"]` — from Printify enrich |
| `printifyPlacements` | object[] | **Stored placements** `{ position, label, width, height }` — from backfill, Printify source |
| `printfulPlacements` | object[] | **Stored placements** `{ position, label, width, height }` — from backfill, Printful source |
| `lastSyncedAt` | timestamp | When last provider sync ran |
| `lastEnrichedAt` | timestamp | When last enrich job ran (colors/sizes/prices) |
| `lastPlacementSyncAt` | timestamp | When placements were last backfilled from carrier APIs |

**Single source of truth for placements:** `GET /public/catalog/placements` checks `master_catalog` for stored `printifyPlacements` / `printfulPlacements` first. Falls back to live carrier APIs only when not yet stored. Run `POST /api/admin/master-catalog/backfill-placements` (or click "Backfill Placements" in the admin Sync panel) to populate stored placements across the entire catalog.

Returned by `GET /api/master-catalog`. Categories served: `Tees` (101–199), `Hoodies` (201–299), `Hats` (301–399), `Drinkware` (401–499).

### GRF Graphic Reference Format

Every graphic asset is identified by a GRF code. Parallel to QRG (which identifies products), GRF identifies the visual building blocks those products are assembled from. The two schemas are independent and never mixed.

```
GRF - [TT] - [K] - [H] - [ST] - [NNNNNN]
       ↑       ↑     ↑      ↑       ↑
     type    role  host  subtype sequence
```

All segments are numeric. No letters.

| Segment | Width | Meaning |
|---------|-------|---------|
| `GRF` | 3 chars | Brand prefix — always present |
| `[TT]` | 2 digits | Asset type — what kind of graphic this is |
| `[K]` | 1 digit | Role — where this asset sits in the production pipeline |
| `[H]` | 1 digit | Hosting mode — where the asset lives |
| `[ST]` | 1 digit | Presentation subtype — branches by hosting mode |
| `[NNNNNN]` | 6 digits | Atomic sequence, zero-padded, unique per type+role bucket |

**Type codes `[TT]`**

| Code | Name |
|------|------|
| `01` | Upload Source |
| `02` | Cropped Derivative |
| `03` | Background |
| `04` | QR Graphic |
| `05` | Canvas Design |
| `06` | URL Artifact Image |
| `07` | Template Graphic |

**Role codes `[K]`**

| Code | Name |
|------|------|
| `1` | Source |
| `2` | Derivative |
| `3` | Renderable |
| `4` | Final |
| `5` | Template |

**Hosting mode `[H]`**

| Code | Name |
|------|------|
| `0` | Online (hosted URL) |
| `1` | Local (design-layer construct) |

**Presentation subtype `[ST]`** — meaning branches by `[H]`

When Online (`H=0`):

| Code | Name |
|------|------|
| `1` | Image (PNG, JPG, WebP, SVG) |
| `2` | Video (MP4, WebM) |
| `3` | Document (PDF) |
| `4` | Audio |

When Local (`H=1`):

| Code | Name |
|------|------|
| `5` | Zone |
| `6` | Canvas |
| `7` | Text |
| `8` | Graphic |
| `9` | Composite |

**Examples:**
```
GRF-04-3-0-1-000001   QR Graphic · Renderable · Online · Image
GRF-05-4-1-6-000003   Canvas Design · Final · Local · Canvas
GRF-03-3-0-2-000012   Background · Renderable · Online · Video
```

**Regex:** `^GRF-(01|02|03|04|05|06|07)-[12345]-[01]-[123456789]-[0-9]{6}$`

**Authority file:** `shared/graphicCodes.ts` — `buildGraphicId()`, `parseGraphicId()`, `isValidGraphicId()`

**Firestore:** `grf_counters/{typeCode}_{roleCode}` (atomic counter) · `library_assets` (docs with `assetType="graphic"`, `grfId` field)

**API:** `POST /api/admin/graphics/save-grf` — mints a GRF code and writes to `library_assets`. Required body: `typeCode`, `roleCode`, `hostingMode`, `subtype`, `imageUrl`.

**Full spec:** See Section 18 of `METHODOLOGY.md`.

### BLD Build Definition Schema

Every reusable product build configuration is identified by a BLD code. Parallel to QRG (products) and GRF (graphic assets), BLD captures layer layouts, text styling, and graphic positioning independent of any specific product or packet.

```
BLD - [1] [2] [3] [4] [5–6] ... [001–999]
```

| Position | Meaning |
|----------|---------|
| `[1]` | Context — `S`=Shirt graphic, `U`=URL |
| `[2]` | Layout mode (if S): `Z`=Zone, `P`=Palette — or Content type (if U): `I`=Image, `V`=Video, `D`=Document |
| `[3]` | Engine type: `T`=Text, `I`=Image, `Q`=QR, `A`=Action/CTA |
| `[4]` | Instance count (if T): 1–9 |
| `[5–6]` | Two-digit sequence per instance: 01–09 |
| `[last 3]` | Build sequence: 001–999 |

**Instance vehicles:** `txt` (role/font/size/weight/spacing/stroke/position) · `img` (role/size/position) · `qrc` (size/position — center locked in Zone, required in Palette) · `act` (font/stroke/url/position — always optional) · `vid` (playback/source/type/ratio/size/length) · `doc` (playback/source/format/pages/layout/fontSize)

**Example:** `BLD-SZ9001` = Shirt · Zone · 9 ordered layer instances · build #001

**Full spec:** See [`BLD.md`](./BLD.md).

### Catalog Management System

Everything runs through named catalogs. Admin creates catalogs (curated subsets of blanks), assigns them to 5 sections (Member, Public, External, Marketplace, Platform). Managed from `admin-blanks.tsx`. Data stored in `catalogs`, `systemSettings/catalog-assignments`, `systemSettings/catalog-defaults` Firestore collections.

**Good/Better/Best Tier System:** Products tagged with tiers. Stored as `blankTiers: { blankId: "good"|"better"|"best" }` on catalog docs. `TierPickerStep` shows tier cards in wizards; falls back to flat list when no tiers configured.

### Central Fetch Utilities

Two utilities replace all scattered `apiBase` + `getAuthHeaders` + raw `fetch` patterns:

| Utility | File | Base URL | Use For |
|---|---|---|---|
| `adminFetch` | `client/src/lib/adminFetch.ts` | `/api/admin` | All admin feature API calls |
| `memberFetch` | `client/src/lib/memberFetch.ts` | `/api/members` | All member feature API calls |

Both accept `json: payload` for JSON bodies and `body` for FormData/multipart. Auth headers are injected automatically.

**Legitimate exceptions** (keep using `getAuthHeaders()` directly):
- `/api/connect/...` endpoints — different route prefix, no dedicated utility
- `/api/member/...` (singular) endpoints — separate route tree from `/api/members/` (plural)
- XHR video uploads — need raw `XMLHttpRequest` for progress event tracking

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

**Always use the three-step scripts in `deploy/` — never chain them into one command (timeout risk).**

### Step 1 — Bump BUILD_ID + build both (timeout 60s)

```bash
bash deploy/1-build.sh
```

### Step 2 — Deploy Cloud Functions (timeout 90s)

```bash
bash deploy/2-functions.sh
```

### Step 3 — Deploy Frontend Hosting (timeout 60s)

```bash
bash deploy/3-hosting.sh
```

> **Why BUILD_ID?** `_BUILD_ID` on line 1 of `functions/src/index.ts` is stamped with a timestamp+random before every build. This changes the compiled bundle hash so Firebase always deploys instead of silently skipping ("No changes detected").
> **If step 2 times out:** re-run `bash deploy/2-functions.sh` alone — the compiled output from step 1 is still valid.

### Post-Deploy Verification

```bash
curl -s -o /dev/null -w "%{http_code}" https://qrgear-c1ffd.web.app/
curl -s -o /dev/null -w "%{http_code}" https://qrgear-c1ffd.web.app/shop
```

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

**Delete behavior (soft-delete):** Deleting a catalog instance sets `isVisible: false`, `status: 'deleted'`, and `deletedAt` — it does NOT hard-delete the Firestore document. Deleting a channel or store cascades this soft-delete to all matching `admin_catalog_instances`. All public store endpoints (`store-files.ts`) filter out any instance where `isVisible === false` or `status === 'deleted'`, so deleted products are immediately invisible to shoppers.

---

## Canon Rules for Future Agents

1. **NEVER** use raw `fetch()` with `getAuthHeaders()` for `/api/admin/` or `/api/members/` calls — always use `adminFetch` or `memberFetch` from `client/src/lib/`. Exception: `/api/connect/`, `/api/member/` (singular), and XHR calls (for progress tracking) may keep using `getAuthHeaders()` directly.
2. **NEVER** add `originalDescription`, `adminDescription`, or `customDescription` to client code
3. **NEVER** create a second viewer system — use `SharedViewer` with canon views and skins
4. **NEVER** put business logic in viewers, views, or skins — controllers own authority
5. **NEVER** invent new view types — compose from the 5 canon views
6. **NEVER** use `collectionTag` — it has been fully removed; use `collectionId`
7. **ALWAYS** use `canonicalBlankKey` for product identity; never reconstruct from raw IDs
8. **ALWAYS** use `resolveDescription()` or `resolvePublicDescription()` for description resolution
9. **ALWAYS** use `normalizeWizardProduct()` when building wizard product objects
10. **ALWAYS** import collection names from `functions/src/constants.ts` — never redefine locally
11. **ALWAYS** deploy to production after every change; update the ZIP
12. **NEVER** hard-delete `admin_catalog_instances` documents — always soft-delete (`isVisible: false`, `status: 'deleted'`, `deletedAt`). Store/channel deletes must cascade this soft-delete to all child instances.

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

## Known Agent Failure — Admin UI Bypass for Testing

**Date:** May 3, 2026

**What was asked:** Add a way for the agent to visually inspect admin pages (e.g. `/admin/products`) during testing without being blocked by the login wall.

**What the agent did wrong:**
1. Built a `VITE_DEV_BYPASS=true` flag and wired it into `.env.development` — which only affects the local dev server. This project runs **production only** on Firebase. The dev server is disabled and irrelevant.
2. Was told this explicitly. Did it again anyway by baking the flag into `deploy/1-build.sh`.
3. Was told again. Finally reverted everything.

**The correct approach (not yet implemented):**
The agent cannot visually test admin pages on the production site without an active authenticated session. Options for a future fix:
- Use the Firebase Emulator with a seeded admin user for visual testing.
- Accept that the agent verifies correctness by code-tracing (reading route files, component files, and Firestore) rather than screenshots.

**What is permanently true about this project:**
- **Production only.** Firebase hosting at `https://qrgear-c1ffd.web.app`. The dev server is disabled.
- All backend logic lives in `functions/src/routes/`. Changes to `server/routes/` are secondary.
- Deploy always uses the three scripts in `deploy/` in order.

---

## License

Proprietary — All rights reserved.
