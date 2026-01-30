# QR Gear Test Pages Package

## Overview
This package contains all test pages and shared components for the QR Gear e-commerce platform. These pages are used for developing and testing features before they go into production.

---

## QR Dynamics Feature (Primary Focus)

### What It Does
QR Dynamics allows users to create rotating product experiences. When a QR code is scanned, it displays content that rotates on a schedule (daily, weekly, or monthly).

### Architecture
Uses the **Viewer → View → Skin** pattern:
- **Viewer**: Orchestrates layout and state
- **View**: Handles behavior/layout (grids, lightboxes, scrolling)
- **Skin**: Pure visual styling (cards, details)

### Current Implementation Status

#### Completed
1. **Store/Channel Selection** - Auto-populates with "QR Gear" store by default
2. **Media Grid** - Displays channel content (images, videos, documents) in a 4-column grid using GridScrollView
3. **Collection Management** - Create new collections inline, select existing collections
4. **Add to Collection** - Click any media item to add it to the selected collection
5. **Collection Display** - Shows items in collection with order numbers and remove buttons
6. **QR Dynamics Scan Lightbox** - Click a collection item to open a detail panel with:
   - Item thumbnail preview
   - Order number and content type badges
   - Rotation interval selector (Daily/Weekly/Monthly)
7. **Firestore Integration** - Collections and items stored in Firestore with proper indexes

#### Data Flow
1. User selects Store → Channel
2. Media from channel displayed in grid
3. User creates/selects a Collection
4. User clicks media to add to collection
5. User clicks collection item → opens QR Dynamics Scan Lightbox
6. User sets rotation interval (how often content rotates when QR is scanned)

### Key Files
- `pages/test-dynamics.tsx` - Main test page for QR Dynamics
- `shared-components/QRDynamicsScanLightbox.tsx` - Lightbox view for item details
- `shared-components/QRDynamicsScanSkin.tsx` - Skin for rotation interval selection
- `shared-components/GridScrollView.tsx` - Grid layout component
- `shared-components/ChannelItemSkin.tsx` - Card skin for media items
- `shared-components/CollectionItemSkinV2.tsx` - Card skin for collection items
- `docs/QR_DYNAMICS_SPEC.md` - Full specification document

---

## Other Test Pages

| Page | Purpose |
|------|---------|
| test-pricing.tsx | Admin pricing configuration with markup percentages, fixed markups, hosting tiers |
| test-stores.tsx | Store management and selection |
| test-settings.tsx | System settings configuration |
| test-ar-demo.tsx | AR preview demonstration |
| test-images.tsx | Image management testing |
| test-library.tsx | Admin library module for backgrounds, templates, images |
| test-products.tsx | Product management testing |
| test-store-builder.tsx | Store builder harness for product configuration |
| test-members.tsx | Member/team management |

---

## Shared Components

### Views (Behavior/Layout)
- **GridScrollView** - 4-column scrollable grid
- **GalleryView** - Swipeable image gallery
- **ScrollView** - Scrollable content container
- **ContentView** - Single content display
- **ImageLightbox** - Full-screen image viewer
- **QRDynamicsScanLightbox** - Collection item detail modal

### Skins (Visual Styling)
- **ChannelItemSkin** - Media cards in channel grid
- **CollectionItemSkinV2** - Items in collection grid
- **QRDynamicsScanSkin** - Rotation interval selector
- **TemplateSkin** - Template cards
- **GraphicsSkin** - Graphics cards
- **BackgroundSkin** - Background image cards
- **StoreProductSkin** - Product cards

---

## Firestore Collections Used

### dynamicsCollections
```
{
  id: string,
  storeId: string,
  channelId: string,
  name: string,
  createdAt: Date,
  updatedAt: Date
}
```

### dynamicsCollectionItems
```
{
  id: string,
  collectionId: string,
  contentType: 'image' | 'video' | 'document',
  contentUrl: string,
  title: string,
  thumbnailUrl: string,
  order: number,
  rotationInterval: 'daily' | 'weekly' | 'monthly',
  addedAt: Date
}
```

---

## What's Next (Pending Implementation)
1. Reorder items in collection (drag-drop or arrows)
2. QR code generation linking to collection
3. Actual rotation logic when QR is scanned (determines which item to show based on schedule)
4. Preview of what the QR scan experience looks like
