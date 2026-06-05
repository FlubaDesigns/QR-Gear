# QR Gear — Admin Operating Law

Last updated: June 5, 2026 (blankColors catalog overlay — admin now curates which colors appear in the member wizard color picker; replaces hardcoded SHIRT_COLORS fallback.)

> History → `ADMIN_CHANGELOG.md` | Schema authority → `ADMIN_SCHEMA_MAP.md` | Route inventory → `ADMIN_ROUTES.md`

## Required Reading

Before making any changes to this project, read these files in full:

| File | Purpose |
|------|---------|
| `replit.md` | Project overview, stack, architecture decisions, gotchas, and user preferences — the top-level source of truth |
| `VVSS.md` | VVSS four-digit code system — naming conventions, folder structure, and canon component set for all UI surfaces |
| `ARCHITECTURE_VIEWER.md` | Binding law for the five-layer UI architecture (Domain → Controller → Viewer → View → Skin/Shape) — no exceptions |
| `QRG.md` *(root)* | QRG identity system — canonical blank identity, STNNN format, and QRG code rules |
| `GRF.md` *(root)* | GRF schema — graphic/asset file identity, 5-digit format, channel-relative purpose, and registration rules |
| `BLD.md` *(root)* | BLD schema — build/layout structure, what BLD owns and must never contain |

---

## ADMIN AUTHORITY MAP

Admin is divided into five sections:

| Section | Purpose |
|---------|---------|
| **RUN** | Dashboard, sessions, in-progress work |
| **BUILD** | Blanks, products, graphics, packet creation |
| **PLACE** | Stores, channels, collections (public-facing structure) |
| **SELL** | Pricing, orders, customers |
| **SYSTEM** | Settings, health, email, integrations |

> **IMPORTANT:** `/admin/products` is the BUILD cockpit — not a catalog page. It is where product graphics are created, assembled, and committed. The blank catalog lives at `/admin/blanks`.

---

## SCHEMA CHAIN (LOCKED)

```
QRG      = identity       — what the blank product IS
BLD      = build/layout   — structure only, NO identity
GRF      = graphics/asset — files only, NO layout logic
ASSEMBLY = joins QRG + BLD + GRF — the ONLY place they connect
PACKET   = final sellable product, references an Assembly
INSTANCE = a committed product in a store/channel
```

**Absolute rules:**
- BLD must NEVER contain `qrgBlankId`, `qrgBaseCode`, or any QRG reference
- GRF must NEVER contain layout logic, zone data, or placement info
- QRG must NEVER be generated as fake, fallback, or client-side
- Assembly is the ONLY layer that joins QRG + BLD + GRF
- Commit reads `qrgBlankId` from `master_catalog` via `session.sourceMasterId` — never from the BLD draft

Source files: `shared/blankKeys.ts`, `shared/qrgCodes.ts`, `shared/graphicCodes.ts`, `shared/assemblyCodes.ts`
Full definitions: `BLD.md`, `GRF.md`, `QRG.md`, `ASSEMBLY.md` (Canonical Core — these win over everything)

**GRF ID format:** `GRF-[D1][D2][D3][D4][D5]-[NNNNNN]` — 5 descriptor digits + 6-digit sequence.
D1=asset class (1=input build, 2=output artifact) · D2=media type · D3=channel · D4=purpose (channel-relative) · D5=format.
No D6/subContext — D4 purpose meaning depends on D3 channel.
Example: `GRF-11411-000001` = input build · image · assets · original · PNG · #1
Example: `GRF-21111-000001` = output artifact · image · print · qr_composite · PNG · #1

---

## BUILD FLOW

```
1. Select Blank (QRG identity established)
2. Build Layout  → BLD draft  (layout only — no QRG inside)
3. Add Graphics  → GRF draft  (asset files — no layout inside)
4. Autosave      → admin_build_sessions (working state)
5. Commit        → creates:
     BLD record       (bld_definitions)
     GRF record       (grf_assets)
     Assembly record  (assemblies)  ← joins QRG + BLD + GRF
     Packet           (packets)
     Instance         (admin_catalog_instances)
```

**Autosave stores separately:**
- Selected blank identity → `working.metadata.selectedProductDocId`
- Layout draft → `working.bldDraft` → `{ layoutMode, instanceCount, layers[] }` — layout only
- Graphics draft → `working.graphics`

Selected blank is NOT inside the BLD draft. They are stored at different levels of the working snapshot.

---

