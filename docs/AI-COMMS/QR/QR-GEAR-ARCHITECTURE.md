# QR Gear Architecture Reference
**Use this document to understand QR Gear technical patterns**

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 18 + TypeScript + Vite |
| Styling | Tailwind CSS + shadcn/ui |
| State | TanStack React Query |
| Forms | React Hook Form + Zod |
| Backend | Node.js + Express |
| Database | PostgreSQL (Neon serverless) |
| ORM | Drizzle ORM |
| Auth | Replit Auth |
| Storage | Replit Object Storage |
| Payments | Stripe |
| Fulfillment | Printify API |

---

## Database Schema (Key Tables)

```sql
-- Users (Replit Auth)
users (
  id TEXT PRIMARY KEY,
  email TEXT,
  first_name TEXT,
  last_name TEXT,
  profile_image_url TEXT,
  role TEXT DEFAULT 'customer',
  created_at TIMESTAMP
)

-- Library assets (backgrounds, videos)
library_assets (
  id TEXT PRIMARY KEY,
  owner_type TEXT,  -- 'admin' | 'user'
  user_id TEXT,
  asset_type TEXT,  -- 'background' | 'design' | 'template'
  media_type TEXT,  -- 'image' | 'video'
  name TEXT,
  storage_url TEXT,
  public_url TEXT,
  season TEXT,      -- 'spring' | 'summer' | 'fall' | 'winter'
  event TEXT,       -- 'christmas' | 'easter' | etc.
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP
)

-- Products (synced from Printify)
products (
  id TEXT PRIMARY KEY,
  name TEXT,
  description TEXT,
  base_price TEXT,
  image_url TEXT,
  category TEXT,
  printify_blueprint_id INTEGER,
  is_active BOOLEAN
)

-- QR Designs (customer customizations)
qr_designs (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  header_text TEXT,
  footer_text TEXT,
  qr_url TEXT,
  background_image_url TEXT,
  hosting_tier_id TEXT
)
```

---

## API Endpoints

### Widget (For KC Integration)
```
POST /api/widget/token     - Generate JWT for widget embedding
GET  /api/widget/session   - Get widget data + pre-generated QR
```

### Library (Admin)
```
GET    /api/admin/library/admin?assetType=background&season=winter
POST   /api/admin/library/upload  - Multipart form upload
PUT    /api/admin/library/:id
DELETE /api/admin/library/:id
```

### Products
```
GET /api/products           - List all products
GET /api/products/:id       - Product detail
GET /api/admin/catalog/sync - Sync from Printify
```

---

## Field Naming Convention

We use camelCase in TypeScript but snake_case in database:
```typescript
// TypeScript interface
interface LibraryAsset {
  id: string;
  ownerType: string;    // Maps to owner_type in DB
  assetType: string;    // Maps to asset_type in DB
  mediaType: string;    // Maps to media_type in DB
}
```

Drizzle ORM handles the mapping automatically.

---

## Widget JWT Payload

```typescript
interface WidgetTokenPayload {
  businessId: string;
  businessName: string;
  businessLogoUrl?: string;
  kcListingUrl: string;
  iat?: number;  // Issued at
  exp?: number;  // Expires
}
```

---

## Storage Structure

```
library/
├── admin/
│   ├── backgrounds/     # Admin backgrounds
│   ├── designs/         # Pre-made designs
│   └── videos/          # Video backgrounds
└── users/
    └── {userId}/
        ├── backgrounds/
        └── videos/
```

---

## Key Differences from KC

| Aspect | KC | QR Gear |
|--------|----|---------| 
| Auth | Firebase Auth | Replit Auth |
| Database | Firestore (NoSQL) | PostgreSQL (SQL) |
| Field naming | snake_case | camelCase (TS) / snake_case (DB) |
| CSS | Vanilla modular | Tailwind + shadcn |
| JS Framework | Vanilla ES6 | React 18 |

---

*Last updated: December 24, 2025*
