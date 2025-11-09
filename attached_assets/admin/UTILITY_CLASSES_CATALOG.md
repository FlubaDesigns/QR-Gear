# Kingdom Connects - Utility Classes Catalog

This document catalogs all utility classes available in the Kingdom Connects CSS framework. These utilities are defined in `styles/overrides.css` and `styles/forms.css`.

---

## SPACING UTILITIES

### Margins
- **`.m-0`** - Remove all margin
- **`.mt-0`** - Remove top margin
- **`.mb-0`** - Remove bottom margin
- **`.m-block`** - Vertical margin: 1rem top & bottom
- **`.m-block-sm`** - Vertical margin: 0.5rem top & bottom
- **`.m-block-lg`** - Vertical margin: 1.5rem top & bottom
- **`.m-block-xl`** - Vertical margin: 2rem top & bottom
- **`.mt-sm`** - Top margin: 0.25rem
- **`.mt-md`** - Top margin: 0.5rem
- **`.mr-sm`** - Right margin: 0.5rem
- **`.mr-md`** - Right margin: 1rem
- **`.ml-md`** - Left margin: 1rem
- **`.mx-auto`** - Horizontal auto margins (center)
- **`.m-block-hidden`** - Vertical margin 1.5rem + display:none

### Padding
- **`.p-0`** - Remove all padding
- **`.p-sm`** - Padding: 0.5rem all sides
- **`.p-md`** - Padding: 1rem all sides
- **`.p-block-sm`** - Vertical padding: 0.5rem top & bottom
- **`.p-block-md`** - Vertical padding: 0.75rem top & bottom
- **`.p-block`** - Vertical padding: 1rem top & bottom

---

## TYPOGRAPHY UTILITIES

### Font Sizes
- **`.text-sm`** - 0.85rem
- **`.text-md`** - 0.9rem
- **`.text-base`** - 1rem
- **`.text-lg`** - 1.1rem
- **`.text-xl`** - 1.2rem
- **`.text-2xl`** - 1.3rem
- **`.text-3xl`** - 1.5rem
- **`.text-4xl`** - 1.8rem
- **`.text-5xl`** - 2rem
- **`.text-huge`** - 4rem
- **`.text-3xl-faded`** - 3rem + 60% opacity

### Font Weights
- **`.font-bold`** - Bold text (700)
- **`.font-semibold`** - Semi-bold text (600)

### Opacity
- **`.opacity-50`** - 50% opacity
- **`.opacity-60`** - 60% opacity
- **`.opacity-70`** - 70% opacity
- **`.opacity-80`** - 80% opacity
- **`.opacity-90`** - 90% opacity

### Text Styles
- **`.italic`** - Italic text
- **`.line-height-relaxed`** - Line height: 1.7
- **`.line-height-normal`** - Line height: 1.6

### Content Width
- **`.max-w-500`** - Max width: 500px
- **`.max-w-700`** - Max width: 700px
- **`.max-w-800`** - Max width: 800px
- **`.mx-auto-content`** - Max 700px, centered
- **`.mx-auto-content-lg`** - Max 800px, centered, margin-bottom: 1.5rem
- **`.text-content-center`** - 1.1rem, line-height 1.7, max 700px, centered
- **`.text-content-italic`** - Same as above + italic

---

## LAYOUT UTILITIES

### Alignment
- **`.text-center`** - Center text alignment

### Display
- **`.hidden`** - Display: none
- **`.block`** - Display: block
- **`.inline-block`** - Display: inline-block

### Flexbox
- **`.flex-between`** - Flex with space-between & align-start
- **`.flex-between-center`** - Flex with space-between & align-center
- **`.flex-gap`** - Flex with 1rem gap, wrap
- **`.flex-gap-center`** - Flex with 1rem gap, centered, wrap
- **`.flex-gap-sm`** - Flex with 0.5rem gap, wrap
- **`.flex-center`** - Flex with center alignment both axes
- **`.flex-align-center`** - Flex with center alignment + 0.5rem gap
- **`.flex-1`** - Flex: 1
- **`.flex-1-min`** - Flex: 1 with min-width: 150px
- **`.inline-flex-sm`** - Inline-flex, 0.25rem gap, 70% opacity, 0.85rem font

### Grid
- **`.grid-auto`** - Grid with 1rem gap
- **`.grid-responsive`** - Grid auto-fit, min 200px columns, 1rem gap
- **`.grid-3-cols`** - Grid 3 equal columns, 0.5rem gap
- **`.grid-auto-250`** - Grid auto-fit, min 250px columns, 1rem gap