## Admin Routes (App.tsx — verified)

### RUN
| Route | Component | Purpose |
|-------|-----------|---------|
| `/admin` | AdminRun | Dashboard — drafts, quick actions, section links |
| `/admin/run` | → redirect | Alias for `/admin` |
| `/admin/dashboard` | → redirect | Alias for `/admin` |

### BUILD
| Route | Component | Purpose |
|-------|-----------|---------|
| `/admin/products` | AdminProducts | BUILD cockpit — product graphic builder |
| `/admin/blanks` | AdminBlanks | Blank catalog curation and QRG assignment |
| `/admin/library` | LibraryPage | Images, backgrounds (tab), templates, graphics, assemblies |
| `/admin/videos` | AdminVideos | Video content management |
| `/admin/categories` | AdminCategories | Product category management |
| `/admin/tags` | AdminTags | Tag management |
| `/admin/fonts` | FontManagement | Custom font management |

> Backgrounds are managed inside `/admin/library` → Backgrounds tab. There is no standalone `/admin/backgrounds` route.
> QR Dynamics is a public feature at `/qr-dynamics`. There is no `/admin/dynamics` route.

### PLACE
| Route | Component | Purpose |
|-------|-----------|---------|
| `/admin/store-planner` | StorePlanner | PLACE cockpit — product configs, store tool links |
| `/admin/store-builder` | AdminStoreBuilder | Configure storefronts and assign products |
| `/admin/store-library` | AdminStoreLibrary | Browse existing stores and channels |
| `/admin/partners` | AdminPartners | Partner / referral management |
| `/admin/external-sites` | AdminExternalSites | Manage embedded product widgets |
| `/admin/marketplaces` | AdminMarketplaces | Marketplace integrations (eBay, Etsy, Amazon) |

> Store Builder exists in admin but **belongs to PLACE, not BUILD**. It is not part of the product build system.

### SELL
| Route | Component | Purpose |
|-------|-----------|---------|
| `/admin/orders` | AdminOrders | View and manage customer orders |
| `/admin/customers` | AdminCustomers | View registered members |
| `/admin/pricing` | AdminPricing | Pricing rules and margins |
| `/admin/orchestration` | AdminOrchestration | Bulk operations, analytics, routing |
| `/admin/gifts` | AdminGifts | Gift card and gift flow management |
| `/admin/coupons` | AdminCoupons | Coupon management |

### SYSTEM
| Route | Component | Purpose |
|-------|-----------|---------|
| `/admin/settings` | AdminSettings | Platform-wide settings |
| `/admin/health` | AdminHealth | System health monitoring |
| `/admin/email-templates` | AdminEmailTemplates | Automated email configuration |
| `/admin/email-health` | AdminEmailHealth | Email delivery monitoring |
| `/admin/manual` | AdminManual | Admin manual |
| `/admin/sales/build` | StoreBuild | Sales build flow |

---

## Product Builder (BUILD Cockpit)

**Route:** `/admin/products`
**State:** `client/src/features/adminProducts/builder/BuilderContext.tsx`
**Container:** `client/src/features/adminProducts/builder/BuilderHarness.tsx`
**Modules:** `client/src/features/adminProducts/builder/modules/`

### Builder Modules

| Module | File | Purpose |
|--------|------|---------|
| Basics | `BasicsContentModule.tsx` | Product name, description, category |
| Compose | `ComposeContentModule.tsx` | Background, images, text zones |
| Text | `ProductGraphicTextModule.tsx` | Header/footer text, fonts, colors |
| QR Code | *(inline)* | Size slider 40–85%, position, presets S/M/L/XL |
| Placement | `PlacementModule.tsx` | Print areas on the blank |
| Products | `ProductsModule.tsx` | Select blank products to apply design to |
| State | `StateModule.tsx` | Product lifecycle: draft → active → archived |
| Play | `PlayContentModule.tsx` | Preview the product graphic |

### Product Graphic Renderer

**File:** `client/src/features/shared/graphics/productGraphicRenderer.ts`

- Canvas: 1200 × 1800 px
- **Header zone** — top text/image, ~20% when active
- **Middle zone** — QR code, expands to fill inactive zones
- **Sub-bottom zone** — text strip below QR
- **Footer zone** — bottom text/image, ~16% when active
- QR size applied as: `min(regionWidth, regionHeight) * percent / 100`
- Default QR size: 42%. Reset returns to `qrSizePercent=42, qrPositionY=0`

