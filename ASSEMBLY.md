# ASSEMBLY — The Three-Schema Glue Layer

> **Status: IMPLEMENTED** — `assemblies` collection, CRUD routes (`functions/src/routes/assemblies.ts`), admin UI tab (`AssembliesTab.tsx`), and shared utilities (`shared/assemblyCodes.ts`) are all live.

> **Iron Rule:** Assembly is the ONLY place where QRG, BLD, and GRF are linked together. No other layer may cross-reference these three schemas simultaneously. Assembly has no pricing, no checkout, no product metadata — those live in Packet.

---

## Changelog

| Date | Update |
|------|--------|
| 2026-05-05 | Hardening pass — Mapping Enforcement Rules section added: slot count (required only), 1:1 assignment (required only), vehicle type matching, slot order, complete required mapping (required only, optional slots exempt), no fallback/auto-generation, no conditional logic, QRG anchor requirement; Pre-Build Validation Phase checklist (7 checks); Assembly Responsibility Boundary section added |

---

## Overview

Assembly is the internal binding record that links a product blank (QRG) to a build structure (BLD) and maps each build slot to an actual graphic asset (GRF). It is the glue. Nothing more.

Assembly answers one question: **What assets fill which slots in what structure, for which product blank?**

```
Assembly
  ├── qrgId   → QRG  (which product blank)
  ├── bldId   → BLD  (which layout/structure)
  └── mappings[]
        ├── { seq, type, grfId }   — asset slot
        └── { seq, type, value }   — text slot
```

---

## Position in the Chain

```
Packet  (top-level published offer)
  └── assemblyId ──→ Assembly  ← this document
                        ├── qrgId ──→ QRG  (blank identity: product type, super-category, item number)
                        ├── bldId ──→ BLD  (structure: slots, vehicles, layer order, styling schema)
                        └── mappings[]
                              └── grfId ──→ GRF  (asset file: image, QR graphic, canvas composite)
                                              └── grf_assets/{grfId}  (file metadata)
```

**Packet** is the published offer — pricing, product options, QR content, checkout.
**Assembly** is the internal record — pure linking, no user-facing data.

---

## When Assembly Is Created

An Assembly is created when a build session resolves into a committed set of assets. The Assembly is written first, then the Packet references it.

1. Admin or member selects a product blank → **qrgId** is resolved
2. A BLD layout is chosen or generated → **bldId** is resolved
3. Each BLD slot is filled with an asset or text value → **mappings[]** is populated
4. Assembly document is written to Firestore
5. Packet is created or updated with the resulting **assemblyId**

---

## Firestore Schema

**Collection:** `assemblies/{assemblyId}`

```typescript
{
  assemblyId:  "ASM-000001",
  qrgId:       "11101",               // QRG blank number — master_catalog doc key
  bldId:       "BLD-SZ9-001",          // BLD definition — bld_definitions doc key
  name:        "Armed Forces Tee — Zone Build",   // optional, human label
  mappings: [
    {
      seq:   "01",                    // matches bld_definitions slot sequence
      type:  "img",                   // matches BLD slot vehicle type
      grfId: "GRF-03-3-000007"       // background image asset
    },
    {
      seq:   "02",
      type:  "txt",
      value: "UNITED STATES ARMED FORCES",   // text content lives here, NOT in BLD
      color: "#FFFFFF"                // per-instance color override (optional)
    },
    {
      seq:   "03",
      type:  "qrc",
      grfId: "GRF-04-3-000001"       // QR code graphic asset
    },
    {
      seq:   "04",
      type:  "txt",
      value: "Honor. Duty. Country.",
      color: "#FFFFFF"
    },
    {
      seq:   "05",
      type:  "txt",
      value: "EST. 1776",
      color: "#FFD700"
    }
  ],
  createdAt:   timestamp,
  createdBy:   "admin",
  packetIds:   ["pkt_abc123"]         // reverse reference — which packets use this assembly
}
```

---

## Mapping Rules

### Asset slots (`img`, `qrc`)

```typescript
{
  seq:   "01",          // must match a slot seq in the referenced BLD
  type:  "img",         // must match the vehicle type defined for that slot in BLD
  grfId: "GRF-03-3-000007"  // must be a valid GRF ID — format: GRF-TT-K-NNNNNN
}
```

- `grfId` is required for `img` and `qrc` slots
- `value` is not present in asset slots
- The GRF type code must be compatible with the slot vehicle:

