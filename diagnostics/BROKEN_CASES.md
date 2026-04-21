# Known Broken Cases — QR Gear Admin Builder

Last updated: April 21, 2026

---

## Case 1 — No catalog instance created after save

**Symptom:** Build + Save completes (no error toast) but the product does not appear in the Catalog tab or the storefront.

**Steps:**
1. Go to /admin/products
2. Select a product from the master catalog
3. Make edits
4. Press Build + Save
5. Check Catalog tab — item is missing
6. Check /shop/channel/usa250 — item not there

**Expected:** New item appears in Catalog tab under the correct collection

**Actual:** No item. Packet was created (check productPackets in Firestore) but no admin_catalog_instances doc was written.

**Root cause:** `state.activeSessionId` was null when Step 10 ran. Session was never created or was lost from state. The commit call (Step 11) was skipped.

**Fix path:** Ensure `POST /build-sessions/from-master` is called immediately when a master product is selected, and that `setActiveSession(sessionId)` is called on the returned ID.

---

## Case 2 — Product shows no price in storefront

**Symptom:** Product card in /shop/channel/usa250 shows no price or $0.

**Steps:**
1. Build and save a product
2. Open /shop/channel/usa250
3. Find the product card
4. Price field is empty or missing

**Expected:** Price shows as $25.38 (or whatever customerPrice resolves to)

**Actual:** No price shown

**Root cause (before April 21 2026 fix):** The `pricing` object was calculated in the client but never passed in the commit body. The CF commit handler used `w.pricing` from the working state, which was null in the session doc.

**Fix applied April 21 2026:** `useCreatePacket.ts` now passes `{ pricing }` in the commit body. CF handler uses `bodyPricing || w.pricing`.

**Remaining issue:** Instances committed BEFORE April 21 still have null pricing. Must rebuild and re-save those items.

---

## Case 3 — Description or title missing on product card

**Symptom:** Product card in admin Catalog tab or storefront shows "Untitled" or blank description.

**Steps:**
1. Build a product without entering a custom title
2. Save
3. Open Catalog tab — card shows "Untitled"

**Expected:** Falls back to master catalog title (e.g. "Unisex Jersey Short Sleeve Tee")

**Actual:** Shows "Untitled" or null

**Root cause:** `effectiveTitle` resolution in `useCreatePacket` relies on `state.selectedProduct?.title`, then `state.masterTitle`, then `product?.name`. If `state.selectedProduct` is restored from session without all fields, the fallback chain may still produce null.

**Root cause (title in catalog instance):** The commit handler builds `resolved.title` from `overrides.title || base.title`. If overrides has no title and base.title is null, resolved.title is null.

---

## Case 4 — Delete says success but item remains

**Symptom:** Pressing delete on a catalog instance shows success toast, but the item still shows in the list on refresh.

**Steps:**
1. Go to /admin/store-builder → Catalog tab
2. Find an item, open Actions accordion
3. Press Delete → confirm
4. Success toast shown
5. Refresh page
6. Item is still there

**Expected:** Item removed from Firestore and list

**Actual:** Item remains

**Root cause (suspected):** The delete endpoint (`DELETE /admin/catalog-instances/:instanceId`) may be using the wrong document ID. The InstanceCard passes `instance.id` which should be the Firestore doc ID — verify the instance object returned by the list endpoint is using `doc.id` not a field inside the doc.

**Secondary cause:** TanStack Query cache is not invalidated after delete. The list query `['/api/admin/catalog-instances']` needs `queryClient.invalidateQueries` called after the delete mutation succeeds.

---

## Case 5 — Asset folder created but missing after refresh

**Symptom:** Creating a new image folder in the library appears to succeed, but the folder is gone on page reload.

**Steps:**
1. Go to /admin/library → Images tab
2. Click "New Folder", type a name, press Save
3. Folder appears in list
4. Refresh page
5. Folder is gone

**Expected:** Folder persists (stored in admin_image_folders collection)

**Actual:** Folder disappears

**Root cause (suspected):** `POST /admin/images/folders` may be writing to the dev Express server (`server/`) instead of the Firebase CF (`functions/`). Dev server writes to in-memory storage, not Firestore. On restart, memory is cleared.

**Check:** Confirm the API call goes to `/api/admin/images/folders` and is handled by `functions/src/routes/images.ts` — not `server/routes/`.

---

## Case 6 — Colors shown as [object Object] in storefront

**Symptom:** Color dropdown in /shop/channel/usa250 shows "[object Object]" instead of color names.

**Root cause:** `admin_catalog_instances` stores colors as `{ name, hex }` objects. The store-files CF route was returning those objects directly to the frontend. The frontend called `.toLowerCase()` on them and crashed, or showed "[object Object]".

**Fix applied April 21 2026:** `store-files.ts` now runs `toStringArray()` which maps color objects to their `.name` string before returning.

**Remaining risk:** If `name` is missing from a color object, `toStringArray` falls back to `String(v)` which produces "[object Object]". Ensure all colors written to `admin_catalog_instances` have a `name` field.
