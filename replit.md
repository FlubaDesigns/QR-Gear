# QR Gear Admin Platform

Firebase-hosted e-commerce admin platform for creating and selling QR-code-integrated apparel and products.

## Run & Operate

```bash
npm run dev          # Start Express + Vite dev server (port 5000)
npm run build        # Build frontend for production
```

**Deploy frontend:** `bash deploy/1-build.sh` then `bash deploy/3-hosting.sh` (never chain 2+3)
**Deploy functions:** Bump `_BUILD_ID` in `functions/src/index.ts` + `version` in `functions/package.json` first

Required env vars: `FIREBASE_SERVICE_ACCOUNT_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `RESEND_API_KEY`, `VITE_FIREBASE_*`

## Stack

- **Frontend:** React 18 + Vite + TypeScript + TanStack Query v5 + Wouter + Shadcn/ui + Tailwind
- **Backend (dev):** Express (`server/`) serving API + Vite frontend on same port
- **Backend (prod):** Firebase Cloud Functions (`functions/src/`)
- **Database:** Firestore (NoSQL)
- **Storage:** Firebase Storage
- **Auth:** Firebase Auth + Replit Auth (`isAdmin` middleware)
- **Payments:** Stripe
- **Email:** Resend (NexusMail)
- **Print providers:** Printify, Printful, Apliiq

## Where things live

```
client/src/
  pages/               # Route page components
  features/adminProducts/
    builder/           # Product graphic builder (BuilderContext, BuilderHarness)
    controllers/       # useAdminBlanksController, etc.
    storeBuilder/      # Store builder
    ADMIN_README.md    # Detailed admin section guide (source of truth for admin docs)
  features/shared/graphics/  # productGraphicRenderer.ts — canvas engine
server/routes/         # Express API routes (dev server only)
functions/src/routes/  # Cloud Functions API routes (production)
shared/                # Code shared across all layers
  schema.ts            # Main Drizzle schema
  blankKeys.ts         # isQRGBlankId, getCanonicalBlankKey helpers
  qrgCodes.ts          # isValidMasterCatalogDocId, QRG code helpers
  __tests__/           # Vitest unit tests
```

Key source-of-truth files: `shared/blankKeys.ts`, `shared/qrgCodes.ts`, `docs/QRG.md`, `ADMIN_README.md`

## UI Architecture — VVSS

All repeating data surfaces follow the VVSS (Viewer / View / Skin / Shape) methodology.
Full spec: `VVSS.md`. Binding law: `ARCHITECTURE_VIEWER.md`.

```
viewers/   — pane structure (1 = single, 2 = two-pane)
views/     — scroll/layout (0 = SingleView, 1 = VScrollView, 2 = HScrollView, 3 = SlideView, 4 = TableView, 5 = FocusView)
skins/     — card content ([DataType]CardSkin)
shapes/    — popup layer (ModalView container + [DataType]Shape content)
```

VVSS four-digit code: `[Viewer][View][Skin][Shape]` — e.g. `1·1·1·1` = single pane + grid + CardSkin + popup.
Layer order: Viewer wraps View, View contains Skins, Shape floats on top when a Skin is selected.

## Architecture decisions

- Dev server (`server/`) and Cloud Functions (`functions/src/`) both implement the API — always make matching changes to both when adding routes.
- `master_catalog` Firestore collection uses `qrg_STNNN` doc IDs as the canonical blank identity. Provider IDs (`py_`, `pf_`, `pf:`) are lookup/reference only and must never be persisted in `catalog.blankIds` or overlay maps.
- QRG variant suffix is **TSSLLCC** (7 digits): T=size type (1 digit), SS=size within type (2 digits), LL=length (2 digits, `00`=none; only non-00 for T=2 Adult Numeric/waist), CC=color (2 digits). Full code: `QRG-[STNNN]-[C]-[NNNNNN]-[TSSLLCC]`. Key helpers: `getSizeCode()` → 3-char TSS, `getLengthCode()` → 2-char LL, `buildVariantSuffix(size, length, color)` → 7-char.
- `resolveCatalogBlankId()` in `server/routes/admin-catalogs-shelf.routes.ts` is the single resolution path from any provider key → `qrg_STNNN`. Always use it before any catalog write.
- `expandBlankIdSet()` in the frontend controller reads legacy Firestore data — keep it; do not remove.
- Frontend uses `allProductMap` with multi-key indexing for display lookup only — these keys are never persisted.

## Product

- Admin panel at `/admin` with sections: Run, Build, Place, Sell, System
- Product graphic builder with QR code placement and sizing
- Blank catalog curation (admin-blanks page) with catalog assignment, tier/title/description overlays
- Store builder to configure storefronts and assign products
- Order management, pricing, fulfillment routing (Printify/Printful/Apliiq)
- NexusMail for transactional emails via Resend

## User preferences

- Always deploy after code changes (see `always-deploy` skill)
- Ask clarifying questions before starting any task (see `ask-before-starting` skill)
- Fail loudly — never let errors happen silently (see `fail-loudly` skill)
- Present changed files as downloadable assets after each task (see `present-changed-files` skill)
- Never show canvas exploration suggestions in chat

## Gotchas

- NEVER edit `package.json` scripts or `drizzle.config.ts`
- NEVER modify `server/vite.ts` or `vite.config.ts`
- NEVER touch `server/routes/` — the dev server is irrelevant; all backend work goes in `functions/src/` only
- The QRG STNNN format is 5 digits: `qrg_11001`. Legacy 4-digit (`qrg_1101`) and 3-digit (`qrg_101`) are invalid.
- Catalog overlay maps (`blankTiers`, `blankDescriptions`, etc.) must always use the same keys as `blankIds`
- Deploy: `deploy/1-build.sh` (90s) then `deploy/3-hosting.sh` (75s) — never chain them directly

## Pointers

- Admin guide: `client/src/features/adminProducts/ADMIN_README.md`
- QRG identity: `docs/QRG.md`, `shared/qrgCodes.ts`
- Blank key helpers: `shared/blankKeys.ts`, `shared/__tests__/blankKeys.test.ts`
- Canonical Field Authority (CFA): `shared/adapters/catalog.adapter.ts` — the one approved translation boundary for catalog→UI fields
- Skills: `.agents/skills/always-deploy`, `.agents/skills/ask-before-starting`, `.agents/skills/fail-loudly`

## Canonical Field Authority (CFA)

Provider/Firestore fields are NOT UI fields. All raw data must pass through `shared/adapters/catalog.adapter.ts` before components consume it.

Canonical UI field names (non-negotiable):
- `availableColors` — never `colorsAvailable`, `colorOptions`, `colors` (catalog context)
- `availableSizes` — never `sizesAvailable`, `sizeOptions`, `sizes` (catalog context)

Rule: if a field name is wrong in a component, fix the adapter — not the component. Components must never alias, fall back to, or guess provider field names.

Full spec: `ADMIN_README.md` → "CANONICAL FIELD AUTHORITY" section
