# GRF — Graphic Reference Format

The GRF system is the canonical identity and storage schema for all graphic assets in the QR Gear platform. Every asset — whether it goes on a printed shirt, appears in the store, or lives on a landing page — is issued a unique GRF ID and stored as a record in `grf_assets/{grfId}`.

> Previous schema archived at `GRF_v1_ARCHIVED.md`

---

## ID Format

```
[D1][D2][D3][D4][D5]-[NNNNNN]
```

Five single-digit descriptor positions followed by a hyphen and a 6-digit zero-padded global sequence number.

**Example:** `12421-000003`
→ Image · Store · Glamor Shot · JPEG · First to show · Sequence 3

---

## Digit Key

### D1 — Media Type

| Value | Type |
|---|---|
| `1` | Image |
| `2` | Video |
| `3` | Document |

---

### D2 — Channel

Where this asset lives and is served from.

| Value | Channel | Description |
|---|---|---|
| `1` | Print | Goes to the physical product (sent to print provider) |
| `2` | Store | Displayed in the customer-facing storefront |
| `3` | URL | Lives on a landing page / online digital artifact |

---

### D3 — Purpose

What the asset *is* — its functional role in the build chain.

| Value | Name | Description |
|---|---|---|
| `1` | QR Composite | QR code merged with zone/palette graphic or text — what goes on the front of the item |
| `2` | QR Standalone | The QR code with QRG logo centered on a white box |
| `3` | URL Graphic | Image created for the online landing page / digital artifact |
| `4` | Glamor Shot | Lifestyle/mockup render — shirt with design applied, store-facing presentation |
| `5` | Source Upload | Raw asset uploaded by user before any processing |
| `6` | Background | Background image used during composition in the builder |
| `7` | Template | Reusable graphic element applied across multiple products |

---

### D4 — Format *(conditional on D1)*

Valid format values depend on the media type in D1.

**If D1 = `1` (Image):**

| Value | Format |
|---|---|
| `1` | PNG |
| `2` | JPEG |
| `3` | WebP |
| `4` | SVG |

**If D1 = `2` (Video):**

| Value | Format |
|---|---|
| `1` | MP4 |
| `2` | WebM |

**If D1 = `3` (Document):**

| Value | Format |
|---|---|
| `1` | PDF |

---

### D5 — Sub-context *(conditional on D2)*

Meaning depends on the channel in D2.

**If D2 = `1` (Print) — Location on item:**

| Value | Location |
|---|---|
| `1` | Front |
| `2` | Back |
| `3` | Sleeve |

**If D2 = `2` (Store) — Display index:**

| Value | Position |
|---|---|
| `1` | First image shown |
| `2` | Second image shown |
| `3` | Third image shown |
| `4` | Fourth image shown |
| `5` | Fifth image shown |

**If D2 = `3` (URL) — File location:**

| Value | Location |
|---|---|
| `1` | Internal file (Firebase Storage) |
| `2` | External URL (e.g. YouTube, Vimeo) |

---

### Sequence — NNNNNN

Six-digit zero-padded global sequence number. Minted atomically from `grf_counters/global` in Firestore. Codes are **global and fixed** — never renumber once assigned.

---

## Examples

| GRF ID | Reads as |
|---|---|
| `11111-000001` | Image · Print · QR Composite · PNG · Front · #1 |
| `11211-000001` | Image · Print · QR Standalone · PNG · Front · #1 |
| `12421-000001` | Image · Store · Glamor Shot · JPEG · First shown · #1 |
| `12422-000002` | Image · Store · Glamor Shot · JPEG · Second shown · #2 |
| `13311-000001` | Image · URL · URL Graphic · WebP · Internal file · #1 |
| `13312-000001` | Image · URL · URL Graphic · WebP · External URL · #1 |
| `12111-000005` | Image · Store · QR Composite · PNG · First shown · #5 |

---

## Storage Path Convention

Assets are stored in Firebase Storage at:

```
grf/{grfId}/{filename}
```

The filename uses a human-readable slug based on purpose:

| Purpose (D3) | Filename |
|---|---|
| `1` QR Composite | `composite.png` |
| `2` QR Standalone | `qr-standalone.png` |
| `3` URL Graphic | `url-graphic.{ext}` |
| `4` Glamor Shot | `glamor.{ext}` |
| `5` Source Upload | `source.{ext}` |
| `6` Background | `background.{ext}` |
| `7` Template | `template.{ext}` |

**Example:** `grf/12421-000001/glamor.jpg`

---

## Firestore Record — `grf_assets/{grfId}`

```json
{
  "grfId":          "12421-000001",
  "mediaType":      "1",
  "channel":        "2",
  "purpose":        "4",
  "format":         "2",
  "subContext":     "1",
  "sequence":       1,
  "mediaTypeName":  "image",
  "channelName":    "store",
  "purposeName":    "glamor_shot",
  "formatName":     "jpeg",
  "subContextName": "first",
  "mimeType":       "image/jpeg",
  "storagePath":    "grf/12421-000001/glamor.jpg",
  "publicUrl":      "https://...",
  "packetId":       "abc123",
  "sourceSessionId":"session456",
  "isActive":       true,
  "createdAt":      "..."
}
```

---

## Counter

Global sequence counter: `grf_counters/global { count: N }`

Atomically incremented in a Firestore transaction for every new GRF ID minted. The counter is never decremented or reset.

---

## Rules

1. **Assembly mappings must use grfId — never raw URLs.** The store and build chain resolve grfId → publicUrl at read time.
2. **Never reuse or renumber a GRF ID.** Once minted it is permanent, even if the asset is deleted or replaced.
3. **Format must be compatible with media type.** PNG/JPEG/WebP/SVG for images; MP4/WebM for video; PDF for documents.
4. **Sub-context is always set** — use the appropriate value for the channel; do not leave it zero or null.
5. **Source uploads (purpose `5`) are internal only** — never exposed in store display or URL artifact chains.
6. **STOP on invalid ID — never silently accept.** Hard error, do not save, do not continue.

---

## API Endpoints

**Save a GRF asset:**
```
POST /api/admin/graphics/save-grf
{ mediaType, channel, purpose, format, subContext, imageUrl, name, mimeType, packetId }
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

The store reads images by walking: `packet → assembly → grfIds → publicUrls`.
Raw URLs are never stored on packets or assemblies.

---

## Source File

`shared/graphicCodes.ts`

Key exports: `buildGrfId`, `parseGrfId`, `isValidGrfId`, `grfStoragePath`, `grfMimeType`, `GRF_COUNTER_KEY`
