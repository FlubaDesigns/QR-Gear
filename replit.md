# QR Gear - System Reference Guide

## Overview
QR Gear is an e-commerce platform specializing in personalized promotional merchandise featuring custom QR codes. The platform integrates with Printify for print-on-demand fulfillment. Its core purpose is to enable users to design and order custom QR-enhanced products efficiently. The project aims to capture a niche market for businesses and individuals seeking unique, branded merchandise.

## User Preferences
- **Communication**: Simple, everyday language
- **Accessibility**: User has CIDP (limited hand mobility) - agent must be fully autonomous
- **Documentation**: Keep ADMIN_MANUAL.md updated as admin features evolve
- **Deployment**: ALL fixes must be deployed to Firebase production after making changes in dev. Never just fix in dev without deploying.

## System Architecture

### UI/UX Decisions
The storefront displays lifestyle mockups over flat product shots for a more engaging user experience. Product pricing shown to customers is the admin-configured retail price (`customer_price`).

### Technical Implementations
- **Pricing System**: Prices are set by the admin and stored in `products.customer_price`. This value is the single source of truth for retail pricing and is never recalculated from base costs.
- **Mockup System**: Utilizes Printful for generating high-quality mockups, including lifestyle images, as Printify does not support mockups for unpublished products. Mockups are generated for all product colors and three QR code sizes (25%, 45%, 65% of print area) via a background job queue to respect Printful's API rate limits. Mockups are stored in object storage.
- **QR Artwork Selection**: Automatic selection of QR code color (black or white) based on the background product color's luminance to ensure scannability. Dark backgrounds receive white QRs, and light backgrounds receive black QRs.
- **Printify Local Catalog**: Product colors and sizes are synced weekly from Printify into the `printify_print_providers` table. This local catalog serves as the source of truth, avoiding direct API calls for product options.
- **Database Schema**: Key tables include `products` (storing product details, prices, mockups, and Printify IDs), `mockup_cache` (for generated mockup variations), and `custom_designs` (for design images and cached mockups).
- **Dual Storage System**: The system supports `postgres-only`, `dual-write`, and `firestore-only` modes, controlled by the `STORAGE_MODE` environment variable. In `dual-write` mode, data is written to both PostgreSQL and Firestore, with PostgreSQL as the primary source for reads. This facilitates migration to a Firebase-centric deployment.
- **File Storage**: Uses Firebase Storage exclusively for all file operations. No Replit dependencies.
- **Authentication**: Uses Firebase Authentication for all user sessions. Replit OIDC removed.

### Feature Specifications
- **Product Management**: Admins can manage products, set retail prices, and enable/disable product visibility.
- **Custom QR Code Integration**: Products can be customized with QR codes.
- **Shopping Cart**: Standard e-commerce cart operations are supported.

### System Design Choices
- **Printful-First Mockup Architecture**: Decouples mockup generation (Printful) from order fulfillment (Printify) to overcome Printify's limitations with draft products.
- **Node.js, Express, TypeScript Backend**: Provides a robust and scalable API layer.
- **React, TypeScript, Vite Frontend**: Modern and efficient user interface.
- **PostgreSQL with Drizzle ORM / Firestore**: Flexible and performant database solutions, supporting a migration path to Firebase.

## External Dependencies
- **Printify**: For print-on-demand fulfillment services.
- **Printful**: For generating product mockups, including lifestyle images.
- **Stripe**: For payment processing.
- **Firebase**: For hosting, Firestore database (migration target), Firebase Storage, and Cloud Functions for the backend API.
- **Neon**: Managed PostgreSQL database service.
- **Resend**: For email services.
- **TanStack Query**: For data fetching and state management in the frontend.
- **shadcn/ui**: UI component library.

## Firebase Deployment

### Full Firebase Independence
The system is now fully independent from Replit services:
- **Database**: Firestore (default STORAGE_MODE is 'firestore-only')
- **File Storage**: Firebase Storage exclusively
- **Authentication**: Firebase Auth exclusively
- **API Backend**: Firebase Cloud Functions

### API URL Architecture
The frontend auto-detects the environment and routes API calls correctly:
- **Dev (Replit)**: Uses relative `/api` paths via Vite proxy
- **Production (Firebase Hosting)**: Auto-detects `qrgear-c1ffd.web.app` hostname and routes to `https://us-central1-qrgear-c1ffd.cloudfunctions.net/api`

This is handled in `client/src/lib/queryClient.ts` - no manual configuration needed.

### Quick Deploy Command (ALWAYS USE THIS)
After any code change, run this single command to deploy everything:
```bash
npm run build && cd functions && npm run build && cd .. && export GOOGLE_APPLICATION_CREDENTIALS=/tmp/firebase-sa.json && echo "$FIREBASE_SERVICE_ACCOUNT_KEY" > /tmp/firebase-sa.json && npx firebase deploy --only functions,hosting --force && rm -f /tmp/firebase-sa.json
```

### Deploying Cloud Functions Only
To deploy only Cloud Functions:
1. Build: `cd functions && npm run build`
2. Deploy: `export GOOGLE_APPLICATION_CREDENTIALS=/tmp/firebase-sa.json && echo "$FIREBASE_SERVICE_ACCOUNT_KEY" > /tmp/firebase-sa.json && npx firebase deploy --only functions && rm -f /tmp/firebase-sa.json`

