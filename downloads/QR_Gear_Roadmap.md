# QR Gear — Build Roadmap

This document captures every planned, in-progress, and completed development task for the QR Gear platform. Tasks are numbered in rough priority order. Slots 14–19 are intentionally open for new work as the platform grows.

---

## Vision

QR Gear is being built to run itself. Every task below moves the platform closer to a fully automated, AI-operated e-commerce system — one that designs products, publishes them to print providers, manages storefronts, tracks orders, and pays out affiliates without manual intervention. The architecture being built here is intentionally multi-site: the same engine will power additional branded stores beyond QR Gear.

---

## Task List

---

### #1 — Fix Cascading Product Description
**Status:** Queued

When a product is shown to a member or customer, the description should come from Printify's own rich product copy — not a model number like "3001." Right now the system never fetches the real description from Printify's detail endpoint, so it falls back to a generic placeholder. This task fetches the real description during blueprint sync, stores it in the database, and wires it through the full cascade: Printify original → admin override → member customization.

---

### #2 — Order & Checkout Unification
**Status:** Queued

Three separate checkout paths exist (direct cart, public/packet purchase, external-site embed buy). Each one independently implements pricing, order creation, affiliate attribution, and payout logic. When one path is updated, the others drift. This task extracts one canonical order service that all three paths call, so pricing, attribution, and payouts are always consistent regardless of how the customer arrived at checkout.

---

### #3 — External-Sites Transaction Closure
**Status:** Queued

The external-sites system lets QR Gear products be sold on third-party websites via an embed. The buy flow needs hardening end-to-end: domain validation must strictly reject requests from unlisted sites, affiliate attribution must always resolve correctly through the placement → host → profile chain, and the purchase must atomically write both the order attribution and the payout ledger entry so no money is ever mis-credited.

---

### #4 — Client Giant File Splits
**Status:** Queued

Several frontend files have grown past 800–1000 lines and mix multiple unrelated responsibilities into one file. This makes them slow to navigate and easy to break when editing. This task splits each oversized file into focused components by responsibility — no feature changes, just structure. Cleaner files mean faster future development.

---

### #5 — Admin UX Shell Adoption
**Status:** Queued

A set of mobile-friendly admin UI building blocks already exists (card sections, sticky action bars, preview drawers, bottom nav) but the biggest admin pages haven't adopted them yet. Those pages are dense, desktop-only walls of controls. This task retrofits the admin store builder, admin products, admin pricing, and external-sites pages with the card-based shell so they work well on a phone with one hand.

---

### #6 — Store Builder Restructure
**Status:** Queued

The store builder is currently a single 1000+ line component that tries to handle store settings, branding, product discovery, product configuration, and catalog management all at once. This task breaks it into four focused sections — Overview, Branding, Catalog, Access — each in its own file and navigated via tabs. The catalog section alone gets three sub-views: browse available products, configure a selected product, and manage products already in the store.

---

### #7 — Builder Family Unification
**Status:** Queued

Five different product builder wizards exist (SuperSimple, Simple, Advanced, Studio, Owner) that share partial internals but are largely copy-pasted from each other. Every feature change has to be made in multiple places. This task moves toward one canonical builder engine with a capability/permission model that controls what each shell can do, so each wizard becomes a thin configuration on top of shared logic.

---

### #8 — Marketplace Domain Hardening
**Status:** Queued

The platform has adapter stubs for Etsy, eBay, and Amazon but no working sync pipeline connecting them to the product catalog. This task establishes the canonical domain types for marketplace listings and builds a real sync pipeline — Surface (internal product representation) → MarketplaceListing. Etsy is the first fully connected marketplace. The marketplace listing and the external-sites embed will share the same canonical Surface so a product published everywhere starts from one source of truth.

---

### #9 — Security & Trust-Boundary Pass
**Status:** Queued

The platform handles real money and real user data. Before scaling up, a focused security review is needed: verify every admin endpoint requires admin authentication, verify public endpoints don't leak sensitive fields (emails, payout amounts, internal IDs), confirm embed domain enforcement can't be bypassed, validate that file upload endpoints check type and size, and confirm affiliate ID resolution is server-side only and can't be spoofed from the client.

---

### #10 — Test Coverage Expansion
**Status:** Queued

The platform currently has 4 test files covering only basic shared utilities. For a system that handles pricing math, affiliate payouts, order attribution, and multi-channel publishing, this is dangerously thin. This task adds at least 15 test files covering the most critical business logic: pricing snapshot calculations, order creation idempotency, affiliate resolution chain, external-sites domain validation, payout ledger writes, and builder capability parity.

---

### #11 — Legacy Naming Cleanup
**Status:** Queued

Old service names and terminology from earlier versions of the platform (programService, channelItemsService, widget-auth, collectionTag, site_programs) still appear in the runtime code. The documentation uses current language but the code carries the old language alongside it, creating confusion. This task either removes the dead code entirely or wraps it in one explicit compatibility adapter, so the codebase speaks one consistent language throughout.

---

### #12 — Builder One-Finger UX Refactor
**Status:** Queued

The admin product builder is a long flat scroll with no hierarchy. For someone operating it with one hand on a phone, finding and completing each step requires too much hunting. This task reorganizes the builder into a 5-section accordion with only one section open at a time, a command strip at the top with large labeled buttons (Resume, Templates, New, Save, Generate), a summary bar showing completion status for each section, and a sticky footer with Save and Generate always visible. Every existing capability stays — it's a layout restructure, not a feature change.

---

### #13 — Table-First Placement Data Model
**Status:** Queued

Every time a product is selected in the admin builder, the system makes a live API call to Printify or Printful to fetch the available print placements (front, back, sleeve, etc.) and methods (DTG, DTF, embroidery). If the provider API is slow or down, the builder stalls. This task pre-syncs all placement data into QR Gear's own database on a weekly schedule and loads it instantly at build time. If a product hasn't been synced yet, a one-tap button fetches it on demand and stores it for next time.

---

### #14–19 — Reserved
**Status:** Open

These slots are intentionally unassigned. New tasks will be numbered into these slots as the platform grows.

---

### #20 — Generic Placement Support in Printify Publish Pipeline
**Status:** **Complete** ✓

Previously the publish-to-Printify step only handled front and left_sleeve placements via hardcoded logic. This task replaced that with a generic loop driven by the packet's `placements` array and a placement-to-URL lookup map. Any product with back, right sleeve, or future placement combinations now publishes all of them automatically. Army and Navy products (front + left sleeve) are unaffected.

---

### #21 — Auto Re-Publish to Printify on Design Update
**Status:** Queued

When a product's composite image is updated — new graphic, new layout, new colors — the Printify listing currently goes stale until someone manually re-publishes. This task automates that: a trigger fires whenever a composite image changes, looks up every published Printify product linked to that design, and re-publishes each one automatically using the same generic placement pipeline from task #20. Works for any product, not just Army and Navy.

---

### #22 — Admin Publish Status UI
**Status:** Queued

Once task #21 is running, admins need visibility into the state of each product's Printify sync. This task adds a status badge to every product card in the Store Library showing one of four states: Synced (with timestamp), Pending, Error (tappable to see the error message), or Not Published (with a "Publish Now" button). The badge updates in real time as the auto-publish trigger fires, so you always know exactly where each product stands.

---

## Notes for Future Sites

The architecture above — catalog instances as the source of truth, generic publish pipeline, marketplace sync, external-site embeds, canonical order service — is intentionally not QR Gear-specific. When additional branded stores are created, they get their own channels and stores in the same system. The same pipelines run. New sites are configuration, not new code.
