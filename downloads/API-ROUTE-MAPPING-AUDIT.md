# QR Gear — Site-Wide API Route Name Map

## How Names Connect (The Chain)

```
FRONTEND VARIABLE          →  RESOLVES TO          →  DEV SERVER ROUTE       →  CLOUD FUNCTION ROUTE
─────────────────             ───────────              ────────────────          ────────────────────

Admin apiBase              =  /api/admin               /api/admin/...            /admin/...
Admin api.baseUrl          =  /api/admin               /api/admin/...            /admin/...
Member apiBase             =  /api/members             /api/members/...          /members/...
(hardcoded /api/...)       =  /api/...                 /api/...                  /...
```

Firebase Hosting rewrites `/api/**` → Cloud Function.
Cloud Function strips the `/api` prefix.
So `/api/admin/stores` arrives at Cloud Function as `/admin/stores`.

---

## SECTION 1: ADMIN ROUTES

Uses admin `apiBase` or `api.baseUrl` (both = `/api/admin`).
All require Bearer auth via `getAuthHeaders()` or `authFetch()`.

### STORES (Admin)

| Frontend Call | → Resolves To | → Dev Server | → Cloud Function | Auth | Status |
|--------------|--------------|-------------|-----------------|------|--------|
| `${apiBase}/stores` GET | `/api/admin/stores` | `/api/admin/stores` | `/admin/stores` | Bearer | OK |
| `${apiBase}/stores` POST | `/api/admin/stores` | `/api/admin/stores` | `/admin/stores` | Bearer | OK |
| `${apiBase}/stores?roleType=internal` GET | `/api/admin/stores?roleType=internal` | `/api/admin/stores` | `/admin/stores` | Bearer | OK |
| `${apiBase}/stores?roleType=${roleType}` GET | `/api/admin/stores?roleType=...` | `/api/admin/stores` | `/admin/stores` | Bearer | OK |
| `${apiBase}/stores/by-id/${urlStoreId}` GET | `/api/admin/stores/by-id/abc` | `/api/admin/stores/by-id/:id` | `/admin/stores/by-id/:id` | **None** | BROKEN AUTH |
| `${apiBase}/stores/${urlStoreId}/channels` GET | `/api/admin/stores/abc/channels` | `/api/admin/stores/:id/channels` | `/admin/stores/:id/channels` | **None** | BROKEN AUTH |
| `${apiBase}/stores/${storeId}/channels` GET | `/api/admin/stores/abc/channels` | `/api/admin/stores/:id/channels` | `/admin/stores/:id/channels` | Bearer | OK |
| `${apiBase}/stores/${storeId}/channels` POST | `/api/admin/stores/abc/channels` | `/api/admin/stores/:id/channels` | `/admin/stores/:id/channels` | Bearer | OK |
| `${apiBase}/stores/${storeId}/channels/${channel}/collections` GET | `/api/admin/stores/.../collections` | `/api/admin/stores/:id/channels/:cid/collections` | `/admin/stores/:id/channels/:cid/collections` | Bearer | OK |
| `${api.baseUrl}/stores` GET | `/api/admin/stores` | `/api/admin/stores` | `/admin/stores` | Bearer | OK |
| `${api.baseUrl}/stores/${storeId}` GET | `/api/admin/stores/abc` | **NOTHING** | **NOTHING** | Bearer | WRONG PATH — should be `stores/by-id/${storeId}` |
| `${api.baseUrl}/stores/${storeId}/channels` GET | `/api/admin/stores/abc/channels` | `/api/admin/stores/:id/channels` | `/admin/stores/:id/channels` | Bearer | OK |
| `${api.baseUrl}/stores/${storeId}/channels/${channelId}` GET | `/api/admin/stores/.../channels/xyz` | **NOTHING** | **NOTHING** | Bearer | WRONG PATH — no single-channel GET route exists |

**Files:**
- StoreLibraryContext.tsx:78 — `stores/by-id` (no auth)
- StoreLibraryContext.tsx:91 — `stores/:id/channels` (no auth)
- StoreChannelDropdownModule.tsx:126 — wrong path `stores/${storeId}` (should be `stores/by-id/${storeId}`)
- StoreChannelDropdownModule.tsx:164 — route doesn't exist

---

### CATALOG & FULFILLMENT (Admin)

