import { Home, ShoppingBag, User, Settings, LayoutDashboard, Package, DollarSign, Image, Video, Tag, Users, Truck, Gift, Heart, Activity, Mail, Palette, PenTool, Store, QrCode, History } from "lucide-react";

export interface BreadcrumbItem {
  label: string;
  href: string;
  icon?: any;
}

interface RouteConfig {
  label: string;
  parent?: string;
  icon?: any;
}

const routeMap: Record<string, RouteConfig> = {
  "/": { label: "Home", icon: Home },
  
  "/creator": { label: "Creator", parent: "/", icon: PenTool },
  "/store": { label: "Store", parent: "/", icon: Store },
  "/gallery": { label: "Gallery", parent: "/", icon: Image },
  "/cart": { label: "Cart", parent: "/", icon: ShoppingBag },
  "/account": { label: "Account", parent: "/", icon: User },
  "/gifts": { label: "Gifts", parent: "/", icon: Gift },
  "/gift/redeem": { label: "Redeem Gift", parent: "/gifts", icon: Gift },
  "/login": { label: "Login", parent: "/" },
  "/register": { label: "Register", parent: "/" },
  "/checkout/success": { label: "Order Complete", parent: "/cart" },
  
  "/qr-basics": { label: "QR Basics", parent: "/", icon: QrCode },
  "/qr-plus": { label: "QR Plus", parent: "/", icon: QrCode },
  "/qr-canvas": { label: "QR Canvas", parent: "/", icon: QrCode },
  "/qr-play": { label: "QR Play", parent: "/", icon: QrCode },
  "/qr-dynamics": { label: "QR Dynamics", parent: "/", icon: QrCode },
  "/qr-history": { label: "QR History", parent: "/", icon: History },
  
  // QR Basics examples
  "/website-qr-shirts": { label: "Website QR Shirts", parent: "/qr-basics" },
  "/office-qr-mug": { label: "Office QR Mug", parent: "/qr-basics" },
  "/lost-found-qr": { label: "Lost & Found QR", parent: "/qr-basics" },
  "/networking-qr-shirts": { label: "Networking QR Shirts", parent: "/qr-basics" },
  "/medical-alert-qr": { label: "Medical Alert QR", parent: "/qr-basics" },
  "/personal-items-qr": { label: "Personal Items QR", parent: "/qr-basics" },
  "/everyday-qr": { label: "Everyday QR", parent: "/qr-basics" },
  
  // QR Plus examples
  "/business-qr-plus": { label: "Business QR Plus", parent: "/qr-plus" },
  "/event-qr-shirts": { label: "Event QR Shirts", parent: "/qr-plus" },
  
  // QR Canvas examples
  "/wedding-qr-shirts": { label: "Wedding QR Shirts", parent: "/qr-canvas" },
  "/family-reunion-shirts": { label: "Family Reunion Shirts", parent: "/qr-canvas" },
  "/artist-qr-apparel": { label: "Artist QR Apparel", parent: "/qr-canvas" },
  "/memorial-qr-gifts": { label: "Memorial QR Gifts", parent: "/qr-canvas" },
  "/musician-merch": { label: "Musician Merch", parent: "/qr-canvas" },
  
  // QR Play examples
  "/memorial-video-shirts": { label: "Memorial Video Shirts", parent: "/qr-play" },
  "/family-video-messages": { label: "Family Video Messages", parent: "/qr-play" },
  "/video-time-capsule": { label: "Video Time Capsule", parent: "/qr-play" },
  
  // QR Dynamics examples
  "/advent-qr-shirts": { label: "Advent QR Shirts", parent: "/qr-dynamics" },
  "/band-dynamic-merch": { label: "Band Dynamic Merch", parent: "/qr-dynamics" },
  "/realtor-qr-shirts": { label: "Realtor QR Shirts", parent: "/qr-dynamics" },
  "/business-analytics-qr": { label: "Business Analytics QR", parent: "/qr-dynamics" },
  
  "/admin": { label: "Admin", parent: "/", icon: Settings },
  "/admin/dashboard": { label: "Dashboard", parent: "/admin", icon: LayoutDashboard },
  
  "/admin/orders": { label: "Orders", parent: "/admin/dashboard", icon: Truck },
  "/admin/customers": { label: "Customers", parent: "/admin/dashboard", icon: Users },
  "/admin/health": { label: "System Health", parent: "/admin/dashboard", icon: Activity },
  "/admin/coupons": { label: "Promo Codes", parent: "/admin/dashboard", icon: Tag },
  
  "/admin/products": { label: "Products", parent: "/admin", icon: Package },
  "/admin/pricing": { label: "Pricing", parent: "/admin", icon: DollarSign },
  "/admin/library": { label: "Library", parent: "/admin", icon: Image },
  "/admin/videos": { label: "Videos", parent: "/admin", icon: Video },
  "/admin/categories": { label: "Categories", parent: "/admin", icon: Tag },
  "/admin/tags": { label: "Tags", parent: "/admin", icon: Tag },
  "/admin/partners": { label: "Partners", parent: "/admin", icon: Users },
  "/admin/orchestration": { label: "Orchestration", parent: "/admin", icon: Package },
  "/admin/gifts": { label: "Gifts", parent: "/admin", icon: Gift },
  "/admin/email-templates": { label: "Email Templates", parent: "/admin", icon: Mail },
  "/admin/sales/build": { label: "Build Store", parent: "/admin/partners", icon: Store },
};

