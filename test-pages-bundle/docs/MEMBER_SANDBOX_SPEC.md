# Member Sandbox Specification

## Overview
The Member Sandbox (`/test-members`) is a simplified product builder where authenticated members can create and sell products using admin-unlocked templates with **25% profit share**.

## Module Stack (Composable Architecture)

Each QR type builds on the previous, adding modules:

| QR Type | Modules Used |
|---------|--------------|
| **QR Basic** | URL only (no extras) |
| **QR Plus** | TextStyleEditor (header/footer) |
| **QR Canvas** | TextStyleEditor + BackgroundModule + Text overlay |
| **QR Play** | TextStyleEditor + VideoModule |

**TextStyleEditor** is the common module - introduced at Plus, reused in Canvas and Play.

## Wizard Flow

### Step 1: Product Picker
**Purpose**: Select a product from the Common Library

**Card Skin Requirements**:
- Thumbnail image of product
- Product title
- Earnings badge at bottom (e.g. "$2" profit)

**Lightbox (on click)**:
- Large product image
- Upcharge info (size/color premiums)
- "Select" button

**On Select**:
1. Product instance saved to member's Personal Library (for reuse)
2. Wizard advances to Step 2

### Step 2: QR Type Selection ("Pick Your Poison")
Choose QR experience type:

- **QR Basic** (Blue) - Simple URL redirect
- **QR Plus** (Purple) - Styled landing page with header/footer
- **QR Canvas** (Emerald) - Image background landing page
- **QR Play** (Rose) - Video landing page

### Step 3: Customize
Different modules render based on QR type:

**QR Basic**: 
- URL input only

**QR Plus**:
- URL input
- TextStyleEditor (header/footer text)

**QR Canvas**:
- URL input
- TextStyleEditor (header/footer)
- BackgroundModule with BackgroundLibraryPicker
- Text overlay on background (TextStyleEditor again)

**QR Play**:
- URL input
- TextStyleEditor (header/footer)
- VideoModule (upload or URL)

### Step 4: Preview
- GraphicPreviewView showing product + QR graphic
- QR type badge
- Edit button to go back

### Step 5: Publish
- Channel selection (My Channels)
- Publish button
- Product saved to member's personal library

## Two-Tier Library System

### Common Library (Admin-curated)
- Firestore: `commonLibrary` collection
- Backgrounds, templates, graphics curated by admin
- Read-only for members

### Personal Library (Member-owned)
- Firestore: `memberLibrary` collection
- Member's own uploads and saved product instances
- Scoped by `memberId`

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

### Card Display for Members
Show members their potential earnings on each product card:
```
Product: $10 base
+ Your graphic: $4
= Retail: $14
🎉 You earn: $1.00
```

## Server Requirements by QR Type

| QR Type | Server Required? | Notes |
|---------|------------------|-------|
| **QR Basic** | No | Simple URL redirect |
| **QR Plus** | No | Simple URL redirect with styling |
| **QR Canvas** | Yes | Server-side landing page with image |
| **QR Play** | Yes | Server-side landing page with video |

## Earnings Calculation
- Members get **25% profit share** on sales
- Displayed on each product card as earnings badge
- Example: Product sells for $24, cost is $16, profit = $8, member gets $2

## Landing Page URLs
- QR Canvas and QR Play build URLs under `/m/member/[slug]`
- Stateless, time-based resolution for QR Dynamics

## API Endpoints
- `GET /api/members/allowed-products` - Products from common library
- `GET /api/common-library` - Common library assets
- `GET/POST /api/members/:memberId/personal-library` - Personal library CRUD
- `GET/POST /api/members/:memberId/channels` - Member channels
- `GET /api/members/:memberId/earnings` - Earnings dashboard

## Design Patterns
- Use **SkinGridViewer** for all grids
- Use **CardSkin/DetailSkin** pattern for items
- Use **SkinActions.onSelect** for selection callbacks
- Build once, compose as needed
