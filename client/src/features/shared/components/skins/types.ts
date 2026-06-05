import type { GalleryImage } from "../views/index";

// Universal Product Packet - syncs across all stores when pricing updates
export interface ProductPacket {
  canonicalBlankKey: string;
  blueprintId: number;
  title: string;
  imageUrl?: string | null;
  brand?: string | null;
  baseCost: number;          // Manufacturing cost
  retailPrice: number;       // What customer pays
  profit: number;            // retailPrice - baseCost
  memberEarnings: number;    // 25% of profit
  hasUSAProvider: boolean;
  upcharges?: Record<string, number> | null;  // Size upcharges
  packetCreatedAt?: string;
  packetUpdatedAt?: string;
  raw?: Record<string, any>; // Raw asset metadata (grfId, sourceGrfId, mimeType, etc.)
}

export interface SkinItem {
  id: string;
  packetId?: string;
  name: string;
  primaryImage?: string | null;
  secondaryImage?: string | null;
  images?: GalleryImage[];  // For swipeable galleries (uses shared GalleryImage type)
  qrContent?: string | null;
  headerText?: string | null;
  footerText?: string | null;
  qrMode?: string | null;
  price?: number | null;
  colorCount?: number;
  sizeCount?: number;
  selectedSize?: string | null;
  createdAt?: string | null;
  dimensions?: string | null;
  isUsed?: boolean;
  metadata?: Partial<ProductPacket> | Record<string, any>;  // Dynamic packet data
}

export interface SkinActions {
  onEdit?: (id: string) => void;
  onArchive?: (id: string) => void;
  onDelete?: (id: string) => void;
  onSelect?: (id: string) => void;
  onCrop?: (id: string) => void;
}

export interface SkinProps {
  item: SkinItem;
  actions?: SkinActions;
  isActionPending?: boolean;
}

export interface CardSkinProps extends SkinProps {
  onClick?: () => void;
  isSelected?: boolean;
}

export interface DetailSkinProps extends SkinProps {
  onClose?: () => void;
  onPrev?: () => void;
  onNext?: () => void;
  hasPrev?: boolean;
  hasNext?: boolean;
}
