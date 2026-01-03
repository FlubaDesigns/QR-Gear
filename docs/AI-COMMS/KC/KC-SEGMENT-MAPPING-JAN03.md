# KC Segment ID Mapping System - January 3, 2026

## Status: IMPLEMENTED

---

## Overview

KC has implemented a segment ID mapping system to identify entities for QR Gear widget integration.

---

## Segment ID Format

```
KC-{TYPE}-{slug}
```

| Type Code | Entity Type | Example |
|-----------|-------------|---------|
| `BIZ` | Business | `KC-BIZ-joes-plumbing` |
| `CHR` | Church | `KC-CHR-faith-community` |
| `MEM` | Member | `KC-MEM-john-doe` |

---

## Files Created

| File | Purpose |
|------|---------|
| `js/qrgear/segment-mapper.js` | Generates/parses segment IDs, builds KC URLs |
| `js/qrgear/widget-embed.js` | Widget embedding helper with token generation |
| `functions/index.js` | Added `generateQrGearToken` Cloud Function |

---

## Cloud Function: generateQrGearToken

**Endpoint:** `POST /api/qrgear/generate-token`

**Authentication:** Requires Firebase Auth Bearer token

**Request Body:**
```json
{
  "partnerId": "kingdom-connects",
  "placement": "business",
  "segmentId": "KC-BIZ-joes-plumbing",
  "kcListingUrl": "https://kingdomconnects.org/business/joes-plumbing.htm",
  "allowedSegments": ["Religious", "Business", "Custom"],
  "businessId": "joes-plumbing",
  "businessName": "Joe's Plumbing",
  "businessSlug": "joes-plumbing",
  "businessLogoUrl": "https://...",
  "ownerEmail": "joe@example.com"
}
```

**Response:**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "expiresIn": 3600
}
```

---

## Segment Mapper Functions

```javascript
import { generateSegmentId, parseSegmentId, getKcPageUrl } from './js/qrgear/segment-mapper.js';

// Generate segment ID
const segmentId = generateSegmentId('business', 'joes-plumbing');
// Returns: "KC-BIZ-joes-plumbing"

// Parse segment ID
const parsed = parseSegmentId('KC-BIZ-joes-plumbing');
// Returns: { entityType: 'business', slug: 'joes-plumbing' }

// Get KC page URL
const url = getKcPageUrl('business', 'joes-plumbing');
// Returns: "https://kingdomconnects.org/business/joes-plumbing.htm"
```

---

## Widget Embed Helper

```javascript
import { embedQrGearWidget } from './js/qrgear/widget-embed.js';

// Embed widget on a business page
await embedQrGearWidget('#widget-container', 'business', {
  id: 'business-123',
  slug: 'joes-plumbing',
  name: "Joe's Plumbing",
  logo: 'https://...',
  ownerEmail: 'joe@example.com'
}, {
  segment: 'Religious'  // Optional filter
});
```

---

## JWT Token Contents

The generated token includes:

```json
{
  "partnerId": "kingdom-connects",
  "placement": "business",
  "segmentId": "KC-BIZ-joes-plumbing",
  "kcListingUrl": "https://kingdomconnects.org/business/joes-plumbing.htm",
  "allowedSegments": ["Religious", "Business", "Custom"],
  "businessId": "joes-plumbing",
  "businessName": "Joe's Plumbing",
  "businessSlug": "joes-plumbing",
  "businessLogoUrl": "https://...",
  "ownerEmail": "joe@example.com",
  "iat": 1735900000,
  "exp": 1735903600
}
```

---

## Shared Secret

JWT tokens are signed with `WIDGET_JWT_SECRET` which is configured in:
- Firebase Functions secrets
- QR Gear server (for verification)

---

## Next Steps

1. Deploy functions: `firebase deploy --only functions`
2. QR Gear to verify token using shared secret
3. KC to embed widgets on business/church/member pages

---

*Last updated: January 3, 2026*
