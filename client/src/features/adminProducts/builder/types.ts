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

export interface ContentData {
  url: string;
  title: string;
  description: string;
  backgroundType: "image" | "video";
  overlayPosition: "top" | "bottom" | "center";
  overlayColor: string;
  overlayFontFamily: string;
}

export type PlacementId = "front-chest" | "front-center" | "back" | "left-shoulder" | "right-shoulder";

export const PLACEMENT_OPTIONS: Array<{ id: PlacementId; label: string }> = [
  { id: "front-chest", label: "Front Chest" },
  { id: "front-center", label: "Front Center" },
  { id: "back", label: "Back" },
  { id: "left-shoulder", label: "Left Shoulder" },
  { id: "right-shoulder", label: "Right Shoulder" },
];

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
}
