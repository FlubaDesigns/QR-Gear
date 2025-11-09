# QR Gear - Complete Product Specification

**Last Updated:** November 8, 2025  
**Status:** Planning / Pre-Development  
**Related Project:** Kingdom Connects (integration partner)

---

## Executive Summary

QR Gear is a custom promotional merchandise platform using QR code technology to create personalized apparel and products. The business model focuses on B2B sales to small businesses (especially Christian businesses via Kingdom Connects) and faith-based organizations, with USA-made products fulfilled through Printify.

**Core Value Proposition:**
- Businesses order branded promotional items (hats, shirts, mugs, bags) to give customers as memorable marketing pieces
- Each item features a custom QR code linking to business info, personal messages, or hosted content
- Two product types: offline text-only QR codes and online image/page QR codes

---

## Business Model

### Primary Revenue Streams

1. **B2B Promotional Merchandise**
   - Businesses buy bulk orders (shirts, hats, mugs, bags) with custom QR codes
   - Use case: Leave-behind marketing tools after completing jobs
   - Example: Plumber gives branded mug after $2K bathroom remodel; QR code links to their Kingdom Connects listing for easy rebooking/reviews

2. **Kingdom Connects Integration**
   - "Mission Partner" tier supporters receive free merch gifts
   - All Pro businesses can order promotional items through dashboard
   - Co-branding: Business logo + Kingdom Connects logo + QR Gear logo

3. **Consumer Custom Products**
   - Individuals order personalized items with custom messages, Bible verses, quotes
   - Faith-based content templates (Ten Commandments, Battle Hymn, Constitution, etc.)

### Fulfillment Partner

**Printify API Integration**
- Print-on-demand fulfillment (zero inventory)
- USA-made products ONLY (at least initially)
- Direct shipping to customer
- Quality control and returns handled by Printify

---

## Product Line

### Available Products
- T-shirts (various styles/colors)
- Hats/Baseball caps
- Mugs/Cups
- Hoodies
- Gym bags/Book bags
- Stickers (3x3 vinyl)
- (Expandable based on Printify catalog)

### QR Code Placement Options (Already Coded)
- **Chest:** Large image or small pocket area
- **Back:** Large image
- **Left Sleeve:** Large or small
- **Right Sleeve:** Large or small

---

## QR Code Technology: Two Product Types

### Type 1: Text-Only QR Codes (Offline)

**How It Works:**
- Customer enters ANY text (up to QR code capacity limit ~4,000 characters)
- Text is encoded DIRECTLY into the QR code image
- Scanning the code displays plain text—**no internet connection required**
- Works anywhere, anytime (airplane, wilderness, no WiFi/data needed)

**Use Cases:**
- Bible verses (John 3:16, Psalm 23, etc.)
- Personal messages ("I love Mary", "Eat at Joe's")
- Historical documents (Constitution, Declaration of Independence)
- Business taglines/slogans
- Contact information
- Inspirational quotes

**Technical Advantage:**
- Zero hosting costs
-永久有效 (永远不会断链)
- Privacy (no tracking, no server logs)
- Universal compatibility

---

### Type 2: Image/Page QR Codes (Online)

**How It Works:**
- QR code links to hosted content (web page or image file)
- Requires internet connection to load content
- Can be updated server-side without reprinting merch

**Two Subcategories:**

#### A. Shared Template Content
- Pre-designed content available to all customers
- Examples:
  - Ten Commandments scroll image
  - Battle Hymn of the Republic lyrics
  - Constitution text with historical styling
  - Popular Bible verses with decorative formatting
- Multiple customers buying "Ten Commandments" product all get same hosted image
- Cost-effective (single hosting cost serves many customers)

#### B. Custom Hosted Content
- Unique page/image per customer
- Business-specific landing pages
- Custom artwork/designs
- Kingdom Connects business listing integration (auto-generated QR pointing to their KC profile)

**Technical Requirements:**
- Simple hosting infrastructure
- Image storage (Firebase Storage or CDN)
- Static HTML pages for text content
- Optional: Short URL service for cleaner QR codes

---

## Kingdom Connects Integration

### Business Dashboard Integration

**Location:** business-admin/dashboard (existing KC project)

**Features:**
1. **"Order Promotional Merch" Button**
   - Links to QR Gear ordering interface
   - Auto-populates business name, logo, KC listing URL

2. **Auto-Generated QR Codes**
   - QR code automatically generated pointing to their KC business listing
   - Pre-configured for easy reordering

3. **Co-Branding Options**
   - Business logo (primary)
   - Kingdom Connects logo (small)
   - QR Gear logo (small)
   - QR code placement options

### Mission Partner Gifts

**Trigger Conditions (choose one):**
- 3 months of paid Mission Partner tier ($14.99/month or $149.99/year)
- $25+ one-time donation
- Churches who onboard 5+ member businesses

**Gift Options:**
- Free t-shirt, hat, or sticker
- Custom QR code linking to their KC listing OR thank-you page
- Design options:
  - "Kingdom Supporter"
  - "Building the Kingdom, one business at a time"
  - "I support Kingdom Connects — scan to see why"

**Firestore Tracking:**
```
has_received_supporter_gift: boolean
supporter_gift_type: "shirt" | "hat" | "sticker"
supporter_gift_fulfillment_date: timestamp
supporter_gift_size: string (if applicable)
```

---

## Technical Architecture

### Frontend (QR Gear Website)

**Product Customization Interface:**
- Product selection (shirt, hat, mug, etc.)
- QR code type selection (text-only vs hosted content)
- Text input (for Type 1) or content upload (for Type 2)
- Placement selection (chest, back, sleeve)
- Size/color selection
- Live mockup preview

