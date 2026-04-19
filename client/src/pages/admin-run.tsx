import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import {
  Hammer,
  MapPin,
  ShoppingCart,
  Settings,
  Package,
  Layers,
  Store,
  DollarSign,
  Users,
  BookOpen,
  FolderOpen,
  Plus,
  Activity,
  Zap,
  Play,
  Clock,
  Bookmark,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAdminAuth } from "@/features/shared/AdminAuthContext";

interface QuickAction {
  label: string;
  description: string;
  icon: typeof Hammer;
  href: string;
  primary?: boolean;
}

interface SectionEntry {
  label: string;
  description: string;
  icon: typeof Hammer;
  href: string;
  color: string;
}

interface BuildSession {
  id: string;
  draftName?: string;
  status: string;
  working?: { title?: string; description?: string };
  generated?: { packetId?: string };
  updatedAt?: string | null;
  lastActiveAt?: string | null;
}

const quickActions: QuickAction[] = [
  {
    label: "New Product",
    description: "Open the builder and start fresh",
    icon: Plus,
    href: "/admin/products",
    primary: true,
  },
  {
    label: "Load Template",
    description: "Resume from a saved template",
    icon: FolderOpen,
    href: "/admin/products",
  },
  {
    label: "Library",
    description: "Browse images, graphics, templates",
    icon: Layers,
    href: "/admin/library",
  },
  {
    label: "Store Builder",
    description: "Configure stores and channels",
    icon: Store,
    href: "/admin/store-builder",
  },
  {
    label: "Orders",
    description: "Review pending and recent orders",
    icon: ShoppingCart,
    href: "/admin/orders",
  },
  {
    label: "Customers",
    description: "View registered members",
    icon: Users,
    href: "/admin/customers",
  },
];

const sectionEntries: SectionEntry[] = [
  {
    label: "Build",
    description: "Products · Templates · Library · Blanks · Dynamics",
    icon: Hammer,
    href: "/admin/products",
    color: "text-blue-500",
  },
  {
    label: "Place",
    description: "Store Builder · Store Library · Partners · Marketplaces",
    icon: MapPin,
    href: "/admin/store-builder",
    color: "text-emerald-500",
  },
  {
    label: "Sell",
    description: "Orders · Customers · Pricing · Coupons · Gifts",
    icon: ShoppingCart,
    href: "/admin/orders",
    color: "text-orange-500",
  },
  {
    label: "System",
    description: "Settings · Health · Email · Manual",
    icon: Settings,
    href: "/admin/settings",
    color: "text-purple-500",
  },
];

function timeAgo(dateStr: string | null | undefined): string {
  if (!dateStr) return "";
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function InProgressSection() {
  const { getAuthHeaders, apiBase } = useAdminAuth();
  const [, navigate] = useLocation();

  const { data, isLoading } = useQuery({
    queryKey: ["/api/admin/build-sessions", "working"],
    queryFn: async () => {
      const headers = await getAuthHeaders();
      const res = await fetch(`${apiBase}/admin/build-sessions?status=working`, { headers });
      if (!res.ok) return { sessions: [] };
      return res.json();
    },
    staleTime: 30000,
  });

  const sessions: BuildSession[] = (data?.sessions || []).filter(
    (s: BuildSession) => s.draftName
  );

  if (isLoading || sessions.length === 0) return null;

  return (
    <section>
      <div className="flex items-center gap-1.5 mb-3">
        <Bookmark className="h-3.5 w-3.5 text-primary" />
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          In Progress
        </h2>
        <Badge variant="secondary" className="text-[10px] h-4 px-1.5 ml-0.5">
          {sessions.length}
        </Badge>
      </div>
      <div className="flex flex-col gap-2">
        {sessions.slice(0, 5).map((session) => {
          const label = session.draftName!;
          const productTitle = session.working?.title;
          const lastActive = session.lastActiveAt || session.updatedAt;
          return (
            <div
              key={session.id}
              className="flex items-center gap-3 p-3 rounded-md border border-border bg-card"
              data-testid={`run-draft-${session.id}`}
            >
              <div className="flex-shrink-0 h-8 w-8 rounded-md bg-primary/10 flex items-center justify-center">
                <Bookmark className="h-4 w-4 text-primary" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium leading-tight truncate">{label}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  {productTitle && (
                    <p className="text-xs text-muted-foreground truncate">{productTitle}</p>
                  )}
                  {lastActive && (
                    <span className="text-xs text-muted-foreground flex items-center gap-0.5 flex-shrink-0">
                      <Clock className="h-2.5 w-2.5" />
                      {timeAgo(lastActive)}
                    </span>
                  )}
                </div>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => navigate(`/admin/products?resume=${session.id}`)}
                data-testid={`run-draft-resume-${session.id}`}
                className="flex-shrink-0 gap-1.5"
              >
                <Play className="h-3 w-3" />
                Resume
              </Button>
            </div>
          );
        })}
      </div>
    </section>
  );
}

