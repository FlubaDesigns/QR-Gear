# AI-COMMS - Cross-Agent Communication

**Purpose:** Share context and issues between AI agents working on QR Gear project.

---

## CURRENT ISSUES - January 8, 2026

### Issue #1: 401 Unauthorized on Source Images Tab (Dev)

**Problem:** Admin Backgrounds page "Source Images" tab returns 401 Unauthorized in 1ms.

**Key Facts:**
- Files exist in Firebase Storage
- Metadata exists in PostgreSQL `background_assets` table  
- Browser sends valid auth token (930 chars)
- 401 returns in 1ms (too fast for actual token verification which takes 100-200ms)

**Root Cause:** Auth middleware checks session first, then token. First request has no session, so it falls through and sets `isAuthenticated = false` before token verification completes.

**File:** `server/firebaseAuth.ts` - `isAdmin` middleware (lines 190-209)

---

### Issue #2: Images Not Showing in Production File Viewer

**Problem:** Uploaded background images don't appear in Firebase production source code viewer.

**Key Facts:**
- Files ARE in Firebase Storage bucket `qrgear-c1ffd.firebasestorage.app`
- Files ARE in PostgreSQL metadata
- Dev environment can access files (when auth works)
- Production deployment doesn't show files in viewer

**Likely Cause:** Firebase Hosting serves static files bundled at deploy time. Firebase Storage files uploaded after deployment are NOT part of the static bundle and won't appear in the hosting file browser.

---

## PROJECT CONTEXT

### Tech Stack
- **Frontend:** React, TypeScript, Vite, TanStack Query
- **Backend:** Node.js, Express, TypeScript
- **Database:** PostgreSQL (Neon) with Drizzle ORM
- **Storage:** Firebase Storage
- **Auth:** Firebase Authentication
- **Hosting:** Firebase Hosting + Cloud Functions

### Key Files
| File | Purpose |
|------|---------|
| `server/firebaseAuth.ts` | Auth middleware (lines 76-120 = token verification, lines 190-209 = isAdmin) |
| `server/routes.ts` | API endpoints including `/api/admin/background-assets` |
| `client/src/pages/admin-backgrounds.tsx` | Admin UI for background images |
| `shared/schema.ts` | Database schema including `background_assets` table |

### Storage Paths
- Raw uploads: `library/backgrounds/raw/`
- ZIP uploads: `library/backgrounds/raw/zip/`
- Cropped images: `library/backgrounds/cropped/`

---

## HOW TO RESPOND

1. Create a response file (e.g., `RESPONSE-JAN08.md`)
2. Include specific code fixes with line numbers
3. Re-zip this folder

---

*Last Updated: January 8, 2026*
