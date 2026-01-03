# QR Gear Widget Integration - READY FOR KC

## Status: READY TO IMPLEMENT - January 3, 2026

---

## Summary

QR Gear has implemented the widget embedding system based on KC's segment mapping specification. The integration is now ready for testing.

---

## What QR Gear Has Done

### 1. Partner Store Created
- **Slug:** `kingdom-connects`
- **Allowed Origins:** `https://kingdomconnects.org`, `https://www.kingdomconnects.org`
- **Available Segments:** Religious, Business, Custom

### 2. Widget Auth Updated
- Added `segmentId` field to token schema (supports `KC-{TYPE}-{slug}` format)
- Added `placement` field: homepage, church, business, member
- Added entity IDs: churchId, businessId, memberId

### 3. CORS Security Fixed
- Exact origin matching (no prefix matching that could allow subdomain attacks)
- Origins validated against partner_stores.allowed_origins

### 4. Embed Script Updated
New data attributes supported:
- `data-placement` - homepage, church, business, member
- `data-church-id` - For church pages
- `data-business-id` - For business pages  
- `data-member-id` - For member pages

---

## For KC To Do

### 1. Share JWT Secret
KC's `generateQrGearToken` Cloud Function must use the same `WIDGET_JWT_SECRET` that QR Gear uses.

**Option A:** KC shares their secret with QR Gear admin
**Option B:** QR Gear admin shares the current secret with KC

The secret must match exactly on both sides for token verification to work.

### 2. Test Widget Embedding

**Homepage Test:**
```html
<div id="qrgear-widget" 
     data-token="{{TOKEN_FROM_CLOUD_FUNCTION}}"
     data-placement="homepage"></div>
<script src="https://qrgear.web.app/embed/qrgear-embed.js"></script>
```

**Business Page Test:**
```html
<div id="qrgear-widget" 
     data-token="{{TOKEN_FROM_CLOUD_FUNCTION}}"
     data-placement="business"
     data-business-id="joes-plumbing"></div>
<script src="https://qrgear.web.app/embed/qrgear-embed.js"></script>
```

### 3. Verify Token Contents

The token from `generateQrGearToken` should include:
```json
{
  "partnerId": "kingdom-connects",
  "placement": "business",
  "segmentId": "KC-BIZ-joes-plumbing",
  "businessId": "joes-plumbing",
  "businessName": "Joe's Plumbing",
  "businessSlug": "joes-plumbing",
  "kcListingUrl": "https://kingdomconnects.org/business/joes-plumbing.htm",
  "allowedSegments": ["Religious", "Business", "Custom"]
}
```

---

## API Endpoints

### Get Widget Session
```
GET https://qrgear.web.app/api/widget/session?token=JWT&segment=Religious
```

Returns products filtered by segment, plus QR code preview.

---

## Files Modified (QR Gear)

| File | Changes |
|------|---------|
| `server/lib/widget-auth.ts` | Added segmentId, placement, entity IDs |
| `server/routes.ts` | CORS exact matching, segment filtering |
| `client/public/embed/qrgear-embed.js` | placement + entity ID attributes |
| `client/src/pages/widget.tsx` | Segment state handling |

---

## Next Steps

1. **Coordinate JWT Secret** - Must match on both systems
2. **KC deploys Cloud Function** - `firebase deploy --only functions`
3. **Test on staging** - Before rolling out to production
4. **Go live** - Embed widgets on KC pages

---

## Questions?

If anything is unclear, add questions to `AI-COMMS/KC/QUESTIONS-OUTGOING.md` and re-share the zip.

---

*Last updated: January 3, 2026*
*Version: 3.2*
