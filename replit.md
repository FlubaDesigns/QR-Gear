# QR Gear - Compressed System Reference Guide

## Overview
QR Gear is an e-commerce platform specializing in personalized promotional merchandise with custom QR codes. It integrates with Printify for print-on-demand fulfillment, targeting a niche market by enabling efficient design and ordering of QR-enhanced products. The platform offers advanced features for product management, custom QR code integration, and streamlined order fulfillment, aiming for significant market potential in personalized promotional goods.

## User Preferences
- **Communication**: Simple, everyday language
- **Accessibility**: User has CIDP (limited hand mobility) - agent must be fully autonomous
- **Documentation**: Keep ADMIN_MANUAL.md updated as admin features evolve
- **Deployment**: ALL fixes must be deployed to Firebase production after making changes in dev. Never just fix in dev without deploying.
- **CRITICAL WORKFLOW**: After ANY code change, deploy directly to Firebase using the service account. User tests in production only - they cannot see dev changes.
- **Firebase Deploy Method**: Use `FIREBASE_SERVICE_ACCOUNT_KEY` env var to deploy directly:
  ```bash
  npm run build
  echo "$FIREBASE_SERVICE_ACCOUNT_KEY" > /tmp/firebase-sa.json
  export GOOGLE_APPLICATION_CREDENTIALS=/tmp/firebase-sa.json
  firebase deploy --only hosting
  rm /tmp/firebase-sa.json
  ```
- **Session Rules**:
    - Handle voice-to-text transcription errors
    - Verify/confirm before acting
    - Deploy and test BOTH dev AND production every time
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
- **Firestore-Only Storage**: All data persistence uses Firebase/Firestore exclusively (STORAGE_MODE=firestore-only). PostgreSQL is no longer used for any application data. Both dev and production use the same Firebase database.
- **File Storage**: Exclusively uses Firebase Storage for all file assets, including a background image library.
- **Admin Library Module**: Modular, tenant-aware feature set for managing backgrounds, templates, and images (`client/src/features/adminLibrary/`).
- **Shared Utilities Pattern**: Employs a Viewer/View/Skin architecture for reusable UI components (e.g., `SkinGridViewer`, `CropUtility`).
- **Wizard Step Engines**: Shared, modular components (`client/src/features/shared/components/wizardSteps/`) defining steps for product creation, graphic placement, QR setup, and publishing across various wizards.
- **Modular Wizard Architecture**: Refactored `MembersPage.tsx` into `WizardContext.tsx` (shared state, pricing, API), `SuperSimpleWizard.tsx` (6-step card flow), `SimpleWizard.tsx` (full guided wizard), `AdvancedWizard.tsx` (rebuilt with shared step components), and `StudioMode.tsx` (quick publish). `MembersPage.tsx` acts as a routing shell. All modules consume state via `useWizardContext()`.
- **Public Wizard**: A public-facing conversion funnel (`client/src/features/owner/OwnerWizard.tsx`) for unauthenticated users to build custom QR products. It's a self-contained component without `WizardContext` dependency, using cost framing and minimum tier enforcement. It reuses shared wizard step components and integrates with a planned Stripe checkout.
- **Authentication**: Exclusively uses Firebase Authentication.
- **Nexus Self-Healing System**: Client-side self-healing with automatic retry, error capture, and an admin debugging console.
- **NexusMail Email System**: Portable, self-healing, queue-first, idempotent, provider-agnostic email system.
- **Smart Diff-Based Catalog Sync**: Both Printify and Printful sync operations load existing Firestore data first, compare field-by-field, and only write changed/new records. Tracks added/updated/skipped counts. Endpoint: `/api/admin/catalog/sync` (Printify), `/api/admin/catalog/sync-printful` (Printful). Status polling: `/api/admin/catalog/sync-status`. Frontend: Merged FulfillmentPickerModule handles both provider selection and sync (no separate SyncModule). No auto-sync on provider switch.
- **Printify Cost Lookup**: Server-side logic (`server/lib/printify-cost-lookup.ts`) to extract per-variant manufacturing costs from Printify.
- **Pricing Snapshot Architecture**: At packet save time, the server calculates and stores a full pricing breakdown (`printifyCostVariants`, `adminMarginBase`, `memberEarningsRange`) within the packet's `pricingSnapshot`.
- **Order-Time Cost Tracking**: Actual Printify costs and earnings (`actualPrintifyCost`, `memberEarningsActual`, `adminMarginActual`) are logged on the order item from the packet's `pricingSnapshot`.
- **Public Wizard Stripe Checkout & Post-Sale Flow**: Planned features include a `temp_packets` Firestore document system for public wizard creations (24-hour TTL), guest checkout via Stripe, public checkout endpoints (`/api/public/checkout`), conversion of temp packets to permanent product packets on successful payment, a unique claim code system for item registration, and a post-sale member conversion push with two paths (account creation or clean goodbye). Pricing is validated server-side at checkout.

