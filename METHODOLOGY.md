# QR Gear Methodology

This document captures the core design principles and architectural decisions for QR Gear. Updates are dated to track evolution.

---

## Changelog

| Date | Update |
|------|--------|
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

Product tiers build on each other. Each tier inherits from the previous and adds capabilities:

| Tier | Fork Point | Adds |
|------|------------|------|
| QR Basic | Step 8 | QR code on product |
| QR Plus | Step 12 | Header/footer text on product |
| QR Canvas | Step 13+ | Custom landing page with urlGraphic |
| Play | Step 13+ | Video surface with QR overlay |

The packet grows with each tier - QR Basic has fewer fields, QR Canvas has more.

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

---

## Future Considerations

### Drafts on Dashboard
Members should see their drafts (status: 'draft') on their main dashboard, not hidden in the wizard. Click to resume where they left off.

### Buyer Customizer (Future)
A completely separate buyer-first experience. Uses different language: "Customize" not "Build", "Preview" not "Publish". See replit.md for full spec.

---

## Notes

This is an evolving platform at its infant stage. Expect changes. Date all updates.
