# ICOM - COMPLETE FIELD REFERENCE FOR GHOST

## THE BUG
We save `print_areas[].placeholders[].images[].src` which is the UPLOADED ARTWORK URL, not the rendered mockup.

---

## ALL FIELD NAMES AND MAPPINGS

### mockup-service.ts INPUT FIELDS

| Field Name | Type | Source |
|------------|------|--------|
| `blueprintId` | number | `products.blueprint_id` |
| `printProviderId` | number | `products.print_provider_id` |
| `colorName` | string | User selection (e.g., "Solid Black") |
| `colorHex` | string | `products.available_colors[].hex` |
| `canonicalPlacementId` | string | "FRONT_CHEST" from `canonical_placements.id` |
| `artworkUrl` | string | `custom_designs.placement_images["front-center"]` or `["front-center-white"]` |
| `artworkVariant` | "black" \| "white" | Computed by `isColorDark(colorHex)` |
| `productId` | string | `products.id` (e.g., "custom_hello-world") |

### mockup-service.ts OUTPUT DESTINATIONS

| Output Field | Stored In |
|--------------|-----------|
| `mockupUrl` | `mockup_cache.mockup_url` |
| `mockupUrl` | `products.mockups_by_color[colorName].front` |
| `mockupUrl` | `custom_designs.mockups_by_color[colorName].front` |
| `lifestyleMockupUrl` | `mockup_cache.lifestyle_mockup_url` |
| `lifestyleMockupUrl` | `products.mockups_by_color[colorName].lifestyle` |

---

## DATABASE TABLES - EVERY COLUMN

### products (25 columns)
```
id                    VARCHAR   PK - "custom_hello-world"
printify_id           TEXT      Printify product ID
name                  TEXT      "Unisex Cotton Crew Tee"
description           TEXT      Description
category              TEXT      "QR Gear main/Home"
base_price            NUMERIC   Printify base cost
image_url             TEXT      Default product image
manufacturer          TEXT      Manufacturer
made_in_usa           BOOLEAN   USA made
available_placements  TEXT[]    ["front","back"]
available_colors      JSONB     [{hex:"#000000",name:"Solid Black"}]
available_sizes       TEXT[]    ["S","M","L","XL"]
metadata              JSONB     Extra data
blueprint_id          INTEGER   Printify blueprint (5)
print_provider_id     INTEGER   Printify provider (61)
is_enabled            BOOLEAN   Active
markup_percent        NUMERIC   Markup %
markup_fixed          NUMERIC   Fixed markup $
qr_production_cost    NUMERIC   QR cost
customer_price        NUMERIC   FINAL CUSTOMER PRICE
is_featured           BOOLEAN   Show on home
sort_order            INTEGER   Display order
product_line          TEXT      Product line
default_placement     TEXT      "front-chest"
default_color         TEXT      "Solid Black"
mockups_by_color      JSONB     {"Solid Black":{front:"url",lifestyle:"url"}}
created_at            TIMESTAMP
updated_at            TIMESTAMP
```

### custom_designs (37 columns)
```
id                      VARCHAR   PK - "hello-world"
product_id              INTEGER   Legacy FK
product_name            TEXT      Product name
product_image           TEXT      Image URL
background_image_url    TEXT      Background
top_text                JSONB     Top text config
bottom_text             JSONB     Bottom text config
text_upcharge           NUMERIC   Text upcharge
store_type              TEXT      Store type
store_name              TEXT      Store name
segment                 TEXT      Segment
is_featured             BOOLEAN   Featured
is_seasonal_promo       BOOLEAN   Seasonal
qr_code_url             TEXT      QR image URL
saved_to_library        BOOLEAN   Saved
saved_to_store          BOOLEAN   Saved
printify_composite_url  TEXT      Composite URL
placements              TEXT[]    ["front-center"]
landing_overlay         JSONB     Overlay config
background_asset_id     VARCHAR   Asset ID
template_variant        TEXT      "url"
dynamic_content_set_id  VARCHAR   Dynamic content
placement_configs       JSONB     Placement configs
placement_images        JSONB     {"front-center":"/api/files/xxx.png","front-center-white":"/api/files/yyy.png"}
external_url            TEXT      External URL
template_name           TEXT      Template name
template_category       TEXT      Category
template_subcategory    TEXT      Subcategory
owner_user_id           VARCHAR   Owner
campaign_name           TEXT      Campaign
project_name            TEXT      Project name
blueprint_id            INTEGER   Printify blueprint (5)
print_provider_id       INTEGER   Printify provider (61)
printify_product_id     TEXT      Live Printify ID
print_ready_art_url     TEXT      Print-ready art
selected_colors         TEXT[]    ["Solid Black","Solid White"]
default_color           TEXT      Default color
publish_status          TEXT      "draft" or "published"
publish_error           TEXT      Error message
mockups_by_color        JSONB     {"Solid Black":{front:"url"}}
selected_variant_ids    JSONB     Selected variants
created_at              TIMESTAMP
updated_at              TIMESTAMP
```

