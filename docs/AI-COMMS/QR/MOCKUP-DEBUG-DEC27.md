# Mockup Display Debug Session - December 27, 2025

## CRITICAL ISSUE FOR NEXT AGENT

**Problem**: Featured products on home page do NOT display Printify mockup images when users click color swatches. The image stays static.

---

## What Works (Verified)

1. **API Endpoint**: `/api/storefront/generate-mockup` returns valid Printify URLs
2. **Database**: `products.mockups_by_color` has correct Printify URLs  
3. **Mockup Cache**: `mockup_cache` table has valid entries
4. **Images Accessible**: Printify mockup URLs download valid JPEGs (53KB+)
5. **Pricing**: Admin-configured `customer_price` displays correctly

---

## What Doesn't Work

- ProductCard image does NOT update when color swatches clicked
- Image remains static showing default product image
- No console errors when clicking swatches

---

## ALL CODE CHANGES ATTEMPTED

### Change 1: Added lifestyleMockupUrl to API response
**File**: `server/routes.ts` lines 4160-4167
**Before**:
```javascript
res.json({ 
  success: true, 
  color, 
  mockupUrl: result.mockupUrl, 
  fromCache: result.fromCache,
  mockupsByColor: existingProductMockups 
});
```
**After**:
```javascript
res.json({ 
  success: true, 
  color, 
  mockupUrl: result.mockupUrl,
  lifestyleMockupUrl: result.lifestyleMockupUrl,
  fromCache: result.fromCache,
  mockupsByColor: existingProductMockups 
});
```

### Change 2: Added URL validation in handleColorChange
**File**: `client/src/components/FeaturedProducts.tsx` lines 69-82
**Before**:
```typescript
const handleColorChange = async (color: string) => {
  setSelectedColor(color);
  
  const hasPreloaded = product.mockupsByColor?.[color]?.front || product.mockupsByColor?.[color]?.lifestyle;
  const hasDynamic = dynamicMockups[color]?.front || dynamicMockups[color]?.lifestyle;
  
  if (hasPreloaded || hasDynamic) return;
```
**After**:
```typescript
const handleColorChange = async (color: string) => {
  setSelectedColor(color);
  
  // Helper to check if URL is valid (HTTP URL)
  const isValidMockupUrl = (url?: string) => url && url.startsWith('http');
  
  // Check if we already have a valid mockup (preloaded or dynamically fetched)
  const hasPreloaded = isValidMockupUrl(product.mockupsByColor?.[color]?.front) || 
                       isValidMockupUrl(product.mockupsByColor?.[color]?.lifestyle);
  const hasDynamic = isValidMockupUrl(dynamicMockups[color]?.front) || 
                     isValidMockupUrl(dynamicMockups[color]?.lifestyle);
  
  if (hasPreloaded || hasDynamic) return;
```

### Change 3: Added URL validation in getCurrentMockup
**File**: `client/src/components/FeaturedProducts.tsx` lines 109-136
**Before**:
```typescript
const getCurrentMockup = (): { url: string | null; isLifestyle: boolean } => {
  const color = selectedColor || product.defaultColor || availableColors[0];
  
  // Check dynamic mockups first (fetched on color change)
  if (color && dynamicMockups[color]) {
    if (dynamicMockups[color].lifestyle) {
      return { url: dynamicMockups[color].lifestyle!, isLifestyle: true };
    }
    if (dynamicMockups[color].front) {
      return { url: dynamicMockups[color].front!, isLifestyle: false };
    }
  }
  
  // Fall back to pre-loaded mockups from product data
  if (product.mockupsByColor && color && product.mockupsByColor[color]) {
    if (product.mockupsByColor[color].lifestyle) {
      return { url: product.mockupsByColor[color].lifestyle!, isLifestyle: true };
    }
    if (product.mockupsByColor[color].front) {
      return { url: product.mockupsByColor[color].front!, isLifestyle: false };
    }
  }
  return { url: product.defaultMockupImage || null, isLifestyle: false };
};
```
**After**:
```typescript
const getCurrentMockup = (): { url: string | null; isLifestyle: boolean } => {
  const color = selectedColor || product.defaultColor || availableColors[0];
  
  // Helper to check if URL is valid (HTTP URL, not broken local path)
  const isValidUrl = (url?: string) => url && url.startsWith('http');
  
  // Check dynamic mockups first (fetched on color change)
  if (color && dynamicMockups[color]) {
    if (isValidUrl(dynamicMockups[color].lifestyle)) {
      return { url: dynamicMockups[color].lifestyle!, isLifestyle: true };
    }
    if (isValidUrl(dynamicMockups[color].front)) {
      return { url: dynamicMockups[color].front!, isLifestyle: false };
    }
  }
  
  // Fall back to pre-loaded mockups from product data
  if (product.mockupsByColor && color && product.mockupsByColor[color]) {
    if (isValidUrl(product.mockupsByColor[color].lifestyle)) {
      return { url: product.mockupsByColor[color].lifestyle!, isLifestyle: true };
    }
    if (isValidUrl(product.mockupsByColor[color].front)) {
      return { url: product.mockupsByColor[color].front!, isLifestyle: false };
    }
  }
  
  return { url: product.defaultMockupImage || null, isLifestyle: false };
};
```

