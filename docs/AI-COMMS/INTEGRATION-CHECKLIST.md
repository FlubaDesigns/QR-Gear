# QR Gear + Kingdom Connects Integration Checklist

## Status: Ready for Integration

---

## Environment Variables Required

### QR Gear Side (Already Has Structure)
```bash
WIDGET_JWT_SECRET=<shared-secret>      # Generate: openssl rand -hex 32
WIDGET_API_KEY=<api-key>               # Generate: openssl rand -hex 24
ALLOWED_WIDGET_ORIGINS=https://kingdomconnects.org,https://93878a2f-7782-4a2b-8056-5310a965e985-00-2148o27kozh9u.janeway.replit.dev
```

### Kingdom Connects Side
```bash
WIDGET_JWT_SECRET=<same-shared-secret>  # Must match QR Gear
QR_GEAR_WIDGET_URL=https://qrgear.replit.app
```

---

## QR Gear Endpoints (Ready)

### 1. Widget Session
```
GET /widget?token=<jwt>
```
- Validates JWT token
- Returns widget HTML with business context
- Pre-fills QR destination to KC listing URL

### 2. Widget Token Generation (API)
```
POST /api/widget/token
Headers: X-API-Key: <WIDGET_API_KEY>
Body: {
  businessId: string,
  businessName: string,
  businessSlug?: string,
  kcListingUrl: string,
  businessLogoUrl?: string,
  ownerEmail?: string
}
Response: { token: string, expiresIn: 3600 }
```

---

## Token Payload Structure

```typescript
interface WidgetTokenPayload {
  businessId: string;      // KC business ID
  businessName: string;    // Business display name
  businessSlug?: string;   // KC URL slug
  businessLogoUrl?: string; // Logo URL (optional)
  kcListingUrl: string;    // Full KC listing URL
  ownerEmail?: string;     // Business owner email
  iat?: number;            // Issued at (auto)
  exp?: number;            // Expires (auto, 1 hour)
}
```

---

## KC Integration Steps

### 1. Token Generation (KC Backend)
```javascript
// POST /api/qr-widget-token
const jwt = require('jsonwebtoken');
const secret = process.env.WIDGET_JWT_SECRET;

function generateWidgetToken(business, user) {
  return jwt.sign({
    businessId: business.id,
    businessName: business.business_name,
    businessSlug: business.slug,
    kcListingUrl: `https://kingdomconnects.org/business/${business.slug}.htm`,
    businessLogoUrl: business.photos?.[0] || null,
    ownerEmail: user.email
  }, secret, { expiresIn: '1h' });
}
```

### 2. Button on Dashboard (KC Frontend)
```html
<button onclick="openQRGearWidget()" class="btn btn-gold">
  Order Promo Items
</button>

<div id="qrGearModal" class="modal">
  <div class="modal-content">
    <button onclick="closeQRGearModal()" class="close-btn">X</button>
    <iframe id="qrGearFrame" style="width:100%;height:80vh;border:none;"></iframe>
  </div>
</div>

<script>
async function openQRGearWidget() {
  const response = await fetch('/api/qr-widget-token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ businessId: currentBusiness.id })
  });
  const { token } = await response.json();
  
  document.getElementById('qrGearFrame').src = 
    `https://qrgear.replit.app/widget?token=${token}`;
  document.getElementById('qrGearModal').classList.add('active');
}

function closeQRGearModal() {
  document.getElementById('qrGearModal').classList.remove('active');
  document.getElementById('qrGearFrame').src = '';
}
</script>
```

---

## Testing Steps

1. **Dave sets secrets in both projects:**
   - QR Gear: `WIDGET_JWT_SECRET`, `WIDGET_API_KEY`, `ALLOWED_WIDGET_ORIGINS`
   - KC: `WIDGET_JWT_SECRET`

2. **Test token generation:**
   ```bash
   curl -X POST https://qrgear.replit.app/api/widget/token \
     -H "Content-Type: application/json" \
     -H "X-API-Key: <WIDGET_API_KEY>" \
     -d '{"businessId":"test","businessName":"Test Biz","kcListingUrl":"https://kingdomconnects.org/business/test.htm"}'
   ```

3. **Test widget load:**
   - Open `https://qrgear.replit.app/widget?token=<returned-token>`
   - Verify business name displays
   - Verify QR destination is pre-filled

---

## Future Enhancements

1. **Order Webhook** - QR Gear notifies KC when order placed
2. **Analytics Sync** - QR scan data shared with KC
3. **Annual Perk** - Discounted QR products for KC Gold members

---

*Last Updated: December 25, 2025*
