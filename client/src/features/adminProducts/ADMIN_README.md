# QR Gear — Admin Operating Law

Last updated: October 11, 2026

> History → `ADMIN_CHANGELOG.md` | Schema authority → `ADMIN_SCHEMA_MAP.md` | Route inventory → `ADMIN_ROUTES.md`


## Main admin emergency repair — October 9, 2026

Supplier sync history selects the newest matching provider job using an equality-only read and normalized timestamps, so it does not fail while a composite index is absent. Orchestration lists the same saved catalog instances as Store Builder; QRG supplier blanks are no longer presented as sellable products or deletable through that screen. Saved-build links and the existing Graphics/BLD/Assembly Library remain available.

Profit now reads paid store-order revenue and all saved product price/cost estimates. Unrecorded settlement costs and fees remain unknown; estimated contribution is explicitly separate from realized profit. Routing shows each saved packet/provider/price/inside-label relationship and links to the existing paid-order fulfillment controls. The disconnected supplier-scoring form is removed. Repricing uses the existing Admin Pricing preview/apply transaction, including stale-preview rejection and mandatory label protection. The obsolete rule-run controls are replaced by this working saved-settings flow; no scheduled rule engine is claimed. Marketplace publishing and channel management open their existing authoritative screens instead of the disconnected bulk worker. No external publication or order submission occurs from these changes.

Registry comparison found every displayed sandbox Graphics, BLD and Assembly ID on Main. The protected 22 products and their canonical dependencies are retained. Cleanup is a separate dependency-reviewed operation; this code does not delete registry or product records.

Acceptance: provider history loads; Orchestration shows the 22 saved products; Profit and Routing show recorded data; Repricing displays a real canonical preview; anonymous admin access remains rejected; Main Hosting/API markers match the released source. Local checks and live verification must be reported separately.

## Admin audit release candidate — October 9, 2026

User authorized promotion to Main with remaining wiring defects tracked for follow-up. This batch shares recorded analytics and provider-health services across adapters; saves versioned owner AI instructions; consolidates coupon/hosting handlers and the coupon editor; derives channel counts from catalog instances; surfaces customer read failures; labels saved template prices; and removes 23 unreachable UI files. Existing browser-local sign-in persistence is preserved. Required inside labels and canonical pricing remain intact.

Unconnected orchestration publishing, automatic provider selection, rule execution and profit forecasting now fail explicitly instead of returning fabricated success. They are not implemented by this release. Legacy BLD-SZ10-004 / ASM-000002 remain invalid and must not be blindly promoted. Partner/member workflows and controlled sale/printing verification remain follow-up work. Code deployment does not automatically copy sandbox Firestore records or artwork to Main.

Candidate validation: 267 frontend and 422 backend tests pass; frontend/Functions type checks pass. Acceptance: frontend/Functions builds; complete configured regression suites including authentication and immutable checkout/fulfillment; exact Main Hosting/API markers; unauthenticated admin rejection; visible production admin checks. The release remains unverified until the production workflow and live checks complete.

## Marketplace wiring — sandbox, October 7, 2026

The built-product picker now reads the canonical catalog-instance response envelope. Logs uses the authenticated request helper and displays read errors with Retry. Specific Listings/Jobs/Logs routes precede the generic surface-ID route, fixing their accidental 404s. QRG is displayed read-only in Push dialogs; failed attempts retain dialog input and refresh shared results.

Push and Jobs now use `marketplace-sync.ts` and the account-aware `marketplace-publisher.ts`: one listing per surface/account, one locked job at a time, selected OAuth credentials, saved Etsy publish settings, canonical QRG/instance cross-checks, and shared listing/job/log results. Attempts are awaited during the request. Failures stop; retries are explicit and retain prior job history. Amazon accepted submissions remain Pending, Etsy drafts remain Draft, and only a confirmed active result marks a surface Published. Rotated Etsy refresh tokens and returned external listing IDs are saved before later steps. Unknown Etsy creation outcomes block blind retries. Old direct-push histories are consulted only to recover an existing external ID; new attempts do not write those histories.

Removed the three global seller-token adapters, unused store-based marketplace endpoints, and direct job/log mutation endpoints. Amazon uses the surface retail price in its purchasable offer and separate image slots. eBay retains zero quantity and stops after failed offer lookup. Etsy updates known listings and single-product inventory without flattening existing external variations. Missing retail prices no longer fall back to supplier costs. Explicitly empty selections remain empty, and missing linked packets fail visibly.

**Original wiring review, superseded for eBay and Amazon by the selling-flow updates below:** provider-specific size/color variation publishing, remote delisting, complete category/processing-profile requirements and end-to-end marketplace verification. Saved selections are retained on surfaces; readiness and execution block unsupported variations before external calls. This change does not make clothing listings ready for sale, invent child variants, or mark unsupported operations successful. See the existing Marketplace Expansion item in `downloads/QR_Gear_Roadmap.md`.

Validation: 269 backend checks passed, including 19 new mocked-provider/HTTP/job regressions; 3 new React checks passed. TypeScript and frontend/Functions builds passed. No live accounts, database records or listings were changed. Phone-browser rendering remains unverified. Sandbox source only; no Main or hosting deployment.

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

### Saved product lead photo — October 8, 2026

Products → Output provides Replace lead photo for a committed build. It registers the uploaded PNG/JPEG/WebP through the existing GRF output/store/front service, updates only the saved color's front mockup and display references, then rebuilds the existing instance's gallery. Shirt artwork, QR content, Assembly and other color/lifestyle images are retained. The current packet/instance link is checked before upload. Failed saves remain visible with the selected file available for retry. Resume now restores both placement and lifestyle previews.

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
| `/admin/store-library` | AdminStoreLibrary | Legacy redirect to Store Builder → Placement |
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

Both application package trees pin `@google-cloud/storage` to `7.19.0`. Firebase Admin uses that same SDK; existing server upload services retain default CRC32C validation. This sandbox dependency update is pending release and does not change stored asset identities or paths.

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

### October 10, 2026 — Private member uploads and shared starter backgrounds

My Library now contains private member uploads plus shared starter backgrounds, with upload/download controls and the canonical responsive skeleton/row helpers. Admin Source GRF originals/crops/backgrounds supply the shared collection; personal memberLibrary records never enter it. Removed the production admin product-push route and obsolete assigned-product library registration without deleting records or products.

Both member file proxies check ownership and prevent shared caching. A read-only file session established during sign-in preserves native previews and downloads; mutation authentication is unchanged. Storage rules close the public member-media path, and the release workflow deploys those rules. Publishing verifies that selected private files belong to the member and exports only those selected files for the public product.

#### Files Changed
| File | Change |
|------|--------|
| `client/src/pages/member-library.tsx` | Private uploads and shared starter assets with upload/download. |
| `client/src/features/members/member-index-view.tsx` | Correct library description. |
| `client/src/hooks/useAuth.ts`, `client/src/lib/firebase.ts`, `client/src/lib/firebase.test.ts`, `client/src/components/ProtectedRoute.tsx` | Native file session, refresh/sign-out, visible retry and existing test fixture. |
| `functions/src/middleware.ts`, `functions/src/routes/auth.ts` | Owner-only file authentication and safe filename routing. |
| `functions/src/routes/member-files.ts`, `functions/src/routes/am-sync.ts` | Private image/video reads. |
| `functions/src/routes/members-library.ts` | Shared GRF sources and owner-scoped personal listing. |
| `functions/src/services/member-build.ts` | Publish selected copies while retaining private originals. |
| `functions/src/routes/admin-catalog-instances.ts`, `functions/src/index.ts` | Remove product assignments and register privacy guard/build marker. |
| `storage.rules` | Owner-only member storage. |
| `README.md`, `MANIFEST.json`, source ZIP | Document and package changes. |


### October 11, 2026 — Payout summary read consistency

`members/PayoutsView.tsx` now reads the same earnings summary response as the dashboard and distinguishes request failures from zero earnings or an unconnected account. Its summary uses the shared row/split helper. No financial transaction or bank-account mutation is part of this change.


