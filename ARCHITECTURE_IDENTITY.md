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

==================================================
STEP 2 — DESCRIPTION LAYER SYSTEM
==================================================

Purpose:
Create a consistent, predictable description system across:

- catalog
- blanks
- viewer
- wizard
- packet
- store
- fulfillment

Descriptions must be separated into clear layers so edits never overwrite the wrong source.


==================================================
DESCRIPTION LAYERS
==================================================

The system has three editable layers and one computed layer.

providerDescription
adminCatalogDescription
memberPacketDescription
effectiveDescription


--------------------------------------------------
1. providerDescription
--------------------------------------------------

Source: Printful / Printify
- Raw description from the fulfillment provider
- Never edited by users
- Always preserved as the original source text
- Used as the fallback if no overrides exist


--------------------------------------------------
2. adminCatalogDescription
--------------------------------------------------

Source: Admin interface (blanks page / catalog tools)
- Global override for the product
- Applies to all viewers and public pages
- Stored at the catalog level
- Can be edited only by admin


--------------------------------------------------
3. memberPacketDescription
--------------------------------------------------

Source: Member wizard editing
- Exists only inside a packet
- Applies only to that specific packet instance
- Does not change the catalog or provider description
- Member can only edit this field


==================================================
DESCRIPTION RESOLUTION
==================================================

memberPacketDescription
    overrides
adminCatalogDescription
    overrides
providerDescription

The resolved result becomes: effectiveDescription


==================================================
EDIT PERMISSIONS
==================================================

Provider descriptions: Editable by: nobody
Admin catalog descriptions: Editable by: admin only
Member packet descriptions: Editable by: member wizard only
Owner/public wizard: Read-only


==================================================
PACKET STORAGE RULE
==================================================

Packets store description snapshots:

providerDescription (snapshot)
adminCatalogDescription (snapshot)
memberPacketDescription
effectiveDescription


==================================================
VIEWER RULE
==================================================

The viewer system must not resolve description logic.
Controllers resolve description layers before rendering.
The viewer simply displays the effective description.


==================================================
IMPLEMENTATION STATUS
==================================================

shared/descriptionLayers.ts — resolveDescription, resolvePublicDescription, buildDescriptionSnapshot
ScrollViewItem — carries all 4 description layer fields
ProductSelectItem — carries providerDescription, adminCatalogDescription
ProductSkin — accepts effectiveDescription, uses it for display
admin-blanks.tsx — maps provider/admin layers into ProductSelectItem
ProductSelectCardSkin — "Reset to provider description" button
WizardContext.tsx — packets carry all 4 layers + snapshots
ProductSteps.tsx — cascade uses canonical layer names
API (functions/src/index.ts) — supplies providerDescription, adminCatalogDescription, effectiveDescription


==================================================
END OF STEP 2 CANON
==================================================
