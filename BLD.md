# BLD — Build Definition Schema

> **Iron Rule:** BLD is a PURE STRUCTURAL SCHEMA. It describes layer layout, slot types, and styling parameters only. It contains NO graphic asset identities, NO GRF IDs, NO QRG references, and NO packet data. Asset binding happens exclusively in Assembly.

---

## Changelog

| Date | Update |
|------|--------|
| 2026-05-05 | Architecture clarification — BLD holds structure only, Assembly links BLD to GRF and QRG |
| 2026-05-05 | Initial BLD schema defined — two-context tree (S/U), full vehicle set (txt/img/qrc/act/vid/doc) |

---

## What BLD Answers

- **QRG** answers: What product blank is this?
- **GRF** answers: What file is this asset?
- **BLD** answers: How is this composition structured?
- **Assembly** answers: What assets fill which slots in what structure?
- **Packet** answers: What is the full published product offer?

---

## ID Structure

```
BLD - [1] [2] [3] [4] [5–6] ... [001–999]
```

Each position narrows the tree one level. The ID is the address.
The vehicle record is the payload. Two clean, separate concerns.

---

## Position Key

```
[1]  CONTEXT
       S = Shirt graphic    (what is on the physical product)
       U = URL              (what the QR delivers when scanned)

─────────────────────────────────────────────────────────────

If S:

[2]  LAYOUT MODE
       Z = Zone             (structured regions — top, middle, bottom)
       P = Palette          (full canvas image with QR superimposed)

[3]  ENGINE TYPE
       T = Text instance
       I = Image instance
       Q = QR instance
       A = Action (CTA)     — optional, pick it in or leave it out

[4]  INSTANCE COUNT         (if T)
       1–9

[5–6] INSTANCE SEQUENCE     (if T, two digits per instance)
       01 → 09

─────────────────────────────────────────────────────────────

If U:

[2]  CONTENT TYPE
       I = Image
       V = Video
       D = Document

[3]  ENGINE TYPE
       T = Text overlay instances (optional)

[4]  INSTANCE COUNT         (if T)
       1–9

[5–6] INSTANCE SEQUENCE     (if T, two digits per instance)
       01 → 09

─────────────────────────────────────────────────────────────

[last 3]  BUILD SEQUENCE
       001 → 999
```

---

## Zone Mode — Three Engines

Zone divides the shirt canvas into fixed regions:

```
┌─────────────────┐
│   TOP ZONE      │  → txt | img
├─────────────────┤
│   MIDDLE ZONE   │  → QR (centered, size-controlled)
├─────────────────┤
│  SUB-BOTTOM     │  → txt (strip below QR)
├─────────────────┤
│   BOTTOM ZONE   │  → txt | img
└─────────────────┘
```

Three engines — not more, not less:

| Engine | Type | Notes |
|--------|------|-------|
| Zone | T or I | Same editor, two instances: top and bottom. Same levers, different position. |
| Action | A | Optional. Call to action with embedded URL. Pick it in or leave it out. |
| QR | Q | Always present. Centered in Zone mode. Size-controlled. |

---

## Palette Mode

Full shirt canvas image with QR superimposed at a preset small
(always-readable) size. The image is dominant. The QR is a guest.

```
S + P + I  → full canvas image (background)
S + P + Q  → QR floating over image (position required)
S + P + T  → optional text overlays
S + P + A  → optional action (CTA)
```

---

## Instance Vehicles

### TYPE: txt

```
role          — "header" | "bottom" | "est" | "motto" | "meaning" | "role" | "footer"
fontFamily    — e.g. "Oswald"
fontSize      — px (e.g. 28)
fontWeight    — e.g. 700
letterSpacing — px (e.g. 4)
strokeWidth   — px (e.g. 4)
strokeColor   — hex (e.g. "#FFFFFF")
positionLR    — % left/right (e.g. 5)
positionUD    — % up/down (e.g. 90)
```

> Note: `strokeColor` and other styling defaults live in BLD.
> Actual text content (the words) and per-instance color overrides are set in the Assembly mapping.

### TYPE: img

```
role          — e.g. "top_graphic"
size          — % (implicit 100% if Palette)
positionLR    — %
positionUD    — %

Context rules:
  S + Z + I  → zone-contained (top or bottom zone)
  S + P + I  → full canvas background
```

> The actual GRF asset file (which image) is assigned in Assembly, not here.

### TYPE: qrc

```
S + Z + Q  (Zone QR — centered, locked):
  size        — % (larger, dominant element)
  positionLR  — implicit center, not required
  positionUD  — implicit center, not required

S + P + Q  (Palette QR — floating):
  size        — % (preset small, always readable)
  positionLR  — % REQUIRED
  positionUD  — % REQUIRED
```

> The actual QR code file (GRF-04) is assigned in Assembly.

### TYPE: act (Action / CTA)

```
fontFamily    — e.g. "Oswald"
fontSize      — px
fontWeight    — e.g. 800
letterSpacing — px
strokeWidth   — px
strokeColor   — hex
url           — destination URL
positionLR    — %
positionUD    — %

Note: Optional in every build. No role field needed — type IS the purpose.
```

### TYPE: vid (URL Video)

```
playback      — "file" | "external"
                  file     = served from storage
                  external = YouTube / Vimeo / stream URL
source        — file path (if file) | URL (if external)
type          — "clip" | "loop" | "stream"
ratio         — "16:9" | "9:16" | "1:1" | "4:3"
size          — % of canvas
length        — seconds (max duration)
sequence      — two digits (01–09)
```

### TYPE: doc (URL Document)

