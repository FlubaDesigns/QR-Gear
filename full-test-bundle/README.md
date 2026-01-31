# QR Gear Complete Test Bundle

This bundle contains ALL test pages and their complete dependency chains.

## Bundle Contents (282 files, 3MB)

### /test-pages (10 files)
Test pages accessible via routes:

| File | Route | Description |
|------|-------|-------------|
| test-ar-demo.tsx | /test-ar-demo | AR preview with Three.js |
| test-dynamics.tsx | /test-dynamics | QR Dynamics channels/collections |
| test-images.tsx | /test-images | Image upload and SmartImage testing |
| test-library.tsx | /test-library | Admin library (sources, crops, templates, graphics, backgrounds) |
| test-members.tsx | /test-members | Member sandbox - product customization |
| test-pricing.tsx | /test-pricing | Pricing settings management |
| test-products.tsx | /test-products | Product catalog and builder |
| test-settings.tsx | /test-settings | Admin settings panel |
| test-store-builder.tsx | /test-store-builder | Partner store configuration |
| test-stores.tsx | /test-stores | Partner store management |

### /features (4 directories)

#### /features/adminLibrary
- LibraryContext.tsx - Library state management
- /tabs/ - SourceImagesTab, CroppedImagesTab, TemplatesTab, GraphicsTab, BackgroundsTab

#### /features/adminProducts
- ProductsContext.tsx - Products state
- ProductsHarness.tsx - Product management harness
- /builder/ - BuilderContext, BuilderHarness, modules (ProductsModule, PlacementsModule, etc.)
- /storeBuilder/ - StoreBuilderHarness
- /storeLibrary/ - StoreLibraryHarness

#### /features/shared
- AdminAuthContext.tsx - Admin authentication
- /components/ - Core shared components:
  - SkinGridViewer.tsx - Grid viewer with skin rendering
  - SharedViewer.tsx - Generic viewer component
  - PlacementPicker.tsx - Product placement selection
  - TextStyleEditor.tsx - Text styling controls
  - HeaderFooterEditor.tsx - Header/footer editing
  - LandingPageEditor.tsx - Landing page configuration
  - BackgroundLibraryPicker.tsx - Background selection
  - /views/ - GridScrollView, ScrollView, QRDynamicsScanLightbox
  - /skins/ - 21 skin components (AllowedProductSkin, BackgroundSkin, ChannelItemSkin, etc.)

#### /features/storeBuilder
- StoreBuilderHarness.tsx - Store builder wrapper

### /components (32 files + /ui)
Shared UI components:
- SmartImage.tsx - Intelligent image loading with fallbacks
- ImageCropper.tsx - Image cropping tool
- ImageDesigner.tsx - Design canvas
- ProductMockup.tsx - Mockup preview
- InstantMockupPreview.tsx - Quick mockup generation
- Navbar.tsx - Navigation bar
- Footer.tsx - Site footer
- SEO.tsx - SEO meta tags
- NexusConsole.tsx - Debug console
- /ui/ - All Shadcn UI primitives (Button, Card, Input, Dialog, etc.)

### /hooks (8 files)
Custom React hooks:
- useAuth.ts - Firebase authentication
- useButtonState.ts - Button state management
- useGuestCart.ts - Guest shopping cart
- use-media-query.ts - Responsive breakpoints
- use-mobile.tsx - Mobile detection
- useMockupWithFallback.ts - Mockup loading with fallback
- use-toast.ts - Toast notifications
- use-upload.ts - File upload handling

### /lib (18 files)
Client utilities:
- firebase.ts - Firebase client config
- queryClient.ts - TanStack Query setup
- fileService.ts - File operations
- imageLoader.ts - Image loading utilities
- nexus.ts - Nexus API client
- admin-utils.ts - Admin helper functions
- breadcrumbs.ts - Navigation breadcrumbs
- categories.ts - Product categories
- mockup-fallback.ts - Mockup fallback logic
- mockup-gallery.ts - Gallery utilities

### /server (1 main + 27 lib files)
Server-side code:
- routes.ts - All API endpoints (14,000+ lines)
- /lib/:
  - printify.ts - Printify API client
  - printful.ts - Printful API client
  - mockup-service.ts - Mockup generation
  - mockup-job-queue.ts - Background job queue
  - firebase-admin.ts - Firebase Admin SDK
  - firebase-storage-service.ts - Firebase Storage operations
  - firestore-adapter.ts - Firestore data adapter
  - dual-write-adapter.ts - Dual-write for migration
  - email.ts - Email sending (Resend)
  - qr-generator.ts - QR code generation
  - svg-renderer.ts - SVG rendering
  - composite-image-generator.ts - Image compositing
  - content-upload-service.ts - Content uploads
  - image-upload.ts - Image upload handling
  - local-mockup-generator.ts - Local mockup gen
  - printify-cost-sync.ts - Cost synchronization
  - printify-orders.ts - Order management
  - cron-jobs.ts - Scheduled tasks
  - sitemap.ts - Sitemap generation
  - widget-auth.ts - Widget authentication
  - widget-token-generator.ts - Token generation
  - storage-factory.ts - Storage abstraction
  - storage-path-normalizer.ts - Path normalization
  - env-config-mapper.ts - Environment config
  - field-mapper.ts - Field mapping utilities

### /docs (3 files)
- FIRESTORE_DATA_MODEL.md - Database schema
- MEMBER_SANDBOX_SPEC.md - Member sandbox specification
- QR_DYNAMICS_SPEC.md - QR Dynamics specification

### schema.ts
Shared Drizzle/Zod schema with all database models and types.

---

## API Endpoints Quick Reference

### Member Sandbox
- GET/POST /api/members/allowed-products
- GET/POST /api/members/products

### Partner Stores
- GET/POST /api/partner-stores
- GET/PATCH /api/partner-stores/:id

### Printify
- GET /api/printify/blueprints
- GET /api/printify/blueprints/:id
- GET /api/printify/blueprints/:id/providers
- POST /api/printify/sync-catalog

### Library
- GET/POST/DELETE /api/library/backgrounds
- GET/POST /api/library/sources
- GET/POST /api/library/cropped

### QR Dynamics
- GET/POST /api/dynamics/channels
- GET/POST /api/dynamics/collections

### Settings
- GET/POST /api/settings/pricing

### Files
- GET /api/files/:path (Firebase Storage proxy)
- POST /api/upload

---

## Architecture

**Viewer/View/Skin Pattern:**
- Viewer: Fetches data, manages state
- View: Layout (grid, list, scroll)
- Skin: Individual item renderer

**Harness Pattern:**
- Harnesses wrap features for isolated testing
- Each harness provides mock data or API connections
- Test pages compose harnesses together

**Storage:**
- All file assets use Firebase Storage exclusively
- Served via /api/files/ endpoint (not direct URLs)
- Images auto-migrate from Printify to Firebase
