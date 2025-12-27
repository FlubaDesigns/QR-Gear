# CRITICAL ISSUE: Printify Mockup URLs Expire

## Problem Summary

**Printify mockup image URLs expire after temporary products are deleted.** This is a fundamental architecture problem.

## Evidence

All 3 mockup URLs now return HTTP 200 but `content-length: 0` (empty content):

```bash
curl -sI "https://images-api.printify.com/mockup/6950300b8ebe602d050c1a5d/17429/103295/mockup-gen-5-solid-black.jpg"
# HTTP/2 200, content-length: 0

curl -sI "https://images-api.printify.com/mockup/69502d9c3463a9559306e3c2/17645/103295/mockup-gen-5-solid-white.jpg"  
# HTTP/2 200, content-length: 0

curl -sI "https://images-api.printify.com/mockup/69502da43463a9559306e3c4/17393/103295/mockup-gen-5-heather-grey.jpg"
# HTTP/2 200, content-length: 0
```

## Root Cause

Current mockup generation flow (`server/lib/mockup-service.ts`):

1. Create temporary Printify product with artwork
2. Poll for mockups until ready
3. Save mockup URLs to database
4. **DELETE the temporary Printify product** (line 398)
5. Return URLs to frontend

**The problem**: Printify's image CDN URLs are tied to the product. When product is deleted, URLs eventually become invalid.

## What Needs to Change

**Option A: Download and store mockups locally**
- When mockup URLs are received, download the images
- Store in Replit Object Storage
- Cache the Object Storage URLs (permanent)
- Display Object Storage URLs to users

**Option B: Keep Printify products alive**
- Don't delete temporary products
- Keep them as "draft" or hidden
- URLs stay valid as long as product exists
- Requires cleanup strategy for old products

**Option C: Use Printify publish flow**
- Create real products (not temp)
- Publish to store
- Mockups are permanent
- More complex, requires store integration

## Recommended Fix (Option A)

```typescript
// In mockup-service.ts, after getting mockup URLs:

// Download image from Printify
const imageResponse = await fetch(mockupImages.flat);
const imageBuffer = await imageResponse.buffer();

// Upload to Object Storage
const objectStorage = new ObjectStorageClient();
const storedUrl = await objectStorage.upload(
  `mockups/${blueprintId}/${colorName}-${artworkVariant}.jpg`,
  imageBuffer
);

// Store permanent Object Storage URL (not Printify URL)
await db.insert(mockupCache).values({
  mockupUrl: storedUrl,  // Object Storage URL, not Printify
  // ...
});
```

## Current Code Location

File: `server/lib/mockup-service.ts`
Function: `generatePrintifyMockup()` (lines 223-403)

Deletion happens at line 398:
```javascript
await printify.deleteProduct(printifyProduct.id).catch((err: Error) => {
  console.warn(`[MockupService] Failed to delete temp product: ${err.message}`);
});
```

## Additional Issue: QR Artwork Variant

The QR artwork selection (black vs white) IS working now:
- `isColorDark()` correctly detects luminance
- White artwork selected for dark shirts
- BUT mockup URLs expire before user sees them

## Additional Issue: Lifestyle Mockups

Printify's "lifestyle" images for this product are actually size-charts (`camera_label=size-chart`), not models.

To get real lifestyle mockups:
1. Use different Printify blueprint that includes model photos
2. OR generate AI composite with model base image + QR overlay

---

## Immediate Actions Needed

1. **Fix URL expiration** - Download and store mockups in Object Storage
2. **Clear all cached expired URLs** - Delete from mockup_cache table
3. **Regenerate mockups** - Create new ones and store permanently
4. **Test end-to-end** - Verify color swatches work with permanent URLs

---

*Written by Agent, December 27, 2025*
*This is a BLOCKING issue - no mockups will display until fixed*
