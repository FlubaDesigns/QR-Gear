# QR Gear

## Overview
QR Gear is a custom promotional merchandise e-commerce platform specializing in personalized apparel and products featuring QR codes. It integrates with Printify for print-on-demand fulfillment of USA-made items like hats, shirts, mugs, and bags. Users can generate and customize QR codes (text or image-based) and apply them to products. The platform targets B2B sales, particularly small businesses for marketing, with planned integration into Kingdom Connects, a faith-based business directory. Key product lines include Simple Text QR, Pre-designed Template Collections, Fully Custom QR Gifts, and the innovative "QR Dynamics™" (living QR) for changeable digital content, aiming for recurring revenue streams.

## User Preferences
Preferred communication style: Simple, everyday language.
Documentation: Keep ADMIN_MANUAL.md updated as admin features evolve.
Accessibility: User has CIDP (limited hand mobility) - agent should be fully autonomous.

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
- 2025-12-23: Fixed external store creation - now properly saves to PostgreSQL via POST /api/admin/partner-stores with auto-generated API key and unique slug. External stores appear immediately in dropdown after creation. Fixed switch component visibility with border-border class.
- 2025-12-23: Added cost extraction system for Printify products - printifyPrintProviders table now stores minCost/maxCost fields. Backend endpoint `/api/admin/catalog/fetch-costs` creates temporary placeholder products in Printify to extract real production costs (since Printify catalog API doesn't expose costs). Batch-details endpoint prioritizes cached costs from database.
- 2025-12-22: Added Printify catalog sync feature with local caching (printifyBlueprints, printifyPrintProviders tables), on-demand sync from admin products page, real-time status updates

## Next Priority: Printify Pricing Automation
Plan to implement automated cost fetching from Printify:
1. Background job module (lib/printify-cost-sync.ts) that creates temp products to extract costs, with throttling to avoid rate limits
2. Store cheapest single-print cost as minCost in printifyPrintProviders table
3. Run on schedule (nightly cron) plus on-demand trigger from admin
4. Show cost data in admin UI with staleness indicators (>24h badge)
5. Track sync status (timestamps, lastBlueprintId, errors) for resume capability