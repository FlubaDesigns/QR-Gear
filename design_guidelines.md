# Q*RGear.com Design Guidelines

## Design Approach: Reference-Based E-Commerce
zZe
**Primary References:** Shopify (clean product displays), Custom.ink (customization workflow), Printful (print-on-demand aesthetic), Linear (modern dashboard)

**Core Principle:** Professional e-commerce experience with intuitive product customization tools, emphasizing American manufacturing and seamless QR code integration.

---

## Typography System

**Font Stack:**
- **Primary:** Inter (Google Fonts) - Clean, modern sans-serif for UI and body text
- **Accent:** Space Grotesk (Google Fonts) - Bold, geometric for headings and CTAs

**Hierarchy:**
- Hero Headline: Space Grotesk, 4xl-6xl, font-bold
- Section Headings: Space Grotesk, 2xl-3xl, font-semibold
- Subheadings: Inter, lg-xl, font-medium
- Body Text: Inter, base, font-normal
- Labels/UI: Inter, sm-base, font-medium
- Fine Print: Inter, xs-sm, font-normal

---

## Layout System

**Spacing Primitives:** Tailwind units of 2, 4, 6, 8, 12, 16, 24
- Micro spacing (gaps, padding): 2, 4
- Component spacing: 6, 8
- Section spacing: 12, 16, 24

**Grid Structure:**
- Container: max-w-7xl with px-4 md:px-6 lg:px-8
- Product grids: grid-cols-1 md:grid-cols-2 lg:grid-cols-3
- Customization interface: Two-column split (lg:grid-cols-2) - configuration left, live preview right

---

## Core Components

### Navigation
- Sticky header with logo left, navigation center, account/cart right
- Transparent on hero, solid background on scroll
- Mobile: Hamburger menu with slide-in drawer
- Include: Shop, Custom Creator, Gallery, Account, Cart (with item count badge)

### Product Cards
- Clean card with product image, rounded-lg border
- Product name, starting price, "Made in USA" flag badge when applicable
- Hover: Subtle lift effect (shadow increase)
- CTA: "Customize" button, full-width within card

### Customization Interface (Critical Component)
**Left Panel - Configuration:**
- Tabbed sections: Message/Image → Product → Placement → Style → Review
- QR Code input: Large textarea for text OR image upload/selection
- QR Code style controls: Color picker for QR code itself, logo upload option
- Product selector: Image thumbnails in grid, American flag overlay for USA-made
- Placement selector: Visual diagram of garment with clickable regions
- Size/Color dropdowns with visual swatches

**Right Panel - Live Preview:**
- Sticky preview showing product mockup with QR code positioned
- Real-time QR code generation preview
- Zoom controls for detail view
- "Save Design" and "Add to Cart" CTAs at bottom

### Dashboard (User Account)
- Sidebar navigation: Saved Designs, Order History, Account Settings
- Saved designs: Card grid with thumbnails, edit/reorder/delete actions
- Order history: Table view with order number, date, status, reorder button

### QR Code Gallery Section
- Pre-designed QR codes (Ten Commandments, Bill of Rights, etc.)
- Masonry grid layout showcasing themed collections
- Hover reveals: "Customize This Design" overlay
- Filter by category: Patriotic, Religious, Inspirational, Custom

### Forms & Inputs
- Rounded input fields (rounded-lg) with focus ring
- Labels above inputs, helper text below
- Error states with red accent and icon
- Checkbox/radio with custom styling matching brand
- File upload: Drag-drop zone with preview thumbnail

---

## Marketing Pages

### Homepage
**Hero Section:** (h-screen)
- Full-width background: High-quality lifestyle image of person wearing custom QR code t-shirt in outdoor setting
- Centered content with blurred-background buttons
- Headline: "Your Message. Their Discovery." (Space Grotesk, 6xl, font-bold)
- Subheading explaining concept
- CTA: "Create Your Design" (primary) + "Shop Gallery" (secondary, blurred background)

**How It Works:** (3-column grid on desktop)
1. Choose Your Message (icon: message bubble)
2. Customize Your Product (icon: t-shirt)
3. We Print & Ship (icon: package)

**Featured Products:** (grid-cols-3)
- Product cards showing popular QR code designs
- "Made in USA" badges prominent

**American-Made Emphasis Section:**
- Split layout: Image of American factory left, content right
- Heading: "Proudly Supporting American Manufacturing"
- List of USA-made product categories with flag icons

**Pre-Designed Collection Preview:**
- Horizontal scrolling carousel of themed QR codes
- Categories: Patriotic, Faith-Based, Humorous, Contact Info

**Social Proof:**
- Customer photos grid (masonry layout)
- Star ratings and testimonials
- "Join 10,000+ satisfied customers" stat

**Footer:**
- Four-column layout: About, Shop, Support, Connect
- Newsletter signup: "Get QR code inspiration weekly"
- Social media icons, payment badges, American flag graphic
- "Powered by Printify" badge

### Product Customization Page
- Full-height layout with split interface (described above)
- Breadcrumb navigation at top
- Sticky "Add to Cart" footer bar on mobile

---

## Animations

**Minimal Motion:**
- Hover: Subtle scale (1.02) on product cards
- Transitions: 200-300ms ease for most interactions
- QR code preview: Fade-in when generated (300ms)
- Cart add: Brief success checkmark animation

---

## Images

**Hero Image:**
- Lifestyle shot: Person wearing QR code apparel in authentic setting (outdoor, candid)
- High energy, natural lighting, diverse representation
- QR code clearly visible on product

**Product Mockups:**
- Clean white/neutral background for product catalog
- Realistic mockups with QR codes positioned correctly
- Multiple angles for customization preview

**Section Images:**
- American factory/manufacturing for Made in USA section
- Customer lifestyle photos showing QR codes in use
- Close-up of phone scanning QR code

**Gallery Thumbnails:**
- Square crops of QR code designs
- High contrast for easy visibility
- Preview of what message/image displays when scanned

---

## Special Considerations

**American Flag Badge:**
- Small, consistent badge (w-6 h-4) overlaying product thumbnails
- Position: Top-right corner of product images
- Tooltip on hover: "Made in America"

**QR Code Display:**
- Always show QR code at readable size (minimum 200x200px)
- High contrast for scannability
- Test pattern visible in customizer preview

**Manufacturer Dropdown:**
- Flag icon inline with manufacturer name
- Sort: American manufacturers first, then alphabetically
- Clear visual distinction (flag + "USA" label)

**Printify Integration UI:**
- Order confirmation shows "Fulfilled by Printify" badge
- Tracking integration displays seamlessly
- Batch order interface for admin (table view with checkboxes)

This design creates a professional, trustworthy e-commerce experience while highlighting the unique QR code customization and American manufacturing values central to QRGear's brand.