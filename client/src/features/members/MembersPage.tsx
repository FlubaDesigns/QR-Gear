import { useState, useEffect, useRef, Component, lazy, Suspense, type ErrorInfo, type ReactNode } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { 
  Users, 
  User,
  Package,
  QrCode,
  Loader2,
  ChevronRight,
  ChevronLeft,
  Layers,
  DollarSign,
  Share2,
  Plus,
  ExternalLink,
  Wand2,
  Zap,
  Sparkles,
  ArrowRight,
  BarChart3,
  Trash2,
  CalendarPlus,
  AlertTriangle
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

const SuperSimpleWizard = lazy(() => import("./SuperSimpleWizard").then(m => ({ default: m.SuperSimpleWizard })));
const SimpleWizard = lazy(() => import("./SimpleWizard").then(m => ({ default: m.SimpleWizard })));
const AdvancedWizard = lazy(() => import("./AdvancedWizard").then(m => ({ default: m.AdvancedWizard })));
const StudioMode = lazy(() => import("./StudioMode").then(m => ({ default: m.StudioMode })));
const SocialHubView = lazy(() => import("./SocialHubView").then(m => ({ default: m.SocialHubView })));

function LazyFallback() {
  return (
    <div className="flex items-center justify-center py-12">
      <Loader2 className="h-8 w-8 animate-spin text-blue-400" />
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

interface EarningsSummary {
  total: number;
  pending: number;
  paid: number;
  profitShare: number;
}

interface MemberIndexViewProps {
  memberId: string;
  onNavigate: (view: ViewMode, channelId?: string) => void;
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
                <button
                  key={channel.id}
                  onClick={() => onNavigate('channels', channel.id)}
                  className="p-3 bg-slate-700/50 rounded-lg border border-slate-600 hover:border-blue-500 transition-colors cursor-pointer flex items-center justify-between text-left w-full"
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
                </button>
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

function ChannelsView({ memberId, initialChannelId }: { memberId: string; initialChannelId?: string | null }) {
  const { toast } = useToast();
  const [selectedChannelId, setSelectedChannelId] = useState<string | null>(initialChannelId || null);
  const [confirmDeleteChannel, setConfirmDeleteChannel] = useState<string | null>(null);
  const [confirmDeleteProduct, setConfirmDeleteProduct] = useState<string | null>(null);
  const [newChannelName, setNewChannelName] = useState('');
  const [showNewChannel, setShowNewChannel] = useState(false);

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

  const { data: packets } = useQuery<{ packets: any[] }>({
    queryKey: ['/api/member/packets'],
    queryFn: async () => {
      const headers = await getAuthHeaders();
      const res = await fetch(`/api/member/packets?memberId=${memberId}`, { headers });
      if (!res.ok) return { packets: [] };
      return res.json();
    },
    enabled: !!memberId
  });

  const createChannelMutation = useMutation({
    mutationFn: async (name: string) => {
      const headers = await getAuthHeaders();
      const res = await fetch(`/api/members/${memberId}/channels`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify({ name }),
      });
      if (!res.ok) throw new Error('Failed to create channel');
      return res.json();
    },
    onSuccess: () => {
      toast({ title: 'Channel created' });
      setNewChannelName('');
      setShowNewChannel(false);
      queryClient.invalidateQueries({ queryKey: ['/api/members', memberId, 'channels'] });
    },
    onError: (err: Error) => toast({ title: 'Error', description: err.message, variant: 'destructive' }),
  });

  const deleteChannelMutation = useMutation({
    mutationFn: async (channelId: string) => {
      const headers = await getAuthHeaders();
      const res = await fetch(`/api/members/${memberId}/channels/${channelId}`, {
        method: 'DELETE', headers: { 'Content-Type': 'application/json', ...headers },
      });
      if (!res.ok) throw new Error('Failed to delete channel');
      return res.json();
    },
    onSuccess: (data) => {
      toast({ title: 'Channel deleted', description: `${(data.unlinkedProducts || 0) + (data.unlinkedPackets || 0)} items moved back to your library.` });
      setSelectedChannelId(null);
      setConfirmDeleteChannel(null);
      queryClient.invalidateQueries({ queryKey: ['/api/members', memberId, 'channels'] });
      queryClient.invalidateQueries({ queryKey: ['/api/members', memberId, 'products'] });
      queryClient.invalidateQueries({ queryKey: ['/api/member/packets'] });
    },
    onError: (err: Error) => toast({ title: 'Error', description: err.message, variant: 'destructive' }),
  });

  const removeFromChannelMutation = useMutation({
    mutationFn: async ({ channelId, itemId, itemType }: { channelId: string; itemId: string; itemType: string }) => {
      const headers = await getAuthHeaders();
      const res = await fetch(`/api/members/${memberId}/channels/${channelId}/remove-item`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify({ itemId, itemType }),
      });
      if (!res.ok) throw new Error('Failed to remove item from channel');
      return res.json();
    },
    onSuccess: () => {
      toast({ title: 'Removed from channel', description: 'Item is still in your library.' });
      setConfirmDeleteProduct(null);
      queryClient.invalidateQueries({ queryKey: ['/api/members', memberId, 'products'] });
      queryClient.invalidateQueries({ queryKey: ['/api/member/packets'] });
    },
    onError: (err: Error) => toast({ title: 'Error', description: err.message, variant: 'destructive' }),
  });

  const deleteProductMutation = useMutation({
    mutationFn: async (productId: string) => {
      const headers = await getAuthHeaders();
      const res = await fetch(`/api/members/${memberId}/products/${productId}`, {
        method: 'DELETE', headers: { 'Content-Type': 'application/json', ...headers },
      });
      if (!res.ok) throw new Error('Failed to delete product');
      return res.json();
    },
    onSuccess: () => {
      toast({ title: 'Product deleted' });
      setConfirmDeleteProduct(null);
      queryClient.invalidateQueries({ queryKey: ['/api/members', memberId, 'products'] });
      queryClient.invalidateQueries({ queryKey: ['/api/member/packets'] });
    },
    onError: (err: Error) => toast({ title: 'Error', description: err.message, variant: 'destructive' }),
  });

  const channelList = channels || [];
  const productList = products || [];
  const packetList = packets?.packets || [];
  const selectedChannel = selectedChannelId ? channelList.find(c => c.id === selectedChannelId) : null;

  const getProductPacket = (product: MemberProduct) => {
    const pid = (product as any).packetId;
    if (pid) return packetList.find((p: any) => p.id === pid);
    return null;
  };

  const deletePacketMutation = useMutation({
    mutationFn: async (packetId: string) => {
      const headers = await getAuthHeaders();
      const res = await fetch(`/api/member/packets/${packetId}`, {
        method: 'DELETE', headers: { 'Content-Type': 'application/json', ...headers },
      });
      if (!res.ok) throw new Error('Failed to delete packet');
      return res.json();
    },
    onSuccess: () => {
      toast({ title: 'Item deleted' });
      setConfirmDeleteProduct(null);
      queryClient.invalidateQueries({ queryKey: ['/api/member/packets'] });
      queryClient.invalidateQueries({ queryKey: ['/api/members', memberId, 'products'] });
    },
    onError: (err: Error) => toast({ title: 'Error', description: err.message, variant: 'destructive' }),
  });

  if (selectedChannel) {
    const channelProducts = productList.filter(p => p.channelId === selectedChannelId);
    const channelPackets = packetList.filter((p: any) => p.channelId === selectedChannelId);
    const productPacketIds = new Set(channelProducts.map((p: any) => p.packetId).filter(Boolean));
    const normalizedProducts = channelProducts.map((p: any) => ({
      id: p.id,
      name: p.name || 'Untitled',
      thumbnailUrl: p.thumbnailUrl || null,
      price: p.price || 0,
      status: p.status || 'draft',
      channelId: p.channelId,
      packetId: p.packetId || null,
      memberEarnings: (p as any).memberEarnings || 0,
      _type: 'product' as const,
    }));
    const normalizedPackets = channelPackets
      .filter((p: any) => !productPacketIds.has(p.id))
      .map((p: any) => ({
        id: p.id,
        name: p.title || p.simpleTitle || 'Untitled',
        thumbnailUrl: p.itemImage || p.socialPacket?.itemImage || p.qrBasicMockup || p.qrPlusMockup || p.qrCanvasMockup || null,
        price: p.pricingSnapshot?.retailPrice || p.retailPrice || 0,
        status: p.status || 'draft',
        channelId: p.channelId,
        packetId: p.id,
        memberEarnings: p.pricingSnapshot?.memberEarnings || p.memberEarnings || 0,
        _type: 'packet' as const,
      }));
    const allItems = [...normalizedProducts, ...normalizedPackets];

    return (
      <div className="space-y-4">
        <Card className="bg-slate-800/50 border-slate-700">
          <CardHeader className="flex flex-row items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Button size="icon" variant="ghost" onClick={() => setSelectedChannelId(null)} data-testid="button-back-channels">
                <ChevronLeft className="w-5 h-5 text-white" />
              </Button>
              <CardTitle className="text-white flex items-center gap-2">
                <Layers className="w-5 h-5" />
                {selectedChannel.name}
              </CardTitle>
              <Badge className="bg-blue-500/20 text-blue-300 border-blue-500/30">
                {allItems.length} {allItems.length === 1 ? 'item' : 'items'}
              </Badge>
            </div>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  const url = `${window.location.origin}/channel/${selectedChannelId}`;
                  navigator.clipboard?.writeText(url);
                  toast({ title: 'Link copied' });
                }}
                className="border-slate-600 text-white"
                data-testid={`share-channel-${selectedChannelId}`}
              >
                <Share2 className="w-4 h-4" />
              </Button>
              {confirmDeleteChannel === selectedChannelId ? (
                <div className="flex items-center gap-1">
                  <Button size="sm" variant="destructive" onClick={() => deleteChannelMutation.mutate(selectedChannelId!)} disabled={deleteChannelMutation.isPending} data-testid="button-confirm-delete-channel">
                    {deleteChannelMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Yes, Delete Channel'}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setConfirmDeleteChannel(null)} className="text-white" data-testid="button-cancel-delete-channel">Cancel</Button>
                </div>
              ) : (
                <Button size="sm" variant="outline" onClick={() => setConfirmDeleteChannel(selectedChannelId)} className="border-red-500/50 text-red-400" data-testid={`delete-channel-${selectedChannelId}`}>
                  <Trash2 className="w-4 h-4 mr-1" />
                  Delete Channel
                </Button>
              )}
            </div>
          </CardHeader>
          {confirmDeleteChannel === selectedChannelId && (
            <div className="mx-6 mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg flex items-start gap-2">
              <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-300">This will delete the channel. Your {allItems.length} items will stay in your library.</p>
            </div>
          )}
          <CardContent>
            {allItems.length === 0 ? (
              <div className="text-center py-8 text-slate-400">
                <Package className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>No items in this channel yet</p>
              </div>
            ) : (
              <div className="space-y-3">
                {allItems.map((item: any) => {
                  const packet = getProductPacket(item) || (item.packetId ? packetList.find((p: any) => p.id === item.packetId) : null);
                  const retailPrice = packet?.pricingSnapshot?.retailPrice || item.price || 0;
                  const earnings = packet?.pricingSnapshot?.memberEarnings || item.memberEarnings || 0;
                  const imageUrl = item.thumbnailUrl || packet?.itemImage || packet?.socialPacket?.itemImage || null;
                  const title = item.name || packet?.title || 'Untitled';
                  const status = item.status || packet?.status || 'draft';

                  return (
                    <div key={item.id} className="p-4 bg-slate-700/50 rounded-lg border border-slate-600" data-testid={`product-${item.id}`}>
                      <div className="flex items-center gap-4">
                        {imageUrl ? (
                          <img src={imageUrl} alt={title} className="w-16 h-16 rounded-lg object-cover bg-white flex-shrink-0" />
                        ) : (
                          <div className="w-16 h-16 rounded-lg bg-slate-600 flex items-center justify-center flex-shrink-0">
                            <Package className="w-8 h-8 text-slate-400" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <h4 className="text-white font-medium truncate">{title}</h4>
                          <div className="flex items-center gap-3 mt-1 flex-wrap">
                            <span className="text-sm text-slate-300">
                              <DollarSign className="w-3 h-3 inline" />{retailPrice > 0 ? `${retailPrice.toFixed(2)} retail` : 'No price set'}
                            </span>
                            <span className="text-sm text-green-400">
                              <DollarSign className="w-3 h-3 inline" />{earnings > 0 ? `${earnings.toFixed(2)} you earn` : '—'}
                            </span>
                          </div>
                          <Badge className={`mt-1 text-xs ${status === 'published' ? 'bg-green-500/20 text-green-300 border-green-500/30' : 'bg-slate-500/20 text-slate-300 border-slate-500/30'}`}>
                            {status}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          {status === 'published' && item.packetId && (
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => {
                                const pkt = packetList.find((p: any) => p.id === item.packetId);
                                const shareUrl = pkt?.socialPacket?.shareUrl || `/p/${item.packetId}`;
                                const fullUrl = shareUrl.startsWith('http') ? shareUrl : `${window.location.origin}${shareUrl}`;
                                const refUrl = `${fullUrl}${fullUrl.includes('?') ? '&' : '?'}ref=${memberId}`;
                                if (navigator.share) {
                                  navigator.share({ title: title, text: pkt?.socialPacket?.shareCaption || `Check out ${title}!`, url: refUrl }).catch(() => {});
                                } else {
                                  navigator.clipboard?.writeText(refUrl);
                                  toast({ title: 'Share link copied!' });
                                }
                              }}
                              className="text-blue-400"
                              data-testid={`share-product-${item.id}`}
                            >
                              <Share2 className="w-4 h-4" />
                            </Button>
                          )}
                          {confirmDeleteProduct === item.id ? (
                            <div className="flex items-center gap-1">
                              <Button size="sm" variant="destructive" onClick={() => {
                                removeFromChannelMutation.mutate({
                                  channelId: selectedChannelId!,
                                  itemId: item.id,
                                  itemType: item._type || 'product',
                                });
                              }} disabled={removeFromChannelMutation.isPending} data-testid={`confirm-delete-product-${item.id}`}>
                                {removeFromChannelMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Remove'}
                              </Button>
                              <Button size="sm" variant="ghost" onClick={() => setConfirmDeleteProduct(null)} className="text-white" data-testid={`cancel-delete-product-${item.id}`}>No</Button>
                            </div>
                          ) : (
                            <Button size="icon" variant="ghost" onClick={() => setConfirmDeleteProduct(item.id)} className="text-orange-400" data-testid={`delete-product-${item.id}`}>
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <Card className="bg-slate-800/50 border-slate-700">
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <CardTitle className="text-white flex items-center gap-2">
          <Layers className="w-5 h-5" />
          My Channels
        </CardTitle>
        <Button size="sm" className="bg-blue-600" onClick={() => setShowNewChannel(true)} data-testid="button-create-channel">
          <Plus className="w-4 h-4 mr-1" />
          New Channel
        </Button>
      </CardHeader>
      <CardContent>
        {showNewChannel && (
          <div className="mb-4 p-3 bg-slate-700/50 rounded-lg border border-blue-500/30 flex items-center gap-2">
            <input
              type="text"
              value={newChannelName}
              onChange={(e) => setNewChannelName(e.target.value)}
              placeholder="Channel name..."
              className="flex-1 bg-transparent border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
              data-testid="input-new-channel-name"
              onKeyDown={(e) => { if (e.key === 'Enter' && newChannelName.trim()) createChannelMutation.mutate(newChannelName.trim()); }}
            />
            <Button size="sm" onClick={() => createChannelMutation.mutate(newChannelName.trim())} disabled={!newChannelName.trim() || createChannelMutation.isPending} data-testid="button-save-new-channel">
              {createChannelMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Create'}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => { setShowNewChannel(false); setNewChannelName(''); }} className="text-white" data-testid="button-cancel-new-channel">Cancel</Button>
          </div>
        )}
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
          <div className="space-y-3">
            {channelList.map((channel) => {
              const channelProductCount = productList.filter(p => p.channelId === channel.id).length;
              const channelPacketCount = packetList.filter((p: any) => p.channelId === channel.id).length;
              const totalItems = Math.max(channelProductCount, channelPacketCount);
              return (
                <button 
                  key={channel.id}
                  onClick={() => setSelectedChannelId(channel.id)}
                  className="w-full p-4 bg-slate-700/50 rounded-lg border border-slate-600 hover:border-blue-500 transition-colors cursor-pointer text-left"
                  data-testid={`channel-${channel.id}`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-blue-500/20 rounded-lg flex items-center justify-center flex-shrink-0">
                        <Layers className="w-5 h-5 text-blue-400" />
                      </div>
                      <div>
                        <h3 className="text-white font-medium">{channel.name}</h3>
                        <p className="text-sm text-slate-400">
                          {totalItems} {totalItems === 1 ? 'item' : 'items'} {channel.createdAt && `· Created ${new Date(channel.createdAt).toLocaleDateString()}`}
                        </p>
                      </div>
                    </div>
                    <ChevronRight className="w-5 h-5 text-slate-500" />
                  </div>
                </button>
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
    queryKey: ['/api/members', memberId, 'compose-packets'],
    queryFn: async () => {
      if (!memberId) return [];
      const headers = await getAuthHeaders();
      const res = await fetch(`/api/members/${memberId}/packets?status=published&kind=qr-compose`, { headers });
      if (!res.ok) return [];
      const data = await res.json();
      return data.packets || data || [];
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
  const { user: apiUser, firebaseUser, isLoading: authLoading, isAuthenticated } = useAuth();
  const user = apiUser || (firebaseUser ? { id: firebaseUser.uid, email: firebaseUser.email, displayName: firebaseUser.displayName } as any : null);

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
    setSelectedColor, setQrType, setSelectedPlacements, setGraphicSize,
  } = useWizardContext();

  const userId = user?.id || '';
  const [, setLocation] = useLocation();
  const [initialChannelId, setInitialChannelId] = useState<string | null>(null);
  const onboardingKey = `member_onboarding_complete_${userId}`;
  const localComplete = userId ? localStorage.getItem(onboardingKey) === 'true' : false;
  const [serverChecked, setServerChecked] = useState(false);
  const [serverComplete, setServerComplete] = useState(false);

  useEffect(() => {
    if (!userId || localComplete) { setServerChecked(true); return; }
    let cancelled = false;
    (async () => {
      try {
        const { auth } = await import("@/lib/firebase");
        const token = await auth.currentUser?.getIdToken();
        if (!token) { setServerChecked(true); return; }
        const res = await fetch('/api/members/profile', { headers: { Authorization: `Bearer ${token}` } });
        if (!res.ok) { setServerChecked(true); return; }
        const data = await res.json();
        if (!cancelled && data.isMember) {
          localStorage.setItem(onboardingKey, 'true');
          setServerComplete(true);
        }
      } catch { /* ignore */ }
      if (!cancelled) setServerChecked(true);
    })();
    return () => { cancelled = true; };
  }, [userId, localComplete, onboardingKey]);

  const onboardingComplete = localComplete || serverComplete;

  useEffect(() => {
    if (userId && serverChecked && !onboardingComplete) {
      const params = window.location.search;
      setLocation(`/member${params}`);
    }
  }, [userId, onboardingComplete, serverChecked, setLocation]);

  const params = new URLSearchParams(window.location.search);
  const tempPacketIdFromUrl = params.get('tempPacketId') || localStorage.getItem('pending_temp_packet_id');

  const claimTempPacket = async (memberId: string, packetId: string) => {
    try {
      const token = await (await import("@/lib/firebase")).auth.currentUser?.getIdToken();
      const res = await fetch(`/api/members/${memberId}/claim-temp-packet`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ tempPacketId: packetId }),
      });
      if (!res.ok) return;
      const data = await res.json();
      if (data.success && data.packetConfig) {
        const cfg = data.packetConfig;
        if (cfg.selectedColor) setSelectedColor(cfg.selectedColor);
        if (cfg.qrType) setQrType(cfg.qrType);
        if (cfg.selectedPlacements?.length) setSelectedPlacements(cfg.selectedPlacements);
        if (cfg.graphicSize) setGraphicSize(cfg.graphicSize);
        console.log('[Member] Claimed temp packet config:', cfg);
      }
    } catch (err) {
      console.warn('[Member] Failed to claim temp packet:', err);
    }
  };

  const claimedRef = useRef(false);
  useEffect(() => {
    if (onboardingComplete && tempPacketIdFromUrl && userId && !claimedRef.current) {
      claimedRef.current = true;
      localStorage.removeItem('pending_temp_packet_id');
      claimTempPacket(userId, tempPacketIdFromUrl);
      setWizardTier('super-simple');
      setViewMode('wizard');
    }
  }, [onboardingComplete, tempPacketIdFromUrl, userId]);

  if (!onboardingComplete) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e3a5f 50%, #0f172a 100%)' }}>
        <Loader2 className="h-8 w-8 animate-spin text-blue-400" />
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
              <Button
                variant={viewMode === 'social' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('social')}
                data-testid="tab-social"
                className={viewMode === 'social' ? 'bg-pink-600 text-white' : 'text-white/70 hover:text-white hover:bg-white/10'}
              >
                <Share2 className="w-4 h-4 mr-1" />
                Social Hub
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
          <Suspense fallback={<LazyFallback />}>
            <SimpleWizard />
          </Suspense>
        )}

        {viewMode === 'wizard' && wizardTier === 'advanced' && (
          <Suspense fallback={<LazyFallback />}>
            <AdvancedWizard />
          </Suspense>
        )}

        {viewMode === 'wizard' && wizardTier === 'studio' && (
          <Suspense fallback={<LazyFallback />}>
            <StudioMode />
          </Suspense>
        )}

        {viewMode === 'wizard' && wizardTier === 'super-simple' && (
          <Suspense fallback={<LazyFallback />}>
            <SuperSimpleWizard />
          </Suspense>
        )}

        {viewMode === 'index' && (
          <MemberIndexView 
            memberId={user?.id || ''} 
            onNavigate={(view, channelId) => {
              if (view === 'channels' && channelId) {
                setInitialChannelId(channelId);
              } else {
                setInitialChannelId(null);
              }
              setViewMode(view);
            }}
            onStartWizard={(tier) => {
              setWizardTier(tier);
              setViewMode('wizard');
            }}
            publishCount={publishCount}
          />
        )}

        {viewMode === 'channels' && (
          <ChannelsView memberId={user?.id || ''} initialChannelId={initialChannelId} />
        )}

        {viewMode === 'collections' && (
          <CollectionsView memberId={user?.id || ''} />
        )}

        {viewMode === 'earnings' && (
          <EarningsView memberId={user?.id || ''} />
        )}

        {viewMode === 'social' && (
          <Suspense fallback={<LazyFallback />}>
            <SocialHubView memberId={user?.id || ''} />
          </Suspense>
        )}

        <div className="mt-6 text-center text-white/50 text-sm">
          Logged in as: {user?.email || "Unknown"}
        </div>
      </div>
    </div>
  );
}

class MembersErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null; errorInfo: string }> {
  state = { error: null as Error | null, errorInfo: '' };
  static getDerivedStateFromError(error: Error) { return { error }; }
  componentDidCatch(error: Error, info: ErrorInfo) {
    this.setState({ errorInfo: info.componentStack || '' });
    console.error('[MembersPage crash]', error, info);
  }
  render() {
    if (this.state.error) {
      return (
        <div className="min-h-screen flex items-center justify-center p-6" style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e3a5f 50%, #0f172a 100%)' }}>
          <Card className="bg-slate-800/80 border-red-500/50 max-w-lg">
            <CardContent className="p-6 space-y-4">
              <h2 className="text-xl font-bold text-white">Something went wrong</h2>
              <p className="text-red-300 text-sm font-mono break-all">{this.state.error.message}</p>
              <pre className="text-xs text-slate-400 max-h-40 overflow-auto whitespace-pre-wrap">{this.state.errorInfo}</pre>
              <Button onClick={() => { this.setState({ error: null, errorInfo: '' }); window.location.reload(); }} data-testid="button-reload-members">
                Reload Page
              </Button>
            </CardContent>
          </Card>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function TestMembersSandbox() {
  return (
    <MembersErrorBoundary>
      <MemberAuthProvider apiBase="/api/members">
        <MembersProvider>
          <MembersSandboxContent />
        </MembersProvider>
      </MemberAuthProvider>
    </MembersErrorBoundary>
  );
}
