# QR Gear - Firestore Data Model

## Migration Strategy
Phased migration from Postgres to Firestore. Data structures are designed as portable JSON blobs.

## Collection Mapping

### Tier 1: Core Business (Migrate First)
These are essential for the site to function.

| Postgres Table | Firestore Collection | Document ID Strategy |
|----------------|---------------------|----------------------|
| `users` | `users` | Firebase Auth UID |
| `products` | `products` | Keep existing ID (e.g., `custom_hello-world-1`) |
| `custom_designs` | `customDesigns` | Keep existing ID (slugified name) |
| `orders` | `orders` | Auto-generated |
| `order_items` | `orders/{orderId}/items` | Subcollection |
| `cart_items` | `carts/{sessionId}/items` | Subcollection |

### Tier 2: Product Configuration
| Postgres Table | Firestore Collection | Notes |
|----------------|---------------------|-------|
| `product_categories_lookup` | `productCategories` | Small, rarely changes |
| `product_variants` | `products/{productId}/variants` | Subcollection |
| `qr_templates` | `qrTemplates` | Background images for QR codes |
| `hosting_tiers` | `hostingTiers` | Pricing tiers |
| `coupons` | `coupons` | Discount codes |

### Tier 3: Admin & Settings
| Postgres Table | Firestore Collection | Notes |
|----------------|---------------------|-------|
| `admin_settings` | `settings` | Single document for global settings |
| `partner_stores` | `partnerStores` | Widget embed configs |
| `pricing_rules` | `pricingRules` | Margin calculations |

### Tier 4: Background Jobs & Cache
| Postgres Table | Firestore Collection | Notes |
|----------------|---------------------|-------|
| `mockup_jobs` | `mockupJobs` | Background queue for mockup generation |
| `mockup_cache` | `mockupCache` | Cached mockup URLs |
| `printify_blueprints` | `printifyBlueprints` | Catalog cache |
| `printify_print_providers` | `printifyPrintProviders` | Provider cache |

### Tier 5: Dynamic Content
| Postgres Table | Firestore Collection | Notes |
|----------------|---------------------|-------|
| `dynamic_pages` | `dynamicPages` | Landing pages for QR codes |
| `dynamic_content_sets` | `dynamicContentSets` | Cycling content |
| `dynamic_content_slots` | `dynamicContentSlots` | Time-based content |
| `library_assets` | `libraryAssets` | Uploaded images |

---

## Key Document Structures

### products/{productId}
```javascript
{
  id: "custom_hello-world-1",
  name: "Unisex Cotton Crew Tee",
  description: "...",
  basePrice: "8.77",
  customerPrice: "24.99",
  blueprintId: 5,
  printProviderId: 27,
  availableColors: [
    { name: "Solid Black", hex: "#000000" },
    { name: "Solid White", hex: "#FFFFFF" }
  ],
  availableSizes: ["S", "M", "L", "XL", "2XL"],
  defaultColor: "Solid Black",
  mockupsByColor: {
    "Solid Black": {
      front: "/api/files/mockup-...",
      lifestyle: "/api/files/mockup-...",
      qrSize: "medium"
    }
  },
  graphicsConfig: [
    {
      id: "graphic-1",
      imageUrl: "/api/files/...",
      placement: "front-chest",
      qrSize: "medium"
    }
  ],
  isFeatured: true,
  isEnabled: true,
  createdAt: Timestamp,
  updatedAt: Timestamp
}
```

### customDesigns/{designId}
```javascript
{
  id: "hello-world-1",
  projectName: "Hello World QR",
  productId: 5,
  productName: "Unisex Cotton Crew Tee",
  placements: ["front-chest"],
  placementImages: {
    "front-chest": "/api/files/...",
    "front-chest-white": "/api/files/..."
  },
  qrCodeUrl: "/api/files/...",
  blueprintId: 5,
  printProviderId: 27,
  selectedColors: ["Solid Black", "Solid White"],
  defaultColor: "Solid Black",
  mockupsByColor: { ... },
  savedToStore: true,
  savedToLibrary: false,
  createdAt: Timestamp,
  updatedAt: Timestamp
}
```

### orders/{orderId}
```javascript
{
  id: "ord_abc123",
  userId: "user_123",  // Optional for guest checkout
  sessionId: "sess_xyz",
  status: "pending",
  totalAmount: "49.98",
  shippingAddress: {
    name: "John Doe",
    address1: "123 Main St",
    city: "Austin",
    state: "TX",
    zip: "78701",
    country: "US"
  },
  printifyOrderId: "12345678",
  stripePaymentIntentId: "pi_...",
  createdAt: Timestamp
}
```

### mockupJobs/{jobId}
```javascript
{
  id: "job_abc123",
  productId: "custom_hello-world-1",
  color: "Solid Black",
  qrSize: "medium",
  placement: "front-chest",
  status: "pending",  // pending, processing, completed, failed
  attempts: 0,
  maxAttempts: 5,
  resultUrl: null,
  error: null,
  createdAt: Timestamp,
  processAt: Timestamp  // For delayed retry
}
```

---

## Indexes Required

### products
- `isFeatured` (for home page query)
- `isEnabled` (for active products)
- `blueprintId` + `printProviderId` (for catalog sync)

### mockupJobs
- `status` + `processAt` (for queue processing)
- `productId` + `status` (for product-specific job lookup)

### orders
- `userId` + `createdAt` (for order history)
- `status` (for admin dashboard)

---

## Security Rules (Draft)
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Products are publicly readable
    match /products/{productId} {
      allow read: if true;
      allow write: if request.auth != null && request.auth.token.admin == true;
    }
    
    // Orders require authentication or session matching
    match /orders/{orderId} {
      allow read: if request.auth.uid == resource.data.userId;
      allow create: if true;  // Guest checkout allowed
    }
    
    // Cart items by session
    match /carts/{sessionId}/items/{itemId} {
      allow read, write: if true;  // Session-based cart
    }
  }
}
```

---

## Migration Order
1. `users` - Base user data
2. `products` - Product catalog  
3. `customDesigns` - Design configurations
4. `productCategories` - Category lookup
5. `hostingTiers` - Pricing configuration
6. `adminSettings` - Global settings
7. `mockupJobs` - Background queue
8. `orders` + `orderItems` - Order history
9. Everything else

---

## Notes
- All JSON blob fields (`mockupsByColor`, `graphicsConfig`, etc.) transfer directly as nested objects
- Timestamps convert from Postgres to Firestore Timestamp
- File URLs remain unchanged (still point to Object Storage or Firebase Storage)
- IDs are preserved to maintain existing references