| Frontend Call | → Resolves To | → Dev Server | → Cloud Function | Auth | Status |
|--------------|--------------|-------------|-----------------|------|--------|
| `${apiBase}/fulfillment-providers` GET | `/api/admin/fulfillment-providers` | `/api/admin/fulfillment-providers` | `/admin/fulfillment-providers` | Bearer | OK |
| `${api.baseUrl}/catalog/sync` POST | `/api/admin/catalog/sync` | `/api/admin/catalog/sync` | `/admin/catalog/sync` | Bearer | OK |
| `${api.baseUrl}/catalog/sync-printful` POST | `/api/admin/catalog/sync-printful` | `/api/admin/catalog/sync-printful` | `/admin/catalog/sync-printful` | Bearer | OK |
| `${api.baseUrl}/catalog/sync-status` GET | `/api/admin/catalog/sync-status` | `/api/admin/catalog/sync-status` | `/admin/catalog/sync-status` | Bearer | OK |
| `${api.baseUrl}/catalog/printful-products` GET | `/api/admin/catalog/printful-products` | `/api/admin/catalog/printful-products` | `/admin/catalog/printful-products` | Bearer | OK |
| `/api/admin/catalog/placements` GET (hardcoded) | `/api/admin/catalog/placements` | `/api/admin/catalog/placements` | `/admin/catalog/placements` | **Cookie** | BROKEN AUTH — cookie fails in production |
| `${apiBase}/printify/catalog?provider=...` GET | `/api/admin/printify/catalog` | `/api/admin/printify/catalog` | `/admin/printify/catalog` | **Cookie** | BROKEN AUTH — cookie fails in production |

**Files:**
- BuilderContext.tsx:210 — placements with cookie auth (MAIN BLOCKER for product builder)
- CatalogBrowserModule.tsx:49 — printify catalog with cookie auth

---

### PRICING (Admin)

| Frontend Call | → Resolves To | → Dev Server | → Cloud Function | Auth | Status |
|--------------|--------------|-------------|-----------------|------|--------|
| `${apiBase}/pricing-settings` GET | `/api/admin/pricing-settings` | `/api/admin/pricing-settings` | `/admin/pricing-settings` | **None** | BROKEN AUTH — no auth sent |
| `${apiBase}/pricing-settings` POST | `/api/admin/pricing-settings` | `/api/admin/pricing-settings` | `/admin/pricing-settings` | Bearer | OK |
| `${apiBase}/pricing-settings/sync` POST | `/api/admin/pricing-settings/sync` | `/api/admin/pricing-settings/sync` | `/admin/pricing-settings/sync` | Bearer | OK |

**Files:**
- CreateGraphicsModule.tsx:480 — GET pricing-settings with zero auth

---

### PACKETS (Admin)

| Frontend Call | → Resolves To | → Dev Server | → Cloud Function | Auth | Status |
|--------------|--------------|-------------|-----------------|------|--------|
| `${apiBase}/packets` POST | `/api/admin/packets` | `/api/admin/packets` | `/admin/packets` | Bearer (authFetch) | OK |
| `${apiBase}/packets` GET | `/api/admin/packets` | `/api/admin/packets` | `/admin/packets` | Bearer (authFetch) | OK |
| `${apiBase}/packets?status=published&types=...` GET | `/api/admin/packets?...` | `/api/admin/packets` | `/admin/packets` | Bearer | OK |
| `${apiBase}/packets/${id}` PATCH | `/api/admin/packets/abc` | `/api/admin/packets/:id` | `/admin/packets/:id` | Bearer (authFetch) | OK |
| `${apiBase}/packets/${id}` DELETE | `/api/admin/packets/abc` | `/api/admin/packets/:id` | `/admin/packets/:id` | Bearer (authFetch) | OK |
| `/api/admin/packets` GET (hardcoded) | `/api/admin/packets` | `/api/admin/packets` | `/admin/packets` | Bearer (authFetch) | OK |
| `/api/admin/packets/${id}` DELETE (hardcoded) | `/api/admin/packets/abc` | `/api/admin/packets/:id` | `/admin/packets/:id` | Bearer (authFetch) | OK |

All OK.

---

### BUILDER ACTIONS (Admin)

