# QR Gear - Firebase/Firestore Database Schema

Firestore schema reference. Sections explicitly marked **planned** document approved relationships; they do not describe deployed collections or completed features.

---

## Marketplace publishing records — sandbox wiring

Existing collections remain the publishing contract; there is no second catalog or seller credential store.

| Collection | Identity and ownership | Fields used by the shared publishing path |
|---|---|---|
| `surfaces` | `masterProductId` is the existing source `admin_catalog_instances` document ID; `sku` must match that instance's canonical QRG identity. | Listing content, `retailPrice`, currency, enabled platforms and existing marketplace settings. `colors`, `sizes`, `options` retain the normalized product choices for review. `readinessErrors` reports blocked or missing selections. These projections do not allocate identities or create variant combinations. |
| `surfaceVariants` | Existing children reference `surfaceId`. | Existing variant contract is retained. Provider variation payloads are not implemented; these records must not be silently dropped during publication. |
| `marketplaceAccounts` | Selected account ID and platform own OAuth seller/shop credentials. | Server reads existing platform-specific connected state, seller/shop IDs and refresh tokens. Rotated Etsy refresh tokens are stored here only. Account list responses omit token/secret/verifier fields. |
| `marketplaceListings` | One record per surface/account. New IDs are deterministic hashes of that pair; existing canonical IDs are reused. | `surfaceId`, `accountId`, `platform`, `qrgCode`, `marketplaceSku`, `productInstanceId`, title, price, status, external identity/URL and latest job reference. `publishOptions` retains Etsy taxonomy/shipping/return policy IDs and maker/era selections for retries. `externalCreateAttempted` prevents blind recreation when Etsy's POST outcome is unknown and no external ID is saved. |
| `marketplaceSyncJobs` | Each explicit attempt references the same listing, surface, account, platform and QRG identity. | Queued → running → completed/failed, attempts, timestamps, provider result and error. A listing lock prevents overlapping jobs. Failed jobs are not automatically retried; an explicit retry creates an auditable new attempt. |
| `marketplaceSyncLogs` | Written by the shared job service, linked to job/listing/account/platform. | Level, message and creation time. No seller tokens, request headers or credentials in job/log records. |

Amazon acceptance records a Pending listing; an Etsy draft stays Draft. Only a confirmed active provider result records an Active listing and Published surface. Unsupported variation publication and remote delisting fail visibly. Legacy surface push histories are read only for existing external identity reconciliation; all new outcomes go through listings/jobs/logs. Existing data is not bulk migrated or deleted by these code changes.

---

## Partner Member Storefronts and Builders — planned

**Owner direction: October 7, 2026.** A partner website such as Kingdom Connects will give each of its members access to their own mini storefront and builder. This is the foundation for the second integration push. The partner-site experience is not implemented by this documentation change.

### Identity and relationships

A partner site can have many member storefronts. A member storefront is scoped by **both the partner identity and the member identity**. Neither ID substitutes for the other. Its store/channel destination remains a separate reference to the existing store system.

| Reference | Meaning | Existing contract and intended connection |
|---|---|---|
| Partner identity | The participating website/organization | Reuse the existing partner record. `partnerStoreId` already denotes a partner reference in `shared/schema-stores.ts`; reconcile the current `partnerStores` / `partner_stores` route mismatch before implementing the member binding. Do not create another partner registry. |
| `memberId` | The individual whose mini storefront and builder are being accessed | Reuse the authenticated QR Gear member identity and `member_profiles` record. A partner-local user ID must be scoped to that partner and securely mapped to this identity; do not assume Firebase UIDs match across projects. |
| `storeId`, `channelId` | Where that member's products are placed | Reference existing store/channel records. A partner's store ID and a member's destination store ID must not be assumed to be interchangeable. |
| `builderHostId`, `builderProfileId`, `builderPlacementId` | Website integration settings, editing permissions and placement | Reuse the existing contracts in `shared/surfaces.ts`. Link the website configuration to its partner and member context instead of creating a separate builder or copying partner/member records. |
| Product, build and asset references | Products offered and work saved by that member | Reuse canonical QRG instances, existing builder snapshots/sessions, BLD structures, GRF assets and Assembly bindings. Provider tables remain lookup inputs. |
| Sales attribution | The partner and member associated with a sale | Preserve the verified partner/member context through checkout. Keep storefront ownership, buyer identity and `affiliateUserId` distinct; earning eligibility and amounts come from the applicable existing pricing/revenue rules. A member reference alone does not award a commission. |

