# QR Gear ordered audit repairs

The October 17 audit is checked against the retained Firebase code. D-01–D-17 and O-13 belong to the removed development backend and are excluded. Existing canonical QRG, BLD, GRF and Assembly definitions remain authoritative.

## QRG-001 — Stripe account ownership

Problem: ordinary members could write arbitrary `member_profiles` fields, including the account ID and payout flag used by privileged Connect endpoints. Checking that a caller owns the profile did not prove that they owned the referenced Stripe account.

Repair:
- Client Firestore access permits only typed tutorial progress. Financial and membership fields use server-controlled writers; member deletion and replacement of privileged data are denied.
- A shared account check requires the retrieved Stripe Express account to identify the member in its server-created `metadata.entityId`.
- Onboarding reuse, refresh, status, dashboard links and packet checkout use that check. Current Stripe status determines dashboard/payout eligibility; historical profile flags do not establish it.
- Account-update webhooks address the metadata owner and require an exact existing account binding, avoiding first-match writes into duplicate or poisoned profiles.

Checks performed:
- Actual Firestore rules in a local demo emulator: five scenarios passed, covering safe tutorial creation/update, privilege seeding, modification/removal/replacement/deletion, other-user/anonymous denial and administrator access.
- Nine new actual-route tests with controlled Stripe/Firestore fixtures passed.
- Existing checkout and signed-webhook regression checks also passed: 18 assertions across the three selected Functions files.
- Functions TypeScript passed. No real financial account, purchase, email or payout was exercised.

Release marker: `20261017-audit-connect-ownership`. The release workflow validates deployed rules against the tested source and verifies Hosting/API markers. Consult the release run receipt for deployment completion; this source document alone is not proof of deployment.

QRG-002 was repaired separately below. Matching a Stripe account to a URL entity alone is not authentication.

## QRG-002 — Anonymous onboarding refresh

Problem: an unauthenticated GET containing any member ID could create a Stripe onboarding link for that member.

Repair: the old GET now only returns a no-cache redirect to the member UI and does not access profiles or Stripe. Newly created links return directly to that UI on expiry. Connect handoffs require sign-in and open Payouts; the Continue Stripe Setup button uses the existing authenticated POST. That POST derives ownership exclusively from the verified token, ignoring caller-supplied member IDs.

Checks: 11 Connect route tests pass (including the previous nine QRG-001 cases), with anonymous requests for known and unknown members, unauthenticated renewal, and an attempted alternate member ID. Three client checks pass, covering the authenticated continuation button and existing sign-in/admin boundary. Client and Functions TypeScript checks pass. No real Stripe onboarding or payment was performed.

Release marker for both repairs: `20261017-audit-connect-001-002`.

Release follow-up: the first workflow stopped before deployment because npm 10.8.2 required an omitted nested esbuild optional dependency. The root lockfile was regenerated with that exact npm version; no existing locked versions changed. Its clean-install dry run passed. The subsequent workflow receipt determines live completion.

## QRG-003 — Public image proxy

Problem: substring host checks and unrestricted upstream content could expose an active document on the app origin. Repair: accept exact approved HTTPS hosts without credentials or nonstandard ports, revalidate every manual redirect, bound time/bytes/pixels, and decode approved raster formats with sharp before returning PNG with nosniff/sandbox headers. Checks cover host/redirect denial, size limits, false image content and real PNG decoding. Sharp 0.35.5 is pinned; npm also reconciled semver 7.7.3 to 7.8.5 in the Functions lock.

## QRG-004 — Stored active image content

Problem: stored SVG/other active types could be served inline from the app origin. Repair: shared response headers enforce nosniff and a sandbox CSP across retained raw-asset routes; non-raster/non-video content is an attachment with private/no-store caching. Upload input validates encoding, type and byte signature, derives identity from the verified caller and marks SVG storage metadata as attachment. SVG remains usable in image contexts. Checks assert actual route headers and upload rejection, including duplicate first-match file routes. No live SVG upload/browser script execution or historical cache purge was performed.

## QRG-005 — Custom design ownership

Problem: knowing a design ID permitted access or mutation across accounts. Repair: require authentication and owner/admin authorization for detail/update/delete, allowlist editable design fields, derive creation owner from the token, and read ownership within mutation transactions. Checks cover foreign access, owner edits and attempted owner/status replacement.

## QRG-006 — Member library packet ownership

Problem: template save/link publication trusted caller-selected packet/template/channel IDs. Repair: transactionally verify packet ownership, same-packet template ownership and channel ownership before publishing or attaching records. Checks cover foreign packet/template/channel denial and valid owner publication.

## QRG-007 — Legacy buyer detail privacy

Problem: a public legacy instance detail spread buyer/private fields. Repair: full details require the exact signed-in buyer; renewal uses an explicit public ID/expiry/activity projection, and renewal verification no longer spreads the private record. The renewal page no longer displays buyer email. Checks exercise anonymous/foreign denial and public redaction, including Firestore timestamps. Presence of affected live legacy records was not established.

## QRG-008 — Account cache isolation

Problem: shared private query keys and retained component state could display the previous account's data. Repair: UID-scope affected queries, cancel/clear query state on identity changes, reject in-flight results from stale identities and remount account state when leaving a signed-in identity. Guest-to-member transitions preserve unfinished guest state. Checks use real TanStack cancellation/late completion and React account transitions; 300 client tests pass. Draft persistence remains separately tracked under QRG-039.

## QRG-009 — Dynamic page ownership

Problem: authenticated callers could select another owner's page/assets by ID. Repair: apply owner/admin checks to page detail, edits, deletion, asset listing/creation and active selection; mutation transactions enforce ownership and immutable owner/slug/billing fields. Selected assets must belong to the page; referenced hosted images must be owned. Public slug responses expose only presentation fields and hide inactive pages. Checks exercise all six foreign-account paths, field protection and owner asset creation/selection.

## QRG-010 — Privileged mockup queue

Problem: ordinary members could enqueue arbitrary targets for an administrator's worker to modify. Repair: admin-only intake/prioritization; every retained producer atomically writes a server-only authorization subdocument bound by a canonical SHA-256 hash to immutable targets. Both workers check the proof and current admin role before provider work and recheck before writeback. Parent fields cannot spoof authorization. Checks cover member denial, valid admin processing, forged/altered jobs and revoked admins. Old unapproved jobs fail closed and must be regenerated from the admin builder. No real provider generation was run.

Batch validation: 40 focused Functions tests across six files, 300 client tests across 49 files, both TypeScript checks, diff whitespace checks and npm 10.8.2 Functions clean-install dry run passed. Build marker: `20261018-audit-003-010`. Publication, deployed markers and anonymous live boundaries are verified separately by the release receipt. Controlled fixtures are not authenticated production acceptance.

## Remaining sequence

Continue QRG-011 through QRG-074 in order. Recheck before editing: QRG-068 was already fixed in the Firebase-only removal commit, and QRG-064 requires visual verification. Preserve the conditional/legacy qualifications in the verified audit register. Report a real completion result for each item; do not mark a fixture pass as authenticated live acceptance.
