# QR Gear — Products Canonical Implementation

**Status:** Ready for Replit deployment  
**Date:** June 5, 2026  
**Priority:** Critical — fixes member area earnings bug  
**Time to deploy:** 2-3 hours

---

## What You're Doing

Implementing the **Products Canonical Resolver** — a single endpoint that all five contexts (admin, member, owner, external, marketplace) use to get product data.

**This fixes:**
- Member earnings showing "$0.00+" 
- Five separate broken product query systems
- No unified product shape across contexts

**After deployment:**
- One endpoint: `GET /api/products/canonical/:qrgCode?context=...`
- All contexts get the same data shape
- Members can see real earnings data

---

## What to Copy

Three files go into your `functions/src/` directory:

1. **products-canonical.ts** → `functions/src/routes/products-canonical.ts`
2. **Update functions/src/index.ts** → Add route registration + bump BUILD_ID
3. **Update functions/src/routes/members.ts** → Add two new endpoints

---

## Step 1: Copy products-canonical.ts

Take the file `products-canonical.ts` from this package.

Copy it to: `functions/src/routes/products-canonical.ts`

That's it. No edits. Production-ready.

---

## Step 2: Register in functions/src/index.ts

**At the top with other imports, add:**

```typescript
import { register as registerProductsCanonical } from './routes/products-canonical';
```

**Find where other routes are registered (look for `register(app)` calls) and add:**

```typescript
registerProductsCanonical(app);
```

**On line 1, bump the BUILD_ID timestamp.**

Current example:
```typescript
export const _BUILD_ID = "2026-06-05_abc123";
```

Change to today:
```typescript
export const _BUILD_ID = "2026-06-05_rebuild-canonical";
```

This forces Firebase to recognize the new code.

---

## Step 3: Add Member Routes

**File to edit:** `functions/src/routes/members.ts`

**Add these two routes at the end (before the export):**

```typescript
// GET member's published items
app.get('/members/:memberId/published-items', async (req: Request, res: Response): Promise<void> => {
  try {
    const { memberId } = req.params;
    const auth = await verifyMemberAuthCF(req, memberId);
    if (!auth.authorized) { res.status(401).json({ error: auth.error }); return; }

    const { types } = req.query;
    const typeFilter = types ? (types as string).split(',') : null;

    const snapshot = await db.collection('qr_dynamics_instances')
      .where('memberId', '==', memberId)
      .where('isPublished', '==', true)
      .orderBy('createdAt', 'desc')
      .get();

    let items = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    }));

    if (typeFilter) {
      items = items.filter((item: any) => typeFilter.includes(item.type));
    }

    res.json({ items, count: items.length });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// GET member earnings summary
app.get('/members/:memberId/earnings', async (req: Request, res: Response): Promise<void> => {
  try {
    const { memberId } = req.params;
    const auth = await verifyMemberAuthCF(req, memberId);
    if (!auth.authorized) { res.status(401).json({ error: auth.error }); return; }

    const snapshot = await db.collection('member_earnings')
      .where('memberId', '==', memberId)
      .get();

    const earnings = snapshot.docs.map(doc => doc.data());
    
    const summary = {
      total: earnings.reduce((sum, e) => sum + (e.amount || 0), 0),
      pending: earnings.filter(e => e.status === 'pending').reduce((sum, e) => sum + (e.amount || 0), 0),
      paid: earnings.filter(e => e.status === 'paid').reduce((sum, e) => sum + (e.amount || 0), 0),
      profitShare: 0.25,
    };

    res.json({ earnings, summary });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});
```

---

## Step 4: Fix Auth Timeout (Client)

**File to edit:** `client/src/lib/memberFetch.ts`

**Replace the `getMemberToken()` function with:**

```typescript
async function getMemberToken(): Promise<string | null> {
  if (import.meta.env.VITE_ADMIN_BYPASS === "true") {
    return null;
  }

  let user = auth.currentUser;

  if (!user) {
    await new Promise<void>((resolve) => {
      const timeout = setTimeout(() => {
        console.warn("[memberFetch] Auth state timeout after 5s");
        resolve();
      }, 5000);

      const unsub = onAuthStateChanged(auth, (u) => {
        clearTimeout(timeout);
        unsub();
        resolve();
      });
    });
    user = auth.currentUser;
  }

  if (!user) {
    console.error("[memberFetch] No authenticated user found after timeout");
    throw new Error("User not authenticated");
  }

  return user.getIdToken();
}
```

---

## Step 5: Build

```bash
bash deploy/1-build.sh
```

Wait for it to finish. If you see TypeScript errors, fix them and re-run this step.

---

## Step 6: Deploy Functions

```bash
bash deploy/2-functions.sh
```

If this times out, go straight to Step 7.

---

## Step 7: Deploy Hosting

```bash
bash deploy/3-hosting.sh
```

---

## Step 8: Test

**Test the resolver endpoint:**

```bash
curl "https://qrgear-c1ffd.web.app/api/products/canonical/QRG-11101?context=external"
```

Should return JSON with product data.

**Test member endpoints (with auth token):**

```bash
curl -H "Authorization: Bearer YOUR_TOKEN" \
  "https://qrgear-c1ffd.web.app/api/members/user123/published-items"

curl -H "Authorization: Bearer YOUR_TOKEN" \
  "https://qrgear-c1ffd.web.app/api/members/user123/earnings"
```

Should return member data (not empty, not "$0.00+").

---

## API Endpoints

### GET /api/products/canonical/:qrgCode

Query params:
- `context` (required): `admin` | `member` | `owner` | `external` | `marketplace`
- `memberId` (if context=member)
- `ownerId` (if context=owner)
- `provider` (if context=marketplace): `etsy` | `amazon` | `ebay`

### GET /api/members/:memberId/published-items

Returns member's published QR Compose items.

### GET /api/members/:memberId/earnings

Returns member's earnings summary with total, pending, paid amounts.

---

## Checklist

- [ ] products-canonical.ts copied to functions/src/routes/
- [ ] Route registered in functions/src/index.ts
- [ ] BUILD_ID bumped in functions/src/index.ts
- [ ] Two member routes added to functions/src/routes/members.ts
- [ ] Auth timeout fixed in client/src/lib/memberFetch.ts
- [ ] Build completes (step 5)
- [ ] Deploy functions completes (step 6)
- [ ] Deploy hosting completes (step 7)
- [ ] Test endpoints return data (step 8)
- [ ] Member page no longer shows "$0.00+"
- [ ] Member earnings show real data

---

## If Something Breaks

**TypeScript error during build:**
- Fix the error
- Re-run step 5

**"No changes detected" on deploy step 6:**
- Verify BUILD_ID was bumped in functions/src/index.ts line 1
- Re-run step 5, then step 6

**Endpoints return 404:**
- Verify routes were added to functions/src/routes/members.ts
- Verify registerProductsCanonical(app) was added to functions/src/index.ts
- Check deployment completed

**Member earnings still show $0:**
- Verify member_earnings collection exists in Firestore
- Check that member has earnings records
- Verify memberId in request matches exactly

---

## Reference Documents

See the additional markdown files for full technical details:
- PRODUCTS_CANONICAL_ROUTES.md — Complete API specification
- QR_GEAR_MEMBER_AREA_FIXES.md — Root cause analysis
- MEMBERS_ROUTES.md — Member endpoint details

But you don't need them to deploy. Just follow the steps above.

---

## Production URL

Live at: https://qrgear-c1ffd.web.app

Test all endpoints against this URL only. This is production.

---

Done. Deploy and test.
