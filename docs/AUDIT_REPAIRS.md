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

## QRG-011 — Public product aliases

Public packet, landing and store aliases exposed unpublished or withdrawn content. They now share publication/visibility checks, enforce current packet bindings, and return an explicit Play projection. Hidden/draft mockup requests stop before provider work. The legacy custom-design alias also now enforces owner/admin access. Four route/policy checks passed.

## QRG-012 — Legacy embed session capabilities

The session ID alone previously allowed expired mutations. Draft/cart actions now require the separately issued token in Authorization: Bearer, normalize expiry and recheck state inside the same transaction as writes. Invalid, expired and reused sessions are rejected. Buy is disabled by QRG-021 below; no checkout reservation path remains. Existing clients must send the capability returned when creating the session.

## QRG-013 — Bounded QR rendering

The public QR raster route now accepts only PNG, string payloads of at most 2048 UTF-8 bytes and integer dimensions from 64 to 2048. It caps concurrent renders per process at two and output at 2 MiB. Malformed/oversized requests are rejected before rendering; a real bounded PNG was decoded in the test. This is a resource bound, not a distributed abuse-rate measurement.

## QRG-014 — Revoked member authentication

Removed the local verifier that omitted token revocation checks. Member routes use the shared revocation-aware verifier, preserving their explicitly configured administrator allowance. Controlled disabled/revoked-token cases are rejected by both ordinary and member adapters; every SDK verification receives checkRevoked=true.

## QRG-015 — Frozen member compensation

Checkout and creator earnings now use one frozen saved memberProfitShare applied to profit in integer cents. Zero remains zero. The order stores the exact expected destination amount, and transferred status requires the actual Stripe transfer amount/currency/destination/reversal evidence to match. Historical records without a frozen policy remain needs_review. Checks cover 0%, 25% and 50%, later policy changes, missing policy and mismatched settlement. No financial transaction was performed.

## QRG-016 — Frozen paid production source

Checkout now saves the checked production packet in server-only orderProductionSources records, atomically with the order/items. Later catalog edits, folder moves or deletion do not replace that source; folder metadata is excluded from its production hash. Production verifies the frozen hash and order binding. Checks cover edited/deleted live sources, tampering and foreign/missing snapshots. Historical orders without snapshots retain the conservative reconciliation hold; no historical artwork is invented or silently substituted.

## QRG-017 — Refunds and production retry

Signed charge.refunded events persist monotonic refund evidence, hold matching orders and mark earnings for review with actual reversal evidence. Refund-first delivery prevents later checkout replay from restoring paid status. Production retrieves Stripe payment state before provider lookup and again before creation/confirmation, rejecting refunds, disputes and mismatches. Worker tests confirm a missed refund webhook cannot let a retry reach the provider. A refund arriving after production has begun still requires provider-order review; no automatic financial reversal or provider cancellation was added.

## QRG-018 — Unpaid gift issuance

Public issuance now accepts only an active package explicitly marked isFreePromotion with a zero price and configured validity. Paid gift sales remain disabled until payment-backed issuance exists. Admin Gifts exposes that explicit setting; the public UI says Get Free Gift and tells the user to share the code, without falsely promising an email. A $99 fixture cannot issue a code; an explicit free promotion can.

## QRG-019 — Gift expiry and duplicate redemption

Expiry parsing handles real Firestore Timestamp values and rejects invalid/missing expiry. A transaction consumes the gift and creates one deterministic redemption record. Concurrent controlled requests produce one success and one rejection; expired Timestamp checks pass. These are transaction fixtures, not a production load test.

## QRG-020 — Idempotent legacy hosting renewal

Renewal checkout freezes price/currency/duration and instance in hosting_renewals. The signed webhook and return-page verification use the same consumption transaction and session receipt. Concurrent callbacks/replays credit exactly once, and mismatched terms are rejected. Old sessions without a frozen renewal record require reconciliation because their prior credit cannot be inferred safely. This repair covers the legacy buyer_instances path only.

## QRG-021 — Legacy embed payment without fulfillment

Disabled the legacy embed Buy route with an explicit unavailable response and public allowBuyNow=false. A valid session capability cannot initiate payment. Historical embed payment callbacks retain reconciliation behavior; this does not implement or certify partner checkout.

## QRG-022 — Durable earnings failure handling

