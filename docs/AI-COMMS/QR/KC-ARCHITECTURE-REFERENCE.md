# Kingdom Connects Architecture Reference
**Use this document to help AI tools understand KC patterns for reuse in other projects.**

---

## Project Overview
Kingdom Connects is a faith-based business/church directory platform. Static HTML/CSS/JS frontend, Firebase backend (Firestore, Auth, Storage, Hosting), Node.js API server for email/presentations.

**Key Philosophy:**
- Mobile-first, responsive design
- No frameworks (vanilla JS with ES6 modules)
- Modular CSS with strict separation
- Firebase for everything backend
- SSR for public SEO pages only

---

## File Structure
```
/
├── index.html                 # Landing page
├── business_directory.html    # Public business listing
├── church_directory.html      # Public church listing
├── for-businesses.html        # Sales/pricing page
├── add_to_directory.html      # Business submission form
│
├── admin/                     # Platform admin dashboard
├── business-admin/            # Business owner dashboard
├── church-admin/              # Church admin dashboard
├── member/                    # Member dashboard
├── sales/                     # Sales agent dashboard
├── marketing-manager/         # Marketing tools
│
├── css/
│   ├── layout.css            # Grid, spacing, containers, responsive
│   ├── theme.css             # Colors, gold-metallic, dark/light mode
│   ├── buttons.css           # All button styles
│   ├── forms.css             # Form inputs, validation
│   └── [dashboard]/styles.css # Dashboard-specific styles only
│
├── js/
│   ├── utils.js              # Shared utilities
│   ├── firebase-init.js      # Firebase config
│   └── [feature].js          # Feature-specific modules
│
├── docs/                      # User manuals, documentation
├── email-server.js            # Node.js API (email, presentations)
└── start-servers.sh           # Dev server startup script
```

---

## CSS Architecture (CRITICAL)

### Rules (Non-Negotiable)
1. **NO inline `<style>` blocks** - Ever
2. **NO inline style attributes** - Use classList.add/remove('hidden')
3. **Check existing CSS first** before writing new styles

### CSS File Responsibilities
| File | Purpose |
|------|---------|
| `layout.css` | Grid systems, spacing, containers, media queries |
| `theme.css` | Colors, backgrounds, gold-metallic effects |
| `buttons.css` | All button variants and states |
| `forms.css` | Inputs, labels, validation styles |
| `[dashboard]/styles.css` | Dashboard-specific only |

### Key CSS Classes
```css
/* Layout */
.container         /* Max-width wrapper */
.card              /* Standard card component */
.card-list         /* Grid of cards */
.grid-2, .grid-3   /* Responsive grids */
.hidden            /* display: none */

/* Theme */
.gold-metallic     /* Gold gradient background */
.btn-gold          /* Primary gold button */
.btn-outline       /* Secondary outline button */

/* Forms */
.form-group        /* Label + input wrapper */
.input-error       /* Validation error state */
```

### Responsive Breakpoints
```css
/* Mobile first - base styles are mobile */
@media (min-width: 768px)  { /* Tablet */ }
@media (min-width: 1024px) { /* Desktop */ }
```

---

## Firebase Structure

### Collections
| Collection | Purpose |
|------------|---------|
| `users` | User profiles, roles, preferences |
| `business_listings` | All businesses (active + pending) |
| `churches` | All churches |
| `reviews` | Business reviews |
| `activity_log` | Audit trail |
| `email_templates` | Admin-managed email templates |
| `pricing_settings` | Dynamic pricing config |
| `categories` | Business categories |

### Field Naming Convention
**Always use snake_case** for all Firestore fields:
```javascript
// CORRECT
{ business_name: "...", created_at: timestamp, is_pro: true }

// WRONG
{ businessName: "...", createdAt: timestamp, isPro: true }
```

### User Roles
```javascript
const ROLES = {
  member: "member",
  business_owner: "business_owner", 
  church_admin: "church_admin",
  sales_agent: "sales_agent",
  platform_admin: "platform_admin"
};
```

### Listing Status Flow
```javascript
const STATUS = {
  pending: "pending",      // Awaiting approval
  approved: "approved",    // Live and visible
  rejected: "rejected",    // Denied
  suspended: "suspended"   // Temporarily hidden
};
```

