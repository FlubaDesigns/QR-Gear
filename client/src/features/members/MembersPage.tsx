import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Users, 
  User,
  Package,
  QrCode,
  Loader2,
  ChevronRight,
  Layers,
  DollarSign,
  Share2,
  Plus,
  ExternalLink,
  Wand2,
  Zap,
  Sparkles,
  ArrowRight,
  BarChart3
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import SEO from "@/components/SEO";
import { MemberAuthProvider } from "@/features/members/MemberAuthContext";
import { MembersProvider } from "@/features/members/MembersContext";
import {
  type ViewMode, type WizardTier, type MemberChannel,
  getAuthHeaders,
} from "@/features/shared/components/wizardSteps";
import { WizardProvider, useWizardContext } from "./WizardContext";
import { SuperSimpleWizard } from "./SuperSimpleWizard";
import { SimpleWizard } from "./SimpleWizard";
import { AdvancedWizard } from "./AdvancedWizard";
import { StudioMode } from "./StudioMode";
import { MemberOnboarding } from "./MemberOnboarding";

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

interface MemberIndexViewProps {
  memberId: string;
  onNavigate: (view: ViewMode) => void;
  onStartWizard: (tier: WizardTier) => void;
  publishCount: number;
}

function MemberIndexView({ memberId, onNavigate, onStartWizard, publishCount }: MemberIndexViewProps) {
  const [hasSeenIntro, setHasSeenIntro] = useState(true);

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
                  <p className="text-sm text-slate-300">You keep a share of every sale. We track your earnings and handle payments automatically.</p>
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
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
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
            <button
              onClick={() => onStartWizard('studio')}
              className="p-5 bg-gradient-to-br from-amber-900/40 to-orange-900/40 rounded-lg border border-amber-500/30 hover:border-amber-400/60 transition-all text-left group"
              data-testid="launch-studio"
            >
              <div className="w-12 h-12 mb-3 bg-amber-500/20 rounded-full flex items-center justify-center">
                <Zap className="w-6 h-6 text-amber-400" />
              </div>
              <h3 className="font-bold text-white text-lg mb-1">Studio</h3>
              <p className="text-sm text-slate-400">Quick publish for experienced creators. Minimal steps, maximum speed.</p>
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
    <WizardProvider>
      <MembersSandboxInner />
    </WizardProvider>
  );
}

function MembersSandboxInner() {
  const {
    user,
    viewMode, setViewMode,
    wizardTier, setWizardTier,
    publishCount,
    showUnlockPrompt, setShowUnlockPrompt,
  } = useWizardContext();

  const userId = user?.id || user?.uid || '';
  const onboardingKey = `member_onboarding_complete_${userId}`;
  const [onboardingComplete, setOnboardingComplete] = useState(() => {
    if (!userId) return false;
    return localStorage.getItem(onboardingKey) === 'true';
  });

  const handleOnboardingComplete = (data: any) => {
    localStorage.setItem(onboardingKey, 'true');
    localStorage.setItem(`member_onboarding_data_${userId}`, JSON.stringify({
      ...data,
      onboarding_completed_at: new Date().toISOString(),
      onboarding_version: 'v1',
    }));
    setOnboardingComplete(true);
    setWizardTier('super-simple');
    setViewMode('wizard');
  };

  if (!onboardingComplete && userId) {
    return (
      <div className="min-h-screen py-8" style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e3a5f 50%, #0f172a 100%)' }}>
        <MemberOnboarding onComplete={handleOnboardingComplete} userId={userId} />
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

        {viewMode === 'wizard' && wizardTier === 'simple' && (
          <SimpleWizard />
        )}

        {viewMode === 'wizard' && wizardTier === 'advanced' && (
          <AdvancedWizard />
        )}

        {viewMode === 'wizard' && wizardTier === 'studio' && (
          <StudioMode />
        )}

        {viewMode === 'wizard' && wizardTier === 'super-simple' && (
          <SuperSimpleWizard />
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
