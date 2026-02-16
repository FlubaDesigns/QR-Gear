# QR Gear — API Route Name Map

## How Names Connect

```
FRONTEND VARIABLE          RESOLVES TO            DEV SERVER ROUTE         CLOUD FUNCTION ROUTE
─────────────────          ───────────            ────────────────         ────────────────────
apiBase                  = /api/admin              /api/admin/...           /admin/...
api.baseUrl              = /api/admin              /api/admin/...           /admin/...
(hardcoded /api/...)     = /api/...                /api/...                 /...
```

Firebase Hosting rewrites `/api/**` → Cloud Function, which strips `/api`.
So `/api/admin/stores` arrives at the Cloud Function as `/admin/stores`.

---

## ADMIN ROUTES (require Bearer auth)

Frontend uses `apiBase` or `api.baseUrl` (both = `/api/admin`)

| Frontend Name (left of fetch) | Resolves To | Dev Server Route | Cloud Function Route | Status |
|-------------------------------|-------------|------------------|---------------------|--------|
| **STORES** | | | | |
| `${apiBase}/stores` | `/api/admin/stores` | `/api/admin/stores` | `/admin/stores` | OK |
| `${apiBase}/stores?roleType=internal` | `/api/admin/stores?roleType=internal` | `/api/admin/stores` | `/admin/stores` | OK |
| `${apiBase}/stores?roleType=${roleType}` | `/api/admin/stores?roleType=...` | `/api/admin/stores` | `/admin/stores` | OK |
| `${apiBase}/stores/by-id/${storeId}` | `/api/admin/stores/by-id/abc` | `/api/admin/stores/by-id/:storeId` | `/admin/stores/by-id/:storeId` | OK |
| `${api.baseUrl}/stores` | `/api/admin/stores` | `/api/admin/stores` | `/admin/stores` | OK |
| `${api.baseUrl}/stores/${storeId}` | `/api/admin/stores/abc` | **NOTHING** | **NOTHING** | BROKEN — route is `stores/by-id/:id`, not `stores/:id` |
| `${api.baseUrl}/stores/${storeId}/channels` | `/api/admin/stores/abc/channels` | `/api/admin/stores/:storeId/channels` | `/admin/stores/:storeId/channels` | OK |
| `${api.baseUrl}/stores/${storeId}/channels/${channelId}` | `/api/admin/stores/abc/channels/xyz` | **NOTHING** | **NOTHING** | BROKEN — no single-channel GET route exists |
| **CATALOG** | | | | |
| `${api.baseUrl}/fulfillment-providers` | `/api/admin/fulfillment-providers` | `/api/admin/fulfillment-providers` | `/admin/fulfillment-providers` | OK |
| `${api.baseUrl}/catalog/sync` | `/api/admin/catalog/sync` | `/api/admin/catalog/sync` | `/admin/catalog/sync` | OK |
| `${api.baseUrl}/catalog/sync-printful` | `/api/admin/catalog/sync-printful` | `/api/admin/catalog/sync-printful` | `/admin/catalog/sync-printful` | OK |
| `${api.baseUrl}/catalog/sync-status` | `/api/admin/catalog/sync-status` | `/api/admin/catalog/sync-status` | `/admin/catalog/sync-status` | OK |
| `/api/admin/catalog/placements` (hardcoded) | `/api/admin/catalog/placements` | `/api/admin/catalog/placements` | `/admin/catalog/placements` | BROKEN AUTH — uses cookie instead of Bearer |
| `${api.baseUrl}/catalog/printful-products` | `/api/admin/catalog/printful-products` | `/api/admin/catalog/printful-products` | `/admin/catalog/printful-products` | OK |
| `${api.baseUrl}/printify/catalog` | `/api/admin/printify/catalog` | `/api/admin/printify/catalog` | `/admin/printify/catalog` | OK |
| `${apiBase}/printify/catalog` | `/api/admin/printify/catalog` | `/api/admin/printify/catalog` | `/admin/printify/catalog` | BROKEN AUTH — uses cookie instead of Bearer |
| **PRICING** | | | | |
| `${apiBase}/pricing-settings` (GET) | `/api/admin/pricing-settings` | `/api/admin/pricing-settings` | `/admin/pricing-settings` | BROKEN AUTH — sends no auth at all |
| `${apiBase}/pricing-settings` (POST) | `/api/admin/pricing-settings` | `/api/admin/pricing-settings` | `/admin/pricing-settings` | OK |
| `${apiBase}/pricing-settings/sync` | `/api/admin/pricing-settings/sync` | `/api/admin/pricing-settings/sync` | `/admin/pricing-settings/sync` | OK |
| **PACKETS** | | | | |
| `${apiBase}/packets` (POST) | `/api/admin/packets` | `/api/admin/packets` | `/admin/packets` | OK |
| `${apiBase}/packets` (GET) | `/api/admin/packets` | `/api/admin/packets` | `/admin/packets` | OK |
| `${apiBase}/packets/${id}` (PATCH) | `/api/admin/packets/abc` | `/api/admin/packets/:packetId` | `/admin/packets/:packetId` | OK |
| `${apiBase}/packets/${id}` (DELETE) | `/api/admin/packets/abc` | `/api/admin/packets/:packetId` | `/admin/packets/:packetId` | OK |
| **BUILDER ACTIONS** | | | | |
| `${apiBase}/content/upload` | `/api/admin/content/upload` | `/api/admin/content/upload` | `/admin/content/upload` | BROKEN AUTH — sends no auth |
| `${apiBase}/graphics/save` | `/api/admin/graphics/save` | `/api/admin/graphics/save` | `/admin/graphics/save` | BROKEN AUTH — sends no auth |
| `${apiBase}/templates/full-save` | `/api/admin/templates/full-save` | `/api/admin/templates/full-save` | `/admin/templates/full-save` | BROKEN AUTH — sends no auth |
| `${apiBase}/queue/process` | `/api/admin/queue/process` | `/api/admin/queue/process` | `/admin/queue/process` | BROKEN AUTH — sends no auth |
| `${apiBase}/store-product-links` | `/api/admin/store-product-links` | `/api/admin/store-product-links` | `/admin/store-product-links` | BROKEN AUTH — sends no auth |
| `${apiBase}/mockup/priority` | `/api/admin/mockup/priority` | `/api/admin/mockup/priority` | `/admin/mockup/priority` | BROKEN AUTH — sends no auth |
| **SHELF** | | | | |
| `${api.baseUrl}/shelf-groups` | `/api/admin/shelf-groups` | `/api/admin/shelf-groups` | `/admin/shelf-groups` | OK |
| `${api.baseUrl}/shelf-groups/${id}` | `/api/admin/shelf-groups/abc` | `/api/admin/shelf-groups/:id` | `/admin/shelf-groups/:id` | OK |
| `${api.baseUrl}/build-shelf` | `/api/admin/build-shelf` | `/api/admin/build-shelf` | `/admin/build-shelf` | OK |
| `${api.baseUrl}/build-shelf/${id}` | `/api/admin/build-shelf/abc` | `/api/admin/build-shelf/:id` | `/admin/build-shelf/:id` | OK |
| **COMPOSE** | | | | |
| `${apiBase}/published-compose-items` | `/api/admin/published-compose-items` | `/api/admin/published-compose-items` | `/admin/published-compose-items` | OK |
| `${apiBase}/compose/publish` | `/api/admin/compose/publish` | `/api/admin/compose/publish` | `/admin/compose/publish` | OK |
| **OTHER** | | | | |
| `${apiBase}/products` | `/api/admin/products` | `/api/admin/products` | `/admin/products` | OK |
| `${apiBase}/background-assets` | `/api/admin/background-assets` | `/api/admin/background-assets` | `/admin/background-assets` | OK |
| `${apiBase}/partner-stores/${id}/products` | `/api/admin/partner-stores/abc/products` | `/api/admin/partner-stores/:id/products` | `/admin/partner-stores/:id/products` | OK |

