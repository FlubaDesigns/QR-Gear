---
name: present-changed-files
description: After completing any fix, update, or build task, present only the files that were created or modified to the user as downloadable assets. Use this skill at the end of every task completion. Replaces "add files to downloads/site files."
---

# Present Changed Files After Every Fix or Update

After completing any fix, feature, or update — before marking a task done — present only the files that were created or newly modified during that task.

## When to Activate

Activate at the end of **every** completed fix, update, or build task. This runs after the work is done and verified.

## What to Present

Only include files that were **created or modified** during the current task. Do not include unchanged files. Examples:

- New route files: `functions/src/routes/print-placements.ts`
- Modified service files: `functions/src/services/instance-resolver.ts`
- Updated config/index files: `functions/src/index.ts`
- Any newly generated output files (zips, PDFs, images, etc.)

## How to Present

Use the `present_asset` tool. Pass only the files touched in this session.

```
present_asset({
  files: [
    { file_path: "functions/src/routes/print-placements.ts", title: "Print Placements Route (new)" },
    { file_path: "functions/src/index.ts", title: "Index — registered new route" }
  ]
})
```

## Rules

- **Only files touched this session** — do not present the entire codebase
- Use a descriptive `title` for each file that reflects what changed (e.g., "new", "updated", "bugfix")
- For non-code output files (zips, images, PDFs), present them the same way
- If a file is very large or binary, present it only if the user would reasonably want to download it
- Present assets **before** saying the task is complete — this is part of the handoff

## Example

After adding `print-placements.ts` and updating `index.ts`:

```
present_asset({
  files: [
    { file_path: "functions/src/routes/print-placements.ts", title: "Print Placements — new route (single source of truth)" },
    { file_path: "functions/src/index.ts", title: "Index — registered print-placements route" }
  ]
})
```

Then tell the user what was done.
