import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { 
  Users, 
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
  X
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { auth } from "@/lib/firebase";
import SEO from "@/components/SEO";
import { TextStyleEditor, type TextStyleConfig, defaultTextStyle } from "@/features/shared/components/TextStyleEditor";
import { GraphicPreviewView } from "@/features/shared/components/skins/GraphicPreviewView";
import { SkinGridViewer, type SkinItem, type SkinActions } from "@/features/shared/components/SkinGridViewer";
import { AllowedProductCardSkin, AllowedProductDetailSkin } from "@/features/shared/components/skins/AllowedProductSkin";
import { BackgroundLibraryPicker } from "@/features/shared/components/BackgroundLibraryPicker";
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

type WizardStep = 'channel' | 'product' | 'qr-type' | 'customize' | 'background' | 'preview' | 'publish';
type QRType = 'qr-basic' | 'qr-plus' | 'qr-canvas' | 'qr-play' | '';

const WIZARD_STEPS: { id: WizardStep; label: string; icon: any }[] = [
  { id: 'channel', label: 'Channel', icon: Layers },
  { id: 'product', label: 'Pick Item', icon: Package },
  { id: 'qr-type', label: 'QR Type', icon: QrCode },
  { id: 'customize', label: 'Customize', icon: Sparkles },
  { id: 'background', label: 'Background', icon: ImagePlus },
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

function WizardProgressBar({ 
  currentStep, 
  onStepClick,
  completedSteps 
}: { 
  currentStep: WizardStep; 
  onStepClick: (step: WizardStep) => void;
  completedSteps: Set<WizardStep>;
}) {
  const currentIndex = WIZARD_STEPS.findIndex(s => s.id === currentStep);
  
  return (
    <div className="w-full mb-8">
      <div className="flex items-center justify-between relative">
        <div className="absolute top-5 left-0 right-0 h-0.5 bg-slate-700 -z-10" />
        <div 
          className="absolute top-5 left-0 h-0.5 bg-blue-500 transition-all duration-300 -z-10"
          style={{ width: `${(currentIndex / (WIZARD_STEPS.length - 1)) * 100}%` }}
        />
        
        {WIZARD_STEPS.map((step, index) => {
          const isActive = step.id === currentStep;
          const isCompleted = completedSteps.has(step.id);
          const isPast = index < currentIndex;
          const StepIcon = step.icon;
          
          return (
            <button
              key={step.id}
              onClick={() => onStepClick(step.id)}
              className={`flex flex-col items-center gap-2 transition-all ${
                isActive || isPast || isCompleted ? 'cursor-pointer' : 'cursor-not-allowed opacity-50'
              }`}
              disabled={!isActive && !isPast && !isCompleted}
              data-testid={`wizard-step-${step.id}`}
            >
              <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${
                isCompleted 
                  ? 'bg-green-600 text-white' 
                  : isActive 
                    ? 'bg-blue-600 text-white ring-4 ring-blue-600/30' 
                    : isPast
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-700 text-slate-400'
              }`}>
                {isCompleted ? <Check className="w-5 h-5" /> : <StepIcon className="w-5 h-5" />}
              </div>
              <span className={`text-xs font-medium ${
                isActive ? 'text-blue-400' : isPast || isCompleted ? 'text-white' : 'text-slate-500'
              }`}>
                {step.label}
              </span>
            </button>
          );
        })}
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
    subtitle: p.brand,
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
    },
  }));

  const handleItemTap = (item: ScrollViewItem) => {
    onSelect({
      id: Number(item.id),
      name: item.title,
      thumbnailUrl: item.imageUrl || null
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

function QRTypeStep({ 
  qrType, 
  onSelect 
}: { 
  qrType: QRType;
  onSelect: (type: QRType) => void;
}) {
  return (
    <div className="space-y-6">
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold text-white mb-2">Pick Your Poison</h2>
        <p className="text-slate-400">What kind of QR experience do you want?</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {QR_TYPES.map((type) => {
          const Icon = type.icon;
          const isSelected = qrType === type.id;
          const colorClasses = {
            slate: 'border-slate-500 bg-slate-600/20',
            blue: 'border-blue-500 bg-blue-600/20',
            purple: 'border-purple-500 bg-purple-600/20',
            rose: 'border-rose-500 bg-rose-600/20',
          };
          const iconColors = {
            slate: 'text-slate-400',
            blue: 'text-blue-400',
            purple: 'text-purple-400',
            rose: 'text-rose-400',
          };
          
          return (
            <button
              key={type.id}
              onClick={() => onSelect(type.id)}
              className={`p-6 rounded-xl border-2 text-left transition-all ${
                isSelected
                  ? colorClasses[type.color as keyof typeof colorClasses]
                  : 'border-slate-600 bg-slate-800/50 hover:border-slate-500'
              }`}
              data-testid={`qr-type-${type.id}`}
            >
              <div className="flex items-center gap-3 mb-2">
                <div className={`p-2 rounded-lg ${isSelected ? 'bg-white/10' : 'bg-slate-700'}`}>
                  <Icon className={`w-6 h-6 ${isSelected ? iconColors[type.color as keyof typeof iconColors] : 'text-slate-400'}`} />
                </div>
                <span className="text-lg font-semibold text-white">{type.label}</span>
              </div>
              <p className="text-sm text-slate-400 ml-12">{type.description}</p>
              {isSelected && (
                <div className="mt-3 ml-12">
                  <Badge className="bg-green-600/20 text-green-400 border-green-500/30">
                    <Check className="w-3 h-3 mr-1" />
                    Selected
                  </Badge>
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function CustomizeStep({ 
  qrType,
  qrDestination,
  onDestinationChange,
  headerStyle,
  onHeaderStyleChange,
  footerStyle,
  onFooterStyleChange,
  backgroundUrl,
  onBackgroundChange,
  backgroundText,
  onBackgroundTextChange,
  videoUrl,
  onVideoUrlChange,
  memberId
}: { 
  qrType: QRType;
  qrDestination: string;
  onDestinationChange: (url: string) => void;
  headerStyle: TextStyleConfig;
  onHeaderStyleChange: (style: TextStyleConfig) => void;
  footerStyle: TextStyleConfig;
  onFooterStyleChange: (style: TextStyleConfig) => void;
  backgroundUrl: string;
  onBackgroundChange: (url: string) => void;
  backgroundText: TextStyleConfig;
  onBackgroundTextChange: (style: TextStyleConfig) => void;
  videoUrl: string;
  onVideoUrlChange: (url: string) => void;
  memberId: string;
}) {
  const [showBackgroundLibrary, setShowBackgroundLibrary] = useState(false);
  const [showVideoLibrary, setShowVideoLibrary] = useState(false);
  const showHeaderFooter = qrType === 'qr-plus' || qrType === 'qr-canvas' || qrType === 'qr-play';
  const showBackground = qrType === 'qr-canvas';
  const showVideo = qrType === 'qr-play';

  return (
    <div className="space-y-6">
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold text-white mb-2">Customize Your QR</h2>
        <p className="text-slate-400">
          {qrType === 'qr-basic' && 'Enter your destination URL'}
          {qrType === 'qr-plus' && 'Add text styling to your landing page'}
          {qrType === 'qr-canvas' && 'Design your image landing page'}
          {qrType === 'qr-play' && 'Set up your video landing page'}
        </p>
      </div>

      {/* URL Module - All types need a destination */}
      <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
        <div className="flex items-center gap-2 mb-3">
          <Link2 className="w-5 h-5 text-blue-400" />
          <span className="font-medium text-white">Destination URL</span>
        </div>
        <input
          type="url"
          value={qrDestination}
          onChange={(e) => onDestinationChange(e.target.value)}
          placeholder="https://example.com"
          className="w-full p-3 bg-slate-900 border border-slate-600 rounded-lg text-white placeholder:text-slate-500 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
          data-testid="input-qr-destination"
        />
        {qrType !== 'qr-basic' && (
          <p className="text-xs text-slate-500 mt-2">
            For {qrType === 'qr-canvas' ? 'Canvas' : qrType === 'qr-play' ? 'Play' : 'Plus'}, 
            this will be generated after you design your content
          </p>
        )}
      </div>

      {/* Header/Footer Module - Plus, Canvas, Play */}
      {showHeaderFooter && (
        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
          <div className="flex items-center gap-2 mb-4">
            <Type className="w-5 h-5 text-blue-400" />
            <span className="font-medium text-white">Header & Footer Text</span>
            <Badge className="ml-auto text-xs">+$2 per line</Badge>
          </div>
          
          <div className="space-y-4">
            <TextStyleEditor
              label="Top Text"
              sublabel="Appears at top of graphic"
              maxLength={40}
              style={headerStyle}
              onChange={(updates) => onHeaderStyleChange({ ...headerStyle, ...updates })}
              testIdPrefix="header"
              showPositionControls={true}
              previewBackgroundColor="#1a1a2e"
            />
            
            <TextStyleEditor
              label="Bottom Text"
              sublabel="Appears at bottom of graphic"
              maxLength={40}
              style={footerStyle}
              onChange={(updates) => onFooterStyleChange({ ...footerStyle, ...updates })}
              testIdPrefix="footer"
              showPositionControls={true}
              previewBackgroundColor="#1a1a2e"
            />
          </div>
          
          {(headerStyle.enabled || footerStyle.enabled) && (
            <div className="mt-4 pt-4 border-t border-slate-600 flex flex-col items-center">
              <p className="text-xs text-slate-400 mb-2">Live Preview</p>
              <GraphicPreviewView
                backgroundColor="#1a1a2e"
                headerStyle={headerStyle}
                footerStyle={footerStyle}
                showQRCode={true}
                aspectRatio="square"
              />
            </div>
          )}
        </div>
      )}

      {/* Background Module - Canvas only */}
      {showBackground && (
        <div className="bg-slate-800/50 rounded-xl p-4 border border-purple-500/30">
          <div className="flex items-center gap-2 mb-4">
            <ImagePlus className="w-5 h-5 text-purple-400" />
            <span className="font-medium text-white">Background Image</span>
          </div>
          
          <div className="grid grid-cols-2 gap-3 mb-4">
            <button
              className="p-4 rounded-lg border-2 border-dashed border-slate-600 hover:border-purple-500 transition-colors flex flex-col items-center justify-center gap-2"
              onClick={() => setShowBackgroundLibrary(true)}
              data-testid="button-upload-background"
            >
              <Upload className="w-8 h-8 text-slate-400" />
              <span className="text-sm text-slate-400">Upload Image</span>
            </button>
            <button
              className="p-4 rounded-lg border-2 border-dashed border-slate-600 hover:border-purple-500 transition-colors flex flex-col items-center justify-center gap-2"
              onClick={() => setShowBackgroundLibrary(true)}
              data-testid="button-library-background"
            >
              <Layers className="w-8 h-8 text-slate-400" />
              <span className="text-sm text-slate-400">From Library</span>
            </button>
          </div>
          
          {backgroundUrl && (
            <div className="relative aspect-[9/16] bg-slate-900 rounded-lg overflow-hidden">
              <img src={backgroundUrl} alt="Background" className="w-full h-full object-cover" />
              <button 
                className="absolute top-2 right-2 p-1.5 bg-black/60 rounded-full hover:bg-black/80"
                onClick={() => onBackgroundChange('')}
                data-testid="button-clear-background"
              >
                <X className="w-4 h-4 text-white" />
              </button>
            </div>
          )}
          
          <div className="mt-4">
            <TextStyleEditor
              label="Background Text"
              sublabel="Text overlay on your background"
              maxLength={100}
              style={backgroundText}
              onChange={(updates) => onBackgroundTextChange({ ...backgroundText, ...updates })}
              testIdPrefix="bg-text"
              showPositionControls={true}
              previewBackgroundColor="#1a1a2e"
            />
          </div>
        </div>
      )}

      {showBackgroundLibrary && memberId && (
        <BackgroundLibraryPicker
          memberId={memberId}
          selectedUrl={backgroundUrl}
          onSelect={(url) => {
            onBackgroundChange(url);
          }}
          onClose={() => setShowBackgroundLibrary(false)}
          assetType="background"
        />
      )}

      {/* Video Module - Play only */}
      {showVideo && (
        <div className="bg-slate-800/50 rounded-xl p-4 border border-rose-500/30">
          <div className="flex items-center gap-2 mb-4">
            <Play className="w-5 h-5 text-rose-400" />
            <span className="font-medium text-white">Video Content</span>
          </div>
          
          <div className="grid grid-cols-2 gap-3 mb-4">
            <button
              className="p-4 rounded-lg border-2 border-dashed border-slate-600 hover:border-rose-500 transition-colors flex flex-col items-center justify-center gap-2"
              data-testid="button-upload-video"
            >
              <Upload className="w-8 h-8 text-slate-400" />
              <span className="text-sm text-slate-400">Upload Video</span>
            </button>
            <div className="p-4 rounded-lg border border-slate-600 bg-slate-900">
              <label className="text-xs text-slate-400 mb-2 block">Or paste URL</label>
              <input
                type="url"
                value={videoUrl}
                onChange={(e) => onVideoUrlChange(e.target.value)}
                placeholder="YouTube, Vimeo..."
                className="w-full p-2 bg-slate-800 border border-slate-600 rounded text-white text-sm placeholder:text-slate-500 focus:border-rose-500 outline-none"
                data-testid="input-video-url"
              />
            </div>
          </div>
        </div>
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
  
  const [viewMode, setViewMode] = useState<ViewMode>('wizard');
  const [currentStep, setCurrentStep] = useState<WizardStep>('channel');
  const [completedSteps, setCompletedSteps] = useState<Set<WizardStep>>(new Set());
  const [powerMode, setPowerMode] = useState(false);
  const [hasCompletedWizard, setHasCompletedWizard] = useState(false);
  const [showSpeedBuildPrompt, setShowSpeedBuildPrompt] = useState(false);
  const [selectedChannel, setSelectedChannel] = useState<{ id: string; name: string } | null>(null);
  const [isCreatingChannel, setIsCreatingChannel] = useState(false);
  const [newChannelName, setNewChannelName] = useState('');
  
  // Check if user has completed wizard before
  useEffect(() => {
    if (user?.id) {
      const completed = localStorage.getItem(`wizard_completed_${user.id}`);
      setHasCompletedWizard(completed === 'true');
    }
  }, [user?.id]);
  
  // Mark wizard as completed when they publish
  const markWizardCompleted = () => {
    if (user?.id) {
      localStorage.setItem(`wizard_completed_${user.id}`, 'true');
      setHasCompletedWizard(true);
    }
  };
  
  const [selectedProduct, setSelectedProduct] = useState<ProductItem | null>(null);
  const [qrType, setQrType] = useState<QRType>('');
  const [qrDestination, setQrDestination] = useState<string>('');
  const [channelName, setChannelName] = useState<string>('My Products');
  const [isPublishing, setIsPublishing] = useState(false);
  
  // Customize step state
  const [headerStyle, setHeaderStyle] = useState<TextStyleConfig>({ ...defaultTextStyle });
  const [footerStyle, setFooterStyle] = useState<TextStyleConfig>({ ...defaultTextStyle });
  const [backgroundUrl, setBackgroundUrl] = useState<string>('');
  const [backgroundText, setBackgroundText] = useState<TextStyleConfig>({ ...defaultTextStyle });
  const [videoUrl, setVideoUrl] = useState<string>('');

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
      
      // Create the member product using the pre-selected channel
      const productRes = await fetch(`/api/members/${user.id}/products`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify({
          printfulProductId: selectedProduct.productId,
          variantId: selectedProduct.id,
          qrType,
          qrDestination,
          headerStyle: headerStyle.enabled ? headerStyle : null,
          footerStyle: footerStyle.enabled ? footerStyle : null,
          backgroundUrl: backgroundUrl || null,
          backgroundText: backgroundText.enabled ? backgroundText : null,
          videoUrl: videoUrl || null,
          channelId: selectedChannel.id,
          name: selectedProduct.name,
          price: 0 // Will be calculated later
        })
      });
      
      if (!productRes.ok) throw new Error('Failed to create product');
      
      setCompletedSteps(prev => new Set<WizardStep>([...Array.from(prev), 'publish']));
      markWizardCompleted(); // Unlock Speed Build for next time
      setShowSpeedBuildPrompt(true); // Show prompt about Speed Build
      setViewMode('channels'); // Switch to channels view to see the new item
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
      case 'qr-type': return qrType !== '';
      case 'customize': return true; // Will add validation per type
      case 'preview': return true;
      case 'publish': return true; // Channel already selected
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
            
            <div className="flex gap-2 flex-wrap">
              <Button
                variant={viewMode === 'wizard' && !powerMode ? 'default' : 'ghost'}
                size="sm"
                onClick={() => { setViewMode('wizard'); setPowerMode(false); }}
                data-testid="tab-wizard"
                className={viewMode === 'wizard' && !powerMode ? 'bg-blue-600 text-white' : 'text-white/70 hover:text-white hover:bg-white/10'}
              >
                <Wand2 className="w-4 h-4 mr-1" />
                Wizard
              </Button>
              {hasCompletedWizard && (
                <Button
                  variant={viewMode === 'wizard' && powerMode ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => { setViewMode('wizard'); setPowerMode(true); }}
                  data-testid="tab-power"
                  className={viewMode === 'wizard' && powerMode ? 'bg-amber-600 text-white' : 'text-white/70 hover:text-white hover:bg-white/10'}
                >
                  <Zap className="w-4 h-4 mr-1" />
                  Speed Build
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

        {showSpeedBuildPrompt && (
          <div className="glass-card p-4 mb-6 flex items-center justify-between gap-4 border-amber-500/50 bg-amber-900/20">
            <div className="flex items-center gap-3">
              <Zap className="w-6 h-6 text-amber-400" />
              <div>
                <p className="text-white font-medium">Speed Build Unlocked!</p>
                <p className="text-white/70 text-sm">You've mastered the basics. Use Speed Build next time for faster product creation.</p>
              </div>
            </div>
            <Button 
              size="sm" 
              variant="ghost" 
              onClick={() => setShowSpeedBuildPrompt(false)}
              className="text-white/70 hover:text-white"
              data-testid="dismiss-speed-build-prompt"
            >
              Got it
            </Button>
          </div>
        )}

        {viewMode === 'wizard' && !powerMode && (
          <Card className="bg-slate-800/50 border-slate-700">
            <CardContent className="p-6">
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
                {currentStep === 'qr-type' && (
                  <QRTypeStep 
                    qrType={qrType}
                    onSelect={setQrType}
                  />
                )}
                {currentStep === 'customize' && (
                  <CustomizeStep 
                    qrType={qrType}
                    qrDestination={qrDestination}
                    onDestinationChange={setQrDestination}
                    headerStyle={headerStyle}
                    onHeaderStyleChange={setHeaderStyle}
                    footerStyle={footerStyle}
                    onFooterStyleChange={setFooterStyle}
                    backgroundUrl={backgroundUrl}
                    onBackgroundChange={setBackgroundUrl}
                    backgroundText={backgroundText}
                    onBackgroundTextChange={setBackgroundText}
                    videoUrl={videoUrl}
                    onVideoUrlChange={setVideoUrl}
                    memberId={user?.id || ''}
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

        {viewMode === 'wizard' && powerMode && (
          <div className="space-y-4">
            <Card className="bg-slate-800/50 border-slate-700">
              <CardHeader className="pb-2">
                <CardTitle className="text-white text-lg flex items-center gap-2">
                  <Package className="w-5 h-5 text-blue-400" />
                  Quick Builder
                  <Badge className="bg-amber-600 text-white">Power Mode</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-300">Product</label>
                    <div 
                      className="p-3 bg-slate-700/50 rounded-lg border border-slate-600 cursor-pointer hover:border-blue-500 transition-colors"
                      onClick={() => { setCurrentStep('product'); setPowerMode(false); }}
                      data-testid="power-select-product"
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
                    <label className="text-sm font-medium text-slate-300">QR Type</label>
                    <div 
                      className="p-3 bg-slate-700/50 rounded-lg border border-slate-600 cursor-pointer hover:border-blue-500 transition-colors"
                      onClick={() => { setCurrentStep('qr-type'); setPowerMode(false); }}
                      data-testid="power-select-qr-type"
                    >
                      {qrType ? (
                        <div className="flex items-center gap-3">
                          <QrCode className="w-5 h-5 text-blue-400" />
                          <span className="text-white text-sm">{QR_TYPES.find(t => t.id === qrType)?.label || qrType}</span>
                        </div>
                      ) : (
                        <span className="text-slate-400 text-sm">Click to select QR type...</span>
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
