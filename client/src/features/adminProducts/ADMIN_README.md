# QR Gear — Admin Operating Law

Last updated: October 7, 2026 (Build tabs integration review, sandbox).

> History → `ADMIN_CHANGELOG.md` | Schema authority → `ADMIN_SCHEMA_MAP.md` | Route inventory → `ADMIN_ROUTES.md`

## Blanks and Catalogs — current sandbox behavior

- `functions/src/services/admin-catalog-routes.ts` owns catalog writes for both server adapters. `shared/catalogs.ts` owns catalog fields and overlay cleanup. Writes use QRG master document IDs and Firestore transactions. Provider tables supply lookups only.
- `shared/masterCatalog.ts` projects master records; `shared/adapters/catalog.adapter.ts` supplies the shared card model. Blanks and Products display Our cost and saved title/description/image choices. Catalog copies retain colors. Empty saved selections are intentional.
- `catalog-tier-products.ts` reads the same QRG masters and catalog overrides for members. `catalog-color-options.ts` constrains live fulfillment options to catalog colors; the builder includes the owning catalog on new selection, provider changes and draft reload. Saved draft images survive reload.
- Removing one blank or clearing a catalog requires confirmation identifying the destination. Changing catalogs cancels confirmation. Missing masters stay visible as unavailable references and can be removed. All per-blank overlays are cleared with membership. Assigned catalogs cannot be deleted; deleting an unassigned default clears that default.
- Blanks and Catalogs show failed reads with Retry rather than an empty-data message. Add Blank keeps its inherited destination, has one left-side 48px close button, and copies from the selected source without saving provider snapshots. No automatic insertion into Primary.
- Removed superseded catalog mutation handlers and unused migration endpoints. Shelf remains dormant. Changes are sandbox-only pending the owner's Main release.


## Categories and Tags — sandbox, October 7, 2026

Categories retains its existing `categories` collection and admin-only Firestore write rules. Its header stacks on phones, category rows wrap long text, and edit/delete controls sit on the left on narrow screens. The misleading Templates title and inactive drag handles are gone. Dialogs have a 48px left close button, scroll within the viewport, and lock during writes. Failed reads show Retry and cannot be mistaken for an empty collection eligible for seeding.

Tags previously called `.filter` on the Cloud Functions `{ categories }` response. That read used `product_categories`, while the first registered update route used `productCategories`; its seed route inserted unrelated blank types with neither taxonomy nor ordering. The existing schema-backed `productCategories` collection is now used for admin read/update/seed by one `product-tags.ts` service in both HTTP adapters. Duplicate routes were removed. The shared existing season/holiday/occasion/theme defaults seed in a transaction, skip existing slugs, and retain saved inactive choices. No legacy data was migrated or deleted and no defaults were seeded during this change; old `product_categories` data remains untouched and is not read by Tags.

The Tags page validates its response, shows load/save failures, offers Retry, groups legacy or unknown taxonomy under Other Themes, and uses wrapping, keyboard-accessible toggle buttons locked during writes. Neither section was added to a new product flow. Validation: 13 focused React/HTTP regression checks, TypeScript, frontend build and Functions build passed. The browser executable was unavailable for the attempted local viewport check; mobile sizing still needs a device check. No live database operations or Main deployment. Held on `sandbox/products-fulfillment`.


## Build tabs integration review — sandbox, October 7, 2026

Reviewed Products, Library, Blanks (including Catalogs), Videos, Fonts, Categories and Tags together before the Store pass. Library now uses the shared AdminShell and preserves all seven Build destinations while retaining its subtab deep links. The shared section navigation has 48px controls; the secondary sticky bar uses the same navigation height to avoid overlap.

Products derives its category navigation and selected-category cards from the existing master-catalog query rather than two additional independent caches. Master/catalog/joint failures show Retry. Smart Sync also refreshes the joint catalog. Successful packet commits invalidate existing GRF, BLD and Assembly library queries, including inactive tabs, so revisiting Library reads the newly registered output. Uploaded packet backgrounds refresh Source. Template auto-save is awaited, refreshes the existing Templates cache on success, and reports failure visibly. Commit retry uses the existing builder activity guard and releases it after success or failure.

