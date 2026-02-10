# QR Gear - Pages & Components Bundle

## What's In This Bundle

This bundle contains all member pages, public-facing pages, test pages, shared wizard components, server renderers, and the main routing file. Below is a comprehensive breakdown of every file, what it does, and what changes have been made.

---

## ZIP: routing.zip
### App.tsx
- **Purpose**: Main routing file. Maps every URL path to its page component.
- **Changes Made**: No recent changes to routing. This is the single source of truth for all routes.

---

## ZIP: member-features.zip

### MembersPage.tsx (~817 lines)
- **Purpose**: Pure routing shell for the member area (`/member`). Handles auth, nav tabs (Super Simple / Simple / Advanced / Studio), view mode switching.
- **Changes Made**: Refactored from 3,661 lines into modular architecture. Now delegates all wizard logic to the modules below via `WizardProvider`.

### WizardContext.tsx (~1,815 lines)
- **Purpose**: All shared wizard state (~100 useStates), pricing queries, API operations, navigation logic. Consumed via `useWizardContext()` hook.
- **Changes Made**: Extracted from MembersPage.tsx during modular refactor. Contains `handleSimpleNext`, `handleSimpleBack`, `canSimpleProceed`, `simpleStep` navigation used by all wizard tiers.

### SuperSimpleWizard.tsx (~186 lines)
- **Purpose**: Cards-based wizard (tier: 'super-simple'). 6 steps shown as large tappable cards with progress dots. After type selection, hands off to Simple Wizard.
- **Changes Made**: Extracted from MembersPage.tsx. Uses BlackboardExplainer for step explanations.

### SimpleWizard.tsx (~981 lines)
- **Purpose**: Full guided wizard with all QR type branches (Basic/Plus/Canvas/Play/Compose), progress bar, next/back navigation. Green branding.
- **Changes Made**: Extracted from MembersPage.tsx. Reference implementation — Advanced Wizard mirrors this step flow.

### AdvancedWizard.tsx (~580 lines)
- **Purpose**: Advanced wizard rebuilt to use same `simpleStep` navigation and all shared step components as Simple Wizard. Blue branding (text-blue-400, bg-blue-500), Layers icon. Full ~40+ step coverage across all QR branches.
- **Changes Made**: Rebuilt Feb 2026 to share step components with Simple. Uses `handleSimpleNext`/`handleSimpleBack`/`canSimpleProceed` from WizardContext. Test IDs prefixed with "advanced".

### StudioMode.tsx (~128 lines)
- **Purpose**: Quick publish interface for experienced users. Minimal UI, fast workflow.
- **Changes Made**: Extracted from MembersPage.tsx.

### MemberAuthContext.tsx
- **Purpose**: Authentication context for member area. Firebase Auth integration.
- **Changes Made**: None recent.

### MembersContext.tsx
- **Purpose**: Member-specific data context (channels, collections, earnings).
- **Changes Made**: None recent.

### OwnerWizard.tsx (Public Wizard)
- **Purpose**: Public-facing conversion funnel at `/build` and `/creator`. Self-contained (no WizardContext dependency). Lets visitors build custom QR products without authentication. Shows cost framing instead of earnings. Supports all QR types via `?type=basic|plus|canvas|play|compose` URL param. After building, shows cost summary and member conversion pitch.
- **Changes Made**: Created Feb 2026. Reuses shared wizard step components. If QR type is pre-selected via URL param, type selection step is skipped.

---

## ZIP: shared-wizard-steps.zip
These are the shared step components used by Super Simple, Simple, Advanced, and Owner wizards.

### TextSteps.tsx (~766 lines)
- **Purpose**: Text layout selection (header/footer/both/none), text style editing (color, size, font, position sliders), and per-zone text editing steps (HeaderTextEditStep, FooterTextEditStep).
- **Changes Made**:
  - Replaced inline 25/50/25 zone thumbnail code with shared `ZoneThumbnail` component from ZonePreview.tsx
  - Uses `UnifiedGraphic` for live SVG previews with proper zone math
  - Vertical/horizontal offset sliders (0-100 range) control text positioning within zones

### PlacementSteps.tsx (~813 lines)
- **Purpose**: Product placement selection (front-center, left-chest, etc.), graphic choice (full graphic vs QR-only), graphic size selection, shirt color selection.
- **Changes Made**:
  - Replaced both "Full Graphic" and "QR Only" inline zone thumbnails with shared `ZoneThumbnail` component
  - Uses `UnifiedGraphic` for live preview

