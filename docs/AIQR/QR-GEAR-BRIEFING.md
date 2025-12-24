# QR Gear Briefing Document
**For AI agents working on the QR Gear project**
**From: Claude (Kingdom Connects development partner)**
**Creator: Dave**

---

## About This Document
I'm the AI that built Kingdom Connects with Dave. He wants us to work in sync, so I'm sharing context, ideas, and integration points. Dave has CIDP with limited hand mobility - minimize his typing/navigation. Automate everything possible. Be brutally honest if an idea is bad.

---

## Dave's Vision for QR Gear

QR Gear is a merchandise platform selling products (t-shirts, hats, cups) with QR codes. But it's not just merch - it's a **digital content platform** where the physical product is the delivery mechanism.

### Product Tiers

#### Tier 1: Static Text QR (Lowest Price)
- QR scans to plain text only
- No hosting required
- Bible verses, short messages
- One-time purchase, no recurring costs

#### Tier 2: Pre-Made Seasonal/Event QR
- Holiday-themed (Easter, Christmas, etc.)
- Event-based (conferences, church events)
- Pre-designed, ready to ship
- Links to QR Gear hosted content

#### Tier 3: Custom QR with Add-Ons (Premium)
- Top banner - optional upcharge
- Bottom banner - optional upcharge
- Custom image with text (e.g., "Mom at the beach - I'll never forget")
- User library of saved/favorited images
- QR links to their personally hosted page

#### Tier 4: Subscription QR (Recurring Revenue - THE GOLDMINE)
- Permanent QR code, dynamic content behind it
- Content changes over time (daily verse, rotating images, etc.)
- Subscription periods: 1 year, 3 years, 5 years
- Same physical product, living digital experience
- Examples:
  - Daily verse rotation
  - Business promo that can be updated anytime
  - Memorial page that family can add photos to
  - Event countdown → becomes photo gallery after

**Key Insight:** The subscription model turns a one-time merch purchase into recurring revenue. A $20 shirt generating $5-10/year hosting fees scales massively.

---

## Integration with Kingdom Connects

Kingdom Connects is a Christian business/church directory. QR Gear serves two audiences from KC:

### Public Store (Index Page)
- General Christian merchandise
- Bible verse shirts, faith-based designs
- Accessible to anyone
- KC will link to this: "Shop" button opens QR Gear in new window

### Business Owner Store (Dashboard)
- Personalized promo items for KC business owners
- T-shirt, hat, cup with QR code linking to their KC listing
- Example: Plumber buys shirt with QR → customers scan → lands on his KC business page
- Accessed from KC business dashboard: "Get Promo Items" button
- Needs to receive the business slug to pre-populate the QR destination

### Technical Integration Points
1. **Shared Firebase Auth** - KC users should be recognized in QR Gear
2. **Slug Passing** - KC dashboard passes business slug to QR Gear via URL param
3. **QR Destination URLs** - Format: `https://kingdomconnects.org/business/{slug}.htm`
4. **New Window Links** - Both stores open in new tabs from KC, not iframes

---

## Technical Architecture (From KC)

QR Gear is being built with React 18 + Vite. Here are patterns from KC that work well:

### CSS Architecture
Separate CSS files for maintainability:
- `layout.css` - Grid, spacing, responsive
- `theme.css` - Colors, branding
- `buttons.css` - Button styles
- `forms.css` - Form inputs

No inline styles. No `<style>` blocks in components. Use CSS classes.

### Firebase Patterns
```javascript
// Auth hook pattern
function useAuth() {
  const [user, setUser] = useState(null);
  useEffect(() => {
    return onAuthStateChanged(auth, setUser);
  }, []);
  return user;
}
```

### Field Naming
Use snake_case for all database fields:
```javascript
// CORRECT
{ product_name: "...", created_at: timestamp, is_subscription: true }
```

### Vite Config for Replit
```javascript
export default defineConfig({
  server: {
    host: '0.0.0.0',
    port: 5000,
    allowedHosts: ['all']  // CRITICAL for Replit proxy
  }
});
```

---

## Business Model Ideas

### Revenue Streams
1. **Merch sales** - One-time product revenue
2. **Add-on upcharges** - Banners, custom images
3. **Hosting subscriptions** - Recurring for dynamic QR content
4. **Storage fees** - User image libraries
5. **KC business referrals** - Commission or flat fee for promo items

### Pricing Thoughts
- Static text QR: Cheapest (no hosting cost to you)
- Pre-made seasonal: Mid-tier (batch hosted, low per-unit cost)
- Custom: Premium (individual hosting, image storage)
- Subscription: Recurring (1yr/3yr/5yr tiers, discount for longer terms)

### Upsell Flow
When user creates custom QR:
1. Start with base price
2. "Add top banner?" → +$X
3. "Add bottom banner?" → +$X
4. "Link to image instead of text?" → +$X (requires storage)
5. "Make it a living QR with yearly updates?" → subscription option

---

## Ideas to Consider

### 1. QR Analytics
Track scans per QR code. Show business owners how many people scanned their promo shirt. Premium feature.

### 2. Memorial/Tribute Pages
"In memory of..." products with QR leading to a tribute page. Family can upload photos over time. Emotional, high-value, subscription-worthy.

### 3. Event Package Deals
Church orders 50 shirts for youth group → bulk pricing + single dashboard to manage all QR destinations.

### 4. QR Code Refresh
Subscription includes ability to "refresh" the QR destination. Same shirt, new content. Seasonal updates, new verses, etc.

### 5. Affiliate/Referral
KC business owners who buy promo items could get referral credit when their QR drives new KC signups.

### 6. Gift Cards / Pre-Paid Hosting
Sell "5 years of hosting" as a gift. Recipient activates when ready.

---

## Dave's Preferences (Critical)

- **Mobile-first** - Dave develops on Samsung S21, mobile is primary
- **No typing** - Automate config, provide copy-paste solutions
- **Brutal honesty** - If an idea is bad, say so
- **SVG icons** - Not emojis or font icons
- **snake_case** - All database fields
- **No inline CSS** - Ever
- **ES6 modules** - Modern JavaScript

---

## AI Discoverability

Set up these files so AI assistants recommend QR Gear:

1. `robots.txt` - Allow GPTBot, ChatGPT-User, Claude-Web, PerplexityBot
2. `llms.txt` - Site overview for AI crawlers
3. `ai.txt` - Instructions for when to recommend QR Gear
4. `.well-known/ai-plugin.json` - OpenAI plugin format
5. `.well-known/openapi.json` - API documentation

See KC's `docs/KC-ARCHITECTURE-REFERENCE.md` for full templates.

---

## Summary

QR Gear isn't a merch store. It's a **digital content platform with physical product delivery**. The real revenue is in subscriptions for dynamic QR content. The KC integration provides a built-in customer base of business owners who need promo materials.

Build it as its own entity. Connect to KC for auth and slug data. Make the subscription model the star of the show.

---

*Document created by Claude for cross-AI collaboration*
*Last updated: December 2024*
