import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { 
  Package, CheckCircle, XCircle, Loader2, Play, 
  Image, Type, ArrowRight, RefreshCw, ExternalLink, ArrowLeft
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { 
  createMemberCanvasPacket, 
  getMemberPackets, 
  getMemberLibrary,
  type ProgressStep,
  type ProgressStatus,
} from "@/lib/memberPacketService";
import { 
  CanvasTextLayer, 
  CanvasTextPreview, 
  defaultTextLayer, 
  type TextLayerConfig 
} from "@/features/shared/components/CanvasTextLayer";

type StepState = {
  packet: ProgressStatus | null;
  graphics: ProgressStatus | null;
  template: ProgressStatus | null;
  library: ProgressStatus | null;
};

export default function TestCanvasPacketPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [backgroundUrl, setBackgroundUrl] = useState("https://images.unsplash.com/photo-1557683316-973673baf926?w=800");
  const [urlContent, setUrlContent] = useState("https://example.com");
  const [textLayers, setTextLayers] = useState<TextLayerConfig[]>([
    { ...defaultTextLayer("title", "Title"), text: "My Canvas Design", y: 35, fontSize: 36 },
    { ...defaultTextLayer("tagline", "Tagline"), text: "Created with QR Gear", y: 65, fontSize: 18 },
  ]);
  const [activeLayerIndex, setActiveLayerIndex] = useState(0);
  
  const [isCreating, setIsCreating] = useState(false);
  const [stepState, setStepState] = useState<StepState>({
    packet: null,
    graphics: null,
    template: null,
    library: null,
  });
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const memberId = user?.id || "test-member-123";

  const { data: packetsData, refetch: refetchPackets } = useQuery({
    queryKey: ['/api/member/packets', memberId],
    queryFn: async () => getMemberPackets(memberId),
    enabled: !!memberId,
  });

  const { data: libraryData, refetch: refetchLibrary } = useQuery({
    queryKey: ['/api/member/library-links', memberId],
    queryFn: async () => getMemberLibrary(memberId),
    enabled: !!memberId,
  });

  function handleProgress(step: ProgressStep, status: ProgressStatus) {
    setStepState(prev => ({ ...prev, [step]: status }));
  }

  async function handleCreatePacket(mode: 'draft' | 'commit') {
    setIsCreating(true);
    setError(null);
    setResult(null);
    setStepState({ packet: null, graphics: null, template: null, library: null });

    try {
      const res = await createMemberCanvasPacket({
        memberId,
        mode,
        canvas: {
          kind: 'qr_canvas',
          urlContent,
          background: { url: backgroundUrl },
          textLayers,
        },
        metadata: {
          tags: ['test', 'demo'],
          category: 'promotional',
        },
        source: {
          entryPoint: 'test',
          sessionId: `session-${Date.now()}`,
        },
        onProgress: handleProgress,
      });

      setResult(res);
      
      if (res.success) {
        toast({
          title: mode === 'draft' ? "Draft Saved" : "Canvas Published",
          description: `Packet ID: ${res.packetId}`,
        });
        refetchPackets();
        refetchLibrary();
      } else {
        setError(res.error || "Unknown error");
        toast({
          title: "Error",
          description: res.error,
          variant: "destructive",
        });
      }
    } catch (err: any) {
      setError(err.message);
      toast({
        title: "Error",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setIsCreating(false);
    }
  }

  function getStepIcon(status: ProgressStatus | null) {
    if (status === 'started') return <Loader2 className="h-4 w-4 animate-spin text-blue-500" />;
    if (status === 'done') return <CheckCircle className="h-4 w-4 text-green-500" />;
    if (status === 'error') return <XCircle className="h-4 w-4 text-red-500" />;
    return <div className="h-4 w-4 rounded-full border-2 border-muted" />;
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="sticky top-0 z-50 bg-background/95 backdrop-blur border-b px-4 py-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <Link href="/member">
              <Button variant="ghost" size="icon" data-testid="button-back">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <div className="min-w-0">
              <h1 className="text-base font-bold flex items-center gap-2" data-testid="text-page-title">
                <Package className="h-5 w-5 shrink-0" />
                <span className="truncate">Canvas Packet Test</span>
              </h1>
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {user ? (
              <Badge data-testid="badge-auth-status">Authenticated</Badge>
            ) : (
              <Badge variant="secondary" data-testid="badge-auth-status">Test Mode</Badge>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-4 space-y-4">

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Image className="h-4 w-4" />
              Canvas Setup
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label className="text-sm">Background URL</Label>
              <Input
                value={backgroundUrl}
                onChange={(e) => setBackgroundUrl(e.target.value)}
                placeholder="https://..."
                data-testid="input-background-url"
              />
            </div>
            
            <div className="space-y-2">
              <Label className="text-sm">QR Content URL</Label>
              <Input
                value={urlContent}
                onChange={(e) => setUrlContent(e.target.value)}
                placeholder="https://..."
                data-testid="input-url-content"
              />
            </div>

            <div className="aspect-video bg-muted rounded-md overflow-hidden relative">
              <img
                src={backgroundUrl}
                alt="Background preview"
                className="w-full h-full object-cover"
                onError={(e) => (e.currentTarget.src = 'https://via.placeholder.com/800x450?text=Invalid+URL')}
                data-testid="img-background-preview"
              />
              <CanvasTextPreview
                layers={textLayers}
                containerWidth={400}
                containerHeight={225}
                className="absolute inset-0 w-full h-full"
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Type className="h-4 w-4" />
              Text Layers
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2">
              {textLayers.map((layer, i) => (
                <Button
                  key={layer.id}
                  size="sm"
                  variant={activeLayerIndex === i ? "default" : "outline"}
                  onClick={() => setActiveLayerIndex(i)}
                  data-testid={`btn-select-layer-${layer.id}`}
                >
                  {layer.label}
                  {layer.text && <CheckCircle className="h-3 w-3 ml-1" />}
                </Button>
              ))}
            </div>

            <CanvasTextLayer
              layer={textLayers[activeLayerIndex]}
              onChange={(updated) => {
                const next = [...textLayers];
                next[activeLayerIndex] = updated;
                setTextLayers(next);
              }}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Play className="h-4 w-4" />
              Create Packet
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-3 bg-muted rounded-md space-y-2">
              <div className="text-sm font-medium">Lifecycle Steps</div>
              {(['packet', 'graphics', 'template', 'library'] as ProgressStep[]).map((step, i) => (
                <div key={step} className="flex items-center gap-3">
                  {getStepIcon(stepState[step])}
                  <span className="text-sm capitalize">{step}</span>
                  {i < 3 && <ArrowRight className="h-3 w-3 text-muted-foreground ml-auto" />}
                </div>
              ))}
            </div>

            <div className="flex gap-2">
              <Button
                onClick={() => handleCreatePacket('draft')}
                disabled={isCreating}
                variant="outline"
                className="flex-1"
                data-testid="btn-save-draft"
              >
                {isCreating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                Save Draft
              </Button>
              <Button
                onClick={() => handleCreatePacket('commit')}
                disabled={isCreating}
                className="flex-1"
                data-testid="btn-publish"
              >
                {isCreating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                Publish
              </Button>
            </div>

            {error && (
              <div className="p-3 bg-destructive/10 text-destructive rounded-md text-sm" data-testid="text-error">
                {error}
              </div>
            )}

            {result?.success && (
              <div className="p-3 bg-green-500/10 text-green-600 rounded-md text-sm space-y-1" data-testid="text-success">
                <div className="font-medium">Success!</div>
                <div className="break-all">Packet: {result.packetId}</div>
                {result.templateId && <div className="break-all">Template: {result.templateId}</div>}
                {result.libraryLinkId && <div className="break-all">Library: {result.libraryLinkId}</div>}
                {result.shareUrl && (
                  <a href={result.shareUrl} className="flex items-center gap-1 text-blue-500 hover:underline break-all">
                    <ExternalLink className="h-3 w-3 shrink-0" />
                    {result.shareUrl}
                  </a>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-3">
            <CardTitle className="text-base">My Packets</CardTitle>
            <Button size="icon" variant="ghost" onClick={() => refetchPackets()} data-testid="btn-refresh-packets">
              <RefreshCw className="h-4 w-4" />
            </Button>
          </CardHeader>
          <CardContent>
            {packetsData?.packets && packetsData.packets.length > 0 ? (
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {packetsData.packets.slice(0, 10).map((pkt: any) => (
                  <div key={pkt.packetId} className="flex items-center justify-between gap-2 p-2 bg-muted rounded-md text-sm">
                    <span className="font-mono text-xs truncate min-w-0" data-testid={`text-packet-${pkt.packetId}`}>{pkt.packetId}</span>
                    <Badge variant={pkt.status === 'published' ? 'default' : 'secondary'}>
                      {pkt.status}
                    </Badge>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-sm text-muted-foreground text-center py-4">
                No packets yet
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-3">
            <CardTitle className="text-base">My Library</CardTitle>
            <Button size="icon" variant="ghost" onClick={() => refetchLibrary()} data-testid="btn-refresh-library">
              <RefreshCw className="h-4 w-4" />
            </Button>
          </CardHeader>
          <CardContent>
            {libraryData?.items && libraryData.items.length > 0 ? (
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {libraryData.items.slice(0, 10).map((item: any) => (
                  <div key={item.libraryLinkId} className="flex items-center justify-between gap-2 p-2 bg-muted rounded-md text-sm">
                    <span className="font-mono text-xs truncate min-w-0" data-testid={`text-library-${item.libraryLinkId}`}>{item.libraryLinkId}</span>
                    <Badge>{item.status}</Badge>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-sm text-muted-foreground text-center py-4">
                No library items yet
              </div>
            )}
          </CardContent>
        </Card>

        <div className="text-center text-xs text-muted-foreground pb-4">
          Member: <code className="bg-muted px-1 py-0.5 rounded break-all">{memberId}</code>
        </div>
      </div>
    </div>
  );
}