The combined regression run exposed one outdated product-images test adapter; it now supplies transactions and catalog membership required by the shared writer, preserving the original final-image-removal assertions. Across the reviewed suites, 163 client checks and 238 Functions checks pass (401 total); the initially failing adapter was rerun after correction. TypeScript and both builds passed. Live Firebase/provider/font calls and actual phone rendering remain unverified; the local browser executable is unavailable. No production data changes, schema changes, or Main deployment. Store-specific listing/collection review remains the next task.

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

Source files: `shared/bldCodes.ts`, `shared/blankKeys.ts`, `shared/qrgCodes.ts`, `shared/graphicCodes.ts`, `shared/assemblyCodes.ts`
Full definitions: `BLD.md`, `GRF.md`, `QRG.md`, `ASSEMBLY.md` (Canonical Core — these win over everything)

**GRF ID format:** `GRF-[D1][D2][D3][D4][D5]-[NNNNNN]` — 5 descriptor digits + 6-digit sequence.
D1=asset class (1=input build, 2=output artifact) · D2=media type · D3=channel · D4=purpose (channel-relative) · D5=format.
No D6/subContext — D4 purpose meaning depends on D3 channel.
Example: `GRF-11411-000001` = input build · image · assets · original · PNG · #1
Example: `GRF-21111-000001` = output artifact · image · print · qr_composite · PNG · #1

---

## Builder command buttons

| Button | Behavior |
|---|---|
| Resume | Lists working drafts, packet-ready builds, and committed builds; restores in place without a page reload. |
| Templates | Loads its canonical saved snapshot, resolves QRG identity and the saved supplier, and creates a separate working draft. Existing drafts remain intact. |
| New | Saves the current working draft, clears the build, opens Product, and creates a fresh session on the next product selection. Keeps fulfillment and destination selections. |
| Save / Save Draft | Both bars open the same name dialog and save the full working snapshot. Named drafts remain resumable through cleanup. Finalized builds use Update Saved Item first. |
| Generate / View | Generate invokes the existing packet creator and displays missing requirements; View opens the existing packet. |

New, Resume, and Templates use the same save-before-switch action. A failed save or restore retains the open build. The activity guard prevents overlapping command/generation actions. Templates and Resume resolve by canonical QRG document identity; Printify and Printful mappings are supported on the same product. A removed product or missing saved supplier is reported explicitly. Legacy supplier IDs are accepted only if they identify one unambiguous QRG product.

Output remains mounted when another accordion opens, so packet creation is not lost during navigation. Opening a packet-ready draft does not automatically commit it. The existing Retry catalog save button remains available. Save as New uses the same in-place resume path. All changes are sandbox-only pending the combined release.

## Master Catalog Diagnostics

Open System → Health (`/admin/health`) for the collapsed Master Catalog Diagnostics panel. The same scan and repair controls remain available there; Products no longer displays the panel. Moving the panel does not change supplier sync, QRG creation, or builder state. Sandbox-only pending the combined release.

## Fulfillment card

Choose Printify or Printful, then Smart Sync to refresh that supplier's lookup tables and rebuild the existing QRG master catalog. The button stays busy until the master-catalog query refresh finishes. Opening Products only reads history. Supplier selection preserves the QRG product identity.

Configured reports server credential configuration; Unknown indicates that configuration could not be checked. Supplier totals and timestamps reflect the selected supplier. Errors remain visible and do not produce a success notification. Keep the page open during an explicit sync; historical completed supplier jobs do not automatically trigger a QRG rebuild on return.

These changes are sandbox-only pending the combined release. Include the new catalogSyncs composite index when releasing. No live supplier connectivity was tested.

## Role, Store, and Channel

The Products card lists supported store roles from `shared/storeRoles.ts`: Internal, External, Member, and Marketplace. Changing the role clears its store/channel/collection. Selecting another store clears its channel and collection; selecting another channel clears its collection. The existing builder snapshot still saves/restores this metadata. A late default or create/delete response does not replace a newer selection. Request failures are displayed in the card. All products clears the collection selection.

