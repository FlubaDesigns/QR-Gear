# QR Gear — Methodology

## Store / Channel / Collection Hierarchy

The entire platform uses a three-tier data architecture: **Store → Channel → Collection**. The same structure applies everywhere, but who fills each slot changes depending on the context.

### Platform Store (QR Gear)

| Tier       | Value          | Example                          |
|------------|----------------|----------------------------------|
| Store      | QR Gear        | The brand / platform itself      |
| Channel    | USA 250        | A themed channel within QR Gear  |
| Collection | (user-defined) | Dynamics or Compose products     |

### External Brand (e.g. Kingdom Connects)

| Tier       | Value              | Example                              |
|------------|--------------------|--------------------------------------|
| Store      | Kingdom Connects   | The external brand                   |
| Channel    | User ID / Page ID  | Whoever owns the page or account     |
| Collection | (user-defined)     | Dynamics or Compose products         |

### Member

| Tier       | Value                    | Example                              |
|------------|--------------------------|--------------------------------------|
| Store      | Member ID                | The member themselves                |
| Channel    | (member-named)           | "My Favorite 25 Shirts" or similar   |
| Collection | (member-curated)         | Their curated Dynamics/Compose items |

### Key Rules

- The hierarchy is always Store → Channel → Collection, no exceptions.
- Collections are what can be turned into Dynamics or Compose products.
- The backend routing (`/shop/:storeType/:storeName`) maps to this hierarchy.
- Frontend labels (e.g. "Featured Stores", "Featured Channels") are marketing copy and can vary — the data model underneath always follows this three-tier pattern.

---

## Member Onboarding Flow

### Purpose

When a new member arrives at `/member` for the first time, they go through a one-time onboarding sequence that orients them, captures identity and preferences, then launches the Super Simple Wizard. The system gets quieter and faster as they gain experience.

### Hard Constraints

- Members area = creation + publishing + sharing (social-only)
- No buying flow inside Members
- No marketplace publishing (Amazon/eBay/Etsy)
- No website embed options
- Distribution is ONLY via social media surfaces and link/QR sharing
- All purchases route through the platform's centralized distribution + checkout (Rome Principle)
- Members earn at least 25% profit on tracked sales
- Payout setup happens later, only when needed

### Onboarding Cards (One-Time Sequence)

#### Card 1: Welcome — "This is the Creator Workspace"
- Establishes what /member is for and what it is NOT for
- Copy: This is where you create products and publish them for sharing. You share on social media and anywhere you can post a link. Checkout and fulfillment are handled through the platform.
- Fields: none
- CTA: "Continue"

#### Card 2: Learning Contract — "We'll Walk You Through It"
- Prevents frustration about guided prompts
- Frames Super Simple as training that runs once
- Promises the system gets quieter and faster after
- Fields: none (optional "Got it" checkbox, psychological only)
- CTA: "Continue"

#### Card 3: What Describes You — Use Case / Audience
- Single-select: "What best describes you?"
- Options: Small business owner, Event planner, Creator/Influencer, Nonprofit, Other
- Helps tailor language and surface relevant templates later
- CTA: "Continue"

#### Card 4: What Products Interest You
- Multi-select: Apparel, Hats, Mugs, Bags, Phone Cases, etc.
- Pre-loads the right product catalog for their first wizard run
- CTA: "Continue"

#### Card 5: Creator Identity
- **Full name** (required) — real name, for records/attribution/future payouts
- **Store name** (required) — what customers see, the public-facing label
- **Creator slug** (auto-generated from store name, editable) — URL-safe handle, unique per tenant scope
- **Country** (required) — for compliance and reporting
- **Avatar** (optional) — profile image for creator page
- Validation: full name 2-80 chars, store name 2-40 chars, slug lowercase 3-30 chars [a-z0-9-], country ISO code
- CTA: "Save and Continue"

#### Card 6: Social Sharing Surfaces
- **Social platforms** (multi-select, optional but recommended): Instagram, Facebook, TikTok, X, YouTube, WhatsApp, Email/Text, QR Code (in-person)
- **Primary platform** (single select, optional)
- **@ handle** (optional, ties to primary platform) — used by Share Kit for "follow me @handle" on generated assets
- NOT included: "My website", "Embed", "Amazon/eBay/Etsy"
- CTA: "Continue"

#### Card 7: Inspiration — "Here's What You're Building"
- Visual card showing finished product examples
- Small phone icon with dotted lines connecting up to a larger phone case mockup showing a completed QR product
- Sets a quality bar and builds excitement before they start creating
- Fields: none
- CTA: "Continue"

#### Card 8: Creator Economics — "How You Get Paid (Later)"
- When products sell through the platform, members earn at least 25% of the profit
- No payout setup required now — prompted later only if/when they have sales
- **Required checkbox**: "I understand and agree"
- Flags: creator_terms_accepted, creator_terms_version = "v1", creator_terms_accepted_at = timestamp
- CTA: "Continue"

#### Card 9: How'd You Find Us — Attribution
- Simple dropdown or free text
- Options: Social media, Friend/referral, Search engine, Event, Other
- CTA: "Continue"

#### Card 10: Launch — "Let's Create Your First Item"
- End onboarding, start Super Simple immediately
- Copy: We'll guide you through the Super Simple version once. After that, you'll move faster with fewer prompts.
- Sets: onboarding_complete = true, onboarding_completed_at = timestamp, onboarding_version = "v1"
- CTA: "Start Super Simple"

### Super Simple → Simple Graduation

- At the END of Super Simple: show a brief "You did it" graduation moment explaining they're moving to the faster mode
- At the START of Simple (first time): show a brief "Welcome to the faster lane" card acknowledging the transition
- After that, Simple is the default day-to-day creation workflow
- Advanced/Studio unlock later based on publish count gating (existing logic)

### Data Stored

| Key | Type | Purpose |
|-----|------|---------|
| onboarding_complete | boolean | One-time gate |
| onboarding_completed_at | timestamp | Audit |
| onboarding_version | string | Future upgrades |
| full_name | string | Real name for records |
| store_name | string | Public-facing store label |
| creator_slug | string | URL-safe handle |
| country | string | Compliance/reporting |
| avatar_url | string or null | Creator page image |
| use_case | string | What describes them |
| product_interests | string[] | Pre-load catalog |
| social_surfaces | string[] | Configured share tools |
| primary_social_surface | string or null | Main platform |
| social_handle | string or null | @ handle for Share Kit |
| attribution_source | string | How they found QR Gear |
| creator_terms_accepted | boolean | Legal flag |
| creator_terms_version | string | Terms version |
| creator_terms_accepted_at | timestamp | Legal timestamp |
| tutorialAlreadyDone | boolean | Super Simple runs once |
| publish_count | number | Tier gating (existing) |

### Flow Summary

1. User visits /member
2. Not logged in → sign up / sign in
3. onboarding_complete is false → show onboarding cards (1-10)
4. Card 10 launches Super Simple Wizard
5. Super Simple completes → graduation moment → marks tutorialAlreadyDone
6. Auto-advances to Simple Wizard → "welcome to the faster lane" card
7. Simple is the default from then on
8. Advanced/Studio unlock based on publish count
9. All sharing is social-only via configured surfaces
10. All commerce routes through platform (Rome Principle)
