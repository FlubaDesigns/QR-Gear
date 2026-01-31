# KC Widget Integration Guide

## Overview
This guide explains how Kingdom Connects (KC) pages embed QR Gear widgets to display entity-scoped QR items.

## Widget URL
**Production**: `https://qrgear-c1ffd.web.app`

## Integration Flow

```
┌─────────────────────────────────────────────────────────────────┐
│  KC Page Render                                                 │
│  1. KC identifies entityType + entityId                         │
│  2. KC server calls POST /api/widget/token                      │
│  3. Receives JWT token                                          │
│  4. Injects iframe with token                                   │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  QR Gear Widget                                                 │
│  1. Widget loads with token                                     │
│  2. Calls GET /api/widget/session?token=JWT                     │
│  3. Displays entity's QR items                                  │
│  4. User can view/share items                                   │
└─────────────────────────────────────────────────────────────────┘
```

## Step 1: Add Container to Template

In the KC profile HTML template, add a placeholder:

```html
<div id="qrgear-widget-container"></div>
```

**Recommended placement**: Below hero/contact section, above reviews/events (engagement zone).

## Step 2: Request Widget Token (Server-Side)

On page render, call the token endpoint:

```javascript
const response = await fetch('https://qrgear-c1ffd.web.app/api/widget/token', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-api-key': process.env.KC_SERVICE_API_KEY  // or use Authorization header
  },
  body: JSON.stringify({
    entityType: 'business',  // 'business' | 'church' | 'member'
    entityId: 'acme-corp-123',
    placement: 'profile',
    mode: 'public'
  })
});

const { token, storeId, channelId } = await response.json();
```

### Request Body

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| entityType | string | Yes | 'business', 'church', or 'member' |
| entityId | string | Yes | KC entity identifier |
| placement | string | No | Where widget is shown (default: 'embed') |
| mode | string | No | 'public' or 'admin' (default: 'public') |

### Response

```json
{
  "token": "<JWT>",
  "storeId": "kingdom_connects",
  "channelId": "business_acme-corp-123",
  "expiresIn": 600
}
```

## Step 3: Inject iFrame

Render the iframe into the container:

```html
<iframe
  id="qrgear-widget"
  src="https://qrgear-c1ffd.web.app/widget?token=<JWT_HERE>"
  width="100%"
  height="400"
  frameborder="0"
  scrolling="no"
  style="border: none; overflow: hidden;"
></iframe>
```

### JavaScript Injection Example

```javascript
function injectQRGearWidget(token) {
  const container = document.getElementById('qrgear-widget-container');
  if (!container) return;

  const iframe = document.createElement('iframe');
  iframe.id = 'qrgear-widget';
  iframe.src = `https://qrgear-c1ffd.web.app/widget?token=${token}`;
  iframe.width = '100%';
  iframe.height = '400';
  iframe.frameBorder = '0';
  iframe.scrolling = 'no';
  iframe.style.border = 'none';
  iframe.style.overflow = 'hidden';

  container.appendChild(iframe);
}
```

## Pages to Implement

| Page | entityType | entityId Source |
|------|------------|-----------------|
| Business Profile | 'business' | business.id |
| Church Profile | 'church' | church.id |
| Member Profile | 'member' | member.id |

## Widget Behavior

- **Default**: Shows top 3 items in a grid
- **View all**: Toggle to show all items
- **Empty state**: Shows "No items yet" message
- **Actions**: Share and View buttons on each item
- **Caching**: 60-second client cache for performance

## Security

- JWT tokens expire in 10 minutes
- channelId is derived from verified token (not URL)
- Service API key required for token minting
- Key rotation supported via kid header

## Testing

### Seed Test Data (Admin Only)

```bash
curl -X POST https://qrgear-c1ffd.web.app/api/admin/channel-items/seed \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <ADMIN_TOKEN>" \
  -d '{"channelId": "business_test-123"}'
```

### Test Widget URL

After seeding, test by minting a token and opening:
```
https://qrgear-c1ffd.web.app/widget?token=<JWT>
```

## Environment Variables

**KC Side** (add to KC server):
- `QRGEAR_WIDGET_URL`: `https://qrgear-c1ffd.web.app`
- `KC_SERVICE_API_KEY`: Service key for token minting

**QR Gear Side** (already configured):
- `KC_SERVICE_API_KEY`: Same key for verification
- `WIDGET_JWT_KEYS`: JWT signing keys (JSON)
- `WIDGET_JWT_ACTIVE_KID`: Active key ID