Ledger work is persisted as pending before writes and marked completed only afterward. Database failures propagate to callers/webhooks for retry; deterministic earning IDs avoid duplicate credits. Member earnings are recorded before fulfillment, so provider failure does not erase the obligation. Missing legacy embed attribution now raises an error instead of acknowledging success. Failure/retry checks verify pending work and one eventual earning.

## QRG-023 — Legacy claim expiry and concurrency

Legacy claim POST now reads and consumes the code inside a transaction, checks normalized expiry and creates the claimed instance atomically. Concurrent claimants cannot both succeed. Modern paid-item identity transfer remains separate and retains the existing printed identity. Tests cover an expired code and competing users.

## QRG-024 — Activation email HTML

Activation email text and attributes use the existing HTML escaping helper. Claim codes are URL-encoded; preview URLs require HTTPS without credentials and are attribute-escaped. Controlled member markup renders as text and an unsafe image URL is omitted. No email was sent.

## QRG-025 — Original lifetime referrer

Each order now freezes the buyer’s saved original referral relationship; a later link or missing referral parameter does not replace it. New relationships use a deterministic normalized-email identity and transactional creation. Earnings use the saved share and idempotent order/member key. Checks credit the original referrer with and without a later candidate and preserve the original relationship.

Batch marker: `20261018-audit-011-025`. Focused route/service/transaction fixtures and TypeScript checks are recorded in the release receipt. One existing client test used a fixed 20 ms delay; it now waits for the asserted UI state. The previous full Functions/shared baseline failures remain tracked under QRG-073; this batch does not claim an entirely green legacy regression suite or authenticated production acceptance.

## QRG-026 — Historical Printify retry

A stored remote ID was treated as production success after a failed submission. The helper now leases the order, rechecks payment, reads the saved remote order and resumes an on-hold submission. Created/submitted/production states are distinct; unknown remote states fail for review. The admin shortcut was removed. Controlled retries create once and submit twice; already submitted and refunded cases are checked. This does not automatically reconstruct a remote create whose response and identity were both lost.

## QRG-027 — Saved embed pricing

Pricing now uses the saved retail, campaign markup, reserved platform margin, rounding and price limits. Numeric zero survives the editor and calculation. Unsupported live/variant cost feeds fail explicitly. Platform margin is labeled as reserved from retail before affiliate sharing. Tests reproduce the $75 policy/$70 minimum case and zero affiliate payment. Legacy Buy remains disabled under QRG-021; no charge was made.

## QRG-028 — Partial guest-cart transfer

Only successfully imported identities are removed from local storage. Failed items remain visible with retry/remove controls. A stable per-user import receipt makes a lost-response retry idempotent and detects changed input. Tests cover one failed row, stable retry identity, repeated server import, removed imported rows and separate users.

## QRG-029 — Checkout confirmation receipt

The authenticated verification endpoint now returns the exact buyer-owned frozen order and an explicit safe item projection. Session, amount and currency bindings are checked. Paid sessions waiting for their webhook show confirmation pending with bounded polling, rather than a failed order. Refunds and incomplete payment have distinct copy. Tests cover delayed completion, confirmed receipt, refund and mismatched ownership/payment.

## QRG-030 — Plus QR destination

Plus now uses the shared direct-content contract with Basic; Canvas, Play and Compose remain hosted types. Plus exposes the direct URL/text editor and empty destinations block generation. The destination contract is tested. Canonical tier identities are unchanged.

## QRG-031 — Missing selected artwork

Print and landing renderers now reject a selected image load failure instead of returning an incomplete successful image. Tests exercise the actual renderers with controlled canvas/image adapters, including a valid landing background. No physical print was generated.

## QRG-032 — Member Canvas landing

Public landing projection no longer substitutes the physical print composite for a missing landing snapshot. The viewer renders the saved landing background/text contract with the existing landing renderer and explicit retry on failure. A route test proves the chosen Canvas background is retained while the snapshot remains absent.

## QRG-033 — Interrupted marketplace locks

Jobs have a 65-minute lease, longer than the deployed one-hour function deadline. Expired jobs become recoverable failures; status checks are reachable from the listing UI and retries reconcile the saved remote identity first. Unknown creation outcomes remain held until reconciliation succeeds, preventing blind duplicate creation. Tests cover expired recovery, no new create, and the unknown-outcome hold. No external listing was changed.

## QRG-034 — Activation-code input

The input accepts both current 24-character paid codes and 12-character case-sensitive admin codes. It no longer truncates or uppercases the latter, has an accessible label, and describes the purchased hosting term instead of promising one year. Shared-format tests cover both generators and invalid legacy-shaped input.

