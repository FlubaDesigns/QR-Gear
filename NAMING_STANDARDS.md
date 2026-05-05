# QR Gear – Naming Standards

---

## TABLE OF CONTENTS

1. Purpose
2. Absolute Naming Rule
3. No-Rename Rule
4. Required Code-Tracing Before Naming Changes
5. QRG Naming
6. File Naming
7. Component Naming
8. Class and ID Naming
9. Firestore Naming
10. API and Route Naming
11. Packet Naming
12. Graphics Asset Naming
13. Marketplace Naming
14. Forbidden Naming Behavior
15. Change Approval Rule
16. Maintenance Rule

---

## 1. PURPOSE

This document defines naming standards for QR Gear.

Its purpose is to prevent agents from inventing new names, renaming existing structures, breaking references, or creating parallel naming systems.

QR Gear depends on consistent names across:

- frontend components
- backend routes
- Firestore collections
- product packets
- graphics layers
- QRG identities
- marketplace surfaces
- admin workflows

Naming mistakes can break the system.

---

## 2. ABSOLUTE NAMING RULE

Do not invent names.

Before creating or changing any name, read the existing code and match the current pattern.

This applies to:

- files
- folders
- classes
- IDs
- components
- hooks
- functions
- services
- Firestore collections
- Firestore fields
- routes
- API endpoints
- product packets
- graphics layers
- image assets
- marketplace records

---

## 3. NO-RENAME RULE

Do NOT rename existing structures unless the user explicitly requests it.

This includes:

- CSS classes
- DOM IDs
- React component names
- function names
- Firestore field names
- Firestore collection names
- API route names
- file names
- packet field names
- graphics layer keys

A rename is only allowed if:

1. the user explicitly requests the rename
2. every reference is traced
3. all affected files are updated
4. no legacy references remain
5. the change is verified

---

## 4. REQUIRED CODE-TRACING BEFORE NAMING CHANGES

Before creating or changing a name, trace:

- where the name is created
- where it is imported
- where it is exported
- where it is saved
- where it is loaded
- where it is rendered
- where it is queried
- where it is deployed
- where it appears in documentation

If this trace is not complete, do not change the name.

---

## 5. QRG NAMING

QRG identity must follow the QRG authority file.

Base format:

QRG-[STNNN]-[C]-[IIIIII]

Full format:

QRG-[STNNN]-[C]-[IIIIII]-[SSCC]

Allowed context codes:

- I = Internal
- M = Member
- E = External
- O = Owner

Forbidden:

- QRG-PENDING
- QRG-UNASSIGNED
- fake QRG values
- placeholder QRG values
- fallback marketplace SKUs pretending to be QRG codes

QRG names must be server-generated and tied to real instances.

---

## 6. FILE NAMING

Before creating a file:

- inspect nearby files
- match the existing folder convention
- match casing style
- match suffix patterns
- match feature grouping

Do not create a new naming style.

Examples of patterns to preserve when already present:

- kebab-case service files
- camelCase utility files
- PascalCase React components
- feature-based folder names
- route files matching route responsibility

The existing codebase pattern wins.

---

## 7. COMPONENT NAMING

React components must follow existing component patterns.

Rules:

- do not rename existing components casually
- do not create duplicate components with similar names
- do not create "New", "Fixed", "Better", or "Final" versions
- update the original component unless a separate component is clearly justified
- preserve exported names unless the user requested a rename

Forbidden examples:

- `ProductCardNew`
- `ProductCardFixed`
- `BetterProductCard`
- `FinalProductCard`
- `AdminProductsV2`

Unless explicitly authorized, improve the existing component.

---

## 8. CLASS AND ID NAMING

Do not invent class names or IDs without checking existing usage.

Before touching classes or IDs:

- search for the class/ID
- inspect CSS modules/global styles
- inspect component references
- inspect tests or render assumptions
- inspect admin/store dependencies

Rules:

- preserve existing class names
- preserve existing IDs
- do not change selectors casually
- do not create parallel selectors for the same element
- do not use inline styles to bypass existing styling rules

---

## 9. FIRESTORE NAMING

Firestore naming must remain consistent.

Before adding or changing a collection or field:

- inspect `functions/src/constants.ts`
- inspect shared types
- inspect route usage
- inspect service usage
- inspect frontend reads/writes
- inspect security rules if present

Rules:

- collection names should be centralized where the codebase already centralizes them
- do not hardcode new collection names if constants exist
- do not rename fields without migration and full reference trace
- do not create duplicate fields with similar meanings

Forbidden examples:

- `productName` if system uses `title`
- `descriptionText` if system uses `description`
- `qrgCode` if system uses `qrg`
- `storeProducts` if existing collection is already defined differently

Existing schema wins.

---

## 10. API AND ROUTE NAMING

Before adding or changing routes:

- inspect `functions/src/index.ts`
- inspect `functions/src/routes/`
- inspect frontend API callers
- inspect service functions

Rules:

- match existing route naming style
- do not create duplicate endpoints for existing behavior
- do not bypass service layers
- do not put business logic in `index.ts`
- route names should describe stable system behavior, not temporary fixes

Forbidden examples:

- `/fixProduct`
- `/newProductSave`
- `/testCatalog2`
- `/adminProductsBetter`

---

## 11. PACKET NAMING

Product packet naming must match existing packet structure.

Before changing packet names or fields:

- inspect packet creation code
- inspect packet save/load code
- inspect admin/product builder code
- inspect store rendering code
- inspect surface publishing code

Rules:

- do not rename packet fields casually
- do not duplicate packet concepts
- do not create temporary packet schemas
- do not split packet identity from QRG identity unless authority files allow it

---

## 12. GRAPHICS ASSET NAMING

Graphics naming must match GRF.md and existing renderer code.

Before changing graphics names:

- inspect graphics renderer files
- inspect image save/load flows
- inspect mockup generation
- inspect product packet graphics config
- inspect admin graphics UI

Rules:

- preserve layer names
- preserve renderer key names
- preserve asset reference names
- do not rename QR/image/text layer keys without full trace

Graphics naming impacts rendering.

---

## 13. MARKETPLACE NAMING

Marketplace naming must not override QR Gear identity.

Rules:

- marketplace SKUs are not QRG identity unless explicitly mapped
- fallback marketplace IDs must not become real QRG codes
- marketplace listing names must preserve product packet identity
- external platform naming must not break internal system naming

Internal QRG identity wins.

---

## 14. FORBIDDEN NAMING BEHAVIOR

Forbidden:

- inventing new names without reading code
- renaming classes or IDs because they "look messy"
- creating duplicate concepts
- using temporary "fixed" names
- bypassing constants
- hardcoding collection names when constants exist
- changing casing style without reason
- changing schema names without migration
- claiming a rename is safe without tracing references

---

## 15. CHANGE APPROVAL RULE

Any naming change must be reported clearly.

Final response must include:

- old name
- new name
- reason for change
- files where references were traced
- files modified
- verification performed

If this cannot be provided, the naming change is not allowed.

---

## 16. MAINTENANCE RULE

Whenever this file changes:

- update the Table of Contents
- keep naming rules centralized here
- remove duplicated naming rules from README.md and REPLIT.md
- preserve the no-rename rule
- preserve code-tracing requirements

If the Table of Contents is outdated, the task is incomplete.
