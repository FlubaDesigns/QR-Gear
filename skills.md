# QR Gear — Agent Skills Execution System (ENFORCED)

This is NOT a reference document.
This is a **mandatory execution system with proof-based enforcement**.

If any required block is missing → TASK IS NOT COMPLETE.

---

## Skill 0 — Read All Skills (Mandatory Gatekeeper)

**Skill file:** `.agents/skills/read-all-skills/SKILL.md`

This is the first skill. Its job is to prevent work from starting until the entire QR Gear execution system has been loaded.

### Absolute Start Rule

Before doing ANY task, you MUST:

- Read this skill
- Read all required skills
- Read README.md
- Follow the README REQUIRED FLOW

You are NOT allowed to answer requests, suggest code, write code, modify files, run commands, deploy, or rename anything until README.md authorizes execution.

### Mandatory Skill Load Order

1. `.agents/skills/read-all-skills/SKILL.md`
2. `.agents/skills/read-code-first/SKILL.md`
3. `.agents/skills/ask-before-starting/SKILL.md`
4. `.agents/skills/always-deploy/SKILL.md`
5. `.agents/skills/fail-loudly/SKILL.md`
6. `.agents/skills/update-readmes/SKILL.md`
7. `.agents/skills/present-changed-files/SKILL.md`

### Required Confirmation

CONFIRMED:
- Skills loaded
- README.md read in full
- replit.md read in full
- Authority files read in full
- NAMING_STANDARDS.md read in full
- Affected code traced before changes

### Restart Enforcement

If README.md has not been read → respond exactly:

RESTART REQUIRED: README flow not completed.

If confirmation is missing → respond exactly:

RESTART REQUIRED: Confirmation missing.

---

## Skill 1 — Execution Protocol (READ FIRST — ALWAYS)

Every task MUST follow this exact flow:

**PHASE 1 → PHASE 2 → (PHASE 4 if triggered) → PHASE 5 → PHASE 3**

No skipping. No reordering. No guessing. No silent completion.

---

### PHASE 1 — PRE-OPERATION (MANDATORY UNDERSTANDING)

#### STEP 1 — REQUIRED FILE READ (NO EXCEPTIONS)

Agent MUST read FIRST:

- `README.md` (root)
- `replit.md`

Then read:

- Relevant feature README(s)
- Actual source files involved

Do NOT ask questions before reading.

#### STEP 2 — REQUIRED PRE-OP PROOF BLOCK

Agent MUST output BEFORE coding:

```
PRE-OP PROOF:

TARGET FILES:
- [exact paths]

FILES READ:
- README.md
- replit.md
- [other files]

CHANGE PLAN:
- [exact change]

DO NOT TOUCH:
- [explicit boundaries]

REASON:
- [why this is correct]

DEPLOYMENT IMPACT:
- Frontend / Backend / Both / Docs Only
```

If missing → STOP.

#### STEP 3 — QUESTION RULE

Max 3 questions ONLY if:

- Requirement missing
- Target unclear
- Risk of wrong system

Otherwise proceed.

#### FAILURE CONDITIONS (PHASE 1)

- Skipped reading required files
- Missing Pre-Op block
- Guessing
- Unnecessary questions

→ STOP

---

### PHASE 2 — CONTROLLED EXECUTION

Execute ONLY the Pre-Op plan.

#### Rules

- No silent fallbacks
- No fake data
- No placeholder logic
- No refactors unless required
- No unrelated changes

#### NO-DRIFT LOCK

If not directly tied to task → FORBIDDEN

If other issues found:
- Log them
- Do NOT fix them

#### FAILURE CONDITIONS (PHASE 2)

- Scope drift
- Hidden logic
- Broken behavior

→ STOP

---

### PHASE 4 — BACKEND FINALIZATION (CONDITIONAL)

**TRIGGER:** ANY change in `functions/src/`

#### Required Backend Proof Block

```
BACKEND PROOF:

MODIFIED FILES:
- [list]

PREVIOUS BUILD_ID:
- [value]

NEW BUILD_ID:
- [value]

BUILD_ID CHANGED:
- YES / NO
```

If NO → STOP

#### Backend Validation

- No silent failures
- Proper HTTP status codes
- No fake fallbacks
- No `return []`
- Clear logging prefixes
- Production code is in `functions/src/`
- No reliance on `server/` for production

---

### PHASE 5 — POST-DEPLOY VERIFICATION

After deployment completes:

- Confirm live URL responds: https://qrgear-c1ffd.web.app
- Confirm the changed route or UI behaves as expected
- If verification fails → report loudly, do not claim completion

---

### PHASE 3 — TASK COMPLETION

Task is only complete when:

- All phases executed
- Proof blocks present
- Deploy verified
- Changed files added to zip
- READMEs updated if structural change
- User notified with summary

---

## Skill 2 — Always Deploy to Firebase Production

