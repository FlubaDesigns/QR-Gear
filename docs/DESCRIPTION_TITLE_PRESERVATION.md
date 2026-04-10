# Description & Title Preservation — Product Catalog Architecture

**Status:** Ready to implement  
**Priority:** Critical  
**Affects:** master catalog, admin/products, sync pipeline, Cloud Functions

---

## The Problem in One Sentence

Provider syncs are overwriting (or nulling out) product titles and descriptions that were already set, and admin edits to title/description have nowhere safe to land without contaminating the master catalog.

---

## The Three-Layer Architecture

```
LAYER A — Master / Common Catalog       (provider-seeded, then read-only for text)
LAYER B — Working Catalog Entry         (admin-curated per active catalog)
LAYER C — Product Packet / Instance     (item-level per purchase/member)
```

### Layer A — Master Catalog (`master_catalog`)

- Populated once from provider ingest (Printify seeds title + description; Printful does not)
- After initial creation, **title and description are read-only**
- Sync may only update: `cost`, `colors`, `availability`, `images`, `lastSyncedAt`
- Sync must **never** write `null` or blank over an existing title/description

**Firestore fields:**
```
title               string   (seeded from Printify, never overwritten)
description         string   (seeded from Printify, never overwritten)
providerTitle       string   (raw provider value, updated each sync)
providerDescription string   (raw provider value, updated each sync)
cost                number
colors              array
availability        object
provider            string
providerProductId   string
lastSyncedAt        timestamp
```

### Layer B — Working Catalog Entry

- Created when an admin configures a product inside a specific catalog
- Can hold an edited title/description that overrides master for display
- Does **not** write back to master catalog

**Firestore fields:**
```
masterCatalogId   string
catalogId         string
title             string   (admin override)
description       string   (admin override)
customizedBy      string
updatedAt         timestamp
```

### Layer C — Product Packet / Instance

- The item used for a specific purchase, member QR, or store listing
- Carries exact title/description for that unit
- Does **not** write back to master or working catalog

**Firestore fields:**
```
sourceMasterCatalogId   string
sourceCatalogId         string
packetId                string
instanceOwnerId         string
title                   string
description             string
updatedAt               timestamp
```

---

## Display Resolution Order

Always resolve in this order — never skip layers:

```
effectiveTitle =
  packet.title
  ?? workingCatalog.title
  ?? master.title
  ?? ""

effectiveDescription =
  packet.description
  ?? workingCatalog.description
  ?? master.description
  ?? ""
```

### Shared Resolver (to create: `client/src/lib/resolveCatalogText.ts`)

```ts
function normalize(value?: string | null): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

export function resolveEffectiveTitle({
  packetTitle,
  catalogTitle,
  masterTitle,
}: {
  packetTitle?: string | null;
  catalogTitle?: string | null;
  masterTitle?: string | null;
}): string {
  return normalize(packetTitle) ?? normalize(catalogTitle) ?? normalize(masterTitle) ?? "";
}

export function resolveEffectiveDescription({
  packetDescription,
  catalogDescription,
  masterDescription,
}: {
  packetDescription?: string | null;
  catalogDescription?: string | null;
  masterDescription?: string | null;
}): string {
  return normalize(packetDescription) ?? normalize(catalogDescription) ?? normalize(masterDescription) ?? "";
}
```

---

## Sync Preservation Rule (Pseudo-code)

Apply this logic in **both** Cloud Functions sync and Express sync routes:

```
existing = current master_catalog record from Firestore

incomingTitle       = normalized provider title or null
incomingDescription = normalized provider description or null

finalTitle =
  existing.title?.trim()
    ? existing.title                              // already set — keep it
    : (incomingTitle?.trim() ? incomingTitle : null)   // seed from provider if available

finalDescription =
  existing.description?.trim()
    ? existing.description                        // already set — keep it
    : (incomingDescription?.trim() ? incomingDescription : null)  // seed if available

// Write to master_catalog:
{
  title:               finalTitle,
  description:         finalDescription,
  providerTitle:       incomingTitle,       // always update raw provider value
  providerDescription: incomingDescription, // always update raw provider value
  cost:                ...,                 // always update
  colors:              ...,                 // always update
  availability:        ...,                 // always update
  lastSyncedAt:        now,
}
```

