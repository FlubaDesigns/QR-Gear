# Background Images Not Displaying - January 8, 2026

## ISSUE SUMMARY

Source Images tab in Admin Backgrounds page is not displaying uploaded images, despite files existing in Firebase Storage and metadata existing in PostgreSQL.

---

## VERIFIED FACTS

### 1. Files Exist in Firebase Storage
```
Bucket: qrgear-c1ffd.firebasestorage.app

Files confirmed to exist:
- library/backgrounds/raw/zip/1767833856943-test-from-zip.png: EXISTS
- library/backgrounds/raw/1767833856943-test-individual.png: EXISTS
- backgrounds/source/test-upload-1767832056748.png: EXISTS

Total files found:
- library/backgrounds/: 8 files
- backgrounds/source/: 10 files
```

### 2. Metadata Exists in PostgreSQL
```sql
SELECT id, name, asset_type, storage_path FROM background_assets WHERE is_active = true;

Results:
- yd462cQrOWGmWsGzY4gj | test-from-zip-1767833856943 | source | library/backgrounds/raw/zip/1767833856943-test-from-zip.png
- bwgLFBK9U1aXHjC4ljkz | test-individual-1767833856943 | source | library/backgrounds/raw/1767833856943-test-individual.png
- (and 3 more...)
```

### 3. API Returns 401 Unauthorized
```
GET /api/admin/background-assets 401 in 1ms :: {"message":"Unauthorized"}
```

The 1ms response time indicates auth middleware rejected before token verification (which would take 100-200ms).

---

## ARCHITECTURE

### Image Display Flow
1. Frontend queries: `GET /api/admin/background-assets?type=source`
2. Each image displayed via proxy: `/api/background-files/{encoded_storage_path}`
3. Proxy fetches from Firebase Storage with auth token

### Authentication Flow
1. Frontend uses `apiRequest()` which calls `getAuthHeader()`
2. `getAuthHeader()` waits for `auth.authStateReady()` then gets Firebase ID token
3. Token sent as `Authorization: Bearer {token}` header
4. Server middleware verifies token via Firebase Admin SDK

### Storage Paths
- Individual uploads: `library/backgrounds/raw/`
- ZIP uploads: `library/backgrounds/raw/zip/`
- Cropped images: `library/backgrounds/cropped/`

---

## DEBUG LOGS ADDED

Added to `server/firebaseAuth.ts`:
```typescript
if (req.path.includes('/admin/background')) {
  console.log('[Auth Debug] Path:', req.path);
  console.log('[Auth Debug] Session user:', req.session?.user?.email || 'none');
  console.log('[Auth Debug] Auth header present:', !!req.headers.authorization);
}
```

---

## SUSPECTED CAUSES

1. **Race condition**: Query fires before Firebase auth state is restored
2. **Session not persisting**: Token verified but session not saved
3. **CORS/Cookie issue**: Session cookie not being sent with request

---

## KEY FILES

| File | Purpose |
|------|---------|
| `client/src/pages/admin-backgrounds.tsx` | Frontend - Source Images tab |
| `client/src/lib/queryClient.ts` | `apiRequest()` and `getAuthHeader()` |
| `server/firebaseAuth.ts` | Auth middleware and `isAdmin` check |
| `server/routes.ts` | `/api/admin/background-assets` endpoint |
| `server/lib/firebase-storage-service.ts` | File retrieval from Firebase Storage |

---

## NEXT STEPS

1. Check debug logs to see if Authorization header is present
2. Verify token is being sent on first request (not just subsequent)
3. Test if adding delay before first query fixes timing issue

---

*Created: January 8, 2026*
*Issue Status: OPEN*
