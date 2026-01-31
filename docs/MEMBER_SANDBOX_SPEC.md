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
