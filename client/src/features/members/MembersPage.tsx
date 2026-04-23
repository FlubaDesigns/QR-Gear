import { useState, useEffect, useRef, Component, lazy, Suspense, type ErrorInfo, type ReactNode } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  User, QrCode, Loader2, Layers, DollarSign, Share2,
  Wand2, Zap, Sparkles, BarChart3, Banknote
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import SEO from "@/components/SEO";
import { MemberAuthProvider } from "@/features/members/MemberAuthContext";
import { MembersProvider } from "@/features/members/MembersContext";
import {
  type ViewMode, type WizardTier,
  getAuthHeaders,
} from "@/features/shared/components/wizardSteps";
import { WizardProvider, useWizardContext } from "./WizardContext";
import { MemberIndexView } from "./member-index-view";
import { ChannelsView } from "./member-channels-view";
import { PayoutsView } from "./PayoutsView";

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

interface EarningsSummary {
  total: number;
  pending: number;
  paid: number;
  profitShare: number;
}

function CollectionsView({ memberId }: { memberId: string }) {
  const { data: dynamicsItems, isLoading } = useQuery<any[]>({
    queryKey: ['/api/members', memberId, 'dynamics'],
    queryFn: async () => {
      if (!memberId) return [];
      const headers = await getAuthHeaders();
      const res = await fetch(`/api/members/${memberId}/published-items?types=qr-compose`, { headers });
      if (!res.ok) return [];
      const data = await res.json();
      return data.items || [];
    },
    enabled: !!memberId
  });

  const itemList = dynamicsItems || [];

  return (
    <Card className="bg-slate-800/50 border-slate-700">
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <CardTitle className="text-white flex items-center gap-2">
          <QrCode className="w-5 h-5" />
          QR Dynamics
        </CardTitle>
        <Badge variant="outline" className="text-slate-400 border-slate-600">
          Built with QR Compose
        </Badge>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full" />
          </div>
        ) : itemList.length === 0 ? (
          <div className="text-center py-12 text-slate-400">
            <QrCode className="w-16 h-16 mx-auto mb-4 opacity-50" />
            <p className="mb-2">No QR Dynamics yet</p>
            <p className="text-sm">Use QR Compose in any wizard to stitch your Canvas and Play items into a rotating QR experience</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {itemList.map((item: any) => (
              <div 
                key={item.id} 
                className="p-4 bg-slate-700/50 rounded-lg border border-slate-600 hover:border-blue-500 transition-colors cursor-pointer"
                data-testid={`dynamics-item-${item.id}`}
              >
                <div className="flex items-start gap-3">
                  {item.itemImage && (
                    <img src={item.itemImage} alt={item.title} className="w-16 h-16 rounded-md object-cover flex-shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <h3 className="text-white font-medium truncate">{item.title || 'Untitled'}</h3>
                    <p className="text-sm text-slate-400">
                      {item.composeItems?.length || 0} items · {item.composeMode || 'auto-rotate'}
                    </p>
                    {item.composeInstanceId && (
                      <p className="text-xs text-blue-400 mt-1 truncate">
                        Instance: {item.composeInstanceId}
                      </p>
                    )}
                  </div>
                  <Badge variant="outline" className="text-green-400 border-green-400 flex-shrink-0">
                    Live
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
  const { isAuthenticated } = useAuth();

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
    if (isAuthenticated && userId && serverChecked && !onboardingComplete) {
      const params = window.location.search;
      setLocation(`/member${params}`);
    }
  }, [isAuthenticated, userId, onboardingComplete, serverChecked, setLocation]);

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

  useEffect(() => {
    if (!isAuthenticated) {
      setWizardTier('super-simple');
      setViewMode('wizard');
    }
  }, [isAuthenticated]);

  if (isAuthenticated && !onboardingComplete) {
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
        {viewMode !== 'wizard' && isAuthenticated && (
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
                QR Dynamics
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
                variant={viewMode === 'payouts' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('payouts')}
                data-testid="tab-payouts"
                className={viewMode === 'payouts' ? 'bg-emerald-600 text-white' : 'text-white/70 hover:text-white hover:bg-white/10'}
              >
                <Banknote className="w-4 h-4 mr-1" />
                Payouts
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

        {viewMode === 'index' && !isAuthenticated && (
          <div className="flex flex-col items-center justify-center py-16 px-4">
            <Card className="bg-slate-800/80 border-slate-700 max-w-md w-full">
              <CardContent className="p-8 text-center space-y-4">
                <QrCode className="w-12 h-12 mx-auto text-emerald-400" />
                <h2 className="text-xl font-bold text-white">You need an account to continue</h2>
                <p className="text-slate-400 text-sm">
                  An account lets us save your creations, generate your product mockups, and give you a personal dashboard to manage everything. It only takes a few seconds.
                </p>
                <p className="text-slate-500 text-xs">
                  Head back to the creator — you'll be asked to sign up right before your mockup is generated.
                </p>
                <div className="flex flex-col gap-3 pt-2">
                  <Button
                    onClick={() => { setWizardTier('super-simple'); setViewMode('wizard'); }}
                    className="bg-emerald-600 hover:bg-emerald-500 text-white"
                    data-testid="button-back-to-wizard"
                  >
                    <Wand2 className="w-4 h-4 mr-2" />
                    Back to Creator
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {viewMode === 'index' && isAuthenticated && (
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

        {viewMode === 'payouts' && (
          <PayoutsView memberId={user?.id || ''} />
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
