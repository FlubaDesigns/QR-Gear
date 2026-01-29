# QR Gear - System Reference Guide

## ⚠️ READ THIS EVERY 5 MINUTES - MANDATORY ⚠️

**PRODUCTION DEPLOYMENT IS NON-NEGOTIABLE:**
1. After EVERY code change, deploy to production immediately
2. After EVERY deployment, TEST the production server (https://qrgear-c1ffd.web.app)
3. NEVER just test dev - ALWAYS test production too
4. User has CIDP - cannot debug manually - agent must be 100% autonomous

**Deploy Command (run after every change):**
```bash
npm run build && echo "$FIREBASE_SERVICE_ACCOUNT_KEY" > /tmp/firebase-key.json && GOOGLE_APPLICATION_CREDENTIALS=/tmp/firebase-key.json firebase deploy --only hosting,functions
```

**Then TEST production endpoints with curl before reporting success.**

**Run Null Guard Tests (before deployment):**
```bash
cd client && npx vitest run src/features/adminProducts/builder/__tests__/nullGuards.test.ts
```
All 8 tests must pass before deploying.

---

## Overview
QR Gear is an e-commerce platform specializing in personalized promotional merchandise featuring custom QR codes. The platform integrates with Printify for print-on-demand fulfillment. Its core purpose is to enable users to design and order custom QR-enhanced products efficiently. The project aims to capture a niche market for businesses and individuals seeking unique, branded merchandise.

## User Preferences
- **Communication**: Simple, everyday language
- **Accessibility**: User has CIDP (limited hand mobility) - agent must be fully autonomous
- **Documentation**: Keep ADMIN_MANUAL.md updated as admin features evolve
- **Deployment**: ALL fixes must be deployed to Firebase production after making changes in dev. Never just fix in dev without deploying.
- **CRITICAL WORKFLOW**: After ANY code change, immediately call suggest_deploy. User tests in production only - they cannot see dev changes. Do NOT wait to be asked. Do NOT just restart dev workflow. ALWAYS trigger production publish.

## Session Rules (Hard and Fast)
1. Handle voice-to-text transcription errors
2. Verify/confirm before acting
3. Deploy and test BOTH dev AND production every time
4. Automate everything - no manual testing requests
5. "Let's talk" = discussion only, no code changes
6. Always read the page code before making new code

## Deployment Process (MANDATORY)
After every code fix, the agent MUST:
1. Run `npm run build` to build the frontend
2. Deploy to Firebase using:
   ```bash
   echo "$FIREBASE_SERVICE_ACCOUNT_KEY" > /tmp/firebase-key.json && GOOGLE_APPLICATION_CREDENTIALS=/tmp/firebase-key.json firebase deploy --only hosting,functions
   ```
3. Confirm deployment completed successfully
4. The live site is at: https://qrgear-c1ffd.web.app

## System Architecture

### UI/UX Decisions
The storefront displays lifestyle mockups over flat product shots for a more engaging user experience. Product pricing shown to customers is the admin-configured retail price (`customer_price`).

### Technical Implementations
- **Pricing System**: Prices are set by the admin and stored in `products.customer_price`. The admin can configure pricing via `/test-pricing`:
  - Markup percentage and fixed markup
  - Additional placement costs (per extra placement beyond first)
  - Text line upcharges (per header/footer line)
  - Hosting tiers (1/2/3 year) for Canvas/Play/Dynamics modes
  - Pricing formula: `CustomerPrice = (Base + Placements + Text + Hosting) × (1 + markup%) + fixedMarkup`
  - PricingModule displays live pricing breakdown in product builder
  - Pricing data is passed to save flows and stored in template/graphics metadata
- **Mockup System**: Utilizes Printful for generating high-quality mockups, including lifestyle images, for all product colors and three QR code sizes. Mockups are generated via a background job queue and stored in object storage.
- **QR Artwork Selection**: Automatic selection of QR code color (black or white) based on background product color luminance to ensure scannability.
- **COLOR_HEX_MAP**: A fallback color name → hex code lookup table in `StoreBuilderHarness.tsx` (~30 colors). Used when database doesn't provide hex values. Expandable for future color library needs.
- **Printify Local Catalog**: Product colors and sizes are synced weekly from Printify into `printify_print_providers` table, serving as a local source of truth. Only Printify products with valid Printful mappings are shown in the product builder.
- **Printful Native Catalog**: Full Printful catalog synced to `printfulProducts` collection in Firestore. 159+ products with colors, sizes, and model images. No mapping needed - use Printful products directly for seamless mockup generation.
  - Sync endpoint: `POST /test/catalog/printful-sync`
  - Catalog endpoint: `GET /test/catalog/printful-products` (returns categorized products)
  - Select "Printful" as fulfillment provider in the product builder to use native catalog
- **Dual Storage System**: Supports `postgres-only`, `dual-write`, and `firestore-only` modes, controlled by `STORAGE_MODE`. `dual-write` facilitates migration to a Firebase-centric deployment with PostgreSQL as the primary source for reads.
- **File Storage**: Uses Firebase Storage exclusively.
- **Background Image Library**: Canonical storage structure at `libraries/backgrounds/{raw|cropped|zip}/`. The "Sync from Storage" button scans this folder and creates database records for existing files. ZIP uploads are extracted automatically (original saved to `zip/`, images to `raw/`).
- **Admin Library Module**: Modular feature structure at `client/src/features/adminLibrary/` with tenant-aware architecture. Uses LibraryContext for multi-tenant support (storeId, apiBase, storageRoots, permissions). Route: `/admin/library`.
  - **Architecture**: Library is the handler/controller. Viewer lives underneath it and displays content.
  - **Modules**: Backgrounds, Templates, Source Images, Cropped Images - each module feeds content into the Viewer.
  - **Viewer**: The display component that renders content from whichever module is active.
- **Authentication**: Uses Firebase Authentication exclusively.
- **Nexus Self-Healing System**: Client-side self-healing with automatic retry logic, error capture, and an admin debugging console. Includes Printful retry profiles and a mockup fallback chain.
- **NexusMail Email System**: A portable, self-healing, queue-first, idempotent, provider-agnostic email system with automatic health monitoring and retry logic. Uses state-driven triggers, slug-based templates, and an outbox service.

### Feature Specifications
- **Product Management**: Admins can manage products, set retail prices, and control visibility.
- **Custom QR Code Integration**: Products can be customized with QR codes.
- **Shopping Cart**: Standard e-commerce cart operations.
- **Order Fulfillment Flow**: Integrates with Stripe for checkout, creates orders in Firestore, allows admin review, and submission/status sync with Printify. Automatic shipping and confirmation emails.

### Product Packet Architecture (January 2026)
The save system uses a **Product Packet** as the single source of truth:

```
PRODUCT PACKET (master record)
├── packetId
├── Large QR image (high-res master)
├── Large composite graphic (high-res master)
├── qrContent: URL (Canvas/Play/Dynamics) or Text (Basics)
├── Header/footer text
├── Pricing data
└── Product reference (id, name, blueprint, provider)

GRAPHICS ENTRY (lightweight reference)
├── graphicsId
├── packetId → references packet
└── Pulls images/content from packet on demand

TEMPLATE ENTRY (has its own sized copy)
├── templateId
├── packetId → references packet
├── selectedSize: "small" | "medium" | "large"
├── resizedImage: (generated at save time from packet's large master)
└── Triggers Printful mockup queue (size × color × location)

STORE BUILDER
├── Receives lightweight reference (packetId + what's available)
└── Queries database directly for actual assets
```

**Flow:** One save creates the packet → Graphics and Templates link to it → Store Builder queries DB by ID.

**API Endpoints (Test):**
- GET `/api/test/packets` - Get all packets (most recent 100)
- POST `/api/test/packets` - Create packet with qrOnlyUrl, compositeUrl, qrContent, pricing, productId, etc.
- GET `/api/test/packets/:packetId` - Retrieve packet by ID from Firestore
- GET `/api/test/templates` - Get all templates with linked packet data
- POST `/api/test/templates` - Create template linked to packet

**Product Lifecycle Flow (January 2026):**
1. **Products Builder** (test-products page):
   - User selects store + channel at top of page
   - User configures product, QR content, pricing
   - Clicks "Create Graphics" → creates packet + graphics + template + **storeProductLink**
   - storeProductLink locks in the store/channel assignment immediately
   - Navigates to Store Builder with `?packetId=xxx` in URL

2. **Store Builder** (test-store-builder page):
   - Loads packet from database, displays pricing breakdown
   - Store/channel dropdowns auto-populate from packet's saved destination
   - **If nothing changed** → nothing saved (just viewing)
   - **If anything changed** → creates NEW packet ID (fork) with its own storeProductLink
   - Original assignment stays intact; edits fork into separate item

**Fork-on-Edit Pattern (January 2026):**
When loading an existing packet and making changes:
1. Store Builder detects "edit mode" when loaded via `?packetId=xxx`
2. On save, creates a NEW packet (fork) instead of modifying original
3. New template and storeProductLink created for the fork
4. Original packet + original storeProductLink remain unchanged
5. UI shows "Edit Mode" warning: "Saving will create a new version"

**Admin Library Tabs:**
- **Graphics Tab**: Queries `productPackets` collection, displays compositeUrl/qrOnlyUrl
- **Templates Tab**: Queries `productTemplates` collection with linked packet data
- **Backgrounds Tab**: File-based uploads to Firebase Storage (unchanged)
- **Source Images/Cropped Tab**: File-based asset management (unchanged)

Route: `/admin/library` with URL param support: `?tab=graphics|templates|library|source|cropped`

### Store Library Architecture (January 2026)
The Store Library is an admin interface for viewing and managing products by store/channel.

**UI Flow:**
1. Role buttons (Internal/External/Member) filter store types
2. Store dropdown (queries `/api/test/stores?roleType=xxx`)
3. Channel dropdown (queries `/api/test/stores/{storeId}/channels`)
4. Channel title displays when store+channel selected
5. Product grid shows products linked to that channel

**storeProductLinks Collection (Firestore):**
```
{
  storeId: string,           // Store document ID
  storeName: string,         // Store display name
  channel: string,           // Channel name (e.g., "Test", "Church Merch")
  packetId: string | null,   // Reference to product packet
  templateId: string | null, // Reference to template
  graphicsId: string | null, // Reference to graphics entry
  productName: string,       // Display name for the product
  compositeUrl: string,      // URL to composite graphic image
  qrOnlyUrl: string,         // URL to QR-only image
  qrContent: string,         // QR code content/URL
  pricing: object,           // Pricing breakdown data
  enabledColors: string[],   // Enabled product colors
  enabledSizes: string[],    // Enabled product sizes
  selectedGraphicSize: string, // "small" | "medium" | "large"
  defaultColor: string,      // Default hero color
  createdAt: timestamp,
  updatedAt: timestamp
}
```

**API Endpoints:**
- GET `/api/test/stores/:storeId/channels/:channelId/products` - Get products for store/channel
- POST `/api/test/store-product-links` - Create a new store product link
- PATCH `/api/test/store-product-links/:linkId` - Update a store product link
- DELETE `/api/test/store-product-links/:linkId` - Delete a store product link

**Note:** The `:channelId` URL parameter is actually the channel name (not ID) for the GET endpoint.

### System Design Choices
- **Printful-First Mockup Architecture**: Decouples mockup generation (Printful) from order fulfillment (Printify).
- **Backend**: Node.js, Express, TypeScript.
- **Frontend**: React, TypeScript, Vite.
- **Database**: PostgreSQL with Drizzle ORM / Firestore, supporting a migration path to Firebase.
- **Nexus Vision Philosophy**: A self-learning, self-healing system using composable modules to detect problems, discover solutions, learn from success, and compose new solutions. Core data structures include `ProblemSignature`, `CapabilityModule`, `SolutionRecipe`, and `ModuleGraph`.

## External Dependencies
- **Printify**: Print-on-demand fulfillment.
- **Printful**: Product mockup generation.
- **Stripe**: Payment processing.
- **Firebase**: Hosting, Firestore, Firebase Storage, Cloud Functions, Authentication.
- **Neon**: Managed PostgreSQL database service.
- **Resend**: Email services.
- **TanStack Query**: Frontend data fetching and state management.
- **shadcn/ui**: UI component library.