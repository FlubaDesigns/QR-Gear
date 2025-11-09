# Category System Schema Documentation

## Overview
Kingdom Connects uses a dynamic category system where categories are stored in Firestore and can be expanded through business owner suggestions and admin approval.

## Collections

### 1. `categories` Collection
Stores all available business categories for the platform.

**Document ID:** `{category_slug}` (e.g., "plumbing", "it-services")

**Fields:**
- `slug` (string, required): URL-friendly identifier (e.g., "plumbing", "it-services")
- `label` (string, required): Display name (e.g., "Plumbing Services", "IT & Computer Services")
- `display_order` (number, required): Sort order for dropdown display (1-999)
- `active` (boolean, required): Whether category is currently available for selection
- `created_at` (timestamp, required): When category was created
- `created_by` (string, required): User ID or "migration" or "suggestion-approved"
- `type` (string, required): Category type - "general" for standard categories, "custom" for approved suggestions
- `description` (string, optional): Detailed description of what businesses fit this category

**Indexes:**
- `active, display_order` (for efficient dropdown loading)

**Example Document:**
```json
{
  "slug": "plumbing",
  "label": "Plumbing Services",
  "display_order": 5,
  "active": true,
  "created_at": "2025-11-08T10:00:00Z",
  "created_by": "migration",
  "type": "general",
  "description": "Residential and commercial plumbing services"
}
```

---

### 2. `category_suggestions` Collection
Stores category suggestions submitted by business owners for admin review.

**Document ID:** Auto-generated

**Fields:**
- `suggested_by` (string, required): User ID of the business owner who suggested
- `business_id` (string, optional): Business listing ID if submitted from specific business context
- `suggested_slug` (string, required): Proposed category slug
- `suggested_label` (string, required): Proposed display name
- `description` (string, required): Why this category is needed / what businesses it serves
- `status` (string, required): "pending" | "approved" | "denied"
- `created_at` (timestamp, required): When suggestion was submitted
- `reviewed_at` (timestamp, optional): When admin made decision
- `reviewed_by` (string, optional): Admin user ID who reviewed
- `admin_feedback` (string, optional): Admin's message to business owner
- `approved_category_slug` (string, optional): Final slug used if approved (may differ from suggested)

**Indexes:**
- `status, created_at` (for admin queue sorting)
- `suggested_by, created_at` (for business owner's "My Suggestions" view)

**Example Document (Pending):**
```json
{
  "suggested_by": "user_abc123",
  "business_id": "biz_xyz789",
  "suggested_slug": "mobile-car-wash",
  "suggested_label": "Mobile Car Wash Services",
  "description": "There are many mobile car wash services in our area but no specific category. This would help customers find mobile detailing and washing services.",
  "status": "pending",
  "created_at": "2025-11-08T14:30:00Z"
}
```

**Example Document (Approved):**
```json
{
  "suggested_by": "user_abc123",
  "business_id": "biz_xyz789",
  "suggested_slug": "mobile-car-wash",
  "suggested_label": "Mobile Car Wash Services",
  "description": "There are many mobile car wash services...",
  "status": "approved",
  "created_at": "2025-11-08T14:30:00Z",
  "reviewed_at": "2025-11-08T16:45:00Z",
  "reviewed_by": "admin_def456",
  "admin_feedback": "Great suggestion! We've added this as a new category.",
  "approved_category_slug": "mobile-car-wash"
}
```

**Example Document (Denied):**
```json
{
  "suggested_by": "user_abc123",
  "suggested_slug": "cryptocurrency-mining",
  "suggested_label": "Cryptocurrency Mining",
  "description": "Growing industry that needs representation",
  "status": "denied",
  "created_at": "2025-11-08T14:30:00Z",
  "reviewed_at": "2025-11-08T15:00:00Z",
  "reviewed_by": "admin_def456",
  "admin_feedback": "Thank you for your suggestion. At this time, we're focusing on traditional service-based businesses that align with our faith-based community values."
}
```

---

## Workflow

### Business Owner Suggests Category
1. Business owner fills out suggestion form (business-admin dashboard)
2. System creates document in `category_suggestions` with `status: "pending"`
3. Business owner can view their suggestions and status

### Admin Reviews Suggestion
1. Admin views pending suggestions in admin dashboard
2. Admin can:
   - **Approve:** Suggestion is marked `approved`, new document created in `categories` collection
   - **Deny:** Suggestion marked `denied` with feedback
3. Business owner sees updated status and admin feedback

### Category Becomes Available
1. When approved, category is automatically added to `categories` collection
2. All dropdown menus load from `categories` collection dynamically
3. New category immediately available site-wide

---

## Migration Notes

**Initial Migration:**
- 44 original categories migrated from hardcoded HTML to Firestore
- Use `admin/migrate_categories.html` tool (run once)
- All original categories have `created_by: "migration"` and `type: "general"`

**Future Categories:**
- Approved suggestions have `created_by: "suggestion-approved"` and `type: "custom"`
- Can be manually added by admin with `created_by: {admin_user_id}` and `type: "general"`
