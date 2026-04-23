import { Link } from "wouter";
import { ChevronRight } from "lucide-react";

export interface BreadcrumbCrumb {
  label: string;
  href?: string;
}

export function StorefrontBreadcrumb({ crumbs }: { crumbs: BreadcrumbCrumb[] }) {
  if (crumbs.length === 0) return null;
  return (
    <nav
      className="flex items-center flex-wrap gap-1 text-sm text-muted-foreground mb-6"
      aria-label="Breadcrumb"
      data-testid="nav-breadcrumb"
    >
      {crumbs.map((crumb, i) => (
        <div key={i} className="flex items-center gap-1">
          {i > 0 && (
            <ChevronRight className="h-3.5 w-3.5 opacity-40 flex-shrink-0" aria-hidden />
          )}
          {crumb.href ? (
            <Link
              href={crumb.href}
              className="hover:text-foreground transition-colors"
              data-testid={`breadcrumb-${i}`}
            >
              {crumb.label}
            </Link>
          ) : (
            <span
              className="text-foreground font-medium"
              aria-current="page"
              data-testid={`breadcrumb-${i}`}
            >
              {crumb.label}
            </span>
          )}
        </div>
      ))}
    </nav>
  );
}
