import {
  Layers, Package, DollarSign, Sparkles, ImagePlus, Wand2, Type, Eye, 
  Smartphone, QrCode, Crop, Library, Link2, Send, Check, Play, Zap, Store
} from "lucide-react";
import { auth } from "@/lib/firebase";

export type WizardStep = 'channel' | 'product' | 'placement' | 'header-footer' | 'background' | 'landing-page' | 'preview' | 'publish';

export type SimpleWizardStep = 'channel' | 'product' | 'product-congrats' | 'color' | 'size' | 'type' | 'placement-count' | 'graphic-size' | 'generate' | 'text-choice' | 'text-edit-header' | 'text-edit-footer' | 'placement-config' | 'shirt-preview' | 'canvas-fork' | 'compose-explainer' | 'platform-acknowledge' | 'url-explainer' | 'url-source-choice' | 'url-library-pick' | 'url-details' | 'url-title' | 'url-description' | 'url-preview' | 'canvas-mockup' | 'url-publish' | 'canvas-save-choice' | 'canvas-confirm' | 'qr-basic-type' | 'qr-basic-input' | 'qr-basic-mockup' | 'qr-basic-save-choice' | 'qr-basic-confirm' | 'qr-plus-mockup' | 'qr-plus-save-choice' | 'qr-plus-confirm' | 'play-video-source' | 'play-preview' | 'play-mockup' | 'play-publish' | 'play-save-choice' | 'compose-pick-items' | 'compose-mode' | 'compose-durations' | 'compose-order' | 'compose-hosting' | 'compose-mockup' | 'compose-preview' | 'compose-publish' | 'compose-confirm';

export type QRBasicSaveOption = 'item' | 'graphic' | 'both' | '';
export type QRPlusSaveOption = 'item' | 'graphic' | 'both' | '';
export type QRCanvasSaveOption = 'item' | 'landing' | 'all' | '';
export type QRPlaySaveOption = 'video' | 'skip' | '';
export type PlayVideoSource = 'upload' | 'url' | 'library' | '';
export type UrlSourceChoice = 'upload' | 'library' | '';
export type LibraryChoice = 'personal' | 'common' | '';
export type PlacementGraphicChoice = 'full' | 'qr-only' | '';
export type QRBasicInputType = 'url' | 'text' | '';
export type PlacementOption = 'front' | 'back' | 'left_chest' | 'sleeve_left' | 'sleeve_right';
export type QRType = 'qr-basic' | 'qr-plus' | 'qr-canvas' | 'qr-play' | 'qr-compose' | '';
export type WizardTier = 'simple' | 'advanced' | 'studio' | 'super-simple';
export type BackgroundSubStep = 'choice' | 'upload' | 'library-choice' | 'personal-library' | 'common-library' | 'crop' | 'full-or-crop';
export type TextLayoutChoice = 'header' | 'footer' | 'both' | '';
export type GraphicLocation = 'front-center' | 'left-chest' | 'back-center' | '';
export type GraphicSize = 'small' | 'medium' | 'large' | '';
export type ViewMode = 'index' | 'wizard' | 'channels' | 'collections' | 'earnings';

export interface ProductItem {
  id: number;
  productId?: number;
  name: string;
  type?: string;
  description?: string | null;
  thumbnailUrl: string | null;
  placements?: { id: string; title: string }[] | null;
}

export interface AllowedProduct {
  blueprintId: number;
  printProviderId?: number;
  title: string;
  imageUrl?: string | null;
  brand?: string | null;
  addedAt?: string;
  baseCost?: number;
  retailPrice?: number;
  profit?: number;
  memberEarnings?: number;
  hasUSAProvider?: boolean;
  placements?: { id: string; title: string; widthPx?: number; heightPx?: number; widthInches?: string; heightInches?: string }[];
  availableColors?: Array<{ name: string; hex: string }>;
  availableSizes?: string[];
}

export interface MemberChannel {
  id: string;
  name: string;
  storeId?: string;
  type?: string;
  createdAt?: string;
  productCount?: number;
  mediaCount?: number;
}

export interface GraphicSet {
  id: string;
  name: string;
  thumbnailUrl: string;
  imageCount: number;
}

