import { useLocation, Link } from "wouter";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import BreadcrumbTrail from "@/components/BreadcrumbTrail";
import {
  ArrowLeft,
  Package,
  DollarSign,
  Image,
  Video,
  Tag,
  Store,
  Settings,
  ChevronRight,
  Globe,
  LayoutDashboard,
  Users,
  Activity,
  Percent,
  ShoppingCart,
  Gift,
  Mail,
  Book,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

const adminSections = [
  {
    title: "Dashboard",
    description: "Analytics, revenue, and business metrics",
    icon: LayoutDashboard,
    href: "/admin/dashboard",
  },
  {
    title: "Orders",
    description: "View and manage customer orders",
    icon: ShoppingCart,
    href: "/admin/orders",
  },
  {
    title: "Customers",
    description: "View customer list and order history",
    icon: Users,
    href: "/admin/customers",
  },
  {
    title: "Products",
    description: "Manage product catalog and sync from Printify",
    icon: Package,
    href: "/admin/products",
  },
  {
    title: "Pricing",
    description: "Set markup, production costs, and upcharges",
    icon: DollarSign,
    href: "/admin/pricing",
  },
  {
    title: "Promo Codes",
    description: "Create and manage discount codes",
    icon: Percent,
    href: "/admin/coupons",
  },
  {
    title: "Library",
    description: "Manage templates and backgrounds",
    icon: Image,
    href: "/admin/library",
  },
  {
    title: "Videos",
    description: "Upload and manage video backgrounds for QR pages",
    icon: Video,
    href: "/admin/videos",
  },
  {
    title: "Gifts",
    description: "Manage gift packages and codes",
    icon: Gift,
    href: "/admin/gifts",
  },
  {
    title: "Templates",
    description: "Manage product category templates",
    icon: Tag,
    href: "/admin/categories",
  },
  {
    title: "Partners",
    description: "Manage partner stores and product lines",
    icon: Store,
    href: "/admin/partners",
  },
  {
    title: "Multi-Provider",
    description: "Orchestrate products across Printify, Printful, Etsy, eBay, Amazon",
    icon: Globe,
    href: "/admin/orchestration",
  },
  {
    title: "System Health",
    description: "Monitor provider status and system health",
    icon: Activity,
    href: "/admin/health",
  },
  {
    title: "Email Templates",
    description: "Manage email templates and view logs",
    icon: Mail,
    href: "/admin/email-templates",
  },
  {
    title: "Email Health",
    description: "Monitor email system health and queue",
    icon: Mail,
    href: "/admin/email-health",
  },
  {
    title: "Admin Manual",
    description: "Complete guide to managing QR Gear",
    icon: Book,
    href: "/admin/manual",
  },
];

export default function Admin() {
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();

  const copyUserId = () => {
    if (user?.id) {
      navigator.clipboard.writeText(user.id);
      toast({ title: "User ID copied to clipboard" });
    }
  };

  return (
    <div className="min-h-screen">
      <BreadcrumbTrail />
      <div className="bg-slate-900 dark:bg-slate-950 text-white">
        <div className="container max-w-6xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigate("/")}
                className="text-white hover:bg-white/10"
                data-testid="button-back"
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div className="flex items-center gap-2">
                <Settings className="h-6 w-6 text-amber-400" />
                <div>
                  <h1 className="text-xl font-bold font-heading" data-testid="text-page-title">
                    QR Gear Admin
                  </h1>
                  <p className="text-xs text-slate-400">
                    Manage products, pricing, and content
                  </p>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {user && (
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={copyUserId}
                  className="font-mono text-xs border-slate-600 text-slate-300 hover:bg-slate-800"
                  data-testid="button-copy-user-id"
                >
                  Copy ID
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>

      <main className="container max-w-6xl mx-auto py-6 px-4">
        <nav className="mb-4 text-sm" aria-label="Breadcrumb">
          <span className="text-muted-foreground">Home</span>
          <span className="text-muted-foreground mx-2">/</span>
          <span className="text-foreground font-medium" aria-current="page">Admin Dashboard</span>
        </nav>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {adminSections.map((section) => (
            <Link
              key={section.href}
              href={section.href}
              className="flex flex-col items-center justify-center gap-3 p-4 min-h-[140px] rounded-xl border-2 border-border bg-card hover-elevate active-elevate-2 transition-all text-center"
              data-testid={`button-admin-${section.title.toLowerCase().replace(/\s+/g, '-')}`}
            >
              <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                <section.icon className="h-6 w-6 text-primary" />
              </div>
              <div>
                <div className="font-semibold text-base">{section.title}</div>
                <div className="text-xs text-muted-foreground mt-1 line-clamp-2">{section.description}</div>
              </div>
            </Link>
          ))}
        </div>

        {user && (
          <div className="mt-8 p-4 bg-muted/50 rounded-lg">
            <p className="text-sm text-muted-foreground">
              Logged in as <span className="font-medium text-foreground">{user.email || user.id}</span>
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
