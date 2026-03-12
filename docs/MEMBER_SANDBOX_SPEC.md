# Member Sandbox Specification

**Last updated**: March 2026

## Overview
The Member area (`/members`) is a product builder where members can create and sell QR-enhanced merchandise with **25% profit share**. Supports both authenticated and unauthenticated (guest-first) flows.

## Wizard Tiers (Progressive Unlock)

| Tier | Unlock Requirement | Experience |
|------|-------------------|------------|
| **SuperSimple** | Available immediately | Card-based tutorial with "Blackboard" explainer cards |
| **Simple** | Available immediately | Standard step-by-step guided flow |
| **Advanced** | After 1st publish | Full control: Quick Start resume, font size slider, vertical offset, placement coordinates |
| **Studio** | After 2nd publish | Streamlined "Quick Publish" for experienced creators |

Unlock tracking uses `localStorage` key `publish_count_{userId}`. Unlock banners display in `MembersPage.tsx`.

## Guest-First (Unauthenticated) Flow

Users can launch the SuperSimple wizard without logging in and design their entire product:
- Select product, color, size
- Choose QR type and configure content (upload video, enter URL, pick background)

The **sign-in gate** triggers at the preview-to-mockup transition (not at publish time), maximizing sunk-cost investment before requesting credentials.

**Post-auth**: System creates real channel from temp-channel, uploads pending video file, then advances to mockup generation with real credentials.

**If user closes without signing in**: An explanatory card appears explaining that an account is needed to save work, generate mockups, and access the dashboard. A "Back to Creator" button returns to the wizard.

## Module Stack (Composable Architecture)

Each QR type builds on the previous, adding modules:

| QR Type | Modules Used |
|---------|--------------|
| **QR Basic** | URL or text only (no extras) |
| **QR Plus** | TextStyleEditor (header/footer styled landing page) |
| **QR Canvas** | TextStyleEditor + BackgroundModule + Text overlay |
| **QR Play** | VideoModule (upload or URL) |
| **QR Compose** | Hosting tier selection + domain configuration |

**TextStyleEditor** is the common module — introduced at Plus, reused in Canvas.

## Wizard Flow

See `docs/WIZARD_FLOW.md` for the complete step-by-step breakdown by QR type.

### Summary
1. **Channel** — Choose or create a storefront
2. **Product** — Select base product (via TierPickerStep: Good/Better/Best or flat list)
3. **Product Congrats** — Display potential earnings
4. **Color/Size** — Pick variant
5. **QR Type** — Choose: Basic, Plus, Canvas, Play, or Compose
6. **Placement/Graphic Size** — Configure placement and graphic dimensions
7. **Generate** — Header/Footer fork (Yes → QR Plus/Canvas text steps; No → QR Basic)
8. **QR-Specific Content** — Type-specific steps (URL input, video upload, background selection, etc.)
9. **Preview** — Preview landing page or mockup
10. **Publish/Confirm** — Final save + ShareKitHandoff (Dashboard / Create Another)

## Two-Tier Library System

### Common Library (Admin-curated)
- Firestore: `commonLibrary` collection
- Backgrounds, templates, graphics curated by admin
- Read-only for members

### Personal Library (Member-owned)
- Firestore: `memberLibrary` collection
- Member's own uploads and saved product instances
- Scoped by `memberId`

## Good/Better/Best Tier System

Products in catalogs can be tagged with tiers. `TierPickerStep` replaces `ProductPickerStep` in all wizards — shows tier cards when tiers exist, falls back to flat product list when no tiers configured.

| Tier | Color | Icon |
|------|-------|------|
| Good | Blue | Star |
| Better | Amber | Award |
| Best | Emerald | Crown |

## Pricing Model

### Base Pricing
- **Base cost** = Product manufacturing cost (e.g. $10 shirt)
- **First graphic** = INCLUDED in base price (no extra charge)
- **Each additional graphic** = +$4 (e.g. back graphic)
- **Header text** = +$2
- **Footer text** = +$2

### Example Calculation
```
Product: $10 base (includes 1 graphic)
+ Back graphic: $4
+ Header text: $2
+ Footer text: $2
= Retail: $18
Profit: $8
Member earns: $2 (25% of profit)
```

## Earnings
- Members get **25% profit share** on sales
- Displayed on product cards as earnings badge
- Recorded in `member_earnings` Firestore collection

## Landing Page URLs
- QR Canvas and QR Play build URLs under `/m/member/[slug]`
- Stateless, time-based resolution for QR Dynamics

## API Endpoints
- `GET /api/members/allowed-products` — Products from catalog (defaults to `member` section)
- `GET /api/members/tier-products?section=member` — Products grouped by category and tier
- `GET /api/common-library` — Common library assets
- `GET/POST /api/members/:memberId/personal-library` — Personal library CRUD
- `GET/POST /api/members/:memberId/channels` — Member channels
- `GET /api/members/:memberId/earnings` — Earnings dashboard

## Key Files

| File | Purpose |
|------|---------|
| `client/src/features/members/MembersPage.tsx` | Tier routing + unlock banners + unauthenticated card |
| `client/src/features/members/SuperSimpleWizard.tsx` | SuperSimple wizard UI + sign-in gate |
| `client/src/features/members/WizardContext.tsx` | Shared wizard state + packet save logic |
| `client/src/features/shared/components/wizardSteps/wizardTypes.ts` | Step ID definitions + sequences |
| `client/src/features/shared/components/wizardSteps/ProductSteps.tsx` | TierPickerStep + product cards |
| `client/src/features/shared/components/wizardSteps/PlaySteps.tsx` | QR Play step components |