export interface ProductCategory {
  name: string;
  items: ProductItem[];
  count: number;
}

export interface MockupFetchParams {
  blueprintId: number;
  printProviderId: number;
  colorName: string;
  artworkUrl: string;
  artworkVariant?: 'black' | 'white';
  canonicalPlacementId?: string;
  qrSize?: 'small' | 'medium' | 'large';
}

export interface MockupFetchResult {
  success: boolean;
  lifestyleUrl: string | null;
  flatUrl: string | null;
  bestUrl: string | null;
  fromCache: boolean;
  error?: string;
}

export const SHIRT_COLORS = [
  { id: 'white', name: 'White', hex: '#FFFFFF', textColor: '#000000' },
  { id: 'black', name: 'Black', hex: '#1a1a1a', textColor: '#FFFFFF' },
  { id: 'navy', name: 'Navy', hex: '#1e3a5f', textColor: '#FFFFFF' },
  { id: 'red', name: 'Red', hex: '#dc2626', textColor: '#FFFFFF' },
  { id: 'forest', name: 'Forest', hex: '#166534', textColor: '#FFFFFF' },
  { id: 'gray', name: 'Gray', hex: '#6b7280', textColor: '#FFFFFF' },
];

export const SHIRT_SIZES = ['S', 'M', 'L', 'XL', '2XL', '3XL'];

export function calculateSizeEarningsBonuses(sizeUpcharges: Record<string, number> | undefined, memberProfitShare: number): Record<string, number> {
  const defaultUpcharges: Record<string, number> = { 'S': 0, 'M': 2, 'L': 4, 'XL': 6, '2XL': 8, '3XL': 10 };
  const upcharges = sizeUpcharges || defaultUpcharges;
  const bonuses: Record<string, number> = {};
  for (const size of SHIRT_SIZES) {
    bonuses[size] = (upcharges[size] || 0) * memberProfitShare;
  }
  return bonuses;
}

export const SHIRT_TEXT_COLORS = ['#ffffff', '#000000', '#3b82f6', '#22c55e', '#f59e0b', '#ef4444'];
export const SHIRT_TEXT_SIZES = [
  { id: 'sm', label: 'S', value: '12px' },
  { id: 'md', label: 'M', value: '18px' },
  { id: 'lg', label: 'L', value: '24px' },
  { id: 'xl', label: 'XL', value: '32px' }
];
export const SHIRT_TEXT_FONTS = [
  { id: 'sans', label: 'Clean', family: 'Arial' },
  { id: 'bold', label: 'Bold', family: 'Impact' },
  { id: 'script', label: 'Script', family: 'Georgia' }
];

export const PLACEMENT_OPTIONS: { id: PlacementOption; label: string; description: string; sizeLabel: string }[] = [
  { id: 'front', label: 'Front Center', description: 'Large main print', sizeLabel: '12"×16"' },
  { id: 'left_chest', label: 'Left Chest', description: 'Small logo area', sizeLabel: '4"×4"' },
  { id: 'back', label: 'Back Center', description: 'Large back print', sizeLabel: '12"×16"' },
  { id: 'sleeve_left', label: 'Left Sleeve', description: 'Sleeve print', sizeLabel: '4"×4"' },
  { id: 'sleeve_right', label: 'Right Sleeve', description: 'Sleeve print', sizeLabel: '4"×4"' },
];

export const QR_TYPES = [
  { id: 'qr-basic' as QRType, label: 'QR Basic', description: 'Static URL - no hosting needed', icon: Link2, color: 'slate' },
  { id: 'qr-plus' as QRType, label: 'QR Plus', description: 'Dynamic URL + header/footer text', icon: Type, color: 'blue' },
  { id: 'qr-canvas' as QRType, label: 'QR Canvas', description: 'Background image with text overlay', icon: ImagePlus, color: 'purple' },
  { id: 'qr-play' as QRType, label: 'QR Play', description: 'Video content landing page', icon: Play, color: 'rose' },
];

