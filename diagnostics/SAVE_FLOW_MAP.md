# Save Flow Map — QR Gear Admin Builder

Last updated: April 21, 2026

---

## The One Button That Does Everything

**Button label:** "Build + Save to Catalog" (or "Create Packet" in some UI states)
**Location:** Builder sticky bar / CreateGraphicsModule

A single press does ALL of the following in sequence. There is no separate autosave. There is no separate commit step.

---

## Step-by-Step Flow (what fires in order)

### Step 1 — Price calculation (client-side, no network)
- `useCreatePacket.calculatePricing()` runs locally
- Uses: `pricingSettings` (fetched from `/api/admin/pricing-settings`), `state.selectedProduct`, `state.selectedPlacements`, `state.content`
- **Fails silently if:** `pricingSettings` is undefined, `selectedProduct` is null, or `content` is null → returns null → throws "Could not calculate pricing" and aborts

### Step 2 — Create packet (`POST /api/admin/packets`)
- **Collection written:** `productPackets`
- **Key fields written:** productId, productName, effectiveTitle, pricing, storeId, channelId, channelName, collectionName, headerStyle, footerStyle, qrProductState, placements, sizes, colors, etc.
- **Returns:** `{ packetId }`
- **Failure mode:** If this fails, all downstream steps are skipped

### Step 3 — Render product graphic (client-side canvas)
- `renderProductGraphic()` draws to an HTML canvas
- Outputs a base64 PNG data URL
- **Failure mode:** Silent — if it fails, `productGraphicUrl` is set to "" and save continues

### Step 4 — Upload product graphic (`POST /api/admin/content/upload`)
- Uploads the base64 PNG to Firebase Storage
- **Collection written:** Firebase Storage — `library/images/...` or `uploads/...`
- **Returns:** `{ publicUrl }`
- **Failure mode:** Warns to console, uses data URL as fallback (large, slow, breaks later)

### Step 5 — Patch packet with graphic URLs (`PATCH /api/admin/packets/:packetId`)
- **Collection written:** `productPackets` (existing doc)
- **Fields updated:** qrOnlyUrl, productGraphicUrl, compositeUrl, landingPageSnapshotUrl, qrContent, playMediaUrl

### Step 6 — Save graphic record (`POST /api/admin/graphics/save`)
- Creates a record in the graphics library
- **Collection written:** `admin_graphics` (or similar — used by Library tab)

### Step 7 — Save template (`POST /api/admin/templates/full-save`)
- Saves a reusable template from this build
- **Collection written:** `templates` (or `admin_templates`)
- **Returns:** `{ template: { id }, jobsQueued }`

### Step 8 — Queue mockup jobs (`POST /api/admin/queue/process`)
- Fires and forgets — does not block
- Triggers background mockup generation

### Step 9 — Link to store (`POST /api/admin/store-product-links`)
- Only runs if `selectedStore.id` AND `selectedChannel.name` are both set
- **Collection written:** `storeProductLinks` (legacy — not used by storefront anymore post-April 21 2026)
- **Failure mode:** Warns to console, save considered complete anyway

### Step 10 — Link packet to build session (`POST /api/admin/build-sessions/:sessionId/generate-artifact`)
- Only runs if `state.activeSessionId` is set
- Sets session status to `artifact_ready`
- **Collection written:** `admin_build_sessions`

### Step 11 — Auto-commit → creates catalog instance (`POST /api/admin/build-sessions/:sessionId/commit`)
- **Collection written:** `admin_catalog_instances` ← THE REAL PRODUCT RECORD
- Writes: storeId, channelId, channelName, collectionName, currentPacketId, resolved (title, description, images, colors, sizes, pricing), overrides, baseSnapshot, status: "draft"
- **This is what the storefront reads**
- **Failure mode:** If session has no `activeSessionId`, this entire step is skipped silently — no catalog instance is created

---

## What Makes a Save Succeed vs. Fail

| Condition | Result |
|-----------|--------|
| `pricingSettings` is null | Aborts at Step 1 — nothing is saved |
| `state.selectedProduct` is null | Aborts at Step 1 |
| `state.activeSessionId` is null | Steps 1–9 complete; NO catalog instance created (Step 11 skipped) |
| `selectedChannel` is null | Step 9 (store link) and Step 11 (catalog instance) miss `channelId` field |
| Canvas render fails | Steps 3–4 fail gracefully; packet saved without graphic |
| Commit fails (Step 11) | Packet exists but no catalog instance → product invisible to storefront |

---

## Draft vs. Final

| State | Where it lives | What it means |
|-------|---------------|---------------|
| **Session (working)** | `admin_build_sessions` | Temporary scratch pad. Safe to abandon. Expires in 7 days. |
| **Packet** | `productPackets` | Full product build artifact. Permanent once created. Referenced by catalog instance. |
| **Catalog instance (draft)** | `admin_catalog_instances` with `status: "draft"` | Product is in the catalog but NOT yet published. Visible in admin, not in storefront by default. |
| **Catalog instance (active)** | `admin_catalog_instances` with `status: "active"` | Published. Storefront reads this. |

---

## What "Load from Template" Reads

- Reads from: `templates` collection (via `GET /api/admin/templates/:templateId`)
- Key fields consumed: artworkUrl, qrContent, headerStyle, footerStyle, productId, colors, placements, pricing, packetId (for packet restore)
- After loading: builder state is hydrated from template data
- Then: `POST /api/admin/build-sessions/from-master` is called to create a new session
- **CRITICAL:** If `packetId` in the template is null or the packet doc is missing, restore partially fails — builder shows blank graphic but session is created

---

## What "Pre-Packet" Reads From

Pre-packet = resuming an existing build session

- Reads: `GET /api/admin/build-sessions/:sessionId`
- Also reads: `GET /api/admin/packets/:packetId` (the linked packet)
- Hydrates: `loadFromPacketData(packet)` in BuilderContext
- **CRITICAL:** If `working.graphics.content` is missing from the session doc, graphic state is blank after restore

---

## Are Catalog Save and Packet Save Separate?

No. They are triggered by the same button press, in sequence, automatically. There is no two-step process exposed to the admin. The commit (catalog instance creation) happens immediately after the packet and graphics are saved — no second "commit" button.

---

## Session State Required Before Save Is Allowed

The builder checks:
1. `state.selectedProduct` must not be null
2. `pricingSettings` must be loaded (fetched on builder mount)
3. `state.content` must exist
4. `isCreating` must be false (debounce guard)

Session does NOT need to exist before Step 1. But if it doesn't exist by Step 10, no catalog instance is created.