export function getBreadcrumbs(path: string, dynamicLabel?: string): BreadcrumbItem[] {
  const crumbs: BreadcrumbItem[] = [];
  
  let normalizedPath = path.split("?")[0];
  
  if (normalizedPath.startsWith("/view/")) {
    crumbs.push({ label: "Home", href: "/", icon: Home });
    crumbs.push({ label: dynamicLabel || "View QR", href: normalizedPath, icon: QrCode });
    return crumbs;
  }
  
  if (normalizedPath.startsWith("/dynamic/")) {
    crumbs.push({ label: "Home", href: "/", icon: Home });
    crumbs.push({ label: dynamicLabel || "Dynamic QR", href: normalizedPath, icon: QrCode });
    return crumbs;
  }
  
  if (normalizedPath.startsWith("/customs/")) {
    crumbs.push({ label: "Home", href: "/", icon: Home });
    crumbs.push({ label: "Creator", href: "/creator", icon: PenTool });
    crumbs.push({ label: dynamicLabel || "Customize", href: normalizedPath, icon: Palette });
    return crumbs;
  }
  
  if (normalizedPath.startsWith("/shop/")) {
    crumbs.push({ label: "Home", href: "/", icon: Home });
    crumbs.push({ label: "Store", href: "/store", icon: Store });
    crumbs.push({ label: dynamicLabel || "Shop", href: normalizedPath, icon: ShoppingBag });
    return crumbs;
  }
  
  if (normalizedPath.startsWith("/gift/redeem/")) {
    crumbs.push({ label: "Home", href: "/", icon: Home });
    crumbs.push({ label: "Gifts", href: "/gifts", icon: Gift });
    crumbs.push({ label: "Redeem", href: normalizedPath, icon: Gift });
    return crumbs;
  }
  
  let currentPath = normalizedPath;
  const visited = new Set<string>();
  
  while (currentPath && !visited.has(currentPath)) {
    visited.add(currentPath);
    const config = routeMap[currentPath];
    
    if (config) {
      crumbs.unshift({
        label: currentPath === normalizedPath && dynamicLabel ? dynamicLabel : config.label,
        href: currentPath,
        icon: config.icon,
      });
      currentPath = config.parent || "";
    } else {
      break;
    }
  }
  
  if (crumbs.length === 0 || crumbs[0].href !== "/") {
    crumbs.unshift({ label: "Home", href: "/", icon: Home });
  }
  
  return crumbs;
}
