# QR Gear Widget Embedding System

## Status: IMPLEMENTED - January 3, 2026

## Overview

The QR Gear embeddable widget allows partner websites (like Kingdom Connects) to embed product displays on their pages.

---

## KC Integration Variables (From INTEGRATION-RESPONSE.md)

| Variable | Type | Source | Description |
|----------|------|--------|-------------|
| `partnerId` | string | Hardcoded | "kingdom-connects" |
| `businessSlug` | string | URL path | From `/business/{slug}.htm` or `/church/{slug}.htm` |
| `context` | enum | Page type | "homepage" \| "dashboard" \| "listing" |
| `email` | string | Firebase Auth | User's email as unique ID |
| `businessName` | string | KC database | Business display name |
| `businessLogoUrl` | string | KC database | Business logo URL |

---

## Embed Contexts (KC Locations)

### 1. Homepage (`context: "homepage"`)
```html
<div id="qrgear-widget" 
     data-token="JWT_TOKEN"
     data-context="homepage"></div>
<script src="https://qrgear.web.app/embed/qrgear-embed.js"></script>
```
- Shows general/featured products
- No business-specific content

### 2. Dashboard (`context: "dashboard"`)
```html
<div id="qrgear-widget" 
     data-token="JWT_TOKEN"
     data-context="dashboard"
     data-business-slug="joes-plumbing"></div>
<script src="https://qrgear.web.app/embed/qrgear-embed.js"></script>
```
- Shows products relevant to logged-in user's business
- Token contains user's email and businessSlug

### 3. Listing Page (`context: "listing"`)
```html
<!-- On /business/joes-plumbing.htm -->
<div id="qrgear-widget" 
     data-token="JWT_TOKEN"
     data-context="listing"
     data-business-slug="joes-plumbing"></div>
<script src="https://qrgear.web.app/embed/qrgear-embed.js"></script>
```
- Shows products for specific business/church
- QR codes auto-link to that business page

---

## JWT Token Structure

```javascript
{
  // Business Info (from KC)
  businessId: "kc-uuid-123",
  businessName: "Joe's Plumbing",
  businessSlug: "joes-plumbing",
  businessLogoUrl: "https://kc.org/logos/joes.png",
  
  // Destination URL (auto-generated)
  kcListingUrl: "https://kingdomconnects.org/business/joes-plumbing.htm",
  
  // User tracking
  ownerEmail: "joe@example.com",
  
  // Partner config
  partnerId: "kingdom-connects",
  context: "listing",  // "homepage" | "dashboard" | "listing"
  
  // Segment access
  allowedSegments: ["Religious", "Business", "Custom"]
}
```

---

## Segment Filtering

Add `data-segment` to filter products:

```html
<!-- Religious products only -->
<div id="qrgear-widget" 
     data-token="JWT_TOKEN"
     data-segment="Religious"></div>
```

KC's available segments (from partner_stores.availableSegments):
- `Religious`
- `Business`
- `Custom`

---

## URL Patterns

| Page Type | URL Pattern | Context |
|-----------|-------------|---------|
| Homepage | `/` | `homepage` |
| Business Dashboard | `/dashboard/business` | `dashboard` |
| Member Dashboard | `/dashboard/member` | `dashboard` |
| Business Listing | `/business/{slug}.htm` | `listing` |
| Church Listing | `/church/{slug}.htm` | `listing` |

---

## API Endpoints

### Get Widget Session
```
GET /api/widget/session?token=JWT&segment=Religious
```

### Get Partner Products (API-first option)
```
GET /api/partners/kingdom-connects/products?context=homepage
GET /api/partners/kingdom-connects/products?slug=joes-plumbing
```

---

## Token Generation (KC Server-Side)

KC generates tokens server-side when rendering pages:

```javascript
// KC server code
const token = jwt.sign({
  businessId: business.id,
  businessName: business.name,
  businessSlug: business.slug,
  businessLogoUrl: business.logo,
  kcListingUrl: `https://kingdomconnects.org/business/${business.slug}.htm`,
  ownerEmail: user.email,
  partnerId: 'kingdom-connects',
  context: 'listing',
  allowedSegments: ['Religious', 'Business', 'Custom']
}, SHARED_JWT_SECRET, { expiresIn: '1h' });
```

---

## Files Modified

| File | Changes |
|------|---------|
| `server/lib/widget-auth.ts` | Added context, partnerId, allowedSegments |
| `server/routes.ts` | CORS middleware, segment filtering |
| `client/public/embed/qrgear-embed.js` | data-segment, data-partner-id, data-context |
| `client/src/pages/widget.tsx` | segment state handling |

---

## Questions Answered (From KC)

1. **User ID format**: Email address (Firebase Auth)
2. **URL patterns**: `/business/{slug}.htm`, `/church/{slug}.htm`
3. **Embed locations**: homepage, dashboard, listing_page
4. **Segments**: Religious, Business, Custom

---

*Last updated: January 3, 2026*
*References: docs/AI-COMMS/KC/INTEGRATION-SPEC.md, INTEGRATION-RESPONSE.md*
