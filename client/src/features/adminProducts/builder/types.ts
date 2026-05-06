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

export interface CarrierPlacement {
  position: string;
  label: string;
  printArea?: { width: number; height: number };
}

export interface CarrierSubData {
  title?: string;
  description?: string;
  colors?: ProductColor[];
  sizes?: string[];
  minPrice?: number | null;
  maxPrice?: number | null;
  images?: string[];
  placements?: CarrierPlacement[];
  blueprintId?: number;
  printProviderId?: number;
  productId?: number;
}

export interface QrgColorOption {
  code: string;
  label: string;
  hex?: string;
  providerValues?: string[];
}

export interface QrgSizeOption {
  code: string;
  label: string;
  providerValues?: string[];
}

export interface QrgPrintLocation {
  id: string;
  label: string;
  provider: string;
  providerPlacement: string;
}

export interface CatalogProduct {
  id: number;
  /** Firestore document ID — always send this as sourceMasterId to build-session endpoints */
  docId?: string;
  /** QRG blank identifier — 5-digit STNNN, e.g. "11101" */
  qrgBlankId?: string;
  title: string;
  description?: string;
  brand: string;
  model: string;
  images?: string[];
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
  /** QRG-native print locations from the /options endpoint */
  printLocations?: QrgPrintLocation[];
  fulfillmentProvider?: 'printful' | 'printify';
  // Per-carrier sub-objects — single source of truth
  printify?: CarrierSubData;
  printful?: CarrierSubData;
  /** QRG variant map keyed by SSCC (sizeCode+colorCode) */
  qrgVariants?: Record<string, any>;
  /** Provider mapping object { printify: {...}, printful: {...} } */
  providerMappings?: Record<string, any>;
  /** True once the /options endpoint has been called and merged */
  optionsLoaded?: boolean;
  /** Per-provider image arrays — sourced from master_catalog */
  printifyImages?: string[];
  printfulImages?: string[];
  /** QRG subcategory label e.g. "T-Shirts", "Hoodies & Sweatshirts" */
  qrgCategory?: string | null;
  /** QRG parent category label e.g. "Apparel" */
  qrgParentCategory?: string | null;
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
  fontWeight?: string;
  fontSize: string;
  color: string;
  warpPreset: string;
  letterSpacing: number;
  strokeColor: string;
  strokeWidth: number;
  verticalOffset: number;
  horizontalOffset: number;
  mode?: "text" | "image";
  imageUrl?: string;
  imageScale?: number;
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
  titleStyle: TextStyleConfig;        // Styled title for landing page (legacy — use landingTextBlocks)
  descriptionStyle: TextStyleConfig;  // Styled description for landing page (legacy — use landingTextBlocks)
  landingTextBlocks: TextStyleConfig[]; // Dynamic text blocks for landing page
  hostingTierCode: string;
  // Play-specific fields
  playMediaSource: "url" | "upload" | null;
  playMediaUrl: string;         // External URL (YouTube, etc.)
  playMediaFile: File | null;   // Uploaded file
  playMediaPreview: string;     // Data URL or blob URL for preview
  playMediaMimeType: string;    // video/mp4, image/gif, etc.
  playPermissionConfirmed: boolean;  // Required before saving
  // Compose-specific fields
  qrPositionX: number;
  qrPositionY: number;
  qrSizePercent: number;
  areaImageUrl: string;
  areaImageMode: "behind-qr";
  areaImageOffsetX: number;
  areaImageOffsetY: number;
  areaImageScale: number;
  subBottomStyle: TextStyleConfig;
  graphicLayoutMode: "" | "zone" | "freeform";
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
  qrBasicInputType: 'text' | 'url';
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

export interface TemplateProductHint {
  blueprintId: number | null;
  printProviderId: number | null;
  productId: number | null;
  productName: string | null;
  fulfillmentProvider: string | null;
}

export type TextLayerSource = 'provider' | 'catalog' | 'packet' | 'manual' | 'none' | null;

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
  masterTitle: string | null;
  adminCatalogTitle: string | null;
  masterDescription: string | null;
  productDescription: string | null;
  adminCatalogDescription: string | null;
  /** Which layer the current packet title originated from */
  titleSource: TextLayerSource;
  /** Which layer the current packet description originated from */
  descriptionSource: TextLayerSource;
  selectedColor: SelectedColor | null;
  qrProductState: QRProductState;
  content: ContentData;
  placementsLoading: boolean;
  placementsError: string | null;
  selectedPlacements: string[];
  placementConfig: _PlacementConfig;
  placementSizes: _PlacementSizeConfig;
  placementMethods: PrintMethodSelection;
  activePacketId: string | null;
  templateBaseline: string | null;
  templateProductHint: TemplateProductHint | null;
  activeSessionId: string | null;
  sessionStatus: 'working' | 'artifact_ready' | 'committed' | null;
  committedInstanceId: string | null;
  selectedCatalogId: string;
}
