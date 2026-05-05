# QR Gear System – ENTRY POINT CONTROL ROUTER

---

## TABLE OF CONTENTS

1. Execution Gate
2. Required Flow
3. Required Confirmation
4. Enforcement Rule
5. System Identity
6. System Structure
7. Authority Map
8. Code-Tracing Requirement
9. Final Rule
10. README Maintenance Rule

---

## 1. EXECUTION GATE

STOP.

This README is the required entry point for the QR Gear project.

You are NOT allowed to:

- write code
- suggest code
- modify files
- run commands
- deploy
- answer implementation questions
- rename files, classes, IDs, collections, fields, routes, or components

UNTIL the REQUIRED FLOW below is completed.

Failure to complete the REQUIRED FLOW makes the response invalid.

---

## 2. REQUIRED FLOW

You MUST complete ALL steps in this exact order.

No skipping.  
No summarizing instead of reading.  
No assuming prior knowledge.  
No relying on memory.

---

### STEP 1 — LOAD ALL SKILLS

Read all required skills:

- `.agents/skills/read-all-skills/SKILL.md`
- `.agents/skills/read-code-first/SKILL.md`
- `.agents/skills/ask-before-starting/SKILL.md`
- `.agents/skills/always-deploy/SKILL.md`
- `.agents/skills/fail-loudly/SKILL.md`
- `.agents/skills/update-readmes/SKILL.md`
- `.agents/skills/present-changed-files/SKILL.md`

---

### STEP 2 — LOAD CONTROL FILE

Read in full:

- `replit.md`

Follow all execution rules inside it.

---

### STEP 3 — LOAD AUTHORITY FILES

Read in full:

- `QRG.md`
- `BLD.md`
- `GRF.md`
- `ASSEMBLY.md`

These are authority files.

They define system behavior and MUST NOT be overridden by guesses, assumptions, convenience, or newly invented patterns.

---

### STEP 4 — LOAD NAMING STANDARDS

Read in full:

- `NAMING_STANDARDS.md`

Naming rules are mandatory.

You are NOT allowed to invent or rename:

- file names
- class names
- component names
- IDs
- Firestore collections
- Firestore fields
- route names
- API names
- packet names
- graphics layer names
- QRG structures

You must match the existing codebase.

---

### STEP 5 — TRACE CODE BEFORE ACTION

Before any implementation work, you MUST:

- identify affected files
- read the relevant code
- trace the full data flow
- confirm existing naming patterns
- identify exact change points
- check whether authority files already define the answer

No guessing.  
No assumptions.  
No invented structures.

---

## 3. REQUIRED CONFIRMATION

Before proceeding with implementation, you MUST output exactly:

CONFIRMED:
- Skills loaded
- README.md read in full
- replit.md read in full
- Authority files read in full
- NAMING_STANDARDS.md read in full
- Affected code traced before changes

If this confirmation is missing, the task is not authorized.

---

## 4. ENFORCEMENT RULE

If the REQUIRED CONFIRMATION is not present:

- STOP
- DO NOT continue
- DO NOT answer the implementation request
- DO NOT write code
- DO NOT run commands

You MUST respond exactly:

RESTART REQUIRED: Confirmation missing.

No exceptions.

---

## 5. SYSTEM IDENTITY

QR Gear is not just a store.

QR Gear is a system built around this loop:

PRODUCT → QR CODE → EXPERIENCE → SHARE → NEW USER → REPEAT

Every change must support this loop.

If a change does not support this loop, it must be questioned before implementation.

---

## 6. SYSTEM STRUCTURE

High-level structure:

- Frontend: React / Vite
- Backend: Firebase Cloud Functions
- Database: Firestore
- Hosting: Firebase Hosting
- Integrations:
  - Printify
  - Printful
  - marketplace systems
  - QR/digital experience systems

Backend entry point:

- `functions/src/index.ts`

Rule:

- `functions/src/index.ts` is wiring only
- business logic belongs in routes, services, adapters, or shared modules

---

## 7. AUTHORITY MAP

This README is the entry router.

It does not contain all system logic.

System truth lives in these files:

- `replit.md` — execution control, deploy rules, response contract
- `QRG.md` — QR identity law and QRG format
- `BLD.md` — build logic and build schema
- `GRF.md` — graphics/rendering rules
- `ASSEMBLY.md` — final packet/product composition rules
- `NAMING_STANDARDS.md` — naming, file, ID, and schema consistency rules

Rules:

- Do NOT duplicate authority logic here
- Do NOT override authority files
- Do NOT invent alternatives
- Always read the proper authority file before acting

---

## 8. CODE-TRACING REQUIREMENT

Reading documentation is not enough.

Before changing any file, you MUST read the affected code.

You must trace:

- where data starts
- where data is transformed
- where data is saved
- where data is loaded
- where data is rendered
- where names/classes/IDs are referenced
- where deployment or production behavior is affected

If the code has not been traced, implementation is not authorized.

---

## 9. FINAL RULE

If REQUIRED FLOW is not completed:

YOU ARE NOT AUTHORIZED TO ACT.

If code was not traced:

YOU ARE NOT AUTHORIZED TO CHANGE FILES.

If naming standards were not checked:

YOU ARE NOT AUTHORIZED TO CREATE OR RENAME ANY STRUCTURE.

---

## 10. README MAINTENANCE RULE

This README is a control router.

Whenever this README is modified:

- update the Table of Contents
- keep section numbers correct
- keep authority file pointers accurate
- remove duplicated logic that belongs in authority files
- preserve the execution gate
- preserve the required confirmation
- preserve restart enforcement

If the Table of Contents is outdated, the task is incomplete.
