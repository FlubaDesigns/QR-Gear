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
  verticalOffset: 15,    // 15% from QR (top text default)
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
  type PlacementId,
  type PlacementType,
  type PlacementSize,
  type PlacementConfig,
  type PlacementSizeConfig,
  type PlacementOption,
  QR_ONLY_PLACEMENTS,
  ALL_PLACEMENT_OPTIONS,
  CATEGORY_PLACEMENTS,
  DEFAULT_PLACEMENTS,
  getPlacementsForCategory,
  isQrOnlyPlacement,
} from "@/features/shared/placementTypes";

// Size scaling for different placement areas
// Front/Back have more dramatic size differences
// Sleeve/Shoulder have more gradual/subtle differences
export const PLACEMENT_SIZE_SCALES: Record<string, Record<_PlacementSize, number>> = {
  // Large areas - more dramatic differences
  "front-chest": { small: 0.6, medium: 0.8, large: 1.0 },
  "front-center": { small: 0.6, medium: 0.8, large: 1.0 },
  "back": { small: 0.6, medium: 0.8, large: 1.0 },
  "bag-front": { small: 0.6, medium: 0.8, large: 1.0 },
  "bag-back": { small: 0.6, medium: 0.8, large: 1.0 },
  // Small areas - more gradual differences
  "left-shoulder": { small: 0.7, medium: 0.85, large: 1.0 },
  "right-shoulder": { small: 0.7, medium: 0.85, large: 1.0 },
  "pocket": { small: 0.7, medium: 0.85, large: 1.0 },
  "hat-front": { small: 0.7, medium: 0.85, large: 1.0 },
  "hat-side": { small: 0.7, medium: 0.85, large: 1.0 },
  "hat-back": { small: 0.7, medium: 0.85, large: 1.0 },
  "bag-pocket": { small: 0.7, medium: 0.85, large: 1.0 },
  // Mugs - medium differences
  "mug-wrap": { small: 0.65, medium: 0.8, large: 1.0 },
  "mug-front": { small: 0.65, medium: 0.8, large: 1.0 },
  "mug-back": { small: 0.65, medium: 0.8, large: 1.0 },
};

// Base dimensions per placement at 300 DPI (width × height in pixels)
// These are the LARGE sizes - small/medium use the scale factors above
// Compatible with both Printful and Printify print areas
export const PLACEMENT_BASE_DIMENSIONS: Record<string, { width: number; height: number }> = {
  // Full front: Printful 12"×16" (standard) or 15"×18" (large_front)
  //             Printify 12"×16" standard, up to 14"×18" oversized
  // Using 12"×16" as safe universal maximum = 3600×4800 pixels
  "front-center": { width: 3600, height: 4800 },
  
  // Full back: Printful 12"×14", Printify 10"×14" to 14"×15"
  // Using 12"×14" = 3600×4200 pixels
  "back": { width: 3600, height: 4200 },
  
  // Center chest: Printful 10"×6", Printify 8"×8" average
  // Using 10"×8" as compromise = 3000×2400 pixels
  "front-chest": { width: 3000, height: 2400 },
  
  // Left chest/pocket: Printful 4"×4", Printify 3.5"×3.5" to 5"×5"
  // Using 4"×4" = 1200×1200 pixels
  "pocket": { width: 1200, height: 1200 },
  
  // Sleeve (QR ONLY): Printful 4"×3.5", Printify 3"×4"
  // QR codes need less space - using 3"×3" = 900×900 pixels
  // Square format optimal for QR scanning
  "left-shoulder": { width: 900, height: 900 },
  "right-shoulder": { width: 900, height: 900 },
  
  // Hat front: Printful 4"×4" embroidery, Printify varies by product
  // Using 4"×2.5" = 1200×750 pixels (typical hat panel)
  "hat-front": { width: 1200, height: 750 },
  "hat-side": { width: 900, height: 600 },
  "hat-back": { width: 1200, height: 750 },
  
  // Bag front/back: Typically 10"×10" to 12"×12"
  // Using 10"×10" = 3000×3000 pixels
  "bag-front": { width: 3000, height: 3000 },
  "bag-back": { width: 3000, height: 3000 },
  "bag-pocket": { width: 1200, height: 1200 },
  
  // Mug wrap: Printful 9.5"×3.5", varies by mug size
  // Using 9.5"×3.5" = 2850×1050 pixels
  "mug-wrap": { width: 2850, height: 1050 },
  "mug-front": { width: 1200, height: 1050 },
  "mug-back": { width: 1200, height: 1050 },
};

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
