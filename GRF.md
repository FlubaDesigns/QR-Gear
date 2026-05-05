# GRF — Graphic Reference Format: Full Schema Reference

> **Iron Rule:** GRF is a PURE ASSET IDENTITY SYSTEM. It identifies files only. It does not describe layout, context, placement, sequence, or usage. Codes are GLOBAL and FIXED — never renumber once assigned.

---

## Overview

GRF is the identity system for all graphic and design asset files in the QR Gear platform. It is completely separate from QRG (product identity), BLD (build structure), and Assembly (the glue layer). Every image, QR graphic, canvas composite, background, and template file gets a GRF ID at the moment it is saved to the library.

GRF answers one question only: **What file is this?**

Everything else — layout, context, placement, content type, usage — belongs in BLD or Assembly.

---

## ID Format

```
GRF - TT - K - NNNNNN
      │    │   └── Sequence number (6 digits, zero-padded, 000001–999999)
      │    └─────── Role code (1–5)
      └──────────── Type code (01–07)
```

**Regex:** `^GRF-(01|02|03|04|05|06|07)-([12345])-(\d{6})$`

**Examples:**
```
GRF-04-3-000001  →  QR Graphic · Renderable · sequence 1
GRF-05-4-000003  →  Canvas Design · Final · sequence 3
GRF-01-1-000012  →  Upload Source · Source · sequence 12
GRF-07-5-000002  →  Template Graphic · Template · sequence 2
GRF-03-3-000007  →  Background · Renderable · sequence 7
```

---

## Segment 1 — Type Code (TT)

Two digits. Defines what kind of asset file this is.

| Code | Label | Description | Valid Roles |
|------|-------|-------------|-------------|
| 01 | upload_source | Raw uploaded source image — unmodified, as received | 1 |
| 02 | cropped_derivative | Cropped or derived from a source image | 2 |
| 03 | background | Background image used in canvas compositions | 3 |
| 04 | qr_graphic | QR code image file only — no surrounding design | 3 |
| 05 | canvas_design | Full canvas composite — QR + overlays + background rendered together | 3, 4 |
| 06 | url_artifact_asset | Landing page or URL artifact image file | 3 |
| 07 | template_graphic | Reusable template file | 5 |

**Rules:**
- Each type has a fixed set of valid roles — invalid combinations throw an error
- Types 01–07 are globally fixed and cannot be reassigned

---

## Segment 2 — Role Code (K)

Single digit. Defines the production lifecycle stage of the asset.

| Code | Label | Meaning |
|------|-------|---------|
| 1 | Source | Original, unmodified — the raw input file |
| 2 | Derivative | Processed or transformed from a source |
| 3 | Renderable | Ready to display, embed, or print |
| 4 | Final | Approved and locked — no further modification |
| 5 | Template | Reusable pattern — not a one-off instance |

### Valid TT → K pairings

| TT | Valid K | Typical use |
|----|---------|-------------|
| 01 | 1 | Raw user upload |
| 02 | 2 | Cropped version of an upload |
| 03 | 3 | Background for canvas |
| 04 | 3 | QR code file |
| 05 | 3, 4 | Canvas composite (working or approved) |
| 06 | 3 | Landing page snapshot |
| 07 | 5 | Reusable design template |

---

## Segment 3 — Sequence Number (NNNNNN)

Six digits, zero-padded. A globally unique, atomically incrementing counter per TT+K pairing.

- Range: `000001` to `999999`
- Stored and incremented atomically in Firestore
- Never reused once assigned

---

## Counter Storage

**Collection:** `grf_counters`
**Document key:** `{TT}_{K}`

| Counter key | Tracks |
|-------------|--------|
| `01_1` | Upload sources |
| `02_2` | Cropped derivatives |
| `03_3` | Background renderables |
| `04_3` | QR graphics |
| `05_3` | Canvas design renderables |
| `05_4` | Canvas design finals |
| `06_3` | URL artifact assets |
| `07_5` | Template graphics |

---

## Asset Database Record

All additional data about an asset is stored in Firestore, not in the ID.

**Collection:** `grf_assets/{grfId}`

```
{
  grfId:       "GRF-04-3-000001",
  typeCode:    "04",
  roleCode:    "3",
  fileName:    "qr-graphic-abc123.png",
  mimeType:    "image/png",
  storagePath: "graphics/qr/qr-graphic-abc123.png",
  publicUrl:   "https://...",
  width:       1200,
  height:      1200,
  hash:        "sha256:...",
  sourceGrfId: null,
  createdAt:   timestamp,
  createdBy:   "admin"
}
```

**What does NOT go in the database record:**
- Layout or zone information
- Context (shirt vs URL)
- Content type (image/video/document)
- Placement or sequence
- BLD or Assembly references (those link from Assembly → GRF, not the reverse)

---

## What GRF Is NOT

GRF does not and must never describe:

| Concept | Belongs in |
|---------|-----------|
| Layout mode (zone / freeform) | BLD |
| Context (shirt graphic vs URL surface) | BLD |
| Content type (image / video / document) | BLD |
| Placement on product | BLD |
| Instance sequence in a build | BLD |
| Which packet used this asset | Assembly |
| Which QRG blank this supports | Assembly |

---

## Relationship to the Full Chain

```
QRG  (product blank identity)
  └── Assembly
        ├── qrgId   → QRG
        ├── bldId   → BLD  (layout + structure)
        └── mappings
              └── grfId → GRF  (asset file identity)  ← GRF lives here
                              └── grf_assets/{grfId}  (file metadata)

Packet  (top-level published offer)
  └── assemblyId → Assembly
```

GRF is the leaf node. It identifies the file. Everything above it provides context.

---

## API

**Save a GRF asset to the library:**
```
POST /api/admin/graphics/save-grf
{
  typeCode: "04",
  roleCode: "3",
  imageUrl: "https://...",
  name: "Navy QR Graphic",
  relatedPacketId: "abc123"    ← optional, for cross-reference only
}
```

Response:
```
{
  success: true,
  grfId: "GRF-04-3-000042"
}
```

---

## Source File

All GRF types, roles, regex, builder/parser, and counter key helpers:

```
shared/graphicCodes.ts
```

Functions exported:
- `isValidGraphicId(id)` — validates a GRF ID string
- `assertValidGraphicId(id)` — throws if invalid
- `parseGraphicId(id)` — returns all parsed components
- `buildGraphicId(typeCode, roleCode, sequence)` — constructs a valid GRF ID
- `grfCounterKey(typeCode, roleCode)` — returns the Firestore counter doc key
- `GRF_VALID_PAIRINGS` — flat list of all valid TT + K combinations
