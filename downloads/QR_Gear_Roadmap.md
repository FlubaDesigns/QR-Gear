# QR Gear — Build Roadmap

This document is the single source of truth for all planned, in-progress, and completed development on the QR Gear platform. Tasks are ordered by execution priority — each group unblocks the one after it.

---

## Vision

QR Gear is being built to run itself. Every task below moves the platform closer to a fully automated, AI-operated e-commerce system — one that designs products, publishes them to print providers, manages storefronts, tracks orders, and pays out affiliates without manual intervention. The architecture is intentionally multi-site: the same engine will power additional branded stores beyond QR Gear.

---

## Track Status

| Track | Description | Status |
|-------|-------------|--------|
| Track 1 — Foundation | Source-of-truth cleanup, instance system, generic publish pipeline | **Complete** |
| Track 2 — Stabilization | Four targeted backend fixes (cart order, draft filter, legacy flags) | **Complete** |
| Track 3 — Monetization | Security, checkout unification, affiliate, embed, marketplace | In queue |
| Track 4 — Automation | Auto-publish, bulk tools, test coverage | In queue |
| Track 5 — UX & Maintainability | Builder UX, file splits, admin shell, legacy cleanup | In queue |

---

## Execution Order

Tasks should be executed in the order shown. Dependencies are noted inline.

---

## TRACK 2 — STABILIZATION (Complete)

---

### #20 — Generic Placement Support in Printify Publish Pipeline
**Status: Complete** ✓

Previously the publish-to-Printify step only handled front and left_sleeve placements via hardcoded logic. Replaced with a generic loop driven by the packet's `placements` array and a placement-to-URL lookup map. Any product with back, right sleeve, or future placement combinations now publishes all of them automatically. Army and Navy products (front + left sleeve) are unaffected.

---

### Stabilization Fixes — add-to-cart, draft filter, legacy flags
**Status: Complete** ✓

Four targeted backend fixes shipped in build `20260502-stabilize-v10`:
- add-to-cart now checks `admin_catalog_instances` first (instances are the source of truth — storeProductLinks is legacy fallback only)
- All three public store listing paths now exclude `status === 'draft'` so draft products never appear in the public store
- Legacy `storeProductLinks` fallback now logs `console.warn` and sets `isLegacy: true` on the response so it's always visible in logs

---

## TRACK 3 — MONETIZATION

Do these in order. Security before money. Money before distribution.

---

### #21 — Auto Re-Publish to Printify on Design Update
**Status: Complete** ✓ — Build `20260502-task21-republish-v1`

When a composite image is regenerated in the builder, the system now automatically re-publishes every linked Printify product with the new image — no manual step required. Works for any product, any placement combination (front, back, sleeve).

