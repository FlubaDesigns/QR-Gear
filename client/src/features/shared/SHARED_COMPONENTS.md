# Shared Components Usage Map

This document tracks where shared components are used throughout the application.
Last updated: 2026-01-19

---

## Architecture Overview

The shared component system follows a **three-layer architecture**:

```
┌─────────────────────────────────────────────────────────────────┐
│                      SKIN GRID VIEWER                            │
│  Orchestrates everything: state, navigation, dialogs, actions   │
│  Location: /features/shared/components/SkinGridViewer.tsx       │
└────────────────────────────┬────────────────────────────────────┘
                             │
         ┌───────────────────┼───────────────────┐
         ▼                   ▼                   ▼
┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│     VIEWS       │  │     VIEWS       │  │     VIEWS       │
│   (Layouts)     │  │   (Layouts)     │  │   (Layouts)     │
│                 │  │                 │  │                 │
│  - GridView     │  │  - GalleryView  │  │  - ScrollView   │
│  - SinglePane   │  │  (side-scroll)  │  │  (horiz/vert)   │
└────────┬────────┘  └────────┬────────┘  └────────┬────────┘
         │                    │                    │
         └──────────┬─────────┴────────────────────┘
                    ▼
┌─────────────────────────────────────────────────────────────────┐
│                          SKINS                                   │
│  How individual items look + their usability (buttons, actions) │
│  Location: /features/shared/components/skins/                   │
│                                                                  │
│  - GraphicsSkin      (edit, archive buttons)                    │
│  - TemplateSkin      (edit, delete buttons)                     │
│  - BackgroundSkin    (delete button)                            │
│  - SourceImageSkin   (crop, delete buttons)                     │
│  - CroppedImageSkin  (delete button, "in use" badge)            │
└─────────────────────────────────────────────────────────────────┘
```

### Key Concepts

1. **Views** = Pure layout containers (WHERE things go, HOW they scroll/arrange)
   - Don't know or care what buttons are on each item
   - Examples: grid, horizontal scroller, single pane, gallery with navigation

2. **Skins** = Everything about the item itself:
   - Visual appearance (card styling, image display)
   - Interactive controls (edit, delete, crop, archive buttons)
   - Lightbox/modal triggers
   - Hover states, selection states, badges
   - Context-specific actions

3. **SkinGridViewer** = The orchestrator that:
   - Accepts which View to use
   - Accepts which Skin to use (CardSkin + DetailSkin)
   - Handles state (selected item, dialog open, pending actions)
   - Wires up navigation, confirmation dialogs, callbacks

---

## Skins Reference

Location: `/features/shared/components/skins/`

### SkinItem Interface (types.ts)

Common data contract all skins expect:

```typescript
interface SkinItem {
  id: string;
  packetId?: string;        // For packet-based items (graphics, templates)
  name: string;
  primaryImage?: string;    // Main display image
  secondaryImage?: string;  // Alternate image (e.g., QR-only)
  qrContent?: string;       // QR code URL/content
  headerText?: string;
  footerText?: string;
  qrMode?: string;          // CANVAS, PLAY, BASICS, etc.
  price?: number;
  colorCount?: number;
  sizeCount?: number;
  createdAt?: string;
  dimensions?: string;      // For image assets (e.g., "1920x1080")
  isUsed?: boolean;         // For cropped images in use
}
```

### SkinActions Interface

Actions a skin can trigger:

```typescript
interface SkinActions {
  onEdit?: (id: string) => void;
  onArchive?: (id: string) => void;
  onDelete?: (id: string) => void;
  onSelect?: (id: string) => void;
  onCrop?: (id: string) => void;
}
```

### Available Skins

| Skin | Card | Detail | Actions | Used By |
|------|------|--------|---------|---------|
| GraphicsSkin | GraphicsCardSkin | GraphicsDetailSkin | edit, archive | GraphicsTab |
| TemplateSkin | TemplateCardSkin | TemplateDetailSkin | edit, delete | TemplatesTab |
| BackgroundSkin | BackgroundCardSkin | BackgroundDetailSkin | delete | BackgroundsTab |
| SourceImageSkin | SourceImageCardSkin | SourceImageDetailSkin | crop, delete | SourceImagesTab |
| CroppedImageSkin | CroppedImageCardSkin | CroppedImageDetailSkin | delete | CroppedImagesTab |

---

## Views Reference

Location: `/features/shared/components/views/`

### GalleryView

Modal dialog with image display, left/right navigation, image toggle (dots).

**Features:**
- Prev/next navigation between items
- Toggle between primary/secondary images
- Displays: name, qrMode, colorCount, sizeCount, URL, header/footer, price
- Edit and Action (archive/delete) buttons with confirmation

**Usage:** Graphics and Templates detail view

### ScrollView

