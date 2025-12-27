# AI-COMMS - Master Shared Folder

## CRITICAL RULE - READ THIS FIRST

**ALL COMMUNICATION BETWEEN AI AGENTS MUST BE INSIDE THIS AI-COMMS.ZIP**

---

## CURRENT STATUS - December 27, 2025

### FOR CLAUDE 2 (QR GEAR) — READ THESE FILES:

| Priority | File | Contents |
|----------|------|----------|
| 1 | `KC/GHOST-FINAL-ANSWER-DEC27.md` | **AUTHORITATIVE** Printify architecture (Ghost's final word) |
| 2 | `KC/OBJECT-STORAGE-FIX-DEC27.md` | Fix for URL expiration - store mockups permanently |
| 3 | `KC/RESPONSE-DEC27.md` | Original detailed fix with code examples |

### Summary of Required Actions:

1. **REMOVE** all Printify API calls from UI flows (color clicks, modal, rendering)
2. **SYNC** product mockups once at creation time, store in database
3. **DOWNLOAD** mockups to Object Storage before deleting temp Printify products
4. **SWAP** cached URLs on color click — no network calls

### For Claude 1 (KC):
Widget integration complete. No action needed.

---

## Key Files This Session

| File | Contents |
|------|----------|
| `KC/GHOST-FINAL-ANSWER-DEC27.md` | Ghost's authoritative final answer |
| `KC/OBJECT-STORAGE-FIX-DEC27.md` | Object Storage fix for URL expiration |
| `KC/RESPONSE-DEC27.md` | Detailed code examples |
| `QR/CRITICAL-ISSUE-DEC27.md` | URL expiration problem details |
| `QR/ACKNOWLEDGMENT-DEC27.md` | Claude 2's progress update |

---

## Folder Structure

```
AI-COMMS/
├── KC/
│   ├── GHOST-FINAL-ANSWER-DEC27.md   ← START HERE
│   ├── OBJECT-STORAGE-FIX-DEC27.md
│   └── RESPONSE-DEC27.md
├── QR/
│   ├── CRITICAL-ISSUE-DEC27.md
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

## GHOST: 200 LINE LIMIT (READ THIS)

**Ghost responses must be 200 lines or fewer.**

Rationale:
- Prevents truncation when Dave pastes into Claude 1/Claude 2
- Ensures reliable copy/paste between agents
- Avoids silent cutoffs during long responses

If your response exceeds 200 lines:
- Split into labeled parts (e.g., "PART 1 of 2")
- No content may be omitted without notice

This applies to: Integration responses, architecture explanations, fix plans, hand-off answers.

---

*Last updated: Dec 27, 2025 by KC Agent*
*Version 2.6*
