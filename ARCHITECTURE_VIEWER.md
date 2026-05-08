# Official Viewer Architecture — LAW

This document is the authoritative, binding architecture for all viewer/UI component systems in QR Gear.
No exceptions. No alternate systems. No forks. One system.

See `VVSS.md` for the VVSS code system (four-digit codes, folder conventions, naming rules).

---

## The Five Layers

```
DOMAIN      — business truth
CONTROLLER  — authority + data prep
VIEWER      — mount point  (VVSS digit 1)
  VIEW      — scroll/layout  (VVSS digit 2)
    SKIN    — card content  (VVSS digit 3)
  SHAPE     — popup layer  (VVSS digit 4)
```

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

### 3. VIEWER — Dumb Mount Point  *(VVSS digit 1)*
The Viewer is a structural container. It owns the page or panel layout.

Answers: how many panels are visible? Where do they live on screen?

VVSS codes:
| Code | Component | Description |
|---|---|---|
| 1 | `SinglePaneViewer` | One full-width pane |
| 2 | `TwoPaneViewer` | Side by side — list left, detail right |

The Viewer ONLY:
- Receives prepared items
- Receives a view type
- Receives a skin
- Receives explicit props and actions
- Mounts the view and skin together

The Viewer does NOT:
- Invent business truth
- Infer provider identity
- Rewrite item shape
- Decide save targets
- Decide permissions
- Decide role meaning
- Derive product keys from active tabs
- Interpret domain rules

The Viewer is a socket. It mounts. It does not think.

### 4. VIEW — Layout Only  *(VVSS digit 2)*
A View controls scroll and layout behavior. Nothing else.

VVSS codes:
| Code | Component | Description |
|---|---|---|
| 0 | `SingleView` | No scroll, static or single item |
| 1 | `ScrollGridView`, `ScrollVerticalView` | Vertical scroll |
| 2 | `ScrollHorizontalView` | Horizontal scroll |
| 3 | — | Paginated (not yet built) |

A View may control:
- Grid arrangement
- Vertical / horizontal / paginated scroll
- Spacing and density
- Column count where applicable

A View may NOT control:
- Business truth, role authority, save targets
- Provider identity, permission meaning
- Description-layer meaning, packet-vs-catalog logic
- Action meaning

### 5. SKIN — Visible Controls  *(VVSS digit 3)*
The Skin renders card content: image, buttons, text, badges, actions.
Everything the user sees and taps on a card in the grid.

VVSS codes:
| Code | Pattern | Description |
|---|---|---|
| 1 | `[DataType]CardSkin` | Standard card — image, name, metadata |
| 2 | `[DataType]RowSkin` | Compact horizontal row — text-focused |

The Skin does NOT:
- Define business truth
- Decide where save goes
- Render popup/detail content (that belongs in Shape)
- Know what Viewer, View, or Shape contains it

Naming convention: `[DataType]CardSkin` or `[DataType]RowSkin` in `skins/[DataType]Skin.tsx`.

---

### 6. SHAPE — Popup Layer  *(VVSS digit 4)*
The Shape layer answers one question: does this Viewer contain a popup on top of the View?

Shape is NOT a sub-type of View. It is its own layer. Shape components live in `shapes/`, not `views/`.

VVSS codes:
| Code | Description |
|---|---|
| 0 | Flat — no popup |
| 1 | Popup — `ModalView` container + a named Shape content component |

The Shape layer has two parts:
- **Container** — `ModalView` in `shapes/` wraps the popup shell (dialog, overlay)
- **Content** — a named `[DataType]Shape` component renders inside the popup

Shape content components follow the naming convention `[DataType]Shape.tsx` and live in `shapes/`.
They are NOT Skins. They are NOT Views.

---

## VVSS Four-Digit Code

Every repeating UI surface gets a four-digit VVSS code. See `VVSS.md` for full reference.

```
[Viewer][View][Skin][Shape]

1·1·1·1 = SinglePaneViewer + ScrollGridView + CardSkin + ModalView popup
1·1·1·0 = SinglePaneViewer + ScrollGridView + CardSkin + flat (no popup)
2·1·1·0 = TwoPaneViewer   + ScrollGridView + CardSkin + flat
1·2·1·1 = SinglePaneViewer + ScrollHorizontalView + CardSkin + ModalView popup
```

---

## Canon View Set  *(VVSS digit 2)*

There are exactly four canon Views. Do not invent additional View types unless the interaction model is fundamentally different.

### ScrollGridView
- A grid of items/cards that scrolls vertically
- Column count is a layout property, not a separate view type

### ScrollVerticalView
- A vertically stacked list of items/cards
- Used when items should be scanned downward

### ScrollHorizontalView
- A horizontal strip/rail of items/cards
- Used when items should be swiped sideways

### SingleView
- One focused content surface or one focused item
- Used for single-workspace experiences

**ModalView is NOT a View.** It is a Shape (popup container). It lives in `shapes/`, not `views/`.

---

## Canon Shape Set  *(VVSS digit 4)*

There is one canon popup container and one shape component per data type.

### ModalView  *(container)*
- The popup/dialog shell
- File: `shapes/ModalView.tsx`
- Used for: inspect, detail, editing flows launched from grid Views

### [DataType]Shape  *(content)*
- The content that renders inside the popup
- File: `shapes/[DataType]Shape.tsx`
- One Shape file per data type that has a popup

Current Shape components:
| Component | Data type | File |
|---|---|---|
| `SourceDetailShape` | GRF source original | `shapes/SourceShape.tsx` |

---

## Page Layouts Are NOT Canon View Types

A page may compose multiple Viewers. Page structure is composition, not a new core View.

