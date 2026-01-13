# QR Gear - System Reference Guide

## Overview
QR Gear is an e-commerce platform specializing in personalized promotional merchandise featuring custom QR codes. The platform integrates with Printify for print-on-demand fulfillment. Its core purpose is to enable users to design and order custom QR-enhanced products efficiently. The project aims to capture a niche market for businesses and individuals seeking unique, branded merchandise.

## User Preferences
- **Communication**: Simple, everyday language
- **Accessibility**: User has CIDP (limited hand mobility) - agent must be fully autonomous
- **Documentation**: Keep ADMIN_MANUAL.md updated as admin features evolve
- **Deployment**: ALL fixes must be deployed to Firebase production after making changes in dev. Never just fix in dev without deploying.

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
- **Pricing System**: Prices are set by the admin and stored in `products.customer_price`. This value is the single source of truth for retail pricing.
- **Mockup System**: Utilizes Printful for generating high-quality mockups, including lifestyle images, for all product colors and three QR code sizes. Mockups are generated via a background job queue and stored in object storage.
- **QR Artwork Selection**: Automatic selection of QR code color (black or white) based on background product color luminance to ensure scannability.
- **Printify Local Catalog**: Product colors and sizes are synced weekly from Printify into `printify_print_providers` table, serving as a local source of truth.
- **Dual Storage System**: Supports `postgres-only`, `dual-write`, and `firestore-only` modes, controlled by `STORAGE_MODE`. `dual-write` facilitates migration to a Firebase-centric deployment with PostgreSQL as the primary source for reads.
- **File Storage**: Uses Firebase Storage exclusively.
- **Background Image Library**: Canonical storage structure at `libraries/backgrounds/{raw|cropped|zip}/`. The "Sync from Storage" button scans this folder and creates database records for existing files. ZIP uploads are extracted automatically (original saved to `zip/`, images to `raw/`).
- **Admin Library Module**: Modular feature structure at `client/src/features/adminLibrary/` with tenant-aware architecture. Uses LibraryContext for multi-tenant support (storeId, apiBase, storageRoots, permissions). Route: `/admin/library`. Contains tabs for Templates, Backgrounds, Source Images, and Cropped Images.
- **Authentication**: Uses Firebase Authentication exclusively.
- **Nexus Self-Healing System**: Client-side self-healing with automatic retry logic, error capture, and an admin debugging console. Includes Printful retry profiles and a mockup fallback chain.
- **NexusMail Email System**: A portable, self-healing, queue-first, idempotent, provider-agnostic email system with automatic health monitoring and retry logic. Uses state-driven triggers, slug-based templates, and an outbox service.

### Feature Specifications
- **Product Management**: Admins can manage products, set retail prices, and control visibility.
- **Custom QR Code Integration**: Products can be customized with QR codes.
- **Shopping Cart**: Standard e-commerce cart operations.
- **Order Fulfillment Flow**: Integrates with Stripe for checkout, creates orders in Firestore, allows admin review, and submission/status sync with Printify. Automatic shipping and confirmation emails.

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