# VVS — Viewer / View / Skin

Design and rendering methodology for the QR Gear admin platform.
All repeating UI surfaces must be built using VVS layers.

---

## Overview

VVS is three layers with a three-digit code:

```
Viewer  (first digit)   — the pane
  └── View  (second digit) — the behavior
        └── Skin            — the content (named, not coded)
```

Each layer has exactly one job.

---

## VVS Code

Every UI surface gets a three-digit VVS code.

```
[Viewer][View][Shape]

Example:  1·1·1
          │ │ └─ Shape: has a popup/modal
          │ └─── View: vertical scroll
          └───── Viewer: single pane
```

---

## Viewer — First Digit

**The pane.**

The Viewer is the structural container. It owns the page or panel layout.

It answers:
- How many panels are visible?
- Where do they live on screen?

The Viewer does NOT know how items scroll, what they look like, or what buttons exist.

| Code | Name | Description |
|---|---|---|
| 1 | Single pane | One full-width pane |
| 2 | Two pane | Side by side — list left, detail right |

More Viewer types added as they appear in the codebase.

---

## View — Second Digit

**The behavior.**

The View lives inside the Viewer. It controls how items move and arrange.

It answers:
- Does it scroll, and which direction?
- Is it paginated?
- Is there no movement at all?

The View does NOT know what the Viewer looks like, what items look like, or what buttons exist.

| Code | Name | Description |
|---|---|---|
| 0 | None | No scroll, no pagination — static or single item |
| 1 | Vertical | Vertical scroll (grid or list) |
| 2 | Horizontal | Horizontal scroll, row of cards |
| 3 | Paginated | Page-by-page navigation |

More View types added as they appear in the codebase.

---

## Shape — Third Digit

**The popup.**

The Shape digit answers one question: does the Viewer contain a modal or popup layer?

It does NOT describe card styles, buttons, or images.
It only describes whether a secondary layer opens on top of the primary View.

| Code | Name | Description |
|---|---|---|
| 0 | Flat | No popup, no modal — actions happen inline or not at all |
| 1 | Popup | A modal or dialog opens inside the Viewer |

More Shape types added as they appear in the codebase.

---

## Skin — Named, Not Coded

**The content.**

The Skin is where the image lives. Where the buttons live. Where the text lives.
Everything the user sees and taps.

It answers:
- What does each item look like?
- What image is shown?
- What text is displayed?
- What buttons or actions are available?

The Skin does NOT know what Viewer or View contains it.

### Naming convention

```
[DataType][Variant]Skin

DataType = what it displays   (SourceImage, Product, Template...)
Variant  = Card or Detail
```

| Variant | When used |
|---|---|
| Card | Compact — rendered inside the View grid/list |
| Detail | Expanded — rendered inside a popup/modal |

### Examples

| Skin name | Data type | Variant |
|---|---|---|
| `SourceImageCardSkin` | GRF source original | Card |
| `SourceImageDetailSkin` | GRF source original | Detail |
| `ProductCardSkin` | Product | Card |

---

## SkinItem — the shared data contract

All Views accept items in the `SkinItem` shape.
All Skins receive a `SkinItem`.

```ts
interface SkinItem {
  id: string;
  name: string;
  primaryImage?: string | null;     // main display image URL
  dimensions?: string | null;       // e.g. "1080x1920"
  metadata?: {
    raw?: unknown;                  // full original API asset
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

**Key rule:** `metadata.raw` holds the full original API response object.

Skin action handlers read `metadata.raw` to access fields like `grfId`, `mimeType`,
and `originalFilename` — without the Viewer or View needing to know those fields exist.

---

## Composition rule

Every repeating data surface must follow:

```
[Viewer]
  [View]
    [Skin per item]
```

### What violates VVS

| Violation | Description |
|---|---|
| Skin violation | Rendering raw `<div><img /></div>` cards inside a tab instead of a Skin |
| View violation | Putting scroll or grid logic inside a Skin |
| Viewer violation | Putting pane/panel layout inside a View |
| Contract violation | Passing raw API objects into a View instead of mapping to SkinItem |
| Contract violation | Accessing `grfId` or `mimeType` from View layer instead of `metadata.raw` |
| Style violation | `hover-elevate` on an element with `overflow-hidden` |
| Style violation | Setting `hover:*` colors on a Button or Badge |
| Style violation | Setting `h-*` manually on a Button |

---

## Real examples

| Code | Surface | Viewer | View | Shape |
|---|---|---|---|---|
| 1·1·1 | Source Images tab | Single pane | Vertical scroll grid | Detail popup |
| 1·1·0 | Backgrounds tab | Single pane | Vertical scroll grid | Flat |
| 2·1·0 | Product builder | Two pane | Vertical scroll left | Flat |

---

## File locations

```
client/src/features/shared/components/

  viewers/                     # Viewer components (first digit)
    SinglePaneViewer.tsx       # Viewer code 1 — one full-width pane
    TwoPaneViewer.tsx          # Viewer code 2 — side by side

  views/                       # View components (second digit)
    ScrollGridView.tsx         # View code 1 — vertical scroll, grid
    ScrollHorizontalView.tsx   # View code 2 — horizontal scroll
    ScrollVerticalView.tsx     # View code 1 — vertical scroll, list
    SingleView.tsx             # View code 0 — no scroll

  shapes/                      # Shape components (third digit)
    ModalView.tsx              # Shape code 1 — popup/modal container
    SourceShape.tsx            # SourceDetailShape — popup content for source images

  skins/                       # Skin components (named)
    SourceSkin.tsx             # SourceCardSkin — card in the grid

client/src/features/adminLibrary/tabs/
  SourceImagesTab.tsx          # VVS 1·1·1 — source GRF originals
  CroppedImagesTab.tsx         # VVS 1·1·0 — cropped GRF derivatives
  BackgroundsTab.tsx           # VVS 1·1·0 — promoted background assets
```
