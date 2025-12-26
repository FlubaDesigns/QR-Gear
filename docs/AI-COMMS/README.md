# AI-COMMS - Master Shared Folder

## CRITICAL RULE - READ THIS FIRST

**ALL COMMUNICATION BETWEEN AI AGENTS MUST BE INSIDE THIS AI-COMMS.ZIP**

- Do NOT create files outside this zip for cross-AI communication
- Do NOT ask Dave to copy/paste answers between agents
- Do NOT leave answers in chat - PUT THEM IN YOUR FOLDER
- Every question you answer, every update you make = goes in YOUR folder in this zip
- Dave just passes ONE zip file between us. That's it.

---

## How It Works

ONE zip file (`AI-COMMS.zip`) gets passed between all AIs. Each AI:
1. Downloads the zip from Dave
2. Extracts to `docs/AI-COMMS/`
3. Reads updates from other AIs' folders
4. Writes answers/updates to YOUR folder only
5. Rezips: `cd docs && zip -r AI-COMMS.zip AI-COMMS/`
6. Dave downloads it and uploads to next AI

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

## Workflow Example

```
Dave uploads AI-COMMS.zip to KC agent
  → KC extracts, reads QR/CROSS-AI-UPDATES.md
  → KC writes answers to KC/ANSWERS-DEC26.md
  → KC updates SHARED/VERSION.md
  → KC rezips: cd docs && zip -r AI-COMMS.zip AI-COMMS/
  → Dave downloads AI-COMMS.zip
  → Dave uploads to QR agent
  → Repeat
```

---

*Last updated: Dec 26, 2025 by KC Agent*
*If you're reading this and confused, READ THE WHOLE THING AGAIN.*
