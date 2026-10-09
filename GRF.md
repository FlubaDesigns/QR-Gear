# GRF — Graphic Reference Format

The GRF system is the canonical identity and storage schema for all graphic assets in the QR Gear platform. Every asset — whether it goes on a printed shirt, appears in the store, or lives on a landing page — is issued a unique GRF ID and stored as a record in `grf_assets/{grfId}`.

> Previous schema archived at `GRF_v1_ARCHIVED.md`

---

## ID Format

```
GRF-[D1][D2][D3][D4][D5]-[NNNNNN]
```

Three-character brand prefix (`GRF`), five single-digit descriptor positions, and a 6-digit zero-padded global sequence number.

**Example:** `GRF-21212-000001`
→ Output artifact · Image · Store · Glamor Shot · JPEG · Sequence 1

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
| `1` | print | Goes to the physical product (sent to print provider) |
| `2` | store | Displayed in the customer-facing storefront |
| `3` | url | Lives on a landing page / online digital artifact |
| `4` | assets | Internal asset library — source uploads, backgrounds, templates |

---

### D4 — Purpose *(relative to D3)*

D4 is indexed within each channel. The same digit means different things in different channels.

**If D3 = `1` (print):**

| D4 | Name | Description |
|---|---|---|
| `1` | qr_composite | QR code merged with zone/palette graphic — goes on the product |
| `2` | qr_standalone | QR code with QRG logo centered on a white box |

**If D3 = `2` (store):**

| D4 | Name | Description |
|---|---|---|
| `1` | glamor_shot | Hero image — first shown in storefront, lifestyle/glamor render |
| `2` | front | Front-facing product render |
| `3` | back | Back-facing product render |

**If D3 = `3` (url):**

| D4 | Name | Description |
|---|---|---|
| `1` | snapshot | Rendered capture of the landing page |
| `2` | graphic | Designed image placed on the landing page |

**If D3 = `4` (assets):**

| D4 | Name | Description |
|---|---|---|
| `1` | original | Raw asset as uploaded — filename preserved |
| `2` | cropped | Cropped derivative of the original |
| `3` | background | Background image used during builder composition |
| `4` | template | Reusable graphic applied across multiple products |

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

### Sequence — NNNNNN

Six-digit zero-padded global sequence number. Minted atomically from `grf_counters/global`. Never reused once assigned.

---

## Examples

| GRF ID | Reads as |
|---|---|
| `GRF-21111-000001` | Output · Image · Print · QR Composite · PNG |
| `GRF-21121-000001` | Output · Image · Print · QR Standalone · PNG |
| `GRF-21211-000001` | Output · Image · Store · Glamor Shot · PNG |
| `GRF-21312-000001` | Output · Image · URL · Snapshot · JPEG |
| `GRF-11431-000001` | Input · Image · Assets · Background · PNG |
| `GRF-11411-000001` | Input · Image · Assets · Original · PNG |
| `GRF-11421-000001` | Input · Image · Assets · Cropped · PNG |
| `GRF-11441-000001` | Input · Image · Assets · Template · PNG |

---

## Storage Path Convention

```
grf/{grfId}/{filename}
```

Filenames are derived from D3+D4 purpose:

| D3 | D4 | Name | Filename |
|---|---|---|---|
| print | `1` | qr_composite | `composite.{ext}` |
| print | `2` | qr_standalone | `qr-standalone.{ext}` |
| store | `1` | glamor_shot | `glamor.{ext}` |
| store | `2` | front | `front.{ext}` |
| store | `3` | back | `back.{ext}` |
| url | `1` | snapshot | `snapshot.{ext}` |
| url | `2` | graphic | `graphic.{ext}` |
| assets | `1` | original | `{original-filename}.{ext}` |
| assets | `2` | cropped | `cropped.{ext}` |
| assets | `3` | background | `background.{ext}` |
| assets | `4` | template | `template.{ext}` |

**Note:** `original` (assets D4=`1`) preserves the uploaded filename as-is. All other purposes use the canonical filename above.

**Example:** `grf/GRF-21212-000001/glamor.jpg`

The extension follows D5 (`jpeg` uses `.jpg`). Builder print slots use PNG, as defined by `GRF_PACKET_SLOTS`.

---

## Firestore Record — `grf_assets/{grfId}`

