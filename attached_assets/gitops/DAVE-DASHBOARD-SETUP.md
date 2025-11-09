# Git Dashboard Setup for Dave

## What I Built

A mobile-friendly web dashboard with big tap-friendly buttons for your Samsung S21 Plus. **No more HTTP Shortcuts app needed** - just open it in your browser and tap.

## How to Access

1. **From Kingdom Connects Repl:**
   - Click the webview at the top
   - Add `/dashboard` to the URL
   - Example: `https://kingdom-connects-gitops.yourname.repl.co/dashboard`

2. **Bookmark it on your phone:**
   - Open the dashboard URL in Chrome/Samsung Internet
   - Tap the menu (⋮)
   - Choose "Add to Home screen"
   - Now you have a tap-to-open icon like an app!

## First Time Setup

When you open the dashboard, it will ask for your **webhook secret**. This is the `WEBHOOK_SECRET` value from your Replit Secrets.

**To find it:**
1. Open this Repl in Replit
2. Click the lock icon (🔒) in left sidebar → Secrets
3. Copy the value of `WEBHOOK_SECRET`
4. Paste it into the prompt on the dashboard

**Security Note:** The secret stays in your browser session - you'll need to re-enter it if you close the browser.

## The Buttons

### 📤 Daily Work (Dev Branch)

**💾 Push to Dev**
- Saves your current work to the dev branch on GitHub
- Use this when you finish work and want to save changes
- Safe to use anytime

**⬇️ Pull from Dev**
- Gets the latest changes from dev branch
- Use this before starting work if you edited from another device
- Rebases to keep history clean

### 🚀 Weekly Publish

**🔀 Sync Dev → Main**
- Publishes dev branch to main (production)
- Run this once a week after testing
- ⚠️ Only works if main hasn't changed (fast-forward only)
- Has double-confirmation to prevent accidents

## What Happens When You Tap

1. **Confirmation** - You'll get a popup asking "Are you sure?"
2. **Loading** - Button shows spinner while Git operation runs
3. **Result** - Green success ✅ or red error ❌ message appears below button

## Typical Workflow

**Daily (Monday - Friday):**
1. Work on your code in Replit
2. Tap **💾 Push to Dev** when done
3. Changes are saved to GitHub dev branch

**Weekly (Friday or Saturday):**
1. Test everything works
2. Tap **🔀 Sync Dev → Main** to publish to production
3. Main branch gets your week's work

## Troubleshooting

**"Invalid webhook key"**
- You entered the wrong WEBHOOK_SECRET
- Refresh page and enter correct secret

**"Cooldown active. Wait 3s"**
- You tapped too fast
- Wait 3 seconds and try again
- This prevents accidental double-taps

**"Fast-forward not possible"**
- Main branch has changes dev doesn't have
- This means the branches diverged
- Contact me (Claude) or Ghost - don't force it!

## Mobile Optimization

- **Big buttons** - Easy to tap with hands/wheelchair
- **Dark theme** - Easy on eyes
- **No tiny links** - Everything is tap-friendly
- **Confirmations** - Prevents accidental taps
- **Clear feedback** - You always know what happened

---

**You're all set!** Bookmark the dashboard and you've got one-tap Git from your phone.
