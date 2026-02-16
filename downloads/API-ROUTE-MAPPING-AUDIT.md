# QR Gear API Route Mapping Audit

## How to Read This Document

- **Frontend Call** = exactly what the frontend code sends
- **Dev Server Route** = the route defined in `server/routes/*.ts`
- **Cloud Function Route** = the route defined in `functions/src/index.ts`
- **Auth Method** = how the frontend authenticates the call
- **Status** = MATCH (all 3 agree) | MISMATCH (something is wrong)

### Key Variables
- `apiBase` = `/api/admin` (from AdminAuthContext)
- `api.baseUrl` = `/api/admin` (same value, passed through ProductsContext)
- In production, Firebase Hosting rewrites `/api/**` → Cloud Function, which strips the `/api` prefix

So: Frontend `/api/admin/stores` → CF receives `/admin/stores`
And: Frontend `/api/stores` → CF receives `/stores`

### Auth Methods
- **Bearer** = `Authorization: Bearer <firebase-token>` header (works everywhere)
- **Cookie** = `credentials: 'include'` (only works in dev, FAILS in production)
- **None** = no auth sent (only works if route has no auth middleware)

---

## SECTION 1: Stores & Channels

| # | Frontend Call | Auth | Dev Server Route | CF Route | Status |
|---|-------------|------|-----------------|----------|--------|
| 1 | `${apiBase}/stores` → `/api/admin/stores` | Bearer | `/api/admin/stores` | `/admin/stores` | MATCH |
| 2 | `${apiBase}/stores?roleType=internal` | Bearer | `/api/admin/stores` | `/admin/stores` | MATCH |
| 3 | `${apiBase}/stores?roleType=${roleType}` | Bearer | `/api/admin/stores` | `/admin/stores` | MATCH |
| 4 | `${apiBase}/stores/by-id/${storeId}` → `/api/admin/stores/by-id/:storeId` | Bearer | `/api/admin/stores/by-id/:storeId` | `/admin/stores/by-id/:storeId` | MATCH |
| 5 | `${apiBase}/stores/${storeId}/channels` → `/api/admin/stores/:storeId/channels` | Bearer | `/api/admin/stores/:storeId/channels` | `/admin/stores/:storeId/channels` | MATCH |
| 6 | `${api.baseUrl}/stores` → `/api/admin/stores` | Bearer | `/api/admin/stores` | `/admin/stores` | MATCH |
| 7 | `${api.baseUrl}/stores/${storeId}` → `/api/admin/stores/:storeId` | Bearer | **NO ROUTE** (only `/api/admin/stores/by-id/:storeId` exists) | **NO ROUTE** | **MISMATCH** |
| 8 | `${api.baseUrl}/stores/${storeId}/channels` → `/api/admin/stores/:storeId/channels` | Bearer | `/api/admin/stores/:storeId/channels` | `/admin/stores/:storeId/channels` | MATCH |
| 9 | `${api.baseUrl}/stores/${storeId}/channels/${channelId}` → `/api/admin/stores/:storeId/channels/:channelId` | Bearer | **NO ROUTE** (no single-channel GET) | **NO ROUTE** | **MISMATCH** |
| 10 | `/api/stores` (hardcoded) | **None** | `/api/stores` (public, no auth) | `/stores` | MATCH (but see auth note below) |
| 11 | `/api/stores/${storeId}/channels` (hardcoded) | **None** | `/api/stores/:storeId/channels` (public) | `/stores/:storeId/channels` | **MISMATCH** — CF has NO public `/stores/:storeId/channels` route |

### Notes on Stores
- Row 7: `StoreChannelDropdownModule.tsx:126` calls `${api.baseUrl}/stores/${storeId}` but dev server only has `/api/admin/stores/by-id/:storeId`. These are different URL patterns. The call will 404.
- Row 9: `StoreChannelDropdownModule.tsx:164` calls `${api.baseUrl}/stores/${storeId}/channels/${channelId}` (single channel GET). No route exists in dev server or CF for fetching one channel by ID.
- Row 10-11: `StoreModule.tsx` and `ChannelModule.tsx` use hardcoded `/api/stores` paths with NO auth headers. Dev server has these as public routes. CF has `/stores` (public) but does NOT have public `/stores/:storeId/channels`.
- Row 10-11: `StorePickerModule.tsx` and `ChannelPickerModule.tsx` also use the same hardcoded paths with no auth.

