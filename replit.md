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
  graphicCodes.ts      # buildGrfId, parseGrfId, isValidGrfId — GRF identity system
  __tests__/           # Vitest unit tests
QRG.md                 # QRG identity system — canonical source of truth
GRF.md                 # GRF graphic asset schema — canonical source of truth
BLD.md                 # BLD build definition schema — canonical source of truth
```

Key source-of-truth files: `shared/blankKeys.ts`, `shared/qrgCodes.ts`, `shared/graphicCodes.ts`, `QRG.md`, `GRF.md`, `BLD.md`, `ADMIN_README.md`

## Architecture decisions

- Dev server (`server/`) and Cloud Functions (`functions/src/`) both implement the API — always make matching changes to both when adding routes.
- `master_catalog` Firestore collection uses `qrg_STNNN` doc IDs as the canonical blank identity. Provider IDs (`py_`, `pf_`, `pf:`) are lookup/reference only and must never be persisted in `catalog.blankIds` or overlay maps.
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

## Gotchas

- NEVER edit `package.json` scripts or `drizzle.config.ts`
- NEVER modify `server/vite.ts` or `vite.config.ts`
- The QRG STNNN format is 5 digits: `qrg_11001`. Legacy 4-digit (`qrg_1101`) and 3-digit (`qrg_101`) are invalid.
- Catalog overlay maps (`blankTiers`, `blankDescriptions`, etc.) must always use the same keys as `blankIds`
- Deploy: `deploy/1-build.sh` (90s) then `deploy/3-hosting.sh` (75s) — never chain them directly

## Pointers

- Admin guide: `client/src/features/adminProducts/ADMIN_README.md`
- QRG identity: `QRG.md`, `shared/qrgCodes.ts`
- GRF graphic assets: `GRF.md`, `shared/graphicCodes.ts`
- BLD build definitions: `BLD.md`
- Blank key helpers: `shared/blankKeys.ts`, `shared/__tests__/blankKeys.test.ts`
- Skills: `.agents/skills/always-deploy`, `.agents/skills/ask-before-starting`, `.agents/skills/fail-loudly`
