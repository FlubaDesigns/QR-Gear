# Read All Skills – Mandatory Gatekeeper Skill

---

## TABLE OF CONTENTS

1. Purpose
2. Absolute Start Rule
3. Mandatory Skill Load Order
4. Mandatory README Handoff
5. Restart Enforcement
6. Required Confirmation
7. Forbidden Behavior
8. Completion Standard

---

## 1. PURPOSE

This is the first skill.

Its job is to prevent work from starting until the entire QR Gear execution system has been loaded.

This skill does NOT replace README.md.

This skill forces the agent into README.md.

README.md is the project entry point and control router.

---

## 2. ABSOLUTE START RULE

Before doing ANY task, you MUST:

- read this skill
- read all required skills
- read README.md
- follow the README REQUIRED FLOW

You are NOT allowed to:

- answer the user's implementation request
- suggest code
- write code
- modify files
- run commands
- deploy
- rename anything

until README.md authorizes execution.

---

## 3. MANDATORY SKILL LOAD ORDER

Read these skills in order:

1. `.agents/skills/read-all-skills/SKILL.md`
2. `.agents/skills/read-code-first/SKILL.md`
3. `.agents/skills/ask-before-starting/SKILL.md`
4. `.agents/skills/always-deploy/SKILL.md`
5. `.agents/skills/fail-loudly/SKILL.md`
6. `.agents/skills/update-readmes/SKILL.md`
7. `.agents/skills/present-changed-files/SKILL.md`

Do not skip any skill.

Do not summarize instead of reading.

Do not assume prior knowledge.

---

## 4. MANDATORY README HANDOFF

After all skills are loaded, you MUST immediately read:

- `README.md`

Then you MUST follow the REQUIRED FLOW inside README.md.

README.md will direct you to:

- `replit.md`
- `QRG.md`
- `BLD.md`
- `GRF.md`
- `ASSEMBLY.md`
- `NAMING_STANDARDS.md`
- affected source code

The README flow is mandatory.

---

## 5. RESTART ENFORCEMENT

If README.md has not been read:

STOP.

Respond exactly:

RESTART REQUIRED: README flow not completed.

If README.md was read but its REQUIRED FLOW was not completed:

STOP.

Respond exactly:

RESTART REQUIRED: README flow not completed.

If README.md requires confirmation and confirmation is missing:

STOP.

Respond exactly:

RESTART REQUIRED: Confirmation missing.

No exceptions.

---

## 6. REQUIRED CONFIRMATION

Do not proceed until the README-required confirmation has been produced.

The required confirmation is:

CONFIRMED:
- Skills loaded
- README.md read in full
- replit.md read in full
- Authority files read in full
- NAMING_STANDARDS.md read in full
- Affected code traced before changes

If this confirmation cannot be truthfully produced, work cannot begin.

---

## 7. FORBIDDEN BEHAVIOR

You are forbidden from:

- guessing
- assuming file structure
- inventing names
- renaming classes or IDs casually
- changing schema without tracing usage
- writing code before reading affected code
- deploying before the mandatory deploy flow
- claiming completion without verification
- saying something was read when it was not read

---

## 8. COMPLETION STANDARD

This skill is complete only when:

- all skills have been read
- README.md has been read
- README.md REQUIRED FLOW has been followed
- required confirmation has been produced
- affected code has been traced before changes

Anything less is incomplete.
