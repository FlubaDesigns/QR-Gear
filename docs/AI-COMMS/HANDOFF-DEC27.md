# COMPLETE AI HANDOFF DOCUMENT - December 27, 2025

**From:** Claude (QR Gear Agent)
**To:** Next AI Agent
**Status:** BROKEN - Mockups do NOT show QR artwork on shirts

---

## THE PROBLEM IN ONE SENTENCE

We are saving the **uploaded artwork URL** (just the QR image file) instead of the **rendered mockup** (the shirt with the QR printed on it).

---

## WHAT THE USER WANTS

A single **"project"** table that stores:
- Sizes
- Colors  
- All custom graphics (QR artwork black/white versions)
- **Rendered mockup images FROM PRINTIFY showing the QR design ON the shirt**

When user clicks a color swatch, the mockup image should swap instantly (no API calls).

---

## WHAT IS ACTUALLY HAPPENING

1. We upload QR artwork to Printify
2. We create a temp Printify product
3. We poll `print_areas[].placeholders[].images[].src`
4. **THAT URL IS JUST THE UPLOADED ARTWORK FILE** (e.g., `https://pfy-prod-image-storage.s3.us-east-2.amazonaws.com/...`)
5. We save that artwork URL thinking it's the mockup
6. We delete the temp product
7. **Result: Images shown are just the QR code, NOT the shirt with QR printed on it**

---

## WHAT PRINTIFY RETURNS (ACTUAL API RESPONSE)

```
product.images[] = Blueprint stock photos (plain shirt, NO artwork)
print_areas[].placeholders[].images[].src = Just the uploaded artwork file URL
print_areas[].placeholders[].images[].id = The image ID we uploaded
```

**NONE OF THESE ARE THE RENDERED MOCKUP WITH QR ON SHIRT**

---

## WHAT WE ACTUALLY NEED FROM PRINTIFY

Printify has a **Mockup Generator API** or returns mockups at a different location. Options:

1. **Mockup Generator Endpoint**: `POST /v1/mockup-generator/...`
2. **Wait for `images[].mockup_generated`** field to become true
3. **Use product.images[] AFTER publishing** (published products get rendered mockups)

**The current code does NOT use any of these approaches.**

---

## DATABASE TABLES AND ALL COLUMNS

### Table: `products`
| Column | Type | Purpose | Currently Used? |
|--------|------|---------|-----------------|
| id | varchar | Primary key (e.g., "custom_hello-world") | YES |
| printify_id | text | Printify product ID | NO (temp products deleted) |
| name | text | Product name | YES |
| description | text | Description | YES |
| category | text | Category | YES |
| base_price | numeric | Printify base cost | YES |
| image_url | text | Default image URL | YES (blueprint image) |
| manufacturer | text | Manufacturer name | NO |
| made_in_usa | boolean | USA made flag | NO |
| available_placements | text[] | Available placements | YES |
| available_colors | jsonb | `[{hex, name}, ...]` | YES |
| available_sizes | text[] | Size options | YES |
| metadata | jsonb | Extra data | YES |
| blueprint_id | integer | Printify blueprint ID | YES |
| print_provider_id | integer | Print provider ID | YES |
| is_enabled | boolean | Active flag | YES |
| markup_percent | numeric | Price markup % | YES |
| markup_fixed | numeric | Fixed markup $ | YES |
| qr_production_cost | numeric | QR production cost | YES |
| customer_price | numeric | **Final price shown to customer** | YES |
| is_featured | boolean | Show on home page | YES |
| sort_order | integer | Display order | YES |
| product_line | text | Product line | YES |
| default_placement | text | Default placement | YES |
| default_color | text | Default color name | YES |
| **mockups_by_color** | jsonb | `{"Solid Black": {front: "url", lifestyle: "url"}}` | YES - **THIS IS WHERE MOCKUPS SHOULD GO** |
| created_at | timestamp | Created date | YES |
| updated_at | timestamp | Updated date | YES |

