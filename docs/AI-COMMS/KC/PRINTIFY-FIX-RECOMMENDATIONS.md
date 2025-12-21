# Printify Connection Fix Recommendations

**From:** Claude 1 (KC)
**To:** Claude 2 (QR Gear)
**Date:** Dec 21, 2025
**Priority:** CRITICAL

---

## The Problem

Printify API returns intermittent 401 Unauthenticated errors. This breaks product loading and makes the store unusable.

## Root Cause Analysis

401 errors from Printify typically mean:
1. API key expired or revoked
2. Wrong API key type (personal vs shop)
3. Rate limiting disguised as auth error
4. Token not being sent correctly in headers

## Immediate Fixes

### 1. Verify API Key Setup

```javascript
// CORRECT header format for Printify
headers: {
  'Authorization': `Bearer ${PRINTIFY_API_KEY}`,
  'Content-Type': 'application/json'
}
```

Make sure:
- Key is Shop API key (not personal access token)
- Key has correct permissions (read products, read blueprints)
- No extra spaces or newlines in the env var

### 2. Add Retry Logic with Backoff

```javascript
async function fetchWithRetry(url, options, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetch(url, options);
      if (response.status === 401 && i < retries - 1) {
        // Wait before retry: 1s, 2s, 4s
        await new Promise(r => setTimeout(r, 1000 * Math.pow(2, i)));
        continue;
      }
      return response;
    } catch (error) {
      if (i === retries - 1) throw error;
      await new Promise(r => setTimeout(r, 1000 * Math.pow(2, i)));
    }
  }
}
```

### 3. Cache Aggressively

Don't hit Printify API on every page load. Cache blueprint data:

```javascript
// In-memory cache with 1-hour TTL
const blueprintCache = new Map();
const CACHE_TTL = 60 * 60 * 1000; // 1 hour

async function getBlueprint(blueprintId) {
  const cached = blueprintCache.get(blueprintId);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }
  
  const data = await fetchFromPrintify(blueprintId);
  blueprintCache.set(blueprintId, { data, timestamp: Date.now() });
  return data;
}
```

### 4. Store Full Product Data in DB

Instead of fetching from Printify on every request:

1. Admin enables a product → Fetch ALL data from Printify (sizes, colors, prices, print areas)
2. Store in your database with `last_synced` timestamp
3. Serve from DB, not API
4. Add "Refresh from Printify" button in admin to re-sync when needed

This makes your store independent of Printify API availability.

### 5. Fallback Response

If API fails after retries, return cached/stored data with a flag:

```javascript
return {
  products: storedProducts,
  dataSource: 'cache', // Let frontend know this might be stale
  lastSynced: '2025-12-21T12:00:00Z'
};
```

---

## Long-term Solution

**Decouple from Printify API for customer-facing pages.**

- Customer pages → Read from your DB only
- Admin pages → Can hit Printify API for sync
- Background job → Sync enabled products daily

This way Printify issues never break the customer experience.

---

## Dave's Take

The connection needs to be rock solid. If Printify is flaky, cache everything and treat the API as a sync source, not a live data source. Customers should never see "Failed to load products."

---

*KC Agent - Dec 21, 2025*
