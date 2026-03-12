# QR Gear - Compressed System Reference Guide

## Overview
QR Gear is an e-commerce platform specializing in personalized promotional merchandise with custom QR codes. It integrates with Printify for print-on-demand services, streamlining the design and ordering process for QR-enhanced products. The platform aims to lead the personalized promotional goods market by offering advanced features for product management, custom QR code generation, and efficient order fulfillment.

## User Preferences
- **Communication**: Simple, everyday language
- **Accessibility**: User has CIDP (limited hand mobility) - agent must be fully autonomous
- **Documentation**: Keep ADMIN_MANUAL.md updated as admin features evolve
- **BUTTON VISIBILITY RULE**: NEVER use black, dark slate, or low-contrast colors on buttons. ALL buttons must have clearly visible color (blue, green, orange, etc.) with strong contrast against their background. No dark-on-dark. No invisible borders. This applies to ALL button variants (outline, ghost, secondary, default). Defined once in the component, never overridden with inline dark classes.
- **PRODUCTION-ONLY MODE**: The dev server is DISABLED. Do NOT start or use it. All work deploys directly to Firebase production. The `server/` directory exists only as build dependency — never run it.
- **Firebase Deploy — Hosting** (frontend):
  ```bash
  npm run build
  echo "$FIREBASE_SERVICE_ACCOUNT_KEY" > /tmp/firebase-sa.json
  export GOOGLE_APPLICATION_CREDENTIALS=/tmp/firebase-sa.json
  firebase deploy --only hosting --project qrgear-c1ffd
  rm /tmp/firebase-sa.json
  ```
- **Firebase Deploy — Functions** (API):
  ```bash
  cd functions && npm run build && cd _
  echo "$FIREBASE_SERVICE_ACCOUNT_KEY" > /tmp/firebase-sa.json
  export GOOGLE_APPLICATION_CREDENTIALS=/tmp/firebase-sa.json
  firebase deploy --only functions --project qrgear-c1ffd
  rm /tmp/firebase-sa.json
  ```
- **SINGLE API CODEBASE**: The Cloud Function (`functions/src/index.ts`) is the ONLY production API. The `server/` directory code is NOT used at runtime. All API route changes go directly into `functions/src/index.ts`.
- **Production API Flow**: Frontend on `qrgear-c1ffd.web.app` → Firebase Hosting rewrites `/api/*` to Cloud Function → Cloud Function strips `/api` prefix → routes handle `/admin/*`, `/public/*`, `/members/*`, etc.
- **Session Rules**:
    - Handle voice-to-text transcription errors
    - Verify/confirm before acting
    - Deploy and test in production after every change
    - Automate everything - no manual testing requests
    - "Let's talk" = discussion only, no code changes
    - Always read the page code before making new code
    - **NEVER REMOVE FEATURES** - Do NOT remove any feature, toggle, module, or functionality unless the user EXPLICITLY tells you to remove it. Adding features is fine. Removing features without explicit permission is FORBIDDEN.
    - **NEVER CHANGE WORKING CODE** - Do NOT modify any existing working behavior, logic, values, or data flow unless the user EXPLICITLY tells you to change it. Only touch exactly what was asked. If a task says "add X", do NOT also change Y. If something is already working, leave it alone.

## System Architecture

### UI/UX Decisions
The storefront features lifestyle mockups and displays admin-configured retail pricing. The Admin Library Module offers a modular, multi-tenant interface.

