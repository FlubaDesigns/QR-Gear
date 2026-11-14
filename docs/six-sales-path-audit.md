# Six sales paths audit

Tracking: [QR Gear #36](https://github.com/FlubaDesigns/QR-Gear/issues/36), under readiness issue #19.
Baseline reviewed source: `a8e7b822be992d1d1d52f2095fd2835b051b7850`; repair batch based on `2849a465431559a372e99d153e75d34bf2decbba`. Findings below distinguish observed behavior from source review. No paid orders, fulfillment submissions or marketplace publications were performed.

## Working checklist

| Path | Evidence collected | Remaining acceptance |
| --- | --- | --- |
| 1. Admin / QR Gear store | Public collections and product page load. US Army USA250, Military Green, M, quantity 1 failed Add to Cart: “Refresh and regenerate the verified Printful print area for front.” Cart remained empty. | Read-only live diagnosis confirmed the saved `front_large` and current `front` are both 12×16 inches. Narrow alias compatibility retains geometry, DPI, variant, template and technique guards. Live replay passed after deployment: Army Military Green/M added to cart at $33.58. Paid reconciliation remains unverified. |
| 2. Partner sites and stores | Active partner registrations visible. Shared partner API binds credentials to partner, origin, store and allowed products. Fluba rewards integration uses that API. | Verify a normal paid partner purchase separately from sponsored rewards. Catalog now uses the canonical publication predicate, including parent store/channel visibility; regression cases cover filtered and unfiltered queries. Live partner attribution remains unverified. |
| 3. Create from homepage | Public builder completed preview and exact-proof approval, reached unpaid Stripe checkout for White/M at $22.33, and returned with the saved design intact. | Paid reconciliation is not tested. Replace supplier-facing descriptions and missing-description diagnostics; reconcile Compose/Dynamics naming. |
| 4. Create from member page | New product `SEl8ya0eZwTPrfTnRMeh` saved and published after proof approval. Reload retained 11 products / 8 published and channel count 8. Public proof gate and unpaid $22.33 White/M Stripe handoff passed. | Paid earnings reconciliation remains unverified. Stripe displays Kingdom Connects as merchant on both tested handoffs; review account branding before launch. |
| 5. Member promotes on their surface | Published product/share links work. Social tools use manual sharing, intent URLs or clipboard. | Replaced “connected” with “profiles entered” and explained manual posting. Test attribution end to end; the backend already preserves first-buyer lifetime referral ownership. Confirm whether homepage-created orders should retain referral attribution. |
| 6. Sell directly on a surface | Listing jobs, account-aware publishing and reconciliation exist in source. Admin shows no marketplace seller accounts. | Verify inbound paid marketplace orders, fulfillment and tracking; these were not found in the reviewed listing routes. Connect the intended seller account before real marketplace acceptance. |

## Shared data and connectivity

- Canonical sale resolution distinguishes admin catalog instances, member packets and owner packets, then resolves the master product, supplier variant, verified print layout and production assets. Fulfillment freezes the production source.
- Member compensation uses nonnegative sale-minus-cost profit and the frozen configured member share. The confirmed default is **25% of profit**. Copy changes do not alter calculations or discounts.
- Durable checkout attempts now reuse one frozen order and Stripe payload for repeated requests; account/owner scope and request hashes reject mismatched reuse. Existing per-order fulfillment protection remains a separate safeguard. Live replay acceptance is recorded with the release.
- Partner product filtering now reuses the same strict publication predicate as canonical checkout. Parent reads are cached per request.
- Referral capture stores a local timestamp. `lifetime-referral.ts` transactionally preserves first-buyer email attribution; lifetime behavior exists and must not be removed as presumed dead code. The reviewed owner checkout does not consume the referral; its compensation policy and paid evidence still need resolution.
- Zero legacy builder hosts does not establish that partner API integrations are broken. Retired widget purchase routes intentionally reject new checkout.

## Layout, mobile and ease of use

- Published product desktop render measured 1348px viewport and 1348px document width, with no horizontal overflow on that view. This does not prove mobile behavior.
- Actual phone-width acceptance remains pending. Browser DevTools was blocked by the environment; the audit did not bypass that restriction.
- Check all six paths at phone width for wrapping, sticky controls, keyboard obstruction, usable error recovery and tap targets. Navbar controls in reviewed source are 36–40px, below the project's 48px target.
- Published product breadcrumb now says Product and apparel sizes use the shared canonical sorter.
- The homepage builder exposes raw supplier descriptions and a supplier/admin missing-description diagnostic. These need customer-facing copy.
- Packet success now uses the shared row/column layout helpers; shared shell verification passes. Actual phone-width acceptance remains outstanding.

## Legacy cleanup boundaries

- `useWizardController.ts` has no runtime imports in the reviewed search and contains an old Printify fallback. Confirm the dependency graph before removal.
- Removed the unused default size-upcharge constant from `packet.tsx`; retained the active available-size fallback and canonical pricing response.
- Legacy order constructors still serve old checkout verification/backfill paths. They are not safe dead-code deletions without a migration and historical-order recovery plan.
- Some old theme selectors have no JSX references, while others remain active. Remove only individually proven unused rules.

## Validation and sequence

Baseline at the reviewed commit: 450 client tests and 657 backend tests passed with external-network guards and a 15-second test timeout. Layout verification passed for 108 route entries and 114 page/view files. These results do not establish live provider, payment or mobile acceptance.

1. Correct profit-basis copy consistently using the existing shared default.
2. Diagnose and repair the live store cart blocker; repeat the exact failed variant.
3. Verify homepage and member build persistence, preview and checkout handoffs.
4. Align partner publication and verify paid partner attribution separately from rewards.
5. Resolve referral policy and manual social-sharing labels.
6. Verify the direct-surface order lifecycle with the intended seller integration.
7. Complete phone-width acceptance and dependency-proven legacy cleanup.

Keep #36 open until the outstanding checks have evidence. Deployment and local validation must be reported separately.

## Live diagnostic receipt

Authorization Engine run [43562890845](https://github.com/FlubaDesigns/fluba-designs/actions/runs/43562890845) read the exact failing catalog instance and current master. Saved front: 3600×4800 at 300 DPI; verified current front: 1800×2400 at 150 DPI; both 12×16 inches. The saved higher-resolution artwork remains unchanged; canonical current placement is used for proof and production. No Firestore production records were rewritten.

## Reconciliation with readiness issue 19

Read [issue #19](https://github.com/FlubaDesigns/QR-Gear/issues/19) and all 14 comments through comment 6872482602. Its October opening observations are historical: the storefront is now accessible and live Stripe configuration was subsequently verified. The free-first-year hosting requirement and deferred Gifts scope remain constraints. The owner subsequently confirmed existing Admin Pricing for renewal (PR39). Do not treat the original unchecked list as current completion evidence.

| #19 requirement | Current evidence / status | Six-path impact |
| --- | --- | --- |
| 1. Live payment boundary and configuration | Enforcement shipped in PR32. Setup run 43559355448 verified matching live keys, enabled account and signed handler behavior; no charge. | All paid paths; current browser handoffs are live, unpaid sessions, not sandbox purchases. |
| 2. Fresh Functions deployment | PR33 removes tracked generated output and builds clean source before deployment. | Shared backend for all six paths. |
| 3. Marketing reward cost/reporting | PR33 implements canonical loss-leader classification and provider cost reporting; signed-in Admin verified. | Partner-sponsored rewards; keep separate from normal retail revenue. |
| 4. Sponsored recovery | Queues and production retry shipped; notification/shipment recovery still open. | Partner/rewards path; do not mark the entire lifecycle complete. |
| 5. Hosting and renewal | PARTIAL: PR39 connects current Dynamics renewal and expiry advertising to existing Admin Pricing. Its release markers and provider checks passed. First-year-free policy, notifications and paid renewal proof remain open. | Homepage/member creations and promoted QR items. Preserve printed code identity; reconcile expiry advertising, notification deduplication, renewal and terms together. |
| 6. Product/store authorities | PARTIAL: shared purchase/publication policy shipped in PR34; PR37 extends it to partner listing. Alternate product/store APIs still need caller/data review. | Store, partner and surface catalog consistency. |
| 7. Purchase eligibility | PR34 gates new purchases on canonical parent publication while preserving paid fulfillment; PR37 adds partner catalog parity. | Store/partner and stale-cart behavior. |
| 8. Durable checkout replay | PARTIAL: shared durable attempts implemented for cart, member-product, homepage-builder and renewal checkout; concurrent and lost-response fixtures pass. Live replay acceptance is recorded with the release. | All checkout paths; duplicate-webhook safeguards are a different layer. |
| 9. Marketplace lifecycle | OPEN: account-aware listings exist, zero seller accounts observed, complete inbound order/fulfillment/tracking/refund bridge not established. | Direct surface selling remains unaccepted. |
| 10. Store deletion obligations | OPEN: impact preview and resumable handling of partner/remote-listing obligations need implementation. | Admin, partner stores and external surfaces. |
| 11. Shipment updates | OPEN: automatic provider-event delivery and sponsored notification recovery require evidence. | Every fulfilled purchase. |
| 12. Dependencies and legacy login | OPEN: latest #19 audit reports 12 backend findings, including two high; token-in-URL login remains tracked. Advisory status was not independently refreshed in this six-path batch. | Shared security and release readiness. |
| 13. Proven-unused cleanup | Tracked generated output removed by PR33; unused local packet upcharge constant removed by PR37. Unused-controller candidates require dependency review; printed-QR and historical-order routes stay protected. | All paths; no blanket legacy deletion. |
| 14. Full funnel/phone/isolation/recovery acceptance | PARTIAL: new member save/publish/reload and homepage preview/checkout/cancel passed. Phone-width, every offered QR type, cross-account editing, paid reconciliation and physical scan remain unverified. | All six paths. |

PR35 also fixed missing Admin order amounts without inventing historical totals; live unpaid controls stayed disabled. Provider verification run 43562170384 supplied the independent successful receipt after an earlier release's final check failed.

### Unified remaining acceptance order

1. Completed: PR37/38 release and Army Military Green/M cart replay; frontend/backend markers matched. PR39 hosting release also verified.
2. Resolve hosting lifecycle and free-year policy coherently, including current-record renewal, expiry advertising, emails and historical printed codes. Do not invent renewal pricing.
3. Implement durable initial checkout replay and complete sponsored notification/shipment recovery.
4. Review alternate authorities and deletion obligations, then remove only proven-unused code; address dependency/security and legacy-login findings with current evidence.
5. Complete configured partner/marketplace acceptance and authenticated phone/isolation/recovery checks for each offered QR type.
6. Obtain separate authorization for a controlled paid order, fulfillment, email, label and physical scan acceptance. No unpaid checkout or fixture substitutes for this.

The six-path review does not close #19. Both issues retain explicit gaps rather than a blanket launch approval. Gifts remain excluded; visitor-choice/menu and cross-item Exchange requirements from #19 also remain unverified and must be scoped before launch.

## Hosting renewal uses Admin Pricing — November 14, 2026

Renewal options and Stripe amounts now read the existing `testSettings/pricing.hostingTiers` through `readHostingTiers`. The separate $4.99/three-year offer is removed. Paid renewal supports configured positive-price 1/2/3/5-year terms; no new pricing setting or fallback price is introduced. Checkout rejects stale displayed prices and freezes the selected amount and calendar-year term for payment verification. Initial free-year policy remains a separate open acceptance item.

Current `qr_dynamics_instances` records are authoritative, with historical `buyer_instances` compatibility only when no current record exists. Successful paid renewal updates the current record and its existing claimed-item projection atomically and once. Historical paid terms remain honored. Expired, correctly bound public scans return to the existing QR Gear homepage without deleting identity or content. Notification recovery, durable initial checkout replay, phone acceptance and paid live proof remain open under #19/#36.

## Durable checkout attempts — November 14, 2026

Cart (hosted/embedded), shared member products, homepage builds and hosting renewals now retain a browser purchase-attempt ID across reloads and network failures. The server scopes the ID to the authenticated cart account or owner capability where applicable, hashes the exact request, and freezes one existing order/renewal record transactionally. Reusing an ID with different input is rejected. No new order collection or pricing authority is introduced.

The shared `checkout-attempt.ts` service freezes Stripe parameters and expiry before the provider call, reuses the same idempotency key after a lost response, and retrieves a recorded session instead of creating another. A confirmed expired session permits a fresh user attempt; an unresolved provider outcome beyond the 23-hour retry window requires reconciliation. Completed sessions return to their existing verification page. Browser storage failure stops checkout before sending a request. This protects retries of the same intent; independently started purchases are separate intents.

Fixture validation: 454 client tests and 669 backend tests passed, including account/selection isolation, concurrent order creation, lost Stripe responses, provider mode checks, expired sessions and the old-window boundary. Backend rendering used two workers and a 15-second timeout after the existing large-image test exceeded its default five seconds. Live replay evidence is recorded on the release PR; these fixtures do not prove a charge, fulfillment, email or phone acceptance.