## QRG-035 — Basic layout selection

Basic now exposes the shared physical layout editor required by Finalize. This removes the fresh-draft dead end without inventing a default layout. Type checks and the existing builder suite passed.

## QRG-036 — Canonical admin Compose

The picker reads public canonical productPackets. Choosing a playlist stages it; it no longer announces a disconnected experience as published. Graphic generation prepares validated one-based slots, the printed QR uses that resolver, and catalog commit atomically binds/activates the instance with the permanent QRG identity. Resolver checks use the shared publication policy. Tests cover draft denial, canonical targets, invalid content, resolver binding and actual atomic catalog activation.

## QRG-037 — Catalog color objects

The instance resolver normalizes both catalog name/hex objects and historical strings before merging color names. The canonical object fixture no longer calls trim on an object; whitespace and case-insensitive deduplication are checked.

## QRG-038 — Complete Printify republishing

Republishing now uses the same composition validation and registered per-placement artwork projection as first publication. Every selected placement is required; the right sleeve cannot silently disappear. Changes to canonical placement maps trigger synchronization. Tests cover all three placements and failure before provider access. Historical packets without a valid canonical composition need rebuilding through the builder; legacy URL fields are not treated as proof of correct artwork.

## QRG-039 — Guest draft sign-in handoff

The wizard provider stays mounted during transient auth loading. First-time onboarding happens inside the same wizard provider rather than navigating away and destroying it. The existing identity boundary still clears state when leaving a signed-in identity. A React lifecycle test preserves an unsaved draft through loading, onboarding and completion with one provider mount.

## QRG-040 — Acknowledged onboarding

Completion requires a successful server acknowledgment for the same signed-in user. Failures remain on the form with an error; missing tokens and account changes reject. The exact profile cache is updated before completion, preventing the fresh false-cache redirect loop. Failed/empty product discovery offers retry and permits interests to be chosen later. Real query-cache tests cover acknowledged and rejected saves.

Batch marker: `20261018-audit-026-040`. Validation: 53 focused Functions tests across eight files, all 308 client tests across 53 files, and client/Functions TypeScript checks passed. Controlled tests did not create purchases, refunds, payouts, emails or provider products. Deployment is recorded separately. Earlier full Functions/shared baseline failures remain tracked under QRG-073.

## QRG-041 — Claimed-item response and static lifecycle

The Account page expected an envelope but received an array, and static items were treated as expired. The API and client now share a typed array contract, explicit document IDs and normalized expiry values. Static items remain active without a hosting expiry. Actual owner-scoped route tests and lifecycle checks pass.

## QRG-042 — Studio canonical state

Studio read retired product/channel fields, leaving valid builds unable to publish. It now reads the current wizard product, channel and content and navigates to the correct Advanced steps. Required fields are shown before publishing. A rendered React test starts with only canonical state and verifies the publish and edit actions.

## QRG-043 — Per-placement artwork

Full-design/QR-only choices and advanced QR coordinates now persist in the validated build snapshot and owner checkout draft. Rendering uses each placement's saved choices and coordinates; QR-only excludes decorative text/images. Coordinates are bounded to 0–100%, and print dimensions use the actual configured pixels. Actual prepare-build/render-option and owner-hook tests cover different front/back choices and reject invalid coordinates.

## QRG-044 — Play media upload and library identity

Guest video handoff and signed-in upload use the same multipart endpoint. It returns a real owned library asset ID and URL; saving a URL no longer creates a text file pretending to be a video. Public URL references use a dedicated validated route, and existing owned uploads are reused. Failed saves remain recoverable. Multipart route tests cover ownership, returned asset identity and reuse; no live upload occurred.

## QRG-045 — Legacy widget response

The unsupported legacy widget page now clearly states that it is retired. The independent Partner API boundary remains unchanged. Session-contract and signed-token tests cover retained diagnostic behavior; no legacy buying/building surface has been revived.

## QRG-046 — Widget token diagnostics

The diagnostic endpoint now verifies the same JWT signature and expiry as the session endpoint. Arbitrary, forged and expired tokens fail. Valid-token and rejection tests pass without returning the raw token.

## QRG-047 — Central provider-key editor

The local Printful password form was incompatible with the central key authority and rejected every save. It now directs administrators to the existing Cortex provider-key manager while retaining status checks. Source review and TypeScript/build checks pass; no credential was changed.

