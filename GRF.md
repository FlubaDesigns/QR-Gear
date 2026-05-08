# GRF — Graphic Reference Format

The GRF system is the canonical identity and storage schema for all graphic assets in the QR Gear platform. Every asset — whether it goes on a printed shirt, appears in the store, or lives on a landing page — is issued a unique GRF ID and stored as a record in `grf_assets/{grfId}`.

> Previous schema archived at `GRF_v1_ARCHIVED.md`

---

## ID Format

```
GRF-[D1][D2][D3][D4][D5][D6]-[NNNNNN]
```

Three-character brand prefix (`GRF`), six single-digit descriptor positions, and a 6-digit zero-padded global sequence number.

**Example:** `GRF-212421-000001`
→ Output artifact · Image · Store · Glamor Shot · JPEG · First to show · Sequence 1

---

## Digit Key

### D1 — Asset Class

The most fundamental classification — is this a build input or a build output?

| Value | Name | Description |
|---|---|---|
| `1` | Input build | Input to the build process — source uploads, backgrounds, templates, cropped derivatives |
| `2` | Output artifact | Output of the build — QR composites, glamor shots, URL graphics |

---

### D2 — Media Type

| Value | Type |
|---|---|
| `1` | Image |
| `2` | Video |
| `3` | Document |

---

### D3 — Channel

Where this asset lives and is served from.

| Value | Channel | Description |
|---|---|---|
| `1` | Print | Goes to the physical product (sent to print provider) |
| `2` | Store | Displayed in the customer-facing storefront |
| `3` | URL | Lives on a landing page / online digital artifact |

---

### D4 — Purpose

What the asset *is* — its functional role in the build chain.

| Value | Name | Asset class | Description |
|---|---|---|---|
| `1` | QR Composite | Output | QR code merged with zone/palette graphic or text — goes on the front of the item |
| `2` | QR Standalone | Output | QR code with QRG logo centered on a white box |
| `3` | URL Graphic | Output | Image created for the online landing page / digital artifact |
| `4` | Glamor Shot | Output | Lifestyle/mockup render — shirt with design applied, store-facing |
| `5` | Source Upload | Input | Raw asset uploaded by user before any processing |
| `6` | Background | Input | Background image used during composition in the builder |
| `7` | Template | Input | Reusable graphic element applied across multiple products |

---

### D5 — Format *(conditional on D2)*

Valid values depend on the media type in D2.

**If D2 = `1` (Image):**

| Value | Format |
|---|---|
| `1` | PNG |
| `2` | JPEG |
| `3` | WebP |
| `4` | SVG |

**If D2 = `2` (Video):**

| Value | Format |
|---|---|
| `1` | MP4 |
| `2` | WebM |

**If D2 = `3` (Document):**

| Value | Format |
|---|---|
| `1` | PDF |

---

### D6 — Sub-context *(conditional on D3)*

Meaning depends on the channel in D3.

**If D3 = `1` (Print) — Location on item:**

| Value | Location |
|---|---|
| `1` | Front |
| `2` | Back |
| `3` | Sleeve |

**If D3 = `2` (Store) — Display index:**

| Value | Position |
|---|---|
| `1` | First image shown |
| `2` | Second image shown |
| `3` | Third image shown |
| `4` | Fourth image shown |
| `5` | Fifth image shown |

**If D3 = `3` (URL) — File location:**

| Value | Location |
|---|---|
| `1` | Internal file (Firebase Storage) |
| `2` | External URL (e.g. YouTube, Vimeo) |

---

### Sequence — NNNNNN

Six-digit zero-padded global sequence number. Minted atomically from `grf_counters/global`. Never reused once assigned.

---

## Examples

| GRF ID | Reads as |
|---|---|
| `GRF-211111-000001` | Output · Image · Print · QR Composite · PNG · Front |
| `GRF-211211-000001` | Output · Image · Print · QR Standalone · PNG · Front |
| `GRF-212421-000001` | Output · Image · Store · Glamor Shot · JPEG · First shown |
| `GRF-213311-000001` | Output · Image · URL · URL Graphic · WebP · Internal file |
| `GRF-111611-000001` | Input · Image · Print · Background · PNG · Front |
| `GRF-111511-000001` | Input · Image · Print · Source Upload · PNG · Front |
| `GRF-111711-000001` | Input · Image · Print · Template · PNG · Front |

---

## Storage Path Convention

```
grf/{grfId}/{filename}
```

| Purpose (D4) | Filename |
|---|---|
| `1` QR Composite | `composite.png` |
| `2` QR Standalone | `qr-standalone.png` |
| `3` URL Graphic | `url-graphic.{ext}` |
| `4` Glamor Shot | `glamor.{ext}` |
| `5` Source Upload | `source.{ext}` |
| `6` Background | `background.{ext}` |
| `7` Template | `template.{ext}` |

**Example:** `grf/GRF-212421-000001/glamor.jpg`

---

## Firestore Record — `grf_assets/{grfId}`

```json
{
  "grfId":          "GRF-212421-000001",
  "assetClass":     "2",
  "mediaType":      "1",
  "channel":        "2",
  "purpose":        "4",
  "format":         "2",
  "subContext":     "1",
  "sequence":       1,
  "assetClassName": "output_artifact",
  "mediaTypeName":  "image",
  "channelName":    "store",
  "purposeName":    "glamor_shot",
  "formatName":     "jpeg",
  "subContextName": "first",
  "mimeType":       "image/jpeg",
  "storagePath":    "grf/GRF-212421-000001/glamor.jpg",
  "publicUrl":      "https://...",
  "packetId":       "abc123",
  "sourceSessionId":"session456",
  "isActive":       true,
  "createdAt":      "..."
}
```

---

## Counter

Single global counter: `grf_counters/global { count: N }`

Atomically incremented in a Firestore transaction for every new GRF ID. Never decremented or reset.

---

## Rules

1. **Assembly mappings must use grfId — never raw URLs.**
2. **Never reuse or renumber a GRF ID.** Permanent once minted.
3. **Format must be compatible with media type.**
4. **Sub-context is always set** — never zero or null.
5. **Input build assets (D1=`1`) are never exposed in store display or URL artifact chains.**
6. **Hard fail on invalid ID** — stop, throw, do not save, do not continue.

---

## API Endpoints

**Save a GRF asset:**
```
POST /api/admin/graphics/save-grf
{ assetClass, mediaType, channel, purpose, format, subContext, imageUrl, name, mimeType, packetId }
```

**Get GRF assets (filtered):**
```
GET /api/admin/graphics?channel=2&purpose=4
```

**Archive a GRF asset:**
```
PATCH /api/admin/graphics/:grfId/archive
```

---

## Relationship to Assembly

```
Packet → assemblyId
Assembly → { qrgId, bldId, mappings: [{ grfId, ... }] }
GRF asset → { publicUrl, storagePath, ... }
```

The store reads images by walking: `packet → assembly → grfIds → publicUrls`. Raw URLs are never stored on packets or assemblies.

---

## Source File

`shared/graphicCodes.ts`

Key exports: `buildGrfId`, `parseGrfId`, `isValidGrfId`, `grfStoragePath`, `grfMimeType`, `GRF_COUNTER_KEY`