export const SIMPLE_WIZARD_STEPS: { id: SimpleWizardStep; label: string; icon: any }[] = [
  { id: 'channel', label: 'Channel', icon: Layers },
  { id: 'product', label: 'Product', icon: Package },
  { id: 'product-congrats', label: 'Earnings', icon: DollarSign },
  { id: 'color', label: 'Color', icon: Sparkles },
  { id: 'size', label: 'Size', icon: Package },
  { id: 'type', label: 'Type', icon: Sparkles },
  { id: 'placement-count', label: 'Placements', icon: Layers },
  { id: 'graphic-size', label: 'Graphic Size', icon: ImagePlus },
  { id: 'generate', label: 'Text?', icon: Wand2 },
  { id: 'text-choice', label: 'Layout', icon: Type },
  { id: 'text-edit-header', label: 'Header', icon: Type },
  { id: 'text-edit-footer', label: 'Footer', icon: Type },
  { id: 'placement-config', label: 'Configure', icon: Layers },
  { id: 'shirt-preview', label: 'Preview', icon: Eye },
  { id: 'canvas-fork', label: 'Choose Moment', icon: Smartphone },
  { id: 'url-explainer', label: 'Image Moment', icon: QrCode },
  { id: 'url-source-choice', label: 'Image Source', icon: Crop },
  { id: 'url-library-pick', label: 'Pick Image', icon: Library },
  { id: 'url-title', label: 'Title', icon: Type },
  { id: 'url-description', label: 'Description', icon: Type },
  { id: 'url-preview', label: 'Preview', icon: Eye },
  { id: 'canvas-mockup', label: 'Product Preview', icon: Eye },
  { id: 'url-publish', label: 'Go Live', icon: Send },
];

export const QR_BASIC_STEPS: { id: SimpleWizardStep; label: string; icon: any }[] = [
  { id: 'channel', label: 'Channel', icon: Layers },
  { id: 'product', label: 'Product', icon: Package },
  { id: 'product-congrats', label: 'Earnings', icon: DollarSign },
  { id: 'color', label: 'Color', icon: Sparkles },
  { id: 'size', label: 'Size', icon: Package },
  { id: 'type', label: 'Type', icon: Sparkles },
  { id: 'placement-count', label: 'Placements', icon: Layers },
  { id: 'graphic-size', label: 'Graphic Size', icon: ImagePlus },
  { id: 'generate', label: 'Header/Footer?', icon: Wand2 },
  { id: 'qr-basic-type', label: 'URL or Text', icon: Link2 },
  { id: 'qr-basic-input', label: 'Enter Content', icon: Type },
  { id: 'qr-basic-mockup', label: 'Preview', icon: Eye },
  { id: 'qr-basic-save-choice', label: 'Save Options', icon: Library },
  { id: 'qr-basic-confirm', label: 'Done', icon: Check },
];

export const QR_PLUS_STEPS: { id: SimpleWizardStep; label: string; icon: any }[] = [
  { id: 'channel', label: 'Channel', icon: Layers },
  { id: 'product', label: 'Product', icon: Package },
  { id: 'product-congrats', label: 'Earnings', icon: DollarSign },
  { id: 'color', label: 'Color', icon: Sparkles },
  { id: 'size', label: 'Size', icon: Package },
  { id: 'type', label: 'Type', icon: Sparkles },
  { id: 'placement-count', label: 'Placements', icon: Layers },
  { id: 'graphic-size', label: 'Graphic Size', icon: ImagePlus },
  { id: 'generate', label: 'Text?', icon: Wand2 },
  { id: 'text-choice', label: 'Layout', icon: Type },
  { id: 'text-edit-header', label: 'Header', icon: Type },
  { id: 'text-edit-footer', label: 'Footer', icon: Type },
  { id: 'placement-config', label: 'Configure', icon: Layers },
  { id: 'shirt-preview', label: 'Preview', icon: Eye },
  { id: 'canvas-fork', label: 'Choose Moment', icon: Smartphone },
  { id: 'qr-plus-mockup', label: 'Final Preview', icon: Eye },
  { id: 'qr-plus-save-choice', label: 'Save Options', icon: Library },
  { id: 'qr-plus-confirm', label: 'Done', icon: Check },
];

