# Background Images Not Displaying - January 8, 2026

## ISSUE SUMMARY

Source Images tab in Admin Backgrounds page returns 401 Unauthorized in 1ms (too fast for token verification). Files exist in Firebase Storage, metadata exists in PostgreSQL, but the `isAdmin` middleware rejects requests.

---

## WHAT WE'VE TRIED

1. **Added debug logging** to `server/firebaseAuth.ts` at lines 69-73 and 106-118
2. **Verified files exist** in Firebase Storage bucket `qrgear-c1ffd.firebasestorage.app`
3. **Verified metadata exists** in PostgreSQL `background_assets` table
4. **Checked browser console** - tokens ARE being generated (930 chars) and sent
5. **Set staleTime: 0** on queries to prevent caching issues

---

## WHAT WE THINK THE PROBLEM IS

**NOT a PostgreSQL v2 conversion problem.** The issue is authentication middleware timing.

The 401 returns in 1ms, but token verification takes 100-200ms. This means the middleware is rejecting BEFORE checking the token.

**Root Cause Analysis:**

Looking at `server/firebaseAuth.ts`:

```typescript
// Line 76-80: Session check happens FIRST
if (req.session?.user) {
  req.user = req.session.user;
  req.isAuthenticated = () => true;
  return next();
}

// Line 82-113: Token verification happens SECOND
const authHeader = req.headers.authorization;
if (authHeader?.startsWith('Bearer ')) {
  // ... verify token (takes 100-200ms)
}

// Line 115-120: If neither, set isAuthenticated to false
req.isAuthenticated = () => false;
next();
```

Then in `isAdmin` middleware (line 190-209):
```typescript
if (!req.isAuthenticated || !req.isAuthenticated()) {
  return res.status(401).json({ message: "Unauthorized" });  // Returns in 1ms
}
```

**The Problem:** 
- First request has no session yet
- Token IS in header but middleware falls through to `isAuthenticated = false`
- `isAdmin` immediately returns 401

**Why this might happen:**
1. Session cookie not being saved/sent correctly between requests
2. Token verification is failing silently (try/catch swallows error)
3. Race condition where query fires before auth state is ready

---

## VERIFIED FACTS

### 1. Files Exist in Firebase Storage
```
Bucket: qrgear-c1ffd.firebasestorage.app
Paths:
- library/backgrounds/raw/zip/1767833856943-test-from-zip.png
- library/backgrounds/raw/1767833856943-test-individual.png
- backgrounds/source/test-upload-1767832056748.png
```

### 2. Metadata Exists in PostgreSQL
```sql
SELECT id, name, asset_type, storage_path FROM background_assets WHERE is_active = true;
-- Returns 5+ active records
```

### 3. Browser Logs Show Token Generation
```
[Auth Debug] currentUser: perceys@gmail.com
[Auth Debug] Got token, length: 930
```

### 4. Server Returns 401 in 1ms
```
GET /api/admin/background-assets 401 in 1ms
```

---

## ARCHITECTURE

### Authentication Flow
1. Frontend calls `apiRequest()` which calls `getAuthHeader()`
2. `getAuthHeader()` waits for `auth.authStateReady()` then gets Firebase ID token
3. Token sent as `Authorization: Bearer {token}` header
4. Server middleware should verify token and set session
5. `isAdmin` middleware checks `req.isAuthenticated()`

### Storage Paths
- Individual uploads: `library/backgrounds/raw/`
- ZIP uploads: `library/backgrounds/raw/zip/`
- Cropped images: `library/backgrounds/cropped/`

---

## KEY FILES

| File | Purpose |
|------|---------|
| `server/firebaseAuth.ts` | Auth middleware - lines 50-121, isAdmin at 190-209 |
| `server/routes.ts` | `/api/admin/background-assets` at line 8633 |
| `client/src/lib/queryClient.ts` | `apiRequest()` and `getAuthHeader()` |
| `client/src/pages/admin-backgrounds.tsx` | Frontend - Source Images tab |

---

## SUGGESTED FIXES TO TRY

1. **Add more logging** - Log the actual error in the catch block (line 110-112)
2. **Check if token is reaching server** - Log `authHeader` value before verification
3. **Ensure session is saved** - Call `req.session.save()` after setting user
4. **Check cookie settings** - `secure: true` in production may block cookies in dev

---

## QUESTIONS FOR EXPERT

1. Is the Firebase Admin SDK properly initialized when verifying tokens?
2. Could the session store (MemoryStore) be failing silently?
3. Is there a CORS issue preventing cookies from being sent?

---

*Created: January 8, 2026*
*Issue Status: OPEN*
*Version: 3.5*