Scrollable container with multiple layout options.

**Layouts:**
- `horizontal` - Horizontal scroll strip
- `vertical` - Vertical list with ProductSkin cards
- `grid` - Grid layout with ScrollArea
- `single` - Single-item snap carousel

### ContentView

URL/background preview display.

**Usage:** QR content preview in builder

---

## Utilities Reference

Location: `/features/shared/components/utilities/`

### CropUtility

Generic image cropping dialog using react-image-crop.

**Features:**
- Configurable aspect ratio (default 9:16)
- Optional image blob fetching (for authenticated images)
- Callback-based save (consumer handles storage)

**Used by:**
- Library: CropDialog wrapper for cropping source images
- Products: URLContentModule for background cropping

**Props:**
```typescript
interface CropUtilityProps {
  asset: CropAsset | null;           // { id, name, imageUrl }
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (imageData: string, sourceAsset: CropAsset) => Promise<void>;
  fetchImageBlob?: (url: string) => Promise<string>;  // For auth'd images
  aspectRatio?: number;              // Default 9/16
  title?: string;
}
```

---

## SkinGridViewer Usage

Location: `/features/shared/components/SkinGridViewer.tsx`

### Basic Usage

```tsx
import { SkinGridViewer } from "@/features/shared/components/SkinGridViewer";
import { GraphicsCardSkin, GraphicsDetailSkin } from "@/features/shared/components/skins";

<SkinGridViewer
  items={skinItems}                    // Array of SkinItem
  CardSkin={GraphicsCardSkin}          // Card component
  DetailSkin={GraphicsDetailSkin}      // Detail/gallery component
  actions={{
    onEdit: handleEdit,
    onArchive: handleArchive,
  }}
  isActionPending={mutation.isPending}
  confirmAction={{
    type: "archive",                   // "archive" | "delete"
    title: "Archive this graphic?",
    description: "This will hide it from your library.",
  }}
/>
```

### How Tabs Use SkinGridViewer

1. **Fetch data** from API (useQuery)
2. **Map to SkinItem** format
3. **Pass to SkinGridViewer** with appropriate skins and actions
4. **SkinGridViewer handles:** grid display, item click → detail view, navigation, confirmations

---

## SharedLightbox

Panel for displaying selected items with remove/clear actions.

**NOT the same as GalleryView** - this is for multi-select workflows, not item viewing.

**Usage:** Selection workflows, shopping cart style panels

---

## SharedViewer (Legacy)

Orchestrator for multiple modes. SkinGridViewer is the newer pattern for skins-based rendering.

**Modes:**
- `scroll` - Uses ScrollView
- `content` - Uses ContentView
- `grid` - Renders children directly
- `gallery` - Uses GalleryView

---

## Migration Notes

### From AssetGrid to SkinGridViewer + Skins

Old pattern:
```tsx
<AssetGrid
  assets={assets}
  actions={["crop", "delete"]}
  onCrop={handleCrop}
  onDelete={handleDelete}
/>
```

New pattern:
```tsx
const skinItems = assets.map(assetToSkinItem);

<SkinGridViewer
  items={skinItems}
  CardSkin={SourceImageCardSkin}
  DetailSkin={SourceImageDetailSkin}
  actions={{ onCrop: handleCrop, onDelete: handleDelete }}
/>
```

### Key Difference

- **AssetGrid:** Component that knows about asset display and actions
- **SkinGridViewer + Skins:** Separation of concerns - Viewer handles state/navigation, Skins handle appearance/actions

---

## File Locations Summary

```
/features/shared/
├── components/
│   ├── SkinGridViewer.tsx        # Skin-based grid with detail view
│   ├── SharedViewer.tsx          # Legacy orchestrator
│   ├── SharedLightbox.tsx        # Multi-select panel
│   ├── ProductLightbox.tsx       # Product selection panel
│   ├── CollapsibleModule.tsx     # Collapsible wrapper
│   ├── ProductSkin.tsx           # Product card for ScrollView
│   ├── ProductConfigSkin.tsx     # Product config display
│   ├── views/
│   │   ├── GalleryView.tsx       # Modal with navigation
│   │   ├── ScrollView.tsx        # Scrollable layouts
│   │   └── ContentView.tsx       # URL preview
│   ├── skins/
│   │   ├── types.ts              # SkinItem, SkinActions
│   │   ├── GraphicsSkin.tsx
│   │   ├── TemplateSkin.tsx
│   │   ├── BackgroundSkin.tsx
│   │   ├── SourceImageSkin.tsx
│   │   ├── CroppedImageSkin.tsx
│   │   └── index.ts
│   └── utilities/
│       ├── CropUtility.tsx       # Generic cropping dialog
│       └── index.ts
├── AdminAuthContext.tsx
└── SHARED_COMPONENTS.md          # This file
```
