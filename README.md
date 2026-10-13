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

The existing engine can approve a one-use browser request at `/login?engine=1`. The browser keeps its proof in an HttpOnly cookie; only the request ID is shared with the engine. The QR Gear target in Fluba's canonical authorization registry supplies the allowed origin and engine principal during deployment. A Google-signed engine identity approves the request, and the browser exchanges a Firebase custom token for the existing owner account. Normal Firebase and admin checks still apply; no admin role is created or bypassed. The handoff expires after 10 minutes and the browser session uses Firebase browser-local persistence, matching email and Google sign-in; explicit sign-out clears it. Never log or publish the cookie, identity token, or custom token.

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

Validation: 185 client tests, 250 backend tests, TypeScript and both builds passed. Seven new regression cases cover close/save behavior, duplicate moves, old prices and delete…64931 tokens truncated…overage, invalid dimensions, or differing physical templates with no shared placement fail visibly rather than stretching one file across incompatible sizes. This deliberately leaves incompatible size groups unresolved rather than falsely labeling them supported. The sandbox permits only the additional read-only print-file metadata endpoint; orders, product catalog calls and commerce remain disabled.

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

### Homepage message section — October 11, 2026

Custom Gear That Sends a Message now leads with a large image, an offset frame and a floating scan label. Three supporting stories use overlapping image/copy panels, depth shadows and a staggered desktop arrangement. The existing PageSkeleton and Master row/split helpers provide the structure; presentation is scoped in the existing QR Gear site stylesheet. The section is visible on mobile, the Create link keeps its /build destination with a 48px minimum target, and hover motion respects reduced-motion preferences. The memory story uses the current QR Canvas product name. Existing images, data contracts and backend behavior are unchanged.

Files: `client/src/components/MarketingMessage.tsx`, `client/src/styles/canonical/qrgear-site.css`, `client/src/pages/home.tsx`, both READMEs, manifest and source ZIP. TypeScript and production build passed.

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


## Shared starter backgrounds — October 10, 2026

The owner clarified that the two shared videos were accidental. The shared starter API now returns only image GRFs for every query, including `all`; the 18 uploaded photos remain available. Existing video originals and registry references are preserved but excluded from member shared selections. Shared uploads now accept images only, with server validation and matching page labels. Personal media uploads remain separate. Both library sections retain preview-only cards without Download controls.

Validation: TypeScript and production builds, manifest and source ZIP verification, then live release markers and shared background counts. Member post-creation review remains a separate read-only follow-up.

Publication compatibility: all 22 approved Admin packets have no packet-level status field. Public landing access therefore verifies their bound, active and visible canonical catalog instance. Member/owner packets require their explicit published status. Draft packets do not inherit public access.

Purchased-copy allocation reads the blank identity from the validated Assembly/master relationship. It does not require a duplicate `qrgBlankId` field on the source packet; the approved Admin packets use that canonical relationship.

Live readiness follow-up: missing numeric production costs are imported through the existing QRG pricing importer only for mapped Printful products with verified inside-label support. Existing valid costs are reused. Products without size/color mappings or required inside branding remain unavailable with a direct customer-facing explanation rather than a repeated refresh instruction. The two AS Colour choices currently lack a shared verified inside-label area; this release does not bypass that requirement.


## Supported branding and individual labels — October 10, 2026

The owner superseded the universal inside-label requirement: use verified inside branding when available, otherwise verified outside branding, and allow products with neither label area to proceed without a label charge. Printful’s AS Colour 5001 product page lists outside labeling, and its help center limits inside labeling to tear-away-tag apparel. This policy is shared by member options, packet generation, pricing, repricing and checkout. QRG now imports missing costs for every mapped product with verified print areas, including both AS Colour choices. Label areas are separate from member design placements; canonical mockups include the selected brand label.