### Draft Save / Resume

- Save Draft button (bookmark icon) in sticky bar → saves `draftName` to `admin_build_sessions`
- In Progress section on `/admin` → lists named drafts
- Resume → `/admin/products?resume=<sessionId>` → `DraftResumeHandler` restores state

**Two restore modes:**
- **MODE 1** (packet exists): resolves via `packetData.blueprintId` → calls `loadFromPacketData`
- **MODE 2** (no packet yet): resolves via `sourceMasterId` → `p.docId` → calls `loadFromWorkingState`

**Product resolution order (MODE 2):**
1. `session.sourceMasterId` → `p.docId`
2. `working.metadata.selectedProductDocId` → `p.docId`
3. `working.metadata.selectedProductBlueprintId` → `p.blueprintId` (numeric)
4. `working.qrConfig.templateProductHint` → `p.blueprintId` (last resort)

**Key files:**
- `BuilderStickyBar.tsx` — Save Draft button, autosave failure badge
- `DraftResumeHandler.tsx` — URL param detection, state restore
- `client/src/pages/admin-run.tsx` — In Progress section

---

## Blank Catalog (`/admin/blanks`)

**Key files:**
- `client/src/features/adminProducts/controllers/useAdminBlanksController.ts`
- `client/src/pages/admin-blanks.tsx`

### QRG Blank ID System

| Format | Example | Role |
|--------|---------|------|
| `qrg_STNNN` | `qrg_11001` | Canonical Firestore doc ID — the only persisted identity |
| `QRG-STNNN` | `QRG-11001` | Display only |
| `py_NNN` | `py_12` | Printify blueprint — lookup/reference only, never persisted |
| `pf_NNN` | `pf_456` | Printful product — lookup/reference only, never persisted |
| `pending_*` | `pending_py_12` | Unclassified blank, not yet canonical |

**Rules:**
- 4-digit (`qrg_1101`) and 3-digit (`qrg_101`) formats are invalid
- `resolveCatalogBlankId()` in `admin-catalogs-shelf.routes.ts` is the single resolution path: any input → `qrg_STNNN`
- All ten catalog overlay maps must use `qrg_STNNN` keys: `blankIds`, `blankTiers`, `blankDescriptions`, `blankTitles`, `blankMakers`, `blankModels`, `blankProviders`, `blankImages`, `blankPrimaryImages`, `blankColors`
- `expandBlankIdSet()` in `useAdminBlanksController.ts` handles legacy Firestore data — do not remove
- Shelf grouping is automatic via `qrgCategory` field — no manual `admin_build_shelf` assignments needed

---

## Image Library (`/admin/library`)

**Key files:**
- `client/src/features/adminLibrary/LibraryPage.tsx`
- `client/src/features/adminLibrary/tabs/BackgroundsTab.tsx`
- `client/src/features/adminLibrary/tabs/TemplatesTab.tsx`
- `client/src/features/adminLibrary/tabs/GraphicsTab.tsx`
- `client/src/features/adminLibrary/tabs/AssembliesTab.tsx`

Folders → Firestore `admin_image_folders`. Max 80 chars, `normalizedName` for duplicate detection.
Storage path: `library/images/{folderName}/{timestamp}-{safeName}.{ext}`

---

## Store Builder (`/admin/store-planner`)

Store Builder belongs to **PLACE**, not BUILD. It is not part of the product build system.

**Key files:**
- `client/src/features/adminProducts/storeBuilder/StoreBuilderHarness.tsx`
- `client/src/features/adminProducts/storeBuilder/StoreBuilderContext.tsx`

Flow: Store Picker → Channel Picker → Catalog Browser → Product Configure → Assignment

---

## Email System (NexusMail)

**Shared types:** `shared/nexusmail/` | **Implementation:** `functions/src/nexusmail/` | **Provider:** Resend

Handles: order confirmations, shipping notifications, claim code delivery, welcome emails.

---

## Firestore Collections

