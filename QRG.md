# QRG Number System — Full Schema Reference

> **Iron Rule:** Printify and Printful are suppliers only — their IDs never appear in a QRG code. QR Gear assigns all QRG numbers independently. Codes are GLOBAL and FIXED — never renumber once assigned.

---

## 1. The Blank ID — `STNNN` (5 digits)

This is the **master catalog number** assigned by QR Gear to every blank product. It is the permanent, provider-independent identity for a physical blank.

```
S  T  N  N  N
│  │  └──────── 3-digit item number (001–999)
│  └─────────── Product type within category (1–9)
└────────────── Super-category (1–6)
```

### Super-categories (S)

| Code | Category |
|------|----------|
| 1 | Apparel |
| 2 | Houseware |
| 3 | Print & Display |
| 4 | Accessories |
| 5 | Pet Products |
| 6 | Holiday & Seasonal |

**Example:** `11001` = Apparel (1), Type 1, Item 001

| Representation | Value |
|----------------|-------|
| Firestore doc ID | `qrg_11001` |
| Admin display label | `QRG-11001` |
| Regex | `^[1-6][1-9][0-9]{3}$` |
| Doc ID regex | `^qrg_[1-6][1-9][0-9]{3}$` |

---

## 2. The Full QRG Code — Physical Item / Order Identity

Applied to barcodes and order tracking. Never embedded in URLs or packet names.

```
QRG - STNNN - C - NNNNNN - SSCC
      │       │   │         │└── Color code (2 digits, 01–99)
      │       │   │         └─── Size code  (2 digits, 01–10)
      │       │   └──────────── Instance / order number (6 digits, zero-padded)
      │       └──────────────── Context letter (I / M / E / O)
      └──────────────────────── Blank ID — STNNN (5 digits)
```

**Full regex:** `^QRG-([1-6][1-9][0-9]{3})-([IMEO])-(\d{6})-(\d{4})$`
**Base regex (no variant suffix):** `^QRG-([1-6][1-9][0-9]{3})-([IMEO])-(\d{6})$`

**Example:** `QRG-11101-M-000042-0501`
= Apparel blank 11101 · Member context · order #42 · Size L (05) · Black (01)

### Context letter (C) — who holds this item

| Letter | Meaning |
|--------|---------|
| I | Internal — admin / platform use |
| M | Member — registered user account |
| E | External — API / partner integration |
| O | Owner — post-purchase, end customer |

Providers (Printify / Printful) are **never** a context letter — they are suppliers only.

---

## 3. Size Codes (`SS`) — 2 digits

| Code | Size | Aliases |
|------|------|---------|
| 00 | One Size | OSFA, OS |
| 01 | XXS | Extra Extra Small, youth 4, 6 |
| 02 | XS | Extra Small, youth 8 |
| 03 | S | Small, youth 10 |
| 04 | M | Medium, youth 12 |
| 05 | L | Large, youth 14 |
| 06 | XL | Extra Large, Extra-Large, youth 16 |
| 07 | 2XL | XXL, 2X |
| 08 | 3XL | XXXL, 3X |
| 09 | 4XL | XXXXL, 4X |
| 10 | 5XL | XXXXXL, 5X |

Unknown sizes resolve to `00`.

---

## 4. Color Codes (`CC`) — 2 digits (01–99, global fixed)

| Code(s) | Color family | Key aliases |
|---------|-------------|-------------|
| 01 | Black | Black Heather, Vintage Black, Oxblood Black |
| 02 | White | Solid White Blend, Vintage White |
| 03 | Navy | Navy Blue |
| 04 | Red | |
| 05 | Royal Blue | True Royal |
| 06 | Gray / Grey | |
| 07 | Heather Gray | Athletic Heather, Sport Gray, Sport Grey |
| 08 | Charcoal | |
| 09 | Dark Heather | Asphalt |
| 10 | Dark Grey | Dark Grey Heather, Heather Slate |
| 11 | Heather Cool Grey | |
| 12 | Ash / Silver | |
| 13 | Cream / Natural | Soft Cream, Heather Natural |
| 14 | Sand | Heather Sand Dune, Pebble, Heather Dust |
| 15 | Tan / Toast | |
| 16 | Heather Navy | Heather Midnight Navy |
| 17 | Heather True Royal | |
| 18 | Sapphire | |
| 19 | Steel Blue | Ocean Blue |
| 20 | Heather Columbia Blue | Heather Carolina Blue |
| 21 | Light Blue | Baby Blue |
| 22 | Heather Ice Blue | Heather Prism Ice Blue, Heather Prism Dusty Blue |
| 23 | Blue | |
| 24 | Teal | |
| 25 | Heather Deep Teal | |
| 26 | Aqua | Heather Aqua |
| 27 | Turquoise | |
| 28 | Green | |
| 29 | Mint | Heather Mint, Heather Prism Mint |
| 30 | Sage | Leaf |
| 31 | Heather Grass Green | |
| 32 | Heather Emerald | |
| 33 | Kelly Green | Irish Green, Heather Kelly |
| 34 | Olive | Heather Olive |
| 35 | Military Green | Army |
| 36 | Forest Green | Heather Forest |
| 37 | Safety Green | |
| 38 | Yellow | Daisy |
| 39 | Gold | Mustard, Heather Yellow Gold |
| 40 | Autumn | Heather Autumn |
| 41 | Orange | Burnt Orange, Tennessee Orange, Safety Orange |
| 42 | Cardinal | |
| 43 | Maroon | |
| 44 | Burgundy | Berry |
| 45 | Heather Red | |
| 46 | Heather Raspberry | |
| 47 | Pink | Soft Pink, Charity Pink |
| 48 | Heather Clay | Heather Prism Peach |
| 49 | Heather Mauve | Mauve |
| 50 | Purple | Team Purple, Heather Team Purple, Heather Orchid |
| 51 | Lilac | Heather Prism Lilac |
| 52 | Heather Prism Dusty Lavender | |
| 53 | Brown | Heather Brown |
| 54–98 | Reserved for future colors | |
| 00 | Unknown | fallback for unmapped colors |

