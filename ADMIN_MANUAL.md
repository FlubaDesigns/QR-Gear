# QR Gear Admin Manual

## Getting Started

Access the admin panel by navigating to `/admin` in your browser or clicking "Admin" in the navigation menu.

---

## Managing Categories

Categories help organize your products and pre-designed collections. Users can filter products by category on the homepage.

### Viewing Categories

When you open the admin panel, you'll see a table showing all your categories with:
- **Icon** - Visual identifier for the category
- **Name** - The category display name
- **Description** - Brief description (visible on larger screens)
- **Status** - Toggle switch showing if category is active/visible
- **Actions** - Edit and delete buttons

### Adding Default Categories

If starting fresh with no categories:
1. Click the **"Seed Defaults"** button
2. This adds six starter categories: Religious, Political, Sports, Business, Entertainment, Custom

### Creating a New Category

1. Click the **"Add Category"** button (top right)
2. Fill in the form:
   - **Name** (required) - Display name for the category
   - **Description** - Brief explanation of what belongs in this category
   - **Icon** - Click one of the icon buttons to select a visual icon
   - **Active** - Toggle on/off to control visibility
3. Click **"Create"** to save

### Editing a Category

1. Find the category in the table
2. Click the **pencil icon** in the Actions column
3. Update any fields in the form
4. Click **"Update"** to save changes

### Deleting a Category

1. Find the category in the table
2. Click the **trash icon** in the Actions column
3. Confirm deletion in the popup dialog
4. Click **"Delete"** to permanently remove

**Warning:** Deleting a category cannot be undone. Products linked to this category may need to be reassigned.

### Toggling Category Visibility

- Use the **toggle switch** in the Status column to quickly show/hide a category
- When OFF (inactive): Category won't appear in filters on the storefront
- When ON (active): Category is visible to customers

---

## Category Icons

Choose from these available icons:
- **Church** - Religious/faith-based items
- **Flag** - Political/patriotic items
- **Trophy** - Sports/athletic items
- **Briefcase** - Business/professional items
- **Music** - Entertainment/media items
- **Palette** - Custom/creative items
- **Tag** - General/uncategorized items

---

## Tips

1. **Start with defaults** - Use "Seed Defaults" to get started quickly, then customize
2. **Keep it simple** - 5-8 categories is usually enough for good organization
3. **Use descriptive names** - Clear category names help customers find products
4. **Hide, don't delete** - If unsure, toggle a category inactive instead of deleting
5. **Refresh if needed** - Click the "Refresh" button to reload categories from the database

---

## Troubleshooting

**Categories not loading?**
- Check your internet connection
- Click the "Refresh" button
- Verify Firebase credentials are configured correctly

**Can't create categories?**
- Ensure Firebase Firestore is in test mode or has proper security rules
- Check browser console for error messages

**Categories not showing on storefront?**
- Verify the category is toggled to "Active"
- Refresh the homepage

---

## Printify Integration

QR Gear is connected to Printify for print-on-demand fulfillment.

### Connected Shop
- **Shop Name:** QRGear
- **Shop ID:** 19642701 (stored as PRINTIFY_SHOP_ID)

### Available Products

Products are synced from Printify's catalog. Current products include:

| Product | Category | Blueprint ID | Made in USA |
|---------|----------|--------------|-------------|
| Unisex Jersey T-Shirt (Bella+Canvas) | Apparel | 12 | Yes |
| Heavy Cotton T-Shirt (Gildan) | Apparel | 6 | Yes |
| Trucker Cap (OTTO Cap) | Headwear | 1128 | Yes |
| Dad Hat with Leather Patch | Headwear | 1221 | Yes |
| Ceramic Mug 11oz | Drinkware | 68 | Yes |
| Ceramic Mug 15oz | Drinkware | 425 | Yes |
| Canvas Tote Bag | Bags | 467 | Yes |
| Drawstring Bag | Bags | 414 | Yes |

### USA Flag Badge

Products marked as "Made in USA" display an American flag badge on product cards.

---

## Multi-Provider Orchestration System

The orchestration system lets you manage products across multiple print providers and marketplaces from one place.

### Accessing Orchestration