| Collection | Purpose |
|------------|---------|
| `admin_build_sessions` | Builder sessions — status, working state, draftName, linked packetId |
| `admin_catalog_instances` | Committed product instances. Fields: storeId, channelId, collectionName, currentPacketId, enabledColors[], enabledSizes[], resolved (title, images[], pricing.customerPrice), createdAt |
| `admin_image_folders` | Library folders with `normalizedName` |
| `admin_images` | Image metadata |
| `admin_products` | Product definitions |
| `admin_settings` | Platform settings |
| `admin_stores` | Store configurations |
| `assemblies` | Assembly records linking QRG + BLD + GRF → see `ADMIN_SCHEMA_MAP.md` |
| `asm_counters` | Atomic Assembly sequence counters |
| `bld_definitions` | BLD layout records → see `ADMIN_SCHEMA_MAP.md` |
| `bld_counters` | Atomic BLD sequence counters |
| `categories` | Product categories |
| `claims` | Claim codes |
| `dynamics` | QR dynamic content entries |
| `gifts` | Gift configurations |
| `grf_assets` | GRF asset file records → see `ADMIN_SCHEMA_MAP.md` |
| `grf_counters` | Atomic GRF sequence counters |
| `master_catalog` | Canonical blank catalog. Doc ID = `qrg_STNNN`. Fields: qrgBlankId, qrgCategory, availableVia, providerMappings, canonicalTitle, brand, model, printifyImages[], printfulImages[], images[] |
| `members` | Member accounts |
| `member_packets` | Member product customizations |
| `orders` | Customer orders |
| `stores` | Top-level store docs (storeId = doc ID) |
| `storeChannels` | Channel docs. Fields: storeId, name |

## Firebase Storage Paths

| Path | Content |
|------|---------|
| `grf/{grfId}/{filename}` | GRF assets — canonical path for all product graphics (composites, glamor shots, URL graphics, source uploads, backgrounds, templates) |
| `library/images/{folder}/{file}` | Admin uploaded images (UI assets — not GRF pipeline) |
| `library/backgrounds/raw/` | Raw background images |
| `library/backgrounds/cropped/` | Cropped backgrounds |
| `library/member/{userId}/` | Member uploaded media |
| `mockups/` | Generated product mockups |

---

## Recent Changes Log

### June 5, 2026 — blankColors Catalog Overlay (Admin-Curated Color Picker)

Added a new `blankColors` overlay map to admin catalogs. Admins open any blank's detail modal in admin-blanks, check/uncheck provider colors, and save the selection. The member wizard `ColorPickerStep` now uses those curated colors instead of the hardcoded 6-color `SHIRT_COLORS` fallback. If no `blankColors` entry exists for a blank, the full provider color list is used (Printify) or the existing `SHIRT_COLORS` fallback (Printful). Colors are stored as `Array<{name: string; hex: string}>` under the `qrg_STNNN` key in `catalog.blankColors`.

#### Files Changed
| File | Change |
|------|--------|
| `functions/src/routes/tiers.ts` | Added `PUT /admin/catalogs/:catalogId/blank-colors`; `tier-products` now reads `blankColors` and overrides provider colors per-blank |
| `server/routes/admin-catalogs-shelf.routes.ts` | Dev-server mirror of `PUT /api/admin/catalogs/:id/blank-colors` |
| `client/src/features/adminProducts/controllers/useAdminBlanksController.ts` | Added `blankColors` to `AdminCatalog` interface, `saveColorsMutation`, `onSaveColors` callback; all returned from hook |
| `client/src/features/shared/components/skins/ProductSelectCardSkin.tsx` | Added `editableColors`, `savedColors`, `onColorsSave`, `colorsSaving` props to `ProductSelectCardSkinProps` and `PreviewModal`; color editor section (checkboxes + Save/Select All buttons) in the detail modal |
| `client/src/pages/admin-blanks.tsx` | Destructures new color props from controller; passes them to `AdminSourceBlankSkin` |
| `client/src/features/shared/components/wizardSteps/ProductSteps.tsx` | `ColorPickerStep` accepts `availableColors` prop; uses curated colors when provided, falls back to `SHIRT_COLORS` |
| `client/src/features/members/SimpleWizardStepContent.tsx` | Passes `selectedProductType?.availableColors` to `ColorPickerStep` |

### May 9, 2026 — Source Upload: Counter Collision Retry + GRF ID as Display Name

Two fixes to `POST /library/upload-source`:
1. **Counter collision retry** — if the minted GRF ID already exists in `grf_assets` (legacy doc occupying that slot), the endpoint now advances the counter and retries up to 10 times instead of returning a 500.
2. **Name stored as GRF ID** — `name` field in the new doc is now always `grfId`; original filename is preserved in `originalFilename` for reference. Frontend `assetToSkinItem` mapper updated to prefer `asset.grfId` over `asset.name`.

