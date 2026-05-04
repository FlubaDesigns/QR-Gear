# QR Gear Methodology

> **Agent reference:** The canonical system reference for this project is [`replit.md`](./replit.md). It contains the full architecture, API routes, deploy commands, standing rules, naming standards, and session rules. Always read it first.

This document captures the core design principles and architectural decisions for QR Gear. Updates are dated to track evolution.

---

## Changelog

| Date | Update |
|------|--------|
| 2026-04-23 | Added Builder→Storefront 5-Block Display Contract (Section 16) and Naming Standards reference (Section 17) |
| 2026-04-09 | Added Collections sub-level within channels (Section 14) and Packet Auto-Save / Builder State Persistence (Section 15) |
| 2026-03-07 | Added Four Store Types architecture — split "external" into marketplace + partner (Section 13) |
| 2026-02-10 | Added Public Wizard Stripe Checkout & Post-Sale Flow (Section 12) |
| 2026-02-07 | Added QR Architecture Decision: Two-Tier QR System (Section 11) |
| 2026-02-07 | Added Graceful Intro + Unlock Flow for Moments → Compose → Platform (Section 9) |
| 2026-02-07 | Added Portable Moments & Multi-Product Platform concept (Section 10) |
| 2026-02-07 | Added 5-Layer Distribution Architecture (Section 8) |
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

**Prerequisites**: Member must have at least **2 published Canvas or Play packets** before QR Compose unlocks. A rotation of 1 item is just a regular QR - you need a minimum of 2 to make it a real rotation.

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

### 8. Five-Layer Distribution Architecture
**Established: 2026-02-07**

QR Gear is not one product — it's one engine with five distribution layers. Every layer points back to the same core system (packets, instances, ownership, dynamic control).

#### Layer 1 — Member / Creator (Affiliate Engine)
- Members create products (shirts, caps, etc.)
- They define default experiences via QR Compose
- They distribute on their own social platforms
- They earn 25%
- They are the marketing force
- **Purpose**: External reach

#### Layer 2 — Direct Buyer / Buyer-Creator (House Revenue Engine)
- A user lands directly on QR Gear
- They customize a product themselves
- They buy immediately
- QR Gear keeps 100%
- No membership required up front
- **Purpose**: Direct monetization

#### Layer 3 — Owner / QR Dynamic (Retention Engine)
- Buyer claims the product
- Gets an instance
- Uses QR Dynamic to control content
- Can rotate images/video/docs
- Can chain owned items
- May subscribe for ongoing control
- **Purpose**: Long-term engagement

#### Layer 4 — API / Embedded Mini-Stores (Network Engine)
- QR Gear exposes an API + widget
- Embed mini stores per user / per site
- Works on Kingdom Connects, polling site, etc.
- Creates inbound traffic
- Cross-site discovery
- **Purpose**: Ecosystem expansion

#### Layer 5 — External Marketplaces (Acquisition Engine)
- Sell physical products on Etsy, eBay, Amazon, etc.
- QR routes buyers back to the QR Gear system
- Marketplaces become lead sources
- Ownership and Dynamic control happen on the QR Gear platform
- **Purpose**: Borrowed traffic converted to owned relationships

#### The Unifying Principle

No matter where someone enters — social post, QR Gear homepage, embedded store, marketplace listing — they end up interacting with: packets, instances, ownership, and dynamic control.

This works because of one critical design decision: **physical products are dumb, digital behavior is smart**. The QR code on a shirt doesn't change, but what it resolves to is controlled by the digital layer. This allows infinite entry points, consistent ownership, no reprints, no branching data models, and no platform lock-in.

Everything reduces to one question: *"Which digital experience do we serve right now?"*

#### Growth Flywheel

The layers feed each other:
- Buyers become owners (Layer 2 → Layer 3)
- Owners become members (Layer 3 → Layer 1)
- Members become distributors (Layer 1 → Layer 5)
- Other sites become traffic sources (Layer 4 → Layer 2)

Monetization happens at multiple points without conflict. The system scales out, not up.

#### Strategic Priority Question

When choosing what to build next, the question is not "how to build more" but: **Which layer do you want to make money from first, without slowing the others?** That decision determines what to polish, what to leave rough, and what can wait.

### 9. Graceful Intro + Unlock Flow — Moments → Compose → Platform
**Established: 2026-02-07**

#### Goal
Introduce QR Compose early (so users understand the power), but make it feel natural and emotional when it becomes available, by reframing the user's progress as "building a platform" (a living QR-driven digital surface) rather than "adding features."

This must work across the full QR Gear scope:
- Members (creators/affiliates) building to SELL
- Direct buyers building to BUY (100% house profit)
- Owners claiming items and controlling their instance (QR Dynamic)
- API embedded mini-stores on other sites (KC, future polling, etc.)
- Marketplace acquisition (Etsy/eBay/Amazon traffic → owned platform)

