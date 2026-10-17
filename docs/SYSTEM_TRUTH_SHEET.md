# QR Gear — System references

Updated October 17, 2026. Firebase is the sole backend and database platform. The former dual-backend ownership table and retired adapter file map have been removed.

Canonical identity and composition rules live in the root `QRG.md`, `BLD.md`, `GRF.md`, and `ASSEMBLY.md`. This page does not redefine them.

- Backend entry point: `functions/src/index.ts`
- Database: Firestore; current collection constants: `functions/src/constants.ts`
- Authentication: Firebase Auth and the existing server-side admin policy
- Files: Firebase Storage, with the existing GRF and private-file access rules
- Shared validation and types: `shared/`; these are not a database driver
- Local development and backend boundaries: `docs/FIREBASE_BACKEND.md`
- Admin data flow: `client/src/features/adminProducts/ADMIN_SCHEMA_MAP.md`

Retiring the alternate backend does not rename collections, migrate stored records, or change the supported Firebase sales paths.