| Frontend Call | → Resolves To | → Dev Server | → Cloud Function | Auth | Status |
|--------------|--------------|-------------|-----------------|------|--------|
| `${apiBase}/content/upload` POST | `/api/admin/content/upload` | `/api/admin/content/upload` | `/admin/content/upload` | **None** | BROKEN AUTH |
| `${apiBase}/graphics/save` POST | `/api/admin/graphics/save` | `/api/admin/graphics/save` | `/admin/graphics/save` | **None** | BROKEN AUTH |
| `${apiBase}/templates/full-save` POST | `/api/admin/templates/full-save` | `/api/admin/templates/full-save` | `/admin/templates/full-save` | **None** | BROKEN AUTH |
| `${apiBase}/queue/process` POST | `/api/admin/queue/process` | `/api/admin/queue/process` | `/admin/queue/process` | **None** | BROKEN AUTH |
| `${apiBase}/store-product-links` POST | `/api/admin/store-product-links` | `/api/admin/store-product-links` | `/admin/store-product-links` | **None** | BROKEN AUTH |
| `${apiBase}/mockup/priority` POST | `/api/admin/mockup/priority` | `/api/admin/mockup/priority` | `/admin/mockup/priority` | **None** | BROKEN AUTH |
| `${apiBase}/generate-product-graphic` POST | `/api/admin/generate-product-graphic` | `/api/admin/generate-product-graphic` | `/admin/generate-product-graphic` | ? | CHECK |

**Files — ALL in CreateGraphicsModule.tsx:**
- Line 657 — content/upload (no auth)
- Line 746 — content/upload (no auth)
- Line 768 — content/upload (no auth)
- Line 802 — graphics/save (no auth)
- Line 821 — templates/full-save (no auth)
- Line 846 — queue/process (no auth)
- Line 855 — store-product-links (no auth)
- Line 939 — mockup/priority (no auth)

---

### TEMPLATES (Admin)

| Frontend Call | → Resolves To | → Dev Server | → Cloud Function | Auth | Status |
|--------------|--------------|-------------|-----------------|------|--------|
| `/api/admin/templates` GET (hardcoded) | `/api/admin/templates` | `/api/admin/templates` | `/admin/templates` | Bearer (authFetch) | OK |
| `/api/admin/templates/${id}` DELETE (hardcoded) | `/api/admin/templates/abc` | `/api/admin/templates/:id` | `/admin/templates/:id` | Bearer (authFetch) | OK |
| `${apiBase}/templates` GET | `/api/admin/templates` | `/api/admin/templates` | `/admin/templates` | Bearer (authFetch) | OK |
| `${apiBase}/templates/${id}/mockups` GET | `/api/admin/templates/abc/mockups` | `/api/admin/templates/:id/mockups` | `/admin/templates/:id/mockups` | Bearer | OK |

All OK.

---

### BACKGROUND ASSETS (Admin)

| Frontend Call | → Resolves To | → Dev Server | → Cloud Function | Auth | Status |
|--------------|--------------|-------------|-----------------|------|--------|
| `${apiBase}/background-assets?type=${type}` GET | `/api/admin/background-assets?type=...` | `/api/admin/background-assets` | `/admin/background-assets` | Bearer | OK |
| `${apiBase}/background-assets?type=cropped` GET | `/api/admin/background-assets?type=cropped` | `/api/admin/background-assets` | `/admin/background-assets` | **None** | BROKEN AUTH |
| `${apiBase}/background-assets?type=background` GET | `/api/admin/background-assets?type=background` | `/api/admin/background-assets` | `/admin/background-assets` | **None** | BROKEN AUTH |
| `${apiBase}/background-assets` POST | `/api/admin/background-assets` | `/api/admin/background-assets` | `/admin/background-assets` | Bearer | OK |
| `${apiBase}/background-assets` POST | `/api/admin/background-assets` | `/api/admin/background-assets` | `/admin/background-assets` | **None** | BROKEN AUTH |
| `${apiBase}/background-assets/${id}` DELETE | `/api/admin/background-assets/abc` | `/api/admin/background-assets/:id` | `/admin/background-assets/:id` | Bearer | OK |
| `${apiBase}/background-assets/${id}` DELETE | `/api/admin/background-assets/abc` | `/api/admin/background-assets/:id` | `/admin/background-assets/:id` | **None** | BROKEN AUTH |

