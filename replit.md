# QR Gear

## Overview
QR Gear is an e-commerce platform specializing in personalized promotional merchandise, primarily apparel and products featuring custom QR codes. It integrates with Printify for print-on-demand fulfillment of USA-made items. The platform enables users to generate and customize QR codes (text or image-based) and apply them to various products. QR Gear targets B2B sales, particularly small businesses for marketing, and plans integration into the Kingdom Connects business directory. It offers four distinct QR product lines, including the innovative "QR Dynamics™" for changeable digital content, aiming to establish recurring revenue.

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

### Backend
- **Runtime**: Node.js with Express
- **Language**: TypeScript with ES modules
- **API Pattern**: RESTful endpoints under `/api/`

### Database
- **Primary Database**: PostgreSQL via Neon serverless
- **ORM**: Drizzle ORM with drizzle-kit for migrations
- **Secondary Data Store**: Firebase Firestore for dynamic categories.

### Core Features
- Server-side QR code generation with customization options.
- Five QR product lines: QR Basics, QR Plus, QR Canvas, QR Play, and QR Dynamics™ (subscription-based with updateable destinations and analytics).
- Multi-Provider Orchestration System for publishing products to various print providers and marketplaces.
- Shopping cart and order processing.
- Embeddable widget system for partners.
- Admin UI for managing products, channels, and system health.
- Automated Printify cost sync system for real production costs.
- SVG text rendering pipeline for print-ready images with text warp effects.
- Per-placement artwork mode for product customization.
- **Pricing Architecture**: Uses `customerPrice` from Admin Products; no recalculation on frontend. `products.customer_price` stores admin-configured retail price.
- **Printify Local Catalog**: All product data (colors, sizes, costs) sourced from a local database (`printify_print_providers` table), synced weekly via a cron job. UI reads exclusively from this local data.
- **Mockup Caching**: Database-first (`mockup_cache` table) with Printify API as a fallback. Uses canonical placements and supports automatic black/white QR artwork selection based on shirt color luminance.

### Design System
- **Typography**: Inter (body), Space Grotesk (headings).
- **Layout**: Mobile-first responsive, `max-w-7xl` containers.
- **Components**: Card-based, consistent styling with `h-12` touch targets for accessibility.

## External Dependencies

### Third-Party Services
- **Printify API**: Print-on-demand fulfillment.
- **Stripe**: Payment processing (checkout, subscriptions).
- **Firebase/Firestore**: Secondary data store for categories and real-time features.
- **Neon Database**: PostgreSQL hosting.
- **Resend**: Email delivery.

### Key NPM Packages
- `@neondatabase/serverless`: PostgreSQL connectivity.
- `drizzle-orm` / `drizzle-kit`: ORM and migrations.
- `@stripe/stripe-js` / `@stripe/react-stripe-js`: Stripe integration.
- `qrcode`: QR code generation.
- `jsonwebtoken`: Widget authentication.
- `@tanstack/react-query`: Data fetching.
- `zod`: Schema validation.
- `express-rate-limit`: API rate limiting.
- `@resvg/resvg-js`: SVG to PNG conversion.