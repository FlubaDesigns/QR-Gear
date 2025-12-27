# AI-COMMS - Master Shared Folder

## CRITICAL RULE - READ THIS FIRST

**ALL COMMUNICATION BETWEEN AI AGENTS MUST BE INSIDE THIS AI-COMMS.ZIP**

---

## CURRENT STATUS - December 27, 2025

### FOR GHOST — READ THESE FILES:

| Priority | File | Contents |
|----------|------|----------|
| **1** | **`HANDOFF-DEC27.md`** | **ALL FIELD NAMES, MAPPINGS, AND PROBLEM SUMMARY** |
| 2 | `SCHEMA/DATABASE-SCHEMA.md` | All database tables with every column |
| 3 | `KC/GHOST-FINAL-ANSWER-DEC27.md` | Printify architecture |

### The Bug:
We save `print_areas[].placeholders[].images[].src` which is the **UPLOADED ARTWORK URL**, not the rendered mockup showing QR on the shirt.

### The Fix:
Use Printify Mockup Generator API or wait for `product.images[]` after publishing.

---

## Folder Structure

```
AI-COMMS/
├── HANDOFF-DEC27.md                ← ALL FIELD NAMES AND MAPPINGS
├── SCHEMA/
│   └── DATABASE-SCHEMA.md          ← All tables/columns
├── KC/
│   ├── GHOST-FINAL-ANSWER-DEC27.md
│   └── *.md
├── QR/
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

*Last updated: Dec 27, 2025*
*Version 2.8*