#### Key Philosophy
- Physical product is the fixed "doorway"
- The QR code is the doorway
- The digital layer behind it is the living surface
- "MOMENTS" are what the doorway can show
- COMPOSE is how MOMENTS change over time
- DYNAMIC is how OWNERS control MOMENTS post-purchase

Therefore: Users are not "adding assets." Users are building a living platform attached to a product.

#### Terminology (Locked)

**User-facing:**
- Moment = one unit of what shows when scanned (image/video/doc)
- Compose = rotating/scheduling moments over time
- Platform = the living QR-driven digital surface behind the product

**Avoid user-facing (internal only):**
- packet, asset, instance, channel, collection, wizard

**Internal truth (do not show users):**
- Canvas Moment = QR Canvas packet
- Play Moment = QR Play packet
- Doc Moment = QR Doc packet (future)
- Compose = orchestration rules referencing existing moments
- Dynamic = owner-controlled orchestration + storage/subscription

#### Part 1 — Early Intro (Compose Is Never "Hidden")

**Where:** Early in the wizard (Step 4 overview / full ladder step)

**Purpose:**
- Teach capability ceiling (what is possible)
- Set user intention BEFORE they create moments
- Give them a "destination" to work toward

**Implementation:**
Step 4 shows the "journey ladder":
1. QR Basic (off-ramp)
2. QR Plus (off-ramp)
3. Moments (create image/video/doc moments)
4. Compose (rotate/schedule moments)
5. (future: Dynamic shown as "Owner Control" AFTER purchase/claim)

Compose is visible on Step 4 ALWAYS. Compose is explained ALWAYS. Compose is only "actionable" when ready.

**Compose tile shown in Step 4:**
- Label: "QR Compose"
- Subtext: "Show different moments over time"
- Requirement badge: "Requires 2+ moments"
- State: If momentsCount < 2: visually gray/disabled + clickable for explanation. If momentsCount >= 2: fully active

#### Part 2 — "Click Compose Too Early" Education Loop (No Dead End)

**Problem:** Users will see Compose and WANT it immediately. We cannot punish curiosity with a hard lock.

**Solution:** If user clicks Compose before 2+ moments exist, show a dedicated Compose Explainer Card (NOT an error), then return ("bounce back") to the prior card to continue building moments.

**Compose Explainer Card (triggered on early click):**
- Title: "QR Compose — Moments Over Time"
- Body: "QR Compose lets one QR show different moments based on: time of day, scan order, schedule/sequence. Example: Morning → Welcome image moment, Lunch → Menu document moment, Evening → Drone footage video moment. To use QR Compose, you'll need at least TWO moments."
- Primary CTA: [ Create another moment ] — returns user to Moments selection/creation step
- Secondary: [ Back ]

**Benefits:** No confusion, no frustration. The system teaches the user what to do next. Compose feels like "the goal," not "a hidden feature."

#### Part 3 — The Graceful Transition Moment (2+ Moments = Platform)

When a user has 2+ moments, they are no longer "creating content." They are building a PLATFORM: a living QR-driven digital surface behind a fixed QR doorway.

When momentsCount reaches 2 (or more): Do NOT silently unlock Compose. Introduce a "Platform Acknowledgement Card" ONCE. Reframe what they are doing in proud, meaningful language.

**Platform Acknowledgement Card (show once when momentsCount >= 2):**
- Title: "You're building a living QR platform"
- Body: "Your QR can now show different moments over time. This turns your QR into a digital surface you control. With QR Compose, you can: rotate moments (each scan shows the next), schedule moments (breakfast / lunch / dinner), run sequences (12 days of Christmas, 30 days of prayer). You're not just making a shirt. You're building a living platform attached to it."
- Status line: "You currently have: 4 moments"
- Primary CTA: [ Continue building my platform ]
- Secondary CTA: [ Manage moments ]
- Optional tertiary: [ What is QR Compose? ] (opens explainer again)

This card appears only once per project / per user session. It becomes the bridge between: "I made a thing" → "I control a system."

#### Part 4 — Compose Unlock Behavior (Payoff)

Once momentsCount >= 2: Compose tile becomes active. Clicking Compose goes to Compose Setup (no explainer).

**Compose Setup should feel like "settings," not "creation."** Compose is not a new product type. Compose is orchestration rules applied to existing moments.

**Compose Setup Steps:**
1. Choose moments (select 2+)
2. Choose how it changes: Rotate by scan (default), Rotate by time, Rotate by schedule
3. Preview (simulate 3-5 scans or time windows)
4. Confirm / Save (Compose becomes active behavior for the QR)

**Copy rules:** Always call them "moments." Never say "packets." Never say "publish." Use: "Save rotation," "Activate schedule," "Turn on Compose."

#### Part 5 — How This Supports Full Scope

