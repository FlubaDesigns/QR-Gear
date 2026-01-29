import type { GalleryImage } from "../views/GalleryView";

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
}

export interface DetailSkinProps extends SkinProps {
  onClose?: () => void;
  onPrev?: () => void;
  onNext?: () => void;
  hasPrev?: boolean;
  hasNext?: boolean;
}
