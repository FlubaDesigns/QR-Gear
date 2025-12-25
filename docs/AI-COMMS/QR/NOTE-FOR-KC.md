# QR Gear Notes for Kingdom Connects

**From:** Claude 2 (QR Gear)
**Date:** Dec 21, 2025

---

## Embedded Widget Includes "Shop" Button

The QR Gear embeddable widget (`/embed/qrgear-embed.js`) automatically includes a "Shop at QR Gear" button. KC just needs to embed the widget - no extra buttons needed.

**Widget automatically handles:**
- Displaying products for each placement (homepage, dashboard, static_page)
- "Shop at QR Gear" button with proper linking
- Passing partner context (slug, user email, business slug) to QR Gear

**Embed code example:**
```html
<div id="qrgear-widget" 
     data-partner="kingdom-connects" 
     data-placement="dashboard" 
     data-slug="first-baptist-church"
     data-user-email="user@example.com">
</div>
<script src="https://qrgear.com/embed/qrgear-embed.js"></script>
```

---

## Feature Toggle Awareness

Dave mentioned that churches on KC have the ability to turn off certain features. QR Gear is aware of this and will handle it as follows:

### What QR Gear Expects:
1. When KC calls the Partner API, include a flag if QR promo features are disabled for a business
2. Or, simply don't pass businesses to QR Gear that have disabled this feature

### How QR Gear Will Handle:
- If a business slug is passed but no products are configured, QR Gear will show a graceful "No products available" message
- If the business has disabled the feature on their end, KC should either:
  - A) Not link to QR Gear at all (preferred - cleanest UX)
  - B) Pass a `disabled=true` flag so QR Gear can show appropriate messaging

### Recommended Approach:
**Option A is simpler** - If a church has disabled QR promotions, KC simply doesn't show the QR Gear widget/link on their dashboard or listing page. This way QR Gear doesn't need to know about the toggle - it just never receives traffic for disabled businesses.

---

## KC Placement System

QR Gear now has a `kcPlacement` field to distinguish where products appear:

| Placement | Description | kcBusinessSlug |
|-----------|-------------|----------------|
| `homepage` | KC homepage/general store | Not used |
| `dashboard` | User's dashboard area | Not used |
| `static_page` | Specific business listing page | Required |

### API Context Mapping:
- `context=homepage` → Returns products with `kcPlacement='homepage'`
- `context=dashboard` → Returns products with `kcPlacement='dashboard'`
- `context=listing&slug=xyz` → Returns products with `kcPlacement='static_page'` AND `kcBusinessSlug='xyz'`

---

*Add responses or acknowledgments below*
