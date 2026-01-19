# Shared Components Usage Map

This document tracks where shared components are used throughout the application.
Last updated: 2026-01-19

---

## SharedViewer

Main component: `client/src/features/shared/components/SharedViewer.tsx`

### Modes
- **scroll**: Uses ScrollView with configurable layouts (horizontal, vertical, grid, single)
- **content**: Uses ContentView for URL/background preview
- **grid**: Renders children directly in a wrapper
- **gallery**: Uses GalleryView for modal lightbox with navigation

### Usage Locations

| File | Mode | Layout | Purpose |
|------|------|--------|---------|
| `pages/test-products.tsx` | grid | n/a | Product config list display |
| `adminProducts/storeLibrary/modules/ProductGridModule.tsx` | grid | n/a | Store product grid display |
| `adminProducts/builder/modules/ContentModule.tsx` | content | n/a | QR content preview |
| `adminProducts/builder/modules/ProductsModule.tsx` | scroll | vertical | Catalog product selection |
| `adminLibrary/tabs/GraphicsTab.tsx` | grid + gallery | n/a | Graphics grid with lightbox viewer |
| `adminLibrary/tabs/TemplatesTab.tsx` | grid + gallery | n/a | Templates grid with lightbox viewer |

---

## GalleryView

Component: `client/src/features/shared/components/views/GalleryView.tsx`

### Features
- Modal dialog with image display
- Left/right navigation between items
- Toggle between primary/secondary images (dots)
- Displays: name, qrMode, colorCount, sizeCount, URL, header/footer text, price
- Edit and Action (archive/delete) buttons with confirmation

### Usage Locations
| File | Action Type | Purpose |
|------|-------------|---------|
| `adminLibrary/tabs/GraphicsTab.tsx` | archive | Archive graphics from library |
| `adminLibrary/tabs/TemplatesTab.tsx` | delete | Delete templates (cascades to packet) |

---

## ScrollView

Component: `client/src/features/shared/components/views/ScrollView.tsx`

### Layouts
- **horizontal**: Horizontal scroll strip with ScrollArea
- **grid**: Grid layout with ScrollArea (scrollable)
- **single**: Single-item snap carousel with ScrollArea
- **vertical**: Vertical list with ProductSkin cards

### Layout Usage

| Layout | Used By | Scroll Method |
|--------|---------|---------------|
| horizontal | (default) | ScrollArea component |
| grid | (on-demand) | ScrollArea component |
| single | (on-demand) | ScrollArea component |
| vertical | ProductsModule.tsx | ScrollArea component (fixed 2026-01-17) |

### Change History
- **2026-01-17**: Fixed vertical layout to use ScrollArea instead of raw overflow-y-auto
- **2026-01-19**: Added GalleryView for modal lightbox viewing

---

## ProductSkin

Component: `client/src/features/shared/components/ProductSkin.tsx`

Used by: ScrollView (vertical layout)

---

## ContentView

Component: `client/src/features/shared/components/views/ContentView.tsx`

Used by: SharedViewer (content mode)

---

## SharedLightbox

Component: `client/src/features/shared/components/SharedLightbox.tsx`

Panel for displaying selected items with remove/clear actions.

Used by: Selection workflows, multi-select patterns

---

## Notes for Future Changes

1. **Before modifying ScrollView layouts**: Check all usages above
2. **GalleryView**: Used for viewing items with navigation; supports archive/delete actions
3. **grid mode** in SharedViewer renders children directly, doesn't use ScrollView
4. **gallery mode** in SharedViewer renders GalleryView modal dialog
