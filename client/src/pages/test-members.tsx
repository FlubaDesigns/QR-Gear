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
type SimpleWizardStep = 'channel' | 'type' | 'background' | 'save' | 'details' | 'publish';
type QRType = 'qr-basic' | 'qr-plus' | 'qr-canvas' | 'qr-play' | '';
type WizardTier = 'simple' | 'advanced' | 'studio';

// Simple Wizard - 6 essential steps for first-time users
const SIMPLE_WIZARD_STEPS: { id: SimpleWizardStep; label: string; icon: any }[] = [
  { id: 'channel', label: 'Channel', icon: Layers },
  { id: 'type', label: 'Type', icon: Sparkles },
  { id: 'background', label: 'Background', icon: ImagePlus },
  { id: 'save', label: 'Save', icon: Library },
  { id: 'details', label: 'Details', icon: Type },
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
      case 'background': return true; // Background is optional
      case 'save': return true; // Save is optional - they can skip
      case 'details': return simpleTitle.trim() !== '';
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
                {simpleStep === 'background' && (
                  <div className="space-y-6">
                    <div className="text-center mb-6">
                      <h2 className="text-2xl font-bold text-white mb-2">Pick a Background</h2>
                      <p className="text-slate-400">Choose an image for your creation (optional)</p>
                    </div>
                    
                    <Button
                      variant="outline"
                      size="lg"
                      className="w-full h-16 text-lg"
                      onClick={() => setShowBackgroundLibrary(true)}
                      data-testid="button-simple-background-library"
                    >
                      <Library className="w-5 h-5 mr-2" />
                      Browse Backgrounds
                    </Button>
                    
                    {backgroundUrl && (
                      <div className="relative max-w-[200px] mx-auto">
                        <div className="aspect-[9/16] rounded-lg overflow-hidden border-2 border-green-500">
                          <img src={backgroundUrl} alt="Selected" className="w-full h-full object-cover" />
                        </div>
                        <Button
                          size="sm"
                          variant="destructive"
                          className="absolute top-2 right-2"
                          onClick={() => setBackgroundUrl('')}
                          data-testid="button-simple-clear-background"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    )}

                    {!backgroundUrl && (
                      <p className="text-center text-slate-500 text-sm">You can skip this step if you prefer</p>
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
                {simpleStep === 'save' && (
                  <div className="space-y-6">
                    <div className="text-center mb-6">
                      <h2 className="text-2xl font-bold text-white mb-2">Save to Your Library</h2>
                      <p className="text-slate-400">Save your cropped image to use again later</p>
                    </div>
                    
                    {backgroundUrl && (
                      <div className="relative max-w-[200px] mx-auto mb-6">
                        <div className="aspect-[9/16] rounded-lg overflow-hidden border-2 border-slate-600">
                          <img src={backgroundUrl} alt="Cropped" className="w-full h-full object-cover" />
                        </div>
                      </div>
                    )}

                    <div className="grid grid-cols-1 gap-4 max-w-md mx-auto">
                      <Button
                        size="lg"
                        className="h-16 text-lg"
                        onClick={async () => {
                          if (backgroundUrl && user?.id) {
                            try {
                              const headers = await getAuthHeaders();
                              await fetch(`/api/members/${user.id}/library/upload`, {
                                method: 'POST',
                                headers: { ...headers, 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                  assetType: 'background',
                                  name: 'Cropped Background',
                                  imageData: backgroundUrl,
                                  mimeType: 'image/jpeg',
                                  originalName: 'cropped_background.jpg'
                                })
                              });
                              toast({ title: "Cropped image saved to your library" });
                            } catch (err) {
                              toast({ title: "Save failed", variant: "destructive" });
                            }
                          }
                          setSimpleStep('details');
                        }}
                        data-testid="button-save-crop-only"
                      >
                        <Library className="w-5 h-5 mr-2" />
                        Save Crop Only
                      </Button>
                      
                      <Button
                        size="lg"
                        variant="outline"
                        className="h-16 text-lg"
                        onClick={async () => {
                          if (backgroundUrl && user?.id && originalBackgroundUrl) {
                            try {
                              const headers = await getAuthHeaders();
                              // Save cropped
                              await fetch(`/api/members/${user.id}/library/upload`, {
                                method: 'POST',
                                headers: { ...headers, 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                  assetType: 'background',
                                  name: 'Cropped Background',
                                  imageData: backgroundUrl,
                                  mimeType: 'image/jpeg',
                                  originalName: 'cropped_background.jpg'
                                })
                              });
                              // Save original
                              const originalBlob = await fetch(originalBackgroundUrl).then(r => r.blob());
                              const reader = new FileReader();
                              const originalData = await new Promise<string>((resolve, reject) => {
                                reader.onload = () => resolve(reader.result as string);
                                reader.onerror = reject;
                                reader.readAsDataURL(originalBlob);
                              });
                              await fetch(`/api/members/${user.id}/library/upload`, {
                                method: 'POST',
                                headers: { ...headers, 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                  assetType: 'background',
                                  name: 'Original Background',
                                  imageData: originalData,
                                  mimeType: 'image/jpeg',
                                  originalName: 'original_background.jpg'
                                })
                              });
                              toast({ title: "Cropped and original saved to your library" });
                            } catch (err) {
                              toast({ title: "Save failed", variant: "destructive" });
                            }
                          }
                          setSimpleStep('details');
                        }}
                        data-testid="button-save-crop-and-original"
                      >
                        <ImagePlus className="w-5 h-5 mr-2" />
                        Save Crop & Original
                      </Button>
                      
                      <Button
                        size="lg"
                        variant="ghost"
                        className="h-12 text-slate-400"
                        onClick={() => setSimpleStep('details')}
                        data-testid="button-skip-save"
                      >
                        Skip
                      </Button>
                    </div>
                  </div>
                )}
                {simpleStep === 'details' && (
                  <DetailsStep
                    title={simpleTitle}
                    description={simpleDescription}
                    onTitleChange={setSimpleTitle}
                    onDescriptionChange={setSimpleDescription}
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
