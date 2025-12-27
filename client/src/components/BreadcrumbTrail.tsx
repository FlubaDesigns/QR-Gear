import { Link, useLocation } from "wouter";
import { ChevronRight } from "lucide-react";
import { getBreadcrumbs, BreadcrumbItem } from "@/lib/breadcrumbs";

interface BreadcrumbTrailProps {
  dynamicLabel?: string;
}

export default function BreadcrumbTrail({ dynamicLabel }: BreadcrumbTrailProps) {
  const [location] = useLocation();
  const crumbs = getBreadcrumbs(location, dynamicLabel);

  if (crumbs.length <= 1) {
    return null;
  }

  return (
    <nav className="breadcrumb-bar" aria-label="Breadcrumb" data-testid="nav-breadcrumb">
      <ol className="breadcrumb-list">
        {crumbs.map((crumb, index) => {
          const isLast = index === crumbs.length - 1;
          const Icon = crumb.icon;

          return (
            <li key={crumb.href} className="breadcrumb-item">
              {index > 0 && (
                <span className="breadcrumb-separator" aria-hidden="true">
                  <ChevronRight />
                </span>
              )}
              {isLast ? (
                <span 
                  className="breadcrumb-current" 
                  aria-current="page"
                  data-testid={`breadcrumb-current-${crumb.label.toLowerCase().replace(/\s+/g, '-')}`}
                >
                  {Icon && <Icon />}
                  <span>{crumb.label}</span>
                </span>
              ) : (
                <Link 
                  href={crumb.href} 
                  className="breadcrumb-link"
                  data-testid={`breadcrumb-link-${crumb.label.toLowerCase().replace(/\s+/g, '-')}`}
                >
                  {Icon && <Icon />}
                  <span>{crumb.label}</span>
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
