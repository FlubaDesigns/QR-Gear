# Firestore Security Rules Documentation

## 🔒 Security Overview

These rules protect all sensitive data in Kingdom Connects with role-based access control.

## Critical Data Protection

### 🛡️ **Customer Data (users collection)**
- Users can ONLY see their own profile data
- Users CANNOT change their own role (prevents privilege escalation)
- Only admins can delete user accounts
- **EMAIL, PHONE, PERSONAL INFO**: Protected from other users

### ⛪ **Church Data (churches collection)**
- Public can read active churches (directory listing)
- Church admins can ONLY edit their own church
- Only admins can create/delete churches
- **CHURCH CONTACT INFO, FINANCIALS**: Protected

### 💰 **Sales Data (MAXIMUM PROTECTION)**
- **Commissions subcollection**: Only visible to the sales agent who earned it + admins
- **Sales Analytics subcollection**: Only the sales agent + admins
- **Payments collection**: Only the customer who paid + admins
- NO ONE else can see commission amounts, sales data, or payment details

## Role-Based Permissions

### **Admin (role: 'admin')**
- Full access to everything
- Can manage users, churches, businesses
- Can approve/deny category suggestions
- Can view all financial data

### **Church Admin (role: 'church-admin')**
- Can edit their own church profile
- Can view businesses associated with their church
- Cannot access other churches' data

### **Business Admin (role: 'business-admin')**
- Can create and edit their own business listing
- Can submit category suggestions
- Can respond to reviews of their business
- Cannot see other businesses' private data

### **Sales Agent (role: 'sales')**
- Can view their own commission records
- Can view their own sales analytics
- Cannot see other agents' earnings

### **Regular User**
- Can create account
- Can view public directory (businesses & churches)
- Can submit reviews
- Can view their own data only

## Collection-by-Collection Breakdown

### 1. **users** (Customer/User Data)
```
✅ Read: Own data OR admin
✅ Create: Own account (ONLY with role='user' - prevents privilege escalation)
✅ Update: Own data (EXCEPT protected fields) OR admin
✅ Delete: Admin only

🔒 SECURITY PROTECTIONS:
- Users cannot create accounts with admin/church-admin/business-admin roles
- Users cannot change: role, church_id, managed_business_ids, sales_agent_id
- Only admins can assign users to churches or change roles
```

### 2. **churches** (Church Information)
```
✅ Read: Public (if active) OR admin
✅ Create: Admin only
✅ Update: Church admin (own church) OR admin
✅ Delete: Admin only
```

### 3. **business_listings** (Business Data)
```
✅ Read: Public (if active) OR owner OR admin
✅ Create: Authenticated users
✅ Update: Owner OR admin
✅ Delete: Admin only

  Subcollections:
  - commissions: Owner sales agent OR admin (READ/WRITE)
  - salesAnalytics: Owner sales agent OR admin (READ), Admin only (WRITE)
```

### 4. **reviews** (Customer Reviews)
```
✅ Read: Public (if approved) OR review author OR admin
✅ Create: Authenticated users
✅ Update: Author (if pending) OR business owner (ONLY their own business reviews) OR admin
✅ Delete: Admin only

🔒 SECURITY: Business owners can ONLY respond to reviews of businesses they own
```

### 5. **categories** (Business Categories)
```
✅ Read: Anyone (if active)
✅ Create: Admin only
✅ Update: Admin only
✅ Delete: Admin only
```

### 6. **category_suggestions** (Business Owner Suggestions)
```
✅ Read: Suggester OR admin
✅ Create: Business owners (own suggestions)
✅ Update: Admin only (for approval/denial)
✅ Delete: Admin only
```

### 7. **payments** (Payment Records - HIGHLY SENSITIVE)
```
✅ Read: Customer who paid OR admin
✅ Create: Admin ONLY (server-side via Cloud Functions after Stripe webhook)
✅ Update: Admin only
✅ Delete: Admin only

🔒 CRITICAL SECURITY:
- Clients CANNOT create payment records (prevents fraud/fabrication)
- All payments must be created server-side after Stripe confirms payment
- Use Cloud Functions with Admin SDK to create payment records
- This prevents users from bypassing Pro subscription paywall
```

### 8. **activity_log** (System Logs)
```
✅ Read: Admin only
✅ Create: System/authenticated users
✅ Update/Delete: Admin only
```

### 9. **factoids** (Homepage Facts)
```
✅ Read: Anyone (if active)
✅ Create/Update/Delete: Admin only
```

## How to Deploy These Rules

### **Option 1: Firebase Console (Easiest for mobile)**
1. Go to: https://console.firebase.google.com
2. Select your project: `kingdom-connects`
3. Click **Firestore Database** in left menu
4. Click **Rules** tab at the top
5. Copy the entire contents of `firestore.rules` file
6. Paste into the rules editor
7. Click **Publish**

### **Option 2: Firebase CLI (Desktop)**
```bash
firebase deploy --only firestore:rules
```

## Testing Security Rules

After deploying, test these scenarios:

### ✅ **Should Work:**
- Regular user viewing public business directory
- Business owner editing their own listing
- Church admin editing their own church
- Sales agent viewing their own commissions
- Admin viewing everything

### ❌ **Should Be Blocked:**
- User trying to view another user's email/phone
- Business owner trying to edit another business
- Church admin trying to edit another church
- Sales agent trying to view another agent's commissions
- Regular user trying to approve category suggestions

## Security Best Practices

1. **Never store sensitive data in client-side code**
2. **Always validate user roles on the server side** (rules are last line of defense)
3. **Use Firebase Auth** for all user authentication
4. **Log sensitive operations** to activity_log collection
5. **Regularly review the activity_log** for suspicious activity

## Common Security Scenarios

### **Scenario 1: User tries to make themselves admin**
```javascript
// This will FAIL due to rules
await updateDoc(doc(db, 'users', userId), {
  role: 'admin'  // ❌ Blocked! Users can't change their own role
});
```

### **Scenario 2: Sales agent tries to view another agent's commission**
```javascript
// This will FAIL
const commissionRef = doc(db, 'business_listings/ABC/commissions/XYZ');
await getDoc(commissionRef);  // ❌ Blocked! Only owner or admin
```

### **Scenario 3: Non-admin tries to approve category**
```javascript
// This will FAIL
await setDoc(doc(db, 'categories', 'new-category'), {...});
// ❌ Blocked! Only admins can create categories
```

## Emergency Access

If you need to make emergency changes:
1. Go to Firebase Console
2. Use the Firebase Console interface (bypasses rules for project owners)
3. Or temporarily modify rules (NOT RECOMMENDED for production)

## Questions?

If you encounter permission denied errors:
1. Check the browser console for the exact error
2. Verify the user's role in the `users` collection
3. Confirm the user is properly authenticated
4. Check that the data being accessed matches the ownership rules

---

**Last Updated**: November 2025  
**Rules Version**: 2  
**Status**: Ready for production deployment
