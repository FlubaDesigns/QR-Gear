# Shared Components Usage Map

This document tracks where shared components are used throughout the application.
Last updated: 2026-01-17

---

## SharedViewer

Main component: `client/src/features/shared/components/SharedViewer.tsx`

### Modes
- **scroll**: Uses ScrollView with configurable layouts (horizontal, vertical, grid, single)
- **content**: Uses ContentView for URL/background preview
- **grid**: Renders children directly in a wrapper

### Usage Locations

| File | Mode | Layout | Purpose |
|------|------|--------|---------|
| `pages/test-products.tsx` | grid | n/a | Product config list display |
| `adminProducts/storeLibrary/modules/ProductGridModule.tsx` | grid | n/a | Store product grid display |
| `adminProducts/builder/modules/ContentModule.tsx` | content | n/a | QR content preview |
| `adminProducts/builder/modules/ProductsModule.tsx` | scroll | vertical | Catalog product selection |

---

## ScrollView

Component: `client/src/features/shared/components/views/ScrollView.tsx`

### Layouts
- **horizontal**: Horizontal scroll strip with ScrollArea
- **grid**: Grid layout with ScrollArea (scrollable)
- **single**: Single-item snap carousel with ScrollArea
- **vertical**: Vertical list with ProductSkin cards (**USES raw overflow-y-auto**)

### Layout Usage

| Layout | Used By | Scroll Method |
|--------|---------|---------------|
| horizontal | (default) | ScrollArea component |
| grid | (on-demand) | ScrollArea component |
| single | (on-demand) | ScrollArea component |
| vertical | ProductsModule.tsx | ScrollArea component (fixed 2026-01-17) |

### Change History
- **2026-01-17**: Fixed vertical layout to use ScrollArea instead of raw overflow-y-auto (was causing touch scroll issues on mobile)

---

## ProductSkin

Component: `client/src/features/shared/components/ProductSkin.tsx`

Used by: ScrollView (vertical layout)

---

## ContentView

Component: `client/src/features/shared/components/views/ContentView.tsx`

Used by: SharedViewer (content mode)

---

## Notes for Future Changes

1. **Before modifying ScrollView layouts**: Check all usages above
2. **vertical layout fix**: Only affects ProductsModule.tsx currently
3. **grid mode** in SharedViewer renders children directly, doesn't use ScrollView