### QRBasicSteps.tsx (~427 lines)
- **Purpose**: QR Basic type steps — URL/text input, save options (packet/template/catalog), and basic QR preview.
- **Changes Made**:
  - Replaced inline placeholder preview with shared `PlaceholderPreview` component from ZonePreview.tsx

### CanvasSteps.tsx
- **Purpose**: Canvas QR steps — background selection, title/description editing, phone mockup preview (landing page layout, NOT product graphic zones).
- **Changes Made**: None recent. Phone mockups correctly show landing page content with centered flexbox layout.

### PlaySteps.tsx
- **Purpose**: Play QR steps — video source selection, video upload, video preview.
- **Changes Made**: None recent.

### ComposeSteps.tsx
- **Purpose**: Compose QR steps — playlist building from published Canvas/Play items, time-based slot rotation configuration.
- **Changes Made**: None recent.

### QRPlusSteps.tsx
- **Purpose**: QR Plus type steps — enhanced QR with additional features.
- **Changes Made**: None recent.

### ProductSteps.tsx
- **Purpose**: Product selection step — displays available products for the selected channel.
- **Changes Made**: None recent.

### ChannelStep.tsx
- **Purpose**: Channel selection step — pick which store/channel to publish to.
- **Changes Made**: None recent.

### TypeAndSurfaceSteps.tsx
- **Purpose**: QR type selection (Basic/Plus/Canvas/Play/Compose) and surface selection.
- **Changes Made**: None recent.

### PreviewAndPublishSteps.tsx
- **Purpose**: Final preview, pricing summary, publish confirmation, and ShareKitHandoff.
- **Changes Made**: None recent.

### BlackboardExplainer.tsx
- **Purpose**: Educational explanation cards used by Super Simple Wizard to explain each step.
- **Changes Made**: None recent.

### WizardProgressBars.tsx
- **Purpose**: Progress bar and progress dot components for wizard navigation.
- **Changes Made**: None recent.

### wizardTypes.ts
- **Purpose**: All shared TypeScript types — TextLayoutChoice, GraphicSize, GraphicLocation, PlacementOption, SHIRT_COLORS, PLACEMENT_OPTIONS, etc.
- **Changes Made**: None recent.

### index.ts
- **Purpose**: Barrel export file for wizard steps.
- **Changes Made**: None recent.

---

## ZIP: shared-components.zip

### ZonePreview.tsx (~258 lines) — NEW
- **Purpose**: Shared zone preview components eliminating code duplication across all zone layout previews. Contains:
  - `ZoneLayout` — Full 25/50/25 zone preview with text positioning, QR code, background support
  - `ZoneThumbnail` — Small/medium thumbnail showing header/footer bars and QR icon in zone layout
  - `DesignPreview` — Admin-facing print design preview (white background, dashed border, text + QR)
  - `PlaceholderPreview` — Empty QR placeholder preview
- **Changes Made**: Created as new shared module. Replaces duplicated inline zone preview code that was previously scattered across TextSteps, PlacementSteps, QRBasicSteps, and admin-products.

### UnifiedGraphic.tsx (~281 lines)
- **Purpose**: SVG-based graphic preview component. Renders the product graphic with proper 25/50/25 zone math as an SVG. Used for live previews in wizards and admin builder.
- **Zone Math**:
  - Canvas: 1200x1800
  - Header zone: top 25% (0 to 450)
  - QR zone: middle 50% (450 to 1350), with 10% top/bottom margins within that zone, 80% area for QR background
  - Footer zone: bottom 25% (1350 to 1800)
  - Text positioning: `startY = zoneTop + marginY + (vOffset / 100) * (usableHeight - totalTextHeight)` with 1% margins
- **KNOWN ISSUE**: The QR white background box may visually appear to fill the entire 50% zone without visible 10% margins. The vertical offset slider for header text may not visually reach all the way to the QR zone boundary. These need further investigation/fix.

### GraphicPreviewView.tsx
- **Purpose**: Wrapper around UnifiedGraphic that adds background color/image, auto-detects light/dark for QR color, and provides a bordered preview container.
- **Changes Made**: None recent.

### TextStyleEditor.tsx
- **Purpose**: Reusable text style configuration component (color, font, size, stroke, offsets).
- **Changes Made**: None recent.

### HeaderFooterEditor.tsx
- **Purpose**: Combined header + footer text editing interface used in admin builder.
- **Changes Made**: None recent.

### BackgroundPicker.tsx
- **Purpose**: Background color/image selection component.
- **Changes Made**: None recent.

