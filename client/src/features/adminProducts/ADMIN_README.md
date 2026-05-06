# QR Gear — Admin Operating Law

Last updated: May 6, 2026

> Current operating state only. For history see `ADMIN_CHANGELOG.md`. For schema authority see `ADMIN_SCHEMA_MAP.md`. For full route inventory see `ADMIN_ROUTES.md`.

---

## The Five Admin Sections

| Section | Route | Purpose |
|---------|-------|---------|
| **Run** | `/admin` | Dashboard — drafts in progress, quick actions, section links |
| **Build** | `/admin/products` | Product builder, templates, library, blanks, dynamics |
| **Place** | `/admin/store-planner` | Store builder, store library, partners, external sites |
| **Sell** | `/admin/orders` | Orders, customers, pricing, coupons, gifts, orchestration |
| **System** | `/admin/settings` | Settings, health, email, manual |

---

## Product Builder

**Route:** `/admin/products`

**State management:** `client/src/features/adminProducts/builder/BuilderContext.tsx`
**Container:** `client/src/features/adminProducts/builder/BuilderHarness.tsx`
**Modules:** `client/src/features/adminProducts/builder/modules/`

### Builder Modules (in order)

| Module | File | Purpose |
|--------|------|---------|
| Basics | `BasicsContentModule.tsx` | Product name, description, category |
| Compose | `ComposeContentModule.tsx` | Background, images, text zones |
| Text | `ProductGraphicTextModule.tsx` | Header/footer text, fonts, colors |
| QR Code | *(inline in BuilderHarness)* | Size (40–85%), position, presets S/M/L/XL |
| Placement | `PlacementModule.tsx` | Print areas on the blank product |
| Products | `ProductsModule.tsx` | Select blank products to apply design to |
| State | `StateModule.tsx` | Product lifecycle (draft → active → archived) |
| Play | `PlayContentModule.tsx` | Preview the product graphic |

### Product Graphic Renderer

**File:** `client/src/features/shared/graphics/productGraphicRenderer.ts`

- Canvas: 1200 × 1800 px
- **Header zone** — top text/image (~20% canvas height when active)
- **Middle zone** — QR code lives here (gets all remaining space)
- **Sub-bottom zone** — strip below QR when enabled
- **Footer zone** — bottom text/image (~16% canvas height when active)
- Inactive zones collapse to 0 — QR code grows to fill

**QR size controls:**
- Slider: 40–85 (step 2)
- Presets: S=48, M=56, L=64, XL=72
- Default: 42%
- Reset: returns to qrSizePercent=42, qrPositionY=0
- Applied as: `min(regionWidth, regionHeight) * percent / 100`

### Draft Save / Resume

- **Save Draft** button (bookmark icon) appears in the sticky bar when a session is active
- Inline name input → saves `draftName` to `admin_build_sessions` via `PATCH /api/admin/build-sessions/:id`
- **In Progress** section on `/admin` lists named drafts (from `GET /api/admin/build-sessions?status=working`)
- **Resume** navigates to `/admin/products?resume=<sessionId>`
- `DraftResumeHandler.tsx` detects URL param → fetches session + linked packet → resolves catalog product → calls `loadFromPacketData` or `loadFromWorkingState`

**Key files:**
- `client/src/features/adminProducts/builder/modules/BuilderStickyBar.tsx` — Save Draft button
- `client/src/features/adminProducts/builder/modules/DraftResumeHandler.tsx` — URL param + state restore
- `client/src/pages/admin-run.tsx` — In Progress section

### Builder Autosave

- Debounced PATCH to `admin_build_sessions` on every state change
- `buildWorkingSnapshot()` in `BuilderContext.tsx` serializes: title, description, images, graphics (content + loaded assets), QR config, layout config, metadata (selectedProductDocId, selectedProductBlueprintId, selectedCatalogId, store, channel, collection)
- `buildBldDraft()` serializes layout-only: `{ layoutMode, instanceCount, layers[] }` — NO QRG references (Iron Rule)
- `autoSaveFailed: true` exposed via context → sticky bar shows red "Save failed" badge

### Product Resolution on Resume (MODE 2 — no packet yet)

Resolution order for `loadFromWorkingState`:
1. `session.sourceMasterId` → `p.docId`
2. `working.metadata.selectedProductDocId` → `p.docId`
3. `working.metadata.selectedProductBlueprintId` → `p.blueprintId` (numeric)
4. `working.qrConfig.templateProductHint` → `p.blueprintId` (last resort)

