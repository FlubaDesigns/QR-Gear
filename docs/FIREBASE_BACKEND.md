# Firebase-only backend

As of October 17, 2026, `functions/src/index.ts` is the only application backend entrypoint. Its Express route registration is part of Firebase Cloud Functions and remains supported. Firebase Hosting serves `dist/public` and rewrites `/api/**`, `/webhooks/**` and `/qr/d/**` to `api`.

## What was retired

- The entire separate `server/` tree, including its storage adapters, HTTP listener, cron jobs and Replit Stripe initialization.
- Root esbuild/Node-server launch commands, Replit autoscale deployment, database push commands, SQL migration files, and the alternate database configuration/integrations.
- `scripts/refresh-color-hex.ts` and `scripts/seed-placements.ts`, which depended exclusively on the retired adapter. Existing Firebase admin catalog-sync and print-placement routes remain unchanged; use their reviewed authenticated workflows instead of these scripts.
- The test for the retired, production-unused domain mapper. No runtime utility needed relocation: retained application code has no import from the removed backend.
- Only retired backend entries inside historical source archives. Unrelated archived files and uploaded images are retained. The retired SQL migration files and database provisioning settings are removed; this does not execute a migration or delete stored data.

## What stays

All Firebase route families, including admin storefront, member, public builder, gift, partner/widget, marketplace and historical sales compatibility paths, stay in place. `shared/` schemas and their Drizzle/Zod dependencies are still used for validation/types and are not an alternate database implementation. QRG, GRF, BLD and Assembly authority and all stored data remain unchanged.

Account Sign Out now calls the existing Firebase sign-out helper (including the private-file session cleanup), waits for completion, cancels cached reads, clears cached account data and returns home. Failure is visible and retryable. It no longer navigates to the removed development-only logout URL.

## Development and validation

- `npm run dev`: Vite frontend on loopback port 5173.
- `npm start`: local Vite preview of the built frontend on port 4173. This is a preview, not a production application server.
- Both proxy the three Firebase backend prefixes to `http://127.0.0.1:5000`, the configured local Firebase Hosting emulator. There is no fallback to a deployed backend.
- The backend is built with `npm --prefix functions run build`. A separately and explicitly configured `firebase emulators:start --only functions,hosting --project <approved-project>` uses that same code and Hosting rewrite configuration. Review the chosen project, credentials and connected resources before starting it.

**Isolation limitation:** the current runtime accepts only the existing Main/sandbox project identities, and browser Auth, Firestore and Storage do not have emulator connection switches. Starting Hosting/Functions emulators alone does not isolate those services or supplier/email/payment APIs. Do not treat this as an offline full-stack environment or run it against live credentials for tests. Full data-isolated emulator support is separate work. This retirement does not modify production authentication or relax runtime project checks.

`npm run check`, `npm run layout:verify`, `vite build`, and the existing client/Functions regression suites can be run with local fixtures. `npm run build` retains the existing crawler-discovery build: it reads public production catalog APIs. It is not an offline build. No deployment, account mutation, database migration or supplier action is needed to validate backend removal.

## Release and archive handling

Use the existing Firebase release workflow after review/authorization. This source change does not deploy itself. Do not restore the retired listener, duplicate its routes, or deploy a Replit/Node substitute. Historical release notes mentioning two adapters describe the previous architecture.

When packaging a deletion, remove the exact deleted entries with `zip -d`, then update only changed/new source entries with `zip -u`. Preserve unrelated archive content. Never export dependency directories, generated Functions output or credentials.
