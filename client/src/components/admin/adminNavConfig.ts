import {
  Package,
  Image,
  Box,
  Zap,
  Film,
  Type,
  Store,
  ShoppingBag,
  Users,
  DollarSign,
  Tag,
  Gift,
  Settings,
  Activity,
  Mail,
  BookOpen,
  MapPin,
  Globe,
  LayoutGrid,
  Layers,
} from "lucide-react";

export interface SubNavItem {
  label: string;
  href: string;
  icon: typeof Package;
}

export const BUILD_SUBNAV: SubNavItem[] = [
  { label: "Products", href: "/admin/products", icon: Package },
  { label: "Library", href: "/admin/library", icon: Image },
  { label: "Blanks", href: "/admin/blanks", icon: Box },
  { label: "Dynamics", href: "/admin/dynamics", icon: Zap },
  { label: "Videos", href: "/admin/videos", icon: Film },
  { label: "Fonts", href: "/admin/fonts", icon: Type },
];

export const PLACE_SUBNAV: SubNavItem[] = [
  { label: "Store Builder", href: "/admin/store-builder", icon: Store },
  { label: "Library", href: "/admin/store-library", icon: LayoutGrid },
  { label: "Partners", href: "/admin/partners", icon: Users },
  { label: "External Sites", href: "/admin/external-sites", icon: Globe },
  { label: "Marketplaces", href: "/admin/marketplaces", icon: MapPin },
];

export const SELL_SUBNAV: SubNavItem[] = [
  { label: "Orders", href: "/admin/orders", icon: ShoppingBag },
  { label: "Customers", href: "/admin/customers", icon: Users },
  { label: "Pricing", href: "/admin/pricing", icon: DollarSign },
  { label: "Coupons", href: "/admin/coupons", icon: Tag },
  { label: "Gifts", href: "/admin/gifts", icon: Gift },
  { label: "Orchestration", href: "/admin/orchestration", icon: Layers },
];

export const SYSTEM_SUBNAV: SubNavItem[] = [
  { label: "Settings", href: "/admin/settings", icon: Settings },
  { label: "Health", href: "/admin/health", icon: Activity },
  { label: "Email", href: "/admin/email-templates", icon: Mail },
  { label: "Email Health", href: "/admin/email-health", icon: Activity },
  { label: "Manual", href: "/admin/manual", icon: BookOpen },
];

const MODE_MAP: Array<{ prefixes: string[]; mode: string }> = [
  {
    prefixes: [
      "/admin/products",
      "/admin/library",
      "/admin/blanks",
      "/admin/categories",
      "/admin/tags",
      "/admin/videos",
      "/admin/fonts",
      "/admin/dynamics",
      "/admin/backgrounds",
    ],
    mode: "Build",
  },
  {
    prefixes: [
      "/admin/store-builder",
      "/admin/store-library",
      "/admin/partners",
      "/admin/marketplaces",
      "/admin/external-sites",
    ],
    mode: "Place",
  },
  {
    prefixes: [
      "/admin/orders",
      "/admin/customers",
      "/admin/pricing",
      "/admin/coupons",
      "/admin/gifts",
      "/admin/orchestration",
    ],
    mode: "Sell",
  },
  {
    prefixes: [
      "/admin/settings",
      "/admin/health",
      "/admin/email-templates",
      "/admin/email-health",
      "/admin/manual",
      "/admin/ar-demo",
    ],
    mode: "System",
  },
];

export function getModeForPath(path: string): string | null {
  for (const entry of MODE_MAP) {
    if (entry.prefixes.some((p) => path.startsWith(p))) return entry.mode;
  }
  return null;
}
