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
GRF-[D1][D2][D3][D4][D5][D6]-[NNNNNN]

Three-character brand prefix, six single-digit descriptor positions, and a 6-digit zero-padded global sequence.
Example: GRF-111611-000007

Regex:
^GRF-\d{6}-\d{6}$

---

D1 — ASSET CLASS

1 = input_build     (source uploads, backgrounds, templates — inputs to the build)
2 = output_artifact (QR composites, glamor shots, URL graphics — outputs of the build)

---

D2 — MEDIA TYPE

1 = image
2 = video
3 = document

---

D3 — CHANNEL

1 = print (goes to physical product / print provider)
2 = store (displayed in customer-facing storefront)
3 = url   (lives on landing page / digital artifact)

---

D4 — PURPOSE

1 = qr_composite   (QR merged with zone/palette graphic — print face)
2 = qr_standalone  (QR code with QRG logo on white box)
3 = url_graphic    (image created for landing page / digital artifact)
4 = glamor_shot    (lifestyle/mockup render — store-facing)
5 = source_upload  (raw asset uploaded before any processing)
6 = background     (background image used in builder composition)
7 = template       (reusable graphic applied across products)

---

D5 — FORMAT (depends on D2)

Image (D2=1): 1=PNG  2=JPEG  3=WebP  4=SVG
Video (D2=2): 1=MP4  2=WebM
Document (D2=3): 1=PDF

---

D6 — SUB-CONTEXT (depends on D3)

Print (D3=1): 1=Front  2=Back  3=Sleeve
Store (D3=2): 1=First  2=Second  3=Third  4=Fourth  5=Fifth
URL   (D3=3): 1=Internal  2=External

---

NNNNNN — COUNTER

6-digit zero-padded global sequence number.
Range: 000001–999999
Counter stored in Firestore: grf_counters/global  { count: N }
Single global counter — never per type or per pairing.

---

EXAMPLES

GRF-111611-000007   input · image · print · background · png · front  (#7)
GRF-211211-000001   output · image · print · qr_standalone · png · front  (#1)
GRF-211111-000001   output · image · print · qr_composite · png · front  (#1)
GRF-213311-000001   output · image · url · url_graphic · webp · internal  (#1)

---

RULES

- Must match regex exactly
- All six descriptor digits must be valid per their respective tables
- Format (D5) must be compatible with media type (D2)
- Sub-context (D6) must be compatible with channel (D3)
- Hard error on any invalid combination — reject, do not save
- Global counter only — never per type

---

STORAGE FIELDS (REFERENCE — from grf_assets/{grfId})

grfId, assetClass, mediaType, channel, purpose, format, subContext, sequence,
assetClassName, mediaTypeName, channelName, purposeName, formatName, subContextName,
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
