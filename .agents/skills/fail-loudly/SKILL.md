---
name: fail-loudly
description: When something fails to load, fetch, or initialize, always surface the error explicitly to the user. Never let failures happen silently. Use this skill whenever writing any data-fetching, loading, or initialization code.
---

# Fail Loudly

When something fails or returns empty when it shouldn't, **always tell the user explicitly** — in the UI, in the console, and in the API response. Never let failures hide behind silent fallbacks.

## The Rule

If a load fails, the user must see it fail. No silent swallowing of errors, no invisible fallbacks that make broken look normal.

## What to Avoid

```tsx
// BAD: Silent fallback — user sees empty content with no idea why
const description = p.description || p.model || null;

// BAD: Error swallowed, component renders as if nothing happened
try {
  const data = await fetchCatalog();
  setItems(data);
} catch (e) {
  // silently do nothing
}

// BAD: Returns empty array on failure — caller can't tell if it worked
if (!res.ok) return [];

// BAD: Falls back to stale/wrong data source without warning
if (localBlueprints.length === 0) {
  blueprints = await printify.getCatalogBlueprints(); // no description on this path
}
```

## What to Do Instead

```tsx
// GOOD: Show an error state the user can see
const { data, isLoading, error } = useQuery({ ... });
if (error) return <ErrorMessage message="Failed to load products. Please try again." />;

// GOOD: Log clearly and surface the error
} catch (e) {
  console.error("[CatalogLoad] Failed:", e);
  res.status(500).json({ error: e.message });
}

// GOOD: Return a meaningful error, not empty data
if (!res.ok) {
  console.error("[API] Catalog fetch failed:", res.status);
  throw new Error(`Catalog unavailable (${res.status})`);
}

// GOOD: If critical data is missing, show a placeholder that communicates failure
{!description && <p className="text-destructive text-sm">Description unavailable — check Firestore sync</p>}
```

## Specific Patterns for This Project

- **TanStack Query**: Always handle the `error` state from `useQuery` — don't just handle `isLoading`. Show a visible error message or toast.
- **API routes**: Never return `200 OK` with empty data when the real cause is a failure. Use appropriate status codes (500, 503).
- **Fallback chains**: If you write `a || b || null`, ask whether `b` is a real fallback or a disguise for a broken `a`. If `a` should always have data, log an error when it doesn't.
- **Silent empty arrays**: `return []` on failure hides the problem. Throw instead, or return `{ data: [], error: "..." }`.
- **Firebase/Firestore**: If a collection read returns 0 docs when it should have data, log it as an error with the collection name.

## In the UI

Use toasts or inline error messages — never just render nothing:
```tsx
const { data, error } = useQuery({ queryKey: [...], ... });

if (error) {
  toast({ title: "Load failed", description: error.message, variant: "destructive" });
}
```

## In Console/Logs

Every caught error should be logged with:
1. Which module/function failed (prefix like `[ProductsModule]`, `[Catalog API]`)
2. What it was trying to do
3. The actual error message

```ts
console.error("[Catalog API] Failed to read printify_blueprints:", e.message);
```