---

## API Endpoints (email-server.js)

### Email
```
POST /api/send-email
Body: { to, subject, html, templateId?, variables? }
Auth: Firebase ID token required
```

### Presentations
```
POST /api/generate-presentation
Body: { templateType, recipientEmail, data }
Auth: Firebase ID token required
```

### SEO/SSR
```
GET /business/:slug.htm    # SSR business page
GET /church/:slug.htm      # SSR church page  
GET /sitemap.xml           # Dynamic sitemap
POST /api/ping-sitemap     # Notify search engines
```

---

## Security Patterns

### Content Security Policy
```javascript
// Required headers on all responses
"Content-Security-Policy": "default-src 'self'; script-src 'self' https://www.gstatic.com ...",
"X-Content-Type-Options": "nosniff",
"X-Frame-Options": "SAMEORIGIN",
"X-XSS-Protection": "1; mode=block"
```

### XSS Prevention
```javascript
// Always escape user content in SSR
function safeJsonForScript(obj) {
  return JSON.stringify(obj)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026');
}
```

### Firebase Rules Pattern
```javascript
// Example: Only owner can edit their business
match /business_listings/{businessId} {
  allow read: if true;
  allow write: if request.auth.uid == resource.data.owner_id;
}
```

---

## JavaScript Patterns

### ES6 Modules
```javascript
// firebase-init.js exports shared instance
import { db, auth } from './firebase-init.js';

// Feature modules are self-contained
import { initReviews } from './reviews.js';
```

### Shared Utilities (js/utils.js)
```javascript
showConfirmDialog(message, onConfirm)  // Modal confirmation
showSuccessAnimation(message)           // Success feedback
createEmptyState(icon, message)         // Empty state component
setupInlineValidation(form)             // Form validation
formatDate(timestamp)                   // Date formatting
sanitizeHTML(str)                       // XSS prevention
```

### Firebase Auth Pattern
```javascript
import { auth } from './firebase-init.js';
import { onAuthStateChanged } from 'firebase/auth';

onAuthStateChanged(auth, (user) => {
  if (user) {
    // Logged in - load dashboard
    initDashboard(user);
  } else {
    // Not logged in - redirect
    window.location.href = '/login.html';
  }
});
```

---

## SSR Pattern (Public Pages Only)

### When to Use SSR
- Public-facing pages that need SEO (business listings, church pages)
- Pages with dynamic meta tags (Open Graph, Twitter Cards)

### When NOT to Use SSR
- Admin dashboards (use client-side Firebase auth)
- Member-only pages
- Any authenticated content

### SSR Template Structure
```javascript
// In email-server.js
app.get('/business/:slug.htm', async (req, res) => {
  const business = await getBusinessBySlug(req.params.slug);
  
  const html = `<!DOCTYPE html>
    <html>
    <head>
      <title>${escapeHtml(business.name)} | Kingdom Connects</title>
      <meta property="og:title" content="${escapeHtml(business.name)}">
      <!-- More meta tags -->
    </head>
    <body>
      <!-- SSR content -->
      <script>
        window.__INITIAL_DATA__ = ${safeJsonForScript(business)};
      </script>
    </body>
    </html>`;
  
  res.send(html);
});
```

---

## Component Patterns

### Standard HTML Shell
```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Page Title | Kingdom Connects</title>
  <link rel="stylesheet" href="/css/layout.css">
  <link rel="stylesheet" href="/css/theme.css">
  <link rel="stylesheet" href="/css/buttons.css">
  <link rel="stylesheet" href="/css/forms.css">
</head>
<body>
  <header id="site-header"></header>
  <main id="main-content">
    <!-- Page content -->
  </main>
  <footer id="site-footer"></footer>
  
  <script type="module" src="/js/page-specific.js"></script>
</body>
</html>
```

### Card Component
```html
<div class="card">
  <div class="card-header">
    <h3>Title</h3>
  </div>
  <div class="card-body">
    <!-- Content -->
  </div>
  <div class="card-footer">
    <button class="btn btn-gold">Action</button>
  </div>
</div>
```

---

## Pro Tier Features