**A) Member (Creator/Affiliate selling):** They need Compose power explained EARLY because they're building campaigns (12 Days of Christmas, 30 Days of Prayer, restaurant daily schedule). Seeing Compose early shapes how they build moments intentionally.

**B) Direct Buyer (100% house profit):** Buyer starts customizing without membership friction. When they reach 2+ moments, the platform card reframes: "This is yours; it can live and evolve."

**C) Owner (Post-purchase control via QR Dynamic):** The "platform" framing prepares owners to understand Dynamic later. Compose = member control, Dynamic = owner control (after claim).

**D) API / Mini-stores on other sites:** Same wizard can live embedded. The "platform" language fits everywhere.

**E) Marketplaces (Etsy/eBay/Amazon):** Marketplace listing drives buyer to scan/claim → platform begins. The "platform" framing makes the product feel premium.

#### Part 6 — Final UX Rules (Non-Negotiable)

1. Compose is always explained early (Step 4)
2. Compose is visible even when locked
3. Locked Compose is clickable → explainer card (not error)
4. Explainer card returns user to build moments (bounce-back)
5. When momentsCount >= 2, show Platform Acknowledgement Card ONCE
6. Compose unlock should feel like payoff, not a new confusing mode
7. "Moments" is the only user-facing unit term
8. Avoid technical nouns in user UI (packet/instance/channel/etc.)
9. The whole system is framed as building a living QR platform behind a fixed QR doorway

#### One-Line User Truth
"Your product's QR can show different moments over time — you're building a living platform people can scan."

#### Success Criteria
If a first-time member or buyer: understands Compose exists early, intentionally creates multiple moments to reach it, feels "platform ownership" at 2+ moments, can enable Compose without confusion, and wants to return to update moments later — then the wizard is doing its job.

### 10. Portable Moments & Multi-Product Platform
**Established: 2026-02-07**

This is the FINAL architectural and marketing concept that completes QR Gear. This is no longer "QR on products." This is a portable digital-moment platform where physical products become interchangeable doorways into an owned, living digital layer.

#### Core Reframe (The Breakthrough)

- Products are NOT the value
- Moments are the value
- Products are doorways to moments

A QR code does NOT point directly to content. It points to a bridge. The bridge decides which moment to show.

Moments are: Owned by the user, Portable, Reassignable, Schedulable, Chainable, Reusable across products.

#### Ownership Model (Clean & Future-Proof)

User owns:
- Moments (digital)
- Products (physical)
- Connections between them (dynamic)

Conceptual structure:
```
User
 ├── Moments (owned, portable)
 ├── Products (owned doorways)
 │     └── QR Mount (per product)
 │           └── Bridge → Moment (dynamic reference)
```

Key rule: A product NEVER permanently contains a moment. A product REFERENCES a moment through a bridge. Bridges can be changed anytime.

#### Why This Drives More Sales

Each product purchased gives the user another doorway, another surface, another mount point. But moments are reusable.

Value proposition: "Buy more products. Expand your platform." NOT: "Buy the same thing again."

Examples:
- Shirt + Mug + Hat → all show the same holiday moment
- Later → reassign moments differently
- No reprint, no waste, no friction

This naturally encourages: Multiple purchases, collecting, gifting, long-term engagement.

#### Moment Bridging

Internally: bridge logic. Externally: simple choice.

User-facing phrasing: "Where should this product point right now?" That's it. No technical explanation needed.

#### Wizard Integration

**Early (Step 4 — Capability Overview):** Show that products can show moments, moments can change over time, moments can move between products. Explained, not executed.

**Mid (Moment Creation):** Users create moments (image/video/doc). They are told: "These moments belong to you."

**Platform Transition (2+ Moments):** Show Platform Acknowledgement Card ONCE. Reframes behavior from "creating content" to "building a platform."

**Compose Unlock:** Rotate, schedule, sequence moments. Compose applies to moments, NOT products.

**Connect Moments to Products (Final wizard step):**
- Title: "Connect moments to your products"
- Body: "Each product you own can show any moment. You can change this anytime."
- UI: List of owned products, each with dropdown "Show this moment…" and option to follow Compose schedule or override
- Reassurance: "Nothing is permanent. You can change this later."

#### Post-Purchase / QR Dynamic (Owner App)

QR Dynamic becomes the REMOTE CONTROL. From the app, owners can:
- Move moments between products
- Change which moment a product shows
- Temporarily override schedules
- Sync multiple products together
- Chain products into experiences

Example: Shirt + Mug mirror the same moment. Hat shows a different one. Later, swap all three instantly. This JUSTIFIES the app and subscription.

#### Subscription Justification (Natural, Not Pushy)

**Free:** Fixed moment connections, limited changes.

**Paid:** Unlimited reassignment, advanced scheduling, multi-product sync, history/rollback, long-term storage.

User thinks: "I'm paying to control my platform." NOT: "I'm paying for QR hosting."

