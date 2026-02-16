# QR Gear — API Route Naming Audit

## THE NAMING CONVENTION (Proposed Standard)

Every API call in the app should follow ONE of these two patterns:

### Pattern A: Admin Routes (requires login)
```
Frontend:   ${apiBase}/[resource]         which resolves to → /api/admin/[resource]
Dev Server: /api/admin/[resource]
Cloud Func: /admin/[resource]             (CF strips the /api prefix)
Auth:       Bearer token via getAuthHeaders() or authFetch()
```

### Pattern B: Public Routes (no login needed)
```
Frontend:   /api/[resource]               (hardcoded, no apiBase prefix)
Dev Server: /api/[resource]
Cloud Func: /[resource]                   (CF strips the /api prefix)
Auth:       None
```

### Rules
1. `apiBase` and `api.baseUrl` are ALWAYS `/api/admin` — never use them for public routes
2. EVERY admin fetch MUST include Bearer auth — either `authFetch()` or `{ headers: await getAuthHeaders() }`
3. NEVER use `credentials: 'include'` — that's cookie auth and only works in dev
4. NEVER do a bare `fetch(adminUrl, { body... })` without auth headers on an admin route
5. If a route needs no login (pricing lookups, public store pages), use Pattern B with no `/admin/` in the path

---

## THE FULL ROUTE MAP

Organized by resource name. Each row shows what the frontend CURRENTLY does vs what it SHOULD do.

### STORES

| Resource Path | Method | Frontend Currently Sends | Auth Currently | Should Be | Problem |
|--------------|--------|------------------------|----------------|-----------|---------|
| `/admin/stores` | GET | `${apiBase}/stores` | Bearer | No change needed | OK |
| `/admin/stores` | POST | `${apiBase}/stores` | Bearer | No change needed | OK |
| `/admin/stores/by-id/:id` | GET | `${api.baseUrl}/stores/${storeId}` | Bearer | `${api.baseUrl}/stores/by-id/${storeId}` | WRONG PATH — frontend says `/stores/:id`, backend expects `/stores/by-id/:id` |
| `/admin/stores/:id/channels` | GET | `${apiBase}/stores/${storeId}/channels` | Bearer | No change needed | OK |
| `/admin/stores/:id/channels` | POST | `${apiBase}/stores/${storeId}/channels` | Bearer | No change needed | OK |
| `/admin/stores/:id/channels/:cid` | GET | `${api.baseUrl}/stores/${storeId}/channels/${channelId}` | Bearer | Route doesn't exist | MISSING ROUTE — no backend handles single-channel GET |
| `/stores` (public) | GET | `/api/stores` (hardcoded) | None | No change needed | OK |
| `/stores` (public) | POST | `/api/stores` (hardcoded) | None | `${apiBase}/stores` with Bearer auth | WRONG — creating a store should be admin, not public/unauthenticated |
| `/stores/:id/channels` (public) | GET | `/api/stores/${storeId}/channels` (hardcoded) | None | No change needed (dev has it) | MISSING from CF — need to add public route |
| `/stores/:id/channels` (public) | POST | `/api/stores/${storeId}/channels` (hardcoded) | None | `${apiBase}/stores/${storeId}/channels` with Bearer auth | WRONG — creating a channel should be admin, not public/unauthenticated |

**Where the problems are:**
- `StoreChannelDropdownModule.tsx:126` — wrong URL path for single store GET
- `StoreChannelDropdownModule.tsx:164` — calls route that doesn't exist
- `StoreModule.tsx:35` — creates stores with no auth
- `StorePickerModule.tsx:34` — creates stores with no auth  
- `ChannelModule.tsx:33` — creates channels with no auth
- `ChannelPickerModule.tsx:35` — creates channels with no auth

---

### CATALOG & FULFILLMENT

