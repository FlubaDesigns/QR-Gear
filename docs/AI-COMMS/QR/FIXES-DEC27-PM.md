# Mockup Fixes - December 27, 2025 (PM Session)

## Issues Fixed

### Issue 1: QR Artwork Variant Selection NOT Working

**Problem**: Black shirts displayed BLACK QR codes (invisible on dark fabric). The `isColorDark()` function existed but wasn't properly selecting white artwork.

**Root Cause**: Design stored artwork with keys `front-center` and `front-center-white`, but endpoint looked for `front-chest` and `front-chest-white`.

**Fix Applied** (`server/routes.ts` lines 4100-4108):
```javascript
// Support multiple naming conventions: front-chest, front-center, or just "front"
const blackArtwork = designPlacements["front-chest"] || 
                     designPlacements["front-chest-black"] || 
                     designPlacements["front-center"] ||
                     designPlacements["front-center-black"] ||
                     designPlacements["front"];
const whiteArtwork = designPlacements["front-chest-white"] || 
                     designPlacements["front-center-white"] ||
                     designPlacements["front-white"];
```

**Verification**:
```
[StorefrontMockup] Color Solid Black hex=#000000, needsWhiteQR=true
[StorefrontMockup] Using WHITE artwork for dark shirt: Solid Black
```

**Cache Now Shows**:
| Color | Artwork Variant |
|-------|----------------|
| Solid Black | white (correct!) |
| Solid White | black |
| Heather Grey | black |

---

### Issue 2: Lifestyle Mockups Not Stored in products.mockups_by_color

**Problem**: Lifestyle mockup URLs returned by API but not saved to product record.

**Root Cause**: Line 4138 only saved flat mockup:
```javascript
existingProductMockups[color] = { front: result.mockupUrl };
```

**Fix Applied** (`server/routes.ts` lines 4142-4145):
```javascript
existingProductMockups[color] = { 
  front: result.mockupUrl,
  lifestyle: result.lifestyleMockupUrl || undefined
};
```

---

## Lifestyle Mockup Limitation

**Finding**: Printify returns "lifestyle" URL with `camera_label=size-chart` (NOT a model wearing the product).

This is a **Printify product limitation** for blueprint 5 / provider 61. The "other" position image is a size chart, not a lifestyle photo.

**Options for true lifestyle mockups**:
1. Use different Printify blueprint that has model photos
2. Generate AI composite using base model image + QR overlay
3. Commission custom photography

---

## Files Changed

| File | Change |
|------|--------|
| `server/routes.ts` | Fixed artwork key lookup, added lifestyle storage |

---

## Database State After Fix

```sql
SELECT color_name, artwork_variant FROM mockup_cache WHERE blueprint_id = 5;
```
| color_name | artwork_variant |
|------------|-----------------|
| Heather Grey | black |
| Solid Black | white |
| Solid White | black |

---

*Written by Agent, December 27, 2025*
