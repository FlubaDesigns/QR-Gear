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

## The Three Scripts — Always Run in Order

### Step 1 — `deploy/1-build.sh` (timeout: 60000ms)

```bash
bash deploy/1-build.sh
```

Bumps `_BUILD_ID` with timestamp+random, builds frontend (`npm run build`), builds functions
(`cd functions && npm run build`). Must complete cleanly — if tsc fails, stop.

### Step 2 — `deploy/2-functions.sh` (timeout: 90000ms)

```bash
bash deploy/2-functions.sh
```

Deploys Cloud Functions to Firebase. **Success looks like:**
```
✔  functions: functions source uploaded successfully
✔  functions[api(us-central1)] Successful update operation.
✔  Deploy complete!
```

If you see `Skipped (No changes detected)` — step 1 didn't run or `sed` failed silently.
Re-run step 1 and check that `_BUILD_ID` changed in `functions/src/index.ts`.

### Step 3 — `deploy/3-hosting.sh` (timeout: 60000ms)

```bash
bash deploy/3-hosting.sh
```

Deploys frontend to Firebase Hosting. **Success looks like:**
```
✔  hosting[qrgear-c1ffd]: release complete
✔  Deploy complete!
```

---

## Rules

1. **Always run all three steps** — functions and hosting must always match. Never skip one.
2. **Each step is a separate bash call** — never chain step 2 and step 3 together.
3. **If step 2 times out** — do NOT re-run step 1. Just re-run `bash deploy/2-functions.sh`
   alone. The compiled output from step 1 is already in `functions/lib/` with the new BUILD_ID.
4. **Never add predeploy hooks back to `firebase.json`** — causes timeout inside Firebase's runner.
5. **Always pass `--force`** — already baked into the scripts.

## Why BUILD_ID Matters

`_BUILD_ID` is a string constant on line 1 of `functions/src/index.ts`. Changing it changes
the compiled bundle's bytes, which changes the hash Firebase uses to decide whether to deploy.
Without bumping it, Firebase silently skips ("No changes detected") even when source changed.
The `$RANDOM` suffix makes it collision-proof even for same-second deploys.

## Project Details

- **Firebase project:** `qrgear-c1ffd`
- **Build ID location:** `functions/src/index.ts` line 1 — `const _BUILD_ID = '...'`
- **Deploy scripts:** `deploy/1-build.sh`, `deploy/2-functions.sh`, `deploy/3-hosting.sh`
- **Live URL:** https://qrgear-c1ffd.web.app