Store creation rejects duplicate normalized names. Channel names are unique within a store; a collision with another store uses a distinct stored ID without renaming existing records. The shared writer supports existing legacy partner-store parents. Deletion checks ownership, archives the affected catalog instances, and leaves other destinations alone. Both route families use the same writer and retain admin authentication. These changes remain sandbox-only.

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
- Layout draft → `working.bldDraft` → `{ context, layoutMode, instanceCount, instances[] }` — layout only
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
| `/admin/manual` | AdminManual | Admin manual |
| `/admin/sales/build` | StoreBuild | Sales build flow |

---

## Product Builder (BUILD Cockpit)

**Route:** `/admin/products`
**State:** `client/src/features/adminProducts/builder/BuilderContext.tsx`
**Container:** `client/src/features/adminProducts/builder/BuilderHarness.tsx`
**Modules:** `client/src/features/adminProducts/builder/modules/`

### Product selection

Select a classified `qrg_STNNN` blank. Its card and build session use that same identity, even when two blanks share a provider product ID. Catalog copy is applied to the owned title/description fields; master/provider text remains available separately.

Selecting another blank clears the previous blank's color, placements, provider dimensions, session, packet, and generated graphic. Reusable design content and BLD structure remain available. Category and filter browsing does not discard the current build. Editing another catalog card updates that catalog entry without changing the active product.

The selected provider supplies fresh options through the existing options endpoint and CFA adapter. Older options/session responses cannot replace a later blank selection. Draft restoration reconciles selected placements and color, removes unavailable placement settings, and refreshes provider dimensions.

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

**One editor snapshot:**
- `shared/builderSnapshot.ts` owns the `graphics`, `qrConfig`, `layoutConfig`, `metadata`, and structural `bldDraft` shape.
- Autosave and explicit Save use the same queued working-state writer. Generate awaits the current save before creating a packet.
- Working drafts resume from `session.working`, including when an older packet exists. Committed output and reusable packet templates restore from `packet.builderSnapshot` through the same state loader.
- Packet snapshots are captured render inputs. Autosave never rewrites them.
- Packet layout/display fields are derived through `packetBuildFields`; product render options use `productGraphicOptions`. Freeform mode, image offsets, scale, placements, print methods, and provider dimensions are retained.
- Commit validates and reads the generated packet snapshot before allocating identities or registering assets.
- Old beta packets without this snapshot must be regenerated. There is no alternate legacy editor shape.

**Output controls:**
- Update Saved Item clears the displayed result, reopens the session, and updates the existing instance while preserving its QRG identity.
- A failed catalog commit has a visible Retry catalog save button. Successful commit returns its Assembly ID to the result view.
- Publish uses the existing `/admin/qrg/publish-to-printify/:packetId` route in both backend adapters.
- Delete Packet uses the shared dependency preview and confirmation described under Library deletion. It removes affected build records together, preserves files and assets still used elsewhere, and tracks unfinished Storage cleanup.

**Key files:**
- `BuilderStickyBar.tsx` — Save Draft button, autosave failure badge
- `DraftResumeHandler.tsx` — URL param detection, state restore
- `client/src/pages/admin-run.tsx` — In Progress section

---

## Blank Catalog (`/admin/blanks`)

The owner uses a phone left-handed with one finger. Catalog-card remove X controls are on the left with 48px tap targets; badges sit to the right. The shared product detail preview also places its existing 48px close X on the left. Apply this preference to other controls as their screens are updated.

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

## Email

**Implementation:** `functions/src/services/email.ts` | **Provider:** Resend

Order confirmations and shipping notices use `email_templates` and `email_logs`, managed under System → Email. Activation emails use the same delivery service.

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

### October 7, 2026 — Fonts source, save integrity and mobile previews (sandbox)

Both adapters now use `config/fonts` with one validation/read/write service. Font defaults and the existing available-family catalog are shared with the admin and editor. Saves preserve order, reject invalid values, normalize duplicates, block concurrent edits, cancel stale reads and publish the confirmed list into the shared query cache. Failed saves retain unsaved work; refreshed data cannot overwrite it. Previews load when visible and expose Retry, with left-side 48px add/remove/reorder controls. No drag handle or hover dependency remains.

Browser generation waits for fonts; text editors report loading/settings errors. The two server renderers now share font loading, successful-request deduplication, invalid-file checks and retryable errors instead of silently substituting Arial. Device fonts retain their native device/runtime dependency. Existing BLD fontFamily values remain styling, unchanged by removal from the available list. Local tests cover both API prefixes, invalid/auth/failure paths, concurrent saves, stale reads, browser readiness and server retry. No live deployment or settings migration.