How it works:
- `printify-republish.ts` service contains the re-publish logic, decoupled from any HTTP handler
- When the composite generation endpoint saves a new `compositeUrl`, it fires `republishAllInstancesForPacket()` as a background task (response goes out immediately, republish runs async)
- Queries all `admin_catalog_instances` where `currentPacketId` matches and `printifyProductId` exists, re-uploads images to Printify, calls `updateProduct` on the existing listing
- Writes `publishStatus: "synced"` + `lastPublishedAt` on success, or `publishStatus: "error"` + `publishError` on failure
- Manual on-demand endpoint added: `POST /admin/qrg/republish/:instanceId` (used by task #22's "Publish Now" button)
- `updateProduct()` method added to the Printify client

**Depends on:** #20 (complete)

---

### #22 — Admin Publish Status UI
**Status: Queued** — After #21

Adds a status badge to every product card in the Store Library showing one of four states: Synced (with timestamp), Pending, Error (tappable for message), or Not Published (with a "Publish Now" button). Badge updates in real time as the auto-publish trigger fires.

**Depends on:** #21

---

### #9 — Security & Trust-Boundary Pass
**Status: Queued** — Before any checkout work

The platform handles real money and real user data. Before scaling up monetization, a focused review is required: verify every admin endpoint requires admin auth, verify public endpoints don't expose sensitive fields (emails, payout amounts, internal IDs), confirm embed domain enforcement can't be bypassed, validate file upload size/type limits, and confirm affiliate ID resolution is server-side only and cannot be spoofed from the client.

**Depends on:** nothing — can start any time, must complete before #2

---

### #2 — Order & Checkout Unification
**Status: Queued**

Three separate checkout paths exist (direct cart, public/packet purchase, external-site embed buy). Each one independently implements pricing, order creation, affiliate attribution, and payout logic. When one path is updated, the others drift. This task extracts one canonical order service that all three paths call — unified order model with `orderId`, `items[]`, `provider`, `pricing`, `status` — so pricing, attribution, and payouts are always consistent regardless of how the customer arrived at checkout. Normalizes provider responses from Printify and Printful into a single shape.

**Depends on:** #9 (security pass first)

---

### #1 — Fix Cascading Product Description
**Status: Queued**

When a product is shown to a member or customer, the description currently comes from a model number like "3001" — not the real product copy. The system never fetches the real description from Printify's blueprint detail endpoint. This task fetches rich descriptions during blueprint sync, stores them in the database, and wires them through the full cascade: Printify original → admin override → member customization.

**Depends on:** nothing — can run parallel to #2

---

### #14 — Affiliate System
**Status: Queued** *(New task — added from expansion plan)*

The platform has affiliate attribution wiring in the external-sites transaction path but no standalone affiliate membership system. This task adds: member affiliate IDs, unique tracking links per member per product, and the revenue split logic that credits the correct affiliate on every sale. Revenue split: platform share, affiliate share, creator share — defined per product, frozen in the pricing snapshot at order time.

**Depends on:** #2 (canonical order service must exist first)

---

### #3 — External-Sites Transaction Closure
**Status: Queued**

The external-sites system lets QR Gear products be sold on third-party websites via an embed. The buy flow needs hardening end-to-end: domain validation must strictly reject requests from unlisted sites, affiliate attribution must always resolve correctly through the placement → host → profile chain, and the purchase must atomically write both the order attribution and the payout ledger entry so no money is ever mis-credited.

**Depends on:** #2, #14

---

### #15 — External Embed System
**Status: Queued** *(New task — split from #3, added from expansion plan)*

Builds the embeddable widget runtime for selling QR Gear products on external websites. Creates the iframe/script embed, the public API surface that external sites call, and the channel mapping system that connects an external host's embed configuration to the correct store channel and affiliate attribution chain. Separate from the transaction closure hardening in #3 — this is the embed UI and API layer.

**Depends on:** #3

---

### #8 — Marketplace Expansion
**Status: Queued**

The platform has adapter stubs for Etsy, eBay, and Amazon but no working sync pipeline. This task builds the canonical marketplace listing types and a real sync pipeline — internal product representation → MarketplaceListing. Etsy is the first fully connected marketplace (highest ROI). Creates the channel mapping system so one product published everywhere starts from one source of truth. Amazon and eBay follow Etsy's adapter pattern.

**Depends on:** #2 (canonical order model), #20 (generic placement)

---

## TRACK 4 — AUTOMATION

---

### #16 — Product Automation
**Status: Queued** *(New task — added from expansion plan)*

Two automation capabilities: (1) Auto-generate mockups — when a new composite image is created in the builder, automatically generate the full set of color/angle mockups without manual trigger. (2) Bulk product creation tools — admin UI for creating multiple product variants (sizes, colors, placements) from a single template in one operation. Both capabilities feed into the auto-publish pipeline from #21.

**Depends on:** #21, #7 (builder unification — shared engine makes bulk tools feasible)

---

### #10 — Test Coverage Expansion
**Status: Queued**

The platform currently has 4 test files covering only basic shared utilities. For a system handling pricing math, affiliate payouts, order attribution, and multi-channel publishing, this is dangerously thin. Target: 15+ test files covering pricing snapshot calculations, order creation idempotency, affiliate resolution chain, embed domain validation, payout ledger writes, and builder capability parity.

**Can run:** any time, alongside other tracks

---

## TRACK 5 — UX & MAINTAINABILITY

These don't block monetization but should be completed before the codebase grows further. Run them alongside Track 3 where capacity allows.

---

### #13 — Table-First Placement Data Model
**Status: Queued**

Every time a product is selected in the admin builder, the system makes a live API call to Printify or Printful to fetch available print placements. If the provider API is slow or down, the builder stalls. This task pre-syncs all placement data into QR Gear's own database on a weekly schedule and loads it instantly at build time. One-tap on-demand sync for products not yet cached.

**Depends on:** nothing

---

### #12 — Builder One-Finger UX Refactor
**Status: Queued**

The admin product builder is a long flat scroll with no hierarchy. This task reorganizes it into a 5-section accordion — one section open at a time — with a command strip (Resume, Templates, New, Save, Generate), a summary bar showing completion status per section, and a sticky footer with Save and Generate always visible. No feature changes — layout restructure only.

**Depends on:** nothing

---

### #7 — Builder Family Unification
**Status: Queued**

Five product builder wizards (SuperSimple, Simple, Advanced, Studio, Owner) share partial internals but are largely duplicated. Every feature change has to be made in multiple places. This task creates one canonical builder engine with a capability/permission model, so each wizard becomes a thin configuration shell on top of shared logic. Required before #16 (bulk tools) is feasible.

**Depends on:** #12 (UX refactor should happen first so the engine reflects the new layout)

---

### #6 — Store Builder Restructure
**Status: Queued**

The store builder is a single 1000+ line component handling store settings, branding, product discovery, product configuration, and catalog management all at once. Splits into four focused sections — Overview, Branding, Catalog, Access — each in its own file, navigated via tabs. Catalog section gets three sub-views: browse, configure, manage.

**Depends on:** nothing

---

### #5 — Admin UX Shell Adoption
**Status: Queued**

Mobile-friendly admin shell primitives exist but the biggest admin pages haven't adopted them. Admin store builder, admin products, admin pricing, and external-sites pages are retrofitted with the card-based shell so they work well on mobile with one hand.

**Depends on:** #6 (store builder restructure first)

---

### #4 — Client Giant File Splits
**Status: Queued**

Several frontend files have grown past 800–1000 lines and mix multiple responsibilities. Split each into focused components by responsibility — no feature changes, just structure. Files targeted: AdvancedWizardStepContent.tsx (1087L), StoreBuilderHarness.tsx (1056L), CreateGraphicsModule.tsx (1008L), store-build.tsx (870L), OwnerWizard.tsx (801L).

**Depends on:** #6, #7 (split after the restructure is done or they'll conflict)

---

### #11 — Legacy Naming Cleanup
**Status: Queued**

Old service names and terminology from earlier platform versions (programService, channelItemsService, widget-auth, collectionTag, site_programs) still appear in runtime code. This task removes dead code entirely or wraps it in one explicit compatibility adapter so the codebase speaks one consistent language throughout.

**Depends on:** nothing — but easiest to do after #4 (smaller files are easier to clean)

---

## Reserved Slots

### #17–19 — Reserved
**Status: Open**

Unassigned. New tasks are numbered into these slots as the platform grows.

---

## Rules — DO NOT Violate

These rules were established during stabilization and must be maintained in all future work:

- **Never reintroduce legacy logic.** `storeProductLinks` is a legacy fallback only. `admin_catalog_instances` is the source of truth.
- **Never bypass the instance system.** All product state flows through `admin_catalog_instances`. No route may read product data from packets or links directly without checking instances first.
- **Never add features before validation.** Security pass (#9) must complete before any monetization feature ships to production.
- **Never hardcode placements.** All publish pipelines use the `PLACEMENT_URL_MAP` loop established in #20.
- **Draft products never appear in the public store.** The `status === 'draft'` filter must be preserved in all store listing paths.

---

## Notes for Future Sites

The architecture — catalog instances as the source of truth, generic publish pipeline, marketplace sync, external-site embeds, canonical order service, affiliate tracking — is intentionally not QR Gear-specific. When additional branded stores are created, they get their own channels and stores in the same system. The same pipelines run. New sites are configuration, not new code.
