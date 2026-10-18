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

Important boundary: QRG-002 remains separate. Matching a Stripe account to the entity in a URL does not authenticate an anonymous visitor. That refresh flow is the next numbered repair.

## Remaining sequence

Continue QRG-002 through QRG-074 in order. Recheck before editing: QRG-068 was already fixed in the Firebase-only removal commit, and QRG-064 requires visual verification. Preserve the conditional/legacy qualifications in the verified audit register. Report a real completion result for each item; do not mark a fixture pass as authenticated live acceptance.