#### Files Changed
| File | Change |
|------|--------|
| `server/routes/library-source.routes.ts` | Retry loop (up to 10 attempts) past collision slots; `name: grfId` |
| `functions/src/routes/admin-library-source.ts` | Matching changes |
| `client/src/features/adminLibrary/tabs/SourceImagesTab.tsx` | `assetToSkinItem` mapper: `asset.grfId \|\| asset.name` |

---

### May 9, 2026 — Permanent Delete for Background and Cropped Images

Trash icon on Background and Cropped cards now permanently deletes (Firestore doc + Storage file) instead of archiving. New `DELETE /admin/graphics/:grfId` endpoint added to both dev server and Cloud Functions. Storage delete is best-effort — warns and continues if the file is already gone. Frontend `archiveMutation` renamed to `deleteMutation` in both tabs; toast updated to "Image deleted".

#### Files Changed
| File | Change |
|------|--------|
| `functions/src/routes/admin-graphics.ts` | Added `DELETE /admin/graphics/:grfId` — deletes Firestore doc + Storage file |
| `server/routes/admin-content.routes.ts` | Matching `DELETE /api/admin/graphics/:grfId` for dev server |
| `client/src/features/adminLibrary/tabs/BackgroundsTab.tsx` | `archiveMutation` → `deleteMutation`, calls `DELETE /graphics/:grfId` |
| `client/src/features/adminLibrary/tabs/CroppedImagesTab.tsx` | Same rename and endpoint change |

---

### May 9, 2026 — VVSS Alignment: Backgrounds and Cropped Tabs Go Flat (1·1·1·0)

Corrected the VVSS code for both the Backgrounds and Cropped tabs from `1·1·1·1` to `1·1·1·0` (flat — no Shape popup). Both tabs now place all actions (crop, archive/delete) directly on the card tile inside the Skin. No popup state anywhere. `BackgroundsTab.tsx` had `selectedItem`, `detailOpen`, `handleSelect`, and a `<BackgroundShape>` JSX block — all removed. `CroppedImageSkin.tsx` had an internal `useState`, `ModalView`, and `CroppedDetailShape` popup block — all stripped. `VVSS.md` real examples table updated for both entries.

#### Files Changed
| File | Change |
|------|--------|
| `client/src/features/shared/components/skins/BackgroundSkin.tsx` | Flat card `1·1·1·0` — crop + archive buttons on card, no popup, removed `BackgroundDetailSkin` export |
| `client/src/features/adminLibrary/tabs/BackgroundsTab.tsx` | Removed `selectedItem`, `detailOpen`, `handleSelect`, `BackgroundShape` import/JSX, `onClick` prop |
| `client/src/features/shared/components/skins/CroppedImageSkin.tsx` | Flat card `1·1·1·0` — archive button on card, removed `useState`/`ModalView`/`CroppedDetailShape` popup block |
| `client/src/features/adminLibrary/tabs/CroppedImagesTab.tsx` | VVSS comment updated to `1·1·1·0` |
| `VVSS.md` | Real examples table updated: Backgrounds and Cropped both listed as `1·1·1·0` |

---



### May 6, 2026 — Placement Crosswalk: left_chest Fix, Reverse-Lookup, Refresh Button, Provider Dims

Three bugs fixed in the `/admin/master-catalog/products/:docId/options` placement crosswalk:

1. **`left_chest` missing from `print_placements`** — `qrg_11111` (and similar products) store `"left_chest"` in `printPositions`, but the canonical crosswalk doc ID was `"pocket"`. Direct lookup returned nothing so the placement was silently dropped. Fix: added `left_chest` as a new canonical entry in the seed (providers: printful `left_chest`, printify `pocket`). Seeded directly to Firestore via admin SDK.

2. **Reverse-lookup fallback** — Added a `resolvePlacement()` helper in both the dev-server and Cloud Functions options endpoints. If a position string is not found as a direct canonical doc ID, it now scans all `print_placements` docs for any whose `providers[selectedProvider].dtgNames` or `dtfNames` contains the position name. This handles future cases where product `printPositions` values use provider-native names instead of canonical IDs.

3. **Provider-specific layout fields** — Each placement in the response now carries `canonicalLocationCode`, `providerPlacementId`, `sourceTable`, `printArea`, `safeArea`, `dpi`, and `rawProviderPlacement`. Dimensions use `providerEntry.dimensions || pp.dimensions` so per-provider overrides work when seeded. Frontend `ProductPlacement` type extended with new fields; `BuilderContext` mapping updated.

