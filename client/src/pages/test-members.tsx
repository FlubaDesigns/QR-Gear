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
  Library
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { auth } from "@/lib/firebase";
import SEO from "@/components/SEO";
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
type SimpleWizardStep = 'channel' | 'type' | 'background' | 'text-ask' | 'text-choice' | 'text-edit' | 'details' | 'preview' | 'publish';
type QRType = 'qr-basic' | 'qr-plus' | 'qr-canvas' | 'qr-play' | '';
type WizardTier = 'simple' | 'advanced' | 'studio';
type BackgroundSubStep = 'choice' | 'upload' | 'library-choice' | 'personal-library' | 'common-library' | 'crop';
type TextLayoutChoice = 'header' | 'footer' | 'both' | '';

// Simple Wizard - streamlined steps for first-time users
const SIMPLE_WIZARD_STEPS: { id: SimpleWizardStep; label: string; icon: any }[] = [
  { id: 'channel', label: 'Channel', icon: Layers },
  { id: 'type', label: 'Type', icon: Sparkles },
  { id: 'background', label: 'Background', icon: ImagePlus },
  { id: 'text-ask', label: 'Text', icon: Type },
  { id: 'text-choice', label: 'Layout', icon: Type },
  { id: 'text-edit', label: 'Edit', icon: Type },
  { id: 'details', label: 'Details', icon: Type },
  { id: 'preview', label: 'Preview', icon: Eye },
  { id: 'publish', label: 'Publish', icon: Send },
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
  const currentIndex = SIMPLE_WIZARD_STEPS.findIndex(s => s.id === currentStep);
  const progress = (currentIndex / SIMPLE_WIZARD_STEPS.length) * 100;
  
  return (
    <div className="w-full mb-6">
      <div className="flex justify-between items-center mb-2">
        <span className="text-sm font-medium text-white">
          Step {currentIndex + 1} of {SIMPLE_WIZARD_STEPS.length}: {SIMPLE_WIZARD_STEPS[currentIndex]?.label}
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
  title: string;
  imageUrl?: string | null;
  brand?: string | null;
  addedAt?: string;
  baseCost?: number;
  retailPrice?: number;
  profit?: number;
  memberEarnings?: number;
  hasUSAProvider?: boolean;
  placements?: { id: string; title: string }[];
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
        <h2 className="text-2xl font-bold text-white mb-2">Choose Your Channel</h2>
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

function ProductPickerStep({ 
  selectedProduct, 
  onSelect
}: { 
  selectedProduct: ProductItem | null;
  onSelect: (product: ProductItem) => void;
}) {
  const { data: allowedData, isLoading: loadingAllowed } = useQuery<{ products: AllowedProduct[], storeCount?: number, message?: string }>({
    queryKey: ["/api/members/allowed-products"],
  });

  const allowedProducts = allowedData?.products || [];
  const hasAllowedProducts = allowedProducts.length > 0;

  // Map to ScrollViewItem format with metadata from admin
  const scrollItems: ScrollViewItem[] = allowedProducts.map((p) => ({
    id: String(p.blueprintId),
    imageUrl: p.imageUrl || "",
    title: p.title,
    subtitle: p.brand || undefined,
    minPrice: p.retailPrice ? String(p.retailPrice) : null,
    maxPrice: p.retailPrice ? String(p.retailPrice) : null,
    colorCount: 0,
    madeInUSA: p.hasUSAProvider || false,
    metadata: {
      brand: p.brand,
      baseCost: p.baseCost || 0,
      retailPrice: p.retailPrice || 0,
      profit: p.profit || 0,
      memberEarnings: p.memberEarnings || 0,
      hasUSAProvider: p.hasUSAProvider || false,
      placements: p.placements || [],
    },
  }));

  const handleItemTap = (item: ScrollViewItem) => {
    onSelect({
      id: Number(item.id),
      name: item.title,
      thumbnailUrl: item.imageUrl || null,
      placements: item.metadata?.placements || [],
    });
  };

  // Skin renderer - receives data directly from scrollItem.metadata
  const renderProductSkin = (item: ScrollViewItem, isSelected: boolean, onSelectItem: () => void) => {
    const skinItem: SkinItem = {
      id: String(item.id),
      name: item.title,
      primaryImage: item.imageUrl,
      isUsed: isSelected,
      metadata: item.metadata,
    };
    
    return (
      <AllowedProductCardSkin
        item={skinItem}
        actions={{ onSelect: () => onSelectItem() }}
        onClick={onSelectItem}
      />
    );
  };

  if (loadingAllowed) {
    return (
      <div className="flex justify-center items-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-blue-400" />
      </div>
    );
  }

  return (
    <div>
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold text-white mb-2">Pick Your Product</h2>
        <p className="text-slate-400">Tap a product to select it</p>
      </div>

      {!hasAllowedProducts ? (
        <div className="text-center py-8">
          <Package className="w-12 h-12 mx-auto mb-4 text-slate-500" />
          <p className="text-slate-400 mb-2">No products available yet</p>
          <p className="text-sm text-slate-500">
            Admin needs to configure allowed products in Store Builder
          </p>
        </div>
      ) : (
        <SharedViewer
          mode="scroll"
          scrollProps={{
            items: scrollItems,
            selectedId: selectedProduct ? String(selectedProduct.id) : undefined,
            onSelect: handleItemTap,
            aspectRatio: "square",
            emptyMessage: "No products available.",
            layout: "vertical",
            gridHeight: "min(60vh, 500px)",
            renderItem: renderProductSkin,
          }}
        />
      )}
    </div>
  );
}

// Simple Wizard Step: Type Selection (beginner-friendly)
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
        <h2 className="text-2xl font-bold text-white mb-2">What do you want to create?</h2>
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
  backgroundUrl: string;
  onBackgroundSelected: (croppedUrl: string, originalUrl: string, needsCrop: boolean) => void;
  onComplete: () => void;
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

function SimpleBackgroundStep({ 
  memberId, 
  backgroundUrl,
  onBackgroundSelected,
  onComplete
}: SimpleBackgroundStepProps) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [subStep, setSubStep] = useState<BackgroundSubStep>('choice');
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
    if (isAlready916(asset)) {
      onBackgroundSelected(asset.publicUrl, asset.publicUrl, false);
      onComplete();
    } else {
      setShowCrop(true);
    }
  };

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
            <h2 className="text-2xl font-bold text-white mb-2">Add Your Background</h2>
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
            <h2 className="text-2xl font-bold text-white mb-2">Upload Your Image</h2>
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
            <h2 className="text-2xl font-bold text-white mb-2">Pick From Library</h2>
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
            <h2 className="text-2xl font-bold text-white mb-2">Your Library</h2>
            <p className="text-slate-400">Select an image to use</p>
          </div>

          {loadingPersonal ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-blue-400" />
            </div>
          ) : personalAssets.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-slate-700 flex items-center justify-center">
                <ImagePlus className="w-8 h-8 text-slate-500" />
              </div>
              <p className="text-slate-400 mb-4">No images in your library yet</p>
              <Button onClick={() => setSubStep('upload')} data-testid="button-bg-upload-instead">
                <Upload className="w-4 h-4 mr-2" />
                Upload One
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-3 max-h-[400px] overflow-y-auto">
              {personalAssets.map((asset) => (
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
            <h2 className="text-2xl font-bold text-white mb-2">Common Library</h2>
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

// Phone mockup component for previews
function PhoneMockup({ 
  backgroundUrl, 
  headerText,
  footerText,
  headerStyle,
  footerStyle,
  className = ""
}: { 
  backgroundUrl: string;
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
    <div className={`relative mx-auto ${className}`} style={{ width: '200px' }}>
      <div className="relative rounded-[2rem] border-4 border-slate-700 bg-black overflow-hidden shadow-2xl">
        <div className="absolute top-2 left-1/2 -translate-x-1/2 w-16 h-4 bg-slate-700 rounded-full" />
        <div className="aspect-[9/19] relative">
          {backgroundUrl && (
            <img 
              src={backgroundUrl} 
              alt="Background" 
              className="absolute inset-0 w-full h-full object-cover"
            />
          )}
          <div className="absolute inset-0 flex flex-col items-center justify-center p-4">
            {headerText && headerStyle?.enabled && (
              <div 
                className="text-center mb-2 px-2"
                style={{
                  color: headerStyle.color || '#ffffff',
                  fontSize: getFontSize(headerStyle.fontSize),
                  fontFamily: headerStyle.fontFamily || 'sans-serif',
                  fontWeight: 'bold',
                  textShadow: '0 1px 3px rgba(0,0,0,0.5)'
                }}
              >
                {headerText}
              </div>
            )}
            <div className="w-16 h-16 bg-white rounded-lg flex items-center justify-center">
              <QrCode className="w-12 h-12 text-slate-800" />
            </div>
            {footerText && footerStyle?.enabled && (
              <div 
                className="text-center mt-2 px-2"
                style={{
                  color: footerStyle.color || '#ffffff',
                  fontSize: getFontSize(footerStyle.fontSize),
                  fontFamily: footerStyle.fontFamily || 'sans-serif',
                  fontWeight: 'bold',
                  textShadow: '0 1px 3px rgba(0,0,0,0.5)'
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
  backgroundUrl,
  onYes,
  onNo
}: { 
  backgroundUrl: string;
  onYes: () => void;
  onNo: () => void;
}) {
  return (
    <div className="text-center space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-white mb-2">Looking Good!</h2>
        <p className="text-slate-400">Would you like to add some text?</p>
      </div>

      <PhoneMockup backgroundUrl={backgroundUrl} />

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
        <h2 className="text-2xl font-bold text-white mb-2">Where Should the Text Go?</h2>
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
                <div className="w-full h-3 bg-slate-500 rounded mb-1" />
              )}
              <div className="w-8 h-8 bg-white rounded flex items-center justify-center my-1">
                <QrCode className="w-5 h-5 text-slate-800" />
              </div>
              {(option.id === 'footer' || option.id === 'both') && (
                <div className="w-full h-3 bg-slate-500 rounded mt-1" />
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

// Simple Wizard Step: Text Edit (enter text + styling)
function TextEditStep({ 
  layout,
  backgroundUrl,
  headerStyle,
  footerStyle,
  onHeaderChange,
  onFooterChange
}: { 
  layout: TextLayoutChoice;
  backgroundUrl: string;
  headerStyle: TextStyleConfig;
  footerStyle: TextStyleConfig;
  onHeaderChange: (style: TextStyleConfig) => void;
  onFooterChange: (style: TextStyleConfig) => void;
}) {
  const showHeader = layout === 'header' || layout === 'both';
  const showFooter = layout === 'footer' || layout === 'both';

  const updateStyle = (
    current: TextStyleConfig, 
    updates: Partial<TextStyleConfig>,
    setter: (style: TextStyleConfig) => void
  ) => {
    setter({ ...current, ...updates, enabled: true });
  };

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-white mb-2">Add Your Text</h2>
        <p className="text-slate-400">Type your message and style it</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-6">
          {showHeader && (
            <div className="space-y-4 p-4 bg-slate-800/50 rounded-xl border border-slate-700">
              <Label className="text-white font-medium">Header Text</Label>
              <Input
                value={headerStyle.text || ''}
                onChange={(e) => updateStyle(headerStyle, { text: e.target.value }, onHeaderChange)}
                placeholder="Enter header text..."
                className="bg-slate-700 border-slate-600 text-white"
                data-testid="input-header-text"
              />
              
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-slate-400 w-16">Color</span>
                  <div className="flex gap-2">
                    {TEXT_COLORS.map((color) => (
                      <button
                        key={color}
                        onClick={() => updateStyle(headerStyle, { color }, onHeaderChange)}
                        className={`w-8 h-8 rounded-full border-2 transition-all ${
                          headerStyle.color === color ? 'border-white scale-110' : 'border-transparent'
                        }`}
                        style={{ backgroundColor: color }}
                        data-testid={`button-header-color-${color}`}
                      />
                    ))}
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  <span className="text-sm text-slate-400 w-16">Size</span>
                  <div className="flex gap-2">
                    {TEXT_SIZES.map((size) => (
                      <Button
                        key={size.id}
                        size="sm"
                        variant={headerStyle.fontSize === size.value ? 'default' : 'outline'}
                        onClick={() => updateStyle(headerStyle, { fontSize: size.value }, onHeaderChange)}
                        data-testid={`button-header-size-${size.id}`}
                      >
                        {size.label}
                      </Button>
                    ))}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-sm text-slate-400 w-16">Font</span>
                  <div className="flex gap-2">
                    {TEXT_FONTS.map((font) => (
                      <Button
                        key={font.id}
                        size="sm"
                        variant={headerStyle.fontFamily === font.family ? 'default' : 'outline'}
                        onClick={() => updateStyle(headerStyle, { fontFamily: font.family }, onHeaderChange)}
                        style={{ fontFamily: font.family }}
                        data-testid={`button-header-font-${font.id}`}
                      >
                        {font.label}
                      </Button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {showFooter && (
            <div className="space-y-4 p-4 bg-slate-800/50 rounded-xl border border-slate-700">
              <Label className="text-white font-medium">Footer Text</Label>
              <Input
                value={footerStyle.text || ''}
                onChange={(e) => updateStyle(footerStyle, { text: e.target.value }, onFooterChange)}
                placeholder="Enter footer text..."
                className="bg-slate-700 border-slate-600 text-white"
                data-testid="input-footer-text"
              />
              
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-slate-400 w-16">Color</span>
                  <div className="flex gap-2">
                    {TEXT_COLORS.map((color) => (
                      <button
                        key={color}
                        onClick={() => updateStyle(footerStyle, { color }, onFooterChange)}
                        className={`w-8 h-8 rounded-full border-2 transition-all ${
                          footerStyle.color === color ? 'border-white scale-110' : 'border-transparent'
                        }`}
                        style={{ backgroundColor: color }}
                        data-testid={`button-footer-color-${color}`}
                      />
                    ))}
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  <span className="text-sm text-slate-400 w-16">Size</span>
                  <div className="flex gap-2">
                    {TEXT_SIZES.map((size) => (
                      <Button
                        key={size.id}
                        size="sm"
                        variant={footerStyle.fontSize === size.value ? 'default' : 'outline'}
                        onClick={() => updateStyle(footerStyle, { fontSize: size.value }, onFooterChange)}
                        data-testid={`button-footer-size-${size.id}`}
                      >
                        {size.label}
                      </Button>
                    ))}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-sm text-slate-400 w-16">Font</span>
                  <div className="flex gap-2">
                    {TEXT_FONTS.map((font) => (
                      <Button
                        key={font.id}
                        size="sm"
                        variant={footerStyle.fontFamily === font.family ? 'default' : 'outline'}
                        onClick={() => updateStyle(footerStyle, { fontFamily: font.family }, onFooterChange)}
                        style={{ fontFamily: font.family }}
                        data-testid={`button-footer-font-${font.id}`}
                      >
                        {font.label}
                      </Button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-center">
          <PhoneMockup
            backgroundUrl={backgroundUrl}
            headerText={showHeader ? headerStyle.text : undefined}
            footerText={showFooter ? footerStyle.text : undefined}
            headerStyle={showHeader ? headerStyle : undefined}
            footerStyle={showFooter ? footerStyle : undefined}
          />
        </div>
      </div>
    </div>
  );
}

// Simple Wizard Step: Final Preview
function SimplePreviewStep({ 
  backgroundUrl,
  headerStyle,
  footerStyle,
  title,
  onGoBack
}: { 
  backgroundUrl: string;
  headerStyle: TextStyleConfig;
  footerStyle: TextStyleConfig;
  title: string;
  onGoBack: () => void;
}) {
  return (
    <div className="text-center space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-white mb-2">Your Creation</h2>
        <p className="text-slate-400">Here's what it will look like</p>
      </div>

      <PhoneMockup
        backgroundUrl={backgroundUrl}
        headerText={headerStyle.enabled ? headerStyle.text : undefined}
        footerText={footerStyle.enabled ? footerStyle.text : undefined}
        headerStyle={headerStyle}
        footerStyle={footerStyle}
        className="scale-125 my-8"
      />

      {title && (
        <div className="bg-slate-800/50 rounded-lg p-4 max-w-sm mx-auto">
          <p className="text-sm text-slate-400">Title</p>
          <p className="text-white font-medium">{title}</p>
        </div>
      )}

      <Button
        variant="outline"
        onClick={onGoBack}
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
        <h2 className="text-2xl font-bold text-white mb-2">Add Your Details</h2>
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
  backgroundUrl
}: { 
  isPublishing: boolean;
  onPublish: () => void;
  title: string;
  qrType: QRType;
  backgroundUrl: string;
}) {
  const typeLabel = qrType === 'qr-canvas' ? 'Image Post' : qrType === 'qr-play' ? 'Video Post' : 'Creation';
  
  return (
    <div className="text-center">
      <div className="mb-8">
        <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-green-600/20 flex items-center justify-center">
          <Sparkles className="w-10 h-10 text-green-400" />
        </div>
        <h2 className="text-2xl font-bold text-white mb-2">Ready to Publish!</h2>
        <p className="text-slate-400">Your {typeLabel.toLowerCase()} is ready to share with the world</p>
      </div>

      <Card className="bg-slate-800/50 border-slate-700 max-w-sm mx-auto mb-8">
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center gap-3">
            {backgroundUrl ? (
              <div className="w-12 h-12 rounded-lg overflow-hidden">
                <img src={backgroundUrl} alt="" className="w-full h-full object-cover" />
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
  backgroundUrl
}: { 
  product: ProductItem | null;
  qrType: QRType;
  headerStyle: TextStyleConfig;
  footerStyle: TextStyleConfig;
  backgroundUrl: string;
}) {
  const showGraphicPreview = qrType === 'qr-plus' || qrType === 'qr-canvas' || qrType === 'qr-play';
  
  return (
    <div className="space-y-6">
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold text-white mb-2">Preview Your Creation</h2>
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
                backgroundColor={backgroundUrl ? undefined : '#1a1a2e'}
                backgroundImage={backgroundUrl || undefined}
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
            {backgroundUrl && (
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

type ViewMode = 'wizard' | 'channels' | 'collections' | 'earnings';

export default function TestMembersSandbox() {
  const { user, isLoading: authLoading, isAuthenticated } = useAuth();
  const { toast } = useToast();
  
  const [viewMode, setViewMode] = useState<ViewMode>('wizard');
  const [currentStep, setCurrentStep] = useState<WizardStep>('channel');
  const [simpleStep, setSimpleStep] = useState<SimpleWizardStep>('channel');
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
  const [selectedPlacements, setSelectedPlacements] = useState<string[]>([]);
  const [placementConfigs, setPlacementConfigs] = useState<Record<string, PlacementConfig>>({});
  const [qrType, setQrType] = useState<QRType>('');
  const [qrDestination, setQrDestination] = useState<string>('');
  const [channelName, setChannelName] = useState<string>('My Products');
  const [isPublishing, setIsPublishing] = useState(false);
  
  // Step state - shared components
  const [headerStyle, setHeaderStyle] = useState<TextStyleConfig>({ ...defaultTextStyle });
  const [footerStyle, setFooterStyle] = useState<TextStyleConfig>({ ...defaultTextStyle });
  const [backgroundUrl, setBackgroundUrl] = useState<string>('');
  const [originalBackgroundUrl, setOriginalBackgroundUrl] = useState<string>('');
  const [showBackgroundLibrary, setShowBackgroundLibrary] = useState(false);
  const [landingPage, setLandingPage] = useState<LandingPageConfig>({ ...defaultLandingPage });
  const [videoUrl, setVideoUrl] = useState<string>('');
  
  // Simple wizard text state
  const [textLayoutChoice, setTextLayoutChoice] = useState<TextLayoutChoice>('');
  const [wantsText, setWantsText] = useState<boolean | null>(null);

  // === SIMPLE WIZARD HANDLERS ===
  const handleSimpleNext = () => {
    const currentIndex = SIMPLE_WIZARD_STEPS.findIndex(s => s.id === simpleStep);
    if (currentIndex < SIMPLE_WIZARD_STEPS.length - 1) {
      setSimpleStep(SIMPLE_WIZARD_STEPS[currentIndex + 1].id);
    }
  };

  const handleSimpleBack = () => {
    const currentIndex = SIMPLE_WIZARD_STEPS.findIndex(s => s.id === simpleStep);
    if (currentIndex > 0) {
      setSimpleStep(SIMPLE_WIZARD_STEPS[currentIndex - 1].id);
    }
  };

  const canSimpleProceed = () => {
    switch (simpleStep) {
      case 'channel': return selectedChannel !== null;
      case 'type': return qrType !== '';
      case 'background': return backgroundUrl !== ''; // Background is REQUIRED for QR Canvas
      case 'text-ask': return wantsText !== null;
      case 'text-choice': return textLayoutChoice !== '';
      case 'text-edit': return true; // Can proceed with or without text
      case 'details': return simpleTitle.trim() !== '';
      case 'preview': return true;
      case 'publish': return true;
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
        backgroundUrl: backgroundUrl || null,
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
      setSimpleStep('channel');
      setSimpleTitle('');
      setSimpleDescription('');
      setQrType('');
      setBackgroundUrl('');
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
          backgroundUrl: backgroundUrl || null,
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
      
      <div className="container py-6 max-w-5xl mx-auto px-4">
        <div className="glass-card p-6 mb-6">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-3">
              <Store className="w-8 h-8 text-blue-400" />
              <div>
                <h1 className="text-2xl font-bold text-white">Members Sandbox</h1>
                <p className="text-white/70 text-sm">Build and sell your products</p>
              </div>
            </div>
            
            {/* Dev tool: Reset publish count */}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                if (user?.id) {
                  localStorage.removeItem(`publish_count_${user.id}`);
                  setPublishCount(0);
                  setWizardTier('simple');
                  alert('Publish count reset to 0. You now see only Quick Create.');
                }
              }}
              className="text-xs text-slate-500 hover:text-white"
              data-testid="button-reset-publish-count"
            >
              Reset Progress
            </Button>
            
            <div className="flex gap-2 flex-wrap">
              <Button
                variant={viewMode === 'wizard' && wizardTier === 'simple' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => { setViewMode('wizard'); setWizardTier('simple'); }}
                data-testid="tab-simple"
                className={viewMode === 'wizard' && wizardTier === 'simple' ? 'bg-green-600 text-white' : 'text-white/70 hover:text-white hover:bg-white/10'}
              >
                <Wand2 className="w-4 h-4 mr-1" />
                Quick Create
              </Button>
              {unlockedTiers.advanced && (
                <Button
                  variant={viewMode === 'wizard' && wizardTier === 'advanced' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => { setViewMode('wizard'); setWizardTier('advanced'); }}
                  data-testid="tab-advanced"
                  className={viewMode === 'wizard' && wizardTier === 'advanced' ? 'bg-blue-600 text-white' : 'text-white/70 hover:text-white hover:bg-white/10'}
                >
                  <Layers className="w-4 h-4 mr-1" />
                  Advanced
                </Button>
              )}
              {unlockedTiers.studio && (
                <Button
                  variant={viewMode === 'wizard' && wizardTier === 'studio' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => { setViewMode('wizard'); setWizardTier('studio'); }}
                  data-testid="tab-studio"
                  className={viewMode === 'wizard' && wizardTier === 'studio' ? 'bg-amber-600 text-white' : 'text-white/70 hover:text-white hover:bg-white/10'}
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
          </div>
        </div>

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
            <CardHeader className="pb-2">
              <CardTitle className="text-white flex items-center gap-2">
                <Wand2 className="w-5 h-5 text-green-400" />
                Simple Wizard
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 pt-2">
              <SimpleWizardProgressBar currentStep={simpleStep} />

              <div className="min-h-[400px]">
                {simpleStep === 'channel' && (
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
                {simpleStep === 'type' && (
                  <TypePickerStep 
                    selectedType={qrType}
                    onSelect={setQrType}
                  />
                )}
                {simpleStep === 'background' && user?.id && (
                  <SimpleBackgroundStep
                    memberId={user.id}
                    backgroundUrl={backgroundUrl}
                    onBackgroundSelected={(croppedUrl, originalUrl) => {
                      setBackgroundUrl(croppedUrl);
                      setOriginalBackgroundUrl(originalUrl);
                      // Go to text-ask step after background selection
                      setSimpleStep('text-ask');
                    }}
                    onComplete={() => {}}
                  />
                )}
                {simpleStep === 'text-ask' && (
                  <TextAskStep
                    backgroundUrl={backgroundUrl}
                    onYes={() => {
                      setWantsText(true);
                      setSimpleStep('text-choice');
                    }}
                    onNo={() => {
                      setWantsText(false);
                      setSimpleStep('details');
                    }}
                  />
                )}
                {simpleStep === 'text-choice' && (
                  <TextLayoutChoiceStep
                    selected={textLayoutChoice}
                    onSelect={(choice) => {
                      setTextLayoutChoice(choice);
                      setSimpleStep('text-edit');
                    }}
                  />
                )}
                {simpleStep === 'text-edit' && (
                  <TextEditStep
                    layout={textLayoutChoice}
                    backgroundUrl={backgroundUrl}
                    headerStyle={headerStyle}
                    footerStyle={footerStyle}
                    onHeaderChange={setHeaderStyle}
                    onFooterChange={setFooterStyle}
                  />
                )}
                {simpleStep === 'details' && (
                  <DetailsStep
                    title={simpleTitle}
                    description={simpleDescription}
                    onTitleChange={setSimpleTitle}
                    onDescriptionChange={setSimpleDescription}
                  />
                )}
                {simpleStep === 'preview' && (
                  <SimplePreviewStep
                    backgroundUrl={backgroundUrl}
                    headerStyle={headerStyle}
                    footerStyle={footerStyle}
                    title={simpleTitle}
                    onGoBack={() => setSimpleStep('details')}
                  />
                )}
                {simpleStep === 'publish' && (
                  <SimplePublishStep
                    isPublishing={isPublishing}
                    onPublish={handleSimplePublish}
                    title={simpleTitle}
                    qrType={qrType}
                    backgroundUrl={backgroundUrl}
                  />
                )}
              </div>

              <div className="flex flex-wrap gap-3 justify-between mt-8 pt-6 border-t border-slate-700">
                <Button
                  variant="outline"
                  onClick={handleSimpleBack}
                  disabled={simpleStep === 'channel'}
                  className="flex-1 min-w-[100px] sm:flex-none"
                  data-testid="button-simple-back"
                >
                  <ChevronLeft className="w-4 h-4 mr-1" />
                  Back
                </Button>
                
                {simpleStep !== 'publish' && (
                  <Button
                    onClick={handleSimpleNext}
                    disabled={!canSimpleProceed()}
                    className={`flex-1 min-w-[100px] sm:flex-none transition-all duration-300 ${
                      canSimpleProceed() 
                        ? "bg-green-500 hover:bg-green-600 shadow-lg shadow-green-500/40" 
                        : "bg-slate-600"
                    }`}
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
                  <ProductPickerStep 
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
                      setSelectedPlacements(prev => 
                        prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]
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
                      <h2 className="text-2xl font-bold text-white mb-2">Background Image</h2>
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
                    
                    {backgroundUrl && (
                      <div className="relative">
                        <div className="aspect-[9/16] max-w-[200px] mx-auto rounded-lg overflow-hidden border-2 border-primary">
                          <img 
                            src={backgroundUrl} 
                            alt="Selected background" 
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <Button
                          size="sm"
                          variant="destructive"
                          className="absolute top-2 right-2"
                          onClick={() => setBackgroundUrl('')}
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
                        selectedUrl={backgroundUrl}
                        onSelect={(croppedUrl, originalUrl) => {
                          setBackgroundUrl(croppedUrl);
                          setOriginalBackgroundUrl(originalUrl);
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
                    backgroundUrl={backgroundUrl}
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
