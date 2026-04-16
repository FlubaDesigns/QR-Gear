# QR Gear — Agent Skills Reference

Four user-defined skills govern every task in this project. They are mandatory, not optional. A condensed version of these rules also lives in `replit.md` under "Standing Rules — Mandatory Skills" so they are always in context.

---

## 1. ask-before-starting

**Trigger:** Before any task, fix, or code change.

**The Rule:** Before writing a single line of code or making any change, ask the user clarifying questions. This applies to every task, no matter how small or obvious it seems.

**At minimum, confirm:**
1. What exactly is the problem or feature? Get a precise description — do not assume.
2. Where is it? Which screen, which component, which control?
3. What behavior do they want? What should it do that it does not do now?
4. What should NOT change? Constraints, things to leave alone, existing behavior to preserve.
5. Scope — is this a small tweak or a larger change?

**What NOT to do:**
- Do not read code and immediately start editing because something looks like it could be the problem.
- Do not assume a component name or file from context — ask or confirm.
- Do not add, remove, or change behavior that was not explicitly requested.
- Do not start a build or deploy until the user has confirmed the plan.

**The Pattern:**
```
User: "The X is broken"
Agent: Ask 2–3 targeted clarifying questions.
User: Answers.
Agent: Summarize the plan in plain language. Ask if that's right.
User: Confirms.
Agent: Now start work.
```

---

## 2. always-deploy

**Trigger:** After any code change to `client/`, `functions/`, `server/`, `shared/`, or any config file.

**The Rule:** Every code change — no matter how small — must be deployed to Firebase production before the task is considered done. The dev server (`npm run dev`) is NOT the production environment. The user cannot see changes until they are deployed.

**Deploy steps in order:**

```bash
# Step 1 — Build the frontend
npm run build 2>&1 | tail -20

# Step 2 — Deploy hosting (frontend)
GOOGLE_APPLICATION_CREDENTIALS=/tmp/sa-key.json npx firebase deploy --only hosting --project qrgear-c1ffd --force 2>&1

# Step 3 — Deploy functions (always required)
GOOGLE_APPLICATION_CREDENTIALS=/tmp/sa-key.json npx firebase deploy --only functions --project qrgear-c1ffd --force 2>&1 | tail -20
```

**Restore the SA key if missing:**
```bash
echo "$FIREBASE_SERVICE_ACCOUNT_KEY" > /tmp/sa-key.json
node -e "const d=require('/tmp/sa-key.json'); console.log('project_id:', d.project_id)"
```

**Project details:**
- Firebase project: `qrgear-c1ffd`
- Hosting URL: https://qrgear-c1ffd.web.app
- Frontend build output: `dist/public/`
- Functions source: `functions/`

**Checklist before marking done:**
- [ ] `npm run build` succeeded with no errors
- [ ] Hosting deployed successfully
- [ ] Functions deployed successfully (or GCP infra error noted — do not block on it)
- [ ] Production URL verified: https://qrgear-c1ffd.web.app

---

## 3. fail-loudly

**Trigger:** Any time writing data-fetching, loading, or initialization code.

**The Rule:** When something fails to load, fetch, or initialize, surface the error explicitly — in the UI, in the console, and in the API response. Never let failures hide behind silent fallbacks.

**What to avoid:**
```tsx
// BAD: Silent fallback — user sees empty content with no idea why
const description = p.description || p.model || null;

// BAD: Error swallowed, component renders as if nothing happened
try {
  const data = await fetchCatalog();
  setItems(data);
} catch (e) {
  // silently do nothing
}

// BAD: Returns empty array on failure — caller cannot tell if it worked
if (!res.ok) return [];
```

**What to do instead:**
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

**Project-specific patterns:**
- TanStack Query: Always handle the `error` state from `useQuery` — not just `isLoading`. Show a visible error message or toast.
- API routes: Never return `200 OK` with empty data when the real cause is a failure.
- Firebase/Firestore: If a collection read returns 0 docs when it should have data, log it as an error with the collection name.
- Every caught error must log: which module failed, what it was trying to do, and the actual error message — e.g. `console.error("[Catalog API] Failed to read printify_blueprints:", e.message)`.

---

## 4. present-changed-files

**Trigger:** After completing any fix, update, or build task — before marking done.

**The Rule:** Add only the files that were created or modified during that task into `downloads/QR_Gear_Full_Website.zip`. Use the `-u` (update) flag — adds new files and updates changed ones, never removes existing zip contents.

**Command:**
```bash
cd /home/runner/workspace && zip -u downloads/QR_Gear_Full_Website.zip \
  path/to/changed-file-1.ts \
  path/to/changed-file-2.tsx
```

**Rules:**
- Use `zip -u` — never recreate the zip from scratch
- Run from `/home/runner/workspace` so paths inside the zip match the project structure
- Only files touched this session — do not add the entire codebase
- Do NOT include: files you only read, `package-lock.json`, `node_modules/`, `functions/lib/`, `.firebase/*.cache`, nested zip files, `attached_assets/`, `downloads/`
- Do NOT include generated build output (compiled `.js` from `tsc`) — source files only
- Do this before telling the user the task is complete

**Then tell the user:**
> Added to `QR_Gear_Full_Website.zip`: `path/to/file.ts` (new), `path/to/other.tsx` (updated).

**For a full zip audit/reconciliation, see:** `docs/WEBSITE_ZIP_GUIDE.md`

---

## Quick Reference Card

| Skill | When | Core action |
|---|---|---|
| ask-before-starting | Before any change | Ask, confirm plan, then build |
| always-deploy | After any change | Build → hosting → functions |
| fail-loudly | When writing fetching/loading code | Surface errors, never swallow |
| present-changed-files | After every task | `zip -u` touched files, tell user |
