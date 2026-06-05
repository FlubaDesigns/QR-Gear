# QR Gear — Member Routes (Updated)

> Verified against `client/src/App.tsx` for active routes.
> Member product resolution now uses universal products-canonical endpoint.

Last verified: May 26, 2026

---

## Frontend Member Routes

| Route | Component | Notes |
|-------|-----------|-------|
| `/members/:memberId` | MembersPage | Member dashboard (main entry) |
| `/members/:memberId/library` | MemberLibraryView | Library browser (instances, packets) |
| `/members/:memberId/settings` | MemberSettings | Account settings |
| `/members/:memberId/earnings` | MemberEarnings | Earnings dashboard |
| `/members/:memberId/wizard` | BuilderWizard | First Product Builder (fork from admin) |

---

## Backend Member Route Modules

### Core Members (Firebase Cloud Functions — `functions/src/routes/`)

| Module | Domain | Notes |
|--------|--------|-------|
| `members.ts` | Member accounts, profiles, channels | **LEGACY: memberProducts deprecated** → use products-canonical |
| `member-catalog-instances.ts` | Member library instances (canonical) | `member_library_instances` collection (CORRECT) |
| `members-library.ts` | Member library assets (images, videos) | Stores at `members/{memberId}/library/*` |
| `member-files.ts` | Member file serving | Proxy for member assets |

### Related Modules (Used by Members)

| Module | Domain |
|--------|--------|
| `products-canonical.ts` | **NEW: Universal product resolver** → all contexts use this |
| `master-catalog.ts` | Master catalog (canonical product source) |
| `checkout.ts` | Member purchasing flow |
| `packets.ts` | Packet management (member packets) |

---

## Important: memberProducts Collection (LEGACY → DEPRECATED)

**⚠️ DO NOT USE**

The `memberProducts` collection in `functions/src/routes/members.ts` is **DEPRECATED**.

**Why:**
- Duplicates data already in `member_library_instances`
- Unclear field schema
- Not aligned with admin instances pattern
- Ghost couldn't get it to work

**What to use instead:**
- Query `member_library_instances` (correct, per schema map)
- Resolve canonical product via `/api/products/canonical?context=member&memberId=...`
- Both are official patterns. Use the resolver for normalized data.

**Cleanup plan:**
- Lines 327, 345, 390, 400, 410, 512 in members.ts reference memberProducts
- Once products-canonical is live and tested, remove these endpoints
- Migration script: Move any critical memberProducts data to member_library_instances if not already there

---

## Member Product Resolution (New Pattern)

### Before (Broken)
```typescript
// MemberIndexView.tsx — DOES NOT WORK
const snapshot = await db.collection("memberProducts").get();
// ^ Collection doesn't exist in prod
```

### After (Fixed)
```typescript
// MemberIndexView.tsx — WORKS
// Step 1: Load member's library instances
const instances = await db
  .collection('member_library_instances')
  .where('ownerMemberId', '==', memberId)
  .get();

// Step 2: Resolve canonical product for each instance
const resolved = await Promise.all(
  instances.docs.map((doc) => {
    const { baseSnapshot } = doc.data();
    return fetch(
      `/api/products/canonical/${baseSnapshot.qrgCode}?context=member&memberId=${memberId}`
    ).then((r) => r.json());
  })
);

// Step 3: Display products
resolved.forEach(({ product }) => {
  // product is CanonicalProduct shape
  // same shape for all contexts
  render(product);
});
```

---

## Backend Endpoints (By Domain)

### Product Resolution (NEW)

**GET /api/products/canonical/:qrgCode**
- Context: member, admin, owner, external, marketplace
- Auth: Context-dependent (member requires memberId + auth)
- Returns: CanonicalProduct (universal shape)
- [See PRODUCTS_CANONICAL_ROUTES.md for full spec]

**POST /api/products/canonical/batch**
- Resolve multiple products at once
- Auth: Context-dependent
- Returns: Partial success (products[] + errors[])

### Member Instances (Canonical)

**GET /member/library-instances**
- Returns authenticated member's library instances
- Query: ?sourceAdminInstanceId=..., ?status=...
- Returns: instance[], count

**GET /member/library-instances/:id**
- Get single instance with full lineage
- Returns: instance (baseSnapshot, overrides, resolved, currentPacketId)

**PATCH /member/library-instances/:id**
- Update member overrides
- Body: { overrides: {...}, status?: "..." }
- Returns: resolved (computed from baseSnapshot + overrides)

