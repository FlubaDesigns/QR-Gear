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