/**
 * QR Gear Admin Utilities
 * Shared JavaScript library for admin pages
 * Centralizes common patterns for navigation, status handling, formatting, and UI helpers
 */

import { queryClient } from "./queryClient";

// ============================================
// Navigation Helpers
// ============================================

export function goBack(navigate: (path: string) => void, fallbackPath = "/admin") {
  if (window.history.length > 1) {
    window.history.back();
  } else {
    navigate(fallbackPath);
  }
}

export function navigateToAdmin(navigate: (path: string) => void, section?: string) {
  navigate(section ? `/admin/${section}` : "/admin");
}

// ============================================
// Status & Badge Helpers
// ============================================

export type HealthStatus = "healthy" | "degraded" | "down";
export type OrderStatus = "pending" | "processing" | "shipped" | "delivered" | "cancelled";
export type EmailStatus = "sent" | "failed" | "pending";

export const STATUS_CONFIG = {
  health: {
    healthy: { label: "Healthy", colorClass: "qr-status--success" },
    degraded: { label: "Degraded", colorClass: "qr-status--warning" },
    down: { label: "Down", colorClass: "qr-status--error" },
  },
  order: {
    pending: { label: "Pending", colorClass: "qr-status--warning" },
    processing: { label: "Processing", colorClass: "qr-status--info" },
    shipped: { label: "Shipped", colorClass: "qr-status--info" },
    delivered: { label: "Delivered", colorClass: "qr-status--success" },
    cancelled: { label: "Cancelled", colorClass: "qr-status--error" },
  },
  email: {
    sent: { label: "Sent", colorClass: "qr-status--success" },
    failed: { label: "Failed", colorClass: "qr-status--error" },
    pending: { label: "Pending", colorClass: "qr-status--warning" },
  },
} as const;

export function getStatusConfig<T extends keyof typeof STATUS_CONFIG>(
  type: T,
  status: keyof (typeof STATUS_CONFIG)[T]
) {
  return STATUS_CONFIG[type][status];
}

// ============================================
// Formatting Helpers
// ============================================

export function formatCurrency(amount: number, currency = "USD"): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
  }).format(amount);
}

export function formatDate(date: string | Date, options?: Intl.DateTimeFormatOptions): string {
  const defaultOptions: Intl.DateTimeFormatOptions = {
    year: "numeric",
    month: "short",
    day: "numeric",
  };
  return new Date(date).toLocaleDateString("en-US", options || defaultOptions);
}

export function formatDateTime(date: string | Date): string {
  return new Date(date).toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatTime(date: string | Date): string {
  return new Date(date).toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatNumber(num: number): string {
  return new Intl.NumberFormat("en-US").format(num);
}

export function formatPercentage(value: number, decimals = 1): string {
  return `${value.toFixed(decimals)}%`;
}

export function formatTrend(value: number): string {
  return value >= 0 ? `+${value}%` : `${value}%`;
}

// ============================================
// Query & Cache Helpers
// ============================================

export function invalidateAdminQueries(keys: string[]) {
  keys.forEach((key) => {
    queryClient.invalidateQueries({ queryKey: [key] });
  });
}

export function invalidateAllAdminData() {
  queryClient.invalidateQueries({ queryKey: ["/api/admin"] });
}

export const ADMIN_QUERY_KEYS = {
  dashboard: "/api/admin/dashboard/metrics",
  health: "/api/admin/health",
  customers: "/api/admin/customers",
  orders: "/api/admin/orders",
  coupons: "/api/admin/coupons",
  emailTemplates: "/api/admin/email-templates",
  emailLogs: "/api/admin/email-logs",
  products: "/api/admin/products",
  orchestration: "/api/admin/orchestration",
} as const;

// ============================================
// Validation Helpers
// ============================================

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function isValidPercentage(value: number): boolean {
  return value >= 0 && value <= 100;
}

export function isValidCouponCode(code: string): boolean {
  return /^[A-Z0-9_-]{3,20}$/i.test(code);
}

// ============================================
// Debounce & Throttle
// ============================================

export function debounce<T extends (...args: unknown[]) => unknown>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: ReturnType<typeof setTimeout>;
  return (...args: Parameters<T>) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), delay);
  };
}

