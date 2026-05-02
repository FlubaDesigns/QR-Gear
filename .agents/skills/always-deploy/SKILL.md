---
name: always-deploy
description: CRITICAL — deploy to Firebase production after every code change in this project. Contains the three-step deploy methodology that avoids timeouts and "No changes detected" failures. Read this before any Firebase deploy.
---

# Firebase Deploy — Three-Step Methodology

## Why Three Steps

The full pipeline (build client + build functions + deploy functions + deploy hosting) takes
100–110 seconds chained together — right at the edge where the sandbox kills the process.
Chaining everything into one call causes unpredictable SIGKILL failures with no output.

The fix: split into three separate bash calls, each well under 60 seconds.

`firebase.json` has **no predeploy hooks** by design — we build manually so we control the
order and avoid Firebase re-running a slow npm install + tsc before uploading.

---

## Step 1 — Bump BUILD_ID and build both targets (timeout: 60000ms)

```bash
sed -i "s/const _BUILD_ID = '[^']*'/const _BUILD_ID = '$(date +%Y%m%d-%H%M%S)-$RANDOM'/" functions/src/index.ts \
  && npm run build 2>&1 | tail -5 \
  && cd functions && npm run build 2>&1 | tail -3 && cd ..
```

The `$RANDOM` suffix (0–32767) makes the BUILD_ID collision-proof even when two deploys
happen in the same second. This must complete cleanly before any deploy — if tsc fails, stop.

**What this does:** `_BUILD_ID` is a string constant on line 1 of `functions/src/index.ts`.
Changing it changes the compiled bundle's bytes, which changes the hash Firebase uses to
decide whether to deploy. Without this bump, Firebase silently skips ("No changes detected")
even when source files changed.

## Step 2 — Deploy functions (timeout: 90000ms)

```bash
echo "$FIREBASE_SERVICE_ACCOUNT_KEY" > /tmp/sa-key.json \
  && GOOGLE_APPLICATION_CREDENTIALS=/tmp/sa-key.json \
     npx firebase deploy --only functions --project qrgear-c1ffd --force 2>&1 | tail -10
```

**Success looks like:**
```
✔  functions: functions source uploaded successfully
✔  functions[api(us-central1)] Successful update operation.
✔  Deploy complete!
```

If you see `Skipped (No changes detected)` — the BUILD_ID bump in step 1 didn't make it into
the compiled output. Verify step 1 ran `sed` BEFORE `cd functions && npm run build`.

## Step 3 — Deploy hosting (timeout: 60000ms)

```bash
echo "$FIREBASE_SERVICE_ACCOUNT_KEY" > /tmp/sa-key.json \
  && GOOGLE_APPLICATION_CREDENTIALS=/tmp/sa-key.json \
     npx firebase deploy --only hosting --project qrgear-c1ffd --force 2>&1 | tail -8
```

**Success looks like:**
```
✔  hosting[qrgear-c1ffd]: release complete
✔  Deploy complete!
Hosting URL: https://qrgear-c1ffd.web.app
```

---

## Rules

1. **Always run all three steps** — functions and hosting must always match. Never skip hosting
   after a functions deploy, or vice versa.
2. **Bump `_BUILD_ID` in step 1, always** — without it, Firebase sees "No changes detected"
   and silently skips the functions deploy even though source files changed.
3. **Never chain deploy steps together** — keep step 2 and step 3 as separate bash calls.
   Chaining them causes the combined ~80s deploy to race the sandbox timeout.
4. **Never add predeploy hooks back to `firebase.json`** — Firebase's runner re-runs npm
   install + tsc, which blows the time budget.
5. **Always pass `--force`** — skips confirmation prompts (not a destructive flag).
6. **If step 2 times out** — do NOT retry the full chain. Just re-run step 2 alone. The
   compiled output in `functions/lib/` is already correct from step 1.

## Project Details

- **Firebase project:** `qrgear-c1ffd`
- **Build ID location:** `functions/src/index.ts` line 0 — `const _BUILD_ID = '...'`
- **Frontend build command:** `npm run build` (project root → outputs to `dist/public/`)
- **Functions build command:** `cd functions && npm run build` (tsc → outputs to `functions/lib/`)
- **Live URL:** https://qrgear-c1ffd.web.app
