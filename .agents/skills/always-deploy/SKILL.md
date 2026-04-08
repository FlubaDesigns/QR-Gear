---
name: always-deploy
description: CRITICAL reminder to always deploy to Firebase production after every code change in this project. Use this skill any time you make any change to frontend, backend, functions, or config files. Never leave changes sitting only in the dev environment.
---

# Always Deploy to Firebase After Every Change

## CRITICAL RULE

**Every time you make any code change — no matter how small — you MUST deploy to Firebase production before considering the task done.** The user cannot see your changes until they are deployed. The dev server (npm run dev) is NOT the production environment.

## Deploy Commands

Run these commands in order after making changes:

### Step 1 — Build the frontend
```bash
npm run build 2>&1 | tail -20
```

### Step 2 — Deploy hosting (frontend)
```bash
GOOGLE_APPLICATION_CREDENTIALS=/tmp/sa-key.json npx firebase deploy --only hosting --project qrgear-c1ffd --force 2>&1
```

### Step 3 — Deploy functions (backend) if you changed anything in `functions/`
```bash
GOOGLE_APPLICATION_CREDENTIALS=/tmp/sa-key.json npx firebase deploy --only functions --project qrgear-c1ffd --force 2>&1 | tail -20
```

## Restoring the Service Account Key

The SA key lives in the environment variable `FIREBASE_SERVICE_ACCOUNT_KEY`. If `/tmp/sa-key.json` is missing, recreate it:
```bash
echo "$FIREBASE_SERVICE_ACCOUNT_KEY" > /tmp/sa-key.json
node -e "const d=require('/tmp/sa-key.json'); console.log('project_id:', d.project_id)"
```

## Project Details

- **Firebase project:** `qrgear-c1ffd`
- **Hosting URL:** https://qrgear-c1ffd.web.app
- **Frontend build output:** `dist/public/`
- **Functions source:** `functions/`

## What Counts as a Change

Deploy after ANY of these:
- Editing any file in `client/`
- Editing any file in `functions/`
- Editing any file in `server/` or `shared/`
- Changing `firebase.json`, `firestore.rules`, `firestore.indexes.json`, or `storage.rules`

## Checklist Before Marking Task Complete

- [ ] `npm run build` succeeded with no errors
- [ ] Hosting deployed successfully
- [ ] Functions deployed (or confirmed no changes)
- [ ] Production URL verified: https://qrgear-c1ffd.web.app
