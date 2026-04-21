# Firestore Collection Map — QR Gear

Last updated: April 21, 2026

All collections are top-level (no subcollections in active use).

---

## Master Catalog

| Collection | Purpose | Key fields |
|------------|---------|-----------|
| `master_catalog` | Provider-synced product catalog. One doc per blank product variant. Never manually edited. | title, description, brand, images[], colors[{name,hex}], sizes[], minPrice, maxPrice, printifyBlueprintId, printfulProductId, qrgId, qrgCategory, qrgSequence, lastSyncedAt |

**ID format:** `py_<blueprintId>` for Printify, `pf_<productId>` for Printful

---

## Admin Catalog

| Collection | Purpose | Key fields |
|------------|---------|-----------|
| `admin_build_sessions` | Temporary working scratch pads. Created when admin starts editing. Expire in 7 days. | sessionType, sourceMasterId, ownerAdminId, working{title, description, images, pricing, graphics{content{…}}}, status, expiresAt, committedInstanceId, draftName |
| `admin_catalog_instances` | Committed product records. Created by Build→Save. These are what the storefront reads. | instanceType, sourceMasterId, sourceSessionId, storeId, channelId, channelName, collectionName, currentPacketId, baseSnapshot{…}, overrides{…}, resolved{title, description, images, colors, sizes, pricing}, status, folderPath |

**Status values for admin_catalog_instances:** `draft` | `active` | `archived`

---

## Product Packets

| Collection | Purpose | Key fields |
|------------|---------|-----------|
| `productPackets` | Full build artifacts. One per Build+Save press. Contains graphic URLs, QR content, pricing, all style config. | productId, productName, effectiveTitle, pricing, qrContent, qrProductState, productGraphicUrl, compositeUrl, qrOnlyUrl, landingPageSnapshotUrl, headerStyle, footerStyle, storeId, channelId, channelName, collectionName, placements, colors, sizes |

---

## Templates

| Collection | Purpose | Key fields |
|------------|---------|-----------|
| `templates` (or `admin_templates`) | Saved reusable design templates. Created as a side-effect of every Build+Save. | name, description, category, artworkUrl, thumbnailUrl, qrContent, pricing, packetId, productId, colors, placements, headerStyle, footerStyle, qrSizePercent, backgroundUrl |

---

## Asset Library

| Collection | Purpose | Key fields |
|------------|---------|-----------|
| `admin_image_folders` | Named folders for organizing library images. | name, normalizedName, createdAt, createdBy |
| `admin_images` | Individual uploaded image metadata. | name, folder, storageUrl, mimeType, sizeBytes, width, height, uploadedBy, createdAt |

**Firebase Storage paths for assets:**
- `library/images/{folderName}/{timestamp}-{filename}` — Admin uploaded images
- `library/backgrounds/raw/` — Background images
- `library/backgrounds/cropped/` — Cropped versions

---

## Store & Channel Structure

| Collection | Purpose | Key fields |
|------------|---------|-----------|
| `stores` | Top-level store definitions. | name, roleType (internal/partner/external), isActive |
| `storeChannels` | Sales channel definitions. Doc ID = channel slug (e.g. `usa250`). | storeId, name, isActive |
| `storeProductLinks` | **LEGACY** — was the storefront product source. No longer read by the channel store route (replaced by admin_catalog_instances April 21 2026). Still written by Build+Save as a side-effect (Step 9). | storeId, channel, packetId, productName, compositeUrl, qrOnlyUrl, pricing, enabledColors, enabledSizes |

---

## User-Owned Product Instances (Claimed)

| Collection | Purpose | Key fields |
|------------|---------|-----------|
| `claimCodes` | One-use activation codes sent to customers after purchase. | code, status (unclaimed/claimed/expired), source (order/packet_share), orderId, packetId |
| `claimedInstances` | Activated product instances owned by end users. Hosting starts from claim time (not purchase). | claimCode, userId, packetId, hostingExpiresAt (1 year from claim), isActive |
| `member_packets` | Member-customized product builds. Similar structure to productPackets but owned by a member. | memberId, productId, productName, qrContent, pricing, storeId, channelId |

---

## Pricing & Settings

| Collection | Purpose | Key fields |
|------------|---------|-----------|
| `admin_settings` | Platform-wide settings. Includes pricing settings doc. | markupPercent, markupFixed, additionalPlacementCost, textLineUpcharge, hostingTiers[] |
| `systemSettings` | Catalog defaults and assignments. | Sub-docs: `catalog-defaults`, `catalog-assignments` |

---

## Provider Sync Cache

| Collection | Purpose | Key fields |
|------------|---------|-----------|
| `catalogs` | Named subsets of master_catalog blanks, curated by admin. | name, blankIds[], blankImages{}, blankDescriptions{}, blankTiers{}, tierConfig{} |

---

## Other Active Collections

| Collection | Purpose |
|------------|---------|
| `orders` | Customer orders with fulfillment state |
| `members` | Registered member accounts |
| `dynamics` | QR dynamic content entries |
| `categories` | Product category definitions |
| `admin_graphics` | Saved graphic records from Build+Save (Step 6) |
| `packets` | Alias/legacy — may point to same as productPackets in some routes |