## QRG-048 — Admin order totals and work queue

Revenue now sums verified paid integer cents, including exact legacy decimal amounts, and accounts for refunds. Unsupported currencies or incomplete paid/refund records are explicitly unreconciled rather than guessed. Pending work uses current fulfillment states. Actual metrics tests cover $25 + $30, unpaid exclusion, partial refunds and held/unpaid orders.

## QRG-049 — Current customer records

Customer reports now include current `users` records and canonical `orders.userId` purchases. Legacy customers join only through explicit IDs, never guessed email matches. Full-history totals and the recent-order display use the same customer identity. Route tests verify a current account with paid and unpaid purchases.

## QRG-050 — Unique email-template triggers

Create/edit/delete now atomically reserve and release each trigger, including disabled templates. Conflicting writes return a visible conflict instead of creating ambiguous send behavior. Existing duplicates receive a badge and remain fail-closed until an administrator chooses the correct template; none were deleted automatically. Concurrent create, edit, disabled-conflict and delete/recreate checks pass.

## QRG-051 — Unique creator addresses

Profile saves normalize, validate and transactionally reserve creator slugs, preserve membership age and protect existing owners. Historical mixed-case duplicates and UID collisions are detected; public lookup returns a conflict instead of selecting an arbitrary creator. Concurrent reservation, rename/release and historical-collision tests pass. Existing conflicting profiles are not silently renamed.

## QRG-052 — Reminder recipient and delivery acknowledgment

Reminders prefer the saved contact email and validate it. Provider errors or missing acceptance IDs return a failure instead of `sent: true`; interpolated email text and links are escaped. Route tests use a mocked provider to verify recipient choice and accepted/rejected delivery. No email was sent.

## QRG-053 — Tier products across categories

The tier picker combines every category within Good/Better/Best and deduplicates canonical QRG identities. Products outside the first category remain selectable. A two-category fixture plus a duplicate verifies complete results.

## QRG-054 — Configured Compose hosting prices

Member Compose selectors load saved pricing terms and show each full-term hosting cost. Invented included prices, annual prices and savings claims were removed. Missing configuration has retry UI; progression requires a configured term. A rendered selector test verifies a saved $13.42 term and its selected ID.

## QRG-055 — Canonical hosted previews

Canvas, Play and Compose now preview through the same saved build/artwork pipeline as publishing, including selected placements, per-placement art, layout controls and owned media. Deferred video upload completes before preparation. Failed previews stay on the current step with an error; a QR placeholder is never presented as a supplier mockup. Review steps recheck the input fingerprint before advancing. Controlled client and backend build tests pass; no provider product was created.

## QRG-056 — Measured launch readiness

Static reminders no longer count as configuration blockers. Obsolete backend/auth assertions were replaced with clearly manual fulfillment, payment and customer-journey reviews. Failed setup reads cannot establish readiness. Derived-state/source review confirms an all-OK measured result clears blockers while manual review remains visible.

## QRG-057 — Crop cancellation

Closing the crop dialog preserves the chosen asset, returning to the visible Full Image/Crop choices. Selecting a different image still clears it explicitly. The state transition and mounted shared component were inspected; TypeScript and build checks pass.

## QRG-058 — Super Simple skip-media destination

Skipping hosted media now opens the direct QR Plus content editor and clears its old mockup. It no longer generates a temporary URL preview before collecting a destination. The next action uses canonical destination validation. Fresh and reused-state transitions were traced, and the canonical preview regressions pass.

## QRG-059 — Legacy store builder

The retained `/admin/sales/build` route now opens the canonical admin store builder. It no longer mounts the incompatible legacy POST/PATCH screen. Both entry routes resolve to the same maintained component. No existing store records were migrated or deleted.

## QRG-060 — External policy assignment

Host forms now edit default pricing/revenue policy IDs; placement forms edit overrides or inherit the host defaults. Existing selections survive editing, unavailable selections are visible, and failed option loading offers retry. The forms explicitly state that legacy embed checkout remains disabled. Payload/source and TypeScript checks pass; no live host or policy was changed.

## QRG-061 — Failed external report reads

All seven External Sites sections handle primary and supporting query failures with an actionable retry state. They do not render empty records or authoritative $0 totals while a read has failed. Hook order, error branches and type checks were verified.

## QRG-062 — Scan input validation