### mockup_cache (16 columns)
```
id                      VARCHAR   UUID PK
product_id              VARCHAR   FK to products.id
blueprint_id            INTEGER   Printify blueprint
print_provider_id       INTEGER   Printify provider
color_name              TEXT      "Solid Black"
color_hex               TEXT      "#000000"
canonical_placement_id  VARCHAR   "FRONT_CHEST"
artwork_url             TEXT      QR artwork used
artwork_variant         TEXT      "black" or "white"
mockup_url              TEXT      FLAT MOCKUP URL
mockup_url_hq           TEXT      HQ version
lifestyle_mockup_url    TEXT      LIFESTYLE URL
pod_provider_id         VARCHAR   "printify"
provider_mockup_id      TEXT      Provider ID
status                  TEXT      "active" or "expired"
generated_at            TIMESTAMP
expires_at              TIMESTAMP
created_at              TIMESTAMP
```

### product_variants (10 columns)
```
id                    VARCHAR   UUID PK
product_id            VARCHAR   FK to products.id
printify_variant_id   INTEGER   Printify variant ID
title                 TEXT      "Solid Black / S"
size                  TEXT      "S"
color                 TEXT      "Solid Black"
color_hex             TEXT      "#000000"
price                 NUMERIC   Price
is_enabled            BOOLEAN   Available
is_in_stock           BOOLEAN   In stock
```

### product_placement_availability (7 columns)
```
id                      VARCHAR   UUID PK
product_id              VARCHAR   FK to products.id
canonical_placement_id  VARCHAR   "FRONT_CHEST"
artwork_black_url       TEXT      Black QR URL
artwork_white_url       TEXT      White QR URL
is_primary              BOOLEAN   Primary placement
is_enabled              BOOLEAN   Enabled
created_at              TIMESTAMP
```

### canonical_placements (9 columns)
```
id            VARCHAR   PK - "FRONT_CHEST"
label         TEXT      "Front Chest"
description   TEXT      Description
category      TEXT      "apparel"
preview_x     NUMERIC   0.5
preview_y     NUMERIC   0.4
preview_scale NUMERIC   0.3
sort_order    INTEGER   0
is_active     BOOLEAN   true
created_at    TIMESTAMP
```

### provider_placement_mappings (8 columns)
```
id                      VARCHAR   UUID PK
pod_provider_id         VARCHAR   "printify"
canonical_placement_id  VARCHAR   "FRONT_CHEST"
provider_placement_key  TEXT      "front"
override_x              NUMERIC   Override X
override_y              NUMERIC   Override Y
override_scale          NUMERIC   Override scale
metadata                JSONB     Extra data
created_at              TIMESTAMP
```

### printify_print_providers (12 columns)
```
id                      VARCHAR   UUID PK
blueprint_id            INTEGER   Printify blueprint
provider_id             INTEGER   Printify provider
title                   TEXT      Provider name
country                 TEXT      Country
is_usa                  BOOLEAN   USA provider
min_cost                INTEGER   Min cost cents
max_cost                INTEGER   Max cost cents
placeholder_product_id  TEXT      Placeholder ID
costs_fetched_at        TIMESTAMP Last fetch
available_colors        JSONB     [{hex,name}]
available_sizes         TEXT[]    ["S","M","L"]
last_synced_at          TIMESTAMP
```

---

## PRINTIFY API RESPONSE STRUCTURE

### What we GET (WRONG):
```javascript
product.print_areas[0].placeholders[0].images[0].src
// Returns: "https://pfy-prod-image-storage.s3.us-east-2.amazonaws.com/..."
// This is the UPLOADED ARTWORK file, NOT the rendered mockup
```

### What we NEED:
```javascript
// Option 1: Mockup Generator API
POST /v1/shops/{shop_id}/products/{product_id}/mockup-generator.json

// Option 2: Wait for product.images after publishing
product.images[].src where is_selected_for_publishing = true
```

---

## OBJECT STORAGE

Bucket: `replit-objstore-ac4951d5-c3b2-403e-ab38-26bbe6c49386`
Folder: `custom-designs/`
Served via: `/api/files/:filename`
URL format: `/api/files/mockup-5-61-solid-black-flat.jpg`

---

## KEY FILES

| File | Purpose |
|------|---------|
| `server/lib/mockup-service.ts` | Mockup generation - BROKEN |
| `server/lib/printify.ts` | Printify API wrapper |
| `server/routes.ts` | API endpoints |
| `server/storage.ts` | Database operations |
| `shared/schema.ts` | Drizzle ORM schema |
| `client/src/components/FeaturedProducts.tsx` | Frontend display |

---

## THE FIX

Use Printify Mockup Generator API or wait for rendered mockups in `product.images[]` after publishing. Current code gets artwork URL, not rendered mockup.
