# Kingdom Connects - Utility Classes by Purpose
## Organized for Code Reuse Across Multiple Businesses

This catalog separates **THEME utilities** (business-specific branding) from **LAYOUT utilities** (reusable structure) to make it easy to build multiple businesses using the same layout framework with different themes.

---

# 🎨 THEME UTILITIES (Business-Specific)
*These change for each business based on branding colors, fonts, etc.*

## Colors & Branding

### Text Colors
- **`.gold`** - Brand primary color (#FFD700) → *Change to your business color*
- **`.gold-lg`** - Brand color + 1.1rem font
- **`.gold-underline`** - Brand color + underline
- **`.error-text`** - Error state (#f44336)
- **`.error-red`** - Red (#f66)
- **`.success-green`** - Success state (#6f6)
- **`.color-red`** - Red
- **`.color-ccc`** - Light gray (#ccc)

### Background Colors
- **`.bg-error`** - Error background (#ff4444)
- **`.border-orange`** - Accent border (#FFA500) → *Change to your accent color*

### Component Styling (Brand-Specific)
- **`.card-highlight`** - Brand-colored left border + tinted background
- **`.card-highlight-rounded`** - Lighter brand tint, rounded
- **`.card-highlight-margin`** - Brand highlight + 2rem margin
- **`.card-highlight-margin-md`** - Brand highlight + 1.5rem margin
- **`.card-gradient`** - Brand gradient background
- **`.card-gradient-strong`** - Stronger brand gradient
- **`.card-gradient-alt`** - Alternative brand gradient
- **`.pro-badge-gradient`** - Brand gradient badge
- **`.pricing-headline`** - Brand-colored pricing display

### Typography (Brand Font Choices)
- **`.font-bold`** - Bold (700) → *Matches your brand font weight*
- **`.font-semibold`** - Semi-bold (600) → *Matches your brand font weight*
- **`.italic`** - Italic text
- **`.line-height-relaxed`** - 1.7 line height → *Adjust to brand reading comfort*
- **`.line-height-normal`** - 1.6 line height

### Font Sizes (Brand Typography Scale)
- **`.text-sm`** - 0.85rem → *Adjust to match brand scale*
- **`.text-md`** - 0.9rem
- **`.text-base`** - 1rem
- **`.text-lg`** - 1.1rem
- **`.text-xl`** - 1.2rem
- **`.text-2xl`** - 1.3rem
- **`.text-3xl`** - 1.5rem
- **`.text-4xl`** - 1.8rem
- **`.text-5xl`** - 2rem
- **`.text-huge`** - 4rem
- **`.text-3xl-faded`** - 3rem + opacity

### Form Styling (Brand-Specific)
- **`.input-dark`** - Dark theme input → *Matches admin panel theme*
- **`.textarea-dark`** - Dark theme textarea
- **`.select-dark`** - Dark theme select
- **`.input-rounded`** - Rounded translucent → *Brand style choice*
- **`.textarea-rounded`** - Rounded translucent
- **`.select-rounded`** - Rounded translucent

### Special Theme Components
- **`.card-dark-margin`** - Dark background card → *Matches dark theme*
- **`.card-auth`** - Authentication card styling → *Theme-specific*
- **`.section-divider`** - Section border → *Brand border color*
- **`.section-divider-sm`** - Smaller section border

---

# 📐 LAYOUT UTILITIES (Reusable Across All Businesses)
*These stay the same regardless of branding - pure structure and spacing*

## Spacing System

### Margins (Structure, not style)
- **`.m-0`** - No margin
- **`.mt-0`** - No top margin
- **`.mb-0`** - No bottom margin
- **`.m-block`** - 1rem vertical margin
- **`.m-block-sm`** - 0.5rem vertical margin
- **`.m-block-lg`** - 1.5rem vertical margin
- **`.m-block-xl`** - 2rem vertical margin
- **`.mt-sm`** - 0.25rem top margin
- **`.mt-md`** - 0.5rem top margin
- **`.mr-sm`** - 0.5rem right margin
- **`.mr-md`** - 1rem right margin
- **`.ml-md`** - 1rem left margin
- **`.mx-auto`** - Auto horizontal margins (centering)
- **`.m-block-hidden`** - 1.5rem vertical margin + hidden

### Padding (Structure, not style)
- **`.p-0`** - No padding
- **`.p-sm`** - 0.5rem all sides
- **`.p-md`** - 1rem all sides
- **`.p-block-sm`** - 0.5rem vertical
- **`.p-block-md`** - 0.75rem vertical
- **`.p-block`** - 1rem vertical

## Display & Visibility

### Display Control
- **`.hidden`** - Display none
- **`.block`** - Display block
- **`.inline-block`** - Display inline-block

### Opacity (Universal)
- **`.opacity-50`** - 50% opacity
- **`.opacity-60`** - 60% opacity
- **`.opacity-70`** - 70% opacity
- **`.opacity-80`** - 80% opacity
- **`.opacity-90`** - 90% opacity

## Flexbox Layout

### Flex Containers
- **`.flex-between`** - Space-between, align-start
- **`.flex-between-center`** - Space-between, align-center
- **`.flex-gap`** - 1rem gap, wrap
- **`.flex-gap-center`** - 1rem gap, centered, wrap
- **`.flex-gap-sm`** - 0.5rem gap, wrap
- **`.flex-center`** - Center both axes
- **`.flex-align-center`** - Align center + 0.5rem gap
- **`.inline-flex-sm`** - Inline-flex, 0.25rem gap

### Flex Items
- **`.flex-1`** - Flex: 1 (grow)
- **`.flex-1-min`** - Flex: 1, min-width 150px

## Grid Layout

### Grid Containers
- **`.grid-auto`** - Auto grid, 1rem gap
- **`.grid-responsive`** - Auto-fit, min 200px, 1rem gap
- **`.grid-3-cols`** - 3 equal columns, 0.5rem gap
- **`.grid-auto-250`** - Auto-fit, min 250px, 1rem gap

### Gap Utilities
- **`.gap-sm`** - 0.5rem gap
- **`.gap-md`** - 1rem gap

## Text Alignment & Width

### Alignment
- **`.text-center`** - Center text

### Content Width (Readability)
- **`.max-w-500`** - Max 500px
- **`.max-w-700`** - Max 700px
- **`.max-w-800`** - Max 800px
- **`.mx-auto-content`** - Max 700px, centered
- **`.mx-auto-content-lg`** - Max 800px, centered, bottom margin
- **`.text-content-center`** - 1.1rem, 1.7 line-height, max 700px, centered
- **`.text-content-italic`** - Same + italic

## Component Layout Patterns

### Button Layout
- **`.button-row`** - Flex row, 1rem gap, wrap
- **`.btn-lg`** - Large button sizing (1.1rem, 1/2rem padding)
- **`.btn-xl`** - XL button sizing (1.2rem, 1/3rem padding)

### Badge Layout
- **`.badge`** - 0.5rem left margin (inline spacing)
- **`.badge-inline`** - Inline-block, 0.5/1rem padding
- **`.link-badge`** - Inline-flex badge with gap

### Message Layout
- **`.status-message`** - Centered, 1rem padding
- **`.status-message.empty`** - Same + opacity, larger padding

## Form Layout

### Form Structure
- **`.form-group`** - Field container with spacing
- **`.kc-field`** - Grid field wrapper
- **`.kc-form`** - Main form grid

### List Layout
- **`.list-unstyled`** - Remove bullets/padding
- **`.list-centered`** - Centered, max 500px
- **`.list-indent`** - Indented with line-height

## Interaction

### Cursor
- **`.cursor-pointer`** - Pointer cursor

---

# 🔄 HOW TO REUSE FOR NEW BUSINESSES

## Step 1: Copy LAYOUT utilities (📐 section)
These never change - they're pure structure. Copy the entire layout section to your new business CSS.

## Step 2: Recreate THEME utilities (🎨 section)
Replace brand colors, fonts, and styling to match your new business:

### Example for a Blue-Themed Business:
```css
/* Change from Kingdom Connects gold theme */
.gold { color: #FFD700; }           /* OLD */
.primary { color: #0066CC; }        /* NEW - your business color */

.card-highlight {                   /* OLD */
  border-left: 4px solid gold;
  background: rgba(255,215,0,0.1);
}
.card-highlight {                   /* NEW */
  border-left: 4px solid #0066CC;
  background: rgba(0,102,204,0.1);
}
```

### What to Customize:
1. **Colors** - Replace `.gold`, `.card-highlight`, gradients with your brand colors
2. **Typography** - Adjust font sizes to match your brand scale
3. **Component styling** - Update card styles, badges, pricing displays
4. **Form styles** - Match your UI design (dark, light, rounded, etc.)

### What to Keep:
1. **All spacing** (margins, padding, gaps)
2. **All layout** (flex, grid, display)
3. **All structure** (content width, alignment, button rows)

---

**Total THEME Utilities**: ~40 (business-specific)  
**Total LAYOUT Utilities**: ~40 (reusable forever)

**Last Updated**: November 2025