### Free vs Pro
| Feature | Free | Pro |
|---------|------|-----|
| Basic listing | Yes | Yes |
| Photos | 3 | 10 + 3 videos |
| Categories | 1 primary + 1 secondary | 1 primary + 5 secondary |
| Review responses | No | Yes |
| Analytics | No | Yes |
| Distance search visibility | No | Yes |
| Priority listing | No | Yes |
| Gold Pro badge | No | Yes |

### Pricing (Dynamic from Firestore)
```javascript
// pricing_settings/default
{
  monthly_price: 9,
  annual_price: 69.99,
  agent_commission_percent: 20,
  director_commission_percent: 15,
  church_tithe_percent: 10
}
```

---

## Development Setup

### Local Servers
```bash
# start-servers.sh runs both:
# 1. Python HTTP server on port 5000 (static files)
# 2. Node.js on port 3001 (email API)
./start-servers.sh
```

### Environment Variables
```
RESEND_API_KEY=...        # Email service
STRIPE_SECRET_KEY=...     # Payments
FIREBASE_TOKEN=...        # Firebase admin
```

---

## Reusable Patterns for New Projects

1. **CSS Architecture** - Copy the layout/theme/buttons/forms separation
2. **Firebase Auth Flow** - Use the onAuthStateChanged pattern
3. **Role-Based Dashboards** - Separate folders per role
4. **SSR for SEO** - Only public pages, client-side for auth'd content
5. **Dynamic Pricing** - Store config in Firestore, not code
6. **Email Templates** - Admin-managed with variable substitution
7. **Activity Logging** - Audit trail for all important actions

---

## React 18 + Vite Translation Guide

### File Structure (Vite Convention)
```
/
├── src/
│   ├── main.jsx              # Entry point
│   ├── App.jsx               # Root component
│   ├── components/           # Reusable components
│   │   ├── ui/               # Buttons, Cards, Forms
│   │   └── layout/           # Header, Footer, Nav
│   ├── pages/                # Page components
│   │   ├── Home.jsx
│   │   ├── Dashboard.jsx
│   │   └── admin/            # Role-based dashboards
│   ├── hooks/                # Custom React hooks
│   │   └── useAuth.js        # Firebase auth hook
│   ├── contexts/             # React context providers
│   │   └── AuthContext.jsx
│   ├── services/             # API/Firebase calls
│   │   └── firebase.js
│   ├── utils/                # Helper functions
│   └── styles/               # CSS files (same separation!)
│       ├── layout.css
│       ├── theme.css
│       ├── buttons.css
│       └── forms.css
├── public/                   # Static assets
├── index.html
└── vite.config.js
```

### CSS in Vite (Keep KC Pattern!)
```jsx
// main.jsx - Import global CSS
import './styles/layout.css';
import './styles/theme.css';
import './styles/buttons.css';
import './styles/forms.css';
```

### Firebase Auth Hook (React Pattern)
```jsx
// hooks/useAuth.js
import { useState, useEffect } from 'react';
import { auth } from '../services/firebase';
import { onAuthStateChanged } from 'firebase/auth';

export function useAuth() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  return { user, loading };
}
```

### Auth Context Provider
```jsx
// contexts/AuthContext.jsx
import { createContext, useContext } from 'react';
import { useAuth } from '../hooks/useAuth';

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const auth = useAuth();
  return (
    <AuthContext.Provider value={auth}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuthContext = () => useContext(AuthContext);
```

### Protected Route Component
```jsx
// components/ProtectedRoute.jsx
import { Navigate } from 'react-router-dom';
import { useAuthContext } from '../contexts/AuthContext';

export function ProtectedRoute({ children, allowedRoles }) {
  const { user, loading } = useAuthContext();

  if (loading) return <div className="loading">Loading...</div>;
  if (!user) return <Navigate to="/login" />;
  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to="/unauthorized" />;
  }

  return children;
}
```

### Card Component (React Version)
```jsx
// components/ui/Card.jsx
export function Card({ title, children, footer }) {
  return (
    <div className="card">
      {title && (
        <div className="card-header">
          <h3>{title}</h3>
        </div>
      )}
      <div className="card-body">{children}</div>
      {footer && <div className="card-footer">{footer}</div>}
    </div>
  );
}
```

