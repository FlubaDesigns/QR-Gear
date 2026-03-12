==================================================
STEP 1 — CANONICAL PRODUCT / BLANK IDENTITY
==================================================

Purpose:
Establish a single identity model for products/blanks across the entire system so that:

- catalog
- viewer
- wizard
- packet
- store
- fulfillment

all refer to the same item consistently.

This prevents:
- duplicate products
- mismatched descriptions
- incorrect packet references
- broken fulfillment routing
- UI comparison bugs


==================================================
CORE PRINCIPLE
==================================================

The system separates three identities:

1. Canonical Product Identity (site-level truth)
2. Provider Product Identity (Printful / Printify)
3. Packet Product Instance (configured product instance)

Each layer answers a different question.


==================================================
1. CANONICAL PRODUCT IDENTITY
==================================================

The site must use a single canonical key for each blank/product.

This is the system-wide identity.

Example:

canonicalBlankKey: bella-canvas-3001


This key represents the physical blank or product regardless of provider.

Examples:

bella-canvas-3001
gildan-64000
next-level-3600


Rules:

- Canonical keys are stable
- Canonical keys do not change when providers change
- Canonical keys are used everywhere in the UI and logic
- Canonical keys are the primary comparison key across the system


==================================================
2. PROVIDER PRODUCT IDENTITY
==================================================

Each canonical blank may map to one or more provider products.

Providers include:

printful
printify


Provider data must remain intact because it is required for fulfillment.

Example canonical record:

canonicalBlankKey: bella-canvas-3001

providers:
  printful:
    providerProductId: 3001
  printify:
    providerProductId: 123456


Important:

Provider IDs must NEVER be used as the system identity.

They exist only as provider references for fulfillment operations.


==================================================
3. PACKET PRODUCT INSTANCE
==================================================

The packet is the configured product instance created when a user selects or builds a product.

Packets store fulfillment information because packets represent the exact configured version of the product.

Packet product records must contain:

canonicalBlankKey
fulfillmentProvider
providerProductId
variantMap or providerVariantIds
selectedColor
selectedSize

description layers
price snapshot
earnings snapshot


Example packet product:

canonicalBlankKey: bella-canvas-3001
fulfillmentProvider: printful
providerProductId: 3001
selectedColor: black
selectedSize: large

priceSnapshot: 24.99
earningsSnapshot: 6.50


Important:

Packets must not rely on provider IDs alone.

Packets must always include the canonicalBlankKey.


==================================================
DESCRIPTION LAYERS
==================================================

The system supports three description layers.

providerDescription
adminCatalogDescription
memberPacketDescription


Definitions:

providerDescription
  description supplied by Printful/Printify

adminCatalogDescription
  global override controlled by admin

memberPacketDescription
  member-specific override stored in the packet


Effective description priority:

memberPacketDescription
→ adminCatalogDescription
→ providerDescription


Packets may store snapshots of descriptions to preserve the exact configuration used when the packet was created.


==================================================
COMPARISON RULE
==================================================

All product comparisons must use canonicalBlankKey.

Never compare provider IDs.

Correct example:

if (item.canonicalBlankKey === "bella-canvas-3001")

Incorrect example:

if (providerProductId === 3001)


==================================================
FULFILLMENT ROUTING
==================================================

Fulfillment must be determined by the packet.

The packet defines:

fulfillmentProvider
providerProductId

Orders must always reference the packet configuration when routing fulfillment.

Example order payload:

canonicalBlankKey: bella-canvas-3001
fulfillmentProvider: printful
providerProductId: 3001
variantId: pf_variant_ABC


This ensures fulfillment uses the exact provider selected when the packet was created.


==================================================
VIEWER RULE
==================================================

The viewer system must operate on canonicalBlankKey.

Viewer items may include:

canonicalBlankKey
title
image
price
colors
sizes
providerDescription
adminCatalogDescription
effectiveDescription


The viewer must NOT interpret provider logic.

The viewer only displays data.


==================================================
SYSTEM FLOW
==================================================

Catalog layer defines:

canonicalBlankKey
provider mappings
admin description


Wizard or builder selects a product and creates a packet.

Packet stores:

canonicalBlankKey
fulfillmentProvider
providerProductId
variant selections
description overrides
price snapshot


Orders are generated from packets.

Orders send providerProductId and variant data to the fulfillment provider.


==================================================
RULE SUMMARY
==================================================

canonicalBlankKey
  answers: what product is this?

fulfillmentProvider
  answers: who will produce it?

providerProductId
  answers: which provider record should be used?


Catalog defines the product.

Packet defines the configured instance.

Order performs fulfillment.


==================================================
END OF STEP 1 CANON
==================================================