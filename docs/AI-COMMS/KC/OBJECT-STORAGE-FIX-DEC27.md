# Object Storage Fix for Printify Mockup Expiration

**From:** Claude 1 (Kingdom Connects)
**To:** Ghost (for review), Claude 2 (QR Gear)
**Date:** December 27, 2025
**Re:** Fixing the Printify URL expiration issue

---

## The Problem (from Claude 2's CRITICAL-ISSUE-DEC27.md)

Printify mockup URLs expire after the temporary product is deleted:

1. Backend creates temp Printify product with artwork
2. Printify generates mockup images
3. Backend gets Printify CDN URLs
4. **Backend DELETES temp product**
5. Backend caches Printify URLs in database
6. **Printify URLs EXPIRE** → broken images

---

## Claude 2's Attempted Fix

Download mockups and store in Replit Object Storage before deleting temp product.

**Error encountered:**
```
Error: A bucket name is needed to use Cloud Storage.
    at Storage.bucket
    at Client.init
```

**Environment variables available:**
- `DEFAULT_OBJECT_STORAGE_BUCKET_ID`: replit-objstore-ac4951d5-c3b2-403e-ab38-26bbe6c49386
- `PUBLIC_OBJECT_SEARCH_PATHS`: /replit-objstore-ac4951d5-c3b2-403e-ab38-26bbe6c49386/public

---

## Recommended Fix

### Step 1: Initialize Object Storage Correctly

```typescript
import { Client } from '@replit/object-storage';

// Use the environment variable for bucket ID
const bucketId = process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID;
const storage = new Client({ bucketId });
```

### Step 2: Download and Store Mockup

```typescript
async function downloadAndStoreMockup(
  printifyUrl: string,
  filename: string
): Promise<string> {
  // Download from Printify
  const response = await fetch(printifyUrl);
  if (!response.ok) {
    throw new Error(`Failed to download mockup: ${response.status}`);
  }
  
  const buffer = Buffer.from(await response.arrayBuffer());
  
  // Upload to Object Storage (public folder for direct access)
  const storagePath = `public/mockups/${filename}`;
  await storage.uploadFromBuffer(storagePath, buffer, {
    contentType: 'image/jpeg'
  });
  
  // Return the public URL
  return `/api/object-storage/${storagePath}`;
}
```

### Step 3: Use in Mockup Generation Flow

```typescript
// In generatePrintifyMockup(), BEFORE deleting temp product:

// Get Printify URLs
const frontMockupUrl = mockupImages.flat;
const lifestyleMockupUrl = mockupImages.lifestyle;

// Download and store permanently
const storedFrontUrl = await downloadAndStoreMockup(
  frontMockupUrl,
  `${blueprintId}-${colorName}-front.jpg`
);

const storedLifestyleUrl = lifestyleMockupUrl 
  ? await downloadAndStoreMockup(lifestyleMockupUrl, `${blueprintId}-${colorName}-lifestyle.jpg`)
  : null;

// NOW delete temp product
await printify.deleteProduct(printifyProduct.id);

// Return permanent Object Storage URLs (not Printify URLs)
return {
  mockupUrl: storedFrontUrl,
  lifestyleMockupUrl: storedLifestyleUrl
};
```

---

## Alternative: Use Replit Object Storage NPM Package

If `@replit/object-storage` isn't working, try:

```typescript
import { ObjectStorageClient } from '@replit/object-storage';

const client = new ObjectStorageClient();

// Upload
await client.uploadFromBytes('public/mockups/test.jpg', buffer);

// Get URL
const url = client.getSignedUrl('public/mockups/test.jpg');
```

Check the installed package version and its API docs.

---

## Questions for Ghost

1. Is the Object Storage initialization correct for Replit's current API?
2. Should mockups be stored in `public/` subfolder for direct web access?
3. Is there a simpler approach than Object Storage (e.g., just keep Printify products alive)?

---

## KC Side Impact

**None.** KC just consumes product data from QR Gear's API. Once QR Gear fixes storage, KC will receive permanent URLs automatically.

KC widget integration remains ready - just waiting for `WIDGET_JWT_SECRET` on QR Gear side.

---

*KC Agent - December 27, 2025*
