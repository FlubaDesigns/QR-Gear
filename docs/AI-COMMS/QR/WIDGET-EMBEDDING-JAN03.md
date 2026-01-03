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

## Embed Placements (KC Locations)

### 1. Homepage (`placement: "homepage"`)
```html
<div id="qrgear-widget" 
     data-token="JWT_TOKEN"
     data-placement="homepage"></div>
<script src="https://qrgear.web.app/embed/qrgear-embed.js"></script>
```
- Shows general/featured products
- No entity-specific content

### 2. Church Listing (`placement: "church"`)
```html
<div id="qrgear-widget" 
     data-token="JWT_TOKEN"
     data-placement="church"
     data-church-id="faith-community-church"></div>
<script src="https://qrgear.web.app/embed/qrgear-embed.js"></script>
```
- Shows products for specific church
- QR codes auto-link to that church page

### 3. Business Listing (`placement: "business"`)
```html
<div id="qrgear-widget" 
     data-token="JWT_TOKEN"
     data-placement="business"
     data-business-id="joes-plumbing"></div>
<script src="https://qrgear.web.app/embed/qrgear-embed.js"></script>
```
- Shows products for specific business
- QR codes auto-link to that business page

### 4. Member Dashboard (`placement: "member"`)
```html
<div id="qrgear-widget" 
     data-token="JWT_TOKEN"
     data-placement="member"
     data-member-id="user@email.com"></div>
<script src="https://qrgear.web.app/embed/qrgear-embed.js"></script>
```
- Shows products relevant to logged-in member
- Token contains user's email and memberId

---

## JWT Token Structure

```javascript
{
  // Entity Info (from KC) - use appropriate IDs based on placement
  businessId: "joes-plumbing",      // For business placement
  businessName: "Joe's Plumbing",
  businessSlug: "joes-plumbing",
  businessLogoUrl: "https://kc.org/logos/joes.png",
  
  churchId: "faith-community",      // For church placement
  churchName: "Faith Community Church",
  churchSlug: "faith-community",
  
  memberId: "user@email.com",       // For member placement
  memberEmail: "user@email.com",
  
  // Destination URL (auto-generated)
  kcListingUrl: "https://kingdomconnects.org/business/joes-plumbing.htm",
  
  // User tracking
  ownerEmail: "joe@example.com",
  
  // Partner config
  partnerId: "kingdom-connects",
  placement: "business",  // "homepage" | "church" | "business" | "member"
  
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

| Page Type | URL Pattern | Placement | Entity ID Attribute |
|-----------|-------------|-----------|---------------------|
| Homepage | `/` | `homepage` | (none) |
| Church Listing | `/church/{slug}.htm` | `church` | `data-church-id` |
| Business Listing | `/business/{slug}.htm` | `business` | `data-business-id` |
| Member Dashboard | `/dashboard/member` | `member` | `data-member-id` |

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
