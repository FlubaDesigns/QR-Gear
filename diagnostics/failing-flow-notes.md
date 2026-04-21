# Failing Flow Notes — QR Gear Admin Builder

Last updated: April 21, 2026

Real-world traces of what actually happens during known failure scenarios.

---

## Flow 1 — Successful Build+Save (Happy Path)

**Starting state:** Admin is logged in. Product py_12 (Bella Canvas Tee) selected. QR Gear / USA250 / Armed Forces selected.

1. Admin presses "Build + Save to Catalog"
2. `handleCreatePacket()` fires
3. `calculatePricing()` runs: baseProductCost=18.30, markup=25%, customerPrice=25.375
4. `POST /api/admin/packets` → 201 → packetId = `4kLsxHqCca7fbdICvW3T`
5. Canvas renders product graphic (1200×1800 PNG, ~200KB base64)
6. `POST /api/admin/content/upload` → 200 → productGraphicUrl = `https://storage.googleapis.com/...`
7. `PATCH /api/admin/packets/4kLsxHqCca7fbdICvW3T` → 200
8. `POST /api/admin/graphics/save` → 200
9. `POST /api/admin/templates/full-save` → 200 → templateId returned
10. `POST /api/admin/queue/process` → fires and forgets
11. `POST /api/admin/store-product-links` → 200 → linkId returned (legacy, not used by storefront)
12. `POST /api/admin/build-sessions/WbaNyMM4.../generate-artifact` → 200
13. `POST /api/admin/build-sessions/WbaNyMM4.../commit` with body `{ pricing: {...} }` → 200
    → Firestore: admin_catalog_instances doc `3suaB5KK7Ez8pOOzucec` created
    → resolved.pricing.customerPrice = 25.375
14. Toast: "Saved to catalog"
15. Product appears in Catalog tab under Armed Forces
16. Product appears at /shop/channel/usa250

**Total time:** ~4-6 seconds

---

## Flow 2 — Build+Save with No Active Session (Partial Failure)

**Starting state:** Admin refreshed the page mid-session. `state.activeSessionId` is null.

1. Admin presses "Build + Save to Catalog"
2. Steps 1–11 complete normally (packet, graphic, template, store link all created)
3. Step 12: `state.activeSessionId` is null → `if (state.activeSessionId)` check fails → skip
4. Step 13: Skipped (no session to commit)
5. Toast: "Saved to catalog" ← **MISLEADING — no catalog instance was actually created**
6. Catalog tab: empty for this product
7. /shop/channel/usa250: product not there

**How to detect:** Check Firestore → admin_catalog_instances — no new doc after the save time.

**How to fix:** Navigate away and back to the builder. On returning, the from-master session creation should fire, giving a new session ID. Then retry Build+Save.

---

## Flow 3 — Template Load Then Save (With Session Bug Fixed)

**Starting state:** Admin opens builder, clicks Load Template, selects a template.

1. `handleSelect(template)` fires in LoadTemplateModule
2. `loadFromPacketData(packet)` hydrates builder state from template's linked packet
3. `POST /api/admin/build-sessions/from-master` → 200 → sessionId = `new-session-abc`
4. `setActiveSession('new-session-abc')` stores session ID in context
5. Builder shows "In Progress" badge — ready to save
6. Admin presses Build+Save
7. Full flow runs with activeSessionId set → catalog instance created ✓

**Before the fix (pre-April 21 2026):** Step 3 never happened. `setActiveSession` was never called. `activeSessionId` remained null. Step 12-13 were skipped. No catalog instance created.

---

## Flow 4 — Delete Catalog Instance

**Starting state:** Item shows in Catalog tab.

1. Admin opens item → Actions accordion → Delete button
2. Confirm prompt shown
3. `DELETE /api/admin/catalog-instances/<instanceId>` fires
4. CF handler finds doc by ID → `doc.ref.delete()` → 200
5. Frontend mutation success callback fires
6. **If queryClient.invalidateQueries is called:** List refetches → item gone ✓
7. **If not called:** List shows stale cache → item still shows despite being deleted in Firestore

**Current behavior:** Verify `StoreManagerTab.tsx` calls invalidate after delete mutation.

---

## Flow 5 — Store Channel Loads Products (Happy Path)

**Request:** GET https://qrgear.com/api/store/channel/usa250

1. CF receives request
2. Looks up `storeChannels/usa250` → storeId = "qr-gear", name = "USA250"
3. Queries `admin_catalog_instances` where storeId == "qr-gear" AND channelId == "usa250"
4. Finds N docs
5. For each: extracts resolved.title, resolved.images[0], resolved.pricing.customerPrice
6. Runs toStringArray() on resolved.colors (converts {name,hex} objects to name strings)
7. Returns products array
8. Frontend renders product cards

**Failure at step 3:** If channelId stored on instance is "USA250" (name) instead of "usa250" (doc ID), query returns 0 results.

---

## Flow 6 — Asset Folder Create

**Request:** POST /api/admin/images/folders { name: "Armed Forces Graphics" }

1. CF handler validates: max 80 chars, not blank
2. Queries admin_image_folders where normalizedName == "armed forces graphics"
3. If exists → 409 Conflict
4. If not → creates doc { name, normalizedName, createdAt }
5. Returns { success: true, folder: { name } }
6. Frontend refetches folder list

**Failure mode:** If request goes to dev Express server instead of CF:
- Step 4 writes to in-memory store
- Returns 200 OK
- On page refresh, memory is cleared, folder is gone
- Detection: Check Network tab in browser — URL should not be localhost