| BLD vehicle | Compatible GRF type codes |
|-------------|--------------------------|
| `img` (background) | `03` (Background) |
| `img` (foreground/overlay) | `02` (Cropped Derivative), `05` (Canvas Design) |
| `qrc` | `04` (QR Graphic) |
| `vid` | *(GRF asset or external URL — external URL stored as `value`)* |
| `doc` | *(GRF asset or external URL — external URL stored as `value`)* |

### Text slots (`txt`, `act`)

```typescript
{
  seq:   "02",
  type:  "txt",
  value: "UNITED STATES ARMED FORCES",   // the actual text string
  color: "#FFFFFF"                        // optional — overrides BLD default
}
```

- `value` is required for `txt` and `act` slots
- `grfId` is not present in text slots
- `color` is optional — if omitted, the BLD styling default applies

### Optional slots

If a BLD defines a slot as optional (e.g. `act` / CTA), the mapping entry may be omitted entirely. The slot is simply not rendered.

---

## Mapping Enforcement Rules

### Slot Count (Fix 1)

Assembly mapping count must equal the count of **required** BLD slots.

- Fewer required slot mappings than BLD defines → INVALID
- More mappings than BLD slots → INVALID
- Optional slots (e.g. `act`) may be omitted — their absence is not an error

Mismatch on required slots:
- STOP BUILD
- THROW ERROR

### 1:1 Slot Assignment (Fix 2)

Each **required** BLD slot index must resolve to exactly one Assembly mapping.

- No missing required slots
- No duplicate assignments for the same slot
- No multi-mapping per slot
- Optional slots may be absent — this is not a violation

Violation:
- THROW ERROR
- REJECT ASSEMBLY

### Vehicle Type Matching (Fix 3)

Each Assembly slot must match the vehicle type defined for that slot in BLD.

If BLD slot defines `img` → Assembly must supply a GRF asset with a compatible typeCode.
If BLD slot defines `qrc` → Assembly must supply a GRF asset with typeCode `04`.
If BLD slot defines `txt` or `act` → Assembly must supply a `value` string, not a GRF ID.

Mismatch:
- THROW ERROR
- REJECT BUILD

### Slot Order (Fix 4)

Assembly mappings are order-dependent.

- Slot sequence must match BLD slot sequence exactly
- Reordering is not allowed
- Slot index is authoritative — sequence numbers are not suggestions

Any deviation:
- THROW ERROR

### Complete Required Mapping (Fix 5)

An Assembly is invalid if any **required** slot is unassigned.

Not allowed in required slots:
- null values
- placeholder GRF IDs
- temporary assets
- fallback content

Optional slots may be legitimately absent. Required slots may not.

Missing required slot:
- STOP BUILD
- THROW ERROR

### No Fallback / No Auto-Generation (Fix 6)

Assembly does not support:
- fallback assets
- auto-generated content
- default substitutions

All mappings must be explicit and valid. If data is missing:
- FAIL
- DO NOT RECOVER

### No Conditional Logic (Fix 7)

Assembly contains no conditional logic.

Forbidden:
- if/else behavior
- device-based decisions
- dynamic substitutions
- runtime transformations

Assembly is static mapping only.

### QRG Anchor Requirement (Fix 8)

Every Assembly must be anchored to exactly one valid QRG identity.

- No Assembly without a valid `qrgId`
- One Assembly → one QRG
- `qrgId` must resolve to a real, active record in `master_catalog`

Invalid or missing QRG:
- REJECT ASSEMBLY

---

## Assembly ID Format

```
ASM - NNNNNN
       └── 6-digit zero-padded sequence (000001–999999)
```

Minted atomically from Firestore counter `asm_counters/global`.

**Regex:** `^ASM-\d{6}$`

**Example:** `ASM-000001`

---

## What Assembly Does NOT Hold

| Concept | Belongs in |
|---------|-----------|
| Pricing (base cost, markup, customer price) | Packet |
| Product options (colors, sizes, placements) | Packet |
| Landing page content (title, description, background) | Packet |
| QR destination URL | Packet |
| Checkout / Stripe data | Packet |
| Store / channel / collection assignment | Packet |
| Mockup image URLs | Packet |
| Hosting term | Packet |
| GRF file metadata (dimensions, mime type, storage path) | `grf_assets/{grfId}` |
| BLD vehicle styling defaults (font, size, weight) | `bld_definitions/{bldId}/instances/{seq}` |
| Product blank metadata (brand, model, provider) | `master_catalog/{qrg_STNNN}` |

---

## Reusability