### October 11, 2026 — Super Simple completion

Returning members with completed tutorials also bypass post-selection teaching cards in `members/useSuperSimpleTutorial.ts`.

Tutorial completion follows the successful saved packet instead of an unreachable confirmation-screen Next action. Returning creators skip the teaching cards after their first successful publish, and progress failures display a message.

#### Files Changed
| File | Change |
|------|--------|
| `members/useSuperSimpleTutorial.ts` | Persist completion after publish and expose progress errors |
| `members/SuperSimpleWizard.tsx` | Pass the saved packet identity to tutorial progress |


### October 11, 2026 — Shared member dashboard and fresh builds

The dashboard, channels, and published count read the same member packet projection. New builds clear all draft state through a shared session boundary. Authentication no longer opens the first-product wizard while the returning member profile loads. Members uses the master page skeleton and row/split helpers. Earnings reads the API summary envelope; request failures are visible. All three builder experiences retain their distinct controls over the existing shared QRG/BLD/GRF/Assembly publication path.

#### Files Changed
| File | Change |
|------|--------|
| `members/useMemberRuntimeState.ts` | Shared authenticated packet query and persisted publish count |
| `members/WizardContext.tsx` | Fresh build sessions and shared progress |
| `members/MembersPage.tsx` | Master skeleton and authentication timing |
| `members/member-index-view.tsx`, `members/member-channels-view.tsx` | Consistent totals, errors, and saved product links |
| `members/*Wizard.tsx`, `members/AdvancedWizardProductSteps.tsx` | Shared fresh-build reset and accurate QR badges |
| `shared/components/wizardSteps/WizardProgressBars.tsx` | Labels and progress without numbered steps |
| `lib/memberFetch.ts` | Reject unreadable success responses |



## Main admin smoke-test repairs — October 9, 2026

Committed destinations now include the channel parent store ID. The editor restores legacy snapshots whose nested channel omitted that ID, while retaining rejection of explicit cross-store selections. Output takes its provider from the saved packet: Printful products link to the existing Orders fulfillment path; Printify publishing is offered only for Printify packets; an unknown provider is reported visibly.

Bundles use the same finished catalog instances as Store Builder and Orchestration, with visible titles and saved prices. The backend validates product references, membership, quantity and discount/pick limits, writes parent/items atomically, includes new bundles in sorted listings and calculates current saved prices in cents. Blank-based legacy bundles fail explicitly. At this earlier repair checkpoint, saved bundle discounts were not consumed by storefront checkout. The subsequent Bundle checkout pricing section below supersedes that limitation in the release candidate. No product price is changed by bundle configuration.

Template cards project the linked packet's current saved name, image and price, while retaining the reusable builder snapshot and printed QR content. Categories displays required-name and save errors inside its dialog. Supplier history reports unfinished jobs past the existing 30-minute timeout instead of displaying them as still running indefinitely. Members and Partners are deferred, and Stripe activation remains on the existing to-do list. Code deployment does not itself delete old registry data.


### October 9, 2026 — Preserve existing Pricing settings, including zero

Repaired the existing Pricing form and save handlers. Shared validation in the existing order/pricing schema rejects invalid amounts without replacing saved values. Removed duplicated pricing-save logic; the existing admin and compatibility URLs share one protected handler. No new screen, pricing record, pricing service or repricing engine was added. Missing settings remain editable in Admin; public pricing fails clearly. Sync/repricing remains a separate open item.

#### Files Changed
| Files | Change |
|---|---|
| `shared/schema-orders.ts` | Saved pricing contract without business defaults |
| `client/src/pages/admin-pricing.tsx` | Preserve zero, validate input and show load failures |
| `functions/src/routes/pp-pricing-packets.ts`, `members-library.ts`, `server/routes/pricing.routes.ts` | Consolidate existing readers/savers and use shared validation |
| Focused form/API tests | Zero round trips, invalid input, incomplete configuration and protected saves |


### October 9, 2026 — Protect admin access and correct public navigation

Shopping links and `/store` now lead to the public shop. Admin data/actions require the server admin policy, including a namespace guard for future routes. Removed auth bypass flags, the hardcoded client/Functions owner UID and development empty-list allow-all behavior. Client permission comes only from the verified identity’s server profile, with no access retained after a verification failure. Reused the products-page registrar instead of registering its handlers twice.

#### Files Changed
| Files | Change |
|---|---|
| `shared/adminAccess.ts`, `functions/src/middleware.ts`, `server/firebaseAuth.ts`, auth profile routes | Shared strict admin policy and fail-closed server enforcement |
| `client/src/hooks/useAuth.ts`, authenticated fetch helpers | Verified identity-scoped permissions; no bypass |
| `shared/navigation.ts`, `App.tsx`, `Navbar.tsx`, `home.tsx`, `store.tsx` | Canonical public shopping navigation; remove duplicate legacy builder |
| `functions/src/index.ts` | Namespace authorization and one Products route registration |
| Focused admin-access tests, README, manifest and source bundle | Authorization regression coverage and documentation |

### October 9, 2026 — Product selection and saved default remain separate

The product screen can choose a provider for the current build. Only **Use for new builds** changes the saved default; existing products retain their saved provider. Removed the catalog module's remaining implicit Printify browsing label when no provider is selected. Each setting and record must have one authoritative saved source, with derived displays rather than competing defaults.

#### Files Changed
| File | Change |
|---|---|
| `builder/modules/ProductsModule.tsx` | Prompt for provider selection instead of an implicit Printify browsing state |
| `README.md`, `ADMIN_README.md` | Clarify per-product choice, default and single source of truth |

### October 9, 2026 — Reuse fulfillment selection and connect admin catalog orders

The existing Products Fulfillment selector now remembers an explicitly saved preference. Admin catalog checkout freezes validated product/provider/price/artwork data before payment; verified Stripe delivery drives a retryable Printful handoff. The existing Orders screen exposes failures, submission retry and provider shipping sync. No duplicate fulfillment settings page was added. Partners and Members remain separate and deferred. See the root README section for the tested boundary and remaining Main release gates. Existing `orders`/`orderItems` collections are reused; no parallel order collection was introduced.

#### Files Changed
| Files | Change |
|---|---|
| `client/src/features/adminProducts/ProductsContext.tsx`, `shared/types.ts`, `modules/ProductsControlBar.tsx`, `builder/BuilderContext.tsx` | Existing selector, saved preference, restored-build protection, removal of implicit provider defaults |
| `client/src/features/adminProducts/ProductsContext.test.ts`, `modules/ProductsControlBar.test.ts` | Preference save/load/race and existing-control tests |
| `shared/fulfillmentSettings.ts`, `functions/src/routes/pp-pricing-packets.ts` | Provider value validation and truthful credential configuration |
| `functions/src/routes/core-routes.ts`, `core-routes-checkout.ts`, `stripe-webhooks.ts`, `functions/src/services/order-service.ts` | Server-owned cart pricing, frozen orders, signed/paid session validation, owned reads and duplicate-route removal |
| `functions/src/services/order-fulfillment.ts`, `printful.ts`, `printify.ts` | Exact saved production inputs, Printful draft/confirm/recovery/status and wrong-provider submission protection |
| `functions/src/routes/admin-orders.ts`, `client/src/pages/admin-orders.tsx` | Existing order list projection, retry, shipping status and visible errors |
| `functions/src/services/__tests__/checkout-production.test.ts`, `stripe-production-webhook.test.ts` | Immutable checkout, payment mismatch, retries, raw-signature and shipping tests |
| `firestore.rules` | Server-only order writes and protection against self-assigned admin privileges |
| `functions/src/index.ts`, `functions/package.json`, `functions/package-lock.json` | Raw webhook bytes, one checkout registration, build/version identifier |
| `README.md`, `client/src/features/adminProducts/ADMIN_README.md`, `MANIFEST.json`, `downloads/QR_Gear_Full_Website.zip` | Scope, validation, release gates and updated source bundle |


