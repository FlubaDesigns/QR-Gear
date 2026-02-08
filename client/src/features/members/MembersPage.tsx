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
  Crop,
  AlertCircle
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
import {
  type WizardStep, type SimpleWizardStep, type QRBasicSaveOption, type QRPlusSaveOption,
  type QRCanvasSaveOption, type QRPlaySaveOption, type PlayVideoSource, type UrlSourceChoice,
  type LibraryChoice, type PlacementGraphicChoice, type QRBasicInputType, type PlacementOption,
  type QRType, type WizardTier, type BackgroundSubStep, type TextLayoutChoice,
  type GraphicLocation, type GraphicSize, type ViewMode,
  type ProductItem, type AllowedProduct, type MemberChannel, type GraphicSet, type ProductCategory,
  type MockupFetchParams, type MockupFetchResult,
  SHIRT_COLORS, SHIRT_SIZES, calculateSizeEarningsBonuses, SHIRT_TEXT_COLORS, SHIRT_TEXT_SIZES,
  SHIRT_TEXT_FONTS, PLACEMENT_OPTIONS, QR_TYPES,
  SIMPLE_WIZARD_STEPS, QR_BASIC_STEPS, QR_PLUS_STEPS, QR_PLAY_STEPS, QR_COMPOSE_STEPS, WIZARD_STEPS,
  isQRBasicStep, isQRPlusStep, isQRPlayStep, isQRComposeStep,
  getAuthHeaders, fetchProductMockup, generateQRCodeUrl,
} from "@/features/shared/components/wizardSteps";
import { SimpleWizardProgressBar, WizardProgressBar } from "@/features/shared/components/wizardSteps/WizardProgressBars";
import { ChannelStep } from "@/features/shared/components/wizardSteps/ChannelStep";
import { ProductPickerStep, ProductCongratsStep, ColorPickerStep, SizePickerStep } from "@/features/shared/components/wizardSteps/ProductSteps";
import { GraphicSizeStep, PlacementCountStep, PlacementDiagram, PlacementConfigStep } from "@/features/shared/components/wizardSteps/PlacementSteps";
import { TextAskStep, TextLayoutChoiceStep, TextStyleSection, TextEditStep, HeaderTextEditStep, FooterTextEditStep } from "@/features/shared/components/wizardSteps/TextSteps";
import { TypePickerStep, CapabilityOverviewStep, SurfacePickerStep, GenerateGraphicStep, GraphicLocationStep } from "@/features/shared/components/wizardSteps/TypeAndSurfaceSteps";
import { QRBasicTypeStep, QRBasicInputStep, QRBasicMockupStep, QRBasicSaveChoiceStep, QRBasicConfirmStep } from "@/features/shared/components/wizardSteps/QRBasicSteps";
import { QRPlusMockupStep, QRPlusSaveChoiceStep, QRPlusConfirmStep } from "@/features/shared/components/wizardSteps/QRPlusSteps";
import { QRCanvasExplainerStep, UrlSourceChoiceStep, SimpleBackgroundStep, QRCanvasSaveChoiceStep, QRCanvasConfirmStep, DetailsStep, SimplePreviewStep, SimplePublishStep } from "@/features/shared/components/wizardSteps/CanvasSteps";
import { PlayVideoSourceStep, VideoPlayerWithFallback, PlayPreviewStep, PlayPublishStep, PlayPublishedStep } from "@/features/shared/components/wizardSteps/PlaySteps";
import { ComposeModePicker, ComposePickItemsStep, ComposeDurationsStep, ComposeOrderStep, ComposeHostingStep, ComposePreviewStep, ComposePublishStep, ComposeConfirmStep, ComposeExplainerCard, PlatformAcknowledgementCard } from "@/features/shared/components/wizardSteps/ComposeSteps";
import type { ComposeMode } from "@/features/shared/components/wizardSteps/ComposeSteps";
import { ShirtPreviewStep, PhoneMockupWithQR, PhoneMockup, PreviewStep, PublishStep, UrlCreationStep, UrlTitleStep, UrlDescriptionStep } from "@/features/shared/components/wizardSteps/PreviewAndPublishSteps";

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
                  <h3 className="font-semibold text-white">QR Compose</h3>
                  <p className="text-sm text-slate-300">Build rotating playlists - one QR code cycles through your images and videos over time.</p>
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

      <Card className="bg-slate-800/50 border-slate-700">
        <CardHeader className="flex flex-row items-center justify-between gap-2">
          <CardTitle className="text-white flex items-center gap-2">
            <Wand2 className="w-5 h-5" />
            Create a Product
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <button
              onClick={() => onStartWizard('super-simple')}
              className="p-5 bg-gradient-to-br from-emerald-900/40 to-green-900/40 rounded-lg border border-emerald-500/30 hover:border-emerald-400/60 transition-all text-left group"
              data-testid="launch-super-simple"
            >
              <div className="w-12 h-12 mb-3 bg-emerald-500/20 rounded-full flex items-center justify-center">
                <Sparkles className="w-6 h-6 text-emerald-400" />
              </div>
              <h3 className="font-bold text-white text-lg mb-1">Super Simple</h3>
              <p className="text-sm text-slate-400">Tap through cards to build your product. Easiest way to start.</p>
            </button>
            <button
              onClick={() => onStartWizard('simple')}
              className="p-5 bg-gradient-to-br from-blue-900/40 to-indigo-900/40 rounded-lg border border-blue-500/30 hover:border-blue-400/60 transition-all text-left group"
              data-testid="launch-simple"
            >
              <div className="w-12 h-12 mb-3 bg-blue-500/20 rounded-full flex items-center justify-center">
                <Wand2 className="w-6 h-6 text-blue-400" />
              </div>
              <h3 className="font-bold text-white text-lg mb-1">Simple Wizard</h3>
              <p className="text-sm text-slate-400">Step-by-step guided experience with all the options.</p>
            </button>
            <button
              onClick={() => onStartWizard('advanced')}
              className="p-5 bg-gradient-to-br from-purple-900/40 to-violet-900/40 rounded-lg border border-purple-500/30 hover:border-purple-400/60 transition-all text-left group"
              data-testid="launch-advanced"
            >
              <div className="w-12 h-12 mb-3 bg-purple-500/20 rounded-full flex items-center justify-center">
                <Layers className="w-6 h-6 text-purple-400" />
              </div>
              <h3 className="font-bold text-white text-lg mb-1">Advanced</h3>
              <p className="text-sm text-slate-400">Dense 8-step builder with full control over every detail.</p>
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
      // Use the QR Compose collections endpoint, filtered by member
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
          My Collections (Compose)
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


