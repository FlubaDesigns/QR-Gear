# Products Functions Index — QR Gear Admin

Last updated: April 21, 2026

Key files and functions for the admin/products build system.

---

## Autosave / Build + Save

**File:** `client/src/features/adminProducts/builder/modules/useCreatePacket.ts`
**Export:** `useCreatePacket()`
**Function:** `handleCreatePacket()`
**Purpose:** Orchestrates the entire Build+Save flow — pricing calc, packet POST, graphic render, graphic upload, packet PATCH, template save, store link, session artifact, auto-commit.

**File:** `functions/src/routes/admin-build-sessions.ts`
**Export:** `registerAdminBuildSessions(app)`
**Function:** `POST /admin/build-sessions/:sessionId/generate-artifact` → `POST /admin/build-sessions/:sessionId/commit`
**Purpose:** CF handlers for marking a session artifact_ready and then committing it to admin_catalog_instances.

---

## Session Creation

**File:** `functions/src/routes/admin-build-sessions.ts`
**Function:** `POST /admin/build-sessions/from-master`
**Purpose:** Creates a new admin_build_session from a master_catalog product. Called when admin selects a product OR after template load.

**File:** `client/src/features/adminProducts/builder/BuilderContext.tsx`
**Export:** `useBuilderContext()`
**Function:** `setActiveSession(sessionId)`
**Purpose:** Stores the active session ID in context state. Must be called after `from-master` returns.

---

## Packet Restore

**File:** `client/src/features/adminProducts/builder/BuilderContext.tsx`
**Function:** `loadFromPacketData(packet)`
**Purpose:** Hydrates full builder state from a packet document. Called on template load or session resume.

**File:** `functions/src/routes/admin-build-sessions.ts`
**Function:** `GET /admin/build-sessions/:sessionId`
**Purpose:** Returns a single session with its working state. Used by DraftResumeHandler to restore a draft.

**File:** `functions/src/routes/packets.ts` (or `admin-packets.ts`)
**Function:** `GET /api/admin/packets/:packetId`
**Purpose:** Returns a single packet. Used during session restore to hydrate graphics state.

---

## Template Load

**File:** `client/src/features/adminProducts/builder/modules/LoadTemplateModule.tsx`
**Function:** `handleSelect(item)`
**Purpose:** Loads a template into the builder. Sequence (post April 21 2026 fix):
1. Clears active session (`setActiveSession(null, null, null)`) to prevent autosave cross-contamination
2. Resolves the product from master catalog via blueprintId/docId
3. Determines `sourceMasterId` from: `resolvedProduct.docId` → `packet.productId` → `packet.blueprintId` (in order)
4. Calls `POST /build-sessions/from-master` using that sourceMasterId
5. Calls `setActiveSession(sessionId, 'working', null)` — gates autosave on new session
6. Calls `loadFromPacketData(packet, resolvedProduct)` — hydrates UI with template content
   React 18 batches steps 5+6 into one render so autosave fires with correct session + template state.

**Previous bug (now fixed):** Session creation was gated on `if (resolvedProduct?.docId)`. If product couldn't be
resolved (old blueprint, deleted product), no session was created → activeSessionId null → autosave dead →
Build+Save created a packet but commit was skipped → no catalog instance.
Additionally, session was not cleared before hydration, so prior session could receive template content
via the 1.5s debounced autosave.

**File:** `functions/src/routes/` (templates route file)
**Function:** `GET /admin/templates/:templateId`
**Purpose:** Returns template data including packetId for graphic restore.

---

## Catalog Instance Delete

**File:** `functions/src/routes/admin-catalog-instances.ts`
**Function:** `DELETE /admin/catalog-instances/:instanceId`
**Purpose:** Hard deletes the catalog instance doc from admin_catalog_instances.

**File:** `client/src/features/adminProducts/storeManager/StoreManagerTab.tsx`
**Function:** Delete button in Actions accordion → `apiRequest("DELETE", ...)`
**Purpose:** Calls the delete endpoint. Should call `queryClient.invalidateQueries` after success.

**File:** `functions/src/routes/admin-stores.ts`
**Function:** `DELETE /admin/stores/:storeId/channels/:channelId/collections/:collectionName`
**Purpose:** Bulk deletes all instances in a collection.

---

## Asset Folder Create

**File:** `functions/src/routes/images.ts` (in functions/src/routes/)
**Function:** `POST /admin/images/folders`
**Purpose:** Creates a doc in admin_image_folders with name + normalizedName validation.

**File:** `functions/src/routes/images.ts`
**Function:** `GET /admin/images/folders`
**Purpose:** Returns merged list of folder names from admin_image_folders collection + unique folder fields on admin_images docs.

---

## Asset Library Read/List

**File:** `functions/src/routes/images.ts`
**Function:** `GET /admin/images?folder=<name>`
**Purpose:** Returns admin_images docs, optionally filtered by folder.

**File:** `client/src/features/adminLibrary/tabs/ImagesTab.tsx`
**Purpose:** UI for browsing/uploading images. Uses `useQuery(['/api/admin/images'])`.

---

## Product Card Title/Description Resolution

**Resolution order (most authoritative first):**
1. `overrides.title` (admin manually typed)
2. `baseSnapshot.title` (copied from master_catalog at session creation)
3. Falls back to `"Untitled"` if both are null

This resolution happens in: `functions/src/routes/admin-build-sessions.ts` → `resolveFields(base, overrides)`

**For description:**
1. `overrides.description`
2. `baseSnapshot.description`
3. `null`

**In the packet** (`productPackets` doc):
- `effectiveTitle` = `state.selectedProduct?.title || state.masterTitle || product?.name || "Untitled Product"`
- `effectiveDescription` = `state.productDescription ?? state.selectedProduct?.description ?? product?.description ?? null`

**In the catalog instance** (`admin_catalog_instances` doc):
- `resolved.title` = `overrides.title || base.title`
- `resolved.description` = `overrides.description || base.description`

**File:** `client/src/features/adminProducts/builder/modules/useCreatePacket.ts`
**Lines:** ~114–130 (title/description field assembly in packetPayload)

**File:** `functions/src/routes/admin-build-sessions.ts`
**Function:** `resolveFields(base, overrides)` — merges base + overrides, skipping null/empty values
