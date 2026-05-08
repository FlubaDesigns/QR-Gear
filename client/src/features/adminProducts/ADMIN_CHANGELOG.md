# QR Gear — Admin Changelog

> Historical record of admin changes. Current operating law is in `ADMIN_README.md`.

---

### May 6, 2026 — Fix: Remove qrgBlankId from BLD draft (autosave purity)

`buildBldDraft()` in `BuilderContext.tsx` was embedding `qrgBlankId` inside the BLD draft payload sent with every autosave — a violation of BLD's Iron Rule (BLD is pure structure, no QRG references). Removed. BLD draft now contains only `{ layoutMode, instanceCount, layers[] }`. Blank identity is already persisted separately at `working.metadata.selectedProductDocId`. Commit reads `qrgBlankId` from `master_catalog` via `session.sourceMasterId` — server never touched `bldDraft.qrgBlankId`.

#### Files Changed
| File | Change |
|------|--------|
| `client/src/features/adminProducts/builder/BuilderContext.tsx` | Removed `qrgBlankId` from `buildBldDraft()` return value |

---

### May 5, 2026 — Fix: Catalog image bug + compact card thumbnail slider restored

`catalogToSelectItem` now combines `printifyImages` + `printfulImages` (matching blanks page logic). Compact card thumbnail slider restored with prev/next navigation, squared-off thumbnail strip, and per-image delete button.

#### Files Changed
| File | Change |
|------|--------|
| `client/src/features/adminProducts/builder/modules/ProductSelectCardSkin.tsx` | Restored compact slider with prev/next navigation and per-image delete |

---

### May 5, 2026 — Fix: Auto-shelf grouping by qrgCategory

Catalog mode now auto-groups by `qrgCategory` field instead of manual `admin_build_shelf` Firestore assignments.

---

### May 5, 2026 — Fix: Catalog blankKey resolver duplicate-blank clobber bug

`selectItemMap` now prefers `p.docId` directly when it is in `activeCatalog.blankIds` (O(1) set check via `activeCatalogBlankIdSet`), preventing two QRG blanks sharing a provider blueprint ID from clobbering each other's overrides.

#### Files Changed
| File | Change |
|------|--------|
| `client/src/features/adminProducts/builder/modules/ProductsModule.tsx` | Fixed catalogKeyMap + selectItemMap to use docId-first lookup |

---

### May 5, 2026 — QRG Identity Enforcement on Catalog Writes (rev 35)

Enforced `qrg_STNNN` as the sole canonical key for all catalog blank identity. Provider IDs (`py_`, `pf_`, `pf:`, plain numeric) are now accepted as input but resolved to canonical keys before any Firestore write.

**Backend (`server/routes/admin-catalogs-shelf.routes.ts`):**
- Added `resolveCatalogBlankId()` — single resolution path accepting any provider key, returning canonical `qrg_STNNN` or null (pending), throwing on unresolvable IDs
- `POST /catalogs/:id/blanks` — resolves each input blankId before persisting; pending IDs skipped
- `DELETE /catalogs/:id/blanks` — cleans all nine overlay maps; removes both raw and resolved keys for backward compat
- `POST /catalogs/:id/bulk-copy` — resolves each blankId before persisting
- `PUT /catalogs/:id/blank-tier`, `blank-description`, `blank-title`, `blank-images` — all resolve blankId to canonical key before writing overlay maps
- `POST /catalogs/:id/duplicate` — copies all nine overlay maps (was: only five)
- `POST /catalogs` (create) — initializes all nine overlay maps to `{}` (was: only five)

**Frontend (`useAdminBlanksController.ts`):**
- `onAddToCatalog` — sends `product.docId` (qrg_STNNN) when available instead of provider key fallback
- Fixed `data.count` → `data.total` in toast message

**Tests (`shared/__tests__/blankKeys.test.ts`):**
- Added `getCanonicalBlankKey` cases proving `docId=qrg_STNNN` takes priority
- Added `isQRGBlankId` suite: valid STNNN cases return true; legacy 4-digit, 3-digit, provider keys return false
- Added `isValidQRGBlankNumber` and `isPendingBlankId` suites

---

