# QR Gear - Complete QR Code Design Platform

A full-stack QR code design and management platform built with React, Express, PostgreSQL, and Firebase.

## Live Site
**Production:** https://qrgear-c1ffd.web.app

## Quick Start

### Prerequisites
- Node.js 18+
- PostgreSQL database
- Firebase project with Storage enabled

### Installation

```bash
# Install dependencies
npm install

# Set up environment variables (copy from .env.example)
cp .env.example .env

# Push database schema
npm run db:push

# Start development server
npm run dev
```

The app runs on http://localhost:5000

## Architecture

```
qrgear/
├── client/                 # React frontend (Vite + TypeScript)
│   ├── src/
│   │   ├── components/     # Reusable UI components
│   │   │   ├── ui/         # Shadcn UI primitives
│   │   │   └── SmartImage.tsx  # Unified image loader component
│   │   ├── lib/
│   │   │   ├── firebase.ts     # Firebase client config
│   │   │   ├── imageLoader.ts  # Unified image loading utilities
│   │   │   ├── nexus.ts        # Error tracking & diagnostics
│   │   │   └── queryClient.ts  # TanStack Query setup
│   │   ├── pages/          # Route pages
│   │   │   ├── admin-*.tsx     # Admin panel pages
│   │   │   ├── designer.tsx    # QR code designer
│   │   │   └── *.tsx           # Public pages
│   │   └── styles/         # CSS stylesheets
│   └── index.html
├── server/                 # Express backend
│   ├── routes.ts           # API routes
│   ├── storage.ts          # Database abstraction layer
│   ├── adapters/           # Storage adapters
│   │   ├── postgres.ts         # PostgreSQL adapter
│   │   ├── firestore.ts        # Firestore adapter
│   │   └── dual-write.ts       # Dual-write sync adapter
│   └── index.ts            # Server entry point
├── shared/
│   └── schema.ts           # Drizzle ORM schema & types
├── functions/              # Firebase Cloud Functions
└── dist/                   # Production build output
    └── public/             # Static files for deployment
```

## Key Features

### QR Code Designer
- Custom QR code generation with branding
- Background image integration
- Template system for quick designs
- Export to PNG/SVG

### Admin Panel (/admin)
- **Dashboard:** Analytics and overview
- **Library:** Background image management
  - Upload raw images
  - ZIP file batch upload
  - Automatic thumbnail generation
  - Crop and resize tools
- **Templates:** Design template management
- **Products:** Printify integration for merchandise
- **Users:** User management and roles

### Image Loading System

The unified `imageLoader.ts` module handles all image assets consistently:

```typescript
import { SmartImage } from '@/components/SmartImage';
import { getImageSrc, getThumbnailSrc } from '@/lib/imageLoader';

// Component usage - handles auth automatically
<SmartImage asset={background} alt="Background" className="w-full h-full object-cover" />

// Direct URL extraction
const src = getImageSrc(asset); // Full image
const thumb = getThumbnailSrc(asset); // Thumbnail preferred
```

**Supported URL Fields (priority order):**
1. `imageUrl` - Primary image URL
2. `publicUrl` - Public Firebase Storage URL
3. `storageUrl` - Storage URL from database
4. `thumbnailUrl` - Thumbnail URL
5. `url` - Generic URL field
6. `proxyUrl` - Authenticated proxy URL

**Asset Types:**
- `raw` / `source` - Original uploaded images
- `zip` - Extracted from ZIP uploads
- `cropped` - User-cropped versions
- `template` - Design templates
- `design` - Saved user designs

## Database

### PostgreSQL (Primary)
Using Drizzle ORM with Neon PostgreSQL.

```bash
# Generate migrations
npm run db:generate

# Push schema changes
npm run db:push

# Open Drizzle Studio
npm run db:studio
```

### Firestore (Secondary)
Dual-write mode syncs data to Firestore for Firebase hosting compatibility.

## Firebase Deployment

```bash
# Build production bundle
npm run build

# Deploy to Firebase Hosting
firebase deploy --only hosting

# Deploy Cloud Functions
firebase deploy --only functions
```

## Environment Variables

### Required
```env
DATABASE_URL=postgresql://...
FIREBASE_SERVICE_ACCOUNT_KEY={"type":"service_account",...}
STRIPE_SECRET_KEY=sk_...
VITE_STRIPE_PUBLIC_KEY=pk_...
```

### Optional
```env
RESEND_API_KEY=re_...
PRINTIFY_API_KEY=...
SESSION_SECRET=...
```

## API Endpoints

### Public
- `GET /api/health` - Health check
- `POST /api/auth/login` - Firebase auth login
- `GET /api/backgrounds` - Public backgrounds

### Admin (requires auth)
- `GET /api/admin/library/backgrounds` - All backgrounds
- `POST /api/admin/library/backgrounds` - Upload background
- `DELETE /api/admin/library/backgrounds/:id` - Delete background
- `GET /api/admin/templates` - Template management
- `GET /api/admin/users` - User management

## Tech Stack

- **Frontend:** React 18, TypeScript, Vite, TailwindCSS, Shadcn UI
- **Backend:** Express.js, TypeScript
- **Database:** PostgreSQL (Drizzle ORM), Firestore
- **Storage:** Firebase Storage, Google Cloud Storage
- **Auth:** Firebase Authentication
- **Payments:** Stripe
- **Email:** Resend
- **Deployment:** Firebase Hosting, Replit

## Troubleshooting

### Thumbnails Not Showing
1. Check browser console for errors
2. Verify `storageUrl` field exists in database records
3. Ensure Firebase Storage CORS is configured
4. Check if URLs are publicly accessible

### Firebase Routing Issues
The Nexus system detects HTML responses (Firebase routing errors) and logs them:
```typescript
if (Nexus.detectHtmlResponse(response, url)) {
  // Logs error and prevents silent failures
}
```

### Database Sync Issues
Dual-write mode logs all operations:
```
[DualWriteAdapter] Writing to Postgres...
[DualWriteAdapter] Syncing to Firestore...
```

## License

Proprietary - All rights reserved.

## Support

For issues or questions, check the admin manual at `/ADMIN_MANUAL.md` or the Firebase schema docs at `/FIREBASE_SCHEMA.md`.
