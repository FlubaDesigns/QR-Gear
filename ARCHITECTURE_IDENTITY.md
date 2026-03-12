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


==================================================
STEP 3 — WIZARD PRODUCT DATA CONTRACT
==================================================

Purpose:
Define a single canonical WizardProduct shape that every wizard flow uses.
Before any wizard UI touches product data, it passes through normalizeWizardProduct()
which produces the canonical shape. Packet creation uses wizardProductToPacketBoundProduct()
so all packets carry the same normalized fields.

Canonical File: shared/wizardProduct.ts

WizardProduct Interface — Required Fields:
  canonicalBlankKey    — string, derived from provider + blueprintId (e.g. "123" or "pf:456")
  title                — string
  imageUrl             — string
  fulfillmentProvider  — 'printify' | 'printful'
  providerProductId    — number

  providerDescription        — string (from fulfillment provider)
  adminCatalogDescription    — string (from admin catalog)
  memberPacketDescription    — string (from member customization)
  effectiveDescription       — string (resolved via description layer cascade)

  retailPrice          — number
  memberEarnings       — number
  baseCost             — number

  availableColors      — Array<{ name: string; hex: string }>
  availableSizes       — string[]

  isEditableInMemberWizard   — boolean (true when mode='member')
  isReadOnlyInOwnerWizard    — boolean (true when mode='owner')
  isReadOnlyInPublicWizard   — boolean (true when mode='public')

WizardProduct Interface — Optional Fields:
  brand, placements, hasUSAProvider, variantMap,
  selectedColor, selectedSize, priceSnapshot, earningsSnapshot,
  providerDescriptionSnapshot, adminCatalogDescriptionSnapshot,
  effectivePublicDescription, blueprintId, printProviderId

Canonical Functions:
  normalizeWizardProduct(input, mode)         — builds WizardProduct from any API data shape
  wizardProductToPacketBoundProduct(wp)        — converts WizardProduct to packet boundProduct record
  updateWizardProductMemberDescription(wp, d)  — returns new WizardProduct with updated member description

deriveCanonicalBlankKey():
  - If input has canonicalBlankKey, use it
  - If fulfillmentProvider is 'printful', prefix with "pf:"
  - Otherwise use the blueprintId/providerProductId as string

WizardMode: 'member' | 'owner' | 'public'
  - Controls description resolution (member sees full cascade, public sees admin+provider only)
  - Controls editability flags

Integration Points:
  wizardTypes.ts — re-exports WizardProduct, WizardMode, normalizeWizardProduct,
                   wizardProductToPacketBoundProduct, updateWizardProductMemberDescription
  WizardContext.tsx — uses normalizeWizardProduct + wizardProductToPacketBoundProduct
                      for both createPacketForProduct and publish flows
  ProductSteps.tsx — carries all 4 description layer fields when selecting a product
  AllowedProduct — extended with canonicalBlankKey, providerProductId

Rule: No wizard consumer may construct boundProduct manually.
      All packet creation MUST go through wizardProductToPacketBoundProduct().

==================================================
END OF STEP 3 CANON
==================================================


==================================================
STEP 4 — WIZARD SURFACE SPLIT
==================================================

Purpose:
Rebuild the wizard UI around the official viewer system.
The wizard is a flow/controller shell that uses the canon viewer system.
It is NOT a viewer engine — it does not render ad hoc cards or modals.

Three Wizard Surfaces:

1. TIER PICKER
   View: ScrollVerticalView
   Skin: TierCardSkin (client/src/features/shared/components/skins/TierCardSkin.tsx)
   Data: TierItem { id, tierKey, displayName, tagline, description, productCount, previewImages }
   Controller: maps selected tier to product set, passes items to viewer

2. PRODUCT PICKER
   View: ScrollVerticalView
   Skin: WizardProductCardSkin (client/src/features/shared/components/skins/WizardProductCardSkin.tsx)
   Data: WizardProductItem { id, blueprintId, title, imageUrl, description, retailPrice, memberEarnings }
   Controller: supplies normalized product items, determines tier membership, passes handlers

3. PRODUCT DETAIL MODAL
   Skins:
   - MemberProductDetailSkin (member mode — editable memberPacketDescription)
   - ReadOnlyProductDetailSkin (owner/public mode — read only)
   Both in client/src/features/shared/components/skins/
   Controller: passes normalized product + mode + save handlers