---

## Image Library

**Route:** `/admin/library`

**Key files:**
- `client/src/features/adminLibrary/LibraryPage.tsx`
- `client/src/features/adminLibrary/tabs/ImagesTab.tsx`
- `client/src/features/adminLibrary/tabs/BackgroundsTab.tsx`
- `client/src/features/adminLibrary/tabs/TemplatesTab.tsx`

**Folder system:** Firestore `admin_image_folders` collection. Max 80 chars, case-insensitive duplicate detection via `normalizedName`. Storage path: `library/images/{folderName}/{timestamp}-{safeName}.{ext}`.

---

## Blank Catalog (Admin Blanks)

**Route:** `/admin/products` → Blanks tab

**Key files:**
- `client/src/features/adminProducts/controllers/useAdminBlanksController.ts`
- `client/src/pages/admin-blanks.tsx`

### QRG Blank ID System

Blank identity in Firestore uses `qrg_STNNN` format (5-digit: e.g. `qrg_11001`).

| Format | Example | Used for |
|--------|---------|----------|
| `qrg_STNNN` | `qrg_11001` | Canonical Firestore doc ID |
| `QRG-STNNN` | `QRG-11001` | Display only |
| `py_NNN` | `py_12` | Printify blueprint (lookup only, never persisted) |
| `pf_NNN` | `pf_456` | Printful product (lookup only, never persisted) |
| `pending_*` | `pending_py_12` | Unclassified, not yet canonical |

**Iron Rules:**
- Provider IDs are NEVER written to `catalog.blankIds` or overlay maps
- `resolveCatalogBlankId()` in `admin-catalogs-shelf.routes.ts` is the single resolution path: any provider key → `qrg_STNNN`
- 4-digit (`qrg_1101`) and 3-digit (`qrg_101`) legacy formats are invalid
- `expandBlankIdSet()` in `useAdminBlanksController.ts` handles legacy Firestore data — keep it

### Catalog Overlay Maps

All nine maps must use the same `qrg_STNNN` keys as `blankIds`:
`blankIds`, `blankTiers`, `blankDescriptions`, `blankTitles`, `blankMakers`, `blankModels`, `blankProviders`, `blankImages`, `blankPrimaryImages`

### Auto-Shelf Grouping

Catalog mode groups by `qrgCategory` field on the master catalog doc (set during sync). This is automatic — no manual `admin_build_shelf` assignment needed.

---

## Store Builder

**Route:** `/admin/store-planner`

**Key files:**
- `client/src/features/adminProducts/storeBuilder/StoreBuilderHarness.tsx`
- `client/src/features/adminProducts/storeBuilder/StoreBuilderContext.tsx`

Flow: Store Picker → Channel Picker → Catalog Browser → Product Configure → Assignment

---

## QR Dynamics

**Route:** `/admin/dynamics`
**Spec:** `docs/QR_DYNAMICS_SPEC.md`
**Resolver:** `shared/qrDynamicsResolver.ts`

Each QR code links to dynamic content (video, URL, image, text, contact card) that can change after printing.

---

## Email System (NexusMail)

**Shared types:** `shared/nexusmail/`
**Implementation:** `functions/src/nexusmail/`
**Provider:** Resend

Handles: order confirmations, shipping notifications, claim code delivery, welcome emails.

---

## Orders & Fulfillment

**Route:** `/admin/orders`

**Key files:**
- `functions/src/services/order-service.ts`
- `functions/src/routes/checkout.ts`

Flow: Cart → Checkout (Stripe) → Order (Firestore) → Fulfillment (Printify / Printful / Apliiq) → Tracking

---

## Member Management

**Route:** `/admin/customers`

Members can: create custom products, manage QR dynamic content, build storefronts, upload media.

**Description cascade:** `memberPacketDescription ?? adminCatalogDescription ?? providerDescription`

---

## Firestore Collections

