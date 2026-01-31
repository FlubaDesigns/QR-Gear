# QR Gear Test Pages Bundle

## Contents

### /harnesses (5 files)
Test harness components that wrap features for isolated testing:

| File | Purpose | Used By |
|------|---------|---------|
| BuilderHarness.tsx | Product builder with design tools | test-products.tsx |
| ProductsHarness.tsx | Admin product management | test-products.tsx |
| StoreBuilderHarness.tsx | Store configuration UI | test-store-builder.tsx |
| StoreBuilderHarness2.tsx | Alternate store builder (adminProducts) | test-store-builder.tsx |
| StoreLibraryHarness.tsx | Background library management | test-library.tsx |

### /test-pages (10 files)
Full test pages accessible via routes:

| File | Route | Purpose |
|------|-------|---------|
| test-ar-demo.tsx | /test-ar-demo | AR preview demonstration |
| test-dynamics.tsx | /test-dynamics | QR Dynamics channels/collections |
| test-images.tsx | /test-images | Image upload and cropping |
| test-library.tsx | /test-library | Background library (admin + personal) |
| test-members.tsx | /test-members | Member sandbox products |
| test-pricing.tsx | /test-pricing | Pricing settings management |
| test-products.tsx | /test-products | Product catalog and builder |
| test-settings.tsx | /test-settings | Admin settings panel |
| test-store-builder.tsx | /test-store-builder | Partner store configuration |
| test-stores.tsx | /test-stores | Partner store management |

### /skins (21 files)
Reusable skin components for the Viewer/View/Skin pattern:

| Skin | Data Type | Usage |
|------|-----------|-------|
| AllowedProductSkin.tsx | Member allowed products | Product selection grid |
| BackgroundSkin.tsx | Library backgrounds | Background picker |
| ChannelContentSkin.tsx | Dynamics channel content | Channel detail view |
| ChannelItemSkin.tsx | Dynamics channel | Channel list item |
| CollectionItemSkin.tsx | Dynamics collection | Collection list item |
| CollectionItemSkinV2.tsx | Dynamics collection v2 | Enhanced collection display |
| CropDeleteSkin.tsx | Cropped images | Crop management |
| CroppedImageSkin.tsx | Cropped image display | Image preview |
| DeleteSkin.tsx | Generic delete action | Delete confirmation |
| DynamicsChannelSkin.tsx | Dynamics channel | Channel card |
| DynamicsCollectionSkin.tsx | Dynamics collection | Collection card |
| GraphicPreviewView.tsx | Graphics | Graphic preview |
| GraphicsSkin.tsx | Graphics library | Graphics picker |
| LandingPageView.tsx | Landing pages | Page preview |
| MediaPreviewView.tsx | Media assets | Media preview |
| QRDynamicsScanSkin.tsx | QR scan results | Scan display |
| SelectCropDeleteSkin.tsx | Image selection | Multi-action skin |
| SourceImageSkin.tsx | Source images | Image source picker |
| StoreProductSkin.tsx | Store products | Product display |
| TemplatePickerSkin.tsx | Templates | Template selection |
| TemplateSkin.tsx | Templates | Template display |
| TextPreviewView.tsx | Text content | Text preview |

### /docs (3 files)
Specification documents:

- FIRESTORE_DATA_MODEL.md - Database schema and collections
- MEMBER_SANDBOX_SPEC.md - Member sandbox feature spec
- QR_DYNAMICS_SPEC.md - QR Dynamics system spec

---

## API Endpoints Reference

### Member Sandbox
| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | /api/members/allowed-products | Get products members can customize |
| POST | /api/members/allowed-products | Update allowed products list |
| GET | /api/members/products | Get member's created products |
| POST | /api/members/products | Create member product |

### Partner Stores
| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | /api/partner-stores | List all partner stores |
| POST | /api/partner-stores | Create partner store |
| GET | /api/partner-stores/:id | Get store details |
| PATCH | /api/partner-stores/:id | Update store |

### Printify Integration
| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | /api/printify/blueprints | Get product blueprints |
| GET | /api/printify/blueprints/:id | Get blueprint details |
| GET | /api/printify/blueprints/:id/providers | Get print providers |
| POST | /api/printify/sync-catalog | Sync product catalog |

### Library Assets
| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | /api/library/backgrounds | Get background images |
| POST | /api/library/backgrounds | Upload background |
| DELETE | /api/library/backgrounds/:id | Delete background |

### QR Dynamics
| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | /api/dynamics/channels | List channels |
| POST | /api/dynamics/channels | Create channel |
| GET | /api/dynamics/collections | List collections |
| POST | /api/dynamics/collections | Create collection |

### Settings
| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | /api/settings/pricing | Get pricing settings |
| POST | /api/settings/pricing | Update pricing settings |

### Files (Firebase Storage)
| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | /api/files/:path | Serve file from Firebase Storage |
| POST | /api/upload | Upload file to Firebase Storage |

---

## Architecture Pattern

All UI components follow the **Viewer/View/Skin** pattern:
- **Viewer**: Container that fetches data and manages state
- **View**: Layout component that arranges items
- **Skin**: Individual item renderer (the files in /skins)

Example: `SkinGridViewer` + `AllowedProductSkin` = Product selection grid