4. **Refresh button** — Added a `refreshPlacements()` callback to `BuilderContext` (exposed in context value). `PlacementModule` shows a small refresh icon button next to the placement count line, a "Retry" button in the error state, and a refresh icon in the empty state. All with `data-testid` attributes.

#### Files Changed
| File | Change |
|------|--------|
| `functions/src/routes/print-placements.ts` | Added `left_chest` seed entry (both providers), updated `pocket` to sortOrder 3.5, extended `ProviderEntry` type with per-provider layout fields |
| `functions/src/routes/master-catalog.ts` | `resolvePlacement()` reverse-lookup, `buildLocation()` helper, full provider-specific response shape, fallback paths updated |
| `server/routes/admin-catalog-browse.routes.ts` | Matching changes: `resolvePlacement()`, `buildLocation()`, provider-specific response shape |
| `client/src/features/adminProducts/builder/types.ts` | Added `providerPlacementId`, `sourceTable`, `rawProviderPlacement` to `ProductPlacement` |
| `client/src/features/adminProducts/builder/BuilderContext.tsx` | `refreshPlacements` callback + context value; maps new API fields |
| `client/src/features/adminProducts/builder/modules/PlacementModule.tsx` | Refresh icon button on success/error/empty states |

---

### May 7, 2026 — Schema-First Layout Pipeline (Tier 1–4)

The `/options` endpoint now resolves product family and type from QRG STNNN digits **before** any provider query. The S-digit maps to a schema family (apparel, houseware, accessories…) and the ST-digits map to a specific type (tshirt, hoodie, drinkware, hat…). This unlocks a four-tier dimension fallback:

- **Tier 1:** Canonical layout profile (`layout_profiles/family/type/canonical`) — standard dims seeded once per product type (e.g. 3600×4200 @300dpi for t-shirt front/back)
- **Tier 2:** Backfilled provider placements cached on the `master_catalog` doc (`printifyPlacements` / `printfulPlacements`)
- **Tier 3:** Live provider API (Printify variants endpoint)
- **Tier 4:** Generic `{front}` fallback

The response now includes `schemaFamily`, `schemaType`, and `canonicalProfilePath`. `BuilderContext` stores these on the merged `CatalogProduct` and `togglePlacement` writes them into `providerLayout` so the renderer and BLD packet always have schema identity alongside geometry. `buildLocation()` now chains canonical dims as the final dim fallback after provider crosswalk and `print_placements` doc.

#### Files Changed
| File | Change |
|------|--------|
| `functions/src/routes/master-catalog.ts` | QRG S/T digit parsing, parallel canonical profile load, Tier 2 backfilled path, `buildLocation()` dim fallback, `schemaFamily/schemaType/canonicalProfilePath` in response |
| `server/routes/admin-catalog-browse.routes.ts` | Identical mirrored changes for dev server |
| `client/src/features/adminProducts/builder/types.ts` | Added `schemaFamily`, `schemaType`, `canonicalProfilePath` to `CatalogProduct` and `ProviderLayout` |
| `client/src/features/adminProducts/builder/BuilderContext.tsx` | `fetchOptionsForProduct` stores schema fields on merged product; `togglePlacement` writes schema fields into `newProviderLayout` |

---

### May 6, 2026 — Provider-Filtered Print Placement

The product options endpoint now filters print locations by the selected fulfillment provider using the `print_placements` canonical crosswalk. Previously, all placements were always returned as Printify positions regardless of the selected provider.

**Correct chain:** selected provider → `print_placements` crosswalk filter → only placements where `providers[selectedProvider]` exists → provider-specific `providerPlacement` name (e.g. `front_large` for Printful DTG front) + dimensions returned.

**Frontend:** `BuilderContext` now passes `?provider=` on the options fetch and re-fetches placements automatically when the fulfillment provider changes while a product is already selected.

#### Files Changed
| File | Change |
|------|--------|
| `functions/src/routes/master-catalog.ts` | Options endpoint accepts `?provider=`, loads `print_placements` crosswalk, filters by provider |
| `server/routes/admin-catalog-browse.routes.ts` | Added matching native dev-server route for `/api/admin/master-catalog/products/:docId/options` |
| `client/src/features/adminProducts/builder/BuilderContext.tsx` | Passes `?provider=` param; adds `fulfillmentProviderRef` + re-fetch effect on provider change |
| `functions/src/index.ts` | BUILD_ID bumped |

---