| Resource Path | Method | Frontend Currently Sends | Auth Currently | Should Be | Problem |
|--------------|--------|------------------------|----------------|-----------|---------|
| `/admin/fulfillment-providers` | GET | `${apiBase}/fulfillment-providers` | Bearer | No change needed | OK |
| `/admin/catalog/sync` | POST | `${api.baseUrl}/catalog/sync` | Bearer | No change needed | OK |
| `/admin/catalog/sync-printful` | POST | `${api.baseUrl}/catalog/sync-printful` | Bearer | No change needed | OK |
| `/admin/catalog/sync-status` | GET | `${api.baseUrl}/catalog/sync-status` | Bearer | No change needed | OK |
| `/admin/catalog/placements` | GET | `/api/admin/catalog/placements` (hardcoded) | **Cookie** | `${api.baseUrl}/catalog/placements` with Bearer | BROKEN — cookie auth fails in production |
| `/admin/catalog/printful-products` | GET | `${api.baseUrl}/catalog/printful-products` | Bearer | No change needed | OK |
| `/admin/printify/catalog` | GET | `${api.baseUrl}/printify/catalog` | Bearer | No change needed | OK |
| `/admin/printify/catalog` | GET | `${apiBase}/printify/catalog` | **Cookie** | Same path but with Bearer auth | BROKEN — cookie auth fails in production |

**Where the problems are:**
- `BuilderContext.tsx:210` — placements fetch uses cookie auth, hardcoded path (THIS IS THE MAIN BLOCKER)
- `CatalogBrowserModule.tsx:49` — catalog fetch uses cookie auth

---

### PRICING

| Resource Path | Method | Frontend Currently Sends | Auth Currently | Should Be | Problem |
|--------------|--------|------------------------|----------------|-----------|---------|
| `/admin/pricing-settings` | GET | `${apiBase}/pricing-settings` | **None** | Either add Bearer auth, OR switch to public `/api/pricing-settings` | BROKEN — admin route called with no auth |
| `/admin/pricing-settings` | POST | `${apiBase}/pricing-settings` | Bearer | No change needed | OK |
| `/admin/pricing-settings/sync` | POST | `${apiBase}/pricing-settings/sync` | Bearer | No change needed | OK |
| `/pricing-settings` (public) | GET | Not used here (used elsewhere) | None | This one works fine | OK |

**Where the problem is:**
- `CreateGraphicsModule.tsx:480` — fetches admin pricing-settings with zero auth

---

### PACKETS

| Resource Path | Method | Frontend Currently Sends | Auth Currently | Should Be | Problem |
|--------------|--------|------------------------|----------------|-----------|---------|
| `/admin/packets` | POST | `${apiBase}/packets` | Bearer (authFetch) | No change needed | OK |
| `/admin/packets` | GET | `${apiBase}/packets` | Bearer (authFetch) | No change needed | OK |
| `/admin/packets/:id` | PATCH | `${apiBase}/packets/${id}` | Bearer (authFetch) | No change needed | OK |
| `/admin/packets/:id` | DELETE | `${apiBase}/packets/${id}` | Bearer (authFetch) | No change needed | OK |

All packet routes are correct — they all use `authFetch`.

---

### BUILDER ACTIONS (Content, Graphics, Templates, Queue, Links, Mockups)

| Resource Path | Method | Frontend Currently Sends | Auth Currently | Should Be | Problem |
|--------------|--------|------------------------|----------------|-----------|---------|
| `/admin/content/upload` | POST | `${apiBase}/content/upload` | **None** | Same path + Bearer auth | BROKEN — no auth on 3 separate calls |
| `/admin/graphics/save` | POST | `${apiBase}/graphics/save` | **None** | Same path + Bearer auth | BROKEN — no auth |
| `/admin/templates/full-save` | POST | `${apiBase}/templates/full-save` | **None** | Same path + Bearer auth | BROKEN — no auth |
| `/admin/queue/process` | POST | `${apiBase}/queue/process` | **None** | Same path + Bearer auth | BROKEN — no auth |
| `/admin/store-product-links` | POST | `${apiBase}/store-product-links` | **None** | Same path + Bearer auth | BROKEN — no auth |
| `/admin/mockup/priority` | POST | `${apiBase}/mockup/priority` | **None** | Same path + Bearer auth | BROKEN — no auth |