#### Marketplace & API Power

**Marketplaces (Etsy/Amazon/eBay):** Sell physical product → QR leads to claim page → buyer becomes owner → moments + platform activate post-sale.

**Embedded Stores (KC, Polling Site, Others):** Same wizard embedded → user builds moments → products attach → platform persists across sites. All roads lead back to: owned moments + owned control.

#### The One-Line Pitch
"QR Gear lets you own moments, move them between products, and control what people see when they scan — anytime."

#### Final Lock Statement

- Products are doorways
- Moments are portable
- Ownership is permanent
- Control evolves over time

QR Gear is not selling items. QR Gear is selling a living digital platform that happens to be attached to physical products.

### 11. QR Architecture Decision: Two-Tier QR System
**Established: 2026-02-07**

#### The Decision

Every QR code in the system falls into one of two tiers. This is a locked architectural decision.

#### Tier 1: QR Basic (Server-Independent)

- QR encodes **plain text or a direct external URL** — NOT a QR Gear bridge URL
- Zero server involvement from QR Gear after the product is printed
- No hosting cost, no resolver, no bridge
- Works offline if the content is text (phone displays it directly from the QR data)
- **Permanently dumb** — can never be stitched into Compose, Dynamic, or the platform
- QR Gear makes money on the product sale only — no ongoing relationship
- This is the genuine "just put a QR on a shirt" off-ramp

#### Tier 2: Platform QR (Server-Dependent, Bridge-Based)

- QR encodes a **bridge URL** on QR Gear's system (e.g., `qrgear.com/qr/abc123`)
- Bridge resolves to whatever the owner/system has configured
- Every QR from QR Plus upward gets a bridge from the moment it's created
- Bridge starts simple (QR Plus = just resolves header/footer text product) but can grow
- **Always stitchable** — can be upgraded to moments, Compose, Dynamic at any time
- Requires internet to scan (bridge URL must resolve)
- Hosting tiers apply (1-year, 3-year, 5-year)
- This is the entry point into the living platform

#### Why Two Tiers

- **Business reason:** QR Basic has zero ongoing server cost. Every bridge URL costs hosting/server resources forever. QR Basic is the free-tier product; platform QR is the revenue engine.
- **User reason:** Some users genuinely just want a QR code on a shirt. Forcing them into a server-dependent system for a simple use case is overengineering.
- **Architecture reason:** Clean separation. Server-independent QRs have zero system dependencies. Platform QRs have the full resolver/bridge/compose/dynamic stack.

#### The Bridge (Platform QR)

For every Platform QR (QR Plus and above):
1. A bridge URL is created at product creation time
2. The bridge initially resolves to the simplest version (QR Plus = text product, Canvas = image moment, Play = video moment)
3. The bridge can later be upgraded: add moments, enable Compose rotation, hand control to buyer via Dynamic
4. The physical product's QR never changes — the bridge handles everything
5. Registration/claim page can live at the bridge level for all platform products

#### Upgrade Path

QR Basic creates a natural upgrade path:
- Customer buys a QR Basic shirt → it works, it's simple, it's done
- Customer later wants to change what the QR shows → can't, it's dumb
- Customer buys a new platform-tier product → now they're in the ecosystem
- QR Basic is a taste of QR that drives people toward the full platform

#### Future Consideration (Parked)

Down the line, the Dynamic app could potentially recognize a "dumb" QR via order history matching and offer a physical upgrade (smart QR sticker). This is not architecturally planned — just noted as a possibility for the app phase.

#### Off-Ramp Placement in Wizard

- **QR Basic off-ramp:** Step 6 (Capability Overview). User sees the full ladder, chooses "I just want a basic QR," branches immediately into QR Basic mini-flow. Does NOT continue through text editing or canvas-fork.
- **QR Plus off-ramp:** Canvas-fork (after text editing, shirt preview). User says "No thanks, just the product with my text." This IS a platform QR — it gets a bridge, it's stitchable, hosting applies.

### 12. Public Wizard Stripe Checkout & Post-Sale Flow
**Established: 2026-02-10**

#### Overview

The Public Wizard (`/build`, `/creator`) is a conversion funnel where visitors build custom QR products without authentication. This section documents the full purchase lifecycle from product creation through item registration.

#### Phase 1 — Building (Temp Packet System)

1. Visitor arrives at `/build` (or `/creator`) and selects a product
2. System creates a `temp_packets` Firestore document to track their build
3. Each wizard step updates the packet: color, size, QR type, placements, graphic size, text
4. At preview steps, real Printful mockups are generated (composite artwork + Printful API)
5. Visitor sees running cost badge, cost summary breakdown, and real product mockups
6. Temp packets have a 24-hour TTL and `building` → `completed` status lifecycle

#### Phase 2 — Member Pitch (Pre-Checkout)

