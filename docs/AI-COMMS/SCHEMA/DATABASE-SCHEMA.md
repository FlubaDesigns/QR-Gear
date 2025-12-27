# Complete Database Schema - QR Gear

## Table: products

```sql
CREATE TABLE products (
    id VARCHAR PRIMARY KEY,                    -- e.g., "custom_hello-world"
    printify_id TEXT,                          -- Printify product ID (null if unpublished)
    name TEXT NOT NULL,                        -- "Unisex Cotton Crew Tee"
    description TEXT,
    category TEXT NOT NULL,                    -- "QR Gear main/Home"
    base_price NUMERIC NOT NULL,               -- Printify base cost
    image_url TEXT,                            -- Default product image
    manufacturer TEXT,
    made_in_usa BOOLEAN DEFAULT FALSE,
    available_placements TEXT[],               -- ["front","back","neck"]
    available_colors JSONB,                    -- [{hex:"#000000",name:"Solid Black"}]
    available_sizes TEXT[],                    -- ["S","M","L","XL","2XL","3XL"]
    metadata JSONB,
    blueprint_id INTEGER,                      -- Printify blueprint ID (e.g., 5)
    print_provider_id INTEGER,                 -- Printify provider ID (e.g., 61)
    is_enabled BOOLEAN DEFAULT FALSE,
    markup_percent NUMERIC DEFAULT 0,
    markup_fixed NUMERIC DEFAULT 0,
    qr_production_cost NUMERIC DEFAULT 0,
    customer_price NUMERIC,                    -- FINAL PRICE TO CUSTOMER
    is_featured BOOLEAN DEFAULT FALSE,         -- Show on home page
    sort_order INTEGER DEFAULT 0,
    product_line TEXT DEFAULT 'all',
    default_placement TEXT DEFAULT 'front-chest',
    default_color TEXT,                        -- "Solid Black"
    mockups_by_color JSONB,                    -- {"Solid Black":{front:"url",lifestyle:"url"}}
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
```

## Table: custom_designs

```sql
CREATE TABLE custom_designs (
    id VARCHAR PRIMARY KEY,                    -- "hello-world"
    product_id INTEGER NOT NULL,               -- Legacy FK
    product_name TEXT NOT NULL,
    product_image TEXT,
    background_image_url TEXT,
    top_text JSONB,
    bottom_text JSONB,
    text_upcharge NUMERIC DEFAULT 2.00,
    store_type TEXT,
    store_name TEXT,
    segment TEXT,
    is_featured BOOLEAN DEFAULT FALSE,
    is_seasonal_promo BOOLEAN DEFAULT FALSE,
    qr_code_url TEXT,                          -- QR code image URL
    saved_to_library BOOLEAN DEFAULT FALSE,
    saved_to_store BOOLEAN DEFAULT FALSE,
    printify_composite_url TEXT,
    placements TEXT[] NOT NULL,                -- ["front-center"]
    landing_overlay JSONB,
    background_asset_id VARCHAR,
    template_variant TEXT DEFAULT 'url',
    dynamic_content_set_id VARCHAR,
    placement_configs JSONB,
    placement_images JSONB,                    -- {"front-center":"/api/files/xxx.png","front-center-white":"/api/files/yyy.png"}
    external_url TEXT,
    template_name TEXT,
    template_category TEXT,
    template_subcategory TEXT,
    owner_user_id VARCHAR,
    campaign_name TEXT,
    project_name TEXT NOT NULL,
    blueprint_id INTEGER,                      -- 5
    print_provider_id INTEGER,                 -- 61
    printify_product_id TEXT,
    print_ready_art_url TEXT,
    selected_colors TEXT[],                    -- ["Solid Black","Solid White"]
    default_color TEXT,
    publish_status TEXT DEFAULT 'draft',
    publish_error TEXT,
    mockups_by_color JSONB,                    -- {"Solid Black":{front:"url",lifestyle:"url"}}
    selected_variant_ids JSONB,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
```

## Table: mockup_cache

```sql
CREATE TABLE mockup_cache (
    id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id VARCHAR,                        -- FK to products.id
    blueprint_id INTEGER,
    print_provider_id INTEGER,
    color_name TEXT NOT NULL,                  -- "Solid Black"
    color_hex TEXT,                            -- "#000000"
    canonical_placement_id VARCHAR,            -- "FRONT_CHEST"
    artwork_url TEXT,                          -- QR artwork used
    artwork_variant TEXT DEFAULT 'black',      -- "black" or "white"
    mockup_url TEXT NOT NULL,                  -- FLAT MOCKUP URL
    mockup_url_hq TEXT,                        -- High quality version
    lifestyle_mockup_url TEXT,                 -- LIFESTYLE MOCKUP URL
    pod_provider_id VARCHAR,                   -- "printify"
    provider_mockup_id TEXT,
    status TEXT DEFAULT 'active',
    generated_at TIMESTAMP DEFAULT NOW(),
    expires_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW()
);
```

## Table: product_variants

