import { useLocation, Link } from "wouter";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
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
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

const adminSections = [
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
    title: "Backgrounds",
    description: "Upload and manage QR background images",
    icon: Image,
    href: "/admin/backgrounds",
  },
  {
    title: "Videos",
    description: "Upload and manage video backgrounds for QR pages",
    icon: Video,
    href: "/admin/videos",
  },
  {
    title: "Templates",
    description: "Manage product category templates",
    icon: Tag,
    href: "/admin/categories",
  },
  {
    title: "Tags",
    description: "Organize products by seasons, holidays, and occasions",
    icon: Tag,
    href: "/admin/tags",
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
              <Button asChild size="lg" data-testid="button-store-builder">
                <Link href="/admin/sales/build">
                  <Store className="h-5 w-5 mr-2" />
                  Build Store Segment
                </Link>
              </Button>
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