#### Files Changed

| File | Change |
|---|---|
| `shared/fonts.ts`, `shared/googleFonts.ts`, `client/src/data/google-fonts-list.ts` | One defaults/catalog/validation contract; existing catalog re-export |
| `functions/src/services/font-settings.ts`, `functions/src/routes/am-sync.ts`, `server/routes/misc/fonts-and-test.routes.ts` | Shared canonical settings routes |
| `client/src/pages/admin-fonts.tsx`, `client/src/hooks/use-fonts.ts` | Save/read integrity, phone controls, viewport previews and error states |
| `client/src/lib/fontLoader.ts`, `client/src/features/shared/components/TextStyleEditor.tsx`, `client/src/features/shared/graphics/productGraphicRenderer.ts` | Awaited font readiness and visible editor failures |
| `functions/src/services/font-loader.ts`, `functions/src/services/composite-image.ts`, `server/lib/composite-image-generator.ts` | One server font loader; failures stop rendering and remain retryable |
| `client/src/lib/__tests__/{adminFonts,fontLoader}.test.ts`, `functions/src/services/__tests__/{font-settings,font-loader}.test.ts` | Focused UI, HTTP and font-loading tests |
| `functions/src/index.ts`, `README.md`, `MANIFEST.json` | Sandbox build marker and checked documentation |


### October 7, 2026 — Videos upload and phone controls (sandbox)

`/admin/videos` accepts schema-supported MP4/WebM files up to 20 MB using shared GRF rules. The existing registrar verifies encoding/container signatures before allocating an ID or writing storage. The existing input classification, immutable files, and shared deletion confirmation remain intact. Cards have touch playback and 48px View/Delete buttons; the read-only viewer has a 48px left close X. Preview object URLs are released on replace/close/unmount. Upload errors retain the form for retry. The page exposes the shared tracked file-cleanup component and a list-load Retry button. No Main deployment; validation uses controlled local adapters.

#### Files Changed

| File | Change |
|---|---|
| `client/src/pages/admin-videos.tsx` | Shared upload rules, touch playback, View button, left close, preview lifecycle and cleanup controls |
| `shared/GRF_engine.ts` | Shared video format mapping and upload limit |
| `functions/src/services/video-validation.ts` | Decode and check video encoding/container |
| `functions/src/services/admin-grf-routes.ts`, `functions/src/services/grf-store.ts` | Validate before registration/storage through the existing shared path |
| `client/src/lib/__tests__/adminVideos.test.ts`, `functions/src/services/__tests__/video-library.test.ts` | UI and upload/registrar/HTTP regression checks |
| `functions/src/index.ts`, `README.md`, `MANIFEST.json` | Sandbox build marker, behavior notes, integrity manifest |


### October 7, 2026 — Left-hand Blanks controls (sandbox)

Moved the catalog-card remove X and shared product-preview close X to the left. Enlarged the catalog-card target from 24px to 48px and repositioned badges to avoid overlap. Existing handlers are unchanged; other Blanks findings remain under review. Updated `AdminCatalogBlankSkin.tsx`, `ProductSelectCardSkin.tsx`, both READMEs, and the integrity manifest. Frontend-only, held in sandbox.

### October 7, 2026 — Assembly/GRF documentation and manifest reconciliation (sandbox)

Corrected GRF ID/filename examples, removed obsolete Archive API instructions, and documented the existing reviewed deletion flow. Assembly examples now follow the referenced BLD slot order, distinguish the blank number from its Firestore document key, and describe the linked-record deletion guard. The BLD QR reference points to the shared GRF slot definition. Traced these corrections against the shared schema, registrar, composition routes, and deletion service. Regenerated the existing manifest after confirming earlier documentation changes were intentional. No runtime code or production data changes.

#### Files Changed

| File | Change |
|---|---|
| `GRF.md`, `ASSEMBLY.md`, `BLD.md` | Correct examples and current shared lifecycle references |
| `README.md`, `client/src/features/adminProducts/ADMIN_README.md` | Record repair and remove superseded GRF/packet lifecycle guidance |
| `MANIFEST.json` | Regenerate tracked hashes with the existing script |

