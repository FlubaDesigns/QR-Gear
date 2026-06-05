# QR Gear Member Area - Broken & Fixes

## Issues Found

### 1. **Missing Member Routes (CRITICAL)**
**Problem:** Client calls to `/api/members/{memberId}/published-items` don't have corresponding server routes.

**Where it fails:**
- `client/src/features/members/MembersPage.tsx` line ~60
- Calls: `memberFetch<any>(\`/${memberId}/published-items?types=qr-compose\`)`
- Expected endpoint: `/api/members/{memberId}/published-items`
- **This doesn't exist in functions/src/routes/members.ts**

**Fix:** Add this route to `functions/src/routes/members.ts`:

```typescript
// GET member's published items (QR Compose items)
app.get('/members/:memberId/published-items', async (req: Request, res: Response): Promise<void> => {
  try {
    const { memberId } = req.params;
    const auth = await verifyMemberAuthCF(req, memberId);
    if (!auth.authorized) { res.status(401).json({ error: auth.error }); return; }

    const { types } = req.query; // types=qr-compose or canvas or play
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
```

---

### 2. **Missing Earnings Endpoint**
**Problem:** Client calls `/api/members/{memberId}/earnings` which doesn't exist.

**Where it fails:**
- `client/src/features/members/MembersPage.tsx` line ~90
- Calls: `memberFetch<any>(\`/${memberId}/earnings\`)`

**Fix:** Add this route to `functions/src/routes/members.ts`:

```typescript
// GET member earnings summary
app.get('/members/:memberId/earnings', async (req: Request, res: Response): Promise<void> => {
  try {
    const { memberId } = req.params;
    const auth = await verifyMemberAuthCF(req, memberId);
    if (!auth.authorized) { res.status(401).json({ error: auth.error }); return; }

    // Get all transactions for this member
    const snapshot = await db.collection('member_earnings')
      .where('memberId', '==', memberId)
      .get();

    const earnings = snapshot.docs.map(doc => doc.data());
    
    const summary = {
      total: earnings.reduce((sum, e) => sum + (e.amount || 0), 0),
      pending: earnings.filter(e => e.status === 'pending').reduce((sum, e) => sum + (e.amount || 0), 0),
      paid: earnings.filter(e => e.status === 'paid').reduce((sum, e) => sum + (e.amount || 0), 0),
      profitShare: 0.25, // 25% to creators
    };

    res.json({ earnings, summary });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});
```

---

### 3. **Auth Token Not Being Passed**
**Problem:** `memberFetch` in `client/src/lib/memberFetch.ts` waits for Firebase auth but may not be initialized when component mounts.

**Where it fails:**
- First page load: user logs in, but component renders before Firebase initializes
- Results in: "No authenticated user found" error in console
- Member data never loads

**Fix:** Update `memberFetch` to have better timeout handling:

```typescript
async function getMemberToken(): Promise<string | null> {
  if (import.meta.env.VITE_ADMIN_BYPASS === "true") {
    return null;
  }

  let user = auth.currentUser;

  if (!user) {
    // Wait for auth state with timeout
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

### 4. **Missing Error Boundary in MembersPage**
**Problem:** If ANY subcomponent fails, entire member area crashes with no fallback.

**Currently:** `MembersPage` has error boundary class but it's not properly wired to child components.

**Fix:** Wrap all lazy-loaded wizards in error handling:

```typescript
function SafeLazyComponent({ Component, fallback }: { Component: any; fallback?: ReactNode }) {
  return (
    <Suspense fallback={fallback || <LazyFallback />}>
      <ErrorBoundary>
        <Component />
      </ErrorBoundary>
    </Suspense>
  );
}

// Then use:
<SafeLazyComponent Component={SuperSimpleWizard} />
```

---

### 5. **Member Context Not Initialized**
**Problem:** `useMemberRuntimeState` hook in MembersPage may not have provider context.

**Fix:** Ensure proper nesting in `client/src/pages/Members.tsx` or entry point:

```typescript
export function MembersLayout() {
  return (
    <MemberAuthProvider>
      <MembersProvider>
        <WizardProvider>
          <MembersPage />
        </WizardProvider>
      </MembersProvider>
    </MemberAuthProvider>
  );
}
```

---

## Quick Fix Priority

**CRITICAL (Do First):**
1. Add `/members/:memberId/published-items` route
2. Add `/members/:memberId/earnings` route
3. Fix auth token timeout in memberFetch

**HIGH (Do Second):**
4. Add error boundary wrapper
5. Verify context provider nesting

**MEDIUM (Do Third):**
6. Add console logging for debugging
7. Add retry logic for failed API calls

---

## Testing Checklist

- [ ] Log in as member
- [ ] Member page loads without console errors
- [ ] Published items appear
- [ ] Earnings dashboard shows data
- [ ] Can create new QR with wizard
- [ ] Can view studio mode
- [ ] Can access payouts
- [ ] Social hub loads

---

## Files to Edit

1. `functions/src/routes/members.ts` — Add 2 new routes
2. `client/src/lib/memberFetch.ts` — Fix auth timeout
3. `client/src/pages/Members.tsx` or entry point — Fix context nesting
4. `client/src/features/members/MembersPage.tsx` — Add error boundary

---

## Deploy After Fixes

```bash
# From Replit:
npm run build
npm run deploy
```

This pushes both client and functions to Firebase.
