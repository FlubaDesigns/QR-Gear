# SYSTEM_KEYS.md — REFERENCE ONLY (NON-CANONICAL)

========================================
⚠️ NOT A SOURCE OF TRUTH

This file is a REFERENCE MIRROR only.

All definitions originate from:

- BLD.md
- GRF.md
- QRG.md
- ASSEMBLY.md

If ANY conflict exists:
→ THIS FILE IS WRONG
→ CANONICAL CORE WINS

This file must NEVER:

- Define behavior
- Introduce new structures
- Override canonical logic

========================================
SECTION 1 — QRG KEY (IDENTITY SYSTEM)

FORMAT:
QRG-[STNNN]-[C]-[IIIIII]-[SSCC]

---

STNNN — BLANK ID

S = Super-category (single digit: 1–6)
T = Product type within category (single digit: 1–9)
NNN = Item number (001–999)

Super-categories:
1 = Apparel
2 = Houseware
3 = Print & Display
4 = Accessories
5 = Pet Products
6 = Holiday & Seasonal

(Defined in QRG.md — do not extend here)

---

C — CONTEXT

I = Internal
M = Member
E = External
O = Owner

---

IIIIII — INSTANCE ID

6-digit zero-padded unique instance identifier (000001–999999)

---

SSCC — VARIANT SUFFIX

SS = Size code (two digits)
CC = Color code (two digits)

Size codes (SS):
00 = One Size
01 = XXS  02 = XS  03 = S  04 = M
05 = L    06 = XL  07 = 2XL  08 = 3XL
09 = 4XL  10 = 5XL

Color codes (CC):
01 = Black   02 = White   03 = Navy
04 = Red     05 = Royal Blue   06 = Gray
07 = Heather Gray

---

STORAGE REPRESENTATION

Firestore ID: qrg_STNNN  (e.g. qrg_11001)
Display:      QRG-STNNN  (e.g. QRG-11001)

---

RULES

- Must map to a real, existing instance
- NO placeholders
- NO "PENDING"
- NO "UNASSIGNED"
- Must be server-generated, not client-generated

========================================
SECTION 2 — BLD KEY (BUILD STRUCTURE)

FORMAT:
BLD-[C][M][N]-[SEQ]

Example:
BLD-SZ9-001

---

C — CONTEXT (WHAT IS BEING BUILT)

S = Shirt
U = URL
(Extend ONLY via BLD.md)

---

M — MODE / LAYOUT TYPE

S context:
  Z = Zone layout (structured top / middle / bottom regions)
  P = Palette (full canvas image with QR superimposed)

U context:
  I = Image
  V = Video
  D = Document

(Defined in BLD.md — do not extend here)

---

N — INSTANCE COUNT

Single digit: 0–9

Represents number of ordered slots in build.
Values above 9 are NOT supported in BLD v1.

---

SEQ — BUILD SEQUENCE

3-digit sequence identifier (001–999)
Atomically allocated per context + mode branch.

---

VEHICLE TYPES (VALID ONLY)

txt = text
img = image
qrc = QR code
act = action / CTA
vid = video
doc = document

---

RULES

- BLD defines STRUCTURE ONLY
- NO content allowed in BLD
- NO GRF data in BLD
- NO QRG data in BLD
- Instance count MUST match actual slot definitions
- Vehicles must resolve to valid types during Assembly

---

DIAGRAM SHORTHAND (NON-STORAGE)

T / I / A / Q

→ Diagram references only
→ NEVER used in code, storage, or data

========================================
SECTION 3 — GRF KEY (FILE IDENTITY)

FORMAT:
GRF-TT-K-NNNNNN

Regex:
^GRF-(01|02|03|04|05|06|07)-([12345])-(\d{6})$

---

TT — TYPE CODE

01 = upload_source      (raw uploaded source image — unmodified)
02 = cropped_derivative (cropped or derived from a source image)
03 = background         (background image for canvas compositions)
04 = qr_graphic         (QR code image file — no surrounding design)
05 = canvas_design      (full canvas composite — QR + overlays + background)
06 = url_artifact_asset (rendered external or linked artifact image)
07 = template_graphic   (reusable template file)

---

K — ROLE CODE

1 = Source      (original, unmodified — raw input)
2 = Derivative  (processed or transformed from a source)
3 = Renderable  (ready to display, embed, or print)
4 = Final       (approved and locked — immutable)
5 = Template    (reusable pattern — not a one-off instance)

---

VALID TT / K PAIRINGS

01 → 1
02 → 2
03 → 3
04 → 3
05 → 3, 4
06 → 3
07 → 5

Any other pairing: INVALID — throw error, reject save

---

NNNNNN — COUNTER

6-digit zero-padded incremental ID per (TT + K) pairing
Range: 000001–999999
Counter stored in Firestore: grf_counters/{TT}_{K}

---

RULES

- Must match regex exactly
- TT/K pairing must be in the valid pairings table
- mimeType must be compatible with TT (all current types → image/*)
- Final (K=4) is immutable — no overwrite, no replace, no metadata change
- No invalid combinations allowed — hard error on violation

---

STORAGE FIELDS (REFERENCE — from grf_assets/{grfId})

grfId, typeCode, roleCode, typeName, name, description,
mimeType, storagePath, publicUrl, sourceGrfId,
relatedPacketId, tags, isActive, archivedAt,
createdAt, createdBy

========================================
SECTION 4 — ASSEMBLY KEY (MAPPING RULES)

ID FORMAT:
ASM-NNNNNN

6-digit zero-padded sequence (000001–999999)
Minted atomically from Firestore counter: asm_counters/global
Regex: ^ASM-\d{6}$

---

CORE ROLE

BLD      → defines slots and structure
ASSEMBLY → maps slots to assets
GRF      → supplies the asset files
QRG      → anchors the product identity

---

RULES

- Slot count MUST match required BLD slot count
- Every REQUIRED slot MUST be assigned
- Optional slots (e.g. act / CTA) may be legitimately absent
- No duplicate slot assignments
- No extra mappings beyond BLD slot definitions
- Order MUST match BLD sequence exactly
- Each required slot must resolve to ONE valid GRF asset or value
- Vehicle types must match BLD slot expectations

---

PROHIBITED

- No fallback assets
- No auto-generation or default substitutions
- No conditional logic
- No layout definitions (BLD responsibility)
- No file identity definitions (GRF responsibility)
- No product identity definitions (QRG responsibility)

---

VALIDATION (MANDATORY BEFORE BUILD)

1. BLD exists and is valid
2. Slot count matches required BLD slot count
3. All required slots are assigned
4. All GRF IDs resolve to valid, active grf_assets records
5. All vehicle types match BLD slot expectations
6. Slot order matches BLD sequence exactly
7. QRG identity is valid and resolves in master_catalog

Any failure:
→ STOP BUILD
→ THROW ERROR
→ DO NOT CONTINUE

========================================
END OF SYSTEM_KEYS.md
