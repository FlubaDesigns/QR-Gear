import type { PlacementSize as _PlacementSize, PlacementConfig as _PlacementConfig, PlacementSizeConfig as _PlacementSizeConfig, PlacementOption as _PlacementOption } from "@/features/shared/placementTypes";

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

export interface PlacementMethodOption {
  method: 'dtg' | 'dtf';
  providerName: string;
}

export interface ProductPlacement {
  id: string;
  type: string;
  title: string;
  additionalPrice?: number;
  options?: any;
  methods?: PlacementMethodOption[];
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

export {
  FONT_FAMILIES,
  FONT_SIZES,
  DEFAULT_FONT_SIZE,
  DEFAULT_FONT_SIZE_NUM,
  WARP_PRESETS,
  defaultTextStyle,
} from "@/features/shared/components/TextStyleEditor";

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

// Re-export placement types and data from shared location (single source of truth)
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
  buildPlacementOption,
  PLACEMENT_SIZE_SCALES,
  PLACEMENT_BASE_DIMENSIONS,
  DEFAULT_PLACEMENT_DIMENSIONS,
} from "@/features/shared/placementTypes";

export interface SelectedColor {
  name: string;
  hex: string;
}

export type PrintMethodSelection = Record<string, 'dtg' | 'dtf'>;

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
  placementMethods: PrintMethodSelection;
}