export const QR_PLAY_STEPS: { id: SimpleWizardStep; label: string; icon: any }[] = [
  { id: 'channel', label: 'Channel', icon: Layers },
  { id: 'product', label: 'Product', icon: Package },
  { id: 'product-congrats', label: 'Earnings', icon: DollarSign },
  { id: 'color', label: 'Color', icon: Sparkles },
  { id: 'size', label: 'Size', icon: Package },
  { id: 'type', label: 'Type', icon: Sparkles },
  { id: 'placement-count', label: 'Placements', icon: Layers },
  { id: 'graphic-size', label: 'Graphic Size', icon: ImagePlus },
  { id: 'generate', label: 'Text?', icon: Wand2 },
  { id: 'text-choice', label: 'Layout', icon: Type },
  { id: 'text-edit-header', label: 'Header', icon: Type },
  { id: 'text-edit-footer', label: 'Footer', icon: Type },
  { id: 'placement-config', label: 'Configure', icon: Layers },
  { id: 'shirt-preview', label: 'Preview', icon: Eye },
  { id: 'canvas-fork', label: 'Choose Moment', icon: Smartphone },
  { id: 'play-video-source', label: 'Video Moment', icon: Play },
  { id: 'play-preview', label: 'Preview', icon: Eye },
  { id: 'play-mockup', label: 'Product Preview', icon: Eye },
  { id: 'play-publish', label: 'Go Live', icon: Send },
  { id: 'play-save-choice', label: 'Done', icon: Check },
];

export const QR_COMPOSE_STEPS: { id: SimpleWizardStep; label: string; icon: any }[] = [
  { id: 'channel', label: 'Channel', icon: Layers },
  { id: 'product', label: 'Product', icon: Package },
  { id: 'product-congrats', label: 'Earnings', icon: DollarSign },
  { id: 'color', label: 'Color', icon: Sparkles },
  { id: 'size', label: 'Size', icon: Package },
  { id: 'type', label: 'Type', icon: Sparkles },
  { id: 'placement-count', label: 'Placements', icon: Layers },
  { id: 'graphic-size', label: 'Graphic Size', icon: ImagePlus },
  { id: 'generate', label: 'Text?', icon: Wand2 },
  { id: 'text-choice', label: 'Layout', icon: Type },
  { id: 'text-edit-header', label: 'Header', icon: Type },
  { id: 'text-edit-footer', label: 'Footer', icon: Type },
  { id: 'placement-config', label: 'Configure', icon: Layers },
  { id: 'shirt-preview', label: 'Preview', icon: Eye },
  { id: 'canvas-fork', label: 'Choose Moment', icon: Smartphone },
  { id: 'compose-pick-items', label: 'Pick Moments', icon: Library },
  { id: 'compose-mode', label: 'Mode', icon: Sparkles },
  { id: 'compose-durations', label: 'Timing', icon: Zap },
  { id: 'compose-order', label: 'Order', icon: Layers },
  { id: 'compose-hosting', label: 'Hosting', icon: Store },
  { id: 'compose-mockup', label: 'Product Preview', icon: Eye },
  { id: 'compose-preview', label: 'Summary', icon: Eye },
  { id: 'compose-publish', label: 'Go Live', icon: Send },
  { id: 'compose-confirm', label: 'Done', icon: Check },
];

export const WIZARD_STEPS: { id: WizardStep; label: string; icon: any }[] = [
  { id: 'channel', label: 'Channel', icon: Layers },
  { id: 'product', label: 'Pick Item', icon: Package },
  { id: 'placement', label: 'Location', icon: Layers },
  { id: 'header-footer', label: 'Header & Footer', icon: Type },
  { id: 'background', label: 'Background', icon: ImagePlus },
  { id: 'landing-page', label: 'Landing Page', icon: Link2 },
  { id: 'preview', label: 'Preview', icon: Eye },
  { id: 'publish', label: 'Publish', icon: Send },
];

export const isQRBasicStep = (step: SimpleWizardStep): boolean => step.startsWith('qr-basic-');
export const isQRPlusStep = (step: SimpleWizardStep): boolean => step.startsWith('qr-plus-');
export const isQRPlayStep = (step: SimpleWizardStep): boolean => step.startsWith('play-');
export const isQRComposeStep = (step: SimpleWizardStep): boolean => step.startsWith('compose-');