7. After the final mockup step, the Member Conversion Pitch is shown
8. Pitch message: "Turn This Into Income" — explains earning potential as a member
9. Two paths forward: "Become a Member" (sign up) or "Continue as Guest" (proceed to checkout)
10. Whether they sign up or skip, the purchase flow continues

#### Phase 3 — Guest Checkout (Option B — No Account Required)

11. `POST /api/public/checkout` — Creates Stripe checkout session from temp packet data (no auth)
12. Server reads temp packet from Firestore, extracts product details (name, color, size, price)
13. **Server-side price re-calculation** — Never trust client-side price. Server looks up the product's admin-configured retail price, applies size upcharges, placement costs, text line costs, and calculates the true total
14. Stripe session metadata includes `tempPacketId` for post-payment lookup
15. Stripe's checkout page collects buyer email (no pre-registration needed)
16. On cancellation/abandonment, temp packet remains with its 24-hour TTL

#### Phase 4 — Payment Verification & Order Creation

17. On successful payment, Stripe redirects to success page with `session_id`
18. `GET /api/public/checkout/verify/:sessionId` — Verifies payment (no auth)
19. Server retrieves Stripe session, confirms `payment_status === 'paid'`
20. **Temp-to-Real Packet Conversion**: Temp packet data is written to `productPackets` collection (legacy camelCase — grandfathered) as a permanent record
21. Order is created in Firestore with line items, Stripe session ID, buyer email
22. **Claim Code Generation**: Unique claim code (format: `QR-XXXX-XXXX`, e.g. `QR-7X4M-9K2P`) is generated and stored on the order
23. Confirmation email sent via NexusMail with: order details, claim code, scan instructions
24. Temp packet status set to `completed`

#### Phase 5 — Post-Sale Member Push (Two-Path Confirmation Screen)

25. After payment, buyer sees a two-path confirmation screen:

**Path A — "Become a Member":**
- Track your order's shipping status
- Keep your custom graphic permanently (stored on your account)
- Turn your design into income — sell it to others and earn 25%
- Manage your QR code destination (for Platform QR tiers)
- Leads to account creation → account linked to order via email match

**Path B — "No thanks, just my shirt":**
- Order confirmation with order number
- Claim code displayed prominently
- Instructions: "When your shirt arrives, scan the QR code and enter your claim code to activate it"
- Clean goodbye: "Your shirt is on its way! Check your email for your order details."
- Custom graphic retained for 30 days as incentive to sign up later
- After 30 days without account creation, graphic storage may be reclaimed

#### Phase 6 — Item Registration on First Scan (Claim Code System)

26. Buyer receives their physical product and scans the QR code
27. System detects this is tied to an order but no registered owner yet
28. "Register this item" screen appears, prompting for claim code
29. Buyer enters their claim code (from email or packing slip)
30. System validates: code matches order, code hasn't been used, order is paid
31. `buyer_instance` record is created in QR Dynamics, linking physical product to buyer's account
32. If buyer already has a QR Gear account (from Path A), instance links automatically
33. If buyer doesn't have an account, registration flow is triggered (email pre-filled from Stripe)
34. **Security**: Without the correct claim code, nobody can register someone else's item

#### Design Decisions

**Why Guest Checkout (Option B)?**
- Lowest friction to purchase — don't lose buyers by requiring account creation before they can pay
- Stripe handles email collection on the checkout page
- Account creation happens organically: either from the member pitch, the post-sale push, or at first-scan registration
- Even if they never create an account, we have their email from Stripe for follow-up

**Why Server-Side Price Validation?**
- Client-side prices can be manipulated via browser dev tools
- Server reads product configuration directly from the database at checkout time
- Applies same pricing logic as the admin pricing system: base price + size upcharge + placement costs + text line costs
- If client-side total doesn't match server calculation, server total wins

**Why Claim Codes?**
- Physical products can be gifted, resold, or shared — the person scanning may not be the buyer
- Claim code ensures only the legitimate purchaser (or someone they give the code to) can register the item
- Code is short and memorable (8 characters) for easy entry on mobile
- Code travels with the buyer via email — always recoverable

**Why Temp-to-Real Packet Conversion?**
- Temp packets are ephemeral (24-hour TTL) — not suitable for permanent product records
- On purchase, the packet becomes a real `product_packet` that persists indefinitely
- Real packet supports future features: fork-on-edit, library management, resale by members
- Clean separation: temp = building, real = owned

#### Technical Endpoints

| Endpoint | Method | Auth | Purpose |
|----------|--------|------|---------|
| `/api/public/packets` | POST | None | Create temp packet |
| `/api/public/packets/:id` | PUT | None | Update temp packet |
| `/api/public/packets/:id` | GET | None | Read temp packet |
| `/api/public/generate-mockup` | POST | None | Generate Printful mockup |
| `/api/public/checkout` | POST | None | Create Stripe checkout session from temp packet |
| `/api/public/checkout/verify/:sessionId` | GET | None | Verify payment, convert packet, create order |

