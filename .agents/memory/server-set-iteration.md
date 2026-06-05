---
name: Server Set iteration
description: Server tsconfig has no downlevelIteration — spreading Sets/Map iterators fails TS in server/routes/*.ts
---

The root `tsconfig.json` (which covers `server/`) does not have `downlevelIteration` enabled. This means:

- `[...new Set(...)]` → TS error "Type 'Set<X>' can only be iterated through when using '--downlevelIteration'"
- `for (const x of someSet)` → same error
- `for (const [k, v] of someMap.entries())` → same error

**Fix:** Always use `Array.from()` wrappers:
- `Array.from(new Set(...))` instead of `[...new Set(...)]`
- `for (const x of Array.from(someSet))` instead of direct for-of on Set
- `for (const [k, v] of Array.from(map.entries()))` instead of direct for-of on MapIterator

**Why:** The server tsconfig targets a level where iterating non-array iterables requires downlevelIteration or explicit Array.from conversion. This is only a server-side issue — client (Vite/React) tsconfig is fine with direct spread.

**How to apply:** Any time you add code to `server/routes/` or `server/lib/` that uses Set/Map spread or for-of, use Array.from.