### QR Gear branding and QR Play gallery — sandbox, October 8, 2026

Public store product titles and descriptions use QR Gear branding instead of the blank manufacturer and its 3001 model number. The saved supplier/QRG configuration stays internal and unchanged. The shared AI Build Rules require this customer-facing branding for future builds.

For QR Play products, the shared gallery replaces the linked packet's exact landing snapshot slot with its existing video. Model photos, artwork and QR order are retained. Native videos show a paused frame with playback controls; YouTube entries show the video's thumbnail before an explicit Play action. If that external thumbnail fails, the same packet's artwork remains visible with an Artwork preview label and Play control. Main gallery, thumbnails and lightbox share one media renderer. Failed direct media shows a source link. Non-video products retain their landing proof. Future AI builds must verify both the gallery video and phone preview.

#### Files Changed
| File | Change |
|------|--------|
| `ProductImageGallery.tsx`, `ProductGalleryMedia.tsx`, `buildProductGallery.ts`, `mediaTypes.ts`, `playMediaPreview.ts` | Saved video in the gallery with a visible frame/thumbnail and controls. |
| `shared/descriptionLayers.ts`, `functions/src/routes/store-files.ts` | Public QR Gear branding without modifying supplier data. |
| `shared/aiProductBuilder.ts` | Future-build branding and gallery verification rules. |
| Focused gallery and store API tests | Media order, playback selection, errors and branding regression coverage. |


### October 8, 2026 — Preserve the Armed Forces content methodology

Added the owner's establishment date → branch → motto → meaning → role/purpose → legacy order to the existing shared AI Build Rules (`shared/aiProductBuilder.ts`). It is reusable methodology for future builds, not an edit to an individual product or landing page. Use subject-specific supplied or verified content and never publish the placeholders.

### October 8, 2026 — Restore saved-design storefront color previews

Products and storefront color changes share the saved packet's front artwork, print dimensions and QRG Printful variant mapping. Each product retains its own graphic when its shirt color changes. Heather colors stay distinct; request failures now have a visible retry action. Store cards display complete names with consistent photo framing. The saved builder, pricing, IDs, QR destinations and proof gallery remain unchanged. Focused tests cover distinct artwork on the same shirt/color, missing mapping/artwork/dimensions, gallery retention and lead-photo preservation.

#### Files Changed
| File | Change |
|------|--------|
| `shared/builderSnapshot.ts` | Shared saved-packet mockup request resolver |
| `functions/src/routes/pp-builder.ts`, `functions/src/routes/store-files.ts` | Reuse canonical QRG and placement artwork handoff |
| `client/src/pages/shop-product.tsx` | Visible retry and stale-request handling |
| `client/src/features/storefront-shared/buildProductGallery.ts` | Keep Heather colors distinct |
| `client/src/features/storefront/ProductCard.tsx` | Full card titles and consistent photo framing |
| `client/src/lib/__tests__/packetMockup.test.ts`, `client/src/lib/__tests__/productGallery.test.ts` | Focused mockup and gallery checks |

### October 8, 2026 — Close gaps found while adapting the Air Force build

Follow the same shared AI Build Rules when adapting a completed reference: Save as New, verify destination, identify the correct Library/Cropped asset in the target environment, replace subject copy without duplicating a baked-in title, and verify every generated gallery artifact. The draft name is separate from the store title. Output now exposes the existing product title and description controls without requiring a catalog card. Generate uses the captured product title for the new landing slug; existing content title remains a legacy fallback.

#### Files Changed
| File | Change |
|------|--------|
| `shared/aiProductBuilder.ts` | Extend the one shared rulebook with observed workflow gaps |
| `client/src/features/adminProducts/builder/modules/CreateGraphicsModule.tsx` | Expose existing product text setters in Output |
| `client/src/features/adminProducts/builder/modules/useCreatePacket.ts` | Derive the new landing slug from the captured product title |
| `client/src/features/adminProducts/builder/__tests__/commandButtons.test.ts` | Verify resumed-draft metadata controls without catalog data |
| `functions/src/index.ts` | Sandbox deployment marker |


### October 8, 2026 — Keep all generated images after mockups arrive

Products already generated and saved the shirt artwork, standalone QR and landing proof. The shared storefront gallery now appends those packet images after selected-color mockups instead of returning early with only mockups. It preserves API order, deduplicates URLs and excludes other-color mockups when switching colors. The existing generation workflow and source packet remain authoritative.

#### Files Changed
| File | Change |
|------|--------|
| `client/src/features/storefront-shared/buildProductGallery.ts` | Combine color mockups and complete packet images |
| `client/src/lib/__tests__/productGallery.test.ts` | Cover complete gallery, color switching and duplicate handling |

### October 8, 2026 — Store type follows the generated packet

Product details and all catalog-instance listing paths project the linked packet’s saved QR product state into the existing storefront label format. QR Canvas builds are no longer displayed as QR Basics. Missing packet type remains unset.

#### Files Changed
| File | Change |
|------|--------|
| `functions/src/routes/store-files.ts` | Read the linked packet’s QR product type on details and listings |
| `functions/src/index.ts` | Sandbox deployment build marker |

### October 8, 2026 — Preserve generated shirt color

The existing Generate callback saves returned provider proofs into the packet's existing `mockupsByColor` color/placement map using the captured build color. The store selects that generated default color before the first available catalog color. Sandbox preparation initializes an empty placement table through its existing seed route, keeping dimensions in the existing QRG options flow and leaving the sizing calculation unchanged.

#### Files Changed
| File | Change |
|------|--------|
| `client/src/features/adminProducts/builder/modules/useCreatePacket.ts` | Save returned proofs under their captured color and placement |
| `client/src/pages/shop-product.tsx` | Prefer the generated packet's default color |

### October 8, 2026 — Saved build parity and provider mockups

The builder preview uses the same snapshot projection and print dimensions as Generate. The QR percentage calculation is unchanged. The priority handoff takes packet and placement, reads their saved artwork and QRG variant, and returns the actual provider result or error. Only mockup task creation/status is permitted in sandbox. The shared AI Build Rules require reading existing code, resuming the existing build, inspecting the requested reference, using Generate and verifying the returned shirt mockup before claiming completion. URL artwork remains separate.

#### Files Changed
| File | Change |
|------|--------|
| `shared/aiProductBuilder.ts` | One execution rulebook for all product AI prompts and Rules UI |
| `ProductGraphicTextModule.tsx`, `GraphicPreviewView.tsx`, `useProductGraphicPreview.ts` | Preview consumes Generate's rendering inputs |
| `useCreatePacket.ts`, `pp-builder.ts`, `mockup-generator.ts`, `printful.ts` | Saved packet/QRG handoff and real provider errors |


### October 8, 2026 — Persistent isolated sandbox

The sandbox carries forward the existing admin navigation, tab and product-builder
work. It uses its own Firebase resources; build drafts remain available until
explicitly deleted, including unnamed drafts. Cleanup cannot abandon sandbox work
based on age. Supplier requests, marketplace publishing and outbound email are
blocked in this environment. Canonical product IDs and assembly logic are unchanged.
The backend Firebase Admin SDK is aligned with the root at 13.6 for keyless authorization. Deployment verification and the Navy build are still pending.

#### Files Changed
| File | Change |
|------|--------|
| `functions/src/runtime-config.ts` | Validate deployment project, bucket, origin and commerce boundary |
| `functions/src/core.ts` | Use the deployment's own Firebase and storage configuration |
| `functions/src/middleware.ts` | Sandbox origins and commerce request boundary |
| `functions/src/routes/admin-build-sessions.ts` | Preserve sandbox drafts and use sandbox QR/storage destinations |
| `functions/src/routes/deploy-proof.ts` | Report actual deployed project |
| `functions/src/services/printify.ts`, `printful.ts`, `email.ts`, `marketplace-publisher.ts` | Prevent sandbox outbound commerce |
| `functions/src/index.ts`, `functions/package.json` | Dedicated sandbox runtime and deployment version |



