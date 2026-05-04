# QR Gear — QRG Identity Schema Audit & Fix
**Session:** May 4, 2026  
**Production URL:** https://qrgear-c1ffd.web.app  
**Cloud Function:** `api` (us-central1, 3600s timeout, 256MiB)  
**Build ID deployed:** `20260504-143200-2770`

---

## What Was Done

The entire codebase was audited and corrected to comply with the canonical QRG identity schema:

```
QRG-[STNNN]-[C]-[IIIIII]-[SSCC]
```

| Segment | Meaning | Valid values |
|---------|---------|--------------|
| `STNNN` | 5-digit blank ID (e.g. `11101`) | `[1-6][1-9][0-9]{3}` |
| `C`     | Context code (who created the instance) | `I` Internal · `M` Member · `E` External · `O` Owner |
| `IIIIII`| 6-digit zero-padded sequential instance number | `000001`–`999999` |
| `SSCC`  | Size code + Color code (surface-level suffix) | e.g. `0401` = Medium + color 01 |

**Critical rule enforced:** `[C]` is **never** a provider name. `printify`, `printful`, or any other fulfillment provider name must never appear as a context code. Only `I / M / E / O` are valid.

---

## Files Changed

### 1. `functions/src/services/master-catalog.ts`
**Problem:** `enrichDoc` treated `providerMappings` as an array and used `.find(m => m.provider === 'printify')` to extract IDs.  
**Fix:** `providerMappings` is now always an object `{ printify: { blueprintId, printProviderId, ... }, printful: { productId, ... } }`. All reads use `pm.printify` and `pm.printful` key access. The audit/fix endpoint also migrates any legacy array-form documents in Firestore automatically.

---

### 2. `functions/src/routes/admin-build-sessions.ts`
**Problem:** The `/admin/qrg/allocate` endpoint accepted `source`, `blankCode`, and `buildStr` — a non-schema payload that allowed provider names to slip in as context values.  
**Fix:** Endpoint now requires `{ qrgBlankId: "11101", contextCode: "I" }`. Returns `{ packetCode: "QRG-11101-I-000002", instanceNumber: "000002", ... }`. The commit endpoint writes all four QRG identity fields (`qrgBlankId`, `qrgContext`, `instanceNumber`, `qrgPacketCode`) to every new instance Firestore document.  
**Validation:** Bad context codes (anything not `I/M/E/O`) return HTTP 400.

---

### 3. `functions/src/routes/admin-catalog-instances.ts`
**Problem:** Instance creation endpoints (`from-master`, `push-to-member`) did not write QRG identity fields.  
**Fix:** Added `allocateQrgInstanceNumber(qrgBlankId, contextCode)` helper using Firestore transactions on the `qrg_counters` collection. Counter key format: `11101_I`. Both endpoints now allocate and write: `qrgBlankId`, `qrgContext`, `instanceNumber`, `qrgPacketCode`.

| Endpoint | contextCode assigned |
|----------|---------------------|
| `from-master` | `I` (Internal admin instance) |
| `push-to-member` | `M` (Member instance) |

---

### 4. `functions/src/services/surface-generator.ts`
**Problem:** `deriveSkuFromIds(instanceId, masterId)` sliced raw Firestore document IDs to produce fake QRG codes like `QRG-abc12345`.  
**Fix:** Replaced with `deriveSkuFromInstance(instance, instanceId)` which:
1. Reads `instance.qrgPacketCode` if it matches `^QRG-[1-6][1-9][0-9]{3}-[IMEO]-\d{6}$`
2. Reconstructs from parts (`qrgBlankId`, `qrgContext`, `instanceNumber`) if the full code is absent
3. Falls back to `QRG-[qrgBlankId]-[C]-PENDING` if the master is known but instance number not yet assigned
4. Final fallback: `QRG-UNASSIGNED` (never a sliced Firestore ID)

---

### 5. `functions/src/routes/marketplace.ts`
**Problem:** Amazon, eBay, and Etsy listing creation all used `QRG-${surfaceId.slice(0,8)}` — a raw Firestore document ID fragment, not a valid QRG code.  
**Fix:** All three endpoints now use: `skuOverride || surface.qrgCode || surface.sku || QRG-UNASSIGNED-${last8}`. Provider names never appear in the SKU derivation path.

---