These are relationship requirements, not a new collection definition or a claim that all fields already coexist in one record. The persistent member-to-partner binding must be implemented once, using the existing records and shared schema after the current route inconsistencies are resolved.

### Access and ownership

- Each member accesses their own storefront management, builder sessions and saved work within the selected partner context. Reading a public storefront is separate from permission to edit it.
- Validate the authenticated member, partner relationship and destination on the server. IDs passed in a URL identify context; they do not grant access. Unknown or mismatched relationships must fail visibly.
- Resolve host, profile and placement permissions through the existing integration layer. The host's `ownerUserId` identifies the website owner and must not stand in for every member on that website.
- Use references to shared products/assets and the existing create, save, placement and reviewed-deletion services. Do not create a parallel catalog, builder, identity allocator or orphan-cleanup path for partner sites.
- Keep the partner/member relationship intact when saving, reopening, placing products and recording orders. Changing or removing a relationship must not transfer another member's work or delete shared assets implicitly.

### Current implementation boundary

`shared/schema-stores.ts` describes partner data; `shared/surfaces.ts` describes host/profile/placement/session contracts; existing member routes authenticate `memberId`. Those pieces do **not** yet form a completed per-partner member storefront flow. In particular, a host owner or affiliate field is not a complete member ownership binding.

This section records the intended relationship only. No collection, field migration, security rule, endpoint or runtime behavior is introduced here. Per-member provisioning, partner identity mapping, the external storefront/builder interface and full end-to-end verification belong to the second integration push. Current work is limited to schema consistency and wiring defects. BLD.md, GRF.md, QRG.md and ASSEMBLY.md retain their existing authority and identity rules.

---

## Collection: `users`

**Path:** `/users/{userId}`

### Fields:

| Field Name | Type | Required | Description | Example |
|------------|------|----------|-------------|---------|
| `id` | string | ✅ | User's unique ID (from Firebase Auth UID) | `"abc123xyz"` |
| `email` | string | ✅ | User's email address | `"john@example.com"` |
| `displayName` | string | ❌ | User's display name | `"John Smith"` |
| `photoUrl` | string | ❌ | Profile photo URL | `"https://..."` |
| `createdAt` | timestamp | ✅ | Account creation date | Firebase `Timestamp` |

### Indexes:
- `email` (ascending)

---

## Collection: `qrDesigns`

**Path:** `/qrDesigns/{designId}`

Stores user's saved QR code designs before ordering.

### Fields:

| Field Name | Type | Required | Description | Example |
|------------|------|----------|-------------|---------|
| `id` | string | ✅ | Auto-generated design ID | `"qr_abc123"` |
| `userId` | string | ✅ | Reference to user who created this | `"abc123xyz"` |
| `name` | string | ✅ | Design name (user-defined) | `"Business Card QR"` |
| `qrType` | string | ✅ | Type: `"text"` or `"image"` | `"text"` |
| `qrContent` | string | ✅ | Text content OR image URL | `"https://kingdomconnects.com/..."` |
| `qrStyle` | map | ✅ | QR code styling preferences | See below ⬇️ |
| `productId` | string | ❌ | Printify product ID | `"prod_abc123"` |
| `placement` | string | ✅ | Where QR goes on product | `"front-chest"`, `"back"`, `"left-sleeve"` |
| `productColor` | string | ❌ | Product color choice | `"black"`, `"white"` |
| `manufacturer` | string | ❌ | Product manufacturer name | `"Gildan"`, `"Next Level"` |
| `madeInUSA` | boolean | ❌ | Is product made in USA? | `true` / `false` |
| `previewUrl` | string | ❌ | URL to preview image | `"https://..."` |
| `createdAt` | timestamp | ✅ | Design creation date | Firebase `Timestamp` |
| `updatedAt` | timestamp | ✅ | Last modified date | Firebase `Timestamp` |

