# Android Shortcut Setup for Git-Ops

## 📱 Install HTTP Shortcuts App

1. Open Google Play Store
2. Search: **"HTTP Shortcuts"** by Waboodoo
3. Install (it's free)

---

## 🔧 Create Your 3 Git Buttons

### Button 1: 📤 PUSH DEV (Daily Save)

**Purpose:** Save your work to GitHub dev branch

1. Open HTTP Shortcuts app
2. Tap **"+"** (bottom right)
3. Enter:
   - **Name:** `📤 PUSH DEV`
   - **Description:** `Save work to GitHub dev branch`
   - **Method:** POST
   - **URL:** `https://[your-gitops-repl-url]/hook/push/dev`
   - **Request Headers:**
     - Header name: `X-Webhook-Key`
     - Header value: `[your-WEBHOOK_SECRET]`
4. Tap **Save**
5. Long-press the shortcut → **Place on Home Screen**

---

### Button 2: 📥 PULL DEV (Sync Latest)

**Purpose:** Get latest changes from GitHub dev branch

1. Tap **"+"**
2. Enter:
   - **Name:** `📥 PULL DEV`
   - **Description:** `Get latest from GitHub dev`
   - **Method:** POST
   - **URL:** `https://[your-gitops-repl-url]/hook/pull/dev`
   - **Request Headers:**
     - Header name: `X-Webhook-Key`
     - Header value: `[your-WEBHOOK_SECRET]`
3. Tap **Save**
4. Long-press → **Place on Home Screen**

---

### Button 3: 🚀 PUBLISH TO MAIN (Weekly Release)

**Purpose:** Fast-forward main branch from dev (weekly stable release)

1. Tap **"+"**
2. Enter:
   - **Name:** `🚀 PUBLISH TO MAIN`
   - **Description:** `Weekly release: dev → main`
   - **Method:** POST
   - **URL:** `https://[your-gitops-repl-url]/hook/sync/dev-to-main`
   - **Request Headers:**
     - Header name: `X-Webhook-Key`
     - Header value: `[your-WEBHOOK_SECRET]`
3. Tap **Save**
4. Long-press → **Place on Home Screen**

---

## 🎯 Daily Workflow

### Morning (Starting Work):
1. Tap **📥 PULL DEV** (get latest)
2. Work in Replit with AI

### Throughout Day:
1. Make changes in Replit
2. Tap **📤 PUSH DEV** (save to GitHub)
3. Repeat as needed

### Weekly (Stable Release):
1. Tap **🚀 PUBLISH TO MAIN** (dev → main)
2. Main branch now has stable weekly release

---

## ⚠️ Multi-AI Safety Rules

When using multiple AIs (Claude, ChatGPT, etc.):

1. **ALWAYS tap 📥 PULL DEV before switching AIs**
2. **ALWAYS tap 📤 PUSH DEV after AI finishes work**
3. **Tell each AI which files to work on** (prevents conflicts)

### Example:
```
Morning:
- Tap 📥 PULL DEV
- Tell Claude: "Build admin/businesses.html"
- Claude finishes
- Tap 📤 PUSH DEV

Afternoon:
- Tap 📥 PULL DEV (gets Claude's work)
- Tell ChatGPT: "Build admin/churches.html"
- ChatGPT finishes
- Tap 📤 PUSH DEV

Weekly:
- Tap 🚀 PUBLISH TO MAIN
- Main branch updated with stable code
```

---

## 🔍 How to Get Your URLs and Secrets

### Get Gitops Repl URL:
1. Open your `kingdom-connects-gitops` Repl
2. Click **Run**
3. Copy the URL from the webview (e.g., `https://kingdom-connects-gitops.yourname.repl.co`)

### Get WEBHOOK_SECRET:
1. In your `kingdom-connects-gitops` Repl
2. Click 🔒 **Secrets**
3. Look for `WEBHOOK_SECRET`
4. Copy the value

---

## 🛠️ Troubleshooting

**Button says "Unauthorized":**
- Check that `X-Webhook-Key` header matches `WEBHOOK_SECRET` exactly

**Button says "Cooldown active":**
- Wait 3 seconds between requests (prevents spam)

**Button says "Script failed":**
- Check your Git-Ops Repl logs for details
- Ensure GITHUB_TOKEN is set correctly

**Changes not showing on GitHub:**
- Verify the Git-Ops Repl is running
- Check you're using correct branch (dev vs main)

---

**Once setup is complete, you'll never type Git commands again!** 🎉
