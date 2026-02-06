# QR Gear Methodology

This document captures the core design principles and architectural decisions for QR Gear. Updates are dated to track evolution.

---

## Changelog

| Date | Update |
|------|--------|
| 2026-02-06 | Added QR States (Static, Fixed, Living) and QR Compose vs QR Dynamics distinction (Sections 3a, 3b) |
| 2026-02-05 | Added Member Library Storage Paths (Section 7) |
| 2026-02-04 | Initial methodology document created |

---

## Core Principles

### 1. Packet as Single Source of Truth
**Established: 2026-02-04**

The packet is the central data structure that contains everything about a member's creation:
- All graphics (qrGraphic, productGraphic, urlGraphic, mockups)
- All styling (headerStyle, footerStyle, text positioning)
- Product configuration (color, size, placements)
- Status and metadata

When a member "saves to library," they save the entire packet. The library entry references the packet, and the UI pulls whichever assets are needed based on context. No duplication.

### 2. Wizard Serves Dual Purpose
**Established: 2026-02-04**

The wizard flow is not just for preview - it creates commerce-ready assets:
- Color + Size selection generates the default selling image
- The mockup shown in the wizard becomes the storefront product image
- One flow accomplishes both member preview AND store asset creation

### 3. Progressive Tier Architecture
**Established: 2026-02-04**
**Updated: 2026-02-06** - Added QR Compose tier and QR States model

Product tiers build on each other. Each tier inherits from the previous and adds capabilities:

| Tier | Fork Point | Adds |
|------|------------|------|
| QR Basic | Step 8 | QR code on product |
| QR Plus | Step 12 | Header/footer text on product |
| QR Canvas | Step 13+ | Custom landing page with urlGraphic |
| QR Play | Step 13+ | Video surface with QR overlay |
| QR Compose | Step 13+ | Rotating collection of Canvas + Play items |

The packet grows with each tier - QR Basic has fewer fields, QR Compose has the most.

### 3a. QR States
**Established: 2026-02-06**

Every QR product exists in one of three states based on what happens when someone scans it:

| State | Behavior | Tiers |
|-------|----------|-------|
| **Static** | Always goes to the same destination. Set once, never changes. | QR Basic, QR Plus |
| **Fixed** | Goes to a single rich destination (image landing page or video player). The content is set by the creator. | QR Canvas, QR Play |
| **Living** | Destination rotates through a collection of content over time. Changes automatically on a schedule. | QR Compose (creator-built), QR Dynamics (buyer-controlled) |

#### State: Static
The QR code resolves to a permanent, unchanging destination. Once created, the destination never changes. No hosting required - the QR encodes the destination directly.

- **QR Basic**: The QR code itself IS the product. It encodes a URL, text, phone number, email, WiFi credentials, or vCard. What you scan is what you get. No landing page, no rich content. The value is the QR printed on a physical product (shirt, mug, etc.) with optional graphic sizing and placement choices. No ongoing cost beyond the product purchase.

- **QR Plus**: Same as Basic but the productGraphic includes header text and/or footer text composed around the QR code. The text is baked into the graphic - it's not dynamic. Member earns $0.50/line of text. Still a permanent destination, still no hosting needed. The added value is the professional-looking composed graphic (header + QR + footer) printed on the product.

#### State: Fixed
The QR code resolves to a single rich destination that the creator sets. The content is richer than Static (a full-screen image experience or video player), but it does not change over time. Requires hosting because the destination is a served page, not an encoded URL.

- **QR Canvas**: The QR links to a landing page that displays a full-screen background image (the urlGraphic). The creator picks or uploads a background, optionally crops it to 9:16, and adds text overlays (title, description) with positioning, color, size, and font choices. When someone scans the QR, they see this custom image landing page on their phone. The physical product gets the productGraphic (header + QR + footer). Requires a hosting term because the landing page is served from QR Gear infrastructure.

- **QR Play**: The QR links to a video player page. The creator uploads or selects a video, and when someone scans the QR, they see the video play on their phone. The physical product gets the same productGraphic treatment as Canvas. Requires a hosting term because the video player page is served from QR Gear infrastructure.

#### State: Living
The QR code resolves to a destination that changes over time. Instead of pointing to one thing forever, it cycles through a playlist of content on a schedule. This is the premium tier - the QR is alive.

