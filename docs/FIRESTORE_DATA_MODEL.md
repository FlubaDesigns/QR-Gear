# Firestore data model

Read the root `QRG.md`, `BLD.md`, `GRF.md`, and `ASSEMBLY.md` for canonical identity and composition rules.

Current implementation references:

- `functions/src/constants.ts` — collection names
- `client/src/features/adminProducts/ADMIN_SCHEMA_MAP.md` — saved build and product relationships
- `shared/qrgCodes.ts`, `shared/blankKeys.ts`, `shared/assemblyCodes.ts`, `shared/graphicCodes.ts` — shared identity validation

Firestore is the only application database. Preserve existing IDs and records; backend retirement requires no data migration.
