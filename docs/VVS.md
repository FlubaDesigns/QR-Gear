# VVS — Viewer / View / Skin

Design and rendering methodology for the QR Gear admin platform.
All repeating UI surfaces must be built using VVS layers.

---

## Overview

VVS is three layers:

```
Viewer
  └── View
        └── Skin
```

Each layer has exactly one job.

---

## Viewer — Layer 1

**The pane.**

The Viewer is the structural container. It owns the overall page or panel layout.

It answers:
- How many panels are visible?
- Where do they live on screen?

The Viewer does NOT know:
- How items scroll or arrange
- What individual items look like
- What buttons exist

### Viewer type codes

The first digit of any VVS code identifies the Viewer type.

| Code | Name | Description |
|---|---|---|
| 1 | Single pane | One full-width pane |
| 2 | Two pane | Side by side — list left, detail right |

More Viewer types will be added as they appear in the codebase.

---

## View — Layer 2

**The behavior.**

The View lives inside the Viewer. It controls how items move and arrange.

It answers:
- Does it scroll, and which direction?
- Is it paginated?
- Is there no movement at all?

The View does NOT know:
- What the Viewer looks like structurally
- What individual items look like
- What buttons exist

### View type codes

The second digit of any VVS code identifies the View type.

| Code | Name | Description |
|---|---|---|
| 0 | None | No scroll, no pagination — static or single item |
| 1 | Vertical | Vertical scroll (grid or list) |
| 2 | Horizontal | Horizontal scroll, row of cards |
| 3 | Paginated | Page-by-page navigation |

More View types will be added as they appear in the codebase.

---

## S — Skin

**The content.**

The Skin is where the image lives. Where the buttons live. Where the text lives. Everything the user sees and taps.

It answers:
- What does each item look like?
- What image is shown?
- What text is displayed?
- What buttons or actions are available?

The Skin does NOT know:
- What Viewer it lives in
- What View arranged it
- How many siblings it has

### Skin types (examples)

| Name | Description |
|---|---|
| CardSkin | Thumbnail + name + action buttons |
| DetailSkin | Large image + full metadata + actions |
| ListRowSkin | Compact row with icon, name, actions |
| BadgeSkin | Small inline chip, label only |
| HeroSkin | Full-bleed image with overlay text |

### Skin variants

A Skin can have two variants:
- **Card** — compact, shown inside the View grid/list
- **Detail** — expanded, shown inside a modal or detail panel

Example: `SourceImageCardSkin` and `SourceImageDetailSkin` are both Skins for the same data type, just different display contexts.

---

## Composition rule

Every repeating data surface in the admin must be built as:

```
[Viewer]
  [View]
    [Skin per item]
```

No hand-rendering of item cards inside a tab directly.
No raw `<div><img /></div>` blocks in place of a Skin.
No View logic (scrolling, columns) inside a Skin.
No layout structure (panes, drawers) inside a View.

---

## SkinItem — the shared data contract

All Views accept items in the `SkinItem` shape.
All Skins receive a `SkinItem`.

```ts
interface SkinItem {
  id: string;
  name: string;
  primaryImage: string;       // main display image URL
  imageUrl?: string;          // alias for primaryImage (optional)
  dimensions?: string;        // e.g. "1080x1920"
  metadata?: {
    raw?: unknown;            // original API asset, for actions that need full fields
    grfId?: string;
    mimeType?: string;
    originalFilename?: string;
    channel?: string;
    purpose?: string;
    sourceGrfId?: string;
    [key: string]: unknown;
  };
}
```

Key rule: `metadata.raw` holds the original API response object.
This allows Skin action handlers to access fields like `grfId`, `mimeType`, and `originalFilename` without the Viewer or View needing to know about them.

---

## Numbering convention

Components follow the VVS type in their name:

| Layer | Suffix or prefix | Example |
|---|---|---|
| Viewer | Tab or Page | `SourceImagesTab` |
| View | View | `ScrollGridView` |
| Skin | CardSkin / DetailSkin | `SourceImageCardSkin` |

---

## File locations

```
client/src/features/shared/components/
  views/           # All View components
  skins/           # All Skin components
  viewers/         # Viewer wrappers (if shared)

client/src/features/adminLibrary/tabs/
  SourceImagesTab.tsx     # Viewer for source GRF originals
  CroppedImagesTab.tsx    # Viewer for cropped GRF derivatives
  BackgroundsTab.tsx      # Viewer for promoted background assets
```

---

## What violates VVS

- Rendering item cards with raw HTML inside a tab file — **Skin violation**
- Putting scroll/grid logic inside a Skin — **View violation**
- Putting pane/panel layout inside a View — **Viewer violation**
- Passing raw API objects directly into a View instead of mapping to SkinItem — **contract violation**
- Accessing `grfId` or `mimeType` from the View layer instead of `metadata.raw` — **contract violation**
