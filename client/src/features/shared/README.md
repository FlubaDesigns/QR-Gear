# Shared Components Architecture

This folder contains reusable components organized in a **Viewer → View → Skin** hierarchy.

## Architecture Pattern

```
┌─────────────────────────────────────────────────────────────┐
│  VIEWER (Container)                                         │
│  SharedViewer, SkinGridViewer                               │
│  - Orchestrates layout and state                            │
│  - Decides which View to render                             │
│                                                             │
│    ┌─────────────────────────────────────────────────────┐  │
│    │  VIEW (Behavior/Layout)                             │  │
│    │  GalleryView, ScrollView, ContentView               │  │
│    │  - Handles interactions (swipe, navigate, zoom)     │  │
│    │  - Manages image switching, pagination              │  │
│    │  - Applies layout (grid, scroll, gallery)           │  │
│    │                                                     │  │
│    │    ┌─────────────────────────────────────────────┐  │  │
│    │    │  SKIN (Visual Styling)                      │  │  │
│    │    │  TemplateSkin, GraphicsSkin, BackgroundSkin │  │  │
│    │    │  - Pure presentation                        │  │  │
│    │    │  - No behavior logic                        │  │  │
│    │    │  - Card appearance, detail layout           │  │  │
│    │    └─────────────────────────────────────────────┘  │  │
│    └─────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

## Folder Structure

```
shared/
├── components/
│   ├── SharedViewer.tsx       # Main viewer orchestrator
│   ├── SkinGridViewer.tsx     # Grid-based viewer with lightbox
│   │
│   ├── views/                 # VIEWS - Behavior & Layout
│   │   ├── GalleryView.tsx    # Swipeable image gallery with navigation
│   │   ├── ScrollView.tsx     # Scrollable content container
│   │   ├── ContentView.tsx    # Single content display
│   │   └── ImageLightbox.tsx  # Full-screen image viewer
│   │
│   └── skins/                 # SKINS - Visual Styling Only
│       ├── types.ts           # Shared types (SkinItem, SkinActions)
│       ├── TemplateSkin.tsx   # Template card/detail styling
│       ├── GraphicsSkin.tsx   # Graphics card/detail styling
│       ├── BackgroundSkin.tsx # Background card/detail styling
│       └── ...
```

## Key Types

### GalleryImage (from GalleryView)
```typescript
interface GalleryImage {
  url: string;
  label: string;  // "Mockup", "Graphic", "Landing Page"
}
```

### SkinItem (from skins/types.ts)
```typescript
interface SkinItem {
  id: string;
  name: string;
  primaryImage?: string;
  secondaryImage?: string;
  images?: GalleryImage[];  // For multi-image swipeable galleries
  qrContent?: string;
  price?: number;
  // ...
}
```

## Usage Example

```tsx
// Tab component builds SkinItems with images array
const skinItems = templates.map(t => ({
  id: t.id,
  name: t.name,
  images: [
    { url: t.mockupUrl, label: "Mockup" },
    { url: t.graphicUrl, label: "Graphic" },
    { url: t.landingPageUrl, label: "Landing Page" },
  ].filter(img => img.url),
}));

// SkinGridViewer handles the grid + lightbox
<SkinGridViewer
  items={skinItems}
  CardSkin={TemplateCardSkin}    // Skin for grid cards
  DetailSkin={TemplateDetailSkin} // Skin for lightbox detail
/>

// GalleryView (inside lightbox) handles image swapping automatically
// using the images[] array from each SkinItem
```

## Rules

1. **Skins are pure styling** - No state, no fetch, no navigation logic
2. **Views handle behavior** - Swipe, navigate, zoom, pagination
3. **Viewers orchestrate** - Choose views, manage global state
4. **Types are shared** - GalleryImage defined once, used everywhere
