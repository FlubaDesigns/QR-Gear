# GHOST → CLAUDE Handoff: Secure Git‑Ops Buttons for `dev` + Weekly Sync to `main`

**Owner:** David “Stone Soup” Percey  
**Teammates:** Ghost (this doc’s author), Claude (Replit AI “Developer/Engineer” agent)  
**Purpose:** Stand up a small, **private** Git‑Ops Repl that exposes **secure POST‑only webhooks** to:
- **Push `dev`** (commit changed files only, then push)
- **Pull `dev`** (fetch latest from GitHub and **rebase** to keep history clean)
- **Weekly fast‑forward sync:** **`dev → main`** (safe: no auto-merge; only fast‑forward)

This Git‑Ops Repl is **separate** from the public site Repl. We keep secrets out of the public code and run maintenance from here.

---

## Roles & Coordination Rules

- **David**: taps Android home‑screen buttons to push/pull `dev` during the week; runs weekly **Sync `dev → main`**.
- **Ghost**: authors & updates this Git‑Ops workflow and supporting docs/scripts.
- **Claude**: executes this handoff in Replit exactly as specified. **Claude must not edit the public app Repl when handling Git‑Ops**. Claude must never expose or hardcode secrets anywhere in code or client UI.

**Safety Rules (Claude must follow):**
1. Keep this Git‑Ops Repl **private**. Do not add secrets to public Repls.
2. Do not auto-merge divergent branches; the sync is **fast‑forward only**.
3. Only these three endpoints are required for daily/weekly ops:
   - `POST /hook/push/dev`
   - `POST /hook/pull/dev`
   - `POST /hook/sync/dev-to-main`
4. Optional “main” endpoints may remain present but **should not be used** unless David explicitly requests.
5. Never place `WEBHOOK_SECRET` in URLs or client code. Only accept it via header `X-Webhook-Key` on POST.

---

## Quick Start (Claude, do this exactly)

1) **Create a new private Repl** (Python) named: `kingdom-connects-gitops` (or similar).  
2) **Upload** the file: **`_replit_gitops_secure_bundle.zip`** and **extract** it into the project root.  
   - If you don’t have the zip, create the files exactly as listed in “Files & Contents” below.
3) **Install deps**: ensure `requirements.txt` has `Flask==3.0.3` (already provided).  
4) **Set Secrets** in Replit (left sidebar → 🔑 Secrets):
   - `GITHUB_TOKEN` → David’s GitHub Personal Access Token (scope: `repo`).
   - `WEBHOOK_SECRET` → a long random string. (Example: `2a6ede55-...`)
   - *(optional)* `WEBHOOK_COOLDOWN_SECONDS` → `3`
5) **Make scripts executable** (Repl Shell):
   ```bash
   chmod +x pushlib.sh push_*.sh pull_*.sh sync_*.sh
   ```
6) **Run** the Repl. It should serve on port **8000**. Note the full URL:
   - `https://<repl-name>.<user>.repl.co`

**Verification:** `GET /` should return `OK`. No Git actions occur on GET; only POST to the specific endpoints (below).

---

## Endpoints (POST + Header only)

All endpoints require: header `X-Webhook-Key: <WEBHOOK_SECRET>` and no body.

- **Push DEV**  
  `POST /hook/push/dev`  
  – Stages changed files, commits (empty commit allowed), pushes to `dev`

- **Pull DEV (rebase)**  
  `POST /hook/pull/dev`  
  – Fetches from GitHub and rebases local `dev` to keep a straight history

- **Weekly Publish: Fast‑forward `dev → main`**  
  `POST /hook/sync/dev-to-main`  
  – Ensures both branches are current; tries a **fast‑forward** only. If not possible (diverged), it returns a message and does **not** merge.

*(Optional endpoints—disabled by policy unless David asks: `push/main`, `pull/main`, `sync/main-to-dev`.)*

---

## Files & Contents (already in the zip)

- `.replit` → run `python3 app.py`  
- `requirements.txt` → `Flask==3.0.3`  
- `app.py` → Flask webhook server (POST‑only, header auth, cooldown, JSON output)  
- `pushlib.sh` → shared git helpers: `pull --rebase`, commit‑if‑changed, fast‑forward merge  
- `push_dev.sh`, `push_main.sh` → push buttons  
- `pull_dev.sh`, `pull_main.sh` → pull (rebase) buttons  
- `sync_dev_to_main.sh`, `sync_main_to_dev.sh` → safe fast‑forward sync

> Internals: We use `git add -A` → commit (or `--allow-empty`) → `git push` for push endpoints. Pull endpoints use `git pull --rebase`. Sync tries `git merge --ff-only` and pushes only if fast‑forward is possible.

---

## Android Home‑Screen Buttons (David)

Install **HTTP Shortcuts** (free on Android). Create **three** shortcuts:

**Common settings**
- Method: `POST`
- Header: `X-Webhook-Key: <WEBHOOK_SECRET>`
- Body: *(empty)*

**1) Push to dev**  
URL: `https://<repl-name>.<user>.repl.co/hook/push/dev`

**2) Pull dev (rebase)**  
URL: `https://<repl-name>.<user>.repl.co/hook/pull/dev`

**3) Weekly sync dev → main**  
URL: `https://<repl-name>.<user>.repl.co/hook/sync/dev-to-main`

Each tap returns JSON confirming success or explaining what to fix (e.g., divergence).

---

## One‑Time Branch Reset Plan (David)

After you import your current Replit export and you’re ready to **replace** both branches:

```bash
# Force dev to the current working tree
git checkout -B dev
git add -A
git commit -m "reset: replace dev with Replit export"
git push -f origin dev

# Force main to match dev (or do this later after testing)
git checkout -B main
git reset --hard dev
git push -f origin main
```

**Going forward**
- Work **only in `dev`** daily (use Push/Pull DEV buttons).  
- **Once a week**, run **Sync dev → main** to publish.

---

## Glossary (Plain English)

- **Pull** = “Grab the latest picture your friend colored.”  
- **Rebase** = “Put your colors **on top** of the latest picture so the story stays neat.”  
- **Fast‑forward merge** = “Main hasn’t colored anything new; we just move its bookmark up to match dev.”  
- **No auto‑merge** = “If the pictures differ, don’t mash them together automatically—tell us instead.”

---

## Claude: Success Criteria

- Repl runs on `python3 app.py`, returns `OK` on `/` (GET).  
- All three dev‑first endpoints accept **POST with header** and perform expected Git actions.  
- Secrets are set only in Replit **Secrets**—**not** in code or client.  
- No changes are made to David’s public Repl or Firebase configuration.  
- Provide the live URL to David so he can wire his Android buttons.

---

## Notes for Future (optional)

- Add a small **server‑side admin page** in the Git‑Ops Repl with buttons that POST internally (keeps secrets server‑side).  
- Hook into GitHub webhooks later for auto‑pull or CI checks.  
- Add a “health” endpoint showing repo status (`current branch`, `ahead/behind`, `last sync`).

— End of handoff —