**Files:**
- LibraryContext.tsx:62,69,83,97 — uses Bearer auth from context (OK)
- LibraryBackgroundPicker.tsx:67,77,113,129 — NO auth headers at all (BROKEN)

---

### PRODUCTS (Admin)

| Frontend Call | → Resolves To | → Dev Server | → Cloud Function | Auth | Status |
|--------------|--------------|-------------|-----------------|------|--------|
| `${apiBase}/products${providerParam}` GET | `/api/admin/products` | `/api/admin/products` | `/admin/products` | Bearer | OK |
| `${apiBase}/products/${id}/sync-printify` POST | `/api/admin/products/abc/sync-printify` | `/api/admin/products/:id/sync-printify` | `/admin/products/:id/sync-printify` | **Cookie** | BROKEN AUTH |
| `${apiBase}/partner-stores/${id}/products` GET | `/api/admin/partner-stores/abc/products` | `/api/admin/partner-stores/:id/products` | `/admin/partner-stores/:id/products` | Bearer (authFetch) | OK |

**Files:**
- ProductConfigSkin.tsx:144 — sync-printify uses `credentials: 'include'` (cookie auth)

---

### SHELF & BUILD SHELF (Admin)

| Frontend Call | → Resolves To | → Dev Server | → Cloud Function | Auth | Status |
|--------------|--------------|-------------|-----------------|------|--------|
| `${api.baseUrl}/shelf-groups` GET/POST | `/api/admin/shelf-groups` | `/api/admin/shelf-groups` | `/admin/shelf-groups` | Bearer | OK |
| `${api.baseUrl}/shelf-groups/${id}` PATCH/DELETE | `/api/admin/shelf-groups/abc` | `/api/admin/shelf-groups/:id` | `/admin/shelf-groups/:id` | Bearer | OK |
| `${api.baseUrl}/build-shelf` GET/POST | `/api/admin/build-shelf` | `/api/admin/build-shelf` | `/admin/build-shelf` | Bearer | OK |
| `${api.baseUrl}/build-shelf/${id}` PATCH/DELETE | `/api/admin/build-shelf/abc` | `/api/admin/build-shelf/:id` | `/admin/build-shelf/:id` | Bearer | OK |

All OK.

---

### COMPOSE & PUBLISH (Admin)

| Frontend Call | → Resolves To | → Dev Server | → Cloud Function | Auth | Status |
|--------------|--------------|-------------|-----------------|------|--------|
| `${apiBase}/published-compose-items` GET | `/api/admin/published-compose-items` | `/api/admin/published-compose-items` | `/admin/published-compose-items` | Bearer (authFetch) | OK |
| `${apiBase}/compose/publish` POST | `/api/admin/compose/publish` | `/api/admin/compose/publish` | `/admin/compose/publish` | Bearer (authFetch) | OK |

All OK.

---

### FONTS, GRAPHIC-SETS, LIBRARY, ORCHESTRATION (Admin, hardcoded)

| Frontend Call | → Resolves To | → Dev Server | → Cloud Function | Auth | Status |
|--------------|--------------|-------------|-----------------|------|--------|
| `/api/admin/fonts` POST (hardcoded) | `/api/admin/fonts` | `/api/admin/fonts` | `/admin/fonts` | Bearer (authFetch) | OK |
| `/api/admin/graphic-sets` GET/POST (hardcoded) | `/api/admin/graphic-sets` | `/api/admin/graphic-sets` | `/admin/graphic-sets` | Bearer (authFetch) | OK |
| `/api/admin/graphic-sets/${id}` DELETE (hardcoded) | `/api/admin/graphic-sets/abc` | `/api/admin/graphic-sets/:id` | `/admin/graphic-sets/:id` | Bearer (authFetch) | OK |
| `/api/admin/library/admin?${params}` GET (hardcoded) | `/api/admin/library/admin?...` | `/api/admin/library/admin` | `/admin/library/admin` | Bearer (authFetch) | OK |
| `/api/admin/library/upload` POST (hardcoded) | `/api/admin/library/upload` | `/api/admin/library/upload` | `/admin/library/upload` | Bearer | OK |
| `/api/admin/library/${id}` PUT/DELETE (hardcoded) | `/api/admin/library/abc` | `/api/admin/library/:id` | `/admin/library/:id` | Bearer (apiRequest) | OK |
| `/api/admin/orchestration/bulk-publish/${jobId}` GET (hardcoded) | `/api/admin/orchestration/...` | `/api/admin/orchestration/...` | `/admin/orchestration/...` | Bearer | OK |
| `/api/admin/stores` GET (hardcoded) | `/api/admin/stores` | `/api/admin/stores` | `/admin/stores` | Bearer (authFetch) | OK |
| `/api/admin/stores/${id}/channels` GET (hardcoded) | `/api/admin/stores/abc/channels` | `/api/admin/stores/:id/channels` | `/admin/stores/:id/channels` | Bearer (authFetch) | OK |

