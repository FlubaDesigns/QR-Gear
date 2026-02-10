# QR Gear - System Reference Guide

## Overview
QR Gear is an e-commerce platform specializing in personalized promotional merchandise with custom QR codes, integrated with Printify for print-on-demand fulfillment. The platform aims to serve a niche market by enabling efficient design and ordering of custom QR-enhanced products, offering advanced features for product management, custom QR code integration, and streamlined order fulfillment.

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
The storefront prioritizes lifestyle mockups. Product pricing is displayed to customers as the admin-configured retail price (`customer_price`). The Admin Library Module provides a modular, multi-tenant interface for managing various assets.

### Technical Implementations
- **Pricing System**: Admins configure complex pricing via a dedicated interface (`/test-pricing`), supporting markup percentages, fixed markups, and additional costs.
- **Mockup System**: Utilizes Printful for generating high-quality mockups, including lifestyle images, for all product variations via a background job queue.
- **QR Artwork Selection**: Automatic black or white QR code selection based on background luminance for optimal scannability.
- **Product Catalogs**: Printify and Printful product catalogs are synced locally and to Firestore for use in product builders.
- **Dual Storage System**: Supports `postgres-only`, `dual-write`, and `firestore-only` modes for data persistence, facilitating migration to a Firebase-centric deployment.
- **File Storage**: Exclusively uses Firebase Storage for all file assets, including a background image library with admin syncing and ZIP uploads.
- **Admin Library Module**: A modular, tenant-aware feature set for managing backgrounds, templates, and images, located at `client/src/features/adminLibrary/`.
- **Shared Utilities Pattern**: Employs a Viewer/View/Skin architecture for reusable UI components like `SkinGridViewer`, `CropUtility`, `ImageUploader`, and `LibraryBackgroundPicker`.
- **Wizard Step Engines**: A set of shared, modular components (`client/src/features/shared/components/wizardSteps/`) that define the steps for product creation, graphic placement, QR setup, and publishing, used by Simple, Advanced, Super Simple Wizards, and the admin builder's ComposeContentModule.
- **Wizard Modular Architecture** (Feb 2026): MembersPage.tsx was refactored from 3,661 lines into a clean modular architecture:
  - `WizardContext.tsx` (1,815 lines) - All shared wizard state (~100 useStates), pricing queries, API operations, navigation logic via React Context
  - `SuperSimpleWizard.tsx` (186 lines) - 6-step card flow with blackboard explainers, progress dots, handoff to Simple
  - `SimpleWizard.tsx` (934 lines) - Full guided wizard with all QR type branches (Basic/Plus/Canvas/Play/Compose), progress bar, next/back logic
  - `AdvancedWizard.tsx` (201 lines) - Dense 8-step builder with PlacementPicker, HeaderFooterEditor, BackgroundLibraryPicker
  - `StudioMode.tsx` (128 lines) - Quick publish interface for experienced users
  - `MembersPage.tsx` (817 lines) - Pure routing shell: auth, nav tabs, view mode switching, delegates to wizard modules via WizardProvider
  - All modules consume shared state via `useWizardContext()` hook - no state duplication
- **Public Wizard** (aka Owner Builder, `/build` and `/creator`, Feb 2026): Public-facing conversion funnel at `client/src/features/owner/OwnerWizard.tsx`. Called the "Public Wizard" to distinguish from member wizards (Super Simple, Simple, Advanced, Studio). Self-contained component (no WizardContext dependency) that lets visitors build custom QR products without authentication. Key differences from member wizards: no channel step, cost framing (blue running cost badge) instead of earnings, minimum tier enforcement via `?type=basic|plus|canvas|play|compose` URL param. All QR types (Basic/Plus/Canvas/Play/Compose) are selectable by owners. After building, shows cost summary breakdown and member conversion pitch ("Turn This Into Income"). Reuses shared wizard step components. Page wrapper at `client/src/pages/build.tsx`, public route (no auth gate). If a QR type is pre-selected via URL param (e.g. `?type=canvas`), the type selection step (step 6) should be skipped since the choice is already made.
- **Super Simple Wizard**: A cards-based wizard (`wizardTier: 'super-simple'`) that presents the first 6 steps (channel, product, congrats, color, size, type) as large tappable cards with progress dots. After type selection, hands off to the Simple Wizard for the remaining QR-specific flow. All wizard tiers are always visible in nav tabs (unlock system bypassed for testing).
- **Authentication**: Exclusively uses Firebase Authentication.
- **Nexus Self-Healing System**: Client-side self-healing with automatic retry logic, error capture, and an admin debugging console.
- **NexusMail Email System**: A portable, self-healing, queue-first, idempotent, provider-agnostic email system.
- **Printify Cost Lookup** (`server/lib/printify-cost-lookup.ts`): Creates a temporary product in Printify to extract real per-variant manufacturing costs, then deletes it. Used at packet publish time to build a `pricingSnapshot`.
- **Pricing Snapshot Architecture**: At packet save time, the server looks up actual Printify costs per variant/size, calculates retail price, member earnings, admin margins, and stores the full breakdown in the packet's `pricingSnapshot` field. Admin-only fields: `printifyCostVariants`, `printifySizeUpcharges`, `adminMarginBase`, `earningsBySize`. Member-visible: `memberEarningsRange` (min/max across sizes).
- **Order-Time Cost Tracking**: When orders are created, the actual Printify cost for the selected size is read from the packet's `pricingSnapshot` and logged on the order item as `actualPrintifyCost`, `memberEarningsActual`, and `adminMarginActual`.

