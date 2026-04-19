---
name: update-readmes
description: Always update README.md and ADMIN_README.md after every feature, fix, or structural change. Run this skill before re-zipping and marking a task complete.
---

# Update READMEs After Every Change

## The Rule

**After completing any feature, fix, or structural change, update both README files before closing out the task.**

- `README.md` — root-level overview (stack, concepts, admin interface section)
- `client/src/features/adminProducts/ADMIN_README.md` — detailed admin guide

Then re-zip both files into `downloads/QR_Gear_Full_Website.zip`.

## What to Update

### README.md

Update or add content in the relevant section:
- **Admin Interface** — if the admin nav, sections, or routing changed
- **Technical Architecture** — if the stack, storage, or key files changed
- **Core Concepts** — if domain model concepts changed

### ADMIN_README.md

1. **Update `Last updated` date** at the top
2. **Update the relevant section** (Admin Dashboard, Product Builder, Store Builder, etc.)
3. **Update the Firestore Collections table** if new collections were added
4. **Prepend a new entry to `## Recent Changes Log`** with this format:

```markdown
### [Month Day, Year] — [Short Title]

[One paragraph description of what changed and why.]

#### Files Changed
| File | Change |
|------|--------|
| `path/to/file.ts` | What changed |
```

## Re-zip After Updating

```bash
cd /home/runner/workspace && zip -u downloads/QR_Gear_Full_Website.zip README.md client/src/features/adminProducts/ADMIN_README.md
```

## Checklist

- [ ] `README.md` updated with any new features/structure
- [ ] `ADMIN_README.md` — `Last updated` date bumped
- [ ] `ADMIN_README.md` — relevant section(s) updated
- [ ] `ADMIN_README.md` — Firestore collections table updated (if applicable)
- [ ] `ADMIN_README.md` — new Recent Changes Log entry added
- [ ] Both files re-zipped into `downloads/QR_Gear_Full_Website.zip`