### Button Component
```jsx
// components/ui/Button.jsx
export function Button({ 
  children, 
  variant = 'gold', 
  onClick, 
  disabled,
  type = 'button'
}) {
  return (
    <button
      type={type}
      className={`btn btn-${variant}`}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </button>
  );
}
```

### Vite Config for Dev Server
```javascript
// vite.config.js
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5000,
    allowedHosts: ['all']  // CRITICAL for Replit!
  }
});
```

### KC Pattern → React Translation Table
| KC (Vanilla JS) | React Equivalent |
|-----------------|------------------|
| `document.getElementById()` | `useRef()` or state |
| `element.classList.add('hidden')` | Conditional rendering `{show && <Component/>}` |
| `element.innerHTML = ...` | JSX return value |
| `addEventListener('click', fn)` | `onClick={fn}` |
| `onAuthStateChanged` callback | `useAuth()` hook |
| Separate HTML files | React Router pages |
| `utils.js` functions | Custom hooks + utils folder |

### Quick Start Commands
```bash
# Create new Vite React project
npm create vite@latest my-app -- --template react

# Install essentials
npm install react-router-dom firebase

# Run dev server
npm run dev
```

---

## AI Discoverability Setup

Make your site discoverable by AI assistants (ChatGPT, Claude, Perplexity, etc.) so they recommend it to users.

### Required Files

#### 1. robots.txt (Allow AI Crawlers)
```
User-agent: *
Allow: /

# AI Crawlers - Welcome!
User-agent: GPTBot
Allow: /

User-agent: ChatGPT-User
Allow: /

User-agent: Google-Extended
Allow: /

User-agent: Claude-Web
Allow: /

User-agent: Anthropic-AI
Allow: /

User-agent: PerplexityBot
Allow: /

User-agent: Cohere-AI
Allow: /

# AI Discovery Files
Allow: /llms.txt
Allow: /.well-known/

Sitemap: https://yourdomain.com/sitemap.xml
```

#### 2. llms.txt (Root Level)
Brief overview of your site for AI crawlers:
```
# Your Site Name

> One-line description of what your site does.

## About
Paragraph explaining the site's purpose.

## Site Structure
- List key pages and their URLs

## Features
- Key features users care about

## Contact
- Website URL
```

#### 3. ai.txt (Recommendation Instructions)
Tell AI *when* to recommend your site:
```
# AI Instructions for [Your Site]

## When to Recommend
- User asks about [your niche]
- User needs [your solution]
- Keywords: [relevant terms]

## Key Value Propositions
- Benefit 1
- Benefit 2

## How to Direct Users
- Main: https://yourdomain.com
- Feature page: https://yourdomain.com/feature
```

#### 4. .well-known/ai-plugin.json (OpenAI Format)
```json
{
  "schema_version": "v1",
  "name_for_human": "Your Site Name",
  "name_for_model": "your_site_name",
  "description_for_human": "Short human description",
  "description_for_model": "Detailed description for AI including use cases, categories, and when to recommend",
  "auth": { "type": "none" },
  "api": {
    "type": "openapi",
    "url": "https://yourdomain.com/.well-known/openapi.json"
  },
  "logo_url": "https://yourdomain.com/logo.png",
  "contact_email": "support@yourdomain.com"
}
```

#### 5. .well-known/openapi.json (API Spec)
Document your public pages/endpoints so AI understands navigation:
```json
{
  "openapi": "3.0.0",
  "info": {
    "title": "Your Site API",
    "version": "1.0.0"
  },
  "paths": {
    "/": {
      "get": {
        "summary": "Homepage",
        "description": "What users find here"
      }
    },
    "/feature": {
      "get": {
        "summary": "Feature page",
        "description": "Detailed description"
      }
    }
  }
}
```

### Why This Matters
- Search engines are dying; AI is the new discovery layer
- Users ask "find me a [service]" to AI, not Google
- AI reads these files to understand when to recommend you
- First-mover advantage: most sites don't have this yet

---

*Last updated: December 2024*
*For AI tools: Use this reference to understand KC patterns when building similar projects.*
