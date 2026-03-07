# QR Gear - Compressed System Reference Guide

## Overview
QR Gear is an e-commerce platform focused on personalized promotional merchandise featuring custom QR codes. It integrates with Printify for print-on-demand fulfillment, targeting a niche market by enabling efficient design and ordering of QR-enhanced products. The platform aims to offer advanced features for product management, custom QR code integration, and streamlined order fulfillment, aspiring to capture significant market potential in personalized promotional goods.

## User Preferences
- **Communication**: Simple, everyday language
- **Accessibility**: User has CIDP (limited hand mobility) - agent must be fully autonomous
- **Documentation**: Keep ADMIN_MANUAL.md updated as admin features evolve
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
  cd functions && npm run build && cd ..
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
The storefront emphasizes lifestyle mockups. Product pricing is shown as the admin-configured retail price. The Admin Library Module provides a modular, multi-tenant interface.

### Technical Implementations
- **Pricing System**: Admins configure complex pricing via a dedicated interface, supporting markup percentages, fixed markups, and additional costs.
- **Mockup System**: Utilizes Printful for generating high-quality mockups for all product variations via a background job queue.
- **QR Artwork Selection**: Automatic black or white QR code selection based on background luminance.
- **Product Catalogs**: Printify and Printful catalogs are synced locally and to Firestore.
- **Firestore-Only Storage**: All data persistence uses Firebase/Firestore exclusively. Both dev and production use the same Firebase database.
- **File Storage**: Exclusively uses Firebase Storage for all file assets, including a background image library.
- **Admin Library Module**: Modular, tenant-aware feature set for managing backgrounds, templates, and images.
- **Shared Utilities Pattern**: Employs a Viewer/View/Skin architecture for reusable UI components.
- **Wizard Step Engines**: Shared, modular components defining steps for product creation, graphic placement, QR setup, and publishing across various wizards.
- **Modular Wizard Architecture**: Refactored `MembersPage.tsx` into shared state management (`WizardContext.tsx`), and different wizard flows (`SuperSimpleWizard.tsx`, `SimpleWizard.tsx`, `AdvancedWizard.tsx`, `StudioMode.tsx`).
- **Public Wizard**: A public-facing conversion funnel for unauthenticated users to build custom QR products, integrating with Stripe checkout.
- **Authentication**: Exclusively uses Firebase Authentication.
- **Unified Rendering Architecture**: Product graphics and landing pages use a single "image of truth" pattern with dedicated canvas renderers and React hooks for debounced rendering and live preview.
- **Nexus Self-Healing System**: Client-side self-healing with automatic retry, error capture, and an admin debugging console.
- **NexusMail Email System**: Portable, self-healing, queue-first, idempotent, provider-agnostic email system.
- **Placement Bridge**: Normalizes provider-specific placement names (e.g., Printify's `sleeve_left`) to unified internal names (e.g., `left_sleeve`).
- **Smart Diff-Based Catalog Sync**: Printify and Printful sync operations perform field-by-field comparisons and only write changed/new records to Firestore.
- **Printify Cost Lookup**: Server-side logic to extract per-variant manufacturing costs from Printify.
- **Pricing Snapshot Architecture**: Server stores a full pricing breakdown (`pricingSnapshot`) within the product packet at save time.
- **Order-Time Cost Tracking**: Actual Printify costs and earnings are logged on the order item from the packet's `pricingSnapshot`.
- **Public Wizard Stripe Checkout & Post-Sale Flow**: Planned features include `temp_packets` in Firestore, guest checkout via Stripe, conversion of temp packets to permanent product packets, a claim code system, and post-sale member conversion.
- **Social Media Packet & Share & Earn Referral System**: `socialPacket` sub-object on `memberPackets` facilitates sharing. Referral tracking via `/p/:packetId` and `referralUrl`. Persistent referral relationships are stored in Firestore.

### Feature Specifications
- **Product Management**: Admins manage products, pricing, and visibility.
- **Custom QR Code Integration**: Products can be customized with QR codes.
- **Shopping Cart**: Standard e-commerce cart.
- **Order Fulfillment Flow**: Integrates with Stripe, creates Firestore orders, enables admin review, and syncs with Printify.
- **Product Packet Architecture**: A `Product Packet` is the single source of truth for product configurations, using a "fork-on-edit" pattern.
- **Store Library Architecture**: Admin interface for managing products linked to stores and channels.
- **QR Compose Architecture**: Enables members and admins to build rotating playlists from published Canvas/Play items, creating `qr_dynamics_instances`.
- **Members Sandbox**: A simplified product builder for authenticated members to create and sell products using unlocked templates.
- **QR GEAR DUAL-PRODUCT ARCHITECTURE**: Comprises **QR COMPOSER** (member/creator tool for sellable QR merchandise templates) and **QR DYNAMICS** (buyer/owner app for controlling purchased instances post-sale).
- **Three Surfaces (Resolver Engine)**: Supports IMAGE (Canvas), VIDEO (Play), and future DOCUMENT (PDF) based QR experiences.
- **Critical Flows**: Strict publish ordering and `ShareKitHandoff` post-publish.
- **Phase 8: Share Kit + Auto-Generated Assets**: Includes automatic generation of social media images, captions, and a Share Kit UI.
- **Member Library Storage Paths**: Member-isolated Firebase Storage paths for assets with associated Firestore metadata.
- **Member Creation Wizards**: Progressive unlock system for members (Quick Create, Advanced, Studio) based on publishing activity.

### System Design Choices
- **Printful-First Mockup Architecture**: Decouples mockup generation from fulfillment.
- **Backend**: Node.js, Express, TypeScript.
- **Frontend**: React, TypeScript, Vite.
- **Database**: Firebase/Firestore exclusively.
- **Nexus Vision Philosophy**: Self-learning, self-healing system using composable modules.
- **Modular Route Architecture**: `server/routes.ts` refactored into feature-based modules within `server/routes/`.
- **Unified Admin Authorization**: All admin endpoints use `/api/admin/` prefix with `isAdmin` middleware. Public buyer-facing endpoints use `/api/public/` prefix (no auth).

### Downloadable Assets
- **Location**: All downloadable ZIP packages go in the ROOT `downloads/` folder.
- **Access**: User downloads directly from the Replit file manager by right-clicking the file in the `downloads/` folder.

### Fluba Brain Harness
- **Client**: `client/src/lib/flubaBrainClient.ts` – universal harness connecting QR Gear to the Fluba Brain gateway.
- **Pattern**: Initializes a separate Firebase app (`fluba-brain`) while QR Gear maintains its own Firebase.
- **API**: `getFlubaBrainClient()` returns `{ submitToBrain(), listenToBrainResponse() }` or `null`.
- **Flow**: Website calls `brainSubmit` callable → Fluba writes `brain_inbox/{requestId}` → processor writes `brain_responses/{requestId}` → real-time listener picks it up.
- **Status**: Harness installed, inactive until Fluba env vars are configured.

## External Dependencies
- **Printify**: Print-on-demand fulfillment.
- **Printful**: Product mockup generation.
- **Stripe**: Payment processing.
- **Firebase**: Hosting, Firestore, Firebase Storage, Cloud Functions, Authentication.
- **Fluba Brain**: AI governance gateway.
- **Resend**: Email services.
- **TanStack Query**: Frontend data fetching and state management.
- **shadcn/ui**: UI component library.