export default function AdminRun() {
  const [, navigate] = useLocation();

  return (
    <div className="min-h-screen bg-background">
      <div className="px-4 pt-6 pb-4 border-b border-border">
        <div className="flex items-center gap-2 mb-0.5">
          <Zap className="h-5 w-5 text-primary" />
          <h1 className="text-xl font-semibold tracking-tight">Run</h1>
        </div>
        <p className="text-sm text-muted-foreground">Your operating dashboard</p>
      </div>

      <div className="px-4 py-5 space-y-6">
        <InProgressSection />

        <section>
          <div className="flex items-center gap-1.5 mb-3">
            <Activity className="h-3.5 w-3.5 text-muted-foreground" />
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Quick Actions
            </h2>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {quickActions.map((action) => {
              const Icon = action.icon;
              return (
                <Card
                  key={action.label}
                  className={`cursor-pointer hover-elevate transition-all ${
                    action.primary ? "border-primary/30 bg-primary/5" : ""
                  }`}
                  onClick={() => navigate(action.href)}
                  data-testid={`run-action-${action.label.toLowerCase().replace(/\s+/g, "-")}`}
                >
                  <CardContent className="p-3 flex flex-col gap-1.5">
                    <Icon
                      className={`h-4 w-4 ${
                        action.primary ? "text-primary" : "text-muted-foreground"
                      }`}
                    />
                    <p
                      className={`text-sm font-medium leading-tight ${
                        action.primary ? "text-primary" : ""
                      }`}
                    >
                      {action.label}
                    </p>
                    <p className="text-xs text-muted-foreground leading-tight">
                      {action.description}
                    </p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </section>

        <section>
          <div className="flex items-center gap-1.5 mb-3">
            <Package className="h-3.5 w-3.5 text-muted-foreground" />
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Sections
            </h2>
          </div>
          <div className="flex flex-col gap-2">
            {sectionEntries.map((section) => {
              const Icon = section.icon;
              return (
                <button
                  key={section.label}
                  onClick={() => navigate(section.href)}
                  className="flex items-center gap-3 p-3 rounded-md text-left hover-elevate transition-colors border border-border bg-card w-full"
                  data-testid={`run-section-${section.label.toLowerCase()}`}
                >
                  <Icon className={`h-5 w-5 flex-shrink-0 ${section.color}`} />
                  <div className="min-w-0">
                    <p className="text-sm font-medium leading-tight">{section.label}</p>
                    <p className="text-xs text-muted-foreground truncate mt-0.5">
                      {section.description}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        <section>
          <div className="flex items-center gap-1.5 mb-3">
            <BookOpen className="h-3.5 w-3.5 text-muted-foreground" />
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Reference
            </h2>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => navigate("/admin/manual")}
              className="flex items-center gap-2 p-3 rounded-md text-left border border-border hover-elevate transition-colors bg-card"
              data-testid="run-link-manual"
            >
              <BookOpen className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              <span className="text-sm font-medium">Manual</span>
            </button>
            <button
              onClick={() => navigate("/admin/health")}
              className="flex items-center gap-2 p-3 rounded-md text-left border border-border hover-elevate transition-colors bg-card"
              data-testid="run-link-health"
            >
              <Activity className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              <span className="text-sm font-medium">Health</span>
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}