```sql
CREATE TABLE product_variants (
    id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id VARCHAR NOT NULL,               -- FK to products.id
    printify_variant_id INTEGER NOT NULL,      -- Printify variant ID
    title TEXT NOT NULL,                       -- "Solid Black / S"
    size TEXT,                                 -- "S"
    color TEXT,                                -- "Solid Black"
    color_hex TEXT,                            -- "#000000"
    price NUMERIC NOT NULL,                    -- Variant price
    is_enabled BOOLEAN DEFAULT TRUE,
    is_in_stock BOOLEAN DEFAULT TRUE
);
```

## Table: product_placement_availability

```sql
CREATE TABLE product_placement_availability (
    id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id VARCHAR NOT NULL,               -- FK to products.id
    canonical_placement_id VARCHAR NOT NULL,   -- "FRONT_CHEST"
    artwork_black_url TEXT,                    -- Black QR artwork URL
    artwork_white_url TEXT,                    -- White QR artwork URL
    is_primary BOOLEAN DEFAULT FALSE,
    is_enabled BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW()
);
```

## Table: canonical_placements

```sql
CREATE TABLE canonical_placements (
    id VARCHAR PRIMARY KEY,                    -- "FRONT_CHEST"
    label TEXT NOT NULL,                       -- "Front Chest"
    description TEXT,
    category TEXT NOT NULL,                    -- "apparel"
    preview_x NUMERIC DEFAULT 0.5,
    preview_y NUMERIC DEFAULT 0.4,
    preview_scale NUMERIC DEFAULT 0.3,
    sort_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW()
);
```

## Table: provider_placement_mappings

```sql
CREATE TABLE provider_placement_mappings (
    id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
    pod_provider_id VARCHAR NOT NULL,          -- "printify"
    canonical_placement_id VARCHAR NOT NULL,   -- "FRONT_CHEST"
    provider_placement_key TEXT NOT NULL,      -- "front"
    override_x NUMERIC,
    override_y NUMERIC,
    override_scale NUMERIC,
    metadata JSONB,
    created_at TIMESTAMP DEFAULT NOW()
);
```

## Table: printify_print_providers

```sql
CREATE TABLE printify_print_providers (
    id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
    blueprint_id INTEGER NOT NULL,             -- Printify blueprint ID
    provider_id INTEGER NOT NULL,              -- Printify provider ID
    title TEXT NOT NULL,                       -- Provider name
    country TEXT,
    is_usa BOOLEAN DEFAULT FALSE,
    min_cost INTEGER,                          -- Min cost in cents
    max_cost INTEGER,                          -- Max cost in cents
    placeholder_product_id TEXT,
    costs_fetched_at TIMESTAMP,
    available_colors JSONB,                    -- [{hex,name}]
    available_sizes TEXT[],                    -- ["S","M","L"]
    last_synced_at TIMESTAMP DEFAULT NOW()
);
```

---

## Key Relationships

```
products.id ─────────────────┬──> custom_designs.product_id (via naming convention)
                             ├──> product_variants.product_id
                             ├──> product_placement_availability.product_id
                             └──> mockup_cache.product_id

products.blueprint_id ───────┬──> printify_print_providers.blueprint_id
products.print_provider_id ──┴──> printify_print_providers.provider_id

canonical_placements.id ─────┬──> product_placement_availability.canonical_placement_id
                             ├──> provider_placement_mappings.canonical_placement_id
                             └──> mockup_cache.canonical_placement_id
```

---

## JSONB Field Structures

### products.available_colors / custom_designs.selected_colors
```json
[
  {"hex": "#000000", "name": "Solid Black"},
  {"hex": "#FFFFFF", "name": "Solid White"},
  {"hex": "#9CA3AF", "name": "Heather Grey"}
]
```

### products.mockups_by_color / custom_designs.mockups_by_color
```json
{
  "Solid Black": {
    "front": "/api/files/mockup-5-61-solid-black-flat.jpg",
    "lifestyle": "/api/files/mockup-5-61-solid-black-lifestyle.jpg"
  },
  "Solid White": {
    "front": "/api/files/mockup-5-61-solid-white-flat.jpg",
    "lifestyle": "/api/files/mockup-5-61-solid-white-lifestyle.jpg"
  }
}
```

### custom_designs.placement_images
```json
{
  "front-center": "/api/files/deb11da38777376f.png",
  "front-center-white": "/api/files/008bafe5c8f0d429.png"
}
```
Note: "front-center" is black QR, "front-center-white" is white QR for dark shirts.

---

## Current Product Data Example

```sql
SELECT * FROM products WHERE id = 'custom_hello-world';

id: "custom_hello-world"
name: "Unisex Cotton Crew Tee"
blueprint_id: 5
print_provider_id: 61
available_colors: [
  {hex: "#9CA3AF", name: "Heather Grey"},
  {hex: "#000000", name: "Solid Black"},
  {hex: "#FFFFFF", name: "Solid White"}
]
available_sizes: ["S","M","L","XL","2XL","3XL"]
customer_price: 18.88
is_featured: true
mockups_by_color: {} -- EMPTY - THIS IS THE BUG
```
