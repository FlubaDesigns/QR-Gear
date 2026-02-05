import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { 
  Users, 
  User,
  Store, 
  Package,
  Image,
  QrCode,
  Eye,
  Send,
  Loader2,
  ChevronRight,
  ChevronLeft,
  Check,
  Layers,
  DollarSign,
  Share2,
  BarChart3,
  Upload,
  Plus,
  ExternalLink,
  Wand2,
  Zap,
  Link2,
  Type,
  ImagePlus,
  Play,
  Sparkles,
  X,
  MapPin,
  Library,
  Smartphone,
  ArrowRight,
  ShoppingBag,
  Crop
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { auth, signInWithGoogle, signInWithEmail } from "@/lib/firebase";
import { useQueryClient } from "@tanstack/react-query";
import SEO from "@/components/SEO";
import { MemberAuthProvider } from "@/features/members/MemberAuthContext";
import { MembersProvider, useMembersContext } from "@/features/members/MembersContext";
import { type TextStyleConfig, defaultTextStyle } from "@/features/shared/components/TextStyleEditor";
import { PlacementPicker, type PlacementSize, type PlacementType, type PlacementConfig } from "@/features/shared/components/PlacementPicker";
import { HeaderFooterEditor } from "@/features/shared/components/HeaderFooterEditor";
import { LandingPageEditor, type LandingPageConfig, defaultLandingPage } from "@/features/shared/components/LandingPageEditor";
import { GraphicPreviewView } from "@/features/shared/components/skins/GraphicPreviewView";
import { SkinGridViewer, type SkinItem, type SkinActions } from "@/features/shared/components/SkinGridViewer";
import { AllowedProductCardSkin, AllowedProductDetailSkin } from "@/features/shared/components/skins/AllowedProductSkin";
import { BackgroundLibraryPicker } from "@/features/shared/components/BackgroundLibraryPicker";
import { CropUtility } from "@/features/shared/components/utilities/CropUtility";
import { SharedViewer } from "@/features/shared/components/SharedViewer";
import type { ScrollViewItem } from "@/features/shared/components/views/ScrollView";

async function getAuthHeaders(): Promise<HeadersInit> {
  const token = await auth.currentUser?.getIdToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

interface ProductCategory {
  name: string;
  items: ProductItem[];
  count: number;
}

interface ProductItem {
  id: number;
  productId?: number;
  name: string;
  type?: string;
  description?: string | null;
  thumbnailUrl: string | null;
  placements?: { id: string; title: string }[] | null;
}

interface GraphicSet {
  id: string;
  name: string;
  thumbnailUrl: string;
  imageCount: number;
}

type WizardStep = 'channel' | 'product' | 'placement' | 'header-footer' | 'background' | 'landing-page' | 'preview' | 'publish';
type SimpleWizardStep = 'product' | 'product-congrats' | 'color' | 'size' | 'type' | 'placement-count' | 'graphic-size' | 'generate' | 'text-choice' | 'text-edit' | 'placement-config' | 'shirt-preview' | 'canvas-fork' | 'url-explainer' | 'url-source-choice' | 'url-library-pick' | 'url-details' | 'url-preview' | 'url-publish' | 'qr-basic-type' | 'qr-basic-input' | 'qr-basic-mockup' | 'qr-basic-save-choice' | 'qr-basic-confirm' | 'qr-plus-mockup' | 'qr-plus-save-choice' | 'qr-plus-confirm';

type QRBasicSaveOption = 'item' | 'graphic' | 'both' | '';
type QRPlusSaveOption = 'item' | 'graphic' | 'both' | '';
type UrlSourceChoice = 'upload' | 'library' | '';
type LibraryChoice = 'personal' | 'common' | '';
type PlacementGraphicChoice = 'full' | 'qr-only' | '';
type QRBasicInputType = 'url' | 'text' | '';
// Matches Printify placement IDs
type PlacementOption = 'front' | 'back' | 'left_chest' | 'sleeve_left' | 'sleeve_right';
type QRType = 'qr-basic' | 'qr-plus' | 'qr-canvas' | 'qr-play' | '';
type WizardTier = 'simple' | 'advanced' | 'studio';
type BackgroundSubStep = 'choice' | 'upload' | 'library-choice' | 'personal-library' | 'common-library' | 'crop';
type TextLayoutChoice = 'header' | 'footer' | 'both' | '';
type GraphicLocation = 'front-center' | 'left-chest' | 'back-center' | '';
type GraphicSize = 'small' | 'medium' | 'large' | '';

// Available shirt colors
const SHIRT_COLORS = [
  { id: 'white', name: 'White', hex: '#FFFFFF', textColor: '#000000' },
  { id: 'black', name: 'Black', hex: '#1a1a1a', textColor: '#FFFFFF' },
  { id: 'navy', name: 'Navy', hex: '#1e3a5f', textColor: '#FFFFFF' },
  { id: 'red', name: 'Red', hex: '#dc2626', textColor: '#FFFFFF' },
  { id: 'forest', name: 'Forest', hex: '#166534', textColor: '#FFFFFF' },
  { id: 'gray', name: 'Gray', hex: '#6b7280', textColor: '#FFFFFF' },
];

// Available sizes - earnings calculated dynamically from pricing settings
const SHIRT_SIZES = ['S', 'M', 'L', 'XL', '2XL', '3XL'];

// Helper to calculate size earnings bonuses from pricing settings
// S is base (0), each size up adds increment based on sizeUpcharges × memberProfitShare
function calculateSizeEarningsBonuses(sizeUpcharges: Record<string, number> | undefined, memberProfitShare: number): Record<string, number> {
  const defaultUpcharges: Record<string, number> = { 'S': 0, 'M': 2, 'L': 4, 'XL': 6, '2XL': 8, '3XL': 10 };
  const upcharges = sizeUpcharges || defaultUpcharges;
  const bonuses: Record<string, number> = {};
  for (const size of SHIRT_SIZES) {
    bonuses[size] = (upcharges[size] || 0) * memberProfitShare;
  }
  return bonuses;
}

// Text style presets for shirt text editor
const SHIRT_TEXT_COLORS = ['#ffffff', '#000000', '#3b82f6', '#22c55e', '#f59e0b', '#ef4444'];
const SHIRT_TEXT_SIZES = [
  { id: 'sm', label: 'S', value: '12px' },
  { id: 'md', label: 'M', value: '18px' },
  { id: 'lg', label: 'L', value: '24px' }
];
const SHIRT_TEXT_FONTS = [
  { id: 'sans', label: 'Clean', family: 'Arial' },
  { id: 'bold', label: 'Bold', family: 'Impact' },
  { id: 'script', label: 'Script', family: 'Georgia' }
];

// Simple Wizard - streamlined steps for first-time users
const SIMPLE_WIZARD_STEPS: { id: SimpleWizardStep; label: string; icon: any }[] = [
  { id: 'product', label: 'Product', icon: Package },
  { id: 'product-congrats', label: 'Earnings', icon: DollarSign },
  { id: 'color', label: 'Color', icon: Sparkles },
  { id: 'size', label: 'Size', icon: Package },
  { id: 'type', label: 'Type', icon: Sparkles },
  { id: 'placement-count', label: 'Placements', icon: Layers },
  { id: 'graphic-size', label: 'Graphic Size', icon: ImagePlus },
  { id: 'generate', label: 'Generate', icon: Wand2 },
  { id: 'text-choice', label: 'Layout', icon: Type },
  { id: 'text-edit', label: 'Edit', icon: Type },
  { id: 'placement-config', label: 'Configure', icon: Layers },
  { id: 'shirt-preview', label: 'Preview', icon: Eye },
  { id: 'canvas-fork', label: 'Online Image', icon: Smartphone },
  { id: 'url-explainer', label: 'QR Canvas', icon: QrCode },
  { id: 'url-source-choice', label: 'Image Source', icon: Crop },
  { id: 'url-library-pick', label: 'Pick Image', icon: Library },
  { id: 'url-details', label: 'Details', icon: Type },
  { id: 'url-preview', label: 'Preview', icon: Eye },
  { id: 'url-publish', label: 'Publish', icon: Send },
];

// QR Basic fork steps (after saying No at step 7)
const QR_BASIC_STEPS: { id: SimpleWizardStep; label: string; icon: any }[] = [
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

// Helper to check if we're in QR Basic flow
const isQRBasicStep = (step: SimpleWizardStep): boolean => {
  return step.startsWith('qr-basic-');
};

// Helper to check if we're in QR Plus flow
const isQRPlusStep = (step: SimpleWizardStep): boolean => {
  return step.startsWith('qr-plus-');
};

// QR Plus fork steps (after step 12 shirt-preview for qr-plus type)
const QR_PLUS_STEPS: { id: SimpleWizardStep; label: string; icon: any }[] = [
  { id: 'product', label: 'Product', icon: Package },
  { id: 'product-congrats', label: 'Earnings', icon: DollarSign },
  { id: 'color', label: 'Color', icon: Sparkles },
  { id: 'size', label: 'Size', icon: Package },
  { id: 'type', label: 'Type', icon: Sparkles },
  { id: 'placement-count', label: 'Placements', icon: Layers },
  { id: 'graphic-size', label: 'Graphic Size', icon: ImagePlus },
  { id: 'generate', label: 'Header/Footer?', icon: Wand2 },
  { id: 'text-choice', label: 'Layout', icon: Type },
  { id: 'text-edit', label: 'Edit', icon: Type },
  { id: 'placement-config', label: 'Configure', icon: Layers },
  { id: 'shirt-preview', label: 'Preview', icon: Eye },
  { id: 'canvas-fork', label: 'Online Image?', icon: Smartphone },
  { id: 'qr-plus-mockup', label: 'Final Preview', icon: Eye },
  { id: 'qr-plus-save-choice', label: 'Save Options', icon: Library },
  { id: 'qr-plus-confirm', label: 'Done', icon: Check },
];

// ============================================================================
// ROBUST MOCKUP FETCHER - Reusable across all QR phases
// ============================================================================
interface MockupFetchParams {
  blueprintId: number;
  printProviderId: number;
  colorName: string;
  artworkUrl: string;
  artworkVariant?: 'black' | 'white';
  canonicalPlacementId?: string;
  qrSize?: 'small' | 'medium' | 'large';
}

interface MockupFetchResult {
  success: boolean;
  lifestyleUrl: string | null;  // Glamor/lifestyle mockup (preferred)
  flatUrl: string | null;       // Standard flat product shot
  bestUrl: string | null;       // Best available (lifestyle > flat)
  fromCache: boolean;
  error?: string;
}

async function fetchProductMockup(
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

  // Validate required params
  if (!blueprintId || !printProviderId || !colorName || !artworkUrl) {
    console.error('[MockupFetcher] Missing required params:', { blueprintId, printProviderId, colorName, artworkUrl: !!artworkUrl });
    return {
      success: false,
      lifestyleUrl: null,
      flatUrl: null,
      bestUrl: null,
      fromCache: false,
      error: 'Missing required parameters for mockup generation',
    };
  }

  try {
    console.log('[MockupFetcher] Requesting priority mockup (test-products pattern):', { 
      blueprintId, printProviderId, colorName, placement: canonicalPlacementId, qrSize 
    });
    
    // Use member-specific endpoint (same pattern as test-products)
    const response = await fetch('/api/members/mockup/priority', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders },
      body: JSON.stringify({
        blueprintId,
        printProviderId,
        colorName,
        colorHex: '#000000',
        placement: canonicalPlacementId,
        artworkUrl,
        qrSize,
        fulfillmentProvider: 'printify',
      }),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      console.error('[MockupFetcher] API error:', response.status, errorText);
      return {
        success: false,
        lifestyleUrl: null,
        flatUrl: null,
        bestUrl: null,
        fromCache: false,
        error: `Mockup API error: ${response.status}`,
      };
    }

    const data = await response.json();
    console.log('[MockupFetcher] Priority mockup response:', {
      success: data.success,
      hasLifestyle: !!data.lifestyleMockupUrl,
      hasFlat: !!data.mockupUrl,
      fromCache: data.fromCache,
      error: data.error,
    });

    // Handle the priority mockup response format
    if (!data.success) {
      return {
        success: false,
        lifestyleUrl: null,
        flatUrl: null,
        bestUrl: null,
        fromCache: false,
        error: data.error || 'Mockup generation failed',
      };
    }

    const lifestyleUrl = data.lifestyleMockupUrl || null;
    const flatUrl = data.mockupUrl || null;
    const bestUrl = lifestyleUrl || flatUrl;

    return {
      success: !!bestUrl,
      lifestyleUrl,
      flatUrl,
      bestUrl,
      fromCache: data.fromCache || false,
      error: bestUrl ? undefined : 'No mockup URL returned',
    };
  } catch (err: any) {
    console.error('[MockupFetcher] Exception:', err);
    return {
      success: false,
      lifestyleUrl: null,
      flatUrl: null,
      bestUrl: null,
      fromCache: false,
      error: err.message || 'Network error during mockup fetch',
    };
  }
}

// Generate high-quality QR code URL (reusable across all phases)
function generateQRCodeUrl(content: string, size: number = 1000): string {
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(content)}&format=png&qzone=2&ecc=H&color=000000&bgcolor=ffffff`;
}

// Available placement options - matches Printify API placement IDs
// Sizes based on actual Printify print areas: Front/Back 12"×16", Left Chest 4"×4", Sleeves 4"×4"
const PLACEMENT_OPTIONS: { id: PlacementOption; label: string; description: string; sizeLabel: string }[] = [
  { id: 'front', label: 'Front Center', description: 'Large main print', sizeLabel: '12"×16"' },
  { id: 'left_chest', label: 'Left Chest', description: 'Small logo area', sizeLabel: '4"×4"' },
  { id: 'back', label: 'Back Center', description: 'Large back print', sizeLabel: '12"×16"' },
  { id: 'sleeve_left', label: 'Left Sleeve', description: 'Sleeve print', sizeLabel: '4"×4"' },
  { id: 'sleeve_right', label: 'Right Sleeve', description: 'Sleeve print', sizeLabel: '4"×4"' },
];

// Advanced Wizard - full 8 steps (unlocks after 1st publish)
const WIZARD_STEPS: { id: WizardStep; label: string; icon: any }[] = [
  { id: 'channel', label: 'Channel', icon: Layers },
  { id: 'product', label: 'Pick Item', icon: Package },
  { id: 'placement', label: 'Location', icon: MapPin },
  { id: 'header-footer', label: 'Header & Footer', icon: Type },
  { id: 'background', label: 'Background', icon: ImagePlus },
  { id: 'landing-page', label: 'Landing Page', icon: Link2 },
  { id: 'preview', label: 'Preview', icon: Eye },
  { id: 'publish', label: 'Publish', icon: Send },
];

const QR_TYPES = [
  { 
    id: 'qr-basic' as QRType, 
    label: 'QR Basic', 
    description: 'Static URL - no hosting needed',
    icon: Link2,
    color: 'slate'
  },
  { 
    id: 'qr-plus' as QRType, 
    label: 'QR Plus', 
    description: 'Dynamic URL + header/footer text',
    icon: Type,
    color: 'blue'
  },
  { 
    id: 'qr-canvas' as QRType, 
    label: 'QR Canvas', 
    description: 'Background image with text overlay',
    icon: ImagePlus,
    color: 'purple'
  },
  { 
    id: 'qr-play' as QRType, 
    label: 'QR Play', 
    description: 'Video content landing page',
    icon: Play,
    color: 'rose'
  },
];

function SimpleWizardProgressBar({ 
  currentStep 
}: { 
  currentStep: SimpleWizardStep; 
}) {
  // Use appropriate step array based on current flow
  const steps = isQRBasicStep(currentStep) 
    ? QR_BASIC_STEPS 
    : isQRPlusStep(currentStep) 
      ? QR_PLUS_STEPS 
      : SIMPLE_WIZARD_STEPS;
  const currentIndex = steps.findIndex(s => s.id === currentStep);
  const progress = ((currentIndex + 1) / steps.length) * 100;
  
  return (
    <div className="w-full mb-6">
      <div className="flex justify-between items-center mb-2">
        <span className="text-sm font-medium text-white">
          Step {currentIndex + 1} of {steps.length}: {steps[currentIndex]?.label}
        </span>
        <span className="text-sm text-slate-400">{Math.round(progress)}%</span>
      </div>
      <div className="w-full h-2 bg-slate-700 rounded-full overflow-hidden">
        <div 
          className="h-full bg-gradient-to-r from-green-500 to-green-400 transition-all duration-300 rounded-full"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}

function WizardProgressBar({ 
  currentStep, 
  completedSteps 
}: { 
  currentStep: WizardStep; 
  onStepClick: (step: WizardStep) => void;
  completedSteps: Set<WizardStep>;
}) {
  const currentIndex = WIZARD_STEPS.findIndex(s => s.id === currentStep);
  const progress = (currentIndex / WIZARD_STEPS.length) * 100;
  
  return (
    <div className="w-full mb-6">
      <div className="flex justify-between items-center mb-2">
        <span className="text-sm font-medium text-white">
          Step {currentIndex + 1} of {WIZARD_STEPS.length}: {WIZARD_STEPS[currentIndex]?.label}
        </span>
        <span className="text-sm text-slate-400">{Math.round(progress)}%</span>
      </div>
      <div className="w-full h-2 bg-slate-700 rounded-full overflow-hidden">
        <div 
          className="h-full bg-gradient-to-r from-blue-500 to-blue-400 transition-all duration-300 rounded-full"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}

interface AllowedProduct {
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

interface MemberChannel {
  id: string;
  name: string;
  storeId?: string;
  type?: string;
  createdAt?: string;
  productCount?: number;
  mediaCount?: number;
}

function ChannelStep({ 
  selectedChannel, 
  onSelect,
  memberId,
  isCreatingChannel,
  setIsCreatingChannel,
  newChannelName,
  setNewChannelName
}: { 
  selectedChannel: { id: string; name: string } | null;
  onSelect: (channel: { id: string; name: string }) => void;
  memberId: string;
  isCreatingChannel: boolean;
  setIsCreatingChannel: (v: boolean) => void;
  newChannelName: string;
  setNewChannelName: (v: string) => void;
}) {
  const { toast } = useToast();
  
  const { data: channels = [], isLoading, refetch } = useQuery<MemberChannel[]>({
    queryKey: ["/api/members", memberId, "channels"],
    queryFn: async () => {
      const headers = await getAuthHeaders();
      const res = await fetch(`/api/members/${memberId}/channels`, { headers });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!memberId,
  });

  const createChannelMutation = useMutation({
    mutationFn: async (name: string) => {
      const headers = await getAuthHeaders();
      const res = await fetch(`/api/members/${memberId}/channels`, {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (!res.ok) throw new Error("Failed to create channel");
      return res.json();
    },
    onSuccess: (data) => {
      toast({ title: "Channel Created", description: `"${data.name}" is ready to use.` });
      onSelect({ id: data.id, name: data.name });
      setIsCreatingChannel(false);
      setNewChannelName('');
      refetch();
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const handleCreate = () => {
    if (newChannelName.trim()) {
      createChannelMutation.mutate(newChannelName.trim());
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-blue-400" />
      </div>
    );
  }

  return (
    <div>
      <div className="text-center mb-6">
        <h2 className="text-lg font-bold text-white mb-2">Choose Your Channel</h2>
        <p className="text-slate-400">Products are organized into channels for your store</p>
      </div>

      {isCreatingChannel ? (
        <div className="max-w-md mx-auto space-y-4">
          <div className="space-y-2">
            <Label htmlFor="channel-name" className="text-white">Channel Name</Label>
            <Input
              id="channel-name"
              value={newChannelName}
              onChange={(e) => setNewChannelName(e.target.value)}
              placeholder="e.g., Summer Collection, Tech Gear..."
              className="bg-slate-700 border-slate-600 text-white"
              data-testid="input-new-channel-name"
              autoFocus
            />
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => setIsCreatingChannel(false)}
              className="flex-1"
              data-testid="button-cancel-channel"
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreate}
              disabled={!newChannelName.trim() || createChannelMutation.isPending}
              className="flex-1 bg-blue-600 hover:bg-blue-700"
              data-testid="button-create-channel"
            >
              {createChannelMutation.isPending ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Plus className="w-4 h-4 mr-2" />
              )}
              Create Channel
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {channels.map((channel) => (
              <button
                key={channel.id}
                onClick={() => onSelect({ id: channel.id, name: channel.name })}
                className={`p-4 rounded-lg border-2 transition-all text-left ${
                  selectedChannel?.id === channel.id
                    ? 'border-blue-500 bg-blue-500/20'
                    : 'border-slate-600 bg-slate-800/50 hover:border-slate-500'
                }`}
                data-testid={`button-channel-${channel.id}`}
              >
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${
                    selectedChannel?.id === channel.id ? 'bg-blue-500' : 'bg-slate-700'
                  }`}>
                    <Layers className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h3 className="font-medium text-white">{channel.name}</h3>
                    {channel.productCount !== undefined && (
                      <p className="text-sm text-slate-400">{channel.productCount} products</p>
                    )}
                  </div>
                  {selectedChannel?.id === channel.id && (
                    <Check className="w-5 h-5 text-blue-400 ml-auto" />
                  )}
                </div>
              </button>
            ))}

            <button
              onClick={() => setIsCreatingChannel(true)}
              className="p-4 rounded-lg border-2 border-dashed border-slate-600 bg-slate-800/30 hover:border-blue-500 hover:bg-blue-500/10 transition-all"
              data-testid="button-new-channel"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-slate-700">
                  <Plus className="w-5 h-5 text-blue-400" />
                </div>
                <div>
                  <h3 className="font-medium text-white">Create New Channel</h3>
                  <p className="text-sm text-slate-400">Start a new product line</p>
                </div>
              </div>
            </button>
          </div>

          {channels.length === 0 && (
            <div className="text-center py-4">
              <p className="text-slate-400">No channels yet. Create your first one!</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Simple Wizard Step: Product Selection
// Step 0: Product Picker
function ProductPickerStep({
  selectedProduct,
  onSelect
}: {
  selectedProduct: AllowedProduct | null;
  onSelect: (product: AllowedProduct) => void;
}) {
  const { data: productsData, isLoading } = useQuery<{ products: AllowedProduct[] }>({
    queryKey: ["/api/members/allowed-products"],
  });
  
  const products = productsData?.products || [];
  
  if (isLoading) {
    return (
      <div className="text-center py-12">
        <Loader2 className="w-8 h-8 animate-spin mx-auto text-slate-400" />
        <p className="text-slate-400 mt-2">Loading products...</p>
      </div>
    );
  }
  
  if (products.length === 0) {
    return (
      <div className="text-center py-12 space-y-4">
        <Package className="w-12 h-12 mx-auto text-slate-500" />
        <h2 className="text-xl font-bold text-white">No Products Available</h2>
        <p className="text-slate-400">Contact admin to unlock products for you.</p>
      </div>
    );
  }
  
  return (
    <div className="space-y-4">
      <div className="text-center">
        <h2 className="text-lg font-bold text-white mb-2">Pick Your Product</h2>
        <p className="text-slate-400">Select an item to customize</p>
      </div>
      
      <div className="max-h-[400px] overflow-y-auto pr-2 space-y-2">
        {products.map((product) => (
          <button
            key={product.blueprintId}
            onClick={() => onSelect(product)}
            className={`w-full flex items-center gap-4 p-3 rounded-xl border-2 transition-all text-left ${
              selectedProduct?.blueprintId === product.blueprintId
                ? 'border-green-500 bg-green-500/20'
                : 'border-slate-600 bg-slate-800/50 hover:border-slate-500'
            }`}
            data-testid={`button-product-${product.blueprintId}`}
          >
            {product.imageUrl ? (
              <img 
                src={product.imageUrl} 
                alt={product.title}
                className="w-16 h-16 rounded-lg object-cover bg-white"
              />
            ) : (
              <div className="w-16 h-16 rounded-lg bg-slate-700 flex items-center justify-center">
                <Package className="w-8 h-8 text-slate-500" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-white font-medium truncate">{product.title}</p>
              {product.brand && (
                <p className="text-xs text-slate-400">{product.brand}</p>
              )}
              {product.memberEarnings && (
                <p className="text-xs text-green-400">Earn ${product.memberEarnings.toFixed(2)}</p>
              )}
            </div>
            {selectedProduct?.blueprintId === product.blueprintId && (
              <Check className="w-5 h-5 text-green-500 flex-shrink-0" />
            )}
          </button>
        ))}
      </div>
    </div>
  );
}

// Advanced wizard product picker (placeholder - not in scope)
function AdvancedProductPickerStep({ selectedProduct, onSelect }: { selectedProduct: ProductItem | null; onSelect: (product: ProductItem) => void; }) {
  return <div className="text-center py-12 text-slate-400">Advanced product picker - use Simple Wizard for now</div>;
}

// Product Congrats Step - animated celebration showing earnings
function ProductCongratsStep({
  productName,
  earnings
}: {
  productName: string;
  earnings: number;
}) {
  const [showAmount, setShowAmount] = useState(false);
  
  useEffect(() => {
    // Trigger animation after mount
    const timer = setTimeout(() => setShowAmount(true), 300);
    return () => clearTimeout(timer);
  }, []);
  
  return (
    <div className="flex flex-col items-center justify-center py-8 space-y-6">
      <div className="relative">
        <div className="absolute inset-0 bg-green-500/20 rounded-full blur-3xl animate-pulse" />
        <div className="relative bg-gradient-to-br from-green-500 to-emerald-600 rounded-full p-6">
          <DollarSign className="w-16 h-16 text-white" />
        </div>
      </div>
      
      <div className="text-center space-y-3">
        <h2 className="text-lg font-bold text-white">
          Congratulations!
        </h2>
        <p className="text-slate-300">
          You selected the <span className="text-white font-semibold">{productName}</span>
        </p>
      </div>
      
      <div className={`transition-all duration-700 ${showAmount ? 'opacity-100 scale-100' : 'opacity-0 scale-75'}`}>
        <div className="bg-slate-800/80 rounded-2xl p-6 border border-green-500/30">
          <p className="text-slate-400 text-sm mb-2">Starting potential earnings</p>
          <div className="text-4xl font-bold text-green-400">
            ${(earnings || 0).toFixed(2)}+
          </div>
          <p className="text-slate-500 text-xs mt-2">Actual earnings depend on size the customer picks!</p>
        </div>
      </div>
    </div>
  );
}

// Step 0a: Color Picker
function ColorPickerStep({
  selectedColor,
  onSelect
}: {
  selectedColor: string;
  onSelect: (color: string) => void;
}) {
  return (
    <div className="text-center space-y-6">
      <div>
        <h2 className="text-lg font-bold text-white mb-2">Choose Your Color</h2>
        <p className="text-slate-400">What color would you like?</p>
      </div>
      
      <div className="flex flex-wrap justify-center gap-4 max-w-md mx-auto">
        {SHIRT_COLORS.map((color) => (
          <button
            key={color.id}
            onClick={() => onSelect(color.id)}
            className={`w-16 h-16 rounded-full border-4 transition-all ${
              selectedColor === color.id
                ? 'border-green-500 scale-110'
                : 'border-slate-600 hover:border-slate-400'
            }`}
            style={{ backgroundColor: color.hex }}
            title={color.name}
            data-testid={`button-color-${color.id}`}
          />
        ))}
      </div>
      
      {selectedColor && (
        <p className="text-white font-medium">
          {SHIRT_COLORS.find(c => c.id === selectedColor)?.name}
        </p>
      )}
      
      <div className="mt-4 p-4 bg-slate-800/50 rounded-lg max-w-md mx-auto">
        <p className="text-slate-400 text-sm">
          This color creates your product's display image. Your customers can still choose their own color and size when they order.
        </p>
      </div>
    </div>
  );
}

// Step 0b: Size Picker with shirt preview
function SizePickerStep({
  selectedSize,
  selectedColor,
  baseEarnings = 0,
  sizeEarningsBonuses,
  onSelect
}: {
  selectedSize: string;
  selectedColor: string;
  baseEarnings?: number;
  sizeEarningsBonuses: Record<string, number>;
  onSelect: (size: string) => void;
}) {
  const colorHex = SHIRT_COLORS.find(c => c.id === selectedColor)?.hex || '#1a1a1a';
  
  // Scale shirt size based on selected size
  const sizeScales: Record<string, number> = {
    'XS': 0.7,
    'S': 0.8,
    'M': 0.9,
    'L': 1.0,
    'XL': 1.1,
    '2XL': 1.2,
    '3XL': 1.3,
  };
  const scale = sizeScales[selectedSize] || 0.9;
  const shirtWidth = Math.round(120 * scale);
  const shirtHeight = Math.round(140 * scale);
  
  return (
    <div className="text-center space-y-3">
      <div>
        <h2 className="text-xl font-bold text-white mb-1">What Size?</h2>
        <p className="text-slate-400 text-sm">For preview - customers pick their own size</p>
      </div>
      
      {/* Shirt preview - scales based on selected size */}
      <div className="flex justify-center items-end h-[200px]">
        <svg 
          width={shirtWidth * 1.4} 
          height={shirtHeight * 1.4} 
          viewBox="0 0 120 140" 
          className="drop-shadow-lg transition-all duration-300"
        >
          <path
            d="M20,35 L35,20 L50,25 L60,20 L70,25 L85,20 L100,35 L95,55 L85,50 L85,120 L35,120 L35,50 L25,55 Z"
            fill={colorHex}
            stroke="#444"
            strokeWidth="2"
          />
        </svg>
      </div>
      
      <div className="flex flex-wrap justify-center gap-3 max-w-md mx-auto">
        {SHIRT_SIZES.map((size) => {
          const sizeEarnings = baseEarnings + (sizeEarningsBonuses[size] || 0);
          return (
            <button
              key={size}
              onClick={() => onSelect(size)}
              className={`w-16 h-20 rounded-lg border-2 font-bold transition-all flex flex-col items-center justify-center ${
                selectedSize === size
                  ? 'border-green-500 bg-green-500/20 text-green-400'
                  : 'border-slate-600 bg-slate-800/50 text-white hover:border-slate-400'
              }`}
              data-testid={`button-size-${size}`}
            >
              <span className="text-lg">{size}</span>
              <span className={`text-xs ${selectedSize === size ? 'text-green-400' : 'text-slate-400'}`}>
                ${sizeEarnings.toFixed(2)}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// Step 2: Graphic Location
function GraphicLocationStep({
  selectedLocation,
  selectedColor,
  onSelect
}: {
  selectedLocation: GraphicLocation;
  selectedColor: string;
  onSelect: (location: GraphicLocation) => void;
}) {
  const colorHex = SHIRT_COLORS.find(c => c.id === selectedColor)?.hex || '#1a1a1a';
  
  return (
    <div className="text-center space-y-6">
      <div>
        <h2 className="text-lg font-bold text-white mb-2">Where Do You Want Your Graphic?</h2>
        <p className="text-slate-400">Tap a location to select</p>
      </div>
      
      {/* Shirt with location boxes */}
      <div className="flex justify-center">
        <svg width="180" height="210" viewBox="0 0 180 210" className="drop-shadow-lg">
          {/* Shirt shape */}
          <path
            d="M30,52 L52,30 L75,37 L90,30 L105,37 L128,30 L150,52 L142,82 L127,75 L127,180 L53,180 L53,75 L38,82 Z"
            fill={colorHex}
            stroke="#444"
            strokeWidth="2"
          />
          
          {/* Left Chest location */}
          <rect
            x="60" y="65" width="25" height="25"
            fill={selectedLocation === 'left-chest' ? '#22c55e' : '#666'}
            fillOpacity={selectedLocation === 'left-chest' ? 0.8 : 0.4}
            stroke={selectedLocation === 'left-chest' ? '#22c55e' : '#888'}
            strokeWidth="2"
            strokeDasharray={selectedLocation === 'left-chest' ? '0' : '4'}
            rx="3"
            className="cursor-pointer"
            onClick={() => onSelect('left-chest')}
          />
          
          {/* Front Center location */}
          <rect
            x="65" y="100" width="50" height="50"
            fill={selectedLocation === 'front-center' ? '#22c55e' : '#666'}
            fillOpacity={selectedLocation === 'front-center' ? 0.8 : 0.4}
            stroke={selectedLocation === 'front-center' ? '#22c55e' : '#888'}
            strokeWidth="2"
            strokeDasharray={selectedLocation === 'front-center' ? '0' : '4'}
            rx="3"
            className="cursor-pointer"
            onClick={() => onSelect('front-center')}
          />
        </svg>
      </div>
      
      <div className="flex flex-wrap justify-center gap-3">
        <button
          onClick={() => onSelect('left-chest')}
          className={`px-4 py-2 rounded-lg border-2 transition-all ${
            selectedLocation === 'left-chest'
              ? 'border-green-500 bg-green-500/20 text-green-400'
              : 'border-slate-600 bg-slate-800/50 text-white hover:border-slate-400'
          }`}
          data-testid="button-location-left-chest"
        >
          Left Chest
        </button>
        <button
          onClick={() => onSelect('front-center')}
          className={`px-4 py-2 rounded-lg border-2 transition-all ${
            selectedLocation === 'front-center'
              ? 'border-green-500 bg-green-500/20 text-green-400'
              : 'border-slate-600 bg-slate-800/50 text-white hover:border-slate-400'
          }`}
          data-testid="button-location-front-center"
        >
          Front Center
        </button>
        <button
          onClick={() => onSelect('back-center')}
          className={`px-4 py-2 rounded-lg border-2 transition-all ${
            selectedLocation === 'back-center'
              ? 'border-green-500 bg-green-500/20 text-green-400'
              : 'border-slate-600 bg-slate-800/50 text-white hover:border-slate-400'
          }`}
          data-testid="button-location-back-center"
        >
          Back Center
        </button>
      </div>
    </div>
  );
}

// Step 3: Graphic Size - shows outline of entire graphic area
function GraphicSizeStep({
  selectedSize,
  selectedColor,
  currentPlacement,
  onSelect
}: {
  selectedSize: GraphicSize;
  selectedColor: string;
  currentPlacement: PlacementOption;
  onSelect: (size: GraphicSize) => void;
}) {
  const colorHex = SHIRT_COLORS.find(c => c.id === selectedColor)?.hex || '#1a1a1a';
  
  // Get size options based on placement
  const getSizeOptionsForPlacement = () => {
    if (currentPlacement === 'sleeve_left' || currentPlacement === 'sleeve_right') {
      // 4"×4" sleeve - proportionally larger visual
      return { small: { w: 16, h: 16 }, medium: { w: 22, h: 22 }, large: { w: 28, h: 28 } };
    }
    if (currentPlacement === 'left_chest') {
      return { small: { w: 15, h: 15 }, medium: { w: 20, h: 20 }, large: { w: 25, h: 25 } };
    }
    // Front/back - larger sizes
    return { small: { w: 22, h: 30 }, medium: { w: 33, h: 44 }, large: { w: 41, h: 52 } };
  };
  
  const sizeOptions = getSizeOptionsForPlacement();
  const currentSize = sizeOptions[selectedSize || 'medium'] || sizeOptions.medium;
  
  // Check if this is a sleeve placement
  const isSleeve = currentPlacement === 'sleeve_left' || currentPlacement === 'sleeve_right';
  const isLeftSleeve = currentPlacement === 'sleeve_left';
  const isLeftChest = currentPlacement === 'left_chest';
  const isBack = currentPlacement === 'back';
  
  // Render sleeve view
  const renderSleeveView = () => (
    <svg width="200" height="200" viewBox="0 0 180 180" className="drop-shadow-xl">
      {/* Angled sleeve shape - showing partial shirt from side */}
      <g transform={isLeftSleeve ? "translate(90, 90) rotate(-25)" : "translate(90, 90) rotate(25) scale(-1,1)"}>
        {/* Sleeve tube */}
        <path
          d="M-30,-60 L30,-60 L35,60 L-35,60 Z"
          fill={colorHex}
          stroke="#444"
          strokeWidth="2"
        />
        {/* Shoulder seam hint */}
        <path
          d="M-30,-60 Q-40,-70 -50,-55"
          fill="none"
          stroke="#555"
          strokeWidth="1.5"
        />
        {/* Partial body hint */}
        <path
          d="M-35,60 Q-45,80 -40,100 L40,100 Q45,80 35,60"
          fill={colorHex}
          stroke="#444"
          strokeWidth="1"
          opacity="0.5"
        />
      </g>
      
      {/* Graphic outline on sleeve - positioned in center */}
      <g transform={isLeftSleeve ? "translate(90, 85) rotate(-25)" : "translate(90, 85) rotate(25) scale(-1,1)"}>
        <rect
          x={-currentSize.w/2}
          y={-currentSize.h/2}
          width={currentSize.w}
          height={currentSize.h}
          fill="transparent"
          stroke="#22c55e"
          strokeWidth="2"
          strokeDasharray="4 2"
          rx="2"
        />
        {/* Mini QR icon */}
        <rect x={-4} y={-4} width={8} height={8} fill="white" rx="1" />
        <rect x={-3} y={-3} width={2} height={2} fill="#374151" />
        <rect x={1} y={-3} width={2} height={2} fill="#374151" />
        <rect x={-3} y={1} width={2} height={2} fill="#374151" />
      </g>
      
      {/* Label */}
      <text x="90" y="175" textAnchor="middle" fill="#64748b" fontSize="10">
        {isLeftSleeve ? 'Left Sleeve' : 'Right Sleeve'}
      </text>
    </svg>
  );
  
  // Render front/back/chest view
  const renderBodyView = () => {
    const graphicX = isLeftChest ? 77 : 90;
    const graphicY = isLeftChest ? 68 : 79;
    
    return (
      <svg width="200" height="240" viewBox="0 0 180 210" className="drop-shadow-xl">
        <path
          d="M30,52 L52,30 L75,37 L90,30 L105,37 L128,30 L150,52 L142,82 L127,75 L127,180 L53,180 L53,75 L38,82 Z"
          fill={colorHex}
          stroke="#444"
          strokeWidth="2"
        />
        
        {/* Back indicator */}
        {isBack && (
          <text x="90" y="25" textAnchor="middle" fill="#64748b" fontSize="8">BACK</text>
        )}
        
        {/* Graphic outline on shirt */}
        <rect
          x={graphicX - currentSize.w/2}
          y={graphicY - currentSize.h/2}
          width={currentSize.w}
          height={currentSize.h}
          fill="transparent"
          stroke="#22c55e"
          strokeWidth="1.5"
          strokeDasharray="4 2"
          rx="3"
        />
        
        {/* Header text placeholder */}
        <text
          x={graphicX}
          y={graphicY - currentSize.h/2 + 10}
          textAnchor="middle"
          fill="#64748b"
          fontSize={isLeftChest ? 4 : 6}
        >
          Header
        </text>
        
        {/* QR code - smaller with blank pattern */}
        <g transform={`translate(${graphicX - (isLeftChest ? 4 : 6)}, ${graphicY - (isLeftChest ? 4 : 6)})`}>
          <rect width={isLeftChest ? 8 : 12} height={isLeftChest ? 8 : 12} fill="white" rx="1" />
          <rect x="1" y="1" width={isLeftChest ? 2 : 2.5} height={isLeftChest ? 2 : 2.5} fill="#374151" />
          <rect x={isLeftChest ? 5 : 8.5} y="1" width={isLeftChest ? 2 : 2.5} height={isLeftChest ? 2 : 2.5} fill="#374151" />
          <rect x="1" y={isLeftChest ? 5 : 8.5} width={isLeftChest ? 2 : 2.5} height={isLeftChest ? 2 : 2.5} fill="#374151" />
          <rect x={isLeftChest ? 3 : 4.5} y={isLeftChest ? 3 : 4.5} width={isLeftChest ? 2 : 3} height={isLeftChest ? 2 : 3} fill="#374151" />
        </g>
        
        {/* Footer text placeholder */}
        <text
          x={graphicX}
          y={graphicY + currentSize.h/2 - 4}
          textAnchor="middle"
          fill="#64748b"
          fontSize={isLeftChest ? 4 : 6}
        >
          Footer
        </text>
      </svg>
    );
  };
  
  return (
    <div className="text-center space-y-6">
      <div>
        <h2 className="text-lg font-bold text-white mb-2">What Size Graphic?</h2>
        <p className="text-slate-400">This is your entire print area</p>
      </div>
      
      {/* Shirt/Sleeve with graphic outline preview */}
      <div className="flex justify-center py-4">
        {isSleeve ? renderSleeveView() : renderBodyView()}
      </div>
      
      <p className="text-xs text-slate-500">
        {isSleeve ? 'QR fits inside this box on the sleeve' : 'Header + QR + Footer all fit inside this box'}
      </p>
      
      <div className="flex flex-wrap justify-center gap-3">
        {(['small', 'medium', 'large'] as GraphicSize[]).map((size) => (
          <button
            key={size}
            onClick={() => onSelect(size)}
            className={`px-6 py-3 rounded-lg border-2 capitalize transition-all ${
              selectedSize === size
                ? 'border-green-500 bg-green-500/20 text-green-400'
                : 'border-slate-600 bg-slate-800/50 text-white hover:border-slate-400'
            }`}
            data-testid={`button-graphic-size-${size}`}
          >
            {size}
          </button>
        ))}
      </div>
    </div>
  );
}

// Step 4: Generate Graphic (asks about header/footer)
function GenerateGraphicStep({
  selectedColor,
  graphicLocation,
  graphicSize,
  onYes,
  onNo
}: {
  selectedColor: string;
  graphicLocation: GraphicLocation;
  graphicSize: GraphicSize;
  onYes: () => void;
  onNo: () => void;
}) {
  const colorHex = SHIRT_COLORS.find(c => c.id === selectedColor)?.hex || '#1a1a1a';
  
  const getQrSize = () => {
    const sizeKey = graphicSize || 'medium';
    if (graphicLocation === 'left-chest') {
      // Left chest: proportional to 25%/45%/65% of ~40px area
      const sizes: Record<string, number> = { small: 10, medium: 18, large: 26 };
      return sizes[sizeKey] || 18;
    }
    // Front/back center: proportional to 25%/45%/65% of ~100px area
    const sizes: Record<string, number> = { small: 25, medium: 45, large: 65 };
    return sizes[sizeKey] || 45;
  };
  
  const qrSize = getQrSize();
  
  return (
    <div className="text-center space-y-6">
      <div>
        <h2 className="text-lg font-bold text-white mb-2">Want a Header and/or Footer?</h2>
        <p className="text-slate-400">Add text above or below your QR code</p>
      </div>
      
      {/* Shirt with QR placeholder */}
      <div className="flex justify-center">
        <svg width="180" height="210" viewBox="0 0 180 210" className="drop-shadow-lg">
          <path
            d="M30,52 L52,30 L75,37 L90,30 L105,37 L128,30 L150,52 L142,82 L127,75 L127,180 L53,180 L53,75 L38,82 Z"
            fill={colorHex}
            stroke="#444"
            strokeWidth="2"
          />
          
          {/* QR Code - smaller with blank pattern */}
          {graphicLocation === 'left-chest' && (
            <g transform={`translate(${77 - 5}, ${68 - 5})`}>
              <rect width="10" height="10" fill="white" rx="1" />
              <rect x="1" y="1" width="2" height="2" fill="#333" />
              <rect x="7" y="1" width="2" height="2" fill="#333" />
              <rect x="1" y="7" width="2" height="2" fill="#333" />
              <rect x="4" y="4" width="2" height="2" fill="#333" />
            </g>
          )}
          {(graphicLocation === 'front-center' || graphicLocation === 'back-center') && (
            <g transform={`translate(${90 - 8}, ${79 - 8})`}>
              <rect width="16" height="16" fill="white" rx="1" />
              <rect x="1" y="1" width="3" height="3" fill="#333" />
              <rect x="12" y="1" width="3" height="3" fill="#333" />
              <rect x="1" y="12" width="3" height="3" fill="#333" />
              <rect x="6" y="6" width="4" height="4" fill="#333" />
            </g>
          )}
        </svg>
      </div>
      
      <div className="flex flex-wrap justify-center gap-4">
        <Button
          onClick={onYes}
          className="px-8 py-4 bg-green-600 hover:bg-green-700 text-lg"
          data-testid="button-want-text-yes"
        >
          <Check className="w-5 h-5 mr-2" />
          Yes, add text
        </Button>
        <Button
          onClick={onNo}
          variant="outline"
          className="px-8 py-4 text-lg"
          data-testid="button-want-text-no"
        >
          <X className="w-5 h-5 mr-2" />
          No, just the QR
        </Button>
      </div>
    </div>
  );
}

// QR Basic Step 1: Choose URL or Text
function QRBasicTypeStep({
  selectedType,
  onSelect,
  selectedColor,
  graphicSize
}: {
  selectedType: QRBasicInputType;
  onSelect: (type: QRBasicInputType) => void;
  selectedColor: string;
  graphicSize: GraphicSize;
}) {
  const colorHex = SHIRT_COLORS.find(c => c.id === selectedColor)?.hex || '#1a1a1a';
  
  // Get outline size matching graphic-size step
  const getOutlineSize = () => {
    const sizeKey = graphicSize || 'medium';
    const sizes: Record<string, { w: number; h: number }> = { 
      small: { w: 22, h: 30 }, 
      medium: { w: 33, h: 44 }, 
      large: { w: 41, h: 52 } 
    };
    return sizes[sizeKey] || sizes.medium;
  };
  const outlineSize = getOutlineSize();
  
  return (
    <div className="text-center space-y-6">
      <div>
        <h2 className="text-lg font-bold text-white mb-2">What should the QR code link to?</h2>
        <p className="text-slate-400">Choose what people see when they scan</p>
      </div>
      
      {/* Shirt with QR code sized to match step 6 graphic size */}
      <div className="flex justify-center py-4">
        <svg width="180" height="210" viewBox="0 0 180 210" className="drop-shadow-lg">
          <path
            d="M30,52 L52,30 L75,37 L90,30 L105,37 L128,30 L150,52 L142,82 L127,75 L127,180 L53,180 L53,75 L38,82 Z"
            fill={colorHex}
            stroke="#444"
            strokeWidth="2"
          />
          {/* QR code fills the graphic area based on step 6 size */}
          {(() => {
            const qrSize = Math.min(outlineSize.w, outlineSize.h) - 2;
            const qrX = 90 - qrSize/2;
            const qrY = 90 - qrSize/2;
            const cellSize = qrSize / 7;
            return (
              <g>
                <rect x={qrX} y={qrY} width={qrSize} height={qrSize} fill="white" rx="2" />
                <rect x={qrX + cellSize * 0.5} y={qrY + cellSize * 0.5} width={cellSize * 2} height={cellSize * 2} fill="#333" />
                <rect x={qrX + cellSize * 4.5} y={qrY + cellSize * 0.5} width={cellSize * 2} height={cellSize * 2} fill="#333" />
                <rect x={qrX + cellSize * 0.5} y={qrY + cellSize * 4.5} width={cellSize * 2} height={cellSize * 2} fill="#333" />
                <rect x={qrX + cellSize * 3} y={qrY + cellSize * 3} width={cellSize} height={cellSize} fill="#333" />
                <rect x={qrX + cellSize * 0.8} y={qrY + cellSize * 0.8} width={cellSize * 1.4} height={cellSize * 1.4} fill="white" />
                <rect x={qrX + cellSize * 4.8} y={qrY + cellSize * 0.8} width={cellSize * 1.4} height={cellSize * 1.4} fill="white" />
                <rect x={qrX + cellSize * 0.8} y={qrY + cellSize * 4.8} width={cellSize * 1.4} height={cellSize * 1.4} fill="white" />
                <rect x={qrX + cellSize * 1.1} y={qrY + cellSize * 1.1} width={cellSize * 0.8} height={cellSize * 0.8} fill="#333" />
                <rect x={qrX + cellSize * 5.1} y={qrY + cellSize * 1.1} width={cellSize * 0.8} height={cellSize * 0.8} fill="#333" />
                <rect x={qrX + cellSize * 1.1} y={qrY + cellSize * 5.1} width={cellSize * 0.8} height={cellSize * 0.8} fill="#333" />
              </g>
            );
          })()}
        </svg>
      </div>
      
      <div className="grid grid-cols-1 gap-4 max-w-sm mx-auto">
        <button
          onClick={() => onSelect('url')}
          className={`p-5 rounded-xl border-2 transition-all text-left ${
            selectedType === 'url'
              ? 'border-blue-500 bg-blue-500/20'
              : 'border-slate-600 bg-slate-800/50 hover:border-slate-400'
          }`}
          data-testid="button-qr-basic-url"
        >
          <div className="flex items-center gap-4">
            <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
              selectedType === 'url' ? 'bg-blue-500' : 'bg-slate-700'
            }`}>
              <Link2 className="w-6 h-6 text-white" />
            </div>
            <div className="flex-1">
              <h3 className="font-bold text-white text-lg">Website Link (URL)</h3>
              <p className="text-slate-400 text-sm">Opens a webpage when scanned</p>
            </div>
            {selectedType === 'url' && <Check className="w-6 h-6 text-blue-400" />}
          </div>
        </button>
        
        <button
          onClick={() => onSelect('text')}
          className={`p-5 rounded-xl border-2 transition-all text-left ${
            selectedType === 'text'
              ? 'border-purple-500 bg-purple-500/20'
              : 'border-slate-600 bg-slate-800/50 hover:border-slate-400'
          }`}
          data-testid="button-qr-basic-text"
        >
          <div className="flex items-center gap-4">
            <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
              selectedType === 'text' ? 'bg-purple-500' : 'bg-slate-700'
            }`}>
              <Type className="w-6 h-6 text-white" />
            </div>
            <div className="flex-1">
              <h3 className="font-bold text-white text-lg">Text Message</h3>
              <p className="text-slate-400 text-sm">Shows text when scanned (up to 2000 characters)</p>
            </div>
            {selectedType === 'text' && <Check className="w-6 h-6 text-purple-400" />}
          </div>
        </button>
      </div>
    </div>
  );
}

// QR Basic Step 2: Enter URL or Text content
// URL validation helper - just check for no spaces and has a dot
function isValidUrl(urlString: string): boolean {
  if (!urlString.trim()) return false;
  // No spaces allowed
  if (urlString.includes(' ')) return false;
  // Must contain a dot (like example.com)
  if (!urlString.includes('.')) return false;
  return true;
}

function QRBasicInputStep({
  inputType,
  content,
  onContentChange,
  selectedColor,
  graphicSize
}: {
  inputType: QRBasicInputType;
  content: string;
  onContentChange: (content: string) => void;
  selectedColor: string;
  graphicSize: GraphicSize;
}) {
  const colorHex = SHIRT_COLORS.find(c => c.id === selectedColor)?.hex || '#1a1a1a';
  const isUrl = inputType === 'url';
  const maxLength = isUrl ? 500 : 2000;
  const charCount = content.length;
  const urlError = isUrl && content.trim() !== '' && !isValidUrl(content);
  
  // Get outline size matching graphic-size step
  const getOutlineSize = () => {
    const sizeKey = graphicSize || 'medium';
    const sizes: Record<string, { w: number; h: number }> = { 
      small: { w: 22, h: 30 }, 
      medium: { w: 33, h: 44 }, 
      large: { w: 41, h: 52 } 
    };
    return sizes[sizeKey] || sizes.medium;
  };
  const outlineSize = getOutlineSize();
  
  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-lg font-bold text-white mb-2">
          {isUrl ? 'Enter Your Website Link' : 'Enter Your Message'}
        </h2>
        <p className="text-slate-400">
          {isUrl ? 'This opens when someone scans your QR code' : 'This text appears when someone scans your QR code'}
        </p>
      </div>
      
      {/* Shirt with dashed graphic area */}
      <div className="flex justify-center py-2">
        <svg width="140" height="160" viewBox="0 0 180 210" className="drop-shadow-lg">
          <path
            d="M30,52 L52,30 L75,37 L90,30 L105,37 L128,30 L150,52 L142,82 L127,75 L127,180 L53,180 L53,75 L38,82 Z"
            fill={colorHex}
            stroke="#444"
            strokeWidth="2"
          />
          {/* Dashed graphic area */}
          <rect
            x={90 - outlineSize.w/2}
            y={90 - outlineSize.h/2}
            width={outlineSize.w}
            height={outlineSize.h}
            fill="transparent"
            stroke="#64748b"
            strokeWidth="1.5"
            strokeDasharray="4 2"
            rx="3"
          />
          {/* QR icon in center */}
          <g transform="translate(82, 82)">
            <rect width="16" height="16" fill="white" rx="1" opacity="0.9" />
            <rect x="1" y="1" width="3" height="3" fill="#333" />
            <rect x="12" y="1" width="3" height="3" fill="#333" />
            <rect x="1" y="12" width="3" height="3" fill="#333" />
            <rect x="6" y="6" width="4" height="4" fill="#333" />
          </g>
        </svg>
      </div>
      
      <div className="max-w-md mx-auto space-y-3">
        {isUrl ? (
          <div className="space-y-2">
            <Label className="text-white font-medium">Website URL</Label>
            <Input
              value={content}
              onChange={(e) => onContentChange(e.target.value)}
              placeholder="https://example.com"
              className={`bg-slate-700 border-slate-600 text-white h-12 text-lg ${urlError ? 'border-red-500 focus:ring-red-500' : ''}`}
              data-testid="input-qr-basic-url"
            />
            {urlError ? (
              <p className="text-red-400 text-sm">Enter a valid link (e.g., example.com). No spaces allowed.</p>
            ) : (
              <p className="text-slate-500 text-xs text-right">{charCount} / {maxLength} characters</p>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            <Label className="text-white font-medium">Your Message</Label>
            <textarea
              value={content}
              onChange={(e) => {
                if (e.target.value.length <= maxLength) {
                  onContentChange(e.target.value);
                }
              }}
              placeholder="Enter your message here..."
              className="w-full h-40 bg-slate-700 border border-slate-600 text-white rounded-lg p-3 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
              data-testid="input-qr-basic-text"
            />
            <p className={`text-xs text-right ${charCount > maxLength * 0.9 ? 'text-amber-400' : 'text-slate-500'}`}>
              {charCount} / {maxLength} characters
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// QR Basic Step 3: Show mockup
function QRBasicMockupStep({
  mockupUrl,
  isLoading,
  selectedColor,
  selectedSize,
  inputType,
  content
}: {
  mockupUrl: string;
  isLoading: boolean;
  selectedColor: string;
  selectedSize: string;
  inputType: QRBasicInputType;
  content: string;
}) {
  const colorName = SHIRT_COLORS.find(c => c.id === selectedColor)?.name || selectedColor;
  
  return (
    <div className="text-center space-y-6">
      <div>
        <h2 className="text-lg font-bold text-white mb-2">Your QR Shirt Preview</h2>
        <p className="text-slate-400">Here's how your shirt will look!</p>
      </div>
      
      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-12">
          <Loader2 className="w-12 h-12 animate-spin text-blue-400 mb-4" />
          <p className="text-slate-400">Generating your preview...</p>
        </div>
      ) : mockupUrl ? (
        <div className="max-w-sm mx-auto">
          <img 
            src={mockupUrl} 
            alt="Shirt mockup preview" 
            className="w-full rounded-xl shadow-lg border border-slate-700"
          />
          <div className="mt-4 flex items-center justify-center gap-4 text-sm text-slate-400">
            <span className="bg-slate-700 px-3 py-1 rounded-full">{colorName}</span>
            <span className="bg-slate-700 px-3 py-1 rounded-full">Size {selectedSize}</span>
          </div>
        </div>
      ) : (
        <div className="max-w-sm mx-auto bg-slate-800 rounded-xl p-8 border border-slate-700">
          <div className="w-32 h-40 mx-auto bg-slate-700 rounded-lg flex items-center justify-center mb-4">
            <QrCode className="w-12 h-12 text-slate-500" />
          </div>
          <p className="text-slate-400 text-sm">
            {inputType === 'url' ? 'QR links to: ' : 'QR contains: '}
            <span className="text-white font-medium">
              {content.length > 50 ? content.substring(0, 50) + '...' : content}
            </span>
          </p>
        </div>
      )}
    </div>
  );
}

// QR Basic Step 4: Save to library prompt
function QRBasicSaveChoiceStep({
  selected,
  onSelect
}: {
  selected: QRBasicSaveOption;
  onSelect: (choice: QRBasicSaveOption) => void;
}) {
  const options: { id: QRBasicSaveOption; label: string; description: string; icon: React.ReactNode }[] = [
    { id: 'item', label: 'Save Item Only', description: 'Save the shirt design to your library', icon: <ShoppingBag className="w-8 h-8" /> },
    { id: 'graphic', label: 'Save Graphic Only', description: 'Save just the QR code graphic', icon: <QrCode className="w-8 h-8" /> },
    { id: 'both', label: 'Save Both', description: 'Save the shirt and the graphic separately', icon: <Library className="w-8 h-8" /> },
  ];
  
  return (
    <div className="text-center space-y-6">
      <div>
        <h2 className="text-lg font-bold text-white mb-2">What would you like to save?</h2>
        <p className="text-slate-400">Choose what to keep in your library</p>
      </div>
      
      <div className="grid gap-4 max-w-md mx-auto">
        {options.map((option) => (
          <button
            key={option.id}
            onClick={() => onSelect(option.id)}
            className={`p-4 rounded-xl border-2 transition-all text-left flex items-center gap-4 ${
              selected === option.id
                ? 'border-green-500 bg-green-500/10'
                : 'border-slate-600 bg-slate-800/50 hover:border-slate-500'
            }`}
            data-testid={`button-save-${option.id}`}
          >
            <div className={`w-14 h-14 rounded-full flex items-center justify-center ${
              selected === option.id ? 'bg-green-500 text-white' : 'bg-slate-700 text-slate-300'
            }`}>
              {option.icon}
            </div>
            <div>
              <div className="font-semibold text-white">{option.label}</div>
              <div className="text-sm text-slate-400">{option.description}</div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

// QR Basic Step 5: Confirmation based on save choice
function QRBasicConfirmStep({
  saveChoice,
  mockupUrl,
  qrContent,
  isSaving,
  onDone
}: {
  saveChoice: QRBasicSaveOption;
  mockupUrl: string | null;
  qrContent: string;
  isSaving: boolean;
  onDone: () => void;
}) {
  const getMessage = () => {
    switch (saveChoice) {
      case 'item':
        return { title: 'Item Saved!', description: 'Your shirt design has been saved to your library.' };
      case 'graphic':
        return { title: 'Graphic Saved!', description: 'Your QR code graphic has been saved to your library.' };
      case 'both':
        return { title: 'Both Saved!', description: 'Your shirt design and QR graphic have been saved to your library.' };
      default:
        return { title: 'Saved!', description: 'Your design has been saved.' };
    }
  };
  
  const message = getMessage();
  
  return (
    <div className="text-center space-y-6">
      <div>
        <div className="w-20 h-20 mx-auto bg-green-500 rounded-full flex items-center justify-center mb-4">
          <Check className="w-10 h-10 text-white" />
        </div>
        <h2 className="text-lg font-bold text-white mb-2">{message.title}</h2>
        <p className="text-slate-400">{message.description}</p>
      </div>
      
      {/* Show what was saved */}
      <div className="flex flex-wrap justify-center gap-4 max-w-md mx-auto">
        {(saveChoice === 'item' || saveChoice === 'both') && mockupUrl && (
          <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
            <img src={mockupUrl} alt="Saved item" className="w-32 h-32 object-contain mx-auto mb-2" />
            <p className="text-sm text-slate-400">Shirt Design</p>
          </div>
        )}
        {(saveChoice === 'graphic' || saveChoice === 'both') && (
          <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
            <img 
              src={`https://api.qrserver.com/v1/create-qr-code/?size=128x128&data=${encodeURIComponent(qrContent)}`} 
              alt="QR Code" 
              className="w-32 h-32 object-contain mx-auto mb-2 bg-white rounded"
            />
            <p className="text-sm text-slate-400">QR Graphic</p>
          </div>
        )}
      </div>
      
      <Button
        onClick={onDone}
        disabled={isSaving}
        className="px-8 py-4 bg-green-600 hover:bg-green-700 text-lg"
        data-testid="button-qr-basic-done"
      >
        {isSaving ? <Loader2 className="w-5 h-5 mr-2 animate-spin" /> : null}
        Done
      </Button>
    </div>
  );
}

// QR Plus Step 1: Mockup Preview (shows productGraphic on shirt)
function QRPlusMockupStep({
  mockupUrl,
  isLoading,
  selectedColor,
  selectedSize,
  headerText,
  footerText
}: {
  mockupUrl: string;
  isLoading: boolean;
  selectedColor: string;
  selectedSize: string;
  headerText?: string;
  footerText?: string;
}) {
  const colorName = SHIRT_COLORS.find(c => c.id === selectedColor)?.name || selectedColor;
  
  // Debug: Log what we received
  console.log('[QRPlusMockupStep] Rendering with:', { 
    mockupUrl: mockupUrl?.substring(0, 60) || 'EMPTY', 
    isLoading, 
    selectedColor 
  });
  
  return (
    <div className="text-center space-y-6">
      <div>
        <h2 className="text-lg font-bold text-white mb-2">Your QR Plus Preview</h2>
        <p className="text-slate-400">Here's your shirt with the full graphic!</p>
      </div>
      
      {/* Debug info */}
      <div className="text-xs text-slate-500">
        Loading: {isLoading ? 'Yes' : 'No'} | URL: {mockupUrl ? mockupUrl.substring(0, 40) + '...' : 'None'}
      </div>
      
      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-12">
          <Loader2 className="w-12 h-12 animate-spin text-blue-400 mb-4" />
          <p className="text-slate-400">Generating your preview...</p>
        </div>
      ) : mockupUrl ? (
        <div className="max-w-sm mx-auto">
          <img 
            src={mockupUrl} 
            alt="Shirt mockup preview" 
            className="w-full rounded-xl shadow-lg border border-slate-700"
            onError={(e) => console.error('[QRPlusMockupStep] Image failed to load:', mockupUrl)}
          />
          <div className="mt-4 flex items-center justify-center gap-4 text-sm text-slate-400">
            <span className="bg-slate-700 px-3 py-1 rounded-full">{colorName}</span>
            <span className="bg-slate-700 px-3 py-1 rounded-full">Size {selectedSize}</span>
          </div>
          {(headerText || footerText) && (
            <div className="mt-3 text-sm text-slate-500">
              {headerText && <p>Header: {headerText}</p>}
              {footerText && <p>Footer: {footerText}</p>}
            </div>
          )}
        </div>
      ) : (
        <div className="max-w-sm mx-auto bg-slate-800 rounded-xl p-8 border border-slate-700">
          <div className="w-32 h-40 mx-auto bg-slate-700 rounded-lg flex items-center justify-center mb-4">
            <Type className="w-12 h-12 text-slate-500" />
          </div>
          <p className="text-slate-400 text-sm">No mockup available</p>
        </div>
      )}
    </div>
  );
}

// QR Plus Step 2: Save to library prompt (reuses same options as QR Basic)
function QRPlusSaveChoiceStep({
  selected,
  onSelect
}: {
  selected: QRPlusSaveOption;
  onSelect: (choice: QRPlusSaveOption) => void;
}) {
  const options: { id: QRPlusSaveOption; label: string; description: string; icon: React.ReactNode }[] = [
    { id: 'item', label: 'Save Item Only', description: 'Save the shirt design to your library', icon: <ShoppingBag className="w-8 h-8" /> },
    { id: 'graphic', label: 'Save Graphic Only', description: 'Save the graphic (with text) to reuse', icon: <Type className="w-8 h-8" /> },
    { id: 'both', label: 'Save Both', description: 'Save the shirt and the graphic separately', icon: <Library className="w-8 h-8" /> },
  ];
  
  return (
    <div className="text-center space-y-6">
      <div>
        <h2 className="text-lg font-bold text-white mb-2">What would you like to save?</h2>
        <p className="text-slate-400">Choose what to keep in your library</p>
      </div>
      
      <div className="grid gap-4 max-w-md mx-auto">
        {options.map((option) => (
          <button
            key={option.id}
            onClick={() => onSelect(option.id)}
            className={`p-4 rounded-xl border-2 transition-all text-left flex items-center gap-4 ${
              selected === option.id
                ? 'border-green-500 bg-green-500/10'
                : 'border-slate-600 bg-slate-800/50 hover:border-slate-500'
            }`}
            data-testid={`button-qr-plus-save-${option.id}`}
          >
            <div className={`w-14 h-14 rounded-full flex items-center justify-center ${
              selected === option.id ? 'bg-green-500 text-white' : 'bg-slate-700 text-slate-300'
            }`}>
              {option.icon}
            </div>
            <div>
              <div className="font-semibold text-white">{option.label}</div>
              <div className="text-sm text-slate-400">{option.description}</div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

// QR Plus Step 3: Confirmation based on save choice
function QRPlusConfirmStep({
  saveChoice,
  mockupUrl,
  productGraphicUrl,
  qrGraphicUrl,
  isSaving,
  onDone
}: {
  saveChoice: QRPlusSaveOption;
  mockupUrl: string | null;
  productGraphicUrl: string | null;
  qrGraphicUrl: string | null;
  isSaving: boolean;
  onDone: () => void;
}) {
  return (
    <div className="text-center space-y-6">
      <div>
        <div className="w-20 h-20 mx-auto bg-green-500 rounded-full flex items-center justify-center mb-4">
          <Check className="w-10 h-10 text-white" />
        </div>
        <h2 className="text-lg font-bold text-white mb-2">Saved!</h2>
        <p className="text-slate-400">Your QR Plus design has been saved to your library.</p>
      </div>
      
      {/* Always show all saved assets */}
      <div className="flex flex-wrap justify-center gap-4 max-w-md mx-auto">
        {mockupUrl && (
          <div className="bg-slate-800 rounded-xl p-3 border border-slate-700">
            <img src={mockupUrl} alt="Shirt mockup" className="w-28 h-28 object-contain mx-auto mb-2" />
            <p className="text-xs text-slate-400">Shirt Mockup</p>
          </div>
        )}
        {productGraphicUrl && (
          <div className="bg-slate-800 rounded-xl p-3 border border-slate-700">
            <img src={productGraphicUrl} alt="Product graphic" className="w-28 h-28 object-contain mx-auto mb-2" />
            <p className="text-xs text-slate-400">Product Graphic</p>
          </div>
        )}
        {qrGraphicUrl && (
          <div className="bg-slate-800 rounded-xl p-3 border border-slate-700">
            <img src={qrGraphicUrl} alt="QR code" className="w-28 h-28 object-contain mx-auto mb-2" />
            <p className="text-xs text-slate-400">QR Code</p>
          </div>
        )}
      </div>
      
      {/* Debug: Show what was saved */}
      <div className="text-xs text-slate-500 space-y-1">
        <p>Mockup: {mockupUrl ? '✓' : '✗'}</p>
        <p>Graphic: {productGraphicUrl ? '✓' : '✗'}</p>
        <p>QR Code: {qrGraphicUrl ? '✓' : '✗'}</p>
      </div>
      
      <Button
        onClick={onDone}
        disabled={isSaving}
        className="px-8 py-4 bg-green-600 hover:bg-green-700 text-lg"
        data-testid="button-qr-plus-done"
      >
        {isSaving ? <Loader2 className="w-5 h-5 mr-2 animate-spin" /> : null}
        Done
      </Button>
    </div>
  );
}

// Step 9: Placement Count - select multiple graphic placements
function PlacementCountStep({
  selected,
  onToggle,
  selectedColor,
  placementEarningsBonus = 1.00,
  productPlacements
}: {
  selected: PlacementOption[];
  onToggle: (placement: PlacementOption) => void;
  selectedColor: string;
  placementEarningsBonus?: number;
  productPlacements?: { id: string; title: string; widthPx?: number; heightPx?: number; widthInches?: string; heightInches?: string }[];
}) {
  const colorHex = SHIRT_COLORS.find(c => c.id === selectedColor)?.hex || '#1a1a1a';
  
  // Show only placements that are actually available for this specific product from Printify
  // Fall back to defaults only if no product-specific placements available
  const displayPlacements = productPlacements && productPlacements.length > 0
    ? productPlacements.map(p => ({
        id: p.id as PlacementOption,
        label: p.title,
        description: 'Print area',
        sizeLabel: p.widthInches && p.heightInches ? `${p.widthInches}×${p.heightInches}` : '',
      }))
    : PLACEMENT_OPTIONS;
  
  // Positions on SVG for each Printify placement - TRUE TO RATIO
  // Sleeve positions adjusted to be on actual sleeve areas of the shirt SVG
  const placementPositions: Record<string, { x: number; y: number; size: number }> = {
    'front': { x: 90, y: 100, size: 24 },
    'left_chest': { x: 70, y: 75, size: 8 },
    'back': { x: 90, y: 100, size: 24 },
    'sleeve_left': { x: 44, y: 52, size: 10 },
    'sleeve_right': { x: 136, y: 52, size: 10 },
  };
  
  return (
    <div className="space-y-4">
      <div className="text-center">
        <h2 className="text-xl font-bold text-white mb-1">Where Do You Want Graphics?</h2>
        <p className="text-slate-400 text-sm">Each extra placement adds +${placementEarningsBonus.toFixed(2)} to your earnings</p>
      </div>
      
      {/* Shirt preview with counter */}
      <div className="flex justify-center items-center gap-4 py-2">
        <svg width="180" height="200" viewBox="0 0 180 180" className="drop-shadow-lg">
          <path
            d="M30,52 L52,30 L75,37 L90,30 L105,37 L128,30 L150,52 L142,82 L127,75 L127,180 L53,180 L53,75 L38,82 Z"
            fill={colorHex}
            stroke="#444"
            strokeWidth="2"
          />
          
          {/* Show selected placements - back is larger */}
          {selected.map(placement => {
            const pos = placementPositions[placement];
            if (!pos) return null;
            // Make back graphic larger to distinguish from front
            const displaySize = placement === 'back' ? pos.size * 1.3 : pos.size;
            return (
              <g key={placement} transform={`translate(${pos.x - displaySize/2}, ${pos.y - displaySize/2})`}>
                <rect width={displaySize} height={displaySize} fill="white" rx="2" opacity="0.95" stroke="#22c55e" strokeWidth="2" />
                <rect x="2" y="2" width={displaySize * 0.2} height={displaySize * 0.2} fill="#22c55e" />
                <rect x={displaySize - displaySize * 0.2 - 2} y="2" width={displaySize * 0.2} height={displaySize * 0.2} fill="#22c55e" />
                <rect x="2" y={displaySize - displaySize * 0.2 - 2} width={displaySize * 0.2} height={displaySize * 0.2} fill="#22c55e" />
                {placement === 'back' && (
                  <text x={displaySize/2} y={displaySize/2 + 4} textAnchor="middle" fontSize="8" fill="#22c55e" fontWeight="bold">BACK</text>
                )}
              </g>
            );
          })}
        </svg>
        
        {/* Counter badge */}
        <div className="flex flex-col items-center">
          <div className={`w-16 h-16 rounded-full flex items-center justify-center text-2xl font-bold transition-all ${
            selected.length > 0 
              ? 'bg-green-500 text-white' 
              : 'bg-slate-700 text-slate-400'
          }`}>
            {selected.length}
          </div>
          <p className="text-slate-400 text-xs mt-1">selected</p>
        </div>
      </div>
      
      {/* Placement options - uses actual product placements if available */}
      <div className="grid grid-cols-2 gap-2">
        {displayPlacements.map((option) => {
          const isSelected = selected.includes(option.id as PlacementOption);
          return (
            <button
              key={option.id}
              onClick={() => onToggle(option.id as PlacementOption)}
              className={`p-3 rounded-lg border-2 text-left transition-all ${
                isSelected
                  ? 'border-green-500 bg-green-500/20'
                  : 'border-slate-600 bg-slate-800/50 hover:border-slate-400'
              }`}
              data-testid={`button-placement-${option.id}`}
            >
              <div className="flex items-center gap-2">
                <div className={`w-4 h-4 rounded border-2 flex items-center justify-center ${
                  isSelected ? 'border-green-500 bg-green-500' : 'border-slate-500'
                }`}>
                  {isSelected && <Check className="w-3 h-3 text-white" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-0.5 sm:gap-2">
                    <p className={`font-medium text-sm ${isSelected ? 'text-green-400' : 'text-white'}`}>
                      {option.label}
                    </p>
                    {option.sizeLabel && (
                      <span className="text-[10px] text-slate-400 bg-slate-700 px-1 py-0.5 rounded w-fit whitespace-nowrap">{option.sizeLabel}</span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500">{option.description}</p>
                </div>
              </div>
            </button>
          );
        })}
      </div>
      
      <p className="text-center text-slate-500 text-xs">
        {selected.length === 0 ? 'Select at least one placement' : `${selected.length} placement${selected.length > 1 ? 's' : ''} selected`}
      </p>
    </div>
  );
}

// Step 10: Text Edit - shows graphic outline with QR in center, text above/below
function ShirtTextEditStep({
  layout,
  selectedColor,
  graphicLocation,
  graphicSize,
  headerStyle,
  footerStyle,
  onHeaderChange,
  onFooterChange
}: {
  layout: TextLayoutChoice;
  selectedColor: string;
  graphicLocation: GraphicLocation;
  graphicSize: GraphicSize;
  headerStyle: TextStyleConfig;
  footerStyle: TextStyleConfig;
  onHeaderChange: (style: TextStyleConfig) => void;
  onFooterChange: (style: TextStyleConfig) => void;
}) {
  const colorHex = SHIRT_COLORS.find(c => c.id === selectedColor)?.hex || '#1a1a1a';
  const showHeader = layout === 'header' || layout === 'both';
  const showFooter = layout === 'footer' || layout === 'both';
  
  // Graphic outline sizes calculated from Printify specs
  // SVG shirt body: 74px wide = 20" real shirt. Scale: 3.7 px/inch
  // Small: 6"x8" = 22x30px, Medium: 9"x12" = 33x44px, Large: 11"x14" = 41x52px
  const getOutlineSize = () => {
    const sizeKey = graphicSize || 'medium';
    const sizes: Record<string, { w: number; h: number }> = { 
      small: { w: 22, h: 30 }, 
      medium: { w: 33, h: 44 }, 
      large: { w: 41, h: 52 } 
    };
    return sizes[sizeKey] || sizes.medium;
  };
  
  const outlineSize = getOutlineSize();
  const isLeftChest = graphicLocation === 'left-chest';
  // Calculated from Printify specs: left chest 3" below shoulder, 3.5" from center
  // Front center: 3.5" below collar, centered at y=79 for medium print
  const graphicX = isLeftChest ? 77 : 90;
  const graphicY = isLeftChest ? 68 : 79;
  
  const updateHeader = (updates: Partial<TextStyleConfig>) => {
    onHeaderChange({ ...headerStyle, ...updates, enabled: true });
  };
  
  const updateFooter = (updates: Partial<TextStyleConfig>) => {
    onFooterChange({ ...footerStyle, ...updates, enabled: true });
  };
  
  // Get font size for SVG based on selected size
  const getSvgFontSize = (fontSize?: string, isSmallArea?: boolean) => {
    const base = isSmallArea ? 4 : 7;
    if (fontSize === '12px') return base * 0.8;
    if (fontSize === '24px') return base * 1.4;
    return base;
  };

  // Position offset state for slider
  const [headerOffset, setHeaderOffset] = useState(0);
  const [footerOffset, setFooterOffset] = useState(0);
  
  return (
    <div className="space-y-4">
      <div className="text-center">
        <h2 className="text-xl font-bold text-white mb-1">Add Your Text</h2>
        <p className="text-slate-400 text-sm">Text stays inside your graphic area</p>
      </div>
      
      {/* Header controls */}
      {showHeader && (
        <div className="bg-slate-800/50 rounded-lg p-3 space-y-2">
          <div>
            <Label className="text-white font-bold text-sm">Header Text</Label>
            <p className="text-slate-500 text-xs">Top of graphic</p>
          </div>
          <Input
            value={headerStyle.text}
            onChange={(e) => updateHeader({ text: e.target.value })}
            placeholder="Enter header text..."
            className="bg-slate-700 border-slate-600 text-white h-9"
            data-testid="input-header-text"
          />
          <div className="flex flex-wrap gap-3">
            <div className="flex items-center gap-1">
              <span className="text-xs text-slate-500">Color:</span>
              {SHIRT_TEXT_COLORS.map((color) => (
                <button
                  key={color}
                  onClick={() => updateHeader({ color })}
                  className={`w-5 h-5 rounded-full border-2 transition-all ${
                    headerStyle.color === color ? 'border-white scale-110' : 'border-slate-600'
                  }`}
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>
            <div className="flex items-center gap-1">
              <span className="text-xs text-slate-500">Size:</span>
              {SHIRT_TEXT_SIZES.map((size) => (
                <Button
                  key={size.id}
                  size="sm"
                  variant={headerStyle.fontSize === size.value ? 'default' : 'outline'}
                  onClick={() => updateHeader({ fontSize: size.value })}
                  className="h-5 px-2 text-xs"
                >
                  {size.label}
                </Button>
              ))}
            </div>
            <div className="flex items-center gap-1">
              <span className="text-xs text-slate-500">Font:</span>
              {SHIRT_TEXT_FONTS.map((font) => (
                <Button
                  key={font.id}
                  size="sm"
                  variant={headerStyle.fontFamily === font.family ? 'default' : 'outline'}
                  onClick={() => updateHeader({ fontFamily: font.family })}
                  style={{ fontFamily: font.family }}
                  className="h-5 px-2 text-xs"
                >
                  {font.label}
                </Button>
              ))}
            </div>
          </div>
          {/* Position slider for header - moves within graphic */}
          <div className="flex items-center gap-2 pt-1">
            <span className="text-xs text-slate-500">Position:</span>
            <input
              type="range"
              min="-8"
              max="8"
              value={headerOffset}
              onChange={(e) => setHeaderOffset(Number(e.target.value))}
              className="flex-1 h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer"
              data-testid="slider-header-position"
            />
            <span className="text-xs text-slate-400 w-8">{headerOffset > 0 ? `+${headerOffset}` : headerOffset}</span>
          </div>
        </div>
      )}
      
      {/* Shirt with graphic and text preview - zoomed in on print area */}
      <div className="flex justify-center py-1">
        <svg 
          width="280" 
          height="220" 
          viewBox={isLeftChest ? "40 25 80 90" : "45 25 90 100"} 
          className="drop-shadow-xl"
        >
          <path
            d="M30,52 L52,30 L75,37 L90,30 L105,37 L128,30 L150,52 L142,82 L127,75 L127,180 L53,180 L53,75 L38,82 Z"
            fill={colorHex}
            stroke="#444"
            strokeWidth="1"
          />
          
          {/* Graphic outline on shirt */}
          <rect
            x={graphicX - outlineSize.w/2}
            y={graphicY - outlineSize.h/2}
            width={outlineSize.w}
            height={outlineSize.h}
            fill="transparent"
            stroke="#64748b"
            strokeWidth="1"
            strokeDasharray="4 2"
            rx="3"
          />
          
          {/* Header text - at TOP inside the graphic */}
          {showHeader && (
            <text
              x={graphicX}
              y={graphicY - outlineSize.h/2 + 8 + headerOffset}
              textAnchor="middle"
              fill={headerStyle.color || '#fff'}
              fontSize={getSvgFontSize(headerStyle.fontSize, isLeftChest)}
              fontFamily={headerStyle.fontFamily || 'Arial'}
              fontWeight="bold"
            >
              {headerStyle.text?.substring(0, 15) || 'Header'}
            </text>
          )}
          
          {/* QR code in center - smaller, with blank QR pattern */}
          <g transform={`translate(${graphicX - (isLeftChest ? 5 : 8)}, ${graphicY - (isLeftChest ? 5 : 8)})`}>
            <rect width={isLeftChest ? 10 : 16} height={isLeftChest ? 10 : 16} fill="white" rx="1" />
            {/* Simple QR pattern */}
            <rect x="1" y="1" width={isLeftChest ? 2 : 3} height={isLeftChest ? 2 : 3} fill="#333" />
            <rect x={isLeftChest ? 7 : 12} y="1" width={isLeftChest ? 2 : 3} height={isLeftChest ? 2 : 3} fill="#333" />
            <rect x="1" y={isLeftChest ? 7 : 12} width={isLeftChest ? 2 : 3} height={isLeftChest ? 2 : 3} fill="#333" />
            <rect x={isLeftChest ? 4 : 6} y={isLeftChest ? 4 : 6} width={isLeftChest ? 2 : 4} height={isLeftChest ? 2 : 4} fill="#333" />
          </g>
          
          {/* Footer text - at BOTTOM inside the graphic */}
          {showFooter && (
            <text
              x={graphicX}
              y={graphicY + outlineSize.h/2 - 3 + footerOffset}
              textAnchor="middle"
              fill={footerStyle.color || '#fff'}
              fontSize={getSvgFontSize(footerStyle.fontSize, isLeftChest)}
              fontFamily={footerStyle.fontFamily || 'Arial'}
              fontWeight="bold"
            >
              {footerStyle.text?.substring(0, 15) || 'Footer'}
            </text>
          )}
        </svg>
      </div>
      
      {/* Footer controls */}
      {showFooter && (
        <div className="bg-slate-800/50 rounded-lg p-3 space-y-2">
          <div>
            <Label className="text-white font-bold text-sm">Footer Text</Label>
            <p className="text-slate-500 text-xs">Bottom of graphic</p>
          </div>
          <Input
            value={footerStyle.text}
            onChange={(e) => updateFooter({ text: e.target.value })}
            placeholder="Enter footer text..."
            className="bg-slate-700 border-slate-600 text-white h-9"
            data-testid="input-footer-text"
          />
          <div className="flex flex-wrap gap-3">
            <div className="flex items-center gap-1">
              <span className="text-xs text-slate-500">Color:</span>
              {SHIRT_TEXT_COLORS.map((color) => (
                <button
                  key={color}
                  onClick={() => updateFooter({ color })}
                  className={`w-5 h-5 rounded-full border-2 transition-all ${
                    footerStyle.color === color ? 'border-white scale-110' : 'border-slate-600'
                  }`}
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>
            <div className="flex items-center gap-1">
              <span className="text-xs text-slate-500">Size:</span>
              {SHIRT_TEXT_SIZES.map((size) => (
                <Button
                  key={size.id}
                  size="sm"
                  variant={footerStyle.fontSize === size.value ? 'default' : 'outline'}
                  onClick={() => updateFooter({ fontSize: size.value })}
                  className="h-5 px-2 text-xs"
                >
                  {size.label}
                </Button>
              ))}
            </div>
            <div className="flex items-center gap-1">
              <span className="text-xs text-slate-500">Font:</span>
              {SHIRT_TEXT_FONTS.map((font) => (
                <Button
                  key={font.id}
                  size="sm"
                  variant={footerStyle.fontFamily === font.family ? 'default' : 'outline'}
                  onClick={() => updateFooter({ fontFamily: font.family })}
                  style={{ fontFamily: font.family }}
                  className="h-5 px-2 text-xs"
                >
                  {font.label}
                </Button>
              ))}
            </div>
          </div>
          {/* Position slider for footer - moves within graphic */}
          <div className="flex items-center gap-2 pt-1">
            <span className="text-xs text-slate-500">Position:</span>
            <input
              type="range"
              min="-8"
              max="8"
              value={footerOffset}
              onChange={(e) => setFooterOffset(Number(e.target.value))}
              className="flex-1 h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer"
              data-testid="slider-footer-position"
            />
            <span className="text-xs text-slate-400 w-8">{footerOffset > 0 ? `+${footerOffset}` : footerOffset}</span>
          </div>
        </div>
      )}
    </div>
  );
}

// Placement visual diagrams - shows WHERE on shirt the placement goes
function PlacementDiagram({ placement, size }: { placement: PlacementOption; size: GraphicSize }) {
  // Size multipliers for the print area indicator
  const sizeScale = size === 'small' ? 0.7 : size === 'large' ? 1.2 : 1;
  
  // Front view of t-shirt
  const FrontShirt = ({ highlight }: { highlight: 'center' | 'left-chest' | null }) => (
    <svg viewBox="0 0 120 140" className="w-full h-full">
      {/* Shirt body */}
      <path 
        d="M20,45 L10,55 L10,135 L110,135 L110,55 L100,45 L85,45 L75,25 C70,20 50,20 45,25 L35,45 Z" 
        fill="#374151" 
        stroke="#4b5563" 
        strokeWidth="1.5"
      />
      {/* Left sleeve */}
      <path 
        d="M20,45 L5,60 L5,80 L20,75 L20,45" 
        fill="#374151" 
        stroke="#4b5563" 
        strokeWidth="1.5"
      />
      {/* Right sleeve */}
      <path 
        d="M100,45 L115,60 L115,80 L100,75 L100,45" 
        fill="#374151" 
        stroke="#4b5563" 
        strokeWidth="1.5"
      />
      {/* Collar */}
      <ellipse cx="60" cy="28" rx="15" ry="8" fill="#1f2937" stroke="#4b5563" strokeWidth="1"/>
      
      {/* Print area highlight - center */}
      {highlight === 'center' && (
        <g>
          <rect 
            x={60 - 20 * sizeScale} 
            y={55} 
            width={40 * sizeScale} 
            height={50 * sizeScale} 
            fill="rgba(74, 222, 128, 0.3)" 
            stroke="#4ade80" 
            strokeWidth="2" 
            strokeDasharray="4,2"
            rx="3"
          />
          <circle cx="60" cy={55 + 25 * sizeScale} r="12" fill="rgba(255,255,255,0.2)" stroke="white" strokeWidth="1.5"/>
        </g>
      )}
      
      {/* Print area highlight - left chest */}
      {highlight === 'left-chest' && (
        <g>
          <rect 
            x={28} 
            y={50} 
            width={22 * sizeScale} 
            height={22 * sizeScale} 
            fill="rgba(74, 222, 128, 0.3)" 
            stroke="#4ade80" 
            strokeWidth="2" 
            strokeDasharray="4,2"
            rx="2"
          />
          <circle cx={39} cy={50 + 11 * sizeScale} r="6" fill="rgba(255,255,255,0.2)" stroke="white" strokeWidth="1.5"/>
        </g>
      )}
    </svg>
  );
  
  // Back view of t-shirt
  const BackShirt = () => (
    <svg viewBox="0 0 120 140" className="w-full h-full">
      {/* Shirt body */}
      <path 
        d="M20,45 L10,55 L10,135 L110,135 L110,55 L100,45 L85,45 L75,30 C70,25 50,25 45,30 L35,45 Z" 
        fill="#374151" 
        stroke="#4b5563" 
        strokeWidth="1.5"
      />
      {/* Left sleeve */}
      <path 
        d="M20,45 L5,60 L5,80 L20,75 L20,45" 
        fill="#374151" 
        stroke="#4b5563" 
        strokeWidth="1.5"
      />
      {/* Right sleeve */}
      <path 
        d="M100,45 L115,60 L115,80 L100,75 L100,45" 
        fill="#374151" 
        stroke="#4b5563" 
        strokeWidth="1.5"
      />
      {/* Back neck seam */}
      <path d="M45,30 Q60,35 75,30" fill="none" stroke="#4b5563" strokeWidth="1.5"/>
      
      {/* Print area highlight - back center */}
      <rect 
        x={60 - 20 * sizeScale} 
        y={50} 
        width={40 * sizeScale} 
        height={50 * sizeScale} 
        fill="rgba(74, 222, 128, 0.3)" 
        stroke="#4ade80" 
        strokeWidth="2" 
        strokeDasharray="4,2"
        rx="3"
      />
      <circle cx="60" cy={50 + 25 * sizeScale} r="12" fill="rgba(255,255,255,0.2)" stroke="white" strokeWidth="1.5"/>
      
      {/* "BACK" label */}
      <text x="60" y="130" textAnchor="middle" fill="#9ca3af" fontSize="8" fontWeight="bold">BACK</text>
    </svg>
  );
  
  // Side view for left sleeve - viewing from left side
  const LeftSleeveView = () => (
    <svg viewBox="0 0 120 140" className="w-full h-full">
      {/* Torso side profile */}
      <path 
        d="M70,45 L70,135 L90,135 L90,45 Q80,35 70,45" 
        fill="#374151" 
        stroke="#4b5563" 
        strokeWidth="1.5"
      />
      {/* Left arm/sleeve extending toward viewer */}
      <path 
        d="M70,48 L25,58 L20,80 L25,82 L70,72" 
        fill="#374151" 
        stroke="#4b5563" 
        strokeWidth="1.5"
      />
      {/* Shoulder curve */}
      <path d="M70,45 Q65,40 70,35 Q80,30 90,35 Q95,40 90,45" fill="#374151" stroke="#4b5563" strokeWidth="1.5"/>
      
      {/* Print area on sleeve */}
      <g transform="rotate(-8, 45, 68)">
        <rect 
          x={35} 
          y={58} 
          width={18 * sizeScale} 
          height={18 * sizeScale} 
          fill="rgba(74, 222, 128, 0.3)" 
          stroke="#4ade80" 
          strokeWidth="2" 
          strokeDasharray="4,2"
          rx="2"
        />
        <circle cx={44} cy={58 + 9 * sizeScale} r="5" fill="rgba(255,255,255,0.2)" stroke="white" strokeWidth="1.5"/>
      </g>
      
      {/* View indicator */}
      <text x="60" y="130" textAnchor="middle" fill="#9ca3af" fontSize="7">LEFT SIDE VIEW</text>
    </svg>
  );
  
  // Side view for right sleeve - viewing from right side
  const RightSleeveView = () => (
    <svg viewBox="0 0 120 140" className="w-full h-full">
      {/* Torso side profile */}
      <path 
        d="M50,45 L50,135 L30,135 L30,45 Q40,35 50,45" 
        fill="#374151" 
        stroke="#4b5563" 
        strokeWidth="1.5"
      />
      {/* Right arm/sleeve extending toward viewer */}
      <path 
        d="M50,48 L95,58 L100,80 L95,82 L50,72" 
        fill="#374151" 
        stroke="#4b5563" 
        strokeWidth="1.5"
      />
      {/* Shoulder curve */}
      <path d="M50,45 Q55,40 50,35 Q40,30 30,35 Q25,40 30,45" fill="#374151" stroke="#4b5563" strokeWidth="1.5"/>
      
      {/* Print area on sleeve */}
      <g transform="rotate(8, 75, 68)">
        <rect 
          x={67} 
          y={58} 
          width={18 * sizeScale} 
          height={18 * sizeScale} 
          fill="rgba(74, 222, 128, 0.3)" 
          stroke="#4ade80" 
          strokeWidth="2" 
          strokeDasharray="4,2"
          rx="2"
        />
        <circle cx={76} cy={58 + 9 * sizeScale} r="5" fill="rgba(255,255,255,0.2)" stroke="white" strokeWidth="1.5"/>
      </g>
      
      {/* View indicator */}
      <text x="60" y="130" textAnchor="middle" fill="#9ca3af" fontSize="7">RIGHT SIDE VIEW</text>
    </svg>
  );
  
  // Render appropriate diagram based on placement
  const renderDiagram = () => {
    switch (placement) {
      case 'front':
        return <FrontShirt highlight="center" />;
      case 'back':
        return <BackShirt />;
      case 'left_chest':
        return <FrontShirt highlight="left-chest" />;
      case 'sleeve_left':
        return <LeftSleeveView />;
      case 'sleeve_right':
        return <RightSleeveView />;
      default:
        return <FrontShirt highlight="center" />;
    }
  };
  
  return (
    <div className="w-32 h-40 mx-auto">
      {renderDiagram()}
    </div>
  );
}

// Step 10: Placement Config - for each placement, choose Full Graphic or QR Only + Size
function PlacementConfigStep({
  currentPlacement,
  currentIndex,
  totalPlacements,
  graphicChoice,
  onGraphicChoiceChange,
  headerStyle,
  footerStyle,
  textLayoutChoice
}: {
  currentPlacement: PlacementOption;
  currentIndex: number;
  totalPlacements: number;
  graphicChoice: PlacementGraphicChoice;
  onGraphicChoiceChange: (choice: PlacementGraphicChoice) => void;
  headerStyle: TextStyleConfig;
  footerStyle: TextStyleConfig;
  textLayoutChoice: TextLayoutChoice;
}) {
  const placementLabel = PLACEMENT_OPTIONS.find(p => p.id === currentPlacement)?.label || currentPlacement;
  const showHeader = textLayoutChoice === 'header' || textLayoutChoice === 'both';
  const showFooter = textLayoutChoice === 'footer' || textLayoutChoice === 'both';
  
  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="text-center">
        <h2 className="text-xl font-bold text-white mb-1">Configure {placementLabel}</h2>
        {totalPlacements > 1 && (
          <p className="text-slate-400 text-sm">Placement {currentIndex + 1} of {totalPlacements}</p>
        )}
      </div>
      
      {/* Visual placement diagram */}
      <div className="flex justify-center">
        <PlacementDiagram placement={currentPlacement} size="medium" />
      </div>
      
      {/* Choice: Full Graphic or QR Only */}
      <div className="space-y-3">
        <p className="text-sm text-slate-300 text-center">What do you want on this placement?</p>
        <div className="grid grid-cols-2 gap-3 max-w-md mx-auto">
          <button
            onClick={() => onGraphicChoiceChange('full')}
            className={`p-4 rounded-xl border-2 transition-all ${
              graphicChoice === 'full'
                ? 'border-green-400 bg-green-500/20 shadow-lg shadow-green-500/20'
                : 'border-slate-600 bg-slate-800/50 hover:border-slate-500'
            }`}
            data-testid="button-full-graphic"
          >
            <div className="flex flex-col items-center gap-2">
              <div className="w-16 h-20 bg-slate-700 rounded-lg flex flex-col items-center justify-center gap-1 p-1">
                {showHeader && <div className="w-10 h-2 bg-white/60 rounded-sm" />}
                <QrCode className="w-8 h-8 text-white" />
                {showFooter && <div className="w-10 h-2 bg-white/60 rounded-sm" />}
              </div>
              <span className="font-medium text-white text-sm">Full Graphic</span>
              <span className="text-xs text-slate-400">Header + QR + Footer</span>
            </div>
          </button>
          
          <button
            onClick={() => onGraphicChoiceChange('qr-only')}
            className={`p-4 rounded-xl border-2 transition-all ${
              graphicChoice === 'qr-only'
                ? 'border-green-400 bg-green-500/20 shadow-lg shadow-green-500/20'
                : 'border-slate-600 bg-slate-800/50 hover:border-slate-500'
            }`}
            data-testid="button-qr-only"
          >
            <div className="flex flex-col items-center gap-2">
              <div className="w-16 h-20 bg-slate-700 rounded-lg flex items-center justify-center">
                <QrCode className="w-10 h-10 text-white" />
              </div>
              <span className="font-medium text-white text-sm">QR Only</span>
              <span className="text-xs text-slate-400">Just the QR code</span>
            </div>
          </button>
        </div>
      </div>
      
      </div>
  );
}

// Step 11: Shirt Preview - shows completed graphic on shirt (including sleeve views)
function ShirtPreviewStep({
  selectedColor,
  graphicLocation,
  graphicSize,
  headerStyle,
  footerStyle,
  textLayoutChoice,
  selectedPlacements = []
}: {
  selectedColor: string;
  graphicLocation: GraphicLocation;
  graphicSize: GraphicSize;
  headerStyle: TextStyleConfig;
  footerStyle: TextStyleConfig;
  textLayoutChoice: TextLayoutChoice;
  selectedPlacements?: PlacementOption[];
}) {
  const colorHex = SHIRT_COLORS.find(c => c.id === selectedColor)?.hex || '#1a1a1a';
  const showHeader = textLayoutChoice === 'header' || textLayoutChoice === 'both';
  const showFooter = textLayoutChoice === 'footer' || textLayoutChoice === 'both';
  
  const hasFrontPlacement = selectedPlacements.includes('front') || selectedPlacements.includes('left_chest');
  const hasBackPlacement = selectedPlacements.includes('back');
  const hasLeftSleeve = selectedPlacements.includes('sleeve_left');
  const hasRightSleeve = selectedPlacements.includes('sleeve_right');
  
  const getGraphicDimensions = () => {
    const sizeKey = graphicSize || 'medium';
    const sizes: Record<string, { w: number; h: number }> = {
      small: { w: 22, h: 30 },
      medium: { w: 33, h: 44 },
      large: { w: 41, h: 52 }
    };
    return sizes[sizeKey] || sizes.medium;
  };
  
  const graphicDims = getGraphicDimensions();
  const isLeftChest = graphicLocation === 'left-chest';
  const graphicX = isLeftChest ? 77 : 90;
  const graphicY = isLeftChest ? 68 : 79;
  
  // Front/Back shirt view
  const ShirtFrontBackView = ({ view }: { view: 'front' | 'back' }) => (
    <svg viewBox="0 0 180 210" className="w-full h-full drop-shadow-xl">
      <path
        d="M30,52 L52,30 L75,37 L90,30 L105,37 L128,30 L150,52 L142,82 L127,75 L127,180 L53,180 L53,75 L38,82 Z"
        fill={colorHex}
        stroke="#444"
        strokeWidth="2"
      />
      {view === 'back' && (
        <path d="M75,37 Q90,42 105,37" fill="none" stroke="#444" strokeWidth="1.5"/>
      )}
      
      {/* Graphic area on shirt */}
      <g transform={`translate(${graphicX - graphicDims.w/2}, ${graphicY - graphicDims.h/2})`}>
        {showHeader && (
          <text x={graphicDims.w / 2} y={10} textAnchor="middle" fill={headerStyle.color || '#fff'}
            fontSize={isLeftChest ? 5 : 8} fontFamily={headerStyle.fontFamily || 'Arial'} fontWeight="bold">
            {headerStyle.text?.substring(0, 15) || ''}
          </text>
        )}
        <g transform={`translate(${(graphicDims.w - (isLeftChest ? 8 : 12)) / 2}, ${(graphicDims.h - (isLeftChest ? 8 : 12)) / 2})`}>
          <rect width={isLeftChest ? 8 : 12} height={isLeftChest ? 8 : 12} fill="white" rx="1" />
          <rect x="1" y="1" width={isLeftChest ? 1.5 : 2.5} height={isLeftChest ? 1.5 : 2.5} fill="#333" />
          <rect x={isLeftChest ? 5.5 : 8.5} y="1" width={isLeftChest ? 1.5 : 2.5} height={isLeftChest ? 1.5 : 2.5} fill="#333" />
          <rect x="1" y={isLeftChest ? 5.5 : 8.5} width={isLeftChest ? 1.5 : 2.5} height={isLeftChest ? 1.5 : 2.5} fill="#333" />
          <rect x={isLeftChest ? 3 : 4.5} y={isLeftChest ? 3 : 4.5} width={isLeftChest ? 2 : 3} height={isLeftChest ? 2 : 3} fill="#333" />
        </g>
        {showFooter && (
          <text x={graphicDims.w / 2} y={graphicDims.h - 3} textAnchor="middle" fill={footerStyle.color || '#fff'}
            fontSize={isLeftChest ? 5 : 8} fontFamily={footerStyle.fontFamily || 'Arial'} fontWeight="bold">
            {footerStyle.text?.substring(0, 15) || ''}
          </text>
        )}
      </g>
      <text x="90" y="200" textAnchor="middle" fill="#9ca3af" fontSize="10" fontWeight="bold">
        {view === 'front' ? 'FRONT' : 'BACK'}
      </text>
    </svg>
  );
  
  // Left sleeve side view
  const LeftSleeveView = () => (
    <svg viewBox="0 0 120 160" className="w-full h-full drop-shadow-xl">
      {/* Torso side profile */}
      <path d="M70,50 L70,150 L95,150 L95,50 Q82,38 70,50" fill={colorHex} stroke="#444" strokeWidth="2"/>
      {/* Left arm/sleeve */}
      <path d="M70,52 L20,65 L15,95 L22,98 L70,82" fill={colorHex} stroke="#444" strokeWidth="2"/>
      {/* Shoulder */}
      <path d="M70,50 Q62,42 70,35 Q82,28 95,35 Q103,42 95,50" fill={colorHex} stroke="#444" strokeWidth="2"/>
      {/* QR on sleeve */}
      <g transform="translate(32, 72) rotate(-10)">
        <rect width="16" height="16" fill="white" rx="2"/>
        <rect x="2" y="2" width="4" height="4" fill="#333"/>
        <rect x="10" y="2" width="4" height="4" fill="#333"/>
        <rect x="2" y="10" width="4" height="4" fill="#333"/>
        <rect x="6" y="6" width="4" height="4" fill="#333"/>
      </g>
      <text x="60" y="155" textAnchor="middle" fill="#9ca3af" fontSize="9" fontWeight="bold">LEFT SLEEVE</text>
    </svg>
  );
  
  // Right sleeve side view
  const RightSleeveView = () => (
    <svg viewBox="0 0 120 160" className="w-full h-full drop-shadow-xl">
      {/* Torso side profile */}
      <path d="M50,50 L50,150 L25,150 L25,50 Q38,38 50,50" fill={colorHex} stroke="#444" strokeWidth="2"/>
      {/* Right arm/sleeve */}
      <path d="M50,52 L100,65 L105,95 L98,98 L50,82" fill={colorHex} stroke="#444" strokeWidth="2"/>
      {/* Shoulder */}
      <path d="M50,50 Q58,42 50,35 Q38,28 25,35 Q17,42 25,50" fill={colorHex} stroke="#444" strokeWidth="2"/>
      {/* QR on sleeve */}
      <g transform="translate(72, 72) rotate(10)">
        <rect width="16" height="16" fill="white" rx="2"/>
        <rect x="2" y="2" width="4" height="4" fill="#333"/>
        <rect x="10" y="2" width="4" height="4" fill="#333"/>
        <rect x="2" y="10" width="4" height="4" fill="#333"/>
        <rect x="6" y="6" width="4" height="4" fill="#333"/>
      </g>
      <text x="60" y="155" textAnchor="middle" fill="#9ca3af" fontSize="9" fontWeight="bold">RIGHT SLEEVE</text>
    </svg>
  );
  
  // Determine which views to show
  const views: { id: string; component: JSX.Element }[] = [];
  if (hasFrontPlacement || (!hasBackPlacement && !hasLeftSleeve && !hasRightSleeve)) {
    views.push({ id: 'front', component: <ShirtFrontBackView view="front" /> });
  }
  if (hasBackPlacement) {
    views.push({ id: 'back', component: <ShirtFrontBackView view="back" /> });
  }
  if (hasLeftSleeve) {
    views.push({ id: 'left-sleeve', component: <LeftSleeveView /> });
  }
  if (hasRightSleeve) {
    views.push({ id: 'right-sleeve', component: <RightSleeveView /> });
  }
  
  return (
    <div className="text-center space-y-2">
      <div>
        <h2 className="text-xl font-bold text-white mb-1">Your Design Preview</h2>
        <p className="text-slate-400 text-sm">Here's how your graphic will look</p>
      </div>
      
      <div className={`flex justify-center items-start gap-2 ${views.length > 2 ? 'flex-wrap' : ''}`}>
        {views.map(view => (
          <div key={view.id} className={`${views.length === 1 ? 'w-56 h-64' : views.length === 2 ? 'w-44 h-52' : 'w-36 h-44'}`}>
            {view.component}
          </div>
        ))}
      </div>
      
      <p className="text-green-400 text-sm">Looking good! Proceed to create your URL.</p>
    </div>
  );
}

// Step 14: URL Creation - title, description with actual background preview
// Landing page text styling options
const LANDING_TEXT_COLORS = ['#ffffff', '#000000', '#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];
const LANDING_TEXT_SIZES = [
  { id: 'sm', label: 'S', value: '14px' },
  { id: 'md', label: 'M', value: '18px' },
  { id: 'lg', label: 'L', value: '24px' },
  { id: 'xl', label: 'XL', value: '32px' }
];
const LANDING_TEXT_FONTS = [
  { id: 'sans', label: 'Clean', family: 'Arial' },
  { id: 'serif', label: 'Classic', family: 'Georgia' },
  { id: 'mono', label: 'Tech', family: 'Courier New' },
  { id: 'display', label: 'Bold', family: 'Impact' }
];

function UrlCreationStep({
  title,
  description,
  onTitleChange,
  onDescriptionChange,
  background,
  titleVertical,
  titleHorizontal,
  titleColor,
  titleSize,
  titleFont,
  descVertical,
  descHorizontal,
  descColor,
  descSize,
  descFont,
  onTitleVerticalChange,
  onTitleHorizontalChange,
  onTitleColorChange,
  onTitleSizeChange,
  onTitleFontChange,
  onDescVerticalChange,
  onDescHorizontalChange,
  onDescColorChange,
  onDescSizeChange,
  onDescFontChange
}: {
  title: string;
  description: string;
  onTitleChange: (title: string) => void;
  onDescriptionChange: (description: string) => void;
  background: string;
  titleVertical: number;
  titleHorizontal: number;
  titleColor: string;
  titleSize: string;
  titleFont: string;
  descVertical: number;
  descHorizontal: number;
  descColor: string;
  descSize: string;
  descFont: string;
  onTitleVerticalChange: (v: number) => void;
  onTitleHorizontalChange: (v: number) => void;
  onTitleColorChange: (c: string) => void;
  onTitleSizeChange: (s: string) => void;
  onTitleFontChange: (f: string) => void;
  onDescVerticalChange: (v: number) => void;
  onDescHorizontalChange: (v: number) => void;
  onDescColorChange: (c: string) => void;
  onDescSizeChange: (s: string) => void;
  onDescFontChange: (f: string) => void;
}) {
  return (
    <div className="space-y-4">
      <div className="text-center">
        <h2 className="text-xl font-bold text-white mb-1">Create Your Landing Page</h2>
        <p className="text-slate-400 text-sm">This is what people see when they scan your QR code</p>
      </div>
      
      {/* Landing Page Preview - Phone mockup with positioned text */}
      <div className="flex justify-center py-2">
        <div className="relative w-44 h-72 rounded-3xl border-4 border-slate-700 bg-black overflow-hidden shadow-2xl">
          {/* Phone notch */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-20 h-5 bg-black rounded-b-xl z-10" />
          
          {/* Screen content */}
          <div className="w-full h-full relative">
            {/* Background image or placeholder */}
            {background ? (
              <img 
                src={background} 
                alt="Landing page background" 
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full bg-gradient-to-b from-slate-700 to-slate-900 flex items-center justify-center">
                <span className="text-slate-500 text-xs">No background selected</span>
              </div>
            )}
            
            {/* Dark overlay for readability */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />
            
            {/* Title - positioned by sliders with styling */}
            <div 
              className="absolute w-full px-2 text-center"
              style={{ 
                bottom: `${titleVertical}%`,
                left: `${titleHorizontal - 50}%`
              }}
            >
              <h3 
                className="font-bold truncate drop-shadow-lg"
                style={{ 
                  color: titleColor,
                  fontSize: titleSize,
                  fontFamily: titleFont
                }}
              >
                {title || 'Your Title Here'}
              </h3>
            </div>
            
            {/* Description - positioned by sliders with styling */}
            <div 
              className="absolute w-full px-2 text-center"
              style={{ 
                bottom: `${descVertical}%`,
                left: `${descHorizontal - 50}%`
              }}
            >
              <p 
                className="line-clamp-2 drop-shadow-lg"
                style={{ 
                  color: descColor,
                  fontSize: descSize,
                  fontFamily: descFont
                }}
              >
                {description || 'Add a description...'}
              </p>
            </div>
          </div>
        </div>
      </div>
      
      {/* Input fields with position sliders and styling controls */}
      <div className="space-y-4 max-w-md mx-auto">
        {/* Title Section */}
        <div className="bg-slate-800/50 rounded-lg p-3 space-y-3">
          <div>
            <Label className="text-white text-sm font-medium">Title</Label>
            <Input
              value={title}
              onChange={(e) => onTitleChange(e.target.value)}
              placeholder="Give your creation a name..."
              className="bg-slate-700 border-slate-600 text-white mt-1"
              data-testid="input-url-title"
            />
          </div>
          
          {/* Title Style Controls */}
          <div className="flex flex-wrap gap-3">
            <div className="flex items-center gap-1">
              <span className="text-xs text-slate-500">Color:</span>
              {LANDING_TEXT_COLORS.map((color) => (
                <button
                  key={color}
                  onClick={() => onTitleColorChange(color)}
                  className={`w-5 h-5 rounded-full border-2 transition-all ${
                    titleColor === color ? 'border-white scale-110' : 'border-slate-600'
                  }`}
                  style={{ backgroundColor: color }}
                  data-testid={`btn-title-color-${color}`}
                />
              ))}
            </div>
            <div className="flex items-center gap-1">
              <span className="text-xs text-slate-500">Size:</span>
              {LANDING_TEXT_SIZES.map((size) => (
                <Button
                  key={size.id}
                  size="sm"
                  variant={titleSize === size.value ? 'default' : 'outline'}
                  onClick={() => onTitleSizeChange(size.value)}
                  className="h-5 px-2 text-xs"
                  data-testid={`btn-title-size-${size.id}`}
                >
                  {size.label}
                </Button>
              ))}
            </div>
            <div className="flex items-center gap-1">
              <span className="text-xs text-slate-500">Font:</span>
              {LANDING_TEXT_FONTS.map((font) => (
                <Button
                  key={font.id}
                  size="sm"
                  variant={titleFont === font.family ? 'default' : 'outline'}
                  onClick={() => onTitleFontChange(font.family)}
                  style={{ fontFamily: font.family }}
                  className="h-5 px-2 text-xs"
                  data-testid={`btn-title-font-${font.id}`}
                >
                  {font.label}
                </Button>
              ))}
            </div>
          </div>
          
          {/* Title Position Sliders */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-slate-400 text-xs">
                Vertical: {titleVertical}%
              </Label>
              <input
                type="range"
                min="0"
                max="90"
                value={titleVertical}
                onChange={(e) => onTitleVerticalChange(Number(e.target.value))}
                className="w-full h-6 accent-green-500 cursor-pointer"
                style={{ touchAction: 'none' }}
                data-testid="slider-title-vertical"
              />
            </div>
            <div>
              <Label className="text-slate-400 text-xs">
                Horizontal: {titleHorizontal}%
              </Label>
              <input
                type="range"
                min="0"
                max="100"
                value={titleHorizontal}
                onChange={(e) => onTitleHorizontalChange(Number(e.target.value))}
                className="w-full h-6 accent-green-500 cursor-pointer"
                style={{ touchAction: 'none' }}
                data-testid="slider-title-horizontal"
              />
            </div>
          </div>
        </div>
        
        {/* Description Section */}
        <div className="bg-slate-800/50 rounded-lg p-3 space-y-3">
          <div>
            <Label className="text-white text-sm font-medium">Description</Label>
            <Input
              value={description}
              onChange={(e) => onDescriptionChange(e.target.value)}
              placeholder="What is this about?"
              className="bg-slate-700 border-slate-600 text-white mt-1"
              data-testid="input-url-description"
            />
          </div>
          
          {/* Description Style Controls */}
          <div className="flex flex-wrap gap-3">
            <div className="flex items-center gap-1">
              <span className="text-xs text-slate-500">Color:</span>
              {LANDING_TEXT_COLORS.map((color) => (
                <button
                  key={color}
                  onClick={() => onDescColorChange(color)}
                  className={`w-5 h-5 rounded-full border-2 transition-all ${
                    descColor === color ? 'border-white scale-110' : 'border-slate-600'
                  }`}
                  style={{ backgroundColor: color }}
                  data-testid={`btn-desc-color-${color}`}
                />
              ))}
            </div>
            <div className="flex items-center gap-1">
              <span className="text-xs text-slate-500">Size:</span>
              {LANDING_TEXT_SIZES.map((size) => (
                <Button
                  key={size.id}
                  size="sm"
                  variant={descSize === size.value ? 'default' : 'outline'}
                  onClick={() => onDescSizeChange(size.value)}
                  className="h-5 px-2 text-xs"
                  data-testid={`btn-desc-size-${size.id}`}
                >
                  {size.label}
                </Button>
              ))}
            </div>
            <div className="flex items-center gap-1">
              <span className="text-xs text-slate-500">Font:</span>
              {LANDING_TEXT_FONTS.map((font) => (
                <Button
                  key={font.id}
                  size="sm"
                  variant={descFont === font.family ? 'default' : 'outline'}
                  onClick={() => onDescFontChange(font.family)}
                  style={{ fontFamily: font.family }}
                  className="h-5 px-2 text-xs"
                  data-testid={`btn-desc-font-${font.id}`}
                >
                  {font.label}
                </Button>
              ))}
            </div>
          </div>
          
          {/* Description Position Sliders */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-slate-400 text-xs">
                Vertical: {descVertical}%
              </Label>
              <input
                type="range"
                min="0"
                max="90"
                value={descVertical}
                onChange={(e) => onDescVerticalChange(Number(e.target.value))}
                className="w-full h-6 accent-green-500 cursor-pointer"
                style={{ touchAction: 'none' }}
                data-testid="slider-desc-vertical"
              />
            </div>
            <div>
              <Label className="text-slate-400 text-xs">
                Horizontal: {descHorizontal}%
              </Label>
              <input
                type="range"
                min="0"
                max="100"
                value={descHorizontal}
                onChange={(e) => onDescHorizontalChange(Number(e.target.value))}
                className="w-full h-6 accent-green-500 cursor-pointer"
                style={{ touchAction: 'none' }}
                data-testid="slider-desc-horizontal"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function TypePickerStep({ 
  selectedType, 
  onSelect 
}: { 
  selectedType: QRType;
  onSelect: (type: QRType) => void;
}) {
  const allTypes = [
    { 
      id: 'qr-basic' as QRType, 
      label: 'QR Basic', 
      description: 'Just the QR code - simple and clean',
      icon: QrCode,
      color: 'bg-slate-600'
    },
    { 
      id: 'qr-plus' as QRType, 
      label: 'QR Plus', 
      description: 'QR code with header and footer text',
      icon: Type,
      color: 'bg-blue-600'
    },
    { 
      id: 'qr-canvas' as QRType, 
      label: 'QR Canvas', 
      description: 'QR code with a custom background image',
      icon: ImagePlus,
      color: 'bg-purple-600'
    },
    { 
      id: 'qr-play' as QRType, 
      label: 'QR Play', 
      description: 'QR code that opens a video',
      icon: Play,
      color: 'bg-rose-600'
    },
    { 
      id: 'qr-dynamics' as QRType, 
      label: 'QR Dynamics', 
      description: 'Rotating content that changes over time',
      icon: Sparkles,
      color: 'bg-amber-600'
    },
  ];

  return (
    <div>
      <div className="text-center mb-6">
        <h2 className="text-lg font-bold text-white mb-2">What do you want to create?</h2>
        <p className="text-slate-400">Choose the type of QR experience</p>
      </div>

      <div className="grid grid-cols-1 gap-3 max-w-md mx-auto">
        {allTypes.map((type) => (
          <button
            key={type.id}
            onClick={() => onSelect(type.id)}
            className={`p-4 rounded-xl border-2 transition-all flex items-center gap-4 ${
              selectedType === type.id
                ? 'border-white bg-white/10'
                : 'border-slate-600 bg-slate-800/50 hover:border-slate-500'
            }`}
            data-testid={`button-type-${type.id}`}
          >
            <div className={`w-12 h-12 rounded-full ${type.color} flex items-center justify-center flex-shrink-0`}>
              <type.icon className="w-6 h-6 text-white" />
            </div>
            <div className="text-left flex-1">
              <h3 className="font-bold text-white">{type.label}</h3>
              <p className="text-slate-400 text-sm">{type.description}</p>
            </div>
            {selectedType === type.id && (
              <Check className="w-6 h-6 text-green-400 flex-shrink-0" />
            )}
          </button>
        ))}
      </div>
    </div>
  );
}

// Simple Wizard Step: Background (5 sub-steps)
interface SimpleBackgroundStepProps {
  memberId: string;
  background: string;
  onBackgroundSelected: (croppedUrl: string, originalUrl: string, needsCrop: boolean) => void;
  onComplete: () => void;
  initialSubStep?: BackgroundSubStep; // Skip 'choice' if already decided
  croppedOnly?: boolean; // Show only cropped images and skip crop step
}

interface LibraryAsset {
  id: string;
  name: string;
  assetType: string;
  mediaType: string;
  thumbnailUrl: string;
  publicUrl: string;
  width?: number | null;
  height?: number | null;
  isCropped?: boolean;
}

// Step 13: Canvas Fork - ask if they want online scannable image
function CanvasForkStep({
  onYes,
  onNo
}: {
  onYes: () => void;
  onNo: () => void;
}) {
  return (
    <div className="text-center space-y-6">
      <div className="w-20 h-20 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center mx-auto">
        <Smartphone className="w-10 h-10 text-white" />
      </div>
      
      <div>
        <h2 className="text-xl font-bold text-white mb-3">One More Thing...</h2>
        <p className="text-slate-300 text-lg max-w-md mx-auto">
          Would you like to create a scannable image that you can customize the background and text on?
        </p>
      </div>
      
      <div className="p-4 bg-slate-800/50 rounded-lg max-w-md mx-auto">
        <p className="text-slate-300 text-base font-medium">
          Make it yours! Show the world!
        </p>
      </div>
      
      <div className="flex flex-col gap-3 max-w-xs mx-auto pt-4">
        <Button
          onClick={onYes}
          className="w-full py-6 text-lg bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500"
          data-testid="button-canvas-yes"
        >
          Yes, let's do it!
        </Button>
        <Button
          onClick={onNo}
          variant="outline"
          className="w-full py-4 text-slate-300 border-slate-600"
          data-testid="button-canvas-no"
        >
          No, I'm good with just the shirt
        </Button>
      </div>
    </div>
  );
}

function QRCanvasExplainerStep({
  onUploadClick,
  onLibraryClick
}: {
  onUploadClick: () => void;
  onLibraryClick: () => void;
}) {
  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="text-center">
        <h2 className="text-lg font-bold text-white mb-2">Create Your Landing Page</h2>
        <p className="text-slate-400">When someone scans your QR code, they'll see a beautiful page you design</p>
      </div>
      
      <div className="flex justify-center py-6">
        <div className="flex items-center gap-6">
          <div className="relative">
            <div className="w-20 h-20 bg-white rounded-xl flex items-center justify-center shadow-lg">
              <QrCode className="w-12 h-12 text-slate-800" />
            </div>
            <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 text-xs text-slate-500 whitespace-nowrap">
              Your QR Code
            </div>
          </div>
          
          <div className="flex flex-col items-center gap-1">
            <ArrowRight className="w-8 h-8 text-emerald-400 animate-pulse" />
            <Smartphone className="w-6 h-6 text-slate-400" />
          </div>
          
          <div className="relative group">
            <div className="w-32 h-56 bg-gradient-to-b from-slate-700 to-slate-800 rounded-2xl border-2 border-emerald-400 shadow-lg shadow-emerald-400/30 p-2 flex flex-col items-center justify-center">
              <div className="w-full h-full bg-gradient-to-br from-purple-600/30 to-blue-600/30 rounded-xl flex flex-col items-center justify-center gap-2">
                <ImagePlus className="w-8 h-8 text-white/60" />
                <span className="text-xs text-white/80 text-center px-2">Your favorite picture</span>
              </div>
            </div>
            <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 text-xs text-emerald-400 whitespace-nowrap font-medium">
              Landing Page
            </div>
          </div>
        </div>
      </div>
      
      <div className="text-center text-slate-300 text-sm max-w-md mx-auto mt-8">
        Pick your favorite photo, memory, or design. It becomes what people see when they scan.
      </div>
      
      <div className="flex flex-col sm:flex-row gap-4 justify-center mt-8">
        <Button
          onClick={onUploadClick}
          size="lg"
          className="bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white shadow-lg shadow-emerald-500/30 px-8"
          data-testid="button-upload-new"
        >
          <Upload className="w-5 h-5 mr-2" />
          Upload New
        </Button>
        <Button
          onClick={onLibraryClick}
          size="lg"
          variant="outline"
          className="border-slate-500 text-slate-300 hover:bg-slate-700 px-8"
          data-testid="button-pick-library"
        >
          <Library className="w-5 h-5 mr-2" />
          Pick from Library
        </Button>
      </div>
    </div>
  );
}

function UrlSourceChoiceStep({
  choice,
  onChoiceChange
}: {
  choice: LibraryChoice;
  onChoiceChange: (choice: LibraryChoice) => void;
}) {
  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="text-center">
        <h2 className="text-lg font-bold text-white mb-2">Choose Image Source</h2>
        <p className="text-slate-400">Pick from ready-to-use cropped images or browse raw backgrounds</p>
      </div>
      
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-lg mx-auto mt-6">
        <button
          onClick={() => onChoiceChange('personal')}
          className={`p-6 rounded-xl border-2 transition-all duration-200 text-left ${
            choice === 'personal'
              ? 'border-emerald-400 bg-emerald-500/10 shadow-lg shadow-emerald-500/20'
              : 'border-slate-600 bg-slate-800/50 hover:border-slate-500'
          }`}
          data-testid="button-cropped-library"
        >
          <div className="flex items-center gap-3 mb-2">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
              choice === 'personal' ? 'bg-emerald-500' : 'bg-slate-700'
            }`}>
              <Crop className="w-5 h-5 text-white" />
            </div>
            <span className="font-semibold text-white">Cropped Library</span>
          </div>
          <p className="text-sm text-slate-400">Your saved 9:16 cropped images - ready to use</p>
        </button>
        
        <button
          onClick={() => onChoiceChange('common')}
          className={`p-6 rounded-xl border-2 transition-all duration-200 text-left ${
            choice === 'common'
              ? 'border-emerald-400 bg-emerald-500/10 shadow-lg shadow-emerald-500/20'
              : 'border-slate-600 bg-slate-800/50 hover:border-slate-500'
          }`}
          data-testid="button-raw-library"
        >
          <div className="flex items-center gap-3 mb-2">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
              choice === 'common' ? 'bg-emerald-500' : 'bg-slate-700'
            }`}>
              <Library className="w-5 h-5 text-white" />
            </div>
            <span className="font-semibold text-white">Raw Background Library</span>
          </div>
          <p className="text-sm text-slate-400">Browse backgrounds - you'll crop to 9:16</p>
        </button>
      </div>
    </div>
  );
}

function SimpleBackgroundStep({ 
  memberId, 
  background,
  onBackgroundSelected,
  onComplete,
  initialSubStep = 'choice',
  croppedOnly = false
}: SimpleBackgroundStepProps) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [subStep, setSubStep] = useState<BackgroundSubStep>(initialSubStep);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState<LibraryAsset | null>(null);
  const [showCrop, setShowCrop] = useState(false);

  const { data: personalAssets = [], isLoading: loadingPersonal, refetch: refetchPersonal } = useQuery<LibraryAsset[]>({
    queryKey: ['/api/members', memberId, 'library', 'background'],
    queryFn: async () => {
      const token = await auth.currentUser?.getIdToken();
      const headers: HeadersInit = token ? { Authorization: `Bearer ${token}` } : {};
      const res = await fetch(`/api/members/${memberId}/library?assetType=background`, { headers });
      if (!res.ok) return [];
      const data = await res.json();
      return data.assets || [];
    },
    enabled: !!memberId && (subStep === 'personal-library')
  });

  const { data: commonAssets = [], isLoading: loadingCommon } = useQuery<LibraryAsset[]>({
    queryKey: ['/api/members/common-library', 'background'],
    queryFn: async () => {
      const token = await auth.currentUser?.getIdToken();
      const headers: HeadersInit = token ? { Authorization: `Bearer ${token}` } : {};
      const res = await fetch(`/api/members/common-library?assetType=background`, { headers });
      if (!res.ok) return [];
      const data = await res.json();
      return data.assets || [];
    },
    enabled: subStep === 'common-library'
  });

  const isAlready916 = (asset: LibraryAsset): boolean => {
    if (asset.isCropped) return true;
    if (asset.width && asset.height) {
      const ratio = asset.width / asset.height;
      const target = 9 / 16;
      return Math.abs(ratio - target) < 0.05;
    }
    return false;
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setUploadProgress(0);

    try {
      const reader = new FileReader();
      
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => Math.min(prev + 10, 90));
      }, 100);

      const base64Promise = new Promise<string>((resolve, reject) => {
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      
      const imageData = await base64Promise;
      clearInterval(progressInterval);
      setUploadProgress(95);

      const token = await auth.currentUser?.getIdToken();
      const headers: HeadersInit = token 
        ? { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } 
        : { 'Content-Type': 'application/json' };

      const res = await fetch(`/api/members/${memberId}/library/upload`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          assetType: 'background',
          name: file.name,
          imageData,
          mimeType: file.type,
          originalName: file.name
        })
      });

      setUploadProgress(100);

      if (!res.ok) throw new Error('Upload failed');
      
      const data = await res.json();
      if (data.asset) {
        setSelectedAsset(data.asset);
        setShowCrop(true);
      }
    } catch (error) {
      toast({ title: "Upload failed", variant: "destructive" });
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleAssetSelect = (asset: LibraryAsset) => {
    setSelectedAsset(asset);
    // If croppedOnly mode, always skip crop (these are pre-cropped images)
    if (croppedOnly || isAlready916(asset)) {
      onBackgroundSelected(asset.publicUrl, asset.publicUrl, false);
      onComplete();
    } else {
      setShowCrop(true);
    }
  };
  
  // Filter personal assets to only show cropped images when croppedOnly is true
  const filteredPersonalAssets = croppedOnly 
    ? personalAssets.filter(asset => isAlready916(asset))
    : personalAssets;

  const handleCropComplete = (croppedUrl: string) => {
    const originalUrl = selectedAsset?.publicUrl || '';
    onBackgroundSelected(croppedUrl, originalUrl, true);
    setShowCrop(false);
    onComplete();
  };

  const fetchImageBlob = async (url: string): Promise<string> => {
    const response = await fetch(url);
    const blob = await response.blob();
    return URL.createObjectURL(blob);
  };

  return (
    <div className="space-y-6">
      {subStep === 'choice' && (
        <div className="text-center space-y-8">
          <div>
            <h2 className="text-lg font-bold text-white mb-2">Add Your Background</h2>
            <p className="text-slate-400">Every great QR Canvas needs an image</p>
          </div>

          <div className="max-w-sm mx-auto space-y-4">
            <p className="text-lg text-white font-medium">Would you like to upload a new image?</p>
            
            <div className="grid grid-cols-2 gap-4">
              <Button
                size="lg"
                className="h-20 text-lg bg-green-600 hover:bg-green-700"
                onClick={() => setSubStep('upload')}
                data-testid="button-bg-upload-yes"
              >
                <Upload className="w-6 h-6 mr-2" />
                Yes
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="h-20 text-lg"
                onClick={() => setSubStep('library-choice')}
                data-testid="button-bg-upload-no"
              >
                <Library className="w-6 h-6 mr-2" />
                No
              </Button>
            </div>
          </div>
        </div>
      )}

      {subStep === 'upload' && (
        <div className="text-center space-y-6">
          <div>
            <h2 className="text-lg font-bold text-white mb-2">Upload Your Image</h2>
            <p className="text-slate-400">Choose a photo from your device</p>
          </div>

          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileSelect}
            accept="image/*"
            className="hidden"
            data-testid="input-bg-file"
          />

          {isUploading ? (
            <div className="max-w-sm mx-auto space-y-4">
              <div className="w-24 h-24 mx-auto rounded-full bg-slate-700 flex items-center justify-center">
                <Loader2 className="w-10 h-10 text-green-400 animate-spin" />
              </div>
              <div className="space-y-2">
                <div className="h-3 bg-slate-700 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-green-500 to-green-400 transition-all duration-300 rounded-full"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
                <p className="text-slate-400 text-sm">{uploadProgress}% uploaded</p>
              </div>
            </div>
          ) : (
            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-full max-w-sm mx-auto h-48 border-2 border-dashed border-slate-600 rounded-2xl flex flex-col items-center justify-center gap-4 hover:border-green-500 hover:bg-green-500/10 transition-all cursor-pointer"
              data-testid="button-bg-upload-trigger"
            >
              <div className="w-16 h-16 rounded-full bg-slate-700 flex items-center justify-center">
                <Upload className="w-8 h-8 text-green-400" />
              </div>
              <div>
                <p className="font-medium text-white text-lg">Tap to upload</p>
                <p className="text-sm text-slate-400">JPG, PNG, or GIF</p>
              </div>
            </button>
          )}

          <Button
            variant="ghost"
            className="text-slate-400"
            onClick={() => setSubStep('choice')}
            data-testid="button-bg-upload-back"
          >
            <ChevronLeft className="w-4 h-4 mr-1" />
            Go Back
          </Button>
        </div>
      )}

      {subStep === 'library-choice' && (
        <div className="text-center space-y-8">
          <div>
            <h2 className="text-lg font-bold text-white mb-2">Pick From Library</h2>
            <p className="text-slate-400">Choose from your saved images or browse common backgrounds</p>
          </div>

          <div className="max-w-sm mx-auto space-y-4">
            <p className="text-lg text-white font-medium">Use your personal library?</p>
            
            <div className="grid grid-cols-2 gap-4">
              <Button
                size="lg"
                className="h-20 text-lg bg-blue-600 hover:bg-blue-700"
                onClick={() => setSubStep('personal-library')}
                data-testid="button-bg-personal-yes"
              >
                <User className="w-6 h-6 mr-2" />
                Yes
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="h-20 text-lg"
                onClick={() => setSubStep('common-library')}
                data-testid="button-bg-personal-no"
              >
                <Library className="w-6 h-6 mr-2" />
                Common
              </Button>
            </div>
          </div>

          <Button
            variant="ghost"
            className="text-slate-400"
            onClick={() => setSubStep('choice')}
            data-testid="button-bg-library-back"
          >
            <ChevronLeft className="w-4 h-4 mr-1" />
            Go Back
          </Button>
        </div>
      )}

      {subStep === 'personal-library' && (
        <div className="space-y-6">
          <div className="text-center">
            <h2 className="text-lg font-bold text-white mb-2">
              {croppedOnly ? "Your Cropped Images" : "Your Library"}
            </h2>
            <p className="text-slate-400">
              {croppedOnly ? "Ready to use - no cropping needed" : "Select an image to use"}
            </p>
          </div>

          {loadingPersonal ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-blue-400" />
            </div>
          ) : filteredPersonalAssets.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-slate-700 flex items-center justify-center">
                <ImagePlus className="w-8 h-8 text-slate-500" />
              </div>
              <p className="text-slate-400 mb-4">
                {croppedOnly ? "No cropped images yet - crop some from the raw library first" : "No images in your library yet"}
              </p>
              <Button onClick={() => setSubStep('upload')} data-testid="button-bg-upload-instead">
                <Upload className="w-4 h-4 mr-2" />
                Upload One
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-3 max-h-[400px] overflow-y-auto">
              {filteredPersonalAssets.map((asset) => (
                <button
                  key={asset.id}
                  onClick={() => handleAssetSelect(asset)}
                  className="aspect-[9/16] rounded-lg overflow-hidden border-2 border-slate-600 hover:border-blue-500 transition-all relative group"
                  data-testid={`button-bg-asset-${asset.id}`}
                >
                  <img 
                    src={asset.thumbnailUrl || asset.publicUrl} 
                    alt={asset.name}
                    className="w-full h-full object-cover"
                  />
                  {isAlready916(asset) && (
                    <div className="absolute top-1 right-1 bg-green-500 rounded-full p-1">
                      <Check className="w-3 h-3 text-white" />
                    </div>
                  )}
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <span className="text-white font-medium text-sm">Select</span>
                  </div>
                </button>
              ))}
            </div>
          )}

          <div className="flex justify-center">
            <Button
              variant="ghost"
              className="text-slate-400"
              onClick={() => setSubStep('library-choice')}
              data-testid="button-bg-personal-back"
            >
              <ChevronLeft className="w-4 h-4 mr-1" />
              Go Back
            </Button>
          </div>
        </div>
      )}

      {subStep === 'common-library' && (
        <div className="space-y-6">
          <div className="text-center">
            <h2 className="text-lg font-bold text-white mb-2">Common Library</h2>
            <p className="text-slate-400">Select from curated backgrounds</p>
          </div>

          {loadingCommon ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-blue-400" />
            </div>
          ) : commonAssets.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-slate-700 flex items-center justify-center">
                <Library className="w-8 h-8 text-slate-500" />
              </div>
              <p className="text-slate-400 mb-4">No common backgrounds available</p>
              <Button onClick={() => setSubStep('upload')} data-testid="button-bg-upload-common">
                <Upload className="w-4 h-4 mr-2" />
                Upload Your Own
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-3 max-h-[400px] overflow-y-auto">
              {commonAssets.map((asset) => (
                <button
                  key={asset.id}
                  onClick={() => handleAssetSelect(asset)}
                  className="aspect-[9/16] rounded-lg overflow-hidden border-2 border-slate-600 hover:border-purple-500 transition-all relative group"
                  data-testid={`button-bg-common-${asset.id}`}
                >
                  <img 
                    src={asset.thumbnailUrl || asset.publicUrl} 
                    alt={asset.name}
                    className="w-full h-full object-cover"
                  />
                  {isAlready916(asset) && (
                    <div className="absolute top-1 right-1 bg-green-500 rounded-full p-1">
                      <Check className="w-3 h-3 text-white" />
                    </div>
                  )}
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <span className="text-white font-medium text-sm">Select</span>
                  </div>
                </button>
              ))}
            </div>
          )}

          <div className="flex justify-center">
            <Button
              variant="ghost"
              className="text-slate-400"
              onClick={() => setSubStep('library-choice')}
              data-testid="button-bg-common-back"
            >
              <ChevronLeft className="w-4 h-4 mr-1" />
              Go Back
            </Button>
          </div>
        </div>
      )}

      {showCrop && selectedAsset && (
        <CropUtility
          asset={{
            id: selectedAsset.id,
            name: selectedAsset.name,
            imageUrl: selectedAsset.publicUrl
          }}
          open={showCrop}
          onOpenChange={(open) => {
            setShowCrop(open);
            if (!open) setSelectedAsset(null);
          }}
          onCropComplete={handleCropComplete}
          fetchImageBlob={fetchImageBlob}
          aspectRatio={9 / 16}
          title="Crop for Mobile Screen"
          allowCropToggle={false}
        />
      )}
    </div>
  );
}

// Phone mockup with actual QR code for preview
function PhoneMockupWithQR({ 
  background, 
  headerText,
  footerText,
  headerStyle,
  footerStyle,
  qrCodeUrl
}: { 
  background: string;
  headerText?: string;
  footerText?: string;
  headerStyle?: TextStyleConfig;
  footerStyle?: TextStyleConfig;
  qrCodeUrl?: string;
}) {
  const getFontSize = (size: string) => {
    if (size === '12px' || size === 'sm') return '12px';
    if (size === '24px' || size === 'lg') return '20px';
    return '16px';
  };

  return (
    <div className="relative mx-auto" style={{ width: '180px' }}>
      <div className="relative rounded-[1.5rem] border-4 border-slate-700 bg-black overflow-hidden shadow-2xl">
        <div className="absolute top-1.5 left-1/2 -translate-x-1/2 w-12 h-3 bg-slate-700 rounded-full z-10" />
        <div className="aspect-[9/19] relative">
          {background && (
            <img 
              src={background} 
              alt="Background" 
              className="absolute inset-0 w-full h-full object-cover"
            />
          )}
          <div className="absolute inset-0 flex flex-col items-center justify-center p-3">
            {headerText && headerStyle?.enabled && (
              <div 
                className="text-center mb-2 px-1 max-w-full"
                style={{
                  color: headerStyle.color || '#ffffff',
                  fontSize: getFontSize(headerStyle.fontSize),
                  fontFamily: headerStyle.fontFamily || 'sans-serif',
                  fontWeight: 'bold',
                  textShadow: '0 1px 3px rgba(0,0,0,0.5)',
                  transform: `translateY(${(headerStyle.verticalOffset || 0) * 0.5}px)`
                }}
              >
                {headerText}
              </div>
            )}
            <div className="w-16 h-16 bg-white rounded-lg flex items-center justify-center flex-shrink-0 overflow-hidden">
              {qrCodeUrl ? (
                <img src={qrCodeUrl} alt="QR Code" className="w-full h-full object-contain" />
              ) : (
                <QrCode className="w-12 h-12 text-slate-800" />
              )}
            </div>
            {footerText && footerStyle?.enabled && (
              <div 
                className="text-center mt-2 px-1 max-w-full"
                style={{
                  color: footerStyle.color || '#ffffff',
                  fontSize: getFontSize(footerStyle.fontSize),
                  fontFamily: footerStyle.fontFamily || 'sans-serif',
                  fontWeight: 'bold',
                  textShadow: '0 1px 3px rgba(0,0,0,0.5)',
                  transform: `translateY(${(footerStyle.verticalOffset || 0) * 0.5}px)`
                }}
              >
                {footerText}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// Phone mockup component for previews
function PhoneMockup({ 
  background, 
  headerText,
  footerText,
  headerStyle,
  footerStyle,
  className = ""
}: { 
  background: string;
  headerText?: string;
  footerText?: string;
  headerStyle?: TextStyleConfig;
  footerStyle?: TextStyleConfig;
  className?: string;
}) {
  const getFontSize = (size: string) => {
    if (size === '12px' || size === 'sm') return '10px';
    if (size === '24px' || size === 'lg') return '16px';
    return '12px';
  };

  return (
    <div className={`relative mx-auto ${className}`} style={{ width: '160px' }}>
      <div className="relative rounded-[1.5rem] border-4 border-slate-700 bg-black overflow-hidden shadow-2xl">
        <div className="absolute top-1.5 left-1/2 -translate-x-1/2 w-12 h-3 bg-slate-700 rounded-full z-10" />
        <div className="aspect-[9/19] relative">
          {background && (
            <img 
              src={background} 
              alt="Background" 
              className="absolute inset-0 w-full h-full object-cover"
            />
          )}
          <div className="absolute inset-0 flex flex-col items-center justify-center p-3">
            {headerText && headerStyle?.enabled && (
              <div 
                className="text-center mb-1 px-1 max-w-full"
                style={{
                  color: headerStyle.color || '#ffffff',
                  fontSize: getFontSize(headerStyle.fontSize),
                  fontFamily: headerStyle.fontFamily || 'sans-serif',
                  fontWeight: 'bold',
                  textShadow: '0 1px 3px rgba(0,0,0,0.5)',
                  transform: `translateY(${(headerStyle.verticalOffset || 0) * 0.5}px)`
                }}
              >
                {headerText}
              </div>
            )}
            <div className="w-12 h-12 bg-white rounded-lg flex items-center justify-center flex-shrink-0">
              <QrCode className="w-9 h-9 text-slate-800" />
            </div>
            {footerText && footerStyle?.enabled && (
              <div 
                className="text-center mt-1 px-1 max-w-full"
                style={{
                  color: footerStyle.color || '#ffffff',
                  fontSize: getFontSize(footerStyle.fontSize),
                  fontFamily: footerStyle.fontFamily || 'sans-serif',
                  fontWeight: 'bold',
                  textShadow: '0 1px 3px rgba(0,0,0,0.5)',
                  transform: `translateY(${(footerStyle.verticalOffset || 0) * 0.5}px)`
                }}
              >
                {footerText}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// Simple Wizard Step: Text Ask (phone preview with "Want to add text?")
function TextAskStep({ 
  background,
  onYes,
  onNo
}: { 
  background: string;
  onYes: () => void;
  onNo: () => void;
}) {
  return (
    <div className="text-center space-y-6">
      <div>
        <h2 className="text-lg font-bold text-white mb-2">Looking Good!</h2>
        <p className="text-slate-400">Would you like to add some text?</p>
      </div>

      <PhoneMockup background={background} />

      <div className="max-w-sm mx-auto grid grid-cols-2 gap-4">
        <Button
          size="lg"
          className="h-16 text-lg bg-green-600 hover:bg-green-700"
          onClick={onYes}
          data-testid="button-text-yes"
        >
          <Type className="w-5 h-5 mr-2" />
          Yes
        </Button>
        <Button
          size="lg"
          variant="outline"
          className="h-16 text-lg"
          onClick={onNo}
          data-testid="button-text-no"
        >
          <ChevronRight className="w-5 h-5 mr-2" />
          No, Skip
        </Button>
      </div>
    </div>
  );
}

// Simple Wizard Step: Text Layout Choice (Header/Footer/Both)
function TextLayoutChoiceStep({ 
  selected,
  onSelect
}: { 
  selected: TextLayoutChoice;
  onSelect: (choice: TextLayoutChoice) => void;
}) {
  const options = [
    {
      id: 'header' as TextLayoutChoice,
      label: 'Header Only',
      description: 'Text above the QR code'
    },
    {
      id: 'footer' as TextLayoutChoice,
      label: 'Footer Only', 
      description: 'Text below the QR code'
    },
    {
      id: 'both' as TextLayoutChoice,
      label: 'Both',
      description: 'Text above and below'
    }
  ];

  return (
    <div className="text-center space-y-6">
      <div>
        <h2 className="text-lg font-bold text-white mb-2">Where Should the Text Go?</h2>
        <p className="text-slate-400">Choose a layout for your text</p>
      </div>

      <div className="grid grid-cols-3 gap-4 max-w-lg mx-auto">
        {options.map((option) => (
          <button
            key={option.id}
            onClick={() => onSelect(option.id)}
            className={`p-4 rounded-xl border-2 transition-all ${
              selected === option.id
                ? 'border-green-500 bg-green-500/20'
                : 'border-slate-600 bg-slate-800/50 hover:border-slate-500'
            }`}
            data-testid={`button-layout-${option.id}`}
          >
            <div className="w-full aspect-[9/16] bg-slate-700 rounded-lg mb-3 flex flex-col items-center justify-center p-2">
              {(option.id === 'header' || option.id === 'both') && (
                <div className="w-full h-4 bg-yellow-400 border-2 border-yellow-200 rounded mb-1 shadow-lg" />
              )}
              <div className="w-8 h-8 bg-white rounded flex items-center justify-center my-1">
                <QrCode className="w-5 h-5 text-slate-800" />
              </div>
              {(option.id === 'footer' || option.id === 'both') && (
                <div className="w-full h-4 bg-yellow-400 border-2 border-yellow-200 rounded mt-1 shadow-lg" />
              )}
            </div>
            <p className="text-white font-medium text-sm">{option.label}</p>
            {selected === option.id && (
              <Check className="w-5 h-5 text-green-400 mx-auto mt-2" />
            )}
          </button>
        ))}
      </div>
    </div>
  );
}

// Text style presets
const TEXT_COLORS = ['#ffffff', '#000000', '#3b82f6', '#22c55e', '#f59e0b', '#ef4444'];
const TEXT_SIZES = [
  { id: 'sm', label: 'S', value: '12px' },
  { id: 'md', label: 'M', value: '18px' },
  { id: 'lg', label: 'L', value: '24px' }
];
const TEXT_FONTS = [
  { id: 'sans', label: 'Clean', family: 'Arial' },
  { id: 'bold', label: 'Bold', family: 'Impact' },
  { id: 'script', label: 'Script', family: 'Georgia' }
];

// Text style editor section component
function TextStyleSection({ 
  label,
  style,
  onStyleChange,
  testIdPrefix
}: {
  label: string;
  style: TextStyleConfig;
  onStyleChange: (style: TextStyleConfig) => void;
  testIdPrefix: string;
}) {
  const updateStyle = (updates: Partial<TextStyleConfig>) => {
    onStyleChange({ ...style, ...updates, enabled: true });
  };

  return (
    <div className="space-y-3 p-3 bg-slate-800/50 rounded-xl border border-slate-700">
      <Label className="text-white font-medium text-sm">{label}</Label>
      <Input
        value={style.text || ''}
        onChange={(e) => updateStyle({ text: e.target.value })}
        placeholder={`Enter ${label.toLowerCase()}...`}
        className="bg-slate-700 border-slate-600 text-white h-10"
        data-testid={`input-${testIdPrefix}-text`}
      />
      
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400 w-12">Color</span>
          <div className="flex gap-1 flex-wrap">
            {TEXT_COLORS.map((color) => (
              <button
                key={color}
                onClick={() => updateStyle({ color })}
                className={`w-6 h-6 rounded-full border-2 transition-all ${
                  style.color === color ? 'border-white scale-110' : 'border-slate-600'
                }`}
                style={{ backgroundColor: color }}
                data-testid={`button-${testIdPrefix}-color-${color}`}
              />
            ))}
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400 w-12">Size</span>
          <div className="flex gap-1">
            {TEXT_SIZES.map((size) => (
              <Button
                key={size.id}
                size="sm"
                variant={style.fontSize === size.value ? 'default' : 'outline'}
                onClick={() => updateStyle({ fontSize: size.value })}
                className="h-7 px-3 text-xs"
                data-testid={`button-${testIdPrefix}-size-${size.id}`}
              >
                {size.label}
              </Button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400 w-12">Font</span>
          <div className="flex gap-1">
            {TEXT_FONTS.map((font) => (
              <Button
                key={font.id}
                size="sm"
                variant={style.fontFamily === font.family ? 'default' : 'outline'}
                onClick={() => updateStyle({ fontFamily: font.family })}
                style={{ fontFamily: font.family }}
                className="h-7 px-2 text-xs"
                data-testid={`button-${testIdPrefix}-font-${font.id}`}
              >
                {font.label}
              </Button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400 w-12">Position</span>
          <input
            type="range"
            min="-50"
            max="50"
            value={style.verticalOffset || 0}
            onChange={(e) => updateStyle({ verticalOffset: parseInt(e.target.value) })}
            className="flex-1 h-2 bg-slate-600 rounded-lg appearance-none cursor-pointer accent-green-500"
            data-testid={`slider-${testIdPrefix}-position`}
          />
          <span className="text-xs text-slate-500 w-8">{style.verticalOffset || 0}</span>
        </div>
      </div>
    </div>
  );
}

// Simple Wizard Step: Text Edit (enter text + styling)
function TextEditStep({ 
  layout,
  background,
  headerStyle,
  footerStyle,
  onHeaderChange,
  onFooterChange
}: { 
  layout: TextLayoutChoice;
  background: string;
  headerStyle: TextStyleConfig;
  footerStyle: TextStyleConfig;
  onHeaderChange: (style: TextStyleConfig) => void;
  onFooterChange: (style: TextStyleConfig) => void;
}) {
  const showHeader = layout === 'header' || layout === 'both';
  const showFooter = layout === 'footer' || layout === 'both';

  return (
    <div className="space-y-4">
      <div className="text-center">
        <h2 className="text-xl font-bold text-white mb-1">Add Your Text</h2>
        <p className="text-slate-400 text-sm">Type your message and style it</p>
      </div>

      {showHeader && (
        <TextStyleSection
          label="Header Text"
          style={headerStyle}
          onStyleChange={onHeaderChange}
          testIdPrefix="header"
        />
      )}

      <div className="flex justify-center py-2">
        <PhoneMockup
          background={background}
          headerText={showHeader ? headerStyle.text : undefined}
          footerText={showFooter ? footerStyle.text : undefined}
          headerStyle={showHeader ? headerStyle : undefined}
          footerStyle={showFooter ? footerStyle : undefined}
        />
      </div>

      {showFooter && (
        <TextStyleSection
          label="Footer Text"
          style={footerStyle}
          onStyleChange={onFooterChange}
          testIdPrefix="footer"
        />
      )}
    </div>
  );
}

// Simple Wizard Step: Final Preview for QR Canvas
// QR Canvas shows the urlGraphic (landing page) with title + description
// NO QR code - that's on the physical product, not the landing page
function SimplePreviewStep({ 
  background,
  title,
  description,
  onGoBack
}: { 
  background: string;
  title: string;
  description?: string;
  onGoBack: () => void;
}) {
  return (
    <div className="text-center space-y-4">
      <div>
        <h2 className="text-xl font-bold text-white mb-1">Your Landing Page</h2>
        <p className="text-slate-400 text-sm">This is what people see when they scan your QR code</p>
      </div>

      <div className="pt-4">
        {/* Phone mockup showing ONLY background + title + description - NO QR */}
        <div className="relative mx-auto" style={{ width: '180px' }}>
          <div className="relative rounded-[1.5rem] border-4 border-slate-700 bg-black overflow-hidden shadow-2xl">
            <div className="absolute top-1.5 left-1/2 -translate-x-1/2 w-12 h-3 bg-slate-700 rounded-full z-10" />
            <div className="aspect-[9/19] relative">
              {background && (
                <img 
                  src={background} 
                  alt="Background" 
                  className="absolute inset-0 w-full h-full object-cover"
                />
              )}
              <div className="absolute inset-0 flex flex-col items-center justify-center p-4">
                {title && (
                  <h3 className="text-white font-bold text-lg text-center mb-2" style={{ textShadow: '0 2px 4px rgba(0,0,0,0.8)' }}>
                    {title}
                  </h3>
                )}
                {description && (
                  <p className="text-white/90 text-sm text-center" style={{ textShadow: '0 1px 3px rgba(0,0,0,0.8)' }}>
                    {description}
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <Button
        variant="outline"
        onClick={onGoBack}
        className="mt-4"
        data-testid="button-preview-change"
      >
        <ChevronLeft className="w-4 h-4 mr-2" />
        Make Changes
      </Button>
    </div>
  );
}

// Simple Wizard Step: Details (title + description only)
function DetailsStep({ 
  title, 
  description,
  onTitleChange,
  onDescriptionChange
}: { 
  title: string;
  description: string;
  onTitleChange: (value: string) => void;
  onDescriptionChange: (value: string) => void;
}) {
  return (
    <div>
      <div className="text-center mb-8">
        <h2 className="text-lg font-bold text-white mb-2">Add Your Details</h2>
        <p className="text-slate-400">Give your creation a title and description</p>
      </div>

      <div className="max-w-md mx-auto space-y-6">
        <div className="space-y-2">
          <Label htmlFor="simple-title" className="text-white text-lg">Title</Label>
          <Input
            id="simple-title"
            value={title}
            onChange={(e) => onTitleChange(e.target.value)}
            placeholder="My Awesome Creation"
            className="bg-slate-700 border-slate-600 text-white text-lg h-14"
            data-testid="input-simple-title"
          />
          <p className="text-slate-500 text-sm">This appears when people scan your QR code</p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="simple-description" className="text-white text-lg">Description (optional)</Label>
          <textarea
            id="simple-description"
            value={description}
            onChange={(e) => onDescriptionChange(e.target.value)}
            placeholder="Tell people what this is about..."
            rows={4}
            className="w-full bg-slate-700 border border-slate-600 text-white rounded-lg p-3 resize-none focus:border-blue-500 outline-none"
            data-testid="input-simple-description"
          />
        </div>
      </div>
    </div>
  );
}

// Simple Wizard Step: Publish (simplified confirmation)
function SimplePublishStep({ 
  isPublishing,
  onPublish,
  title,
  qrType,
  background
}: { 
  isPublishing: boolean;
  onPublish: () => void;
  title: string;
  qrType: QRType;
  background: string;
}) {
  const typeLabel = qrType === 'qr-canvas' ? 'Image Post' : qrType === 'qr-play' ? 'Video Post' : 'Creation';
  
  return (
    <div className="text-center">
      <div className="mb-8">
        <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-green-600/20 flex items-center justify-center">
          <Sparkles className="w-10 h-10 text-green-400" />
        </div>
        <h2 className="text-lg font-bold text-white mb-2">Ready to Publish!</h2>
        <p className="text-slate-400">Your {typeLabel.toLowerCase()} is ready to share with the world</p>
      </div>

      <Card className="bg-slate-800/50 border-slate-700 max-w-sm mx-auto mb-8">
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center gap-3">
            {background ? (
              <div className="w-12 h-12 rounded-lg overflow-hidden">
                <img src={background} alt="" className="w-full h-full object-cover" />
              </div>
            ) : (
              <div className="w-12 h-12 rounded-lg bg-slate-700 flex items-center justify-center">
                {qrType === 'qr-play' ? <Play className="w-6 h-6 text-slate-400" /> : <ImagePlus className="w-6 h-6 text-slate-400" />}
              </div>
            )}
            <div className="text-left">
              <p className="text-white font-medium">{title || 'Untitled'}</p>
              <p className="text-slate-400 text-sm">{typeLabel}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Button
        size="lg"
        onClick={onPublish}
        disabled={isPublishing || !title.trim()}
        className="bg-green-600 hover:bg-green-700 text-white px-12 py-6 text-lg"
        data-testid="button-simple-publish"
      >
        {isPublishing ? (
          <>
            <Loader2 className="w-5 h-5 mr-2 animate-spin" />
            Publishing...
          </>
        ) : (
          <>
            <Send className="w-5 h-5 mr-2" />
            Publish Now
          </>
        )}
      </Button>

      {!title.trim() && (
        <p className="text-amber-400 text-sm mt-4">Please add a title before publishing</p>
      )}
    </div>
  );
}

function PreviewStep({ 
  product, 
  qrType,
  headerStyle,
  footerStyle,
  background
}: { 
  product: ProductItem | null;
  qrType: QRType;
  headerStyle: TextStyleConfig;
  footerStyle: TextStyleConfig;
  background: string;
}) {
  const showGraphicPreview = qrType === 'qr-plus' || qrType === 'qr-canvas' || qrType === 'qr-play';
  
  return (
    <div className="space-y-6">
      <div className="text-center mb-6">
        <h2 className="text-lg font-bold text-white mb-2">Preview Your Creation</h2>
        <p className="text-slate-400">Review before publishing to your store</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Product Preview */}
        <div className="space-y-3">
          <p className="text-sm font-medium text-slate-300">Product</p>
          <div className="aspect-square bg-slate-800 rounded-xl flex items-center justify-center border border-slate-700">
            {product?.thumbnailUrl ? (
              <img 
                src={product.thumbnailUrl} 
                alt={product.name}
                className="w-full h-full object-contain"
              />
            ) : (
              <div className="text-center">
                <Package className="w-16 h-16 text-slate-600 mx-auto mb-2" />
                <p className="text-slate-500 text-sm">{product?.name || 'No product'}</p>
              </div>
            )}
          </div>
        </div>

        {/* QR Graphic Preview */}
        <div className="space-y-3">
          <p className="text-sm font-medium text-slate-300">QR Graphic</p>
          <div className="flex justify-center">
            {showGraphicPreview ? (
              <GraphicPreviewView
                backgroundColor={background ? undefined : '#1a1a2e'}
                backgroundImage={background || undefined}
                headerStyle={headerStyle}
                footerStyle={footerStyle}
                showQRCode={true}
                aspectRatio="square"
              />
            ) : (
              <div className="w-48 h-48 bg-slate-800 rounded-xl flex items-center justify-center border border-slate-700">
                <QrCode className="w-16 h-16 text-slate-600" />
              </div>
            )}
          </div>
        </div>
      </div>

      <Card className="bg-slate-800/50 border-slate-700">
        <CardContent className="p-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-slate-400">Product</p>
              <p className="text-white font-medium">{product?.name || 'Not selected'}</p>
            </div>
            <div>
              <p className="text-xs text-slate-400">QR Type</p>
              <p className="text-white font-medium">{QR_TYPES.find(t => t.id === qrType)?.label || qrType}</p>
            </div>
            {(headerStyle.enabled || footerStyle.enabled) && (
              <div>
                <p className="text-xs text-slate-400">Text Lines</p>
                <p className="text-white font-medium">
                  {[headerStyle.enabled && 'Header', footerStyle.enabled && 'Footer'].filter(Boolean).join(' + ')}
                </p>
              </div>
            )}
            {background && (
              <div>
                <p className="text-xs text-slate-400">Background</p>
                <Badge className="bg-purple-600/20 text-purple-400">Custom Image</Badge>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function PublishStep({ 
  isPublishing,
  onPublish,
  selectedChannel
}: { 
  isPublishing: boolean;
  onPublish: () => void;
  selectedChannel: { id: string; name: string } | null;
}) {
  return (
    <div className="space-y-6">
      <div className="text-center mb-6">
        <h2 className="text-xl font-bold text-white mb-2">Ready to Publish!</h2>
        <p className="text-slate-400">Your product will be added to your channel</p>
      </div>

      <div className="max-w-md mx-auto space-y-4">
        <div className="p-4 bg-slate-800/50 border border-slate-600 rounded-lg">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-500">
              <Layers className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="text-sm text-slate-400">Publishing to</p>
              <p className="text-lg font-medium text-white">{selectedChannel?.name || 'Unknown Channel'}</p>
            </div>
          </div>
        </div>

        <Button
          onClick={onPublish}
          disabled={isPublishing || !selectedChannel}
          className="w-full bg-blue-600 hover:bg-blue-700"
          data-testid="button-publish"
        >
          {isPublishing ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Publishing...
            </>
          ) : (
            <>
              <Send className="w-4 h-4 mr-2" />
              Publish Item
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

interface MemberProduct {
  id: string;
  name: string;
  thumbnailUrl?: string;
  price: number;
  status: string;
  channelId?: string;
}

interface ChannelMedia {
  id: string;
  channelId: string;
  type: 'image' | 'video' | 'document';
  url: string;
  name: string;
  thumbnailUrl?: string;
  createdAt: string;
}

interface EarningsSummary {
  total: number;
  pending: number;
  paid: number;
  profitShare: number;
}

interface MemberIndexViewProps {
  memberId: string;
  onNavigate: (view: ViewMode) => void;
  onStartWizard: (tier: WizardTier) => void;
  publishCount: number;
}

function MemberIndexView({ memberId, onNavigate, onStartWizard, publishCount }: MemberIndexViewProps) {
  const [hasSeenIntro, setHasSeenIntro] = useState(false); // Disabled for testing

  const { data: channels } = useQuery<MemberChannel[]>({
    queryKey: ['/api/members', memberId, 'channels'],
    queryFn: async () => {
      if (!memberId) return [];
      const headers = await getAuthHeaders();
      const res = await fetch(`/api/members/${memberId}/channels`, { headers });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!memberId
  });

  const { data: products } = useQuery<MemberProduct[]>({
    queryKey: ['/api/members', memberId, 'products'],
    queryFn: async () => {
      if (!memberId) return [];
      const headers = await getAuthHeaders();
      const res = await fetch(`/api/members/${memberId}/products`, { headers });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!memberId
  });

  const { data: earnings } = useQuery<EarningsSummary>({
    queryKey: ['/api/members', memberId, 'earnings'],
    queryFn: async () => {
      if (!memberId) return { total: 0, pending: 0, paid: 0, profitShare: 25 };
      const headers = await getAuthHeaders();
      const res = await fetch(`/api/members/${memberId}/earnings`, { headers });
      if (!res.ok) return { total: 0, pending: 0, paid: 0, profitShare: 25 };
      return res.json();
    },
    enabled: !!memberId
  });

  const channelCount = channels?.length || 0;
  const productCount = products?.length || 0;
  const totalEarnings = earnings?.total || 0;

  const handleGetStarted = () => {
    localStorage.setItem(`member_intro_seen_${memberId}`, 'true');
    setHasSeenIntro(true);
    onStartWizard('simple');
  };

  if (!hasSeenIntro) {
    return (
      <div className="space-y-6">
        <Card className="bg-gradient-to-br from-blue-900/50 to-purple-900/50 border-blue-500/30">
          <CardContent className="p-8 text-center">
            <div className="mb-6">
              <div className="w-20 h-20 mx-auto mb-4 bg-gradient-to-br from-blue-500 to-purple-500 rounded-full flex items-center justify-center">
                <QrCode className="w-10 h-10 text-white" />
              </div>
              <h1 className="text-3xl font-bold text-white mb-2">Welcome to QR Gear Creator</h1>
              <p className="text-lg text-blue-200">Turn your ideas into sellable products</p>
            </div>

            <div className="max-w-2xl mx-auto text-left space-y-4 mb-8">
              <div className="flex items-start gap-4 p-4 bg-white/5 rounded-lg">
                <div className="w-10 h-10 bg-green-500/20 rounded-full flex items-center justify-center flex-shrink-0">
                  <Package className="w-5 h-5 text-green-400" />
                </div>
                <div>
                  <h3 className="font-semibold text-white">Create Custom Products</h3>
                  <p className="text-sm text-slate-300">Design t-shirts, mugs, and more with your own QR codes and graphics. We handle printing and shipping.</p>
                </div>
              </div>

              <div className="flex items-start gap-4 p-4 bg-white/5 rounded-lg">
                <div className="w-10 h-10 bg-blue-500/20 rounded-full flex items-center justify-center flex-shrink-0">
                  <Layers className="w-5 h-5 text-blue-400" />
                </div>
                <div>
                  <h3 className="font-semibold text-white">Organize in Channels</h3>
                  <p className="text-sm text-slate-300">Group your products into channels for different brands, events, or themes. Share a channel link to showcase your collection.</p>
                </div>
              </div>

              <div className="flex items-start gap-4 p-4 bg-white/5 rounded-lg">
                <div className="w-10 h-10 bg-purple-500/20 rounded-full flex items-center justify-center flex-shrink-0">
                  <QrCode className="w-5 h-5 text-purple-400" />
                </div>
                <div>
                  <h3 className="font-semibold text-white">QR Dynamics</h3>
                  <p className="text-sm text-slate-300">Create rotating experiences - one QR code can show different content each time it's scanned.</p>
                </div>
              </div>

              <div className="flex items-start gap-4 p-4 bg-white/5 rounded-lg">
                <div className="w-10 h-10 bg-amber-500/20 rounded-full flex items-center justify-center flex-shrink-0">
                  <DollarSign className="w-5 h-5 text-amber-400" />
                </div>
                <div>
                  <h3 className="font-semibold text-white">Earn Money</h3>
                  <p className="text-sm text-slate-300">You keep 25% of every sale. We track your earnings and handle payments automatically.</p>
                </div>
              </div>
            </div>

            <Button
              onClick={handleGetStarted}
              className="bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-400 hover:to-emerald-400 text-white px-4 py-3 text-sm md:px-8 md:py-4 md:text-base h-auto whitespace-normal text-center"
              data-testid="button-get-started"
            >
              <Wand2 className="w-4 h-4 mr-2 flex-shrink-0" />
              <span>Create Your First Product</span>
              <ArrowRight className="w-4 h-4 ml-2 flex-shrink-0" />
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="bg-gradient-to-br from-slate-800/80 to-slate-900/80 border-slate-700">
        <CardHeader className="flex flex-row items-center justify-between gap-2">
          <CardTitle className="text-white flex items-center gap-2">
            <User className="w-5 h-5" />
            My Dashboard
          </CardTitle>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                localStorage.removeItem(`member_intro_seen_${memberId}`);
                setHasSeenIntro(false);
              }}
              className="text-xs text-slate-500 hover:text-white"
              data-testid="button-reset-intro"
            >
              Reset Intro
            </button>
            <Button
              size="sm"
              onClick={() => onStartWizard('simple')}
              className="bg-green-600 hover:bg-green-500"
              data-testid="button-new-product"
            >
              <Plus className="w-4 h-4 md:mr-1" />
              <span className="hidden md:inline">New</span>
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <button
              onClick={() => onNavigate('channels')}
              className="bg-slate-700/50 rounded-lg p-4 text-center hover:bg-slate-600/50 transition-colors"
              data-testid="stat-products"
            >
              <Package className="w-8 h-8 mx-auto mb-2 text-blue-400" />
              <div className="text-lg font-bold text-white">{productCount}</div>
              <div className="text-sm text-slate-400">Products</div>
            </button>
            <button
              onClick={() => onNavigate('channels')}
              className="bg-slate-700/50 rounded-lg p-4 text-center hover:bg-slate-600/50 transition-colors"
              data-testid="stat-channels"
            >
              <Layers className="w-8 h-8 mx-auto mb-2 text-purple-400" />
              <div className="text-lg font-bold text-white">{channelCount}</div>
              <div className="text-sm text-slate-400">Channels</div>
            </button>
            <button
              onClick={() => onNavigate('earnings')}
              className="bg-slate-700/50 rounded-lg p-4 text-center hover:bg-slate-600/50 transition-colors"
              data-testid="stat-earnings"
            >
              <DollarSign className="w-8 h-8 mx-auto mb-2 text-green-400" />
              <div className="text-lg font-bold text-white">${totalEarnings.toFixed(2)}</div>
              <div className="text-sm text-slate-400">Earnings</div>
            </button>
            <button
              onClick={() => onNavigate('collections')}
              className="bg-slate-700/50 rounded-lg p-4 text-center hover:bg-slate-600/50 transition-colors"
              data-testid="stat-dynamics"
            >
              <QrCode className="w-8 h-8 mx-auto mb-2 text-amber-400" />
              <div className="text-lg font-bold text-white">{publishCount}</div>
              <div className="text-sm text-slate-400">Published</div>
            </button>
          </div>
        </CardContent>
      </Card>

      {channelCount > 0 && (
        <Card className="bg-slate-800/50 border-slate-700">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-white flex items-center gap-2">
              <Layers className="w-5 h-5" />
              My Channels
            </CardTitle>
            <Button variant="ghost" size="sm" onClick={() => onNavigate('channels')} data-testid="view-all-channels">
              View All
              <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {(channels || []).slice(0, 4).map((channel) => (
                <div
                  key={channel.id}
                  className="p-3 bg-slate-700/50 rounded-lg border border-slate-600 hover:border-blue-500 transition-colors cursor-pointer flex items-center justify-between"
                  data-testid={`channel-preview-${channel.id}`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-blue-500/20 rounded-lg flex items-center justify-center">
                      <Layers className="w-5 h-5 text-blue-400" />
                    </div>
                    <div>
                      <h4 className="font-medium text-white">{channel.name}</h4>
                      <p className="text-xs text-slate-400">
                        {(products || []).filter(p => p.channelId === channel.id).length} items
                      </p>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-500" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {channelCount === 0 && (
        <Card className="bg-slate-800/50 border-slate-700 border-dashed">
          <CardContent className="p-8 text-center">
            <Layers className="w-12 h-12 mx-auto mb-3 text-slate-500" />
            <h3 className="text-lg font-medium text-white mb-1">No channels yet</h3>
            <p className="text-slate-400 mb-4">Create your first product to start a channel</p>
            <Button onClick={() => onStartWizard('simple')} className="bg-green-600 hover:bg-green-500" data-testid="create-first-product">
              <Wand2 className="w-4 h-4 mr-2" />
              Create First Product
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function ChannelsView({ memberId }: { memberId: string }) {
  const { data: channels, isLoading } = useQuery<MemberChannel[]>({
    queryKey: ['/api/members', memberId, 'channels'],
    queryFn: async () => {
      if (!memberId) return [];
      const headers = await getAuthHeaders();
      const res = await fetch(`/api/members/${memberId}/channels`, { headers });
      if (!res.ok) throw new Error('Failed to fetch channels');
      return res.json();
    },
    enabled: !!memberId
  });

  const { data: products } = useQuery<MemberProduct[]>({
    queryKey: ['/api/members', memberId, 'products'],
    queryFn: async () => {
      if (!memberId) return [];
      const headers = await getAuthHeaders();
      const res = await fetch(`/api/members/${memberId}/products`, { headers });
      if (!res.ok) throw new Error('Failed to fetch products');
      return res.json();
    },
    enabled: !!memberId
  });

  const channelList = channels || [];
  const productList = products || [];

  return (
    <Card className="bg-slate-800/50 border-slate-700">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-white flex items-center gap-2">
          <Layers className="w-5 h-5" />
          My Channels
        </CardTitle>
        <Button size="sm" className="bg-blue-600 hover:bg-blue-500" data-testid="button-create-channel">
          <Plus className="w-4 h-4 mr-1" />
          New Channel
        </Button>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full" />
          </div>
        ) : channelList.length === 0 ? (
          <div className="text-center py-12 text-slate-400">
            <Layers className="w-16 h-16 mx-auto mb-4 opacity-50" />
            <p className="mb-2">No channels yet</p>
            <p className="text-sm">Create your first item to start a channel</p>
          </div>
        ) : (
          <div className="space-y-4">
            {channelList.map((channel) => {
              const channelProducts = productList.filter(p => p.channelId === channel.id);
              return (
                <div 
                  key={channel.id} 
                  className="p-4 bg-slate-700/50 rounded-lg border border-slate-600 hover:border-blue-500 transition-colors cursor-pointer"
                  data-testid={`channel-${channel.id}`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-white font-medium">{channel.name}</h3>
                      <p className="text-sm text-slate-400">
                        {channelProducts.length} items {channel.createdAt && `· Created ${new Date(channel.createdAt).toLocaleDateString()}`}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" data-testid={`share-channel-${channel.id}`}>
                        <Share2 className="w-4 h-4" />
                      </Button>
                      <Button size="sm" variant="outline" data-testid={`view-channel-${channel.id}`}>
                        <ExternalLink className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function CollectionsView({ memberId }: { memberId: string }) {
  const { data: collections, isLoading } = useQuery<any[]>({
    queryKey: ['/api/members', memberId, 'collections'],
    queryFn: async () => {
      if (!memberId) return [];
      // Use the QR Dynamics collections endpoint, filtered by member
      const res = await fetch(`/api/test/stores/qr-gear/collections?ownerId=${memberId}`);
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!memberId
  });

  const collectionList = collections || [];

  return (
    <Card className="bg-slate-800/50 border-slate-700">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-white flex items-center gap-2">
          <QrCode className="w-5 h-5" />
          My Collections (Dynamics)
        </CardTitle>
        <Button size="sm" className="bg-blue-600 hover:bg-blue-500" data-testid="button-create-collection">
          <Plus className="w-4 h-4 mr-1" />
          New Collection
        </Button>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full" />
          </div>
        ) : collectionList.length === 0 ? (
          <div className="text-center py-12 text-slate-400">
            <QrCode className="w-16 h-16 mx-auto mb-4 opacity-50" />
            <p className="mb-2">No collections yet</p>
            <p className="text-sm">Build rotating QR experiences from your items</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {collectionList.map((collection: any) => (
              <div 
                key={collection.id} 
                className="p-4 bg-slate-700/50 rounded-lg border border-slate-600 hover:border-blue-500 transition-colors cursor-pointer"
                data-testid={`collection-${collection.id}`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-white font-medium">{collection.name}</h3>
                    <p className="text-sm text-slate-400">
                      {collection.itemCount || 0} items · {collection.rotationInterval || 'daily'} rotation
                    </p>
                  </div>
                  <Badge variant="outline" className="text-blue-400 border-blue-400">
                    Active
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function EarningsView({ memberId }: { memberId: string }) {
  const { data: earningsData, isLoading } = useQuery<{ earnings: any[], summary: EarningsSummary }>({
    queryKey: ['/api/members', memberId, 'earnings'],
    queryFn: async () => {
      if (!memberId) return { earnings: [], summary: { total: 0, pending: 0, paid: 0, profitShare: 0.25 } };
      const headers = await getAuthHeaders();
      const res = await fetch(`/api/members/${memberId}/earnings`, { headers });
      if (!res.ok) throw new Error('Failed to fetch earnings');
      return res.json();
    },
    enabled: !!memberId
  });

  const summary = earningsData?.summary || { total: 0, pending: 0, paid: 0, profitShare: 0.25 };
  const earnings = earningsData?.earnings || [];

  return (
    <Card className="bg-slate-800/50 border-slate-700">
      <CardHeader>
        <CardTitle className="text-white flex items-center gap-2">
          <DollarSign className="w-5 h-5" />
          Earnings Dashboard
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full" />
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <Card className="bg-slate-700/50 border-slate-600">
                <CardContent className="p-4 text-center">
                  <p className="text-sm text-slate-400">Total Earnings</p>
                  <p className="text-2xl font-bold text-green-400">${summary.total.toFixed(2)}</p>
                </CardContent>
              </Card>
              <Card className="bg-slate-700/50 border-slate-600">
                <CardContent className="p-4 text-center">
                  <p className="text-sm text-slate-400">Pending</p>
                  <p className="text-2xl font-bold text-yellow-400">${summary.pending.toFixed(2)}</p>
                </CardContent>
              </Card>
              <Card className="bg-slate-700/50 border-slate-600">
                <CardContent className="p-4 text-center">
                  <p className="text-sm text-slate-400">Profit Share</p>
                  <p className="text-2xl font-bold text-blue-400">{(summary.profitShare * 100).toFixed(0)}%</p>
                </CardContent>
              </Card>
            </div>
            
            {earnings.length === 0 ? (
              <div className="text-center py-8 text-slate-400">
                <BarChart3 className="w-16 h-16 mx-auto mb-4 opacity-50" />
                <p className="mb-2">No sales yet</p>
                <p className="text-sm">Share your products to start earning {(summary.profitShare * 100).toFixed(0)}% profit</p>
              </div>
            ) : (
              <div className="space-y-2">
                <h3 className="text-white font-medium mb-3">Recent Earnings</h3>
                {earnings.slice(0, 5).map((earning: any) => (
                  <div key={earning.id} className="flex justify-between items-center p-3 bg-slate-700/50 rounded-lg">
                    <div>
                      <p className="text-white text-sm">{earning.productName || 'Product Sale'}</p>
                      <p className="text-xs text-slate-400">{new Date(earning.createdAt).toLocaleDateString()}</p>
                    </div>
                    <Badge variant={earning.status === 'paid' ? 'default' : 'secondary'}>
                      ${earning.amount?.toFixed(2) || '0.00'}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

type ViewMode = 'index' | 'wizard' | 'channels' | 'collections' | 'earnings';

function MembersSandboxContent() {
  const { user, isLoading: authLoading, isAuthenticated } = useAuth();
  const { toast } = useToast();
  const { api } = useMembersContext();
  
  const [viewMode, setViewMode] = useState<ViewMode>('index');
  const [currentStep, setCurrentStep] = useState<WizardStep>('channel');
  const [simpleStep, setSimpleStep] = useState<SimpleWizardStep>('product');
  const [completedSteps, setCompletedSteps] = useState<Set<WizardStep>>(new Set());
  const [wizardTier, setWizardTier] = useState<WizardTier>('simple');
  const [publishCount, setPublishCount] = useState(0);
  const [showUnlockPrompt, setShowUnlockPrompt] = useState<'advanced' | 'studio' | null>(null);
  const [selectedChannel, setSelectedChannel] = useState<{ id: string; name: string } | null>(null);
  const [isCreatingChannel, setIsCreatingChannel] = useState(false);
  const [newChannelName, setNewChannelName] = useState('');
  
  // Simple wizard state
  const [simpleTitle, setSimpleTitle] = useState('');
  const [simpleDescription, setSimpleDescription] = useState('');
  // Title position (vertical: 0=bottom, 100=top; horizontal: 0=left, 100=right)
  const [titleVertical, setTitleVertical] = useState(15);
  const [titleHorizontal, setTitleHorizontal] = useState(50);
  // Title styling
  const [titleColor, setTitleColor] = useState('#ffffff');
  const [titleSize, setTitleSize] = useState('18px');
  const [titleFont, setTitleFont] = useState('Arial');
  // Description position
  const [descVertical, setDescVertical] = useState(8);
  const [descHorizontal, setDescHorizontal] = useState(50);
  // Description styling
  const [descColor, setDescColor] = useState('#e2e8f0');
  const [descSize, setDescSize] = useState('14px');
  const [descFont, setDescFont] = useState('Arial');
  
  // New wizard state: product selection
  const [selectedProductType, setSelectedProductType] = useState<AllowedProduct | null>(null);
  const [selectedColor, setSelectedColor] = useState<string>('');
  const [selectedShirtSize, setSelectedShirtSize] = useState<string>('');
  const [graphicLocation, setGraphicLocation] = useState<GraphicLocation>('');
  const [graphicSize, setGraphicSize] = useState<GraphicSize>('');
  const [wantsHeaderFooter, setWantsHeaderFooter] = useState<boolean | null>(null);
  
  // Progressive packet - created when product is selected, updated as wizard proceeds
  const [currentPacketId, setCurrentPacketId] = useState<string | null>(null);
  
  // Running earnings total - accumulates as items are created
  const [runningEarnings, setRunningEarnings] = useState<number>(0);
  
  // Fetch pricing settings from API for dynamic earnings calculations
  const { data: pricingSettings } = useQuery<{
    memberProfitShare: number;
    additionalPlacementCost: number;
    sizeUpcharges: Record<string, number>;
    baseRetailPrice: number;
  }>({
    queryKey: ['/api/test/pricing-settings'],
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });
  
  // Calculate earnings bonuses from pricing settings
  const placementEarningsBonus = (pricingSettings?.additionalPlacementCost || 4) * (pricingSettings?.memberProfitShare || 0.25);
  const sizeEarningsIncrement = (pricingSettings?.sizeUpcharges?.['M'] || 2) * (pricingSettings?.memberProfitShare || 0.25);
  
  // Load publish count from localStorage
  useEffect(() => {
    if (user?.id) {
      const count = parseInt(localStorage.getItem(`publish_count_${user.id}`) || '0', 10);
      setPublishCount(count);
      // Auto-select appropriate tier based on count
      if (count === 0) {
        setWizardTier('simple');
      }
    }
  }, [user?.id]);
  
  // Increment publish count and show unlock prompts
  const incrementPublishCount = () => {
    if (user?.id) {
      const newCount = publishCount + 1;
      localStorage.setItem(`publish_count_${user.id}`, String(newCount));
      setPublishCount(newCount);
      
      // Show unlock prompts at milestones
      if (newCount === 1) {
        setShowUnlockPrompt('advanced');
      } else if (newCount === 2) {
        setShowUnlockPrompt('studio');
      }
    }
  };
  
  // Determine what tiers are unlocked
  const unlockedTiers = {
    simple: true, // Always available
    advanced: publishCount >= 1,
    studio: publishCount >= 2
  };
  
  const [selectedProduct, setSelectedProduct] = useState<ProductItem | null>(null);
  const [placementConfigs, setPlacementConfigs] = useState<Record<string, PlacementConfig>>({});
  const [qrType, setQrType] = useState<QRType>('');
  const [qrDestination, setQrDestination] = useState<string>('');
  const [channelName, setChannelName] = useState<string>('My Products');
  const [isPublishing, setIsPublishing] = useState(false);
  
  // Step state - shared components
  const [headerStyle, setHeaderStyle] = useState<TextStyleConfig>({ ...defaultTextStyle });
  const [footerStyle, setFooterStyle] = useState<TextStyleConfig>({ ...defaultTextStyle });
  const [productGraphic, setProductGraphic] = useState<string>(''); // Graphic on shirt/cup/product
  const [originalUrlGraphic, setOriginalUrlGraphic] = useState<string>('');
  const [urlGraphic, setUrlGraphic] = useState<string>(''); // Graphic shown on phone when QR is scanned
  const [showBackgroundLibrary, setShowBackgroundLibrary] = useState(false);
  const [landingPage, setLandingPage] = useState<LandingPageConfig>({ ...defaultLandingPage });
  const [videoUrl, setVideoUrl] = useState<string>('');
  
  // Simple wizard text state
  const [textLayoutChoice, setTextLayoutChoice] = useState<TextLayoutChoice>('');
  const [selectedPlacements, setSelectedPlacements] = useState<PlacementOption[]>([]);
  const [wantsText, setWantsText] = useState<boolean | null>(null);
  const [qrGraphic, setQrGraphic] = useState<string>(''); // The actual QR code image
  const [isGeneratingQr, setIsGeneratingQr] = useState(false);
  const [urlSourceChoice, setUrlSourceChoice] = useState<UrlSourceChoice>('');
  const [libraryChoice, setLibraryChoice] = useState<LibraryChoice>('');
  
  // Multi-placement loop state - track which placement we're currently configuring
  const [currentPlacementIndex, setCurrentPlacementIndex] = useState<number>(0);
  // Current placement's graphic choice (full graphic or QR only)
  const [placementGraphicChoice, setPlacementGraphicChoice] = useState<PlacementGraphicChoice>('');
  const [placementSize, setPlacementSize] = useState<GraphicSize>('');
  // Per-placement configurations: stores graphic choice and size for each placement
  const [perPlacementConfigs, setPerPlacementConfigs] = useState<Record<PlacementOption, {
    graphicChoice: PlacementGraphicChoice;
    size: GraphicSize;
  }>>({} as any);
  // Per-placement graphic sizes (step 6 loop)
  const [perPlacementSizes, setPerPlacementSizes] = useState<Record<PlacementOption, GraphicSize>>({} as any);
  
  // QR Basic flow state (when user says No to header/footer)
  const [qrBasicInputType, setQrBasicInputType] = useState<QRBasicInputType>('');
  const [qrBasicContent, setQrBasicContent] = useState<string>('');
  const [qrBasicMockup, setQrBasicMockup] = useState<string>(''); // The product mockup image
  const [isGeneratingBasicMockup, setIsGeneratingBasicMockup] = useState(false);
  const [qrBasicSaveChoice, setQrBasicSaveChoice] = useState<QRBasicSaveOption>('');
  const [isQrBasicSaving, setIsQrBasicSaving] = useState(false);
  
  // QR Plus flow state (fork at step 12 for qr-plus type)
  const [qrPlusMockup, setQrPlusMockup] = useState<string>(''); // The product mockup image with full graphic
  const [isGeneratingPlusMockup, setIsGeneratingPlusMockup] = useState(false);
  const [qrPlusSaveChoice, setQrPlusSaveChoice] = useState<QRPlusSaveOption>('');
  const [isQrPlusSaving, setIsQrPlusSaving] = useState(false);
  
  // Get current placement being configured
  const currentPlacement = selectedPlacements[currentPlacementIndex] || 'front';

  // === SIMPLE WIZARD HANDLERS ===
  const generatePreviewQrCode = async () => {
    // Generate a QR code pointing to a preview URL
    const previewUrl = `${window.location.origin}/preview/${Date.now()}`;
    const qrApiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(previewUrl)}`;
    setQrGraphic(qrApiUrl);
    setProductGraphic(qrApiUrl); // Store as the graphic for the shirt/product
    return qrApiUrl;
  };

  // Create packet when product is selected (step 1)
  const createPacketForProduct = async (product: AllowedProduct) => {
    try {
      console.log('[Wizard] Creating packet for product:', {
        blueprintId: product.blueprintId,
        printProviderId: product.printProviderId,
        title: product.title,
        memberEarnings: product.memberEarnings,
        retailPrice: product.retailPrice,
        baseCost: product.baseCost,
      });
      
      const authHeaders = await getAuthHeaders();
      // Use a placeholder QR URL - will be replaced when user enters actual QR content
      const placeholderQrUrl = generateQRCodeUrl('placeholder', 200);
      
      const packetPayload = {
        memberId: user?.id,
        kind: 'qr_basic',
        background: { url: placeholderQrUrl },
        boundProduct: {
          blueprintId: product.blueprintId,
          printProviderId: product.printProviderId,
          title: product.title,
          imageUrl: product.imageUrl,
          memberEarnings: product.memberEarnings || 0,
          retailPrice: product.retailPrice || 0,
          baseCost: product.baseCost || 0,
        },
        metadata: {},
        source: { entryPoint: 'simple-wizard' },
        status: 'building',
      };
      
      const res = await fetch('/api/member/packets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify(packetPayload),
      });
      
      if (res.ok) {
        const data = await res.json();
        console.log('[Wizard] Created packet on product select:', data.packetId);
        setCurrentPacketId(data.packetId);
        return data.packetId;
      } else {
        const errorData = await res.json();
        console.error('[Wizard] Packet creation failed:', errorData);
      }
    } catch (error) {
      console.error('[Wizard] Failed to create packet:', error);
    }
    return null;
  };

  // Update packet as wizard proceeds
  const updatePacket = async (updates: Record<string, any>) => {
    if (!currentPacketId || !user?.id) {
      console.warn('[Wizard] No packet or user to update');
      return false;
    }
    try {
      const authHeaders = await getAuthHeaders();
      const res = await fetch(`/api/members/${user.id}/packets/${currentPacketId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify(updates),
      });
      if (res.ok) {
        console.log('[Wizard] Updated packet:', currentPacketId, Object.keys(updates));
        return true;
      }
      console.error('[Wizard] Packet update failed:', await res.json());
      return false;
    } catch (error) {
      console.error('[Wizard] Failed to update packet:', error);
      return false;
    }
  };

  // Save QR Basic assets to packet
  const saveQrBasicToPacket = async () => {
    if (!currentPacketId || !user?.id) return false;
    
    setIsQrBasicSaving(true);
    try {
      const updates: Record<string, any> = {
        kind: 'qr_basic',
        qrGraphic: qrGraphic || null,
        qrBasicMockup: qrBasicMockup || null,
        qrBasicSaveChoice: qrBasicSaveChoice,
        status: 'saved',
      };
      
      const success = await updatePacket(updates);
      console.log('[Wizard] QR Basic saved to packet:', { success, saveChoice: qrBasicSaveChoice });
      return success;
    } finally {
      setIsQrBasicSaving(false);
    }
  };

  // Save QR Plus assets to packet
  const saveQrPlusToPacket = async () => {
    if (!currentPacketId || !user?.id) {
      console.error('[QR Plus Save] Missing packet or user:', { currentPacketId, userId: user?.id });
      return false;
    }
    
    setIsQrPlusSaving(true);
    try {
      // Log EXACTLY what we're saving
      console.log('[QR Plus Save] Preparing to save:', {
        packetId: currentPacketId,
        qrGraphic: qrGraphic ? qrGraphic.substring(0, 80) + '...' : 'EMPTY!',
        productGraphic: productGraphic ? productGraphic.substring(0, 80) + '...' : 'EMPTY!',
        qrPlusMockup: qrPlusMockup ? qrPlusMockup.substring(0, 80) + '...' : 'EMPTY!',
        saveChoice: qrPlusSaveChoice,
      });
      
      const updates: Record<string, any> = {
        kind: 'qr_plus',
        qrGraphic: qrGraphic || null,
        productGraphic: productGraphic || null,
        qrPlusMockup: qrPlusMockup || null,
        qrPlusSaveChoice: qrPlusSaveChoice,
        headerStyle: headerStyle,
        footerStyle: footerStyle,
        status: 'saved',
      };
      
      const success = await updatePacket(updates);
      console.log('[QR Plus Save] Result:', { success, packetId: currentPacketId });
      return success;
    } finally {
      setIsQrPlusSaving(false);
    }
  };

  // Handle product selection - creates packet immediately
  const handleProductSelect = async (product: AllowedProduct) => {
    setSelectedProductType(product);
    await createPacketForProduct(product);
  };

  const handleSimpleNext = async () => {
    // Add earnings when leaving product-congrats step
    if (simpleStep === 'product-congrats' && selectedProductType) {
      setRunningEarnings(prev => prev + (selectedProductType.memberEarnings || 0));
    }
    
    // Handle QR Basic flow navigation
    if (simpleStep === 'qr-basic-type') {
      setSimpleStep('qr-basic-input');
      return;
    }
    if (simpleStep === 'qr-basic-input') {
      // Generate QR and get Printify mockup
      setIsGeneratingBasicMockup(true);
      try {
        const authHeaders = await getAuthHeaders();
        
        // Step 1: Generate QR code URL using robust utility (black on white, high quality)
        const qrContent = qrBasicContent;
        const qrApiUrl = generateQRCodeUrl(qrContent, 1000);
        
        // Step 2: Update the existing packet (created when product was selected) with QR content
        if (currentPacketId) {
          await updatePacket({
            urlContent: qrBasicInputType === 'url' ? qrContent : null,
            graphicUrl: qrApiUrl,
            textLayers: qrBasicInputType === 'text' ? [{ text: qrContent, type: 'content' }] : [],
            'boundProduct.color': selectedColor,
            'boundProduct.size': selectedShirtSize,
            'boundProduct.blueprintId': selectedProductType?.blueprintId,
            'boundProduct.printProviderId': selectedProductType?.printProviderId,
            'metadata.inputType': qrBasicInputType,
            'metadata.graphicSize': graphicSize,
            'metadata.placements': selectedPlacements,
            'metadata.perPlacementSizes': perPlacementSizes,
            status: 'draft',
          });
          console.log('[QR Basic] Updated packet with QR content:', currentPacketId);
        }
        
        // Step 3: Get Printify mockup using product info from state (packet was created on product select)
        if (selectedProductType?.blueprintId && selectedProductType?.printProviderId && selectedColor) {
          const effectiveQrSize = (graphicSize === 'small' || graphicSize === 'medium' || graphicSize === 'large') ? graphicSize : 'medium';
          console.log('[QR Basic] Generating mockup with graphicSize:', graphicSize, '→ effectiveQrSize:', effectiveQrSize);
          const mockupResult = await api.generateMockup({
            blueprintId: selectedProductType.blueprintId,
            printProviderId: selectedProductType.printProviderId,
            colorName: selectedColor,
            artworkUrl: qrApiUrl,
            placement: 'FRONT_CHEST',
            qrSize: effectiveQrSize,
          });
          
          // Normalize result - api.generateMockup returns lifestyleMockupUrl instead of lifestyleUrl
          const bestUrl = mockupResult.lifestyleMockupUrl || mockupResult.mockupUrl;
          if (mockupResult.success && bestUrl) {
            console.log('[QR Basic] Got mockup:', { 
              lifestyle: !!mockupResult.lifestyleMockupUrl, 
              flat: !!mockupResult.mockupUrl,
              fromCache: mockupResult.fromCache 
            });
            setQrBasicMockup(bestUrl);
          } else {
            console.warn('[QR Basic] Mockup fetch failed:', mockupResult.error);
            setQrBasicMockup(qrApiUrl);
          }
        } else {
          console.warn('[QR Basic] Missing product info for mockup - blueprintId:', selectedProductType?.blueprintId, 'printProviderId:', selectedProductType?.printProviderId, 'color:', selectedColor);
          setQrBasicMockup(qrApiUrl);
        }
      } catch (error) {
        console.error('[QR Basic] Error generating mockup:', error);
        // Fallback to QR preview using robust utility
        setQrBasicMockup(generateQRCodeUrl(qrBasicContent, 300));
      } finally {
        setIsGeneratingBasicMockup(false);
      }
      setSimpleStep('qr-basic-mockup');
      return;
    }
    if (simpleStep === 'qr-basic-mockup') {
      setSimpleStep('qr-basic-save-choice');
      return;
    }
    if (simpleStep === 'qr-basic-save-choice') {
      // Save to packet then move to confirmation
      await saveQrBasicToPacket();
      setSimpleStep('qr-basic-confirm');
      return;
    }
    if (simpleStep === 'qr-basic-confirm') {
      // End of QR Basic flow - reset wizard
      setSimpleStep('product');
      setCurrentPacketId(null);
      setQrBasicInputType('');
      setQrBasicContent('');
      setQrBasicMockup('');
      setQrBasicSaveChoice('');
      return;
    }
    
    // Handle QR Plus flow navigation
    if (simpleStep === 'qr-plus-mockup') {
      setSimpleStep('qr-plus-save-choice');
      return;
    }
    if (simpleStep === 'qr-plus-save-choice') {
      // Save to packet then move to confirmation
      await saveQrPlusToPacket();
      setSimpleStep('qr-plus-confirm');
      return;
    }
    if (simpleStep === 'qr-plus-confirm') {
      // End of QR Plus flow - reset wizard
      setSimpleStep('product');
      setCurrentPacketId(null);
      setQrPlusMockup('');
      setQrPlusSaveChoice('');
      return;
    }
    
    // Select correct steps array based on qrType
    const stepsArray = qrType === 'qr-basic' ? QR_BASIC_STEPS
      : qrType === 'qr-plus' ? QR_PLUS_STEPS
      : SIMPLE_WIZARD_STEPS;
    const currentIndex = stepsArray.findIndex(s => s.id === simpleStep);
    
    // Reset placement index when entering graphic-size from placement-count
    if (simpleStep === 'placement-count') {
      setCurrentPlacementIndex(0);
      setGraphicSize('');
    }
    
    // Graphic-size loop - save size for current placement and loop through all
    if (simpleStep === 'graphic-size') {
      // Save size for current placement
      setPerPlacementSizes(prev => ({
        ...prev,
        [currentPlacement]: graphicSize
      }));
      
      // Check if more placements to configure
      if (currentPlacementIndex < selectedPlacements.length - 1) {
        // More placements - stay on graphic-size, move to next
        setCurrentPlacementIndex(prev => prev + 1);
        setGraphicSize(''); // Reset for next placement
        return; // Stay on graphic-size step
      }
      // All placements have sizes - proceed to generate step
    }
    
    // After text-edit, reset placement index for the placement-config loop
    if (simpleStep === 'text-edit') {
      setCurrentPlacementIndex(0);
      setPlacementGraphicChoice('');
      // Reset size for first placement
      setPlacementSize('');
    }
    
    // Save current placement config when leaving placement-config step
    if (simpleStep === 'placement-config') {
      // Use the size saved from graphic-size step for this placement
      const savedSize = perPlacementSizes[currentPlacement] || 'medium';
      setPerPlacementConfigs(prev => ({
        ...prev,
        [currentPlacement]: {
          graphicChoice: placementGraphicChoice,
          size: savedSize
        }
      }));
      
      // Check if more placements to configure
      if (currentPlacementIndex < selectedPlacements.length - 1) {
        // More placements - stay on placement-config, move to next placement
        const nextPlacement = selectedPlacements[currentPlacementIndex + 1];
        setCurrentPlacementIndex(prev => prev + 1);
        setPlacementGraphicChoice('');
        // Reset size for next placement
        setPlacementSize('');
        return; // Stay on placement-config step
      }
      // All placements done - proceed to shirt-preview
    }
    
    // Fork at shirt-preview (step 12) based on qrType
    // shirt-preview now advances to canvas-fork (step 13) for QR Plus vs Canvas decision
    
    if (currentIndex < stepsArray.length - 1) {
      const nextStep = stepsArray[currentIndex + 1].id;
      setSimpleStep(nextStep);
    }
  };

  const handleSimpleBack = () => {
    // Handle QR Basic flow back navigation
    if (simpleStep === 'qr-basic-type') {
      setSimpleStep('generate');
      return;
    }
    if (simpleStep === 'qr-basic-input') {
      setSimpleStep('qr-basic-type');
      return;
    }
    if (simpleStep === 'qr-basic-mockup') {
      setSimpleStep('qr-basic-input');
      return;
    }
    if (simpleStep === 'qr-basic-save-choice') {
      setSimpleStep('qr-basic-mockup');
      return;
    }
    if (simpleStep === 'qr-basic-confirm') {
      setSimpleStep('qr-basic-save-choice');
      return;
    }
    
    // Handle QR Plus flow back navigation
    if (simpleStep === 'qr-plus-mockup') {
      setSimpleStep('canvas-fork');
      return;
    }
    if (simpleStep === 'qr-plus-save-choice') {
      setSimpleStep('qr-plus-mockup');
      return;
    }
    if (simpleStep === 'qr-plus-confirm') {
      setSimpleStep('qr-plus-save-choice');
      return;
    }
    
    // Handle canvas-fork and QR Canvas flow back navigation
    if (simpleStep === 'canvas-fork') {
      setSimpleStep('shirt-preview');
      return;
    }
    if (simpleStep === 'url-explainer') {
      setSimpleStep('canvas-fork');
      return;
    }
    
    // Handle graphic-size loop back navigation
    if (simpleStep === 'graphic-size' && currentPlacementIndex > 0) {
      // Go back to previous placement in the loop
      const prevPlacement = selectedPlacements[currentPlacementIndex - 1];
      setCurrentPlacementIndex(prev => prev - 1);
      setGraphicSize(perPlacementSizes[prevPlacement] || '');
      return;
    }
    
    // Select correct steps array based on qrType
    const stepsArray = qrType === 'qr-basic' ? QR_BASIC_STEPS
      : qrType === 'qr-plus' ? QR_PLUS_STEPS
      : SIMPLE_WIZARD_STEPS;
    const currentIndex = stepsArray.findIndex(s => s.id === simpleStep);
    if (currentIndex > 0) {
      setSimpleStep(stepsArray[currentIndex - 1].id);
    }
  };

  const canSimpleProceed = () => {
    switch (simpleStep) {
      case 'product': return selectedProductType !== null;
      case 'product-congrats': return true;
      case 'color': return selectedColor !== '';
      case 'size': return selectedShirtSize !== '';
      case 'type': return qrType !== '';
      case 'graphic-size': return graphicSize !== '';
      case 'generate': return wantsHeaderFooter !== null;
      case 'text-choice': return textLayoutChoice !== '';
      case 'placement-count': return selectedPlacements.length > 0;
      case 'text-edit': return true;
      case 'placement-config': return placementGraphicChoice !== '';
      case 'shirt-preview': return true;
      case 'url-explainer': return true;
      case 'url-source-choice': return libraryChoice !== '';
      case 'url-library-pick': return urlGraphic !== '';
      case 'url-details': return simpleTitle.trim() !== '';
      case 'url-preview': return true;
      case 'url-publish': return true;
      // QR Basic flow
      case 'qr-basic-type': return qrBasicInputType !== '';
      case 'qr-basic-input': {
        if (qrBasicContent.trim() === '') return false;
        if (qrBasicInputType === 'url' && !isValidUrl(qrBasicContent)) return false;
        return true;
      }
      case 'qr-basic-mockup': return true;
      case 'qr-basic-save-choice': return qrBasicSaveChoice !== '';
      case 'qr-basic-confirm': return true;
      // QR Plus flow
      case 'qr-plus-mockup': return true;
      case 'qr-plus-save-choice': return qrPlusSaveChoice !== '';
      case 'qr-plus-confirm': return true;
      default: return false;
    }
  };

  const handleSimplePublish = async () => {
    if (!user?.id || !selectedChannel) return;
    
    setIsPublishing(true);
    try {
      const authHeaders = await getAuthHeaders();
      
      // Create packet for simple wizard (canvas or play)
      const packetData = {
        packetType: qrType,
        title: simpleTitle,
        description: simpleDescription,
        channelId: selectedChannel.id,
        storeId: user.id, // Member store = memberId
        background: urlGraphic || null,
        status: 'published'
      };
      
      const res = await fetch(`/api/members/${user.id}/products`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify(packetData)
      });
      
      if (!res.ok) throw new Error('Failed to publish');
      
      incrementPublishCount();
      setViewMode('channels');
      
      // Reset simple wizard state for next use
      setSimpleStep('product');
      setCurrentPacketId(null);
      setSimpleTitle('');
      setSimpleDescription('');
      setQrType('');
      setUrlGraphic('');
      setProductGraphic('');
    } catch (error) {
      console.error('Simple publish error:', error);
      alert('Failed to publish. Please try again.');
    } finally {
      setIsPublishing(false);
    }
  };

  // === ADVANCED WIZARD HANDLERS ===
  const handleStepClick = (step: WizardStep) => {
    const stepIndex = WIZARD_STEPS.findIndex(s => s.id === step);
    const currentIndex = WIZARD_STEPS.findIndex(s => s.id === currentStep);
    if (stepIndex <= currentIndex || completedSteps.has(step)) {
      setCurrentStep(step);
    }
  };

  const handleNext = () => {
    const currentIndex = WIZARD_STEPS.findIndex(s => s.id === currentStep);
    if (currentIndex < WIZARD_STEPS.length - 1) {
      setCompletedSteps(prev => new Set([...Array.from(prev), currentStep]));
      setCurrentStep(WIZARD_STEPS[currentIndex + 1].id);
    }
  };

  const handleBack = () => {
    const currentIndex = WIZARD_STEPS.findIndex(s => s.id === currentStep);
    if (currentIndex > 0) {
      setCurrentStep(WIZARD_STEPS[currentIndex - 1].id);
    }
  };

  const handlePublish = async () => {
    if (!user?.id || !selectedProduct || !selectedChannel) return;
    
    setIsPublishing(true);
    try {
      const authHeaders = await getAuthHeaders();
      
      const productRes = await fetch(`/api/members/${user.id}/products`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify({
          printfulProductId: selectedProduct.productId,
          variantId: selectedProduct.id,
          qrType,
          qrDestination: qrDestination || landingPage.url || null,
          headerStyle: headerStyle.enabled ? headerStyle : null,
          footerStyle: footerStyle.enabled ? footerStyle : null,
          background: urlGraphic || null,
          landingPage: landingPage,
          videoUrl: videoUrl || null,
          channelId: selectedChannel.id,
          name: selectedProduct.name,
          price: 0
        })
      });
      
      if (!productRes.ok) throw new Error('Failed to create product');
      
      setCompletedSteps(prev => new Set<WizardStep>([...Array.from(prev), 'publish']));
      incrementPublishCount();
      setViewMode('channels');
    } catch (error) {
      console.error('Publish error:', error);
      alert('Failed to publish. Please try again.');
    } finally {
      setIsPublishing(false);
    }
  };

  const canProceed = () => {
    switch (currentStep) {
      case 'channel': return selectedChannel !== null;
      case 'product': return selectedProduct !== null;
      case 'placement': return selectedPlacements.length > 0;
      case 'header-footer': return true;
      case 'background': return true;
      case 'landing-page': return true;
      case 'preview': return true;
      case 'publish': return true;
      default: return false;
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-400" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center p-4">
        <Card className="bg-slate-800/50 border-slate-700 max-w-md">
          <CardContent className="p-6 text-center">
            <Users className="w-12 h-12 text-blue-400 mx-auto mb-4" />
            <h1 className="text-xl font-bold text-white mb-2">Sign In Required</h1>
            <p className="text-slate-400">Please sign in to access the Members Sandbox</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e3a5f 50%, #0f172a 100%)' }}>
      <SEO title="Members Sandbox" description="Build and sell your products" />
      
      <div className="container py-4 max-w-5xl mx-auto px-4">
        {viewMode !== 'wizard' && (
        <div className="flex gap-2 flex-wrap mb-4">
              <Button
                variant={viewMode === 'index' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('index')}
                data-testid="tab-home"
                className={viewMode === 'index' ? 'bg-slate-600 text-white' : 'text-white/70 hover:text-white hover:bg-white/10'}
              >
                <User className="w-4 h-4 mr-1" />
                Home
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => { setViewMode('wizard'); setWizardTier('simple'); }}
                data-testid="tab-simple"
                className="text-white/70 hover:text-white hover:bg-white/10"
              >
                <Wand2 className="w-4 h-4 mr-1" />
                Quick Create
              </Button>
              {unlockedTiers.advanced && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => { setViewMode('wizard'); setWizardTier('advanced'); }}
                  data-testid="tab-advanced"
                  className="text-white/70 hover:text-white hover:bg-white/10"
                >
                  <Layers className="w-4 h-4 mr-1" />
                  Advanced
                </Button>
              )}
              {unlockedTiers.studio && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => { setViewMode('wizard'); setWizardTier('studio'); }}
                  data-testid="tab-studio"
                  className="text-white/70 hover:text-white hover:bg-white/10"
                >
                  <Zap className="w-4 h-4 mr-1" />
                  Studio
                </Button>
              )}
              <Button
                variant={viewMode === 'channels' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('channels')}
                data-testid="tab-channels"
                className={viewMode === 'channels' ? 'bg-blue-600 text-white' : 'text-white/70 hover:text-white hover:bg-white/10'}
              >
                <Layers className="w-4 h-4 mr-1" />
                Channels
              </Button>
              <Button
                variant={viewMode === 'collections' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('collections')}
                data-testid="tab-collections"
                className={viewMode === 'collections' ? 'bg-blue-600 text-white' : 'text-white/70 hover:text-white hover:bg-white/10'}
              >
                <QrCode className="w-4 h-4 mr-1" />
                Dynamics
              </Button>
              <Button
                variant={viewMode === 'earnings' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('earnings')}
                data-testid="tab-earnings"
                className={viewMode === 'earnings' ? 'bg-blue-600 text-white' : 'text-white/70 hover:text-white hover:bg-white/10'}
              >
                <DollarSign className="w-4 h-4 mr-1" />
                Earnings
              </Button>
        </div>
        )}

        {showUnlockPrompt === 'advanced' && (
          <div className="glass-card p-4 mb-6 flex items-center justify-between gap-4 border-blue-500/50 bg-blue-900/20">
            <div className="flex items-center gap-3">
              <Layers className="w-6 h-6 text-blue-400" />
              <div>
                <p className="text-white font-medium">Advanced Mode Unlocked!</p>
                <p className="text-white/70 text-sm">Great job on your first creation! You now have access to Advanced mode with more options.</p>
              </div>
            </div>
            <Button 
              size="sm" 
              variant="ghost" 
              onClick={() => setShowUnlockPrompt(null)}
              className="text-white/70 hover:text-white"
              data-testid="dismiss-unlock-prompt"
            >
              Got it
            </Button>
          </div>
        )}

        {showUnlockPrompt === 'studio' && (
          <div className="glass-card p-4 mb-6 flex items-center justify-between gap-4 border-amber-500/50 bg-amber-900/20">
            <div className="flex items-center gap-3">
              <Zap className="w-6 h-6 text-amber-400" />
              <div>
                <p className="text-white font-medium">Studio Mode Unlocked!</p>
                <p className="text-white/70 text-sm">You're a pro now! Studio mode gives you full control with quick publishing.</p>
              </div>
            </div>
            <Button 
              size="sm" 
              variant="ghost" 
              onClick={() => setShowUnlockPrompt(null)}
              className="text-white/70 hover:text-white"
              data-testid="dismiss-unlock-prompt"
            >
              Got it
            </Button>
          </div>
        )}

        {/* SIMPLE WIZARD - First-time user experience */}
        {viewMode === 'wizard' && wizardTier === 'simple' && (
          <Card className="bg-slate-800/50 border-slate-700">
            <CardHeader className="pb-1 pt-3">
              <p className="text-xs text-slate-400 flex items-center gap-1">
                <Wand2 className="w-3 h-3" />
                Simple Wizard
              </p>
            </CardHeader>
            <CardContent className="p-6 pt-1">
              <SimpleWizardProgressBar currentStep={simpleStep} />
              {runningEarnings > 0 && (
                <div className="flex items-center gap-1 mb-4">
                  <span className="text-green-400 font-semibold text-sm">
                    ${runningEarnings.toFixed(2)} potential
                  </span>
                </div>
              )}

              <div className="min-h-[400px]">
                {/* Step 0: Pick Product */}
                {simpleStep === 'product' && (
                  <ProductPickerStep
                    selectedProduct={selectedProductType}
                    onSelect={handleProductSelect}
                  />
                )}
                
                {/* Step: Product Congrats - earnings celebration */}
                {simpleStep === 'product-congrats' && selectedProductType && (
                  <ProductCongratsStep
                    productName={selectedProductType.title}
                    earnings={selectedProductType.memberEarnings || 0}
                  />
                )}
                
                {/* Step 0a: Pick Color */}
                {simpleStep === 'color' && (
                  <ColorPickerStep
                    selectedColor={selectedColor}
                    onSelect={setSelectedColor}
                  />
                )}
                
                {/* Step 0b: Pick Size */}
                {simpleStep === 'size' && (() => {
                  // Calculate size earnings bonuses from pricing settings
                  const sizeEarningsBonuses = calculateSizeEarningsBonuses(
                    pricingSettings?.sizeUpcharges,
                    pricingSettings?.memberProfitShare || 0.25
                  );
                  return (
                    <SizePickerStep
                      selectedSize={selectedShirtSize}
                      selectedColor={selectedColor}
                      baseEarnings={selectedProductType?.memberEarnings || 0}
                      sizeEarningsBonuses={sizeEarningsBonuses}
                      onSelect={(size) => {
                        // Calculate earnings difference when changing size
                        const oldBonus = sizeEarningsBonuses[selectedShirtSize] || 0;
                        const newBonus = sizeEarningsBonuses[size] || 0;
                        const earningsDiff = newBonus - oldBonus;
                        
                        // Only update running earnings if changing from a previous selection
                        if (selectedShirtSize && earningsDiff !== 0) {
                          setRunningEarnings(prev => prev + earningsDiff);
                        } else if (!selectedShirtSize) {
                          // First time selecting - add the bonus
                          setRunningEarnings(prev => prev + newBonus);
                        }
                        
                        setSelectedShirtSize(size);
                      }}
                    />
                  );
                })()}
                
                {/* Step 1: Type */}
                {simpleStep === 'type' && (
                  <TypePickerStep 
                    selectedType={qrType}
                    onSelect={setQrType}
                  />
                )}
                
                {/* Step: Graphic Size - loops through each placement */}
                {simpleStep === 'graphic-size' && (
                  <div className="space-y-2">
                    <GraphicSizeStep
                      selectedSize={graphicSize}
                      selectedColor={selectedColor}
                      currentPlacement={currentPlacement}
                      onSelect={setGraphicSize}
                    />
                  </div>
                )}
                
                {/* Step: Generate Graphic - asks about header/footer */}
                {simpleStep === 'generate' && (
                  <div className="space-y-2">
                    <GenerateGraphicStep
                      selectedColor={selectedColor}
                      graphicLocation={graphicLocation}
                      graphicSize={graphicSize}
                      onYes={() => {
                        setWantsHeaderFooter(true);
                        setQrType('qr-plus'); // Set type for header/footer flow (will become qr-canvas if they add landing page)
                        setSimpleStep('text-choice');
                      }}
                      onNo={() => {
                        setWantsHeaderFooter(false);
                        setQrType('qr-basic'); // Set type for basic QR-only flow
                        // Fork to QR Basic flow: Step 8 = URL/Text choice
                        setQrBasicInputType('');
                        setQrBasicContent('');
                        setSimpleStep('qr-basic-type');
                      }}
                    />
                  </div>
                )}
                
                {/* QR Basic Step 1: Choose URL or Text */}
                {simpleStep === 'qr-basic-type' && (
                  <QRBasicTypeStep
                    selectedType={qrBasicInputType}
                    onSelect={(type) => {
                      setQrBasicInputType(type);
                      setSimpleStep('qr-basic-input');
                    }}
                    selectedColor={selectedColor}
                    graphicSize={graphicSize}
                  />
                )}
                
                {/* QR Basic Step 2: Enter URL or Text */}
                {simpleStep === 'qr-basic-input' && (
                  <QRBasicInputStep
                    inputType={qrBasicInputType}
                    content={qrBasicContent}
                    onContentChange={setQrBasicContent}
                    selectedColor={selectedColor}
                    graphicSize={graphicSize}
                  />
                )}
                
                {/* QR Basic Step 3: Show Mockup */}
                {simpleStep === 'qr-basic-mockup' && (
                  <QRBasicMockupStep
                    mockupUrl={qrBasicMockup}
                    isLoading={isGeneratingBasicMockup}
                    selectedColor={selectedColor}
                    selectedSize={selectedShirtSize}
                    inputType={qrBasicInputType}
                    content={qrBasicContent}
                  />
                )}
                
                {/* QR Basic Step 4: Save Choice (Item, Graphic, or Both) */}
                {simpleStep === 'qr-basic-save-choice' && (
                  <QRBasicSaveChoiceStep
                    selected={qrBasicSaveChoice}
                    onSelect={(choice) => setQrBasicSaveChoice(choice)}
                  />
                )}
                
                {/* QR Basic Step 5: Confirmation */}
                {simpleStep === 'qr-basic-confirm' && (
                  <QRBasicConfirmStep
                    saveChoice={qrBasicSaveChoice}
                    mockupUrl={qrBasicMockup}
                    qrContent={qrBasicContent}
                    isSaving={isQrBasicSaving}
                    onDone={() => {
                      // Reset wizard
                      setSimpleStep('product');
                      setCurrentPacketId(null);
                      setQrBasicInputType('');
                      setQrBasicContent('');
                      setQrBasicMockup('');
                      setQrBasicSaveChoice('');
                    }}
                  />
                )}
                
                {/* QR Plus Step 1: Mockup Preview */}
                {simpleStep === 'qr-plus-mockup' && (
                  <QRPlusMockupStep
                    mockupUrl={qrPlusMockup}
                    isLoading={isGeneratingPlusMockup}
                    selectedColor={selectedColor}
                    selectedSize={selectedShirtSize}
                    headerText={headerStyle.text}
                    footerText={footerStyle.text}
                  />
                )}
                
                {/* QR Plus Step 2: Save Choice */}
                {simpleStep === 'qr-plus-save-choice' && (
                  <QRPlusSaveChoiceStep
                    selected={qrPlusSaveChoice}
                    onSelect={(choice) => setQrPlusSaveChoice(choice)}
                  />
                )}
                
                {/* QR Plus Step 3: Confirmation */}
                {simpleStep === 'qr-plus-confirm' && (
                  <QRPlusConfirmStep
                    saveChoice={qrPlusSaveChoice}
                    mockupUrl={qrPlusMockup}
                    productGraphicUrl={productGraphic}
                    qrGraphicUrl={qrGraphic}
                    isSaving={isQrPlusSaving}
                    onDone={() => {
                      // Reset wizard
                      setSimpleStep('product');
                      setCurrentPacketId(null);
                      setQrPlusMockup('');
                      setQrPlusSaveChoice('');
                      setQrGraphic('');
                      setProductGraphic('');
                    }}
                  />
                )}
                
                {/* Step 5: Text Placement */}
                {simpleStep === 'text-choice' && (
                  <div className="space-y-2">
                    <TextLayoutChoiceStep
                      selected={textLayoutChoice}
                      onSelect={(choice) => {
                        setTextLayoutChoice(choice);
                        setSimpleStep('text-edit');
                      }}
                    />
                  </div>
                )}
                
                {/* Step 9: Placement Count - uses actual Printify dimensions if available */}
                {simpleStep === 'placement-count' && (
                  <PlacementCountStep
                    selected={selectedPlacements}
                    onToggle={(placement) => {
                      const isRemoving = selectedPlacements.includes(placement);
                      const currentCount = selectedPlacements.length;
                      
                      if (isRemoving) {
                        // Only subtract earnings if removing a non-first placement
                        if (currentCount > 1) {
                          setRunningEarnings(prev => prev - placementEarningsBonus);
                        }
                        setSelectedPlacements(prev => prev.filter(p => p !== placement));
                      } else {
                        // Only add earnings for placements beyond the first
                        if (currentCount >= 1) {
                          setRunningEarnings(prev => prev + placementEarningsBonus);
                        }
                        setSelectedPlacements(prev => [...prev, placement]);
                      }
                    }}
                    selectedColor={selectedColor}
                    placementEarningsBonus={placementEarningsBonus}
                    productPlacements={selectedProductType?.placements}
                  />
                )}
                
                {/* Step 10: Text Edit - shows graphic with text for current placement */}
                {simpleStep === 'text-edit' && (
                  <div className="space-y-2">
                    <ShirtTextEditStep
                      layout={textLayoutChoice}
                      selectedColor={selectedColor}
                      graphicLocation={graphicLocation}
                      graphicSize={graphicSize}
                      headerStyle={headerStyle}
                      footerStyle={footerStyle}
                      onHeaderChange={setHeaderStyle}
                      onFooterChange={setFooterStyle}
                    />
                  </div>
                )}
                
                {/* Step 10: Placement Config - Full Graphic or QR Only for each placement */}
                {simpleStep === 'placement-config' && (
                  <PlacementConfigStep
                    currentPlacement={currentPlacement}
                    currentIndex={currentPlacementIndex}
                    totalPlacements={selectedPlacements.length}
                    graphicChoice={placementGraphicChoice}
                    onGraphicChoiceChange={setPlacementGraphicChoice}
                    headerStyle={headerStyle}
                    footerStyle={footerStyle}
                    textLayoutChoice={textLayoutChoice}
                  />
                )}
                
                {/* Step 11: Shirt Preview - show graphic on shirt */}
                {simpleStep === 'shirt-preview' && (
                  <ShirtPreviewStep
                    selectedColor={selectedColor}
                    graphicLocation={graphicLocation}
                    graphicSize={graphicSize}
                    headerStyle={headerStyle}
                    footerStyle={footerStyle}
                    textLayoutChoice={textLayoutChoice}
                    selectedPlacements={selectedPlacements}
                  />
                )}
                
                {/* Step 13: Canvas Fork - QR Plus vs QR Canvas decision */}
                {simpleStep === 'canvas-fork' && (
                  <CanvasForkStep
                    onYes={() => {
                      setQrType('qr-canvas');
                      setSimpleStep('url-explainer');
                    }}
                    onNo={async () => {
                      setQrType('qr-plus');
                      setIsGeneratingPlusMockup(true);
                      setSimpleStep('qr-plus-mockup');
                      
                      try {
                        // Step 1: Generate qrGraphic (the actual QR code)
                        const previewUrl = `${window.location.origin}/preview/${Date.now()}`;
                        const qrApiUrl = generateQRCodeUrl(previewUrl, 200);
                        setQrGraphic(qrApiUrl);
                        console.log('[QR Plus] Generated qrGraphic:', qrApiUrl);
                        
                        // Step 2: Generate productGraphic (composite: header + QR + footer)
                        // This is what goes on the physical product (shirt, cup, etc.)
                        console.log('[QR Plus] Generating productGraphic with:');
                        console.log('[QR Plus]   textLayoutChoice:', textLayoutChoice);
                        console.log('[QR Plus]   headerStyle:', JSON.stringify({
                          text: headerStyle.text,
                          enabled: headerStyle.enabled,
                          color: headerStyle.color,
                          fontFamily: headerStyle.fontFamily,
                          fontSize: headerStyle.fontSize,
                        }));
                        console.log('[QR Plus]   footerStyle:', JSON.stringify({
                          text: footerStyle.text,
                          enabled: footerStyle.enabled,
                          color: footerStyle.color,
                          fontFamily: footerStyle.fontFamily,
                          fontSize: footerStyle.fontSize,
                        }));
                        const productGraphicResult = await api.generateProductGraphic({
                          qrUrl: previewUrl,
                          headerStyle: headerStyle,
                          footerStyle: footerStyle,
                          textLayoutChoice: textLayoutChoice,
                          qrColor: 'black',
                        });
                        
                        console.log('[QR Plus] productGraphicResult:', JSON.stringify({
                          success: productGraphicResult.success,
                          hasProductGraphic: !!productGraphicResult.productGraphic,
                          productGraphicLength: productGraphicResult.productGraphic?.length || 0,
                          error: productGraphicResult.error,
                        }));
                        
                        if (productGraphicResult.success && productGraphicResult.productGraphic) {
                          setProductGraphic(productGraphicResult.productGraphic);
                          console.log('[QR Plus] Generated productGraphic (composite), length:', productGraphicResult.productGraphic.length);
                        } else {
                          console.warn('[QR Plus] productGraphic generation failed, using qrGraphic as fallback');
                          console.warn('[QR Plus] Fallback reason - success:', productGraphicResult.success, 'hasGraphic:', !!productGraphicResult.productGraphic);
                          setProductGraphic(qrApiUrl);
                        }
                        
                        // Step 3: Generate mockup using the productGraphic (composite with header/footer)
                        if (selectedProductType?.blueprintId && selectedProductType?.printProviderId && selectedColor) {
                          const effectiveQrSize = (graphicSize === 'small' || graphicSize === 'medium' || graphicSize === 'large') ? graphicSize : 'medium';
                          console.log('[QR Plus] Generating mockup with graphicSize:', graphicSize, '→ effectiveQrSize:', effectiveQrSize);
                          
                          // Use productGraphic (composite) for the mockup, not bare qrGraphic
                          const artworkForMockup = productGraphicResult.success && productGraphicResult.productGraphic 
                            ? productGraphicResult.productGraphic 
                            : qrApiUrl;
                          
                          const mockupResult = await api.generateMockup({
                            blueprintId: selectedProductType.blueprintId,
                            printProviderId: selectedProductType.printProviderId,
                            colorName: selectedColor,
                            artworkUrl: artworkForMockup,
                            placement: 'FRONT_CHEST',
                            qrSize: effectiveQrSize,
                          });
                          
                          console.log('[QR Plus] Mockup API Response:', JSON.stringify(mockupResult, null, 2));
                          
                          const bestUrl = mockupResult.lifestyleMockupUrl || mockupResult.mockupUrl;
                          
                          if (mockupResult.success && bestUrl) {
                            console.log('[QR Plus] SUCCESS - Setting qrPlusMockup to:', bestUrl);
                            setQrPlusMockup(bestUrl);
                          } else {
                            console.warn('[QR Plus] FAILED - Using QR fallback. Error:', mockupResult.error);
                            setQrPlusMockup(qrApiUrl);
                          }
                        } else {
                          console.warn('[QR Plus] Missing product info for mockup');
                          setQrPlusMockup(qrApiUrl);
                        }
                      } catch (error) {
                        console.error('[QR Plus] Error generating mockup:', error);
                        const fallbackUrl = generateQRCodeUrl('placeholder', 200);
                        setQrPlusMockup(fallbackUrl);
                      } finally {
                        setIsGeneratingPlusMockup(false);
                      }
                    }}
                  />
                )}
                
                {/* Step 14: URL Explainer - shows QR scan flow and choice buttons */}
                {simpleStep === 'url-explainer' && (
                  <QRCanvasExplainerStep
                    onUploadClick={() => {
                      setUrlSourceChoice('upload');
                      setSimpleStep('url-library-pick');
                    }}
                    onLibraryClick={() => {
                      setUrlSourceChoice('library');
                      setSimpleStep('url-source-choice');
                    }}
                  />
                )}
                
                {/* Step 12: URL Source Choice - My Library vs Common Library */}
                {simpleStep === 'url-source-choice' && (
                  <UrlSourceChoiceStep
                    choice={libraryChoice}
                    onChoiceChange={setLibraryChoice}
                  />
                )}
                
                {/* Step 15: URL Library Pick - browse and select background */}
                {simpleStep === 'url-library-pick' && user?.id && (
                  <SimpleBackgroundStep
                    memberId={user.id}
                    background={urlGraphic}
                    onBackgroundSelected={(croppedUrl, originalUrl, needsCrop) => {
                      setUrlGraphic(croppedUrl);
                      setOriginalUrlGraphic(originalUrl);
                    }}
                    onComplete={() => setSimpleStep('url-details')}
                    initialSubStep={
                      urlSourceChoice === 'upload' ? 'upload' :
                      libraryChoice === 'personal' ? 'personal-library' :
                      libraryChoice === 'common' ? 'common-library' : 'choice'
                    }
                    croppedOnly={libraryChoice === 'personal'}
                  />
                )}
                
                {/* Step 14: URL Details - title, description with visual preview */}
                {simpleStep === 'url-details' && (
                  <UrlCreationStep
                    title={simpleTitle}
                    description={simpleDescription}
                    onTitleChange={setSimpleTitle}
                    onDescriptionChange={setSimpleDescription}
                    background={urlGraphic}
                    titleVertical={titleVertical}
                    titleHorizontal={titleHorizontal}
                    titleColor={titleColor}
                    titleSize={titleSize}
                    titleFont={titleFont}
                    descVertical={descVertical}
                    descHorizontal={descHorizontal}
                    descColor={descColor}
                    descSize={descSize}
                    descFont={descFont}
                    onTitleVerticalChange={setTitleVertical}
                    onTitleHorizontalChange={setTitleHorizontal}
                    onTitleColorChange={setTitleColor}
                    onTitleSizeChange={setTitleSize}
                    onTitleFontChange={setTitleFont}
                    onDescVerticalChange={setDescVertical}
                    onDescHorizontalChange={setDescHorizontal}
                    onDescColorChange={setDescColor}
                    onDescSizeChange={setDescSize}
                    onDescFontChange={setDescFont}
                  />
                )}
                
                {/* Step 15: URL Preview - preview the landing page (title + description, no QR) */}
                {simpleStep === 'url-preview' && (
                  <SimplePreviewStep
                    background={urlGraphic}
                    title={simpleTitle}
                    description={simpleDescription}
                    onGoBack={() => setSimpleStep('url-details')}
                  />
                )}
                
                {/* Step 16: Publish */}
                {simpleStep === 'url-publish' && (
                  <SimplePublishStep
                    isPublishing={isPublishing}
                    onPublish={handleSimplePublish}
                    title={simpleTitle}
                    qrType={qrType}
                    background={urlGraphic}
                  />
                )}
              </div>

              <div className="flex flex-wrap gap-3 justify-between mt-8 pt-6 border-t border-slate-700">
                <Button
                  variant="outline"
                  onClick={handleSimpleBack}
                  disabled={simpleStep === 'product'}
                  className="flex-1 min-w-[100px] sm:flex-none"
                  data-testid="button-simple-back"
                >
                  <ChevronLeft className="w-4 h-4 mr-1" />
                  Back
                </Button>
                
                {simpleStep !== 'url-publish' && (
                  <Button
                    onClick={handleSimpleNext}
                    disabled={!canSimpleProceed()}
                    className={`flex-1 min-w-[100px] sm:flex-none transition-all duration-300 ${
                      canSimpleProceed() 
                        ? "bg-green-500 hover:bg-green-600 shadow-lg shadow-green-500/40" 
                        : "bg-slate-600"
                    }`}
                    style={canSimpleProceed() ? { animation: "glow 2s ease-in-out infinite" } : undefined}
                    data-testid="button-simple-next"
                  >
                    Next
                    <ChevronRight className="w-4 h-4 ml-1" />
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* ADVANCED WIZARD - Full 8-step experience (unlocked after 1st publish) */}
        {viewMode === 'wizard' && wizardTier === 'advanced' && (
          <Card className="bg-slate-800/50 border-slate-700">
            <CardHeader className="pb-2">
              <CardTitle className="text-white flex items-center gap-2">
                <Layers className="w-5 h-5 text-blue-400" />
                Advanced Wizard
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 pt-2">
              <WizardProgressBar 
                currentStep={currentStep}
                onStepClick={handleStepClick}
                completedSteps={completedSteps}
              />

              <div className="min-h-[400px]">
                {currentStep === 'channel' && (
                  <ChannelStep 
                    selectedChannel={selectedChannel}
                    onSelect={setSelectedChannel}
                    memberId={user?.id || ''}
                    isCreatingChannel={isCreatingChannel}
                    setIsCreatingChannel={setIsCreatingChannel}
                    newChannelName={newChannelName}
                    setNewChannelName={setNewChannelName}
                  />
                )}
                {currentStep === 'product' && (
                  <AdvancedProductPickerStep 
                    selectedProduct={selectedProduct}
                    onSelect={setSelectedProduct}
                  />
                )}
                {currentStep === 'placement' && selectedProduct && (
                  <PlacementPicker
                    placements={selectedProduct.placements || []}
                    selectedPlacements={selectedPlacements}
                    placementConfigs={placementConfigs}
                    onToggle={(id) => {
                      const placementId = id as PlacementOption;
                      setSelectedPlacements(prev => 
                        prev.includes(placementId) ? prev.filter(p => p !== placementId) : [...prev, placementId]
                      );
                      if (!placementConfigs[id]) {
                        setPlacementConfigs(prev => ({ ...prev, [id]: { type: 'qr', size: 'medium' } }));
                      }
                    }}
                    onTypeChange={(id, type) => {
                      setPlacementConfigs(prev => ({ ...prev, [id]: { ...prev[id], type } }));
                    }}
                    onSizeChange={(id, size) => {
                      setPlacementConfigs(prev => ({ ...prev, [id]: { ...prev[id], size } }));
                    }}
                    showTypeToggle={true}
                    productTitle={selectedProduct.name}
                  />
                )}
                {currentStep === 'header-footer' && (
                  <HeaderFooterEditor
                    headerStyle={headerStyle}
                    onHeaderChange={(updates) => setHeaderStyle(prev => ({ ...prev, ...updates }))}
                    footerStyle={footerStyle}
                    onFooterChange={(updates) => setFooterStyle(prev => ({ ...prev, ...updates }))}
                  />
                )}
                {currentStep === 'background' && (
                  <div className="space-y-6">
                    <div className="text-center mb-6">
                      <h2 className="text-lg font-bold text-white mb-2">Background Image</h2>
                      <p className="text-slate-400">Choose from the library or upload your own</p>
                    </div>
                    
                    <Button
                      variant="outline"
                      size="lg"
                      className="w-full h-16 text-lg"
                      onClick={() => setShowBackgroundLibrary(true)}
                      data-testid="button-open-background-library"
                    >
                      <Library className="w-5 h-5 mr-2" />
                      Open Background Library
                    </Button>
                    
                    {urlGraphic && (
                      <div className="relative">
                        <div className="aspect-[9/16] max-w-[200px] mx-auto rounded-lg overflow-hidden border-2 border-primary">
                          <img 
                            src={urlGraphic} 
                            alt="Selected background" 
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <Button
                          size="sm"
                          variant="destructive"
                          className="absolute top-2 right-2"
                          onClick={() => setUrlGraphic('')}
                          data-testid="button-clear-background"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                        <p className="text-center text-sm text-slate-400 mt-2">Background selected</p>
                      </div>
                    )}
                    
                    {showBackgroundLibrary && user?.id && (
                      <BackgroundLibraryPicker
                        memberId={user.id}
                        selectedUrl={urlGraphic}
                        onSelect={(croppedUrl, originalUrl) => {
                          setUrlGraphic(croppedUrl);
                          setOriginalUrlGraphic(originalUrl);
                          setShowBackgroundLibrary(false);
                        }}
                        onClose={() => setShowBackgroundLibrary(false)}
                        assetType="background"
                      />
                    )}
                  </div>
                )}
                {currentStep === 'landing-page' && (
                  <LandingPageEditor
                    value={landingPage}
                    onChange={setLandingPage}
                  />
                )}
                {currentStep === 'preview' && (
                  <PreviewStep 
                    product={selectedProduct}
                    qrType={qrType}
                    headerStyle={headerStyle}
                    footerStyle={footerStyle}
                    background={urlGraphic}
                  />
                )}
                {currentStep === 'publish' && (
                  <PublishStep 
                    isPublishing={isPublishing}
                    onPublish={handlePublish}
                    selectedChannel={selectedChannel}
                  />
                )}
              </div>

              <div className="flex flex-wrap gap-3 justify-between mt-8 pt-6 border-t border-slate-700">
                <Button
                  variant="outline"
                  onClick={handleBack}
                  disabled={currentStep === 'channel'}
                  className="flex-1 min-w-[100px] sm:flex-none"
                  data-testid="button-back"
                >
                  <ChevronLeft className="w-4 h-4 mr-1" />
                  Back
                </Button>
                
                {currentStep !== 'publish' && (
                  <Button
                    onClick={handleNext}
                    disabled={!canProceed()}
                    className={`flex-1 min-w-[100px] sm:flex-none transition-all duration-300 ${
                      canProceed() 
                        ? "bg-green-500 hover:bg-green-600 shadow-lg shadow-green-500/40" 
                        : "bg-slate-600"
                    }`}
                    style={canProceed() ? { animation: "pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite" } : undefined}
                    data-testid="button-next"
                  >
                    Next
                    <ChevronRight className="w-4 h-4 ml-1" />
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* STUDIO MODE - Full control quick publish (unlocked after 2nd publish) */}
        {viewMode === 'wizard' && wizardTier === 'studio' && (
          <div className="space-y-4">
            <Card className="bg-slate-800/50 border-slate-700">
              <CardHeader className="pb-2">
                <CardTitle className="text-white text-lg flex items-center gap-2">
                  <Zap className="w-5 h-5 text-amber-400" />
                  Studio Mode
                  <Badge className="bg-amber-600 text-white">Pro</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-300">Product</label>
                    <div 
                      className="p-3 bg-slate-700/50 rounded-lg border border-slate-600 cursor-pointer hover:border-blue-500 transition-colors"
                      onClick={() => { setCurrentStep('product'); setWizardTier('advanced'); }}
                      data-testid="studio-select-product"
                    >
                      {selectedProduct ? (
                        <div className="flex items-center gap-3">
                          {selectedProduct.thumbnailUrl && (
                            <img src={selectedProduct.thumbnailUrl} alt="" className="w-10 h-10 rounded object-cover" />
                          )}
                          <span className="text-white text-sm truncate">{selectedProduct.name}</span>
                        </div>
                      ) : (
                        <span className="text-slate-400 text-sm">Click to select product...</span>
                      )}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-300">Channel</label>
                    <div 
                      className="p-3 bg-slate-700/50 rounded-lg border border-slate-600 cursor-pointer hover:border-blue-500 transition-colors"
                      onClick={() => { setCurrentStep('channel'); setWizardTier('advanced'); }}
                      data-testid="studio-select-channel"
                    >
                      {selectedChannel ? (
                        <div className="flex items-center gap-3">
                          <Layers className="w-5 h-5 text-blue-400" />
                          <span className="text-white text-sm">{selectedChannel.name}</span>
                        </div>
                      ) : (
                        <span className="text-slate-400 text-sm">Click to select channel...</span>
                      )}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-300">QR Type</label>
                    <select
                      value={qrType}
                      onChange={(e) => setQrType(e.target.value as QRType)}
                      className="w-full p-3 bg-slate-700/50 border border-slate-600 rounded-lg text-white focus:border-blue-500 outline-none"
                      data-testid="power-qr-type"
                    >
                      <option value="qr-basic">QR Basic</option>
                      <option value="qr-plus">QR Plus</option>
                      <option value="qr-canvas">QR Canvas</option>
                      <option value="qr-play">QR Play</option>
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-300">Channel</label>
                    <input
                      type="text"
                      value={channelName}
                      onChange={(e) => setChannelName(e.target.value)}
                      placeholder="My Products"
                      className="w-full p-3 bg-slate-700/50 border border-slate-600 rounded-lg text-white placeholder:text-slate-500 focus:border-blue-500 outline-none"
                      data-testid="power-channel-name"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-300">QR Destination URL</label>
                  <input
                    type="text"
                    value={qrDestination}
                    onChange={(e) => setQrDestination(e.target.value)}
                    placeholder="https://your-website.com or leave empty for default"
                    className="w-full p-3 bg-slate-700/50 border border-slate-600 rounded-lg text-white placeholder:text-slate-500 focus:border-blue-500 outline-none"
                    data-testid="power-qr-destination"
                  />
                </div>

                <div className="flex justify-end pt-4 border-t border-slate-700">
                  <Button
                    onClick={handlePublish}
                    disabled={isPublishing || !selectedProduct}
                    className="bg-blue-600 hover:bg-blue-700"
                    data-testid="power-publish"
                  >
                    {isPublishing ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Publishing...
                      </>
                    ) : (
                      <>
                        <Send className="w-4 h-4 mr-2" />
                        Quick Publish
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {viewMode === 'index' && (
          <MemberIndexView 
            memberId={user?.id || ''} 
            onNavigate={setViewMode}
            onStartWizard={(tier) => {
              setWizardTier(tier);
              setViewMode('wizard');
            }}
            publishCount={publishCount}
          />
        )}

        {viewMode === 'channels' && (
          <ChannelsView memberId={user?.id || ''} />
        )}

        {viewMode === 'collections' && (
          <CollectionsView memberId={user?.id || ''} />
        )}

        {viewMode === 'earnings' && (
          <EarningsView memberId={user?.id || ''} />
        )}

        <div className="mt-6 text-center text-white/50 text-sm">
          Logged in as: {user?.email || "Unknown"}
        </div>
      </div>
    </div>
  );
}

export default function TestMembersSandbox() {
  return (
    <MemberAuthProvider apiBase="/api/members">
      <MembersProvider>
        <MembersSandboxContent />
      </MembersProvider>
    </MemberAuthProvider>
  );
}