All OK — these all use `authFetch`.

---

## SECTION 2: MEMBER ROUTES

Uses member `apiBase` (= `/api/members`) or hardcoded `/api/members/...`.
Most require Bearer auth via member `getAuthHeaders()`.

### MEMBER PACKETS & PRODUCTS

| Frontend Call | → Resolves To | → Dev Server | → Cloud Function | Auth | Status |
|--------------|--------------|-------------|-----------------|------|--------|
| `${apiBase}/${userId}/packets` POST | `/api/members/abc/packets` | `/api/members/:id/packets` | `/members/:id/packets` | Bearer | OK |
| `${apiBase}/${userId}/packets/${id}` PATCH | `/api/members/abc/packets/xyz` | `/api/members/:id/packets/:pid` | `/members/:id/packets/:pid` | Bearer | OK |
| `${apiBase}/member/packets` POST | `/api/members/member/packets` | `/api/members/member/packets` | `/members/member/packets` | **None** | CHECK — memberPacketService.ts |
| `${apiBase}/member/packets/${id}` DELETE | `/api/members/member/packets/abc` | `/api/members/member/packets/:id` | `/members/member/packets/:id` | **None** | CHECK — rollback call |
| `${apiBase}/member/packets?memberId=...` GET | `/api/members/member/packets?memberId=...` | `/api/members/member/packets` | `/members/member/packets` | **None** | CHECK |
| `${apiBase}/member/graphics/create` POST | `/api/members/member/graphics/create` | `/api/members/member/graphics/create` | `/members/member/graphics/create` | **None** | CHECK |
| `${apiBase}/member/templates/save` POST | `/api/members/member/templates/save` | `/api/members/member/templates/save` | `/members/member/templates/save` | **None** | CHECK |
| `${apiBase}/member/library-links` POST/GET | `/api/members/member/library-links` | `/api/members/member/library-links` | `/members/member/library-links` | **None** | CHECK |
| `${apiBase}/member/play-packets` POST | `/api/members/member/play-packets` | `/api/members/member/play-packets` | `/members/member/play-packets` | **None** | CHECK |
| `${apiBase}/member/play-packets/${id}/share-card` POST | `/api/members/member/play-packets/abc/share-card` | same | same | **None** | CHECK |
| `${apiBase}/member/play-packets/${id}/publish` POST | `/api/members/member/play-packets/abc/publish` | same | same | **None** | CHECK |
| `${apiBase}/allowed-products` GET | `/api/members/allowed-products` | `/api/members/allowed-products` | `/members/allowed-products` | Bearer | OK |
| `${apiBase}/${memberId}/channels` GET/POST | `/api/members/abc/channels` | `/api/members/:id/channels` | `/members/:id/channels` | Bearer | OK |
| `${apiBase}/${userId}/media` POST (XHR) | `/api/members/abc/media` | `/api/members/:id/media` | `/members/:id/media` | Bearer | OK |
| `/api/members/${userId}/products` GET/POST | `/api/members/abc/products` | `/api/members/:id/products` | `/members/:id/products` | Bearer | OK |
| `/api/members/${userId}/library` PUT | `/api/members/abc/library` | `/api/members/:id/library` | `/members/:id/library` | Bearer | OK |
| `/api/members/${userId}/library/upload` POST | `/api/members/abc/library/upload` | `/api/members/:id/library/upload` | `/members/:id/library/upload` | Bearer | OK |
| `/api/members/${userId}/published-items?types=...` GET | `/api/members/abc/published-items?...` | `/api/members/:id/published-items` | `/members/:id/published-items` | Bearer | OK |
| `/api/members/${memberId}/assets/upload` POST | `/api/members/abc/assets/upload` | `/api/members/:id/assets/upload` | `/members/:id/assets/upload` | Bearer | OK |
| `/api/members/${memberId}/videos/upload` POST | `/api/members/abc/videos/upload` | `/api/members/:id/videos/upload` | `/members/:id/videos/upload` | Bearer | OK |
| `/api/members/${memberId}/library?assetType=...` GET | `/api/members/abc/library?...` | `/api/members/:id/library` | `/members/:id/library` | Bearer | OK |
| `/api/members/${memberId}/library/${assetId}` DELETE | `/api/members/abc/library/xyz` | `/api/members/:id/library/:aid` | `/members/:id/library/:aid` | Bearer | OK |
| `/api/members/${memberId}/channels` GET/POST | `/api/members/abc/channels` | `/api/members/:id/channels` | `/members/:id/channels` | Bearer | OK |
| `/api/members/${memberId}/products` GET | `/api/members/abc/products` | `/api/members/:id/products` | `/members/:id/products` | Bearer | OK |
| `/api/members/${memberId}/earnings` GET | `/api/members/abc/earnings` | `/api/members/:id/earnings` | `/members/:id/earnings` | Bearer | OK |
| `/api/members/${memberId}/claim-temp-packet` POST | `/api/members/abc/claim-temp-packet` | `/api/members/:id/claim-temp-packet` | `/members/:id/claim-temp-packet` | Bearer | OK |
| `/api/members/common-library?assetType=...` GET | `/api/members/common-library?...` | `/api/members/common-library` | `/members/common-library` | Bearer | OK |
| `/api/members/allowed-products` GET/POST | `/api/members/allowed-products` | `/api/members/allowed-products` | `/members/allowed-products` | **None** | CHECK — admin-store-builder.tsx |
| `/api/members/mockup/priority` POST | `/api/members/mockup/priority` | `/api/members/mockup/priority` | `/members/mockup/priority` | Bearer | OK |
| `/api/members/profile` PUT | `/api/members/profile` | `/api/members/profile` | `/members/profile` | Bearer | OK |

