# QR Layout Export

## What This Is

This folder contains full, unedited copies of every file related to the QR product graphic layout system. These were copied directly from the live project on April 7, 2026 so they can be handed off for exact review and rewrite.

## Files Included (7 files — exist in the project)

| File | Original Path |
|------|--------------|
| `productGraphicRenderer.ts` | `client/src/features/shared/graphics/productGraphicRenderer.ts` |
| `UnifiedGraphic.tsx` | `client/src/features/shared/components/UnifiedGraphic.tsx` |
| `landingPageRenderer.ts` | `client/src/features/shared/graphics/landingPageRenderer.ts` |
| `ProductGraphicTextModule.tsx` | `client/src/features/adminProducts/builder/modules/ProductGraphicTextModule.tsx` |
| `PlacementModule.tsx` | `client/src/features/adminProducts/builder/modules/PlacementModule.tsx` |
| `BuilderContext.tsx` | `client/src/features/adminProducts/builder/BuilderContext.tsx` |
| `types.ts` | `client/src/features/adminProducts/builder/types.ts` |

## Files That Do NOT Exist Yet (4 files — not in the project)

These files were requested but do not currently exist anywhere in the codebase. They would need to be created from scratch:

| File | Intended Path |
|------|--------------|
| `graphicZones.ts` | `client/src/features/shared/graphics/graphicZones.ts` |
| `zoneLayout.ts` | `client/src/features/shared/graphics/zoneLayout.ts` |
| `qrLayout.ts` | `client/src/features/shared/graphics/qrLayout.ts` |
| `qrSafety.ts` | `client/src/features/shared/graphics/qrSafety.ts` |

## What Was Changed Before This Export

The following edits were made to `productGraphicRenderer.ts` before this export was taken. These are the changes currently live in the project compared to the original zip version:

1. **Header zone height**: Changed from `H * 0.13` to `H * 0.25`
2. **Footer zone height**: Changed from `H * 0.09` to `H * 0.25`
3. **Middle zone minimum**: Changed from `H * 0.30` to `H * 0.20`
4. **Top/bottom padding**: Reduced from `H * 0.035` / `H * 0.03` to `H * 0.02` / `H * 0.02`
5. **Section gap**: Reduced from `H * 0.012` to `H * 0.01`
6. **SubBottom zone height**: Changed from `H * 0.05` to `H * 0.04`
7. **QR max size percent**: Changed from `clamp(_, 30, 55)` to `clamp(_, 30, 62)`
8. **QR internal insets**: Changed from `max(8, middleZoneHeight * 0.015)` to `max(6, middleZoneHeight * 0.01)`
9. **Footer text rendering**: Replaced generic `drawTextInZone()` call with inline code that measures text width and auto-scales the font to keep footer text on a single line (max width = 85% of canvas)

## Current Known Issues

- QR code is still rendering too large relative to the overall composition
- Footer text positioning has a visible gap from the QR
- The zone proportions (head/middle/foot) are not producing the intended balanced layout
- The four missing files (`graphicZones.ts`, `zoneLayout.ts`, `qrLayout.ts`, `qrSafety.ts`) suggest the layout logic should be broken out of the monolithic renderer into separate, focused modules
