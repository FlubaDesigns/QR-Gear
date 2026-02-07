# QR Gear Methodology

This document captures the core design principles and architectural decisions for QR Gear. Updates are dated to track evolution.

---

## Changelog

| Date | Update |
|------|--------|
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

---

## Notes

This is an evolving platform at its infant stage. Expect changes. Date all updates.
