import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import {
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
  Box,
} from "lucide-react";
import AdminShell from "@/components/AdminShell";
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
    title: "Blanks",
    description: "Set up base products for members to customize",
    icon: Box,
    href: "/admin/blanks",
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
    title: "Marketplaces",
    description: "Sell on Etsy, eBay, Amazon and other surfaces",
    icon: Globe,
    href: "/admin/marketplaces",
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
    title: "Settings",
    description: "Manage API keys and provider integrations",
    icon: Settings,
    href: "/admin/settings",
  },
  {
    title: "Admin Manual",
    description: "Complete guide to managing QR Gear",
    icon: Book,
    href: "/admin/manual",
  },
];

export default function Admin() {
  const { user } = useAuth();
  const { toast } = useToast();

  const copyUserId = () => {
    if (user?.id) {
      navigator.clipboard.writeText(user.id);
      toast({ title: "User ID copied to clipboard" });
    }
  };

  const actionButtons = user ? (
    <Button 
      variant="outline" 
      size="sm" 
      onClick={copyUserId}
      className="font-mono text-xs"
      data-testid="button-copy-user-id"
    >
      Copy ID
    </Button>
  ) : undefined;

  return (
    <AdminShell
      title="QR Gear Admin"
      subtitle="Manage products, pricing, and content"
      icon={Settings}
      backHref="/"
      backLabel="Back"
      actions={actionButtons}
    >
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
    </AdminShell>
  );
}
