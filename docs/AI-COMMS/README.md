# AI-COMMS - Master Shared Folder

## CRITICAL RULE - READ THIS FIRST

**ALL COMMUNICATION BETWEEN AI AGENTS MUST BE INSIDE THIS AI-COMMS.ZIP**

---

## CURRENT STATUS - January 8, 2026

### OPEN ISSUES: Background Images (2 Problems)

**File:** `QR/ISSUE-BACKGROUND-IMAGES-JAN08.md`

**Issue 1: 401 Unauthorized in Dev**
- Source Images tab returns 401 in 1ms (too fast for token verification)
- Files exist in Firebase Storage + PostgreSQL, but auth middleware rejects

**Issue 2: Not Showing in Production Source Code Viewer**
- Uploaded images don't appear in Firebase production file browser
- Files ARE in Firebase Storage but not visible in deployment viewer

**To Answer:**
1. Read `QR/ISSUE-BACKGROUND-IMAGES-JAN08.md` for full details
2. Create answer file in your folder (e.g., `KC/BACKGROUND-FIX-JAN08.md`)
3. Update VERSION.md
4. Re-zip

---

### WIDGET INTEGRATION: COMPLETE - READY TO TEST

### Files For Reference:

| Priority | File | Contents |
|----------|------|----------|
| **1** | **`QR/ISSUE-BACKGROUND-IMAGES-JAN08.md`** | **CURRENT ISSUE - NEEDS HELP** |
| 2 | `QR/READY-FOR-KC-JAN03.md` | Widget implementation ready |
| 3 | `KC/KC-SEGMENT-MAPPING-JAN03.md` | KC segment ID mapping |
| 4 | `QR/WIDGET-EMBEDDING-JAN03.md` | Widget embedding system |
| 5 | `QR/DATABASE-CONTENTS-DEC28.md` | Actual data in all tables |
| 6 | `QR/SITEMAP-DEC28.md` | All 61 pages with routes |

### The Mockup Bug (FIXED):
Mockups now generated via Printful API with lifestyle images, stored in Firebase Storage.

---

## Folder Structure

```
AI-COMMS/
├── README.md                       ← THIS FILE
├── HANDOFF-DEC27.md                ← Field names and mappings
├── SCHEMA/
│   └── DATABASE-SCHEMA.md          ← All tables/columns
├── KC/
│   ├── GHOST-FINAL-ANSWER-DEC27.md
│   └── *.md
├── QR/
│   ├── DATABASE-CONTENTS-DEC28.md  ← ACTUAL DATA WITH FILE LOCATIONS
│   ├── SITEMAP-DEC28.md            ← ALL 61 ROUTES
│   ├── PROJECT-STRUCTURE-DEC28.md  ← FILE/FOLDER MAP
│   └── *.md
├── SHARED/
│   └── VERSION.md
└── README.md
```

---

## Critical Rules

1. **ALL ANSWERS GO IN THE ZIP**
2. **Only write to YOUR folder**
3. **Check VERSION.md first**
4. **Increment version after changes**
5. **Always rezip after updates**

---

*Last updated: January 8, 2026*
*Version 3.5*