**Rule:** Deploy to Firebase production after every code change. Never consider a task
done until it is live at https://qrgear-c1ffd.web.app.

### Why Three Separate Steps

The full pipeline takes 100–110 seconds chained — right at the edge where the sandbox
kills the process. Three separate bash calls avoid silent SIGKILL failures.

### The Three Scripts — Always Run in Order

**Step 1 — Build** (timeout: 90000ms)
```bash
bash deploy/1-build.sh
```
Bumps `_BUILD_ID` with timestamp+random, builds frontend and functions. If tsc fails, stop.

**Step 2 — Deploy Functions** (timeout: 90000ms)
```bash
bash deploy/2-functions.sh
```
Deploys Cloud Functions to Firebase.

**Step 3 — Deploy Hosting** (timeout: 75000ms)
```bash
bash deploy/3-hosting.sh
```
Deploys frontend to Firebase Hosting.

### Critical Timeout Rules

- If step 2 times out (exit code 124 or no output) → **Firebase completed the upload
  server-side anyway. Go straight to step 3. Do NOT re-run step 1 or 2.**
- If step 2 says "Skipped (No changes detected)" after a timeout → same thing, go to step 3.
- If step 2 says "No changes detected" WITHOUT a prior timeout → step 1 didn't run or
  `sed` failed. Re-run step 1 only, then retry step 2.

### Why BUILD_ID Matters

`_BUILD_ID` is a string constant on line 1 of `functions/src/index.ts`. Changing it
changes the compiled bundle hash. Without bumping it, Firebase silently skips deployment
("No changes detected") even when source changed.

### Frontend-Only Changes

If only `client/` files changed (no `functions/src/` edits):
1. Run step 1 (build only)
2. Skip step 2
3. Run step 3

### Production Rules

- All backend logic lives in `functions/src/routes/` — these are the Cloud Functions
- The Express dev server (`server/`) is local development only — NEVER the deploy target
- NEVER edit `server/` routes expecting production to reflect the change
- NEVER deploy `--only functions,hosting` together — it times out and dies silently
- NEVER add predeploy hooks back to `firebase.json` — causes timeout inside Firebase's runner
- ALWAYS pass `--force` (already baked into the scripts)

**Firebase project:** `qrgear-c1ffd`
**Build ID location:** `functions/src/index.ts` line 1
**Live URL:** https://qrgear-c1ffd.web.app

---

## Skill 3 — Ask Before Starting

**Rule:** Before writing a single line of code or making any change, ask the user
clarifying questions. This applies to every task, no matter how small.

### What to Ask

1. **What exactly** is the problem or feature? Get a precise description.
2. **Where** is it? Which screen, which component, which control?
3. **What behavior** do they want? What should it do that it doesn't do now?
4. **What should NOT change?** Constraints, things to leave alone, behavior to preserve.
5. **Scope** — small tweak or larger change? Confirm before going broad.

### Why This Matters

- The user knows their app. You don't always know what "the text box" refers to.
- Fixing the wrong thing wastes time.
- Adding things never asked for (padding, defaults, resets) is worse than doing nothing.
- "Looks related" is not good enough — confirm before touching.

### What NOT to Do

- Do not read code and immediately start editing because something looks like the problem.
- Do not assume a component name or file from context — ask or confirm.
- Do not add, remove, or change behavior that wasn't explicitly requested.
- Do not start a deploy or build until the user has confirmed the plan.
- Do not edit `server/` routes for production fixes — they have no effect in production.

### The Pattern

```
User: "The X is broken / limited / wrong"
Agent: Ask 2–3 targeted clarifying questions.
User: Answers.
Agent: Summarize the plan in plain language. Confirm.
User: Confirms.
Agent: Start work.
Agent: Deploy to Firebase production.
```

### Example

User: "The position left right on the x-axis is very limited trying to go to the left."

WRONG: Immediately read graphicLayout.ts and start editing position math.

RIGHT: "Which control are you referring to — the QR position slider, the text box
position, or something else? And where in the builder do you see it?"

---

## Skill 4 — Fail Loudly

**Rule:** When something fails to load, fetch, or initialize, always surface the error
explicitly. Never let failures happen silently.

### What to Avoid

```tsx
// BAD: Silent fallback — user sees empty content with no idea why
const description = p.description || p.model || null;

// BAD: Error swallowed
try {
  const data = await fetchCatalog();
  setItems(data);
} catch (e) {
  // silently do nothing
}

// BAD: Returns empty array on failure — caller can't tell if it worked
if (!res.ok) return [];
```

### What to Do Instead

```tsx
// GOOD: Show an error state the user can see
const { data, isLoading, error } = useQuery({ ... });
if (error) return <ErrorMessage message="Failed to load products. Please try again." />;

// GOOD: Log clearly and surface the error
} catch (e) {
  console.error("[CatalogLoad] Failed:", e);
  res.status(500).json({ error: e.message });
}

// GOOD: Return a meaningful error, not empty data
if (!res.ok) {
  console.error("[API] Catalog fetch failed:", res.status);
  throw new Error(`Catalog unavailable (${res.status})`);
}
```