---

## SECTION 2: Fulfillment & Catalog

| # | Frontend Call | Auth | Dev Server Route | CF Route | Status |
|---|-------------|------|-----------------|----------|--------|
| 12 | `${api.baseUrl}/catalog/sync-status` → `/api/admin/catalog/sync-status` | Bearer | `/api/admin/catalog/sync-status` | `/admin/catalog/sync-status` | MATCH |
| 13 | `${api.baseUrl}/catalog/sync` → `/api/admin/catalog/sync` | Bearer | `/api/admin/catalog/sync` | `/admin/catalog/sync` | MATCH |
| 14 | `${api.baseUrl}/catalog/sync-printful` → `/api/admin/catalog/sync-printful` | Bearer | `/api/admin/catalog/sync-printful` | `/admin/catalog/sync-printful` | MATCH |
| 15 | `/api/admin/catalog/placements?${params}` (hardcoded) | **Cookie** | `/api/admin/catalog/placements` (admin) | `/admin/catalog/placements` (requireAdmin) | **MISMATCH** — Cookie auth fails in production; CF needs Bearer token |
| 16 | `${api.baseUrl}/printify/catalog` → `/api/admin/printify/catalog` | Bearer | `/api/admin/printify/catalog` | `/admin/printify/catalog` | MATCH |
| 17 | `${api.baseUrl}/catalog/printful-products` → `/api/admin/catalog/printful-products` | Bearer | `/api/admin/catalog/printful-products` | `/admin/catalog/printful-products` | MATCH |
| 18 | `${apiBase}/printify/catalog?provider=${filter}` → `/api/admin/printify/catalog` | **Cookie** | `/api/admin/printify/catalog` | `/admin/printify/catalog` | **MISMATCH** — Cookie auth, CatalogBrowserModule.tsx:49 |

### Notes on Catalog
- **Row 15 is the main blocker**: `BuilderContext.tsx:210` fetches placements with `credentials: 'include'` (cookie auth). The Cloud Function's `requireAdmin` middleware checks for a Bearer token. This call silently fails in production, so selecting a product never loads the builder.
- Row 18: Same cookie auth problem in `CatalogBrowserModule.tsx`.

---

## SECTION 3: Pricing Settings

| # | Frontend Call | Auth | Dev Server Route | CF Route | Status |
|---|-------------|------|-----------------|----------|--------|
| 19 | `${apiBase}/pricing-settings` → `/api/admin/pricing-settings` | **None** | `/api/admin/pricing-settings` (admin) | `/admin/pricing-settings` (requireAdmin) | **MISMATCH** — No auth header sent in CreateGraphicsModule.tsx:480 |

### Notes on Pricing
- Row 19: `CreateGraphicsModule.tsx:480` does a bare `fetch()` with no auth headers. The dev server route requires `isAdmin`. The CF route requires `requireAdmin`. This call will fail with 401 in both dev and production unless the browser has a session cookie from dev.
- There IS a public `/pricing-settings` route (no admin prefix) in both dev server and CF that works without auth. But the frontend is calling the admin path without sending auth.

---

## SECTION 4: Packets (Product Packets)

| # | Frontend Call | Auth | Dev Server Route | CF Route | Status |
|---|-------------|------|-----------------|----------|--------|
| 20 | `${apiBase}/packets` POST → `/api/admin/packets` | Bearer (authFetch) | `/api/admin/packets` | `/admin/packets` | MATCH |
| 21 | `${apiBase}/packets/${packetId}` PATCH → `/api/admin/packets/:packetId` | Bearer (authFetch) | `/api/admin/packets/:packetId` | `/admin/packets/:packetId` | MATCH |
| 22 | `${apiBase}/packets/${packetId}` DELETE | Bearer (authFetch) | `/api/admin/packets/:packetId` | `/admin/packets/:packetId` | MATCH |
| 23 | `${apiBase}/packets?status=published&types=...` GET | Bearer (authFetch) | `/api/admin/packets` | `/admin/packets` | MATCH (query params handled server-side) |