```
playback      — "file" | "external"
                  file     = served from storage
                  external = linked URL (Google Doc, Dropbox, etc.)
source        — file path (if file) | URL (if external)
format        — "pdf" | "docx" | "pptx"
pages         — number (e.g. 4)
layout        — "portrait" | "landscape"
fontSize      — base font size px (e.g. 12)
sequence      — two digits (01–09)
```

---

## Decoded Examples

```
BLD-SZ9001    Shirt · Zone · 9 instances · build #001
BLD-SZI001    Shirt · Zone · Image (zone-contained) · build #001
BLD-SPI001    Shirt · Palette · Image (full canvas) · build #001
BLD-SZQ001    Shirt · Zone · QR (centered, locked) · build #001
BLD-SPQ001    Shirt · Palette · QR (floating, position required) · build #001
BLD-UI301-001  URL · Image · 3 text overlays · build #001
BLD-UV201-001  URL · Video · 2 instances · build #001
BLD-UD001     URL · Document · build #001
```

---

## Full Example — QRG-11111 (T-Shirt #111)

**Product:** QRG-11111 — Apparel / T-Shirt #111
**Theme:** United States Armed Forces
**Build:** BLD-SZ9001 — Shirt · Zone · 9 instances · build #001

> Note: This shows the BLD structure only. Actual text content and GRF asset IDs are defined in the Assembly that links this BLD to the product.

```
BLD-SZ9001
─────────────────────────────────────────────────────────────
01  txt   role:          header
          fontFamily:    Oswald
          fontSize:      28

02  img   role:          top_graphic
          size:          25%
          positionLR:    30%
          positionUD:    100%

03  qrc   size:          35%
          positionLR:    center (default)
          positionUD:    center (default)

04  txt   role:          bottom
          fontSize:      20
          fontWeight:    800
          letterSpacing: 4
          positionLR:    50%
          positionUD:    10%

05  act   fontFamily:    Oswald
          fontSize:      29
          fontWeight:    800
          letterSpacing: 4
          strokeWidth:   0
          strokeColor:   #FFFFFF
          url:           [destination]

06  txt   role:          est
          fontFamily:    Oswald
          fontSize:      24
          fontWeight:    600
          strokeWidth:   4
          positionLR:    5%
          positionUD:    90%

07  txt   role:          motto
          fontFamily:    Oswald
          fontSize:      30
          fontWeight:    700
          strokeWidth:   4
          positionLR:    5%
          positionUD:    50%

08  txt   role:          meaning
          fontFamily:    Oswald
          fontSize:      19
          fontWeight:    500
          letterSpacing: 4
          positionLR:    5%
          positionUD:    32%

09  txt   role:          role
          fontFamily:    Oswald
          fontSize:      18
          fontWeight:    700
          strokeWidth:   4
          positionLR:    5%
          positionUD:    55%
─────────────────────────────────────────────────────────────
```

**Render order:** Layer 01 paints first (bottom of stack).
Layer 09 paints last (top of stack).

**Instance 05 (act)** is optional — this build includes it.
A leaner build of the same product without CTA would be BLD-SZ8002.

---

## What BLD Does NOT Hold

| Concept | Belongs in |
|---------|-----------|
| Graphic file identities (GRF IDs) | Assembly mappings |
| Product blank identity (QRG IDs) | Assembly |
| Text content (actual words) | Assembly mappings |
| Text color instance overrides | Assembly mappings |
| Packet pricing or product data | Packet |
| Which builds are used in which product | Assembly |

---

## Relationship to the Full Chain

```
Packet  (top-level published offer — pricing, QR content, checkout)
  └── assemblyId → Assembly
                     ├── qrgId → QRG  (product blank)
                     ├── bldId → BLD  ← BLD lives here (structure + layout + styling schema)
                     │             └── bld_definitions/{bldId}/instances/{seq}
                     └── mappings[]
                           ├── seq:  "03"
                           ├── type: "qrc"
                           └── grfId → GRF  (actual asset file)
```

BLD defines the shape. Assembly fills it with actual assets.

---

## Firestore Collections and Sub-Collections

| Collection | Purpose |
|------------|---------|
| `bld_definitions` | Top-level BLD records. Doc ID = full BLD code (e.g. `BLD-SZ9001`). Holds header fields: context, layoutMode, engineType, instanceCount, buildSequence, createdAt. |
| `bld_definitions/{bldId}/instances` | **Sub-collection.** One document per ordered layer instance. Doc ID = two-digit sequence (`01`, `02` … `09`). Holds the full vehicle payload for that layer. |
| `bld_counters` | Atomic sequence counters. Doc ID = context+mode key (e.g. `SZ`, `SP`, `UI`). Field: `count` (integer). Guarantees unique build sequence numbers per branch. |

**Sub-collection document structure (`instances/{seq}`):**

```
{
  seq:          "01",       // two-digit render order — 01 paints first
  type:         "txt",      // txt | img | qrc | act | vid | doc
  role:         "header",   // vehicle-specific fields follow...
  fontFamily:   "Oswald",
  fontSize:     28,
  ...
}
```

Render order is declared by sequence number. `01` paints first (bottom of stack). Highest sequence paints last (top of stack).

---

## Key Properties

- **ID is the address** — the path through the decision tree tells
  you mode, engine type, and instance count before opening any record
- **Vehicle is the payload** — all properties live in the typed
  instance record, not in the ID
- **Render order is declared** — the two-digit sequence number IS
  the paint order; 01 renders first, 09 renders last
- **Action is always optional** — every build may include or omit A
- **QR in Zone = centered + locked** — positionLR/UD not required
- **QR in Palette = floating** — positionLR/UD always required
- **Design is not product identity** — BLD records are reusable
  across any QRG product; the same BLD-SZ9001 can be applied to
  QRG-11111 or QRG-12101 without modification