### Technical Implementations
- **Storefront Purchase Path**: Complete buy flow from store listing → product detail page (`/shop/product/:linkId`) → add-to-cart → checkout. Backend `GET /store/product/:linkId` returns full product detail with calculated price. `POST /store/product/:linkId/add-to-cart` resolves canonical productId and price server-side before writing to cart. Store listings include computed prices. Both guest (localStorage) and authenticated (server) cart paths supported.
- **Pricing System**: Supports complex, configurable pricing structures including markups and additional costs.
- **Mockup System**: Generates high-quality product mockups for all variations via a background job queue, utilizing Printful.
- **QR Artwork Selection**: Automatically selects black or white QR codes based on background luminance.
- **Product Catalogs**: Synchronizes Printify and Printful catalogs locally and with Firestore, performing smart diff-based updates.
- **Catalog Management System**: Everything runs through catalogs. Admin creates named catalogs (curated subsets of blanks), assigns them to 5 sections (Member, Public, External, Marketplace, Platform), and controls which blanks are available where. Old "allowed products" system replaced by catalog assignments. Default catalog auto-loads on page open (stored in `systemSettings/catalog-defaults`). Managed from the Blanks page (`admin-blanks.tsx`). Data stored in `catalogs`, `systemSettings/catalog-assignments`, and `systemSettings/catalog-defaults` Firestore collections. Features: duplicate catalog, bulk copy blanks between catalogs, set default catalog, thumbnail viewport strip showing catalog contents. The `GET /members/allowed-products` endpoint defaults to `member` section catalog when no `?section=` param provided. `GET /admin/catalog-health` provides diagnostic overview. Product queries use 5-minute staleTime caching. Product images use lazy loading.
- **Cascading Product Descriptions**: Three-level description cascade: Printify original → Admin override (saved in `blankDescriptions` on catalog doc) → Member customization (saved in packet's `boundProduct.customDescription`). Backend endpoints (`/members/allowed-products`, `/members/tier-products`) return `description`, `originalDescription`, and `adminDescription` fields. Admin blanks editor pre-fills with Printify original and offers "Reset to Printify original" button. Member wizard lightboxes pre-fill with the cascading value and persist `customDescription` to the packet. **Owners see descriptions read-only — only admin and members can edit.** Descriptions display on product cards in all wizards (tier and flat list).
- **Good/Better/Best Tier System**: Products in catalogs can be tagged with tiers (Good, Better, Best). Stored as `blankTiers: { blankId: "good"|"better"|"best" }` on catalog docs. Admin tags blanks via tier buttons on product cards in admin Blanks page. Tier display config (`tierConfig`) lets admin customize display names, descriptions, and taglines per tier. Backend endpoints: `PUT /admin/catalogs/:id/blank-tier`, `PUT /admin/catalogs/:id/tier-config`, `GET /members/tier-products?section=member` (returns products grouped by category and tier). `TierPickerStep` component (in `ProductSteps.tsx`) replaces `ProductPickerStep` in all wizards — shows Good/Better/Best tier cards when tiers exist, falls back to flat product list when no tiers configured. Colors: Good=blue, Better=amber, Best=emerald. Icons: Good=Star, Better=Award, Best=Crown. Tier badges appear on product cards and catalog thumbnail strip.
- **Data Storage**: Exclusively uses Firebase/Firestore for all data persistence and Firebase Storage for all file assets.
- **Admin Library Module**: Provides a modular, tenant-aware interface for managing backgrounds, templates, and images.
- **Shared Utilities Pattern**: Employs a Viewer/View/Skin architecture for UI component reusability.
- **Wizard Step Engines**: Modular components defining steps for product creation, graphic placement, QR setup, and publishing.
- **Modular Wizard Architecture**: Refactored `MembersPage.tsx` for shared state management and multiple wizard flows (e.g., `SuperSimpleWizard.tsx`, `AdvancedWizard.tsx`).
- **Public Wizard**: A public-facing conversion funnel for unauthenticated users to create custom QR products, integrated with Stripe checkout.
- **Authentication**: Exclusively uses Firebase Authentication.
- **Unified Rendering Architecture**: Uses a single "image of truth" pattern with canvas renderers and React hooks for debounced rendering and live preview of product graphics.
- **Nexus Self-Healing System**: Client-side system with automatic retry, error capture, and an admin debugging console.
- **NexusMail Email System**: Portable, self-healing, queue-first, idempotent, provider-agnostic email system using Resend.
- **Placement Bridge**: Normalizes provider-specific placement names (e.g., Printify's `sleeve_left`) to unified internal names.
- **Pricing Snapshot Architecture**: Stores a full pricing breakdown (`pricingSnapshot`) within the product packet at save time, enabling order-time cost tracking.
- **Public Wizard Checkout & Post-Sale Flow**: Manages guest checkout via Stripe, converts temporary packets to permanent products, and implements a claim code system.
- **Social Media Integration**: Features a `socialPacket` for sharing, a "Share & Earn" referral system with a 25% referral rate, and a content calendar for members to schedule social media posts and receive email reminders.
- **Member Channel Management**: Provides full CRUD operations for member channels, allowing members to organize and share their products. Products can be unlinked from channels without deletion.
- **Member Creator Earnings**: Automatically allocates 25% of profit (retail - manufacturing cost) to the creator member upon packet purchase, recorded in `member_earnings`.
- **Video Upload**: Handles multipart FormData video uploads via Cloud Functions, leveraging `req.rawBody`.
- **QR Code Rendering**: Optimized QR code rendering with reduced quiet zone and proportional graphic filling.
- **Mockup Cache**: Includes artwork URL hash in the mockup cache key to prevent stale mockups.
- **QR GEAR DUAL-PRODUCT ARCHITECTURE**: Comprises **QR COMPOSER** (for creating sellable QR merchandise templates) and **QR DYNAMICS** (for controlling purchased instances post-sale). **Naming convention**: "QR Compose" = the member wizard process of stitching items together; "QR Dynamics" = the resulting stitched item that rotates content. The member dashboard tab is labeled "QR Dynamics" and shows items built via QR Compose.
- **Three Surfaces (Resolver Engine)**: Supports IMAGE (Canvas), VIDEO (Play), and future DOCUMENT (PDF) based QR experiences.
- **Member Creation Wizards**: Progressive unlock system for members based on publishing activity (Quick Create, Advanced, Studio). Code-split via React.lazy for reduced initial bundle size.
- **Advanced Wizard Differentiation**: Advanced tier includes Quick Start resume, font size slider, vertical offset controls, and placement coordinate display with X/Y offset adjusters.
- **Wizard Completion Flow**: All wizard confirm screens hide Back/Next footer and show dual "Dashboard" / "Create Another" buttons via ShareKitHandoff.
- **Error Toasts**: Packet creation failures and library auto-save failures show user-visible toast notifications instead of silent console logs.

### System Design Choices
- **Printful-First Mockup Architecture**: Decouples mockup generation from fulfillment.
- **Backend**: Node.js, Express, TypeScript.
- **Frontend**: React, TypeScript, Vite.
- **Database**: Firebase/Firestore exclusively.
- **Nexus Vision Philosophy**: Emphasizes self-learning, self-healing, and composable modules.
- **Modular Route Architecture**: Routes are organized into feature-based modules.
- **Four Store Types**: `internal` (QR Gear's own storefront, e.g. USA 250), `marketplace` (Etsy/eBay/Amazon — push listings, pull orders, you sell on their surface), `partner` (external sites embedding your UX — they build channels, you enable), `member` (individual member stores via wizard). Each type has its own admin section and data flows.
- **Unified Admin Authorization**: All admin endpoints use `/api/admin/` with `isAdmin` middleware; public endpoints use `/api/public/` without authentication.
- **Downloadable Assets**: Stored in the ROOT `downloads/` folder for direct user access.
- **Fluba Brain Harness**: A universal harness (`client/src/lib/flubaBrainClient.ts`) connects to an AI governance gateway, using a separate Firebase app instance for communication.

## External Dependencies
- **Printify**: Print-on-demand fulfillment.
- **Printful**: Product mockup generation.
- **Stripe**: Payment processing.
- **Firebase**: Hosting, Firestore, Firebase Storage, Cloud Functions, Authentication.
- **Fluba Brain**: AI governance gateway.
- **Resend**: Email services.
- **TanStack Query**: Frontend data fetching and state management.
- **shadcn/ui**: UI component library.