# Zip Export Rules — QR Gear Full Website

Always use this file before building `downloads/QR_Gear_Full_Website.zip`.

## Command (explicit include — use this, not exclude-based)

Do NOT use `zip -r . --exclude ...` — it sweeps temp files and node_modules that slip past patterns.
Use explicit includes only:

```bash
cd /home/runner/workspace && zip -r downloads/QR_Gear_Full_Website.zip \
  client/src \
  client/index.html \
  client/public \
  server \
  functions/src \
  functions/tsconfig.json \
  functions/vitest.config.ts \
  functions/package.json \
  shared \
  migrations \
  scripts \
  public \
  .agents \
  replit.md \
  README.md \
  ADMIN_MANUAL.md \
  METHODOLOGY.md \
  PRODUCTION_INVENTORY.md \
  ARCHITECTURE_IDENTITY.md \
  ARCHITECTURE_VIEWER.md \
  ASSET_LIBRARY_SPEC.md \
  tailwind.config.ts \
  tsconfig.json \
  vite.config.ts \
  postcss.config.js \
  package.json \
  storage.rules \
  .gitignore \
  .gitattributes \
  .gcloudignore \
  drizzle.config.ts
```

## What is excluded and why

| Excluded path | Reason |
|---|---|
| `node_modules/` | Installed dependencies — not source code |
| `.git/` | Version control internals |
| `downloads/` | The zip itself — would cause recursive inclusion |
| `attached_assets/` | User-uploaded reference images, often very large |
| `.local/` | Agent workspace / skills — not project source |
| `dist/` | Build output — not source |
| `lib/` | Compiled output folders |
| `client/public/img/*` | Large product/hero images — user manages these separately |
| `client/src/assets/*.png/jpg/jpeg/webp` | Large binary assets |

## What IS included

All source code:
- `client/src/**` (tsx, ts, css)
- `server/**`
- `functions/src/**`
- `shared/**`
- Config files (tailwind, tsconfig, vite.config, etc.)
- `replit.md`, `README.md`, `ADMIN_MANUAL.md`
- `.agents/skills/**`
- `migrations/**`
