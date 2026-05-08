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
- `bld_definitions/{bldId}/instances` — sub-collection (builder-generated only). One doc per layer. Doc ID = two-digit sequence (`01`–`09`)
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

**Builder-generated BLD docs also carry** (informational fields set at commit, not in draft):
`sourceSessionId`, `sourceInstanceId`, `qrgBlankId` (from master), `qrgBaseCode`, `packetId`, `graphicLayoutMode`, `qrProductState`, `qrSizePercent`, `qrPositionX`, `qrPositionY`

**Autosave BLD draft format** (`working.bldDraft` in `admin_build_sessions`):
```ts
{
  layoutMode:    string,   // "zone" | "palette"
  instanceCount: number,
  layers:        Layer[]   // vehicle payload per slot
}
```
No QRG fields. No GRF fields. Layout only.

**Source files:** `functions/src/routes/bld.ts` (prod), `server/routes/` (dev mirror)

---

## GRF — Graphic/Asset Layer

**Question answered:** What file is this asset?

**Format:** `GRF-TT-K-NNNNNN`

| Segment | Meaning | Example |
|---------|---------|---------|
| TT | Type code (01–07) | 04 = QR graphic |
| K | Role code (1–5) | 3 = Renderable |
| NNNNNN | Sequence (000001–999999) | 000001 |

**Valid TT → K pairings:**

| TT | Label | Valid K |
|----|-------|---------|
| 01 | upload_source | 1 |
| 02 | cropped_derivative | 2 |
| 03 | background | 3 |
| 04 | qr_graphic | 3 |
| 05 | canvas_design | 3, 4 |
| 06 | url_artifact_asset | 3 |
| 07 | template_graphic | 5 |

Any undefined TT/K pairing → hard error, reject, do not save.

**Firestore collections:**
- `grf_assets/{grfId}` — asset file records
- `grf_counters` — atomic sequence counters. Doc ID = `{TT}_{K}`

**Key fields on a grf_assets doc:**

| Field | Type | Purpose |
|-------|------|---------|
| `grfId` | string | Document ID = the GRF code |
| `typeCode` | string | TT value |
| `roleCode` | string | K value |
| `typeName` | string | Human label from GRF_TYPE_MAP |
| `mimeType` | string | Must be compatible with typeCode |
| `storagePath` | string | GCS path |
| `publicUrl` | string | Accessible URL |
| `isActive` | boolean | false = archived |

**GRF contains ONLY:** File identity. Nothing else.

**GRF must NEVER contain:**
- Layout data (that is BLD)
- Context or placement (that is BLD)
- Mapping logic (that is Assembly)
- QRG identity (that is QRG)

**Shared code:** `shared/graphicCodes.ts`
Functions: `isValidGraphicId()`, `assertValidGraphicId()`, `parseGraphicId()`, `buildGraphicId()`, `grfCounterKey()`, `GRF_VALID_PAIRINGS`

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
{ seq: "01", type: "img", grfId: "GRF-03-3-000007" }
```

**Mapping entry — text slot (txt, act):**
```ts
{ seq: "02", type: "txt", value: "UNITED STATES ARMED FORCES", color: "#FFFFFF" }
```

**GRF type compatibility per BLD vehicle:**

| BLD vehicle | Compatible GRF TT |
|-------------|-------------------|
| `img` (background) | 03 |
| `img` (overlay) | 02, 05 |
| `qrc` | 04 |

**Assembly rules:**
- Every Assembly must have exactly one valid `qrgId` — no Assembly without QRG anchor
- `qrgId` must resolve to a real, active `master_catalog` record
- `qrgId` and `bldId` are immutable once the Assembly has linked Packets
- Slot count must match required BLD slot count exactly
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
2. Assembly slot count matches required BLD slot count
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
