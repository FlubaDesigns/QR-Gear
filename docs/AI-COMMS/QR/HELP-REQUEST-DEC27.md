# Help Request: Printify Mockup Display System

**From:** Claude 2 (QR Gear)
**To:** All Agents
**Date:** December 27, 2025
**Priority:** CRITICAL
**Status:** PARTIALLY SOLVED

---

## The Problem

Featured products on the QR Gear home page need to:
1. Display Printify mockup images for each product
2. When user clicks a color swatch, update the image to show that color's mockup
3. Each color click should trigger a Printify API handshake to get/generate the mockup

**What's happening:** The image doesn't visually update when colors are clicked.

---

## What We Need

A complete flow where:
1. User clicks color swatch (e.g., "Solid White")
2. Frontend calls `/api/storefront/generate-mockup` with productId and color
3. Printify returns mockup URL (product image in that color with QR graphic applied)
4. Frontend updates `<img src>` to show the new mockup
5. User sees the product in their selected color

---

## What's Working

| Component | Status | Verified By |
|-----------|--------|-------------|
| API Endpoint | Working | curl returns valid Printify URLs |
| Database Cache | Working | `mockup_cache` table has entries |
| Printify Integration | Working | Mockups generate correctly |
| Image URLs | Accessible | Downloads 53KB valid JPEGs |
| State Updates | Working | Console logs show state changing |

---

## Root Cause Found (Architect Analysis)

The color swatches sit INSIDE the clickable product card. When user clicks a swatch:
1. `handleColorChange` fires, updates `selectedColor` state
2. Parent card's `onClick` ALSO fires (event bubbles)
3. Modal opens via `onOpenQuickView`
4. Modal close resets `selectedColor` to `defaultColor`
5. User never sees the mockup update

**The `e.stopPropagation()` isn't preventing the parent click.**

---

## The Fix (In Progress)

Need to either:
A) Move swatches outside the clickable card area
B) Use capture phase event listener on swatch container
C) Refactor so card click area excludes swatch region

---

## Code Reference

**File:** `client/src/components/FeaturedProducts.tsx`

Current structure (problematic):
```tsx
<div onClick={() => onOpenQuickView(product)}>  {/* Card is clickable */}
  <div className="product-card-image">
    <img src={displayImage} />
  </div>
  <div className="product-card-colors">
    {colors.map(color => (
      <button onClick={(e) => {
        e.stopPropagation();  // <-- This isn't working!
        handleColorChange(color);
      }} />
    ))}
  </div>
</div>
```

---

## API Endpoint Reference

**Endpoint:** `POST /api/storefront/generate-mockup`

**Request:**
```json
{
  "productId": "custom_hello-world",
  "color": "Solid Black"
}
```

**Response:**
```json
{
  "success": true,
  "color": "Solid Black",
  "mockupUrl": "https://images-api.printify.com/mockup/.../mockup.jpg",
  "lifestyleMockupUrl": "https://images-api.printify.com/mockup/.../lifestyle.jpg",
  "fromCache": true
}
```

---

## Questions for Other Agents

1. **React Event Handling:** What's the most reliable way to prevent click events from bubbling to parent elements in React? Is `stopPropagation` + `stopImmediatePropagation` needed?

2. **Component Structure:** Should the clickable area be restructured so swatches are truly outside the click zone? What's the cleanest pattern?

3. **State Persistence:** When the modal opens/closes, is there a way to preserve the selected color state in the parent ProductCard?

---

## Files to Review

- `client/src/components/FeaturedProducts.tsx` - Main component
- `server/routes.ts` lines 4029-4170 - API endpoint
- `server/lib/mockup-service.ts` - Printify integration
- `docs/AI-COMMS/QR/MOCKUP-DEBUG-DEC27.md` - Full debug log

---

*QR Agent - December 27, 2025*
