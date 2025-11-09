# Kingdom Connects Git-Ops Repl

**Team:** Dave (Owner) + Ghost (Architect) + Claude (Developer)

## Purpose
Secure webhook automation for GitHub dev/main workflow with Android home-screen buttons.

## Setup Instructions

### 1. Create New Private Repl
- Go to Replit
- Click "+ Create Repl"
- Choose: **Python**
- Name: `kingdom-connects-gitops`
- Privacy: **Private**

### 2. Upload These Files
Copy all files from this `gitops/` folder into the new Repl root:
- `app.py`
- `pushlib.sh`
- `push_dev.sh`, `push_main.sh`
- `pull_dev.sh`, `pull_main.sh`
- `sync_dev_to_main.sh`, `sync_main_to_dev.sh`
- `requirements.txt`
- `.replit`

### 3. Set Secrets (Replit Secrets Panel)
Click the lock icon 🔒 in the left sidebar and add:

```
GITHUB_TOKEN = <your-github-personal-access-token>
WEBHOOK_SECRET = <long-random-string>
WEBHOOK_COOLDOWN_SECONDS = 3
GIT_USER_EMAIL = dave@kingdom-connects.com
GIT_USER_NAME = Dave Percey
```

**Note:** GIT_USER_EMAIL and GIT_USER_NAME are optional. If not set, defaults will be used.

**How to get GITHUB_TOKEN:**
1. Go to GitHub.com → Settings → Developer settings → Personal access tokens → Tokens (classic)
2. Generate new token (classic)
3. Give it `repo` scope (full control of private repositories)
4. Copy the token and paste it into Replit Secrets

**WEBHOOK_SECRET:** Generate a random string:
- Use: https://www.random.org/strings/
- Or create one: `openssl rand -hex 32`

### 4. Make Scripts Executable
Open the Shell tab and run:
```bash
chmod +x *.sh
```

### 5. Run the Repl
Click the big **Run** button. You should see:
```
🚀 Git-Ops Webhook Server Starting...
   Cooldown: 3s between requests
   Secret configured: Yes

Endpoints:
  POST /hook/push/dev
  POST /hook/pull/dev
  POST /hook/sync/dev-to-main

Header required: X-Webhook-Key: <WEBHOOK_SECRET>
```

### 6. Note Your Repl URL
The webview will show your Repl URL, something like:
```
https://kingdom-connects-gitops.<username>.repl.co
```

Copy this URL - you'll need it for Android buttons.

---

## Android Home-Screen Buttons

Install **HTTP Shortcuts** app (free on Google Play).

Create **3 shortcuts** with these settings:

### Common Settings (all 3 buttons)
- Method: `POST`
- Headers: Add header
  - Name: `X-Webhook-Key`
  - Value: `<paste-your-WEBHOOK_SECRET>`
- Body: *(leave empty)*

### Button 1: 📤 Push to Dev
- Name: `Push Dev`
- URL: `https://<your-repl-url>/hook/push/dev`
- Icon: Upload arrow

### Button 2: 📥 Pull Dev
- Name: `Pull Dev`
- URL: `https://<your-repl-url>/hook/pull/dev`
- Icon: Download arrow

### Button 3: 🚀 Publish (Sync Dev → Main)
- Name: `Publish to Main`
- URL: `https://<your-repl-url>/hook/sync/dev-to-main`
- Icon: Rocket

Then add all 3 shortcuts to your Android home screen!

---

## Daily Workflow

**During the week (daily):**
1. Make changes in your main Kingdom Connects Repl
2. Tap **📤 Push to Dev** - saves work to GitHub dev branch
3. Before starting work: Tap **📥 Pull Dev** - gets latest from GitHub

**Once a week (publish day):**
1. Tap **🚀 Publish to Main** - fast-forwards main branch from dev
2. This makes dev changes live on main

---

## Troubleshooting

**"Invalid or missing X-Webhook-Key header"**
- Check that your Android button has the correct header set
- Verify WEBHOOK_SECRET matches between Replit and button

**"WEBHOOK_SECRET not configured"**
- Go to Replit Secrets panel and add the secret

**"Cooldown active. Wait X.Xs"**
- You tapped too fast. Wait a few seconds and try again.

**Git errors in output**
- Check that GITHUB_TOKEN is valid
- Verify token has `repo` scope
- Make sure you've done initial Git setup (see One-Time Setup below)

---

## One-Time Git Setup

Before the buttons work, you need to initialize Git in your Git-Ops Repl:

```bash
# In your GIT-OPS Repl (the new one you just created)
# Clone your Kingdom Connects repo
git clone https://github.com/<your-username>/kingdom-connects.git .

# If repo doesn't exist yet on GitHub, initialize it:
git init
git remote add origin https://github.com/<your-username>/kingdom-connects.git
git checkout -b dev
git add -A
git commit -m "Initial commit to dev"
git push -u origin dev

git checkout -b main
git reset --hard dev
git push -u origin main

git checkout dev
```

**Important:** The Git-Ops Repl needs a local clone of your Kingdom Connects code. You have two options:

**Option A - Import from your main Repl:**
1. In your main Kingdom Connects Repl, download a ZIP export
2. Upload that ZIP to your Git-Ops Repl
3. Extract it
4. Run `git init` and configure remote as shown above

**Option B - Clone from GitHub (if already set up):**
1. Run `git clone https://github.com/<username>/kingdom-connects.git .` in Git-Ops Repl
2. Run `git checkout dev`

**After this one-time setup, use only the Android buttons!**

---

## Security Notes

- ✅ All secrets are in Replit Secrets (never in code)
- ✅ Webhook requires secret header (can't trigger from browser)
- ✅ POST-only endpoints (no accidental GET triggers)
- ✅ Cooldown prevents rapid-fire requests
- ✅ This Repl should be **PRIVATE** (not public)

---

## Files Explained

- **app.py** - Flask webhook server (runs on port 8000)
- **pushlib.sh** - Shared Git helper functions
- **push_dev.sh** - Push current changes to dev branch
- **pull_dev.sh** - Pull latest dev branch (with rebase)
- **sync_dev_to_main.sh** - Weekly publish: fast-forward main from dev
- **requirements.txt** - Python dependencies (Flask)
- **.replit** - Replit run configuration

---

**Created by Ghost & Claude for Dave's Kingdom Connects project**  
**Date: November 8, 2025**