### Table: `custom_designs`
| Column | Type | Purpose |
|--------|------|---------|
| id | varchar | Design ID (e.g., "hello-world") |
| product_id | integer | Legacy product ID |
| product_name | text | Product name |
| product_image | text | Product image URL |
| background_image_url | text | Background image |
| top_text | jsonb | Top text config |
| bottom_text | jsonb | Bottom text config |
| qr_code_url | text | QR code image URL |
| placements | text[] | Placement keys |
| **placement_images** | jsonb | `{"front-chest": "black_qr_url", "front-chest-white": "white_qr_url"}` |
| **mockups_by_color** | jsonb | Cached mockups per color |
| blueprint_id | integer | Printify blueprint |
| print_provider_id | integer | Print provider |
| printify_product_id | text | Live Printify product ID |
| selected_colors | text[] | Available colors |
| default_color | text | Default color |
| publish_status | text | draft/published |

### Table: `mockup_cache`
| Column | Type | Purpose |
|--------|------|---------|
| id | varchar | UUID primary key |
| product_id | varchar | Product ID |
| blueprint_id | integer | Blueprint ID |
| print_provider_id | integer | Provider ID |
| color_name | text | Color name |
| color_hex | text | Color hex |
| canonical_placement_id | varchar | Placement (e.g., "FRONT_CHEST") |
| artwork_url | text | Artwork URL used |
| artwork_variant | text | "black" or "white" |
| **mockup_url** | text | **FLAT MOCKUP URL - SHOULD BE RENDERED IMAGE** |
| mockup_url_hq | text | High quality version |
| **lifestyle_mockup_url** | text | **LIFESTYLE MOCKUP - SHOULD BE RENDERED IMAGE** |
| status | text | "active" or "expired" |
| generated_at | timestamp | When generated |

### Table: `product_variants`
| Column | Type | Purpose |
|--------|------|---------|
| id | varchar | UUID |
| product_id | varchar | FK to products |
| printify_variant_id | integer | Printify variant ID |
| title | text | Variant title |
| size | text | Size (S, M, L, etc.) |
| color | text | Color name |
| color_hex | text | Color hex code |
| price | numeric | Variant price |
| is_enabled | boolean | Available for sale |
| is_in_stock | boolean | In stock |

### Table: `product_placement_availability`
| Column | Type | Purpose |
|--------|------|---------|
| id | varchar | UUID |
| product_id | varchar | FK to products |
| canonical_placement_id | varchar | Placement ID |
| artwork_black_url | text | Black QR artwork URL |
| artwork_white_url | text | White QR artwork URL |
| is_primary | boolean | Primary placement |
| is_enabled | boolean | Enabled |

---

## DATA FLOW (CURRENT - BROKEN)

```
1. Frontend calls: POST /api/storefront/generate-mockup
   Body: {productId, color}

2. Route handler (routes.ts line ~6800):
   - Gets product from DB
   - Gets custom_design for artwork URLs
   - Determines artwork variant (black/white based on shirt color luminance)
   - Calls getMockupWithFallback()

3. getMockupWithFallback() (mockup-service.ts):
   - Checks mockup_cache table
   - If cache miss, calls generatePrintifyMockup()

4. generatePrintifyMockup():
   - Uploads artwork to Printify (printify.uploadImage)
   - Creates temp product with print_areas
   - Polls productDetails = printify.getProduct()
   - Looks for print_areas[].placeholders[].images[].src
   - **BUG: This is just the uploaded artwork URL, NOT the rendered mockup**
   - Downloads image, stores in Object Storage
   - Deletes temp Printify product
   - Returns URL

5. URL stored in:
   - mockup_cache.mockup_url
   - products.mockups_by_color
   - custom_designs.mockups_by_color

6. Frontend displays image from mockups_by_color[colorName].front
```

---

## DATA FLOW (REQUIRED - NOT IMPLEMENTED)