#### Relationship to Five-Layer Architecture

This flow primarily serves **Layer 2 (Direct Buyer / Buyer-Creator)** — the house revenue engine where QR Gear keeps 100%. But it feeds the other layers:

- **Layer 2 → Layer 3**: Buyer claims item at first scan → becomes owner in QR Dynamics
- **Layer 2 → Layer 1**: Post-sale member push → buyer becomes member/creator/affiliate
- **Layer 3 → Revenue**: Owner may subscribe for advanced QR Dynamic features

The Growth Flywheel in action: visitor → builder → buyer → owner → member → distributor.

---

### 13. Four Store Types Architecture
**Established: 2026-03-07**

The previous "external" store type has been split to properly represent two fundamentally different business relationships. The platform now recognizes four store types:

#### Store Type 1 — Internal
- **What it is**: QR Gear's own storefront (e.g., USA 250 channel)
- **Who controls it**: QR Gear admin
- **Data flow**: Admin builds products → assigns to channels → shows on QR Gear homepage/shop pages
- **Revenue**: QR Gear keeps 100% (minus member earnings if applicable)
- **Distribution Layer**: Layer 2 (Direct Buyer / House Revenue Engine)

#### Store Type 2 — Marketplace
- **What it is**: Etsy, eBay, Amazon — external sales surfaces
- **Who controls it**: QR Gear admin pushes listings; marketplace handles checkout
- **Data flow**: Admin builds product → pushes listing to marketplace → order comes back → fulfills via Printify/Printful → QR on product routes buyer to QR Gear platform
- **Revenue**: QR Gear sells at marketplace price, pays marketplace fees, keeps the rest
- **Key features needed**: API credentials per marketplace, listing push, order pull, inventory sync, fee calculation, marketplace-specific pricing rules
- **Distribution Layer**: Layer 5 (External Marketplaces / Acquisition Engine)

#### Store Type 3 — Partner
- **What it is**: External sites that embed QR Gear's UX — they build channels, you enable the backend
- **Who controls it**: Partner manages their storefront; QR Gear provides the engine
- **Data flow**: Partner embeds widget/API → their customers use QR Gear tools → orders route through QR Gear fulfillment
- **Revenue**: Revenue sharing between QR Gear and partner
- **Key features needed**: Embed codes, channel permissions, branding controls, revenue sharing config
- **Distribution Layer**: Layer 4 (API / Embedded Mini-Stores / Network Engine)

#### Store Type 4 — Member
- **What it is**: Individual member stores created through the wizard system
- **Who controls it**: Members create via QR Compose wizards; admin sets catalog/pricing
- **Data flow**: Member picks blank → customizes → publishes → shares on social → earns 25% of profit on each sale
- **Revenue**: 25% to member creator, 75% to QR Gear (minus manufacturing)
- **Distribution Layer**: Layer 1 (Member / Creator / Affiliate Engine)

#### Why This Split Matters
"Marketplace" and "Partner" have completely different admin interfaces, API requirements, and data flows:
- **Marketplace** = you push OUT (listings, images, pricing) and pull IN (orders, payments)
- **Partner** = they pull IN (your UX, your tools) and you enable their surface

Trying to manage both through one "external" type would create a confusing admin experience and tangled data models.

---

### 14. Collections — Channel Sub-Grouping
**Established: 2026-04-09**

Collections provide a fourth level of product organization within the admin system.

**Hierarchy:** Role → Store → Channel → Collection

A Collection is a named group of products within a specific Channel. They allow the admin to organize inventory into logical product families or campaign groupings without creating separate channels.

**Admin UI:** The Store/Channel dropdown module includes a Collection selector that appears after a Channel is selected. The admin can:
- Select an existing collection for that channel
- Create a new collection on the fly with a name
- Leave it unset (products sit at the channel root level)

**Data:** Collections are stored as Firestore documents scoped to their parent Channel. A product is tagged to a collection at save time.

**Rule:** Collections are channel-scoped. A collection named "Summer 2026" in Channel A and a collection with the same name in Channel B are independent records. No cross-channel collection references.

**API pattern:** `GET /api/admin/collections?channelId=...` returns collection list. `POST /api/admin/collections` creates one.

---

### 15. Packet Auto-Save & Builder State Persistence
**Established: 2026-04-09**

#### The Problem
Previously, closing or navigating away from the builder lost all unsaved settings. Every admin session started from scratch — slider positions, text blocks, font choices, and background selections had to be re-entered.

#### The Solution
Every change the admin makes in the builder is automatically written back to the active packet (debounced 1.5 seconds after the last change). This makes the packet a live session checkpoint. Return to a packet and the builder restores exactly where you left off — X at 54%, Y at 30%, every setting intact.