### `qrStyle` Map Structure:
```javascript
{
  color: "#1e40af",           // QR code foreground color (hex)
  backgroundColor: "#ffffff", // QR code background color (hex)
  logoUrl: "https://..."      // Optional: business logo overlay on QR
}
```

### Indexes:
- `userId` (ascending)
- `createdAt` (descending)

---

## Collection: `products`

**Path:** `/products/{productId}`

Product catalog from Printify.

### Fields:

| Field Name | Type | Required | Description | Example |
|------------|------|----------|-------------|---------|
| `id` | string | ✅ | QR Gear product ID | `"prod_abc123"` |
| `printifyId` | string | ❌ | Printify's product ID | `"12345"` |
| `name` | string | ✅ | Product name | `"Unisex T-Shirt"` |
| `description` | string | ❌ | Product description | `"Soft cotton tee..."` |
| `category` | string | ✅ | Product category | `"apparel"`, `"accessories"`, `"drinkware"` |
| `basePrice` | number | ✅ | Base price in USD | `19.99` |
| `imageUrl` | string | ❌ | Product image URL | `"https://..."` |
| `manufacturer` | string | ❌ | Manufacturer name | `"Gildan"` |
| `madeInUSA` | boolean | ❌ | Made in USA? | `true` / `false` |
| `availablePlacements` | array | ❌ | Where QR codes can be placed | `["front-chest", "back", "left-sleeve"]` |
| `availableColors` | array | ❌ | Color options | See below ⬇️ |
| `metadata` | map | ❌ | Additional Printify metadata | `{}` |
| `createdAt` | timestamp | ✅ | Product added date | Firebase `Timestamp` |
| `updatedAt` | timestamp | ✅ | Last updated date | Firebase `Timestamp` |

### `availableColors` Array Structure:
```javascript
[
  { name: "White", hex: "#FFFFFF" },
  { name: "Black", hex: "#000000" },
  { name: "Navy", hex: "#001F3F" }
]
```

### Indexes:
- `category` (ascending)
- `madeInUSA` (ascending)
- `basePrice` (ascending)

---

## Collection: `cartItems`

**Path:** `/cartItems/{cartItemId}`

User's shopping cart items.

### Fields:

| Field Name | Type | Required | Description | Example |
|------------|------|----------|-------------|---------|
| `id` | string | ✅ | Auto-generated cart item ID | `"cart_abc123"` |
| `userId` | string | ✅ | User who owns this cart item | `"abc123xyz"` |
| `designId` | string | ❌ | Reference to saved design (if any) | `"qr_abc123"` |
| `productId` | string | ✅ | Product being ordered | `"prod_abc123"` |
| `quantity` | number | ✅ | Quantity to order | `2` |
| `customization` | map | ✅ | Full design configuration | See below ⬇️ |
| `price` | number | ✅ | Price per unit | `24.99` |
| `createdAt` | timestamp | ✅ | Added to cart date | Firebase `Timestamp` |

### `customization` Map Structure:
```javascript
{
  qrType: "text",
  qrContent: "https://kingdomconnects.com/business/joes-plumbing",
  qrStyle: {
    color: "#1e40af",
    backgroundColor: "#ffffff"
  },
  placement: "front-chest",
  productColor: "black",
  businessLogoUrl: "https://...",  // For co-branding
  kcListingUrl: "https://...",     // For Kingdom Connects integration
  qrGearTag: true                  // Include QR Gear branding
}
```

### Indexes:
- `userId` (ascending)

---

## Collection: `orders`

**Path:** `/orders/{orderId}`

Completed orders.

### Fields:

| Field Name | Type | Required | Description | Example |
|------------|------|----------|-------------|---------|
| `id` | string | ✅ | Auto-generated order ID | `"order_abc123"` |
| `userId` | string | ✅ | User who placed the order | `"abc123xyz"` |
| `status` | string | ✅ | Order status | `"pending"`, `"processing"`, `"shipped"`, `"delivered"` |
| `totalAmount` | number | ✅ | Total order amount in USD | `89.97` |
| `stripePaymentId` | string | ❌ | Stripe payment intent ID | `"pi_abc123"` |
| `printifyOrderId` | string | ❌ | Printify order ID | `"12345"` |
| `shippingAddress` | map | ✅ | Shipping address details | See below ⬇️ |
| `trackingNumber` | string | ❌ | USPS/UPS/FedEx tracking | `"1Z999AA10123456784"` |
| `createdAt` | timestamp | ✅ | Order placed date | Firebase `Timestamp` |
| `updatedAt` | timestamp | ✅ | Last status update | Firebase `Timestamp` |

### `shippingAddress` Map Structure:
```javascript
{
  name: "John Smith",
  address1: "123 Main St",
  address2: "Apt 4B",        // Optional
  city: "Springfield",
  state: "IL",
  zipCode: "62701",
  country: "US",
  phone: "+1234567890"       // Optional
}
```

### Indexes:
- `userId` (ascending)
- `status` (ascending)
- `createdAt` (descending)

---

## Collection: `orderItems`

**Path:** `/orderItems/{orderItemId}`

Individual items within an order.

### Fields:

| Field Name | Type | Required | Description | Example |
|------------|------|----------|-------------|---------|
| `id` | string | ✅ | Auto-generated item ID | `"item_abc123"` |
| `orderId` | string | ✅ | Parent order ID | `"order_abc123"` |
| `productId` | string | ✅ | Product ordered | `"prod_abc123"` |
| `quantity` | number | ✅ | Quantity ordered | `2` |
| `customization` | map | ✅ | Design used for this item | Same as `cartItems.customization` |
| `price` | number | ✅ | Price per unit at time of order | `24.99` |
| `printifyItemId` | string | ❌ | Printify line item ID | `"67890"` |

### Indexes:
- `orderId` (ascending)

---

## Security Rules (Firestore Rules)

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    // Users can only read/write their own user document
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
    
    // Users can only read/write their own designs
    match /qrDesigns/{designId} {
      allow read, write: if request.auth != null && 
                           resource.data.userId == request.auth.uid;
      allow create: if request.auth != null;
    }
    
    // Products are read-only for all authenticated users
    match /products/{productId} {
      allow read: if request.auth != null;
      allow write: if false; // Only admins via Firebase Admin SDK
    }
    
    // Cart items - users can only access their own
    match /cartItems/{cartItemId} {
      allow read, write: if request.auth != null && 
                           resource.data.userId == request.auth.uid;
      allow create: if request.auth != null;
    }
    
    // Orders - users can only read their own
    match /orders/{orderId} {
      allow read: if request.auth != null && 
                    resource.data.userId == request.auth.uid;
      allow create: if request.auth != null;
      allow update: if false; // Only backend can update order status
    }
    
    // Order items - readable if user owns parent order
    match /orderItems/{itemId} {
      allow read: if request.auth != null && 
                    exists(/databases/$(database)/documents/orders/$(resource.data.orderId)) &&
                    get(/databases/$(database)/documents/orders/$(resource.data.orderId)).data.userId == request.auth.uid;
      allow write: if false; // Only backend can write
    }
  }
}
```

---

## Initial Seed Data

### Sample Products (add these manually in Firebase Console):

```javascript
// Product 1: T-Shirt
{
  id: "prod_tshirt_001",
  printifyId: null,
  name: "Unisex Premium T-Shirt",
  description: "Soft, comfortable cotton blend tee perfect for everyday wear",
  category: "apparel",
  basePrice: 24.99,
  imageUrl: "https://via.placeholder.com/400x400.png?text=T-Shirt",
  manufacturer: "Gildan",
  madeInUSA: true,
  availablePlacements: ["front-chest", "front-pocket", "back", "left-sleeve", "right-sleeve"],
  availableColors: [
    { name: "White", hex: "#FFFFFF" },
    { name: "Black", hex: "#000000" },
    { name: "Navy", hex: "#001F3F" },
    { name: "Red", hex: "#FF4136" }
  ],
  metadata: {},
  createdAt: Firebase.firestore.FieldValue.serverTimestamp(),
  updatedAt: Firebase.firestore.FieldValue.serverTimestamp()
}

