/**
 * store-builder-types.ts
 *
 * Color utilities are re-exported from the shared canonical source.
 * Do not add a local COLOR_HEX_MAP here — use @shared/colorUtils directly.
 */

export { COLOR_HEX_MAP, getColorHexByName, getColorHex, resolveColorHex } from '@shared/colorUtils';

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
