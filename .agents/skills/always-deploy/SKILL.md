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

## Standard Deploy (ALWAYS use this — functions + hosting)

**Every deploy must update both Cloud Functions and hosting.** Run this single command
after all code edits are complete:

```bash
sed -i "s/const _BUILD_ID = '[^']*'/const _BUILD_ID = '$(date +%Y%m%d-%H%M%S)'/" functions/src/index.ts \
  && npm run build 2>&1 | tail -5 \
  && cd functions && npm run build 2>&1 | tail -3 && cd .. \
  && echo "$FIREBASE_SERVICE_ACCOUNT_KEY" > /tmp/sa-key.json \
  && GOOGLE_APPLICATION_CREDENTIALS=/tmp/sa-key.json \
     npx firebase deploy --only functions,hosting --project qrgear-c1ffd --force 2>&1 | tail -10
```

Set bash tool **timeout to 120000ms** — the full deploy takes 60–90 seconds.

## Rules

1. **Always deploy both `functions,hosting`** — never deploy functions-only or hosting-only. Production must always have matching frontend and backend.
2. **Bump `_BUILD_ID` first, always** — the `sed` command does this automatically. Without it, Firebase sees "No changes detected" and skips the functions deploy silently.
3. **Never add predeploy hooks back to `firebase.json`** — they cause the deploy to timeout (Firebase's runner re-runs npm install + tsc, which exceeds the 2-minute bash limit).
4. **One bash call** — chain everything with `&&`. If tsc fails, deploy never runs.
5. **Always pass `--force`** — skips confirmation prompts (not a destructive flag).

## Project Details

- **Firebase project:** `qrgear-c1ffd`
- **Build ID location:** `functions/src/index.ts` line 0 — `const _BUILD_ID = '...'`
- **Frontend build command:** `npm run build` (from project root — outputs to `dist/public/`)
- **Functions build command:** `cd functions && npm run build` (tsc — outputs to `functions/lib/`)
- **Live URL:** https://qrgear-c1ffd.web.app

## Success Indicators

```
✔  functions: functions source uploaded successfully
✔  functions[api(us-central1)] Successful update operation.
✔  Hosting URL: https://qrgear-c1ffd.web.app
✔  Deploy complete!
```

If you see `Skipped (No changes detected)` on functions — the `_BUILD_ID` bump didn't make
it into the compiled output. Verify `sed` ran before `cd functions && npm run build`.