### October 7, 2026 — Cloud Storage upload integrity (sandbox)

Pinned the Google Storage SDK to `7.19.0` in both package manifests and regenerated the corresponding lockfiles. Traced Firebase Admin storage initialization, the GRF registrar and the image helper; they use the existing SDK upload path without disabling checksum validation. No alternate upload/checksum logic was added. Node.js 20 TypeScript and Functions compilation passed, along with 30 image/video/composition tests. Actual SDK tests against local HTTP fixtures verified valid PNG uploads and checksum-mismatch rejection/cleanup for resumable and multipart requests in both package trees. Live Google Cloud upload remains unverified; no Main or Firebase deployment. Repository instruction/schema refresh checked.

#### Files Changed

| File | Change |
|---|---|
| `package.json`, `functions/package.json` | Pin the existing storage SDK to 7.19.0 in each independently installed package tree |
| `package-lock.json`, `functions/package-lock.json` | Lock the SDK and its required XML parser dependencies; Firebase Admin resolves the same SDK |
| `README.md`, `client/src/features/adminProducts/ADMIN_README.md`, `MANIFEST.json` | Record scope, checks and sandbox-only status |

### October 7, 2026 — eBay selling flow

Added connected-seller policy/category/location setup, canonical saved-combination publishing, provider-approved variation labels, remote status checks and verified withdrawal. The existing shared job service owns all actions. Detailed behavior and validation appear in the eBay selling-flow section below.

| Files | Change |
|---|---|
| `client/src/pages/marketplaces-ebay.tsx`, `marketplaces-listings.tsx`, `marketplaces-accounts.tsx` | Phone-sized setup/status/end controls and removal of duplicate seller-policy fields |
| `functions/src/services/ebay-api.ts`, `marketplace-variants.ts`, `marketplace-publisher.ts`, `marketplace-sync.ts` | Provider requirements, actual variant combinations, recoverable offers, remote reads and withdrawal |
| `functions/src/routes/marketplace.ts`, `shared/surfaces.ts`, `functions/src/constants.ts` | Shared setup contract, selected-seller APIs and status action |
| `functions/src/services/surface-generator.ts`, `marketplace-fees.ts`, `functions/src/index.ts` | Supplier lineage, removal of stale defaults, accurate fee limits and build ID |
| Marketplace React/provider/publishing/fee tests | Regression coverage for setup, identity, zero stock, uncertain replies and remote state |

### October 7, 2026 — Item fees and verified seller connections

Fees moved from the account form to individual marketplace listings. Official signup links, same-tab authorization, verified seller/shop identity and protected callback state replace the incomplete connection behavior. Amazon estimates drive the item margin before shipping/tax; eBay listing charges are explicitly partial and Etsy estimates unavailable. The canonical fee schema invalidates stale context and no missing fee becomes zero. Existing draft listings now have Publish.

#### Files Changed
| Files | Change |
|---|---|
| `shared/surfaces.ts` | Shared account/listing/fee contract and sale-price selector |
| `functions/src/services/marketplace-fees.ts` | Provider estimate retrieval, per-item persistence, stale checks and shared-engine margin |
| `functions/src/services/marketplace-oauth.ts`, `functions/src/routes/{amazon,ebay,etsy}-oauth.ts` | One verified authorization flow, protected state and disconnect |
| `functions/src/services/{amazon-sp-api,ebay-api,etsy-api,marketplace-publisher,marketplace-sync,store-channels}.ts` | Provider integration, offer fee capture, price reuse and obsolete fee default removal |
| `functions/src/routes/marketplace.ts` | Item fee API, enriched listing reads and sanitized account responses |
| `client/src/pages/marketplaces-{accounts,listings}.tsx` | Signup/Connect controls, item fee/margin cards and draft Publish |
| Marketplace backend and React regression tests | Connection rejection/success, provider requests, fee ownership, stale data and mobile navigation behavior |
| `functions/src/index.ts`, READMEs, `FIREBASE_SCHEMA.md`, `MANIFEST.json` | Sandbox build identifier and schema/review documentation |



### October 7, 2026 — Dashboard To-Do List (sandbox)

Run now displays a full-width To-Do List button above metrics, with a minimum 72px height. It expands the existing server queue and includes **Connect to surfaces**, linking to Marketplaces. The queue renderer moved out of the unused older dashboard into one shared component. It retains priority ordering, uses accessible 64px-minimum task buttons and a 48px Refresh control, and shows failures with Retry. The reminder lives in the existing queue response; there is no new task collection or automatic completion claim. No scheduled polling is added.

Files: `client/src/pages/admin-run.tsx`, `client/src/pages/admin.tsx`, `client/src/components/admin/AdminPriorityQueue.tsx`, `functions/src/routes/admin-dashboard.ts`, `client/src/lib/__tests__/adminTodo.test.ts`, `functions/src/services/__tests__/admin-dashboard.test.ts`, `README.md`, `MANIFEST.json`.

Validation: React interaction and HTTP authorization/repeated-read tests use controlled API/database fixtures. Changes remain in sandbox, with no live marketplace action or Main deployment.


### October 7, 2026 — Partner member schema foundation (sandbox)

