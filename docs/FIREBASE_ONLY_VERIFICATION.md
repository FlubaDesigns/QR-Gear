# Firebase-only cleanup — verification

Verified October 17, 2026 against baseline `b59b55fc98c55d8e5f73c9c579d6acb627b04e8b`.

## Provenance and scope

The supplied patch SHA-256 is `02d61ae3ff40cd54a8afca292806dd7b1f09a364b748efb5ea25bb3db51c3c82`. It applied in an isolated clean checkout. Before follow-up edits, its staged tree exactly matched `60d43958edae673b9df2f1aad90a4d149ff6f05a` (154 paths: 132 deleted, 19 modified, 3 added).

The final source intentionally extends that candidate: it removes remaining Replit database/auth integrations, the unused storage-mode selector, SQL migrations and retired-server guidance; updates current operating references and the export; and strengthens the backend boundary guard. Shared Drizzle/Zod validation is retained because Firebase uses it. All tracked `functions/` files, shared runtime modules, and QRG/BLD/GRF/Assembly authority files remain byte-identical to baseline. Generated Functions build output was discarded after successful compilation. No stored data or provider account was changed.

## Defect found and corrected

The supplied lockfile removed `hono` despite the retained `@hono/node-server` peer requirement from Firebase tooling. A standard `npm ci --dry-run` failed with a missing peer package. Restoring the exact baseline `hono@4.11.3` lock entry fixes the normal install path without adding a direct dependency or changing any surviving version. A fresh standard `npm ci --no-audit --no-fund` then succeeded on Node 20. The final lockfile removes 113 package entries, adds none relative to baseline, and changes no surviving package version. The 19 removed direct dependencies remain removed.

## Independent verification

| Check | Result |
|---|---|
| Original patch integrity and reconstructed tree | Exact match |
| Client baseline | 293 passed, 0 failed |
| Final client suite after standard install | 296 passed, 0 failed |
| Account logout regressions (included above) | All 3 passed |
| Functions baseline | 432 passed, 32 failed, 464 total |
| Final Functions suite | 432 passed, 32 failed, 464 total; exact failing names match baseline |
| Brain connection fixture suite | 8 passed |
| Root TypeScript | Passed |
| Functions TypeScript compilation | Passed |
| Canonical layout | Passed: 107 routes, 114 page/view files; Master unchanged |
| Vite production build | Passed; existing chunk-size and Browserslist warnings |
| Discovery build and verification | Passed: 66 public pages, metadata, structured data, asset links, sitemap and AI guide |
| Local Vite dev/preview proxy checks | 8 passed using an in-memory loopback fixture |
| Firebase-only boundary | Passed: 786 source/test/script files scanned |
| Root standard locked install | Passed after restoring the required existing peer |
| Functions standard lockfile dry-run | Passed |
| Manifest, archive source correspondence and diff whitespace | Passed |

Client tests used Node 20 and Functions tests Node 22, with external socket/fetch calls blocked and only the existing non-secret Main project ID supplied. No live credentials were supplied to regression tests. Discovery's initial Node 20 fetch failed to resolve the public hostname; the read-only discovery step passed on the proxy-enabled Node 24 host runtime. Deployment should repeat the full build on its standard runner. No live payment, fulfillment, database write or supplier job was performed.

The 32 existing failure names are in the following suites: `admin-catalog-routes.test.ts` (1), `catalog-markup.test.ts` (7), `checkout-production.test.ts` (4), `orchestration-catalog.test.ts` (1), `packet-pricing.test.ts` (14), and `store-placement.test.ts` (5). This is regression equivalence, not an all-green backend certification.

## Packaging and operational boundaries

The supplied four archive deltas removed only 21 retired backend entries; their other unchanged members were compared byte-for-byte. Their 17 changed/new export source entries matched the supplied candidate. Follow-up packaging removes deleted migration/memory entries where present and updates the main source export with the final changed files. Unrelated historical archives, artwork and uploaded assets remain unchanged.

Vite proxies `/api`, `/webhooks` and `/qr/d` only to loopback Firebase Hosting. Auth, Firestore, Storage and external providers are not automatically isolated by those emulators. No alternate database/server startup path is supported.

## Audit and release status

The original audit is not rewritten. The handoff's D-01–D-17 and O-13 concern the removed backend; their implementation is absent from this candidate. QRG-068 has a source fix and regression coverage. The handoff's 73 remaining application/release findings (17 P1, 51 P2, 5 P3), including QRG-008 and QRG-065, are not closed by this work. This is not a new broad audit or dependency advisory review.

Source publication must be verified against the actual remote commit/tree. This report alone is not proof of publication or deployment. The production controller in `FlubaDesigns/fluba-designs` still owns release, and its pointer is separate from QR Gear source. No production-release pointer is changed by this source cleanup.
