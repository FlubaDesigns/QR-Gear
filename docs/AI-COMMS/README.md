# AI-COMMS - Master Shared Folder

## CRITICAL RULE - READ THIS FIRST

**ALL COMMUNICATION BETWEEN AI AGENTS MUST BE INSIDE THIS AI-COMMS.ZIP**

---

## CURRENT STATUS - December 27, 2025

### SUCCESS: Mockup System Fixed!

The Object Storage fix from Ghost/KC worked. Printify mockups are now stored permanently.

**See:** `QR/SUCCESS-DEC27.md` for full details.

### Summary of What Was Fixed:

1. **Object Storage Integration** - Mockups downloaded and stored permanently before temp products deleted
2. **QR Artwork Selection** - White QR on dark shirts, black QR on light shirts (verified working)
3. **Permanent URLs** - `https://replit-objstore-...replit.dev/public/mockups/...`

### For Claude 1 (KC):

KC widget integration is ready. QR Gear returns permanent mockup URLs in the products API.

`WIDGET_JWT_SECRET` exists and works.

---

## Key Files This Session

| File | Contents |
|------|----------|
| `QR/SUCCESS-DEC27.md` | **FIX CONFIRMATION** - Everything working |
| `KC/GHOST-FINAL-ANSWER-DEC27.md` | Ghost's authoritative architecture guidance |
| `KC/OBJECT-STORAGE-FIX-DEC27.md` | Object Storage fix that resolved the issue |

---

## Folder Structure

```
AI-COMMS/
├── KC/                 (Kingdom Connects writes here)
│   └── *.md files      (Answers, briefings, updates)
├── QR/                 (QR Gear writes here)
│   └── *.md files      (Answers, briefings, updates)
├── GH/                 (Ghost writes here)
│   └── *.md files
├── SHARED/             (Protocols everyone follows)
│   └── VERSION.md      (Track zip versions)
└── README.md           (This file - the rules)
```

---

## Critical Rules

1. **ALL ANSWERS GO IN THE ZIP** - Not in chat, not in separate files. In YOUR folder in this zip.
2. **Only write to YOUR folder** - KC writes to KC/, QR writes to QR/, etc.
3. **Check VERSION.md first** - See who updated last, avoid conflicts
4. **Increment version after changes** - Update SHARED/VERSION.md
5. **Always rezip after updates** - `cd docs && zip -r AI-COMMS.zip AI-COMMS/`
6. **Keep it small** - Dave is on mobile. No node_modules, no binaries.

---

## Dave's Constraints

- **CIDP** - Limited hand mobility. ONE zip file only. No extra steps.
- **Mobile** - Primary device is Android phone. Keep zips under 500KB if possible.
- **No patience for confusion** - If you forget this system, re-read this README.

---

## Current AIs

- **KC (Claude 1)** - Kingdom Connects development
- **QR (Claude 2)** - QR Gear development  
- **GH (Ghost)** - Visual review chatbot, coordinator

---

*Last updated: Dec 27, 2025 by QR Gear Agent*
*Version 2.7 - MOCKUP SYSTEM FIXED*
