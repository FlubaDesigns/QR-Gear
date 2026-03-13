export const COLOR_HEX_MAP: Record<string, string> = {
  "White": "#FFFFFF", "Black": "#000000", "Navy": "#1F2937", "Navy Blue": "#1F2937",
  "Red": "#DC2626", "Blue": "#2563EB", "Royal Blue": "#1D4ED8", "Light Blue": "#93C5FD",
  "Green": "#16A34A", "Forest Green": "#166534", "Yellow": "#FBBF24", "Gold": "#F59E0B",
  "Orange": "#EA580C", "Pink": "#EC4899", "Purple": "#9333EA", "Gray": "#6B7280",
  "Grey": "#6B7280", "Charcoal": "#374151", "Brown": "#92400E", "Tan": "#D4A574",
  "Maroon": "#7F1D1D", "Burgundy": "#881337", "Teal": "#0D9488", "Aqua": "#22D3D1",
  "Heather Gray": "#9CA3AF", "Heather Grey": "#9CA3AF", "Sport Grey": "#9CA3AF",
  "Dark Heather": "#4B5563", "Ash": "#D1D5DB", "Natural": "#F5F5DC", "Cream": "#FFFDD0",
  "Sand": "#C2B280", "Olive": "#556B2F", "Kelly Green": "#22C55E", "Irish Green": "#22C55E",
  "Cardinal": "#B91C1C", "Safety Orange": "#FF6600", "Safety Green": "#84CC16",
};

export function getColorHex(color: { name: string; hex?: string }): string {
  if (color.hex && color.hex.trim() !== "") return color.hex;
  const normalized = color.name.trim();
  if (COLOR_HEX_MAP[normalized]) return COLOR_HEX_MAP[normalized];
  const lowerName = normalized.toLowerCase();
  for (const [key, value] of Object.entries(COLOR_HEX_MAP)) {
    if (key.toLowerCase() === lowerName) return value;
  }
  return "#CCCCCC";
}

export interface ProductColor {
  hex: string;
  name: string;
}

export interface ProductPackage {
  packetId?: string;
  templateId?: string;
  productId?: string;
  qrContent?: string;
  productName?: string;
  productDescription?: string;
  productImageUrl?: string;
  compositeUrl?: string;
  qrOnlyUrl?: string;
  headerText?: string;
  footerText?: string;
  colors?: ProductColor[];
  sizes?: string[];
  qrSizes?: string[];
  availablePlacements?: string[];
  placements?: string[];
  basePrice?: string;
  customerPrice?: string;
  qrProductState?: string;
  blueprintId?: number;
  printProviderId?: number;
  manufacturer?: string;
  madeIn?: string;
  defaultColor?: string;
  defaultColorHex?: string;
  placementSizes?: Record<string, string>;
  priorityMockupUrl?: string | null;
  destinationRoleType?: string | null;
  destinationStoreId?: string | null;
  destinationStoreName?: string | null;
  destinationChannelId?: string | null;
  destinationChannelName?: string | null;
  pricing?: {
    baseProductCost: number;
    placementCost: number;
    textUpcharge: number;
    hostingCost: number;
    subtotal: number;
    markupPercent: number;
    markupFixed: number;
    markupAmount: number;
    customerPrice: number;
    hostingTierCode?: string;
  };
}

export interface ProductConfiguration {
  enabledColors: Set<string>;
  enabledSizes: Set<string>;
  selectedGraphicSize: string;
  defaultColor: string;
}

export interface MockupJob {
  id: string;
  status: "pending" | "processing" | "completed" | "failed";
  color?: string;
  size?: string;
  placement?: string;
  mockupUrl?: string | null;
  error?: string | null;
}

export type StoreType = "internal" | "external" | null;