**Where ALL the problems are — ONE FILE:**
- `CreateGraphicsModule.tsx` lines 657, 746, 768 (content/upload ×3)
- `CreateGraphicsModule.tsx` line 802 (graphics/save)
- `CreateGraphicsModule.tsx` line 821 (templates/full-save)
- `CreateGraphicsModule.tsx` line 846 (queue/process)
- `CreateGraphicsModule.tsx` line 855 (store-product-links)
- `CreateGraphicsModule.tsx` line 939 (mockup/priority)

---

### SHELF & BUILD SHELF

| Resource Path | Method | Frontend Currently Sends | Auth Currently | Should Be | Problem |
|--------------|--------|------------------------|----------------|-----------|---------|
| `/admin/shelf-groups` | GET/POST | `${api.baseUrl}/shelf-groups` | Bearer | No change needed | OK |
| `/admin/shelf-groups/:id` | PATCH/DELETE | `${api.baseUrl}/shelf-groups/${id}` | Bearer | No change needed | OK |
| `/admin/build-shelf` | GET/POST | `${api.baseUrl}/build-shelf` | Bearer | No change needed | OK |
| `/admin/build-shelf/:id` | PATCH/DELETE | `${api.baseUrl}/build-shelf/${id}` | Bearer | No change needed | OK |

All shelf routes are correct.

---

### COMPOSE & PUBLISH

| Resource Path | Method | Frontend Currently Sends | Auth Currently | Should Be | Problem |
|--------------|--------|------------------------|----------------|-----------|---------|
| `/admin/published-compose-items` | GET | `${apiBase}/published-compose-items` | Bearer (authFetch) | No change needed | OK |
| `/admin/compose/publish` | POST | `${apiBase}/compose/publish` | Bearer (authFetch) | No change needed | OK |

All compose routes are correct.

---

### OTHER ADMIN

| Resource Path | Method | Frontend Currently Sends | Auth Currently | Should Be | Problem |
|--------------|--------|------------------------|----------------|-----------|---------|
| `/admin/products` | GET | `${apiBase}/products` | Bearer | No change needed | OK |
| `/admin/background-assets` | GET | `${apiBase}/background-assets` | Bearer | No change needed | OK |
| `/admin/partner-stores/:id/products` | GET | `${apiBase}/partner-stores/${id}/products` | Bearer (authFetch) | No change needed | OK |

All correct.

---

## SCOREBOARD

| Category | Total Calls | Working | Broken | 
|----------|------------|---------|--------|
| Stores & Channels | 10 | 6 | 4 |
| Catalog & Fulfillment | 8 | 6 | 2 |
| Pricing | 4 | 3 | 1 |
| Packets | 4 | 4 | 0 |
| Builder Actions | 6 | 0 | **6** |
| Shelf | 4 | 4 | 0 |
| Compose | 2 | 2 | 0 |
| Other Admin | 3 | 3 | 0 |
| **TOTAL** | **41** | **28** | **13** |

---

## FIX PLAN (sorted by impact)

### Fix 1: CreateGraphicsModule.tsx — 8 broken calls (highest impact)
Every bare `fetch()` in this file needs `headers: await getAuthHeaders()` added. This file already has `getAuthHeaders` imported and available — it's just not being used on these calls.

### Fix 2: BuilderContext.tsx — 1 broken call (the main blocker)
The placements fetch at line 210 needs to switch from `credentials: 'include'` to using `api.getAuthHeaders()` Bearer token. This is the call that fires when you click a product, and it's why the builder never loads.

### Fix 3: CatalogBrowserModule.tsx — 1 broken call
Same cookie-to-Bearer fix.

### Fix 4: StoreChannelDropdownModule.tsx — 2 wrong paths
- Line 126: Change `stores/${storeId}` to `stores/by-id/${storeId}`
- Line 164: Either add a single-channel GET route to the backend, or remove this call

### Fix 5: Cloud Function — 1 missing public route
Add `/stores/:storeId/channels` GET (public, no auth) to match dev server.

### Fix 6: StoreModule/ChannelModule — public create mutations with no auth
These POST to `/api/stores` and `/api/stores/:id/channels` with no auth. Should use admin path with Bearer auth since creating stores/channels is an admin action. Lower priority since the user flow may not hit these in the current products page.
