# Official Viewer Architecture — LAW

This document is the authoritative, binding architecture for all viewer/UI component systems in QR Gear. No exceptions. No alternate systems. No forks. One system.

## The Five Layers

### 1. DOMAIN — Truth
The domain layer controls truth. Business rules live here.
- What a blank product is
- What a canonical blank key is (Printify: "71", Printful: "pf:71")
- What a catalog is
- What a tier is
- What description layers exist (providerDescription, adminCatalogDescription, memberPacketDescription)
- Who is allowed to edit what
- Where edits must save
- Printify and Printful must remain distinct identities

The domain defines truth. It does not paint UI.

### 2. CONTROLLER — Authority
The controller layer enforces truth and prepares UI inputs.
- What data gets loaded
- What data shape is passed into the viewer
- Which actions are allowed
- Where save operations go
- What role is active
- What mode is active
- What item is selected
- What modal is opened
- What action handlers are passed down

The controller owns action authority. Not visual layout. Not painting.

### 3. VIEWER — Dumb Mount Point
SharedViewer is dumb. This is locked.

SharedViewer ONLY:
- Receives prepared items
- Receives a view type
- Receives a skin
- Receives explicit props
- Receives explicit actions
- Mounts the view and skin together

SharedViewer does NOT:
- Invent business truth
- Infer provider identity
- Rewrite item shape
- Decide save targets
- Decide permissions
- Decide role meaning
- Derive product keys from active tabs
- Interpret domain rules

SharedViewer is a socket. It mounts. It does not think.

### 4. VIEW — Layout Only
A view controls layout and pane behavior only.
- Single pane, double pane, top/bottom stacked, scroll, grid, modal, gallery
- Scroll area behavior, pane arrangement, stacking order
- Modal frame behavior

A view does NOT own business actions, decide permissions, decide save targets, infer provider identity, or mutate data meaning.

### 5. SKIN — Visible Controls + Interaction Surface
The skin renders buttons, edit actions, badges, title, image, price, colors, sizes, previews, and role-specific controls.

The skin may launch detail modals, edit flows, remove actions.

The skin does NOT define business truth. Does NOT decide where save goes. Does NOT decide whether edit means global vs packet. It only receives declared handlers and visible state from the controller.

## One Viewer System Only

There is NOT two different viewer systems. Any alternate viewer family must be folded into the same official viewer/view/skin architecture.

All UI experiences use this same system:
- Admin blanks
- Product pickers
- Store product displays
- Graphics/template pickers
- Library pickers
- Other card/grid/modal selectors

Differences between pages are handled by different controllers, different views, different skins — NOT by inventing a second viewer system.

## Shared Components Rule

`shared/components` = where the viewer/view/skin infrastructure is built (the factory).
Pages and modules = where it is used.

## Phone-First Rule (Mandatory)

All viewer usage must be designed phone-first:
- Narrow screens are the default assumption
- Thumb-friendly controls are mandatory
- No dependence on wide desktop-only layouts
- Cards should not hold too much text or too many micro-controls
- Long editing happens in a modal/detail pane, not inside a tiny card
- Desktop can be an enhancement, not the baseline

## Description Cascade Model

Three description layers (full system):
1. **providerDescription** — Exact source description from Printify or Printful. Preserve the real long description when available.
2. **adminCatalogDescription** — Global lasting admin override. Saved at catalog level in `catalog.blankDescriptions[canonicalBlankKey]`.
3. **memberPacketDescription** — Member-only override for that packet/item instance. Only applies inside the member workflow. Never writes back to admin/global.

Effective description: `adminCatalogDescription ?? providerDescription ?? fallback`

## Admin-Blanks Specific Rules

### Layout: Phone-First Top/Bottom
- TOP = Catalog pane (active working set)
- BOTTOM = Source pane (browsing supply shelf, scrollable)
- Detail editing happens in a lightbox/modal, NOT inline in tiny cards

### Three Skins for Admin-Blanks

1. **AdminCatalogBlankSkin** — Top pane. Compact working-set card. Launch detail editor. Quick remove. Does NOT hold full editing UI inline.
2. **AdminSourceBlankSkin** — Bottom pane. Source browser card. Add-to-catalog launcher. Browse provider blanks.
3. **AdminBlankDetailSkin** — Lightbox/modal. Full detail display. Full long-description reader. Global admin description editor with save.

### Global Authority Rule
Admin changes the global and lasting catalog description. Save goes to `catalog.blankDescriptions[canonicalBlankKey]` only. Does NOT save to Printify, packet, or user/customer state.

## What Must NOT Live in Viewer/View/Skin

- Canonical blank key truth
- Printify vs Printful identity truth
- Role truth / permission truth
- Save-target truth
- Description-layer truth
- Packet-vs-catalog write rules
- Provider source mapping truth
- Fallback policy for description sources

Those belong in domain + controller layers only.
