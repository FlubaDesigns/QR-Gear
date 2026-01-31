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

## File Path Mapping (Bundle → Actual Codebase)

### Test Pages
All test pages live in `client/src/pages/`:
| Bundle File | Actual Path |
|-------------|-------------|
| `test-ar-demo.tsx` | `client/src/pages/test-ar-demo.tsx` |
| `test-dynamics.tsx` | `client/src/pages/test-dynamics.tsx` |
| `test-images.tsx` | `client/src/pages/test-images.tsx` |
| `test-library.tsx` | `client/src/pages/test-library.tsx` |
| `test-members.tsx` | `client/src/pages/test-members.tsx` |
| `test-pricing.tsx` | `client/src/pages/test-pricing.tsx` |
| `test-products.tsx` | `client/src/pages/test-products.tsx` |
| `test-settings.tsx` | `client/src/pages/test-settings.tsx` |
| `test-store-builder.tsx` | `client/src/pages/test-store-builder.tsx` |
| `test-stores.tsx` | `client/src/pages/test-stores.tsx` |

### Harnesses
| Bundle File | Actual Path |
|-------------|-------------|
| `harnesses/BuilderHarness.tsx` | `client/src/features/adminProducts/builder/BuilderHarness.tsx` |
| `harnesses/ProductsHarness.tsx` | `client/src/features/adminProducts/ProductsHarness.tsx` |
| `harnesses/StoreLibraryHarness.tsx` | `client/src/features/adminProducts/storeLibrary/StoreLibraryHarness.tsx` |
| `harnesses/StoreBuilderHarness.tsx` | `client/src/features/adminProducts/storeBuilder/StoreBuilderHarness.tsx` |
| `harnesses/library-harness.txt` | `downloads/library-harness.txt` (reference doc) |

### Shared Components
| Bundle File | Actual Path |
|-------------|-------------|
| `shared-components/SkinGridViewer.tsx` | `client/src/features/shared/components/SkinGridViewer.tsx` |

### Skin Components
All skins live in `client/src/features/shared/components/skins/`:
| Bundle File | Actual Path |
|-------------|-------------|
| `shared-components/skins/AllowedProductSkin.tsx` | `client/src/features/shared/components/skins/AllowedProductSkin.tsx` |
| `shared-components/skins/BackgroundSkin.tsx` | `client/src/features/shared/components/skins/BackgroundSkin.tsx` |
| `shared-components/skins/ChannelContentSkin.tsx` | `client/src/features/shared/components/skins/ChannelContentSkin.tsx` |
| `shared-components/skins/ChannelItemSkin.tsx` | `client/src/features/shared/components/skins/ChannelItemSkin.tsx` |
| `shared-components/skins/CollectionItemSkin.tsx` | `client/src/features/shared/components/skins/CollectionItemSkin.tsx` |
| `shared-components/skins/CollectionItemSkinV2.tsx` | `client/src/features/shared/components/skins/CollectionItemSkinV2.tsx` |
| `shared-components/skins/CropDeleteSkin.tsx` | `client/src/features/shared/components/skins/CropDeleteSkin.tsx` |
| `shared-components/skins/CroppedImageSkin.tsx` | `client/src/features/shared/components/skins/CroppedImageSkin.tsx` |
| `shared-components/skins/DeleteSkin.tsx` | `client/src/features/shared/components/skins/DeleteSkin.tsx` |
| `shared-components/skins/DynamicsChannelSkin.tsx` | `client/src/features/shared/components/skins/DynamicsChannelSkin.tsx` |
| `shared-components/skins/DynamicsCollectionSkin.tsx` | `client/src/features/shared/components/skins/DynamicsCollectionSkin.tsx` |
| `shared-components/skins/GraphicPreviewView.tsx` | `client/src/features/shared/components/skins/GraphicPreviewView.tsx` |
| `shared-components/skins/GraphicsSkin.tsx` | `client/src/features/shared/components/skins/GraphicsSkin.tsx` |
| `shared-components/skins/LandingPageView.tsx` | `client/src/features/shared/components/skins/LandingPageView.tsx` |
| `shared-components/skins/MediaPreviewView.tsx` | `client/src/features/shared/components/skins/MediaPreviewView.tsx` |
| `shared-components/skins/QRDynamicsScanSkin.tsx` | `client/src/features/shared/components/skins/QRDynamicsScanSkin.tsx` |
| `shared-components/skins/SelectCropDeleteSkin.tsx` | `client/src/features/shared/components/skins/SelectCropDeleteSkin.tsx` |
| `shared-components/skins/SourceImageSkin.tsx` | `client/src/features/shared/components/skins/SourceImageSkin.tsx` |
| `shared-components/skins/StoreProductSkin.tsx` | `client/src/features/shared/components/skins/StoreProductSkin.tsx` |
| `shared-components/skins/TemplatePickerSkin.tsx` | `client/src/features/shared/components/skins/TemplatePickerSkin.tsx` |
| `shared-components/skins/TemplateSkin.tsx` | `client/src/features/shared/components/skins/TemplateSkin.tsx` |
| `shared-components/skins/TextPreviewView.tsx` | `client/src/features/shared/components/skins/TextPreviewView.tsx` |

### Spec Documents
| Bundle File | Actual Path |
|-------------|-------------|
| `MEMBER_SANDBOX_SPEC.md` | `docs/MEMBER_SANDBOX_SPEC.md` |
| `QR_DYNAMICS_SPEC.md` | `docs/QR_DYNAMICS_SPEC.md` |
| `ASSET_LIBRARY_SPEC.md` | `ASSET_LIBRARY_SPEC.md` (root) |