### May 8, 2026 — GRF Schema Migration: 5-Digit Format, Channel-Relative Purpose, No subContext

Migrated the entire GRF (Graphic Reference Format) system to the new canonical 5-digit schema: `GRF-[D1][D2][D3][D4][D5]-[NNNNNN]`. The old 6-digit format had D6 as a "subContext" which was ambiguous and tightly coupled to print channel semantics. The new schema eliminates D6 entirely — D4 purpose is now channel-relative, meaning its value depends on which D3 channel is selected. This makes the schema self-describing and removes the need for a separate sub-context concept. All layers were updated: `shared/graphicCodes.ts` (GRF engine), both dev-server and Cloud Functions save-grf endpoints, the GRF registrar service, the Assembly slot validator (now uses `channel:purpose` pairs instead of flat purpose codes), the admin library UI (`LibraryContext`, `GraphicsTab`, `types.ts`), `admin-videos.tsx`, `schema-commit.ts`, `imageUtils.ts`, and `test-http-endpoint.ts`. No legacy shims remain.

#### Files Changed
| File | Change |
|------|--------|
| `shared/graphicCodes.ts` | Rewritten: 5-digit format, `GRF_PURPOSES_BY_CHANNEL` keyed by channel, removed D6/subContext |
| `functions/src/services/grf-registrar.ts` | Removed subContext, added originalFilename for assets/original |
| `functions/src/routes/file-routes.ts` | save-grf + GET filter: removed subContext, added originalFilename |
| `functions/src/routes/assemblies.ts` | Slot validator now uses `IMG_ALLOWED_CH_PURPOSE` Set + `QRC_REQUIRED_CH_PURPOSE` |
| `server/routes/admin-content.routes.ts` | save-grf + GET filter: removed subContext, added originalFilename |
| `server/lib/schema-commit.ts` | registerGrfDev: removed subContext, updated urlGraphic→urlSnapshot |
| `client/src/features/adminLibrary/shared/types.ts` | GrfAsset: channel/purpose/channelName/purposeName/originalFilename (removed typeCode/roleCode) |
| `client/src/features/adminLibrary/LibraryContext.tsx` | fetchAssets takes no args; fully rewritten |
| `client/src/features/adminLibrary/tabs/GraphicsTab.tsx` | Filters by channel+purpose using GRF_PURPOSES_BY_CHANNEL |
| `client/src/features/adminLibrary/shared/imageUtils.ts` | Removed storageUrl fallback (field no longer exists) |
| `client/src/pages/admin-videos.tsx` | Updated to new GRF schema (mediaType=2, channel=3, purpose=2) |
| `functions/test-http-endpoint.ts` | Updated test params to new 5-digit format, removed subContext |
| `functions/src/index.ts` | BUILD_ID bumped |

---

### May 7, 2026 — QRG Wall/Shelf Catalog Navigator

Replaced the freeform category dropdown in the "All Products" browsing mode with a structured QRG wall/shelf navigator. The navigator uses QRG STNNN digit parsing to group blanks by wall (S-digit = super-category: Apparel, Houseware, etc.) and shelf (ST-digit = product type within category). The current print provider (Printify/Printful) acts as the catalog gate — only blanks available via the selected provider are shown and counted in the navigator. Switching providers re-filters the same wall/shelf from the new provider's data without deselecting the current product or resetting navigation. The freeform category dropdown and the provider-switch reset effect have been removed.

#### Files Changed
| File | Change |
|------|--------|
| `client/src/features/adminProducts/builder/modules/ProductsModule.tsx` | Added QRG_WALL_LABELS, parseQrgWall, parseQrgShelf, matchesProvider helpers; added qrgWall/qrgShelf state; extended masterCatalogFull to also load in "all" mode; added qrgNavigatorData useMemo; added provider filter to filteredProducts; removed provider-switch reset effect; replaced CustomDropdown with wall/shelf button navigator |

---

## Deploy

```bash
bash deploy/1-build.sh      # Build frontend + functions (90s) — always first
bash deploy/2-functions.sh  # Deploy Cloud Functions (90s) — only if functions/ changed
bash deploy/3-hosting.sh    # Deploy frontend hosting (75s)
```

- Bump `_BUILD_ID` in `functions/src/index.ts` + `version` in `functions/package.json` before any functions deploy
- NEVER chain steps together — run each separately
- Frontend-only changes: step 1 → step 3, skip step 2

**Live URL:** https://qrgear-c1ffd.web.app

