# QR Gear — Admin Products Page: Problem Summary & Fix Guide

## What Happened (The Problem)

The admin products page at `/admin/products` needs to display the product catalog using the same view that was working on the test products page (`/test-products`). Multiple attempts were made to get this right, and each time the wrong version of the catalog view was restored.

### The Two Versions That Keep Getting Mixed Up

**VERSION A — The CORRECT one (what you had on test-products):**
- File: `client/src/features/adminProducts/modules/CatalogListModule.tsx`
- Uses: `SkinGridViewer` + `ProductCardSkin` + `ProductDetailSkin`
- ~177 lines
- Clean card grid with product images, color/size counts, calculated pricing
- No manual grid/list toggle buttons, no zoom modal, no delete buttons, no tag editor inline
- Found in git commit: `5e6ee4b0`

**VERSION B — The WRONG one (older, bloated version):**
- Same file path
- Uses: Manual `ProductRow` component with `Card`, `Switch`, `Button` for grid/list toggle
- ~552 lines
- Has zoom modal, delete buttons, enable/disable switches, inline tag editor
- Found in git commit: `0f5440a5`

The agent kept restoring Version B when you wanted Version A.

### The Test Endpoint Problem

The test products page used:
```tsx
<AdminAuthProvider apiBase="/api/test">
```

The admin products page needs to use:
```tsx
<AdminAuthProvider apiBase="/api/admin">
```

Additionally, `ProductsContext.tsx` had code that auto-defaulted to the "Test" channel on page load. This has been removed — it now only defaults to Internal role + QR Gear store (no channel auto-selected).

The `useSaveProduct.ts` hook had a `useTestEndpoints` parameter that allowed toggling between `/api/test` and `/api/admin` endpoints. This has been removed — all saves now go directly to `/api/admin`.

---

## File Map — What Each File Does

### Pages (entry points)
| File | Purpose |
|------|---------|
| `client/src/pages/admin-products.tsx` | The admin products page at `/admin/products`. Wraps everything in `AdminAuthProvider` with `apiBase="/api/admin"` and renders `ProductsHarness`. |
| `test-pages/test-products.tsx` | The OLD test products page. Same layout but used `apiBase="/api/test"`. This is the version whose VIEW you liked. |

### Core Components
| File | Purpose |
|------|---------|
| `client/src/features/adminProducts/ProductsHarness.tsx` | Main shell that renders FulfillmentPicker, SyncModule, StoreChannelDropdown, CatalogListModule, and BuilderHarness. Both admin and test pages use this same component. |
| `client/src/features/adminProducts/ProductsContext.tsx` | React context providing API methods, selected providers/role/store/channel state. All API calls use `apiBase` from `AdminAuthContext`. Auto-defaults to Internal role + QR Gear store on load. |
| `client/src/features/adminProducts/modules/CatalogListModule.tsx` | **THE KEY FILE.** This is the catalog view. Currently set to Version A (SkinGridViewer). If this gets overwritten with the 552-line version, that's the bug. |
| `client/src/features/adminProducts/modules/StoreChannelDropdownModule.tsx` | Role/Store/Channel picker with create/delete. |
| `client/src/features/adminProducts/modules/FulfillmentPickerModule.tsx` | Provider selection (Printify/Printful). |
| `client/src/features/adminProducts/modules/SyncModule.tsx` | Catalog sync buttons. |

### Shared Components (the Viewer/View/Skin pattern)
| File | Purpose |
|------|---------|
| `client/src/features/shared/components/SkinGridViewer.tsx` | Generic grid viewer that takes `SkinItem[]` and renders them using pluggable Card/Detail skins. Handles grid layout, click-to-expand detail view. |
| `client/src/features/shared/components/skins/ProductCatalogSkin.tsx` | `ProductCardSkin` (grid card) and `ProductDetailSkin` (expanded detail) — the actual product card rendering with image, name, price, color/size badges. |
| `client/src/features/shared/components/skins/PriceBreakdownSkin.tsx` | Shows base cost + QR upcharge + markup = customer price. |
| `client/src/features/shared/components/skins/types.ts` | `SkinItem` interface — the data shape that skins expect. |
| `client/src/features/shared/components/CollapsibleModule.tsx` | Collapsible section wrapper used by CatalogListModule. |

