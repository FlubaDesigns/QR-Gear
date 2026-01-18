export type SourceType = "custom" | "product_template" | "graphic_template" | "background" | null;

export interface LoadedTemplate {
  id: string;
  name: string;
  type: "product" | "graphic" | "background";
  data: Record<string, unknown>;
}

export interface LoadedGraphic {
  compositeUrl: string;
  qrOnlyUrl: string;
}

export interface LoadedBackground {
  id: string;
  name: string;
  url: string;
  isClipped?: boolean;
}

export interface CatalogCategory {
  name: string;
  itemCount: number;
}

export interface ProductColor {
  name: string;
  hex: string;
}

export interface CatalogProduct {
  id: number;
  title: string;
  brand: string;
  model: string;
  imageUrl: string | null;
  madeInUSA: boolean;
  minPrice: string | null;
  maxPrice: string | null;
  colorCount: number;
  availableColors: ProductColor[];
  availableSizes: string[];
  blueprintId: number;
  printProviderId: number | null;
}

export interface OriginFilter {
  showUSA: boolean;
  showOther: boolean;
}

export type GenderFilter = "all" | "mens" | "womens" | "unisex";

export type QRProductState = 
  | "qr_basics"    // Permanent - Simple QR code with text, URL, or contact info
  | "qr_plus"      // Permanent + Messaging - QR with header/footer text
  | "qr_canvas"    // Visual Space - Custom image your QR opens to
  | "qr_play"      // Motion - Video that plays when QR is scanned
  | "qr_dynamics"  // Living Space - Dynamic content that changes over time
  | null;

export const QR_PRODUCT_STATES = [
  { id: "qr_basics", label: "QR Basics", state: "Permanent", description: "A simple, scannable QR code. Text, URL, or contact info encoded permanently." },
  { id: "qr_plus", label: "QR Plus", state: "Permanent + Messaging", description: "Add a message above and below your QR. Perfect for calls-to-action." },
  { id: "qr_canvas", label: "QR Canvas", state: "Visual Space", description: "Design a custom image your QR opens to. Your QR Space. Your visual." },
  { id: "qr_play", label: "QR Play", state: "Motion", description: "Bring your QR to life with video. Plays instantly in your QR Space." },
  { id: "qr_dynamics", label: "QR Dynamics™", state: "Living Space", description: "Content that changes over time. Scheduled updates, rotating content." },
] as const;

export interface TextStyleConfig {
  text: string;
  enabled: boolean;
  fontFamily: string;
  fontSize: string;
  color: string;
  warpPreset: string;
  letterSpacing: number;
  strokeColor: string;
  strokeWidth: number;
}

export const FONT_FAMILIES = [
  "Arial",
  "Helvetica", 
  "Times New Roman",
  "Georgia",
  "Verdana",
  "Courier New",
  "Impact",
  "Comic Sans MS",
  "Trebuchet MS",
  "Palatino Linotype",
];

export const FONT_SIZES = ["72", "96", "120", "144", "168", "192", "216", "240", "280", "320"];

export const WARP_PRESETS = [
  { value: "straight", label: "Straight" },
  { value: "arc-up", label: "Arc Up" },
  { value: "arc-down", label: "Arc Down" },
];

export const defaultTextStyle: TextStyleConfig = {
  text: "",
  enabled: false,
  fontFamily: "Arial",
  fontSize: "144",
  color: "#FFFFFF",
  warpPreset: "straight",
  letterSpacing: 0,
  strokeColor: "",
  strokeWidth: 0,
};

export interface ContentData {
  url: string;
  title: string;
  description: string;
  backgroundType: "image" | "video";
  videoUrl: string;
  overlayPosition: "top" | "bottom" | "center";
  overlayColor: string;
  overlayFontFamily: string;
  headerStyle: TextStyleConfig;
  footerStyle: TextStyleConfig;
  hostingTierCode: string;
}

export interface PricingBreakdown {
  baseProductCost: number;
  placementCost: number;
  textUpcharge: number;
  hostingCost: number;
  subtotal: number;
  markupAmount: number;
  customerPrice: number;
  hostingTierCode: string;
}

export type PlacementId = 
  // Shirts/Hoodies
  | "front-chest" | "front-center" | "back" | "left-shoulder" | "right-shoulder" | "left-sleeve" | "right-sleeve" | "pocket"
  // Mugs
  | "mug-wrap" | "mug-front" | "mug-back"
  // Hats
  | "hat-front" | "hat-side" | "hat-back"
  // Bags
  | "bag-front" | "bag-back" | "bag-pocket";

export type PlacementType = "graphic" | "qr";

export interface PlacementConfig {
  [key: string]: PlacementType;
}

export interface PlacementOption {
  id: PlacementId;
  label: string;
}

// Placements that can ONLY have QR codes (no graphics option)
export const QR_ONLY_PLACEMENTS: PlacementId[] = ["left-shoulder", "right-shoulder"];