### Printify vs Printful rules

| Field       | Printify sync       | Printful sync                          |
|-------------|---------------------|----------------------------------------|
| title       | Seed if blank       | Seed if blank AND Printful has a value |
| description | Seed if blank       | **Never write — Printful has none**    |
| cost        | Always update       | Always update                          |
| colors      | Always update       | Always update                          |
| images      | Always update       | Always update                          |

---

## Admin Save Rule

When admin edits title/description on a product card in `admin/products`:

```ts
await Promise.all([
  saveWorkingCatalogEntry({
    catalogId,
    productId,
    title: editedTitle,
    description: editedDescription,
  }),
  saveProductPacket({
    packetId,
    productId,
    title: editedTitle,
    description: editedDescription,
  }),
]);

// DO NOT write to master_catalog
```

---

## Critical Structural Bug — Two Collection Names

### Problem

Two collection names are currently active in production:

| Name              | Used in                                                      | Doc count |
|-------------------|--------------------------------------------------------------|-----------|
| `master_products` | Express routes, Cloud Functions (am-crud, orchestration)     | unknown   |
| `master_catalog`  | New CF sync service, constants.ts                            | 1,612     |

### Fix

**Canonical name: `master_catalog`**

Files that still write to / read from `master_products` (need updating):

- `server/services/auto-repricer.ts` (lines 250, 310, 348, 423)
- `server/services/qr-analytics.ts` (lines 201, 261)
- `server/routes/orchestration-pricing.routes.ts` (line 395)
- `server/routes/products.routes.ts` (lines 402, 540, 545, 550, 565)
- `functions/src/routes/orchestration.ts` (line 118)
- `functions/src/routes/am-crud.ts` (lines 290, 298, 306, 313, 320)
- `functions/src/routes/am-utility.ts` (line 66)
- `functions/src/routes/pp-catalog-browse.ts` (lines 371, 420)

### Migration plan

1. Add temporary fallback read: if doc not found in `master_catalog`, check `master_products`
2. Run one-time migration: copy `master_products` docs → `master_catalog` (preserve-first for title/description)
3. Update all reads/writes to `master_catalog`
4. Remove fallback after verification

---

## Files to Create / Modify

| File | Action |
|------|--------|
| `client/src/lib/resolveCatalogText.ts` | **Create** — shared resolver utility |
| `functions/src/services/master-catalog.ts` | **Modify** — preserve-first sync logic |
| `server/routes/products.routes.ts` | **Modify** — use `master_catalog`, preserve-first |
| `server/services/auto-repricer.ts` | **Modify** — rename collection |
| `server/services/qr-analytics.ts` | **Modify** — rename collection |
| `server/routes/orchestration-pricing.routes.ts` | **Modify** — rename collection |
| `functions/src/routes/am-crud.ts` | **Modify** — rename collection |
| `functions/src/routes/am-utility.ts` | **Modify** — rename collection |
| `functions/src/routes/pp-catalog-browse.ts` | **Modify** — rename + use `master_catalog` |
| `functions/src/routes/orchestration.ts` | **Modify** — rename collection |
| `client/src/features/adminProducts/builder/modules/ProductsModule.tsx` | **Modify** — use resolver |
| `client/src/features/adminProducts/controllers/useAdminBlanksController.ts` | **Modify** — use resolver |

---

## Verification Checklist

- [ ] `master_catalog` has 1,612+ docs (from CF sync run on 2026-04-10)
- [ ] `master_products` migration completed — docs copied, no title/description overwritten
- [ ] Sync run after fix: no existing title/description blanked
- [ ] admin/products displays resolved text (packet > catalog > master)
- [ ] Admin edit saves to working catalog + packet, not master
- [ ] Printful sync cannot null out a Printify-seeded description
- [ ] One broken product traced end-to-end and verified fixed
- [ ] `master_products` reads all removed from codebase
- [ ] CF functions redeployed with updated sync logic