### Builder (product creation)
| File | Purpose |
|------|---------|
| `client/src/features/adminProducts/builder/BuilderHarness.tsx` | Product builder accordion. |
| `client/src/features/adminProducts/builder/BuilderContext.tsx` | Builder state management. |
| `client/src/features/adminProducts/builder/hooks/useSaveProduct.ts` | Save logic — templates, graphics, store assignment. All endpoints hardcoded to `/api/admin`. |

### Server Endpoints
| File | Purpose |
|------|---------|
| `server/routes.ts` | Route orchestrator — mounts all route modules. |
| `server/routes/products.routes.ts` | `/api/admin/products/*` — CRUD for products, toggle enable/disable, sync catalog. |
| `server/routes/stores.routes.ts` | `/api/admin/stores/*` — Stores and channels CRUD. |
| `server/routes/admin.routes.ts` | `/api/admin/*` — General admin endpoints (templates, graphics, library assets, fulfillment providers). |
| `server/routes/admin-library.routes.ts` | `/api/admin/library-assets/*` — Library asset management. |

### Auth
| File | Purpose |
|------|---------|
| `client/src/features/shared/AdminAuthContext.tsx` | Provides `apiBase`, `getAuthHeaders()`, and `requiresAuth` to all admin components. The `apiBase` prop determines whether calls go to `/api/admin` or `/api/test`. |

---

## How To Fix If It Breaks Again

1. **Check CatalogListModule.tsx** — It should be ~177 lines, import `SkinGridViewer` and `ProductCardSkin`. If it's 500+ lines with `ProductRow`, `ImageZoomModal`, `CategoryTagEditor` — that's the wrong version.

2. **The correct version** is in this zip at `client/src/features/adminProducts/modules/CatalogListModule.tsx` and also preserved in git at commit `5e6ee4b0`.

3. **Endpoints** — Every API call should go through `apiBase` which is set to `/api/admin` in `admin-products.tsx`. There should be NO hardcoded `/api/test` anywhere in the admin products feature.

4. **No test auto-defaults** — `ProductsContext.tsx` should NOT auto-select a "Test" channel. It should only default to Internal role + QR Gear store.

5. **No useTestEndpoints** — `useSaveProduct.ts` should NOT have a `useTestEndpoints` parameter. All saves go to `/api/admin/templates/full-save` and `/api/admin/graphics/save`.

---

## Key Endpoints Used by Admin Products Page

```
GET    /api/admin/fulfillment-providers     — List configured providers
GET    /api/admin/products                  — List all products
GET    /api/admin/products?provider=X       — List products by provider
POST   /api/admin/products/sync             — Sync Printify catalog
POST   /api/admin/catalog/sync-printful     — Sync Printful catalog
PATCH  /api/admin/products/:id/toggle       — Enable/disable product
DELETE /api/admin/products/:id              — Delete product
PUT    /api/admin/products/:id              — Update product
GET    /api/admin/stores?roleType=X         — List stores by role
GET    /api/admin/stores/:id/channels       — List channels for store
POST   /api/admin/stores                    — Create store
DELETE /api/admin/stores/:id                — Delete store
POST   /api/admin/stores/:id/channels       — Create channel
DELETE /api/admin/stores/:id/channels/:cid  — Delete channel
POST   /api/admin/templates/full-save       — Save template + queue mockups
POST   /api/admin/graphics/save             — Save graphics to library
GET    /api/admin/product-categories        — List categories for tagging
GET    /api/admin/products/:id/categories   — Get product category assignments
POST   /api/admin/products/:id/categories   — Update product categories
```
