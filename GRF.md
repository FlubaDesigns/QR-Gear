# GRF — Graphic Reference Format: Full Schema Reference

> **Iron Rule:** GRF codes are GLOBAL and FIXED — never renumber once assigned. Each TT+K pairing has its own atomic counter. Codes are assigned by QR Gear only.

---

## Overview

GRF is the identity system for **all graphic and design assets** in the QR Gear platform. It is completely separate from the QRG product blank identity system. Every image, canvas design, QR graphic, background, template, and video asset gets a GRF ID.

---

## ID Format

```
GRF - TT - K - H - ST - NNNNNN
      │    │   │   │    └── Sequence number (6 digits, zero-padded, 000001–999999)
      │    │   │   └─────── Presentation subtype (1–9)
      │    │   └─────────── Hosting mode (0 = Online | 1 = Local)
      │    └─────────────── Role code (1–5)
      └──────────────────── Type code (01–07)
```

**Regex:** `^GRF-(01|02|03|04|05|06|07)-([12345])-([01])-([123456789])-(\d{6})$`

**Examples:**
```
GRF-04-3-0-1-000001  →  QR Graphic · Renderable · Online · Image · sequence 1
GRF-05-4-1-6-000003  →  Canvas Design · Final · Local · Canvas · sequence 3
GRF-01-1-0-1-000012  →  Upload Source · Source · Online · Image · sequence 12
GRF-07-5-0-1-000002  →  Template Graphic · Template · Online · Image · sequence 2
```

---

## Segment 1 — Type Code (TT)

Two digits. Defines what kind of graphic asset this is.

| Code | Label | Description | Valid Roles |
|------|-------|-------------|-------------|
| 01 | upload_source | Raw uploaded source image — unmodified, as received from the user | 1 (Source) |
| 02 | cropped_derivative | Cropped or derived from a source image | 2 (Derivative) |
| 03 | background | Background image asset used in canvas compositions | 3 (Renderable) |
| 04 | qr_graphic | QR code graphic — the QR image only, no surrounding design | 3 (Renderable) |
| 05 | canvas_design | Full canvas composite — QR + text overlays + background combined | 3 (Renderable), 4 (Final) |
| 06 | url_artifact_image | URL or landing page artifact image | 3 (Renderable) |
| 07 | template_graphic | Reusable template graphic for repeated use | 5 (Template) |

**Rules:**
- Each type code has a fixed set of valid roles — assigning an invalid role throws an error
- Types 01–07 are globally fixed and cannot be reassigned

---

## Segment 2 — Role Code (K)

Single digit. Defines the lifecycle stage of the asset.

| Code | Label | Meaning |
|------|-------|---------|
| 1 | Source | Original, unmodified asset — the raw input |
| 2 | Derivative | Processed or transformed from a source |
| 3 | Renderable | Ready to display, print, or embed |
| 4 | Final | Approved and locked — no further modification |
| 5 | Template | Reusable pattern — not a one-off instance |

**Valid TT → K pairings:**
| TT | Valid K codes |
|----|--------------|
| 01 | 1 |
| 02 | 2 |
| 03 | 3 |
| 04 | 3 |
| 05 | 3, 4 |
| 06 | 3 |
| 07 | 5 |

---

## Segment 3 — Hosting Mode (H)

Single digit. Defines where the asset lives.

| Code | Label | Meaning |
|------|-------|---------|
| 0 | Online | Stored in cloud storage / CDN — has a public URL |
| 1 | Local | On-canvas or in-session only — not yet persisted to cloud |

---

## Segment 4 — Presentation Subtype (ST)

Single digit. Defines the format or presentation type of the asset. The valid range depends on the hosting mode.

### Online subtypes (H = 0) — codes 1–4

| Code | Label | Meaning |
|------|-------|---------|
| 1 | Image | Static image file (PNG, JPG, WebP, etc.) |
| 2 | Video | Video file or stream |
| 3 | Document | Document asset (PDF, etc.) |
| 4 | Audio | Audio file |

### Local subtypes (H = 1) — codes 5–9

| Code | Label | Meaning |
|------|-------|---------|
| 5 | Zone | A defined zone/region within a canvas |
| 6 | Canvas | A full canvas composition object |
| 7 | Text | A text layer or overlay |
| 8 | Graphic | A graphic element within a local canvas |
| 9 | Composite | A composite of multiple local elements |

**Rule:** Online subtypes (1–4) are only valid when H=0. Local subtypes (5–9) are only valid when H=1. Mismatched combinations throw a validation error.

---