### May 5, 2026 — Three-Schema Integrity Audit + Control System Audit (rev 34)

Full end-to-end audit of QRG → BLD → GRF → Assembly → Packet chain, plus audit of all control system documents. 18 code findings fixed, 6 documentation findings corrected.

**Code fixes (functions/src/):**
- QRG blank ID validation consolidated into shared `isValidQrgBlankId()` utility
- Legacy `qrgPacketCode` fallback now logs `[LEGACY_FIELD]` warning
- Assembly POST validates `qrgId` format before writing
- BLD create blocks U-context + Z/P layout cross-contamination
- BLD POST enforces required `qrgBlankId`
- BLD DELETE cascades to sub-collection instances; blocks deletion if Assembly references BLD
- GRF existence + active status validated before Assembly writes
- GRF type/slot compatibility enforced (qrc → type 04, img → type 02/03/05)
- BLD slot cross-validation added to Assembly POST
- Assembly ID format validated on all reads/writes
- GRF counter collision protection via Firestore transaction
- `master_catalog` write now enforces `qrg_STNNN` doc ID format
- `admin-build-sessions` commit reads `qrgBlankId` from master catalog (not working state)
- Added `[BLD]`, `[GRF]`, `[ASM]` log prefixes on all schema operations

**Documentation fixes:**
- `BLD.md` hardening pass (5 fixes): shorthand/vehicle conflict, instanceCount cap, Structure Boundary Rule, Vehicle Resolution Rule, Build Validation Rule
- `GRF.md` hardening pass (4 fixes): hard failure enforcement, MIME validation rule, TT/K pair enforcement, GRF Responsibility Boundary section
- `ASSEMBLY.md` hardening pass (10 fixes): Mapping Enforcement Rules (8 rules), Pre-Build Validation Phase (7 checks), Assembly Responsibility Boundary

---

### May 4, 2026 — Fix: Catalog image and selection fixes

Fixed catalog images not loading, selection state not persisting across catalog tab changes.

---

### May 3, 2026 — Feature: QRG BBB Master Blank Catalog Architecture

Full rebuild of the master blank catalog to use QRG BBB numbering as the master identity layer.

1. **QRG BBB sequential numbering** — Each blank type gets a permanent `qrg_NNN` Firestore doc ID. Numbers auto-assign at sync time in sequential order per category. Unclassified products fall back to `pending_py_*` or `pending_pf_*`.
2. **Provider bridge** — When both Printify and Printful carry the same brand+model blank, merged into one `qrg_NNN` record via `providerMappings[]`.
3. **Separate images per provider** — `printifyImages[]` and `printfulImages[]` plus combined `images[]`.
4. **QRG categories on API** — `GET /api/master-catalog` groups by QRG categories (Tees 101–199, Hoodies 201–299, Hats 301–399, Drinkware 401–499).
5. **Provider badge on blank cards** — Printify (orange), Printful (sky blue), Both (violet).
6. **QRG category filter labels** — "Tees (101–199)", "Hoodies (201–299)" etc.
7. **Backward compat** — `fulfillmentProvider` field retained. `expandBlankIdSet()` passes `qrg_*` and `pending_*` IDs through.

#### Files Changed
| File | Change |
|------|--------|
| `functions/src/services/master-catalog.ts` | Full QRG sync engine with sequential BBB numbering |
| `functions/src/routes/pp-catalog-browse.ts` | `/master-catalog` endpoint with QRG categories |
| `shared/blankKeys.ts` | Added `isQRGBlankId()`, `isPendingBlankId()`, `getQRGBlankNumber()` |
| `client/src/features/adminProducts/controllers/useAdminBlanksController.ts` | Rewritten with `isAvailableVia()`, `allProductMap` indexed by `docId` |
| `client/src/pages/admin-blanks.tsx` | Provider badge + QRG range labels |

---

### April 20, 2026 — Fix: Pre-packet builder resume restores all saved work

**Root cause:** `POST /api/admin/build-sessions/from-master` returned `isExisting: true` with full `working` session but the client only called `setActiveSession()` — never `loadFromWorkingState()`. Fix: call `loadFromWorkingState(data.session.working, entry.catalog)` after `from-master` returns existing session. "Draft resumed" toast confirms the restore.