| Collection | Purpose |
|------------|---------|
| `admin_products` | Product definitions and graphics |
| `admin_images` | Image metadata (name, folder, storageUrl) |
| `admin_image_folders` | Folder names with `normalizedName` |
| `admin_stores` | Store configurations |
| `admin_build_sessions` | Builder sessions (status, working state, draftName, linked packetId) |
| `admin_catalog_instances` | Committed product instances. Fields: storeId, channelId, collectionName, currentPacketId, enabledColors[], enabledSizes[], resolved (title, images[], colors[], sizes[], pricing.customerPrice), createdAt |
| `admin_settings` | Platform settings |
| `master_catalog` | Canonical blank catalog — doc ID = `qrg_STNNN`. Fields: qrgBlankId, qrgCategory, categorySource, availableVia, providerMappings, canonicalTitle, brand, model, originCountry, printifyImages[], printfulImages[], images[] |
| `stores` | Top-level store docs (storeId = doc ID, e.g. `qr-gear`) |
| `storeChannels` | Channel docs (channelId = doc ID). Fields: storeId, name |
| `members` | Member accounts |
| `member_packets` | Member product customizations |
| `orders` | Customer orders |
| `dynamics` | QR dynamic content entries |
| `claims` | Claim codes |
| `gifts` | Gift configurations |
| `categories` | Product categories |
| `bld_definitions` | BLD records. See `ADMIN_SCHEMA_MAP.md` |
| `bld_counters` | Atomic BLD sequence counters |
| `grf_assets` | GRF asset file records. See `ADMIN_SCHEMA_MAP.md` |
| `grf_counters` | Atomic GRF sequence counters |
| `assemblies` | Assembly linking records. See `ADMIN_SCHEMA_MAP.md` |
| `asm_counters` | Atomic Assembly sequence counters |

## Firebase Storage Paths

| Path | Content |
|------|---------|
| `library/images/{folder}/{file}` | Admin uploaded images |
| `library/backgrounds/raw/` | Raw background images |
| `library/backgrounds/cropped/` | Cropped backgrounds |
| `library/member/{userId}/` | Member uploaded media |
| `mockups/` | Generated product mockups |

---

## Deploy

See `SKILLS.md` Skill 2 (Always Deploy) and the `deploy/` scripts.

```bash
bash deploy/1-build.sh      # Build frontend + functions (90s)
bash deploy/2-functions.sh  # Deploy Cloud Functions (90s) — only if functions changed
bash deploy/3-hosting.sh    # Deploy frontend to Firebase Hosting (75s)
```

**Rules:**
- Bump `_BUILD_ID` in `functions/src/index.ts` + `version` in `functions/package.json` before any functions deploy
- NEVER chain steps 1+2 or 2+3 — run each separately
- Frontend-only changes: run 1 then 3, skip 2

**Live URL:** https://qrgear-c1ffd.web.app

---

## Rebuild From Zip

1. Extract `QR_Gear_Full_Website.zip`
2. `npm install` (root) + `cd functions && npm install`
3. Set env vars: `FIREBASE_SERVICE_ACCOUNT_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `RESEND_API_KEY`, `VITE_FIREBASE_*`
4. Configure `functions/.env`
5. `bash deploy/1-build.sh` → `bash deploy/2-functions.sh` → `bash deploy/3-hosting.sh`
6. Upload library images via `/admin/library`

---

## Key Source Files

| File | Purpose |
|------|---------|
| `client/src/features/adminProducts/builder/BuilderContext.tsx` | Builder state, autosave, snapshot |
| `client/src/features/adminProducts/builder/BuilderHarness.tsx` | Builder container |
| `client/src/features/shared/graphics/productGraphicRenderer.ts` | Canvas engine |
| `client/src/features/adminProducts/controllers/useAdminBlanksController.ts` | Blanks page logic |
| `shared/blankKeys.ts` | `isQRGBlankId`, `getCanonicalBlankKey` helpers |
| `shared/qrgCodes.ts` | QRG code helpers |
| `shared/graphicCodes.ts` | GRF ID helpers |
| `shared/assemblyCodes.ts` | Assembly ID helpers |
| `server/routes/admin-catalogs-shelf.routes.ts` | `resolveCatalogBlankId()` — canonical resolution path |
| `functions/src/routes/admin-build-sessions.ts` | Build session PATCH + commit (prod) |
| `functions/src/routes/bld.ts` | BLD CRUD (prod) |
| `functions/src/routes/assemblies.ts` | Assembly CRUD (prod) |
| `functions/src/index.ts` | Cloud Functions entry — `_BUILD_ID` on line 1 |