export async function getAuthHeaders(): Promise<HeadersInit> {
  const token = await auth.currentUser?.getIdToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function fetchProductMockup(
  params: MockupFetchParams,
  authHeaders: HeadersInit
): Promise<MockupFetchResult> {
  const {
    blueprintId,
    printProviderId,
    colorName,
    artworkUrl,
    artworkVariant = 'black',
    canonicalPlacementId = 'FRONT_CHEST',
    qrSize = 'medium',
  } = params;

  if (!blueprintId || !printProviderId || !colorName || !artworkUrl) {
    console.error('[MockupFetcher] Missing required params:', { blueprintId, printProviderId, colorName, artworkUrl: !!artworkUrl });
    return {
      success: false, lifestyleUrl: null, flatUrl: null, bestUrl: null, fromCache: false,
      error: 'Missing required parameters for mockup generation',
    };
  }

  try {
    console.log('[MockupFetcher] Requesting priority mockup (test-products pattern):', { 
      blueprintId, printProviderId, colorName, placement: canonicalPlacementId, qrSize 
    });
    
    const response = await fetch('/api/members/mockup/priority', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders },
      body: JSON.stringify({
        blueprintId, printProviderId, colorName, colorHex: '#000000',
        placement: canonicalPlacementId, artworkUrl, qrSize, fulfillmentProvider: 'printify',
      }),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      console.error('[MockupFetcher] API error:', response.status, errorText);
      return {
        success: false, lifestyleUrl: null, flatUrl: null, bestUrl: null, fromCache: false,
        error: `Mockup API error: ${response.status}`,
      };
    }

    const data = await response.json();
    console.log('[MockupFetcher] Priority mockup response:', {
      success: data.success, hasLifestyle: !!data.lifestyleMockupUrl, hasFlat: !!data.mockupUrl,
      fromCache: data.fromCache, error: data.error,
    });

    if (!data.success) {
      return {
        success: false, lifestyleUrl: null, flatUrl: null, bestUrl: null, fromCache: false,
        error: data.error || 'Mockup generation failed',
      };
    }

    const lifestyleUrl = data.lifestyleMockupUrl || null;
    const flatUrl = data.mockupUrl || null;
    const bestUrl = lifestyleUrl || flatUrl;

    return {
      success: !!bestUrl, lifestyleUrl, flatUrl, bestUrl, fromCache: data.fromCache || false,
      error: bestUrl ? undefined : 'No mockup URL returned',
    };
  } catch (err: any) {
    console.error('[MockupFetcher] Exception:', err);
    return {
      success: false, lifestyleUrl: null, flatUrl: null, bestUrl: null, fromCache: false,
      error: err.message || 'Network error during mockup fetch',
    };
  }
}

export function generateQRCodeUrl(
  content: string,
  size: number = 1000,
  qrColor: "black" | "white" = "black"
): string {
  const dark = qrColor === "white" ? "ffffff" : "000000";
  const light = qrColor === "white" ? "000000" : "ffffff";
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(content)}&format=png&qzone=2&ecc=H&color=${dark}&bgcolor=${light}`;
}

export function calculateAutoTextSize(text: string, baseSize: string, areaWidth: number): { lines: string[]; fontSize: number } {
  const sizeMap: Record<string, number> = { '12px': 4, '18px': 5.5, '24px': 7 };
  const baseSvgSize = sizeMap[baseSize] || 3.5;
  const maxCharsPerLine = 20;

  if (!text) return { lines: [''], fontSize: baseSvgSize };

  let lines: string[];
  const hasNewline = text.includes('\n');
  if (hasNewline) {
    lines = text.split('\n').slice(0, 2);
  } else if (text.length > maxCharsPerLine) {
    const mid = Math.ceil(text.length / 2);
    const spaceIdx = text.lastIndexOf(' ', mid);
    const breakAt = spaceIdx > 0 ? spaceIdx : maxCharsPerLine;
    lines = [text.slice(0, breakAt).trim(), text.slice(breakAt).trim()];
  } else {
    lines = [text];
  }

  const longestLine = Math.max(...lines.map(l => l.length), 1);
  let effectiveSize = baseSvgSize;
  if (longestLine > 8) {
    effectiveSize = baseSvgSize * Math.max(0.5, 8 / longestLine);
  }

  return { lines, fontSize: Math.round(effectiveSize * 100) / 100 };
}
