# QR Gear Project Structure
**Generated:** December 28, 2025

---

## Root Directory
```
QR-Gear/
├── client/                    # Frontend (React + Vite)
├── server/                    # Backend (Express)
├── shared/                    # Shared types/schemas
├── docs/                      # Documentation
├── downloads/                 # Downloadable assets
├── public/                    # Static public files
├── scripts/                   # Utility scripts
├── attached_assets/           # Uploaded/generated assets
├── package.json               # Dependencies
├── vite.config.ts             # Vite configuration
├── tailwind.config.ts         # Tailwind CSS config
├── drizzle.config.ts          # Database ORM config
├── tsconfig.json              # TypeScript config
├── replit.md                  # Project reference guide
├── design_guidelines.md       # UI/UX guidelines
└── ADMIN_MANUAL.md            # Admin user guide
```

---

## Frontend Structure (client/)
```
client/
├── src/
│   ├── pages/                 # Route components (61 pages)
│   │   ├── home.tsx
│   │   ├── store.tsx
│   │   ├── creator.tsx
│   │   ├── cart.tsx
│   │   ├── admin.tsx
│   │   ├── admin-products.tsx
│   │   ├── admin-orders.tsx
│   │   ├── admin-orchestration.tsx
│   │   └── ... (58 more pages)
│   │
│   ├── components/            # Reusable components
│   │   ├── ui/                # shadcn/ui components (50+)
│   │   │   ├── button.tsx
│   │   │   ├── card.tsx
│   │   │   ├── dialog.tsx
│   │   │   └── ...
│   │   ├── Navbar.tsx
│   │   ├── Footer.tsx
│   │   ├── Hero.tsx
│   │   ├── FeaturedProducts.tsx
│   │   ├── ProductCard.tsx
│   │   ├── ProductMockup.tsx
│   │   ├── InstantMockupPreview.tsx
│   │   ├── ImageCropper.tsx
│   │   ├── ImageDesigner.tsx
│   │   └── ...
│   │
│   ├── hooks/                 # Custom React hooks
│   │   ├── useAuth.ts
│   │   ├── useGuestCart.ts
│   │   ├── useMockupWithFallback.ts
│   │   ├── use-toast.ts
│   │   └── ...
│   │
│   ├── lib/                   # Utilities
│   │   ├── queryClient.ts     # TanStack Query setup
│   │   ├── firebase.ts        # Firebase config
│   │   ├── auth.ts            # Auth helpers
│   │   ├── utils.ts           # General utilities
│   │   └── ...
│   │
│   ├── styles/                # CSS files
│   │   ├── theme.css
│   │   ├── layout.css
│   │   ├── buttons.css
│   │   └── forms.css
│   │
│   ├── assets/                # Static assets
│   │   ├── logo.svg
│   │   ├── logo.png
│   │   └── ...
│   │
│   ├── App.tsx                # Root component + router
│   ├── main.tsx               # Entry point
│   └── index.css              # Global styles
│
├── public/                    # Public static files
│   ├── favicon.png
│   ├── robots.txt
│   ├── sitemap.xml
│   ├── llms.txt               # AI discoverability
│   ├── ai.txt                 # AI discoverability
│   └── embed/
│       └── qrgear-embed.js    # Embeddable widget
│
└── index.html                 # HTML entry point
```

---

