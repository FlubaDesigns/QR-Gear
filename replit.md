# QR Gear - System Reference Guide

## Overview
QR Gear is an e-commerce platform specializing in personalized promotional merchandise featuring custom QR codes. The platform integrates with Printify for print-on-demand fulfillment. Its core purpose is to enable users to design and order custom QR-enhanced products efficiently. The project aims to capture a niche market for businesses and individuals seeking unique, branded merchandise.

## User Preferences
- **Communication**: Simple, everyday language
- **Accessibility**: User has CIDP (limited hand mobility) - agent must be fully autonomous
- **Documentation**: Keep ADMIN_MANUAL.md updated as admin features evolve

## System Architecture

### UI/UX Decisions
The storefront displays lifestyle mockups over flat product shots for a more engaging user experience. Product pricing shown to customers is the admin-configured retail price (`customer_price`).

### Technical Implementations
- **Pricing System**: Prices are set by the admin and stored in `products.customer_price`. This value is the single source of truth for retail pricing and is never recalculated from base costs.
- **Mockup System**: Utilizes Printful for generating high-quality mockups, including lifestyle images, as Printify does not support mockups for unpublished products. Mockups are generated for all product colors and three QR code sizes (25%, 45%, 65% of print area) via a background job queue to respect Printful's API rate limits. Mockups are stored in object storage.
- **QR Artwork Selection**: Automatic selection of QR code color (black or white) based on the background product color's luminance to ensure scannability. Dark backgrounds receive white QRs, and light backgrounds receive black QRs.
- **Printify Local Catalog**: Product colors and sizes are synced weekly from Printify into the `printify_print_providers` table. This local catalog serves as the source of truth, avoiding direct API calls for product options.
- **Database Schema**: Key tables include `products` (storing product details, prices, mockups, and Printify IDs), `mockup_cache` (for generated mockup variations), and `custom_designs` (for design images and cached mockups).
- **Dual Storage System**: The system supports `postgres-only`, `dual-write`, and `firestore-only` modes, controlled by the `STORAGE_MODE` environment variable. In `dual-write` mode, data is written to both PostgreSQL and Firestore, with PostgreSQL as the primary source for reads. This facilitates migration to a Firebase-centric deployment.
- **File Storage**: Supports dual backend for files, utilizing Firebase Storage as primary (when enabled) with Replit Object Storage as a fallback.

### Feature Specifications
- **Product Management**: Admins can manage products, set retail prices, and enable/disable product visibility.
- **Custom QR Code Integration**: Products can be customized with QR codes.
- **Shopping Cart**: Standard e-commerce cart operations are supported.

### System Design Choices
- **Printful-First Mockup Architecture**: Decouples mockup generation (Printful) from order fulfillment (Printify) to overcome Printify's limitations with draft products.
- **Node.js, Express, TypeScript Backend**: Provides a robust and scalable API layer.
- **React, TypeScript, Vite Frontend**: Modern and efficient user interface.
- **PostgreSQL with Drizzle ORM / Firestore**: Flexible and performant database solutions, supporting a migration path to Firebase.

## External Dependencies
- **Printify**: For print-on-demand fulfillment services.
- **Printful**: For generating product mockups, including lifestyle images.
- **Stripe**: For payment processing.
- **Firebase**: For hosting, Firestore database (migration target), Firebase Storage, and Cloud Functions for the backend API.
- **Neon**: Managed PostgreSQL database service.
- **Resend**: For email services.
- **TanStack Query**: For data fetching and state management in the frontend.
- **shadcn/ui**: UI component library.