# Admin Builder — Current Status & Known Issues

Last updated: April 7, 2026

## What This Area Does

The admin builder lets you create product graphics with customizable text zones (top/bottom), center image area, background colors, and QR codes. Images can be uploaded directly or picked from the admin image library.

---

## Current Work In Progress

### 1. Image Y-Axis Positioning (Top & Bottom Zones)

**Goal:** The up/down slider should move the image across the entire vertical range of its zone, minus a small print-safe margin (2% on each edge).

**What was wrong:** When an image filled most of the zone height, the slider had almost zero travel — moving it from 0 to 100 did almost nothing because the available range (`bottomEdge - topEdge`) was near zero.

**Current fix:** The renderer now guarantees a minimum travel distance of 15% of the zone height, even when the image fills the zone. The image is centered by default (slider at 50) and moves up/down from center based on the slider value.

**File:** `client/src/features/shared/graphics/productGraphicRenderer.ts` — `drawImageInZone()` function

**Still needs testing:** Verify that images don't clip outside the graphic boundaries at extreme slider positions (0 or 100). May need canvas clipping if they do.

---

### 2. Admin Image Library — Save to Folder

**Goal:** Upload an image from your phone, then save it to a named folder in the library for reuse across products.

**What was wrong:**
- Save was using base64 encoding (doubling the file size in transit, hitting request limits on large PNGs)
- No error feedback if save failed — dialog just closed silently
- Could save with a blank folder name

**Current fix:**
- Upload now sends the native PNG/image file via multipart form data (no base64 bloat)
- Save button is disabled until a folder is selected
- Errors now show an alert with the actual failure reason
- New folder creation works: type a name, tap the checkmark, then save

**Files:**
- Client: `client/src/features/adminProducts/builder/modules/ProductGraphicTextModule.tsx` — `SaveToLibraryDialog` component
- Server: `functions/src/routes/file-routes.ts` — `POST /admin/images` endpoint

---

### 3. Library Image Display (Broken Images Fix)

**Goal:** Images saved to the library should display correctly when browsing or when used in a product graphic.

**What was wrong:** The file proxy route (`/api/library-files/:filename`) only searched old background storage paths (`library/backgrounds/raw/`, etc.). Admin images are stored at `library/images/{folder}/{filename}` which wasn't in the search list.

**Current fix:** The proxy now falls back to a Firestore lookup in the `admin_images` collection to find the actual storage path when the file isn't found in the standard locations.

**Files:**
- `functions/src/routes/store-files.ts` — GET `/library-files/:file`
- `functions/src/routes/core-routes-checkout.ts` — GET `/library-files/:filename`

---

### 4. PNG Upload in Top/Bottom Text Zones

**Status:** Reported but not yet fully debugged.

**Issue:** Uploading a PNG to the top or bottom text zone may not show in the preview. The file input is only rendered when `!isCollapsed && style.enabled` — so the section must be expanded and enabled for upload to work.

**File:** `client/src/features/shared/components/TextStyleEditor.tsx`

---

## Storage Structure

- **Admin images:** `library/images/{folderName}/{timestamp}-{safeName}.{ext}`
- **Background assets:** `library/backgrounds/raw/`, `library/backgrounds/cropped/`, etc.
- **Member media:** `library/member/{userId}/{mediaType}/{filename}`
- **Firestore collection:** `admin_images` — tracks name, folder, storageUrl, mimeType, isActive

---

## Deploy Commands

**Hosting (frontend):**
```
npm run build && firebase deploy --only hosting --project qrgear-c1ffd
```

**Functions (backend):**
- Bump `_BUILD_ID` in `functions/src/index.ts`
- Bump `version` in `functions/package.json`
```
firebase deploy --only functions --project qrgear-c1ffd
```

---

## Rebuild From This Zip

1. Extract `QR_Gear_Full_Website.zip`
2. Run `npm install` in root
3. Run `cd functions && npm install`
4. Set up Firebase credentials (service account key)
5. Set environment variables in `functions/.env`
6. Upload library images manually through the admin UI
7. `npm run build && firebase deploy --project qrgear-c1ffd`
