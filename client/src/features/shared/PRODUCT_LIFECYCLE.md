# Product Lifecycle Flow

## Overview

This document describes the complete lifecycle of a product from creation in Products Builder through assignment and display in Store Library.

## Flow Diagram

```
PRODUCTS BUILDER (test-products)
        │
        ▼
┌─────────────────────────────────┐
│  User selects:                  │
│  - Role (Internal/External)     │
│  - Store                        │
│  - Channel                      │
│  - Product                      │
│  - QR Content                   │
│  - Pricing                      │
└─────────────────────────────────┘
        │
        ▼  "Create Graphics" clicked
        │
┌─────────────────────────────────┐
│  Creates (in order):            │
│  1. Product Packet              │
│  2. Graphics Entry              │
│  3. Template Entry              │
│  4. Store Product Link ◄────────┼── Assignment locked in HERE
└─────────────────────────────────┘
        │
        ▼  Auto-navigates with ?packetId=xxx
        │
STORE BUILDER (test-store-builder)
        │
        ▼
┌─────────────────────────────────┐
│  Loads packet from database     │
│  Auto-populates:                │
│  - Store dropdown               │
│  - Channel dropdown             │
│  - Pricing display              │
└─────────────────────────────────┘
        │
        ├── Nothing changed? ──► Nothing saved (view only)
        │
        └── Anything changed? ──► FORK: Creates NEW packet + NEW link
                                  (Original stays intact)
```

## Key Concepts

### 1. Packet = Master Record
The Product Packet contains all the data:
- QR images (black & white versions)
- Composite graphic
- QR content/URL
- Header/footer text
- Pricing breakdown
- Product info (blueprint, provider, colors, sizes)
- Store/Channel destination

### 2. Assignment Happens in Products Builder
When "Create Graphics" is clicked:
1. Packet is created first
2. Graphics entry links to packet
3. Template entry links to packet
4. **storeProductLink is created immediately** (if store & channel selected)

This means the store/channel assignment is locked in BEFORE Store Builder opens.

### 3. Fork-on-Edit Pattern
Store Builder operates in two modes:

**View Mode:**
- User opens packet via `?packetId=xxx`
- Views pricing, colors, sizes
- Makes no changes
- Nothing saved to database

**Edit Mode:**
- User changes anything (color, size, store, channel, etc.)
- On save: Creates NEW packet ID (fork)
- Creates NEW storeProductLink for the fork
- Original packet and link remain unchanged

### 4. Store Product Link Structure
```javascript
{
  storeId: string,           // Store document ID
  storeName: string,         // Store display name
  channel: string,           // Channel name
  packetId: string,          // Reference to product packet
  templateId: string,        // Reference to template
  productName: string,       // Display name
  compositeUrl: string,      // Graphic image URL
  qrOnlyUrl: string,         // QR-only image URL
  qrContent: string,         // QR destination URL
  pricing: object,           // Full pricing breakdown
  enabledColors: string[],   // Available colors
  enabledSizes: string[],    // Available sizes
  selectedGraphicSize: string, // "small" | "medium" | "large"
  defaultColor: string,      // Hero color
  createdAt: timestamp,
  updatedAt: timestamp
}
```

## API Endpoints

### Packets
- `POST /api/test/packets` - Create packet
- `GET /api/test/packets/:packetId` - Get packet by ID
- `PATCH /api/test/packets/:packetId` - Update packet
- `DELETE /api/test/packets/:packetId` - Delete packet

### Store Product Links
- `GET /api/test/store-product-links` - List all links (debugging)
- `POST /api/test/store-product-links` - Create link
- `PATCH /api/test/store-product-links/:linkId` - Update link
- `DELETE /api/test/store-product-links/:linkId` - Delete link

### Stores & Channels
- `GET /api/test/stores?roleType=xxx` - List stores by role
- `GET /api/test/stores/by-id/:storeId` - Get store (checks both stores & partnerStores)
- `GET /api/test/stores/:storeId/channels` - List channels for store
- `POST /api/test/stores/:storeId/channels` - Create channel

## Store Library

Store Library reads from `storeProductLinks` to display products:
1. User selects role (Internal/External/Member)
2. User selects store
3. User selects channel
4. Grid shows all products linked to that store/channel

Clicking a product navigates to Store Builder with the packetId for viewing/editing.

## Related Files

- `client/src/features/adminProducts/builder/modules/CreateGraphicsModule.tsx` - Creates packet + link
- `client/src/features/storeBuilder/StoreBuilderHarness.tsx` - View/edit packets
- `client/src/features/adminProducts/storeLibrary/StoreLibraryHarness.tsx` - Browse by store/channel
- `server/routes.ts` - All API endpoints
