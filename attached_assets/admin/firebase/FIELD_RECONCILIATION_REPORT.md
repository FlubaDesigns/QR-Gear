# Firebase Field Reconciliation Report
**Generated:** November 8, 2025  
**Purpose:** Compare documented Firestore fields vs. actual code implementation

---

## 📊 BUSINESS_LISTINGS Collection

### Currently Used in Code (submit_business.html):
```
✅ businessName (camelCase - NEEDS FIX → business_name)
✅ yourName (camelCase - NEEDS FIX → your_name)
✅ email
✅ description
✅ phone
✅ website
✅ address1 (NEEDS FIX → address_1 or address_line1)
✅ address2 (NEEDS FIX → address_2 or address_line2)
✅ city
✅ state
✅ zip (NEEDS FIX → zip_code)
✅ churchId (camelCase - NEEDS FIX → church_id)
✅ listing_status (snake_case ✓)
✅ pro_status (snake_case ✓)
✅ created_at (snake_case ✓)
✅ average_rating (snake_case ✓)
✅ pro_start_date (snake_case ✓)
✅ pro_end_date (snake_case ✓)
```

### Documented but NOT Used in Code:
```
❓ _field_priority (boolean) - Priority handling flag
❓ allow_reviews (boolean) - Enable/disable reviews
❓ allow_social_sharing (boolean) - Enable social sharing
❓ categories (array) - Business categories/tags
❓ church_name (string) - Church name (redundant? we have church_id)
❓ country (string) - Country field
❓ category (string) - Single category field
```

### Missing from Both Documentation & Code:
```
⚠️ photos (array) - Photo URLs for Pro listings
⚠️ videos (array) - Video URLs for Pro listings
⚠️ help_text fields - Form help text (may be in separate collection)
```

---

## ⛪ CHURCHES Collection

### Currently Used in Code (submit_church.html):
```
✅ church_name (snake_case ✓)
✅ city (snake_case ✓)
✅ state (snake_case ✓)
✅ zip_code (snake_case ✓)
✅ denomination (snake_case ✓)
✅ website (snake_case ✓)
✅ contact_email (snake_case ✓)
✅ contact_phone (snake_case ✓)
✅ listing_status (snake_case ✓)
✅ submission_date (snake_case ✓)
```

### Documented but NOT Used:
```
❓ allow_reviews_for_church (boolean)
❓ allow_social_sharing (boolean)
❓ bible_study_times (array)
❓ country (string)
❓ created_at (timestamp) - vs submission_date?
❓ description (string) - Church about section
❓ directory_link (string) - QR code URL
❓ is_pro (boolean) - Pro church status
❓ service_times (array)
❓ updated_at (timestamp)
```

### Status:
**Churches collection is PERFECTLY formatted with snake_case! ✅**

---

## 👥 USERS Collection

### Documented Fields (from Word doc):
```
account_status, admin_notes, created_at, date_joined, display_name,
email, is_email_verified, is_pro_user, last_activity, last_login,
last_updated, listing_count, notification_preferences (map),
notifications_enabled, phone_number, pro_end_date, pro_start_date,
profile_photo_url, referral_code, review_count, role
```

### Status:
**NOT checked against code yet - need to review login/auth pages**

---

## ⭐ REVIEWS Collection

### Documented Fields:
```
admin_notes, business_id, created_at, rating, response_date,
response_text, review_id, review_text, status, user_id, reviewer_name
```

### Currently Used (submit_review.html):
```
✅ business_id
✅ user_id (if logged in)
✅ rating
✅ review_text
✅ created_at
❓ status (should be 'pending' by default)
❓ reviewer_name
```

---

## 💳 PAYMENTS Collection

### Documented Fields (all snake_case):
```
amount, business_id, created_at, currency, last_updated, notes,
payment_id, payment_method, pro_end_date, pro_start_date,
receipt_url, status, transaction_date, user_id
```

### Status:
**NOT implemented yet - Stripe integration pending**

---

## 📁 SUBCOLLECTIONS

### business_listings/{docId}/commissions
```
church_id, commission_amount, commission_paid, payment_date,
pro_payment_amount, referrer_display_name, referrer_id,
referrer_type, tithe_amount
```
**Status:** Not implemented yet

### business_listings/{docId}/salesAnalytics
```
active_months_on_pro, average_pro_lifetime_months,
last_commission_payment_date, most_recent_commission_amount,
new_pro_clients_this_month, pro_renewal_rate,
total_active_pro_clients, total_commission_paid,
total_pro_subscriptions, total_revenue_from_pro_clients,
yearlyCompanyRevenue (camelCase - ONLY ONE!)
```
**Status:** Not implemented yet

---

## 🎯 RECOMMENDED ACTIONS

### Priority 1: Fix business_listings Naming (CRITICAL)
1. Rename in code: `businessName` → `business_name`
2. Rename in code: `yourName` → `your_name`
3. Rename in code: `address1/address2` → `address_line1/address_line2`
4. Rename in code: `zip` → `zip_code`
5. Rename in code: `churchId` → `church_id`

### Priority 2: Decide on Unused Fields
**Option A - DELETE from Firebase (if never planning to use):**
- `_field_priority`
- `allow_reviews` (just allow all reviews by default)
- `allow_social_sharing` (just enable by default)
- `church_name` (redundant, we have church_id)
- `country` (only operating in Florida initially)

**Option B - START USING (add to forms):**
- `categories` (array) - Very useful for filtering!
- `description` (for churches) - Good for SEO
- `photos/videos` - Essential for Pro tier

### Priority 3: Add Missing Essential Fields
- `photos` array to business_listings
- `videos` array to business_listings
- `status` to reviews (set to 'pending' on submit)

---

## 📋 QUESTIONS FOR YOU

1. **Categories:** Do you want businesses to select multiple categories (array) or just one (string)?
2. **Church Fields:** Should we add `description`, `service_times`, `bible_study_times` to the submit form?
3. **Country Field:** Delete it? (Only Florida for now)
4. **Social Sharing:** Enable by default or make it optional?
5. **Photos/Videos:** Where should Pro businesses upload these? (Need storage solution)

---

## 🚀 NEXT STEPS

Once you answer the questions above, I can:
1. Migrate all business_listings fields to snake_case
2. Update all forms to use correct field names
3. Update all display pages (business.html, etc.)
4. Add any new fields you want to use
5. Clean up unused fields from Firebase

**This will make your codebase consistent and match your documentation! ✅**