### Cloud Functions Configuration
The Firebase Cloud Functions require environment variables to be set via Google Cloud Console:

1. Go to: https://console.cloud.google.com/functions
2. Select the `api` function in `us-central1`
3. Click "Edit" → "Runtime, build, connections and security settings"
4. Under "Runtime environment variables", add:
   - `PRINTFUL_API_KEY`: Your Printful API key
   - `PRINTIFY_API_KEY`: Your Printify API key (for order fulfillment)
   - `PRINTIFY_SHOP_ID`: Your Printify shop ID
   - `STRIPE_SECRET_KEY`: Your Stripe secret key
   - `STRIPE_WEBHOOK_SECRET`: Your Stripe webhook secret
   - `QR_RESEND_API_KEY`: Your Resend API key (for transactional emails)
5. Deploy/Save the changes

### Deployed Endpoints
- **API Base URL**: https://us-central1-qrgear-c1ffd.cloudfunctions.net/api
- **Health Check**: GET /health
- **Storefront Mockup**: POST /storefront/generate-mockup

### Order Fulfillment Flow
1. **Checkout**: Customer completes Stripe checkout (shipping address collected)
2. **Webhook**: `checkout.session.completed` creates order in Firestore with shipping address
3. **Admin Review**: Admin views orders at /admin/orders
4. **Printify Submission**: Admin calls POST /admin/orders/:id/submit-to-printify
5. **Status Sync**: Admin calls POST /admin/orders/:id/sync-printify to get tracking info

### Order Admin Endpoints (require admin auth)
- `GET /admin/orders` - List all orders with fulfillment status
- `GET /admin/orders/:id` - Get order details with items
- `POST /admin/orders/:id/submit-to-printify` - Submit order to Printify for fulfillment
- `POST /admin/orders/:id/sync-printify` - Sync order status and tracking from Printify (auto-sends shipping email if tracking is new)
- `POST /admin/orders/:id/send-shipping-email` - Manually send shipping notification email
- `POST /admin/orders/:id/resend-confirmation` - Resend order confirmation email
- `PATCH /admin/orders/:id` - Manually update order status/tracking

### Email System (QR Gear - Separate from KC)
- Order confirmation emails sent automatically after checkout
- Shipping notification emails sent automatically when tracking is added via sync-printify
- Uses Resend API with separate QR Gear account (not shared with KC)
- Sender: `QR Gear <noreply@qrgear.com>` (requires domain verification in Resend)

### Order Status Mapping
- pending/on-hold → pending
- in-production → in_production  
- fulfilled → shipped
- canceled → cancelled

### Mockup Caching
Mockups are cached in Firestore `mockupCache` collection with key format: `{blueprintId}_{colorName}_{artworkVariant}`

## Nexus Self-Healing System

### Overview
Client-side self-healing system with automatic retry logic, error capture, and admin debugging console.

### Core Files
- `client/src/lib/nexus.ts` - Core NexusCore class with retry logic, event logging, error capture
- `client/src/lib/nexusFetch.ts` - Generic fetch wrapper with Nexus retry
- `client/src/lib/nexusFetchProfiled.ts` - Profiled fetch for Printful calls (BULK vs SINGLE)
- `client/src/lib/mockup-fallback.ts` - Graceful mockup URL fallback chain
- `client/src/components/NexusErrorBoundary.tsx` - React error boundary for crash prevention
- `client/src/components/NexusConsole.tsx` - Admin-only debug console

### Printful Retry Profiles
```typescript
NexusProfiles.PRINTFUL_BULK   // tries: 2, slow backoff (for product-level bulk generation)
NexusProfiles.PRINTFUL_SINGLE // tries: 4, fast backoff (for on-demand preview)
```

### Source Tags (Required for Debugging)
All Printful mockup calls must use one of these tags:
- `"printful:mockups:bulk"` - Product-level full set generation
- `"printful:mockup:single"` - Single variant preview
- `"printful:mockup:fill-missing"` - Fill missing from partial bulk

### Features
- **Bulk Lock**: Prevents double-fire of bulk jobs (120s cooldown)
- **Fill Missing**: Throttled single calls for partial bulk results (max 6 per cycle)
- **Cache Protection**: `mergeMockupMaps()` never overwrites good URLs with empty
- **Mockup Fallback Chain**: exact → same-color → any-cached → default → thumbnail → placeholder
- **No-Retry on Hard Failures**: 400/401/403/404 return immediately, only retry 429/5xx

### Converted Files
All raw fetch() calls converted to nexusFetch or nexusFetchProfiled:
- `queryClient.ts` - Core API request handling
- `use-upload.ts` - File upload presigned URLs
- `store.tsx` - Product categories
- `FeaturedProducts.tsx` - Featured products + single mockup generation
- `widget.tsx` - Widget session loading
- `gift-redeem.tsx` - Gift code lookup
- `view-dynamic.tsx` - Dynamic page loading
- `store-build.tsx` - Partner store products + single mockup generation
- `shop-segment.tsx` - Store segment + single mockup generation
- `admin-products.tsx` - Admin single mockup generation

## Library Maintenance
See `updates.md` for a schedule of libraries requiring regular updates.