# QR Dynamics Specification

## QR Dynamics — individual item contract (October 10, 2026)

QR Dynamics uses the existing QRG allocator, productPackets, BLD, GRF and Assembly chain. It does not redefine their authority.

| Record | Contract |
|---|---|
| `qr_dynamics_instances/{instanceId}` | Opaque resolver identity; `qrgBaseCode`, `qrgBlankId`, `ownerId`, `ownerType`, `packetId`, `status`, `composeMode`, `startTimestamp`, `slots`, `hostingExpiresAt`. Purchased copies additionally reference `orderId`, `orderItemId`, `unitIndex`, `sourcePacketId`, `sourcePacketIds` and an optional guest `claimCode`. |
| `productPackets` | Member builds get an M identity before rendering. Each purchased physical copy gets a new O identity and its own packet/Assembly. `composeInstanceId` binds the packet to its stable resolver. |
| `orderItems` | `qrExperience` freezes the source hash and Compose sequence at checkout. `dynamicsInstanceIds[index]` permanently binds each quantity position to one item. Retries reuse these references. |
| `claimCodes` | Cryptographically random guest code references the existing purchased instance. Claiming is a transaction that binds the authenticated account to that same Dynamics record and packet. |
| `claimedInstances` | Account display projection of the same instance/QRG; it is not a second identity allocator. |

Every purchased physical copy receives a distinct server-allocated QRG O-context number, even when the artwork is reused. Canvas, Play and Compose print `/qr/d/{instanceId}`; the QRG number never appears in that URL. Basic/Plus retain their direct payload semantics and still get individual purchased identities.

Slots reference published Canvas/Play production packets. Editing requires exact authenticated ownership, and content must be the owner's own published content or the purchased item's explicit source entitlement. Admin authoring inputs and another member's uploads are not selectable. Public resolution exposes only the published landing-page URL (`/m/{slug}`). Full production packets require Admin access.

Member checkout and catalog checkout freeze server-owned pricing, selected QRG/provider variant and print files before Stripe payment. Verified payment precedes item allocation/production. Provider lines have quantity one, with separate print files for each hosted copy. The original QR is decoded and matched to the saved payload before replacement; the new QR is decoded before submission. Required inside labels remain unchanged. New files use permanent GRF identities and existing BLD/Assembly services.

Automatic rotation uses `shared/qrDynamicsResolver.ts`; scan to reveal uses a browser-local position. Sequence edits restart the schedule without changing the printed URL. Draft, invalid, unavailable and expired experiences fail explicitly. 1/3/5-year hosting follows the saved term and starts on member publication or verified purchase.

The October 10 audit covers 22 catalog products (10 Founding Fathers, 5 Monuments, 7 Armed Forces). All passed identity/reference checks and original/new print QR decoding. No existing source identities or artwork were replaced. Paid Stripe/Printful fulfillment was not exercised by the audit. See `docs/QR_DYNAMICS_AUDIT.md` for the exact item list.

## Production entry points

- Member prepare/commit: `functions/src/services/member-build.ts` allocates M identity before QR rendering, then publishes packet and experience together.
- Order allocation/print: `functions/src/services/dynamics-order.ts` reuses the QRG counter, GRF registrar and Assembly writer for every physical copy.
- Saved artwork replacement: `functions/src/services/qr-artwork.ts` measures the QR in the actual PNG and verifies both payloads. It does not assume current builder slider defaults match saved pixels.
- Content authorization and resolution: `functions/src/services/qr-dynamics.ts`.
- Owner UI: Members → QR Dynamics.

## API contract

| Endpoint | Access / behavior |
|---|---|
| `GET /api/dynamics/instances` | Authenticated owner; active owned experiences only. |
| `GET /api/dynamics/instances/:id` | Exact owner; private, no-store. |
| `GET /api/dynamics/instances/:id/preview` | Exact owner; shared resolver result. |
| `PUT /api/dynamics/instances/:id/slots` | Exact owner; validated durations, unique packet IDs, canonical ordering and allowed mode. |
| `POST /api/dynamics/instances` | Rejected: use the builder/order path to avoid an orphan identity. |
| `GET /qr/d/:id` | Public resolver; no-store; validates active packet binding and hosting term, then resolves published content. |
| `POST /api/claim/:claimCode` | Authenticated claim, transactionally attaching the existing purchased item. |

The resolver uses sorted slot durations and elapsed epoch time modulo total duration. It does not require a background scheduler. Invalid content fails explicitly; no fabricated fallback destination or silent skipped slot is used.

## Scope

External marketplace order ingestion and automatic renewal billing are separate integrations. This release does not claim those paths are complete. Legacy orders without frozen production records require reconciliation, not silent conversion. No new automated test suite was added; validation used TypeScript/build checks, a read-only production inventory, and actual artwork decoding.
