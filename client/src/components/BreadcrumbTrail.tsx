import { Link, useLocation } from "wouter";

const routeLabels: Record<string, string> = {
  "": "Home",
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
};

interface BreadcrumbTrailProps {
  dynamicLabel?: string;
  currentPage?: string;
}

export default function BreadcrumbTrail({ dynamicLabel, currentPage }: BreadcrumbTrailProps) {
  const [location] = useLocation();
  const segments = location.split("/").filter(Boolean);

  if (segments.length === 0) return null;

  const crumbs: { label: string; href: string }[] = [];

  if (segments.length === 1) {
    crumbs.push({ label: "Home", href: "/" });
  }

  let path = "";
  segments.forEach((seg, i) => {
    path += "/" + seg;
    const isLast = i === segments.length - 1;
    const label = isLast && currentPage
      ? currentPage
      : isLast && dynamicLabel
        ? dynamicLabel
        : routeLabels[seg] || seg.replace(/-/g, " ").replace(/\b\w/g, c => c.toUpperCase());
    crumbs.push({ label, href: path });
  });

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
