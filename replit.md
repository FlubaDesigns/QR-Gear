# QR Gear - System Reference Guide

## Overview
QR Gear is an e-commerce platform specializing in personalized promotional merchandise with custom QR codes, integrating with Printify for print-on-demand fulfillment. The platform's main purpose is to enable users to efficiently design and order custom QR-enhanced products. It aims to serve a niche market seeking unique, branded merchandise, offering advanced features for product management, custom QR code integration, and streamlined order fulfillment.

## Image Naming Convention (Members Wizard)
These are the canonical names for image state variables in the members wizard:
- **productGraphic** = Graphic created for the physical item (shirt, cup, etc.) - composed of header + QR code + footer
- **urlGraphic** = Graphic shown on phone when QR is scanned (the landing page background)
- **qrBasicMockup** = The product mockup image (NO "Url" suffix)
- **qrGraphic** = The actual QR code image (bare QR, no text)

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
- **Shared Utilities Pattern** (Viewer/View/Skin architecture):
  - `SkinGridViewer` - Reusable grid display with lightbox/detail view, navigation, and action buttons
  - `CropUtility` - Shared 9:16 image cropping dialog
  - `ImageUploader` - Upload single images or ZIP files
  - `LibraryBackgroundPicker` - Pick backgrounds from library, crop, delete (uses SkinGridViewer + CropUtility)
  - Skins: `BackgroundCardSkin`, `CroppedImageCardSkin`, `GraphicsSkin`, etc. - Pluggable display components
  - **Design principle**: "Chair in a house" - use shared components everywhere, don't rebuild custom versions
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
- **Members Sandbox** (`/test-members`): A simplified product builder where authenticated members can create and sell products using admin-unlocked templates. Key features:
  - **Wizard Mode**: 5-step guided flow (Product → Graphics → QR Setup → Preview → Publish)
  - **Power Mode**: Compact single-view interface with dropdowns for experienced users
  - **My Channels**: Member-scoped channels to organize products
  - **My Collections**: Member-scoped QR Dynamics collections
  - **Earnings Dashboard**: Tracks profit share (25% of sales)
  - **API Endpoints**: `/api/members/:memberId/graphics|channels|products|earnings`

## QR GEAR DUAL-PRODUCT ARCHITECTURE

### Two Distinct Products
1. **QR COMPOSER** - Member/creator tool for building sellable QR merchandise templates
2. **QR DYNAMICS** - Buyer/owner app for controlling purchased instances post-sale

### Three Surfaces (Resolver Engine)
- **IMAGE (Canvas)** - Static QR backgrounds with text layers (`test-canvas-packet.tsx`)
- **VIDEO (Play)** - Video loops with QR overlay (`test-qr-play.tsx`)
- **DOCUMENT (PDF)** - PDF documents with QR (future)

### Data Model
- **Member Store** = memberId (each member has their own store)
- **Channel** = marketing bucket for organizing content
- **Packet** = single artifact experience (canvas/video/document)
- **Template** = sellable blueprint (created from packet)
- **Catalog Item Link** = what members share/sell (ties packet + template + channel)
- **Buyer Instance** = created at point of sale (separate from template)

### Critical Flows
- **Publish Ordering**: Packet → Assets → Template → Catalog Link (strict sequence)
- **channelId Flow**: Survives through all wizard steps to final publish commit
- **ShareKitHandoff**: Post-publish component with copy link, download QR/preview, share

### Key Services
- `memberPacketService.ts` - Canvas packet creation with proper ordering
- `memberVideoService.ts` - Video/Play packet creation with proper ordering
- `ShareKitHandoff.tsx` - Post-publish handoff UI component
- `social-image-generator.ts` - Auto-generates social media images (1080x1080 square, 1200x630 link preview)

### Phase 8: Share Kit + Auto-Generated Assets
- **Social Images**: Automatically generated on publish - 1080x1080 (Instagram/FB square) and 1200x630 (link preview)
- **Auto-Caption**: Pre-written share caption generated from title + description + URL
- **Share Kit UI**: Download buttons for social images, copy caption, one-click social sharing
- **Regenerate Endpoint**: `POST /api/admin/channel-items/:itemId/regenerate-assets` for admin asset regeneration
- **ChannelItem Fields**: `shareImageSquareUrl`, `shareImageLinkUrl`, `shareCaption` stored per item

### API Endpoints
- `POST /api/member/library-links` - Create catalog entry (includes channelId, storeId)
- `POST /api/member/play-packets/:id/publish` - Publish video packet (includes channelId)
- `GET /api/member/library-links?memberId=X` - Get member's catalog items

### Member vs Buyer Distinction
- **COMPOSER creates TEMPLATES/PACKETS** (sellable items, member-owned)
- **DYNAMICS controls INSTANCES** (buyer-owned, subscription-backed hosting)

### Member Library Storage Paths (Firebase Storage)
Each member has their own isolated library in Firebase Storage:
- **Backgrounds**: `members/{memberId}/library/backgrounds` - Original uploaded images
- **Cropped**: `members/{memberId}/library/cropped` - 9:16 cropped versions for landing pages
- **Videos**: `members/{memberId}/library/videos` - Video uploads for QR Play

**Crop Flow**: When a member crops an image in the wizard:
1. Original saves to `members/{memberId}/library/backgrounds`
2. Cropped version saves to `members/{memberId}/library/cropped`

**Firestore Collection**: `memberLibrary` stores metadata with fields:
- `memberId`, `assetType`, `mediaType`, `name`, `fileName`, `storageUrl`, `publicUrl`
- `isCropped: boolean` - true for cropped images
- `originalAssetId` - links cropped to original

**API Endpoints**:
- `GET /api/members/:memberId/library` - Fetch member's personal library
- `POST /api/members/:memberId/library/upload` - Upload new asset (set `isCropped: true` for cropped)
- `GET /api/member-files/:memberId/:filename` - Proxy to serve files

### Member Creation Wizards (Progressive Unlock System)
Three-tier graduated learning for members who CREATE products to sell:
- **Quick Create** (Simple Wizard) - Available immediately, 5 steps: Channel → Type → Background → Details → Publish
- **Advanced** - Unlocks after 1st publish, full 8-step wizard with placements, header/footer, landing page options
- **Studio** - Unlocks after 2nd publish, dropdown-based quick publishing for experienced creators
- Publish count stored in localStorage as `publish_count_${userId}`

### Buyer Customizer (FUTURE - Spec Saved)
A completely separate BUYER-FIRST experience for casual customers customizing products to purchase.

**Core Psychology**: They feel like they're customizing/previewing/making it theirs - NOT building/publishing/managing.

**Language Rules**:
- DO NOT USE: wizard, packet, publish, channel, collection, advanced, instance
- USE: Customize, Preview, Next, Finish, Buy, Change later, Make it yours

**Toolbox**:
1. **Low-friction entry**: Cards like "Start with a design" / "Upload a photo" / "Use this example" - no blank canvas
2. **Always-on preview**: Large, live, phone-shaped preview that updates immediately
3. **Simple image control**: Drag to reposition, pinch to zoom, reset button - no sliders/coordinates
4. **Safe text control**: Size (S/M/L buttons), Color (5-7 presets), Position (Top/Middle/Bottom zones)
5. **Invisible style safety**: Auto-enforce contrast, margins, overflow - user never sees errors
6. **Emotional confirmation**: "This is what it will look like" + "You can change this later"
7. **Product context**: Always show what product, where QR goes, that it's included
8. **Buy-first exit**: Primary CTA is [Buy this item], no account creation before purchase

**NOT included**: Channels, collections, monetization, analytics, sharing, advanced layouts - those are for members only.

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