### October 6, 2026 — Shared builder commands and safe draft handoffs (sandbox)

Unified Save, New, Resume, and Templates in the existing builder/session flow. Corrected bridged supplier identity, fresh-session intent, named draft retention, and the Generate handoff. Removed the obsolete command-strip implementation, duplicate saves/resolvers, unused baseline/dismissal state, and full-page draft navigation. Verified 132 tests across frontend behavior and backend route/regression coverage, frontend TypeScript/build, and functions build with controlled adapters; no production writes or deployment.

#### Files Changed
| File | Change |
|---|---|
| `builder/BuilderContext.tsx`, `builder/types.ts` | Shared activity/save/restore transitions, draft name and fresh-session intent; remove unused baseline logic |
| `builder/restoreProduct.ts` | Shared canonical QRG and saved supplier resolution |
| `builder/BuilderHarness.tsx` | Shared Save dialog, New navigation, Generate request and persistent Output mount |
| `builder/modules/BuilderCommandStrip.tsx`, `BuilderBottomBar.tsx`, `SaveDraftDialog.tsx` | One set of actions and one full-draft save form |
| `builder/modules/BuilderStickyBar.tsx` | Removed obsolete file |
| `builder/modules/DraftResumeHandler.tsx`, `LoadSavedModule.tsx`, `LoadTemplateModule.tsx` | Thin callers of shared restore paths; working drafts included |
| `builder/modules/ProductsModule.tsx` | Consume fresh-session intent and restore saved draft name |
| `builder/modules/CreateGraphicsModule.tsx`, `useCreatePacket.ts` | Existing generation action, guarded handoff, in-place clone resume, stale result protection |
| `functions/src/routes/admin-build-sessions.ts`, `functions/src/index.ts` | Explicit fresh sessions, atomic template seed, named draft retention, sandbox build ID |
| `builder/__tests__/{productSelection,restoreProduct,buildCommands,commandButtons}.test.ts` | Product, restore, command, and generation regression coverage |
| `functions/src/services/__tests__/build-session-commands.test.ts` | Production route behavior with controlled Firestore adapter |
| `README.md`, `MANIFEST.json` | Behavior notes and integrity manifest |


### October 6, 2026 — Move diagnostics out of Products (sandbox)

Moved the existing collapsed Master Catalog Diagnostics panel to System Health, using the same component and endpoints. No backend or diagnostics behavior changes.

#### Files Changed
| File | Change |
|------|--------|
| `ProductsHarness.tsx` | Remove diagnostics panel from Products |
| `client/src/pages/admin-health.tsx` | Render the existing panel on System Health |
| `README.md`, `MANIFEST.json` | Document the location and update integrity manifest |

### October 6, 2026 — Role/store/channel wiring and blast-radius checks (sandbox)

Unified this card's role choices with server validation, centralized destination state transitions, corrected channel deletion routing, guarded delayed requests, and displayed read/write failures. Shared admin/public-path store operations prevent overwrites, validate parents/ownership, preserve legacy IDs/partner parents, update channel counts, and handle large archival batches. 99 local tests and both builds passed; no live deployment. The separate legacy Store Builder listing and collection flows still require their own review.

#### Files Changed
| File | Change |
|------|--------|
| `shared/storeRoles.ts`, `shared/types.ts`, `ProductsContext.tsx` | Shared supported roles and consistent destination state |
| `modules/StoreChannelDropdownModule.tsx` | Dependent queries, visible errors, correct delete URL, guarded mutations |
| `functions/src/services/store-channels.ts` | Common validated store/channel operations |
| `functions/src/routes/admin-stores.ts`, `functions/src/routes/public-stores.ts` | Existing routes delegate to the common operations |
| `ProductsContext.test.ts`, `modules/StoreChannelDropdownModule.test.ts`, `functions/src/services/__tests__/store-channels.test.ts` | Destination and backend blast-radius regression coverage |
| `functions/src/index.ts`, `README.md`, `MANIFEST.json` | Sandbox build marker, behavior documentation, integrity manifest |

### October 6, 2026 — Fulfillment card wiring (sandbox)