---

## PENDING AGENT WORK — GRF ATOMIC NUMBER (May 8 2026)

### What needs to happen

Every file in the system — source upload, crop, background, QR, composite, landing snapshot — must carry one permanent GRF ID from the moment it is created through every downstream step (builder, packet, assembly). The user calls this the "atomic number." Right now the chain breaks at the builder: a background is selected by URL only, and when a packet is committed `registerPacketGrfsDev`/`registerGrfAsset` mints a brand-new GRF ID for a URL that already has one in `grf_assets`, producing duplicates and losing the lineage.

### What was attempted

1. Added URL-dedup lookup inside `registerGrfDev` (dev) and `registerGrfAsset` (prod) — query `grf_assets` where `sourceUrl == url` before minting a new counter sequence. If found, reuse and update `packetId`/`sourceSessionId`. This is in `server/lib/schema-commit.ts` and `functions/src/services/grf-registrar.ts`.
2. Consolidated all `graphicCodes` imports behind `shared/GRF_engine.ts` so the engine is the single door. Every server route, Cloud Function, and frontend file now imports from `@shared/GRF_engine` only.

### Why it is still broken

The URL-dedup fix only works for the packet-commit path. It does NOT fix the case where an asset was uploaded/cropped before a proper GRF ID existed — those old Firestore docs have wrong `grfId` values (legacy Firestore document IDs like `1000050493` instead of `GRF-11411-NNNNNN`). The dedup query finds those bad docs and returns the bad ID.

The real fix requires:
- A one-time Firestore migration to backfill correct `GRF-114XX-NNNNNN` IDs on all `grf_assets` docs that have non-GRF `grfId` values
- Possibly also fixing the `sourceGrfId` field on cropped/background docs that point to those bad parent IDs
- Verifying the crop-mint route correctly passes `originalMimeType` so `buildCropTransition` produces 114XX codes (it appears correct in code but has not been confirmed against live data)

### Source of truth files

- `shared/GRF_engine.ts` — ALL GRF logic must go through here
- `shared/graphicCodes.ts` — internal implementation, do not import directly
- `server/lib/schema-commit.ts` — dev server GRF registration (has dedup)
- `functions/src/services/grf-registrar.ts` — prod GRF registration (has dedup)
- `server/routes/library-crop.routes.ts` — crop-mint route (uses engine)
- `functions/src/routes/admin-library-crop.ts` — prod crop-mint (uses engine)

---

## CANONICAL FIELD AUTHORITY (CFA)

> Added: May 2026. Extends the same philosophy as QRG/BLD/GRF authority to UI field names.

### Core rule

Provider fields are NOT UI fields. All raw Firestore/provider/packet data must pass through the shared adapter layer before components may consume it.

```
Provider / Firestore / API
         ↓
shared/adapters/catalog.adapter.ts   ← ONLY approved translation boundary
         ↓
Canonical view-model (CanonicalProductSelectItem)
         ↓
UI Components
```

Components may NOT:
- alias field names (`item.colorsAvailable || item.availableColors`)
- support multiple field name variants
- fall back to raw provider field names (`|| product.sizes`, `|| item.colors`)
- translate provider data locally

**ONE FIELD. ONE NAME. ONE AUTHORITY.**

### Canonical UI field names

| Canonical name | Forbidden aliases |
|---|---|
| `availableColors` | `colorsAvailable`, `colorOptions`, `colors` (when sourced from catalog) |
| `availableSizes` | `sizesAvailable`, `sizeOptions`, `sizes` (when sourced from catalog) |

**Note on packet/store fields:** `ProductPacket` has its own `colors` and `sizes` fields — these are canonical within the packet domain. CFA governs the catalog→component translation boundary only.

### Adapter location

`shared/adapters/catalog.adapter.ts` — exports:
- `CanonicalProductSelectItem` — the interface all product display types must conform to
- `normalizeProductColors(raw)` — reads `colorMap` → `providerMappings` → `availableColors` in priority order
- `normalizeProductSizes(raw)` — reads `sizeMap` → `availableSizes` in priority order
- `assertCanonicalProduct(item, context)` — dev-time assertion; call at adapter boundaries

### If a field is wrong in a component

**Fix the adapter. Not the component.**

```typescript
// BAD — component doing field guessing
const colors = item.availableColors || item.colorsAvailable || item.colors || [];

// GOOD — adapter normalized it; component reads one field
const colors = item.availableColors;
```