### Feature Specifications
- **Product Management**: Admins manage products, pricing, and visibility.
- **Custom QR Code Integration**: Products can be customized with QR codes.
- **Shopping Cart**: Standard e-commerce cart.
- **Order Fulfillment Flow**: Integrates with Stripe, creates Firestore orders, enables admin review, and syncs with Printify.
- **Product Packet Architecture**: A `Product Packet` is the single source of truth for product configurations, linking to `Graphics` and `Template` entries, using a "fork-on-edit" pattern.
- **Store Library Architecture**: Admin interface (`/admin/library`) for managing products linked to stores and channels.
- **QR Compose Architecture**: Enables members and admins to build rotating playlists from published Canvas/Play items, creating `qr_dynamics_instances` with time-based slot rotation. The type was renamed from `qr_dynamics` to `qr_compose`.
- **Members Sandbox**: A simplified product builder (`/test-members`) for authenticated members to create and sell products using unlocked templates, offering Wizard and Power modes, member-scoped channels/collections, and an earnings dashboard.
- **QR GEAR DUAL-PRODUCT ARCHITECTURE**: Comprises **QR COMPOSER** (member/creator tool for sellable QR merchandise templates) and **QR DYNAMICS** (buyer/owner app for controlling purchased instances post-sale).
- **Three Surfaces (Resolver Engine)**: Supports IMAGE (Canvas), VIDEO (Play), and future DOCUMENT (PDF) based QR experiences.
- **Critical Flows**: Strict publish ordering (Packet → Assets → Template → Catalog Link), `channelId` persistence, and `ShareKitHandoff` post-publish.
- **Phase 8: Share Kit + Auto-Generated Assets**: Includes automatic generation of social media images, captions, and a Share Kit UI.
- **Member Library Storage Paths**: Member-isolated Firebase Storage paths for assets with associated Firestore metadata.
- **Member Creation Wizards**: Progressive unlock system for members (Quick Create, Advanced, Studio) based on publishing activity.

### System Design Choices
- **Printful-First Mockup Architecture**: Decouples mockup generation from fulfillment.
- **Backend**: Node.js, Express, TypeScript.
- **Frontend**: React, TypeScript, Vite.
- **Database**: Firebase/Firestore exclusively (no PostgreSQL for application data). Firestore CRUD helper at `server/lib/firestore-crud.ts`.
- **Nexus Vision Philosophy**: Self-learning, self-healing system using composable modules.
- **Modular Route Architecture**: `server/routes.ts` refactored into 16 feature-based modules within `server/routes/` (e.g., `auth.routes.ts`, `products.routes.ts`, `admin.routes.ts`, `packets.routes.ts`, `designs.routes.ts`, `gifts.routes.ts`, `pricing.routes.ts`), with `routes.ts` acting as an orchestrator.
- **Unified Admin Authorization**: All admin endpoints use `/api/admin/` prefix with `isAdmin` middleware (Firebase Auth token validation). Public buyer-facing endpoints use `/api/public/` prefix (no auth). No `/api/test/` endpoints remain — all have been consolidated.

### Downloadable Assets
- **Location**: All downloadable ZIP packages go in BOTH `client/public/downloads/` (Vite dev server static files) AND `dist/public/downloads/` (Firebase hosting build). NOTE: `public/downloads/` at project root does NOT work in dev mode - Vite's root is `client/` so static files must be in `client/public/`.
- **Current files**: `library-upload-package.zip` - contains all library upload code, endpoints, API docs, and file dependency map
- **Access**: Local dev at `/downloads/filename.zip`, production at `https://qrgear-c1ffd.web.app/downloads/filename.zip`

## External Dependencies
- **Printify**: Print-on-demand fulfillment.
- **Printful**: Product mockup generation.
- **Stripe**: Payment processing.
- **Firebase**: Hosting, Firestore, Firebase Storage, Cloud Functions, Authentication.
- **Resend**: Email services.
- **TanStack Query**: Frontend data fetching and state management.
- **shadcn/ui**: UI component library.