**Files to check:**
- memberPacketService.ts — all `${apiBase}/member/*` calls appear to send NO auth headers
- memberVideoService.ts — same pattern
- admin-store-builder.tsx:592,608 — `/api/members/allowed-products` with no auth

---

## SECTION 3: PUBLIC ROUTES (No Auth)

Hardcoded paths, no `apiBase` prefix, no login needed.

### STORES (Public)

| Frontend Call | → Resolves To | → Dev Server | → Cloud Function | Auth | Status |
|--------------|--------------|-------------|-----------------|------|--------|
| `/api/stores` GET | `/api/stores` | `/api/stores` | `/stores` | None | OK |
| `/api/stores` POST | `/api/stores` | `/api/stores` | `/stores` | None | WRONG PATTERN — store creation should require admin auth |
| `/api/stores/${storeId}` GET | `/api/stores/abc` | `/api/stores/:id` | `/stores/:id` | None | OK |
| `/api/stores/${storeId}` DELETE | `/api/stores/abc` | `/api/stores/:id` | `/stores/:id` | None | WRONG PATTERN — store deletion should require admin auth |
| `/api/stores/${storeId}/channels` GET | `/api/stores/abc/channels` | `/api/stores/:id/channels` | **NOTHING** | None | MISSING from Cloud Function |
| `/api/stores/${storeId}/channels` POST | `/api/stores/abc/channels` | `/api/stores/:id/channels` | **NOTHING** | None | MISSING + WRONG PATTERN — channel creation should require admin auth |
| `/api/stores/${storeId}/allowed-products` GET/POST | `/api/stores/abc/allowed-products` | `/api/stores/:id/allowed-products` | `/stores/:id/allowed-products` | None | CHECK |
| `/api/stores/qr-gear/collections?ownerId=...` GET | `/api/stores/qr-gear/collections?...` | `/api/stores/qr-gear/collections` | `/stores/qr-gear/collections` | None | OK |

**Files:**
- StoreModule.tsx:35, StorePickerModule.tsx:34 — POST to `/api/stores` (no auth, should be admin)
- ChannelModule.tsx:33, ChannelPickerModule.tsx:35 — POST to `/api/stores/:id/channels` (no auth, should be admin)
- admin-store-builder.tsx:445 — DELETE to `/api/stores/:id` (no auth, should be admin)

