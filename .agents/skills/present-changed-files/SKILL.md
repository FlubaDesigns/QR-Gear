---
name: present-changed-files
description: After completing any fix, update, or build task, present only the files that were created or modified to the user as downloadable assets. Use this skill at the end of every task completion. Replaces "add files to downloads/site files."
---

# Save Changed Files to QR_Gear_Full_Website.zip After Every Fix or Update

After completing any fix, feature, or update — before marking a task done — add only the files that were created or modified during that task into `downloads/QR_Gear_Full_Website.zip`.

## Target

```
downloads/QR_Gear_Full_Website.zip
```

## Steps After Every Task

1. Identify every file you **created or modified** during the task
2. Add them to the zip using the `-u` (update) flag — adds new files and updates changed ones, never removes existing zip contents:

```bash
cd /home/runner/workspace && zip -u downloads/QR_Gear_Full_Website.zip \
  functions/src/routes/print-placements.ts \
  functions/src/index.ts
```

3. Tell the user which files were added/updated in the zip.

## Rules

- Use `zip -u` — never recreate the zip from scratch, only update it
- Run from `/home/runner/workspace` so paths inside the zip match the project structure
- **Only files touched this session** — do not add the entire codebase
- Do NOT include: files you only read, `package-lock.json`, `node_modules/`, `functions/lib/`, `.firebase/*.cache`, nested zip files, `attached_assets/`, `downloads/**`
- Do this **before** telling the user the task is complete

## What Counts as a Touched File

- Any file you wrote, edited, or created via tools during this task
- Do NOT include generated build output (compiled `.js` from `tsc`) — source files only

## Audit / Reconciliation

If you need to fully sync the zip with the project, see:
```
docs/WEBSITE_ZIP_GUIDE.md
```

## Example

Task: added `print-placements.ts`, updated `index.ts`.

```bash
cd /home/runner/workspace && zip -u downloads/QR_Gear_Full_Website.zip \
  functions/src/routes/print-placements.ts \
  functions/src/index.ts
```

Then tell the user:
> Added to `QR_Gear_Full_Website.zip`: `functions/src/routes/print-placements.ts` (new), `functions/src/index.ts` (updated).
