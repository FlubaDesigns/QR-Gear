# QR GEAR SYSTEM — ROOT README (ENFORCED)

========================================
SYSTEM ENTRY POINT — MANDATORY READ

This document controls ALL agent behavior at startup.

This is NOT a general README.
This is an execution router and enforcement layer.

Agents MUST follow this sequence exactly.

---

🔒 CANONICAL CORE AUTHORITY (ABSOLUTE LAW)

The following files ARE the system:

- BLD.md      → Build Structure
- GRF.md      → File Identity
- QRG.md      → Instance Identity
- ASSEMBLY.md → Mapping Layer

These four files form the COMPLETE and ONLY definition of system behavior.

---

❗ ABSOLUTE RULES

1. NO OTHER FILE may:
   
   - Redefine their logic
   - Summarize them with altered meaning
   - Introduce alternate structures
   - Extend their responsibilities

2. ALL OTHER DOCUMENTS are:
   
   - SUPPORTING
   - DESCRIPTIVE
   - NON-AUTHORITATIVE

3. IF ANY CONFLICT EXISTS:
   → CANONICAL CORE ALWAYS WINS
   → ALL OTHER SOURCES ARE INVALID

4. THESE FILES MUST BE READ DIRECTLY
   → NEVER rely on summaries

5. AGENTS MUST NOT:
   
   - Infer missing behavior
   - Create fallback logic
   - "Fill in gaps"

---

📊 AUTHORITY TIERS

TIER 1 — CANONICAL CORE (LAW)

- BLD.md
- GRF.md
- QRG.md
- ASSEMBLY.md

TIER 2 — CONTROL LAYER

- README.md
- REPLIT.md
- SKILLS.md
- NAMING_STANDARDS.md
- METHODOLOGY.md
- VVSS.md         → UI Architecture (Viewer / View / Skin / Shape)

TIER 3+ — NON-CANONICAL

ALL other ".md" files
→ informational ONLY
→ never authoritative

---

🔐 ZIP / MANIFEST INTEGRITY CHECK (MANDATORY)

Before any agent proceeds:

1. Confirm MANIFEST.json exists at project root
2. Run manifest verification:

   node scripts/verify-manifest.js

   or:

   npm run manifest:verify

3. Confirm all Canonical Core files are present and hash-valid

If verification fails:

→ STOP
→ REPORT EXACT FAILURE
→ DO NOT BUILD
→ DO NOT DEPLOY
→ DO NOT MODIFY unrelated files

MANIFEST must be regenerated LAST after any intentional file change:

   npm run manifest:generate

Regenerate ONLY after confirming the change was intentional.
If any tracked file changes after MANIFEST.json is generated, verification will fail.
This is correct behavior — it means something changed unexpectedly.

---

🧪 FILE PRESENCE CHECK (MANDATORY)

Before proceeding, the agent MUST confirm the existence of:

- BLD.md
- GRF.md
- QRG.md
- ASSEMBLY.md
- REPLIT.md
- SKILLS.md
- NAMING_STANDARDS.md

If ANY file is missing:

→ STOP
→ REPORT MISSING FILE
→ DO NOT CONTINUE

---

🔁 REQUIRED READ SEQUENCE (NO SKIPPING)

Agents MUST read in this order:

1. README.md (this file)
2. SKILLS.md
3. REPLIT.md
4. NAMING_STANDARDS.md
5. BLD.md
6. GRF.md
7. QRG.md
8. ASSEMBLY.md

---

✅ REQUIRED CONFIRMATION (MANDATORY OUTPUT)

Before ANY implementation, agents MUST output EXACTLY:

CONFIRMED:
- README.md read in full
- SKILLS.md read in full
- REPLIT.md read in full
- NAMING_STANDARDS.md read in full
- BLD.md read in full
- GRF.md read in full
- QRG.md read in full
- ASSEMBLY.md read in full
- Affected code traced before changes

If this confirmation cannot be truthfully produced:

→ STOP
→ DO NOT PROCEED
→ DO NOT WRITE CODE
→ DO NOT RUN COMMANDS

If confirmation is absent from the response:

→ RESTART REQUIRED: Confirmation missing.

---

🔍 CODE-TRACING REQUIREMENT

Reading documentation is NOT enough.

Before changing ANY file, agents MUST trace:

- Where the data starts
- How the data transforms
- Where the data is saved
- Where the data is loaded
- Where the data is rendered
- What naming is used throughout
- What other files depend on it

If code has not been traced:

→ IMPLEMENTATION IS NOT AUTHORIZED
→ DO NOT MODIFY FILES

---

🔄 CONTINUOUS REVALIDATION RULE

This is NOT a one-time read.

At EVERY major step, agents MUST:

- Re-check Canonical Core rules
- Validate current work against BLD / GRF / QRG / ASSEMBLY
- Reject any drift or assumption

---

🚫 PROHIBITED BEHAVIOR

Agents MUST NOT:

- Invent system behavior
- Use docs/* as source of truth
- Introduce fallback values
- Create temporary IDs (QRG, GRF, etc.)
- Skip validation steps
- Modify canonical definitions

---

✅ VALIDATION GATE (BEFORE ANY BUILD)

Before executing ANY system action:

Agent MUST confirm:

1. Canonical Core has been read
2. No conflicting definitions are in use
3. All required files are present
4. Work aligns strictly with BLD / GRF / QRG / ASSEMBLY

If ANY check fails:

→ STOP
→ DO NOT PROCEED

---

🧠 SYSTEM INTENT

There is ONE system.
There is ONE definition.
There is NO interpretation layer.

The Canonical Core is the ONLY truth.

---

🔚 END OF README — EXECUTION BEGINS

## Cloud Storage upload integrity — sandbox, October 7, 2026

The root and Cloud Functions packages pin `@google-cloud/storage` to `7.19.0`, meeting Google's published Node.js minimum for automatic upload checksums. Both lockfiles resolve Firebase Admin to that same SDK within their package tree. Existing GRF and image upload services continue to use the SDK defaults; no separate checksum implementation, upload route, schema change or credential change was added.

Validation on Node.js 20: root TypeScript check, Cloud Functions compilation and 30 existing image/video/composition tests passed. A local HTTP fixture exercised the actual SDK in both package trees: valid PNG uploads succeeded, incorrect returned CRC32C checksums were rejected and corrupt-upload cleanup was requested, for both resumable and multipart uploads. This does not verify live Google Cloud storage. Held on `sandbox/products-fulfillment`; no Main or Firebase deployment.

## Marketplace wiring — sandbox, October 7, 2026

The built-product picker now reads the canonical catalog-instance response envelope. Logs uses the authenticated request helper and displays read errors with Retry. Specific Listings/Jobs/Logs routes precede the generic surface-ID route, fixing their accidental 404s. QRG is displayed read-only in Push dialogs; failed attempts retain dialog input and refresh shared results.

Push and Jobs now use `marketplace-sync.ts` and the account-aware `marketplace-publisher.ts`: one listing per surface/account, one locked job at a time, selected OAuth credentials, saved Etsy publish settings, canonical QRG/instance cross-checks, and shared listing/job/log results. Attempts are awaited during the request. Failures stop; retries are explicit and retain prior job history. Amazon accepted submissions remain Pending, Etsy drafts remain Draft, and only a confirmed active result marks a surface Published. Rotated Etsy refresh tokens and returned external listing IDs are saved before later steps. Unknown Etsy creation outcomes block blind retries. Old direct-push histories are consulted only to recover an existing external ID; new attempts do not write those histories.

Removed the three global seller-token adapters, unused store-based marketplace endpoints, and direct job/log mutation endpoints. Amazon uses the surface retail price in its purchasable offer and separate image slots. eBay retains zero quantity and stops after failed offer lookup. Etsy updates known listings and single-product inventory without flattening existing external variations. Missing retail prices no longer fall back to supplier costs. Explicitly empty selections remain empty, and missing linked packets fail visibly.

**Original wiring review, superseded for eBay and Amazon by the selling-flow updates below:** provider-specific size/color variation publishing, remote delisting, complete category/processing-profile requirements and end-to-end marketplace verification. Saved selections are retained on surfaces; readiness and execution block unsupported variations before external calls. This change does not make clothing listings ready for sale, invent child variants, or mark unsupported operations successful. See the existing Marketplace Expansion item in `downloads/QR_Gear_Roadmap.md`.

Validation: 269 backend checks passed, including 19 new mocked-provider/HTTP/job regressions; 3 new React checks passed. TypeScript and frontend/Functions builds passed. No live accounts, database records or listings were changed. Phone-browser rendering remains unverified. Sandbox source only; no Main or hosting deployment.

## Blanks and Catalogs — sandbox, October 7, 2026

Blanks and its Catalogs tab now share transactional catalog operations between Express and Cloud Functions. Catalog membership uses canonical QRG master document IDs; Printful/Printify tables remain lookup inputs, never destinations for catalog edits. Copy and duplicate preserve every owned overlay, including color choices and intentionally empty image selections. Removal clears those overlays even when a master blank is missing. Catalog deletion protects assigned catalogs and clears a deleted default atomically. Adding to a selected catalog has no hidden Primary-catalog side effect.

Blanks, Add Blank, Products and member tier choices use the shared master projection and catalog adapter. Cards show **Our cost**. Saved catalog images and colors are respected, including during fulfillment-option lookup and draft image restoration. Single-item removal and Clear All require a catalog-specific confirmation; changing the destination cancels it. Read failures have retry controls; missing master references remain visible and removable. The blank picker has one 48px close control on the left.

Superseded catalog writers, duplicate tier editors, provider-ID catalog resolvers and unused catalog migration endpoints were removed. The dormant shelf workflow remains. Focused tests cover both server prefixes, provider/master immutability, failed bulk-operation rollback, concurrent changes, overlay cleanup, missing blanks, removal scoping, option filtering and product/draft handoff. This work is held on `sandbox/products-fulfillment`; it does not deploy or modify Main.

## Schema documentation integrity — October 7, 2026

Owner accessibility preference: left-handed, one-finger phone use. Put close/remove X controls on the left with at least 44px tap targets as each screen is updated. Blanks catalog-card removal and the shared product preview close control now follow this preference.

Reconciled GRF examples and reviewed-deletion endpoints, Assembly slot examples and reference-protected deletion, and the obsolete BLD QR classification reference with the shared schema implementation. The existing manifest generator records these intentional documentation edits plus the earlier Assembly/Source and NexusMail-removal edits. No runtime schema, data, or production deployment changes are part of this repair. Changes remain on `sandbox/products-fulfillment`.

## BLD Implementation — October 6, 2026

BLD runtime definitions, validation, and editor extraction are centralized in `shared/bldCodes.ts`, implementing `BLD.md`. Admin creation and builder commits share `functions/src/services/bld-store.ts`; the development adapter uses the same writer. The Schema Keys page and BLD library read those shared definitions. BLD records contain structural `instances[]` only. Existing beta records are not migrated or deleted automatically.

## Admin Products Snapshot — October 6, 2026

`shared/builderSnapshot.ts` owns the existing editor snapshot shape. Autosave and explicit Save use it; packet display fields and rendering inputs are derived from it. Draft edits live in `admin_build_sessions.working`. Generated packets retain their captured `builderSnapshot`; commit reads that captured snapshot rather than a newer autosave. Both backend adapters use `functions/src/services/build-session-state.ts` for this handoff and instance update/deletion behavior. This does not change BLD/GRF/QRG/Assembly ownership.

This pass is prepared in the draft PR, not deployed. BLD/Assembly slot binding, saved BLD loading, duplicate GRF registration, and full publication-chain validation remain open before launch. Old beta packets without the canonical snapshot need regeneration; no test data is migrated or deleted by deployment.

### Product builder composition (2026-10-06)

`/admin/products` now loads saved physical BLD styles directly. One ordered layer extractor supplies both BLD structure and Assembly content; header/footer images are supported, and destination backgrounds/text stay outside the physical BLD. Unchanged loaded layouts reuse their BLD; structural edits create another definition. Referenced BLD structure cannot be edited in place.

Production and development share the GRF registrar and Assembly validation services. Commit registers an actual QR PNG and all printed images; the browser no longer independently registers the same output. Generated placement graphics carry their registered IDs into publishing, including back and sleeve locations. Publication verifies the saved snapshot, QRG blank, BLD, Assembly bindings, and active GRF files before calling the provider.

Validation: 32 focused tests exercise snapshot handoffs, HTTP BLD/packet routes, real QR encoding, saved-layout reuse, image/text binding, placement selection, invalid-chain rejection, and output deletion. Firebase/Printify live execution still requires an authenticated environment; local tests use injected storage/database adapters.

### Product selection handoff (2026-10-06)

The existing Products module now selects and highlights by canonical QRG document ID. BuilderContext owns the handoff: choosing another blank clears its predecessor's print selections, draft/packet links, and generated graphic while retaining reusable design inputs. Catalog title/description overrides stay separate from provider text. Editing a different catalog card does not switch the active build.

Options loading uses the selected provider and the existing catalog adapter for colors and sizes. Only the current selection/request can supply options or attach a draft. Reopening a draft reconciles its print selections and dimensions against fresh options. Browsing categories or filters leaves the active build selected.

Seven React integration tests exercise the actual Products module and BuilderContext with controlled API responses. Run `npx vitest run --config vitest.config.ts`. These are local behavioral checks; authenticated production selection and draft persistence still require a live admin session.

### Authorization Engine browser sign-in

The existing engine can approve a one-use browser request at `/login?engine=1`. The browser keeps its proof in an HttpOnly cookie; only the request ID is shared with the engine. The QR Gear target in Fluba's canonical authorization registry supplies the allowed origin and engine principal during deployment. A Google-signed engine identity approves the request, and the browser exchanges a Firebase custom token for the existing owner account. Normal Firebase and admin checks still apply; no admin role is created or bypassed. The handoff expires after 10 minutes and the browser session uses memory persistence (closing/reloading the page requires another sign-in). Never log or publish the cookie, identity token, or custom token.

Security coverage: origin and principal restrictions, browser proof binding, expiry, disabled owner, single consumption, missing configuration, and start-rate limiting.

### Fulfillment card wiring — sandbox (October 6, 2026)

The Products fulfillment card supports Printify and Printful as lookup sources for the existing QRG master catalog. Opening the page reads supplier-specific history without rebuilding products. Explicit Smart Sync tracks the selected supplier, waits for the QRG rebuild, then refreshes the master-catalog query before announcing success. Configuration failures, sync failures, and rebuild/refresh failures are visible. Configured means a server credential is present, not that a live supplier connection has been verified.

Printful sync updates `printful_products` and `printful_variants`, the tables consumed by the QRG builder, and maintains the existing `printfulCatalog` compatibility table. Master-catalog responses retain both supplier mappings and read canonical SSCC variants as well as historical stored variants. Canonical QRG document identity and numbering definitions are unchanged.

Held on `sandbox/products-fulfillment` for the combined release. The release must include the `catalogSyncs` (`syncType`, `startedAt`) index in `firestore.indexes.json` before the new provider-history query is used. Local tests use controlled supplier/Firestore adapters; no live supplier calls or production database writes were made.

### Role / Store / Channel — sandbox (October 6, 2026)

Products uses `shared/storeRoles.ts` for the supported store roles and `ProductsContext` for dependent selection clearing. Store, channel, and collection changes remain part of the existing builder snapshot. Late defaults and mutation responses cannot replace a newer destination; errors are visible.

The existing admin and public-path store writers call `functions/src/services/store-channels.ts`. Duplicate creation returns a conflict instead of overwriting records. Channel creation verifies its parent, accepts the older partner-store parents used by Store Builder, and maintains channel counts. Existing IDs are retained; a new channel gets a store-scoped ID only when its traditional name ID is already taken by another store. Channel deletion verifies ownership, archives only its instances, and batches large changes. Admin authentication remains on both route families.

Sandbox validation: 44 frontend tests and 55 backend tests passed, covering destination changes/restoration, late saves/defaults, duplicate names, legacy IDs/parents, ownership, large deletions, existing fulfillment, selection, snapshots, packet routes, and transaction-chain checks. Frontend and backend builds passed. Test adapters replaced live Firebase/provider services; no production writes or deployment occurred. Separate legacy Store Builder listing/collection flows remain outside this card fix and need their own review.

### Master catalog diagnostics location — sandbox (October 6, 2026)

The existing Master Catalog Diagnostics panel now appears under System → Health (`/admin/health`), collapsed by default. It is no longer rendered on Products. Its scan/repair component and authenticated endpoints are unchanged; no new diagnostics route or implementation was added. Frontend-only change, held in the same sandbox for the combined release.

### Builder commands — sandbox (October 6, 2026)

Resume lists working drafts and restores them in place through BuilderContext, preserving the existing browser login. Templates use the saved builder snapshot and canonical QRG product identity, then resolve its saved Printify/Printful mapping (including products offered by both). Supplier-only resolution remains solely for unambiguous legacy builds without canonical identity. A missing QRG product or supplier mapping is an explicit error, not a substitution.

New saves the current working draft before clearing the builder, retains the selected supplier/destination, and requests a fresh session on the next product selection. Templates use the same save-before-switch handoff and atomically create a separate session containing their snapshot. Failed saves/restores keep the current build. Existing callers of `from-master` retain their select-to-resume behavior; only explicit `forceNew: true` bypasses reuse.

Both button bars open one Save dialog and save the complete working snapshot plus its name. Named drafts are excluded from stale-session cleanup and newly named saves clear expiration. Generate opens Output and invokes the existing packet creator after pricing/options and input validation; existing packets show View. Output stays mounted during accordion navigation and resets its local result when the session changes. Generation and build transitions share an activity guard. Opening an artifact-ready draft no longer automatically commits it; its existing Retry catalog save action remains.

Removed duplicate save handlers, the obsolete BuilderStickyBar file, supplier-only template/resume resolvers, full-page Resume navigation, unused template baseline/dismissal code, and unreachable upload-error code. No QRG numbering or supplier-table schema changes. Validation: 66 frontend tests and 66 backend regression tests, TypeScript, frontend build, and functions build. Database and supplier adapters are controlled test doubles; no live supplier calls or deployment. Held on `sandbox/products-fulfillment` for the combined release.

## Videos — sandbox, October 7, 2026

Admin Videos uses the existing GRF registrar and reviewed build-deletion flow. Upload formats, format digits, and the 20 MB limit come from `shared/GRF_engine.ts`; MOV is not offered because the GRF schema supports MP4/WebM. Both HTTP adapters and direct registrations validate uploaded encoding/container signatures before identity allocation or file storage. The existing classification and permanent GRF identifiers are preserved.

Cards have touch playback controls, View replaces the misleading edit pencil, and the dialog has a 48px left-side close button. Temporary preview URLs are released on replacement, close, and unmount. Failed uploads retain the form; in-flight uploads block duplicate submissions and dialog dismissal. Failed deletions expose the existing Finish cleanup controls on Videos. Held on `sandbox/products-fulfillment`; no Main deployment or production data changes. Validation uses local React/HTTP/storage test adapters; real cloud upload and device playback are not exercised by these tests.

## Fonts — sandbox, October 7, 2026

Fonts now reads and writes the existing production record `config/fonts` through one `font-settings.ts` route service for development and Cloud Functions. Shared `fonts.ts` owns defaults, supported-family validation, device-font names, ordering/deduplication and the query key. The existing Google font catalog moved unchanged to `shared/googleFonts.ts`; its old frontend import re-exports that same catalog. No settings migration or production writes were performed.

The admin editor preserves unsaved changes across query refreshes, cancels stale reads before saving, locks overlapping saves/edits, and updates the shared editor cache from the saved response. Failed reads/writes remain visible. Visible previews load without hover, with explicit failure/retry state; add/remove/reorder controls have left-side 48px targets and the nonfunctional drag handle is removed.

Browser loading waits for actual font faces and can retry failed loads. Product graphic generation awaits its selected fonts before drawing. The text editor displays font-settings/load failures and retains the saved design font when it is removed from the available choices. Both server renderers use one font-loader service; failed downloads or registration stop rendering and are not cached as successful or silently replaced by Arial. Device fonts still depend on the fonts installed on the rendering device/runtime. Local tests use controlled HTTP, storage, font and DOM adapters; live Google/CDN connectivity and production rendering remain release checks. Held on `sandbox/products-fulfillment`.

## Categories and Tags — sandbox, October 7, 2026

Categories retains its existing `categories` collection and admin-only Firestore write rules. Its header stacks on phones, category rows wrap long text, and edit/delete controls sit on the left on narrow screens. The misleading Templates title and inactive drag handles are gone. Dialogs have a 48px left close button, scroll within the viewport, and lock during writes. Failed reads show Retry and cannot be mistaken for an empty collection eligible for seeding.

Tags previously called `.filter` on the Cloud Functions `{ categories }` response. That read used `product_categories`, while the first registered update route used `productCategories`; its seed route inserted unrelated blank types with neither taxonomy nor ordering. The existing schema-backed `productCategories` collection is now used for admin read/update/seed by one `product-tags.ts` service in both HTTP adapters. Duplicate routes were removed. The shared existing season/holiday/occasion/theme defaults seed in a transaction, skip existing slugs, and retain saved inactive choices. No legacy data was migrated or deleted and no defaults were seeded during this change; old `product_categories` data remains untouched and is not read by Tags.

The Tags page validates its response, shows load/save failures, offers Retry, groups legacy or unknown taxonomy under Other Themes, and uses wrapping, keyboard-accessible toggle buttons locked during writes. Neither section was added to a new product flow. Validation: 13 focused React/HTTP regression checks, TypeScript, frontend build and Functions build passed. The browser executable was unavailable for the attempted local viewport check; mobile sizing still needs a device check. No live database operations or Main deployment. Held on `sandbox/products-fulfillment`.

## Build tabs integration review — sandbox, October 7, 2026

Reviewed Products, Library, Blanks (including Catalogs), Videos, Fonts, Categories and Tags together before the Store pass. Library now uses the shared AdminShell and preserves all seven Build destinations while retaining its subtab deep links. The shared section navigation has 48px controls; the secondary sticky bar uses the same navigation height to avoid overlap.

Products derives its category navigation and selected-category cards from the existing master-catalog query rather than two additional independent caches. Master/catalog/joint failures show Retry. Smart Sync also refreshes the joint catalog. Successful packet commits invalidate existing GRF, BLD and Assembly library queries, including inactive tabs, so revisiting Library reads the newly registered output. Uploaded packet backgrounds refresh Source. Template auto-save is awaited, refreshes the existing Templates cache on success, and reports failure visibly. Commit retry uses the existing builder activity guard and releases it after success or failure.

The combined regression run exposed one outdated product-images test adapter; it now supplies transactions and catalog membership required by the shared writer, preserving the original final-image-removal assertions. Across the reviewed suites, 163 client checks and 238 Functions checks pass (401 total); the initially failing adapter was rerun after correction. TypeScript and both builds passed. Live Firebase/provider/font calls and actual phone rendering remain unverified; the local browser executable is unavailable. No production data changes, schema changes, or Main deployment. Store-specific listing/collection review remains the next task.

## Store Builder placement — sandbox, October 7, 2026

Store Builder now has Placement and Product Library. Placement combines saved listings, unplaced products, store setup and each store's channels. Previous Catalog/Channels/Stores/Partners links open the same placement editor; the obsolete separate Partners assignment UI and writer were removed. The global Place navigation is unchanged.

Store administration and allowed-product lists now share services across Functions and development routes. Product choices store QRG references and read the shared master/catalog adapter; provider tables are not read or written. Unplaced reads include missing channels and are no longer truncated to 500. Failed reads show Retry, saves refresh existing destination caches, and explicit empty color/size choices persist. Collection deletion archives listings consistently, including legacy links and collection definitions, while retaining build files. Phone controls wrap, target 48px and put close/cancel controls on the left.

Validation: 170 client tests and 248 Functions tests, TypeScript and both builds. Tests use injected fixtures; no live database mutation or phone-browser verification. Sandbox branch only, pending Main release. Canonical QRG/BLD/GRF/Assembly documents remain unchanged.

## Store Products — sandbox, October 7, 2026

Place's Library is now labeled Store Products, including its page title and breadcrumb; the existing URL is retained. It reads the same catalog instances, store IDs, channel IDs and query caches as Placement and uses its existing product cards, move transaction and dependency-aware deletion dialog. The old selection tray and message-only bulk Move/Copy/Delete actions were removed, along with unused alternate store/channel modules. Role choices use the shared registry, including External. Failed destination/product reads show Retry; old channel-name links resolve to IDs and URL changes cannot be overwritten by late responses. Product cards flow with the page on phones, with search, all-channel browsing and explicit Refresh. Existing Printify retry stays on its existing endpoint; missing status is no longer labeled Synced. No automatic polling or provider actions were performed during this change.

Validation: 179 client tests, TypeScript and production build passed. Source and mocked interaction checks cover destination failures, old links, URL changes, shared refresh and publication status; no rendered phone check or live deployment. Sandbox branch only.

October 7, 2026 naming update: the owner named Store Builder’s product-choice tab **Products**. Its tab label and heading use that name; the existing route, member-products record and shared editor are unchanged.

October 7, 2026 navigation update: Partners now has its own main admin tab, alongside Run, Build, Place, Sell and System. Main destinations are defined in adminNavConfig for mobile and desktop; Partners is removed from Place’s subnavigation, keeps /admin/partners, and highlights its own mode. The six mobile targets share the viewport width. This changes navigation and the page title only; partner records and schema remain unchanged.

## Store Builder final review — sandbox, October 7, 2026

A final pass traced Placement, product choices, store/channel setup, collection destinations, saved selections and the Store Products handoff. Closing product choices now uses one editor-owned action: reopening the panel cannot silently discard edits, Close warns only for unsaved changes, and Close is blocked during Save. Move ignores duplicate rapid taps and gives each collection suggestion list its own ID. Saved prices represented as strings no longer crash the shared product card; long titles and paths wrap. Destination validation uses the same active-record policy as collection listing, so archived collection IDs are rejected and reusing a name cannot reattach the deleted definition. The QRG/BLD/GRF/Assembly authority files are unchanged.

Validation: 185 client tests, 250 backend tests, TypeScript and both builds passed. Seven new regression cases cover close/save behavior, duplicate moves, old prices and deleted collections. Tests use fixtures; mobile sizing was source-checked, not rendered in a phone browser. Sandbox source only; no Main or hosting deployment.


## Placement consolidation — sandbox, October 7, 2026

Place no longer has a separate Store Products tab. Finished products are managed in Store Builder → Placement through the existing catalog-instance query, cards and writers. Search, manual Refresh, all-channel browsing and Printify publication status/retry now live there. The retired `/admin/store-library` route redirects with the original store/channel parameters; old channel names resolve to canonical IDs, failed destinations show errors, and delayed lookups cannot override manual selections. Duplicate screen components were removed. Store Builder → Products still controls member blank choices; Build → Library remains graphics/templates/assets.

Validation: 186 client tests, TypeScript and production build passed. Shared schemas, provider tables and QRG/BLD/GRF/Assembly authority files are unchanged. No live mutations or device-browser verification. Saved on `sandbox/products-fulfillment`, not Main or live hosting.


## Partner member integration foundation — sandbox, October 7, 2026

The dedicated [Partner Member Storefronts and Builders](FIREBASE_SCHEMA.md#partner-member-storefronts-and-builders--planned) section records the owner's planned partner-site → individual-member → mini storefront/builder relationship. Both partner and authenticated member identity are required context; existing store, builder, product and asset references remain the source of truth. This is documentation, not runtime provisioning or a migration. Website integration and the expanded member experience belong to the second push; the current tab review is limited to schema consistency and wiring defects. No navigation redesign or external-site implementation is included.


## Dashboard To-Do List — sandbox, October 7, 2026

The current `/admin` Run dashboard now has a full-width, 72px-minimum To-Do List button above the metrics. It expands the existing authenticated Priority Queue, previously stranded on the unused older dashboard page. `AdminPriorityQueue.tsx` is the shared renderer; the older page imports it rather than retaining a duplicate implementation. Task cards and Refresh have large tap targets. Read failures and malformed responses show an explicit error with Retry, and opening the list uses the existing query cache without scheduled polling.

The existing queue includes the owner's **Connect to surfaces** reminder, linked to Marketplaces. It is a persistent code-backed reminder, not a newly introduced task collection or completion editor. No marketplace account was connected or listing published by adding it. QRG/BLD/GRF/Assembly schemas are unchanged. Held in sandbox for the combined release.


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

## Persistent isolated sandbox — October 8, 2026

The current admin/tab, marketplace and AI Builder working changes are carried forward
on `sandbox/products-fulfillment`. The isolated Firebase deployment targets
`qr-gear-sandbox`, with its own Auth, Firestore, Storage and runtime account. Runtime
configuration rejects cross-project storage and a sandbox pointed at Main. Sandbox
build sessions have no age-based expiry; explicit deletion remains available.
Supplier requests, marketplace publishing and outbound email are disabled there.
The embedded Printify credential fallback was removed; Main requires its configured
credential when this change is eventually promoted. No Main deployment is authorized
by this sandbox update. The Functions Firebase Admin SDK is aligned with the root project at 13.6 to support keyless deployment credentials. Sandbox deployment and browser acceptance remain pending.

### Sandbox runtime update — October 8, 2026

Functions now target Node.js 22 with Canvas 3.2.3 and Firebase Admin 13.6 (aligned with the application). The backend compile, focused regression checks and a real transparent PNG render exercise the update. Frontend build tooling remains on Node.js 20. Deployment uses the existing dedicated sandbox runtime identity. Navy is the first acceptance build; rebuilding Army is deferred until the owner reviews Navy. Main is unchanged.

### AI build authority — October 8, 2026

The AI Builder has an AI Build Rules tab using the same shared rules supplied to every AI prompt. Product facts come only from QRG tables. Direct Printify/Printful table or API lookup is forbidden, including fallback. Missing QRG information may be requested through QRG table logic, which owns provider-table imports. The AI reads the result from QRG and never reads provider tables directly. Switching to Rules keeps the active build mounted. This records the owner’s explicit QRG-only requirement; the AI proposal fields remain limited to the existing reviewed edits.

### Isolated backend startup — October 8, 2026

Functions explicitly include the existing shared-schema runtime dependencies (Drizzle and Zod). The application boot is checked outside the repository so root dependencies cannot mask missing deployment packages. Authorization Engine project validation uses the central runtime resolver, including FIREBASE_CONFIG deployments. Seventeen affected validation/authentication/configuration checks passed.

### Canonical QRG options — October 8, 2026

The product-options route now uses the existing shared QRG color/size projection instead of a duplicate seven-digit parser. This restores actual labels for canonical four-digit SSCC variant rows such as the saved Navy combinations. No provider-table reads are added.



### Navy typography in sandbox

Product and landing-page canvas previews and exports now preserve saved font weights and letter spacing. Oswald loads its available weights before drawing; spacing scales with export dimensions and resets between text blocks. Navy's supplied design values remain in its saved builder snapshot. Reopened working drafts can regenerate even when they retain their previous packet reference. Focused coverage: `client/src/lib/__tests__/navyTypography.test.ts`.
### Subject-aware build layout — October 8, 2026

`shared/aiProductBuilder.ts` remains the single source for the AI Build Rules screen and AI prompts. Owner-supplied typography, scale and position values are starting suggestions unless explicitly locked. Adapt them to each subject and its actual artwork, retain the intended wording and hierarchy, and keep content readable, inside its boundaries and clear of important visual details. Review the rendered shirt graphic and QR landing page separately at phone viewing size before the existing Products Generate workflow. Numeric checks alone are not visual verification. This updates build guidance; it does not introduce an automatic layout engine or broaden the AI proposal fields.


### QR zone clearance — October 8, 2026

The shared shirt layout now measures the top zone against the QR background edge and reserves the rendered CTA line height below it. This keeps top artwork clear even at its lowest allowed position and prevents larger CTA text from rising into the QR border. Preview and export use the same geometry; the QR size and center remain unchanged.


### Generated product galleries — October 8, 2026

Built-product galleries now contain only the linked packet's generated mockups, artwork, QR image, and landing proof. Blank catalog photos are neither appended nor used when generation is unavailable; original catalog selections remain intact for blank browsing. All store gallery images and thumbnails preserve their full aspect ratio, including portrait QR landing images. An empty product gallery explicitly reports generated images unavailable.


### One Products build path — October 8, 2026

All AI product work must read and follow `AI_BUILD_RULES` in `shared/aiProductBuilder.ts`; that same rulebook feeds the admin Rules tab and prompts. Resume the existing build and trace the existing implementation before proposing changes. Reuse its QRG/BLD/GRF/Assembly pipeline and Generate action. A returned, verified provider shirt mockup is required before claiming the physical preview is complete.

Returned mockups are saved in the packet's existing color/placement map using the captured build color. The store initially selects that generated color, so a Navy build opens with its Navy proof instead of the first catalog color. Missing sandbox placement records are initialized only through the existing placement-table seed route; no new sizing formula is introduced.

Admin graphic preview now receives `productGraphicOptions(buildWorkingSnapshot(...))`, the same projection used by Generate, including the selected print dimensions, QR color and styling. Existing QR sizing math is preserved. Priority mockups read the persisted packet's placement artwork, dimensions and selected color and resolve the supplier variant from QRG. They no longer discard placement or conceal provider errors. Sandbox permits only Printful mockup task creation/status; catalog and commerce calls remain blocked. Its existing credential store is connected securely through the Authorization Engine without logging keys, copying unrelated credentials, changing IAM or deploying Main.

The store detail and collection cards read QR product type from the linked generated packet. They no longer invent a QR Basics label when a QR Canvas build is saved.

### Complete generated galleries — October 8, 2026

The shared storefront gallery combines selected-color mockups with the linked packet’s full generated image list. Shirt artwork, standalone QR and landing proof remain visible after mockups arrive. Duplicate and other-color mockups are excluded; generation and packet ownership are unchanged.


### Reference builds and visible product metadata — October 8, 2026

The shared AI Build Rules now cover Save as New versus Resume, destination verification, Library/Cropped asset selection in the target environment, preserving supplied wording and baked-in titles, and verifying the complete generated gallery. Output exposes the existing product title and description setters even when no catalog card is loaded. Generate derives a new landing slug from the captured product title, preventing a cloned reference title from naming the new subject URL. Existing draft, QRG, BLD, GRF, Assembly and packet storage remain the source of truth.


## Storefront color mockups — sandbox, October 8, 2026

Storefront color changes and Products priority mockups now use the same saved-packet request resolver. It uses the packet's exact placement artwork and print dimensions plus the selected color's canonical QRG Printful variant. The storefront no longer relies on legacy blueprint/artwork fallbacks or provider catalog lookups for this request. Cache entries remain scoped to the existing packet and color, and Heather colors remain distinct. Failed previews show a retry control; superseded requests cannot replace the current selection. Product cards show complete names and consistently frame mockup photos. Prices, QR destinations, generated proofs and product identities are unchanged.


## Armed Forces build methodology — October 8, 2026

The shared AI Build Rules retain the owner's reusable content order: establishment date (`EST. MONTH DAY, YEAR`), `UNITED STATES / BRANCH NAME`, motto, translation or meaning, role/purpose, and legacy. This guides future builds and AI prompts; it does not insert placeholder wording into existing products or individual pages.


## QR Play storefront preview — sandbox, October 8, 2026

The product detail response now projects the linked packet’s existing `playMediaUrl`. `PhoneMockupCard` displays YouTube/Vimeo sources as embedded players and direct media as native video, with a correctly sized phone screen, muted autoplay while visible, playback controls, and a Watch full video link. Direct files and YouTube previews stop after 15 seconds; Vimeo retains its own controls. Missing or failed direct media is explicit. Non-video destination images retain their existing behavior. No product, QR, BLD, GRF, QRG or Assembly records are rewritten. Focused API and React regressions cover the saved source, playable media selection, offscreen cleanup, errors and image products.


## QR Gear branding and QR Play gallery — sandbox, October 8, 2026

Public store product titles and descriptions use QR Gear branding instead of the blank manufacturer and its 3001 model number. The saved supplier/QRG configuration stays internal and unchanged. The shared AI Build Rules require this customer-facing branding for future builds.

For QR Play products, the shared gallery replaces the linked packet's exact landing snapshot slot with its existing video. Model photos, artwork and QR order are retained. Native videos show a paused frame with playback controls; YouTube entries show the video's thumbnail before an explicit Play action. If that external thumbnail fails, the same packet's artwork remains visible with an Artwork preview label and Play control. Main gallery, thumbnails and lightbox share one media renderer. Failed direct media shows a source link. Non-video products retain their landing proof. Future AI builds must verify both the gallery video and phone preview.


## Fresh storefront releases — sandbox, October 8, 2026

Hosting now sends `no-cache, no-store, must-revalidate` for page URLs, including rewritten product links. Matching only `index.html` left `/shop/product/...` cached for an hour, allowing an older gallery to persist after deployment. The later `/assets/**` rule retains immutable caching for versioned bundles. Verify response headers on the actual product URL after deployment, not only `/index.html`, and use a fresh query URL when helping someone whose browser already holds the previous one-hour response.


## Embedded video phone posters — sandbox, October 8, 2026

YouTube/Vimeo phone previews now share the gallery media renderer: show a thumbnail (or the same packet's clearly labeled artwork if the thumbnail fails), then load the embedded player only after Play. This avoids an empty or failed third-party player on arrival. Rushmore-style hosted files retain muted 15-second autoplay. The existing full-video link remains available. Both monument gallery and phone previews are verified separately.

### Full QR Play playback — sandbox, October 8, 2026

The selected gallery video slide and the phone preview now open the actual saved video player automatically, muted, with playback controls. Removed the YouTube `end=15` parameter and the uploaded-video pause/reset handlers; viewers can watch the full source video in place. Phone playback stays mounted after first entering view so scrolling does not restart it. Navigation thumbnails retain still-image fallbacks. The shared AI Build Rules require real video playback rather than an artwork overlay and verification beyond 15 seconds.

Regression coverage checks immediate embeds, no excerpt end parameter, full uploaded-file playback, persistent phone playback, reduced-motion manual controls, and inactive thumbnails.

## Existing admin fulfillment controls and paid-order handoff — October 9, 2026

Admin → Build → Products already contained the Fulfillment selector. It is reused, with an explicit **Use for new builds** action writing the existing `settings/admin.defaultFulfillmentProvider` field. No second settings selector was added. Missing preferences no longer silently choose Printify or Printful, including the product catalog's browsing indicator. Restoring a build preserves its saved provider, and new builds use the saved preference. The owner can select a different provider on the product screen without changing the saved default. Provider configuration reads the existing credential record without throwing because another provider is unconfigured. Each setting has one authoritative saved source; displays and consumers derive from that source rather than maintaining competing defaults.

Admin catalog checkout now resolves the saved catalog instance, production packet, Assembly, QRG size/color mapping, registered placement GRFs, verified print dimensions, saved retail price and size upcharge before creating payment. It checks current Printful variant/placement availability, freezes `orders` and `orderItems`, and verifies the Stripe signature, order identity, buyer, currency, total and paid status before production. Cart edits after checkout cannot change a paid order. A failed or repeated notification resumes the same order. Unsupported/missing mappings stop checkout; they never choose another provider or artwork.

The Printful adapter creates a draft with the canonical order's external ID, persists the remote ID and confirms it. A transaction lease and external-ID recovery prevent duplicate creates on retry. Failures remain visible. The existing Admin Orders screen shows canonical items/totals and offers **Retry production submission** and **Refresh shipping status**, including provider tracking and the existing deduplicated shipping email. Server-verified order fields cannot be overwritten by customer writes or manual admin status patches. Duplicate order routes and the raw customer Printify submission path were removed/retired.

Validation: 43 focused React checks and 41 backend checks passed (mocked Stripe, Printful and Firestore), root TypeScript, Functions compilation and the frontend production build passed. No real payment, printer charge or email was sent. Sandbox commerce guards remain enabled. Live Printful account/store confirmation, a controlled paid production order, refund/cancellation behavior, shipping policy configuration and direct-sale referral accounting still require review before Main. Referral identity is retained with `payoutState: needs_review`; it is not silently credited using a hardcoded percentage. Existing member packet verification and partner embed attribution flows are unchanged and deferred. Partners are websites whose identified users receive stores; Members are a separate model. This pass does not close the broader Admin Audit findings.

## Sandbox admin access and navigation — October 9, 2026

Public shopping links and legacy `/store` now use the canonical public shop destination; the legacy duplicate admin builder was removed from `/store`. All `/admin` API paths have a namespace-level server guard as well as their existing route guards. Admin policy requires a verified, non-revoked Firebase identity plus an explicit configured owner or strict saved `users.isAdmin === true` grant. Empty owner configuration grants nobody access. Browser UID allowlists and environment bypass shortcuts were removed. Profile queries are identity-scoped, reject mismatched identities, disable cached admin access on verification errors and use non-cacheable server responses. The development adapter uses the same policy. Existing configured owner access is retained; no new admin grants were created. Repeated Products route registrations were removed, retaining their canonical products-page registrar. Partners and members remain deferred.

## Admin Pricing saved values — sandbox, October 9, 2026

Reuses the existing Pricing screen and `testSettings/pricing` record. One shared schema validates the existing amount fields without hardcoded business defaults. Zero markup, charges, shipping, hosting and profit share survive save/reload. Both save URLs use the same protected handler; the duplicate save handler in members-library was removed. Public reads report invalid/missing configuration rather than inventing prices; authenticated admin reads keep it editable. The development adapter uses the same validation. Nested pricing maps replace their previous values while unrelated legacy metadata is preserved. Load failures are visible and cannot submit defaults. Existing Sync/repricing work is still open; this change does not claim those actions are repaired.


## Catalog markup preview and apply — sandbox, October 9, 2026

The existing Pricing Sync action now previews the saved percentage/fixed markup against each canonical admin catalog product's recorded cost subtotal. Applying a reviewed preview updates the existing instance through `resolveInstance` and its owned packet together, without writing lookup catalog or member/partner store records. Both API aliases use the same existing catalog service; the Cloud Functions no-op handlers and competing development store-price implementations were removed. Missing costs, invalid ownership or a stale preview block every write. An atomic operation is limited to 200 products and reports the limit rather than partially updating a larger catalog. Only actual updates set lastSyncedAt. No external marketplace publication, payment or printer submission occurs.

The UI explicitly calls this saved-markup application. Rebuilding production, shipping, label and hosting cost components is separate work and remains open; this change does not claim that all pricing consumers are repaired. Main is unchanged.

## Saved production pricing and mandatory inside labels — sandbox, October 9, 2026

The existing Admin Pricing preview/apply flow and new packet creation now use one server calculation. QRG imports costs for the product's chosen provider from its existing provider catalog. Saved placement, header/footer, center graphic, hosting, label, shipping and markup settings determine the base retail price. Size increments are added once at checkout. Zero remains valid; missing configuration fails visibly. Member profit share remains a separate saved setting and does not discount admin product prices.

The inside brand label remains mandatory. New builds save its verified QRG print area and existing brand artwork. Pricing preview identifies older packets missing their registered inside label; apply registers that artwork through the existing GRF registrar and atomically saves packet instructions and catalog pricing. Existing valid label artwork is preserved; ambiguous or invalid custom artwork blocks the update. Checkout rejects a product without its inside label. The original automatic mockup label remains. Outside placement selection can add its own saved provider charge, but the historical preferred-position setting cannot replace the mandatory inside label.

Admin Compose hosting choices now read the saved pricing tiers. Packet commits use the server-priced generated packet, and direct packet price patches cannot introduce a second price source. The existing illustrative example remains labeled as an example, not a catalog product price. Marketplace publication and real payment/printing remain outside this sandbox action.

Candidate evidence: 67 focused backend checks and five React pricing checks passed, including inside-label restoration, provider-specific costs, stale previews, zero values, size-once checkout and the mocked Printful label handoff. TypeScript and client/Functions builds passed. Live sandbox verification is recorded separately after deployment; these checks do not establish a real paid print order.

### Sandbox catalog cost import follow-up

Live pricing preview found all 22 seeded products lacked valid Printful lookup costs. Smart Sync then exposed an existing sandbox guard that labeled catalog reads as unconfigured. The Printful client now explicitly permits only GET /products and GET /products/:id alongside existing mockups in sandbox; order lookup, creation and production confirmation remain blocked. Smart Sync uses this same client. The QRG pricing importer reads missing costs from the mapped Printful product once and saves them on that provider mapping; later previews reuse the canonical range until a supplier lookup refresh replaces it. No hardcoded price is substituted.

Live field verification: every one of the 22 configured numeric controls saved zero and retained it after reload; XS stayed unconfigured. All 23 field values then matched their original values after restoration and a second reload. No zero-price catalog apply occurred. The follow-up's 46 targeted tests passed, including catalog-read permission, blocked sandbox orders, QRG cost import/cache, labels and checkout. Live full-cost apply remains pending this follow-up deployment.

## Admin audit release candidate — October 9, 2026

User authorized promotion to Main with remaining wiring defects tracked for follow-up. This batch shares recorded analytics and provider-health services across adapters; saves versioned owner AI instructions; consolidates coupon/hosting handlers and the coupon editor; derives channel counts from catalog instances; surfaces customer read failures; labels saved template prices; and removes 23 unreachable UI files. Existing browser-local sign-in persistence is preserved. Required inside labels and canonical pricing remain intact.

Unconnected orchestration publishing, automatic provider selection, rule execution and profit forecasting now fail explicitly instead of returning fabricated success. They are not implemented by this release. Legacy BLD-SZ10-004 / ASM-000002 remain invalid and must not be blindly promoted. Partner/member workflows and controlled sale/printing verification remain follow-up work. Code deployment does not automatically copy sandbox Firestore records or artwork to Main.

Candidate validation: 267 frontend and 422 backend tests pass; frontend/Functions type checks pass. Acceptance: frontend/Functions builds; complete configured regression suites including authentication and immutable checkout/fulfillment; exact Main Hosting/API markers; unauthenticated admin rejection; visible production admin checks. The release remains unverified until the production workflow and live checks complete.

## Main admin emergency repair — October 9, 2026

Supplier sync history selects the newest matching provider job using an equality-only read and normalized timestamps, so it does not fail while a composite index is absent. Orchestration lists the same saved catalog instances as Store Builder; QRG supplier blanks are no longer presented as sellable products or deletable through that screen. Saved-build links and the existing Graphics/BLD/Assembly Library remain available.

Profit now reads paid store-order revenue and all saved product price/cost estimates. Unrecorded settlement costs and fees remain unknown; estimated contribution is explicitly separate from realized profit. Routing shows each saved packet/provider/price/inside-label relationship and links to the existing paid-order fulfillment controls. The disconnected supplier-scoring form is removed. Repricing uses the existing Admin Pricing preview/apply transaction, including stale-preview rejection and mandatory label protection. The obsolete rule-run controls are replaced by this working saved-settings flow; no scheduled rule engine is claimed. Marketplace publishing and channel management open their existing authoritative screens instead of the disconnected bulk worker. No external publication or order submission occurs from these changes.

Registry comparison found every displayed sandbox Graphics, BLD and Assembly ID on Main. The protected 22 products and their canonical dependencies are retained. Cleanup is a separate dependency-reviewed operation; this code does not delete registry or product records.

Acceptance: provider history loads; Orchestration shows the 22 saved products; Profit and Routing show recorded data; Repricing displays a real canonical preview; anonymous admin access remains rejected; Main Hosting/API markers match the released source. Local checks and live verification must be reported separately.


### Main cleanup dependency scan — 2026-10-09

The shared build-deletion service now limits concurrent database RPCs to eight, discovers nested website references without holding parent slots, and sorts records before generating the review token. A scan that cannot finish within 45 seconds returns an explicit 503 error; incomplete scans never authorize deletion. Reference tokens and owned file paths are extracted once per record to avoid repeated parsing of supplier histories for each asset. The deletion dialog cancels abandoned preview requests and shows the first failure without silently repeating long scans. Existing shared-asset retention and transaction-time impact revalidation remain required. Focused tests cover concurrency bounds, stable tokens, nested reference failures, timeouts, cancellation, and existing deletion protections. No bulk cleanup or payment-mode change is implied by deploying this code.

Main To-Do List: the existing Stripe warning is now the requested **Fix Stripe** task, with a direct Stripe API-keys link and QR Gear account / live keys / checkout webhook / checkout verification instructions. It remains visible while the live server key, live browser key, or webhook signing configuration is missing. External task links open in a new tab; internal tasks retain app navigation. Live Stripe activation is deferred at the owner’s request.


## Main admin smoke-test repairs — October 9, 2026

Committed destinations now include the channel parent store ID. The editor restores legacy snapshots whose nested channel omitted that ID, while retaining rejection of explicit cross-store selections. Output takes its provider from the saved packet: Printful products link to the existing Orders fulfillment path; Printify publishing is offered only for Printify packets; an unknown provider is reported visibly.

Bundles use the same finished catalog instances as Store Builder and Orchestration, with visible titles and saved prices. The backend validates product references, membership, quantity and discount/pick limits, writes parent/items atomically, includes new bundles in sorted listings and calculates current saved prices in cents. Blank-based legacy bundles fail explicitly. At this earlier repair checkpoint, saved bundle discounts were not consumed by storefront checkout. The subsequent Bundle checkout pricing section below supersedes that limitation in the release candidate. No product price is changed by bundle configuration.

Template cards project the linked packet's current saved name, image and price, while retaining the reusable builder snapshot and printed QR content. Categories displays required-name and save errors inside its dialog. Supplier history reports unfinished jobs past the existing 30-minute timeout instead of displaying them as still running indefinitely. Members and Partners are deferred, and Stripe activation remains on the existing to-do list. Code deployment does not itself delete old registry data.


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

Release compatibility: QRG variant collections use Array.from so both the root compiler and Functions compiler accept the same canonical supplier selection.

Live cart correction: memberProfitShare is creator earnings, not a purchase discount. The cart now totals the saved server-priced line items without deducting that share; checkout continues to use the shared server quote and any explicit bundle offer. Army M Black and 2XL Black add successfully in Main.


## Actual Printful base pricing — October 9, 2026

Emergency Main pricing repair: the canonical packet calculator uses the QRG provider minimum/base cost instead of the most expensive supplier size. Admin size surcharges remain in the shared pricing settings and are applied once by the product/cart resolver. The QRG pricing import now refreshes Printful costs from the existing live connection before saving its provider range, so a populated but stale lookup range cannot prevent refresh. Supplier data enters through QRG table logic; storefront and cart continue to read saved packet prices. The mandatory inside label and other saved pricing settings remain in force. Existing catalog items are repriced through Admin Pricing's preview/apply transaction; deployment alone does not change their saved prices. No automated test suite was added.

## Main emergency cart variant repair — October 10, 2026

The live Asphalt / XS failure exposed a storefront projection bug: independent color and size lists offered a Printify-only QRG row on a Printful build. Product detail and the sale resolver now share the enabled QRG variant/provider intersection. The storefront disables unavailable sizes per color, clears an incompatible selected size with an explanation, and never substitutes a size or provider. Both Add to Cart and Buy Now validate the same saved production packet before adding an item, including guest carts. Invalid combinations return an actionable 400 instead of a retrying 500. Existing QRG identities, artwork, inside labels and shared retail pricing remain authoritative.

Acceptance: Asphalt XS/5XL must be unavailable for these Printful builds; Asphalt S must persist through each cart button at the unchanged retail price; Black XS remains available; checkout must agree with the cart. The earlier two-variant smoke check did not cover provider-specific size availability. No new test suite was added.



## Member shared build path — October 11, 2026

Member publishing now resolves the selected blank, supplier variants and print areas through QRG, prices the captured build through the shared packet calculator, registers print assets through GRF, and commits the shared BLD and Assembly before marking the product published. The member listing stores ownership and a reference to its production packet; dashboard and public share reads project that saved packet. Member color/size choices use the QRG/provider intersection. Mockup requests resolve provider identity from the QRG member selection. Failed Basic/Plus publishing no longer advances to a success screen.

Acceptance for this batch: select a verified Printful blank in Members, publish QR Basic with a valid color/size, reopen the saved product, and verify its QRG member identity, BLD, GRF, Assembly, saved price and public share display. Main deployment and authenticated live persistence must be checked separately from compilation. No new automated test suite was added.

Scope: the member product creation/listing path. QR Compose sequence publishing remains unavailable until its content sequence is connected to the shared build; legacy member products are not silently migrated. This batch does not claim payout, paid member fulfillment or every Members tab verified.

Live catalog alignment: the member picker is populated from the assigned tier catalog while the older `member-products` allowlist is explicitly empty. Build preparation, QRG options and mockup resolution now consume that same assigned tier catalog, falling back to the allowed-products list only when the picker has no tier catalog. This avoids showing a selectable blank and then rejecting it as unassigned.

Member read freshness: authenticated member fetches explicitly bypass the browser cache, and member routes emit private/no-store responses. A cached retired 410 product-list response and a stale empty channel response must not survive a source release or a successful member write.


## Member dashboard and three builder experiences — October 11, 2026

Dashboard totals, channel items, and publish progress now use the same authenticated member packet projection. Published progress counts saved production-backed packets instead of a browser/profile counter. Loading and request failures remain visible. Returning members stay on the dashboard after authentication settles. New builds and Create Another remount the shared draft state so a previous packet, mockup or selection cannot leak into a new product. Super Simple retains its teaching cards, Simple its guided flow, and Advanced its detailed controls.

The Members workspace now uses PageSkeleton, Master rows and responsive split helpers. Progress bars retain labels without step counts; a QR badge appears only after a type is selected. Channels offer a direct saved-product link. Earnings reads use the server summary envelope, and member requests reject non-JSON responses instead of treating them as empty data.

Validation before release: root TypeScript and production build passed. Authenticated Main walkthroughs of all three experiences are the release acceptance step; no payment or supplier order is authorized by that check. QR Compose's previously documented shared-sequence limitation remains open.

Super Simple records tutorial completion when the shared build actually returns a published packet. The old completion handler was behind a Next button hidden on confirmation screens, so returning creators repeatedly saw the first-time guide. Progress read/write failures are now visible.
