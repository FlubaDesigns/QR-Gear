# QR Gear Progress Tracker

## COMPLETED CHANGES

### Wizard Wrap - channelId Flow (Jan 31, 2026)
- **memberPacketService.ts**: Added `channelId` parameter that flows through packet creation
- **memberVideoService.ts**: Added `channelId` parameter that flows through play packet publish
- **Backend /api/member/library-links**: Now accepts and stores `channelId` + `storeId`
- **Backend /api/member/play-packets/:id/publish**: Now accepts `channelId`
- **Library links** now properly associate with channels and member stores

### ShareKitHandoff Component (Jan 31, 2026)
- Created `client/src/features/shared/components/ShareKitHandoff.tsx`
- Post-publish UI with: copy link, copy packet ID, download QR, download preview, view live, native share
- "Create Another" and "View Library" action buttons

### Architecture Documentation (Jan 31, 2026)
- Updated `replit.md` with Composer vs Dynamics dual-product architecture
- Documented data model, critical flows, key services, API endpoints

---

## QR GEAR DUAL-PRODUCT ARCHITECTURE

### Product 1: QR COMPOSER (Member/Creator Tool)
**Purpose**: Members build sellable QR merchandise templates

**What Members Create**:
- Packets (single artifact experiences)
- Templates (sellable blueprints from packets)
- Catalog Item Links (what gets shared/sold)

**Three Surfaces**:
1. **IMAGE (Canvas)** - Static QR backgrounds with text layers
2. **VIDEO (Play)** - Video loops with QR overlay
3. **DOCUMENT (PDF)** - PDF documents with QR (future)

**Member Earnings**: 25% profit share on sales

---

### Product 2: QR DYNAMICS (Buyer/Owner App)
**Purpose**: Buyers control their purchased QR instances

**What Buyers Get**:
- **Instance** - Created at point of sale, buyer-owned
- **Control Panel** - Change where QR points
- **Collections** - Rotating playlists that cycle content over time

**Hosting Model**:
- Year 1: FREE
- After Year 1: $4.99 per 3-year block

**Key Distinction**:
- COMPOSER creates TEMPLATES (sellable, member-owned)
- DYNAMICS controls INSTANCES (buyer-owned, subscription-backed)

---

## PLANNED CHANGES

### QR Dynamics Implementation
- [x] Instance creation at point of sale (pull email from Stripe checkout)
- [x] Buyer control panel for managing QR destinations (API ready)
- [ ] Collection management (rotating playlists)
- [x] Hosting subscription billing ($4.99/3-year after Year 1)
- [x] Instance status tracking (active/expired/renewed)

### Buyer Email & Renewal System
- [x] Capture buyer email from Stripe checkout session
- [x] Store on Instance: `buyerEmail`, `hostingExpiresAt`, `remindersSent[]`
- [x] Cron job to check for expiring Instances (runs hourly)
- [x] Resend renewal reminders (30 days, 7 days, 1 day before expiration)
- [x] Stripe checkout link in reminder emails for $4.99 renewal
- [x] On renewal payment: extend `hostingExpiresAt` by 3 years
- [x] Expired Instance behavior: QR still works but shows "renew" page instead of content
- [x] Renewal page UI at `/renew/:instanceId`

### Social Sharing (COMPLETED)
- [x] Server-rendered /p/:packetId route with OG + Twitter meta tags
- [x] ShareKitHandoff enhanced with social share buttons (X, Facebook, LinkedIn, WhatsApp, Email)
- [x] Copy caption + link functionality
- [x] Crawler detection for proper OG tag delivery
- [x] No platform APIs required - uses share intent URLs

### Member Wizard Enhancements
- [ ] Wire VIDEO (Play) surface into member wizard
- [ ] Wire DOCUMENT (PDF) surface into member wizard
- [x] Integrate ShareKitHandoff into all publish flows
- [ ] Channel picker in wizard step 1

### Store/Channel Organization
- [ ] Store = memberId (each member has their own store)
- [ ] Channels = marketing buckets within store
- [ ] Filter library by channel

### Admin Features
- [ ] View all member stores
- [ ] Manage instance hosting status
- [ ] Override billing/extend hosting

---

## DATA MODEL REFERENCE

| Entity | Description | Owner |
|--------|-------------|-------|
| Member Store | = memberId, each member has one | Member |
| Channel | Marketing bucket for organizing content | Member |
| Packet | Single artifact experience (canvas/video/doc) | Member |
| Template | Sellable blueprint created from packet | Member |
| Catalog Item Link | What members share/sell | Member |
| Buyer Instance | Created at sale, separate from template | Buyer |
| Collection | Rotating playlist of instances | Buyer |

---

## API ENDPOINTS

### Member (Composer) Endpoints
- `POST /api/member/library-links` - Create catalog entry (channelId, storeId)
- `POST /api/member/play-packets/:id/publish` - Publish video packet
- `GET /api/member/library-links?memberId=X` - Get member's catalog

### Buyer (Dynamics) Endpoints (Planned)
- `POST /api/dynamics/instances` - Create instance at purchase
- `GET /api/dynamics/instances/:instanceId` - Get instance details
- `PATCH /api/dynamics/instances/:instanceId` - Update destination URL
- `POST /api/dynamics/collections` - Create collection
- `PATCH /api/dynamics/collections/:id/items` - Add/remove items

---

## KEY FILES

### Services
- `client/src/lib/memberPacketService.ts` - Canvas packet creation
- `client/src/lib/memberVideoService.ts` - Video packet creation

### Components
- `client/src/features/shared/components/ShareKitHandoff.tsx` - Post-publish UI
- `client/src/pages/test-canvas-packet.tsx` - Canvas surface
- `client/src/pages/test-qr-play.tsx` - Video surface

### Backend
- `server/routes.ts` - All API endpoints
