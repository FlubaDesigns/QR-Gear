# QR Gear

## Overview
QR Gear is an e-commerce platform for personalized promotional merchandise, focusing on apparel and products featuring custom QR codes. It integrates with Printify for print-on-demand fulfillment of USA-made items. The platform allows users to generate and customize QR codes (text or image-based) and apply them to various products. QR Gear targets B2B sales, particularly small businesses for marketing purposes, with plans for integration into the Kingdom Connects business directory. The platform offers four distinct QR product lines, including the innovative "QR Dynamics™" for changeable digital content, aiming to establish recurring revenue streams.

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
- **Schema**: `shared/schema.ts`
- **Secondary Data Store**: Firebase Firestore for dynamic categories.

### Core Features
- Server-side QR code generation with customization options.
- Four QR product lines: Simple Text QR, Featured Collections, Fully Custom QR Gifts, and QR Dynamics™ (subscription-based dynamic content).
- Multi-Provider Orchestration System for publishing products to various print providers and marketplaces (Printify, Printful, Apliiq, Etsy, eBay, Amazon).
- Shopping cart and order processing.
- Embeddable widget system for partners.
- Admin UI for managing products, channels, and health, designed with mobile-first accessibility.
- Automated Printify cost sync system for extracting real production costs.
- SVG text rendering pipeline for print-ready images with text warp effects.
- Per-placement artwork mode for product customization.

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