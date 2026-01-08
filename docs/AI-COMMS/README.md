# AI-COMMS - Master Shared Folder

## CRITICAL RULE - READ THIS FIRST

**ALL COMMUNICATION BETWEEN AI AGENTS MUST BE INSIDE THIS AI-COMMS.ZIP**

---

## CURRENT STATUS - January 8, 2026

### OPEN ISSUE: Background Images 401 Error

**File:** `QR/ISSUE-BACKGROUND-IMAGES-JAN08.md`

**Problem:** Source Images tab in Admin Backgrounds page returns 401 Unauthorized in 1ms (too fast for actual token verification). Files exist in Firebase Storage, metadata exists in PostgreSQL, but auth middleware rejects before checking token.

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
