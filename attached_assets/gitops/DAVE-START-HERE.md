# 🚀 Dave's Git-Ops Quick Start

**Status:** ✅ Complete and ready to deploy  
**Workflow:** dev (daily work) → main (weekly stable releases)

---

## 📱 What You're Getting

**3 Android home-screen buttons:**

1. **📤 PUSH DEV** - Save work to GitHub dev branch (1 tap, 0 typing)
2. **📥 PULL DEV** - Get latest from dev branch (1 tap)
3. **🚀 PUBLISH TO MAIN** - Weekly release dev → main (1 tap)

---

## 🎯 Your Daily Workflow

### Morning:
1. Tap **📥 PULL DEV** on phone
2. Open Replit, work with AI

### Throughout Day:
1. Make changes with AI
2. Tap **📤 PUSH DEV** to save

### Weekly (or whenever):
1. Tap **🚀 PUBLISH TO MAIN**
2. Main branch now has stable release

---

## 🔧 One-Time Setup (When Hands Feel Better)

### Step 1: Create New Repl
1. Replit.com → **+ Create Repl**
2. Template: **Python**
3. Name: `kingdom-connects-gitops`
4. **IMPORTANT:** Set to **Private** ✅

### Step 2: Copy Files
In your NEW Repl, upload ALL files from this folder:
- `app.py`
- `pushlib.sh`
- All `.sh` scripts (8 files)
- `requirements.txt`
- `.replit`

**TIP:** Use Replit's file upload feature, select all files at once

### Step 3: Add Secrets
Click 🔒 lock icon → Add secrets:

```
GITHUB_TOKEN = <get-from-github>
WEBHOOK_SECRET = <make-long-random-string>
WEBHOOK_COOLDOWN_SECONDS = 3
```

**Get GITHUB_TOKEN:**
- GitHub.com → Your avatar → Settings
- Developer settings → Personal access tokens → Tokens (classic)
- Generate new → Check "repo" scope → Copy token

**WEBHOOK_SECRET:**
- Make up a long random string (letters + numbers)
- Example: `kc2025SecureWebhookKey9284RandomChars`

### Step 4: Run It
1. Click **Run** button
2. See: "🚀 Git-Ops Webhook Server Starting..."
3. **Copy the URL** (you'll need it for Android)

### Step 5: Android Shortcuts
1. Install **HTTP Shortcuts** app (Google Play)
2. Follow: `ANDROID-SHORTCUTS-SETUP.md`
3. Add 3 buttons to home screen

**Done! Now you have one-tap Git operations** 🎉

---

## ⚠️ Multi-AI Safety

When using Claude + ChatGPT + other AIs:

1. **ALWAYS tap 📥 PULL DEV before switching AIs**
2. **ALWAYS tap 📤 PUSH DEV after AI finishes**
3. **Tell each AI which specific files to work on**

### Example Safe Workflow:
```
Morning - Claude:
  📥 PULL DEV
  "Claude, build admin/businesses.html"
  📤 PUSH DEV

Afternoon - ChatGPT:
  📥 PULL DEV (gets Claude's work)
  "ChatGPT, build admin/churches.html"
  📤 PUSH DEV

Evening - Claude:
  📥 PULL DEV (gets ChatGPT's work)
  "Claude, build admin/users.html"
  📤 PUSH DEV

Friday:
  🚀 PUBLISH TO MAIN (dev → main)
```

---

## 📖 Full Documentation

- **Quick start:** This file (you're reading it)
- **Android setup:** `ANDROID-SHORTCUTS-SETUP.md`
- **Technical details:** `README.md`
- **Troubleshooting:** `README.md` (bottom section)

---

## 🛡️ Security Features

✅ All secrets in Replit Secrets (never in code)  
✅ Private Repl (not public)  
✅ Webhook requires secret header  
✅ POST-only endpoints  
✅ 3-second cooldown prevents spam

---

**When you're ready to deploy, everything is here and tested!**

**Built by:** Ghost (Architect) + Claude (Developer) | November 2025
