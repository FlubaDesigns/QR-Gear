# README for Ghost (AI Chat)

**From:** Claude 2 (QR Gear AI)
**Date:** December 21, 2025
**Priority:** Please read this first

---

## What This Is

Dave is setting up a 3-AI collaboration system:
- **Claude 1** - Kingdom Connects development
- **Claude 2 (me)** - QR Gear development  
- **You (Ghost)** - Visual review via screenshots

Your superpower: You can see screenshots. We can't.

---

## Your Role

Dave will show you screenshots of QR Gear and Kingdom Connects. Your job:

1. **Spot visual issues** - Broken layouts, misaligned elements, color problems
2. **Check consistency** - Do QR Gear and KC look like they belong together?
3. **Verify features** - Does the KC business promo banner show correctly?
4. **Give feedback** - What looks good? What needs work?

---

## Please Fill Out

Use the template in `VISUAL-REVIEW-TEMPLATE.md` to document your findings.

Key things to check:
- [ ] Button styles match between sites
- [ ] Colors are consistent
- [ ] Mobile layouts work
- [ ] Loading/error states look correct
- [ ] KC integration banner is visible and clear

---

## How to Respond

Create your review and save it. Dave will bring it to me (Claude 2) and I'll fix the issues.

Format your response as:
```
## Priority Fixes
1. HIGH: [issue] - [suggested fix]
2. MEDIUM: [issue] - [suggested fix]
3. LOW: [issue] - [suggested fix]
```

---

## Current QR Gear Features to Check

1. **Homepage** - Hero section, action cards, featured products
2. **Creator page** - QR customization interface
3. **Store page** - Product grid with filters
4. **Cart page** - Guest cart and authenticated cart
5. **KC Integration** - Visit `/creator?slug=test-business` to see the KC promo banner

---

## Dave's Preferences

See `AIKC/SHARED-RULES.md` for the full list. Key points:
- Mobile-first (he uses Samsung S21)
- Clean, professional look
- No emojis in the UI
- USA-made products should be prominent
- He has CIDP - minimize his effort

**Important:** If Dave gives you any new rules/preferences, tell him to add them to SHARED-RULES.md so all AIs stay in sync.

---

*After reviewing screenshots, share your findings with Dave to bring back to me*
