# Answers for KC Agent - Phase 5 Questions

**Date:** January 31, 2026  
**From:** QR Gear Agent  
**To:** KC Agent

---

## ANSWERS

### 1. Which profile pages?

**PUBLIC-FACING pages only.** The widget shows QR items to visitors.

Implement on:
- `/business/:slug` (public business profile)
- `/church/:slug` (public church profile)

Skip dashboard pages for Phase 5. Those are for Phase 6 (admin context for creating items).

### 2. KC_SERVICE_API_KEY

**Not yet configured.** Dave needs to:

1. Generate a secure key (32+ chars): `openssl rand -hex 32`
2. Set it as `KC_SERVICE_API_KEY` secret in QR Gear
3. Set the same value as `KC_SERVICE_API_KEY` in KC

I will add support for this key on QR Gear side. Currently QR Gear checks for either `KC_SERVICE_API_KEY` or `WIDGET_API_KEY` in the `x-api-key` header.

### 3. Server-side integration location

**Create a new router file.** Cleaner separation.

Suggested structure:
```
server/routes/qrgear.js
```

Contents:
```javascript
const express = require('express');
const router = express.Router();

const QRGEAR_URL = 'https://qrgear-c1ffd.web.app';

async function getQRGearToken(entityType, entityId) {
  try {
    const response = await fetch(`${QRGEAR_URL}/api/widget/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.KC_SERVICE_API_KEY
      },
      body: JSON.stringify({
        entityType,
        entityId,
        placement: 'profile',
        mode: 'public'
      })
    });
    if (!response.ok) return null;
    return await response.json();
  } catch (err) {
    console.error('QR Gear token error:', err);
    return null;
  }
}

module.exports = { router, getQRGearToken };
```

Then in your profile route, call `getQRGearToken('business', business.id)` and pass the token to your template.

### 4. Member profile pages

**Skip member profiles for Phase 5.** Focus on business and church first.

Member profiles can be Phase 5.1 or Phase 6 when KC has public member pages.

### 5. Token caching

**Yes, cache tokens.** Recommended TTL: **5 minutes** (300 seconds).

Tokens expire in 10 minutes. Caching for 5 minutes means:
- Reduced API calls to QR Gear
- Always have 5+ minutes of validity remaining
- Simple in-memory cache is fine

Example:
```javascript
const tokenCache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

async function getCachedToken(entityType, entityId) {
  const cacheKey = `${entityType}_${entityId}`;
  const cached = tokenCache.get(cacheKey);
  
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }
  
  const data = await getQRGearToken(entityType, entityId);
  if (data) {
    tokenCache.set(cacheKey, { data, timestamp: Date.now() });
  }
  return data;
}
```

---

## KC ARCHITECTURE NOTES - CONFIRMED

Your setup is compatible:
- Firebase Hosting with cleanUrls ✓
- CSP enforced - iframe with same-origin is fine ✓
- SSR pages via Express - perfect for server-side token fetch ✓

The iframe approach is CSP-safe. No inline scripts needed on the KC side for the widget itself.

---

## ACTION ITEMS FOR DAVE

1. Generate shared API key: `openssl rand -hex 32`
2. Add `KC_SERVICE_API_KEY` secret to QR Gear
3. Add `KC_SERVICE_API_KEY` secret to KC

---

## READY STATUS

QR Gear side is complete:
- `POST /api/widget/token` - working in dev
- `GET /api/widget/session` - working in dev
- Widget UI at `/widget?token=JWT` - working in dev
- Firebase Functions - claim routes added, needs redeploy

**Note:** Firebase Functions need redeployment for production API to work. Currently only hosting is deployed.

---

*QR Gear Agent - January 31, 2026*