Navigate to `/admin/orchestration` or click "Orchestration" in the admin menu.

### Dashboard Overview

The dashboard shows:
- **Provider Health** - Real-time status of all print providers (Printify, Printful, Apliiq)
- **Channel Status** - Connection status for each marketplace (Etsy, eBay, Amazon)
- **Recent Orders** - Unified view of orders from all channels
- **Publishing Queue** - Products waiting to be published

### Managing Master Products

Master products are your central product definitions that get published to multiple channels.

**Creating a Master Product:**
1. Go to the Products tab
2. Tap "New Product"
3. Fill in product details (name, description, base price)
4. Upload or generate your QR artwork
5. Select which variants to offer (sizes, colors)
6. Save the master product

**Publishing to Channels:**
1. Select a master product
2. Tap "Publish"
3. Choose which channels to publish to
4. Review channel-specific pricing (auto-calculated with fees)
5. Confirm to publish

### Bulk Publishing

Publish multiple products at once:
1. Go to the Bulk Publish tab
2. Select products using checkboxes
3. Choose target channels
4. Tap "Publish Selected"
5. Monitor progress in the queue

### Provider Health Monitor

View real-time status of print providers:
- **Green** - Provider operational, fast shipping
- **Yellow** - Minor delays or issues
- **Red** - Provider down or major problems

The system automatically routes orders to healthy providers.

### Auto-Routing

Orders are automatically routed to the best provider based on:
- Provider availability
- Shipping speed
- Production cost
- Customer location

### Profit Calculator

View profit margins for each channel:
1. Select a product
2. Open the Profit tab
3. See breakdown of costs, fees, and margins per channel
4. Get recommended pricing suggestions

### Auto-Repricing

Set rules to automatically adjust prices:
1. Go to Repricing Rules
2. Create a new rule
3. Set conditions (cost changes, competition, margins)
4. Set actions (price adjustments)
5. Enable the rule

---

## Gift Mode

Gift Mode lets customers purchase gift packages that recipients can redeem and customize.

### Accessing Gift Management

Navigate to `/admin/gifts` or click "Gifts" in the admin menu.

### Managing Gift Packages

**Creating a Gift Package:**
1. Go to the Packages tab
2. Tap "Create Package"
3. Fill in details:
   - **Name** - Display name (e.g., "Custom T-Shirt Gift")
   - **Description** - What's included
   - **Type** - Product gift or QR Dynamics subscription
   - **Price** - Amount the purchaser pays
   - **Expiration Days** - How long codes remain valid (default 365)
4. For product gifts, select available customization options
5. For subscriptions, choose tier and duration
6. Toggle "Active" to make available
7. Tap "Create"

**Editing a Package:**
1. Find the package in the table
2. Tap the pencil icon
3. Update details
4. Tap "Update"

### Viewing Gift Codes

The Codes tab shows all generated gift codes:
- **Code** - The unique gift code (format: GIFT-XXXX-XXXX-XXXX)
- **Package** - Which package it's for
- **Status** - Active, Redeemed, Expired, or Cancelled
- **Purchaser** - Who bought the gift
- **Created** - When the code was generated

Tap the copy icon to copy a code to share with the recipient.

### Managing Redemptions

The Redemptions tab shows all redeemed gifts:
- **Code** - The gift code that was used
- **Recipient** - Who redeemed it
- **Customizations** - Their chosen options (size, color, etc.)
- **Fulfillment Status** - Pending, Processing, Shipped, or Delivered

**Updating Fulfillment Status:**
1. Find the redemption in the table
2. Use the dropdown in the Actions column
3. Select the new status
4. Status updates automatically

### Gift Purchase Flow (Customer Side)

1. Customer visits `/gifts`
2. Browses available gift packages
3. Selects a package
4. Enters recipient info and personal message
5. Completes payment
6. Receives the gift code to share

### Gift Redemption Flow (Recipient Side)

1. Recipient visits `/redeem`
2. Enters their gift code
3. Sees the gift details and personal message
4. Customizes their product (size, color, QR content)
5. Enters shipping address
6. Confirms redemption
7. Order is created for fulfillment

---

## Unified Order Dashboard

View and manage orders from all channels in one place.