export function throttle<T extends (...args: unknown[]) => unknown>(
  fn: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle = false;
  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      fn(...args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
}

// ============================================
// Accessibility Helpers
// ============================================

export function announceToScreenReader(message: string, priority: "polite" | "assertive" = "polite") {
  const announcement = document.createElement("div");
  announcement.setAttribute("role", "status");
  announcement.setAttribute("aria-live", priority);
  announcement.setAttribute("aria-atomic", "true");
  announcement.className = "sr-only";
  announcement.textContent = message;
  document.body.appendChild(announcement);
  setTimeout(() => announcement.remove(), 1000);
}

export function trapFocus(element: HTMLElement) {
  const focusableElements = element.querySelectorAll<HTMLElement>(
    'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
  );
  const firstFocusable = focusableElements[0];
  const lastFocusable = focusableElements[focusableElements.length - 1];

  function handleKeyDown(e: KeyboardEvent) {
    if (e.key !== "Tab") return;

    if (e.shiftKey) {
      if (document.activeElement === firstFocusable) {
        lastFocusable?.focus();
        e.preventDefault();
      }
    } else {
      if (document.activeElement === lastFocusable) {
        firstFocusable?.focus();
        e.preventDefault();
      }
    }
  }

  element.addEventListener("keydown", handleKeyDown);
  return () => element.removeEventListener("keydown", handleKeyDown);
}

// ============================================
// Local Storage Helpers (for admin preferences)
// ============================================

const ADMIN_PREFS_KEY = "qr-admin-prefs";

interface AdminPreferences {
  sidebarCollapsed?: boolean;
  tablePageSize?: number;
  lastVisitedSection?: string;
}

export function getAdminPreferences(): AdminPreferences {
  try {
    const stored = localStorage.getItem(ADMIN_PREFS_KEY);
    return stored ? JSON.parse(stored) : {};
  } catch {
    return {};
  }
}

export function setAdminPreference<K extends keyof AdminPreferences>(
  key: K,
  value: AdminPreferences[K]
) {
  try {
    const prefs = getAdminPreferences();
    prefs[key] = value;
    localStorage.setItem(ADMIN_PREFS_KEY, JSON.stringify(prefs));
  } catch {
    // Silent fail for localStorage errors
  }
}

// ============================================
// Clipboard Helpers
// ============================================

export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Fallback for older browsers
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.select();
    try {
      document.execCommand("copy");
      return true;
    } catch {
      return false;
    } finally {
      textarea.remove();
    }
  }
}

// ============================================
// Error Handling
// ============================================

export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  if (error && typeof error === "object" && "message" in error) {
    return String((error as { message: unknown }).message);
  }
  return "An unexpected error occurred";
}

export function isNetworkError(error: unknown): boolean {
  return (
    error instanceof TypeError &&
    (error.message.includes("fetch") || error.message.includes("network"))
  );
}

// ============================================
// User/Customer Display Helpers
// ============================================

export interface UserDisplayInfo {
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
}

export function getDisplayName(user: UserDisplayInfo): string {
  if (user.firstName || user.lastName) {
    return `${user.firstName || ""} ${user.lastName || ""}`.trim();
  }
  return user.email || "Unknown";
}

export function getInitials(user: UserDisplayInfo): string {
  if (user.firstName) {
    return (user.firstName[0] + (user.lastName?.[0] || "")).toUpperCase();
  }
  if (user.email) {
    return user.email.slice(0, 2).toUpperCase();
  }
  return "??";
}

// ============================================
// Color Utilities (for product swatches)
// ============================================

export const COLOR_MAP: Record<string, string> = {
  white: "#ffffff",
  black: "#000000",
  navy: "#001f3f",
  red: "#e53935",
  blue: "#1e88e5",
  green: "#43a047",
  grey: "#9e9e9e",
  gray: "#9e9e9e",
  charcoal: "#36454f",
  heather: "#b4b4b4",
  maroon: "#800000",
  orange: "#ff9800",
  yellow: "#ffeb3b",
  pink: "#e91e63",
  purple: "#9c27b0",
  tan: "#d2b48c",
  brown: "#795548",
  khaki: "#c3b091",
  cream: "#fffdd0",
  ivory: "#fffff0",
  gold: "#ffd700",
  silver: "#c0c0c0",
  aqua: "#00bcd4",
  teal: "#009688",
  coral: "#ff7f50",
  mint: "#98ff98",
  olive: "#808000",
  burgundy: "#800020",
  sand: "#c2b280",
  slate: "#708090",
  forest: "#228b22",
  royal: "#4169e1",
  sky: "#87ceeb",
  light: "#f5f5f5",
  dark: "#333333",
};

export function getSwatchColor(colorName: string): string {
  const lower = colorName.toLowerCase();
  for (const [key, value] of Object.entries(COLOR_MAP)) {
    if (lower.includes(key)) return value;
  }
  return "#cccccc";
}
