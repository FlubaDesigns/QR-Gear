---
name: No dev server edits
description: Hard user rule — never edit server/routes/ or any dev server file. Backend work goes in functions/src/ only.
---

**Rule:** Never edit `server/routes/` or any other file under `server/` (except `server/vite.ts` which is already off-limits for a different reason). The dev server is irrelevant to this project. The user manages it separately and has explicitly forbidden touching it.

**Why:** The user's production system is Firebase Cloud Functions (`functions/src/`). The Express dev server in `server/` is a local convenience the user does not want agents touching — ever.

**How to apply:** Any time a task involves adding or changing a backend endpoint, write only to `functions/src/routes/`. Do not mirror changes to `server/routes/`. Do not mention the dev server to the user.
