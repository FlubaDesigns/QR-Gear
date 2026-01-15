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
  url: string;
  isClipped: boolean;
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
}

export interface OriginFilter {
  showUSA: boolean;
  showOther: boolean;
}

export type QRProductState = 
  | "plain_qr"           // Just QR code, no decoration
  | "qr_header_footer"   // QR with styled header/footer text
  | "qr_url"             // QR links directly to external URL
  | "qr_url_decorated"   // QR + header/footer + links to URL
  | "dynamic"            // Dynamic QR (rich media, updateable)
  | null;

export const QR_PRODUCT_STATES = [
  { id: "plain_qr", label: "Plain QR", description: "Simple QR code, no decoration" },
  { id: "qr_header_footer", label: "QR + Text", description: "QR with styled header & footer" },
  { id: "qr_url", label: "QR → URL", description: "QR links directly to your URL" },
  { id: "qr_url_decorated", label: "QR + Text → URL", description: "Styled QR that links to URL" },
  { id: "dynamic", label: "Dynamic QR", description: "Updateable rich media content" },
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

export interface BuilderState {
  sourceType: SourceType;
  loadedTemplate: LoadedTemplate | null;
  loadedGraphic: LoadedGraphic | null;
  loadedBackground: LoadedBackground | null;
  fulfillmentProvider: string | null;
  category: string | null;
  originFilter: OriginFilter;
  selectedProduct: CatalogProduct | null;
  qrProductState: QRProductState;
  content: ContentData;
}
