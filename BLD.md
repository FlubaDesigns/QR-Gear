# BLD — Build Definition Schema

> **Iron Rule:** BLD is a PURE STRUCTURAL SCHEMA. It describes layer layout, slot types, and styling parameters only. It contains NO graphic asset identities, NO GRF IDs, NO QRG references, and NO packet data. Asset binding happens exclusively in Assembly.

---

## Changelog

| Date | Update |
|------|--------|
| 2026-05-05 | Hardening pass — Fix 1: shorthand/vehicle conflict resolved; Fix 2: instanceCount capped at single digit (0–9); Fix 3: Structure Boundary Rule with act/url carve-out; Fix 4: Vehicle Resolution Rule; Fix 5: Build Validation Rule |
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
BLD-[context][layoutMode][instanceCount]-[buildSeq]
```

The ID is the address. The vehicle records (instances) are the payload.
Three payload characters, one separator, three sequence digits.

---

## Position Key

```
[1]     CONTEXT
           S = Shirt graphic    (what is on the physical product)
           U = URL              (what the QR delivers when scanned)

[2]     LAYOUT MODE (if S) / CONTENT TYPE (if U)
           S context:  Z = Zone      (structured top / middle / bottom regions)
                       P = Palette   (full canvas image with QR superimposed)
           U context:  I = Image
                       V = Video
                       D = Document

[3]     INSTANCE COUNT
           Single digit (0–9). Total ordered layers in this build.
           Instance type and render order live in the instance records,
           not in the ID.
           Values above 9 are NOT supported in BLD v1.
           If more than 9 instances are required, a new BLD version
           must be defined. DO NOT extend the current format.

-       SEPARATOR (literal hyphen)

[last 3]  BUILD SEQUENCE
           001–999, atomically allocated per context+layoutMode branch.
           Shared counter between builder-generated and admin-created BLDs.
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

> **Shorthand Rule:** T, I, A, Q are DIAGRAM-ONLY references. They are NOT valid storage types, vehicle types, or code values. ONLY the following are valid vehicle types: `txt` | `img` | `qrc` | `act` | `vid` | `doc`. Any use of T, I, A, Q outside of diagrams is INVALID.

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
BLD-SZ9-001    Shirt · Zone · 9 instances · build #001
BLD-SZ3-001    Shirt · Zone · 3 instances · build #001
BLD-SZ2-001    Shirt · Zone · 2 instances (e.g. qrc + one txt) · build #001
BLD-SP4-001    Shirt · Palette · 4 instances · build #001
BLD-SP1-001    Shirt · Palette · 1 instance · build #001
BLD-UI3-001    URL · Image · 3 instances · build #001
BLD-UV2-001    URL · Video · 2 instances · build #001
BLD-UD1-001    URL · Document · 1 instance · build #001
```

---

## Full Example — QRG-11111 (T-Shirt #111)

**Product:** QRG-11111 — Apparel / T-Shirt #111
**Theme:** United States Armed Forces
**Build:** BLD-SZ9-001 — Shirt · Zone · 9 instances · build #001

> Note: This shows the BLD structure only. Actual text content and GRF asset IDs are defined in the Assembly that links this BLD to the product.

```
BLD-SZ9-001
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
A leaner build of the same product without CTA would be BLD-SZ8-002.

---

## Structure Boundary Rule

BLD defines STRUCTURE ONLY.

BLD does NOT contain:
- Text content (the actual words)
- Image content (the actual files)
- QR values or QRG identities
- QR destination URLs or scanned-URL payloads
- GRF data or GRF IDs
- Packet data

> **Carve-out:** The `url` field on the `act` vehicle type is a structural layout parameter — it defines where a CTA slot links. It is permitted in BLD. It is NOT a QR destination and NOT a scanned-URL payload.

BLD ONLY defines:
- Layout type
- Slot structure
- Instance count
- Vehicle type per slot
- Styling parameters
- Build sequencing

All content and asset binding happens later via Assembly.

---

## Vehicle Resolution Rule

Each instance defined in a BLD must resolve to EXACTLY ONE valid vehicle type:

```
txt | img | qrc | act | vid | doc
```

If a slot cannot resolve to a valid vehicle type:
- STOP BUILD
- REPORT ERROR

No fallback. No guessing. No substitution.

---

## Build Validation Rule

A BLD is INVALID if:

- instanceCount does not match actual instance definitions
- any instance lacks a valid vehicle type
- shorthand symbols (T, I, A, Q) are used outside diagrams
- content is embedded directly in BLD (text, images, QR values, GRF IDs, QRG identities)

Invalid BLDs must NOT be used in builds.

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
| `bld_definitions` | Top-level BLD records. Doc ID = full BLD code (e.g. `BLD-SZ9-001`). Core fields: bldId, context, layoutMode, instanceCount, buildSequence, createdAt. Builder-generated docs also carry: sourceSessionId, sourceInstanceId, qrgBlankId, qrgBaseCode, packetId, graphicLayoutMode, qrProductState, qrSizePercent, qrPositionX, qrPositionY. Admin-created docs also carry: layout, name, instances (array), source="admin". |
| `bld_definitions/{bldId}/instances` | **Sub-collection — builder-generated BLDs only.** One document per ordered layer instance. Doc ID = two-digit sequence (`01`, `02` … `09`). Holds the full vehicle payload for that layer. |
| `bld_counters` | Atomic sequence counters. Doc ID = context+mode key (e.g. `SZ`, `SP`, `UI`). Field: `count` (integer). Shared between builder-generated and admin-created BLDs. Guarantees unique build sequence numbers per branch. |

**Two storage strategies — both coexist in `bld_definitions`:**

| Strategy | Created by | Instance storage |
|----------|-----------|-----------------|
| Builder-generated | Builder commit flow (`POST /admin/bld`) | Sub-collection `instances/{seq}` — full vehicle payload per doc |
| Admin-created | Admin direct-create (`POST /admin/bld/create`) | Flat `instances` array embedded in the root doc — structural skeleton: `{ seq, type, role, required }` |

**Sub-collection instance structure (builder-generated):**

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

**Flat array instance structure (admin-created):**

```
{
  seq:      "01",    // two-digit render order
  type:     "txt",   // txt | img | qrc | act | vid | doc
  role:     "header",
  required: true
}
```

Render order is declared by sequence number in both strategies. `01` paints first (bottom of stack). Highest sequence paints last (top of stack).

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
  across any QRG product; the same BLD-SZ9-001 can be applied to
  QRG-11111 or QRG-12101 without modification
