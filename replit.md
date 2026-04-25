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
  cd functions && npm run build && cd ..
  echo "$FIREBASE_SERVICE_ACCOUNT_KEY" > /tmp/firebase-sa.json
  export GOOGLE_APPLICATION_CREDENTIALS=/tmp/firebase-sa.json
  firebase deploy --only functions --project qrgear-c1ffd
  rm /tmp/firebase-sa.json
  ```
- **MODULAR API CODEBASE**: The Cloud Function entry point is `functions/src/index.ts` (~94 lines of wiring). All logic lives in modular files:
  - `functions/src/constants.ts` — Centralized platform constants: `MOSAICS_COLLECTION`, `MOSAIC_TEMPLATES_COLLECTION`, `CHANNEL_ITEMS_COLLECTION`, `CHANNEL_CONTENT_COLLECTION`, `COLLECTION_ITEMS_COLLECTION`, `DYNAMICS_SURFACES_COLLECTION`, `STORE_PRODUCT_LINKS_COLLECTION`, `PRODUCT_PACKETS_COLLECTION`, `QR_DYNAMICS_INSTANCES_COLLECTION`, `MEMBER_PACKETS_COLLECTION`, `PLATFORM_STORE_ID`, Surfaces system collections (`SURFACES_COLLECTION`, `SURFACE_VARIANTS_COLLECTION`, `MARKETPLACE_ACCOUNTS_COLLECTION`, `MARKETPLACE_LISTINGS_COLLECTION`, `MARKETPLACE_SYNC_JOBS_COLLECTION`, `MARKETPLACE_SYNC_LOGS_COLLECTION`), External Sites collections (`BUILDER_HOSTS_COLLECTION`, `BUILDER_PROFILES_COLLECTION`, `BUILDER_PLACEMENTS_COLLECTION`, `BUILDER_SESSIONS_COLLECTION`, `BUILDER_DRAFTS_COLLECTION`, `PRICING_POLICIES_COLLECTION`, `REVENUE_SPLITS_COLLECTION`, `EMBEDDED_ORDER_ATTRIBUTIONS_COLLECTION`, `AFFILIATE_PAYOUT_LEDGER_COLLECTION`), and type aliases for all status/mode/action enums
  - `shared/surfaces.ts` — Canonical types for the multi-channel publishing system: Surface (expanded with storeId, channelId, collectionId, productId, artifactId, mosaicId, supportsEmbed*, bulletPoints, keywords, mockupImages), SurfaceVariant (expanded with option1-3, titleSuffix, marketplaceOverrides), MarketplaceAccount, MarketplaceListing, MarketplaceSyncJob, MarketplaceSyncLog, BuilderHost, BuilderProfile, BuilderPermissionScope, BuilderPlacement, BuilderSession, BuilderDraft, PricingPolicy, RevenueSplit, AttributionContext, PricingSnapshot, ExternalCartContext, EmbeddedOrderAttribution, AffiliatePayoutLedgerEntry, plus `checkSurfaceReadiness()` validator and `computePricingSnapshot()` pricing engine
  - `functions/src/core.ts` — Firebase init, db, storage, types, placement maps, normalization fns, doc helpers, color helpers
  - `functions/src/middleware.ts` — CORS, verifyAuth, requireAuth, requireAdmin, ADMIN_USER_IDS
  - `functions/src/adapters/` — Marketplace platform adapters. `etsy.ts` is the canonical type file: exports `MarketplaceResult`, `SurfaceInput` (base), `SurfaceInputFull` (three-layer extended: core + common + ebay block), `EbayBlock` (full eBay scoped sub-object: categoryId, conditionId, listingFormat, itemSpecifics, policy IDs, package dims, UPC/EAN/MPN, priceOverride, quantity), `AccountInput`. `ebay.ts` exports `buildEbayPayload(surface: SurfaceInputFull)` — single authoritative payload builder implementing core+common+ebay overrides merge → `inventoryItem` + `offerData`; `createListing()` calls PUT inventory_item → POST offer → POST offer/publish on eBay Sell Inventory API. `amazon.ts` — Amazon SP-API Listings Items create/update/delete.
  - `functions/src/services/` — email.ts, pricing.ts, storage-helpers.ts, printful.ts, printify.ts, mockup-generator.ts, composite-image.ts, marketplace-sync.ts (sync pipeline: `SurfaceDoc` now includes common fields: `condition`, `brand`, `material`, `department`, `shippingProfileRef`, `returnsProfileRef`, plus `ebay: EbayBlock`. `toSurfaceInputFull()` normalizes all three layers → dispatched to adapters. `executeSyncJob`, `retryFailedJob`, `processRetryQueue` manage job/listing status, logs, durable retry.)
  - `functions/src/routes/` — 48 route files. Route prefix map (after CF strips `/api`):
    | Route prefix | Files | Auth |
    |---|---|---|
    | `/admin/*` | admin-build-sessions.ts, admin-catalog-instances.ts, admin-misc.ts, admin-orders.ts, admin-products.ts, admin-settings.ts, admin-stores.ts, am-crud.ts, am-sync.ts, am-utility.ts, master-catalog.ts, member-catalog-instances.ts, orchestration.ts, print-placements.ts | `requireAdmin` |
    | `/master-catalog`, `/master-catalog/joint` | pp-catalog-browse.ts | **Public** (no auth) |
    | `/pp/*` | pp-builder.ts, pp-catalog.ts, pp-pricing-packets.ts | varies |
    | `/members/*` | members.ts, members-library.ts, member-files.ts | `requireAuth` |
    | `/public/*` | public.ts, public-stores.ts, external-sites-public.ts, products-page.ts, seo.ts | Public |
    | other | auth.ts, brain.ts, catalog.ts, categories.ts, checkout.ts, claims.ts, core-routes.ts, core-routes-checkout.ts, designs.ts, dynamics.ts, external-sites.ts, file-routes.ts, gifts.ts, images.ts, marketplace.ts, mockup-routes.ts, packets.ts, partner.ts, referral.ts, store-files.ts, stripe-webhooks.ts, tiers.ts, widget.ts | varies |
  - **CRITICAL routing rule**: `/master-catalog` and `/master-catalog/joint` (pp-catalog-browse.ts) are registered WITHOUT the `/admin` prefix — they are public endpoints. Frontend must call them as `/api/master-catalog`, NOT `/api/admin/master-catalog`. Using `${apiBase}/master-catalog` (where apiBase=`/api/admin`) is WRONG for these endpoints and causes silent 404s.
  - The `server/` directory code is NOT used at runtime. All API route changes go into the modular files above.
- **Production API Flow**: Frontend on `qrgear-c1ffd.web.app` → Firebase Hosting rewrites `/api/*` to Cloud Function → Cloud Function strips `/api` prefix → routes handle `/admin/*`, `/public/*`, `/members/*`, etc. **The strip removes only `/api`, not `/api/admin` — so `/api/admin/foo` becomes `/admin/foo` in CF.**
- **Session Rules**:
    - Handle voice-to-text transcription errors
    - Verify/confirm before acting
    - Deploy and test in production after every change
    - Automate everything - no manual testing requests
    - "Let's talk" = discussion only, no code changes
    - Always read the page code before making new code
    - **NEVER REMOVE FEATURES** - Do NOT remove any feature, toggle, module, or functionality unless the user EXPLICITLY tells you to remove it. Adding features is fine. Removing features without explicit permission is FORBIDDEN.
    - **NEVER CHANGE WORKING CODE** - Do NOT modify any existing working behavior, logic, values, or data flow unless the user EXPLICITLY tells you to change it. Only touch exactly what was asked. If a task says "add X", do NOT also change Y. If something is already working, leave it alone.

## Standing Rules — Mandatory Skills
These six rules apply to every task, every session, no exceptions. When the user says "read the first skill", read `.agents/skills/read-all-skills/SKILL.md` immediately — it will tell you to read all remaining skills and this file in full.

0. **Read All Skills First** (`.agents/skills/read-all-skills/SKILL.md`) — When triggered, read every skill file and this entire replit.md before doing anything else. Confirm readiness to the user before starting any task.

1. **Read Code First** (`.agents/skills/read-code-first/SKILL.md`) — Before touching any file, read every file in the affected system: the component, its hooks, the backend routes those hooks call, every shared type and utility involved, and every Firestore collection touched. Follow imports. Trace the full data flow from frontend to Firestore and back. Only form a plan after the full scope is understood. NEVER edit a file you have not read in full this session.

2. **Ask Before Starting** — Before writing a single line of code or making any change, ask clarifying questions. Confirm: what exactly is the problem, where is it, what behavior is wanted, what must NOT change, and the scope. Do not assume. Do not start a build or deploy until the user confirms the plan.

3. **Always Deploy** — Every code change — no matter how small — must be deployed to Firebase production before the task is considered done. The dev server is NOT the production environment. Order: (1) `npm run build`, (2) `firebase deploy --only hosting`, (3) `firebase deploy --only functions`. If functions deploy hits a GCP infra error, note it but do not block. Checklist: build clean, hosting live, functions deployed, production URL verified at https://qrgear-c1ffd.web.app.

4. **Fail Loudly** — When something fails to load, fetch, or initialize, surface the error explicitly — in the UI, in the console, and in the API response. No silent fallbacks. No swallowed errors. No `return []` when the real cause is a failure. Every caught error must log: which module failed, what it was trying to do, and the actual error message. Always handle TanStack Query `error` state, not just `isLoading`.

5. **Present Changed Files** — After every fix, feature, or update — before marking done — add only the files created or modified during that task into `downloads/QR_Gear_Full_Website.zip` using `zip -u`. Never recreate the zip from scratch. Never include build output, node_modules, lock files, or the downloads folder itself. Tell the user which files were added or updated.

## Naming Standards — Project Law

These conventions are mandatory. Before creating any file, class, ID, collection, field, route, or CSS class — verify it does not already exist and that the new name matches these patterns exactly.

### By Layer

| Layer | Convention | Example |
|---|---|---|
| Files — pages & routes | `kebab-case` | `admin-store-builder.tsx`, `store-files.ts` |
| Files — components | `PascalCase.tsx` | `StoreManagerTab.tsx`, `ProductCard.tsx` |
| Feature folders | `kebab-case` | `store-builder/`, `storefront-shared/` |
| React components | `PascalCase` | `InstanceCard`, `StoreManagerTab` |
| TypeScript interfaces & types | `PascalCase` | `AdminInstance`, `ProductOption` |
| Variables & functions | `camelCase` | `getAuthHeaders()`, `enabledColors` |
| Constants | `SCREAMING_SNAKE_CASE` | `COLOR_HEX_MAP`, `ADMIN_USER_IDS` |
| Firestore collections — new | `snake_case` | `admin_catalog_instances`, `mockup_jobs` |
| Firestore document fields | `camelCase` | `currentPacketId`, `enabledColors` |
| CSS custom classes | `kebab-case` + BEM `--` modifier | `qr-btn--primary`, `glass-card` |
| API route paths | `kebab-case` | `/api/catalog-instances`, `/admin/store-files` |
| Query keys (TanStack) | array with `kebab-case` strings | `["catalog-instances", storeId]` |

### Hard Rules

1. **Check before creating** — Search the codebase for an existing file, component, collection, or class that already serves the purpose. Reuse or extend it. Do not create a parallel version.
2. **No mixed conventions in the same layer** — If all route files in `functions/src/routes/` are `kebab-case.ts`, the new one must be too. No exceptions.
3. **Firestore: snake_case going forward** — All new Firestore collections use `snake_case`. Existing `camelCase` collections (`productPackets`, `memberLibrary`, etc.) are grandfathered — do NOT rename live collections. When a duplicate exists (`libraryAssets` + `library_assets`), flag it and consolidate only with explicit user approval.
4. **No creative naming** — Names must describe exactly what the thing is, matching the vocabulary already in use in that layer. No abbreviations that aren't already established in the codebase.
5. **Feature folders go kebab-case** — Existing folders like `adminAuth`, `adminProducts`, `storeBuilder` are grandfathered. All new feature folders use `kebab-case`. Do not rename existing ones without explicit user approval.

## System Architecture

### UI/UX Decisions
The storefront features lifestyle mockups and displays admin-configured retail pricing. The Admin Library Module offers a modular, multi-tenant interface.

### Admin Interface Architecture
- **Shared components** in `client/src/components/admin/`: `AdminSectionTabs` (horizontal scrollable tab bar), `AdminSectionCard` (card wrapper with title/icon/actions), `StickyActionBar` (fixed bottom bar), `PreviewDrawer` (dialog-based preview), `MobileCardList` (card-based list), `AdminBottomNav` (fixed bottom navigation for mobile)
- **AdminShell** (`client/src/components/AdminShell.tsx`): Shared layout shell with top bar (back, title, actions), optional section tabs, and optional sticky bar. Used by all admin pages.
- **Mobile-first design**: All touch targets min 44px, section tabs replace wizard flows (users jump freely between sections), card-based layouts for orders/products/stores
- **Bottom navigation** (mobile only): Products, Collections, Channels, Orders, Store — shown on primary admin pages via `AdminBottomNav`
- **Admin pages restructured**: `admin-products.tsx` (Builder + Tools tabs), `admin-store-builder.tsx` (Channels + Stores + Library tabs), `admin-store-library.tsx` (AdminShell wrapper), `admin-orders.tsx` (All/Pending/Production/Shipped tabs with stat cards + filters), `admin-marketplaces.tsx` (Accounts + Surfaces + Listings + Jobs + Logs tabs), `admin-external-sites.tsx` (Hosts + Profiles + Placements + Pricing + Revenue + Attribution + Payouts tabs)
- **CSS classes**: Admin styles use `.qr-admin-*` classes in `client/src/styles/layout.css`. Button pattern: `qr-btn qr-btn--primary qr-btn--touch qr-btn--full`
- **Central Fetch Utilities** — Two utilities replace all scattered `apiBase`+`getAuthHeaders`+raw-`fetch` patterns:
  - `client/src/lib/adminFetch.ts` — `adminFetch(path, options?)` prepends `/api/admin` and injects admin auth headers automatically. Pass `json: payload` for JSON bodies; raw `body` for FormData/multipart.
  - `client/src/lib/memberFetch.ts` — `memberFetch(path, options?)` prepends `/api/members` and injects member auth headers automatically. Same `json`/`body` options.
  - All admin feature files use `adminFetch`. All member feature files use `memberFetch`. Exception: endpoints at `/api/member/` (singular, e.g. packets) keep using `getAuthHeaders()` directly since they are on a different route prefix.

### First-Scan Activation System (QR Gear Core Flow)
- **QRG Numbering**: All 1,612 master_catalog products assigned `QRG-CCC-SSS` IDs (100=Tees, 200=Hoodies, 300=Hats, 400=Drinkware, etc.). Fields: `qrgId`, `qrgCategory`, `qrgSequence`. Returned by `GET /api/master-catalog`.
- **Activation Flow**: Buyer pays → activation code generated (`XXXX-XXXX` format) → activation email sent → buyer scans product QR → sees product landing page → enters code in activation panel → 1-year hosting starts from claim moment (NOT purchase date).
- **Key Files**:
  - `server/lib/claimService.ts`: `generateClaimCodeForOrderItem()` — creates claim code in `claimCodes` Firestore collection with `status: 'unclaimed'`
  - `server/lib/email.ts`: `sendActivationEmail()` — branded email with large activation code display, step-by-step instructions, and "Activate Now" CTA button
  - `functions/src/services/email.ts`: Same `sendActivationEmail()` for Cloud Functions side
  - `functions/src/routes/checkout.ts`: Wired to send activation email after `createCanonicalOrder()` returns claim code
  - `server/routes/cart-checkout.routes.ts`: After order creation, calls `generateClaimCodeForOrderItem()` + `sendActivationEmail()` for each order item
  - `server/routes/member-public-wizard.routes.ts`: Same activation email sent after wizard checkout completes
  - `client/src/pages/product-landing.tsx`: Fixed bottom `ActivationPanel` — collapsed drawer that expands to show code input field. Routes to `/claim/:code` on submit.
  - `client/src/pages/claim.tsx`: Existing claim flow; success button now navigates to `/my-item/:instanceId` instead of `/dynamics`
  - `client/src/pages/my-item.tsx`: New page showing claimed instance details: hosting status, days remaining, expiry date, renew button
  - `client/src/pages/account.tsx`: "My QR Items" tab added — shows all claimed instances with status badges, days remaining, and View Item/Renew buttons
- **Firestore Collections**: `claimCodes` (status: unclaimed/claimed/expired, source: 'order' or 'packet_share'), `claimedInstances` (hostingExpiresAt = 1 year from claim time, not purchase)
- **API Endpoints**: `GET /api/claimed-instances` (user's instances), `GET /api/claimed-instances/:instanceId` (instance + isActive), `POST /api/claim/:claimCode` (redeem code)
- **Firebase Functions Deploy Note**: If Firebase says "No changes detected" after code changes, add a timestamp comment to `functions/src/index.ts`, rebuild, and redeploy — this creates a new package hash to force re-upload.

### Technical Implementations
- **Storefront Layout**: All commerce-facing pages (`shop-segment`, `shop-product`, `cart`, `gift-shop`, `gift-redeem`) use `StorefrontLayout` (`client/src/components/StorefrontLayout.tsx`) which wraps content with the shared `Navbar`. New commerce pages must use `StorefrontLayout` instead of importing `Navbar` directly.
- **Cart Architecture**: Guest cart state is managed by a single React Context (`client/src/contexts/CartContext.tsx`) wrapping the entire app in `App.tsx`. All components read from `useCart()` — there is one shared instance per session. localStorage is persistence-only (also listens to storage events for cross-tab sync). Deduplication: adding the same productId+color+size increments quantity instead of creating a duplicate line. Decrement to 0 removes the item. `GuestCartItem` type and `mergeGuestCartOnLogin` utility exported from this module. The old `useGuestCart` hook has been removed.
- **Cart Merge**: Merge from guest→server cart fires once per login session (tracked via `useRef`). Resets on logout so subsequent logins retry. Shows "Syncing your cart…" state during merge. Guest items remain visible during merge (no empty-cart flicker). Single `clearCart()` call after confirmed success.
- **Storefront Purchase Path**: Complete buy flow from store listing → product detail page (`/shop/product/:linkId`) → add-to-cart → checkout. Backend `GET /store/product/:linkId` returns full product detail with calculated price. `POST /store/product/:linkId/add-to-cart` resolves canonical productId and price server-side before writing to cart. Store listings include computed prices. Both guest (localStorage) and authenticated (server) cart paths supported.
- **Pricing System**: Supports complex, configurable pricing structures including markups and additional costs.
- **Mockup System**: Generates high-quality product mockups for all variations via a background job queue, utilizing Printful.
- **QR Artwork Selection**: Automatically selects black or white QR codes based on background luminance.
- **Product Catalogs**: Synchronizes Printify and Printful catalogs locally and with Firestore, performing smart diff-based updates.
- **Admin Product Image Curation**: Admin can delete individual images from a product's image set via the product preview modal (action bar below the image). A "Restore all" button appears when images differ from the master catalog and resets them to the original provider images. Provider badge (Printful/Printify) shown on product cards in admin only — invisible to members/customers. Changes persist to `catalog.blankImages[canonicalBlankKey]` via `PUT /admin/catalogs/:id/blank-images`.
- **Catalog Management System**: Everything runs through catalogs. Admin creates named catalogs (curated subsets of blanks), assigns them to 5 sections (Member, Public, External, Marketplace, Platform), and controls which blanks are available where. Old "allowed products" system replaced by catalog assignments. Default catalog auto-loads on page open (stored in `systemSettings/catalog-defaults`). Managed from the Blanks page (`admin-blanks.tsx`). Data stored in `catalogs`, `systemSettings/catalog-assignments`, and `systemSettings/catalog-defaults` Firestore collections. Features: duplicate catalog, bulk copy blanks between catalogs, set default catalog, thumbnail viewport strip showing catalog contents. The `GET /members/allowed-products` endpoint defaults to `member` section catalog when no `?section=` param provided. `GET /admin/catalog-health` provides diagnostic overview. Product queries use 5-minute staleTime caching. Product images use lazy loading.
- **Cascading Product Descriptions (Canonical)**: Three-level description cascade using canonical field names:
  1. `providerDescription` — Exact source from Printify/Printful (formerly `originalDescription`)
  2. `adminCatalogDescription` — Admin override saved in `catalog.blankDescriptions[canonicalBlankKey]` (formerly `adminDescription`)
  3. `memberPacketDescription` — Member-only override saved in packet's `boundProduct` (formerly `customDescription`)
  Resolution: `memberPacketDescription ?? adminCatalogDescription ?? providerDescription ?? fallback`. Implemented in `shared/descriptionLayers.ts` via `resolveDescription()` and `resolvePublicDescription()`. The normalizer `shared/wizardProduct.ts:normalizeWizardProduct()` accepts old field names as INPUT for Firestore backward compat but outputs canonical names only. **No client code uses old field names** — `originalDescription`, `adminDescription`, and `customDescription` are fully purged from `client/src/`. Backend endpoints still return both old and new names for transition safety. **Owners see descriptions read-only — only admin and members can edit.** Descriptions display on product cards in all wizards (tier and flat list).
- **Good/Better/Best Tier System**: Products in catalogs can be tagged with tiers (Good, Better, Best). Stored as `blankTiers: { blankId: "good"|"better"|"best" }` on catalog docs. Admin tags blanks via tier buttons on product cards in admin Blanks page. Tier display config (`tierConfig`) lets admin customize display names, descriptions, and taglines per tier. Backend endpoints: `PUT /admin/catalogs/:id/blank-tier`, `PUT /admin/catalogs/:id/tier-config`, `GET /members/tier-products?section=member` (returns products grouped by category and tier). `TierPickerStep` component (in `ProductSteps.tsx`) replaces `ProductPickerStep` in all wizards — shows Good/Better/Best tier cards when tiers exist, falls back to flat product list when no tiers configured. Colors: Good=blue, Better=amber, Best=emerald. Icons: Good=Star, Better=Award, Best=Crown. Tier badges appear on product cards and catalog thumbnail strip.
- **Data Storage**: Exclusively uses Firebase/Firestore for all data persistence and Firebase Storage for all file assets.
- **Admin Library Module**: Provides a modular, tenant-aware interface for managing backgrounds, templates, and images. Includes an **Images** tab with folder-based organization (Firestore `admin_images` collection, Firebase Storage `library/images/{folder}/`). API endpoints: `GET/POST/DELETE /admin/images`, `GET /admin/images/folders`, `PATCH /admin/images/:id`. Images are browsable from the product builder's "Choose from Library" dialog which shows both admin images (by folder) and existing backgrounds.
- **Shared Utilities Pattern**: Employs a Viewer/View/Skin architecture for UI component reusability. **See ARCHITECTURE_VIEWER.md for the binding, authoritative canon.** One viewer system only. Domain→Controller→Viewer→View→Skin. Viewer is dumb. View is layout only. Skin is visible controls. Controller owns authority. Domain owns truth. Phone-first mandatory. All UI card/grid/modal experiences must use this single system — no alternate viewer families, no forks. **Canon View Set (5 only):** SingleView, ScrollGridView, ScrollVerticalView, ScrollHorizontalView, ModalView. Page layouts are composition of these views, never new view types. Site fit rule: the entire site fits into these five views with different controllers and skins.
- **Wizard Header/Footer Image Mode Parity**: All wizard variants (SuperSimple, Simple, Advanced, Studio, Owner) support both text AND image modes for header/footer zones. `TextSteps.tsx` has text/image toggle, image upload/replace/remove, and X/Y/scale sliders. Both composite generators (`server/lib/composite-image-generator.ts`, `functions/src/services/composite-image.ts`) have `drawImageInZone` for server-side image rendering. Backend mapping in `members.routes.ts` and `functions/src/routes/members.ts` passes through `mode`, `imageUrl`, `verticalOffset`, `horizontalOffset`, `imageScale` fields. Position fields are unified — both text and image modes use `verticalOffset`/`horizontalOffset` for positioning. Image URLs are allowlisted to `data:`, Firebase Storage, and GCS origins.
- **Wizard Step Engines**: Modular components defining steps for product creation, graphic placement, QR setup, and publishing.
- **Modular Wizard Architecture**: Refactored `MembersPage.tsx` for shared state management and four wizard tiers: SuperSimple (tutorial cards), Simple (standard guided), Advanced (unlocks after 1st publish — full control with Quick Start, font slider, offsets), Studio (unlocks after 2nd publish — streamlined Quick Publish). Unlock tracking via `localStorage` key `publish_count_{userId}`.
- **Builder Capabilities Model** (`client/src/features/shared/builder-capabilities.ts`): Canonical `BuilderCapabilities` type declaring what each wizard shell can do (QR types, text customization, uploads, compose, tutorial, earnings vs cost tracking, checkout flow). Presets: `SUPER_SIMPLE_CAPABILITIES`, `SIMPLE_CAPABILITIES`, `ADVANCED_CAPABILITIES`, `STUDIO_CAPABILITIES`, `OWNER_CAPABILITIES`, `EXTERNAL_CAPABILITIES`. Used to document and eventually gate wizard features.
- **Extracted Wizard Hooks**: `useOwnerWizardState` (all Owner wizard state + business logic — temp packets, mockups, checkout), `useSuperSimpleTutorial` (tutorial queue, blackboard cards, congrats data, completion tracking). These keep wizard shell files thin.
- **Guest-First Wizard Flow**: Unauthenticated users can design products through the entire SuperSimple wizard. Sign-in gate triggers at preview-to-mockup transition (not at publish). Post-auth creates real channel from temp-channel, uploads pending video file, then advances to mockup with real credentials. Closing without sign-in shows explanatory card with "Back to Creator" button.
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
- **Member Creation Wizards**: Progressive unlock system for members based on publishing activity (SuperSimple, Simple, Advanced, Studio). Code-split via React.lazy for reduced initial bundle size.
- **Advanced Wizard Differentiation**: Advanced tier includes Quick Start resume, font size slider, vertical offset controls, and placement coordinate display with X/Y offset adjusters.
- **Wizard Completion Flow**: All wizard confirm screens hide Back/Next footer and show dual "Dashboard" / "Create Another" buttons via ShareKitHandoff.
- **Error Toasts**: Packet creation failures and library auto-save failures show user-visible toast notifications instead of silent console logs.

### System Design Choices
- **Printful-First Architecture**: Printful is the default fulfillment provider for all new products and orders. Printify remains available as an alternative but is not the default. The admin catalog browser defaults to the Printful tab. Provider is carried in every packet's `fulfillmentProvider` field for order routing. The admin product card shows a "Printful" or "Printify" provider badge visible only to admins — members and customers see a fully white-label experience.
- **Zone Mode QR Size Slider**: Admin builder now exposes S/M/L/XL presets + a continuous slider for QR size in Zone mode (in addition to Pallet/freeform mode). Formula: `qrSizePercent / 2` percent of safe width. Default 75 → 37.5% (same as prior hardcoded 38%). Firebase composite generator mirrors this formula. Safety assessment uses the correct effective percent in both modes.
- **Complete Packet State Persistence**: All graphic design settings are now fully saved in every packet: `graphicLayoutMode`, `qrSizePercent`, `qrPositionX`, `qrPositionY`, `areaImageUrl`, `areaImageMode`, `areaImageOffsetX`, `areaImageOffsetY`, `areaImageScale`. Also written to the template full-save payload (and stored in Firestore `productTemplates`). Previously these values were used only at render time and discarded.
- **Backend**: Node.js, Express, TypeScript.
- **Frontend**: React, TypeScript, Vite.
- **Database**: Firebase/Firestore exclusively.
- **Nexus Vision Philosophy**: Emphasizes self-learning, self-healing, and composable modules.
- **Modular Route Architecture**: Routes are organized into feature-based modules.
- **Four Store Types**: `internal` (QR Gear's own storefront, e.g. USA 250), `marketplace` (Etsy/eBay/Amazon — push listings, pull orders, you sell on their surface), `partner` (external sites embedding your UX — they build channels, you enable), `member` (individual member stores via wizard). Each type has its own admin section and data flows.
- **Unified Admin Authorization**: All admin endpoints use `/api/admin/` with `isAdmin` middleware; public endpoints use `/api/public/` without authentication.
- **Downloadable Assets**: Stored in the ROOT `downloads/` folder for direct user access.
- **Fluba Brain Harness**: A universal harness (`client/src/lib/flubaBrainClient.ts`) connects to an AI governance gateway, using a separate Firebase app instance for communication.
- **External Sites System (Canonical)**: Complete "create once, sell anywhere" engine. Canonical chain: Internal Product → Surface → BuilderProfile → BuilderHost → BuilderPlacement → AttributionContext → PricingPolicy → RevenueSplit → External Site Experience → Cart/Checkout → EmbeddedOrderAttribution → AffiliatePayoutLedger. Three embed modes: Mini Store (storefront grid), Mini Product (single product embed), Mini Builder (restricted customizer). Affiliate: 25% of gross profit via `computePricingSnapshot()`. Admin route: `/admin/external-sites` with 7 tabs. API: `functions/src/routes/external-sites.ts` with full CRUD for hosts/profiles/placements/pricing/revenue + public embed endpoints (`/public/embed/placement/:id`, `/public/embed/surface/:id`, `/public/embed/session`, `/public/embed/session/:id/draft`, `/public/embed/session/:id/cart`, `/public/embed/session/:id/buy`, `/public/embed/pricing/compute`). All public endpoints use `validateEmbedContext()` for domain validation (Origin/Referer against host's `allowedDomains`), affiliate resolution (placement→host→profile chain), and `checkSurfaceReadiness()` enforcement. Cart endpoint creates `embedCartItems` with pricing snapshot. Buy endpoint creates Stripe Checkout session, writes `EmbeddedOrderAttribution` and `AffiliatePayoutLedgerEntry` (status=pending). One website = many placements (each with own ID, profile, surface, pricing, attribution). Types in `shared/surfaces.ts`, constants in `functions/src/constants.ts`.

## Canonical Architecture — Six Steps (COMPLETE)

All six canonical architecture steps are built, deployed, and adopted. Read `ARCHITECTURE_VIEWER.md` and `ARCHITECTURE_IDENTITY.md` for the full binding canon.

### Step 1: Canonical Blank Identity (`shared/blankKeys.ts`)
Every product blank has a single canonical key: Printify `"71"`, Printful `"pf:71"`. `getCanonicalBlankKey()` is the only way to derive keys. No raw `blueprintId` reconstruction.

### Step 2: Description Layers (`shared/descriptionLayers.ts`)
Three canonical field names only: `providerDescription`, `adminCatalogDescription`, `memberPacketDescription`. Old names (`originalDescription`, `adminDescription`, `customDescription`) are **purged from all client code**. The normalizer in `shared/wizardProduct.ts` accepts old names as INPUT for Firestore backward compat. `resolveDescription()` and `resolvePublicDescription()` are the only resolution functions.

### Step 3: Wizard Product Contract (`shared/wizardProduct.ts`)
`normalizeWizardProduct(input, mode)` is the single normalizer for all product objects flowing through wizards. Outputs `WizardProduct` shape with canonical fields. `wizardProductToPacketBoundProduct()` converts for Firestore save. Already used in `WizardContext.tsx` at packet build time (lines 531, 610).

### Step 4: Wizard Surface Split
Wizard steps are modular components in `client/src/features/shared/components/wizardSteps/`. Three surfaces: IMAGE (Canvas), VIDEO (Play), DOCUMENT (future). `ProductSteps.tsx` uses canon skins (`WizardProductCardSkin`, `MemberProductDetailSkin`, `ReadOnlyProductDetailSkin`, `TierCardSkin`) and canon views (`ScrollVerticalView`).

### Step 5: Skin System (44 skin files)
All skins in `client/src/features/shared/components/skins/`. Skins render visible controls only — they do NOT decide business truth, save targets, or permissions. They receive declared handlers and visible state from controllers.

### Step 6: Controller Layer (6 controller hooks)
- `useAdminBlanksController` — WIRED into `admin-blanks.tsx` (page uses controller for all data/actions)
- `useWizardController` — Built, provides `normalizeForViewer()`, `resolveProductDescription()`, mode/permission state
- `useStoreController` — Built, provides normalized `StoreProductItem[]` from `/api/products`
- `useLibraryController` — Built, provides normalized `AdminLibraryAssetItem[]` with tab-aware type resolution
- `useMembersLibraryController` — Built, provides member library normalization
- `usePacketController` — Built, provides packet item normalization

### Controller Adoption Status
- `admin-blanks.tsx` — FULLY WIRED to `useAdminBlanksController`
- Store pages (`shop-segment.tsx`, `shop-product.tsx`) — Use their own domain-specific data flows; generic `useStoreController` available but not force-wired (these pages have cart/mockup/segment logic that doesn't fit the generic controller)
- Library tabs (`GraphicsTab`, `TemplatesTab`, etc.) — Already follow canon pattern (ScrollGridView + domain skins + ModalView) with their own data flows; `useLibraryController` available for generic asset tabs
- Wizard pages — `WizardContext.tsx` uses `normalizeWizardProduct` directly at packet build time; `useWizardController` available for future viewer-pattern adoption

### CANON RULES FOR FUTURE AGENTS
1. **NEVER** add `originalDescription`, `adminDescription`, or `customDescription` to client code
2. **NEVER** create a second viewer system — use SharedViewer with canon views and skins
3. **NEVER** put business logic in viewers, views, or skins — controllers own authority
4. **NEVER** invent new view types — compose from the 5 canon views
5. **ALWAYS** use `canonicalBlankKey` for product identity, never reconstruct from raw IDs
6. **ALWAYS** use `resolveDescription()` or `resolvePublicDescription()` for description resolution
7. **ALWAYS** use `normalizeWizardProduct()` when building wizard product objects
8. **ALWAYS** use `collectionId` — `collectionTag` has been fully removed
9. **ALWAYS** use domain vocabulary: Store/Channel/Collection/Artifact/Mosaic — not legacy names (see `docs/CANON_COLLECTION_MOSAIC.md`)
10. **NEVER** use any grouping mechanism other than `Collection` — no programs, tags, or ad-hoc grouping (Canon Rule 1)
11. **NEVER** use any stitching mechanism other than `Mosaic` + QR Dynamics (Canon Rule 2)
12. **NEVER** store API tokens in plaintext files — use environment variables only
13. **ALWAYS** import `MOSAICS_COLLECTION`, `MOSAIC_TEMPLATES_COLLECTION`, `PLATFORM_STORE_ID`, `LEGACY_STORE_ID` from centralized constants files (`functions/src/constants.ts` or `server/lib/constants.ts`) — never redefine locally
14. **ALWAYS** deploy to production after every change — this means:
    - `npm run build` → `firebase deploy --only hosting`
    - `cd functions && npm run build && cd ..` → `firebase deploy --only functions`
    - Verify homepage returns 200: `curl -s -o /dev/null -w "%{http_code}" https://qrgear-c1ffd.web.app/`
    - Verify shop returns 200: `curl -s -o /dev/null -w "%{http_code}" https://qrgear-c1ffd.web.app/shop`
    - Verify Cloud Functions health: `curl -s https://us-central1-qrgear-c1ffd.cloudfunctions.net/api/api/health`
    - Verify dynamics endpoint: `curl -s https://us-central1-qrgear-c1ffd.cloudfunctions.net/api/api/dynamics/packets?storeId=qr-gear` (also check `storeId=kingdom_connects` for legacy data)
    - Rebuild the zip: `downloads/QR_Gear_Full_Website.zip`
    - **Every session ends with deploy + verify. No exceptions.**

## Canonical Domain Model

The system follows a canonical domain hierarchy defined in `shared/domainModel.ts`:

```
Store → Channel → Collection → Artifact
                                   ↓
                            QR Dynamics stitches
                            artifacts into a Mosaic
```

- **StoreRecord** — Top-level brand surface (e.g. `qr-gear`)
- **ChannelRecord** — Thematic feed inside a store (e.g. `usa250`, `faith`)
- **CollectionRecord** — Curated grouping inside a channel (e.g. `signature-series`)
- **ArtifactRecord** — Individual content item or QR-linked object
- **MosaicRecord** — Stitched interactive experience from artifacts (via QR Dynamics)

### Domain Mappers (`server/lib/domain-mappers.ts`)
Normalize legacy Firestore records into canonical domain objects. Functions: `channelItemToArtifact()`, `firestoreDocToStore()`, `firestoreDocToChannel()`, `firestoreDocToCollection()`, `legacyProgramToMosaic()`.

### Route Split (COMPLETED)
The 1563-line `qr-dynamics.routes.ts` monolith has been split into 4 domain-aligned route files:
- `dynamic-pages.routes.ts` — Dynamic Pages CRUD
- `buyer-instances.routes.ts` — Buyer Instances + QR resolve
- `dynamics-content.routes.ts` — Channel Content + Collection Items + Collections + Surfaces
- `dynamics-v2.routes.ts` — QR Dynamics V2 instances, preview, resolver, scan-to-reveal

### Mosaic Service (COMPLETED)
`server/lib/mosaicService.ts` is the primary mosaic CRUD implementation with canonical vocabulary: `createMosaic`, `getMosaic`, `getMosaicsByStore`, etc. Legacy `programService.ts` has been removed.

### Name Translation (COMPLETED)
- `collectionTag` → `collectionId` — FULLY REMOVED. No dual-write, no fallback reads. Only `collectionId` exists.
- All Firestore collection names centralized behind named constants in `functions/src/constants.ts` and `server/lib/constants.ts`. No raw collection-name strings in route files:
  - `MOSAICS_COLLECTION` = `'site_programs'`
  - `MOSAIC_TEMPLATES_COLLECTION` = `'dynamicsCollections'`
  - `CHANNEL_ITEMS_COLLECTION` = `'channel_items'`
  - `CHANNEL_CONTENT_COLLECTION` = `'dynamicsChannelContent'`
  - `COLLECTION_ITEMS_COLLECTION` = `'dynamicsCollectionItems'`
  - `DYNAMICS_SURFACES_COLLECTION` = `'qrDynamicsSurfaces'`
  - `STORE_PRODUCT_LINKS_COLLECTION` = `'storeProductLinks'`
  - `PRODUCT_PACKETS_COLLECTION` = `'productPackets'`
  - `PLATFORM_STORE_ID` = `'qr-gear'`
- `channelItemsService.ts` — Now imports `PLATFORM_STORE_ID` and `CHANNEL_ITEMS_COLLECTION` from constants; re-exports `PLATFORM_STORE_ID` for backward compat.
- `domain-mappers.ts` — `firestoreProgramToMosaic` renamed to `firestoreDocToMosaic`; old name kept as deprecated re-export for test compat.
- `program_series` → `mosaic_series` — FULLY REMOVED. ViewType is `'channel_products' | 'mosaic_series' | 'create_product'` only.
- `DEFAULT_STORE_ID` → `PLATFORM_STORE_ID` — COMPLETED. Value changed from `'kingdom_connects'` to `'qr-gear'`. `LEGACY_STORE_ID = 'kingdom_connects'` exported for backward-compat queries. New writes use `'qr-gear'`. Firestore data migration pending.
- `KC_ISSUER` → `PLATFORM_ISSUER` — COMPLETED in `widget-auth.ts`. Value changed from `'kingdom_connects'` to `'qrgear'`. Verification accepts both via `VALID_ISSUERS` array. New tokens signed as `'qrgear'`.
- `KC_ISSUER` → `KC_PARTNER_ISSUER` — COMPLETED in `kcWidgetService.ts`. Value stays `'kingdom_connects'` — this is KC's partner identity, not a platform default. Documented clearly.
- `kingdom_connects` in `shared/nexusmail/contracts.ts` — Stays as a `SiteId` value. KC is a legitimate external partner with its own email triggers. Documented with inline comment.
- All bare `'kingdom_connects'` string literals in `server/` replaced with named constants. No raw `'kingdom_connects'` remains except inside constant definitions and partner-specific code.

### Security Hardening (COMPLETED)
- `server/printify-token.txt` — DELETED (was plaintext API token). Printify key now env-only via `PRINTIFY_API_KEY`
- `server/lib/printify.ts` — Removed file-based token fallback, env-only
- `server/lib/widget-auth.ts` — Always throws if no `WIDGET_JWT_KEYS` or `WIDGET_JWT_SECRET` configured (no dev fallback in any environment)
- License: README says Proprietary, `package.json` says `UNLICENSED` (npm convention for proprietary) — MATCHED

### Test Coverage
- `shared/__tests__/qrDynamicsResolver.test.ts` — 13 tests covering slot resolution, cycle wrap, boundary conditions, time remaining, negative elapsed
- `shared/__tests__/blankKeys.test.ts` — 15 tests covering canonical key derivation, provider detection, prefix handling
- `shared/__tests__/descriptionLayers.test.ts` — 11 tests covering three-level cascade, public resolution, snapshot builder
- `shared/__tests__/domainMappers.test.ts` — 14 tests covering all 5 domain mapper functions, collectionId mapping, legacy field handling
- `shared/qrDynamicsResolver.ts` — Pure extracted resolver function (no Firestore dependency) for testability
- Run with: `npx vitest run --config vite.config.ts --root . shared/__tests__/`

### System Truth Sheet
- `docs/SYSTEM_TRUTH_SHEET.md` — Single canonical reference: official product model, storage ownership (Firestore vs Postgres), legacy translation map, platform constants, security rules

### Storefront UX Pass (COMPLETED — deployed)
- **StoreRootView** (`client/src/features/storefront/StoreRootView.tsx`) — Full hero section with lifestyle image (`attached_assets/store_hero.png`), dark wash overlay, "Wear the Story. Scan the Experience." headline, two CTAs, "Scan. Learn. Connect." 3-step section, channel entry cards below.
- **ChannelHubView** (`client/src/features/storefront/ChannelHubView.tsx`) — Channel header with full-width image (`attached_assets/usa250_header.png`), dark gradient overlay, title + intro text. Collection cards replaced with image-background cards (armed-forces/monuments/founding-fathers images) + text overlay (title + subtitle).
- **CollectionView** (`client/src/features/storefront/CollectionView.tsx`) — Replaced un-clickable breadcrumb text with `StorefrontBreadcrumb` component. Browse-only product grid (no color/size selectors on cards).
- **StorefrontBreadcrumb** (`client/src/features/storefront/StorefrontBreadcrumb.tsx`) — NEW shared breadcrumb component: takes `crumbs: { label, href? }[]`, renders linked path with `ChevronRight` separators. Used in CollectionView, ChannelHubView, shop-product.tsx.
- **shop-product.tsx** — Added breadcrumb (QR Gear → Channel → Collection → Product Name) built from product.channel + product.collection fields via `getChannelConfig` reverse-lookup. Removed `window.history.back()` back button — breadcrumb replaces it.
- **shopHierarchy.ts** — Added `subtitle` field to `CollectionConfig`. Three collections now have subtitles: "Honor. Service. Sacrifice.", "Symbols That Stand the Test of Time", "The Minds That Built a Nation".
- **Images** (in `attached_assets/`): `store_hero.png` (lifestyle hero), `usa250_header.png` (channel header), `collection_armed_forces.png`, `collection_monuments.png`, `collection_founding_fathers.png` — all AI-generated, 16:9 or 4:3 as appropriate.

### Firestore Security + Index Oil Change (2026-04-23 — deployed)
- **`isAdmin()` rule fixed** — Firestore rules `isAdmin()` previously only checked `request.auth.token.role == 'admin'` (custom claim never set). Now also checks `get(.../users/uid).data.isAdmin == true`, matching the backend's `requireAdmin` middleware logic. This unblocks client-side admin writes (Categories CRUD).
- **Three missing collection rules added** to `firestore.rules`:
  - `categories` — public read / admin write (used by `client/src/lib/categories.ts` + `admin-categories.tsx` + `PreDesignedCollection.tsx`)
  - `member_profiles` — owner+admin read/write (used by `useSuperSimpleTutorial.ts` for tutorial completion tracking)
  - `brain_responses` — signed-in read / no client write (used by `flubaBrainClient.ts` for AI async response subscriptions)
- **9 missing composite indexes added** to `firestore.indexes.json` for `where+orderBy` queries that would fail as data grows:
  - `admin_catalog_instances`: storeId+channelId; storeId+channelId+collectionName
  - `storeProductLinks`: storeId+channel+collection+createdAt(ASC)
  - `admin_build_shelf`: groupIds(ARRAY_CONTAINS)+createdAt(DESC)
  - `memberProducts`: memberId+createdAt(DESC)
  - `memberEarnings`: memberId+createdAt(DESC)
  - `mockup_jobs`: productId+createdAt(DESC)
  - `design_versions`: masterProductId+version(DESC)
  - `bundle_items`: bundleId+displayOrder(ASC)
  - `provider_health_checks`: providerType+checkedAt(DESC)
  - `temp_packets`: status+expiresAt(ASC) (inequality filter)

## Member Creator Surface (added 2026-04-23, updated pass 2)
- **Routes**:
  - `/creator/:creatorSlug` — shows all published packets for creator
  - `/creator/:creatorSlug/:channelId` — shows packets filtered to a single channel
  - Both → `client/src/pages/creator-surface.tsx`. Public, no auth.
- **Creator surface features (pass 2)**:
  - SEO component: per-page title, og:description, og:image from first item
  - Avatar with initials (from `storeName`)
  - Social handle display with platform icon + link (Instagram, TikTok, X, YouTube, Facebook)
  - Channel name shown in header when channel-scoped URL used
  - `?ref=:memberId` appended to all product links (referral attribution)
  - Empty state CTA: "Browse QR Gear" link to platform shop
  - Redundant `client/src/features/members/MemberChannelsView.tsx` deleted
- **API**: `GET /api/public/creator/:slug?channel=:channelId`
  - Both endpoints updated: `functions/src/routes/members.ts` + `server/routes/member-public-wizard.routes.ts`
  - `?channel=` param filters packets by `channelId` field
  - Profile response now includes `socialHandle`, `primarySocial`
  - Channel display name resolved from Firestore `channels` collection
- **Share URL**: `client/src/features/members/member-channels-view.tsx`
  - Share button copies `/creator/:creatorSlug/:channelId` (channel-scoped URL)
- **storeId fix** (pass 1): `functions/src/routes/members.ts`
  - Packet `storeId` changed from `storeId || memberId` → `storeId || PLATFORM_STORE_ID`

## External Dependencies
- **Printify**: Print-on-demand fulfillment.
- **Printful**: Product mockup generation.
- **Stripe**: Payment processing.
- **Firebase**: Hosting, Firestore, Firebase Storage, Cloud Functions, Authentication.
- **Fluba Brain**: AI governance gateway.
- **Resend**: Email services.
- **TanStack Query**: Frontend data fetching and state management.
- **shadcn/ui**: UI component library.