### Gap
- **`.gap-sm`** - Gap: 0.5rem
- **`.gap-md`** - Gap: 1rem

### Cursor
- **`.cursor-pointer`** - Pointer cursor on hover

---

## COLOR UTILITIES

### Text Colors
- **`.gold`** - Gold color (#FFD700)
- **`.gold-lg`** - Gold color + 1.1rem font size
- **`.gold-underline`** - Gold color + underline
- **`.error-text`** - Error red (#f44336)
- **`.error-red`** - Red (#f66)
- **`.success-green`** - Green (#6f6)
- **`.color-red`** - Red
- **`.color-ccc`** - Light gray (#ccc)

### Background Colors
- **`.bg-error`** - Red background (#ff4444)
- **`.border-orange`** - Orange border (2px solid #FFA500)

---

## COMPONENT SHELLS

### Cards & Highlights
- **`.card-highlight`** - Gold left-border accent, gold background tint, 1rem padding
- **`.card-highlight-rounded`** - Lighter gold background, 8px border-radius, 1rem padding
- **`.card-highlight-margin`** - Same as card-highlight + 2rem vertical margin
- **`.card-highlight-margin-md`** - Same as card-highlight + 1.5rem vertical margin
- **`.card-gradient`** - Gold gradient background, 2px gold border, centered text
- **`.card-gradient-strong`** - Stronger gold gradient + 2px gold border
- **`.card-gradient-alt`** - Alternative gold gradient + gold border
- **`.card-dark-margin`** - Dark background, 8px radius, 2rem vertical margin
- **`.card-auth`** - Dark auth card: dark bg, 1.5rem padding, centered, max 500px

### Status & Messages
- **`.status-message`** - Centered, 1rem padding
- **`.status-message.empty`** - Same + 50% opacity, 2rem padding

### Pricing & CTAs
- **`.pricing-headline`** - Centered, 1.8rem, gold, bold, 1rem vertical margin

### Sections
- **`.section-divider`** - 0.75rem vertical padding, bottom border (#333)
- **`.section-divider-sm`** - 0.5rem vertical padding, bottom border (#333)

### Badges & Links
- **`.badge`** - 0.5rem left margin (for inline badges)
- **`.pro-badge-gradient`** - Gold gradient badge, inline-block, 0.25/0.5rem padding
- **`.link-badge`** - Inline-flex, 0.5rem gap, rounded, translucent bg, 0.9rem font
- **`.badge-inline`** - Inline-block, 0.5/1rem padding, 0.9rem font

### Buttons
- **`.button-row`** - Flex row with 1rem gap, wraps
- **`.btn-lg`** - Large button: 1.1rem font, 1/2rem padding
- **`.btn-xl`** - Extra large: 1.2rem font, 1/3rem padding

---

## FORM UTILITIES (styles/forms.css)

### Standard Inputs
- **`.kc-input`** - Standard text input with gold focus
- **`.kc-textarea`** - Standard textarea with gold focus
- **`.kc-select`** - Standard select with gold focus
- **`.kc-search-input`** - Search input with icon
- **`.kc-label`** - Form label styling
- **`.kc-help`** - Help text styling

### Alternative Input Styles
- **`.input-dark`** - Dark theme input (admin forms)
- **`.textarea-dark`** - Dark theme textarea (admin forms)
- **`.select-dark`** - Dark theme select (admin forms)
- **`.input-rounded`** - Rounded translucent input
- **`.textarea-rounded`** - Rounded translucent textarea
- **`.select-rounded`** - Rounded translucent select

### Form Groups
- **`.form-group`** - Form field container with gap and margin
- **`.kc-field`** - Field wrapper with grid layout
- **`.kc-form`** - Main form wrapper with grid

### List Styles
- **`.list-unstyled`** - Remove bullets and padding
- **`.list-centered`** - Centered list, max 500px
- **`.list-indent`** - Indented list with 1.7 line-height

---

## USAGE NOTES

1. **Margin System**: Outer containers use `.page-wrap` for page margins. Inner elements use utilities.
2. **Combine Classes**: Stack multiple utilities: `class="text-lg gold font-bold m-block"`
3. **Form Variants**: Use `.kc-*` for public forms, `.input-dark` for admin forms, `.input-rounded` for alternative styling
4. **Responsive**: Some utilities include responsive behavior (grid-auto, grid-responsive)
5. **Component Shells**: Pre-built combinations for common patterns (pricing, highlights, auth cards)

---

**Total Utility Classes**: 80+  
**Last Updated**: November 2025
