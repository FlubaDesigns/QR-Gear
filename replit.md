# QR Gear

## Overview
QR Gear is a custom promotional merchandise e-commerce platform specializing in personalized apparel and products featuring QR codes. It integrates with Printify for print-on-demand fulfillment of USA-made items like hats, shirts, mugs, and bags. Users can generate and customize QR codes (text or image-based) and apply them to products. The platform targets B2B sales, particularly small businesses for marketing, with planned integration into Kingdom Connects, a faith-based business directory. Key product lines include Simple Text QR, Pre-designed Template Collections, Fully Custom QR Gifts, and the innovative "QR Dynamics™" (living QR) for changeable digital content, aiming for recurring revenue streams.

## User Preferences
Preferred communication style: Simple, everyday language.
Documentation: Keep ADMIN_MANUAL.md updated as admin features evolve.
Accessibility: User has CIDP (limited hand mobility) - agent should be fully autonomous.

## CRITICAL Rules
- **NEVER remove existing features without explicit user request.** User pays for agent time - removing and re-adding features wastes money.
- Always confirm back what user said BEFORE starting work on changes.
- Product flow steps are LOCKED and must not be changed:
  1. Store Type (Internal/External)
  2. Select Store
  3. Store Locations (switches for each segment)
  4. Store Occasion (Featured/Seasonal switches)
  5. Product Source (Library/Custom)
  6. Product Type (for Library) or Custom Builder (for Custom)

## System Architecture

### Frontend
- **Framework**: React with TypeScript, bundled with Vite
- **UI Components**: shadcn/ui with Radix UI
- **Styling**: Tailwind CSS (dark/light modes)
- **State Management**: TanStack React Query
- **Forms**: React Hook Form with Zod validation
- **Payments**: Stripe React integration
- **Path Aliases**: `@/` (client/src), `@shared/` (shared/)

### Backend
- **Runtime**: Node.js with Express
- **Language**: TypeScript with ES modules
- **API Pattern**: RESTful endpoints under `/api/`
- **Build**: esbuild

### Database
- **Primary Database**: PostgreSQL via Neon serverless
- **ORM**: Drizzle ORM with drizzle-kit for migrations
- **Schema**: `shared/schema.ts`
- **Key Tables**: `users`, `products`, `productVariants`, `printifyBlueprints`, `qrDesigns`, `qrTemplates`, `customGifts`, `hostingTiers`, `partnerStores`, `cartItems`, `orders`, `adminSettings`, `pricingRules`.
- **Secondary Data Store**: Firebase Firestore for dynamic categories.

### Four QR Product Lines
1.  **Simple Text QR**: User-entered URL/text on any Printify product.
2.  **Featured Collections**: Admin-curated templates with QR codes linking to hosted images.
3.  **Fully Custom QR Gifts**: User uploads image, adds text, with tiered hosting options.
4.  **QR Dynamics™**: Physical product with a permanent QR linking to a changeable digital content page (images, videos, links) via a user dashboard, with a subscription model.

### Core Features
-   Server-side QR code generation.
-   Product customization with QR placement options.
-   Shopping cart and order processing.
-   Embeddable widget system for partners (e.g., Kingdom Connects).
-   Premium QR Text options with upcharges.
-   Firestore-based product category system.
-   Pricing strategy: no upfront prices, final price after customization.

### Design System
-   **Typography**: Inter (body), Space Grotesk (headings).
-   **Layout**: Mobile-first responsive, max-w-7xl containers.
-   **Components**: Card-based, consistent styling.

## External Dependencies

### Third-Party Services
-   **Printify API**: Print-on-demand fulfillment.
-   **Stripe**: Payment processing (checkout, subscriptions).
-   **Firebase/Firestore**: Secondary data store for categories and real-time features.
-   **Neon Database**: Primary PostgreSQL hosting.
-   **Resend**: Email delivery for order confirmations and reminders.

### Key NPM Packages
-   `@neondatabase/serverless`: PostgreSQL connectivity.
-   `drizzle-orm` / `drizzle-kit`: ORM and migrations.
-   `@stripe/stripe-js` / `@stripe/react-stripe-js`: Stripe integration.
-   `qrcode`: QR code generation.
-   `jsonwebtoken`: Widget authentication.
-   `@tanstack/react-query`: Data fetching.
-   `zod`: Schema validation.
-   `express-rate-limit`: API rate limiting.

## Recent Changes
- 2025-12-23: Restored segment selection step in product flow (Store Type → Store → Segment → Product Source). Segment dropdown now appears after store selection.
- 2025-12-23: Custom Product Builder improvements - (1) Font preview: each font selection now shows a live sample of how that font looks. (2) Composite image generator: server-side generation of print-ready images (header + QR + footer on white background) stored in `printifyCompositeUrl` for Printify submission. (3) Multi-placement support: `placements` stored as text array in database.
- 2025-12-23: Implemented automated Printify cost sync system - background job module (server/lib/printify-cost-sync.ts) creates temp products to extract real production costs. Features: printifyCostSync table tracks sync progress, resume capability from paused syncs, finally block cleanup prevents orphaned Printify products, 3s rate limiting between requests, staleness indicators (>24h badge) in admin UI with real-time progress display.
- 2025-12-23: Fixed external store creation - now properly saves to PostgreSQL via POST /api/admin/partner-stores with auto-generated API key and unique slug. External stores appear immediately in dropdown after creation. Fixed switch component visibility with border-border class.
- 2025-12-23: Added cost extraction system for Printify products - printifyPrintProviders table now stores minCost/maxCost fields. Backend endpoint `/api/admin/catalog/fetch-costs` creates temporary placeholder products in Printify to extract real production costs (since Printify catalog API doesn't expose costs). Batch-details endpoint prioritizes cached costs from database.
- 2025-12-22: Added Printify catalog sync feature with local caching (printifyBlueprints, printifyPrintProviders tables), on-demand sync from admin products page, real-time status updates

## Printify Cost Sync System
The cost sync system extracts real production costs from Printify by creating temporary placeholder products (since Printify's catalog API doesn't expose costs):

**Key Components:**
- `server/lib/printify-cost-sync.ts`: Background job module with rate limiting and resume capability
- `printifyCostSync` table: Tracks sync progress (status, counts, lastProcessedProviderId)
- Admin endpoints: `/api/admin/catalog/sync-all-costs`, `/api/admin/catalog/cost-sync-status`, `/api/admin/catalog/cancel-cost-sync`

**Features:**
- Creates temp products with placeholder image to extract variant costs
- Stores minCost/maxCost in printifyPrintProviders table
- Resume from paused syncs using lastProcessedProviderId
- Finally block cleanup prevents orphaned Printify products
- 3s delay between requests to avoid rate limits
- Staleness threshold: 24 hours (amber badge in admin UI)