- **QR Compose** (Creator/Member tool): The member builds a rotation playlist from their already-published Canvas and Play packets. Each slot in the playlist has a duration (how long it stays active before rotating to the next). The QR on the physical product points to a resolver URL that determines which slot is currently active based on the elapsed time. The member sets it up; the system runs it automatically. Requires a hosting term (1 year / 3 year / 5 year) because the resolver engine runs continuously.

- **QR Dynamics** (Buyer/End-user tool - FUTURE): After a buyer purchases a Compose product, they get access to a dashboard where they can manage their instance. They can swap content in and out, reorder the rotation, change durations, and renew their hosting term. From the buyer's perspective, their QR is a living thing they control - digital real estate they own for the length of their term. This is the post-purchase experience; Compose is the pre-sale creation tool.

### 3b. QR Compose vs QR Dynamics
**Established: 2026-02-06**

Two distinct products serve different roles in the Living state:

**QR Compose** (Creator/Member tool)
- Available inside the Members Sandbox wizard
- Member selects a physical product (shirt, mug, etc.) and configures it through the same flow as QR Plus
- At the fork, member chooses "QR Compose" instead of Canvas/Play
- Member picks from their already-published Canvas and Play packets to build a rotation playlist
- Member sets duration per slot (how long each item stays active)
- Member orders the playlist
- Member selects a hosting term (1 year / 3 year / 5 year)
- Result: a sellable product with a QR that resolves through a rotation engine

**QR Dynamics** (Buyer/End-user tool - FUTURE)
- Available to buyers after purchasing a Compose product
- Buyer gets a dashboard to manage their purchased instance
- Buyer can swap content, reorder rotation, change durations
- Buyer can renew hosting when term expires
- The QR is "living" from the buyer's perspective - they control it post-purchase

**Summary**: Compose = backstage production tool (member creates). Dynamics = front-of-house remote control (buyer manages).

### 4. Fork Architecture
**Established: 2026-02-04**

The wizard uses shared steps, then branches based on product type:
- Steps 1-7: Shared by all tiers (product, color, size, type, placements, graphic size)
- Step 8: QR Basic forks here (if user says "No" to header/footer)
- Steps 8-12: Shared by Plus/Canvas/Play
- Step 12: QR Plus forks here
- Step 13+: Canvas and Play continue with their specific flows

This avoids code duplication while allowing tier-specific experiences.

### 5. Image Naming Convention (Canonical)
**Established: 2026-02-04**

Consistent naming across the codebase:
- `productGraphic` = Graphic on the physical item (shirt, cup)
- `urlGraphic` = What shows on phone when QR is scanned (landing page background)
- `qrGraphic` = The actual QR code image
- `qrBasicMockup` = Product mockup for QR Basic tier
- `qrPlusMockup` = Product mockup for QR Plus tier

### 6. Status Lifecycle
**Established: 2026-02-04**

Packets have a status that tracks their lifecycle:
- `building` - Wizard in progress, not complete
- `draft` - Started but paused, can resume
- `saved` - Complete and in member's library
- `published` - Live and available for sale

### 7. Member Library Storage Paths
**Established: 2026-02-05**

Each member has isolated storage in Firebase:
- `members/{memberId}/library/backgrounds` - Original uploaded images
- `members/{memberId}/library/cropped` - 9:16 cropped versions for landing pages
- `members/{memberId}/library/videos` - Video uploads for QR Play

**Crop Flow**: When a member crops an image:
1. Original saves to `/library/backgrounds`
2. Cropped version saves to `/library/cropped`

**Firestore Collection**: `memberLibrary` with fields:
- `memberId`, `assetType`, `mediaType`, `name`, `fileName`, `storageUrl`, `publicUrl`
- `isCropped: boolean` - true for cropped images
- `originalAssetId` - links cropped back to original

**API Endpoints**:
- `GET /api/members/:memberId/library` - Fetch member's library
- `POST /api/members/:memberId/library/upload` - Upload asset
- `GET /api/member-files/:memberId/:filename` - Proxy to serve files

---

## Future Considerations

### Drafts on Dashboard
Members should see their drafts (status: 'draft') on their main dashboard, not hidden in the wizard. Click to resume where they left off.

### Buyer Customizer (Future)
A completely separate buyer-first experience. Uses different language: "Customize" not "Build", "Preview" not "Publish". See replit.md for full spec.

---

## Notes

This is an evolving platform at its infant stage. Expect changes. Date all updates.
