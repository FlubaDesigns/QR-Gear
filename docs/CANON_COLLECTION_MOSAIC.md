QR GEAR CANON — COLLECTION / MOSAIC ARCHITECTURAL RULE
=====================================================

Purpose
-------
Establish a single, authoritative architectural rule that eliminates grouping ambiguity across the platform.

The system previously allowed multiple concepts to behave like grouping containers (programs, tags, dynamic collections, product link groupings). This created duplication, inconsistent behavior, and unnecessary complexity.

This Canon defines the permanent structural rule moving forward.


---------------------------------------------------------------------
CORE PRINCIPLE
---------------------------------------------------------------------

Only ONE concept may group artifacts structurally.

Only ONE concept may stitch artifacts into experiences.

Those concepts are:

Collection  → structural grouping
Mosaic      → dynamic stitched experience


---------------------------------------------------------------------
DOMAIN DEFINITIONS
---------------------------------------------------------------------

Store
-----
The top-level platform surface or brand.

Example:
QR Gear


Channel
-------
A thematic feed or domain inside a store.

Examples:
USA250
Faith
Founders
Summer Sale


Collection
----------
The ONLY structural grouping container in the system.

Responsibilities:

• defines which artifacts belong together structurally
• defines artifact ordering
• defines channel placement
• provides curated browsing structure
• acts as the canonical grouping authority

Collections must always be referenced by a canonical identifier:

collectionId


Artifact
--------
The individual content or product-linked object.

Artifacts belong to collections via:

collectionId


Mosaic
------
A dynamic stitched experience generated from artifacts.

Responsibilities:

• runtime experience assembly
• QR Dynamics sequencing
• slot-based artifact rotation
• preview and playback logic
• instance-level behavior

A Mosaic is not a grouping container.
A Mosaic is an experience built from artifacts.


QR Dynamics
-----------
The engine that stitches artifacts together into a Mosaic.

Conceptually:

Artifacts + QR Dynamics → Mosaic


---------------------------------------------------------------------
PROHIBITED GROUPING MECHANISMS
---------------------------------------------------------------------

The following legacy mechanisms must NOT be used for structural grouping:

program
program_series
site_programs
dynamicsCollections
collectionTag
storeProductLinks.collection
string-based grouping
tag-based grouping

These mechanisms may exist temporarily for migration but must not be used as authoritative domain concepts.


---------------------------------------------------------------------
STRUCTURAL RULES
---------------------------------------------------------------------

Rule 1 — Collection is the only grouping authority

Artifacts may only belong to structural groups through:

collectionId

No other grouping mechanism is allowed.


Rule 2 — Mosaic is the only stitching authority

Dynamic experiences must be created only through:

Mosaic + QR Dynamics


Rule 3 — Tags are metadata only

Tags may exist but may never determine artifact membership in a group.


Rule 4 — Widgets and APIs must follow the same language

External systems must use the canonical domain vocabulary:

Store
Channel
Collection
Artifact
Mosaic


Rule 5 — Persistence must align with domain concepts

Storage models must reflect the canonical architecture.

Examples:

collections/
artifacts/
mosaics/
mosaicTemplates/


---------------------------------------------------------------------
STRUCTURAL MODEL
---------------------------------------------------------------------

Store
  Channel
    Collection
      Artifacts

QR Dynamics
  Mosaic
    Mosaic Slots
      Artifact references


Example:

QR Gear
  Channel: USA250
    Collection: Signature Series
      Artifacts:
        Liberty Tree
        Declaration of Independence
        Rule of Law

QR Dynamics
  Mosaic: The Forefathers
    Slots:
      Artifact → Liberty Tree
      Artifact → Declaration
      Artifact → Rule of Law


---------------------------------------------------------------------
RATIONALE
---------------------------------------------------------------------

This rule eliminates architectural duplication.

Before this Canon, the system contained multiple overlapping grouping concepts:

• program
• dynamicsCollections
• collectionTag
• product-linked grouping fields

These created ambiguity about which grouping model was authoritative.

By enforcing:

Collection → grouping
Mosaic → stitching

the system becomes simpler, more predictable, and easier to scale.


---------------------------------------------------------------------
CANON STATUS
---------------------------------------------------------------------

This rule is permanent platform architecture.

Future features must conform to this model.

If a feature requires grouping artifacts, it must use:

Collection

If a feature requires assembling artifacts into an experience, it must use:

Mosaic
