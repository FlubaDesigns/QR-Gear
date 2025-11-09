# Kingdom Connects

## Overview
Kingdom Connects is a faith-based platform designed to unite churches with local Christian businesses. Its primary purpose is to foster economic support and community within the Christian sphere by allowing users to discover and list churches and businesses, submit reviews, and manage listings through role-specific dashboards. The platform aims to build sustainable Christian commerce, tithing a percentage of its revenue back to churches and ministries to support the Body of Christ.

## User Preferences
- **Developer**: Dave (former developer for chock.com, ~20 years experience)
- **Development Environment**: Built on mobile (Samsung S21 Plus, Android)
- **Health Considerations**: CIDP and GBS (Guillain-Barré Syndrome) since 1991, uses wheelchair, limited hand mobility causing pain after extended work
- **Development Approach**: AI-assisted development - minimize Dave's typing, navigation, and copy-paste tasks. Always provide complete copy-paste solutions and automate configuration when possible
- **Communication Style**: ALWAYS BE HONEST. If an idea is bad, say it's bad. If it's great, acknowledge it. Never lie or sugarcoat technical realities. Dave values brutal honesty over polite deception
- **Business Vision**: Building multiple profitable businesses using reusable layout code with different themes
- **Database Naming Convention**: snake_case for all Firestore field names (standardizing from mixed camelCase/snake_case)

## System Architecture
Kingdom Connects is a static website leveraging Firebase for all backend services.

### UI/UX Decisions
- **Responsive Design**: Mobile-first layout.
- **Theme Support**: Dark/light theme options.
- **Accessibility**: Font scaling and theme preferences.
- **Design System**: Consistent gold metallic styling, card-based layouts, and shared CSS across all sections.
- **CSS Framework**: Utility-first approach with minimal inline styles using a comprehensive set of utility classes for spacing, typography, layout, colors, and components.

### Technical Implementations
- **Frontend**: Pure HTML5, CSS3, JavaScript (ES6 modules).
- **Backend**: Firebase Firestore for the database.
- **Hosting**: Firebase Hosting.
- **Local Development**: Python SimpleHTTPServer for the Replit environment.

### Feature Specifications
- **Directories**: Church and Business directories with search functionality.
- **Review System**: Users can submit and view business reviews.
- **Multi-Dashboard System**: Includes Admin, Church Admin, Business Admin, and Sales dashboards for role-specific management.
- **Pro Tier**: Paid subscription for businesses with enhanced features and visibility.
- **Tithing Model**: 10% of gross revenue is allocated to churches and outreach programs.
- **Permanent Listings**: Business listings are downgraded, not deleted, upon payment lapse.
- **User Roles**: Regular User, Business Owner, Church Admin, Sales Agent, Platform Admin.
- **Dynamic Content**: "Did You Know?" factoid system for the homepage.
- **Hybrid Category System**: Businesses can select a primary and multiple secondary categories with tier-based limits, dynamically managed via Firestore.
- **Sales Commission Structure** (for Pro businesses): Admin-configurable split with default values: 10% Church, 5% Salesperson, 5% Sales Director, 80% Kingdom Connect. Recurring monthly for active Pro subscriptions.

### System Design Choices
- **Modular Architecture**: Public site and dashboard sections utilize modular JavaScript for headers and footers while sharing common CSS.
- **Firestore Database Structure**:
    - `business_listings`: Business data, including `snake_case` fields for details, categories, status, and pro-tier information.
    - `churches`: Church information.
    - `users`: User accounts with role-based access.
    - `reviews`: Business reviews.
    - `payments`: Stripe transactions.
    - `activity_log`: Platform activity.
    - `factoids`: Dynamic homepage facts.
    - `categories`: Stores all business categories dynamically.
    - `category_suggestions`: Stores user-submitted category suggestions for admin approval.
- **Security Implementation**: Mandatory server-side protection (CSP, XSS, X-Frame-Options), role-based access control via Firestore rules, input validation, and client-side input sanitization for all user-generated content and URLs.

## External Dependencies
- **Firebase**: Firestore (NoSQL database) and Firebase Hosting.
- **Stripe**: Payment gateway for Pro tier subscriptions.
- **Python**: Used for the local development server.

## Project Structure
- **Public Site**: 19 HTML pages (index, business directory, church directory, submit forms, auth pages, legal, etc.)
- **Admin Dashboard**: 14 pages (users, businesses, business-insights, churches, church-insights, questionnaire-manager, email-campaigns, commission-settings, factoids, analytics, settings, etc.)
- **Business-Admin Dashboard**: 9 pages (listing management, reviews, stats, Pro upgrade, category suggestions)
- **Church-Admin Dashboard**: 10 pages (profile, featured businesses, analytics, activities, monthly-message, commissions, questionnaire)
- **Sales Dashboard**: 6 pages (referrals, commissions, director-commissions, conversions, agents)
- **Total**: 58 HTML pages across 4 role-based dashboards + public site
- **Assets**: 
  - `library/` - Site-level assets (logos, favicon, social media icons) - NOT user uploads
  - `img/` - Currently used logo
  - `assets/` - Favicon
  - `attached_assets/` - Documentation and design files
- **Styles**: Modular CSS system (layout.css, theme.css, buttons.css, forms.css, help-system.css, loading-skeletons.css, overrides.css)

