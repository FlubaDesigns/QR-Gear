import type { PlacementSize as _PlacementSize, PlacementConfig as _PlacementConfig, PlacementSizeConfig as _PlacementSizeConfig } from "@/features/shared/placementTypes";

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

// Print placement from Printful/Printify API
export interface ProductPlacement {
  id: string;          // e.g., "front", "back", "front_large", "left_chest"
  type: string;        // Same as id, normalized
  title: string;       // Human-readable: "Front", "Back", "Front Large"
  additionalPrice?: number;  // Extra cost for this placement (Printful)
  options?: any;       // Provider-specific options
}

export interface CatalogProduct {
  id: number;
  title: string;
  description?: string;
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
  hasMockupMapping?: boolean;
  // Dynamic placements from print provider API
  placements?: ProductPlacement[];
  fulfillmentProvider?: 'printful' | 'printify';
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
  | "qr_compose"   // Living Space - Rotating playlist of Canvas/Play items
  | null;

export const QR_PRODUCT_STATES = [
  { id: "qr_basics", label: "QR Basics", state: "Permanent", description: "A simple, scannable QR code. Text, URL, or contact info encoded permanently." },
  { id: "qr_plus", label: "QR Plus", state: "Permanent + Messaging", description: "Add a message above and below your QR. Perfect for calls-to-action." },
  { id: "qr_canvas", label: "QR Canvas", state: "Visual Space", description: "Design a custom image your QR opens to. Your QR Space. Your visual." },
  { id: "qr_play", label: "QR Play", state: "Motion", description: "Bring your QR to life with video. Plays instantly in your QR Space." },
  { id: "qr_compose", label: "QR Compose", state: "Living Space", description: "Build a rotating playlist from your Canvas and Play items. Your living QR experience." },
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
  verticalOffset: number;   // Distance from QR code (0-100, higher = further from QR)
  horizontalOffset: number; // Left/right position (-50 to 50, 0 = centered)
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
  verticalOffset: 80,    // 80% default
  horizontalOffset: 50,  // 50 = centered
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
  titleStyle: TextStyleConfig;        // Styled title for landing page
  descriptionStyle: TextStyleConfig;  // Styled description for landing page
  hostingTierCode: string;
  // Play-specific fields
  playMediaSource: "url" | "upload" | null;
  playMediaUrl: string;         // External URL (YouTube, etc.)
  playMediaFile: File | null;   // Uploaded file
  playMediaPreview: string;     // Data URL or blob URL for preview
  playMediaMimeType: string;    // video/mp4, image/gif, etc.
  playPermissionConfirmed: boolean;  // Required before saving
  // Compose-specific fields
  composeItems: Array<{
    packetId: string;
    name: string;
    thumbnailUrl: string;
    type: 'qr-canvas' | 'qr-play';
    durationSeconds: number;
    order: number;
  }>;
  composeMode: 'auto-rotate' | 'scan-to-reveal' | '';
  composeHostingTerm: '1-year' | '3-year' | '5-year' | '';
  composeStep: 'pick-items' | 'mode' | 'durations' | 'order' | 'hosting' | 'preview' | 'publish' | 'confirm' | '';
  composeMockup: string;
  composeInstanceId: string | null;
}

export interface PricingBreakdown {
  baseProductCost: number;
  placementCost: number;
  textUpcharge: number;
  hostingCost: number;
  subtotal: number;
  markupPercent: number;      // The percentage we mark up (e.g., 25)
  markupFixed: number;        // Fixed markup amount
  markupAmount: number;       // Calculated total markup in dollars
  customerPrice: number;
  hostingTierCode: string;
}

// Re-export placement types from shared location (single source of truth)
export {
  type PlacementType,
  type PlacementSize,
  type PlacementConfig,
  type PlacementSizeConfig,
  type PlacementOption,
  QR_ONLY_PLACEMENTS,
  BRANDING_PLACEMENTS,
  FALLBACK_PLACEMENTS,
  isQrOnlyPlacement,
  isBrandingPlacement,
  filterSelectablePlacements,
  getPlacementLabel,
} from "@/features/shared/placementTypes";

// Size scaling for different placement areas
// Large areas get more dramatic size differences, small areas get gradual ones
// Uses actual Printify/Printful API position names
export const PLACEMENT_SIZE_SCALES: Record<string, Record<_PlacementSize, number>> = {
  "front": { small: 0.6, medium: 0.8, large: 1.0 },
  "back": { small: 0.6, medium: 0.8, large: 1.0 },
  "front_large": { small: 0.6, medium: 0.8, large: 1.0 },
  "front_small": { small: 0.7, medium: 0.85, large: 1.0 },
  "front_center": { small: 0.6, medium: 0.8, large: 1.0 },
  "left_sleeve": { small: 0.7, medium: 0.85, large: 1.0 },
  "right_sleeve": { small: 0.7, medium: 0.85, large: 1.0 },
  "pocket": { small: 0.7, medium: 0.85, large: 1.0 },
  "left": { small: 0.7, medium: 0.85, large: 1.0 },
  "right": { small: 0.7, medium: 0.85, large: 1.0 },
  "center": { small: 0.6, medium: 0.8, large: 1.0 },
  "wraparound": { small: 0.65, medium: 0.8, large: 1.0 },
  "side": { small: 0.7, medium: 0.85, large: 1.0 },
};

// Base dimensions per placement at 300 DPI (width × height in pixels)
// These are the LARGE sizes - small/medium use the scale factors above
// Uses actual Printify/Printful API position names
// When a placement isn't listed here, we fall back to a safe 3000×3000 default
export const PLACEMENT_BASE_DIMENSIONS: Record<string, { width: number; height: number }> = {
  "front": { width: 3600, height: 4800 },
  "back": { width: 3600, height: 4200 },
  "front_large": { width: 3600, height: 4800 },
  "front_small": { width: 3000, height: 2400 },
  "front_center": { width: 3600, height: 4800 },
  "back_center": { width: 3600, height: 4200 },
  "pocket": { width: 1200, height: 1200 },
  "left_sleeve": { width: 900, height: 900 },
  "right_sleeve": { width: 900, height: 900 },
  "neck": { width: 750, height: 750 },
  "center": { width: 3000, height: 3000 },
  "left": { width: 3000, height: 3000 },
  "right": { width: 3000, height: 3000 },
  "side": { width: 1200, height: 1050 },
  "wraparound": { width: 2850, height: 1050 },
};

// Fallback dimensions for any placement not in the table above
export const DEFAULT_PLACEMENT_DIMENSIONS = { width: 3000, height: 3000 };

export interface SelectedColor {
  name: string;
  hex: string;
}

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
  selectedColor: SelectedColor | null;
  qrProductState: QRProductState;
  content: ContentData;
  placementsLoading: boolean;
  selectedPlacements: string[];
  placementConfig: _PlacementConfig;
  placementSizes: _PlacementSizeConfig;
}