---

## CONSOLE LOG DEBUGGING ATTEMPTED

Added these logs (later removed):
```typescript
console.log('[FeaturedProducts] Color swatch clicked:', color);
console.log('[FeaturedProducts] Current mockupsByColor:', product.mockupsByColor);
console.log('[FeaturedProducts] Current dynamicMockups:', dynamicMockups);
console.log('[FeaturedProducts] hasPreloaded:', hasPreloaded, 'hasDynamic:', hasDynamic);
console.log('[FeaturedProducts] getCurrentMockup for color:', color);
console.log('[FeaturedProducts] Found in mockupsByColor:', product.mockupsByColor[color]);
```

**Console output showed**:
```
[FeaturedProducts] getCurrentMockup for color: Solid Black
[FeaturedProducts] selectedColor: Solid Black defaultColor: Solid Black
[FeaturedProducts] Found in mockupsByColor: {"front":"https://images-api.printify.com/mockup/69501021202b79182c03c9f7/17429/103295/mockup-gen-5-solid-black.jpg?camera_label=front"}
```

---

## DATABASE STATE

### products table query:
```sql
SELECT id, mockups_by_color FROM products WHERE id = 'custom_hello-world';
```
**Result**:
```json
{
  "Solid Black": {"front": "https://images-api.printify.com/mockup/69501021202b79182c03c9f7/17429/103295/mockup-gen-5-solid-black.jpg?camera_label=front"},
  "Solid White": {"front": "https://images-api.printify.com/mockup/695015123463a9559306de72/17645/103295/mockup-gen-5-solid-white.jpg?camera_label=front"},
  "Heather Grey": {"front": "https://images-api.printify.com/mockup/695007dd202b79182c03c805/17393/103295/mockup-gen-5-heather-grey.jpg?camera_label=front", "lifestyle": "/assets/generated_images/model_wearing_qr_shirt.png"}
}
```
**Issue Found**: Heather Grey has broken local path for lifestyle

### mockup_cache table query:
```sql
SELECT color_name, mockup_url, lifestyle_mockup_url FROM mockup_cache;
```
All entries have valid Printify URLs.

---

## API TEST

```bash
curl -s -X POST "http://localhost:5000/api/storefront/generate-mockup" \
  -H "Content-Type: application/json" \
  -d '{"productId":"custom_hello-world","color":"Solid Black"}' | jq .
```
**Returns**:
```json
{
  "success": true,
  "color": "Solid Black",
  "mockupUrl": "https://images-api.printify.com/mockup/...",
  "lifestyleMockupUrl": "https://images-api.printify.com/mockup/...",
  "fromCache": true,
  "mockupsByColor": {...}
}
```

---

## IMAGE ACCESSIBILITY TEST

```bash
curl -sL "https://images-api.printify.com/mockup/69501021202b79182c03c9f7/17429/103295/mockup-gen-5-solid-black.jpg?camera_label=front" -o /tmp/test.jpg
ls -la /tmp/test.jpg
```
**Result**: 53295 bytes - valid JPEG

---

## ARCHITECT AGENT ANALYSIS

Called architect debug tool. Response:
> "The ProductCard's color change logic never sees the per-color mockups because the featured products query normalizes colors to lowercase while the mockupsByColor keys remain title-cased"

**Investigated**: Checked API response - colors ARE matching (both use "Solid Black", not "solid black"). Case mismatch theory was WRONG.

---

## CURRENT STATE OF FeaturedProducts.tsx

Key component flow:
1. `ProductCard` renders with product data
2. `handleColorChange` called on swatch click
3. Sets `selectedColor` state
4. `getCurrentMockup()` runs on re-render
5. Returns URL from mockupsByColor or dynamicMockups
6. `displayImage = mockupResult.url || product.imageUrl`
7. `<img src={displayImage}>` should show new image

**The problem**: Step 7 image is NOT updating visually despite state changing

---

## UNTESTED THEORIES

1. **React not re-rendering** - State updates but component doesn't re-render
2. **Image browser caching** - Browser caching old src despite new value
3. **CSS issue** - New image loaded but visually covered/hidden
4. **img tag not updating** - React reusing same img element

---

## SUGGESTED NEXT STEPS

1. **Add key to force img recreation**:
```tsx
<img key={displayImage} src={displayImage} alt={product.name} />
```

2. **Use DevTools** - Inspect img element src attribute during swatch click

3. **Add visible state debug**:
```tsx
<div style={{position:'fixed',top:0,zIndex:9999,background:'red',color:'white'}}>
  {selectedColor} | {displayImage?.substring(0,50)}
</div>
```

4. **Test with minimal component** - Strip down to just img + swatches

---

## KEY FILES

- `client/src/components/FeaturedProducts.tsx` - All mockup display logic
- `server/routes.ts` lines 4029-4170 - API endpoint
- `server/lib/mockup-service.ts` - Printify integration
- `replit.md` - System documentation

---

## USER CONTEXT

- User has CIDP (limited hand mobility)
- Extremely frustrated by repeated failures
- Pricing is WORKING - don't change pricing system
- Only problem is mockup image not visually updating

---

*Written by QR Agent, December 27, 2025*
