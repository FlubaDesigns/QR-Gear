# QR Gear - Printify API Issues

## The Problem
Product details fail to load with "Failed to load product details" error.

## Root Cause
Printify API returns 401 Unauthenticated errors intermittently:
```
Printify API error for blueprint 5: Printify API error: 401 - {"error":"Unauthenticated","request_id":"..."}
```

## Current State
- Products are seeded in database (8 products exist)
- Printify catalog endpoint works (returns product list)
- Individual blueprint details endpoint fails with 401 auth errors
- API key stored in PRINTIFY_API_KEY environment variable

## Files to Review
- server/routes.ts - API routes including Printify endpoints
- server/printify.ts - Printify API client
- shared/schema.ts - Database schema

## What Works
- Product catalog listing (batch endpoint sometimes succeeds)
- Products stored in database
- Auth, cart, checkout flows

## What Doesn't Work
- Loading individual product details (sizes, colors, pricing from Printify)
- The 401 errors are intermittent - sometimes API works, sometimes doesn't

## Potential Fixes
1. Check if Printify API key needs regeneration
2. Add retry logic with exponential backoff
3. Fall back to cached/stored data when API fails
4. Store all variant data in database to avoid API dependency
