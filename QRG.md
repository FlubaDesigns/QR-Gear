# QRG.md — QR Gear Identity System (AUTHORITY)

---

## TABLE OF CONTENTS

1. Purpose
2. Absolute Rules
3. Blank ID System (STNNN)
4. Full QRG Code Structure
5. Context Codes
6. Size Codes
7. Color Codes
8. Variant Suffix (SSCC)
9. Provider Separation (CRITICAL)
10. Validation Rules
11. Usage Rules
12. Forbidden Patterns
13. Source of Truth
14. Maintenance Rule

---

## 1. PURPOSE

This file defines the QRG Identity System.

QRG is the single source of truth for identity across:

- products
- blanks
- variants
- orders
- tracking
- system linking

QRG is NOT optional.  
QRG is NOT flexible.  
QRG is NOT inferred.

QRG is assigned, structured, and enforced.

---

## 2. ABSOLUTE RULES

- QRG codes are globally unique
- QRG codes are never renumbered
- QRG codes are never guessed
- QRG codes are never client-generated
- QRG codes are always server-generated
- QRG codes must map to a real instance
- QRG codes must follow exact format

Violation of any rule = system failure

---

## 3. BLANK ID SYSTEM (STNNN)

The Blank ID defines the physical product identity independent of any provider.

Format:

S T N N N

| Segment | Meaning |
|--------|--------|
| S | Super-category (1–6) |
| T | Product type within category (1–9) |
| NNN | Item number (001–999) |

### Super-Categories (S)

| Code | Category |
|------|----------|
| 1 | Apparel |
| 2 | Houseware |
| 3 | Print & Display |
| 4 | Accessories |
| 5 | Pet Products |
| 6 | Holiday & Seasonal |

### Example

11001

- 1 = Apparel  
- 1 = Type  
- 001 = Item  

### Storage Representation

| Use Case | Value |
|---------|------|
| Firestore ID | qrg_11001 |
| Display | QRG-11001 |
| Regex | ^[1-6][1-9][0-9]{3}$ |
| Doc ID Regex | ^qrg_[1-6][1-9][0-9]{3}$ |

---

## 4. FULL QRG CODE STRUCTURE

Used for orders, barcodes, and tracking only.

NOT used in:
- URLs
- packet IDs
- internal naming

### Format

QRG - STNNN - C - NNNNNN - SSCC

| Segment | Meaning |
|--------|--------|
| STNNN | Blank ID |
| C | Context |
| NNNNNN | Instance number (000001–999999) |
| SS | Size code |
| CC | Color code |

### Example

QRG-11101-M-000042-0501

### Regex

Full:
^QRG-([1-6][1-9][0-9]{3})-([IMEO])-(\d{6})-(\d{4})$

Base (no variant):
^QRG-([1-6][1-9][0-9]{3})-([IMEO])-(\d{6})$

---

## 5. CONTEXT CODES (C)

| Code | Meaning |
|------|--------|
| I | Internal |
| M | Member |
| E | External |
| O | Owner |

---

## 6. SIZE CODES (SS)

| Code | Size |
|------|------|
| 00 | One Size |
| 01 | XXS |
| 02 | XS |
| 03 | S |
| 04 | M |
| 05 | L |
| 06 | XL |
| 07 | 2XL |
| 08 | 3XL |
| 09 | 4XL |
| 10 | 5XL |

---

## 7. COLOR CODES (CC)

Global fixed color system (01–99)

| Code | Color |
|------|------|
| 01 | Black |
| 02 | White |
| 03 | Navy |
| 04 | Red |
| 05 | Royal Blue |
| 06 | Gray |
| 07 | Heather Gray |

Rules:

- Codes are global
- Codes are never reassigned
- Codes must be consistent across system

---

## 8. VARIANT SUFFIX (SSCC)

SSCC = Size + Color

Examples:

L + Black → 0501  
M + Navy → 0403  

---

## 9. PROVIDER SEPARATION (CRITICAL)

Providers are NOT identity. They are suppliers only.

### Provider Keys (Internal Only)

| Format | Meaning |
|--------|--------|
| py_123 | Printify blueprint |
| pf_456 | Printful product |
| qrg_11001 | Canonical blank |

### RULES

- Provider IDs NEVER appear in QRG
- Provider IDs NEVER replace QRG
- QRG is ALWAYS primary identity
- Provider mapping is secondary

---

## 10. VALIDATION RULES

A valid QRG must:

- match regex
- use valid STNNN
- use valid context
- use valid instance number
- use valid SSCC (if present)
- exist in system records

Invalid QRG = reject immediately

---

## 11. USAGE RULES

QRG is used for:

- order tracking
- barcode generation
- physical labeling
- inventory tracking
- system linking

QRG is NOT used for:

- URLs
- packet IDs
- graphics naming
- internal UI labels beyond display

---

## 12. FORBIDDEN PATTERNS

Strictly forbidden:

- QRG-PENDING
- QRG-UNASSIGNED
- QRG-TEMP
- QRG-TEST
- fake QRG values
- guessed QRG values
- client-generated QRG
- marketplace SKU used as QRG

Violation = system integrity failure

---

## 13. SOURCE OF TRUTH

QRG logic must be implemented in:

- server-side code
- shared utilities
- centralized generation logic

Never scattered across:

- frontend components
- random utilities
- inline functions

---

## 14. MAINTENANCE RULE

Whenever this file is updated:

- Update Table of Contents
- Preserve format rules
- Preserve separation from GRF, BLD, ASSEMBLY
- Do NOT add unrelated systems
- Keep QRG as identity-only layer

If QRG.md becomes mixed with other systems, it is considered broken.