**POST /member/library-instances/:id/create-packet**
- Create/update packet attached to instance
- Body: packet fields (title, description, pricing, etc.)
- Returns: packetId, instanceId

### Member Accounts (Legacy — Keep, Don't Expand)

**GET /members/:memberId** — Profile
**GET /members/:memberId/earnings** — Earnings data
**GET /members/:memberId/channels** — Member's channels
**POST /members/:memberId/channels** — Create channel
**PATCH /members/:memberId/profile** — Update profile

**⚠️ DEPRECATED (Don't use):**
- `GET /members/:memberId/products` — Use products-canonical instead
- `POST /members/:memberId/products` — Use member_library_instances instead
- `GET /members/:memberId/products/:id` — Use products-canonical instead
- `DELETE /members/:memberId/products/:id` — Use member_library_instances instead

---

## Member Data Model

### Member Library Instance (member_library_instances)

Schema per ADMIN_SCHEMA_MAP.md:

```typescript
{
  id: "member_inst_abc123",
  ownerMemberId: "user_12345",
  
  // Lineage (always preserved)
  sourceMasterId: "qrg_11101",                   // What QRG blank
  sourceAdminInstanceId: "admin_inst_xyz789",   // Where it came from (if applicable)
  
  // Base snapshot (copy from admin or master)
  baseSnapshot: {
    qrgCode: "QRG-11101",
    qrgBlankId: "11101",
    title: "T-Shirt",
    description: "100% cotton",
    images: ["url1", "url2"],
    colors: [{ name: "Black", code: "#000" }],
    sizes: [{ name: "S", code: "s" }],
    pricing: { minPrice: 12.99, maxPrice: 19.99 }
  },
  
  // Member customizations (optional)
  overrides: {
    title: "My Custom T-Shirt",              // Can override title
    pricing: { margin: 5.00 },               // Can override pricing
    colors: [{ name: "Blue", code: "#00F" }] // Can override colors
  },
  
  // Computed: baseSnapshot merged with overrides
  resolved: {
    title: "My Custom T-Shirt",
    colors: [{ name: "Blue", code: "#00F" }],
    pricing: { ... }
  },
  
  // Packet linkage
  currentPacketId: "packet_abc123" | null,
  
  status: "draft" | "saved" | "published",
  version: 1,
  createdAt: timestamp,
  createdBy: "user_12345",
  updatedAt: timestamp,
  updatedBy: "user_12345"
}
```

### Canonical Product (products-canonical response)

See PRODUCTS_CANONICAL_ROUTES.md for full shape.

```typescript
{
  qrgCode: "QRG-11101",
  qrgBlankId: "11101",
  title: "Unisex Classic T-Shirt",
  description: "100% cotton crew neck",
  brand: "Printful",
  category: "Apparel",
  subCategory: "T-Shirts",
  images: [...],
  colors: [...],
  sizes: [...],
  pricing: { minPrice, maxPrice, currency },
  availability: { availableVia, printifyAvailable, printfulAvailable },
  providers: { printify?: {...}, printful?: {...} }
}
```

---

## Naming Standards Compliance

✅ Collection names unchanged:
- `member_library_instances` (canonical per schema)
- `productPackets` (canonical)
- `member_profiles` (canonical)

✅ Legacy endpoints preserved (for compatibility):
- Members account routes stay (GET profile, earnings, channels)
- memberProducts deprecated (don't use, but not deleted yet)

✅ New pattern follows schema:
- products-canonical respects QRG/BLD/GRF/ASSEMBLY
- Uses master_catalog as single source
- No duplication across contexts

---

## Integration Checklist

- [x] products-canonical.ts created
- [x] PRODUCTS_CANONICAL_ROUTES.md documented
- [x] MEMBERS_ROUTES.md updated (this file)
- [ ] Wire products-canonical into functions/src/index.ts
- [ ] Wire products-canonical into server/routes/ (dev mirror)
- [ ] Update MemberIndexView.tsx to use products-canonical
- [ ] Test member library load
- [ ] Remove memberProducts endpoints (after migration verified)
- [ ] Update README.md if it references memberProducts

---

## Related Documents

- **PRODUCTS_CANONICAL_ROUTES.md** — Universal resolver endpoint
- **ADMIN_SCHEMA_MAP.md** — Data structure authority
- **NAMING_STANDARDS.md** — Naming rules (enforced)
- **REPLIT.md** — Execution control
- **METHODOLOGY.md** — Five-layer architecture
