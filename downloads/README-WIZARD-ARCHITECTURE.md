# QR Gear - Members Wizard Architecture Guide

## Purpose
This README provides context for understanding the QR Gear members wizard, specifically to help design a new "Rotation Mode" step for QR Compose.

---

## File Overview

| File | Purpose |
|------|---------|
| `MembersPage.tsx` | Main wizard - all steps, UI, navigation, state management (~9900 lines) |
| `memberPacketService.ts` | Creates Canvas packets (static image QR experiences) |
| `memberVideoService.ts` | Creates Play packets (video QR experiences) |
| `test-canvas-packet.tsx` | Canvas packet test/preview page |
| `test-qr-play.tsx` | QR Play test/preview page |
| `routes.ts` | All server API endpoints including member, packet, compose, mockup |
| `content-upload-service.ts` | Handles file uploads to Firebase Storage |
| `schema.ts` | Drizzle ORM data models and types |
| `METHODOLOGY.md` | Project methodology and design philosophy |
| `replit.md` | Full system reference guide with architecture details |

---

## The Five QR Tiers

1. **QR Basic** - Bare QR code, no text, links to a URL or displays text
2. **QR Plus** - QR code with header/footer text on the product graphic
3. **QR Canvas** - QR links to a custom image landing page (static background)
4. **QR Play** - QR links to a video player experience
5. **QR Compose** - Rotating playlist of Canvas + Play items (minimum 2 required)

---

## Wizard Flow Architecture

### Shared Steps (All Tiers)
Steps 1-9 are shared across all tiers:

1. `channel` - Pick or create a channel
2. `product` - Choose product type (shirt, mug, etc.)
3. `product-congrats` - Earnings preview
4. `color` - Pick product color
5. `size` - Pick product size
6. `type` - Placement type
7. `placement-count` - How many graphic placements
8. `graphic-size` - Size of graphic (small/medium/large), loops per placement
9. `generate` - "Add header or footer?" fork point

### Fork at Step 9
- **"Yes, add text"** → sets `qrType='qr-plus'`, goes to `text-choice` (step 10)
  - Steps 10-14: text-choice → text-edit-header/footer → placement-config → shirt-preview
  - Then arrives at `canvas-fork` (step 15)
- **"No, just the QR"** → skips steps 10-14, jumps directly to `canvas-fork` (step 15)
  - (Previously this off-ramped to QR Basic - recently fixed to always reach canvas-fork)

### Fork at Canvas-Fork (Step 15)
Four options:
- **QR Plus (Skip)** → generates mockup with header/footer graphic → qr-plus-mockup → save → confirm
- **QR Canvas** → url-explainer → source-choice → background pick → details → preview → mockup → publish → confirm
- **QR Play** → video-source → preview → mockup → publish → save-choice
- **QR Compose** → compose-pick-items → compose-durations → compose-order → compose-hosting → compose-mockup → compose-preview → compose-publish → compose-confirm

---

## Step Arrays (Defined at top of MembersPage.tsx)

Each tier has its own step array that defines the step sequence:
- `SIMPLE_WIZARD_STEPS` - Default/QR Plus flow
- `QR_BASIC_STEPS` - QR Basic flow
- `QR_PLUS_STEPS` - QR Plus flow
- `QR_PLAY_STEPS` - QR Play flow
- `QR_COMPOSE_STEPS` - QR Compose flow (lines 253-277)

The step counter uses these arrays to show "Step X of Y" and progress percentage.

---

## QR Compose - Current Steps (lines 253-277)

```
QR_COMPOSE_STEPS:
 1. channel
 2. product
 3. product-congrats
 4. color
 5. size
 6. type
 7. placement-count
 8. graphic-size
 9. generate (Header/Footer?)
10. text-choice (Layout)
11. text-edit-header
12. text-edit-footer
13. placement-config
14. shirt-preview
15. canvas-fork (QR Experience)
16. compose-pick-items (Pick Items)
17. compose-durations (Durations)
18. compose-order (Order)
19. compose-hosting (Hosting)
20. compose-mockup (Product Preview)
21. compose-preview (Summary)
22. compose-publish (Publish)
23. compose-confirm (Done)
```

