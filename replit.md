# QR Gear

## Overview

QR Gear is a custom promotional merchandise e-commerce platform that creates personalized apparel and products featuring QR codes. The platform integrates with Printify for print-on-demand fulfillment of USA-made products (hats, shirts, mugs, bags). Users can create QR codes containing either text content or images, customize their styling, and place them on various product types. The business model focuses on B2B sales to small businesses as leave-behind marketing tools, with integration planned for Kingdom Connects (a faith-based business directory platform).

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React with TypeScript, bundled with Vite
- **UI Components**: shadcn/ui component library with Radix UI primitives
- **Styling**: Tailwind CSS with custom theme configuration supporting dark/light modes
- **State Management**: TanStack React Query for server state
- **Forms**: React Hook Form with Zod validation
- **Payments**: Stripe React integration (@stripe/react-stripe-js)
- **Path Aliases**: `@/` maps to `client/src/`, `@shared/` maps to `shared/`

### Backend Architecture
- **Runtime**: Node.js with Express
- **Language**: TypeScript with ES modules
- **API Pattern**: RESTful endpoints under `/api/` prefix
- **Build**: esbuild for production bundling

### Database
- **Database**: PostgreSQL via Neon serverless
- **ORM**: Drizzle ORM with drizzle-kit for migrations
- **Schema Location**: `shared/schema.ts` contains all table definitions
- **Key Tables**: users, qrDesigns, products, cartItems, orders, orderItems

### Core Features
- **QR Code Generation**: Server-side QR code creation for text and image content
- **Product Customization**: QR placement options (front-chest, back, left-sleeve, etc.)
- **Shopping Cart**: User-associated cart with quantity management
- **Order Processing**: Full order lifecycle with order items tracking
- **Widget System**: Embeddable widget for external sites with JWT token authentication
- **Premium QR Text**: Optional text above (20 chars) and below (30 chars) QR code with $2 upcharge per field
- **Category System**: Firestore-based product categories with admin management panel

### Firestore Categories
Categories are stored in Firebase Firestore and managed via the admin panel at `/admin`.

**Firestore Collection**: `categories`
**Fields**:
- `name`: Category display name
- `slug`: URL-friendly identifier (auto-generated from name)
- `description`: Brief description
- `icon`: Lucide icon name (Church, Flag, Trophy, Briefcase, Music, Palette, Tag)
- `sortOrder`: Display order (ascending)
- `isActive`: Whether category is visible to users
- `createdAt`, `updatedAt`: Timestamps

**Default Categories** (seeded via admin panel):
- Religious, Political, Sports, Business, Entertainment, Custom

**Environment Variables for Firebase**:
- `VITE_FIREBASE_API_KEY`: Firebase API key
- `VITE_FIREBASE_PROJECT_ID`: Firebase project ID (e.g., qrgear-c1ffd)
- `VITE_FIREBASE_APP_ID`: Firebase app ID
- `VITE_FIREBASE_AUTH_DOMAIN`: (optional) Auth domain
- `VITE_FIREBASE_STORAGE_BUCKET`: (optional) Storage bucket

### Embeddable Widget Security

The widget system allows Kingdom Connects and other trusted partners to embed the QR Gear mini-store on their sites.

**Required Environment Variables:**
- `WIDGET_JWT_SECRET`: Secret key for signing widget JWT tokens
- `WIDGET_API_KEY`: API key required for token generation endpoint
- `ALLOWED_WIDGET_ORIGINS`: Comma-separated list of allowed embedding domains (e.g., "https://kingdomconnects.com,https://app.kingdomconnects.com")
- `VITE_ALLOWED_WIDGET_ORIGINS`: Same list for frontend postMessage validation

**Security Architecture:**
1. Token endpoint (`/api/widget/token`) requires `X-API-Key` header authentication
2. JWT tokens are pre-signed by partner backends, not client-side
3. Widget validates parent origin via postMessage with `VITE_ALLOWED_WIDGET_ORIGINS`
4. Embed script (`/embed/qrgear-embed.js`) validates message origins before processing

**Integration Steps for Partners:**
1. Obtain API key from QR Gear admin
2. Generate pre-signed tokens server-side using the `/api/widget/token` endpoint
3. Pass token to embed script via `data-token` attribute or `token` option
4. Configure callback handlers for `onOrder` events

### Design System
- **Typography**: Inter (body), Space Grotesk (headings) from Google Fonts
- **Layout**: Mobile-first responsive design with max-w-7xl containers
- **Components**: Card-based layouts with consistent border-radius and color tokens

## External Dependencies

### Third-Party Services
- **Printify API**: Print-on-demand fulfillment (product catalog, order submission)
- **Stripe**: Payment processing (checkout, subscriptions)
- **Firebase/Firestore**: Secondary data store for user designs and real-time features (schema in FIREBASE_SCHEMA.md)
- **Neon Database**: Primary PostgreSQL hosting (serverless)

### Key NPM Packages
- `@neondatabase/serverless`: Database connectivity
- `drizzle-orm` / `drizzle-kit`: ORM and migrations
- `@stripe/stripe-js` / `@stripe/react-stripe-js`: Payment integration
- `qrcode`: QR code generation
- `jsonwebtoken`: Widget authentication tokens
- `@tanstack/react-query`: Data fetching and caching
- `zod`: Schema validation (shared between client and server)