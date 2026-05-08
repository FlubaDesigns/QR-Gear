# QR GEAR SYSTEM — ROOT README (ENFORCED)

========================================
SYSTEM ENTRY POINT — MANDATORY READ

This document controls ALL agent behavior at startup.

This is NOT a general README.
This is an execution router and enforcement layer.

Agents MUST follow this sequence exactly.

---

🔒 CANONICAL CORE AUTHORITY (ABSOLUTE LAW)

The following files ARE the system:

- BLD.md      → Build Structure
- GRF.md      → File Identity
- QRG.md      → Instance Identity
- ASSEMBLY.md → Mapping Layer

These four files form the COMPLETE and ONLY definition of system behavior.

---

❗ ABSOLUTE RULES

1. NO OTHER FILE may:
   
   - Redefine their logic
   - Summarize them with altered meaning
   - Introduce alternate structures
   - Extend their responsibilities

2. ALL OTHER DOCUMENTS are:
   
   - SUPPORTING
   - DESCRIPTIVE
   - NON-AUTHORITATIVE

3. IF ANY CONFLICT EXISTS:
   → CANONICAL CORE ALWAYS WINS
   → ALL OTHER SOURCES ARE INVALID

4. THESE FILES MUST BE READ DIRECTLY
   → NEVER rely on summaries

5. AGENTS MUST NOT:
   
   - Infer missing behavior
   - Create fallback logic
   - "Fill in gaps"

---

📊 AUTHORITY TIERS

TIER 1 — CANONICAL CORE (LAW)

- BLD.md
- GRF.md
- QRG.md
- ASSEMBLY.md

TIER 2 — CONTROL LAYER

- README.md
- REPLIT.md
- SKILLS.md
- NAMING_STANDARDS.md
- METHODOLOGY.md
- VVSS.md         → UI Architecture (Viewer / View / Skin / Shape)

TIER 3+ — NON-CANONICAL

ALL other ".md" files
→ informational ONLY
→ never authoritative

---

🔐 ZIP / MANIFEST INTEGRITY CHECK (MANDATORY)

Before any agent proceeds:

1. Confirm MANIFEST.json exists at project root
2. Run manifest verification:

   node scripts/verify-manifest.js

   or:

   npm run manifest:verify

3. Confirm all Canonical Core files are present and hash-valid

If verification fails:

→ STOP
→ REPORT EXACT FAILURE
→ DO NOT BUILD
→ DO NOT DEPLOY
→ DO NOT MODIFY unrelated files

MANIFEST must be regenerated LAST after any intentional file change:

   npm run manifest:generate

Regenerate ONLY after confirming the change was intentional.
If any tracked file changes after MANIFEST.json is generated, verification will fail.
This is correct behavior — it means something changed unexpectedly.

---

🧪 FILE PRESENCE CHECK (MANDATORY)

Before proceeding, the agent MUST confirm the existence of:

- BLD.md
- GRF.md
- QRG.md
- ASSEMBLY.md
- REPLIT.md
- SKILLS.md
- NAMING_STANDARDS.md

If ANY file is missing:

→ STOP
→ REPORT MISSING FILE
→ DO NOT CONTINUE

---

🔁 REQUIRED READ SEQUENCE (NO SKIPPING)

Agents MUST read in this order:

1. README.md (this file)
2. SKILLS.md
3. REPLIT.md
4. NAMING_STANDARDS.md
5. BLD.md
6. GRF.md
7. QRG.md
8. ASSEMBLY.md

---

✅ REQUIRED CONFIRMATION (MANDATORY OUTPUT)

Before ANY implementation, agents MUST output EXACTLY:

CONFIRMED:
- README.md read in full
- SKILLS.md read in full
- REPLIT.md read in full
- NAMING_STANDARDS.md read in full
- BLD.md read in full
- GRF.md read in full
- QRG.md read in full
- ASSEMBLY.md read in full
- Affected code traced before changes

If this confirmation cannot be truthfully produced:

→ STOP
→ DO NOT PROCEED
→ DO NOT WRITE CODE
→ DO NOT RUN COMMANDS

If confirmation is absent from the response:

→ RESTART REQUIRED: Confirmation missing.

---

🔍 CODE-TRACING REQUIREMENT

Reading documentation is NOT enough.

Before changing ANY file, agents MUST trace:

- Where the data starts
- How the data transforms
- Where the data is saved
- Where the data is loaded
- Where the data is rendered
- What naming is used throughout
- What other files depend on it

If code has not been traced:

→ IMPLEMENTATION IS NOT AUTHORIZED
→ DO NOT MODIFY FILES

---

🔄 CONTINUOUS REVALIDATION RULE

This is NOT a one-time read.

At EVERY major step, agents MUST:

- Re-check Canonical Core rules
- Validate current work against BLD / GRF / QRG / ASSEMBLY
- Reject any drift or assumption

---

🚫 PROHIBITED BEHAVIOR

Agents MUST NOT:

- Invent system behavior
- Use docs/* as source of truth
- Introduce fallback values
- Create temporary IDs (QRG, GRF, etc.)
- Skip validation steps
- Modify canonical definitions

---

✅ VALIDATION GATE (BEFORE ANY BUILD)

Before executing ANY system action:

Agent MUST confirm:

1. Canonical Core has been read
2. No conflicting definitions are in use
3. All required files are present
4. Work aligns strictly with BLD / GRF / QRG / ASSEMBLY

If ANY check fails:

→ STOP
→ DO NOT PROCEED

---

🧠 SYSTEM INTENT

There is ONE system.
There is ONE definition.
There is NO interpretation layer.

The Canonical Core is the ONLY truth.

---

🔚 END OF README — EXECUTION BEGINS