- **Public Wizard Stripe Checkout & Post-Sale Flow** (Feb 2026 — Planned):
  - **Temp Packet System**: Public wizard creates a `temp_packets` Firestore document on product selection, updates it at each wizard step (color, size, type, placements, graphic size, text), and generates real Printful mockups at preview steps. Packets have 24-hour TTL and `building` → `completed` status.
  - **Guest Checkout (Option B)**: No account required to purchase. Stripe collects buyer email on checkout page. Flow: Public Wizard → member pitch → Stripe guest checkout → order confirmation.
  - **Public Checkout Endpoints**: `POST /api/public/checkout` (creates Stripe session from temp packet, no auth), `GET /api/public/checkout/verify/:sessionId` (verifies payment, converts temp packet to real packet, creates order).
  - **Temp-to-Real Packet Conversion**: On successful payment, temp packet converts to a permanent product packet in the `product_packets` collection.
  - **Claim Code System**: At purchase time, a unique claim code (e.g. `QR-7X4M-9K2P`) is generated and stored on the order. Sent in confirmation email. Required when buyer scans QR on received product to register/activate the item — prevents unauthorized registration of someone else's item.
  - **Item Registration on First Scan**: When buyer scans QR on their physical product, they enter their claim code to create a `buyer_instance` record in QR Dynamics, linking the physical product to their account.
  - **Post-Sale Member Push**: After payment, two-path confirmation screen:
    - Path A "Become a Member": Track shipping, keep custom graphic permanently, turn design into income, manage QR destination → leads to account creation
    - Path B "No thanks": Order confirmation, claim code info, scan instructions, clean goodbye. Custom graphic retained for limited time (30 days) as incentive to sign up.
  - **Pricing Validation**: Server-side re-calculation from product data at checkout time — never trust client-side price.

### Feature Specifications
- **Product Management**: Admins manage products, set retail prices, and control visibility.
- **Custom QR Code Integration**: Products can be customized with QR codes.
- **Shopping Cart**: Standard e-commerce cart functionality.
- **Order Fulfillment Flow**: Integrates with Stripe for checkout, creates Firestore orders, enables admin review, and facilitates submission/status sync with Printify.
- **Product Packet Architecture**: A `Product Packet` serves as the single source of truth for product configurations, linking to `Graphics` and `Template` entries, supporting a "fork-on-edit" pattern.
- **Store Library Architecture**: An admin interface (`/admin/library`) for managing products linked to specific stores and channels.
- **QR Compose Architecture**: Enables members and admins to build rotating playlists from published Canvas/Play items, creating `qr_dynamics_instances` with time-based slot rotation and hosting terms. The admin builder has an inline `ComposeContentModule` (`client/src/features/adminProducts/builder/modules/ComposeContentModule.tsx`) that uses shared `ComposeSteps` components. The type was renamed from `qr_dynamics` to `qr_compose` across the codebase (Feb 2026).
- **Members Sandbox** (`/test-members`): A simplified product builder for authenticated members to create and sell products using admin-unlocked templates, offering Wizard and Power modes, member-scoped channels/collections, and an earnings dashboard.
- **QR GEAR DUAL-PRODUCT ARCHITECTURE**: Comprises **QR COMPOSER** (member/creator tool for sellable QR merchandise templates) and **QR DYNAMICS** (buyer/owner app for controlling purchased instances post-sale).
- **Three Surfaces (Resolver Engine)**: Supports IMAGE (Canvas), VIDEO (Play), and future DOCUMENT (PDF) based QR experiences.
- **Critical Flows**: Strict publish ordering (Packet → Assets → Template → Catalog Link), `channelId` persistence, and `ShareKitHandoff` post-publish.
- **Phase 8: Share Kit + Auto-Generated Assets**: Includes automatic generation of social media images, pre-written share captions, and a Share Kit UI.
- **Member Library Storage Paths**: Member-isolated Firebase Storage paths for backgrounds, cropped images, and videos, with associated Firestore metadata.
- **Member Creation Wizards**: A progressive unlock system for members (Quick Create, Advanced, Studio) based on publishing activity.

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