### 6. `server/routes/orchestration.routes.ts`
**Problem:** Local orchestration records generated fake QRG codes inline, which could be confused with real identity codes.  
**Fix:** Local orchestration records now use the `ORK-TYPE-SEQ` prefix (e.g. `ORK-SHIRT-001`) to make clear these are internal orchestration references, not QRG identity codes.

---

### 7. `functions/src/routes/master-catalog.ts` — NEW ENDPOINT
**Added:** `GET /admin/master-catalog/products/:docId/options`

A QRG-native product options resolver. Given a `qrg_STNNN` doc ID, returns sizes, colors, print locations, and the full variant map — without requiring callers to know any provider-specific IDs.

**Request:**
```
GET /api/admin/master-catalog/products/qrg_11101/options
Authorization: Bearer <admin-id-token>
```

**Response:**
```json
{
  "docId": "qrg_11101",
  "qrgBlankId": "11101",
  "title": "Gildan 18000 Heavy Blend Crewneck Sweatshirt",
  "brand": "Gildan",
  "availableSizes": [
    { "code": "03", "label": "S", "providerValues": ["S"] },
    { "code": "04", "label": "M", "providerValues": ["M"] }
  ],
  "availableColors": [
    { "code": "01", "label": "Black", "providerValues": ["Black"] }
  ],
  "printLocations": [
    { "id": "front", "label": "Front", "provider": "printify", "providerPlacement": "front" }
  ],
  "provider": {
    "name": "printify",
    "blueprintId": "1015",
    "printProviderId": "99"
  },
  "qrgVariants": { ... }
}
```

**Note:** Provider IDs appear only inside `provider: {}`. They are never exposed at the top level and never used as identity codes.

**Error codes:**

| HTTP | Code | Meaning |
|------|------|---------|
| 400 | `INVALID_QRG_DOC_ID` | docId does not match `qrg_[1-6][1-9][0-9]{3}` |
| 404 | `MASTER_PRODUCT_NOT_FOUND` | No Firestore doc with that ID |
| 409 | `PRINTIFY_MAPPING_MISSING` | No `blueprintId` in `providerMappings.printify` |
| 502 | `PRINTIFY_PLACEMENTS_FAILED` | Live Printify API call failed |

---

## Production Audit Results (May 4, 2026)

All 10 tests ran against live production (`https://qrgear-c1ffd.web.app/api`):

| # | Test | Result | HTTP |
|---|------|--------|------|
| 1 | List master catalog products | PASS | 200 |
| 2 | Fetch single product `qrg_11101` | PASS | 200 |
| 3 | `/options` — valid doc | PASS | 200 |
| 4 | `/options` — invalid doc ID format | PASS (expected 400) | 400 |
| 5 | `/options` — valid format, nonexistent doc | PASS (expected 404) | 404 |
| 6 | `/admin/qrg/allocate` — schema-correct payload | PASS | 200 |
| 7 | `/admin/qrg/allocate` — bad contextCode `"printify"` | PASS (expected 400) | 400 |
| 8 | List admin catalog instances | PASS | 200 |
| 9 | List surfaces | PASS | 200 |
| 10 | Orchestration records | PASS (expected 404 — no records yet) | 404 |

**Allocate response verified:**  
`packetCode: "QRG-11101-I-000002"` — matches `^QRG-[1-6][1-9][0-9]{3}-[IMEO]-\d{6}$` ✓

**Options response verified:**  
- Provider IDs NOT at top level ✓  
- `docId` = `qrg_11101`, `qrgBlankId` = `11101` ✓  
- `printLocations` returns normalized internal placement names ✓

---

## QRG Counter Storage (Firestore)

Counters live in the `qrg_counters` collection.  
Document ID format: `{qrgBlankId}_{contextCode}` → e.g. `11101_I`  
Fields: `lastInstanceNumber` (int), `qrgBlankId` (str), `contextCode` (str), `createdAt`

Instance numbers are allocated atomically inside Firestore transactions — no race conditions.

---

## Files Included in This ZIP

```
shared/qrgCodes.ts                         — canonical identity helpers
functions/src/services/master-catalog.ts   — providerMappings fix
functions/src/services/surface-generator.ts — deriveSkuFromInstance
functions/src/routes/admin-build-sessions.ts — allocate endpoint fix
functions/src/routes/admin-catalog-instances.ts — QRG fields on creation
functions/src/routes/marketplace.ts        — SKU derivation fix
functions/src/routes/master-catalog.ts     — new /options endpoint
server/routes/orchestration.routes.ts      — ORK- prefix for local records
```