---

## PUBLIC ROUTES (no auth needed)

Frontend uses hardcoded `/api/...` paths (no `apiBase` prefix)

| Frontend Name (left of fetch) | Resolves To | Dev Server Route | Cloud Function Route | Status |
|-------------------------------|-------------|------------------|---------------------|--------|
| `/api/stores` (GET) | `/api/stores` | `/api/stores` | `/stores` | OK |
| `/api/stores` (POST) | `/api/stores` | `/api/stores` | `/stores` | WRONG — store creation should be admin with auth |
| `/api/stores/${storeId}/channels` (GET) | `/api/stores/abc/channels` | `/api/stores/:storeId/channels` | **NOTHING** | MISSING — CF has no public channels route |
| `/api/stores/${storeId}/channels` (POST) | `/api/stores/abc/channels` | `/api/stores/:storeId/channels` | **NOTHING** | MISSING + WRONG — channel creation should be admin with auth |
| `/api/pricing-settings` (GET) | `/api/pricing-settings` | `/api/pricing-settings` | `/pricing-settings` | OK |

---

## PROBLEMS SUMMARY

### BROKEN AUTH (names are right, auth is wrong) — 9 calls

These all point to the correct route name, but don't send the Firebase Bearer token.

| Frontend Name | File : Line | Current Auth | Fix |
|--------------|-------------|--------------|-----|
| `${apiBase}/content/upload` | CreateGraphicsModule.tsx : 657, 746, 768 | None | Add `await getAuthHeaders()` |
| `${apiBase}/graphics/save` | CreateGraphicsModule.tsx : 802 | None | Add `await getAuthHeaders()` |
| `${apiBase}/templates/full-save` | CreateGraphicsModule.tsx : 821 | None | Add `await getAuthHeaders()` |
| `${apiBase}/queue/process` | CreateGraphicsModule.tsx : 846 | None | Add `await getAuthHeaders()` |
| `${apiBase}/store-product-links` | CreateGraphicsModule.tsx : 855 | None | Add `await getAuthHeaders()` |
| `${apiBase}/mockup/priority` | CreateGraphicsModule.tsx : 939 | None | Add `await getAuthHeaders()` |
| `/api/admin/catalog/placements` | BuilderContext.tsx : 210 | Cookie | Switch to `${api.baseUrl}/catalog/placements` + Bearer |
| `${apiBase}/printify/catalog` | CatalogBrowserModule.tsx : 49 | Cookie | Switch to Bearer |
| `${apiBase}/pricing-settings` (GET) | CreateGraphicsModule.tsx : 480 | None | Switch to public `/api/pricing-settings` (no auth needed) |

### WRONG PATH (name doesn't match any route) — 2 calls

| Frontend Name | File : Line | What It Sends | What Backend Expects |
|--------------|-------------|---------------|---------------------|
| `${api.baseUrl}/stores/${storeId}` | StoreChannelDropdownModule.tsx : 126 | `/api/admin/stores/abc` | `/api/admin/stores/by-id/abc` |
| `${api.baseUrl}/stores/${storeId}/channels/${channelId}` | StoreChannelDropdownModule.tsx : 164 | `/api/admin/stores/abc/channels/xyz` | Route doesn't exist anywhere |

### MISSING FROM CLOUD FUNCTION — 1 route

| Route Needed | Dev Server Has It? | CF Has It? |
|-------------|-------------------|------------|
| `/stores/:storeId/channels` (public GET) | Yes | No |

### WRONG PATTERN (public path used for admin action) — 2 calls

| Frontend Name | File : Line | Problem |
|--------------|-------------|---------|
| `/api/stores` POST | StoreModule.tsx : 35, StorePickerModule.tsx : 34 | Creates stores with no auth — should be admin |
| `/api/stores/${id}/channels` POST | ChannelModule.tsx : 33, ChannelPickerModule.tsx : 35 | Creates channels with no auth — should be admin |
