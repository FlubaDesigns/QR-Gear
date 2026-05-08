# Firestore Data Model

> **This document is superseded.** It described a pre-QRG Postgres-to-Firestore migration that is no longer relevant.

## Current Authority

The authoritative data model documentation lives in:

- **`docs/QRG.md`** — QRG identity system (`qrg_STNNN` blank identity, format rules)
- **`client/src/features/adminProducts/ADMIN_SCHEMA_MAP.md`** — Full schema chain (QRG → BLD → GRF → Assembly → Packet → Instance)
- **`shared/qrgCodes.ts`** — QRG identity helpers and validation
- **`shared/blankKeys.ts`** — Blank key derivation helpers
- **`shared/assemblyCodes.ts`** — Assembly code helpers
- **`shared/graphicCodes.ts`** — GRF graphic code helpers

## Live Firestore Collections

| Collection | Doc ID format | Purpose |
|---|---|---|
| `master_catalog` | `qrg_STNNN` | Canonical blank product records |
| `bld_definitions` | `BLD-SZ9-001` | Build/layout definitions |
| `bld_counters` | `SZ`, `SP`, etc. | Atomic BLD sequence counters |
| `grf_assets` | `GRF-TT-K-NNNNNN` | Graphic/asset file records |
| `grf_counters` | `{TT}_{K}` | Atomic GRF sequence counters |
| `assemblies` | `ASM-NNNNNN` | QRG + BLD + GRF join records |
| `catalogs` | auto-id | Admin curated blank catalogs |
| `admin_catalog_instances` | auto-id | Committed product instances |
| `admin_build_shelf` | auto-id | Admin build shelf entries (shelfKey = `qrg_STNNN`) |
| `admin_build_sessions` | auto-id | Builder session state |
| `email_outbox` | auto-id | NexusMail outbox queue |
| `email_templates` | auto-id | Email template records |

> Provider IDs (`py_NNN`, `pf_NNN`, `pf:NNN`) are lookup references only. They are **never** persisted as document identity in any collection.