### Notes on Packets
- Packets routes all use `authFetch` with proper Bearer token. These should work correctly.

---

## SECTION 5: Builder Actions (Graphics, Templates, Upload, Queue, Mockups)

| # | Frontend Call | Auth | Dev Server Route | CF Route | Status |
|---|-------------|------|-----------------|----------|--------|
| 24 | `${apiBase}/content/upload` POST → `/api/admin/content/upload` | **None** | `/api/admin/content/upload` | `/admin/content/upload` | **MISMATCH** — No auth headers sent (CreateGraphicsModule.tsx:657,746,768) |
| 25 | `${apiBase}/graphics/save` POST → `/api/admin/graphics/save` | **None** | `/api/admin/graphics/save` | `/admin/graphics/save` | **MISMATCH** — No auth headers sent (CreateGraphicsModule.tsx:802) |
| 26 | `${apiBase}/templates/full-save` POST → `/api/admin/templates/full-save` | **None** | `/api/admin/templates/full-save` | `/admin/templates/full-save` | **MISMATCH** — No auth headers sent (CreateGraphicsModule.tsx:821) |
| 27 | `${apiBase}/queue/process` POST → `/api/admin/queue/process` | **None** | `/api/admin/queue/process` | `/admin/queue/process` | **MISMATCH** — No auth headers sent (CreateGraphicsModule.tsx:846) |
| 28 | `${apiBase}/store-product-links` POST → `/api/admin/store-product-links` | **None** | `/api/admin/store-product-links` | `/admin/store-product-links` | **MISMATCH** — No auth headers sent (CreateGraphicsModule.tsx:855) |
| 29 | `${apiBase}/mockup/priority` POST → `/api/admin/mockup/priority` | **None** | `/api/admin/mockup/priority` (`/api/mockup/priority` also exists) | `/admin/mockup/priority` | **MISMATCH** — No auth headers sent (CreateGraphicsModule.tsx:939) |

### Notes on Builder Actions
- **ALL of rows 24-29 are broken in production.** `CreateGraphicsModule.tsx` uses bare `fetch()` calls without auth headers for these admin endpoints. They work in dev only because of session cookies.
- These are the calls that happen AFTER selecting a product — content upload, graphic save, template save, queue processing, store linking, and mockup generation. Even if we fix the product selection (Row 15), these would all fail next.

---

## SECTION 6: Shelf & Build Shelf

| # | Frontend Call | Auth | Dev Server Route | CF Route | Status |
|---|-------------|------|-----------------|----------|--------|
| 30 | `${api.baseUrl}/shelf-groups` GET/POST → `/api/admin/shelf-groups` | Bearer | `/api/admin/shelf-groups` | `/admin/shelf-groups` | MATCH |
| 31 | `${api.baseUrl}/shelf-groups/${groupId}` PATCH/DELETE | Bearer | `/api/admin/shelf-groups/:id` | `/admin/shelf-groups/:id` | MATCH |
| 32 | `${api.baseUrl}/build-shelf` GET/POST → `/api/admin/build-shelf` | Bearer | `/api/admin/build-shelf` | `/admin/build-shelf` | MATCH |
| 33 | `${api.baseUrl}/build-shelf/${itemId}` PATCH/DELETE | Bearer | `/api/admin/build-shelf/:id` | `/admin/build-shelf/:id` | MATCH |

### Notes on Shelf
- All shelf routes use proper Bearer auth via `api.getAuthHeaders()`. These should work.

---

## SECTION 7: Compose & Publish

