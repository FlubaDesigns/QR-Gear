# QR Gear Test Suite - No-Auth Testing Environment

All files in this archive work WITHOUT authentication using `/api/test` endpoints.

## Test Pages (client/src/pages/)

| Page | URL | Purpose |
|------|-----|---------|
| test-products.tsx | /test-products | Product builder with QR code creation, pricing, saves |
| test-pricing.tsx | /test-pricing | Admin pricing configuration |
| test-stores.tsx | /test-stores | Store/channel management |
| test-store-builder.tsx | /test-store-builder | Receives product packages for store assignment |
| test-library.tsx | /test-library | Background/template library |
| test-images.tsx | /test-images | Image testing |
| test-dynamics.tsx | /test-dynamics | Dynamic QR mode testing |
| admin-test-images.tsx | /admin-test-images | Admin image testing |
| admin-test-upload.tsx | /admin-test-upload | Admin upload testing |

## Key Flows

### Product Builder Flow (test-products.tsx)
1. Select product from catalog
2. Configure QR content, placements, text
3. See live pricing breakdown
4. Save options:
   - **Store**: Package data → sessionStorage → navigate to test-store-builder
   - **Save All**: Save template + graphics to DB → package with IDs → navigate to test-store-builder

### Data Package (sessionStorage "productPackage")
```json
{
  "templateId": "from database save",
  "graphicsId": "from database save", 
  "productName": "Product Title",
  "qrContent": "https://...",
  "compositeUrl": "https://...",
  "qrOnlyUrl": "https://...",
  "pricing": { "customerPrice": 29.99, "breakdown": {...} }
}
```

## API Endpoints Used

- GET /api/test/printify/catalog - Product catalog with prices
- GET /api/test/pricing-settings - Admin pricing configuration
- POST /api/test/templates/full-save - Save product template
- POST /api/test/graphics/save - Save graphics to library
- GET /api/test/products - Test products list
- GET /api/test/stores - Stores list
- GET /api/test/channels - Channels list

## Files Included

- **pages/** - 9 test page components
- **builder/** - Product builder modules, hooks, components, context
- **storeBuilder/** - Store assignment modules
- **storeLibrary/** - Store/channel/product listing modules
- **shared/** - Shared components
- **server/** - Server route extracts

## Server Libraries (server/lib/)

| File | Purpose |
|------|---------|
| firebase-admin.ts | Firebase Admin SDK initialization |
| firestore-adapter.ts | Firestore CRUD operations adapter |
| firebase-storage-service.ts | Firebase Storage file operations |
| storage-factory.ts | Storage mode switching (postgres/dual/firestore) |
| field-mapper.ts | Field name mapping between systems |
| qr-generator.ts | QR code generation with styling |
| mockup-service.ts | Printful mockup generation |
| image-upload.ts | Image upload handling |

## Database Schema (db/schema.ts, shared/schema.ts)

Drizzle ORM schema definitions for PostgreSQL tables including:
- products, productTemplates, graphicAssets
- stores, channels, orders
- mockupJobs, printifyProducts
- pricingSettings, and more

## Client Libraries (client/lib/)

| File | Purpose |
|------|---------|
| firebase.ts | Firebase client SDK initialization |
| auth.ts | Authentication helpers |
| queryClient.ts | TanStack Query configuration |
| nexus.ts | Self-healing system client |

## Firestore Collections Used

- `productTemplates` - Saved product configurations
- `graphicAssets` - QR/composite images library
- `stores` - Store configurations
- `channels` - Sales channels
- `orders` - Customer orders
- `pricingSettings` - Admin pricing config