// All available placements
export const ALL_PLACEMENT_OPTIONS: PlacementOption[] = [
  // Shirts/Hoodies
  { id: "front-chest", label: "Front Chest" },
  { id: "front-center", label: "Front Center" },
  { id: "back", label: "Back" },
  { id: "left-shoulder", label: "Left Shoulder (QR Only)" },
  { id: "right-shoulder", label: "Right Shoulder (QR Only)" },
  { id: "left-sleeve", label: "Left Sleeve" },
  { id: "right-sleeve", label: "Right Sleeve" },
  { id: "pocket", label: "Pocket" },
  // Mugs
  { id: "mug-wrap", label: "Wrap Around" },
  { id: "mug-front", label: "Front" },
  { id: "mug-back", label: "Back" },
  // Hats
  { id: "hat-front", label: "Front" },
  { id: "hat-side", label: "Side" },
  { id: "hat-back", label: "Back" },
  // Bags
  { id: "bag-front", label: "Front Panel" },
  { id: "bag-back", label: "Back Panel" },
  { id: "bag-pocket", label: "Pocket" },
];

// Category to placement mapping
export const CATEGORY_PLACEMENTS: Record<string, PlacementId[]> = {
  // Apparel - match exact API category names
  "T-Shirts": ["front-chest", "front-center", "back", "left-shoulder", "right-shoulder", "left-sleeve", "right-sleeve"],
  "Sweatshirts & Hoodies": ["front-chest", "front-center", "back", "left-shoulder", "right-shoulder", "left-sleeve", "right-sleeve", "pocket"],
  "Long Sleeve Shirts": ["front-chest", "front-center", "back", "left-shoulder", "right-shoulder", "left-sleeve", "right-sleeve"],
  "Tank Tops": ["front-chest", "front-center", "back"],
  // Drinkware
  "Drinkware": ["mug-wrap", "mug-front", "mug-back"],
  "Mugs": ["mug-wrap", "mug-front", "mug-back"],
  "Tumblers": ["mug-wrap", "mug-front", "mug-back"],
  // Headwear
  "Hats & Caps": ["hat-front", "hat-side", "hat-back"],
  "Hats": ["hat-front", "hat-side", "hat-back"],
  "Beanies": ["hat-front"],
  // Bags
  "Bags": ["bag-front", "bag-back", "bag-pocket"],
  "Tote Bags": ["bag-front", "bag-back"],
  "Backpacks": ["bag-front", "bag-pocket"],
};

// Default placements for unknown categories
export const DEFAULT_PLACEMENTS: PlacementId[] = ["front-chest", "front-center", "back"];

// Helper function to normalize category names for matching
function normalizeCategory(category: string): string {
  const lower = category.toLowerCase();
  if (lower.includes("t-shirt") || lower.includes("tshirt") || lower.includes("tee")) return "T-Shirts";
  if (lower.includes("long sleeve")) return "Long Sleeve Shirts";
  if (lower.includes("sweatshirt") || lower.includes("hoodie")) return "Sweatshirts & Hoodies";
  if (lower.includes("tank")) return "Tank Tops";
  if (lower.includes("drinkware") || lower.includes("mug") || lower.includes("tumbler")) return "Drinkware";
  if (lower.includes("hat") || lower.includes("cap")) return "Hats & Caps";
  if (lower.includes("beanie")) return "Hats & Caps";
  if (lower.includes("bag")) return "Bags";
  return category;
}

// Helper function to get placements for a category
export function getPlacementsForCategory(category: string | null): PlacementOption[] {
  if (!category) return DEFAULT_PLACEMENTS.map(id => ALL_PLACEMENT_OPTIONS.find(opt => opt.id === id)).filter((opt): opt is PlacementOption => opt !== undefined);
  
  const normalized = normalizeCategory(category);
  const placementIds = CATEGORY_PLACEMENTS[normalized] || DEFAULT_PLACEMENTS;
  return placementIds
    .map(id => ALL_PLACEMENT_OPTIONS.find(opt => opt.id === id))
    .filter((opt): opt is PlacementOption => opt !== undefined);
}

// Legacy export for backward compatibility
export const PLACEMENT_OPTIONS = ALL_PLACEMENT_OPTIONS.slice(0, 5);

export interface BuilderState {
  sourceType: SourceType;
  loadedTemplate: LoadedTemplate | null;
  loadedGraphic: LoadedGraphic | null;
  loadedBackground: LoadedBackground | null;
  fulfillmentProvider: string | null;
  category: string | null;
  originFilter: OriginFilter;
  genderFilter: GenderFilter;
  selectedProduct: CatalogProduct | null;
  qrProductState: QRProductState;
  content: ContentData;
  selectedPlacements: PlacementId[];
  placementConfig: PlacementConfig;
}
