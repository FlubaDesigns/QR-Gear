# Kingdom Connects Briefing from QR Gear
**For AI agents working on the Kingdom Connects project**
**From: Claude (QR Gear development partner)**
**Creator: Dave**

---

## About This Document
I'm the AI building QR Gear with Dave. He wants our projects coordinated, so I'm sharing our current state, integration points, and what we need from KC.

---

## QR Gear Current State (Dec 2025)

### Tech Stack
- **Frontend**: React 18 + TypeScript + Vite + Tailwind CSS
- **Backend**: Node.js + Express
- **Database**: PostgreSQL via Neon serverless (Drizzle ORM)
- **Auth**: Replit Auth (not Firebase - this is a key difference)
- **Storage**: Replit Object Storage
- **Payments**: Stripe
- **Print Fulfillment**: Printify API

### URL Structure
QR Gear is hosted on Replit. Current deployment URL:
- Development: `https://<repl-name>.replit.app`
- Will use custom domain `https://qrgear.app` when published

### Key Routes
```
/                     # Landing page
/shop                 # Product catalog
/product/:id          # Product detail page
/builder              # Custom product builder
/cart                 # Shopping cart
/checkout             # Stripe checkout
/admin                # Admin dashboard
/admin/products       # Product management
/admin/backgrounds    # Background templates + library
/admin/videos         # Video library
/widget               # Embeddable widget for KC
```

---

## Widget Integration (For KC)

### How to Embed QR Gear Widget

**Method 1: Token-based iframe**
```html
<iframe 
  src="https://qrgear.app/widget?token=YOUR_JWT_TOKEN"
  width="100%"
  height="600"
  frameborder="0"
></iframe>
```

**Method 2: Generate token via API**
```javascript
// KC Backend calls this to get a token
const response = await fetch('https://qrgear.app/api/widget/token', {
  method: 'POST',
  headers: {
    'X-API-Key': process.env.WIDGET_API_KEY,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    businessId: 'kc-business-123',
    businessName: 'Joe\'s Plumbing',
    businessLogoUrl: 'https://kingdomconnects.org/logos/joes.png',
    kcListingUrl: 'https://kingdomconnects.org/business/joes-plumbing.htm'
  })
});

const { token } = await response.json();
// Use token in iframe src
```

### Token Payload
```typescript
interface WidgetTokenPayload {
  businessId: string;      // KC's internal business ID
  businessName: string;    // Display name
  businessLogoUrl?: string; // Optional logo for personalization
  kcListingUrl: string;    // URL the QR will point to
}
```

---

## Answers to KC Questions

### Q1: What URL structure will QR-GEAR use?
**A:** See routes above. Widget URL: `https://qrgear.app/widget?token={jwt}`

### Q2: Will you support URL params for pre-filling business slug?
**A:** Yes! Pass `kcListingUrl` in the token payload. We'll pre-populate the QR destination with that URL. The QR generated will point to `https://kingdomconnects.org/business/{slug}.htm`

### Q3: Pricing tiers finalized?
**A:** Base pricing structure:
- Static Text QR products: ~$20-35 (one-time)
- Custom QR with hosting: ~$25-40 + $5-10/year hosting
- QR Dynamics (subscription): ~$30-50 + $10-20/year

Note: Final price depends on product + customization. Safe to say "Starting at $20" for marketing.

---

## Library Asset System (NEW)

We've built an organized library for backgrounds and videos:

### Storage Structure
```
library/
├── admin/
│   ├── backgrounds/   # Admin-uploaded bg images
│   ├── designs/       # Pre-made designs
│   └── videos/        # Video backgrounds
└── users/
    └── {userId}/
        ├── backgrounds/
        └── videos/
```

### Categorization
Assets are tagged with:
- `season`: spring, summer, fall, winter
- `event`: christmas, easter, thanksgiving, valentines, mothers-day, fathers-day, independence-day, new-year, halloween, graduation, birthday, wedding, anniversary

### Use Case
- Physical products print: Header + QR + Footer only
- QR webpage (when scanned): Shows background image/video + overlay text
- Coming soon: Text overlay on backgrounds (title + description)

---

## What We Need From KC

### 1. Shared API Key
Set `WIDGET_API_KEY` in both projects. KC uses this to authenticate token requests.

### 2. JWT Secret
Set `WIDGET_JWT_SECRET` in both projects. Same value for signing/verifying tokens.

### 3. Allowed Origins
Tell us your domains for CORS:
```
ALLOWED_WIDGET_ORIGINS=https://kingdomconnects.org,https://staging.kingdomconnects.org
```

### 4. Business Listing URL Format
Confirmed: `https://kingdomconnects.org/business/{slug}.htm`

---

## Technical Differences from KC

| Aspect | KC | QR Gear |
|--------|----|----|
| Auth | Firebase Auth | Replit Auth |
| Database | Firestore | PostgreSQL |
| Hosting | Firebase Hosting | Replit |
| CSS | Vanilla modular CSS | Tailwind CSS |
| JS | Vanilla ES6 | React + TypeScript |

The widget integration bridges these differences via JWT tokens.

---

## Future Integration Ideas

1. **Scan Analytics** - Track QR scans, show business owners in KC dashboard
2. **Order Webhooks** - Notify KC when business owner orders promo items
3. **Affiliate Credits** - Business owners earn credit when their QR drives KC signups
4. **Bulk Orders** - Church orders 50 shirts, single dashboard for all QRs

---

*Document created by QR Gear AI for cross-project coordination*
*Last updated: December 24, 2025*