## Segment 5 — Sequence Number (NNNNNN)

Six digits, zero-padded. A globally unique, monotonically incrementing counter per TT+K pairing.

- Range: `000001` to `999999`
- Counters are stored atomically in Firestore
- A sequence number is never reused once assigned

---

## Counter Storage

Each unique combination of Type Code + Role Code has its own Firestore counter document.

**Collection:** `grf_counters`
**Document key format:** `{TT}_{K}`

| Counter key | Tracks |
|-------------|--------|
| `01_1` | Upload sources |
| `02_2` | Cropped derivatives |
| `03_3` | Background renderables |
| `04_3` | QR graphics |
| `05_3` | Canvas design renderables |
| `05_4` | Canvas design finals |
| `06_3` | URL artifact images |
| `07_5` | Template graphics |

Counters are incremented inside a Firestore transaction — no two assets ever share the same GRF ID.

---

## Valid TT + K Pairings (Complete List)

Only these combinations are valid. Any other combination will fail validation.

| GRF prefix | Type | Role | Typical use |
|------------|------|------|-------------|
| GRF-01-1 | upload_source | Source | Raw user upload |
| GRF-02-2 | cropped_derivative | Derivative | Cropped version of an upload |
| GRF-03-3 | background | Renderable | Background for a canvas |
| GRF-04-3 | qr_graphic | Renderable | QR code image saved to library |
| GRF-05-3 | canvas_design | Renderable | Working composite design |
| GRF-05-4 | canvas_design | Final | Approved/locked composite design |
| GRF-06-3 | url_artifact_image | Renderable | Landing page snapshot |
| GRF-07-5 | template_graphic | Template | Reusable design template |

---

## Builder Integration — When GRF IDs Are Assigned

GRF IDs are assigned at the moment assets are saved to the library, not at render time.

### Save QR Graphic to library
Calls `POST /graphics/save-grf` with:
```
typeCode:    "04"
roleCode:    "3"
hostingMode: "0"
subtype:     "1"
```
→ Issues a `GRF-04-3-0-1-{NNNNNN}` ID

### Save Canvas Design to library
Calls `POST /graphics/save-grf` with:
```
typeCode:    "05"
roleCode:    "4"
hostingMode: "0"
subtype:     "1"
```
→ Issues a `GRF-05-4-0-1-{NNNNNN}` ID

### Auto-save on packet creation
When a packet is created, a graphic is also auto-saved to the library via `POST /graphics/save`. This is a legacy path — the explicit GRF save buttons in the UI are the canonical path going forward.

---

## Validation Rules

1. Type code must be one of: `01` `02` `03` `04` `05` `06` `07`
2. Role code must be one of: `1` `2` `3` `4` `5`
3. Role must be valid for the given type (see pairing table above)
4. Hosting mode must be `0` or `1`
5. Subtype must be `1–4` when hosting mode is `0` (Online)
6. Subtype must be `5–9` when hosting mode is `1` (Local)
7. Sequence must be between `000001` and `999999`
8. Full regex must match: `^GRF-(01|02|03|04|05|06|07)-([12345])-([01])-([123456789])-(\d{6})$`

---

## Relationship to QRG

GRF and QRG are two separate identity systems that work alongside each other:

| System | Identifies | Assigned by |
|--------|-----------|-------------|
| QRG (`qrg_STNNN`) | The physical blank product | QR Gear admin |
| GRF (`GRF-TT-K-H-ST-NNNNNN`) | A graphic or design asset | System (atomic counter) |

A canvas design (GRF-05) is linked to a packet via `relatedPacketId`. A packet is linked to a QRG blank via `qrgBlankId`. They form a chain — but each identity is independent.

```
qrg_11001  (blank product)
    └── packetId: abc123  (the product packet)
            ├── GRF-04-3-0-1-000001  (QR graphic)
            └── GRF-05-4-0-1-000002  (canvas design)
```

---

## Source File

All GRF types, roles, hosting modes, subtypes, regex, builder/parser functions, and counter key helpers live in:

```
shared/graphicCodes.ts
```

Functions exported:
- `isValidGraphicId(id)` — validates a full GRF ID string
- `assertValidGraphicId(id)` — throws if invalid
- `parseGraphicId(id)` — returns all parsed components
- `buildGraphicId(typeCode, roleCode, hostingMode, subtype, sequence)` — constructs a valid GRF ID
- `grfCounterKey(typeCode, roleCode)` — returns the Firestore counter doc key
- `GRF_VALID_PAIRINGS` — flat list of all valid TT + K combinations