#### What Is Saved
All `content` fields are persisted in a `builderSnapshot` object on the packet document:
- Landing page text blocks (position, font, color, size, stroke)
- Graphic zone text (header/footer position and style)
- Background reference
- QR position, size, and offset settings
- Area image settings
- All other `ContentData` fields

**Excluded from snapshot:** Non-serializable runtime fields (`playMediaFile: File`) and large data URLs (`playMediaPreview`) are stripped before writing.

#### When Auto-Save Activates
Auto-save begins only after a packet document exists. The flow:
1. Admin configures builder settings
2. Admin clicks "Create Packet"
3. Packet document is created in Firestore and `activePacketId` is set in BuilderContext
4. From that point forward, every content change triggers the 1.5s debounced PATCH to `builderSnapshot`

Before a packet exists, nothing is written. This avoids creating orphan snapshots.

#### Restoring State
When an admin opens an existing packet, the `builderSnapshot` is read and hydrated back into the builder context. All positions, text blocks, font choices, background — everything is restored exactly as left.

#### Intentional Fork ("Save as New Instance")
Auto-save updates the same packet continuously. When the admin wants a deliberate variation, a "save as new instance" action creates a new packet document seeded from the current `builderSnapshot`. The two packets are then independent — changes to one do not affect the other.

#### Design Rule
The packet is the working state, not just the output artifact. The admin should never lose work between sessions. The builder is stateful from the moment a packet is created.

---

### 16. Builder → Storefront Architecture (5-Block Display Contract)
**Established: 2026-04-23**

#### The Problem
The storefront was guessing how to render product options. Each product card had to infer whether to show color swatches, size pills, a quick-add button, or a browse-only view — from raw flat arrays with no semantic intent. This caused inconsistent rendering, impossible-to-predict card modes, and frontend logic that needed to be duplicated everywhere.

#### The Solution: Server-Side Translation Layer
A translation layer in `functions/src/routes/store-files.ts` transforms raw Firestore data into a structured display contract before sending it to the frontend. The frontend never guesses — it receives explicit intent.

#### Five Blocks of the Contract

Every product response now includes three structured fields:

**1. `options[]` — Structured display options**
Each option has:
- `type`: `"color"` or `"size"`
- `label`: Display name
- `values[]`: Array of `{ value, label, hex?, available, isDefault }`

Color values include resolved hex codes (from a 100+ color map covering all Bella+Canvas, Gildan, Next Level, and District variants) and availability flags. Contrast for swatch checkmarks is computed via WCAG luminance formula.

**2. `cardMode` — Explicit rendering intent**
- `browseOnly`: Product has both colors AND sizes — user must visit detail page to configure
- `quickAdd`: Product has only one dimension — can be added directly from the card

Rule: virtually all QR apparel is `browseOnly`.

**3. `media` — Hero image strategy**
- `mockupPriority`: The ordered list of image sources to try
- `heroStrategy`: `"mockupFirst"` — always prefer the QR composite mockup image over plain product photos

#### Color Map
The `COLOR_HEX_MAP` (100+ entries) lives in both backend (`store-files.ts`) and frontend (`shop-product.tsx`). It covers every POD brand color name to hex value. The `isLightColor()` function uses WCAG relative luminance to determine whether a white or black checkmark should appear on a color swatch.

#### Data Source
- `admin_catalog_instances` → `enabledColors`, `enabledSizes` (admin-configured)
- `productPackets` → `compositeUrl` (QR composite mockup image)
- No Firestore migration required — translation is 100% at query time

---

### 17. Naming Standards
**Established: 2026-04-23**

All naming conventions for files, folders, Firestore collections, fields, CSS classes, route paths, and TypeScript constructs are canonically defined in **`replit.md` → "Naming Standards — Project Law"**.

Key rule: the duplicate Firestore collections (`libraryAssets`/`library_assets`, `printfulProducts`/`printful_products`) were caused by skipping a naming check before creating new collections. All new collections use `snake_case`. Existing camelCase collections are grandfathered — do not rename them without explicit approval.

---

## Changelog (continued)

| Date | Update |
|------|--------|
| 2026-04-23 | Added Builder→Storefront 5-Block Display Contract (Section 16) |
| 2026-04-23 | Added Naming Standards reference (Section 17) |
| 2026-04-23 | Fixed collection name in Section 12: `product_packets` → `productPackets` (grandfathered camelCase) |
| 2026-05-02 | Added QRG Unified Identity Schema (Section 18) — replaces old QRG-CCC-SSS with three-layer blank code + owner sequence + barcode system |
| 2026-05-04 | Updated Section 18 — removed DDD (build/design number) from identity format. Design is a separate field/linked asset. New format: `QRG-[STNNN]-[C]-[IIIIII]-[SSCC]`. Layers renumbered: Blank→1, Source→2, Instance→3, Variant→4. |

---

### 18. QRG Unified Identity Schema
**Established: 2026-05-02 | Updated: 2026-05-04 — DDD removed**

