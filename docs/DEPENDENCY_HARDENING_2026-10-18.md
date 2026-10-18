# QR Gear dependency hardening — 18 October 2026

Baseline: Main `2c7f97974ea37619a083de66ad913208c7061479`.
Candidate: build `20261018-dependency-hardening`, Functions `1.0.382433`.

## Changes

- Upgrade both Drizzle installations to 0.45.4, fixing SQL identifier escaping while retaining the existing drizzle-zod 0.7 schema contracts. QR Gear uses the shared static schemas; this change does not introduce a SQL database or migrate data.
- Upgrade Google Storage to pinned 7.22.0 and override UUID to 11.1.1 in both dependency trees. All traced Google SDK callers use the compatible `v4()` API. Version 11.1.1 retains CommonJS support and fixes the optional-buffer bounds advisory; blindly installing the newest ESM-only major would be inappropriate for Functions.
- Align root Canvas with the existing Functions 3.2.3 renderer, removing the obsolete node-pre-gyp/tar installation chain.
- Update root Firebase Admin to 13.10.0 and compatible HTTP/CLI transitive patches, removing critical and other fixable advisories. Keep Firebase browser SDK 12.6.0 and existing React/Stripe/application contracts.
- Upgrade Vite from 5.4.20 to 6.4.4, Vitest to 4.1.12, and Node 20 type declarations. Keep Tailwind 3 and its existing configuration. Override gRPC to patched 1.14.6 within its 1.x API and postcss-selector-parser to 7.1.6.
- Preserve existing Authorization Engine deployment and validation gates. No member data, payments, orders, supplier submissions or credentials were changed by this work.

## Verification

- Clean `npm ci` with Node 20.20.2/npm 10.8.2: root 1,254 packages; Functions 375 packages. Both completed successfully. Earlier npm peer-resolution errors and invalid lockfile attempts are not part of this release.
- Full guarded regression suite: 411 client/shared tests in 63 files, 573 Functions tests in 74 files; 984 passed.
- Firestore emulator: seven member/profile access tests passed against the patched gRPC dependency.
- Client TypeScript check and Functions compilation passed.
- Production build passed, including 66 generated discovery pages and layout/discovery checks. All 2,771 baseline CSS selectors are present after the parser/toolchain update.
- Offline checks against real installed packages in both trees passed: native Canvas PNG output, Google SDK UUID resolution and generation, rejection of undersized UUID buffers, Storage/Firestore object construction, and quoted SQL identifier escaping. These checks performed no external writes.
- No browser application imports braces, the CLI Pub/Sub client, or OpenTelemetry. Functions has its own separately audited dependency lock. Hosting serves the built static assets.

## Audit result and remaining scope

The complete Functions dependency audit reports **zero known vulnerabilities** (previously nine: one high and eight moderate). The baseline complete root audit reported 78 affected package entries (5 critical, 42 high, 27 moderate, 4 low). The complete root audit now reports **ten** affected package entries: zero critical, eight high, two moderate. These ten entries come from two underlying tooling advisories, not ten independent application vulnerabilities:

| Advisory | Dependency path | Scope and decision |
| --- | --- | --- |
| [GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm) | braces → micromatch/fast-glob/chokidar → Tailwind/typography/animate and Firebase CLI | Deeply nested glob patterns can exhaust the stack. No patched braces version is published in the audit result. Build paths/patterns come from repository configuration, not customer requests. Retain Tailwind 3 to avoid an unrelated visual migration during beta. |
| [GHSA-8988-4f7v-96qf](https://github.com/advisories/GHSA-8988-4f7v-96qf) | OpenTelemetry core 1.x → Google Pub/Sub → Firebase CLI | Baggage propagation can allocate excessive memory. This is CLI tooling, not the Functions or browser dependency graph. Do not override its 1.x telemetry core with incompatible 2.x merely to clear a scan. |

The reported counts include development dependencies; no findings were hidden by reclassifying packages. The release controller also installs its separately pinned Firebase CLI 15.29.0; this source update does not claim to remove that external tooling's advisories.

Other authoritative fixes: [Drizzle](https://github.com/advisories/GHSA-gpj5-g38j-94v9), [UUID](https://github.com/advisories/GHSA-w5hq-g745-h8pq), [selector parser changelog](https://github.com/postcss/postcss-selector-parser/blob/main/CHANGELOG.md).

## Release and beta acceptance

The existing Authorization Engine must publish this exact Main revision and verify matching Hosting/API markers, deployed database rules, privacy/admin boundaries and authenticated Brain/provider checks. Its run result is the deployment receipt; local test success alone does not establish a live release.

Dave's planned shirt creation test remains necessary for signed-in device acceptance. A real purchase, supplier order and physical garment/QR check are not established by these automated tests. This dependency work does not declare production readiness by itself.

## Changed files / source bundle

Updated `package.json`, `package-lock.json`, `functions/package.json`, `functions/package-lock.json`, `functions/src/index.ts`, both READMEs, this report and `MANIFEST.json`. The existing `downloads/QR_Gear_Full_Website.zip` is updated with the changed source/documentation files only; lockfiles and compiled Functions output remain excluded under the repository's bundle rules. Lockfiles are committed separately in the repository for reproducible installs.
