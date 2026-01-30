import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
  ExternalLink
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import SEO from "@/components/SEO";

interface ProductCategory {
  name: string;
  items: ProductItem[];
  count: number;
}

interface ProductItem {
  id: number;
  productId: number;
  name: string;
  type: string;
  description: string | null;
  thumbnailUrl: string | null;
  placements: { id: string; title: string }[] | null;
}

interface GraphicSet {
  id: string;
  name: string;
  thumbnailUrl: string;
  imageCount: number;
}

type WizardStep = 'product' | 'graphics' | 'qr-setup' | 'preview' | 'publish';

const WIZARD_STEPS: { id: WizardStep; label: string; icon: any }[] = [
  { id: 'product', label: 'Product', icon: Package },
  { id: 'graphics', label: 'Graphics', icon: Image },
  { id: 'qr-setup', label: 'QR Setup', icon: QrCode },
  { id: 'preview', label: 'Preview', icon: Eye },
  { id: 'publish', label: 'Publish', icon: Send },
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

function ProductPickerStep({ 
  selectedProduct, 
  onSelect 
}: { 
  selectedProduct: ProductItem | null;
  onSelect: (product: ProductItem) => void;
}) {
  const { data: categories, isLoading } = useQuery<ProductCategory[]>({
    queryKey: ["/api/test/catalog/printful-products"],
  });

  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);

  if (isLoading) {
    return (
      <div className="flex justify-center items-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-blue-400" />
      </div>
    );
  }

  const allCategories = categories || [];

  return (
    <div className="space-y-4">
      <div className="text-center mb-6">
        <h2 className="text-xl font-bold text-white mb-2">Choose Your Product</h2>
        <p className="text-slate-400">Select a product template to start building</p>
      </div>

      {allCategories.length === 0 ? (
        <div className="text-center py-8 text-slate-400">
          No products available. Contact admin to sync catalog.
        </div>
      ) : (
        <div className="space-y-3">
          {allCategories.map((category) => (
            <div key={category.name} className="bg-slate-800/50 rounded-lg overflow-hidden">
              <button
                onClick={() => setExpandedCategory(
                  expandedCategory === category.name ? null : category.name
                )}
                className="w-full p-4 flex items-center justify-between hover:bg-slate-700/50 transition-colors"
                data-testid={`category-${category.name}`}
              >
                <div className="flex items-center gap-3">
                  <Package className="w-5 h-5 text-blue-400" />
                  <span className="text-white font-medium">{category.name}</span>
                  <Badge variant="secondary">{category.count}</Badge>
                </div>
                <ChevronRight className={`w-5 h-5 text-slate-400 transition-transform ${
                  expandedCategory === category.name ? 'rotate-90' : ''
                }`} />
              </button>
              
              {expandedCategory === category.name && (
                <div className="p-4 pt-0 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                  {category.items.map((product) => (
                    <button
                      key={product.id}
                      onClick={() => onSelect(product)}
                      className={`relative rounded-lg overflow-hidden border-2 transition-all ${
                        selectedProduct?.id === product.id
                          ? 'border-blue-500 ring-2 ring-blue-500/30'
                          : 'border-slate-600 hover:border-slate-500'
                      }`}
                      data-testid={`product-${product.id}`}
                    >
                      <div className="aspect-square bg-slate-700">
                        {product.thumbnailUrl ? (
                          <img 
                            src={product.thumbnailUrl} 
                            alt={product.name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <Package className="w-8 h-8 text-slate-500" />
                          </div>
                        )}
                      </div>
                      <div className="p-2 bg-slate-800">
                        <p className="text-xs text-white truncate">{product.name}</p>
                      </div>
                      {selectedProduct?.id === product.id && (
                        <div className="absolute top-2 right-2 w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center">
                          <Check className="w-4 h-4 text-white" />
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function GraphicsStep({ 
  selectedGraphic, 
  onSelect 
}: { 
  selectedGraphic: GraphicSet | null;
  onSelect: (graphic: GraphicSet) => void;
}) {
  const { user } = useAuth();
  
  // Fetch member's graphics from API
  const { data: graphicSets, isLoading } = useQuery<GraphicSet[]>({
    queryKey: ['/api/members', user?.uid, 'graphics'],
    queryFn: async () => {
      if (!user?.uid) return [];
      const res = await fetch(`/api/members/${user.uid}/graphics`);
      if (!res.ok) throw new Error('Failed to fetch graphics');
      return res.json();
    },
    enabled: !!user?.uid
  });

  const graphics = graphicSets || [];

  return (
    <div className="space-y-4">
      <div className="text-center mb-6">
        <h2 className="text-xl font-bold text-white mb-2">Select Graphics</h2>
        <p className="text-slate-400">Choose a graphic set from your library</p>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full" />
        </div>
      ) : graphics.length === 0 ? (
        <div className="text-center py-12 bg-slate-800/50 rounded-xl border border-slate-700">
          <Image className="w-16 h-16 text-slate-600 mx-auto mb-4" />
          <p className="text-slate-400 mb-4">No graphics uploaded yet</p>
          <button
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-500 transition-colors"
            data-testid="button-upload-first-graphic"
          >
            <Upload className="w-4 h-4 inline mr-2" />
            Upload Your First Graphic
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          {graphics.map((graphic) => (
            <button
              key={graphic.id}
              onClick={() => onSelect(graphic)}
              className={`p-4 rounded-lg border-2 transition-all ${
                selectedGraphic?.id === graphic.id
                  ? 'border-blue-500 bg-blue-600/20'
                  : 'border-slate-600 bg-slate-800/50 hover:border-slate-500'
              }`}
              data-testid={`graphic-${graphic.id}`}
            >
              {graphic.thumbnailUrl ? (
                <img 
                  src={graphic.thumbnailUrl} 
                  alt={graphic.name}
                  className="aspect-square object-cover rounded-lg mb-3"
                />
              ) : (
                <div className="aspect-square bg-slate-700 rounded-lg mb-3 flex items-center justify-center">
                  <Image className="w-12 h-12 text-slate-500" />
                </div>
              )}
              <p className="text-sm font-medium text-white truncate">{graphic.name}</p>
              <p className="text-xs text-slate-400">{graphic.imageCount} images</p>
            </button>
          ))}
        
          <button
            className="p-4 rounded-lg border-2 border-dashed border-slate-600 bg-slate-800/30 hover:border-blue-500 hover:bg-blue-600/10 transition-all"
            data-testid="button-upload-graphics"
          >
            <div className="aspect-square rounded-lg mb-3 flex items-center justify-center">
              <div className="text-center">
                <Upload className="w-12 h-12 text-slate-500 mx-auto mb-2" />
                <span className="text-xs text-slate-400">Upload New</span>
              </div>
            </div>
          </button>
        </div>
      )}
    </div>
  );
}

function QRSetupStep({ 
  qrType, 
  qrDestination,
  onTypeChange,
  onDestinationChange
}: { 
  qrType: string;
  qrDestination: string;
  onTypeChange: (type: string) => void;
  onDestinationChange: (dest: string) => void;
}) {
  const qrTypes = [
    { id: 'qr-basic', label: 'QR Basic', description: 'Simple URL link' },
    { id: 'qr-plus', label: 'QR Plus', description: 'Analytics & tracking' },
    { id: 'qr-canvas', label: 'QR Canvas', description: 'Image landing page' },
    { id: 'qr-play', label: 'QR Play', description: 'Video landing page' },
  ];

  return (
    <div className="space-y-6">
      <div className="text-center mb-6">
        <h2 className="text-xl font-bold text-white mb-2">QR Code Setup</h2>
        <p className="text-slate-400">Configure what your QR code does</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {qrTypes.map((type) => (
          <button
            key={type.id}
            onClick={() => onTypeChange(type.id)}
            className={`p-4 rounded-lg border-2 text-left transition-all ${
              qrType === type.id
                ? 'border-blue-500 bg-blue-600/20'
                : 'border-slate-600 bg-slate-800/50 hover:border-slate-500'
            }`}
            data-testid={`qr-type-${type.id}`}
          >
            <div className="flex items-center gap-2 mb-1">
              <QrCode className="w-4 h-4 text-blue-400" />
              <span className="text-sm font-medium text-white">{type.label}</span>
            </div>
            <p className="text-xs text-slate-400">{type.description}</p>
          </button>
        ))}
      </div>

      {(qrType === 'qr-basic' || qrType === 'qr-plus') && (
        <div className="space-y-2">
          <label className="text-sm text-slate-300">Destination URL</label>
          <input
            type="url"
            value={qrDestination}
            onChange={(e) => onDestinationChange(e.target.value)}
            placeholder="https://example.com"
            className="w-full p-3 bg-slate-800 border border-slate-600 rounded-lg text-white placeholder:text-slate-500 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
            data-testid="input-qr-destination"
          />
        </div>
      )}
    </div>
  );
}

function PreviewStep({ 
  product, 
  graphic, 
  qrType 
}: { 
  product: ProductItem | null;
  graphic: GraphicSet | null;
  qrType: string;
}) {
  return (
    <div className="space-y-6">
      <div className="text-center mb-6">
        <h2 className="text-xl font-bold text-white mb-2">Preview Your Item</h2>
        <p className="text-slate-400">Review before publishing</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="aspect-square bg-slate-800 rounded-lg flex items-center justify-center">
          {product?.thumbnailUrl ? (
            <img 
              src={product.thumbnailUrl} 
              alt={product.name}
              className="w-full h-full object-contain"
            />
          ) : (
            <Package className="w-24 h-24 text-slate-600" />
          )}
        </div>

        <div className="space-y-4">
          <Card className="bg-slate-800/50 border-slate-700">
            <CardContent className="p-4 space-y-3">
              <div>
                <p className="text-xs text-slate-400">Product</p>
                <p className="text-white font-medium">{product?.name || 'Not selected'}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Graphic Set</p>
                <p className="text-white font-medium">{graphic?.name || 'Not selected'}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400">QR Type</p>
                <Badge>{qrType || 'Not selected'}</Badge>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function PublishStep({ 
  isPublishing,
  onPublish,
  channelName,
  onChannelNameChange
}: { 
  isPublishing: boolean;
  onPublish: () => void;
  channelName: string;
  onChannelNameChange: (name: string) => void;
}) {
  return (
    <div className="space-y-6">
      <div className="text-center mb-6">
        <h2 className="text-xl font-bold text-white mb-2">Publish to Channel</h2>
        <p className="text-slate-400">Save your item and get your share link</p>
      </div>

      <div className="max-w-md mx-auto space-y-4">
        <div className="space-y-2">
          <label className="text-sm text-slate-300">Channel Name</label>
          <input
            type="text"
            value={channelName}
            onChange={(e) => onChannelNameChange(e.target.value)}
            placeholder="My Products"
            className="w-full p-3 bg-slate-800 border border-slate-600 rounded-lg text-white placeholder:text-slate-500 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
            data-testid="input-channel-name"
          />
        </div>

        <Button
          onClick={onPublish}
          disabled={isPublishing}
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

interface MemberChannel {
  id: string;
  name: string;
  storeId: string;
  type: string;
  productCount?: number;
  createdAt: string;
}

interface MemberProduct {
  id: string;
  name: string;
  thumbnailUrl?: string;
  price: number;
  status: string;
  channelId?: string;
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
      const res = await fetch(`/api/members/${memberId}/channels`);
      if (!res.ok) throw new Error('Failed to fetch channels');
      return res.json();
    },
    enabled: !!memberId
  });

  const { data: products } = useQuery<MemberProduct[]>({
    queryKey: ['/api/members', memberId, 'products'],
    queryFn: async () => {
      if (!memberId) return [];
      const res = await fetch(`/api/members/${memberId}/products`);
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
                        {channelProducts.length} items · Created {new Date(channel.createdAt).toLocaleDateString()}
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
      const res = await fetch(`/api/members/${memberId}/earnings`);
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
  const [currentStep, setCurrentStep] = useState<WizardStep>('product');
  const [completedSteps, setCompletedSteps] = useState<Set<WizardStep>>(new Set());
  
  const [selectedProduct, setSelectedProduct] = useState<ProductItem | null>(null);
  const [selectedGraphic, setSelectedGraphic] = useState<GraphicSet | null>(null);
  const [qrType, setQrType] = useState<string>('qr-basic');
  const [qrDestination, setQrDestination] = useState<string>('');
  const [channelName, setChannelName] = useState<string>('My Products');
  const [isPublishing, setIsPublishing] = useState(false);

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
    if (!user?.uid || !selectedProduct) return;
    
    setIsPublishing(true);
    try {
      // First, ensure channel exists or create it
      let channelId = '';
      const channelRes = await fetch(`/api/members/${user.uid}/channels`);
      const channels = await channelRes.json();
      const existingChannel = channels.find((c: any) => c.name === channelName);
      
      if (existingChannel) {
        channelId = existingChannel.id;
      } else {
        // Create new channel
        const createRes = await fetch(`/api/members/${user.uid}/channels`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: channelName })
        });
        const newChannel = await createRes.json();
        channelId = newChannel.id;
      }
      
      // Create the member product
      const productRes = await fetch(`/api/members/${user.uid}/products`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          printfulProductId: selectedProduct.productId,
          variantId: selectedProduct.id,
          graphicUrl: selectedGraphic?.thumbnailUrl || null,
          qrType,
          qrDestination,
          channelId,
          name: selectedProduct.name,
          price: 0 // Will be calculated later
        })
      });
      
      if (!productRes.ok) throw new Error('Failed to create product');
      
      setCompletedSteps(prev => new Set<WizardStep>([...Array.from(prev), 'publish']));
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
      case 'product': return selectedProduct !== null;
      case 'graphics': return selectedGraphic !== null;
      case 'qr-setup': return qrType !== '';
      case 'preview': return true;
      case 'publish': return channelName.trim() !== '';
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
            
            <div className="flex gap-2">
              <Button
                variant={viewMode === 'wizard' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setViewMode('wizard')}
                data-testid="tab-wizard"
              >
                <Package className="w-4 h-4 mr-1" />
                Builder
              </Button>
              <Button
                variant={viewMode === 'channels' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setViewMode('channels')}
                data-testid="tab-channels"
              >
                <Layers className="w-4 h-4 mr-1" />
                Channels
              </Button>
              <Button
                variant={viewMode === 'collections' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setViewMode('collections')}
                data-testid="tab-collections"
              >
                <QrCode className="w-4 h-4 mr-1" />
                Dynamics
              </Button>
              <Button
                variant={viewMode === 'earnings' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setViewMode('earnings')}
                data-testid="tab-earnings"
              >
                <DollarSign className="w-4 h-4 mr-1" />
                Earnings
              </Button>
            </div>
          </div>
        </div>

        {viewMode === 'wizard' && (
          <Card className="bg-slate-800/50 border-slate-700">
            <CardContent className="p-6">
              <WizardProgressBar 
                currentStep={currentStep}
                onStepClick={handleStepClick}
                completedSteps={completedSteps}
              />

              <div className="min-h-[400px]">
                {currentStep === 'product' && (
                  <ProductPickerStep 
                    selectedProduct={selectedProduct}
                    onSelect={setSelectedProduct}
                  />
                )}
                {currentStep === 'graphics' && (
                  <GraphicsStep 
                    selectedGraphic={selectedGraphic}
                    onSelect={setSelectedGraphic}
                  />
                )}
                {currentStep === 'qr-setup' && (
                  <QRSetupStep 
                    qrType={qrType}
                    qrDestination={qrDestination}
                    onTypeChange={setQrType}
                    onDestinationChange={setQrDestination}
                  />
                )}
                {currentStep === 'preview' && (
                  <PreviewStep 
                    product={selectedProduct}
                    graphic={selectedGraphic}
                    qrType={qrType}
                  />
                )}
                {currentStep === 'publish' && (
                  <PublishStep 
                    isPublishing={isPublishing}
                    onPublish={handlePublish}
                    channelName={channelName}
                    onChannelNameChange={setChannelName}
                  />
                )}
              </div>

              <div className="flex justify-between mt-8 pt-6 border-t border-slate-700">
                <Button
                  variant="outline"
                  onClick={handleBack}
                  disabled={currentStep === 'product'}
                  data-testid="button-back"
                >
                  <ChevronLeft className="w-4 h-4 mr-1" />
                  Back
                </Button>
                
                {currentStep !== 'publish' && (
                  <Button
                    onClick={handleNext}
                    disabled={!canProceed()}
                    className="bg-blue-600 hover:bg-blue-700"
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

        {viewMode === 'channels' && (
          <ChannelsView memberId={user?.uid || ''} />
        )}

        {viewMode === 'collections' && (
          <CollectionsView memberId={user?.uid || ''} />
        )}

        {viewMode === 'earnings' && (
          <EarningsView memberId={user?.uid || ''} />
        )}

        <div className="mt-6 text-center text-white/50 text-sm">
          Logged in as: {user?.email || "Unknown"}
        </div>
      </div>
    </div>
  );
}