Mode Split:
  member  → TierCardSkin + WizardProductCardSkin + MemberProductDetailSkin
  owner   → TierCardSkin + WizardProductCardSkin + ReadOnlyProductDetailSkin
  public  → TierCardSkin + WizardProductCardSkin + ReadOnlyProductDetailSkin

Wizard Controls:
  - step order
  - selected tier
  - selected product
  - packet create/update
  - mode (member / owner / public)

Wizard Does NOT:
  - render ad hoc product cards
  - render ad hoc tier cards
  - render custom lightbox logic outside viewer canon
  - reconstruct product identity in UI code
  - reconstruct description authority in UI code

Skin Rules:
  - TierCardSkin: shows tier visuals + selection affordance
  - WizardProductCardSkin: shows product visuals + selection affordance
  - MemberProductDetailSkin: shows detail + editable memberPacketDescription only
  - ReadOnlyProductDetailSkin: shows detail in read-only form
  - No skin defines business truth

Packet Rule:
  - Member wizard saves only memberPacketDescription
  - providerDescription and adminCatalogDescription are never writable from wizard
  - Packets carry: canonicalBlankKey, fulfillmentProvider, providerProductId,
    description snapshots, selected options, price/earnings snapshot

Data Flow:
  1. Controller loads tiers
  2. TierCardSkin renders tier items via ScrollVerticalView
  3. User selects tier
  4. Controller loads products for tier
  5. WizardProductCardSkin renders product items via ScrollVerticalView
  6. User taps product → detail modal opens
  7. MemberProductDetailSkin or ReadOnlyProductDetailSkin renders
  8. Member may edit memberPacketDescription only
  9. Packet updated with configured product instance

Helper Functions:
  toWizardMode(context)           — maps WizardContextType to WizardMode
  toWizardProductItem(product)    — maps AllowedProduct to WizardProductItem
  tierProductToAllowedProduct(tp) — maps TierProduct to AllowedProduct with all identity fields

Files Changed:
  ProductSteps.tsx — refactored TierPickerStep + ProductPickerStep to use viewer skins
  TierCardSkin.tsx — new canonical skin
  WizardProductCardSkin.tsx — new canonical skin
  MemberProductDetailSkin.tsx — new canonical skin
  ReadOnlyProductDetailSkin.tsx — new canonical skin

==================================================
END OF STEP 4 CANON
==================================================


==================================================
STEP 5 — SKIN SYSTEM CANON
==================================================

Purpose:
Define the official skin system for the site so UI controls, visible actions,
and item presentation remain consistent across products, libraries, wizards,
packets, and store flows.

==================================================
CORE RULE
==================================================

Viewer mounts.
View arranges.
Skin renders controls.
Controller decides authority.
Domain defines truth.

A skin is the visible interaction layer placed on top of a view.

A skin may render:
- title, image, subtitle, price, colors, sizes, badges, buttons
- edit pencils, save/remove/select/use/apply/open actions
- overlays, visible role-specific affordances

A skin may NOT decide:
- business truth, provider identity, canonical key rules
- save targets, role authority, packet-vs-catalog rules
- description-layer priority, fulfillment routing
- permission logic, action meaning

==================================================
SIZE RULE
==================================================

Skins may support size variants: compact, standard, expanded, fullscreen.
Size changes presentation only. Size does not create a new skin family.

==================================================
OFFICIAL SKIN FAMILIES
==================================================

1. Tier skins
2. Product card skins
3. Library asset card skins
4. Packet / configured item skins
5. Detail / modal skins

==================================================
1. TIER SKINS
==================================================

TierCardSkin
- Renders tier selection items (Good / Better / Best)
- Used in wizard tier picker surfaces
- File: TierCardSkin.tsx

==================================================
2. PRODUCT CARD SKINS
==================================================

AdminCatalogBlankSkin
- Renders products already in the active admin catalog (catalog strip)
- Used in admin-blanks top/catalog strip
- File: AdminCatalogBlankSkin.tsx

AdminSourceBlankSkin
- Renders source/provider blanks available to add to catalog
- Re-exports ProductSelectCardSkin with canonical name
- Used in admin-blanks bottom/source area
- File: AdminSourceBlankSkin.tsx

