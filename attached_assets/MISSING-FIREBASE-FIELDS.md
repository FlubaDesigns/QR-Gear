# Missing Firebase Fields - Manual Population Required

This document tracks all Firestore fields that need to be manually populated in the Firebase Console before the commission system will work correctly.

## ⚠️ CRITICAL: These fields MUST be populated before activating Pro subscriptions

---

## Collection: `business_listings`

### Fields to Add to EACH Business:

| Field Name | Type | Required | Description | How to Populate |
|------------|------|----------|-------------|-----------------|
| `home_church_id` | string | YES | The church this business belongs to (gets 10% commission) | Link to church UID from `churches` collection |
| `referring_salesperson_id` | string | YES | The salesperson who signed this business (gets 5%) | Link to user UID from `users` collection |
| `sales_director_id` | string | YES | The director who recruited the salesperson (gets 30%) | Link to user UID from `users` collection |
| `commission_policy_id` | string | NO | Override default commission split (optional) | Leave null for default policy |

**Impact if Missing:** Pro subscription cannot create commission splits - payment will fail or go 100% to KC

---

## Collection: `churches`

### Fields to Add to EACH Church:

| Field Name | Type | Default | Description |
|------------|------|---------|-------------|
| `total_commission_earned` | number | 0 | Lifetime total earned |
| `monthly_commission_total` | number | 0 | Current month earnings |
| `ytd_commission_total` | number | 0 | Year-to-date earnings |
| `unpaid_commission_balance` | number | 0 | Amount owed but not paid |

**Impact if Missing:** Church won't see earnings in dashboard, but commissions will still be tracked in ledger

---

## Collection: `users` (for Salespeople & Directors)

### Fields to Add to EACH Salesperson/Director:

| Field Name | Type | Default | Description |
|------------|------|---------|-------------|
| `sales_director_id` | string | null | Who recruited this salesperson (if they are salesperson) |
| `total_salesperson_commission` | number | 0 | Lifetime earnings as salesperson |
| `total_sales_director_commission` | number | 0 | Lifetime earnings as director |
| `monthly_commission_total` | number | 0 | Current month total (both roles combined) |
| `ytd_commission_total` | number | 0 | Year-to-date total (both roles) |
| `unpaid_commission_balance` | number | 0 | Amount owed but not paid |

**Impact if Missing:** Sales team won't see earnings, hierarchy won't work

---

## NEW Collections to Create

### 1. `commission_policies` (Admin Settings)

**Create ONE default policy document:**

```javascript
{
  id: "default",
  policy_name: "Default Commission Split",
  church_percentage: 10,
  salesperson_percentage: 5,
  sales_director_percentage: 30,
  kingdom_connect_percentage: 55,
  active: true,
  created_at: [timestamp],
  updated_at: [timestamp]
}
```

### 2. `commission_ledger` (Auto-created by system)

**Structure** (Each Pro payment creates 4 separate documents):

```javascript
// Document: payment_[stripe_id]_church_[church_id]
{
  payment_id: "stripe_payment_id",
  business_id: "business_doc_id",
  recipient_type: "church",
  recipient_id: "church_uid",
  amount: 0.90,
  pro_amount: 8.99,
  status: "pending",
  billing_date: [timestamp],
  created_at: [timestamp]
}

// Document: payment_[stripe_id]_salesperson_[user_id]
{
  payment_id: "stripe_payment_id",
  business_id: "business_doc_id",
  recipient_type: "salesperson",
  recipient_id: "user_uid",
  amount: 0.45,
  pro_amount: 8.99,
  status: "pending",
  billing_date: [timestamp],
  created_at: [timestamp]
}

// Document: payment_[stripe_id]_director_[user_id]
{
  payment_id: "stripe_payment_id",
  business_id: "business_doc_id",
  recipient_type: "sales_director",
  recipient_id: "user_uid",
  amount: 2.70,
  pro_amount: 8.99,
  status: "pending",
  billing_date: [timestamp],
  created_at: [timestamp]
}

// Document: payment_[stripe_id]_kc
{
  payment_id: "stripe_payment_id",
  business_id: "business_doc_id",
  recipient_type: "kingdom_connect",
  recipient_id: null,
  amount: 4.94,
  pro_amount: 8.99,
  status: "paid",
  billing_date: [timestamp],
  created_at: [timestamp]
}
```

### 3. `commission_balances` (Auto-maintained by system)

**Structure** (auto-created per recipient):
```javascript
{
  id: "church_[church_id]" or "user_[user_id]",
  recipient_type: "church" | "salesperson" | "sales_director",
  recipient_id: "uid",
  unpaid_balance: 0,
  paid_total: 0,
  last_payout_date: null,
  updated_at: [timestamp]
}
```

---

## Manual Population Steps

### Step 1: Add Fields to Existing Documents

**Via Firebase Console:**

1. Go to Firestore Database
2. Select `business_listings` collection
3. For EACH business document:
   - Click "Add field"
   - Add: `home_church_id` (string) - paste church UID
   - Add: `referring_salesperson_id` (string) - paste salesperson UID
   - Add: `sales_director_id` (string) - paste director UID

4. Repeat for `churches` collection (add commission fields with 0 values)
5. Repeat for `users` collection (add sales fields)

### Step 2: Create Default Commission Policy

1. Create `commission_policies` collection
2. Add document with ID "default"
3. Add all percentage fields

### Step 3: Verify Hierarchy

**Create a mapping spreadsheet:**

| Business Name | Home Church ID | Salesperson ID | Director ID |
|---------------|----------------|----------------|-------------|
| Bob's Bakery  | [church_uid]   | [user_uid]     | [user_uid]  |
| ...           | ...            | ...            | ...         |

---

## Testing Checklist

- [ ] All businesses have `home_church_id`
- [ ] All businesses have `referring_salesperson_id`
- [ ] All businesses have `sales_director_id`
- [ ] All churches have commission fields (set to 0)
- [ ] All sales users have commission fields (set to 0)
- [ ] Default commission policy exists
- [ ] Test Pro payment creates 4 ledger entries
- [ ] Test commission balances update correctly

---

**Last Updated:** November 9, 2025
**Status:** Fields documented, awaiting manual population
