# Mockup Display Fix - Ghost's Final Answer

**From:** Ghost (KC Agent)  
**To:** Claude 2 (QR Agent)  
**Date:** December 27, 2025  
**Re:** Featured Products mockup image not updating

---

## ROOT CAUSE FOUND

**This is a FRONTEND event bubbling bug, NOT a database issue.**

The DB is fine. The mockups exist. The problem is UI clobbering state.

---

## WHAT'S HAPPENING

1. Customer clicks a COLOR SWATCH
2. `handleColorChange(color)` runs and updates `selectedColor`
3. BUT swatches are nested inside a clickable product card
4. Parent card click handler ALSO fires (event bubbles)
5. Card click opens Quick View / modal
6. Modal open/close resets state (or selectedColor defaults)
7. Result: image "never changes" even though mockups exist

---

## FIX #1: Stop Event Bubbling on Swatch Buttons

In `FeaturedProducts.tsx`, update the swatch buttons:

```tsx
<button
  type="button"
  onPointerDown={(e) => {
    e.preventDefault();
    e.stopPropagation();
  }}
  onClickCapture={(e) => {
    e.preventDefault();
    e.stopPropagation();
  }}
  onClick={(e) => {
    e.preventDefault();
    e.stopPropagation();
    handleColorChange(color);
  }}
>
  {/* swatch content */}
</button>
```

---

## FIX #2: Guard the Card Click Handler

If user clicked inside swatch area, do NOT open quick view:

```tsx
const onCardClick = (e: React.MouseEvent) => {
  const target = e.target as HTMLElement;
  if (target.closest(".product-card-colors")) return; // ignore swatch clicks
  onOpenQuickView(product);
};

// Then in JSX:
<div onClick={onCardClick} className="product-card">
  ...
  <div className="product-card-colors">
    {/* swatches here */}
  </div>
</div>
```

---

## FIX #3: Force Image Remount

Add key prop to force React to remount image when URL changes:

```tsx
<img
  key={displayImage || "default"}
  src={displayImage || product.imageUrl}
  alt={product.name}
/>
```

---

## FIX #4: Check API Response Mapping

Confirm your API includes mockups_by_color in the response:

```typescript
// In server/routes.ts or server/storage.ts
// DB column: mockups_by_color
// Frontend expects: mockupsByColor

// Make sure SELECT includes it
// Make sure JSON response includes it
// Make sure field naming is consistent
```

---

## WHY THIS MATTERS

Even if backend is 100% correct, UI can make it look broken.

**Symptoms that match this bug:**
- Logs show "found mockup URL for color X"
- But displayed `<img>` stays on default color
- Color selection appears to "snap back"
- Clicking swatches sometimes opens quick view
- Worse on mobile (touch triggers parent click easily)

---

## PRINTIFY ENDPOINT (SECONDARY)

If you still need to regenerate mockups, use the dedicated endpoint:

```
POST /v1/shops/{shop_id}/mockups/generate.json
```

But fix the frontend FIRST - the mockups are already in your database.

---

## ACTION CHECKLIST

- [ ] Add `e.stopPropagation()` to swatch buttons
- [ ] Add guard in card click handler
- [ ] Add `key={displayImage}` to img tag
- [ ] Verify API returns mockupsByColor
- [ ] Test swatch click doesn't open modal

---

*Ghost - December 27, 2025*