```
1. At product creation time (not on-demand):
   - Upload artwork to Printify
   - Create product with print_areas
   - EITHER:
     a) Call Printify Mockup Generator API
     b) Wait for product.images[] to have rendered mockups (may require publishing)
     c) Use third-party mockup service
   - Get RENDERED mockup URLs (shirt with QR visible)
   - Download and store in Object Storage
   - Save to products.mockups_by_color

2. Frontend color swatch click:
   - Just swap mockups_by_color[selectedColor].front
   - NO API calls needed
```

---

## KEY FILES AND THEIR ROLES

| File | Purpose |
|------|---------|
| `server/lib/mockup-service.ts` | Main mockup generation logic - **THIS IS BROKEN** |
| `server/lib/printify.ts` | Printify API wrapper |
| `server/routes.ts` | API endpoints including `/api/storefront/generate-mockup` |
| `server/storage.ts` | Database operations |
| `shared/schema.ts` | Drizzle ORM schema definitions |
| `client/src/components/FeaturedProducts.tsx` | Frontend product display |

---

## MOCKUP-SERVICE.TS FIELD MAPPING

### Input Parameters (MockupRequest interface):
```typescript
blueprintId: number       → From products.blueprint_id
printProviderId: number   → From products.print_provider_id
colorName: string         → User selected color
colorHex: string          → From products.available_colors[].hex
canonicalPlacementId: string → "FRONT_CHEST" etc.
artworkUrl: string        → From custom_designs.placement_images
artworkVariant: "black" | "white" → Determined by shirt color luminance
productId: string         → products.id
```

### Output Destinations:
```typescript
mockupUrl → mockup_cache.mockup_url
           → products.mockups_by_color[color].front
           → custom_designs.mockups_by_color[color].front

lifestyleMockupUrl → mockup_cache.lifestyle_mockup_url
                    → products.mockups_by_color[color].lifestyle
```

---

## THE FIX REQUIRED

### Option 1: Use Printify Mockup Generator API
```
POST https://api.printify.com/v1/shops/{shop_id}/products/{product_id}/mockup-generator.json
```
This returns rendered mockup images with artwork composited.

### Option 2: Keep Product and Wait for Mockups
Don't delete the temp product. Wait for Printify to render mockups, then:
```typescript
productDetails.images.find(img => img.position === 'front' && img.is_default)
```
These should have the artwork rendered after some processing time.

### Option 3: Use Third-Party Mockup Service
Services like Placeit or custom rendering.

---

## OBJECT STORAGE SETUP

Bucket ID: `replit-objstore-ac4951d5-c3b2-403e-ab38-26bbe6c49386`

Files stored in: `custom-designs/` folder

Served via: `/api/files/:filename` route

URL format: `/api/files/mockup-5-61-solid-black-flat.jpg`

---

## ENVIRONMENT VARIABLES

| Variable | Purpose |
|----------|---------|
| DEFAULT_OBJECT_STORAGE_BUCKET_ID | Replit Object Storage bucket |
| PRINTIFY_API_KEY | Printify API authentication |
| WIDGET_JWT_SECRET | JWT secret for KC widget |

---

## LOGS SHOWING THE BUG

```
[MockupService] Found rendered artwork preview: https://pfy-prod-image-storage.s3.us-east-2.amazonaws.com/21070892/d2919cd9-1239...
```

**That S3 URL is the UPLOADED ARTWORK FILE, not a rendered mockup.**

A real rendered mockup URL would look like:
```
https://images-api.printify.com/mockup/{product_id}/{variant_id}/...
```

---

## WHAT SUCCESS LOOKS LIKE

1. User visits home page
2. Featured products show t-shirt mockups with QR code VISIBLE ON THE SHIRT
3. User clicks different color swatch
4. Image swaps to show same QR code on different colored shirt
5. No loading delay (images pre-cached)

---

## IMMEDIATE NEXT STEPS FOR NEW AI

1. Research Printify Mockup Generator API documentation
2. Modify `generatePrintifyMockup()` to get actual rendered mockups
3. Test that returned URLs show QR artwork ON the shirt
4. Clear cache and regenerate all mockups
5. Verify frontend displays correct images

---

*Document created for AI handoff - December 27, 2025*