#### Files Changed
| File | Change |
|------|--------|
| `client/src/features/adminProducts/builder/modules/ProductsModule.tsx` | Added `loadFromWorkingState` call after from-master returns existing session |

---

### April 19, 2026 — Fix: Pre-existing TypeScript errors cleared

1. `TextStyleConfig` missing `fontWeight` — added `fontWeight?: string`
2. `admin-blanks.tsx` — `showCreate` out of scope — lifted to `AdminBlanks`, passed as props
3. `admin-catalogs-shelf.routes.ts` — `function classifyCategory` in block — converted to const arrow
4. `qr-templates.routes.ts` — `number | null | undefined` vs `number` — added `?? 39` fallback

#### Files Changed
| File | Change |
|------|--------|
| `client/src/features/adminProducts/builder/types.ts` | Added `fontWeight?: string` |
| `client/src/pages/admin-blanks.tsx` | Lifted `showCreate` state |
| `server/routes/admin-catalogs-shelf.routes.ts` | Converted `classifyCategory` to const |
| `server/routes/misc/qr-templates.routes.ts` | Added `?? 39` fallback |

---

### April 19, 2026 — Feature: Save and restore store, channel, collection, catalog selection

Autosave working snapshot now includes full store, channel, collection, and catalog filter selections. On resume, all four are restored in dependency order (store → channel → collection → catalog).

#### Files Changed
| File | Change |
|------|--------|
| `client/src/features/adminProducts/builder/types.ts` | Added `selectedCatalogId: string` to `BuilderState` |
| `client/src/features/adminProducts/builder/BuilderContext.tsx` | Added `BuilderSnapshotContext`, updated snapshot/restore, `setSelectedCatalogId` |
| `client/src/features/adminProducts/builder/modules/ProductsModule.tsx` | Reads `selectedCatalogId` from context instead of local state |

---

### April 19, 2026 — Fix: Save product docId in working snapshot

Working snapshot was saving `selectedProductId` (numeric Printify blueprint ID). Replaced with `selectedProductDocId` (Firestore doc ID string). Resume handler uses `selectedProductDocId` as second fallback after `sourceMasterId`.

#### Files Changed
| File | Change |
|------|--------|
| `client/src/features/adminProducts/builder/BuilderContext.tsx` | Replaced `selectedProductId` with `selectedProductDocId` in snapshot metadata |
| `client/src/features/adminProducts/builder/modules/DraftResumeHandler.tsx` | Added `snapshotDocId` as second fallback in MODE 2 |

---

### April 19, 2026 — Rewrite: Prepacket Resume / Pre-saved Project Restore

Complete redesign of `DraftResumeHandler.tsx`. Two clean restore modes:

**MODE 1 — Packet-backed restore** (packet exists): Product via `packetData.blueprintId` + provider match. Calls `loadFromPacketData`.
**MODE 2 — Prepacket working-state restore** (no packet): Product via `sourceMasterId → p.docId`. Calls `loadFromWorkingState`.

#### Files Changed
| File | Change |
|------|--------|
| `client/src/features/adminProducts/builder/modules/DraftResumeHandler.tsx` | Full rewrite — two modes, `resolveByDocId`/`resolveByBlueprintId`, detailed logging |
| `client/src/features/adminProducts/builder/BuilderContext.tsx` | `buildWorkingSnapshot` metadata now includes `templateProductHint` |

---

### April 19, 2026 — Fix: Product resolution on draft resume + delete on Run panel

- Catalog fetch was hitting dead endpoint. Fixed: both components call `/api/master-catalog` directly.
- Matcher was comparing `sourceMasterId` (string) against `p.id` (numeric). Fixed: tries `p.docId === sourceMasterId` first.
- Run panel: each draft card now has a trash icon with inline "Delete? / Yes / No" confirm.

#### Files Changed
| File | Change |
|------|--------|
| `client/src/features/adminProducts/builder/modules/DraftResumeHandler.tsx` | Catalog fetch + ID matcher fix |
| `client/src/features/adminProducts/builder/modules/LoadTemplateModule.tsx` | Catalog fetch fix |
| `client/src/features/adminProducts/builder/BuilderContext.tsx` | Snapshot saves `selectedProductBlueprintId` |
| `client/src/pages/admin-run.tsx` | Trash icon + inline confirm on draft cards |