## Backend Structure (server/)
```
server/
├── lib/                       # Core libraries
│   ├── printify.ts            # Printify API wrapper
│   ├── mockup-service.ts      # Mockup generation service
│   ├── local-mockup-generator.ts  # Local mockup compositing
│   ├── qr-generator.ts        # QR code generation
│   ├── image-upload.ts        # Image upload handling
│   ├── email.ts               # Email service (Resend)
│   ├── cron-jobs.ts           # Scheduled tasks
│   ├── printify-cost-sync.ts  # Cost synchronization
│   ├── printify-orders.ts     # Order processing
│   ├── sitemap.ts             # Sitemap generation
│   ├── widget-auth.ts         # Widget authentication
│   └── ...
│
├── adapters/                  # Multi-provider adapters
│   ├── base.ts                # Base adapter interface
│   ├── index.ts               # Adapter registry
│   ├── print-providers/       # POD providers
│   │   ├── printify.ts
│   │   ├── printful.ts
│   │   └── apliiq.ts
│   └── marketplaces/          # Sales channels
│       ├── amazon.ts
│       ├── ebay.ts
│       └── etsy.ts
│
├── services/                  # Business logic services
│   ├── auto-repricer.ts       # Automatic pricing
│   ├── auto-router.ts         # Order routing
│   ├── bulk-publisher.ts      # Bulk product publishing
│   ├── health-monitor.ts      # System health
│   ├── profit-calculator.ts   # Profit calculations
│   ├── qr-analytics.ts        # QR scan analytics
│   └── sku-generator.ts       # SKU generation
│
├── webhooks/                  # Webhook handlers
│   └── index.ts
│
├── replit_integrations/       # Replit services
│   └── object_storage/        # Object storage
│       ├── index.ts
│       ├── objectStorage.ts
│       └── routes.ts
│
├── routes.ts                  # All API routes (4000+ lines)
├── storage.ts                 # Database operations
├── db.ts                      # Database connection
├── stripeClient.ts            # Stripe integration
├── replitAuth.ts              # Replit auth
├── webhookHandlers.ts         # Stripe/Printify webhooks
├── index.ts                   # Server entry point
└── vite.ts                    # Vite dev server
```

---

## Shared Types (shared/)
```
shared/
└── schema.ts                  # Database schema + types
    - products table
    - custom_designs table
    - mockup_cache table
    - printify_print_providers table
    - orders table
    - cart_items table
    - categories table
    - tags table
    - coupons table
    - gift_codes table
    - qr_scans table
    - users table
    - settings table
    - partner_stores table
    - partner_products table
    - ... (20+ tables)
```

---

## Documentation (docs/)
```
docs/
├── AI-COMMS/                  # AI collaboration folder
│   ├── README.md              # Master readme
│   ├── HANDOFF-DEC27.md       # Current handoff doc
│   ├── INTEGRATION-CHECKLIST.md
│   ├── KC/                    # Kingdom Connects docs
│   │   └── ...
│   ├── QR/                    # QR Gear docs
│   │   ├── README.md
│   │   ├── SITEMAP-DEC28.md   # This sitemap
│   │   ├── PROJECT-STRUCTURE-DEC28.md
│   │   └── ...
│   ├── SCHEMA/                # Database docs
│   │   └── DATABASE-SCHEMA.md
│   └── SHARED/                # Cross-project docs
│       └── ...
└── AI-COMMS.zip               # Zipped for transport
```

---

## Key Files Summary

| File | Purpose |
|------|---------|
| `shared/schema.ts` | Database schema - source of truth |
| `server/routes.ts` | All 50+ API endpoints |
| `server/storage.ts` | Database CRUD operations |
| `server/lib/mockup-service.ts` | Printify mockup generation |
| `server/lib/local-mockup-generator.ts` | Local mockup compositing |
| `client/src/App.tsx` | Frontend router - all 61 pages |
| `client/src/components/FeaturedProducts.tsx` | Home page products |
| `replit.md` | Project reference guide |

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 18, TypeScript, Vite, TanStack Query |
| Styling | Tailwind CSS, shadcn/ui |
| Backend | Node.js, Express, TypeScript |
| Database | PostgreSQL (Neon), Drizzle ORM |
| Storage | Replit Object Storage |
| Auth | Firebase, Replit Auth |
| Payments | Stripe |
| POD | Printify (primary), Printful, Apliiq |
| Email | Resend |

---

*Last updated: December 28, 2025*