// Product 2: Baseball Cap
{
  id: "prod_cap_001",
  printifyId: null,
  name: "Adjustable Baseball Cap",
  description: "Classic 6-panel cap with adjustable strap",
  category: "accessories",
  basePrice: 19.99,
  imageUrl: "https://via.placeholder.com/400x400.png?text=Cap",
  manufacturer: "Yupoong",
  madeInUSA: true,
  availablePlacements: ["front-center", "back-center", "side-left", "side-right"],
  availableColors: [
    { name: "Black", hex: "#000000" },
    { name: "Navy", hex: "#001F3F" },
    { name: "Red", hex: "#FF4136" }
  ],
  metadata: {},
  createdAt: Firebase.firestore.FieldValue.serverTimestamp(),
  updatedAt: Firebase.firestore.FieldValue.serverTimestamp()
}

// Product 3: Coffee Mug
{
  id: "prod_mug_001",
  printifyId: null,
  name: "Ceramic Coffee Mug 11oz",
  description: "Durable ceramic mug, dishwasher and microwave safe",
  category: "drinkware",
  basePrice: 14.99,
  imageUrl: "https://via.placeholder.com/400x400.png?text=Mug",
  manufacturer: "Orca Coatings",
  madeInUSA: true,
  availablePlacements: ["wrap-around", "front-only"],
  availableColors: [
    { name: "White", hex: "#FFFFFF" },
    { name: "Black", hex: "#000000" }
  ],
  metadata: {},
  createdAt: Firebase.firestore.FieldValue.serverTimestamp(),
  updatedAt: Firebase.firestore.FieldValue.serverTimestamp()
}
```

---

## Environment Variables Needed

Add these to your Replit Secrets:

```bash
# Firebase Configuration
VITE_FIREBASE_API_KEY="your-api-key"
VITE_FIREBASE_AUTH_DOMAIN="your-project.firebaseapp.com"
VITE_FIREBASE_PROJECT_ID="your-project-id"
VITE_FIREBASE_STORAGE_BUCKET="your-project.appspot.com"
VITE_FIREBASE_MESSAGING_SENDER_ID="123456789"
VITE_FIREBASE_APP_ID="1:123456789:web:abc123"

# QR Gear Widget JWT Secret (for Kingdom Connects integration)
WIDGET_JWT_SECRET="your-secret-key-change-this-in-production"

# Stripe (for payments)
STRIPE_SECRET_KEY="sk_test_..."
VITE_STRIPE_PUBLIC_KEY="pk_test_..."

# Printify (for fulfillment)
PRINTIFY_API_KEY="your-printify-api-key"
PRINTIFY_SHOP_ID="your-shop-id"
```

---

## Firebase Authentication Setup

1. **Enable Email/Password Authentication:**
   - Go to Firebase Console → Authentication → Sign-in method
   - Enable "Email/Password"

2. **Optional - Enable Google Sign-In:**
   - Enable "Google" provider
   - Configure OAuth consent screen

3. **Create First Test User:**
   ```
   Email: test@qrgear.com
   Password: TestUser123!
   ```

---

## Notes

- All timestamps use Firebase's `serverTimestamp()` for consistency
- IDs are auto-generated strings (not Firestore auto-IDs) for PostgreSQL compatibility
- JSONB fields in PostgreSQL map to `map` type in Firestore
- Arrays in PostgreSQL map to `array` type in Firestore
- Decimal prices stored as `number` in Firestore (careful with float precision!)

---

**Ready to copy-paste into Firebase Console!** 🔥
