# QR Gear — Products Canonical (Universal Resolver)

> Single source of truth for product resolution across all contexts.
> All contexts (admin, member, owner, external, marketplace) call the same endpoint and receive the same canonical shape.
> Schema map authority: ADMIN_SCHEMA_MAP.md

---

## Overview

The **Products Canonical** system replaces context-specific product queries with ONE universal resolver endpoint.

**Problem solved:**
- Members queried `memberProducts` (didn't exist)
- Admin queried `master_catalog` directly
- Owners had no unified query
- External sites/marketplaces each did their own thing
- Same data, named differently everywhere → Ghost couldn't wire them

**Solution:**
- One endpoint: `GET /api/products/canonical/:qrgCode`
- All contexts use it
- Returns identical canonical shape
- Context determines access level, not data structure

---

## Canonical Product Shape

Every response contains:

```typescript
{
  qrgCode: "QRG-11101",                      // Display format
  qrgBlankId: "11101",                       // Raw ID
  title: "Unisex Classic T-Shirt",
  description: "100% cotton crew neck",
  brand: "Printful",
  category: "Apparel",                       // Top-level
  subCategory: "T-Shirts",                   // QRG subcategory
  images: ["url1", "url2"],                  // Merged from both providers
  printifyImages: [...],                     // Printify-only
  printfulImages: [...],                     // Printful-only
  colors: [
    { name: "Black", code: "#000000" },
    { name: "White", code: "#FFFFFF" }
  ],
  sizes: [
    { name: "XS", code: "xs" },
    { name: "S", code: "s" }
  ],
  pricing: {
    minPrice: 12.99,
    maxPrice: 19.99,
    currency: "USD"
  },
  availability: {
    availableVia: ["Printify", "Printful"],
    printifyAvailable: true,
    printfulAvailable: true
  },
  metadata: {
    originCountry: "US",
    weight: 0.25,
    dimensions: {...},
    lastSyncedAt: "2026-05-26T..."
  },
  providers: {
    printify: {
      blueprintId: "123456",
      title: "Unisex Classic T-Shirt",
      productId: "py_12345"
    },
    printful: {
      productId: "12345",
      title: "Unisex Classic T-Shirt"
    }
  }
}
```

**Shape is identical** across all contexts. Context only affects: (1) who can call it, (2) how it gets used downstream.

---

## Endpoints

### GET /api/products/canonical/:qrgCode

Resolve a single product by QRG code.

**Query Parameters:**

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `context` | string | Yes | `admin` \| `member` \| `owner` \| `external` \| `marketplace` |
| `memberId` | string | If context=member | Member ID (must be authorized) |
| `ownerId` | string | If context=owner | Owner ID (must be authorized) |
| `provider` | string | If context=marketplace | Marketplace provider: `etsy` \| `amazon` \| `ebay` |

**Request Examples:**

```bash
# Admin context (requires admin auth)
GET /api/products/canonical/QRG-11101?context=admin

# Member context (requires member auth)
GET /api/products/canonical/QRG-11101?context=member&memberId=user_12345

# Owner context (requires owner auth)
GET /api/products/canonical/QRG-11101?context=owner&ownerId=owner_67890

# External/public context (no auth)
GET /api/products/canonical/QRG-11101?context=external

# Marketplace context (no auth, but requires provider)
GET /api/products/canonical/QRG-11101?context=marketplace&provider=etsy
```

**Response (200 OK):**

```json
{
  "success": true,
  "context": "member",
  "product": { /* CanonicalProduct */ },
  "resolvedAt": "2026-05-26T18:30:00Z"
}
```

**Error Responses:**

| Status | Error | Condition |
|--------|-------|-----------|
| 400 | "Invalid context parameter" | context not one of allowed values |
| 400 | "memberId required for member context" | context=member but no memberId |
| 400 | "ownerId required for owner context" | context=owner but no ownerId |
| 400 | "provider required for marketplace context" | context=marketplace but no provider |
| 403 | "Admin access required" | context=admin but not authenticated as admin |
| 403 | "Member access denied" | context=member but not authorized as that member |
| 404 | "Product not found: QRG-11101" | QRG code doesn't exist in master_catalog |
| 500 | Internal server error | Database or service failure |

---

### POST /api/products/canonical/batch

Resolve multiple products at once (returns partial success on mixed results).

**Request Body:**

```json
{
  "qrgCodes": ["QRG-11101", "QRG-12001", "QRG-13001"],
  "context": "external",
  "memberId": "user_12345",        /* optional, required if context=member */
  "ownerId": "owner_67890",        /* optional, required if context=owner */
  "provider": "etsy"               /* optional, required if context=marketplace */
}
```

**Response (200 OK):**

```json
{
  "success": true,
  "context": "external",
  "products": [
    { /* CanonicalProduct for QRG-11101 */ },
    { /* CanonicalProduct for QRG-12001 */ }
  ],
  "errors": [
    {
      "qrgCode": "QRG-13001",
      "error": "Product not found: QRG-13001"
    }
  ],
  "count": 2,
  "failureCount": 1,
  "resolvedAt": "2026-05-26T18:30:00Z"
}
```

**Behavior:**
- Resolves all products in parallel
- Returns successful products in `products[]`
- Returns failed products in `errors[]`
- Does NOT throw on partial failure
- Useful for member library loads, admin bulk operations

---

## Access Control

### Admin Context
- **Who:** Users with `isAdmin === true`
- **Access:** Full product data including all provider details
- **Use case:** Admin dashboard, product management, enrichment

### Member Context
- **Who:** Authenticated member (via Firebase ID token)
- **Must provide:** `memberId` query param
- **Access:** Full product data (members can see what they're working with)
- **Use case:** Member library, product builder, first product wizard

### Owner Context
- **Who:** User who has claimed/purchased an instance
- **Must provide:** `ownerId` query param
- **Access:** Public-facing product data (no internal admin fields)
- **Use case:** QR Dynamic app, owner dashboard, instance management

### External Context
- **Who:** Anyone (no auth required)
- **Access:** Public product data only (no pricing internal details)
- **Use case:** Public storefront, embedded widgets, SEO pages

### Marketplace Context
- **Who:** Anyone (no auth required, but requires provider)
- **Access:** Product data formatted for that marketplace's requirements
- **Use case:** Etsy/eBay/Amazon listing generation, order sync

---

## Data Flow Diagram

```
ANY CONTEXT
   |
   v
GET /api/products/canonical/:qrgCode?context=...&...
   |
   +-- Normalize QRG format (QRG-11101 → qrg_11101)
   |
   +-- Load from master_catalog
   |
   +-- Extract canonical fields:
   |     - Title, description, brand
   |     - Images (merged Printify + Printful)
   |     - Colors, sizes, pricing
   |     - Availability (which providers)
   |     - Provider mappings (blueprintId, productId)
   |
   +-- Verify context permissions
   |
   +-- Return CanonicalProduct
         (same shape for all contexts)
         |
         v
ADMIN     → uses full data for dashboard
MEMBER    → uses for library display
OWNER     → uses for instance control
EXTERNAL  → uses for storefront
MARKETPLACE → transforms for Etsy/eBay/Amazon
```

---

## Integration: Member Area Fix

**Before (Broken):**
```typescript
// MemberIndexView.tsx
const snapshot = await db.collection("memberProducts").get();
// ^ Collection doesn't exist
```

**After (Fixed):**
```typescript
// MemberIndexView.tsx
const response = await fetch(
  `/api/products/canonical/QRG-11101?context=member&memberId=${memberId}`
);
const { product } = await response.json();
// ^ Single source of truth. Same endpoint. All contexts.
```

**Member Library Load:**
```typescript
// Load all member's library instances
const instances = await db
  .collection('member_library_instances')
  .where('ownerMemberId', '==', memberId)
  .get();

// Resolve canonical data for each
const resolved = await Promise.all(
  instances.docs.map((doc) => {
    const baseSnapshot = doc.data().baseSnapshot;
    return fetch(
      `/api/products/canonical/${baseSnapshot.qrgCode}?context=member&memberId=${memberId}`
    ).then((r) => r.json());
  })
);

// Display resolved products
```

---

## Naming Standards Compliance

✅ **NAMING_STANDARDS.md Requirements:**
- Collection names unchanged (master_catalog, member_library_instances, etc.)
- No invented names (products-canonical is a service, not a collection)
- Code traced before changes (references master_catalog only)
- Single source of truth (one resolver, all contexts)
- Firestore fields preserved (qrgCode, qrgBlankId, etc.)

✅ **ADMIN_SCHEMA_MAP.md Compliance:**
- Respects QRG identity (qrg_STNNN in master_catalog)
- Respects provider mappings schema (providerMappings object)
- Does NOT duplicate schema logic across contexts
- Returns canonical shape matching admin expectations

✅ **REPLIT.md Compliance:**
- No guessing — code traces master_catalog source
- No duplication — one endpoint, not five
- Authority files respected (schema map controls structure)

---

## Implementation Notes

### For Developers

1. **Adding to functions/src/index.ts:**
   ```typescript
   import { register as registerProductsCanonical } from './routes/products-canonical';
   // ...
   registerProductsCanonical(app);
   ```

2. **Adding to server/routes/ (dev mirror):**
   - Copy products-canonical.ts to server/routes/ for local dev
   - Keep in sync with functions version

3. **Testing:**
   ```bash
   # Test single product
   curl "http://localhost:5001/api/products/canonical/QRG-11101?context=external"

   # Test with member auth
   curl -H "Authorization: Bearer $TOKEN" \
     "http://localhost:5001/api/products/canonical/QRG-11101?context=member&memberId=user_12345"

   # Test batch
   curl -X POST http://localhost:5001/api/products/canonical/batch \
     -H "Content-Type: application/json" \
     -d '{
       "qrgCodes": ["QRG-11101", "QRG-12001"],
       "context": "external"
     }'
   ```

4. **Updating Documentation:**
   - When endpoint changes, update this file
   - When new contexts added, update access control section
   - When canonical shape changes, update schema definition

---

## Future Considerations

- **Caching:** Could add Redis layer for frequently-accessed products
- **Enrichment:** Could trigger on-demand data refresh if data is stale
- **Filtering:** Could add `include=colors,sizes,pricing` to reduce payload
- **Localization:** Could add `locale` param for localized titles/descriptions
- **Analytics:** Could track which contexts access which products

---

## Related Documents

- **ADMIN_SCHEMA_MAP.md** — Canonical schema authority
- **NAMING_STANDARDS.md** — Naming rules (enforced here)
- **METHODOLOGY.md** — Five-layer architecture (served by this endpoint)
- **REPLIT.md** — Execution control (continuous refresh applies)
- **master-catalog.ts** — Implementation (resolver logic)