**Design Tools Already Built:**
- Placement engine (chest/back/sleeves with large/small options)
- QR code image generation
- Product mockups (t-shirt line already created)

**Product Display & Filtering:**
- USA-made indicator: 🇺🇸 flag icon next to products manufactured in USA
- Potential dropdown filter to show "USA-made only" products
- Visual differentiation to promote American manufacturing
- (Decision pending on implementation approach)

### Backend Requirements

**QR Code Generation:**
- Library: `qrcode` (Python) or `qrcodejs` (JavaScript)
- Text encoding for Type 1
- Short URL generation for Type 2

**Content Hosting (Type 2):**
- Firebase Storage for images
- Firebase Hosting for HTML pages
- URL shortener (optional but recommended)

**Order Management:**
- Printify API integration
- Order tracking
- Customer notification system
- Admin fulfillment dashboard

**Database (Firestore suggested):**
```
orders:
  - order_id
  - customer_info
  - product_type
  - qr_code_type: "text" | "hosted"
  - qr_code_content
  - placement_option
  - size, color, quantity
  - printify_order_id
  - status: "pending" | "submitted" | "fulfilled" | "shipped"
  - created_date, fulfilled_date

templates:
  - template_id
  - name: "Ten Commandments", "Battle Hymn", etc.
  - content_url
  - preview_image
  - category: "faith" | "patriotic" | "personal"
```

### Printify API Integration

**Key Endpoints:**
- `GET /v1/catalog/blueprints.json` - Available products
- `POST /v1/shops/{shop_id}/products.json` - Create product
- `POST /v1/shops/{shop_id}/orders.json` - Submit order
- `GET /v1/shops/{shop_id}/orders/{order_id}.json` - Track order

**Requirements:**
- Printify account and API key
- Shop ID configuration
- Print provider selection (USA-only filter)
- Webhook for order status updates

---

## Pricing Strategy (TBD)

**Considerations:**
- Printify base cost per item
- QR Gear profit margin
- Volume discounts for bulk orders
- Kingdom Connects commission (if applicable)

**Suggested Tiers:**
- Single item orders (higher price, consumer-focused)
- Bulk business orders (volume discounts, 25/50/100+ units)
- Mission Partner gifts (free, cost absorbed by KC revenue)

---

## Marketing & Go-to-Market

### Target Markets

1. **Christian Businesses (via Kingdom Connects)**
   - Primary market
   - Built-in distribution channel
   - Promotional leave-behinds after service calls

2. **Churches & Ministries**
   - Fundraising merch (QR codes linking to donation pages)
   - Event merchandise (conference shirts with schedule QR codes)
   - Outreach tools (evangelism shirts with Gospel QR codes)

3. **Faith-Based Consumers**
   - Personal expression (Bible verse shirts)
   - Gifts (custom message mugs)
   - Patriotic/faith hybrid products

### Unique Selling Points

- **Offline functionality** (text QR codes work without internet)
- **USA-made only** (patriotic appeal, quality assurance)
- **Faith-focused** (Ten Commandments, Bible verses, Christian community)
- **Kingdom Connects ecosystem** (cross-promotion, integrated ordering)

---

## Phase 1 MVP Features (Suggested)

### Must-Have for Launch:
- [ ] Product customization interface (shirt/hat/mug selection)
- [ ] Text-only QR code generation
- [ ] Basic placement options (chest/back)
- [ ] Printify API integration (order submission)
- [ ] Simple checkout with Stripe
- [ ] Order tracking dashboard

### Nice-to-Have (Phase 2):
- [ ] Hosted content QR codes (Type 2)
- [ ] Template library (Ten Commandments, etc.)
- [ ] Kingdom Connects dashboard integration
- [ ] Mission Partner gift fulfillment automation
- [ ] Bulk order discounts
- [ ] Advanced mockup previews

---

## Open Questions & Decisions Needed

1. **Pricing:** What's the markup structure? How much per item type?
2. **Minimum Order Quantities:** Single items allowed, or bulk only?
3. **Design Assistance:** Will QR Gear offer design services, or customer-provided artwork only?
4. **Kingdom Connects Commission:** If KC refers business orders, what's the revenue split?
5. **Mission Partner Gift Budget:** How many free gifts per month can be sustained?
6. **Returns/Exchanges:** What's the policy? (Printify has their own, but what's QR Gear's stance?)
7. **International Shipping:** USA-only for now, or expand to Canada/UK/global?

---

## Next Steps

1. **Set up Printify account** and get API key
2. **Design MVP wireframes** for product customization flow
3. **Build QR code generation engine** (text-only first)
4. **Create product mockup generator** (leverage existing t-shirt mockups)
5. **Integrate Stripe** for payments
6. **Connect Printify API** for order fulfillment
7. **Test end-to-end flow** with sample orders
8. **Coordinate Kingdom Connects integration** (dashboard button, auto-QR generation)

---

## Notes & Ideas

- **QR Code Capacity:** Standard QR codes hold ~4,000 alphanumeric characters. For longer content (full Constitution), consider Type 2 hosted content instead.
- **Design Consistency:** QR Gear branding should complement Kingdom Connects aesthetic (gold metallic accents, faith-forward messaging).
- **Cross-Promotion:** Every QR Gear product could include small Kingdom Connects logo/URL to drive directory traffic.
- **Affiliate Model:** Sales agents from KC could also sell QR Gear products for additional commission.
- **Global Scale:** While USA-made initially, QR Gear concept works globally—consider international print partners for future expansion.

---

**End of Specification Document**

*This document will be updated as QR Gear development progresses. All strategic decisions and technical implementations should reference this spec for alignment with original vision.*
