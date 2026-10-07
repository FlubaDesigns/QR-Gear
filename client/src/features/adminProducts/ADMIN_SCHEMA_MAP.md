# QR Gear — Admin Schema Map

> Pure system authority for the QRG / BLD / GRF / Assembly chain as it applies to this codebase.
> No UI discussion. No route discussion. Schema definitions and rules only.
> Canonical authority lives in the root files: `BLD.md`, `GRF.md`, `QRG.md`, `ASSEMBLY.md`. Those always win.

---

## The Chain

```
QRG      → what the blank product IS (identity)
BLD      → how the build is structured (layout only)
GRF      → what the asset file IS (file identity)
ASSEMBLY → joins QRG + BLD + GRF (the only place they connect)
PACKET   → the sellable offer (references Assembly)
INSTANCE → a committed product placed in a store/channel
```

Each layer answers exactly one question. No layer answers another layer's question.

---

## QRG — Identity Layer

**Question answered:** What blank product is this?

**Format:** `qrg_STNNN` (Firestore doc ID) | `QRG-STNNN` (display)

| Segment | Meaning | Example |
|---------|---------|---------|
| S | Super-category (1–6) | 1 = Apparel |
| T | Type within category (1–9) | 1 = T-Shirt |
| NNN | Item number (001–999) | 001 |

**Valid:** `qrg_11001` (5-digit STNNN)
**Invalid:** `qrg_1101` (4-digit), `qrg_101` (3-digit), `py_12`, `pf_456`

**Firestore collection:** `master_catalog`
**Doc ID:** `qrg_STNNN`

**Key fields on a master_catalog doc:**

| Field | Type | Purpose |
|-------|------|---------|
| `qrgBlankId` | string | The STNNN number (e.g. `"11001"`) |
| `qrgCategory` | string | Tees / Hoodies / Hats / Drinkware / Unclassified |
| `categorySource` | string | `"qrg"` or `"pending"` |
| `availableVia` | string[] | `["Printify"]`, `["Printful"]`, or both |
| `providerMappings` | array | `[{ provider, blueprintId, title, printProviderId }]` |
| `canonicalTitle` / `brand` / `model` | string | Display identity |
| `printifyImages[]` / `printfulImages[]` / `images[]` | string[] | Per-provider + combined images |

**Rules:**
- QRG is NEVER generated client-side
- QRG is NEVER a fake, fallback, or placeholder value
- Provider IDs (`py_`, `pf_`) are lookup references only — never persisted as identity
- `resolveCatalogBlankId()` in `server/routes/admin-catalogs-shelf.routes.ts` is the single entry point from any provider key → `qrg_STNNN`

**Shared code:** `shared/blankKeys.ts`, `shared/qrgCodes.ts`

---

## BLD — Build/Layout Layer

**Question answered:** How is this build structured?

**Format:** `BLD-[context][layoutMode][instanceCount]-[buildSeq]`

| Position | Values | Meaning |
|----------|--------|---------|
| context | S / U | S = Shirt graphic, U = URL surface |
| layoutMode | Z / P (if S) or I / V / D (if U) | Zone, Palette, Image, Video, Document |
| instanceCount | 0–9 | Total ordered layers |
| buildSeq | 001–999 | Atomically allocated per context+mode branch |

**Example:** `BLD-SZ9-001` = Shirt · Zone · 9 layers · build #001

**Firestore collections:**
- `bld_definitions` — top-level BLD records. Doc ID = full BLD code
- Each root BLD record holds one flat `instances[]` array. No instance sub-collections.
- `bld_counters` — atomic sequence counters. Doc ID = context+mode key (e.g. `SZ`, `SP`)

**Valid vehicle types (the only valid values):**
`txt` | `img` | `qrc` | `act` | `vid` | `doc`

**BLD contains ONLY:**
- Layout type (Zone / Palette)
- Slot structure and instance count
- Vehicle type per slot
- Styling parameters (font, size, weight, stroke, position)
- Build sequencing

**BLD must NEVER contain:**
- `qrgBlankId` or any QRG reference
- `qrgBaseCode` or any QRG code
- GRF IDs or asset file references
- Text content (the actual words)
- Image content (the actual files)
- Packet data

**BLD metadata:** `bldId`, `context`, `layoutMode`, `instanceCount`, `buildSequence`, `instances`, `name`, `source`, `isActive`, and timestamps. Session, product, packet, and GRF links are outside BLD.

**Autosave draft:** `working.bldDraft` is derived by `shared/builderSnapshot.ts` using the shared layer extractor. It contains `context`, the canonical layout code, `instanceCount`, and `instances[]`. It is a projection, not a second source of structure.

**Runtime authority:** `shared/bldCodes.ts`, `functions/src/services/bld-store.ts`, and `functions/src/services/admin-composition-routes.ts`. Production and development register the same implementation.

---

## GRF — Graphic/Asset Layer

**Question answered:** What file is this asset?

**Format:** `GRF-[assetClass][mediaType][channel][purpose][format]-[sequence]`

The five code digits are asset class, media type, channel, purpose, and format. Their labels and permitted combinations come from `shared/graphicCodes.ts`; `shared/GRF_engine.ts` supplies the Library registration rules. There is no TT/K identity model.

**Storage:** `grf_assets/{grfId}` holds the canonical file record. `grf_counters/global` allocates the six-digit sequence. The record stores the parsed code components, MIME type, storage path, public URL, registration state, and archive state.

**Build roles:** `GRF_PACKET_SLOTS` defines registration parameters for backgrounds, standalone QR files, print composites, URL snapshots, and store mockups. Assembly refers to these assets by `grfId`; it never stores an alternative file identity.