---

### PRICING (Public)

| Frontend Call | → Resolves To | → Dev Server | → Cloud Function | Auth | Status |
|--------------|--------------|-------------|-----------------|------|--------|
| `/api/pricing-settings` GET | `/api/pricing-settings` | `/api/pricing-settings` | `/pricing-settings` | None | OK |
| `/api/pricing-settings/sync` POST | `/api/pricing-settings/sync` | `/api/pricing-settings/sync` | `/pricing-settings/sync` | None | CHECK — should sync be public? |

---

### PRINTIFY (Public)

| Frontend Call | → Resolves To | → Dev Server | → Cloud Function | Auth | Status |
|--------------|--------------|-------------|-----------------|------|--------|
| `/api/printify/catalog/${id}` GET | `/api/printify/catalog/abc` | `/api/printify/catalog/:id` | `/printify/catalog/:id` | None | OK |
| `/api/printify/local-blueprints` GET | `/api/printify/local-blueprints` | `/api/printify/local-blueprints` | `/printify/local-blueprints` | None | OK |

---

### DYNAMICS (Public/Shared)

| Frontend Call | → Resolves To | → Dev Server | → Cloud Function | Auth | Status |
|--------------|--------------|-------------|-----------------|------|--------|
| `/api/dynamics/packets?storeId=...&channelId=...` GET | `/api/dynamics/packets?...` | `/api/dynamics/packets` | `/dynamics/packets` | None | OK |
| `/api/dynamics/instances` POST | `/api/dynamics/instances` | `/api/dynamics/instances` | `/dynamics/instances` | None | OK |
| `/api/dynamics/instances/${id}/preview` GET | `/api/dynamics/instances/abc/preview` | `/api/dynamics/instances/:id/preview` | `/dynamics/instances/:id/preview` | None | OK |

---

### BUYER (Public)

| Frontend Call | → Resolves To | → Dev Server | → Cloud Function | Auth | Status |
|--------------|--------------|-------------|-----------------|------|--------|
| `/api/buyer/instances/${id}/verify-renewal` POST | `/api/buyer/instances/abc/verify-renewal` | `/api/buyer/instances/:id/verify-renewal` | `/buyer/instances/:id/verify-renewal` | None | OK |
| `/api/buyer/instances/${id}/renew` POST | `/api/buyer/instances/abc/renew` | `/api/buyer/instances/:id/renew` | `/buyer/instances/:id/renew` | None | OK |

---

### CLAIM (Public)

| Frontend Call | → Resolves To | → Dev Server | → Cloud Function | Auth | Status |
|--------------|--------------|-------------|-----------------|------|--------|
| `/api/claim/${claimCode}` POST | `/api/claim/ABC123` | `/api/claim/:code` | `/claim/:code` | Cookie | CHECK — uses `credentials: 'include'` |

**Files:**
- claim.tsx:38 — uses cookie auth

---

### PUBLIC CHECKOUT & PACKETS

| Frontend Call | → Resolves To | → Dev Server | → Cloud Function | Auth | Status |
|--------------|--------------|-------------|-----------------|------|--------|
| `/api/public/checkout/verify/${sid}` GET | `/api/public/checkout/verify/abc` | `/api/public/checkout/verify/:sid` | `/public/checkout/verify/:sid` | None | OK |
| `/api/public/packets/${id}` GET | `/api/public/packets/abc` | `/api/public/packets/:id` | `/public/packets/:id` | None | OK |

---

### STOREFRONT (Public)

| Frontend Call | → Resolves To | → Dev Server | → Cloud Function | Auth | Status |
|--------------|--------------|-------------|-----------------|------|--------|
| `/api/storefront/generate-mockup` POST | `/api/storefront/generate-mockup` | `/api/storefront/generate-mockup` | `/storefront/generate-mockup` | None | OK |

---

### STORAGE (Internal)

| Frontend Call | → Resolves To | → Dev Server | → Cloud Function | Auth | Status |
|--------------|--------------|-------------|-----------------|------|--------|
| `/api/storage/health` GET | `/api/storage/health` | `/api/storage/health` | `/storage/health` | Cookie | CHECK — nexusTests.ts only |

---

## SECTION 4: ALL PROBLEMS — SORTED BY SEVERITY

### CRITICAL: Broken Auth (admin routes called without Bearer token) — 15 calls