Fixed unintended rebuilds on page load, Printful lookup-table alignment, dropped supplier mappings and variant options, misleading configuration/summary status, premature completion, and the missing master-catalog refresh. Both supplier routes and failure paths are covered by local React/HTTP tests with controlled adapters. Production deployment is deferred to the combined release.

#### Files Changed
| File | Change |
|------|--------|
| `modules/ProductsControlBar.tsx`, `ProductsContext.tsx`, `shared/types.ts` | Explicit sync lifecycle, honest status, awaited QRG catalog refresh |
| `functions/src/routes/pp-catalog.ts` | Provider-specific history, normalized summaries/timestamps, Printful lookup writes, visible partial failures |
| `functions/src/routes/pp-catalog-browse.ts` | Preserve object/legacy supplier mappings and current/historical variant options |
| `firestore.indexes.json`, `functions/src/index.ts` | Supplier-history index and sandbox build marker |
| `modules/ProductsControlBar.test.ts`, `ProductsContext.test.ts`, `functions/src/services/__tests__/fulfillment-catalog.test.ts`, `vitest.config.ts` | Reproducible sandbox regression tests |
| `README.md`, `MANIFEST.json` | Sandbox behavior, release requirements, integrity manifest |

### October 6, 2026 — Product selection handoff

Connected canonical card identity, blank-specific builder state, provider options, and draft handoff. Seven React integration tests cover switching blanks with shared provider IDs, out-of-order selection responses, provider changes during loading, draft geometry reconciliation, filter browsing, and catalog editing. Live authenticated persistence is not yet exercised by these tests.

#### Files Changed
| File | Change |
|------|--------|
| `builder/BuilderContext.tsx` | Own selection lifetime, clear blank-specific output, load canonical sizes/colors, reconcile print geometry |
| `builder/modules/ProductsModule.tsx` | Canonical selection, guarded draft handoff, separate catalog/provider copy |
| `builder/__tests__/productSelection.test.ts` | React behavioral coverage for the existing builder and cards |
| `vitest.config.ts`, `package.json`, `package-lock.json` | Reproducible React test runner configuration and development dependencies |
| `README.md`, `MANIFEST.json` | Handoff documentation and integrity manifest |

### October 6, 2026 — Shared builder snapshot and Output handoffs

Removed the separate flat packet editor snapshot and packet-to-editor field reconstruction. The working draft and captured output now use one shared shape; packet projections are derived. Added focused checks for production packet persistence, exact render inputs, commit snapshot selection, instance identity retention, and deletion reference cleanup. Changes are staged in the draft PR; live Firebase/provider behavior is not verified. Remaining pre-live work includes BLD/Assembly slot binding and saved BLD loading.

Key implementation files: `shared/builderSnapshot.ts`, `BuilderContext.tsx`, `useCreatePacket.ts`, `DraftResumeHandler.tsx`, `CreateGraphicsModule.tsx`, `functions/src/services/build-session-state.ts`, and the matching packet/build-session route adapters.



### October 6, 2026 — BLD Single Source of Truth

Shared types, labels, IDs, validation, and structural extraction now live in `shared/bldCodes.ts`. Builder drafts, backend commits, direct creation, and the BLD library use this contract. The shared atomic writer allocates bounded IDs and stores one structural instances array; QRG/packet links and content remain outside BLD. Schema Keys includes BLD, and the library exposes the existing U-context layouts. Invalid beta records are visibly flagged, not migrated. Rendering and the broader Assembly/GRF integration remain a subsequent pass.

#### Files Changed
| File | Change |
|------|--------|
| `shared/bldCodes.ts` | Shared BLD contract and extraction |
| `functions/src/services/bld-store.ts` | Atomic counter + definition writer |
| `functions/src/services/bld-builder.ts`, `functions/src/routes/bld.ts` | Use shared contract and writer |
| `functions/src/routes/admin-build-sessions.ts` | Pass working state without embedding product identity in BLD |
| `server/lib/schema-commit.ts`, `server/routes/admin-build-sessions.routes.ts` | Remove duplicate dev BLD implementation |
| `client/src/features/adminProducts/builder/BuilderContext.tsx` | One structural draft extractor |
| `client/src/features/adminLibrary/tabs/BldDefinitionsTab.tsx`, `AssembliesTab.tsx` | Shared BLD choices/validation |
| `client/src/pages/admin-schema-keys.tsx` | BLD reference from shared definitions |
| `functions/src/services/__tests__/bld-*.test.ts` | Structure and transactional persistence regression checks |
| `BLD.md`, `README.md`, `MANIFEST.json` | Reconcile storage documentation and integrity manifest |
| `deploy/1-build.sh` | Propagate compiler failure through the output pipe |


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