| # | Frontend Call | Auth | Dev Server Route | CF Route | Status |
|---|-------------|------|-----------------|----------|--------|
| 34 | `${apiBase}/published-compose-items` GET | Bearer (authFetch) | `/api/admin/published-compose-items` | `/admin/published-compose-items` | MATCH |
| 35 | `${apiBase}/compose/publish` POST | Bearer (authFetch) | `/api/admin/compose/publish` | `/admin/compose/publish` | MATCH |

---

## SECTION 8: Other

| # | Frontend Call | Auth | Dev Server Route | CF Route | Status |
|---|-------------|------|-----------------|----------|--------|
| 36 | `${apiBase}/products` GET → `/api/admin/products` | Bearer | `/api/admin/products` | `/admin/products` | MATCH |
| 37 | `${apiBase}/background-assets?type=${type}` GET | Bearer | `/api/admin/background-assets` | `/admin/background-assets` | MATCH |
| 38 | `${apiBase}/partner-stores/${id}/products` GET | Bearer (authFetch) | `/api/admin/partner-stores/:id/products` | `/admin/partner-stores/:id/products` | MATCH |

---

## SUMMARY OF ALL MISMATCHES

### Critical (will cause production failures):

| Row | File | Problem | Fix Needed |
|-----|------|---------|------------|
| **15** | `BuilderContext.tsx:210` | Placements fetch uses `credentials: 'include'` (cookie auth) — FAILS in production | Change to use `api.getAuthHeaders()` Bearer token |
| **18** | `CatalogBrowserModule.tsx:49` | Catalog fetch uses `credentials: 'include'` — FAILS in production | Change to use Bearer auth |
| **19** | `CreateGraphicsModule.tsx:480` | Pricing-settings fetch has NO auth at all on admin endpoint | Either add auth headers, or change to use public `/api/pricing-settings` path |
| **24** | `CreateGraphicsModule.tsx:657,746,768` | Content upload — no auth headers | Add `getAuthHeaders()` to all 3 fetch calls |
| **25** | `CreateGraphicsModule.tsx:802` | Graphics save — no auth headers | Add `getAuthHeaders()` |
| **26** | `CreateGraphicsModule.tsx:821` | Template save — no auth headers | Add `getAuthHeaders()` |
| **27** | `CreateGraphicsModule.tsx:846` | Queue process — no auth headers | Add `getAuthHeaders()` |
| **28** | `CreateGraphicsModule.tsx:855` | Store-product-links — no auth headers | Add `getAuthHeaders()` |
| **29** | `CreateGraphicsModule.tsx:939` | Mockup priority — no auth headers | Add `getAuthHeaders()` |

### Medium (may cause issues in some flows):

| Row | File | Problem | Fix Needed |
|-----|------|---------|------------|
| **7** | `StoreChannelDropdownModule.tsx:126` | Calls `/api/admin/stores/${storeId}` but route is `/api/admin/stores/by-id/:storeId` | Change URL to use `stores/by-id/${storeId}` |
| **9** | `StoreChannelDropdownModule.tsx:164` | Calls `/api/admin/stores/${storeId}/channels/${channelId}` — no such route exists | Add route or remove call |
| **11** | `ChannelModule.tsx:33`, `ChannelPickerModule.tsx:35` | Calls public `/api/stores/:storeId/channels` — CF has no public version | Add public route to CF, or change to use admin path with auth |
| **10** | `StoreModule.tsx:35`, `StorePickerModule.tsx:34` | Calls public `/api/stores` — CF has it but with no auth, which works |  OK in CF |

### Pattern Summary
- **9 calls** in `CreateGraphicsModule.tsx` and `BuilderContext.tsx` are completely broken in production because they don't send Firebase Auth tokens
- **2 calls** use incorrect URL patterns that don't match any backend route
- **1 route** is missing from the Cloud Function (public stores/channels)

### Root Cause
The frontend mixes THREE different auth patterns:
1. `authFetch(url, getAuthHeaders, options)` — correct, always works
2. `fetch(url, { headers: await api.getAuthHeaders() })` — correct, always works
3. `fetch(url, { credentials: 'include' })` or bare `fetch(url, {...})` — **BROKEN in production**, only works in dev with session cookies