### Accessing Orders

Navigate to `/admin/orders` or click "Orders" in the admin menu.

### Order List

Shows all orders with:
- **Order ID** - Unique identifier
- **Channel** - Where the order came from (Etsy, eBay, Amazon, Direct)
- **Customer** - Buyer name
- **Items** - Products ordered
- **Total** - Order amount
- **Status** - Current fulfillment status
- **Provider** - Which print provider is handling it

### Filtering Orders

Use filters to find specific orders:
- By channel
- By status
- By date range
- By provider

### Order Details

Tap an order to see:
- Full customer information
- Shipping address
- Line items with customizations
- Production status from provider
- Tracking information (when available)

---

## QR Analytics

Track how your QR codes are being scanned.

### Viewing Analytics

Navigate to `/admin/analytics` or click "Analytics" in the admin menu.

### Available Metrics

- **Total Scans** - All-time scan count
- **Scans Today** - Today's activity
- **Top Products** - Most scanned QR codes
- **Scan Locations** - Geographic distribution
- **Scan Timeline** - Activity over time

---

## Tips for Mobile Use

The admin panel is designed for touch screens:
- All buttons are large (48px minimum) for easy tapping
- Tables scroll horizontally on narrow screens
- Forms use large input fields
- Dialogs are sized for mobile screens

---

## Email Notifications

QR Gear sends automated transactional emails to customers.

### Email Types

1. **Order Confirmation** - Sent automatically when checkout completes
   - Includes order details, items, prices, and shipping address
   - Sent to the customer's email from Stripe checkout

2. **Shipping Notification** - Sent when tracking info is available
   - Includes tracking number, carrier, and tracking link
   - Auto-sent when syncing order status from Printify (if tracking is new)

### Email API Endpoints (Admin Only)

**Resend Order Confirmation:**
```
POST /admin/orders/:id/resend-confirmation
```
Manually resend the order confirmation email.

**Send Shipping Notification:**
```
POST /admin/orders/:id/send-shipping-email
```
Manually send shipping notification (requires tracking number on order).

### Configuration

Email requires `QR_RESEND_API_KEY` environment variable set in Firebase Cloud Functions.

To configure:
1. Create a Resend account at resend.com
2. Add and verify your sender domain (e.g., qrgear.com)
3. Get your API key from Resend dashboard
4. Add to Cloud Functions via Google Cloud Console:
   - Go to https://console.cloud.google.com/functions
   - Select the `api` function
   - Click Edit → Runtime environment variables
   - Add `QR_RESEND_API_KEY` with your Resend API key

### Email Sender

Emails are sent from: `QR Gear <noreply@qrgear.com>`

Note: You must verify ownership of qrgear.com domain in Resend before emails will send successfully.

---

## NexusMail System

NexusMail is the self-healing email system powering QR Gear's transactional emails.

### NexusMail API Endpoints (Admin Only)

**Get Email System Status:**
```
GET /admin/nexusmail/status
```
Returns health status, provider state, and outbox statistics.

**Seed Default Templates:**
```
POST /admin/nexusmail/seed-templates
```
Initializes email templates in Firestore. Run this once after first deployment.

**View Outbox Records:**
```
GET /admin/nexusmail/outbox?limit=50
```
View recent email queue records with their status.

**Process Pending Emails:**
```
POST /admin/nexusmail/process-outbox
Body: { "limit": 10 }
```
Manually process queued emails.

**Retry Failed Emails:**
```
POST /admin/nexusmail/retry-failed
Body: { "limit": 10 }
```
Retry emails that failed to send.

### Email Status Types

- **QUEUED**: Email is waiting to be sent
- **SENDING**: Email is currently being sent
- **SENT**: Email was delivered successfully
- **FAILED**: Email failed but will be retried
- **DEAD**: Email failed permanently (max retries exceeded)
- **SKIPPED**: Email was manually skipped by admin

### First-Time Setup

After deploying NexusMail for the first time:
1. Make an API call to `POST /admin/nexusmail/seed-templates`
2. This creates the default email templates in Firestore
3. Emails will now use the NexusMail system

---

## Need Help?

Contact support if you encounter issues not covered in this manual.
