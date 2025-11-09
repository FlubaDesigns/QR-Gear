# QR Gear - Firebase/Firestore Database Schema

Complete schema for setting up Firestore collections in Firebase Console.

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
