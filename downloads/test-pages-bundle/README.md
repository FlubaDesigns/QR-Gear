# QR Gear Test Pages Bundle

## Overview
This bundle contains all test pages from the QR Gear application. These are admin/development interfaces for managing various aspects of the platform.

---

## Test Pages Summary

### 1. test-members.tsx (1,408 lines) - Member Sandbox
**Route:** `/test-members`
**Purpose:** Simplified product builder for authenticated members to create and sell products with 25% profit share.

**Key Features:**
- **Wizard Mode**: 5-step guided flow (Product → Graphics → QR Setup → Preview → Publish)
- **Power Mode**: Compact single-view interface for experienced users
- **My Channels**: Member-scoped channels to organize products
- **My Collections**: Member-scoped QR Dynamics collections
- **Earnings Dashboard**: Tracks profit share (25% of sales)

**QR Types Supported:**
- QR Basic - Simple URL redirect
- QR Plus - Styled landing page with header/footer
- QR Canvas - Image background landing page
- QR Play - Video landing page

**Known Issue (Current Session):** Product images not displaying because `imageUrl` is sourcing from Printify URLs directly instead of Firebase Storage.

---

### 2. test-dynamics.tsx (704 lines) - QR Dynamics
**Route:** `/test-dynamics`
**Purpose:** Create rotating product experiences structured as Store → Channel → Collection.

**Key Features:**
- Collections are curated playlists of items that cycle over time
- Scoped to user's ID
- Time-based content resolution

**Architecture Note:** Should use SkinGridViewer from shared components, not custom inline grids.

---

### 3. test-store-builder.tsx (707 lines) - Store Builder
**Route:** `/test-store-builder`
**Purpose:** Build and configure partner stores with product assignments.

---

### 4. test-pricing.tsx (427 lines) - Pricing Configuration
**Route:** `/test-pricing`
**Purpose:** Admin interface for configuring complex pricing.

**Settings:**
- Markup percentages
- Fixed markups
- Additional placement costs
- Text line upcharges
- Hosting tiers
- Member profit share percentage

---

### 5. test-ar-demo.tsx (238 lines) - AR Demo
**Route:** `/test-ar-demo`
**Purpose:** Augmented reality product visualization demo.

---

### 6. test-library.tsx (103 lines) - Library Management
**Route:** `/test-library`
**Purpose:** Admin interface for managing the asset library.

---

### 7. test-images.tsx (89 lines) - Image Testing
**Route:** `/test-images`
**Purpose:** Image upload and display testing.

---

### 8. test-products.tsx (58 lines) - Products Testing
**Route:** `/test-products`
**Purpose:** Product catalog testing interface.

---

### 9. test-stores.tsx (49 lines) - Stores Testing
**Route:** `/test-stores`
**Purpose:** Partner stores list/management.

---

### 10. test-settings.tsx (49 lines) - Settings Testing
**Route:** `/test-settings`
**Purpose:** Application settings interface.

---

## API Endpoints

See `api-endpoints.txt` for extracted endpoints from server/routes.ts.

**Key Member Endpoints:**
- `GET /api/members/allowed-products` - Products from common library
- `GET /api/members/common-library` - Common library assets
- `GET/POST /api/members/:memberId/personal-library` - Personal library CRUD
- `GET/POST /api/members/:memberId/channels` - Member channels
- `GET /api/members/:memberId/earnings` - Earnings dashboard

**Key Test Endpoints:**
- `GET/POST /api/test/stores/:storeId/allowed-products` - Store allowed products
- `GET /api/test/partner-stores` - Partner stores list

---

## Two-Tier Library System

### Common Library (Admin-curated)
- Firestore collection: `commonLibrary`
- Contains backgrounds, templates, graphics curated by admin
- Read-only for members

### Personal Library (Member-owned)
- Firestore collection: `memberLibrary`
- Member's own uploads and saved product instances
- Scoped by `memberId`

---

## Pricing Model

### Base Pricing
- **Base cost** = Product manufacturing cost
- **First graphic** = INCLUDED in base price
- **Each additional graphic** = +$4
- **Header text** = +$2
- **Footer text** = +$2

### Member Earnings
- Members get **25% profit share** on sales
- Displayed on each product card as earnings badge

---

## Architecture Patterns

### Viewer/View/Skin Pattern
All grids should use:
- `SkinGridViewer` - Reusable grid display with lightbox/detail view
- `CardSkin/DetailSkin` - Pluggable display components
- `SkinActions.onSelect` - Selection callbacks

### Key Shared Components
Located in `client/src/features/shared/components/`:
- `SkinGridViewer.tsx` - Grid component
- `CropUtility` - 9:16 image cropping dialog
- `ImageUploader` - Upload single images or ZIP files
- `LibraryBackgroundPicker` - Pick backgrounds from library

### Skin Components
Located in `client/src/features/shared/components/skins/`:
- `AllowedProductSkin.tsx` - Product card/detail skin
- `BackgroundSkin.tsx`
- `ChannelContentSkin.tsx`
- `CollectionItemSkin.tsx`
- And more...

---

## File Storage

**IMPORTANT:** All file assets should use Firebase Storage exclusively.
- Product images should be served via `/api/files/...` endpoint
- NOT directly from Printify URLs (`https://images.printify.com/...`)

---

## Related Spec Documents (Included)
- `MEMBER_SANDBOX_SPEC.md` - Full member sandbox specification
- `QR_DYNAMICS_SPEC.md` - QR Dynamics feature specification  
- `ASSET_LIBRARY_SPEC.md` - Universal asset library system spec

---

## Files in This Bundle
```
test-pages-bundle/
├── README.md (this file)
├── api-endpoints.txt
├── MEMBER_SANDBOX_SPEC.md
├── QR_DYNAMICS_SPEC.md
├── ASSET_LIBRARY_SPEC.md
├── test-ar-demo.tsx
├── test-dynamics.tsx
├── test-images.tsx
├── test-library.tsx
├── test-members.tsx
├── test-pricing.tsx
├── test-products.tsx
├── test-settings.tsx
├── test-store-builder.tsx
└── test-stores.tsx
```