### Specific Patterns

- **TanStack Query:** Always handle the `error` state from `useQuery`. Show a visible
  error message or toast — not just `isLoading`.
- **API routes:** Never return `200 OK` with empty data when the real cause is a failure.
- **Fallback chains:** If you write `a || b || null`, ask whether `b` is a real fallback
  or a disguise for a broken `a`. If `a` should always have data, log an error.
- **Silent empty arrays:** `return []` on failure hides the problem. Throw instead.
- **Firebase/Firestore:** If a collection read returns 0 docs when it should have data,
  log it as an error with the collection name.

### Console Log Format

Every caught error should include:
1. Which module/function failed (prefix like `[ProductsModule]`, `[Catalog API]`)
2. What it was trying to do
3. The actual error message

```ts
console.error("[Catalog API] Failed to read printify_blueprints:", e.message);
```

---

## Skill 5 — Present Changed Files After Every Task

**Rule:** After completing any fix, update, or build task, add only the files that were
created or modified into `downloads/QR_Gear_Full_Website.zip`.

### Command

Use `-u` flag (update) — adds new files and updates changed ones, never removes existing:

```bash
cd /home/runner/workspace && zip -u downloads/QR_Gear_Full_Website.zip \
  functions/src/routes/print-placements.ts \
  functions/src/index.ts
```

### Rules

- Use `zip -u` — never recreate the zip from scratch, only update it
- Run from `/home/runner/workspace` so paths inside the zip match the project structure
- **Only files touched this session** — do not add the entire codebase
- Do NOT include: files you only read, `package-lock.json`, `node_modules/`,
  `functions/lib/`, `.firebase/*.cache`, nested zip files, `attached_assets/`, `downloads/`
- Do this **before** telling the user the task is complete

---

## Skill 6 — Update READMEs After Every Change

**Rule:** After completing any feature, fix, or structural change, update both README
files before closing out the task.

### Files to Update

- `README.md` — root-level overview (stack, concepts, admin interface)
- `client/src/features/adminProducts/ADMIN_README.md` — detailed admin guide

### What to Update in ADMIN_README.md

1. **Update `Last updated` date** at the top
2. **Update the relevant section** (Admin Dashboard, Product Builder, Store Builder, etc.)
3. **Update the Firestore Collections table** if new collections were added
4. **Prepend a new entry to `## Recent Changes Log`**:

```markdown
### [Month Day, Year] — [Short Title]

[One paragraph description of what changed and why.]

#### Files Changed
| File | Change |
|------|--------|
| `path/to/file.ts` | What changed |
```

### Re-zip After Updating

```bash
cd /home/runner/workspace && zip -u downloads/QR_Gear_Full_Website.zip \
  README.md \
  client/src/features/adminProducts/ADMIN_README.md
```

---

## Skill 7 — Zip Export Rules

**Rule:** Use explicit includes when building the full website zip — do NOT use
`zip -r . --exclude ...` as it sweeps temp files that slip past patterns.

### Explicit Include Command

```bash
cd /home/runner/workspace && zip -r downloads/QR_Gear_Full_Website.zip \
  client/src \
  client/index.html \
  client/public \
  server \
  functions/src \
  functions/tsconfig.json \
  functions/vitest.config.ts \
  functions/package.json \
  shared \
  migrations \
  .agents \
  replit.md \
  skills.md \
  README.md \
  NAMING_STANDARDS.md \
  ADMIN_MANUAL.md \
  METHODOLOGY.md \
  PRODUCTION_INVENTORY.md \
  ARCHITECTURE_IDENTITY.md \
  ARCHITECTURE_VIEWER.md \
  ASSET_LIBRARY_SPEC.md \
  BLD.md \
  GRF.md \
  ASSEMBLY.md \
  QRG.md \
  NAMING_STANDARDS.md \
  tailwind.config.ts \
  tsconfig.json \
  vite.config.ts \
  postcss.config.js \
  package.json \
  storage.rules \
  firestore.rules \
  firestore.indexes.json \
  firebase.json \
  .firebaserc \
  .gcloudignore \
  drizzle.config.ts \
  deploy
```

### What is Excluded and Why

| Excluded | Reason |
|---|---|
| `node_modules/` | Installed dependencies — not source code |
| `.git/` | Version control internals |
| `downloads/` | The zip itself — would cause recursive inclusion |
| `attached_assets/` | Large uploaded reference images |
| `.local/` | Agent workspace internals |
| `dist/` | Build output — not source |
| `functions/lib/` | Compiled TypeScript output |
| `client/public/img/*` | Large product/hero images |
| `client/src/assets/*.png` | Large binary assets |
| `package-lock.json` | Auto-generated, large, not needed |
| `functions/.env` | Contains secrets — never zip |
