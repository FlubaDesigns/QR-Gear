# QR Gear — System Truth Sheet

**Last updated**: March 2026
**Status**: Canonical reference — one source of truth

---

## Official Product Model

```
Store → Channel → Collection → Artifact
                                   ↓
                            QR Dynamics stitches
                            artifacts into a Mosaic
```

| Domain Concept     | Description                                        |
|--------------------|----------------------------------------------------|
| **Store**          | Top-level brand surface (e.g. `qr-gear`)           |
| **Channel**        | Thematic feed inside a store (e.g. `usa250`)        |
| **Collection**     | Curated grouping inside a channel                   |
| **Artifact**       | Individual content item or QR-linked object         |
| **Mosaic**         | Stitched interactive experience from artifacts      |
| **MosaicTemplate** | Reusable template for mosaic creation               |

---

## Official Storage Ownership

### Firestore Owns
- `stores` — Store records
- `channels` — Channel records
- `channel_items` — Artifact-level items in channels
- `collections` — Named groupings within channels
- `catalogs` — Product catalog definitions + blank assignments
- `systemSettings/*` — Catalog defaults, assignments, platform config
- `memberPackets` — Member-created product packets
- `site_programs` — Mosaic records (legacy collection name)
- `dynamicsCollections` — MosaicTemplate records (legacy collection name)
- `dynamicContentSets` — Dynamic content set definitions
- `dynamicPages` — Dynamic page records
- `qrDynamicsInstances` — QR Dynamics buyer instances
- `member_earnings` — Creator earning records
- `social_calendar` — Scheduled social media posts
- `nexusmail_queue` — Email queue for NexusMail
- Media/catalog/publishing records

### Postgres Owns
- `users` — User accounts
- `sessions` — Active sessions
- Relational commerce data (orders, carts, payment-linked records)

---

## Official Legacy Translation Map

| Legacy Name              | Canonical Name         | Status                          |
|--------------------------|------------------------|---------------------------------|
| `program`                | `Mosaic`               | Alias layer complete            |
| `program_series`         | `mosaic_series`        | Fully removed, only `mosaic_series` exists |
| `collectionTag`          | `collectionId`         | Fully removed, no dual-write or fallback |
| `dynamicsCollections`    | `MosaicTemplate`       | Alias constant, Firestore name unchanged |
| `site_programs`          | `mosaics`              | Alias layer via mosaicService.ts |
| `DEFAULT_STORE_ID`       | `PLATFORM_STORE_ID`    | Exported constant, no hidden default |
| `KC_ISSUER`              | `PLATFORM_ISSUER`      | Renamed, value unchanged for compat |
| `originalDescription`    | `providerDescription`  | Purged from client code         |
| `adminDescription`       | `adminCatalogDescription` | Purged from client code      |
| `customDescription`      | `memberPacketDescription` | Purged from client code      |
| `blueprintId` (raw)      | `canonicalBlankKey`    | All lookups use canonical key   |

---

## Platform Constants

| Constant              | Value                | Location                        |
|-----------------------|----------------------|---------------------------------|
| `PLATFORM_STORE_ID`   | `kingdom_connects`   | `server/lib/channelItemsService.ts` |
| `PLATFORM_ISSUER`     | `kingdom_connects`   | `server/lib/widget-auth.ts`     |
| `QR_GEAR_AUDIENCE`    | `qrgear_widget`      | `server/lib/widget-auth.ts`     |
| `KC_PARTNER_ISSUER`   | `kingdom_connects`   | `server/lib/kcWidgetService.ts` (partner-specific) |

---

## Security Rules

1. No plaintext API tokens — environment variables only (`PRINTIFY_API_KEY`, `WIDGET_JWT_KEYS`)
2. Widget auth always requires `WIDGET_JWT_KEYS` or `WIDGET_JWT_SECRET` — no dev fallback in any environment
3. JWT key rotation via `WIDGET_JWT_KEYS` JSON + `WIDGET_JWT_ACTIVE_KID`
4. All admin endpoints require `isAdmin` middleware on `/api/admin/*`
5. Public endpoints on `/api/public/*` — no authentication required

---

## License

**Proprietary — All rights reserved.**
`package.json` uses `UNLICENSED` (npm convention for proprietary).

---

## Key Architecture Files

| File                              | Purpose                                    |
|-----------------------------------|--------------------------------------------|
| `shared/domainModel.ts`           | Canonical domain interfaces                |
| `server/lib/domain-mappers.ts`    | Legacy Firestore → canonical normalization |
| `server/lib/mosaicService.ts`     | Mosaic alias over programService           |
| `server/lib/channelItemsService.ts` | Channel item CRUD (explicit storeId)     |
| `server/lib/widget-auth.ts`       | Widget JWT system                          |
| `server/lib/kcWidgetService.ts`   | Kingdom Connects partner integration       |
| `shared/blankKeys.ts`             | Canonical blank key derivation             |
| `shared/descriptionLayers.ts`     | Description cascade resolution             |
| `shared/wizardProduct.ts`         | Wizard product normalization               |
| `ARCHITECTURE_VIEWER.md`          | UI architecture canon                      |
| `ARCHITECTURE_IDENTITY.md`        | Product identity canon                     |