Each purchased physical item already receives its identity from the shared QRG allocator. Its brand-label file now retains the existing QR Gear artwork, replaces the generic QR with the individual item URL and prints its full owner QRG number. Quantity N generates N labels through the existing paid-order/GRF/Assembly pipeline. Retries reuse the allocated item identities and completed files. The public label page at /api/qr/item/:instanceId exposes only the bound published item’s title and QRG number, plus its active QR experience link; it does not expose owner, order or claim information. New purchases receive individualized labels; existing fulfilled items are not rewritten.

Validation: frontend TypeScript, backend compilation and production build; direct inside/outside/no-label pricing checks; two rendered PNG labels successfully decoded to distinct URLs; isolated quantity-two fulfillment run and retry reused the same two identities/files. No payment or provider order was submitted. Deployment verification checks the live AS Colour picker and release marker.


## Member draft and sign-in handoff — October 10, 2026

Product selection now updates only the wizard draft. Removed the obsolete packet-create/PATCH helpers from the shared member context and QR Basic navigation; production packets are created through the existing shared member build/publish path. QR Basic and Plus ask for sign-in before authenticated preview generation, retain the draft, and resume the pending step after authentication. Their save wrappers also reach the shared sign-in gate instead of silently returning. The post-sign-in component no longer duplicates channel creation or deferred uploads; the shared publish action owns both. Sign-in copy describes continuing to preview/save rather than promising immediate publication. Failed Basic/Plus mockups leave the input step visible with a retryable error, never a QR-only image presented as a shirt mockup.

Validation: direct behavior checks confirm no write on product selection, guest preview/save gates, and Basic/Plus preview-error retention; frontend typecheck and production build; live walkthrough after the Authorization Engine release. Signed-in saving/reopening requires a member session and is not claimed by the guest walkthrough.


## Member builder labels — October 11, 2026

The direct-destination step is shared by Basic and Plus. All three wizard progress badges now preserve the selected Plus label on that step. The underlying QR type and header were already retained. Product wording recognizes T-shirt/tee before the Canvas brand name, so Bella + Canvas apparel is called a shirt. These are display corrections; publication, artwork and pricing are unchanged.

### Canonical member previews — October 11, 2026

QR Basic and QR Plus now prepare their preview through the same owned QRG build, shared product renderer, verified print area, and supplier variant used for publication. Preview artwork is reused on save when the design is unchanged. A changed position, size, or center image requires an updated preview before proceeding. The preview endpoint verifies member ownership; publishing retains the existing GRF, BLD, Assembly, and pricing checks. Removed developer URL output from the QR Plus preview.

Validation: TypeScript, frontend build, and Functions build pass. Live verification is recorded separately from these build checks.

### Member save choices — October 11, 2026

QR Basic and QR Plus now honor item-only, graphic-only, and both save choices. Graphics are registered in the member library using the rendered canonical artwork; graphic-only saves do not publish a product. A failed library save remains on the save step with an error instead of claiming completion.

### Public builder skeleton — October 11, 2026

`/build` now composes the existing `PageSkeleton` and wizard frame. Header/footer, main-content slot, responsive rows, progress sidebar, and navigation use the established canonical helpers. The Create breadcrumb is inside the main area, with the old narrow gradient/card wrapper removed. Canonical stylesheet sources and member behavior are unchanged. Public option estimates include the saved markup, and Basic QR guidance correctly describes a fixed printed destination.


Desktop footer follow-up (October 11, 2026): Footer.tsx now composes the Master row and split-4 helper inside the shared skeleton scope. Removed its old independent grid rules. Desktop footer presentation is quieter: reduced vertical padding, smaller labels/social icons, compact contact/partner details, and transparent background. Column gaps remain owned by Master CSS.

Footer credit: “Powered by FlubaDesigns.com”, linked to https://flubadesigns.com.


### Card-density correction files

