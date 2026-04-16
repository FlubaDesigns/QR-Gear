# QR Gear Full Website ZIP — Maintenance Guide

This document tells future agent instances how to keep `public/QR_Gear_Full_Website.zip` current.

---

## Where the ZIP Lives

```
public/QR_Gear_Full_Website.zip
```

This is Firebase Hosting's public directory. The zip is served publicly at:
```
https://qrgear-c1ffd.web.app/QR_Gear_Full_Website.zip
```

---

## After Every Fix or Update — Add Touched Files

Use `zip -u` to add or update only the files you touched. Never recreate the zip from scratch.

```bash
cd /home/runner/workspace && zip -u public/QR_Gear_Full_Website.zip \
  path/to/file-you-touched.ts \
  path/to/another-file.tsx
```

The `-u` flag updates existing entries and adds new ones. It never removes files already in the zip.

---

## Removing Stale Files (Deleted From Project)

If a file was deleted from the project, remove it from the zip:

```bash
zip -d public/QR_Gear_Full_Website.zip "path/to/deleted-file.ts"
```

---

## What to Include

| Include | Exclude |
|---|---|
| All source files you created or modified | `functions/package-lock.json` (lock file) |
| `functions/src/**` — routes, services, adapters | `functions/node_modules/**` |
| `client/src/**` — components, pages, features | `functions/lib/**` (compiled output) |
| `client/public/**` — images, favicons, assets | `.firebase/hosting.*.cache` |
| `shared/**` — schemas, types, constants | Binary zips nested inside the zip |
| `server/**` — routes, storage, handlers | `attached_assets/**` |
| `docs/**`, `*.md` at root | |
| `.agents/skills/**` — skill definitions | |
| `functions/package.json`, `functions/tsconfig.json` | |

---

## Running an Audit (Zip vs Project)

To check what's missing from the zip or what's stale:

```bash
# Files in project (git-tracked, no node_modules or attached_assets)
git ls-files | grep -v "^attached_assets/\|^node_modules/\|^functions/lib/\|^functions/node_modules/" | sort > /tmp/project_files.txt

# Files in zip
unzip -l public/QR_Gear_Full_Website.zip | awk 'NR>3{print $4}' | grep -v '/$' | grep -v '^$' | sort > /tmp/zip_files.txt

# In project but missing from zip
comm -23 /tmp/project_files.txt /tmp/zip_files.txt

# In zip but not in project (stale)
comm -13 /tmp/project_files.txt /tmp/zip_files.txt
```

---

## Checking the Zip Size

```bash
ls -lh public/QR_Gear_Full_Website.zip
unzip -l public/QR_Gear_Full_Website.zip | tail -1
```

---

## Current State (as of April 16, 2026)

- **865 files**, **4.4 MB**
- Fully synced with project source at checkpoint `efe8b9cf`
- Excludes: `package-lock.json`, `.firebase` cache, nested zips, `attached_assets/`
