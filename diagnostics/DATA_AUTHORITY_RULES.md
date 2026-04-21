# Data Authority Rules — QR Gear

Last updated: April 21, 2026

This document defines which layer owns which data fields, and how conflicts are resolved.

---

## The Three Layers

```
Layer 1: master_catalog       — Provider truth (Printify/Printful). Read-only.
Layer 2: admin_catalog_instances → overrides   — Admin edits. Wins over Layer 1.
Layer 3: member_packets       — Member customizations. Instance-only. Never written back up.
```

---

## Field Authority Table

| Field | Layer 1 (master) | Layer 2 (admin override) | Layer 3 (member) | Winner |
|-------|-----------------|------------------------|-----------------|--------|
| **title** | Provider title (e.g. "Unisex Jersey Short Sleeve Tee") | Admin override title | Member custom name | Admin > Provider. Member sees admin or provider. |
| **description** | Provider HTML description | Admin plain-text override | Member custom description | Admin > Provider. Member > Admin when set. |
| **images** | Provider images[] | Admin can replace image array | Not customizable | Admin > Provider |
| **colors** | Provider colors[{name,hex}] | Not overridden (uses provider list) | Member selects from available | Provider is authoritative |
| **sizes** | Provider sizes[] | Not overridden | Member selects from available | Provider is authoritative |
| **pricing.customerPrice** | Provider minPrice/maxPrice (cost, not retail) | Admin sets via markup formula | Not customizable | Admin only — provider cost is input, not output |
| **baseProductCost** | Provider minPrice or maxPrice | Admin selects which price point to use | N/A | Provider (via admin selection) |

---

## When Provider Data May Overwrite Fields

- **On master catalog sync** (`lastSyncedAt` updated): Provider data overwrites `master_catalog` docs only. It does NOT touch `admin_catalog_instances` or `productPackets`.
- `baseSnapshot` in `admin_catalog_instances` is a **snapshot taken at session creation**. It is never updated after that — even if the provider later changes the product. This is intentional: catalog instances are point-in-time snapshots.

---

## When Provider Data Must NOT Overwrite Fields

- `overrides` in `admin_catalog_instances` — admin deliberately set these. Provider sync must never touch them.
- `productPackets` — these are build artifacts, not live references. Provider sync does not touch packets.
- `member_packets` — member customizations are instance-only. Never written back.

---

## Whether Admin Edits Should Write Back to Catalog

**No.** Admin edits in the builder write forward (to `admin_build_sessions` working state, then to `admin_catalog_instances` on commit). They do NOT write back to `master_catalog`.

The only path back to `master_catalog` is the provider sync job.

---

## Whether Member Edits Should Remain Instance-Only

**Yes.** Member edits (custom description, custom name, uploaded image) live in `member_packets` only. They do not propagate to `admin_catalog_instances` or `master_catalog`. When a member views a product, the resolution is:

```
memberPacketDescription ?? adminCatalogDescription ?? providerDescription
```

This is computed at display time, not stored in a merged doc.

---

## Whether Packet Save Should Clone or Reference

**Clone (snapshot).** When a packet is created, all field values are copied into the `productPackets` doc at that moment. The packet does not hold a reference to the master_catalog doc. If the provider changes the product later, existing packets are unaffected.

This is intentional: once a product is built and committed, its spec is locked. The `baseSnapshot` in `admin_catalog_instances` serves the same purpose for the catalog layer.

---

## The `resolved` Field

`admin_catalog_instances.resolved` is a pre-merged view:

```
resolved = merge(baseSnapshot, overrides)
```

It is computed at commit time and stored. It is what the storefront reads directly — no runtime merge needed.

**Rule:** If `resolved.title` is null, the storefront shows "Untitled". There is no runtime fallback to master_catalog. The fix is to rebuild the instance.

---

## Summary: Single Source of Truth Per Layer

| Layer | Single source | Do not also read from |
|-------|--------------|----------------------|
| Storefront product title | `admin_catalog_instances.resolved.title` | `master_catalog.title` directly |
| Storefront product price | `admin_catalog_instances.resolved.pricing.customerPrice` | `master_catalog.minPrice` directly |
| Storefront product images | `admin_catalog_instances.resolved.images` | `master_catalog.images` directly |
| Admin builder default title | `admin_build_sessions.working.title` or `baseSnapshot.title` | Nowhere else |