- `MANIFEST.json`
- `README.md`
- `client/src/components/IdeaLinks.tsx`
- `client/src/features/adminProducts/ADMIN_README.md`
- `client/src/features/members/MembersPage.tsx`
- `client/src/pages/account.tsx`
- `client/src/pages/admin-orders.tsx`
- `client/src/pages/admin-run.tsx`
- `client/src/pages/advent-qr-shirts.tsx`
- `client/src/pages/artist-qr-apparel.tsx`
- `client/src/pages/band-dynamic-merch.tsx`
- `client/src/pages/business-analytics-qr.tsx`
- `client/src/pages/business-qr-plus.tsx`
- `client/src/pages/earn.tsx`
- `client/src/pages/event-qr-shirts.tsx`
- `client/src/pages/everyday-qr.tsx`
- `client/src/pages/family-reunion-shirts.tsx`
- `client/src/pages/family-video-messages.tsx`
- `client/src/pages/lost-found-qr.tsx`
- `client/src/pages/medical-alert-qr.tsx`
- `client/src/pages/memorial-qr-gifts.tsx`
- `client/src/pages/memorial-video-shirts.tsx`
- `client/src/pages/musician-merch.tsx`
- `client/src/pages/networking-qr-shirts.tsx`
- `client/src/pages/office-qr-mug.tsx`
- `client/src/pages/orchestration-profit-tab.tsx`
- `client/src/pages/personal-items-qr.tsx`
- `client/src/pages/qr-basics.tsx`
- `client/src/pages/qr-canvas.tsx`
- `client/src/pages/qr-dynamics.tsx`
- `client/src/pages/qr-history.tsx`
- `client/src/pages/qr-ideas.tsx`
- `client/src/pages/qr-play.tsx`
- `client/src/pages/qr-plus.tsx`
- `client/src/pages/realtor-qr-shirts.tsx`
- `client/src/pages/video-time-capsule.tsx`
- `client/src/pages/website-qr-shirts.tsx`
- `client/src/pages/wedding-qr-shirts.tsx`
- `client/src/styles/theme.css`
- `docs/PAGE_LAYOUT_AUDIT.md`
- `downloads/QR_Gear_Full_Website.zip`


## Partner API foundation — October 12, 2026

Admin Partners (`/admin/partners`) now owns a usable per-partner API dialog: key generation/rotation, stable partner ID, server request instructions, and Check API setup. Partner creation, edits, detail reads and rotation share the existing `partnerStores` registry. Edits validate URLs, origins and unique slugs; clearing selected arrays persists. New keys use 256 random bits and rotation invalidates the previous key. Older weak-format keys must be regenerated before connection. Keys belong on partner servers and are excluded from public store-list/detail responses.

`GET /api/partner/verify?partnerId=ID` and `GET /api/partner/products?partnerId=ID` accept that partner's `X-API-Key`, check active status, and enforce configured origins when an Origin header is present. The stable ID or unique saved slug identifies the site; a global widget key does not authorize these routes. Responses are not cached. Products come from that partner's visible saved `admin_catalog_instances`, linked production packets, and the shared QRG options/image/text projections. Optional `channelId` must belong to the same partner. `basePrice` is the saved base retail price, not a final size/shipping/tax quote; QR Gear checkout remains authoritative. Missing production data returns an explicit error instead of fabricated product details.

The admin setup check verifies the saved key, active status and catalog projection inside QR Gear. Actual partner-server connectivity still needs a request from that server. The nonexistent widget.js embed example has been removed. Member storefront provisioning, verified partner-to-member account linking, product imports/builds and partner checkout handoffs are not implemented by this release. A partner ID is not a member or store-owner ID; the product route rejects unbound member/store requests. Existing legacy widget routes are separate and are not certified by this work.

Validation: 29 focused backend checks cover credential isolation, rotation, inactive/origin rejection, shared persistence, public redaction, canonical product projection and existing store/channel behavior. TypeScript and frontend/Functions production builds are release gates. Live partner connection and signed-in Admin acceptance are distinct checks, not established by these fixtures.

Files changed: `client/src/pages/admin-partners.tsx`; `functions/src/services/partner-api.ts`; `functions/src/services/__tests__/partner-api.test.ts`; `functions/src/routes/{admin-stores,am-sync,partner,public,core-routes}.ts`; `functions/src/index.ts`; Functions package/version lock; both READMEs; `MANIFEST.json`; source ZIP. Deployment uses the established Authorization Engine release workflow.
