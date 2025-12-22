import { Link, useLocation } from "wouter";
import { ChevronRight, Home } from "lucide-react";

const routeNames: Record<string, string> = {
  "": "Home",
  "store": "Store",
  "creator": "Creator",
  "cart": "Cart",
  "checkout": "Checkout",
  "admin": "Admin",
  "orders": "Orders",
  "account": "Account",
};

export function Breadcrumbs() {
  const [location] = useLocation();
  const pathSegments = location.split("/").filter(Boolean);
  
  if (pathSegments.length === 0) return null;

  const breadcrumbs = pathSegments.map((segment, index) => {
    const path = "/" + pathSegments.slice(0, index + 1).join("/");
    const name = routeNames[segment] || segment.charAt(0).toUpperCase() + segment.slice(1);
    const isLast = index === pathSegments.length - 1;
    
    return { path, name, isLast };
  });

  return (
    <nav className="flex items-center gap-1 text-sm text-muted-foreground px-4 py-2" data-testid="breadcrumbs">
      <Link href="/" className="flex items-center hover:text-foreground transition-colors">
        <Home className="h-4 w-4" />
      </Link>
      {breadcrumbs.map((crumb, index) => (
        <span key={crumb.path} className="flex items-center gap-1">
          <ChevronRight className="h-4 w-4" />
          {crumb.isLast ? (
            <span className="text-foreground font-medium">{crumb.name}</span>
          ) : (
            <Link href={crumb.path} className="hover:text-foreground transition-colors">
              {crumb.name}
            </Link>
          )}
        </span>
      ))}
    </nav>
  );
}