WizardProductCardSkin
- Renders product choices inside wizard product picker flows
- Used in member/owner/public wizard
- File: WizardProductCardSkin.tsx

StoreProductCardSkin
- Renders public store browsing cards
- Used in public store product grids/rails
- File: StoreProductCardSkin.tsx

ProductChooserCardSkin
- Renders product cards in builder/admin chooser contexts
- Used in products harness, chooser modules, catalog pickers
- File: ProductChooserCardSkin.tsx

==================================================
3. LIBRARY ASSET CARD SKINS
==================================================

AdminLibraryAssetSkin
- Renders admin-side graphics, templates, backgrounds, cropped images, source images
- Used in admin library tabs
- File: AdminLibraryAssetSkin.tsx

MemberLibraryItemSkin
- Renders member library items
- Used in members library, member browsing surfaces
- File: MemberLibraryItemSkin.tsx

StoreLibraryItemSkin
- Renders store-library items in store-library contexts
- Used in store library harness
- File: StoreLibraryItemSkin.tsx

==================================================
4. PACKET / CONFIGURED ITEM SKINS
==================================================

PacketItemSkin
- Renders products/assets already part of a packet/configured set
- Used in packet summary surfaces, configured product displays
- File: PacketItemSkin.tsx

==================================================
5. DETAIL / MODAL SKINS
==================================================

AdminBlankDetailSkin
- Full detail/editor skin for admin blank management
- Editable adminCatalogDescription, provider description read-only
- Uses resolvePublicDescription from description layers
- Used in admin-blanks modal
- File: AdminBlankDetailSkin.tsx

MemberProductDetailSkin
- Full detail/editor skin for member wizard mode
- Editable memberPacketDescription only
- Used in member wizard modal
- File: MemberProductDetailSkin.tsx

ReadOnlyProductDetailSkin
- Read-only product detail skin for owner/public flows
- No edit controls
- Used in owner/public wizard modal, public/store read-only detail
- File: ReadOnlyProductDetailSkin.tsx

LibraryAssetDetailSkin
- Detail/preview skin for library assets
- Used in graphics/template/background/image preview flows
- File: LibraryAssetDetailSkin.tsx

MediaDetailSkin
- Media-focused detail skin for image/media viewing
- Used in lightbox/media preview experiences
- File: MediaDetailSkin.tsx

==================================================
SITE-WIDE MAPPING
==================================================

admin-blanks.tsx:
  AdminCatalogBlankSkin (catalog strip)
  AdminSourceBlankSkin (source/provider blanks)
  AdminBlankDetailSkin (detail modal)

Wizard surfaces:
  TierCardSkin
  WizardProductCardSkin
  MemberProductDetailSkin
  ReadOnlyProductDetailSkin

Store pages:
  StoreProductCardSkin
  ReadOnlyProductDetailSkin

Products harness / chooser:
  ProductChooserCardSkin
  PacketItemSkin
  ReadOnlyProductDetailSkin

Admin library tabs:
  AdminLibraryAssetSkin
  LibraryAssetDetailSkin
  MediaDetailSkin

Members library:
  MemberLibraryItemSkin
  LibraryAssetDetailSkin

Store library:
  StoreLibraryItemSkin
  LibraryAssetDetailSkin

==================================================
FILES CREATED / MODIFIED IN STEP 5
==================================================

Created:
  AdminCatalogBlankSkin.tsx — catalog strip card skin
  AdminSourceBlankSkin.tsx — canonical re-export of ProductSelectCardSkin
  StoreProductCardSkin.tsx — public store card skin
  ProductChooserCardSkin.tsx — admin chooser card skin
  AdminLibraryAssetSkin.tsx — generic admin library card skin
  MemberLibraryItemSkin.tsx — member library card skin
  StoreLibraryItemSkin.tsx — store library card skin
  PacketItemSkin.tsx — packet/configured item card skin
  AdminBlankDetailSkin.tsx — admin blank detail/editor skin
  LibraryAssetDetailSkin.tsx — generic library detail skin
  MediaDetailSkin.tsx — media lightbox detail skin

Modified:
  admin-blanks.tsx — wired AdminCatalogBlankSkin + AdminSourceBlankSkin

==================================================
END OF STEP 5 CANON
==================================================