---

## QR Compose - Current Implementation Details

### ComposePickItemsStep (line ~4253)
- Fetches published Canvas and Play items from the member's catalog
- Requires minimum 2 items selected
- Shows thumbnails with toggle selection
- Has enlarged image overlay with "Select" button

### ComposeDurationsStep (line ~4398)
- Currently TIME-BASED ONLY
- Each item gets a duration dropdown (preset values)
- Shows total cycle time
- Uses `COMPOSE_DURATION_PRESETS` for options

### ComposeOrderStep (line ~4447)
- Drag/arrange items in playlist sequence
- Move up/down/remove buttons
- Shows numbered order

### ComposeHostingStep (line ~4502)
- Choose hosting term: 1-year ($4.99/yr), 3-year ($3.99/yr), 5-year ($2.99/yr)

### ComposeMockupStep / ComposePreviewStep (line ~4559)
- Shows product mockup and summary of all settings

### ComposePublishStep (line ~4630)
- Final publish confirmation

---

## Proposed Change: Rotation Mode Step

### The Problem
Currently QR Compose only supports time-based rotation. We want to also support per-scan rotation.

### Proposed New Step: "Rotation Mode" (between pick-items and durations)
Insert a new step after `compose-pick-items` (step 16) that asks:

**Option A: "Auto-Rotate"**
- Items cycle automatically on a timer
- Leads to the existing `compose-durations` step
- Good for: digital signage, passive displays, merchandise

**Option B: "Fresh Each Scan"**
- Each QR scan shows the next item in sequence
- SKIPS the duration step (durations don't apply)
- Goes directly to `compose-order` step (order matters more here)
- Good for: promotional merchandise, events, collectible experiences

### Future Enhancements (not for v1)
- Random mode (each scan shows random item)
- Weighted mode (some items appear more often - rarity system)
- These could be sub-options under "Fresh Each Scan" later

### Data Model Impact
The compose instance needs a new field to store the rotation mode:
- `rotationMode: 'time-based' | 'per-scan'`
- This should be stored in the Firestore `qr_dynamics_instances` document
- The resolver at `/qr/d/:instanceId` needs to check this field to determine behavior

### Navigation Logic Changes
- New step ID: `compose-rotation-mode`
- After pick-items → compose-rotation-mode
- If auto-rotate → compose-durations → compose-order → ...
- If per-scan → compose-order (skip durations) → compose-hosting → ...
- Back from compose-rotation-mode → compose-pick-items
- Back from compose-durations → compose-rotation-mode
- Back from compose-order → compose-rotation-mode (if per-scan) or compose-durations (if auto-rotate)

---

## Key State Variables (QR Compose)

```typescript
// Compose state (defined around line 600-650 in MembersPage.tsx)
composeSelectedItems: Array<{
  packetId: string;
  name: string;
  thumbnailUrl: string;
  type: 'qr-canvas' | 'qr-play';
  durationSeconds: number;
  order: number;
}>
composeHostingTerm: '1-year' | '3-year' | '5-year'
composeInstanceId: string | null
publishedCanvasPlayItems: any[]
isLoadingPublishedItems: boolean
```

### New state needed:
```typescript
composeRotationMode: 'time-based' | 'per-scan'
```

---

## Navigation Functions

- `handleSimpleNext` (line ~7761) - Forward navigation, handles all step transitions
- `handleSimpleBack` (line ~8079) - Back navigation
- Both use the `stepsArray` selected based on `qrType` to determine current position

---

## Known Issues to Fix Alongside This

1. **Step counter resets to 0 on Compose steps** - The progress bar component (line ~476) doesn't check for `isQRComposeStep`, so it falls through to `SIMPLE_WIZARD_STEPS` where compose steps don't exist, resulting in index -1 (displays as "Step 0")

---

## Design Constraints

- All steps must fit on one mobile screen without scrolling
- WYSIWYG: Preview must match final output exactly
- Member earnings: $0.50/line text earnings
- Packet ID created early (step 2) for mockup generation
- QR Compose requires minimum 2 published Canvas/Play items
- Never remove existing features without explicit permission
- Never change working code without explicit permission
