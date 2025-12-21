# QR Gear

## Overview

QR Gear is a custom promotional merchandise e-commerce platform that creates personalized apparel and products featuring QR codes. The platform integrates with Printify for print-on-demand fulfillment of USA-made products (hats, shirts, mugs, bags). Users can create QR codes containing either text content or images, customize their styling, and place them on various product types. The business model focuses on B2B sales to small businesses as leave-behind marketing tools, with integration planned for Kingdom Connects (a faith-based business directory platform).

## User Preferences

Preferred communication style: Simple, everyday language.
Documentation: Keep ADMIN_MANUAL.md updated as admin features evolve.
Accessibility: User has CIDP (limited hand mobility) - agent should be fully autonomous.

## System Architecture

### Frontend Architecture
- **Framework**: React with TypeScript, bundled with Vite
- **UI Components**: shadcn/ui component library with Radix UI primitives
- **Styling**: Tailwind CSS with custom theme configuration supporting dark/light modes
- **State Management**: TanStack React Query for server state
- **Forms**: React Hook Form with Zod validation
- **Payments**: Stripe React integration (@stripe/react-stripe-js)
- **Path Aliases**: `@/` maps to `client/src/`, `@shared/` maps to `shared/`

### Backend Architecture
- **Runtime**: Node.js with Express
- **Language**: TypeScript with ES modules
- **API Pattern**: RESTful endpoints under `/api/` prefix
- **Build**: esbuild for production bundling

### Database
- **Database**: PostgreSQL via Neon serverless
- **ORM**: Drizzle ORM with drizzle-kit for migrations
- **Schema Location**: `shared/schema.ts` contains all table definitions
- **Key Tables**:
  - `users`: Customer accounts
  - `products`: Printify products with pricing/markup controls
  - `productVariants`: Size/color combinations from Printify
  - `qrDesigns`: User-saved QR designs
  - `qrTemplates`: Admin-curated pre-designed backgrounds
  - `customGifts`: Fully custom user uploads with hosting
  - `hostingTiers`: 1yr/3yr/5yr/permanent hosting options
  - `hostingReminders`: Email reminder scheduling for expiration
  - `partnerStores`: Embeddable widget configurations
  - `partnerStoreProducts`: Per-partner product selections
  - `cartItems`, `orders`, `orderItems`: Shopping flow
  - `adminSettings`, `pricingRules`: Admin pricing controls

### Four QR Product Lines

**Line 1: Simple Text QR**
- Customer enters URL/text → QR generated → placed on product
- Optional: Text above QR (20 chars, +$2), text below QR (30 chars, +$2)
- Available on all Printify products (shirts, hats, bags, mugs)

**Line 2: Featured Collections (Pre-designed Templates)**
- Admin uploads curated backgrounds (religious, business, sports themes)
- Examples: "Ten Commandments on a Shirt", "30 Days of Verses Cup"
- Customer selects template → QR placed on background → printed on products
- Small/medium/large sizing options
- QR links to hosted image page (clean display, no expiration shown)
- Managed via Admin Panel → Templates tab

**Line 3: Fully Custom QR Gifts**
- Customer uploads own image, adds text overlay with font/color choices
- QR placed on composite → printed on products
- Hosting tiers: 1 year (included), 3 years, 5 years, permanent (upcharges)
- Email reminders: 30 days before, 7 days before, on expiration

