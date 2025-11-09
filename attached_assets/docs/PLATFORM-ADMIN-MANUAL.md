# Kingdom Connects - Platform Admin Manual

**Version 1.0** | **November 2025** | **For Platform Administrators**

**⚠️ CONFIDENTIAL - ADMIN USE ONLY**

---

## 📘 Table of Contents

1. [Admin Dashboard Overview](#chapter-1-admin-dashboard-overview)
2. [User Management](#chapter-2-user-management)
3. [Church Management](#chapter-3-church-management)
4. [Business Management](#chapter-4-business-management)
5. [Category Management](#chapter-5-category-management)
6. [Review Moderation](#chapter-6-review-moderation)
7. [Payment Management](#chapter-7-payment-management)
8. [Sales & Commissions](#chapter-8-sales--commissions)
9. [Email Campaign System](#chapter-9-email-campaign-system)
10. [Content Management](#chapter-10-content-management)
11. [Analytics & Reporting](#chapter-11-analytics--reporting)
12. [Settings & Configuration](#chapter-12-settings--configuration)
13. [Security & Access Control](#chapter-13-security--access-control)
14. [Troubleshooting & Support](#chapter-14-troubleshooting--support)
15. [Maintenance & Updates](#chapter-15-maintenance--updates)

---

## Chapter 1: Admin Dashboard Overview

### Accessing the Admin Dashboard

**URL:** `kingdomconnects.com/admin/index.html`

**Login Requirements:**
- Must have `role: 'admin'` in Firestore users collection
- Firebase Authentication required
- Automatic redirect to homepage if not admin

**First-Time Setup:**
1. Create Firebase account
2. Log in to Kingdom Connects
3. Use Firebase Console to manually set your role to 'admin'
4. Log out and log back in
5. Navigate to /admin/index.html

---

### Dashboard Homepage

**admin/index.html**

**Summary Cards:**

**1. Total Users**
- Count of all registered accounts
- Breakdown by role (user, business-admin, church-admin, sales, admin)
- Growth rate (week-over-week)

**2. Total Businesses**
- Active listings count
- Free vs Pro breakdown
- Pending approvals count

**3. Total Churches**
- Active church profiles
- Pending approvals
- Average businesses per church

**4. Total Revenue (MRR)**
- Monthly Recurring Revenue from Pro subscriptions
- Week-over-week change
- Projected annual revenue

**5. Pending Tasks**
- Business approvals needed
- Church approvals needed
- Category suggestions awaiting review
- Flagged reviews
- Support tickets (future)

---

### Navigation Menu

**Left Sidebar:**
- **Dashboard** - Homepage
- **Users** - User management
- **Businesses** - Business listings
- **Churches** - Church profiles
- **Reviews** - Review moderation (coming soon)
- **Payments** - Transaction history (coming soon)
- **Email Campaigns** - Campaign management ✅
- **Analytics** - Platform metrics
- **Factoids** - Homepage content
- **Activity Log** - System activity
- **Settings** - Platform configuration

**Header:**
- Kingdom Connects logo (click to return to dashboard)
- Settings (gear icon)
- Logout

---

## Chapter 2: User Management

### Viewing All Users

**admin/users.html**

**User List Table:**
- Name
- Email
- Role (admin, business-admin, church-admin, sales, user)
- Account Status (active, suspended, banned)
- Created Date
- Last Login
- Actions (Edit, View Profile, Reset Password)

**Filtering:**
- By Role: Dropdown to filter by specific role
- By Status: Active, Suspended, Banned
- Search: By name or email
- Date Range: Created within X days

**Sorting:**
- By Name (A-Z, Z-A)
- By Created Date (Newest, Oldest)
- By Last Login (Most Recent, Least Recent)

**Bulk Actions:**
- Select multiple users
- Bulk role assignment
- Bulk suspend/activate
- Bulk export to CSV

---

### Assigning Roles

**How to change a user's role:**

1. Navigate to admin/users.html
2. Find the user in the list
3. Click **Edit** next to their name
4. Find "Role" dropdown
5. Select new role:
   - `user` - Regular user (default)
   - `business-admin` - Business owner
   - `church-admin` - Church administrator
   - `sales` - Sales agent
   - `admin` - Platform administrator
6. Click **Save Changes**
7. User must log out and log back in for changes to take effect

**Role Change Notifications:**
- User receives email notification of role change
- Email includes what they can now do
- Link to appropriate manual (Business Owner, Church Admin, etc.)

---

### Editing User Accounts

**Editable Fields:**
- Name
- Phone Number
- Role
- Account Status (active, suspended, banned)
- Email Verified Status (manual override)
- Admin Notes (internal, user can't see)

**Protected Fields (Cannot Edit):**
- Email (Firebase Auth controls this)
- Created Date
- Last Login
- Firebase UID

**When to edit accounts:**
- User requests role upgrade (business-admin, church-admin)
- User reports incorrect name
- Suspend account for policy violations
- Add admin notes for future reference

---

### Resetting Passwords

**Two methods:**

**1. User Self-Service** (Preferred):
- Direct user to /forgot-password.html
- They enter email
- Firebase sends reset link
- User sets new password
- No admin intervention needed

**2. Admin Manual Reset** (Emergency Only):
- Firebase Console → Authentication → Users
- Find user by email
- Click **⋮** (three dots) → **Reset Password**
- User receives email with reset link
- Use only if user can't access their email

**Security Note:**
- Admins cannot see user passwords (Firebase Auth encrypts them)
- Admins cannot set passwords directly
- Always use Firebase's password reset flow

---

### Deleting Users (Rare)

**⚠️ WARNING: Permanent Action**

**When to delete:**
- User explicitly requests account deletion (GDPR right to be forgotten)
- Spam/fake account
- Fraudulent activity
- Legal requirement

**What gets deleted:**
- User account and authentication
- Personal data (name, email, phone)
- Login history

**What is NOT deleted:**
- Business listings (ownership transfers to admin or marked "Owner Deleted")
- Reviews written by user (anonymized: "Former User")
- Payment records (required for accounting/tax)
- Activity logs (audit trail)

**Deletion Process:**
1. admin/users.html → Find user
2. Click **Delete User** (red button)
3. Confirm deletion (popup warning)
4. Firestore Function handles:
   - Delete user document
   - Anonymize reviews
   - Transfer business ownership
   - Delete Firebase Auth account
5. Send confirmation email to requester (if GDPR request)

---

### Handling User Complaints

**Common Complaint Types:**

**1. "I can't log in"**
- **Solution**: Verify email is correct, check if email is verified
- **Action**: Send password reset link, or manually verify email if needed

**2. "I didn't receive verification email"**
- **Solution**: Check spam folder first
- **Action**: Manually verify email in Firebase Auth

**3. "My role is wrong, I can't access my dashboard"**
- **Solution**: Check their role in Firestore
- **Action**: Assign correct role (business-admin, church-admin, etc.)

**4. "Someone is impersonating my business"**
- **Solution**: Verify ownership
- **Action**: Delete fake listing, suspend fake user account

**5. "I want my account deleted"**
- **Solution**: GDPR compliance
- **Action**: Follow deletion process, confirm via email

---

## Chapter 3: Church Management

### Approving New Churches

**admin/churches.html**

**Pending Approval Queue:**
- Church Name
- City, State
- Submission Date
- Contact Email/Phone
- Actions (Approve, Reject, Edit)

**Approval Checklist:**
✅ Church name is real (Google search to verify)  
✅ Address is valid (Google Maps check)  
✅ Contact email/phone are legitimate  
✅ Not a duplicate submission  
✅ No obvious spam/fake content  

**Approval Process:**
1. Click **Review** on pending church
2. Review all fields
3. Google search church name + city to verify it exists
4. Check contact info (call church if unsure)
5. Click **Approve** or **Reject**
6. If approved: Church goes live immediately, email sent to contact
7. If rejected: Email sent with reason, can re-submit with corrections

**Rejection Reasons:**
- Duplicate submission (church already exists)
- Invalid address (doesn't exist or incorrect)
- Fake church (can't verify existence)
- Incomplete information (missing required fields)
- Inappropriate content (profanity, spam)

---

### Editing Church Profiles

**When to edit:**
- Church requests info update
- Correct typos or errors
- Update service times
- Change contact information

**How to edit:**
1. admin/churches.html → Find church
2. Click **Edit**
3. Make changes
4. Click **Save**
5. Changes appear immediately (no re-approval)

**Editable Fields:**
- All fields except Created Date and Document ID
- Can change church admin (assign to different user)
- Can add/remove featured businesses (override church admin)

---

### Activating/Deactivating Churches

**Church Status Options:**
- **Active** - Visible in public directory
- **Inactive** - Hidden from public, church admin can still access
- **Pending** - Awaiting admin approval

**When to deactivate:**
- Church requests removal (closing, merging)
- Church is no longer operating
- Duplicate profile (keep one, deactivate other)
- Policy violation (rare)

**Deactivation Process:**
1. admin/churches.html → Find church
2. Click **Edit**
3. Change "Listing Status" to "Inactive"
4. Click **Save**
5. Church disappears from public directory immediately
6. Church admin can still log in and view profile

**Reactivation:**
- Change status back to "Active"
- No re-approval needed

---

### Managing Church Admins

**Assigning Church Admin Role:**
1. User requests church-admin access
2. Verify they're authorized (call church office, check website)
3. admin/users.html → Find user → Edit
4. Change role to "church-admin"
5. admin/churches.html → Find church → Edit
6. Set `admin_uid` field to user's Firebase UID
7. Save changes
8. User can now manage that church

**Multiple Admins per Church:**
- Currently: 1 admin per church
- Future Feature: Multiple admins with permission levels

**Removing Church Admin:**
1. Change user's role back to 'user'
2. Remove `admin_uid` from church document
3. Notify user of role change

---

### Assigning Churches to Church Admins

**Linking User to Church:**

**Method 1: During Church Approval**
- When approving church, check "Contact Email"
- Find user account with that email
- Automatically set them as church admin

**Method 2: Manual Assignment**
1. admin/churches.html → Find church → Edit
2. Find "Church Admin UID" field
3. Enter user's Firebase UID
4. Click Save

**Method 3: User Assignment**
1. admin/users.html → Find user → Edit
2. Add note: "Church Admin for [Church Name]"
3. Change role to "church-admin"
4. Then link church to user (Method 2)

---

## Chapter 4: Business Management

### Viewing All Business Listings

**admin/businesses.html**

**Business List Table:**
- Business Name
- Category
- Owner Name
- City, State
- Status (Active, Pending, Suspended)
- Pro Status (Free or Pro)
- Created Date
- Actions (Edit, Approve/Reject, View)

**Filtering:**
- By Status: Active, Pending, Inactive, Suspended
- By Pro Status: All, Free, Pro
- By Category: Dropdown of all categories
- By Church: Dropdown of all churches
- Search: Business name, owner name, email

**Bulk Actions:**
- Approve multiple pending businesses
- Export to CSV
- Change status (activate/deactivate)

---

### Approving/Rejecting Listings

**Pending Approval Queue:**
- New business submissions appear here
- Review queue sorted by oldest first

**Approval Checklist:**
✅ Business name is professional and legitimate  
✅ Category is appropriate  
✅ Address is valid  
✅ Contact info is real (not spam email)  
✅ Description is appropriate (no profanity/spam)  
✅ Church affiliation is correct (if selected)  

**Approval Process:**
1. admin/businesses.html → Filter by "Pending"
2. Click **Review** on business
3. Review all fields
4. Google search business name (verify it exists)
5. Click **Approve** or **Reject**
6. If approved: Listing goes live, owner notified via email
7. If rejected: Email sent with reason, can re-submit

**Rejection Reasons:**
- Fake business (can't verify)
- Inappropriate content
- Duplicate listing
- Wrong category (ask to resubmit with correct category)
- Incomplete information

---

### Editing Business Information

**When to edit:**
- Owner requests changes but can't access dashboard
- Correct obvious typos
- Update status (active/inactive)
- Manual Pro upgrade (comp accounts)

**Editable Fields:**
- All business fields
- Pro status (manual upgrade/downgrade)
- Listing status
- Featured status (override church admin)

**⚠️ Be careful editing:**
- Don't change business name without owner approval
- Don't modify contact info without verification
- Log all changes in Activity Log

---

### Handling Free vs Pro Status

**Manual Pro Upgrade:**

**When to use:**
- Comp account for early adopters
- Promotional giveaway
- Make up for platform issue (downtime, bug)
- Testing purposes

**How to manually upgrade:**
1. admin/businesses.html → Find business → Edit
2. Change `pro_status` to `true`
3. Set `pro_start_date` to today
4. Set `pro_end_date` to far future (e.g., 2099-12-31) for permanent comp
5. Click **Save**
6. Business immediately gets Pro features
7. No payment processing involved

**Manual Downgrade:**
- Change `pro_status` to `false`
- Pro features are hidden (photos, videos, social links)
- Listing stays active (permanent listing policy)

---

### Manual Pro Upgrades (Comp Accounts)

**Scenarios for comp accounts:**

**1. Beta Testers**
- First 100 businesses: Free Pro for life
- Document: Add admin note "Beta Tester - Free Pro Forever"

**2. First 3 Churches**
- Part of launch promotion
- Free Pro church profile forever

**3. Customer Service Recovery**
- Platform bug caused issue
- Comp 1 month of Pro as apology

**4. Influencer/Partner Accounts**
- Strategic partnerships
- Free Pro in exchange for promotion

**5. Testing Accounts**
- Internal testing
- Dave's personal accounts

**How to document:**
- admin/businesses.html → Edit → Admin Notes field
- Enter reason: "Comp Account - Beta Tester Promo - Lifetime Free"
- Set pro_end_date to 2099-12-31

---

### Permanent Listing Policy Enforcement

**The Policy:**
Kingdom Connects NEVER deletes business listings, even if owner stops paying for Pro.

**When Pro subscription ends/cancels:**
1. Auto-downgrade to Free tier
2. Hide Pro features (photos, videos, extra categories)
3. Listing stays active and searchable
4. Owner can re-upgrade anytime

**What stays:**
- Business name, address, phone, email
- Primary category + 1 secondary
- Hours of operation
- Reviews and ratings
- Church affiliation

**What is hidden:**
- Photos and videos (stored, not deleted)
- Social media links
- Extra categories (beyond 2)
- Analytics access

**Why we do this:**
- Support Christian businesses long-term
- No punishment for financial hardship
- Easy to re-upgrade without re-listing
- Builds trust and loyalty

**Admin enforcement:**
- Never delete businesses unless spam/fake
- If business requests deletion, mark as "Inactive" instead
- Explain permanent listing policy

---

## Chapter 5: Category Management

### Creating New Categories

**admin/categories.html** (Coming Soon)

**When to create category:**
- Multiple businesses need it
- Business owner suggests (via category_suggestions)
- You identify a gap in category coverage

**How to create:**
1. admin/categories.html → Click "Add New Category"
2. Fill in fields:
   - **Slug**: URL-friendly (e.g., "mobile-auto-detailing")
   - **Label**: Display name (e.g., "Mobile Auto Detailing")
   - **Display Order**: Numeric (1-999, determines dropdown sort)
   - **Active**: true (make available immediately)
   - **Type**: "general" (standard category)
   - **Description**: What businesses fit this category
3. Click **Save**
4. Category appears in all business dropdowns immediately

**Slug Guidelines:**
- Lowercase
- No spaces (use hyphens)
- No special characters
- Descriptive and clear
- Examples: "plumbing", "it-services", "mobile-detailing"

---

### Editing Category Names and Slugs

**⚠️ WARNING: Changing slugs breaks existing references**

**When to edit:**
- Fix typo in label
- Make category name clearer
- Reorder display

**Safe to edit:**
- **Label** (display name) - Changes everywhere instantly
- **Description** - Doesn't affect listings
- **Display Order** - Just changes dropdown sort
- **Active** - Hides/shows category

**DANGEROUS to edit:**
- **Slug** - If businesses already use this category, changing slug breaks their listings

**How to edit:**
1. admin/categories.html → Find category
2. Click **Edit**
3. Make changes
4. Click **Save**

**If you must change a slug:**
1. Create new category with new slug
2. Manually re-assign all businesses from old → new
3. Deactivate old category
4. Delete old category after 30 days (ensure no references)

---

### Activating/Deactivating Categories

**Active vs Inactive:**
- **Active**: Appears in business owner category dropdowns
- **Inactive**: Hidden from dropdowns, but existing businesses keep it

**When to deactivate:**
- Category is too niche (only 1-2 businesses)
- Merging categories (e.g., "IT Services" + "Computer Repair" → "IT & Computer Services")
- Outdated category (e.g., "Fax Services")

**Deactivation Process:**
1. admin/categories.html → Find category
2. Click **Edit**
3. Change "Active" to `false`
4. Click **Save**
5. Category disappears from dropdowns
6. Businesses already using it retain it

**Reactivation:**
- Change "Active" to `true`
- Saves immediately, available in dropdowns

---

### Display Order Management

**Display Order** determines dropdown sort order.

**Current System:**
- Alphabetical by label (default)
- Custom order via `display_order` field

**How to reorder:**
1. Decide on desired order
2. Assign numbers (1, 2, 3, etc.)
3. admin/categories.html → Edit each category
4. Set `display_order` field
5. Save
6. Dropdowns sort by `display_order` ASC, then label A-Z

**Example:**
```
1. General Contractor (most common, list first)
2. Plumbing
3. HVAC
4. Electrical
...
999. Other Services (catch-all, list last)
```

---

### Reviewing Category Suggestions

**business-admin/category-suggestions.html** (Business owners submit here)  
**admin/categories.html** → **Suggestions Tab** (Admins review here)

**Suggestion Fields:**
- Suggested by: User who submitted
- Business ID: Their business
- Suggested Label: Proposed category name
- Suggested Slug: Proposed URL-friendly name
- Description: Why they need this category
- Status: Pending, Approved, Denied

**Review Process:**
1. admin/categories.html → **Suggestions** tab
2. See list of pending suggestions
3. Click **Review** on suggestion
4. Read description and rationale
5. Decide: Approve, Modify, or Deny

---

### Approving/Denying Suggestions

**Approval Criteria:**
- Legitimate business category
- At least 3+ businesses would use it
- Not too similar to existing categories
- Professional name

**Approval Process:**
1. Click **Approve**
2. Review suggested slug (edit if needed)
3. Review suggested label (edit if needed)
4. Set display order (where in dropdown?)
5. Click **Create Category**
6. Category is created and activated
7. Suggester receives email: "Your suggestion was approved!"
8. Their business can now use the category

**Modification:**
1. Suggester proposes: "Computer Fixing Services"
2. You modify to: "Computer Repair & IT Services"
3. Approve with modified name
4. Email explains change

**Denial:**
1. Click **Deny**
2. Enter reason:
   - "Too similar to existing 'IT Services' category"
   - "Only applies to your specific business, not broad enough"
   - "Not a professional business category"
3. Click **Send Denial**
4. Suggester receives email with explanation
5. They can revise and re-submit

---

## Chapter 6: Review Moderation

**Feature Status:** Coming Soon

**admin/reviews.html**

**What you'll moderate:**
- Customer reviews of businesses
- Church reviews (if enabled)
- Flagged reviews
- Spam reviews

**Approval Criteria:**
- Legitimate customer experience
- No profanity or hate speech
- No spam or promotional content
- No personal attacks

**Actions:**
- Approve review (goes live)
- Reject review (hidden, user notified)
- Edit review (fix typos, remove profanity)
- Flag for business owner response

---

## Chapter 7: Payment Management

**Feature Status:** Coming Soon

**admin/payments.html**

**What you'll see:**
- All Stripe transactions
- Pro subscription payments
- Failed payments
- Refunds

**Transaction List:**
- Date
- Customer (business name)
- Amount
- Status (Success, Failed, Refunded)
- Payment Method (card last 4 digits)

**Actions:**
- Issue refund
- Retry failed payment
- View full Stripe transaction

**Refund Process:**
1. Navigate to payment
2. Click **Refund**
3. Enter amount (full or partial)
4. Enter reason
5. Confirm
6. Stripe processes refund (2-5 business days)
7. Business is downgraded to Free tier

---

## Chapter 8: Sales & Commissions

**Feature Status:** Coming Soon

**admin/sales.html**

**Managing Sales Agents:**
- View all sales agents
- Approve agent applications
- Assign referral codes
- Track performance
- Adjust commission rates (if custom)

**Commission Payments:**
1. admin/sales.html → **Commissions** tab
2. See pending commission payouts
3. Review for accuracy
4. Approve batch payment
5. Export payment file for PayPal/bank transfer
6. Mark as paid
7. Agents receive notification

**Commission Disputes:**
- Agent claims missing commission
- Verify referral code was used
- Check payment records
- Manually add commission if legitimate error

---

## Chapter 9: Email Campaign System

**admin/email-campaigns.html** ✅ FULLY IMPLEMENTED

### Campaign Dashboard

**Overview Cards:**
- Total Campaigns (all time)
- Active Campaigns (currently running)
- Scheduled Campaigns (set for future send)
- Total Emails Sent (all campaigns combined)

---

### Creating a New Campaign

**Step 1: Choose Audience Segment**

Available segments:
1. **All Users** - Everyone registered
2. **Pro Businesses (Lapsed)** - Had Pro, now downgraded/expired
3. **Pro Businesses (Active)** - Currently paying for Pro
4. **Free Businesses** - Never upgraded to Pro
5. **New Signups (Last 30 Days)** - Recent registrations
6. **Churches** - All church admins
7. **Sales Agents** - All agents

Real-time segment size shown: "This segment has 42 recipients"

---

**Step 2: Select Template**

Pre-built templates:
1. **Pro Winback** - For lapsed Pro businesses
   - Subject: "We Miss You! Get 20% Off Pro This Month"
   - Body: Highlights what they're missing, discount offer

2. **Welcome Email** - For new signups
   - Subject: "Welcome to Kingdom Connects!"
   - Body: Getting started guide, next steps

3. **Church Partnership** - For churches
   - Subject: "Partner with Kingdom Connects"
   - Body: How to recruit member businesses, revenue sharing

4. **Custom Template** - Blank canvas
   - Write your own subject and body

**Template Variables:**
- `{first_name}` - User's first name
- `{business_name}` - Their business name
- `{church_name}` - Their church name
- `{pro_end_date}` - When Pro subscription ended

---

**Step 3: Customize Content**

**Subject Line:**
- Max 100 characters
- Use variables for personalization
- Preview shows with example data

**Email Body:**
- Rich text editor
- Bold, italic, links
- Insert variables
- Preview pane shows live preview

**Example:**
```
Subject: {first_name}, Your Pro Features Are Waiting!

Hi {first_name},

We noticed your Pro subscription for {business_name} ended on {pro_end_date}.

We'd love to have you back! For the next 7 days, upgrade to Pro and get 20% off your first 3 months.

Pro Features You're Missing:
✅ 10 photos & 3 videos
✅ 5 secondary categories
✅ Analytics dashboard
✅ Review responses

Ready to upgrade? Click here: [Upgrade Now]

Blessings,
The Kingdom Connects Team
```

---

**Step 4: Schedule or Send**

**Send Options:**
1. **Send Now** - Immediately send to all in segment
2. **Schedule for Later** - Pick date/time
3. **Save as Draft** - Finish later

**Scheduling:**
- Date picker (calendar)
- Time picker (hour/minute, AM/PM)
- Timezone: Automatically uses server timezone (EST/EDT)

**Confirmation:**
- "Send to 42 recipients now?"
- Preview one last time
- Click **Confirm & Send**

---

### Campaign Analytics

**admin/email-campaigns.html → Campaign List → Click campaign → View Analytics**

**Metrics Tracked:**
- **Sent Count** - Total emails sent
- **Opened Count** - How many opened (requires tracking pixel)
- **Clicked Count** - How many clicked links
- **Bounce Count** - Failed deliveries
- **Open Rate** - Opened ÷ Sent × 100
- **Click Rate** - Clicked ÷ Sent × 100
- **Conversion Count** - How many upgraded to Pro (if tracked)

**Example Analytics:**
```
Campaign: Pro Winback November 2025
Sent: 42
Opened: 28 (66.7%)
Clicked: 12 (28.6%)
Conversions: 4 (9.5%)
Revenue Generated: $48/month MRR
```

---

### Email Service Integration

**Current Status:**
- UI complete ✅
- Campaign creation works ✅
- Email sending NOT implemented yet ❌

**Next Steps:**
1. Add SendGrid or Mailchimp API key to Replit Secrets
2. Implement `sendEmailCampaign()` function in Firebase Cloud Function
3. Test with small segment first
4. Roll out to production

**API Key Setup:**
1. Sign up for SendGrid or Mailchimp
2. Generate API key
3. Replit → Secrets → Add `SENDGRID_API_KEY`
4. Deploy Cloud Function to send emails

---

## Chapter 10: Content Management

### Managing Homepage Factoids

**admin/factoids.html**

**What are factoids?**
- Short, interesting facts displayed on homepage
- Rotate randomly on each page load
- Keep users engaged
- Educate about Kingdom Connects mission

**Factoid List:**
- Factoid Text
- Status (Active/Inactive)
- Created Date
- Actions (Edit, Delete, Activate/Deactivate)

---

### Adding/Editing/Deleting Facts

**Add New Factoid:**
1. admin/factoids.html → Click **Add Factoid**
2. Enter factoid text (max 200 characters)
3. Toggle "Active" (shows on homepage)
4. Click **Save**
5. Factoid immediately appears in rotation

**Example Factoids:**
- "Kingdom Connects returns 10% of revenue to churches and ministries."
- "Over 500 Christian businesses are connected on our platform."
- "Pro tier businesses see 3x more customer inquiries than free listings."
- "Churches can feature up to 5 member businesses on their profile."

**Edit Factoid:**
1. Click **Edit** next to factoid
2. Change text
3. Click **Save**
4. Changes appear immediately

**Delete Factoid:**
1. Click **Delete**
2. Confirm deletion
3. Factoid removed from database and homepage rotation

---

### Activating/Deactivating Content

**Why deactivate instead of delete?**
- Seasonal factoids (e.g., "Happy Easter from Kingdom Connects!")
- Temporary promotions
- Testing new content

**How to deactivate:**
1. Find factoid in list
2. Toggle "Active" to OFF
3. Save
4. Factoid hidden from homepage but stays in database

**Reactivate:**
- Toggle "Active" to ON
- Save
- Factoid returns to rotation

---

## Chapter 11: Analytics & Reporting

### Platform-Wide Statistics

**admin/analytics.html**

**Dashboard Overview:**

**User Metrics:**
- Total Registered Users
- New Users (Last 7/30 Days)
- Active Users (logged in last 30 days)
- User Growth Rate (%)

**Business Metrics:**
- Total Businesses (Active)
- Free vs Pro Breakdown
- Pro Conversion Rate (Free → Pro)
- Average Businesses per Church

**Church Metrics:**
- Total Churches
- Average Parishioner Count
- Churches with 0 businesses (opportunity)
- Churches with 10+ businesses

**Revenue Metrics:**
- Monthly Recurring Revenue (MRR)
- Annual Run Rate (MRR × 12)
- Average Revenue Per User (ARPU)
- Churn Rate (cancelled subscriptions)

---

### Growth Metrics

**Charts and Graphs:**

**1. User Growth Over Time**
- Line chart: Last 12 months
- X-axis: Month
- Y-axis: Total Users
- Shows growth trend

**2. Pro Subscription Growth**
- Line chart: Last 12 months
- Track Free vs Pro over time
- Shows Pro adoption

**3. Revenue Growth**
- Bar chart: Monthly revenue
- Compare month-over-month
- Project forward

**4. Category Distribution**
- Pie chart: Businesses by category
- See which categories are most popular
- Identify underserved categories

**5. Geographic Distribution**
- Map view: Businesses by state
- Heat map showing concentration
- Target expansion areas

---

### Revenue Tracking

**admin/analytics.html → Revenue Tab**

**Metrics:**
- Total MRR (Monthly Recurring Revenue)
- MRR Growth Rate (week/month)
- Average Subscription Value
- Customer Lifetime Value (LTV)
- Churn Rate

**Revenue Breakdown:**
- By Business Type (Pro tier)
- By Location (state/city)
- By Church Affiliation
- By Sales Agent (commission attribution)

**Forecasting:**
- Projected MRR (next month)
- Projected Annual Revenue
- If conversion rate stays at X%, MRR will be Y in 6 months

---

### User Engagement Metrics

**What is "engagement"?**
- Users who log in regularly
- Businesses that update their listings
- Churches that feature businesses
- Customers who leave reviews

**Engagement Metrics:**
- Daily Active Users (DAU)
- Weekly Active Users (WAU)
- Monthly Active Users (MAU)
- DAU/MAU Ratio (stickiness)

**Business Engagement:**
- Businesses with photos uploaded: X%
- Businesses with hours set: X%
- Businesses responding to reviews: X%
- Businesses using all secondary category slots: X%

**Church Engagement:**
- Churches with 5+ businesses: X%
- Churches featuring businesses: X%
- Churches with completed profiles: X%

---

### Export Reports (CSV/PDF)

**admin/analytics.html → Export**

**Available Reports:**

**1. User Report**
- All users with roles, status, created date
- CSV format
- Use for: Segmentation, analysis, CRM import

**2. Business Report**
- All businesses with categories, status, Pro tier
- CSV format
- Use for: Analysis, marketing, sales prospecting

**3. Church Report**
- All churches with parishioner count, businesses affiliated
- CSV format
- Use for: Outreach, partnerships

**4. Revenue Report**
- All transactions, subscriptions, MRR breakdown
- CSV format
- Use for: Accounting, tax prep, investor reports

**5. Analytics Summary (PDF)**
- Platform overview with charts
- Key metrics
- Growth trends
- Use for: Board meetings, investor updates, annual reports

**How to export:**
1. Navigate to report page
2. Click **Export**
3. Choose format (CSV or PDF)
4. Click **Download**
5. File downloads to your computer

---

## Chapter 12: Settings & Configuration

### Platform Settings

**admin/settings.html**

**General Settings:**
- **Platform Name** - "Kingdom Connects" (editable for rebranding)
- **Support Email** - support@kingdomconnects.com
- **Admin Email** - admin@kingdomconnects.com
- **Default Theme** - Dark/Light
- **Maintenance Mode** - ON/OFF (show "Under Maintenance" page)

**Pricing Settings:**
- **Pro Monthly Price** - $9-12 (adjust anytime)
- **Sales Commission Rate** - 30% (adjust for all agents)
- **Church Revenue Share** - 5% (adjust tithing percentage)

**Feature Flags:**
- Enable Reviews: ON/OFF
- Enable Sales Agents: ON/OFF
- Enable Church Revenue Sharing: ON/OFF
- Enable Email Campaigns: ON/OFF

---

### Email Templates (Future)

**Coming Soon:**

Template types:
- New User Welcome
- Business Approved
- Church Approved
- Pro Subscription Confirmed
- Pro Subscription Cancelled
- Password Reset
- Role Changed

**Customization:**
- Subject line
- Email body
- Variables (name, business, date, etc.)
- Logo/branding

---

### Notification Settings

**admin/settings.html → Notifications**

**Admin Notifications:**
What you get notified about:
- New business submission (email)
- New church submission (email)
- New category suggestion (email)
- Flagged review (email)
- Payment dispute (email)

**User Notifications:**
Default settings for all users:
- New review (email)
- Pro subscription renewal (email)
- Listing approved (email)
- Role changed (email)

**Frequency:**
- Instant (as events happen)
- Daily Digest (once per day summary)
- Weekly Digest (once per week summary)

---

### Integration Management

**admin/settings.html → Integrations**

**Current Integrations:**

**1. Firebase**
- Project ID
- API Key (public)
- Auth Domain
- Status: Connected ✅

**2. Stripe**
- Publishable Key (public)
- Webhook Secret
- Status: Connected ✅

**3. SendGrid/Mailchimp** (Future)
- API Key
- Status: Not Connected ❌

**4. Google Maps** (Future)
- API Key
- Status: Not Connected ❌

**How to update:**
1. Navigate to integration
2. Click **Edit**
3. Update API keys in Replit Secrets
4. Test connection
5. Save

---

### API Keys and Secrets

**⚠️ SECURITY: Never expose API keys publicly**

**Replit Secrets (Environment Variables):**
- `FIREBASE_API_KEY`
- `STRIPE_PUBLISHABLE_KEY`
- `STRIPE_SECRET_KEY` (backend only)
- `SENDGRID_API_KEY` (when implemented)
- `WEBHOOK_SECRET` (GitOps)

**How to manage:**
1. Replit → Left Sidebar → Secrets (🔒 icon)
2. Add/Edit/Delete secrets
3. Restart server for changes to take effect
4. NEVER commit secrets to GitHub

**Best Practices:**
- Rotate keys every 6 months
- Use different keys for dev vs production
- Limit API key permissions (least privilege)
- Monitor API usage for anomalies

---

## Chapter 13: Security & Access Control

### Understanding Firestore Rules

**Location:** `firestore.rules`

**What are Firestore Rules?**
- Server-side security that controls who can read/write data
- Even if someone bypasses the frontend, Firestore rules protect data
- Role-based access control

**Key Rules:**

**1. Users Collection**
```javascript
// Users can read their own data
allow read: if request.auth.uid == resource.data.uid;
// Users cannot change their own role (privilege escalation prevention)
allow update: if request.auth.uid == resource.data.uid 
              && !request.resource.data.diff(resource.data).affectedKeys().hasAny(['role']);
```

**2. Business Listings**
```javascript
// Public can read active businesses
allow read: if resource.data.listing_status == 'active';
// Only owner or admin can edit
allow update: if request.auth.uid == resource.data.owner_uid 
              || isAdmin();
```

**3. Churches**
```javascript
// Public can read active churches
allow read: if resource.data.listing_status == 'active';
// Only church admin or platform admin can edit
allow update: if request.auth.uid == resource.data.admin_uid 
              || isAdmin();
```

---

### Role-Based Permissions

**Role Hierarchy:**
1. **admin** - Full access to everything
2. **church-admin** - Manage own church + view affiliated businesses
3. **business-admin** - Manage own business listing
4. **sales** - View own commissions + referrals
5. **user** - Read-only public data

**What each role can do:**

**Admin:**
- ✅ Manage all users, businesses, churches
- ✅ Approve/reject submissions
- ✅ View all payments and commissions
- ✅ Edit platform settings
- ✅ Access activity logs

**Church Admin:**
- ✅ Edit own church profile
- ✅ View businesses affiliated with church
- ✅ Feature up to 5 businesses
- ❌ Cannot edit other churches
- ❌ Cannot access admin dashboard

**Business Admin:**
- ✅ Edit own business listing
- ✅ Upload photos/videos (Pro only)
- ✅ Respond to reviews (Pro only)
- ❌ Cannot edit other businesses
- ❌ Cannot access admin dashboard

**Sales Agent:**
- ✅ View own commissions
- ✅ Track referrals
- ❌ Cannot see other agents' earnings
- ❌ Cannot edit businesses or churches

**User:**
- ✅ View public business/church directories
- ❌ Cannot create businesses or churches
- ❌ Cannot leave reviews (future feature)

---

### Security Best Practices

**1. Authentication**
- Force email verification before allowing dashboard access
- Implement 2FA (future feature)
- Session timeout after 30 days of inactivity

**2. Authorization**
- Always check user role before allowing action
- Never trust client-side role checks
- Firestore rules are the final authority

**3. Input Validation**
- Sanitize all user inputs (use `js/sanitize.js`)
- Validate email formats, phone numbers, URLs
- Prevent XSS attacks (HTML injection)
- Prevent SQL injection (we use Firestore, but still sanitize)

**4. API Security**
- Store API keys in Replit Secrets
- Never commit secrets to GitHub
- Use environment variables
- Rotate keys regularly

**5. Data Privacy**
- GDPR compliance (right to deletion)
- Don't expose user emails publicly
- Encrypt sensitive data
- User data belongs to the user

---

### Activity Log Monitoring

**admin/activity-log.html**

**What gets logged:**
- User role changes
- Business approvals/rejections
- Church approvals/rejections
- Category creations
- Manual Pro upgrades
- Payment refunds
- User deletions

**Log Entry Format:**
```
{
  timestamp: "2025-11-08T14:32:00Z",
  admin_uid: "abc123",
  admin_name: "Dave Percey",
  action: "approved_business",
  target_id: "business_xyz789",
  target_name: "Smith Plumbing",
  details: "Approved business listing after verification"
}
```

**How to review:**
1. admin/activity-log.html
2. Filter by:
   - Date range
   - Action type
   - Admin name
3. Search for specific business/church/user
4. Export to CSV for audit

---

### Detecting Suspicious Activity

**Red Flags:**

**1. Spam Accounts**
- 10+ accounts created from same IP in 1 hour
- Email addresses follow pattern: randomstring123@gmail.com
- No profile completion

**2. Fake Businesses**
- Same address used for multiple businesses
- Phone numbers are fake/disconnected
- Can't verify business exists (Google search)

**3. Review Manipulation**
- Same user leaves multiple reviews from different accounts
- Businesses receiving 10+ 5-star reviews in 1 day
- Suspicious language patterns

**4. Payment Fraud**
- Credit card chargebacks
- Multiple failed payment attempts
- Stolen credit card reports

**What to do:**
1. Suspend account immediately
2. Flag business as "Under Review"
3. Investigate (Google search, call phone number)
4. If confirmed fraud: Delete account, report to Stripe
5. If legitimate: Unsuspend, apologize for inconvenience

---

## Chapter 14: Troubleshooting & Support

### Common Admin Issues

**Issue 1: Can't access admin dashboard**

**Symptoms:**
- Redirects to homepage when visiting /admin/
- "Permission denied" error

**Solution:**
1. Check user role in Firestore: `/users/{uid}`
2. Verify `role: 'admin'`
3. If not admin, update role
4. Log out and log back in
5. Try accessing /admin/ again

---

**Issue 2: Business approval button doesn't work**

**Symptoms:**
- Click "Approve" but nothing happens
- Console error about Firestore permissions

**Solution:**
1. Open browser console (F12)
2. Check for errors
3. Verify admin is logged in
4. Check Firestore rules allow admin to update listing_status
5. Try hard refresh (Ctrl+F5)

---

**Issue 3: Email campaigns not sending**

**Symptoms:**
- Campaign created but no emails received
- "Email service not configured" error

**Solution:**
1. Email sending NOT implemented yet
2. Need SendGrid API key
3. Need Cloud Function to send emails
4. See Chapter 9: Email Campaign System → Integration section

---

**Issue 4: Users can't upload photos**

**Symptoms:**
- "Upload failed" error
- Photos not appearing after upload

**Solution:**
1. Firebase Storage not enabled → Enable in Firebase Console
2. Missing `owner_uid` field in business document → Backfill data
3. Storage security rules incorrect → Update rules (see FIREBASE-STORAGE-SETUP.md)
4. File too large (>10MB) → Compress file

---

### Database Queries

**Firebase Console → Firestore Database**

**Common Queries:**

**Find all admin users:**
- Collection: `users`
- Where: `role == 'admin'`
- Results: All platform admins

**Find businesses missing owner_uid:**
- Collection: `business_listings`
- Where: `owner_uid == null`
- Results: Businesses that can't upload media

**Find Pro businesses:**
- Collection: `business_listings`
- Where: `pro_status == true`
- Results: All Pro tier businesses

**Find pending approvals:**
- Collection: `business_listings`
- Where: `listing_status == 'pending'`
- Results: Awaiting approval queue

---

### Error Log Review

**Browser Console Errors:**
1. Open browser (Chrome recommended)
2. Press F12 (Developer Tools)
3. Click "Console" tab
4. Look for red errors
5. Copy error message
6. Google search or ask Dave

**Common Errors:**

**"Permission denied"**
- User doesn't have role to access resource
- Firestore rules blocking action

**"Firebase: Error (auth/...)"**
- Authentication error
- User not logged in or token expired

**"Uncaught TypeError: Cannot read property '...' of undefined"**
- JavaScript error
- Variable is null/undefined
- Check code logic

---

### Escalation Procedures

**Level 1: You (Platform Admin)**
- Handle 90% of issues
- User management, approvals, content moderation

**Level 2: Dave (Owner/Developer)**
- Code bugs
- Firestore rule changes
- Firebase configuration
- Integration setup

**Level 3: Ghost (GitOps/Architecture Overseer)**
- Architecture decisions
- System design changes
- Git workflow issues

**Level 4: External Support**
- Firebase Support (infrastructure issues)
- Stripe Support (payment issues)
- Replit Support (hosting issues)

**When to escalate:**
- You've tried everything in this manual
- Issue affects multiple users
- Critical bug preventing platform use
- Security vulnerability discovered

---

### Emergency Contacts

**Dave Percey** (Owner/Developer)  
Email: [REDACTED - Dave to provide]  
Phone: [REDACTED - Dave to provide]  
Hours: Usually available 9 AM - 5 PM EST

**Ghost** (GitOps Overseer)  
Contact via: Dave

**Firebase Support:**  
https://firebase.google.com/support

**Stripe Support:**  
https://support.stripe.com

**Replit Support:**  
support@replit.com

---

## Chapter 15: Maintenance & Updates

### Regular Maintenance Tasks

**Daily:**
- ✅ Review pending business approvals (< 24 hour turnaround)
- ✅ Review pending church approvals
- ✅ Check for flagged reviews (future)
- ✅ Monitor activity log for suspicious activity

**Weekly:**
- ✅ Review category suggestions
- ✅ Check payment failures and follow up
- ✅ Review analytics for anomalies
- ✅ Backup Firestore data (automatic, just verify)

**Monthly:**
- ✅ Generate and review monthly revenue report
- ✅ Pay sales agent commissions
- ✅ Review and deactivate inactive businesses (optional)
- ✅ Update homepage factoids (rotate seasonal content)
- ✅ Send email campaign to engaged users

**Quarterly:**
- ✅ Review platform analytics and set goals
- ✅ Update user manuals if features changed
- ✅ Review security logs
- ✅ Rotate API keys

**Annually:**
- ✅ Send 1099 forms to sales agents
- ✅ Prepare annual financial report
- ✅ Review and update Terms of Service / Privacy Policy
- ✅ Plan new features for next year

---

### Backup Procedures (Firebase Automatic)

**Good News: Firebase Auto-Backups**
- Firestore automatically creates daily backups
- Retained for 7 days
- No manual backup needed

**How to restore from backup:**
1. Firebase Console → Firestore Database
2. Click "Import/Export"
3. Choose "Import"
4. Select backup date
5. Confirm restore

**⚠️ WARNING:** Restore overwrites current data. Use only for disaster recovery.

**Additional Backup (Recommended):**
- Monthly export to CSV
- admin/analytics.html → Export → All Reports
- Store in Google Drive or Dropbox
- Use for historical analysis

---

### Database Cleanup

**What to clean:**

**1. Inactive Users** (Never logged in after 1 year)
- admin/users.html → Filter "Last Login > 365 days ago"
- Email: "Your account will be deleted in 30 days unless you log in"
- If no response, delete account (GDPR right to inactivity)

**2. Orphaned Data**
- Businesses with no owner (owner_uid missing or user deleted)
- Categories with 0 businesses (unused categories)
- Old activity logs (keep 1 year, delete older)

**3. Test Accounts**
- Remove after testing
- Search for "test" in business names
- Delete or mark as inactive

**Cleanup Schedule:**
- Run quarterly
- Use Firebase Console or Cloud Functions
- Always export data before deleting

---

### Performance Monitoring

**Metrics to Track:**

**1. Page Load Speed**
- Use Google PageSpeed Insights
- Target: < 3 seconds on mobile
- Optimize images, minify CSS/JS

**2. Firestore Read/Write Usage**
- Firebase Console → Usage
- Free tier: 50k reads/day, 20k writes/day
- Monitor to avoid overage charges

**3. Firebase Hosting Bandwidth**
- Free tier: 10GB/month
- Monitor traffic spikes

**4. User Complaints**
- "Site is slow"
- "Can't upload photos"
- Investigate and optimize

**Optimization Tips:**
- Use Firestore indexes (auto-created)
- Cache static content
- Compress images
- Lazy load photos

---

### Update Deployment Process

**When Dave makes code changes:**

**Step 1: Development (Dev Branch)**
- Dave codes in Replit dev environment
- Tests locally
- Commits to dev branch via GitOps dashboard

**Step 2: Review (Ghost/Architect)**
- Ghost reviews code
- Architect validates changes
- Feedback provided

**Step 3: Testing (Staging)**
- Deploy to staging environment
- Test all features
- Verify no breaking changes

**Step 4: Production (Main Branch)**
- Dave syncs dev → main via GitOps dashboard
- Changes go live immediately
- Monitor for errors

**Step 5: Rollback (If Needed)**
- Use GitOps dashboard to sync main → dev (reverse)
- Or manually revert in Git
- Restore previous version

**Your Role:**
- Test new features after deployment
- Report bugs to Dave immediately
- Update user manuals if UI changed

---

## 🎉 Congratulations!

You've completed the Platform Admin Manual. You now have complete knowledge of:

✅ User, church, and business management  
✅ Category system and suggestions  
✅ Email campaign creation and management  
✅ Revenue tracking and analytics  
✅ Security and access control  
✅ Troubleshooting and support  
✅ Maintenance and updates  

**Next Steps:**
1. Familiarize yourself with all admin pages
2. Practice approving a test business/church
3. Create a test email campaign
4. Review activity log weekly
5. Set up your maintenance schedule

**Questions?**  
Contact: Dave Percey (Owner)

---

**Kingdom Connects** | Admin Manual v1.0 | November 2025 | **CONFIDENTIAL**