| # | Frontend Call | File : Line | Problem |
|---|-------------|-------------|---------|
| 1 | `/api/admin/catalog/placements` | BuilderContext.tsx:210 | Cookie auth — MAIN BLOCKER for product builder |
| 2 | `${apiBase}/printify/catalog` | CatalogBrowserModule.tsx:49 | Cookie auth |
| 3 | `${apiBase}/products/${id}/sync-printify` | ProductConfigSkin.tsx:144 | Cookie auth |
| 4 | `${apiBase}/content/upload` | CreateGraphicsModule.tsx:657,746,768 | No auth at all (×3) |
| 5 | `${apiBase}/graphics/save` | CreateGraphicsModule.tsx:802 | No auth at all |
| 6 | `${apiBase}/templates/full-save` | CreateGraphicsModule.tsx:821 | No auth at all |
| 7 | `${apiBase}/queue/process` | CreateGraphicsModule.tsx:846 | No auth at all |
| 8 | `${apiBase}/store-product-links` | CreateGraphicsModule.tsx:855 | No auth at all |
| 9 | `${apiBase}/mockup/priority` | CreateGraphicsModule.tsx:939 | No auth at all |
| 10 | `${apiBase}/pricing-settings` GET | CreateGraphicsModule.tsx:480 | No auth at all |
| 11 | `${apiBase}/background-assets?type=cropped` | LibraryBackgroundPicker.tsx:67 | No auth at all |
| 12 | `${apiBase}/background-assets?type=background` | LibraryBackgroundPicker.tsx:77 | No auth at all |
| 13 | `${apiBase}/background-assets/${id}` DELETE | LibraryBackgroundPicker.tsx:113 | No auth at all |
| 14 | `${apiBase}/background-assets` POST | LibraryBackgroundPicker.tsx:129 | No auth at all |
| 15 | `${apiBase}/stores/by-id/${id}` | StoreLibraryContext.tsx:78 | No auth at all |
| 16 | `${apiBase}/stores/${id}/channels` | StoreLibraryContext.tsx:91 | No auth at all |

### HIGH: Wrong Path (name doesn't match any backend route) — 2 calls

| # | Frontend Call | File : Line | Sends | Should Be |
|---|-------------|-------------|-------|-----------|
| 1 | `${api.baseUrl}/stores/${storeId}` | StoreChannelDropdownModule.tsx:126 | `/api/admin/stores/abc` | `stores/by-id/abc` |
| 2 | `${api.baseUrl}/stores/${storeId}/channels/${channelId}` | StoreChannelDropdownModule.tsx:164 | `/api/admin/stores/.../channels/xyz` | Route doesn't exist |

### MEDIUM: Missing from Cloud Function — 1 route

| Route | Dev Server Has It | CF Has It |
|-------|------------------|-----------|
| `/stores/:storeId/channels` GET (public) | Yes | No |

### LOW: Wrong Pattern (public path used for admin-only action) — 5 calls

| # | Frontend Call | File : Line | Problem |
|---|-------------|-------------|---------|
| 1 | `/api/stores` POST | StoreModule.tsx:35, StorePickerModule.tsx:34 | Creates stores with no auth |
| 2 | `/api/stores/${id}/channels` POST | ChannelModule.tsx:33, ChannelPickerModule.tsx:35 | Creates channels with no auth |
| 3 | `/api/stores/${storeId}` DELETE | admin-store-builder.tsx:445 | Deletes stores with no auth |

### NEEDS VERIFICATION — 10+ calls

| # | Frontend Call | File | Question |
|---|-------------|------|----------|
| 1 | `${apiBase}/member/packets` POST | memberPacketService.ts | Does server require auth on member/* routes? |
| 2 | `${apiBase}/member/graphics/create` POST | memberPacketService.ts | Same question |
| 3 | `${apiBase}/member/templates/save` POST | memberPacketService.ts | Same question |
| 4 | `${apiBase}/member/library-links` POST/GET | memberPacketService.ts | Same question |
| 5 | `${apiBase}/member/play-packets` POST | memberVideoService.ts | Same question |
| 6 | `/api/members/allowed-products` GET/POST | admin-store-builder.tsx | Sent without auth — intentional? |
| 7 | `/api/claim/${code}` POST | claim.tsx | Uses cookie auth |