### PlacementPicker.tsx
- **Purpose**: Product placement area picker (front, back, left chest, etc.).
- **Changes Made**: None recent.

### ColorSwatchPicker.tsx
- **Purpose**: Color swatch selection component for product colors.
- **Changes Made**: None recent.

### GraphicViewer.tsx
- **Purpose**: Displays generated product graphic with zoom/pan capabilities.
- **Changes Made**: None recent.

### ShareKitHandoff.tsx
- **Purpose**: Post-publish share kit — social media images, pre-written captions, sharing UI.
- **Changes Made**: None recent.

---

## ZIP: admin-and-server.zip

### admin-products.tsx (~5,724 lines)
- **Purpose**: Full admin product management page — product CRUD, catalog sync, product builder with text/graphic/mockup configuration.
- **Changes Made**:
  - Replaced inline "Print Design Preview" code with shared `DesignPreview` component from ZonePreview.tsx

### CreateGraphicsModule.tsx (~1,450 lines)
- **Purpose**: Admin builder module for generating product graphics. Contains `generateProductGraphic()` (client-side canvas renderer) and `generateLandingPageSnapshot()`.
- **Changes Made**:
  - Rewrote `generateProductGraphic()` to use proper 25/50/25 zone math matching server renderers
  - Header zone: top 25% of canvas height
  - QR zone: middle 50% with 10% top/bottom margins, 80% area for QR background
  - Footer zone: bottom 25%
  - Text uses zone formula: `startY = zoneTop + marginY + (vOff / 100) * (usableH - totalTextHeight)`
  - Added `wrapCanvasText()` helper for multi-line text wrapping on canvas

### composite-image-generator.ts (Server)
- **Purpose**: Server-side Sharp-based product graphic renderer. Generates the final PNG for Printify/Printful submission.
- **Zone Math**: Already correct — 25/50/25 zones, 10% QR margins, 1% text margins.
- **Changes Made**: None recent (already had correct math).

### svg-renderer.ts (Server)
- **Purpose**: Server-side SVG product graphic renderer. Alternative renderer path.
- **Zone Math**: Already correct — matches composite-image-generator.
- **Changes Made**: None recent (already had correct math).

---

## ZIP: public-pages.zip
All public-facing pages accessible without authentication:

| File | Route | Purpose |
|------|-------|---------|
| home.tsx | `/` | Landing page / homepage |
| store.tsx | `/store` | Product storefront |
| gallery.tsx | `/gallery` | Product gallery |
| cart.tsx | `/cart` | Shopping cart |
| build.tsx | `/build` | Public wizard wrapper (renders OwnerWizard) |
| build-success.tsx | `/build/success` | Post-build success page |
| earn.tsx | `/earn` | Earnings/member pitch page |
| creator.tsx | `/creator` | Alias for public wizard |
| checkout.tsx | `/checkout` | Stripe checkout |
| checkout-success.tsx | `/checkout/success` | Post-payment confirmation |
| login.tsx | `/login` | Firebase login |
| register.tsx | `/register` | Firebase registration |
| member.tsx | `/member` | Member area entry point |
| packet.tsx | `/p/:id` | Product packet viewer |
| play.tsx | `/play/:packetId` | Play QR landing page |
| product-landing.tsx | `/i/:slug`, `/e/:slug`, `/m/:slug` | Product landing pages |
| view-image.tsx | `/view/:id` | Image viewer |
| view-dynamic.tsx | `/dynamic/:slug` | Dynamic QR content viewer |
| customize.tsx | `/customize` | Product customization |
| claim.tsx | `/claim/:claimCode` | Claim code entry for item registration |
| renew.tsx | `/renew/:instanceId` | Hosting renewal |
| gift-shop.tsx | `/gifts` | Gift shop |
| gift-redeem.tsx | `/gift/redeem` | Gift code redemption |
| shop-segment.tsx | `/shop/:storeType/:storeName` | Segmented store view |
| widget.tsx | `/widget` | Embeddable widget |
| account.tsx | `/account` | User account management |
| customs.tsx | `/customs/:id` | Custom order details |
| not-found.tsx | fallback | 404 page |
| qr-basics.tsx | `/qr-basics` | QR Basics info/landing page |
| qr-plus.tsx | `/qr-plus` | QR Plus info/landing page |
| qr-canvas.tsx | `/qr-canvas` | QR Canvas info/landing page |
| qr-play.tsx | `/qr-play` | QR Play info/landing page |
| qr-dynamics.tsx | `/qr-dynamics` | QR Dynamics info/landing page |
| qr-history.tsx | `/qr-history` | QR History info/landing page |
| wedding-qr-shirts.tsx | `/wedding-qr-shirts` | Niche landing: wedding |
| family-reunion-shirts.tsx | `/family-reunion-shirts` | Niche landing: family reunion |
| artist-qr-apparel.tsx | `/artist-qr-apparel` | Niche landing: artists |
| memorial-qr-gifts.tsx | `/memorial-qr-gifts` | Niche landing: memorials |
| musician-merch.tsx | `/musician-merch` | Niche landing: musicians |
| website-qr-shirts.tsx | `/website-qr-shirts` | Niche landing: websites |
| office-qr-mug.tsx | `/office-qr-mug` | Niche landing: office |
| lost-found-qr.tsx | `/lost-found-qr` | Niche landing: lost & found |
| networking-qr-shirts.tsx | `/networking-qr-shirts` | Niche landing: networking |
| medical-alert-qr.tsx | `/medical-alert-qr` | Niche landing: medical alert |
| personal-items-qr.tsx | `/personal-items-qr` | Niche landing: personal items |
| event-qr-shirts.tsx | `/event-qr-shirts` | Niche landing: events |
| everyday-qr.tsx | `/everyday-qr` | Niche landing: everyday use |
| business-qr-plus.tsx | `/business-qr-plus` | Niche landing: business |
| memorial-video-shirts.tsx | `/memorial-video-shirts` | Niche landing: memorial video |
| family-video-messages.tsx | `/family-video-messages` | Niche landing: family video |
| video-time-capsule.tsx | `/video-time-capsule` | Niche landing: time capsule |
| advent-qr-shirts.tsx | `/advent-qr-shirts` | Niche landing: advent |
| band-dynamic-merch.tsx | `/band-dynamic-merch` | Niche landing: bands |
| realtor-qr-shirts.tsx | `/realtor-qr-shirts` | Niche landing: realtors |
| business-analytics-qr.tsx | `/business-analytics-qr` | Niche landing: analytics |
| logo-preview.tsx | `/logo-preview` | Logo preview tool |