Aliases (e.g. "Gray" / "Grey") share the same code. Unknown colors resolve to `00`.

---

## 5. Variant Suffix (`SSCC`) — combined

The 4-character variant suffix is `SS` + `CC` concatenated.

```
buildVariantSuffix("L", "Black") → "0501"
buildVariantSuffix("M", "Navy")  → "0403"
```

Used in the full QRG code as the trailing segment. Barcode / tracking only — never in URLs.

---

## 6. Provider Blank Keys — Internal Routing Only

These IDs are used internally to route to the correct supplier. They are **never** part of a QRG code.

| Format | Meaning |
|--------|---------|
| `py_123` | Printify blueprint ID (Firestore master doc key) |
| `pf_456` | Printful product ID (Firestore master doc key) |
| `pf:456` | Printful catalog key (frontend / client-side) |
| `pending_py_123` | Unclassified Printify blank — awaiting QRG assignment |
| `pending_pf_456` | Unclassified Printful blank — awaiting QRG assignment |
| `qrg_11001` | Classified blank — canonical Firestore doc ID |

---

## 7. Graphic Reference Format (GRF) — Design Asset Identity

Separate system for all graphic and design assets. Not part of the product blank identity.

```
GRF - TT - K - H - ST - NNNNNN
      │    │   │   │    └── Sequence number (6 digits, zero-padded, 000001–999999)
      │    │   │   └─────── Presentation subtype (1–9)
      │    │   └─────────── Hosting mode (0 = Online | 1 = Local)
      │    └─────────────── Role code (1–5)
      └──────────────────── Type code (01–07)
```

**Regex:** `^GRF-(01|02|03|04|05|06|07)-([12345])-([01])-([123456789])-(\d{6})$`
**Counter storage:** Firestore `grf_counters/{typeCode}_{roleCode}` (atomic increment)

### Type codes (TT)

| Code | Label | Description | Valid Roles |
|------|-------|-------------|-------------|
| 01 | upload_source | Raw uploaded source image | 1 |
| 02 | cropped_derivative | Cropped / derived from source | 2 |
| 03 | background | Background image asset | 3 |
| 04 | qr_graphic | QR code graphic (QR-only image) | 3 |
| 05 | canvas_design | Full canvas composite design | 3, 4 |
| 06 | url_artifact_image | URL / landing page artifact image | 3 |
| 07 | template_graphic | Reusable template graphic | 5 |

### Role codes (K)

| Code | Label |
|------|-------|
| 1 | Source |
| 2 | Derivative |
| 3 | Renderable |
| 4 | Final |
| 5 | Template |

### Hosting mode (H)

| Code | Meaning |
|------|---------|
| 0 | Online |
| 1 | Local |

### Presentation subtype (ST)

| Code | Online (H=0) | Local (H=1) |
|------|-------------|------------|
| 1 | Image | — |
| 2 | Video | — |
| 3 | Document | — |
| 4 | Audio | — |
| 5 | — | Zone |
| 6 | — | Canvas |
| 7 | — | Text |
| 8 | — | Graphic |
| 9 | — | Composite |

**Examples:**
```
GRF-04-3-0-1-000001  →  QR Graphic · Renderable · Online · Image · sequence 1
GRF-05-4-1-6-000003  →  Canvas Design · Final · Local · Canvas · sequence 3
```

---

## Source Files

| File | Responsibility |
|------|---------------|
| `shared/qrgCodes.ts` | Size/color code maps, full QRG code builder/parser, blank ID validators |
| `shared/blankKeys.ts` | Provider key helpers, QRG blank number validators |
| `shared/qrgVariantMappings.ts` | Provider → QRG size/color mapping, label maps |
| `shared/providerQrgMapper.ts` | Normalizes Printify/Printful data into QRG master blank shape |
| `shared/graphicCodes.ts` | GRF identity system — types, roles, hosting, builder/parser |
