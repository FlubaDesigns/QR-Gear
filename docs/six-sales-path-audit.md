# Six sales paths audit

Tracking: [QR Gear #36](https://github.com/FlubaDesigns/QR-Gear/issues/36), under readiness issue #19.
Reviewed source: `a8e7b822be992d1d1d52f2095fd2835b051b7850`. Findings below distinguish observed behavior from source review. No paid orders, fulfillment submissions or marketplace publications were performed.

## Working checklist

| Path | Evidence collected | Remaining acceptance |
| --- | --- | --- |
| 1. Admin / QR Gear store | Public collections and product page load. US Army USA250, Military Green, M, quantity 1 failed Add to Cart: “Refresh and regenerate the verified Printful print area for front.” Cart remained empty. | Diagnose the exact saved-layout/master mismatch; regenerate through the canonical pipeline; repeat cart, quote, checkout and order reconciliation. Never bypass print verification. |
| 2. Partner sites and stores | Active partner registrations visible. Shared partner API binds credentials to partner, origin, store and allowed products. Fluba rewards integration uses that API. | Verify a normal paid partner purchase separately from sponsored rewards. Align partner catalog visibility with canonical publication rules; verify origin rejection and attribution. |
| 3. Create from homepage | Public builder advances through product, color, size, QR type, placement, text and URL input. | Complete preview, persistence, return navigation and test checkout. Replace supplier-facing descriptions and missing-description diagnostics; reconcile Compose/Dynamics naming. |
| 4. Create from member page | Authenticated dashboard, saved products and channel selector load. Existing published product has a mockup and proof-approval gate. | Complete a new build, save, reload, publish and purchase handoff; verify dashboard/channel counts and earnings against canonical records. |
| 5. Member promotes on their surface | Published product/share links work. Social tools use manual sharing, intent URLs or clipboard. | Correct “connected” wording for saved handles; test attribution end to end and define referral expiry. Confirm whether homepage-created orders should retain referral attribution. |
| 6. Sell directly on a surface | Listing jobs, account-aware publishing and reconciliation exist in source. Admin shows no marketplace seller accounts. | Verify inbound paid marketplace orders, fulfillment and tracking; these were not found in the reviewed listing routes. Connect the intended seller account before real marketplace acceptance. |

## Shared data and connectivity

- Canonical sale resolution distinguishes admin catalog instances, member packets and owner packets, then resolves the master product, supplier variant, verified print layout and production assets. Fulfillment freezes the production source.
- Member compensation uses nonnegative sale-minus-cost profit and the frozen configured member share. The confirmed default is **25% of profit**. Copy changes do not alter calculations or discounts.
- Each checkout preparation creates a fresh order ID. Stripe's per-order idempotency key therefore does not deduplicate two separate initial checkout requests. Validate request-level retry behavior before adding an idempotency design; existing per-order fulfillment protection is a separate safeguard.
- Partner product filtering uses its own status rules and validates channel publication only when a channel is requested. Compare it with the strict canonical public-catalog predicate before changing behavior.
- Referral capture stores a local timestamp, but no expiry reader was found. The reviewed owner checkout does not consume that referral. Policy and end-to-end evidence are required before changing who receives compensation.
- Zero legacy builder hosts does not establish that partner API integrations are broken. Retired widget purchase routes intentionally reject new checkout.

## Layout, mobile and ease of use

- Published product desktop render measured 1348px viewport and 1348px document width, with no horizontal overflow on that view. This does not prove mobile behavior.
- Actual phone-width acceptance remains pending. Browser DevTools was blocked by the environment; the audit did not bypass that restriction.
- Check all six paths at phone width for wrapping, sticky controls, keyboard obstruction, usable error recovery and tap targets. Navbar controls in reviewed source are 36–40px, below the project's 48px target.
- Replace the published product's raw packet-ID breadcrumb with a meaningful label; sort apparel sizes consistently.
- The homepage builder exposes raw supplier descriptions and a supplier/admin missing-description diagnostic. These need customer-facing copy.
- The shared layout verifier passes shell coverage, but packet success still uses a structural two-column utility grid. Inspect it against canonical layout helpers and at phone width.

## Legacy cleanup boundaries

- `useWizardController.ts` has no runtime imports in the reviewed search and contains an old Printify fallback. Confirm the dependency graph before removal.
- `packet.tsx` has an unused default size-upcharge constant. Its available-size fallback is still used and must not be removed with it.
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