function MembersSandboxContent() {
  const { user, isLoading: authLoading, isAuthenticated } = useAuth();
  const { toast } = useToast();
  const { api } = useMembersContext();
  
  const [viewMode, setViewMode] = useState<ViewMode>('index');
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
  const [earningsPulse, setEarningsPulse] = useState(false);
  
  // Fetch pricing settings from API for dynamic earnings calculations
  const { data: pricingSettings } = useQuery<{
    memberProfitShare: number;
    additionalPlacementCost: number;
    textLineUpcharge: number;
    sizeUpcharges: Record<string, number>;
    baseRetailPrice: number;
  }>({
    queryKey: ['/api/test/pricing-settings'],
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });
  
  // Calculate earnings bonuses from pricing settings
  const placementEarningsBonus = (pricingSettings?.additionalPlacementCost || 4) * (pricingSettings?.memberProfitShare || 0.25);
  const textLineEarningsBonus = (pricingSettings?.textLineUpcharge || 2) * (pricingSettings?.memberProfitShare || 0.25);
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
  
  // QR Canvas save-to-library state
  const [canvasSaveChoice, setCanvasSaveChoice] = useState<QRCanvasSaveOption>('');
  const [isCanvasSaving, setIsCanvasSaving] = useState(false);
  const [publishedPacketId, setPublishedPacketId] = useState<string | null>(null);
  const [publishedQrGraphicUrl, setPublishedQrGraphicUrl] = useState<string | null>(null);
  const [publishedProductGraphicUrl, setPublishedProductGraphicUrl] = useState<string | null>(null);
  
  // QR Play flow state
  const [playVideoSource, setPlayVideoSource] = useState<PlayVideoSource>('');
  const [playVideoUrl, setPlayVideoUrl] = useState<string>('');
  const [isUploadingVideo, setIsUploadingVideo] = useState(false);
  const [videoUploadError, setVideoUploadError] = useState<string | null>(null);
  const [videoUploadProgress, setVideoUploadProgress] = useState<number>(0);
  const [videoUploadSuccess, setVideoUploadSuccess] = useState(false);
  const [playSaveChoice, setPlaySaveChoice] = useState<QRPlaySaveOption>('');
  const [isPlaySaving, setIsPlaySaving] = useState(false);
  
  // QR Plus flow state (fork at step 12 for qr-plus type)
  const [qrPlusMockup, setQrPlusMockup] = useState<string>(''); // The product mockup image with full graphic
  const [isGeneratingPlusMockup, setIsGeneratingPlusMockup] = useState(false);
  const [qrPlusSaveChoice, setQrPlusSaveChoice] = useState<QRPlusSaveOption>('');
  const [isQrPlusSaving, setIsQrPlusSaving] = useState(false);
  
  // QR Canvas mockup state
  const [qrCanvasMockup, setQrCanvasMockup] = useState<string>('');
  const [isGeneratingCanvasMockup, setIsGeneratingCanvasMockup] = useState(false);
  
  // QR Play mockup state
  const [qrPlayMockup, setQrPlayMockup] = useState<string>('');
  const [isGeneratingPlayMockup, setIsGeneratingPlayMockup] = useState(false);
  
  // QR Compose state
  const [composeItems, setComposeItems] = useState<Array<{
    packetId: string;
    name: string;
    thumbnailUrl: string;
    type: 'qr-canvas' | 'qr-play';
    durationSeconds: number;
    order: number;
  }>>([]);
  const [composeMode, setComposeMode] = useState<ComposeMode | ''>('');
  const [composeHostingTerm, setComposeHostingTerm] = useState<'1-year' | '3-year' | '5-year' | ''>('');
  const [composeMockup, setComposeMockup] = useState<string>('');
  const [isGeneratingComposeMockup, setIsGeneratingComposeMockup] = useState(false);
  const [publishedCanvasPlayItems, setPublishedCanvasPlayItems] = useState<any[]>([]);
  const [isLoadingPublishedItems, setIsLoadingPublishedItems] = useState(false);
  const [composeInstanceId, setComposeInstanceId] = useState<string | null>(null);
  
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

  // Save QR Basic - now routes through unified publish
  const saveQrBasicToPacket = async () => {
    if (!user?.id) return false;
    setIsQrBasicSaving(true);
    try {
      await handleSimplePublish();
      return true;
    } finally {
      setIsQrBasicSaving(false);
    }
  };

  // Save QR Plus - now routes through unified publish
  const saveQrPlusToPacket = async () => {
    if (!user?.id) {
      console.error('[QR Plus Save] Missing user');
      return false;
    }
    setIsQrPlusSaving(true);
    try {
      await handleSimplePublish();
      return true;
    } finally {
      setIsQrPlusSaving(false);
    }
  };

  // Save QR Canvas assets to member library
  const saveCanvasToLibrary = async () => {
    if (!user?.id) return false;
    
    setIsCanvasSaving(true);
    try {
      const authHeaders = await getAuthHeaders();
      const assetsToSave: { url: string; assetType: string; name: string }[] = [];
      
      // Determine what to save based on choice
      if ((canvasSaveChoice === 'item' || canvasSaveChoice === 'all') && publishedProductGraphicUrl) {
        assetsToSave.push({
          url: publishedProductGraphicUrl,
          assetType: 'graphic',
          name: `${simpleTitle || 'Canvas'} - Product Graphic`
        });
      }
      
      if ((canvasSaveChoice === 'landing' || canvasSaveChoice === 'all') && urlGraphic) {
        assetsToSave.push({
          url: urlGraphic,
          assetType: 'background',
          name: `${simpleTitle || 'Canvas'} - Landing Page`
        });
      }
      
      if (canvasSaveChoice === 'all' && publishedQrGraphicUrl) {
        assetsToSave.push({
          url: publishedQrGraphicUrl,
          assetType: 'graphic',
          name: `${simpleTitle || 'Canvas'} - QR Code`
        });
      }
      
      // Save each asset to member library
      for (const asset of assetsToSave) {
        try {
          await fetch(`/api/members/${user.id}/library`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...authHeaders },
            body: JSON.stringify({
              publicUrl: asset.url,
              storageUrl: asset.url,
              assetType: asset.assetType,
              mediaType: 'image',
              name: asset.name,
              fileName: asset.name.replace(/[^a-zA-Z0-9]/g, '_') + '.png'
            })
          });
          console.log('[Canvas Save] Saved to library:', asset.assetType, asset.name);
        } catch (err) {
          console.error('[Canvas Save] Failed to save:', asset.assetType, err);
        }
      }
      
      return true;
    } finally {
      setIsCanvasSaving(false);
    }
  };

  const handleVideoFileUpload = async (file: File) => {
    const MAX_SIZE = 50 * 1024 * 1024; // 50MB
    const MIN_SIZE = 10 * 1024; // 10KB - reject tiny fragment files
    if (file.size > MAX_SIZE) {
      setVideoUploadError(`File is too large (${(file.size / 1024 / 1024).toFixed(1)}MB). Maximum size is 50MB. For larger videos, use the "Paste URL" option instead.`);
      return;
    }
    if (file.size < MIN_SIZE) {
      setVideoUploadError('This file is too small to be a valid video. Please select the actual video file from your camera roll.');
      return;
    }
    
    const rejectedExtensions = /\.(ts|m3u8|m3u)$/i;
    if (rejectedExtensions.test(file.name)) {
      setVideoUploadError('This file type (.ts stream) is not supported. Please select an MP4 or MOV video from your camera roll instead.');
      return;
    }
    
    if (file.type === 'video/mp2t' || file.type === 'video/mp2ts' || file.type === 'video/MP2T') {
      setVideoUploadError('Transport stream (.ts) files are not supported. Please select an MP4 or MOV video from your camera roll instead.');
      return;
    }
    
    const allowedTypes = ['video/mp4', 'video/webm', 'video/quicktime', 'video/3gpp', 'video/3gpp2', 'video/x-m4v', 'video/x-matroska'];
    const isVideo = file.type.startsWith('video/') || /\.(mp4|mov|webm|m4v|3gp)$/i.test(file.name);
    if (!isVideo && !allowedTypes.includes(file.type)) {
      setVideoUploadError('Please upload a video file (MP4, MOV, WebM, M4V, or 3GP).');
      return;
    }
    
    setVideoUploadError(null);
    setVideoUploadSuccess(false);
    setIsUploadingVideo(true);
    setVideoUploadProgress(0);
    
    try {
      const authHeaders = await getAuthHeaders();
      const memberId = user?.id;
      if (!memberId) throw new Error('Not signed in');
      
      const mimeType = file.type || 'video/mp4';
      
      const formData = new FormData();
      formData.append('file', file);
      formData.append('storeType', 'member');
      formData.append('userId', memberId);
      
      const result = await new Promise<{ url: string }>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        
        xhr.upload.addEventListener('progress', (e) => {
          if (e.lengthComputable) {
            const pct = Math.round((e.loaded / e.total) * 100);
            setVideoUploadProgress(pct);
          }
        });
        
        xhr.addEventListener('load', () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            try {
              const data = JSON.parse(xhr.responseText);
              resolve(data);
            } catch {
              reject(new Error('Invalid server response'));
            }
          } else {
            let msg = 'Upload failed';
            try {
              const errData = JSON.parse(xhr.responseText);
              msg = errData.error || msg;
            } catch {}
            reject(new Error(msg));
          }
        });
        
        xhr.addEventListener('error', () => {
          reject(new Error('Network error - check your connection and try again'));
        });
        
        xhr.addEventListener('abort', () => {
          reject(new Error('Upload was cancelled'));
        });
        
        xhr.open('POST', '/api/test/upload-media');
        const authHeader = (authHeaders as any)['Authorization'];
        if (authHeader) {
          xhr.setRequestHeader('Authorization', authHeader);
        }
        xhr.send(formData);
      });
      
      setPlayVideoUrl(result.url);
      setVideoUrl(result.url);
      setVideoUploadSuccess(true);
      console.log('[QR Play] Video uploaded successfully:', result.url);
      
      // Auto-save video to member library on upload
      try {
        const saveRes = await fetch(`/api/members/${memberId}/library/upload`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...authHeaders },
          body: JSON.stringify({
            assetType: 'video',
            name: `${simpleTitle || 'QR Play'} - Video`,
            imageData: 'data:text/plain;base64,' + btoa(result.url),
            mimeType: 'text/plain',
            originalName: `video-url-${Date.now()}.txt`,
          })
        });
        if (saveRes.ok) {
          console.log('[QR Play] Video auto-saved to member library');
        }
      } catch (libErr) {
        console.warn('[QR Play] Auto-save to library failed (non-blocking):', libErr);
      }
    } catch (error: any) {
      console.error('[QR Play] Video upload error:', error);
      setVideoUploadError(error?.message || 'Failed to upload video. Please try again.');
      setVideoUploadSuccess(false);
    } finally {
      setIsUploadingVideo(false);
    }
  };
  
  const savePlayToLibrary = async () => {
    if (!user?.id || playSaveChoice === 'skip') return;
    
    setIsPlaySaving(true);
    try {
      if (playVideoUrl && !playVideoUrl.startsWith('/api/member-files/')) {
        const authHeaders = await getAuthHeaders();
        const res = await fetch(`/api/members/${user.id}/library/upload`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...authHeaders },
          body: JSON.stringify({
            assetType: 'video',
            name: `${simpleTitle || 'QR Play'} - Video`,
            imageData: 'data:text/plain;base64,' + btoa(playVideoUrl),
            mimeType: 'text/plain',
            originalName: `video-url-${Date.now()}.txt`,
          })
        });
      }
    } catch (error) {
      console.error('[QR Play] Save to library error:', error);
    } finally {
      setIsPlaySaving(false);
    }
  };
  
  const fetchPublishedCanvasPlayItems = async () => {
    if (!user?.id) return;
    setIsLoadingPublishedItems(true);
    try {
      const authHeaders = await getAuthHeaders();
      const res = await fetch(`/api/members/${user.id}/published-items?types=qr-canvas,qr-play`, {
        headers: authHeaders
      });
      if (res.ok) {
        const data = await res.json();
        setPublishedCanvasPlayItems(data.items || []);
      }
    } catch (error) {
      console.error('[QR Compose] Error fetching published items:', error);
    } finally {
      setIsLoadingPublishedItems(false);
    }
  };

  const handlePlayDone = () => {
    setSimpleStep('channel');
    setCurrentPacketId(null);
    setSimpleTitle('');
    setSimpleDescription('');
    setQrType('');
    setPlayVideoUrl('');
    setPlayVideoSource('');
    setVideoUrl('');
    setPlaySaveChoice('');
    setVideoUploadError(null);
    setVideoUploadProgress(0);
    setVideoUploadSuccess(false);
  };

  // Handle QR Canvas done - reset wizard
  const handleCanvasDone = () => {
    setViewMode('channels');
    setSimpleStep('channel');
    setCurrentPacketId(null);
    setSimpleTitle('');
    setSimpleDescription('');
    setQrType('');
    setUrlGraphic('');
    setProductGraphic('');
    setCanvasSaveChoice('');
    setPublishedPacketId(null);
    setPublishedQrGraphicUrl(null);
    setPublishedProductGraphicUrl(null);
  };

  // Handle product selection - creates packet immediately for mockup handshake ID
  const handleProductSelect = async (product: AllowedProduct) => {
    setSelectedProductType(product);
    await createPacketForProduct(product);
  };

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
    const el = document.getElementById('wizard-step-content');
    if (el) el.scrollTop = 0;
    const card = el?.closest('.overflow-auto, .overflow-y-auto, .overflow-scroll');
    if (card) card.scrollTop = 0;
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  }, [simpleStep]);

  useEffect(() => {
    if (simpleStep === 'canvas-fork' && user?.id) {
      fetchPublishedCanvasPlayItems();
    }
  }, [simpleStep, user?.id]);

  const handleSimpleNext = async () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
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
      setSimpleStep('channel');
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
      setSimpleStep('channel');
      setCurrentPacketId(null);
      setQrPlusMockup('');
      setQrPlusSaveChoice('');
      return;
    }
    
    // Handle QR Play flow navigation
    if (simpleStep === 'play-video-source') {
      setSimpleStep('play-preview');
      return;
    }
    if (simpleStep === 'play-preview') {
      // Generate product mockup before publish
      setIsGeneratingPlayMockup(true);
      setSimpleStep('play-mockup');
      try {
        await generateProductMockupForType('qr-play', setQrPlayMockup);
      } finally {
        setIsGeneratingPlayMockup(false);
      }
      return;
    }
    if (simpleStep === 'play-mockup') {
      setSimpleStep('play-publish');
      return;
    }
    if (simpleStep === 'play-publish') {
      await handleSimplePublish();
      return;
    }
    if (simpleStep === 'play-save-choice') {
      handlePlayDone();
      return;
    }
    
    // Handle QR Canvas mockup flow
    if (simpleStep === 'url-preview') {
      // Generate product mockup before publish
      setIsGeneratingCanvasMockup(true);
      setSimpleStep('canvas-mockup');
      try {
        await generateProductMockupForType('qr-canvas', setQrCanvasMockup);
      } finally {
        setIsGeneratingCanvasMockup(false);
      }
      return;
    }
    if (simpleStep === 'canvas-mockup') {
      setSimpleStep('url-publish');
      return;
    }
    
    // Handle QR Canvas save flow navigation
    if (simpleStep === 'canvas-save-choice') {
      // Save to library based on choice, then confirm
      await saveCanvasToLibrary();
      setSimpleStep('canvas-confirm');
      return;
    }
    if (simpleStep === 'canvas-confirm') {
      // End of QR Canvas flow - reset wizard
      handleCanvasDone();
      return;
    }
    
    // Handle QR Compose flow navigation
    if (simpleStep === 'compose-pick-items') {
      if (composeItems.length < 2) return;
      setSimpleStep('compose-mode');
      return;
    }
    if (simpleStep === 'compose-mode') {
      if (!composeMode) return;
      if (composeMode === 'scan-to-reveal') {
        setSimpleStep('compose-order');
      } else {
        setSimpleStep('compose-durations');
      }
      return;
    }
    if (simpleStep === 'compose-durations') {
      setSimpleStep('compose-order');
      return;
    }
    if (simpleStep === 'compose-order') {
      setSimpleStep('compose-hosting');
      return;
    }
    if (simpleStep === 'compose-hosting') {
      if (!composeHostingTerm) return;
      setIsGeneratingComposeMockup(true);
      setSimpleStep('compose-mockup');
      try {
        await generateProductMockupForType('qr-compose', setComposeMockup);
      } finally {
        setIsGeneratingComposeMockup(false);
      }
      return;
    }
    if (simpleStep === 'compose-mockup') {
      setSimpleStep('compose-preview');
      return;
    }
    if (simpleStep === 'compose-preview') {
      setSimpleStep('compose-publish');
      return;
    }
    if (simpleStep === 'compose-publish') {
      await handleSimplePublish();
      return;
    }
    if (simpleStep === 'compose-confirm') {
      setSimpleStep('channel');
      setCurrentPacketId(null);
      setComposeItems([]);
      setComposeMode('');
      setComposeHostingTerm('');
      setComposeMockup('');
      setComposeInstanceId(null);
      return;
    }
    
    // Select correct steps array based on qrType
    const stepsArray = qrType === 'qr-basic' ? QR_BASIC_STEPS
      : qrType === 'qr-plus' ? QR_PLUS_STEPS
      : qrType === 'qr-play' ? QR_PLAY_STEPS
      : qrType === 'qr-compose' ? QR_COMPOSE_STEPS
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
    
    if (simpleStep === 'text-choice') {
      setSimpleStep(textLayoutChoice === 'footer' ? 'text-edit-footer' : 'text-edit-header');
      return;
    }
    
    if (simpleStep === 'text-edit-header') {
      if (textLayoutChoice === 'header') {
        setCurrentPlacementIndex(0);
        setPlacementGraphicChoice('');
        setPlacementSize('');
        const stepsArr = isQRPlusStep(simpleStep) ? QR_PLUS_STEPS : isQRPlayStep(simpleStep) ? QR_PLAY_STEPS : stepsArray;
        const pcIdx = stepsArr.findIndex(s => s.id === 'placement-config');
        if (pcIdx >= 0) {
          setSimpleStep('placement-config');
          return;
        }
      }
    }
    if (simpleStep === 'text-edit-footer') {
      setCurrentPlacementIndex(0);
      setPlacementGraphicChoice('');
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
    window.scrollTo({ top: 0, behavior: 'smooth' });
    // Handle compose-explainer and platform-acknowledge back navigation
    if (simpleStep === 'compose-explainer' || simpleStep === 'platform-acknowledge') {
      setSimpleStep('canvas-fork');
      return;
    }
    
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
    
    // Handle QR Play flow back navigation
    if (simpleStep === 'play-video-source') {
      setSimpleStep('canvas-fork');
      return;
    }
    if (simpleStep === 'play-preview') {
      setSimpleStep('play-video-source');
      return;
    }
    if (simpleStep === 'play-mockup') {
      setSimpleStep('play-preview');
      return;
    }
    if (simpleStep === 'play-publish') {
      setSimpleStep('play-mockup');
      return;
    }
    if (simpleStep === 'play-save-choice') {
      return;
    }
    
    // Handle QR Compose back navigation
    if (simpleStep === 'compose-pick-items') {
      setSimpleStep('canvas-fork');
      return;
    }
    if (simpleStep === 'compose-mode') {
      setSimpleStep('compose-pick-items');
      return;
    }
    if (simpleStep === 'compose-durations') {
      setSimpleStep('compose-mode');
      return;
    }
    if (simpleStep === 'compose-order') {
      if (composeMode === 'scan-to-reveal') {
        setSimpleStep('compose-mode');
      } else {
        setSimpleStep('compose-durations');
      }
      return;
    }
    if (simpleStep === 'compose-hosting') {
      setSimpleStep('compose-order');
      return;
    }
    if (simpleStep === 'compose-mockup') {
      setSimpleStep('compose-hosting');
      return;
    }
    if (simpleStep === 'compose-preview') {
      setSimpleStep('compose-mockup');
      return;
    }
    if (simpleStep === 'compose-publish') {
      setSimpleStep('compose-preview');
      return;
    }
    if (simpleStep === 'compose-confirm') {
      return;
    }
    
    // Handle canvas-fork and QR Canvas flow back navigation
    if (simpleStep === 'canvas-fork') {
      if (wantsHeaderFooter) {
        setSimpleStep('shirt-preview');
      } else {
        setSimpleStep('generate');
      }
      return;
    }
    if (simpleStep === 'canvas-mockup') {
      setSimpleStep('url-preview');
      return;
    }
    if (simpleStep === 'url-publish') {
      setSimpleStep('canvas-mockup');
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
      : qrType === 'qr-play' ? QR_PLAY_STEPS
      : qrType === 'qr-compose' ? QR_COMPOSE_STEPS
      : SIMPLE_WIZARD_STEPS;
    const currentIndex = stepsArray.findIndex(s => s.id === simpleStep);
    if (currentIndex > 0) {
      setSimpleStep(stepsArray[currentIndex - 1].id);
    }
  };

  const canSimpleProceed = () => {
    switch (simpleStep) {
      case 'channel': return selectedChannel !== null;
      case 'product': return selectedProductType !== null;
      case 'product-congrats': return true;
      case 'color': return selectedColor !== '';
      case 'size': return selectedShirtSize !== '';
      case 'type': return qrType !== '';
      case 'graphic-size': return graphicSize !== '';
      case 'generate': return wantsHeaderFooter !== null;
      case 'text-choice': return textLayoutChoice !== '';
      case 'placement-count': return selectedPlacements.length > 0;
      case 'text-edit-header': return true;
      case 'text-edit-footer': return true;
      case 'placement-config': return placementGraphicChoice !== '';
      case 'shirt-preview': return true;
      case 'url-explainer': return true;
      case 'url-source-choice': return libraryChoice !== '';
      case 'url-library-pick': return urlGraphic !== '';
      case 'url-title': return simpleTitle.trim() !== '';
      case 'url-description': return true;
      case 'url-preview': return true;
      case 'url-publish': return true;
      // QR Basic flow
      case 'qr-basic-type': return qrBasicInputType !== '';
      case 'qr-basic-input': {
        if (qrBasicContent.trim() === '') return false;
        if (qrBasicInputType === 'url') {
          try { new URL(qrBasicContent); } catch { return false; }
        }
        return true;
      }
      case 'qr-basic-mockup': return true;
      case 'qr-basic-save-choice': return qrBasicSaveChoice !== '';
      case 'qr-basic-confirm': return true;
      // QR Plus flow
      case 'qr-plus-mockup': return true;
      case 'qr-plus-save-choice': return qrPlusSaveChoice !== '';
      case 'qr-plus-confirm': return true;
      // Canvas/Play mockup steps
      case 'canvas-mockup': return true;
      case 'play-mockup': return true;
      // QR Canvas save flow
      case 'canvas-save-choice': return canvasSaveChoice !== '';
      case 'canvas-confirm': return true;
      // QR Play flow
      case 'play-video-source': return playVideoUrl !== '' && !isUploadingVideo;
      case 'play-preview': return true;
      case 'play-publish': return true;
      case 'play-save-choice': return true;
      case 'compose-pick-items': return composeItems.length >= 2;
      case 'compose-mode': return composeMode !== '';
      case 'compose-durations': return true;
      case 'compose-order': return true;
      case 'compose-hosting': return composeHostingTerm !== '';
      case 'compose-mockup': return !isGeneratingComposeMockup;
      case 'compose-preview': return true;
      case 'compose-publish': return !isPublishing;
      case 'compose-confirm': return true;
      default: return false;
    }
  };

  // Shared mockup generation for Canvas, Play, and Plus flows
  const generateProductMockupForType = async (
    type: string,
    setMockup: (url: string) => void,
  ) => {
    try {
      // Step 1: Generate qrGraphic (the actual QR code)
      const previewUrl = `${window.location.origin}/preview/${Date.now()}`;
      const qrApiUrl = generateQRCodeUrl(previewUrl, 200);
      setQrGraphic(qrApiUrl);
      console.log(`[${type}] Generated qrGraphic:`, qrApiUrl);
      
      // Step 2: Generate productGraphic (composite: header + QR + footer)
      console.log(`[${type}] Generating productGraphic with textLayoutChoice:`, textLayoutChoice);
      const productGraphicResult = await api.generateProductGraphic({
        qrUrl: previewUrl,
        headerStyle: headerStyle,
        footerStyle: footerStyle,
        textLayoutChoice: textLayoutChoice,
        qrColor: 'black',
      });
      
      let artworkForMockup = qrApiUrl;
      if (productGraphicResult.success && productGraphicResult.productGraphic) {
        setProductGraphic(productGraphicResult.productGraphic);
        artworkForMockup = productGraphicResult.productGraphic;
        console.log(`[${type}] Generated productGraphic (composite), length:`, productGraphicResult.productGraphic.length);
      } else {
        console.warn(`[${type}] productGraphic generation failed, using qrGraphic as fallback`);
        setProductGraphic(qrApiUrl);
      }
      
      // Step 3: Generate mockup using the productGraphic on the selected product
      if (selectedProductType?.blueprintId && selectedProductType?.printProviderId && selectedColor) {
        const effectiveQrSize = (graphicSize === 'small' || graphicSize === 'medium' || graphicSize === 'large') ? graphicSize : 'medium';
        console.log(`[${type}] Generating mockup with graphicSize:`, graphicSize, '→ effectiveQrSize:', effectiveQrSize);
        
        const mockupResult = await api.generateMockup({
          blueprintId: selectedProductType.blueprintId,
          printProviderId: selectedProductType.printProviderId,
          colorName: selectedColor,
          artworkUrl: artworkForMockup,
          placement: 'FRONT_CHEST',
          qrSize: effectiveQrSize,
        });
        
        const bestUrl = mockupResult.lifestyleMockupUrl || mockupResult.mockupUrl;
        if (mockupResult.success && bestUrl) {
          console.log(`[${type}] SUCCESS - Setting mockup to:`, bestUrl);
          setMockup(bestUrl);
        } else {
          console.warn(`[${type}] FAILED - Using QR fallback. Error:`, mockupResult.error);
          setMockup(qrApiUrl);
        }
      } else {
        console.warn(`[${type}] Missing product info for mockup`);
        setMockup(qrApiUrl);
      }
    } catch (error) {
      console.error(`[${type}] Error generating mockup:`, error);
      const fallbackUrl = generateQRCodeUrl('placeholder', 200);
      setMockup(fallbackUrl);
    }
  };

  const handleSimplePublish = async () => {
    if (!user?.id) {
      alert('You must be logged in to publish.');
      return;
    }
    if (!selectedChannel) {
      alert('Please select a channel first. Go to My Channels and select or create one.');
      return;
    }
    
    setIsPublishing(true);
    try {
      const authHeaders = await getAuthHeaders();
      
      // Calculate pricing breakdown
      const textLines = textLayoutChoice === 'both' ? 2 : (textLayoutChoice === 'header' || textLayoutChoice === 'footer') ? 1 : 0;
      const textUpcharge = textLines * (pricingSettings?.textLineUpcharge || 2);
      const extraPlacements = Math.max(0, selectedPlacements.length - 1);
      const placementUpcharge = extraPlacements * (pricingSettings?.additionalPlacementCost || 4);
      
      // Unified packet data — ALL wizard state for ALL QR types
      const packetData: Record<string, any> = {
        packetType: qrType,
        title: simpleTitle,
        description: simpleDescription,
        channelId: selectedChannel.id,
        storeId: user.id,
        status: 'published',
        // Product info
        boundProduct: selectedProductType ? {
          blueprintId: selectedProductType.blueprintId,
          printProviderId: selectedProductType.printProviderId,
          title: selectedProductType.title,
          imageUrl: selectedProductType.imageUrl,
          memberEarnings: selectedProductType.memberEarnings || 0,
          retailPrice: selectedProductType.retailPrice || 0,
          baseCost: selectedProductType.baseCost || 0,
        } : null,
        selectedColor: selectedColor || null,
        selectedShirtSize: selectedShirtSize || null,
        // Placement info
        selectedPlacements: selectedPlacements.length > 0 ? selectedPlacements : null,
        perPlacementConfigs: Object.keys(perPlacementConfigs).length > 0 ? perPlacementConfigs : null,
        perPlacementSizes: Object.keys(perPlacementSizes).length > 0 ? perPlacementSizes : null,
        graphicSize: graphicSize || null,
        // Text/header/footer
        textLayoutChoice: textLayoutChoice || null,
        headerText: headerStyle.enabled ? headerStyle.text : null,
        footerText: footerStyle.enabled ? footerStyle.text : null,
        headerStyle: headerStyle.enabled ? headerStyle : null,
        footerStyle: footerStyle.enabled ? footerStyle : null,
        // QR content
        qrType: qrType || null,
        qrDestination: qrDestination || null,
        qrGraphic: qrGraphic || null,
        productGraphic: productGraphic || null,
        // Background/landing
        background: urlGraphic || null,
        originalUrlGraphic: originalUrlGraphic || null,
        // Video (QR Play)
        videoUrl: qrType === 'qr-play' ? (playVideoUrl || videoUrl) : null,
        // QR Basic specific
        qrBasicInputType: qrType === 'qr-basic' ? (qrBasicInputType || null) : null,
        qrBasicContent: qrType === 'qr-basic' ? (qrBasicContent || null) : null,
        qrBasicMockup: qrType === 'qr-basic' ? (qrBasicMockup || null) : null,
        qrBasicSaveChoice: qrType === 'qr-basic' ? (qrBasicSaveChoice || null) : null,
        // QR Plus specific
        qrPlusMockup: qrType === 'qr-plus' ? (qrPlusMockup || null) : null,
        qrPlusSaveChoice: qrType === 'qr-plus' ? (qrPlusSaveChoice || null) : null,
        // QR Canvas mockup
        qrCanvasMockup: qrType === 'qr-canvas' ? (qrCanvasMockup || null) : null,
        // QR Play mockup
        qrPlayMockup: qrType === 'qr-play' ? (qrPlayMockup || null) : null,
        // QR Compose
        composeMockup: qrType === 'qr-compose' ? (composeMockup || null) : null,
        composeItems: qrType === 'qr-compose' ? composeItems : null,
        composeMode: qrType === 'qr-compose' ? (composeMode || 'auto-rotate') : null,
        composeHostingTerm: qrType === 'qr-compose' ? (composeHostingTerm || null) : null,
        // Pricing breakdown
        textLines,
        textUpcharge,
        placementUpcharge,
        memberEarnings: runningEarnings,
        // Source tracking
        source: { entryPoint: 'simple-wizard' },
      };
      
      console.log('[UnifiedPublish] Publishing packet:', {
        existingPacketId: currentPacketId,
        qrType,
        blueprintId: selectedProductType?.blueprintId,
        color: selectedColor,
        placements: selectedPlacements,
        graphicSize,
        textLayout: textLayoutChoice,
        earnings: runningEarnings,
      });
      
      let result: any;
      
      if (currentPacketId) {
        // Update existing packet (created at step 2 for mockup handshake) with ALL wizard data
        packetData.existingPacketId = currentPacketId;
        const res = await fetch(`/api/members/${user.id}/products`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...authHeaders },
          body: JSON.stringify(packetData)
        });
        if (!res.ok) throw new Error('Failed to publish');
        result = await res.json();
      } else {
        // No existing packet — create fresh (shouldn't normally happen)
        const res = await fetch(`/api/members/${user.id}/products`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...authHeaders },
          body: JSON.stringify(packetData)
        });
        if (!res.ok) throw new Error('Failed to publish');
        result = await res.json();
      }
      
      const packetId = result.id || result.packetId || currentPacketId || null;
      setPublishedPacketId(packetId);
      setCurrentPacketId(packetId);
      incrementPublishCount();
      
      // Route to appropriate post-publish step based on QR type
      if (qrType === 'qr-compose') {
        setComposeInstanceId(result.composeInstanceId || null);
        setSimpleStep('compose-confirm');
      } else if (qrType === 'qr-play') {
        setSimpleStep('play-save-choice');
      } else if (qrType === 'qr-canvas') {
        setPublishedQrGraphicUrl(result.qrGraphic || null);
        setPublishedProductGraphicUrl(result.productGraphic || null);
        try {
          const saveAuthHeaders = await getAuthHeaders();
          const assetsToSave: { url: string; assetType: string; name: string }[] = [];
          if (result.productGraphic) {
            assetsToSave.push({ url: result.productGraphic, assetType: 'graphic', name: `${simpleTitle || 'Canvas'} - Product Graphic` });
          }
          if (urlGraphic) {
            assetsToSave.push({ url: urlGraphic, assetType: 'background', name: `${simpleTitle || 'Canvas'} - Landing Page` });
          }
          if (result.qrGraphic) {
            assetsToSave.push({ url: result.qrGraphic, assetType: 'graphic', name: `${simpleTitle || 'Canvas'} - QR Code` });
          }
          for (const asset of assetsToSave) {
            try {
              await fetch(`/api/members/${user.id}/library`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', ...saveAuthHeaders },
                body: JSON.stringify({
                  publicUrl: asset.url,
                  storageUrl: asset.url,
                  assetType: asset.assetType,
                  mediaType: 'image',
                  name: asset.name,
                  fileName: asset.name.replace(/[^a-zA-Z0-9]/g, '_') + '.png'
                })
              });
            } catch (err) {
              console.error('[Canvas Auto-Save] Failed:', asset.assetType, err);
            }
          }
        } catch (saveErr) {
          console.error('[Canvas Auto-Save] Error:', saveErr);
        }
        setSimpleStep('canvas-confirm');
      } else if (qrType === 'qr-basic') {
        // QR Basic goes to confirm step (save already handled via saveQrBasicToPacket wrapper)
      } else if (qrType === 'qr-plus') {
        // QR Plus goes to confirm step (save already handled via saveQrPlusToPacket wrapper)
      } else {
        // Fallback - go back to channels
        setViewMode('channels');
        setSimpleStep('channel');
        setCurrentPacketId(null);
        setSimpleTitle('');
        setSimpleDescription('');
        setQrType('');
        setUrlGraphic('');
        setProductGraphic('');
      }
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
      
      const textLines = textLayoutChoice === 'both' ? 2 : (textLayoutChoice === 'header' || textLayoutChoice === 'footer') ? 1 : 0;
      const textUpcharge = textLines * (pricingSettings?.textLineUpcharge || 2);
      const extraPlacements = Math.max(0, selectedPlacements.length - 1);
      const placementUpcharge = extraPlacements * (pricingSettings?.additionalPlacementCost || 4);
      const baseProductPrice = (selectedProduct as any).retailPrice || pricingSettings?.baseRetailPrice || 0;
      const calculatedBasePrice = baseProductPrice + textUpcharge + placementUpcharge;

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
          price: calculatedBasePrice,
          textLines,
          textUpcharge,
          placementUpcharge,
          memberEarnings: runningEarnings
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
                onClick={() => { setViewMode('wizard'); setWizardTier('super-simple'); }}
                data-testid="tab-super-simple"
                className="text-white/70 hover:text-white hover:bg-white/10"
              >
                <Sparkles className="w-4 h-4 mr-1" />
                Super Simple
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
                Compose
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
            <CardContent className="p-4 pt-1">
              {(() => {
                const getTierInfo = () => {
                  if (['play-upload', 'play-preview', 'play-save-choice'].includes(simpleStep)) {
                    return { label: 'QR Play', color: 'text-purple-400 bg-purple-500/10 border-purple-500/20' };
                  }
                  if (['canvas-upload', 'canvas-crop', 'canvas-preview', 'canvas-save-choice', 'canvas-confirm', 'url-bg-pick', 'url-bg-crop', 'url-title', 'url-description', 'url-preview', 'url-publish'].includes(simpleStep)) {
                    return { label: 'QR Canvas', color: 'text-blue-400 bg-blue-500/10 border-blue-500/20' };
                  }
                  if (['text-choice', 'text-edit-header', 'text-edit-footer', 'placement-config', 'shirt-preview', 'qr-plus-mockup', 'qr-plus-save-choice', 'qr-plus-confirm'].includes(simpleStep)) {
                    return { label: 'QR Plus', color: 'text-orange-400 bg-orange-500/10 border-orange-500/20' };
                  }
                  if (['qr-basic-type', 'qr-basic-input', 'qr-basic-mockup', 'qr-basic-save-choice', 'qr-basic-confirm'].includes(simpleStep)) {
                    return { label: 'QR Basic', color: 'text-slate-300 bg-slate-500/10 border-slate-500/20' };
                  }
                  if (['compose-pick-items', 'compose-mode', 'compose-durations', 'compose-order', 'compose-hosting', 'compose-mockup', 'compose-preview', 'compose-publish', 'compose-confirm'].includes(simpleStep)) {
                    return { label: 'QR Compose', color: 'text-amber-400 bg-amber-500/10 border-amber-500/20' };
                  }
                  return { label: 'QR Basic', color: 'text-slate-300 bg-slate-500/10 border-slate-500/20' };
                };
                const tier = getTierInfo();
                return tier ? (
                  <div className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full border mb-2 ${tier.color}`} data-testid="badge-tier-label">
                    {tier.label}
                  </div>
                ) : null;
              })()}
              <SimpleWizardProgressBar currentStep={simpleStep} />
              {runningEarnings > 0 && (
                <div className={`flex items-center justify-center gap-2 mb-3 py-1.5 px-3 rounded-full bg-green-500/10 border border-green-500/20 mx-auto w-fit animate-in fade-in duration-500 transition-all ${earningsPulse ? 'scale-110 border-green-400/60 bg-green-500/20' : ''}`} data-testid="badge-potential-earnings">
                  <DollarSign className="w-3.5 h-3.5 text-green-400" />
                  <span className="text-green-400 font-bold text-sm">
                    ${runningEarnings.toFixed(2)} potential earnings
                  </span>
                </div>
              )}

              <div className="min-h-[350px]" id="wizard-step-content">
                {/* Step 0: Pick Channel */}
                {simpleStep === 'channel' && user && (
                  <ChannelStep
                    selectedChannel={selectedChannel}
                    onSelect={setSelectedChannel}
                    memberId={user.id}
                    isCreatingChannel={isCreatingChannel}
                    setIsCreatingChannel={setIsCreatingChannel}
                    newChannelName={newChannelName}
                    setNewChannelName={setNewChannelName}
                  />
                )}
                
                {/* Step 1: Pick Product */}
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
                      baseEarnings={runningEarnings}
                      sizeEarningsBonuses={sizeEarningsBonuses}
                      selectedPlacements={selectedPlacements}
                      onSelect={(size) => {
                        const oldBonus = sizeEarningsBonuses[selectedShirtSize] || 0;
                        const newBonus = sizeEarningsBonuses[size] || 0;
                        const earningsDiff = newBonus - oldBonus;
                        
                        setSelectedShirtSize(size);
                        
                        const doUpdate = () => {
                          if (selectedShirtSize && earningsDiff !== 0) {
                            setRunningEarnings(prev => prev + earningsDiff);
                          } else if (!selectedShirtSize) {
                            setRunningEarnings(prev => prev + newBonus);
                          }
                          setEarningsPulse(true);
                          setTimeout(() => setEarningsPulse(false), 600);
                        };
                        
                        if (size !== selectedShirtSize) {
                          setTimeout(doUpdate, 1200);
                        } else {
                          doUpdate();
                        }
                      }}
                    />
                  );
                })()}
                
                {/* Step 6: Type Picker */}
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
                        setSimpleStep('canvas-fork');
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
                      setSimpleStep('channel');
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
                      setSimpleStep('channel');
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
                      textLineEarningsBonus={textLineEarningsBonus}
                      onSelect={(choice) => {
                        const prevLines = textLayoutChoice === 'both' ? 2 : (textLayoutChoice === 'header' || textLayoutChoice === 'footer') ? 1 : 0;
                        const newLines = choice === 'both' ? 2 : 1;
                        const diff = newLines - prevLines;
                        if (diff !== 0) {
                          setRunningEarnings(prev => prev + (diff * textLineEarningsBonus));
                        }
                        setTextLayoutChoice(choice);
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
                
                {simpleStep === 'text-edit-header' && (
                  <HeaderTextEditStep
                    selectedColor={selectedColor}
                    graphicSize={graphicSize}
                    graphicLocation={graphicLocation}
                    headerStyle={headerStyle}
                    onHeaderChange={setHeaderStyle}
                    earningsPerLine={textLineEarningsBonus}
                  />
                )}

                {simpleStep === 'text-edit-footer' && (
                  <FooterTextEditStep
                    selectedColor={selectedColor}
                    graphicSize={graphicSize}
                    graphicLocation={graphicLocation}
                    footerStyle={footerStyle}
                    onFooterChange={setFooterStyle}
                    headerStyle={headerStyle}
                    earningsPerLine={textLineEarningsBonus}
                  />
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
                    selectedColor={selectedColor}
                    graphicSize={graphicSize}
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
                
                {/* Compose Explainer — shown when user clicks Compose without enough moments */}
                {simpleStep === 'compose-explainer' && (
                  <ComposeExplainerCard
                    publishedItemCount={publishedCanvasPlayItems.length}
                    onCreateMoment={() => {
                      setSimpleStep('canvas-fork');
                    }}
                    onBack={() => {
                      setSimpleStep('canvas-fork');
                    }}
                  />
                )}
                
                {/* Platform Acknowledgement — shown once when 2+ moments exist */}
                {simpleStep === 'platform-acknowledge' && (
                  <PlatformAcknowledgementCard
                    momentCount={publishedCanvasPlayItems.length}
                    onContinue={() => {
                      setSimpleStep('canvas-fork');
                    }}
                    onManageMoments={() => {
                      setViewMode('channels');
                    }}
                  />
                )}
                
                {/* Surface Picker — choose moment type or off-ramp to QR Plus */}
                {simpleStep === 'canvas-fork' && (
                  <SurfacePickerStep
                    onCanvas={() => {
                      setQrType('qr-canvas');
                      setSimpleStep('url-explainer');
                    }}
                    onPlay={() => {
                      setQrType('qr-play');
                      setSimpleStep('play-video-source');
                    }}
                    onCompose={() => {
                      if (publishedCanvasPlayItems.length < 2) {
                        setSimpleStep('compose-explainer');
                        return;
                      }
                      setQrType('qr-compose');
                      fetchPublishedCanvasPlayItems();
                      setSimpleStep('compose-pick-items');
                    }}
                    publishedItemCount={publishedCanvasPlayItems.length}
                    onSkip={async () => {
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
                    onComplete={() => setSimpleStep('url-title')}
                    initialSubStep={
                      urlSourceChoice === 'upload' ? 'upload' :
                      libraryChoice === 'personal' ? 'personal-library' :
                      libraryChoice === 'common' ? 'common-library' : 'choice'
                    }
                    croppedOnly={libraryChoice === 'personal'}
                  />
                )}
                
                {/* Step 14: URL Details - title, description with visual preview */}
                {simpleStep === 'url-title' && (
                  <UrlTitleStep
                    title={simpleTitle}
                    onTitleChange={setSimpleTitle}
                    background={urlGraphic}
                    description={simpleDescription}
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
                  />
                )}
                
                {simpleStep === 'url-description' && (
                  <UrlDescriptionStep
                    title={simpleTitle}
                    description={simpleDescription}
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
                    onGoBack={() => setSimpleStep('url-description')}
                  />
                )}
                
                {/* Canvas Product Mockup - shows shirt/product with QR graphic */}
                {simpleStep === 'canvas-mockup' && (
                  <QRPlusMockupStep
                    mockupUrl={qrCanvasMockup}
                    isLoading={isGeneratingCanvasMockup}
                    selectedColor={selectedColor}
                    selectedSize={selectedShirtSize}
                    headerText={headerStyle.enabled ? headerStyle.text : undefined}
                    footerText={footerStyle.enabled ? footerStyle.text : undefined}
                  />
                )}
                
                {/* Step 16: Publish */}
                {simpleStep === 'url-publish' && (
                  <SimplePublishStep
                    isPublishing={isPublishing}
                    onPublish={handleSimplePublish}
                    title={simpleTitle}
                    description={simpleDescription}
                    qrType={qrType}
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
                  />
                )}
                
                {/* QR Canvas: Save to Library Choice */}
                {simpleStep === 'canvas-save-choice' && (
                  <QRCanvasSaveChoiceStep
                    selected={canvasSaveChoice}
                    onSelect={setCanvasSaveChoice}
                  />
                )}
                
                {/* QR Canvas: Confirmation */}
                {simpleStep === 'canvas-confirm' && (
                  <QRCanvasConfirmStep
                    saveChoice={'all'}
                    productGraphicUrl={publishedProductGraphicUrl}
                    backgroundUrl={urlGraphic}
                    qrGraphicUrl={publishedQrGraphicUrl}
                    isSaving={isCanvasSaving}
                    onDone={handleCanvasDone}
                  />
                )}
                
                {simpleStep === 'play-video-source' && (
                  <PlayVideoSourceStep
                    videoUrl={playVideoUrl}
                    onVideoUrlChange={(url) => {
                      setPlayVideoUrl(url);
                      setVideoUrl(url);
                    }}
                    onFileUpload={handleVideoFileUpload}
                    isUploading={isUploadingVideo}
                    uploadError={videoUploadError}
                    uploadProgress={videoUploadProgress}
                    uploadSuccess={videoUploadSuccess}
                  />
                )}
                
                {simpleStep === 'play-preview' && (
                  <PlayPreviewStep
                    videoUrl={playVideoUrl}
                    title={simpleTitle}
                  />
                )}
                
                {/* Play Product Mockup - shows shirt/product with QR graphic */}
                {simpleStep === 'play-mockup' && (
                  <QRPlusMockupStep
                    mockupUrl={qrPlayMockup}
                    isLoading={isGeneratingPlayMockup}
                    selectedColor={selectedColor}
                    selectedSize={selectedShirtSize}
                    headerText={headerStyle.enabled ? headerStyle.text : undefined}
                    footerText={footerStyle.enabled ? footerStyle.text : undefined}
                  />
                )}
                
                {simpleStep === 'play-publish' && (
                  <PlayPublishStep
                    videoUrl={playVideoUrl}
                    isPublishing={isPublishing}
                  />
                )}
                
                {simpleStep === 'play-save-choice' && (
                  <PlayPublishedStep />
                )}
                
                {simpleStep === 'compose-mode' && (
                  <ComposeModePicker
                    selected={composeMode}
                    onSelect={setComposeMode}
                  />
                )}

                {simpleStep === 'compose-pick-items' && (
                  <ComposePickItemsStep
                    availableItems={publishedCanvasPlayItems}
                    selectedItems={composeItems}
                    onToggleItem={(item: any) => {
                      const packetId = item.packetId || item.id;
                      const existing = composeItems.find(i => i.packetId === packetId);
                      if (existing) {
                        setComposeItems(prev => prev.filter(i => i.packetId !== packetId));
                      } else {
                        setComposeItems(prev => [...prev, {
                          packetId,
                          name: item.title || item.name || 'Untitled',
                          thumbnailUrl: item.qrCanvasMockup || item.qrPlayMockup || item.composeMockup || item.urlGraphic || item.thumbnailUrl || '',
                          type: item.packetType === 'qr-play' ? 'qr-play' : 'qr-canvas',
                          durationSeconds: 86400,
                          order: prev.length + 1,
                        }]);
                      }
                    }}
                    isLoading={isLoadingPublishedItems}
                  />
                )}

                {simpleStep === 'compose-durations' && (
                  <ComposeDurationsStep
                    items={composeItems}
                    onUpdateDuration={(packetId, seconds) => {
                      setComposeItems(prev => prev.map(i => 
                        i.packetId === packetId ? { ...i, durationSeconds: seconds } : i
                      ));
                    }}
                  />
                )}

                {simpleStep === 'compose-order' && (
                  <ComposeOrderStep
                    items={composeItems}
                    onMoveUp={(packetId) => {
                      setComposeItems(prev => {
                        const idx = prev.findIndex(i => i.packetId === packetId);
                        if (idx <= 0) return prev;
                        const next = [...prev];
                        [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
                        return next.map((i, j) => ({ ...i, order: j + 1 }));
                      });
                    }}
                    onMoveDown={(packetId) => {
                      setComposeItems(prev => {
                        const idx = prev.findIndex(i => i.packetId === packetId);
                        if (idx < 0 || idx >= prev.length - 1) return prev;
                        const next = [...prev];
                        [next[idx], next[idx + 1]] = [next[idx + 1], next[idx]];
                        return next.map((i, j) => ({ ...i, order: j + 1 }));
                      });
                    }}
                    onRemove={(packetId) => {
                      setComposeItems(prev => prev.filter(i => i.packetId !== packetId).map((i, j) => ({ ...i, order: j + 1 })));
                    }}
                  />
                )}

                {simpleStep === 'compose-hosting' && (
                  <ComposeHostingStep
                    selected={composeHostingTerm}
                    onSelect={setComposeHostingTerm}
                  />
                )}

                {simpleStep === 'compose-mockup' && (
                  <QRPlusMockupStep
                    mockupUrl={composeMockup}
                    isLoading={isGeneratingComposeMockup}
                    selectedColor={selectedColor}
                    selectedSize={selectedShirtSize}
                    headerText={headerStyle.enabled ? headerStyle.text : undefined}
                    footerText={footerStyle.enabled ? footerStyle.text : undefined}
                  />
                )}

                {simpleStep === 'compose-preview' && (
                  <ComposePreviewStep
                    items={composeItems}
                    hostingTerm={composeHostingTerm}
                    mockupUrl={composeMockup}
                    isLoadingMockup={isGeneratingComposeMockup}
                    selectedColor={selectedColor}
                    selectedSize={selectedShirtSize}
                    composeMode={composeMode || 'auto-rotate'}
                  />
                )}

                {simpleStep === 'compose-publish' && (
                  <ComposePublishStep
                    isPublishing={isPublishing}
                    itemCount={composeItems.length}
                  />
                )}

                {simpleStep === 'compose-confirm' && (
                  <ComposeConfirmStep
                    instanceId={composeInstanceId}
                    resolverUrl={composeInstanceId ? `/qr/d/${composeInstanceId}` : null}
                    itemCount={composeItems.length}
                  />
                )}
              </div>

              <div className="sticky bottom-0 flex flex-wrap gap-3 justify-between pt-4 pb-2 border-t border-slate-700 bg-slate-800/95 backdrop-blur-sm -mx-6 px-6 z-10 mt-4">
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
                
                {simpleStep !== 'url-publish' && (
                  <Button
                    onClick={handleSimpleNext}
                    disabled={!canSimpleProceed()}
                    className={`flex-1 min-w-[100px] sm:flex-none transition-all duration-300 ${
                      canSimpleProceed() 
                        ? "bg-green-500 hover:bg-green-600 shadow-lg shadow-green-500/40" 
                        : "bg-slate-600"
                    }`}
                    style={canSimpleProceed() ? { animation: "glow 1.2s ease-in-out infinite" } : undefined}
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
                    selectedProduct={selectedProductType}
                    onSelect={handleProductSelect}
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

        {viewMode === 'wizard' && wizardTier === 'super-simple' && (
          <div className="space-y-4">
            <Card className="bg-slate-800/50 border-slate-700 min-h-[500px] flex flex-col">
              <CardHeader className="pb-2 flex flex-row items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      if (simpleStep === 'channel') {
                        setViewMode('index');
                        setWizardTier('simple');
                      } else {
                        const steps: SimpleWizardStep[] = ['channel', 'product', 'product-congrats', 'color', 'size', 'type'];
                        const idx = steps.indexOf(simpleStep);
                        if (idx > 0) setSimpleStep(steps[idx - 1]);
                      }
                    }}
                    className="text-white/70 hover:text-white"
                    data-testid="super-simple-back"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </Button>
                  <p className="text-sm text-emerald-400 font-medium flex items-center gap-1">
                    <Sparkles className="w-4 h-4" />
                    Super Simple
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => { setViewMode('index'); }}
                  className="text-white/50 hover:text-white"
                  data-testid="super-simple-close"
                >
                  <X className="w-4 h-4" />
                </Button>
              </CardHeader>

              <div className="flex justify-center gap-1.5 px-4 pb-3">
                {['channel', 'product', 'color', 'size', 'type'].map((step) => {
                  const steps: SimpleWizardStep[] = ['channel', 'product', 'product-congrats', 'color', 'size', 'type'];
                  const currentIdx = steps.indexOf(simpleStep);
                  const stepIdx = step === 'product' ? 1 : step === 'color' ? 3 : step === 'size' ? 4 : step === 'type' ? 5 : 0;
                  return (
                    <div
                      key={step}
                      className={`h-2 rounded-full transition-all ${
                        currentIdx >= stepIdx ? 'bg-emerald-400 w-8' : 'bg-slate-600 w-4'
                      }`}
                      data-testid={`dot-${step}`}
                    />
                  );
                })}
              </div>

              <CardContent className="flex-1 p-6">
                {simpleStep === 'channel' && user && (
                  <ChannelStep
                    selectedChannel={selectedChannel}
                    onSelect={setSelectedChannel}
                    memberId={user.id}
                    isCreatingChannel={isCreatingChannel}
                    setIsCreatingChannel={setIsCreatingChannel}
                    newChannelName={newChannelName}
                    setNewChannelName={setNewChannelName}
                  />
                )}
                {simpleStep === 'product' && (
                  <ProductPickerStep
                    selectedProduct={selectedProductType}
                    onSelect={handleProductSelect}
                  />
                )}
                {simpleStep === 'product-congrats' && selectedProductType && (
                  <ProductCongratsStep
                    productName={selectedProductType.title}
                    earnings={selectedProductType.memberEarnings || 0}
                  />
                )}
                {simpleStep === 'color' && (
                  <ColorPickerStep
                    selectedColor={selectedColor}
                    onSelect={setSelectedColor}
                  />
                )}
                {simpleStep === 'size' && (() => {
                  const sizeEarningsBonuses = calculateSizeEarningsBonuses(
                    pricingSettings?.sizeUpcharges,
                    pricingSettings?.memberProfitShare || 0.25
                  );
                  return (
                    <SizePickerStep
                      selectedSize={selectedShirtSize}
                      selectedColor={selectedColor}
                      baseEarnings={runningEarnings}
                      sizeEarningsBonuses={sizeEarningsBonuses}
                      selectedPlacements={selectedPlacements}
                      onSelect={setSelectedShirtSize}
                    />
                  );
                })()}
                {simpleStep === 'type' && (
                  <TypePickerStep
                    selectedType={qrType}
                    onSelect={setQrType}
                  />
                )}
              </CardContent>

              <div className="p-4 pt-0">
                <Button
                  onClick={() => {
                    const steps: SimpleWizardStep[] = ['channel', 'product', 'product-congrats', 'color', 'size', 'type'];
                    const idx = steps.indexOf(simpleStep);
                    if (simpleStep === 'type' && qrType) {
                      setWizardTier('simple');
                    } else if (idx < steps.length - 1) {
                      setSimpleStep(steps[idx + 1]);
                    }
                  }}
                  disabled={(() => {
                    switch (simpleStep) {
                      case 'channel': return !selectedChannel;
                      case 'product': return !selectedProductType;
                      case 'product-congrats': return false;
                      case 'color': return !selectedColor;
                      case 'size': return !selectedShirtSize;
                      case 'type': return !qrType;
                      default: return true;
                    }
                  })()}
                  className="w-full bg-emerald-600 hover:bg-emerald-500 text-white py-6 text-lg font-semibold"
                  data-testid="super-simple-next"
                >
                  {simpleStep === 'type' ? (
                    <>Continue to Details <ArrowRight className="w-5 h-5 ml-2" /></>
                  ) : simpleStep === 'product-congrats' ? (
                    <>Nice! Pick a Color <ArrowRight className="w-5 h-5 ml-2" /></>
                  ) : (
                    <>Next <ArrowRight className="w-5 h-5 ml-2" /></>
                  )}
                </Button>
              </div>
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