The public logger validates identifier types, allowed document IDs, lengths and optional field values before writing. Analytics skips and logs corrupt historical rows instead of passing them into Firestore lookups. Tests reject malformed writes and preserve valid analytics alongside a corrupt row. Calendar calculations also use consistent UTC boundaries, fixing the full-suite timezone discrepancy. No malformed live scan was submitted.

## QRG-063 — Short-screen navigation

The menu is constrained to the available dynamic viewport height, scrolls internally, prevents scroll chaining and locks the page behind it. Escape closes it. Chromium at 400×547 CSS pixels verified a 482px panel with 646px scroll content and Sign In fully visible after scrolling.

## QRG-064 — Menu contrast

The navigation panel now has an opaque dark background rather than content-dependent translucent glass. The same Chromium check placed a white surface behind it and confirmed the rendered opaque background; the screenshot was visually inspected. This targeted check is not a whole-site contrast certification.

## QRG-065 — Targeted keyboard and accessible controls

Cart, menu, account, gallery and quantity controls have names; the menu exposes expansion and its controlled navigation. Link/button nesting in the navigation was removed. Content-rights toggles and file pickers support keyboard activation; collapsible headers use native buttons separated from other header actions. Targeted text/color/range controls have names and color selection state. Rendered keyboard/collapse tests and the browser menu check pass; this is not a complete accessibility audit.

## QRG-066 — Trailing-slash informational pages

Editorial-image lookup normalizes trailing slashes, queries and fragments. Missing imagery is nonfatal. Chromium loaded both `/qr-basics/` and `/wedding-qr-shirts/` with their image and navigation, with no page errors. Public-page generation and discovery validation also pass.

## QRG-067 — Sign-in return destinations

Email and Google sign-in share one sanitized internal return-path contract. Current query intent takes precedence over old storage and is consumed after successful authentication. Unsafe external/protocol-relative/backslash targets and login/API loops are rejected. Registration links preserve current intent, and the member flow resumes it after acknowledged onboarding. Tests cover checkout, claim, stale state and unsafe targets without performing a live sign-in.

## QRG-068 — Account logout already repaired

This item was already fixed by the Firebase-only cleanup before these repairs: Account awaits Firebase sign-out, cancels and clears query data, then navigates away. The shared identity boundary also clears signed-in state. Current source and identity regression checks confirm the retained behavior. No duplicate logout implementation was added.

## QRG-069 — Account shopping actions

Browse/Explore links use the canonical shop path, and the Account cart's checkout button navigates to the supported checkout flow. Route/source and type checks pass; no purchase was started.

## QRG-070 — Play mute controls

The legacy direct-video view now uses labeled native playback controls, with mute state synchronized to the video. The full-screen click overlay and competing custom mute layer were removed; embedded players have titles. Source/render structure and type checks pass without opening a live scan destination.

## QRG-071 — QR Plus promise consistency

Terms and Privacy now describe current Basic/Plus as fixed encoded content, without QR Gear hosting expiry. Canvas, Play and Compose remain hosted and use the purchased term. Copy was compared to the builder, pricing and direct-destination implementation. This is a product-contract correction, not a legal-compliance assessment.

## QRG-072 — Owner Back navigation

Layout selection now returns to Generate, and Text Choice returns to Layout Mode. Eighteen reachable Back transitions are checked through the actual navigation hook, including both QR preview branches. Existing owner checkout/draft tests also pass.

## QRG-073 — Full regression release gate

`npm test` runs the complete client/shared and Functions suites with external network calls blocked. Both QR Gear CI and the active Fluba release controller require it before deployment. Fixtures were brought up to current provider selection, saved print specifications, fresh cost imports, public binding, session capabilities, frozen production and Stripe refund-verification contracts. The payment worker test retains real per-unit allocation while mocking external image/storage/provider boundaries. Production validation was not weakened to satisfy old fixtures. Build, type, Brain, manifest and live acceptance remain separate checks.

## QRG-074 — Timing tests must reach assertions

All timing fixtures use one-based slot ordering. Resolver errors throw instead of returning before the timing expectations. Separate negative cases cover zero-based ordering, invalid durations and duplicate orders. The shared suite now executes its cycle, boundary and time-remaining assertions.

Final source batch marker: `20261018-audit-041-074`. Exact suite totals and deployed source/controller commits are recorded in the final delivery receipt. No tests made real purchases, refunds, payouts, emails, provider products or public scan events. Historical reconciliation holds noted above remain explicit.