Assembly records are reusable:
- The same Assembly can be referenced by multiple Packets (e.g. different price tiers of the same product)
- The same BLD can be used in multiple Assemblies (same layout, different assets)
- The same GRF asset can appear in multiple Assembly mappings (same image, different products)

A Packet always references a specific Assembly by `assemblyId`. The Assembly is the canonical "what was built" record. The Packet is the canonical "what is being sold" record.

---

## Full Example

**Scenario:** An Armed Forces T-Shirt product offered at two price points (standard and premium). Both use the same design (same Assembly). They differ only in price, store assignment, and description — so they have two Packets but one Assembly.

### The Assembly

```
assemblyId: "ASM-000001"
qrgId:      "11101"           → QRG blank: Apparel / T-Shirt #101
bldId:      "BLD-SZ9-001"     → Structure: Zone, 9 slots
mappings:
  01 · img   · GRF-03-3-000007   (background: flag image)
  02 · txt   · "UNITED STATES ARMED FORCES"   color: #FFFFFF
  03 · qrc   · GRF-04-3-000001   (QR code graphic)
  04 · txt   · "Honor. Duty. Country."         color: #FFFFFF
  05 · act   · "Visit QRGear.com"             color: #FFFFFF
  06 · txt   · "EST. 1776"                    color: #FFD700
  07 · txt   · "Non Sibi Sed Patriae"         color: #FFFFFF
  08 · txt   · "Not for self, but for country" color: #CCCCCC
  09 · txt   · "Apparel Line"                 color: #FFFFFF
```

### Packet A (Standard)

```
packetId:    "pkt_abc123"
assemblyId:  "ASM-000001"     ← points to the assembly above
customerPrice: 34.99
store: "qr-gear"
channel: "usa250"
status: "published"
```

### Packet B (Premium — different store, higher price)

```
packetId:    "pkt_xyz789"
assemblyId:  "ASM-000001"     ← same assembly
customerPrice: 44.99
store: "partner-store-01"
channel: "veterans"
status: "published"
```

---

## Pre-Build Validation Phase (Fix 9)

Before any build execution, all of the following must pass:

1. BLD exists and is valid
2. Assembly slot count matches required BLD slot count
3. All required slots are assigned
4. All GRF references resolve to valid, active `grf_assets` records
5. All vehicle types match BLD slot expectations
6. Slot order matches BLD sequence exactly
7. QRG identity is valid and resolves to an active `master_catalog` record

If any check fails:
- STOP
- THROW ERROR
- DO NOT BUILD

---

## Assembly Responsibility Boundary (Fix 10)

Assembly maps slots to assets. Nothing more.

Assembly must NOT:
- Define layout — that is BLD responsibility
- Define file identity — that is GRF responsibility
- Define product or blank identity — that is QRG responsibility
- Define rendering behavior
- Contain conditional logic
- Contain pricing, product options, or checkout data — those are Packet responsibility

Assembly ONLY maps BLD slots → GRF assets under a QRG identity.

Any attempt to extend Assembly beyond mapping is invalid.

---

## API

**Create an Assembly:**
```
POST /api/admin/assemblies
{
  qrgId:    "11101",
  bldId:    "BLD-SZ9-001",
  name:     "Armed Forces Tee — Zone Build",
  mappings: [...]
}
```

**Get an Assembly:**
```
GET /api/admin/assemblies/:assemblyId
```

**List Assemblies for a QRG blank:**
```
GET /api/admin/assemblies?qrgId=11101
```

**Update an Assembly (name and/or mappings):**
```
PATCH /api/admin/assemblies/:assemblyId
{
  name:     "Updated label",   ← optional
  mappings: [...]              ← optional — replaces full mappings array
}
```
- `qrgId` and `bldId` are **immutable** once the Assembly has linked Packets (`packetIds` non-empty). Attempting to change them returns `409`.
- To change structure, create a new Assembly and update the Packet to point to it.

**Delete an Assembly:**
```
DELETE /api/admin/assemblies/:assemblyId
```
- Returns `409` if the Assembly has any linked Packets (`packetIds` non-empty). Unlink all Packets first.
- On success, clears `assemblyId` from all linked Packet documents atomically before deleting the Assembly record.

---

## Source File

```
shared/assemblyCodes.ts
```

Functions exported:
- `isValidAssemblyId(id)` — validates an ASM ID string
- `parseAssemblyId(id)` — returns sequence number
- `validateAssemblyMappings(mappings, bldSlots)` — validates mapping completeness against BLD
- `ASM_COUNTER_KEY` — Firestore counter document key for atomic ID minting
