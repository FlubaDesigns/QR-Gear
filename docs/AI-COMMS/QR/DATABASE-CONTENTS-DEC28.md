# QR Gear Database Contents
**Generated:** December 28, 2025
**Total Tables:** 57

---

## SUMMARY - TABLE ROW COUNTS

| Table | Rows | Purpose |
|-------|------|---------|
| `products` | 1 | Products for sale |
| `custom_designs` | 1 | Custom QR designs created |
| `mockup_cache` | 3 | Cached mockup images |
| `printify_print_providers` | 581 | Printify catalog (synced weekly) |
| `orders` | 0 | Customer orders |
| `users` | 2 | Registered users |
| `partner_stores` | 1 | Partner/white-label stores |
| `library_assets` | 2 | Background images for designs |
| `canonical_placements` | 15 | Print placement positions |

---

## PRODUCTS TABLE (1 row)

**Location:** `products` table in PostgreSQL

| ID | Name | Customer Price | Blueprint | Provider |
|----|------|----------------|-----------|----------|
| `custom_hello-world` | Unisex Cotton Crew Tee | $18.88 | 5 | 61 |

**Available Colors:**
- Heather Grey (#9CA3AF)
- Solid Black (#000000)
- Solid White (#FFFFFF)

**Mockups Stored At:** `mockups_by_color` JSON column
```json
{
  "Solid Black": {
    "front": "/api/files/mockup-5-61-solid-black-flat.jpg",
    "lifestyle": "/api/files/mockup-5-61-solid-black-lifestyle.jpg"
  },
  "Solid White": {
    "front": "/api/files/mockup-5-61-solid-white-flat.jpg",
    "lifestyle": "/api/files/mockup-5-61-solid-white-lifestyle.jpg"
  },
  "Heather Grey": {
    "front": "/api/files/mockup-5-61-heather-grey-flat.jpg",
    "lifestyle": "/api/files/mockup-5-61-heather-grey-lifestyle.jpg"
  }
}
```

---

## CUSTOM_DESIGNS TABLE (1 row)

**Location:** `custom_designs` table in PostgreSQL

| ID | Product Name | Blueprint | Provider |
|----|--------------|-----------|----------|
| `hello-world` | Unisex Cotton Crew Tee | (null) | (null) |

**Placement Images:** `placement_images` JSON column
```json
{
  "front-center": "/api/files/deb11da38777376f.png",
  "front-center-white": "/api/files/008bafe5c8f0d429.png"
}
```

**Note:** `front-center` = black QR artwork, `front-center-white` = white QR artwork

---

## MOCKUP_CACHE TABLE (3 rows)

**Location:** `mockup_cache` table in PostgreSQL

| ID | Color | Flat Mockup URL | Lifestyle URL | Artwork |
|----|-------|-----------------|---------------|---------|
| `4b98595a-...` | Solid White | `/api/files/mockup-5-61-solid-white-flat.jpg` | `/api/files/mockup-5-61-solid-white-lifestyle.jpg` | black |
| `674d8224-...` | Heather Grey | `/api/files/mockup-5-61-heather-grey-flat.jpg` | `/api/files/mockup-5-61-heather-grey-lifestyle.jpg` | white |
| `d4f80cb9-...` | Solid Black | `/api/files/mockup-5-61-solid-black-flat.jpg` | `/api/files/mockup-5-61-solid-black-lifestyle.jpg` | white |

---

## OBJECT STORAGE FILES

**Bucket:** `replit-objstore-ac4951d5-c3b2-403e-ab38-26bbe6c49386`
**Public URL Base:** `https://replit-objstore-ac4951d5-c3b2-403e-ab38-26bbe6c49386.replit.dev/public/`
**API Serve Route:** `/api/files/:filename` (in `server/routes.ts`)

### Files in Storage:
| Filename | Purpose | Size |
|----------|---------|------|
| `deb11da38777376f.png` | Black QR artwork | ~varies |
| `008bafe5c8f0d429.png` | White QR artwork | ~varies |
| `mockup-5-61-solid-white-flat.jpg` | White shirt flat mockup | ~84KB |
| `mockup-5-61-solid-white-lifestyle.jpg` | White shirt lifestyle mockup | ~varies |
| `mockup-5-61-solid-black-flat.jpg` | Black shirt flat mockup | ~varies |
| `mockup-5-61-solid-black-lifestyle.jpg` | Black shirt lifestyle mockup | ~varies |
| `mockup-5-61-heather-grey-flat.jpg` | Grey shirt flat mockup | ~varies |
| `mockup-5-61-heather-grey-lifestyle.jpg` | Grey shirt lifestyle mockup | ~varies |
| `0e5b81168f400db0.jpeg` | Background - Test 1 | ~varies |
| `4c9e3d2783a7bb61.jpeg` | Background - Open water | ~188KB |

---

## USERS TABLE (2 rows)

**Location:** `users` table in PostgreSQL

| ID | Email | First Name | Last Name |
|----|-------|------------|-----------|
| `test-user-001` | testuser@example.com | Test | User |
| `44633968` | perceys@gmail.com | David | Percey |

---

## PARTNER_STORES TABLE (1 row)

**Location:** `partner_stores` table in PostgreSQL

| ID | Slug | Name | Segments |
|----|------|------|----------|
| `1984a99c-...` | qr-gear-main-1766691190656 | QR Gear main | Test 1, Creator, Home |

---

## LIBRARY_ASSETS TABLE (2 rows)

**Location:** `library_assets` table in PostgreSQL

| ID | Name | File | Type |
|----|------|------|------|
| `72cc2f05-...` | Background - QR Gear main Test 1 | `/api/files/0e5b81168f400db0.jpeg` | background |
| `4cca3a07-...` | Open water | `/api/files/4c9e3d2783a7bb61.jpeg` | background |

---

## CANONICAL_PLACEMENTS TABLE (15 rows)

**Location:** `canonical_placements` table in PostgreSQL

| ID | Label | Category |
|----|-------|----------|
| FRONT_CHEST | Front Chest | apparel |
| FRONT_CENTER | Front Center | apparel |
| FRONT_POCKET | Front Pocket | apparel |
| BACK_FULL | Full Back | apparel |
| BACK_UPPER | Upper Back | apparel |
| LEFT_SLEEVE | Left Sleeve | apparel |
| RIGHT_SLEEVE | Right Sleeve | apparel |
| HAT_FRONT | Hat Front | headwear |
| HAT_BACK | Hat Back | headwear |
| HOOD_FRONT | Hood Front | apparel |
| HOOD_BACK | Hood Back | apparel |
| MUG_WRAP | Mug Wrap | drinkware |
| MUG_FRONT | Mug Front | drinkware |
| BAG_FRONT | Bag Front | bags |
| CASE_BACK | Case Back | accessories |

---

## PRINTIFY_PRINT_PROVIDERS TABLE (581 rows)

**Location:** `printify_print_providers` table in PostgreSQL
**Synced:** Weekly via cron job

Sample data:
| Blueprint ID | Provider ID | Min Cost | Max Cost |
|--------------|-------------|----------|----------|
| 18 | 3 | $11.74 | $13.93 |
| 12 | 26 | $13.65 | $25.23 |
| 6 | 30 | $8.77 | $11.03 |
| 5 | 61 | varies | varies |

---

## FILE LOCATIONS MAP

| What | Where | Type |
|------|-------|------|
| QR Artwork (black) | Object Storage: `custom-designs/deb11da38777376f.png` | PNG |
| QR Artwork (white) | Object Storage: `custom-designs/008bafe5c8f0d429.png` | PNG |
| Mockup images | Object Storage: `custom-designs/mockup-*.jpg` | JPEG |
| Background images | Object Storage: `library/admin/backgrounds/*.jpeg` | JPEG |
| Database | Neon PostgreSQL | 57 tables |
| Frontend code | `client/src/` | TypeScript/React |
| Backend code | `server/` | TypeScript/Express |
| Shared types | `shared/schema.ts` | Drizzle ORM |

---

## API ROUTES FOR DATA ACCESS

| Data | API Endpoint | Method |
|------|--------------|--------|
| Products | `/api/products` | GET |
| Single Product | `/api/products/:id` | GET |
| Featured Products | `/api/products?featured=true` | GET |
| Generate Mockup | `/api/storefront/generate-mockup` | POST |
| Serve Files | `/api/files/:filename` | GET |
| Cart | `/api/cart` | GET/POST/DELETE |

---

## THE CURRENT BUG

**Problem:** Home page shows plain white t-shirts with sizing info instead of QR mockups.

**Root Cause:** The `mockups_by_color` URLs in `products` table point to files that are **Printify blueprint stock photos**, NOT rendered mockups with QR artwork.

**What Files Contain:**
- Files ARE in Object Storage ✓
- Files ARE being served correctly ✓
- Files ARE **WRONG** - they show plain shirts, not QR shirts ✗

**Solution Needed:** Generate mockups locally by compositing QR artwork onto shirt templates, OR use Printify Mockup Generator API to get actual rendered mockups.

---

*Last updated: December 28, 2025*
