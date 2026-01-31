import { Link, useLocation } from "wouter";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Home } from "lucide-react";

interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface PageBreadcrumbProps {
  items?: BreadcrumbItem[];
  currentPage?: string;
}

const routeLabels: Record<string, string> = {
  "/": "Home",
  "/store": "Shop",
  "/gallery": "Shop",
  "/creator": "Create",
  "/account": "My Account",
  "/admin": "Admin",
  "/cart": "Cart",
};

export default function PageBreadcrumb({ items, currentPage }: PageBreadcrumbProps) {
  const [location] = useLocation();
  
  const pathSegments = location.split("/").filter(Boolean);
  
  const breadcrumbItems: BreadcrumbItem[] = items || [];
  const finalPage = currentPage || routeLabels[location] || pathSegments[pathSegments.length - 1] || "Page";

  return (
    <div className="container py-3">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link href="/" className="flex items-center gap-1" data-testid="breadcrumb-home">
                <Home className="w-3.5 h-3.5" />
                <span className="sr-only sm:not-sr-only">Home</span>
              </Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          
          {breadcrumbItems.map((item, index) => (
            <span key={index} className="contents">
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                {item.href ? (
                  <BreadcrumbLink asChild>
                    <Link href={item.href} data-testid={`breadcrumb-${item.label.toLowerCase()}`}>
                      {item.label}
                    </Link>
                  </BreadcrumbLink>
                ) : (
                  <BreadcrumbPage data-testid={`breadcrumb-${item.label.toLowerCase()}`}>
                    {item.label}
                  </BreadcrumbPage>
                )}
              </BreadcrumbItem>
            </span>
          ))}
          
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage data-testid="breadcrumb-current">{finalPage}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>
    </div>
  );
}