---

## ZIP: test-pages.zip
Internal/admin test pages:

| File | Route | Purpose |
|------|-------|---------|
| test-images.tsx | `/test-images` | Image generation testing |
| test-library.tsx | `/test-library` | Library module testing |
| test-products.tsx | `/test-products` | Product builder testing |
| test-stores.tsx | `/test-stores` | Store management testing |
| test-store-builder.tsx | `/test-store-builder` | Store builder testing |
| test-ar-demo.tsx | `/test-ar-demo` | AR preview testing |
| test-dynamics.tsx | `/test-dynamics` | QR Dynamics testing |
| test-pricing.tsx | `/test-pricing` | Pricing configuration testing |
| test-settings.tsx | `/test-settings` | Settings testing |
| test-canvas-packet.tsx | `/test-canvas-packet` | Canvas packet testing |
| test-qr-play.tsx | `/test-qr-play` | QR Play testing |
| admin-test-images.tsx | `/admin/test-images` | Admin image testing |
| admin-test-upload.tsx | `/test-upload` | Admin upload testing |

---

## Architecture Notes

### Two Distinct Graphics
1. **Product Graphic** — 25/50/25 zone layout for physical products (header text zone 25%, QR code zone 50%, footer text zone 25%). Generated by `generateProductGraphic()` client-side and `composite-image-generator.ts`/`svg-renderer.ts` server-side.
2. **Landing Page Snapshot** — Background image with centered text content. What people see when they scan the QR code. Shown in phone mockups.

### Zone Math (Product Graphic)
- Header: top 25% of canvas
- QR: middle 50% of canvas, with 10% margin top, 80% QR background area, 10% margin bottom (within that 50%)
- Footer: bottom 25% of canvas
- Text margins: 1% on all sides within each text zone
- Text position formula: `startY = zoneTop + marginY + (verticalOffset / 100) * (usableHeight - totalTextHeight)`

### Wizard Tiers
All wizards use the same shared step components but with different levels of explanation:
- **Super Simple**: Card-based, heavy explanation, hands off to Simple after step 6
- **Simple**: Full guided wizard, green branding, reference implementation
- **Advanced**: Same steps as Simple, blue branding, less hand-holding
- **Studio**: Quick publish, minimal UI
- **Owner/Public**: No auth required, cost framing instead of earnings, member conversion pitch
