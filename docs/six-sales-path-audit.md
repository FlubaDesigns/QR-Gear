# Six sales paths audit

Tracking: [QR Gear #36](https://github.com/FlubaDesigns/QR-Gear/issues/36), under readiness issue #19.
Baseline reviewed source: `a8e7b822be992d1d1d52f2095fd2835b051b7850`; repair batch based on `2849a465431559a372e99d153e75d34bf2decbba`. Findings below distinguish observed behavior from source review. No paid orders, fulfillment submissions or marketplace publications were performed.

## Working checklist

| Path | Evidence collected | Remaining acceptance |
| --- | --- | --- |
| 1. Admin / QR Gear store | Public collections and product page load. US Army USA250, Military Green, M, quantity 1 failed Add to Cart: “Refresh and regenerate the verified Printful print area for front.” Cart remained empty. | Read-only live diagnosis confirmed the saved `front_large` and current `front` are both 12×16 inches. Narrow alias compatibility retains geometry, DPI, variant, template and technique guards. Repeat this exact variant after deployment; paid reconciliation remains unverified. |
| 2. Partner sites and stores | Active partner registrations visible. Shared partner API binds credentials to partner, origin, store and allowed products. Fluba rewards integration uses that API. | Verify a normal paid partner purchase separately from sponsored rewards. Catalog now uses the canonical publication predicate, including parent store/channel visibility; regression cases cover filtered and unfiltered queries. Live partner attribution remains unverified. |
| 3. Create from homepage | Public builder completed preview and exact-proof approval, reached unpaid Stripe checkout for White/M at $22.33, and returned with the saved design intact. | Paid reconciliation is not tested. Replace supplier-facing descriptions and missing-description diagnostics; reconcile Compose/Dynamics naming. |
| 4. Create from member page | New product `SEl8ya0eZwTPrfTnRMeh` saved and published after proof approval. Reload retained 11 products / 8 published and channel count 8. Public proof gate and unpaid $22.33 White/M Stripe handoff passed. | Paid earnings reconciliation remains unverified. Stripe displays Kingdom Connects as merchant on both tested handoffs; review account branding before launch. |
| 5. Member promotes on their surface | Published product/share links work. Social tools use manual sharing, intent URLs or clipboard. | Replaced “connected” with “profiles entered” and explained manual posting. Test attribution end to end; the backend already preserves first-buyer lifetime referral ownership. Confirm whether homepage-created orders should retain referral attribution. |
| 6. Sell directly on a surface | Listing jobs, account-aware publishing and reconciliation exist in source. Admin shows no marketplace seller accounts. | Verify inbound paid marketplace orders, fulfillment and tracking; these were not found in the reviewed listing routes. Connect the intended seller account before real marketplace acceptance. |

## Shared data and connectivity

- Canonical sale resolution distinguishes admin catalog instances, member packets and owner packets, then resolves the master product, supplier variant, verified print layout and production assets. Fulfillment freezes the production source.
- Member compensation uses nonnegative sale-minus-cost profit and the frozen configured member share. The confirmed default is **25% of profit**. Copy changes do not alter calculations or discounts.
- Each checkout preparation creates a fresh order ID. Stripe's per-order idempotency key therefore does not deduplicate two separate initial checkout requests. Validate request-level retry behavior before adding an idempotency design; existing per-order fulfillment protection is a separate safeguard.
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
