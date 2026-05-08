# VVSS — Viewer / View / Skin / Shape

Code reference for the QR Gear UI architecture system.
Binding law: `ARCHITECTURE_VIEWER.md`.

---

## The Four-Digit Code

Every repeating data surface gets a four-digit VVSS code:

```
[Viewer] · [View] · [Skin] · [Shape]

1·1·1·1  =  SinglePaneViewer + ScrollGridView + CardSkin + ModalView popup
1·1·1·0  =  SinglePaneViewer + ScrollGridView + CardSkin + flat (no popup)
2·1·1·0  =  TwoPaneViewer   + ScrollGridView + CardSkin + flat
1·2·1·1  =  SinglePaneViewer + ScrollHorizontalView + CardSkin + ModalView popup
```

---

## Digit 1 — Viewer (pane structure)

The Viewer is a structural container. It owns the page or panel layout.

| Code | Component | Description |
|---|---|---|
| 1 | `SinglePaneViewer` | One full-width pane |
| 2 | `TwoPaneViewer` | Side by side — list left, detail right |

Folder: `client/src/features/shared/components/viewers/`

---

## Digit 2 — View (scroll / layout)

The View controls scroll and layout behavior. Nothing else.

| Code | Component | Description |
|---|---|---|
| 0 | `SingleView` | No scroll — one focused item or workspace |
| 1 | `VScrollView` | Vertical scroll — grid or list (layout prop) |
| 2 | `HScrollView` | Horizontal scroll — rail or strip |
| 3 | `SlideView` | Paginated — one item at a time, step forward/back |
| 4 | `TableView` | Data rows with columns |
| 5 | `FocusView` | One dominant item + supporting context around it |

Folder: `client/src/features/shared/components/views/`

---

## Digit 3 — Skin (card component)

The Skin renders card content: image, title, metadata, badges, actions.
Everything the user sees and taps on a card in the grid.

| Code | Pattern | Description |
|---|---|---|
| 1 | `[DataType]CardSkin` | Standard card — image, name, metadata |
| 2 | `[DataType]RowSkin` | Compact horizontal row — text-focused |

Naming: `[DataType]CardSkin` or `[DataType]RowSkin`, file: `skins/[DataType]Skin.tsx`

Folder: `client/src/features/shared/components/skins/`

The Skin does NOT:
- Define business truth
- Decide where saves go
- Render popup/detail content (that belongs in Shape)
- Know what Viewer, View, or Shape contains it

---

## Digit 4 — Shape (popup layer)

The Shape layer answers one question: does this surface have a popup on top of the View?

| Code | Description |
|---|---|
| 0 | Flat — no popup |
| 1 | Popup — `ModalView` container + a named `[DataType]Shape` content component |

The Shape layer has two parts:
- **Container** — `ModalView` in `shapes/` wraps the popup shell (dialog, overlay)
- **Content** — a named `[DataType]Shape` component renders inside the popup

Shape is NOT a sub-type of View. It is its own layer. Components live in `shapes/`, not `views/`.
`ModalView` is NOT a View — it is a Shape container.

Naming: `[DataType]Shape`, file: `shapes/[DataType]Shape.tsx`

Folder: `client/src/features/shared/components/shapes/`

---

## Naming Conventions

| Layer | Component name | File |
|---|---|---|
| Viewer | `SinglePaneViewer`, `TwoPaneViewer` | `viewers/[Name]Viewer.tsx` |
| View | `ScrollGridView`, `ScrollHorizontalView`, `SingleView` | `views/[Name]View.tsx` |
| Skin | `[DataType]CardSkin`, `[DataType]RowSkin` | `skins/[DataType]Skin.tsx` |
| Shape | `ModalView` (container), `[DataType]Shape` (content) | `shapes/[DataType]Shape.tsx` |

---

## Folder Structure

```
client/src/features/shared/components/

  viewers/
    SinglePaneViewer.tsx       # Code 1 — one full-width pane
    TwoPaneViewer.tsx          # Code 2 — side by side

  views/
    SingleView.tsx             # Code 0 — no scroll
    ScrollGridView.tsx         # Code 1 — vertical scroll, grid
    ScrollVerticalView.tsx     # Code 1 — vertical scroll, list
    ScrollHorizontalView.tsx   # Code 2 — horizontal scroll

  skins/
    SourceSkin.tsx             # SourceCardSkin — source GRF card (code 1)

  shapes/
    ModalView.tsx              # Popup container (Shape code 1)
    SourceShape.tsx            # SourceDetailShape — source GRF popup content
```

---

## Real Examples

| Code | Surface | Skin | Shape |
|---|---|---|---|
| `1·1·1·1` | Source Images tab | `SourceCardSkin` | `ModalView` + `SourceDetailShape` |
| `1·1·1·0` | Backgrounds tab | `BackgroundCardSkin` | Flat — none |
| `2·1·1·0` | Product builder | `ProductCardSkin` | Flat — none |
| `1·2·1·1` | Graphics tab | `GraphicCardSkin` | `AdminGraphicShape` |

---

## SkinItem Contract

All items passed into a Skin must conform to `SkinItem`:

```ts
interface SkinItem {
  id:             string;
  name:           string;
  primaryImage?:  string | null;
  dimensions?:    string | null;
  [key: string]:  unknown;
}
```

Controllers extend `SkinItem` with domain-specific fields. Skins may read them but must not write back.

---

See `ARCHITECTURE_VIEWER.md` for the full binding law, layered architecture, and prohibited behaviors.
