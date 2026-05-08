# VVS — Viewer / View / Shape / Skin

Design and rendering methodology for the QR Gear admin platform.
All repeating UI surfaces must be built using VVS layers.

---

## Overview

VVS is four layers with a three-digit code:

```
Viewer  (first digit)    — the pane
  └── View  (second digit)  — the scroll/layout behavior
        └── Shape  (third digit) — the popup layer (if any)
              └── Skin             — the content (named, not coded)
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

Owns the page or panel layout. Answers: how many panels, where do they live?

Does NOT know how items scroll, what they look like, or what buttons exist.

| Code | Name | Component | Description |
|---|---|---|---|
| 1 | Single pane | `SinglePaneViewer` | One full-width pane |
| 2 | Two pane | `TwoPaneViewer` | Side by side — list left, detail right |

More Viewer types added as they appear in the codebase.

---

## View — Second Digit

**The scroll/layout behavior.**

Lives inside the Viewer. Controls how items move and arrange.
Answers: does it scroll, which direction, grid or list, paginated?

Does NOT know what the Viewer looks like, what items look like, or what buttons exist.

| Code | Name | Component | Description |
|---|---|---|---|
| 0 | None | `SingleView` | No scroll, no pagination — static or single item |
| 1 | Vertical | `ScrollGridView`, `ScrollVerticalView` | Vertical scroll |
| 2 | Horizontal | `ScrollHorizontalView` | Horizontal scroll, row of cards |
| 3 | Paginated | — | Page-by-page navigation |

More View types added as they appear in the codebase.

---

## Shape — Third Digit

**The popup layer.**

Answers: does the Viewer open a popup on top of the View? If so, what does it contain?

The Shape layer has two parts:
- **Container** — `ModalView` wraps the popup shell (dialog, overlay)
- **Content** — a named Shape component renders inside the popup

Shape content components live in `shapes/` alongside `ModalView`.
They are NOT Skins. They serve the popup context, not the grid context.

Does NOT describe card styles or grid behavior.

| Code | Name | Container | Description |
|---|---|---|---|
| 0 | Flat | — | No popup, no modal |
| 1 | Popup | `ModalView` | A modal/dialog opens inside the Viewer |

### Shape naming convention

```
[DataType]Shape.tsx

DataType = what data it displays   (Source, Product, Template...)
```

| Component | Data type | File |
|---|---|---|
| `SourceDetailShape` | GRF source original | `shapes/SourceShape.tsx` |

More Shape types added as they appear in the codebase.

---

## Skin — Named, Not Coded

**The card content.**

Lives inside the View grid/list. Everything the user sees and taps on a card.
Answers: what does each card look like, what image, text, and buttons does it show?

Does NOT know what Viewer, View, or Shape contains it.
Does NOT render popup/detail content — that belongs in Shape.

### Skin naming convention

```
[DataType]Skin.tsx

DataType = what it displays   (Source, Product, Template...)
```

| Component | Data type | File |
|---|---|---|
| `SourceCardSkin` | GRF source original | `skins/SourceSkin.tsx` |

More Skin types added as they appear in the codebase.

---

## SkinItem — the shared data contract

All Views accept items in the `SkinItem` shape.
All Skins and Shape content components receive a `SkinItem`.

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

Action handlers in both Skins and Shapes read `metadata.raw` to access
fields like `grfId`, `mimeType`, and `originalFilename` — without the
Viewer or View layer needing to know those fields exist.

---

## Composition rule

```
[Viewer]            — pane structure
  [View]            — scroll/layout
    [Skin]          — card per item
  [Shape]           — popup (if Shape code = 1)
    [ModalView]     — popup container
    [XxxShape]      — popup content
```

### What violates VVS

| Violation | Description |
|---|---|
| Skin violation | Rendering raw `<div><img /></div>` cards in a tab instead of a Skin |
| Shape violation | Putting popup/detail content inside a Skin file |
| View violation | Putting scroll or grid logic inside a Skin or Shape |
| Viewer violation | Putting pane/panel layout inside a View |
| Contract violation | Passing raw API objects into a View instead of mapping to SkinItem |
| Contract violation | Reading `grfId` or `mimeType` from View layer instead of `metadata.raw` |
| Style violation | `hover-elevate` on an element with `overflow-hidden` |
| Style violation | Setting `hover:*` colors on a Button or Badge |
| Style violation | Setting `h-*` manually on a Button |

---

## Real examples

| Code | Surface | Viewer | View | Shape |
|---|---|---|---|---|
| 1·1·1 | Source Images tab | `SinglePaneViewer` | `ScrollGridView` | `ModalView` + `SourceDetailShape` |
| 1·1·0 | Backgrounds tab | `SinglePaneViewer` | `ScrollGridView` | Flat — none |
| 2·1·0 | Product builder | `TwoPaneViewer` | `ScrollGridView` | Flat — none |

---

## File locations

```
client/src/features/shared/components/

  viewers/                       # Viewer components — first digit
    SinglePaneViewer.tsx         # Code 1 — one full-width pane
    TwoPaneViewer.tsx            # Code 2 — side by side

  views/                         # View components — second digit
    ScrollGridView.tsx           # Code 1 — vertical scroll, grid columns
    ScrollVerticalView.tsx       # Code 1 — vertical scroll, single column
    ScrollHorizontalView.tsx     # Code 2 — horizontal scroll
    SingleView.tsx               # Code 0 — no scroll

  shapes/                        # Shape components — third digit
    ModalView.tsx                # Popup container (Shape code 1)
    SourceShape.tsx              # SourceDetailShape — popup content for source images

  skins/                         # Skin components — named
    SourceSkin.tsx               # SourceCardSkin — card in the grid

client/src/features/adminLibrary/tabs/
  SourceImagesTab.tsx            # VVS 1·1·1 — source GRF originals
  CroppedImagesTab.tsx           # VVS 1·1·0 — cropped GRF derivatives
  BackgroundsTab.tsx             # VVS 1·1·0 — promoted background assets
```
