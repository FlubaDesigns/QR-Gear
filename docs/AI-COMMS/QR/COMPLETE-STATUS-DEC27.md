# Complete Mockup System Status - December 27, 2025

## BLOCKING ISSUE: Printify Mockup URLs Expire

**Problem**: Printify mockup image URLs expire after the temporary product is deleted. ALL cached mockup URLs are now returning empty content (HTTP 200, content-length: 0).

---

## What Was Attempted Today

### 1. QR Artwork Selection (FIXED in code, not visible due to URL expiration)
- `isColorDark()` function correctly detects shirt luminance
- White artwork selected for dark shirts (Solid Black = #000000)
- Black artwork selected for light shirts (Solid White, Heather Grey)
- Logs confirm: `needsWhiteQR=true` for Solid Black

### 2. Lifestyle Mockups Storage (FIXED in code)
- `products.mockups_by_color` now stores both `front` and `lifestyle` URLs
- Frontend already prefers lifestyle when available

### 3. Object Storage Integration (ATTEMPTED, FAILED)
Tried to download Printify images and store permanently in Object Storage.

**Error encountered**:
```
Error: A bucket name is needed to use Cloud Storage.
    at Storage.bucket
    at Client.init
```

**Fix attempted**: Pass `{ bucketId }` to ObjectStorageClient constructor.

**Current state**: Untested - needs verification.

---

## Files Changed

| File | Change |
|------|--------|
| `server/routes.ts` lines 4100-4128 | Fixed artwork key lookup for multiple naming conventions |
| `server/routes.ts` lines 4142-4145 | Store lifestyle mockups in products table |
| `server/lib/mockup-service.ts` lines 83-128 | Added `downloadAndStoreImage()` function |
| `server/lib/mockup-service.ts` lines 449-484 | Download images BEFORE deleting temp product |

---

## Database State

### mockup_cache table
All entries deleted (contained expired URLs).

### products table
`mockups_by_color` cleared for `custom_hello-world`.

### custom_designs table
```sql
SELECT placement_images FROM custom_designs WHERE id = 'hello-world';
```
```json
{
  "front-center": "/api/files/deb11da38777376f.png",
  "front-center-white": "/api/files/008bafe5c8f0d429.png"
}
```
Black and white QR artwork files exist and are accessible.

---

## The Actual Problem Flow

1. User clicks color swatch on featured product
2. Frontend calls `/api/storefront/generate-mockup`
3. Backend creates temp Printify product with artwork
4. Printify generates mockup images (takes ~10-20 seconds)
5. Backend gets Printify CDN URLs for mockups
6. **Backend DELETES temp product**
7. Backend caches Printify URLs in database
8. **Printify URLs EXPIRE** (minutes to hours later)
9. User sees broken/missing images

---

## Required Fix

**Option A: Download and Store in Object Storage (recommended)**

Before deleting the temp Printify product:
1. Fetch image bytes from Printify CDN URL
2. Upload to Replit Object Storage
3. Store Object Storage URL (permanent) in database

**Code already added but needs debugging**:
- `downloadAndStoreImage()` function in mockup-service.ts
- Object Storage client initialization issue

**Environment variables available**:
- `DEFAULT_OBJECT_STORAGE_BUCKET_ID`: replit-objstore-ac4951d5-c3b2-403e-ab38-26bbe6c49386
- `PUBLIC_OBJECT_SEARCH_PATHS`: /replit-objstore-ac4951d5-c3b2-403e-ab38-26bbe6c49386/public

---

## Code Location Reference

### Mockup Generation Flow
1. `server/routes.ts` line 4031: `/api/storefront/generate-mockup` endpoint
2. `server/lib/mockup-service.ts` line 130: `getMockupWithFallback()` - main entry
3. `server/lib/mockup-service.ts` line 270: `generatePrintifyMockup()` - creates temp product
4. `server/lib/mockup-service.ts` line 447: **DELETE temp product** (line 480)

### Object Storage Fix Location
- `server/lib/mockup-service.ts` lines 83-128: `downloadAndStoreImage()` function

---

## Additional Issues Noted

### "Lifestyle" mockups are size charts
Printify returns `camera_label=size-chart` for the second image, not a model wearing the shirt. This is a Printify product limitation for blueprint 5 / provider 61.

### User reported: "Black shirt showing as white shirt"
This may have been a visual bug from expired/cached URLs, or the wrong color variant being displayed. Needs re-verification after URL expiration fix.

---

## Environment

- **Stack**: React, Express, TypeScript, Drizzle ORM, PostgreSQL
- **External**: Printify API, Replit Object Storage
- **Product**: Blueprint 5 (Unisex Gildan T-Shirt), Provider 61

---

## To Test After Fix

1. Clear mockup_cache table
2. Clear products.mockups_by_color
3. Restart workflow
4. Call `/api/storefront/generate-mockup` for each color
5. Verify returned URLs are Object Storage URLs (not Printify)
6. Wait 1 hour, verify URLs still work
7. Test color swatch clicking on frontend

---

*This document contains complete state for external review*
*Written December 27, 2025*