### Library deletion

`DeleteBuildDialog` obtains a dependency preview before allowing deletion. Both HTTP adapters register `admin-grf-routes.ts`; `build-deletion.ts` owns the same dependency plan, confirmation token, transactional record removal, shared-file protection, and tracked Storage cleanup. A changed dependency plan requires a new review. Failed file cleanup remains visible in the Library after reload. Source collections, catalog blanks and website records are retained. The old archive handler and duplicate background upload routes have been removed; uploads use the shared GRF registrar.

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

## GRF registration — current shared implementation

`createGrfRegistrar` in `functions/src/services/grf-store.ts` owns registration in both server adapters. It validates classification and MIME through `shared/GRF_engine.ts`, reserves identity transactionally, and reuses matching content hashes or source URLs with the same classification. Crops retain `sourceGrfId`; distinct crops receive distinct immutable files. `inspectGrfAsset` compares stored metadata against the encoded identity, and composition validation checks file records before use.

The old separate development registrar and old-ID migration proposal are superseded. Invalid beta records are reported; no migration or alternate legacy identity path is part of the current implementation. Lifecycle and API details are maintained in root `GRF.md` and `ASSEMBLY.md`.

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

### Product builder: saved layouts and complete composition

Use **Templates** in the product builder's command strip to start a separate draft from a saved product build, including its layout and content. There is no separate Saved Styles picker. BLD remains the structural source of truth behind generation: its identity survives draft saves and packet reopening, unchanged structure reuses the existing BLD, and structural changes create a new definition.

Generation captures one builder snapshot and renders each selected placement using its saved provider dimensions. Failed rendering or uploads stop generation with an error. Commit registers QR, area/header/footer images, composites, and destination previews through the shared backend GRF registrar, then binds every required slot in Assembly. Destination text/backgrounds are excluded from physical BLD layers.

Before Printify publishing, the backend checks actual QRG/BLD/Assembly/GRF records, active file state, matching content and structure, and every chosen print location. Missing graphics are reported instead of silently skipping a location. Printful packets are not submitted to Printify. Deleting a generated packet uses the same reviewed build deletion flow as the Library; shared files and manually created reusable BLD definitions are retained.

Checked locally with 32 focused service/route tests and frontend/functions compilation. Live Firebase storage, browser canvas rendering, and provider publishing require the authenticated beta environment and remain a pre-release verification step.

### Authorization Engine browser sign-in

The existing engine can approve a one-use browser request at `/login?engine=1`. The browser keeps its proof in an HttpOnly cookie; only the request ID is shared with the engine. The QR Gear target in Fluba's canonical authorization registry supplies the allowed origin and engine principal during deployment. A Google-signed engine identity approves the request, and the browser exchanges a Firebase custom token for the existing owner account. Normal Firebase and admin checks still apply; no admin role is created or bypassed. The handoff expires after 10 minutes and the browser session uses memory persistence (closing/reloading the page requires another sign-in). Never log or publish the cookie, identity token, or custom token.

Security coverage: origin and principal restrictions, browser proof binding, expiry, disabled owner, single consumption, missing configuration, and start-rate limiting.

## Store Builder — Placement integration, October 7, 2026