Every owner instance and physical item in QR Gear is identified through one unified schema. Design/build data is explicitly NOT embedded — it lives as a separate Firestore field, linked asset, or QR payload.

#### The Full Schema

```
QRG - [STNNN] - [C] - [IIIIII] - [SSCC]
         ↑       ↑        ↑          ↑
       blank   source  instance  barcode only
```

#### Layer 1 — Blank Identity (`[STNNN]`, 5 digits)

Identifies the product blank (the physical garment type). Assigned once by QR Gear, never changes.

Structure: `S`=super-category (1–6), `T`=product-type (1–9), `NNN`=item number (101–999).

| Digit | Meaning |
|-------|---------|
| S=1, T=1, NNN=101 | First T-Shirt blank |
| S=1, T=2, NNN=101 | First Hoodie blank |
| S=2, T=1, NNN=101 | First Drinkware blank |

Firestore doc ID: `qrg_STNNN` (e.g. `qrg_11101`). Store-facing label: `QRG-11101`.

#### Layer 2 — Source (`[C]`, 1 letter)

Identifies the fulfillment channel that produced this item:

| Letter | Source |
|--------|--------|
| `I` | Internal — QR Gear admin-built |
| `P` | Printify |
| `F` | Printful |
| `E` | External — partner/embedded store |

#### Design Is Not Part of Identity

Design/colorway data is stored separately — as a Firestore field on the packet or product document, a linked design asset, or as payload content in the QR code. It is never appended to the QRG code itself.

Rationale: multiple designs may be applied to the same blank by the same source. Embedding a design number would cause identity to shift every time a new design is created, breaking QR codes, owner URLs, and barcode sequences.

#### Layer 3 — Owner Sequence (`[IIIIII]`, 6 digits)

Zero-padded integer assigned at purchase/claim time, unique per blank+source.

- Range: `000001` – `999999`
- Minted at claim moment — NOT at build or catalog creation time
- First owner of T-Shirt #101 via Printify → `QRG-11101-P-000001`

**Owner URL:**
```
qrgear.com/QRG-[STNNN]-[C]-[IIIIII]
```
Example: `qrgear.com/QRG-11101-I-000001`

The URL IS the Firestore document path and Firebase Storage key — no slug lookup table. The QR code on the physical product encodes this URL permanently. Owner content updates at this address; the shirt never needs a new QR code.

#### Layer 4 — Size + Color (`[SSCC]`, 4 digits — BARCODE ONLY)

**Never appears in the URL.** Barcode-only digits that identify the specific physical unit:

| Segment | Width | Values |
|---------|-------|--------|
| Size `[SS]` | 2 digits | 01=XXS, 02=XS, 03=S, 04=M, 05=L, 06=XL, 07=2XL, 08=3XL, 09=4XL, 10=5XL, 00=One Size |
| Color `[CC]` | 2 digits | 01=Black, 02=White, 03=Navy … full map in `shared/qrgCodes.ts` |

**Full barcode:**
```
QRG-[STNNN]-[C]-[IIIIII]-[SSCC]
```
Example: `QRG-11101-I-000001-0401` = T-Shirt #101 / Internal / Owner #1 / Medium / Black

Encoded as **Code 128**. Every garment ever produced has a globally unique barcode.

#### Summary — What Gets What

| Thing | Identifier | Example |
|-------|-----------|---------|
| Product/blank | `QRG-[STNNN]-[C]` | `QRG-11101-I` |
| Owner URL | `qrgear.com/QRG-[STNNN]-[C]-[IIIIII]` | `qrgear.com/QRG-11101-I-000001` |
| Physical barcode | `QRG-[STNNN]-[C]-[IIIIII]-[SSCC]` | `QRG-11101-I-000001-0401` |

#### Two Scan Experiences Per Product

| Code | Resolves To |
|------|-------------|
| QR code | `qrgear.com/QRG-I-101-001-000001` — customer-facing dynamic landing page |
| Barcode (Code 128) | `QRG-I-101-001-000001-402` — full item verification / admin lookup |

#### Why This Schema

- **Packet name = QRG ID**: no random slugs, every packet is permanently and meaningfully named
- **Permanent URLs**: the QR on a physical shirt is never broken by a rebuild or rename
- **Barcode-only size+color**: these digits belong only on the physical item, never pollute the URL or packet identity
- **Build sequence enables stitching**: all builds under `QRG-I-101` are the same blank — groupable, comparable, linkable
- **Self-describing at every level**: reading any QRG string tells you exactly what it is without a lookup
- **Scalable**: 999,999 owners × 999 builds × 99 blanks × expandable categories
- **Multi-brand ready**: `QRG/` is the namespace; `KC/`, `USA/` use the same resolver on the same platform

---

## Notes

This is an evolving platform at its infant stage. Expect changes. Date all updates.