Example: admin-blanks is NOT a special "TopBottomView". It is a page that composes:
- `ScrollHorizontalView` for the top catalog pane
- `ScrollGridView` for the bottom source pane
- `ModalView` (Shape) for detail/editing

---

## Site-Wide View Usage Guide

**Use ScrollGridView for:**
- Products browsing, store browsing, library tabs
- Templates, graphics, backgrounds
- Members library, store library

**Use ScrollVerticalView for:**
- Wizard tier lists, wizard product lists
- Narrow phone pickers, stacked list selection surfaces

**Use ScrollHorizontalView for:**
- Top catalog strip on admin-blanks
- Featured rails, quick selectors, compact shelves

**Use ModalView (Shape) for:**
- Admin blank detail editor
- Product detail popup, wizard product detail popup
- Library item preview
- Image/template/background preview
- Lightbox workflows

**Use SingleView for:**
- Focused single-item or single-workspace screens

---

## One Viewer System Only

There is NOT two different viewer systems. Any alternate viewer family must be folded into the same official architecture.

All UI experiences use this system:
- Admin blanks, product pickers, store product displays
- Graphics/template pickers, library pickers
- Other card/grid/modal selectors

Differences between pages are handled by different controllers, different views, different shapes, different skins — NOT by inventing a second viewer system.

---

## Shared Components Rule

```
client/src/features/shared/components/

  viewers/     ← Viewer components (digit 1)
  views/       ← View components (digit 2)
  skins/       ← Skin components (digit 3) — card content
  shapes/      ← Shape components (digit 4) — popups and their content
```

Pages and modules use these. They do not reimplement them.

---

## Phone-First Rule (Mandatory)

All viewer usage must be designed phone-first:
- Narrow screens are the default assumption
- Thumb-friendly controls are mandatory
- No dependence on wide desktop-only layouts
- Long editing happens in a modal Shape, not inside a tiny card
- Desktop can be an enhancement, not the baseline

---

## Description Cascade Model

Three description layers (full system):
1. **providerDescription** — Exact source description from Printify or Printful.
2. **adminCatalogDescription** — Global lasting admin override. Saved at catalog level in `catalog.blankDescriptions[canonicalBlankKey]`.
3. **memberPacketDescription** — Member-only override for that packet/item instance. Never writes back to admin/global.

Effective description: `adminCatalogDescription ?? providerDescription ?? fallback`

---

## Admin-Blanks Specific Rules

### Layout: Phone-First Top/Bottom
- TOP = Catalog pane (active working set, `ScrollHorizontalView`)
- BOTTOM = Source pane (browsing supply shelf, `ScrollGridView`, scrollable)
- Detail editing happens in `ModalView` (Shape), NOT inline in tiny cards

### Three Skins for Admin-Blanks

1. **AdminCatalogBlankSkin** — Top pane. Compact working-set card. Launch detail editor. Quick remove.
2. **AdminSourceBlankSkin** — Bottom pane. Source browser card. Add-to-catalog launcher.
3. **AdminBlankDetailSkin** — Shape content. Full detail display. Global admin description editor with save.

### Global Authority Rule
Admin changes the global catalog description. Save goes to `catalog.blankDescriptions[canonicalBlankKey]` only.
Does NOT save to Printify, packet, or user/customer state.

---

## What Must NOT Live in Viewer / View / Skin / Shape

- Canonical blank key truth
- Printify vs Printful identity truth
- Role truth / permission truth
- Save-target truth
- Description-layer truth
- Packet-vs-catalog write rules
- Provider source mapping truth
- Fallback policy for description sources

Those belong in domain + controller layers only.

---

## File Locations

```
client/src/features/shared/components/

  viewers/
    SinglePaneViewer.tsx         # Code 1 — one full-width pane
    TwoPaneViewer.tsx            # Code 2 — side by side

  views/
    ScrollGridView.tsx           # Code 1 — vertical scroll, grid
    ScrollVerticalView.tsx       # Code 1 — vertical scroll, list
    ScrollHorizontalView.tsx     # Code 2 — horizontal scroll
    SingleView.tsx               # Code 0 — no scroll

  shapes/
    ModalView.tsx                # Popup container (Shape code 1)
    SourceShape.tsx              # SourceDetailShape — source GRF popup content

  skins/
    SourceSkin.tsx               # SourceCardSkin — source GRF card
```

---

## Implementation Status — CURRENT

### Canon View Files (`views/`)
- `SingleView.tsx`
- `ScrollGridView.tsx`
- `ScrollVerticalView.tsx`
- `ScrollHorizontalView.tsx`

### Canon Shape Files (`shapes/`)
- `ModalView.tsx` — popup container
- `SourceShape.tsx` — `SourceDetailShape`

### Canon Skin Files (`skins/`)
- `SourceSkin.tsx` — `SourceCardSkin`

### Canon Viewer Files (`viewers/`)
- `SinglePaneViewer.tsx`
- `TwoPaneViewer.tsx`

### Removed Legacy Files
- `ScrollView.tsx` → replaced by `ScrollGridView` + `ScrollVerticalView` + `ScrollHorizontalView`
- `ContentView.tsx` → replaced by `SingleView`
- `GridView.tsx` → replaced by `ScrollGridView` with `renderItem`
- `GridScrollView.tsx` → replaced by `ScrollGridView` with `renderItem`
- `GalleryView.tsx` → replaced by `ModalView` (now in `shapes/`)
- `ImageLightbox.tsx` → replaced by `ModalView` pattern
- `SkinGridViewer.tsx` → folded into `ScrollGridView` + `ModalView` composition

---

This is the canon. Build to this and do not improvise.
