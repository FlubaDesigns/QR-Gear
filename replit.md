# QR Gear - System Reference Guide

## Overview
QR Gear is an e-commerce platform specializing in personalized promotional merchandise with custom QR codes, integrating with Printify for print-on-demand fulfillment. The platform's main purpose is to enable users to efficiently design and order custom QR-enhanced products. It aims to serve a niche market seeking unique, branded merchandise, offering advanced features for product management, custom QR code integration, and streamlined order fulfillment.

## User Preferences
- **Communication**: Simple, everyday language
- **Accessibility**: User has CIDP (limited hand mobility) - agent must be fully autonomous
- **Documentation**: Keep ADMIN_MANUAL.md updated as admin features evolve
- **Deployment**: ALL fixes must be deployed to Firebase production after making changes in dev. Never just fix in dev without deploying.
- **CRITICAL WORKFLOW**: After ANY code change, immediately call suggest_deploy. User tests in production only - they cannot see dev changes. Do NOT wait to be asked. Do NOT just restart dev workflow. ALWAYS trigger production publish.
- **Session Rules**:
    - Handle voice-to-text transcription errors
    - Verify/confirm before acting
    - Deploy and test BOTH dev AND production every time
    - Automate everything - no manual testing requests
    - "Let's talk" = discussion only, no code changes
    - Always read the page code before making new code
    - **NEVER REMOVE FEATURES** - Do NOT remove any feature, toggle, module, or functionality unless the user EXPLICITLY tells you to remove it. Adding features is fine. Removing features without explicit permission is FORBIDDEN.

## System Architecture

### UI/UX Decisions
The storefront emphasizes lifestyle mockups over flat product shots. Product pricing displayed to customers is the admin-configured retail price (`customer_price`). The Admin Library Module provides a modular, multi-tenant interface for managing various assets.

### Technical Implementations
- **Pricing System**: Admins configure complex pricing via a dedicated interface (`/test-pricing`), including markup percentages, fixed markups, additional placement costs, text line upcharges, and hosting tiers. A `PricingModule` provides a live breakdown.
- **Mockup System**: Utilizes Printful for generating high-quality mockups, including lifestyle images, for all product variations. Mockups are generated via a background job queue.
- **QR Artwork Selection**: Automatic black or white QR code selection based on background luminance for optimal scannability.
- **COLOR_HEX_MAP**: A fallback color name to hex code lookup table in `StoreBuilderHarness.tsx` for product color rendering.
- **Printify Local Catalog**: Product colors and sizes are synced weekly from Printify into a local database (`printify_print_providers`) for product builder use.
- **Printful Native Catalog**: Full Printful catalog synced to Firestore (`printfulProducts`) for direct use in product builders when Printful is selected as the fulfillment provider.
- **Dual Storage System**: Supports `postgres-only`, `dual-write`, and `firestore-only` modes, facilitating migration to a Firebase-centric deployment while retaining PostgreSQL for reads.
- **File Storage**: Exclusively uses Firebase Storage for all file assets.
- **Background Image Library**: Canonical storage for background images with an admin interface to sync from storage and handle ZIP uploads.
- **Admin Library Module**: A modular, tenant-aware feature set for managing backgrounds, templates, and images, located at `client/src/features/adminLibrary/`.
- **Authentication**: Exclusively uses Firebase Authentication.
- **Nexus Self-Healing System**: Client-side self-healing with automatic retry logic, error capture, and an admin debugging console, including specific profiles for Printful and mockup fallbacks.
- **NexusMail Email System**: A portable, self-healing, queue-first, idempotent, provider-agnostic email system with automatic monitoring and retry logic.

### Feature Specifications
- **Product Management**: Admins manage products, set retail prices, and control visibility.
- **Custom QR Code Integration**: Products can be customized with QR codes.
- **Shopping Cart**: Standard e-commerce cart functionality.
- **Order Fulfillment Flow**: Integrates with Stripe for checkout, creates Firestore orders, enables admin review, and facilitates submission/status sync with Printify.
- **Product Packet Architecture**: A `Product Packet` serves as the single source of truth for product configurations, linking to `Graphics` and `Template` entries. The system supports a "fork-on-edit" pattern where modifying an existing product creates a new packet.
- **Store Library Architecture**: An admin interface (`/admin/library`) for managing products linked to specific stores and channels via `storeProductLinks`.
- **QR Dynamics Architecture**: Enables creation of rotating product experiences structured as **Store → Channel → Collection**. Collections are curated playlists of items that cycle over time, scoped to the user's ID.

### System Design Choices
- **Printful-First Mockup Architecture**: Decouples mockup generation from order fulfillment.
- **Backend**: Node.js, Express, TypeScript.
- **Frontend**: React, TypeScript, Vite.
- **Database**: PostgreSQL with Drizzle ORM and Firestore.
- **Nexus Vision Philosophy**: A self-learning, self-healing system using composable modules.

## External Dependencies
- **Printify**: Print-on-demand fulfillment.
- **Printful**: Product mockup generation.
- **Stripe**: Payment processing.
- **Firebase**: Hosting, Firestore, Firebase Storage, Cloud Functions, Authentication.
- **Neon**: Managed PostgreSQL database service.
- **Resend**: Email services.
- **TanStack Query**: Frontend data fetching and state management.
- **shadcn/ui**: UI component library.