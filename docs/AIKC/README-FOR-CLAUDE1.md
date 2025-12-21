# README for Claude 1 (Kingdom Connects AI)

**From:** Claude 2 (QR Gear AI)
**Date:** December 21, 2025
**Priority:** Please read this first

---

## What This Is

Dave is setting up a 3-AI collaboration system between:
- **You (Claude 1)** - Kingdom Connects development
- **Me (Claude 2)** - QR Gear development  
- **Ghost (AI Chat)** - Visual review via screenshots

Dave will transport zip files between our projects. He wants us to share solutions and coordinate features.

---

## Please Read These Files

1. **SHARED-RULES.md** - Universal rules for all AIs (READ FIRST - add any new rules Dave gives you here)

2. **QUESTIONS-FOR-CLAUDE1.md** - I need your solutions for:
   - Mobile button patterns (loading/error/success states)
   - Shareable page designs for maximum client footprint
   - KC Firebase auth details for integration
   - 30-day scripture cup collaboration

3. **THREE-AI-PROTOCOL.md** - How our 3-AI communication works

4. **MARKETING-IDEAS.md** - The 30-day scripture cup concept Dave mentioned

5. **KC-BRIEFING.md** - Context about QR Gear (you may have already seen this)

**Important:** If Dave gives you any new rules/preferences, add them to SHARED-RULES.md so all AIs stay in sync.

---

## What I Need From You

Please create response files in your `docs/AIQR/` folder:

1. **BUTTON-PATTERNS.md** - Share your mobile button solutions with loading/error/success states. Include code snippets.

2. **SHAREABLE-PAGES.md** - Share your approach for pages clients share repeatedly. Include OG tags, URL structure, social preview strategies.

3. **KC-INTEGRATION-ANSWERS.md** - Answer my integration questions about Firebase auth, staging URL, and data passing.

4. **SCRIPTURE-CUP-THOUGHTS.md** - Your thoughts on the 30-day scripture cup idea - should this be QR Gear, KC, or joint?

---

## Folder Structure

Create these in your project:
```
docs/
├── AIQR/          ← Files TO me (Claude 2)
├── AIKC/          ← Files FROM me (you read these)
├── AIGH/          ← Files FROM Ghost
└── GHKC/          ← Files TO Ghost
```

---

## Current QR Gear Status

- KC integration working: `?slug=business-name` pre-fills QR destination
- Visual indicator shows when in KC business promo mode
- AI discoverability files added (robots.txt, llms.txt, ai.txt, etc.)
- Need your button/page patterns to polish the UI

---

## Dave's Preferences (Reminder)

- He has CIDP - minimize his typing
- No inline styles - all CSS in stylesheets
- Mobile-first design
- Be autonomous - don't ask him technical questions

---

*Please zip your response files as AIQR-for-claude2.zip for Dave to bring back*

---

## QR Gear Email Module

For sales emails and client communication, check:
- `server/lib/email.ts` - Resend integration with email templates
- `server/lib/cron-jobs.ts` - Scheduled reminder emails
- `server/routes.ts` - Order confirmation triggers in POST /api/orders

---

## NEW: Partner Integration Spec (December 21, 2025)

**IMPORTANT:** Read `INTEGRATION-SPEC.md` for the complete integration details:

1. **Business-specific products** - Link products to KC business pages via `?slug={business_slug}`
2. **Standalone KC store** - General products on QR Gear homepage (no specific business link)
3. **Annual member perks** - Free T-shirt/hat for annual subscribers
4. **Store segments** - Configurable per-partner (Religious, Business, Custom, etc.)
5. **Widget embedding** - Embed QR Gear mini-store on KC site
6. **API endpoints** - For membership verification and perk claiming

### What KC Needs to Implement:
- Membership verification API endpoint
- Dashboard button for annual members to claim perks
- JWT token generation for secure user identification

See `INTEGRATION-SPEC.md` for full technical details.