## Development Status (November 8-9, 2025)
- **Authentication System**: ✅ COMPLETE - login.html, signup.html, forgot-password.html with Firebase Auth, role-based redirects, forced role='user' on signup
- **Dashboards**: ✅ COMPLETE - Business-Admin (9 pages), Church-Admin (10 pages), Sales (6 pages), Admin (14 pages) all with role-based auth guards
- **Security**: ✅ COMPLETE - Multi-layer XSS protection, admin role enforcement, Firestore rules, privilege escalation vulnerability fixed
- **Code Cleanup**: ✅ COMPLETE (Nov 8) - Removed 13 orphan pages, 3 unused CSS files, fixed broken links
- **Email Campaign System**: ✅ COMPLETE (Nov 8) - admin/email-campaigns.html with segments (Pro lapsed, new signups, active businesses, churches), template manager, scheduling, analytics tracking
- **Firebase Storage Integration**: ✅ COMPLETE (Nov 8) - Media upload system for business/church images and videos with file validation and security rules
- **GitOps Dashboard**: ✅ COMPLETE (Nov 8) - Mobile-friendly Git dashboard (gitops/dashboard.html) with push/pull/sync buttons for Dave's phone, Flask server running on port 8000
- **User Manuals**: ✅ COMPLETE (Nov 8) - Comprehensive training documentation suite (5 manuals, 130+ pages total)
- **Church Activities System**: ✅ COMPLETE (Nov 9) - Full activity management with recurring events, social sharing, monthly pastor messages
- **Commission System**: ✅ COMPLETE (Nov 9) - 4-way split structure (Church 10%, Salesperson 5%, Director 30%, KC 55%), admin settings, church/sales/director dashboards, monthly/YTD tracking
- **Pending Features**:
  1. **Firebase Field Population**: Manually add commission hierarchy fields to businesses (see MISSING-FIREBASE-FIELDS.md)
  2. **Firebase Storage Activation**: Dave needs to enable Storage in Firebase Console (see FIREBASE-STORAGE-SETUP.md)
  3. **Stripe Integration**: Pro subscription payments, billing management
  4. **Site Assets**: Add favicon and social media icons to library/
  5. **Launch MVP**: Deploy to production

## Recent Additions (November 8-9, 2025)
- **Dynamic Questionnaire System** (Nov 9): Complete admin-controlled questionnaire management with separate church and business audiences, 6 question types, real-time insights dashboards with legacy data fallback support
- **Church Activities System** (Nov 9): Full activity management (church-admin/activities.html) with image uploads, recurring events, social media sharing (Facebook/Twitter), monthly pastor messages, and public display on church.html
- **Commission System** (Nov 9): Complete 4-way revenue split system with admin-configurable percentages (default: Church 10%, Salesperson 5%, Director 30%, KC 55%), recurring monthly payments for active Pro subscriptions, monthly/YTD tracking
  - admin/commission-settings.html - Configure split percentages
  - church-admin/commissions.html - Church earnings dashboard with CSV export
  - sales/director-commissions.html - Director override dashboard with team performance
  - MISSING-FIREBASE-FIELDS.md - Complete field population guide for hierarchy setup
  - New Firestore collections: commission_policies, commission_ledger, commission_balances
  - Required business fields: home_church_id, referring_salesperson_id, sales_director_id
  - Required church fields: monthly_commission_total, ytd_commission_total, total_commission_earned, unpaid_commission_balance
  - Required user fields: sales_director_id, monthly_commission_total, ytd_commission_total, total_salesperson_commission, total_sales_director_commission
- **Church Insights Dashboard** (Nov 9): Admin page (admin/church-insights.html) with real-time data updates via onSnapshot(), aggregate metrics, filterable table, CSV export, and legacy data support
- **Business Insights Dashboard** (Nov 9): Admin page (admin/business-insights.html) for business questionnaire responses with real-time updates and CSV export
- **Marketing Funnel Pages** (Nov 9): Three public conversion pages (for-businesses.html, for-churches.html, for-agents.html) with clear value propositions, pricing breakdown, and CTAs
- **Marketing Manager Dashboard** (Nov 9): Four protected pages (index, team, analytics, reports) with role-based auth for sales team oversight
- **Email Templates** (Nov 9): Added "Business QR Code" template to email campaigns for automated QR code delivery after profile completion
- **QR Gear Specification** (Nov 9): Complete product spec document (QR-GEAR-SPECS.md) for future standalone project integration
- **Pricing Structure** (Nov 9): Finalized Pro tier pricing ($8.99/month or $74.99/year), Mission Partner tier concept ($14.99/month or $149.99/year)
- **Email Campaigns**: Full campaign management system with audience segmentation, templates, scheduling, and analytics
- **File Upload System**: Reusable FileUploader component for business/church media with drag-and-drop, validation, and Firebase Storage integration
- **Storage Structure**: Organized folders for businesses/{id}/images|videos and churches/{id}/images|videos
- **GitOps Dashboard**: Mobile-friendly dashboard at gitops/dashboard.html with big tap-friendly buttons for push/pull/sync operations, accessible from Dave's phone via Flask server on port 8000
- **User Manual Suite**: Complete training documentation (docs/*.md):
  - Quick Start Guide (10 pages) - Universal onboarding for all users
  - Business Owner Manual (25 pages) - Listing management, Pro features, categories
  - Church Admin Manual (20 pages) - Church profiles, featured businesses, revenue sharing
  - Sales Agent Manual (30 pages) - Commission structure, prospecting, analytics
  - Platform Admin Manual (50+ pages) - Complete admin reference covering all 11 dashboard pages