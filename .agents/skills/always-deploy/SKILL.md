---
name: always-deploy
description: CRITICAL — deploy to Firebase production after every code change in this project. Contains the three-step deploy methodology that avoids timeouts and "No changes detected" failures. Read this before any Firebase deploy.
---

# Firebase Deploy — Three-Step Methodology

## Why Three Steps

The full pipeline (build client + build functions + deploy functions + deploy hosting) takes
100–110 seconds chained together — right at the edge where the sandbox kills the process.
Chaining everything into one call causes unpredictable SIGKILL failures with no output.

The fix: three separate bash calls using the scripts in the `deploy/` folder. The scripts
encode the commands so you don't need to remember them mid-session.

---

## The Four Scripts — Always Run in Order

### Step 1 — `deploy/1-build.sh` (timeout: 90000ms)

```bash
bash deploy/1-build.sh
```

Bumps `_BUILD_ID` with timestamp+random, builds frontend (`npm run build`), builds functions
(`cd functions && npm run build`). Must complete cleanly — if tsc fails, stop.

### Step 2 — `deploy/2-functions.sh` (timeout: 90000ms)

```bash
bash deploy/2-functions.sh
```

Deploys Cloud Functions to Firebase. Uses `set -euo pipefail` and captures the full deploy
log to `/tmp/qrgear-functions-deploy.log`. **Fails loudly** if Firebase does not confirm:
1. `functions source uploaded successfully`
2. `Successful update operation`
3. `Deploy complete`

**If step 2 times out (process killed, no output):**
Deployment status is UNKNOWN. Do NOT assume success. Run `deploy/4-verify-functions.sh`
immediately. If the live BUILD_ID does not match, re-run `deploy/2-functions.sh` and
verify again. Do NOT re-run step 1.

**If step 2 says "Skipped (No changes detected)" after a previous timeout:**
This may mean Firebase already has the new code. Run `deploy/4-verify-functions.sh` to
confirm. If it passes, proceed to step 3. If it fails, re-run `deploy/2-functions.sh`.

**If step 2 says "No changes detected" WITHOUT a prior timeout:**
Step 1 didn't run or `sed` failed silently. Re-run step 1 only, then retry step 2.

### Step 3 — `deploy/3-hosting.sh` (timeout: 75000ms)

```bash
bash deploy/3-hosting.sh
```

Deploys frontend to Firebase Hosting. **Success looks like:**
```
✔  hosting[qrgear-c1ffd]: release complete
✔  Deploy complete!
```

### Step 4 — `deploy/4-verify-functions.sh` (timeout: 30000ms)

```bash
bash deploy/4-verify-functions.sh
```

Reads `_BUILD_ID` from `functions/src/index.ts`, calls the live
`https://qrgear-c1ffd.web.app/api/deploy-proof` endpoint, and confirms the live
Cloud Function's `buildId` matches. **Completion is forbidden unless step 4 passes.**

---

## Rules

1. **Always run all four steps** — functions and hosting must always match. Never skip one.
2. **Each step is a separate bash call** — never chain step 2 and step 3 together.
3. **If step 2 times out — deployment is UNKNOWN. Run step 4 immediately to verify.**
   If step 4 fails, re-run step 2. Then run steps 3 and 4.
4. **If step 2 says "No changes detected" after a timeout — run step 4 to confirm.**
   If step 4 passes, go to step 3. If step 4 fails, re-run step 2.
5. **Never add predeploy hooks back to `firebase.json`** — causes timeout inside Firebase's runner.
6. **Always pass `--force`** — already baked into the scripts.
7. **No task involving `functions/src/` is complete unless step 4 passes** and returns the
   current `_BUILD_ID` from `functions/src/index.ts`.

## Why BUILD_ID Matters

`_BUILD_ID` is a string constant on line 1 of `functions/src/index.ts`. Changing it changes
the compiled bundle's bytes, which changes the hash Firebase uses to decide whether to deploy.
Without bumping it, Firebase silently skips ("No changes detected") even when source changed.
The `$RANDOM` suffix makes it collision-proof even for same-second deploys.

`_BUILD_ID` is also set into `process.env.QRGEAR_BUILD_ID` at CF boot time, which the
`/api/deploy-proof` endpoint reads and returns. This is the live verification source of truth.

## Frontend-Only Changes

If only frontend files changed (no `functions/src/` edits), skip steps 2 and 4:
1. Run step 1 (build only)
2. Skip step 2
3. Run step 3 (hosting deploy)
4. Skip step 4

## Deploy Proof Endpoint

`GET https://qrgear-c1ffd.web.app/api/deploy-proof` returns:
```json
{
  "ok": true,
  "target": "firebase-functions",
  "functionName": "api",
  "project": "qrgear-c1ffd",
  "deployedAtRuntime": "<ISO timestamp>",
  "buildId": "<current _BUILD_ID>"
}
```

`deploy/4-verify-functions.sh` reads the expected `_BUILD_ID` from local
`functions/src/index.ts`, hits this endpoint, and fails loudly if they do not match.

## Project Details

- **Firebase project:** `qrgear-c1ffd`
- **Build ID location:** `functions/src/index.ts` line 1 — `const _BUILD_ID = '...'`
- **Deploy scripts:** `deploy/1-build.sh`, `deploy/2-functions.sh`, `deploy/3-hosting.sh`, `deploy/4-verify-functions.sh`
- **Live URL:** https://qrgear-c1ffd.web.app
- **Deploy proof endpoint:** https://qrgear-c1ffd.web.app/api/deploy-proof
