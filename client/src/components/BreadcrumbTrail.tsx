import { Link, useLocation } from "wouter";

const routeLabels: Record<string, string> = {
  "store": "Shop",
  "gallery": "Shop",
  "build": "Create",
  "account": "My Account",
  "admin": "Admin",
  "cart": "Cart",
  "checkout": "Checkout",
  "member": "Members",
  "members": "Members",
  "login": "Sign In",
  "register": "Register",
  "gifts": "Gifts",
  "widget": "Widget",
  "qr-history": "QR History",
  "qr-basics": "QR Basics",
  "qr-plus": "QR Plus",
  "qr-canvas": "QR Canvas",
  "qr-play": "QR Play",
  "qr-dynamics": "QR Dynamics",
  "products": "Products",
  "pricing": "Pricing",
  "library": "Library",
  "store-builder": "Store Builder",
  "store-library": "Store Library",
  "fonts": "Fonts",
  "dynamics": "Dynamics",
  "ar-demo": "AR Demo",
  "health": "Health",
  "customers": "Customers",
  "categories": "Categories",
  "tags": "Tags",
  "videos": "Videos",
  "orders": "Orders",
  "manual": "Manual",
  "orchestration": "Orchestration",
  "partners": "Partners",
  "coupons": "Coupons",
  "dashboard": "Dashboard",
  "email-templates": "Email Templates",
  "email-health": "Email Health",
  "sales": "Sales",
  "earn": "Earn",
  "success": "Success",
  "redeem": "Redeem",
};

const hiddenRoutes = new Set(["/"]);

// Segments that are technical URL params with no real landing page — omit them
const skipSegments = new Set(["internal", "external"]);

// When a path would point to a non-existent route, remap it to a real one
const hrefOverrides: Record<string, string> = {
  "/shop": "/store",
};

export default function BreadcrumbTrail() {
  const [location] = useLocation();
  const segments = location.split("/").filter(Boolean);

  if (segments.length === 0) return null;

  const crumbs: { label: string; href: string }[] = [];

  let path = "";
  segments.forEach((seg, i) => {
    path += "/" + seg;
    if (skipSegments.has(seg)) return; // skip technical params
    const label = routeLabels[seg] || seg.replace(/-/g, " ").replace(/\b\w/g, c => c.toUpperCase());
    const href = hrefOverrides[path] ?? path;
    crumbs.push({ label, href });
  });

  if (crumbs.length === 0) return null;

  return (
    <nav className="container py-2 text-sm text-muted-foreground" aria-label="Breadcrumb" data-testid="nav-breadcrumb">
      {crumbs.map((crumb, i) => {
        const isLast = i === crumbs.length - 1;
        return (
          <span key={crumb.href}>
            {i > 0 && <span className="mx-1.5" aria-hidden="true">/</span>}
            {isLast ? (
              <span className="text-foreground font-medium" data-testid="breadcrumb-current">{crumb.label}</span>
            ) : (
              <Link href={crumb.href} className="hover:text-foreground transition-colors" data-testid={`breadcrumb-link-${crumb.label.toLowerCase().replace(/\s+/g, '-')}`}>
                {crumb.label}
              </Link>
            )}
          </span>
        );
      })}
    </nav>
  );
}