**Shared code:** `shared/graphicCodes.ts`, `shared/GRF_engine.ts`, and `functions/src/services/grf-store.ts`. `inspectGrfAsset()` checks stored classification and MIME against the encoded ID for display, registration and Assembly validation. `admin-grf-routes.ts` supplies both HTTP adapters. `build-deletion.ts` supplies reviewed dependency deletion and shared-file protection; `DeleteBuildDialog` is the common confirmation.

---

## Assembly — The Join Layer

**Question answered:** What assets fill which slots in what structure, for which product blank?

**Format:** `ASM-NNNNNN` (6-digit, atomically allocated)

**Firestore collection:** `assemblies/{assemblyId}`

**Core fields:**

| Field | Type | Purpose |
|-------|------|---------|
| `assemblyId` | string | Doc ID = ASM code |
| `qrgId` | string | QRG blank number (e.g. `"11101"`) |
| `bldId` | string | BLD definition (e.g. `"BLD-SZ9-001"`) |
| `mappings` | array | Slot assignments |
| `packetIds` | string[] | Reverse reference — which packets use this |

**Mapping entry — asset slot (img, qrc):**
```ts
{ seq: "01", type: "img", grfId: "GRF-11431-000007" }
```

**Mapping entry — text slot (txt, act):**
```ts
{ seq: "02", type: "txt", value: "UNITED STATES ARMED FORCES", color: "#FFFFFF" }
```

**GRF compatibility:** `validateAssemblyMappings()` reads canonical GRF identities. A QR slot requires `GRF_PACKET_SLOTS.qrStandalone`; an image slot cannot substitute for it. See `shared/graphicCodes.ts` and `shared/assemblyCodes.ts`.

**Assembly rules:**
- Every Assembly must have exactly one valid `qrgId` — no Assembly without QRG anchor
- `qrgId` must resolve to a real, active `master_catalog` record
- `qrgId`, `bldId`, and `mappings` are immutable while the Assembly is used by packets or saved builds
- Each required slot must be mapped; optional slots may be omitted
- Each required BLD slot → exactly one mapping (no missing, no duplicates)
- Vehicle types must match BLD slot definitions
- Slot order must match BLD sequence exactly
- No fallback assets, no auto-generated content, no conditional logic
- Assembly contains no pricing, no product options, no checkout data

**Assembly is the ONLY layer** where QRG, BLD, and GRF are joined. No other layer may cross-reference all three simultaneously.

**Shared code:** `shared/assemblyCodes.ts`
Functions: `isValidAssemblyId()`, `parseAssemblyId()`, `validateAssemblyMappings()`, `ASM_COUNTER_KEY`

**Source files:** `functions/src/routes/assemblies.ts` (prod)
**Admin UI:** `client/src/features/adminLibrary/tabs/AssembliesTab.tsx`

---

## Pre-Build Validation (Required Before Commit)

Before any build is executed, all of the following must pass:

1. BLD exists and is valid
2. Every mapping matches a BLD slot and each required slot is filled
3. All required slots are assigned
4. All GRF references resolve to valid, active `grf_assets` records
5. All vehicle types match BLD slot expectations
6. Slot order matches BLD sequence exactly
7. QRG identity is valid and resolves to an active `master_catalog` record

Any failure → STOP. THROW ERROR. DO NOT BUILD.

---

## Commit Flow (Server Side)

**Route:** `POST /api/admin/build-sessions/:sessionId/commit` in `functions/src/routes/admin-build-sessions.ts`

1. Reads `qrgBlankId` from `master_catalog` via `session.sourceMasterId` (NOT from working state or BLD draft)
2. Validates `qrgBlankId` against STNNN regex
3. Allocates QRG instance via `allocateQrgInstance()`
4. Writes BLD record to `bld_definitions`
5. Writes GRF record to `grf_assets`
6. Writes Assembly record to `assemblies`
7. Writes Packet
8. Writes Instance to `admin_catalog_instances`

---

## Violation Examples (What Must Never Happen)

```ts
// VIOLATION — qrgBlankId inside BLD draft
buildBldDraft() {
  return { qrgBlankId: state.selectedProduct.qrgBlankId, ... }
}

// VIOLATION — provider ID stored in catalog
catalog.blankIds['py_12'] = true

// VIOLATION — GRF stores layout info
grf_asset.zonePosition = 'top'

// VIOLATION — Assembly created without QRG
{ bldId: 'BLD-SZ9-001', mappings: [...] }  // missing qrgId

// VIOLATION — fake QRG generated client-side
const qrgId = `QRG-${Math.random()}`
```

### Library-to-Products lifecycle

- `buildLifecycle.ts` defines the supported deletion targets. `build-deletion.ts` and `DeleteBuildDialog` are shared by Library graphics, generated packets and catalog items. They preview connected records, recheck the confirmed plan, remove the complete affected build, retain shared assets, and track any remaining file cleanup.
- `build-destination.ts` resolves store/channel/collection identity and display fields. `catalog-instance-update.ts` applies folder moves to the catalog item, packet snapshot, saved build and storefront link in one transaction. The printed QR payload and artwork remain unchanged by a folder move.
- `saveBuildInstance()` validates the generated schema chain and atomically links the catalog item, packet and saved build. Schema IDs come from their existing allocators; new Firestore documents use the SDK's no-argument auto-ID call.
- Unused catalog-to-packet creation endpoints have been removed. The builder's saved snapshot is the creation source. The shared instance resolver supplies catalog overrides in both server adapters.
