# Kingdom Connects - Briefing for Ghost (AIGH)

## What Is Kingdom Connects?
A faith-based platform connecting churches and local Christian businesses. Think Yelp meets church directory, with a tithing revenue model - 10% of platform revenue goes back to churches.

## Current State (December 2025)
**Phase 1: Mobile-only pre-beta** - Production target is January 1st, 2026.

The site has come a LONG way. Here's what exists now:

### Core Features (Built & Working)
- **Church Directory** - Search, filter, view church profiles
- **Business Directory** - Search, filter, view business profiles with reviews
- **User Authentication** - Firebase Auth with role-based access
- **Review System** - Members can review businesses
- **Multi-Dashboard System**:
  - Admin Dashboard (platform management)
  - Church Admin Dashboard (manage church profile, view affiliated businesses)
  - Business Admin Dashboard (manage listing, promotions, testimonials)
  - Sales Dashboard (track leads, commissions)
  - Member Dashboard (saved businesses, my reviews)

### Pro Tier Features
- **Pricing**: $9/month or $69.99/year
- **Distance Search** (Coming Soon - needs Google Maps API)
- **Promotions Manager** - Create/manage special offers
- **Products & Services** - Showcase offerings
- **Testimonials** - Collect and display customer testimonials
- **Enhanced Analytics**

### Revenue/Commission System
- 20% to Sales Agent
- 15% to Sales Director
- 10% Church Tithe (goes to member's affiliated church)
- All pricing managed dynamically via Firestore (no hardcoded prices)

### Technical Stack
- **Frontend**: Pure HTML5, CSS3, vanilla JavaScript (ES6 modules)
- **Backend**: Firebase (Firestore, Auth, Storage, Hosting)
- **Email**: Node.js server with Resend integration
- **Payments**: Stripe integration ready
- **SSR**: Server-side rendered public pages for SEO
- **No frameworks** - Intentionally vanilla for simplicity and reusability

### Design System
- Gold metallic theme (Christian/premium feel)
- Mobile-first responsive (tablet/desktop coming tomorrow)
- Dark/light mode support
- SVG icons throughout
- Consistent CSS framework (layout.css, theme.css, buttons.css, forms.css)

## The Full Site Code
Look in `KC/SITE-CODE/KC-FULL-SITE.zip` - that's the entire codebase.

**Key folders:**
- `/admin/` - Admin dashboard pages
- `/business-admin/` - Business owner dashboard
- `/church-admin/` - Church admin dashboard
- `/sales/` - Sales agent dashboard
- `/member/` - Member dashboard
- `/js/` - Shared JavaScript modules
- `/css/` - Shared stylesheets
- `/docs/` - Documentation

## Dave's Situation
- **CIDP** - Limited hand mobility, uses wheelchair
- **Primary dev environment**: Mobile (Samsung S21)
- **Needs**: Automation, minimal typing, complete copy-paste solutions
- **Communication style**: Brutal honesty preferred over polite deception

## Your Role (Ghost)
Based on what I've seen, you're the visual reviewer and coordinator. You can:
1. Review screenshots for UI/UX issues
2. Coordinate between KC and QR Gear projects
3. Provide visual feedback Dave can relay to coding AIs

## QR Gear Connection
QR Gear is Dave's parallel project - merchandise (t-shirts, mugs, etc.) with QR codes. It will integrate with KC:
- Shared Firebase auth
- Business promo items link to KC listings via slug parameter
- Reuses KC's layout patterns (translated to React/Vite)

## What's Next
1. **Tomorrow**: Responsive layout (tablet + desktop)
2. **Pending**: Google Maps API for distance search
3. **Target**: Production launch January 1st, 2026

---
*From: KC Agent (Claude 1)*
*Date: December 21, 2025*
