---
name: always-deploy
description: CRITICAL — deploy to Firebase production after every code change in this project. Contains the one-shot deploy methodology that avoids "No changes detected" failures and wasted deploys. Read this before any Firebase deploy.
---

# Firebase Deploy — One-Shot Methodology

## Why This Exists

Firebase compares a hash of the compiled `functions/lib/` bundle against what is deployed.
If the hash matches, it skips the deploy silently ("No changes detected") even though your
source changed. The fix: always bump `_BUILD_ID` in `functions/src/index.ts` to guarantee
the compiled output differs from the last deploy.

`firebase.json` has **no predeploy hooks** by design — we build manually so we control the
order and avoid Firebase re-running a slow npm install + tsc before uploading.

## One-Shot Functions Deploy

Run this single command after all code edits are complete:

```bash
sed -i "s/const _BUILD_ID = '[^']*'/const _BUILD_ID = '$(date +%Y%m%d-%H%M%S)'/" functions/src/index.ts \
  && cd functions && npm run build 2>&1 | tail -3 && cd .. \
  && echo "$FIREBASE_SERVICE_ACCOUNT_KEY" > /tmp/sa-key.json \
  && GOOGLE_APPLICATION_CREDENTIALS=/tmp/sa-key.json \
     npx firebase deploy --only functions --project qrgear-c1ffd --force 2>&1 | tail -8
```

## One-Shot Full Deploy (functions + hosting)

Use when frontend files in `client/` also changed:

```bash
sed -i "s/const _BUILD_ID = '[^']*'/const _BUILD_ID = '$(date +%Y%m%d-%H%M%S)'/" functions/src/index.ts \
  && npm run build 2>&1 | tail -5 \
  && cd functions && npm run build 2>&1 | tail -3 && cd .. \
  && echo "$FIREBASE_SERVICE_ACCOUNT_KEY" > /tmp/sa-key.json \
  && GOOGLE_APPLICATION_CREDENTIALS=/tmp/sa-key.json \
     npx firebase deploy --only functions,hosting --project qrgear-c1ffd --force 2>&1 | tail -10
```

## Rules

1. **Bump `_BUILD_ID` first, always** — the `sed` command does this automatically.
2. **Never add predeploy hooks back to `firebase.json`** — they make the deploy timeout (npm install + tsc inside Firebase's runner exceeds the 2-minute bash limit).
3. **One bash call** — chain everything with `&&` so it's atomic. If tsc fails, deploy never runs.
4. **Only `--force`** — always pass `--force` (skips confirmation prompts, not a "force redeploy").
5. **Set timeout to 120000ms** for the bash tool — the deploy itself takes ~60–90 seconds.

## Project Details

- **Firebase project:** `qrgear-c1ffd`
- **Build ID location:** `functions/src/index.ts` line 0 — `const _BUILD_ID = '...'`
- **Frontend build output:** `dist/public/`
- **Functions compiled output:** `functions/lib/`
- **Hosting URL:** https://qrgear-c1ffd.web.app

## What Counts as a Change Requiring Deploy

Deploy after ANY edit to:
- `functions/src/**` (any backend/Cloud Functions code)
- `client/src/**` (any frontend code — needs hosting deploy too)
- `shared/**`
- `firestore.rules`, `firestore.indexes.json`, `storage.rules`

## Success Indicators

```
✔  functions: functions source uploaded successfully
✔  functions[api(us-central1)] Successful update operation.
✔  Deploy complete!
```

If you see `Skipped (No changes detected)` — the `_BUILD_ID` bump didn't make it into the
compiled output. Check that `sed` ran before `npm run build`.