**Line 4: QR Dynamics™ (Dave's Unique Innovation)**
- The "living QR" product - physical item with changeable digital content
- Customer buys product with QR linking to their personal control panel
- QR code is PERMANENT on product, but PAGE CONTENT is changeable anytime
- Customer can swap: images, videos, messages, links from their dashboard
- Perfect for: seasonal specials, event promotions, rotating content
- Subscription model: 1 year, 3 years, 5 years, permanent
- Creates recurring revenue stream
- Marketing pitch: "Your shirt becomes a digital billboard you control from your phone"

### Core Features
- **QR Code Generation**: Server-side QR code creation for text and image content
- **Product Customization**: QR placement options (front-chest, back, left-sleeve, etc.)
- **Shopping Cart**: User-associated cart with quantity management
- **Order Processing**: Full order lifecycle with order items tracking
- **Widget System**: Embeddable widget for Kingdom Connects and partners
- **Premium QR Text**: Optional text above (20 chars) and below (30 chars) QR code with $2 upcharge per field
- **Category System**: Firestore-based product categories with admin management panel
- **Pricing Strategy**: No upfront prices shown - customers see final price after customization

### Firestore Categories
Categories are stored in Firebase Firestore and managed via the admin panel at `/admin`.

**Firestore Collection**: `categories`
**Fields**:
- `name`: Category display name
- `slug`: URL-friendly identifier (auto-generated from name)
- `description`: Brief description
- `icon`: Lucide icon name (Church, Flag, Trophy, Briefcase, Music, Palette, Tag)
- `sortOrder`: Display order (ascending)
- `isActive`: Whether category is visible to users
- `createdAt`, `updatedAt`: Timestamps

**Default Categories** (seeded via admin panel):
- Religious, Political, Sports, Business, Entertainment, Custom

**Environment Variables for Firebase**:
- `VITE_FIREBASE_API_KEY`: Firebase API key
- `VITE_FIREBASE_PROJECT_ID`: Firebase project ID (e.g., qrgear-c1ffd)
- `VITE_FIREBASE_APP_ID`: Firebase app ID
- `VITE_FIREBASE_AUTH_DOMAIN`: (optional) Auth domain
- `VITE_FIREBASE_STORAGE_BUCKET`: (optional) Storage bucket

### Embeddable Widget Security

The widget system allows Kingdom Connects and other trusted partners to embed the QR Gear mini-store on their sites.

**Required Environment Variables:**
- `WIDGET_JWT_SECRET`: Secret key for signing widget JWT tokens
- `WIDGET_API_KEY`: API key required for token generation endpoint
- `ALLOWED_WIDGET_ORIGINS`: Comma-separated list of allowed embedding domains (e.g., "https://kingdomconnects.com,https://app.kingdomconnects.com")
- `VITE_ALLOWED_WIDGET_ORIGINS`: Same list for frontend postMessage validation

**Security Architecture:**
1. Token endpoint (`/api/widget/token`) requires `X-API-Key` header authentication
2. JWT tokens are pre-signed by partner backends, not client-side
3. Widget validates parent origin via postMessage with `VITE_ALLOWED_WIDGET_ORIGINS`
4. Embed script (`/embed/qrgear-embed.js`) validates message origins before processing

**Integration Steps for Partners:**
1. Obtain API key from QR Gear admin
2. Generate pre-signed tokens server-side using the `/api/widget/token` endpoint
3. Pass token to embed script via `data-token` attribute or `token` option
4. Configure callback handlers for `onOrder` events

### Design System
- **Typography**: Inter (body), Space Grotesk (headings) from Google Fonts
- **Layout**: Mobile-first responsive design with max-w-7xl containers
- **Components**: Card-based layouts with consistent border-radius and color tokens

## External Dependencies

### Third-Party Services
- **Printify API**: Print-on-demand fulfillment (CONNECTED - Shop ID: 19642701, Shop Name: QRGear)
- **Stripe**: Payment processing (checkout, subscriptions) - AWAITING API KEYS
- **Firebase/Firestore**: Secondary data store for user designs and real-time features (schema in FIREBASE_SCHEMA.md)
- **Neon Database**: Primary PostgreSQL hosting (serverless)

### Key NPM Packages
- `@neondatabase/serverless`: Database connectivity
- `drizzle-orm` / `drizzle-kit`: ORM and migrations
- `@stripe/stripe-js` / `@stripe/react-stripe-js`: Payment integration
- `qrcode`: QR code generation
- `jsonwebtoken`: Widget authentication tokens
- `@tanstack/react-query`: Data fetching and caching
- `zod`: Schema validation (shared between client and server)

## Production Readiness Review

### Last Updated: December 20, 2025

### What's Working Well
1. **Core Product Creation Flow**: All 4 product lines (Text QR, Templates, Custom Upload, Dynamic QR) functional
2. **Admin Panel**: Comprehensive with 6 tabs (Products, Pricing, Backgrounds, Templates, Tags, Partners)
3. **Printify Integration**: Connected and syncing products from USA manufacturers
4. **Authentication**: Replit Auth working with navbar integration
5. **Database**: PostgreSQL schema fully migrated with all tables
6. **Widget System**: Partner store infrastructure complete with embeddable widget support

### Critical Items Needed Before Production

#### HIGH PRIORITY - Must Fix
1. ~~**Checkout Success Page Missing**~~: DONE - `/checkout/success` with full order confirmation display

2. **Stripe API Keys**: Currently using test mode. Need live keys after LLC formation:
   - `STRIPE_SECRET_KEY` (backend)
   - `VITE_STRIPE_PUBLIC_KEY` (frontend)

3. ~~**No Email System**~~: DONE - Resend integration implemented:
   - Order confirmations
   - Shipping updates 
   - Hosting expiration reminders (30 day, 7 day, day-of)

4. ~~**Printify Order Submission**~~: DONE - Orders auto-submitted after payment via cron job

5. ~~**Image Hosting Cleanup**~~: DONE - Hourly cron job checks expiration and sends reminders

#### MEDIUM PRIORITY - Should Have
6. ~~**SEO Optimization**~~: DONE - SEO component with meta tags and Open Graph on all pages

7. ~~**Cart Persistence**~~: DONE - Guest cart with localStorage and merge on login at `/cart`

8. ~~**Product Variants**~~: DONE - Size selection added to creator (XS-3XL for apparel, 11oz/15oz for mugs)

9. ~~**Order History Enhancement**~~: DONE - Status tracking, item preview, reorder button

10. ~~**Mobile Optimization**~~: DONE - Responsive grids and tab layouts for creator page

#### LOW PRIORITY - Nice to Have
11. **Analytics**: Add tracking for:
    - Product views
    - Cart abandonment
    - Conversion funnel

12. **Bulk Ordering**: For B2B customers ordering 50+ items

13. **Saved Designs**: Let users save designs without adding to cart

14. **A/B Testing**: For pricing strategies

15. **Customer Reviews**: Product reviews and ratings system

16. **Coupon System**: Discount codes for promotions

### Security Checklist
- [x] Stripe webhook signature verification (via stripe-replit-sync)
- [x] Rate limiting on API endpoints (express-rate-limit)
- [x] Input sanitization for QR content (dangerous protocol/XSS blocking)
- [ ] CORS properly configured for widget origins
- [ ] Session expiration handling

### Performance Recommendations
1. Image optimization (lazy loading, WebP conversion)
2. API response caching for product listings
3. Database query optimization with indexes
4. CDN for static assets

### Testing Recommendations
1. End-to-end tests for checkout flow
2. QR code generation across all scenarios
3. Widget embedding on partner sites
4. Mobile responsive testing

## Cross-AI Communication

QR Gear uses a cross-AI communication protocol to coordinate with Kingdom Connects:
- `docs/AIQR/` - Files received FROM Kingdom Connects AI
- `docs/AIKC/` - Files to send TO Kingdom Connects AI
- `docs/AIKC-for-claude1.zip` - Zip file for Dave to transport to KC

### KC Integration Points
- Creator page accepts `?slug={business_slug}` URL param
- Pre-fills QR destination as `https://kingdomconnects.org/business/{slug}.htm`
- Shows visual indicator when KC business promo mode is active

## Recent Changes Log
- 2025-12-21: Set up cross-AI communication folders and protocol
- 2025-12-21: Added KC business slug parameter support in creator page
- 2025-12-21: Created AIKC-for-claude1.zip for KC transport
- 2025-12-20: Added Partner Stores admin tab with full CRUD
- 2025-12-20: Fixed IMAGE_HOSTING_UPCHARGE error in Creator page
- 2025-12-20: Database schema pushed with partner store tables
- 2025-12-20: Created checkout success page with order confirmation display
- 2025-12-20: Integrated Resend email system for order confirmations and hosting reminders
- 2025-12-20: Built Printify order submission with cron job automation
- 2025-12-20: Added hourly cron job for hosting expiration checks
- 2025-12-20: Created reusable SEO component with meta tags and Open Graph support
- 2025-12-20: Implemented guest cart with localStorage persistence and merge on login
- 2025-12-20: Added dedicated /cart page for both guests and authenticated users
- 2025-12-20: Added size selection to creator (XS-3XL for apparel, 11oz/15oz for mugs)
- 2025-12-20: Enhanced order history with item preview and reorder functionality
- 2025-12-20: Improved mobile responsiveness for creator page tabs and grids
- 2025-12-20: Added express-rate-limit for API endpoint protection
- 2025-12-20: Enhanced QR content validation with XSS/dangerous protocol blocking