Added the dedicated [Partner Member Storefronts and Builders](../../../../FIREBASE_SCHEMA.md#partner-member-storefronts-and-builders--planned) section to the schema reference. It records the planned per-partner, per-member mini storefront and builder, reusing existing identities, destinations and build/product records. The section distinguishes member ownership from host ownership, buyers and affiliate attribution, and marks the runtime binding and external interface as unfinished. Current review scope is schema consistency and wiring only; expanded website functionality and navigation changes are deferred to the second integration push.

#### Files Changed

| File | Change |
|---|---|
| `FIREBASE_SCHEMA.md` | Dedicated planned relationship section, existing contract mapping and implementation boundary |
| `README.md`, `client/src/features/adminProducts/ADMIN_README.md` | Link to the single schema description and record the limited scope |
| `MANIFEST.json` | Regenerated after the intentional documentation edits |

Validation: documentation links, whitespace and manifest integrity checked. No application code, data, provider calls or deployments changed; existing wiring findings remain open.

### October 7, 2026 — One finished-product screen (sandbox)

Removed Place's duplicate Store Products tab and its context/filter/grid/harness. Placement remains the one saved-instance editor, with search, Refresh, all-channel browsing and existing Printify publication status/retry transferred into its shared cards. Old `/admin/store-library` links redirect to Placement with their parameters intact; store/channel names resolve to canonical IDs, failures remain visible, and late responses cannot override manual navigation. Products retains member blank choices; Build Library retains graphics/templates/assets. No schema, database or provider-table changes.

#### Files Changed

| File | Change |
|---|---|
| `client/src/components/admin/adminNavConfig.ts`, `client/src/components/BreadcrumbTrail.tsx` | Remove duplicate navigation; legacy breadcrumb points to Placement |
| `client/src/pages/admin-store-library.tsx`, `client/src/pages/admin-store-builder.tsx` | Preserve old links through Placement |
| `client/src/features/adminProducts/storeManager/StoreManagerTab.tsx` | Canonical destination selection, search, refresh, all channels and publication status |
| `client/src/features/adminProducts/storeManager/StorePublishStatus.tsx`, `PublishStatusBadge.tsx` | Existing publication status/retry moved into shared product cards |
| `client/src/features/shared/components/skins/StoreProductSkin.tsx` | Use relocated badge |
| `client/src/features/adminProducts/storeLibrary/` | Remove obsolete duplicate screen components |
| `client/src/lib/__tests__/storeProducts.test.ts` | Navigation, destination, late-response, search and status regression coverage |
| `README.md`, `ADMIN_README.md`, `ADMIN_ROUTES.md`, `client/src/features/shared/PRODUCT_LIFECYCLE.md`, `MANIFEST.json` | Documentation and manifest |

Validation: 186 client tests, TypeScript and production build passed. Tests use controlled service adapters; phone layout was inspected in source, not rendered on a device. Saved to `sandbox/products-fulfillment`; no Main/hosting deployment or live mutations.

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


## Marketplace item fees and seller connections — sandbox, October 7, 2026

Marketplace fees now belong to `marketplaceListings/{id}.fees`, keyed to the existing item/QRG, surface and seller account. Account-wide `feePercent` inputs, defaults and displays were removed; old stored values are ignored and account write APIs reject that input. Shared `MarketplaceFees`, account and listing types in `shared/surfaces.ts` are used by the UI. Publishing, fee requests and display use the same sale-price selector, including the eBay override.

Amazon Product Fees API estimates are requested for the selected seller's SKU, current item price/currency and US marketplace with seller fulfillment. The listing saves source, amount, component breakdown, timestamp and context fingerprint. The UI derives the effective item percentage from that response and uses the shared pricing engine with canonical builder pricing subtotal for the estimated margin before shipping/tax. Missing costs/fees or currency mismatches produce no margin. Price, category/policy, SKU, product or account changes invalidate the displayed estimate. A transaction rejects responses for a context changed in flight. Explicit Refresh item fees and successful Amazon publishing refresh the estimate; no fee polling is added.

eBay captures its offer ID and queries fees for that single unpublished offer before publishing. These are **partial listing charges**, not per-sale/final-value fees, and are never substituted into a complete sale margin. Etsy pre-sale estimates are **unavailable**; payment/ledger fee ingestion is not implemented. Provider failures store unavailable with a null amount, not zero. These limitations are visible on the item cards. Shipping charges, actual settlement reconciliation and multi-variant fee estimates remain outside this implementation.

Account cards and Add Account platform choices provide official seller signup links for Amazon, eBay and Etsy. Connect navigates in the same tab to avoid blocked mobile popups. One shared OAuth implementation replaces three divergent callbacks: admin-only start, configuration/callback checks, random single-use expiring state, browser binding, Etsy PKCE, full token validation and mandatory seller/shop lookup before connected status is saved. It returns to the originating approved QR Gear admin URL. The browser cookie uses Firebase Hosting's forwarded `__session` name scoped to `/api/marketplace`, separate from Authorization Engine's `/api/auth/engine` scope. Pending attempts are invalidated by disconnect, and account changes during authorization are rejected. API responses never include refresh tokens or pending OAuth state. Incomplete older connections display disconnected. Etsy v3 requests now use the required keystring/shared-secret header and verified token user ID for shop lookup.

New draft listings now expose the existing Publish action. Accounts and Listings show query failures instead of an empty state. Cards wrap their controls for mobile use, with 48px minimum action heights.

**Remaining publishing gaps:** Amazon/Etsy size/color variation publishing, remote delisting, complete Amazon category/Etsy processing-profile requirements, automated marketplace status reconciliation and live seller acceptance tests remain incomplete. eBay manual status and withdrawal are covered by the selling-flow update below. Stored setup fields not consumed by adapters also remain. These are review findings, not a claim that all selling paths are production-ready. The navigation consolidation below supersedes the original recommendation to combine the tabs.

Validation uses mocked provider HTTP, Firestore fixtures and rendered React interactions. No real marketplace account was authorized, no item was published, and production app credential configuration was not inspected. Sandbox source only; Main/live hosting are unchanged.


## Marketplace navigation consolidation — sandbox, October 7, 2026

Marketplace now has **Accounts, Listings and Activity**. Accounts retains seller signup and verified connection actions. Listings owns Add Product → Item Setup → Choose Account, using the existing built-product generator, surface detail/update APIs and listing writer. Existing item setup opens from each listing or an unlisted product card. Marketplace selection filters active accounts by the item's enabled platforms. Readiness checks and removal of unlisted setup remain available. Removing setup does not remove the built product.

The standalone Surfaces screen, manual empty-surface creation form and redundant Amazon/eBay push dialogs were removed. Their listing Publish/Sync actions continue through the existing job service. Etsy's required publishing options stay in a dialog bound to that listing's seller account; saved options are retained. Item setup keeps unsaved edits on a failed save and asks before discarding them. Saving invalidates the existing surface and listing/fee queries. Newly generated items load by ID rather than waiting for the product list to refresh. Item setup and account-choice dialogs have left-side close controls and large actions.

Activity shows publishing jobs and retries, with authenticated detailed logs available behind an expandable control. Failed item/job reads have visible error and Retry states. Existing records, canonical identities, provider adapters and backend services are unchanged; no alternate persistence or fee logic was added. This consolidation does not implement the remaining provider publishing gaps listed above.

Validation: 13 Marketplace React interaction tests cover navigation, generated product setup, item saves and failed-save recovery, account filtering, item fees, signup/connection actions, Etsy seller binding and Activity retry/log behavior. All 202 client tests, TypeScript and the production build pass. No live seller authorization, marketplace publication or Main/live deployment was performed.


## eBay selling flow — sandbox, October 7, 2026

Listings now provides **eBay Setup**, **Check eBay status**, and **End eBay listing**. Setup retrieves the connected seller's shipping/payment/return policies and inventory locations, searches eBay categories and loads current required item specifics. Optional specifics are collapsed by default. A seller can explicitly create a warehouse location using its name, postal code and country; a deterministic external location key makes an uncertain creation response safe to retry. Setup saves common category/item details on the existing surface and seller-specific policy/location choices on `MarketplaceListing.publishOptions.ebay`. The old surface policy/handling-time form writers and generated defaults were removed; the eBay fulfillment policy owns handling time. No account-wide defaults are substituted.

Publishing resolves the product's saved colors/sizes against actual `master_catalog.qrgVariants` rows. It does not construct a Cartesian product or consult provider tables. Missing, ambiguous, unavailable and supplier-unmapped selections fail visibly. Explicit eBay size/color label mappings live with the seller settings; they do not change product selections or canonical identities. The eBay child SKU is an external mapping key (`existing product QRG base:existing variant key`), **not a newly minted QRG code**. Existing QRG, BLD, GRF and Assembly definitions are unchanged. Legacy surface-variant overrides and additional unsupported option dimensions still require reconciliation rather than being silently dropped.

The existing job/publisher path validates seller policies, inventory location and current category requirements before external item writes. It creates one inventory item/offer per saved combination and publishes a variation group as one listing. Offer identities are stored before publication and recovered by SKU after uncertain outcomes. Updates reuse published offers rather than calling Publish again. Best Offer uses the proper policy field; zero quantity is retained and quantity is explicitly per variation. This connection supports eBay US fixed-price offers. Removing variants requires ending the existing listing first; prior unpublished offers remain identifiable in job history.

Successful publication is followed by a remote offer read. Only eBay's confirmed active state displays Active. Manual status checks and remote withdrawal use the same locked job and log records; checks are not automatically polled. Ending a variation listing withdraws its group and verifies the result, retaining product and listing history. A failed or ambiguous response does not become a successful delist. Status checks and ending do not require still-valid product selections. Item setup is blocked while its publication job is running. Local draft deletion is separate and disabled for records tracking external offers.

Single-offer eBay listing fees are still captured before publishing and remain explicitly partial. A variation-group estimate is unavailable here; one variant's fee is never presented as the whole item's fee or a complete sale margin. Seller settlement/final-value fee ingestion is still outstanding.

Validation: the 315-test backend suite and 205-test client suite passed, followed by the additional explicit-size-mapping regression (22 publishing tests). Root TypeScript, Cloud Functions compilation and the frontend production build passed. Provider HTTP and Firestore were mocked; React interactions verified the controls. A real connected-seller publication/withdrawal test and rendered phone acceptance remain necessary. No live account was authorized, no external listing/location was created, and Main/live hosting were not changed. Amazon/Etsy variations, remaining provider-specific requirements, remote status and delisting remain separate work.

Primary API references checked: [eBay publishing requirements](https://developer.ebay.com/api-docs/sell/static/inventory/publishing-offers.html), [inventory groups](https://developer.ebay.com/api-docs/sell/static/inventory/inventory-item-groups.html), [listing management](https://developer.ebay.com/develop/guides/sell/listing-management), [inventory locations](https://developer.ebay.com/api-docs/sell/static/inventory/managing-inventory-locations.html), and [current Inventory API release notes](https://www.developer.ebay.com/develop/api/inventory-api/release-notes).

## Amazon selling flow — sandbox, October 7, 2026

Listings now provides **Amazon Setup**, **Check Amazon status**, and **Remove from Amazon**, with 48px controls and a left-side close button. Setup searches Amazon product types and downloads checksum-verified, current seller-specific Product Type Definitions for standalone, parent and child listings. Nested attributes use labelled inputs and native selections rather than a JSON editor. Save preserves an incomplete draft; Check requirements calls Amazon VALIDATION_PREVIEW without publishing. Publishing repeats validation for the complete family before the first submission. Conditional requirements remain Amazon's responsibility, not a hand-maintained local category schema. Unrenderable schema references stop at a visible Seller Central handoff; exotic category schemas and phone rendering need live acceptance testing.

The existing shared resolver supplies actual saved master-catalog combinations. Amazon child SKUs reuse the external `existing QRG base:existing variant key` mapping; no new QRG identity, provider scrape or Cartesian variant matrix is introduced. Seller details are saved only on the existing listing's `publishOptions.amazon`; item identity, title, description, images and sale price still come from the canonical product/surface. Amazon size/color attributes and valid variation theme are explicit seller choices. Parent details are separate and the parent carries no price or stock. Quantity is explicit, defaults to zero, and applies to each sellable variation. This flow supports Amazon US, USD and seller fulfillment; it does not guess a marketplace or default the product type to SHIRT.

Every intended SKU is saved before external writes. Submission is parent-first and ACCEPTED remains Pending. Retries reuse the same SKUs after failures or unknown outcomes; removed selections cannot abandon existing children. Check status reads each SKU's summaries/issues and marks the family Active only when all sellable children are BUYABLE. Removal records intent, deletes children before the parent, and remains Pending until every tracked SKU returns not found. Products and job history remain. Status/removal continue to work when product selections change or the selling channel is disabled. Local deletion is blocked for records holding Amazon identities. Requests use the selected seller token, bounded timeouts and limited retry on explicit throttling, with no automatic polling or retry of ambiguous writes.

Product Fees API estimates are stored separately for each sellable child SKU, with size/color labels and the marketplace-derived percentage on the listing card. Parent and sibling estimates are never added into a fictitious per-sale group fee. Partial child failures remain unavailable, and price/account/setup changes invalidate the child estimates. Group margin remains unavailable; shipping, actual settlements and differing per-variant costs are not inferred.

Validation: **330 backend tests and 208 client tests passed**, including mocked Amazon schema/HTTP, validation failures, identity persistence, async status/removal, fee ownership and rendered control interactions. Root TypeScript, Functions compilation and frontend production build passed. No real seller account was authorized, listing submitted/removed, or Main/live hosting changed. This is sandbox source, pending a real connected-seller test and device acceptance. Etsy variations, processing-profile requirements and remote status/removal remain outstanding; the existing Marketplace Expansion roadmap is updated.

Primary references: [Product Type Definitions](https://developer-docs.amazon.com/sp-api/lang-en_EN/docs/retrieve-a-product-type-definition), [listing submissions and variations](https://developer-docs.amazon/sp-api/lang-en_US/docs/submit-listings-data), [Listings Items PUT/preview](https://developer-docs.amazon/sp-api/reference/putlistingsitem), [listing management/status](https://developer-docs.amazon.com/sp-api/lang-en_EN/docs/manage-product-listings-guide), and [listing deletion](https://developer-docs.amazon/sp-api/docs/delete-a-listing). These supersede the earlier Amazon gap notes above.

### Sandbox runtime update — October 8, 2026

Functions now target Node.js 22 with Canvas 3.2.3 and Firebase Admin 13.6 (aligned with the application). The backend compile, focused regression checks and a real transparent PNG render exercise the update. Frontend build tooling remains on Node.js 20. Deployment uses the existing dedicated sandbox runtime identity. Navy is the first acceptance build; rebuilding Army is deferred until the owner reviews Navy. Main is unchanged.

### AI build authority — October 8, 2026

The AI Builder has an AI Build Rules tab using the same shared rules supplied to every AI prompt. Product facts come only from QRG tables. Direct Printify/Printful table or API lookup is forbidden, including fallback. Missing QRG information may be requested through QRG table logic, which owns provider-table imports. The AI reads the result from QRG and never reads provider tables directly. Switching to Rules keeps the active build mounted. This records the owner’s explicit QRG-only requirement; the AI proposal fields remain limited to the existing reviewed edits.

### Isolated backend startup — October 8, 2026

Functions explicitly include the existing shared-schema runtime dependencies (Drizzle and Zod). The application boot is checked outside the repository so root dependencies cannot mask missing deployment packages. Authorization Engine project validation uses the central runtime resolver, including FIREBASE_CONFIG deployments. Seventeen affected validation/authentication/configuration checks passed.

### Canonical QRG options — October 8, 2026

The product-options route now uses the existing shared QRG color/size projection instead of a duplicate seven-digit parser. This restores actual labels for canonical four-digit SSCC variant rows such as the saved Navy combinations. No provider-table reads are added.
### Subject-aware build layout — October 8, 2026

`shared/aiProductBuilder.ts` remains the single source for the AI Build Rules screen and AI prompts. Owner-supplied typography, scale and position values are starting suggestions unless explicitly locked. Adapt them to each subject and its actual artwork, retain the intended wording and hierarchy, and keep content readable, inside its boundaries and clear of important visual details. Review the rendered shirt graphic and QR landing page separately at phone viewing size before the existing Products Generate workflow. Numeric checks alone are not visual verification. This updates build guidance; it does not introduce an automatic layout engine or broaden the AI proposal fields.


### QR zone clearance — October 8, 2026

The shared shirt layout now measures the top zone against the QR background edge and reserves the rendered CTA line height below it. This keeps top artwork clear even at its lowest allowed position and prevents larger CTA text from rising into the QR border. Preview and export use the same geometry; the QR size and center remain unchanged.


### Generated product galleries — October 8, 2026

Built-product galleries now contain only the linked packet's generated mockups, artwork, QR image, and landing proof. Blank catalog photos are neither appended nor used when generation is unavailable; original catalog selections remain intact for blank browsing. All store gallery images and thumbnails preserve their full aspect ratio, including portrait QR landing images. An empty product gallery explicitly reports generated images unavailable.

### AI build methods and physical print confirmation — October 8, 2026

The reusable instructions remain in `shared/aiProductBuilder.ts`, which feeds both the AI Build Rules screen and AI prompts. Armed Forces builds use establishment date, branch, motto/meaning, role and legacy. Founding Fathers quote builds use Palette artwork, a small upper-left USA 250 emblem, a verified calligraphic quotation, a dash and historical signature at lower right, and a real QR with a clear border. The biography uses a faint matching background, life dates and places, several verified achievements and quotation attribution. Replace all inherited subject-specific material when cloning.

Every build type also requires physical print confirmation: obtain the exact blank/method/placement and size-specific limits through QRG, record inches, pixels and DPI, compare the artwork and safe area, and confirm the saved handoff matches. Cached or generic dimensions and mockups alone do not establish printer support. Check QR readability at the smallest physical output, and distinguish digital decoding from a phone scan of an actual print. If QRG cannot supply verified limits, retain a draft and report the missing confirmation.

Franklin draft status: the lowered quote artwork and biography copy are saved in the sandbox builder. Physical print limits remain unconfirmed: refreshing the Bella + Canvas 3001 placement through QRG still reports `legacy_printPositions` / cached positions. The reusable front template is 3600 × 4800 pixels (12 × 16 inches at 300 DPI), but that is not evidence that every offered size supports that area. Franklin still needs his historical signature, the generated faint scales background bound to the QR page, and final generation after the print-area question is resolved. No Franklin packet has been generated or published.

### Physical artwork sizing and QRG print-file lookup — October 8, 2026

The saved placement size now drives the shared shirt renderer: Small = two-thirds, Medium = five-sixths, Large = the available area. The whole composition scales once within the full transparent print-file canvas. Preview and Generate share this projection, and the provider receives the padded full-size file without a second reduction. Layout displays the physical design and print-area dimensions separately from garment size. Safe-area and DPI metadata survive snapshot save/restore.

QRG imports Printful print-file specifications by joining each offered QRG variant to its actual printfile, preserving its reported DPI instead of assuming 300. QRG stores the verified projection and refreshes it when variant coverage changes, when missing, or on explicit Refresh. Generic/cached placement rectangles no longer certify support. Missing variant coverage, invalid dimensions, or differing physical templates with no shared placement fail visibly rather than stretching one file across incompatible sizes. This deliberately leaves incompatible size groups unresolved rather than falsely labeling them supported. The sandbox permits only the additional read-only print-file metadata endpoint; orders, product catalog calls and commerce remain disabled.

Verification: focused sizing/import cases cover a 10 × 13.33 inch composition inside 12 × 16 inches, 150-DPI metadata, safe-area limits, missing variants and incompatible size templates. Existing mockup handoff and sandbox boundaries are checked separately. Live deployment and physical sample scanning must be reported independently.


### QR Play product phone preview — October 8, 2026

The storefront uses the current linked packet’s `playMediaUrl` for its phone preview. YouTube and Vimeo use their players; direct media uses the browser video player. The phone screen has an explicit flex height and room for embedded controls. Previews start muted when visible and motion preferences allow autoplay; direct and YouTube previews stop at 15 seconds. Watch full video opens the saved source. Direct playback errors and missing sources are visible. Saved media, shirt graphics and all canonical identities are unchanged. Seven focused API/React regressions cover this path.


## Fresh storefront releases — sandbox, October 8, 2026

Hosting now sends `no-cache, no-store, must-revalidate` for page URLs, including rewritten product links. Matching only `index.html` left `/shop/product/...` cached for an hour, allowing an older gallery to persist after deployment. The later `/assets/**` rule retains immutable caching for versioned bundles. Verify response headers on the actual product URL after deployment, not only `/index.html`, and use a fresh query URL when helping someone whose browser already holds the previous one-hour response.


## Embedded video phone posters — sandbox, October 8, 2026

YouTube/Vimeo phone previews now share the gallery media renderer: show a thumbnail (or the same packet's clearly labeled artwork if the thumbnail fails), then load the embedded player only after Play. This avoids an empty or failed third-party player on arrival. Rushmore-style hosted files retain muted 15-second autoplay. The existing full-video link remains available. Both monument gallery and phone previews are verified separately.

### Full QR Play playback — sandbox, October 8, 2026

The selected gallery video slide and the phone preview now open the actual saved video player automatically, muted, with playback controls. Removed the YouTube `end=15` parameter and the uploaded-video pause/reset handlers; viewers can watch the full source video in place. Phone playback stays mounted after first entering view so scrolling does not restart it. Navigation thumbnails retain still-image fallbacks. The shared AI Build Rules require real video playback rather than an artwork overlay and verification beyond 15 seconds.

Regression coverage checks immediate embeds, no excerpt end parameter, full uploaded-file playback, persistent phone playback, reduced-motion manual controls, and inactive thumbnails.


## Catalog markup preview and apply — sandbox, October 9, 2026

The existing Pricing Sync action now previews the saved percentage/fixed markup against each canonical admin catalog product's recorded cost subtotal. Applying a reviewed preview updates the existing instance through `resolveInstance` and its owned packet together, without writing lookup catalog or member/partner store records. Both API aliases use the same existing catalog service; the Cloud Functions no-op handlers and competing development store-price implementations were removed. Missing costs, invalid ownership or a stale preview block every write. An atomic operation is limited to 200 products and reports the limit rather than partially updating a larger catalog. Only actual updates set lastSyncedAt. No external marketplace publication, payment or printer submission occurs.

The UI explicitly calls this saved-markup application. Rebuilding production, shipping, label and hosting cost components is separate work and remains open; this change does not claim that all pricing consumers are repaired. Main is unchanged.

## Recent Changes Log

### Saved production pricing and mandatory inside labels — sandbox, October 9, 2026

The existing Admin Pricing preview/apply flow and new packet creation now use one server calculation. QRG imports costs for the product's chosen provider from its existing provider catalog. Saved placement, header/footer, center graphic, hosting, label, shipping and markup settings determine the base retail price. Size increments are added once at checkout. Zero remains valid; missing configuration fails visibly. Member profit share remains a separate saved setting and does not discount admin product prices.

The inside brand label remains mandatory. New builds save its verified QRG print area and existing brand artwork. Pricing preview identifies older packets missing their registered inside label; apply registers that artwork through the existing GRF registrar and atomically saves packet instructions and catalog pricing. Existing valid label artwork is preserved; ambiguous or invalid custom artwork blocks the update. Checkout rejects a product without its inside label. The original automatic mockup label remains. Outside placement selection can add its own saved provider charge, but the historical preferred-position setting cannot replace the mandatory inside label.

Admin Compose hosting choices now read the saved pricing tiers. Packet commits use the server-priced generated packet, and direct packet price patches cannot introduce a second price source. The existing illustrative example remains labeled as an example, not a catalog product price. Marketplace publication and real payment/printing remain outside this sandbox action.

Candidate evidence: 67 focused backend checks and five React pricing checks passed, including inside-label restoration, provider-specific costs, stale previews, zero values, size-once checkout and the mocked Printful label handoff. TypeScript and client/Functions builds passed. Live sandbox verification is recorded separately after deployment; these checks do not establish a real paid print order.

#### Files Changed
| Files | Change |
|---|---|
| `functions/src/services/pricing.ts`, `master-catalog.ts`, `catalog-instance-update.ts` | Shared saved pricing and inside-label restoration |
| `functions/src/services/order-fulfillment.ts`, `mockup-generator.ts` | Preserve the inside-label print and mockup handoff |
| Packet and build-session routes, `composition-links.ts` | Server-owned generated packet pricing |
| `client/src/pages/admin-pricing.tsx`, builder modules/types and shared Compose step | Existing controls, complete breakdown and saved hosting options |
| Pricing, packet-route, catalog and checkout tests | Pricing and label regressions |

### Sandbox catalog cost import follow-up

Live pricing preview found all 22 seeded products lacked valid Printful lookup costs. Smart Sync then exposed an existing sandbox guard that labeled catalog reads as unconfigured. The Printful client now explicitly permits only GET /products and GET /products/:id alongside existing mockups in sandbox; order lookup, creation and production confirmation remain blocked. Smart Sync uses this same client. The QRG pricing importer reads missing costs from the mapped Printful product once and saves them on that provider mapping; later previews reuse the canonical range until a supplier lookup refresh replaces it. No hardcoded price is substituted.

Live field verification: every one of the 22 configured numeric controls saved zero and retained it after reload; XS stayed unconfigured. All 23 field values then matched their original values after restoration and a second reload. No zero-price catalog apply occurred. The follow-up's 46 targeted tests passed, including catalog-read permission, blocked sandbox orders, QRG cost import/cache, labels and checkout. Live full-cost apply remains pending this follow-up deployment.


### Main cleanup dependency scan — 2026-10-09

The shared build-deletion service now limits concurrent database RPCs to eight, discovers nested website references without holding parent slots, and sorts records before generating the review token. A scan that cannot finish within 45 seconds returns an explicit 503 error; incomplete scans never authorize deletion. Reference tokens and owned file paths are extracted once per record to avoid repeated parsing of supplier histories for each asset. The deletion dialog cancels abandoned preview requests and shows the first failure without silently repeating long scans. Existing shared-asset retention and transaction-time impact revalidation remain required. Focused tests cover concurrency bounds, stable tokens, nested reference failures, timeouts, cancellation, and existing deletion protections. No bulk cleanup or payment-mode change is implied by deploying this code.


### Main catalog browsing follow-up — 2026-10-09

The live rerun found All Products filtering canonical API rows through obsolete supplier field names. Products now reads printfulId, blueprintId and printProviderId, retaining legacy aliases. Regression coverage uses the actual masterCatalogProduct projection and verifies category browsing and selection for each supplier. Finished products and their saved supplier/destination remain unchanged. The separately verified backed-up cleanup retained the 22 current templates, archived 18 obsolete templates and removed the unused invalid ASM/BLD pair, with all 22 product and packet records unchanged.


## Resumable supplier sync — October 9, 2026

Smart Sync uses the existing catalogSyncs history record as a durable checkpoint. Each authenticated request awaits one supplier product and its changed lookup rows before advancing. A transaction lease prevents duplicate steps; failed or interrupted work resumes from the saved cursor. Opening Products reads status only and offers Resume Sync. New jobs report completion only after the existing QRG projection finishes, then the browser refreshes catalog queries. Finished catalog instances, packets, saved retail prices, artwork and identity definitions are unchanged. Members and Partners remain deferred.

Changed implementation: functions/src/services/catalog-sync.ts, functions/src/routes/pp-catalog.ts and ProductsControlBar.tsx, with backend and React regressions. Local verification: 17 backend and 16 frontend checks; TypeScript and builds. Live verification is separate from these fixtures.


## Bundle checkout pricing — October 9, 2026

Checkout now reads saved bundle rules and quotes current server-owned cart prices before opening payment. Shoppers explicitly choose one eligible fixed or pick bundle per order. The existing percentage, amount-off and fixed-price formulas apply only to the saved bundle quantities at base retail prices; size surcharges and extra quantities remain separate. Exact cent allocation produces Stripe line totals without changing physical production quantities.

A review token detects changed cart, artwork, product or bundle pricing before order creation. The existing orders/orderItems records freeze the selected bundle, discount and line totals. Verified payments must match that frozen amount, so later bundle edits cannot change an order already awaiting payment. Checkout errors remain visible and shoppers can change their selection and review again. Bundle configuration does not modify any saved product price. A zero-total cart remains unsupported by the existing positive-total payment flow.

Local verification: 286 frontend tests and 451 backend tests passed (737 total); frontend TypeScript, client build and Functions build passed. Tests include all three pricing formulas, extra quantities, size surcharges, pick membership, paused/expired bundles, cent rounding, stale reviews, frozen payment amounts, Stripe line totals and the review controls. No live charge, supplier order or new live sync was run. Stripe activation remains a separate setup task.

Release candidate BUILD_ID: `20261009-main-sync-bundles-d916`. Deployment is pending: automatic approval review rejected the GitHub push to FlubaDesigns/QR-Gear and requires explicit approval for that external destination. The existing FlubaDesigns/fluba-designs release descriptor must then point to the approved Main commit. The live Main site remains unchanged. Supplier completion, matching Hosting/API markers and authenticated UI checks still require post-deployment verification.

Changed source: client/src/pages/checkout.tsx; client/src/pages/orchestration-bundles-tab.tsx; functions/src/services/product-bundles.ts; functions/src/services/order-service.ts; functions/src/routes/core-routes-checkout.ts; functions/src/index.ts. Regression files: client/src/lib/__tests__/checkoutBundles.test.ts; functions/src/services/__tests__/product-bundles.test.ts; functions/src/services/__tests__/checkout-production.test.ts; functions/src/services/__tests__/checkout-bundle-routes.test.ts.


## Main cart Assembly comparison repair — October 9, 2026

The read-only production diagnostic reproduced the same Assembly-content rejection for all 22 retained products. Assembly mapping comparisons now ignore object property insertion order while retaining strict values and array slot order. Firestore map serialization must not make an unchanged generated packet appear edited. The same correction applies when reusing an existing Assembly. No product, price, artwork, identity or saved layout is rewritten.

The earlier checkout fixtures mocked composition validation and therefore did not exercise this database round trip. The candidate is checked against the actual production records before release, followed by live cart and checkout review. Main's existing engine identity cannot read sandbox (HTTP 403), so this diagnostic does not claim live sandbox parity.

Source changes: functions/src/services/assembly-store.ts; Functions build/version marker; READMEs, manifest and source bundle. Candidate BUILD_ID: `20261009-main-cart-map-order`. The existing Authorization Engine release workflow owns deployment. Live verification is reported separately.

The current sandbox comparison confirms that Main contains every commit in sandbox/products-fulfillment at a0e13b2, and both live environments contain the same Black-to-Vintage-Black QRG mapping. The importer reused a color-family key and overwrote its supplier mapping with another alias. Both QRG sync paths now use one deterministic selector: prefer the actual canonical color, otherwise retain the existing exact supplier color, and always save its label and supplier ID together under the canonical SSCC key. The existing explicit QRG print-spec refresh imports that product's real supplier variants through QRG logic, then saves variants and verified specifications together after successful validation. Existing provider mappings and prices remain authoritative.

Checkout now takes the actual provider placement and print-area coordinates from QRG. It checks that the saved artwork covers the same physical inches at sufficient resolution; a 300-DPI file for the same 12-by-16-inch area is not rejected merely because QRG's printer template uses 150 DPI. The saved artwork is unchanged. Size upcharges and retail price are resolved once through getCatalogInstancePrice; the duplicate pricing-settings read is removed. No new automated tests are added, per owner instruction. Live QRG refresh, cart and checkout behavior remain required after release.

The QRG cart correction is validated with the root TypeScript compiler as well as the Functions build before deployment.

Live cart correction: memberProfitShare is creator earnings, not a purchase discount. The cart now totals the saved server-priced line items without deducting that share; checkout continues to use the shared server quote and any explicit bundle offer. Army M Black and 2XL Black add successfully in Main.


## Actual Printful base pricing — October 9, 2026

Emergency Main pricing repair: the canonical packet calculator uses the QRG provider minimum/base cost instead of the most expensive supplier size. Admin size surcharges remain in the shared pricing settings and are applied once by the product/cart resolver. The QRG pricing import now refreshes Printful costs from the existing live connection before saving its provider range, so a populated but stale lookup range cannot prevent refresh. Supplier data enters through QRG table logic; storefront and cart continue to read saved packet prices. The mandatory inside label and other saved pricing settings remain in force. Existing catalog items are repriced through Admin Pricing's preview/apply transaction; deployment alone does not change their saved prices. No automated test suite was added.


## Member add-ons and Admin Pricing — October 11, 2026

Member builder earnings are derived from the selected options and saved Admin Pricing, including all configured sizes (4XL/5XL included), zero-valued settings, markup, center graphics and hosting. Click-based earnings increments and duplicate client price inputs are removed. Saved sharing cards use the published production packet price and image, including add-ons. QR Plus now asks for the real direct QR destination before preview and uses that destination in the shared production build. It no longer publishes a placeholder or an unconfigured hosted route. Save/preview actions remain disabled while work is in progress. New builds still use QRG and the shared snapshot/GRF/BLD/Assembly pipeline.

Validation: TypeScript and production/Functions builds are required; live add-on pricing is checked against Admin Pricing through the payment boundary without buying. Paid fulfillment and payouts are not exercised.

Resume verification: QR Plus Back returns to the destination input, and a failed supplier mockup does not advance to the preview. Root TypeScript, frontend production build and Functions compilation passed. Live verification remains a separate release check.

### 2026-10-10 — Canonical member page coverage

All member entry routes (`/members`, `/member`, `/members/library`) now share
PageSkeleton through MemberRoute, including authentication/loading states.
The existing dashboard, channels, QR Dynamics, earnings, payouts, Social Hub
and Super Simple/Simple/Advanced/Studio modes inherit the same full-width stage.
Onboarding and library no longer cap the page width. Master container layouts
arrange cards/options into responsive rows; Social Hub has a split upper row
and a full-width calendar below. Wizard navigation margins match its content
padding, and close buttons sit on the left. Product, schema, pricing, auth,
and publication behavior are unchanged.
