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