---

### April 19, 2026 — Fix: Double /admin/ URL bug

`apiBase` is already `/api/admin` — any path `${apiBase}/admin/...` → `/api/admin/admin/...` = 404. Fixed all 7 affected fetch calls across 4 files.

#### Files Changed
| File | Change |
|------|--------|
| `client/src/features/adminProducts/builder/BuilderContext.tsx` | Fixed autosave PATCH + packet sync PATCH |
| `client/src/features/adminProducts/builder/modules/DraftResumeHandler.tsx` | Fixed session GET + packet GET |
| `client/src/features/adminProducts/builder/modules/BuilderStickyBar.tsx` | Fixed draft name PATCH |
| `client/src/features/adminProducts/builder/modules/useCreatePacket.ts` | Fixed generate-artifact POST + commit POST |

---

### April 19, 2026 — Build Sessions: Index-Free Query + Autosave Failure Indicator + Resume Hardening

1. `GET /admin/build-sessions` no longer requires Firestore composite indexes — single `ownerAdminId` equality filter, in-code sort/filter/slice.
2. Autosave failure is visible in sticky bar — `autoSaveFailed: true` → red "Save failed" badge.
3. `DraftResumeHandler` explicit about empty/broken drafts — destructive toast + early return instead of silent blank.

#### Files Changed
| File | Change |
|------|--------|
| `server/routes/admin-build-sessions.routes.ts` | Removed `orderBy`; in-code filter + sort |
| `functions/src/routes/admin-build-sessions.ts` | Same refactor |
| `client/src/features/adminProducts/builder/BuilderContext.tsx` | Added `autoSaveFailed` state |
| `client/src/features/adminProducts/builder/modules/BuilderStickyBar.tsx` | "Save failed" badge |
| `client/src/features/adminProducts/builder/modules/DraftResumeHandler.tsx` | Early return with toast |

---

### April 19, 2026 — Admin Cockpit Polish: 10-Item Fix Pass

Run page wrapped in AdminShell with live metrics grid. `AdminBottomNav` simplified. Categories and Tags added to BUILD_SUBNAV. `AdminShell` gained `hideBack` prop. `AdminSectionSubNav` made sticky. admin-fonts.tsx and admin-pricing.tsx refactored to standard Card components.

---

### April 19, 2026 — Admin Cockpit Consistency: Mode Labels + Universal Section Sub-Nav

Every admin page shows mode label eyebrow (BUILD / PLACE / SELL / SYSTEM) auto-detected from URL via `getModeForPath()`. All secondary pages render horizontal section sub-nav from central `adminNavConfig.ts`. Hub pages also consume central config. `/admin/run` and `/admin/dashboard` are aliases for `/admin`.

---

### April 19, 2026 — Draft Save/Resume + Admin Cockpit Reorganization (RUN/BUILD/PLACE/SELL/SYSTEM)

Admin panel restructured into five named sections. `/admin` routes to Run dashboard. Draft save/resume system introduced. Section sub-navs added to hub pages.

#### Files Changed
| File | Change |
|------|--------|
| `server/routes/admin-build-sessions.routes.ts` | PATCH accepts top-level `draftName` |
| `server/routes/packets.routes.ts` | New `GET /api/admin/packets/:packetId` endpoint |
| `client/src/features/adminProducts/builder/modules/BuilderStickyBar.tsx` | Save Draft button |
| `client/src/features/adminProducts/builder/modules/DraftResumeHandler.tsx` | New component |
| `client/src/features/adminProducts/builder/BuilderHarness.tsx` | Mounts DraftResumeHandler |
| `client/src/pages/admin-run.tsx` | New Run dashboard |

---

### April 19, 2026 — Store Page Graphic Fix + Admin UX: Delete from Store + Template Save/Load Chain

Store page was showing transparent PNG overlay. Fixed: all three store product fetch paths now enrich `imageUrl` using priority: `mockupUrl → priorityMockupUrl → landingPageSnapshotUrl → productGraphicUrl → compositeUrl → qrOnlyUrl`.
