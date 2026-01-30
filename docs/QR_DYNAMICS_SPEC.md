# QR Dynamics Page Specification

## Overview
The QR Dynamics page allows users to create rotating product experiences. Content rotates on a schedule (daily, weekly, monthly) when a QR code is scanned.

## Architecture
Uses the **Viewer → View → Skin** pattern from `client/src/features/shared/`.

## Page Flow

### Auto-Population
- When page loads, auto-populate with first available store/channel from test products
- Example default: "QR Gear / test channel"
- User can change store/channel via dropdowns but defaults should work immediately
- Page should be ready to work on collections without manual selection

---

## Two Main Views

### 1. Channel View (Content Picker)

**Purpose:** Browse all content in a channel and add items to collections.

**Data Source:** Fetch from selected channel

**Content Types (3 only):**
1. **Images** - URL backgrounds with text overlay (landing page style)
2. **Video** - Video content
3. **Documents** - PDF or document files

**Display:**
- Grid layout using SkinGridViewer
- Each item shows thumbnail/preview
- Each item has "Add to Collection" button

**Add to Collection Flow:**
- Click "Add to Collection" on any item
- Modal/picker appears with two options:
  - Select existing collection from dropdown
  - Create new collection (input field + create button)
- Confirm adds item to selected collection

**Skin:** `ChannelContentSkin`
- Card view: thumbnail, content type badge (image/video/doc), title
- Shows preview appropriate to content type

---

### 2. Collection View (Playlist Manager)

**Purpose:** Manage items within a selected collection.

**Display:**
- Grid layout using SkinGridViewer
- Shows all items added to this collection
- Items displayed in rotation order

**Actions per Item:**
- **Reorder** - Move item up/down in rotation order (drag-drop or arrows)
- **Delete** - Remove item from collection
- **Set Interval** - Click item to open settings for rotation timing

**Rotation Interval Options:**
- Daily - rotates every day
- Weekly - rotates every Sunday
- Monthly - rotates on the 1st

**Skin:** `CollectionItemSkin`
- Card view: thumbnail, order number, content type
- Detail view: rotation interval selector

---

## Data Structure

### Channel Content Item
```typescript
interface ChannelContentItem {
  id: string;
  channelId: string;
  type: 'image' | 'video' | 'document';
  url: string;           // URL for image/video/doc
  title: string;
  thumbnailUrl?: string; // Preview image
  metadata?: {
    text?: string;       // Text overlay for URL backgrounds
    duration?: number;   // Video duration
    pageCount?: number;  // Document pages
  };
}
```

### Collection Item
```typescript
interface CollectionItem {
  id: string;
  collectionId: string;
  contentId: string;     // References ChannelContentItem
  order: number;         // Position in rotation
  rotationInterval: 'daily' | 'weekly' | 'monthly';
  addedAt: Date;
}
```

---

## API Endpoints Needed

### Channel Content
- `GET /api/test/stores/:storeId/channels/:channelId/content`
  - Returns all images, videos, documents in channel

### Collection Management
- `GET /api/test/stores/:storeId/channels/:channelId/collections`
  - Returns all collections (existing)
- `POST /api/test/stores/:storeId/channels/:channelId/collections`
  - Create new collection (existing)
- `GET /api/test/collections/:collectionId/items`
  - Get items in a collection
- `POST /api/test/collections/:collectionId/items`
  - Add item to collection
- `DELETE /api/test/collections/:collectionId/items/:itemId`
  - Remove item from collection
- `PATCH /api/test/collections/:collectionId/items/:itemId`
  - Update item order or rotation interval
- `PUT /api/test/collections/:collectionId/items/reorder`
  - Bulk reorder items

---

## UI Components to Create

### Using Shared Architecture
1. `ChannelContentSkin.tsx` - Card/detail styling for channel content
2. `CollectionItemSkin.tsx` - Card/detail styling for collection items

### Page Layout
- Top: Store/Channel selector (auto-populated)
- Left/Main: Channel View (content grid)
- Right/Tab: Collection View (playlist manager)
- Or: Tab-based switching between Channel View and Collection View

---

## Firestore Collections

### dynamicsChannelContent
```
{
  id: string,
  storeId: string,
  channelId: string,
  name: string,
  contentType: 'image' | 'video' | 'document',
  url: string,
  thumbnailUrl: string,
  metadata: {
    text?: string,
    duration?: number,
    pageCount?: number
  },
  createdAt: Date,
  updatedAt: Date
}
```

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

## User Flow Summary

1. Land on page → Store/Channel auto-selected
2. See Channel View with all content (images, videos, docs)
3. Click "Add to Collection" on any item
4. Pick existing collection or create new one
5. Switch to Collection View to manage playlist
6. Reorder items, delete items, set rotation intervals
7. QR code will rotate through collection items on schedule
