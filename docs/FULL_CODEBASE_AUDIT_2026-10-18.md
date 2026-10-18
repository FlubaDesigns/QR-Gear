# QR Gear beta codebase audit — October 18, 2026 UTC

Baseline: `0532cda9861f3d34855856239ca1b42fd1000778` (Main and the verified live release at audit start).
Release marker: `20261018-beta-audit-boundaries`.

## Scope and approach

Reviewed the current Firebase codebase across authorization, public/private publication, member and owner builds, checkout, referral attribution, refunds, fulfillment, media, legacy APIs, browser contracts, database/storage rules, dependencies, and release gates. The initial inventory covered 901 files under client/source/shared/scripts/tests and 613 unique literal API route declarations; helper-generated routes also exist. Inventory counts are coverage aids, not a claim that every line or every possible state was exhaustively proven correct.

The previous ordered QRG-001–074 audit remains in `AUDIT_REPAIRS.md`. This follow-up goes beyond that list. Changes were isolated in a separate Git worktree. Reproductions use controlled accounts, storage, payment and provider fixtures; no real purchase, payout, email or customer-record mutation was performed for the audit.

## Confirmed findings and repairs

| Area | Confirmed issue | Repair and compatibility check |
|---|---|---|
| Referral integrity and privacy | Anonymous capture accepted another buyer's identity; anonymous lookup returned referral records. A separate legacy admin earnings writer accepted caller totals and could create repeated entries. | Unverified capture and manual earnings endpoints now return 410. Lookup requires admin. Verified checkout retains its canonical transactional attribution/earnings path. Existing referral history is preserved. No active client callers of the retired writers were found. |
| Public publication boundaries | Member packet, crawler, old rotation, legacy product and widget mosaic reads could expose drafts, disabled products or hidden links. | Apply publication/visibility checks before serialization or member production projection. Bound member builds must match the exact published production packet and owner. Legacy published member packets without a production link remain readable. Enabled legacy products with no status retain compatibility; active and published widget mosaics remain readable. |
| Member checkout availability | Publication and cart fulfillment read the nonexistent `member_packets` spelling instead of the canonical `MEMBER_PACKETS_COLLECTION` (`memberPackets`). | Use the shared constant. A real service test quotes a published member product from the canonical collection and rejects a mismatched production owner. No collection migration or duplicate collection was created. |
| Social metadata injection | Stored social image URLs were interpolated into HTML attributes without escaping. Packet identifiers also entered metadata/redirect strings unencoded. | Escape image and canonical URL attributes and encode path identifiers. Tests include a stored quote/script payload and prove drafts are withheld. |
| Legacy administrative routes | Public mockup requests could change shared product defaults or write an arbitrary temporary packet; cache/job diagnostics and legacy collection listings exposed records without admin authorization. | Require the existing admin middleware on legacy provider utilities, job/cache diagnostics, template/link listings and public-named legacy rendering routes. Current public wizard uses its capability-scoped build API; member graphic generation remains authenticated and available. Guards are tested for anonymous/ordinary users and positive admin access. |
| Legacy mockup cache | A secondary cache lookup omitted artwork identity and could return another design's preview. | Remove that secondary lookup and use the existing canonical generator, whose cache includes artwork identity. |
| Hosted image privacy | Anyone could enumerate another user's images; public detail endpoints returned ownership/storage/future private fields and inactive records. | User lists require the matching signed-in UID and no-store caching. Public details return an explicit display projection and reject inactive records. Owner listing and public image display fields are tested. This does not revoke previously public Cloud Storage URLs. |
| Hosted image viewer | The browser used a JSON API endpoint as its image source and did not handle missing/Firestore dates correctly. | Render the projected public image URL, normalize dates at the API, and display a missing-date fallback. Component test verifies the rendered source. |
| Signed upload contract | The hook omitted authentication; server/client field names disagreed; timestamp-only names could collide. | Use the existing authenticated request helper, return the expected uploadURL/objectPath/metadata fields while retaining old aliases, validate metadata size/type/name, and namespace paths by UID plus UUID. File PUTs go only to the signed URL without an app auth header. Declared size validation is not a substitute for server inspection of uploaded object bytes. |
| Brain response privacy | Every signed-in account could directly read administrative `brain_responses`. | Firestore reads now require admin. Emulator tests prove ordinary and anonymous denial and admin access. Current client code has no non-admin listener for this collection. |
| Refund/fulfillment race | A provider shipping sync could overwrite a refund/cancellation status after a refund arrived during the provider request. | Re-read the current order transactionally, verify the provider binding, preserve refund/cancellation/production-hold state, and still save shipment evidence. Tests cover a refund arriving during sync and the existing normal shipping flow. |
| Backend dependency advisories | The Functions locked production dependency tree reported 21 advisory entries, including two critical. | Apply compatible lockfile updates, then perform an isolated clean install and the full suite. The resulting Functions tree reports nine entries: one high and eight moderate, zero critical. Advisory counts include transitive/metavulnerability entries and do not themselves establish exploitability. |

## Validation completed locally

- Clean `npm ci` installations for root and Functions, using the release-compatible Node 20/npm 10 toolchain.
- `npm test`: 411 client/shared tests in 63 files and 573 Functions tests in 74 files — **984 passed**.
- Actual Firestore rules in a demo emulator: **7 passed**, covering profile privilege boundaries, published legacy products and administrative Brain responses.
- `npm run check` and `npm --prefix functions run build`: passed.
- `npm run build`: passed; **66 public/store/product discovery pages** verified for metadata, canonical URLs, structured data, asset links, sitemap and AI guide. Local discovery fetches used the runtime's configured proxy support.
- Source diff whitespace check and repository manifest verification are required before publication.
- Release uses the existing Authorization Engine controller, with fresh installs, the full regression suite, builds, rule verification, Hosting/API markers and authenticated Brain/provider checks. The Actions run and live marker are the deployment receipt; this document alone does not assert deployment completion.

## Beta stability and remaining work

No schema migration, bulk repair of historical customer data, redesign, pricing change or provider replacement is included. Retired/guarded legacy routes intentionally change their authorization or return status; external callers outside this repository were not exercised. Canonical member/owner checkout, build and publication flows remain the supported paths.

The root dependency upgrade was rejected from this release after its automatically generated lockfile failed the existing clean-install gate. The original root package/lockfile is retained and its fresh install passed. Its initial production-labelled audit reports 74 entries (five critical); this root package also includes build/deployment tooling and unused legacy server dependencies. Broader dependency upgrades require a separate beta-compatible update, not `audit fix --force`. The Functions residual advisories include Drizzle and the Google Storage/Admin dependency chain. This audit did not find active SQL query execution in the retained Functions/shared source, but that is not a general security exemption. No zero-vulnerability claim is made.

Real purchases/refunds, supplier production, all signed-in devices, every partner integration and upload completion against real storage were not replayed. The permission/transaction tests are strong regression evidence, not a guarantee of a bug-free beta. Historical referral attribution and previously public assets were not rewritten automatically.

Rollback source is the baseline commit above. If a release regression is confirmed, use the same Authorization Engine release process with a reviewed revert; do not bypass the current-Main pin or permission gates.
