# ASSEMBLY — The Three-Schema Glue Layer

> **Status: IMPLEMENTED** — `assemblies` collection, CRUD routes (`functions/src/routes/assemblies.ts`), admin UI tab (`AssembliesTab.tsx`), and shared utilities (`shared/assemblyCodes.ts`) are all live.

> **Iron Rule:** Assembly is the ONLY place where QRG, BLD, and GRF are linked together. No other layer may cross-reference these three schemas simultaneously. Assembly has no pricing, no checkout, no product metadata — those live in Packet.

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
