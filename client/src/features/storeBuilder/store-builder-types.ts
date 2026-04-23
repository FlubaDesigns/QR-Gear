export const COLOR_HEX_MAP: Record<string, string> = {
  // Whites / Creams / Naturals
  "White": "#FFFFFF", "Solid White Blend": "#F2F2F0", "Vintage White": "#F0EBD8",
  "Soft Cream": "#F5EDD8", "Natural": "#F5F5DC", "Cream": "#FFFDD0",
  "Heather Natural": "#D8CCA0", "Sand": "#C2B280", "Heather Sand Dune": "#C8B89A",
  "Pebble": "#B8A890", "Heather Dust": "#BBAB88", "Tan": "#C8A878", "Toast": "#B88B5B",
  // Blacks / Very Dark
  "Black": "#000000", "Vintage Black": "#2B2828", "Oxblood Black": "#3F0E12",
  "Black Heather": "#3A3A3A", "Dark Heather": "#374151", "Charcoal": "#36454F",
  "Asphalt": "#484848",
  // Greys
  "Ash": "#B2BEB5", "Silver": "#C0C0C0", "Gray": "#6B7280", "Grey": "#6B7280",
  "Heather Gray": "#B2B2B2", "Heather Grey": "#B2B2B2", "Athletic Heather": "#C0BCB8",
  "Sport Gray": "#9CA3AF", "Sport Grey": "#9CA3AF",
  "Heather Cool Grey": "#A8A8A8", "Dark Grey": "#606060",
  "Dark Grey Heather": "#646464", "Heather Slate": "#7B8B9B",
  // Navy / Dark Blues
  "Navy": "#1F2E5C", "Navy Blue": "#1F2E5C", "Heather Navy": "#2D3A5E",
  "Heather Midnight Navy": "#1A2440",
  // Blues
  "Blue": "#2563EB", "Royal Blue": "#4169E1", "True Royal": "#2B5BA8",
  "Heather True Royal": "#4470A8", "Sapphire": "#0F52BA", "Ocean Blue": "#2A6EA6",
  "Steel Blue": "#4682B4", "Heather Columbia Blue": "#8AAECB",
  "Heather Carolina Blue": "#7AA4C0", "Light Blue": "#ADD8E6", "Baby Blue": "#89CFF0",
  "Heather Ice Blue": "#B8D4E8", "Heather Prism Ice Blue": "#B0C8D8",
  "Heather Prism Dusty Blue": "#8AAAB8",
  // Teals / Aquas
  "Teal": "#007B7B", "Heather Deep Teal": "#2B6B6B", "Aqua": "#00B4B4",
  "Heather Aqua": "#5CC0C0", "Turquoise": "#40E0D0",
  // Greens / Mints
  "Green": "#16A34A", "Mint": "#A8DDB8", "Heather Mint": "#8BC0A0",
  "Heather Prism Mint": "#A0C8B8", "Sage": "#8B9B7B", "Leaf": "#6B8B5B",
  "Heather Grass Green": "#6B9B5B", "Heather Emerald": "#2B7B4B",
  "Kelly": "#4CBB17", "Kelly Green": "#4CBB17", "Irish Green": "#22C55E",
  "Heather Kelly": "#5B9B5B", "Olive": "#6B6D3B", "Heather Olive": "#7B8B5B",
  "Military Green": "#6B6B4A", "Army": "#454B3B", "Forest": "#2D5A27",
  "Forest Green": "#228B22", "Heather Forest": "#4A6B3B",
  "Safety Green": "#84CC16",
  // Yellows / Golds / Oranges
  "Yellow": "#FFFF00", "Daisy": "#F7D070", "Gold": "#FFD700",
  "Mustard": "#C8A030", "Heather Yellow Gold": "#D8B838", "Autumn": "#C87B3B",
  "Heather Autumn": "#C08B6B", "Orange": "#E86010", "Burnt Orange": "#CC5500",
  "Tennessee Orange": "#FF6200", "Heather Orange": "#D88B5B",
  "Safety Orange": "#FF6600",
  // Reds
  "Red": "#CC2529", "Heather Red": "#B04455", "Cardinal": "#8B1A2A",
  "Maroon": "#800000", "Burgundy": "#881337", "Berry": "#6B2842",
  "Heather Raspberry": "#9B3B5B",
  // Pinks
  "Pink": "#F4A7B9", "Soft Pink": "#F0B0B8", "Charity Pink": "#E87B9B",
  "Heather Clay": "#B87B6B", "Heather Prism Peach": "#D8A890",
  "Heather Mauve": "#B08890", "Mauve": "#A07575",
  // Purples / Lavenders
  "Purple": "#6B3FA0", "Lilac": "#C8A8D0", "Heather Prism Lilac": "#C0A8C8",
  "Team Purple": "#4A3575", "Heather Team Purple": "#6B5E8B",
  "Heather Orchid": "#9B7BC0",
  // Browns
  "Brown": "#7B4B2B", "Heather Brown": "#8B6B4B",
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

/** Look up a hex value from a plain color name string (no hex field). */
export function getColorHexByName(colorName: string): string | undefined {
  if (!colorName) return undefined;
  const direct = COLOR_HEX_MAP[colorName.trim()];
  if (direct) return direct;
  const lower = colorName.trim().toLowerCase();
  for (const [key, value] of Object.entries(COLOR_HEX_MAP)) {
    if (key.toLowerCase() === lower) return value;
  }
  return undefined;
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
