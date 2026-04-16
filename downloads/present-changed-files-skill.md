---
name: present-changed-files
description: After completing any fix, update, or build task, present only the files that were created or modified to the user as downloadable assets. Use this skill at the end of every task completion. Replaces "add files to downloads/site files."
---

# Save Changed Files to Downloads After Every Fix or Update

After completing any fix, feature, or update — before marking a task done — copy only the files that were created or modified during that task into the `downloads/` folder at the project root.

## Target Folder

```
/home/runner/workspace/downloads/
```

## Steps After Every Task

1. Identify every file you **created or modified** during the task
2. Copy each one into `downloads/` using bash:

```bash
cp functions/src/routes/print-placements.ts downloads/print-placements.ts
cp functions/src/index.ts downloads/index.ts
```

3. For **non-code output files** (zips, images, PDFs, CSVs) also present them using the asset presenter so the user gets a clickable download card:

```
present_asset({
  files: [
    { file_path: "downloads/export.zip", title: "Export — site package" }
  ]
})
```

4. For **code files** (.ts, .js, .tsx, .py, etc.) — do NOT use the asset presenter (it only accepts non-code files). Just tell the user which files were copied to `downloads/`.

## Rules

- **Only files touched this session** — do not copy the entire codebase
- Copy to `downloads/` root, no nested subdirectories
- If two files share a name from different directories, prefix with the parent folder (e.g., `routes_print-placements.ts`)
- Do this **before** telling the user the task is complete
- Always tell the user which files are now in `downloads/` even if you can't use the asset presenter for them

## What Counts as a Touched File

- Any file you wrote, edited, or created via tools during this task
- Generated output files (zips, images, PDFs) produced as part of the task
- Do NOT include: files you only read, unchanged config files, lock files

## Example

Task: added `print-placements.ts` and registered it in `index.ts`.

```bash
cp functions/src/routes/print-placements.ts downloads/print-placements.ts
cp functions/src/index.ts downloads/index.ts
```

Then tell the user:
> Files saved to `downloads/`: `print-placements.ts` (new route), `index.ts` (registered route).