- `admin-store-builder.tsx` exposes Placement and Product Library with URL-driven selection. Existing catalog/channels/stores/partners deep links all reach the saved-instance placement editor, retaining packet links.
- `storeManager/StoreManagerTab.tsx` hosts Unplaced Items, store creation, selected-store setup, channels, collections and saved listings. `storeBuilder/StoreManager.tsx` supplies store/channel creation and allowed-product editing inside it. `AllChannelsManager.tsx` remains the collapsed orphan-channel utility. The old `features/storeBuilder/StoreBuilder*` packet editor and `store-builder-actions.ts` were removed; `store-builder-types.ts` retains the shared color helper used by public pages.
- `storeBuilder/AllowedProductsEditor.tsx` and MemberProductLibrary use QRG references, the master-catalog adapter, explicit Save, blocked competing saves, visible read errors and preserved failed edits. `storeQueries.ts` invalidates existing caches across Build and Place.
- `functions/src/services/store-products.ts` owns admin/public/member allowed-product endpoints for both adapters. Legacy provider references are readable only when unambiguously matched to one QRG blank. Empty lists and empty choices do not turn into defaults. Archived/missing selected blanks produce a visible error instead of silently deleting the saved selection.
- `store-admin.ts` reuses shared store/channel writes and owns channel/collection reads plus collection archival. It recognizes older partner parents and timestamp objects. Collection archive batches never exceed 500 writes and also hide legacy links and explicit definitions. Builds remain intact.
- `catalog-list.ts` supplies both instance-list routes without the old newest-500 cutoff. Unplaced means missing store or channel; archived/deleted/hidden listings are excluded. `catalog-instance-update.ts` validates enabled choices, retains explicit empty arrays and uses the existing transaction to propagate destination changes to packet, build session and linked listings.
- Validation: 170 client tests and 248 backend tests, TypeScript and production builds. Mobile controls were inspected in source; no browser executable was available for a rendered phone check. No live data changes and no Main deployment. Execution-rule refresh checked; canonical schema authority remains unchanged.

## Store Products review — sandbox, October 7, 2026

`admin-store-library.tsx`, `adminNavConfig.ts` and `BreadcrumbTrail.tsx` now label the existing route Store Products. Build's Library is unchanged. The StoreLibrary provider uses URL-driven selections and shared stores/channels queries. Its filter uses STORE_ROLES; all-channel browsing and old channel-name links are supported, but product queries use canonical channel IDs. Missing linked destinations and failed reads cannot silently load another destination's products.

`ProductGridModule.tsx` uses the same admin_catalog_instances endpoint/cache and `InstanceCard` as Placement. Moves, color/size saves and deletion use the existing shared services; no parallel writer or new product collection was created. The fake bulk-action tray and unused StoreListModule/ChannelListModule were deleted. Products scroll with the page rather than inside a 400px pane. Search, visible failures, Retry and manual Refresh use phone-sized controls. The shared delete button now accurately labels complete-build deletion.

Printify publication status/retry remains on its existing endpoint and appears only on linked Printify products. Retry locks while saving and refreshes the shared instance cache. PublishStatusBadge handles Firestore timestamps, does not infer Synced from a provider ID, and uses larger retry/error controls. No provider calls were made in validation. Nine focused regressions plus the full 179-test client suite, TypeScript and production build passed. No browser executable for a phone render; sandbox source only, not Main or live hosting. Schema/execution refresh verified.

October 7, 2026 naming update: the owner named Store Builder’s product-choice tab **Products**. Its tab label and heading use that name; the existing route, member-products record and shared editor are unchanged.

October 7, 2026 navigation update: Partners now has its own main admin tab, alongside Run, Build, Place, Sell and System. Main destinations are defined in adminNavConfig for mobile and desktop; Partners is removed from Place’s subnavigation, keeps /admin/partners, and highlights its own mode. The six mobile targets share the viewport width. This changes navigation and the page title only; partner records and schema remain unchanged.

## Store Builder final pass — October 7, 2026

AllowedProductsEditor owns its optional close action and dirty/save guard; StoreManager's Product choices opener no longer toggles the mounted editor away. MoveDialog guards immediate duplicate submission and uses a per-dialog collection-list ID. InstanceCard safely formats saved numeric-string prices and wraps long titles/destination paths. build-destination imports the collection list's shared isActiveStoreRecord policy from store-admin; explicit deleted collection IDs fail without writes, while a reused collection name remains unbound to the archived definition. No schema or alternate persistence layer was introduced.

185 client and 250 backend tests passed, including seven additional regression cases, plus TypeScript and both builds. Existing store/channel deletion, parent identity, QRG selections, empty choices, destination propagation and failure/retry checks remain green. Authority/execution refresh checked. No live mutations or deployment. Place's former Library remains named Store Products in sandbox; its shared saved-instance path was included in the check.