```json
{
  "grfId":          "GRF-21211-000001",
  "assetClass":     "2",
  "mediaType":      "1",
  "channel":        "2",
  "purpose":        "1",
  "format":         "1",
  "sequence":       1,
  "assetClassName": "output_artifact",
  "mediaTypeName":  "image",
  "channelName":    "store",
  "purposeName":    "glamor_shot",
  "formatName":     "png",
  "mimeType":       "image/png",
  "storagePath":    "grf/GRF-21211-000001/glamor.png",
  "publicUrl":      "https://...",
  "originalFilename": null,
  "packetId":       "abc123",
  "isActive":       true,
  "createdAt":      "..."
}
```

For `original` assets (assets channel, D4=`1`), `originalFilename` stores the uploaded filename.

---

## Counter

Single global counter: `grf_counters/global { count: N }`

Atomically incremented in a Firestore transaction for every new GRF ID. Never decremented or reset.

---

## Rules

1. **Assembly file bindings must use grfId — never raw file URLs.** The external video/document `value` binding is defined separately in `ASSEMBLY.md`.
2. **Never reuse or renumber a GRF ID.** Permanent once minted.
3. **Format (D5) must be compatible with media type (D2).**
4. **D4 is interpreted relative to D3** — the same digit means different things in different channels.
5. **Input build assets (D1=`1`) are never exposed in store display or URL artifact chains.**
6. **Hard fail on invalid ID** — stop, throw, do not save, do not continue.
7. **Original uploads preserve their filename** — all other purposes use canonical filenames.

---

## Source uploads and crops

Source uploads are shared inputs for print and website designs. They accept PNG, JPEG,
WebP, and SVG up to 20 MB per image. Original bytes and filenames are retained. Unsupported
formats are rejected rather than relabeled. Limits and MIME rules come from `shared/GRF_engine.ts`.

Source uploads and crops use `createGrfRegistrar` in `functions/src/services/grf-store.ts`
in both development and Cloud Functions. Identical uploads reuse their registered identity.
Each distinct crop gets a fresh global sequence and immutable file, linked to its original
through `sourceGrfId`; identical crop retries reuse the same derivative. Library crops use
PNG to retain transparency. Background records reference the original file without copying it.

Library removal uses the shared reviewed deletion flow. The preview identifies affected
build records, derived assets, files, and assets retained because they are still in use.
Confirmation removes the reviewed build records and unshared files; it does not leave
a broken Assembly pointing to a deleted graphic. Files shared with surviving builds or
website content are retained. Failed Storage cleanup remains tracked in `asset_deletions`
and can be completed from the Library. Counters are never reset by deletion.

---

## API Endpoints

**Save a GRF asset:**
```
POST /api/admin/graphics/save-grf
{ assetClass, mediaType, channel, purpose, format, imageUrl, name, mimeType, packetId, originalFilename? }
```

**Get GRF assets (filtered):**
```
GET /api/admin/graphics?channel=2&purpose=1
```

**Preview and confirm deletion of a GRF asset and its affected builds:**
```
GET /api/admin/graphics/:id/deletion-preview
DELETE /api/admin/graphics/:id
{ "token": "<token returned by the reviewed preview>" }
```

A changed dependency plan returns `409` and requires a new review. Both HTTP adapters
use `functions/src/services/admin-grf-routes.ts` and `build-deletion.ts`; there is no
separate Archive endpoint.

**Finish tracked file cleanup:**
```
GET /api/admin/graphics/deletions/pending
POST /api/admin/graphics/deletions/:operationId/retry
```

---

## Relationship to Assembly

```
Packet → assemblyId
Assembly → { qrgId, bldId, mappings: [{ grfId, ... }] }
GRF asset → { publicUrl, storagePath, ... }
```

Assembly file bindings resolve through `grfId → grf_assets.publicUrl`. Assembly does not
store duplicate file URLs. External video/document links use the explicit `value` binding
described in `ASSEMBLY.md`. Packet owns the published offer and mockup display data;
those display fields do not replace Assembly's asset identities.

---

## Source File

`shared/graphicCodes.ts`

Key exports: `buildGrfId`, `parseGrfId`, `isValidGrfId`, `grfStoragePath`, `grfMimeType`, `GRF_COUNTER_KEY`
