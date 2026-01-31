import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { 
  Play, 
  Loader2, 
  ChevronRight, 
  ChevronLeft, 
  Check,
  Send,
  Video,
  Type,
  Eye,
  Sparkles,
  ExternalLink
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import SEO from "@/components/SEO";
import { VideoSourcePicker, VideoSource } from "@/features/shared/components/VideoSourcePicker";
import { VideoPlaySkin, createDefaultPlayLayers } from "@/features/shared/components/skins/VideoPlaySkin";
import { CanvasTextLayer, TextLayerConfig, TextBackdrop } from "@/features/shared/components/CanvasTextLayer";
import { createMemberPlayPacket, ProgressStep, ProgressStatus } from "@/lib/memberVideoService";

type WizardStep = "video" | "text" | "preview" | "publish";

const WIZARD_STEPS: { id: WizardStep; label: string; icon: any }[] = [
  { id: "video", label: "Choose Video", icon: Video },
  { id: "text", label: "Text Overlay", icon: Type },
  { id: "preview", label: "Preview", icon: Eye },
  { id: "publish", label: "Publish", icon: Send },
];

function WizardProgressBar({ 
  currentStep, 
  completedSteps 
}: { 
  currentStep: WizardStep; 
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
          className="h-full bg-gradient-to-r from-rose-500 to-rose-400 transition-all duration-300 rounded-full"
          style={{ width: `${progress}%` }}
        />
      </div>
      <div className="flex justify-between mt-2">
        {WIZARD_STEPS.map((step, i) => {
          const StepIcon = step.icon;
          const isCompleted = completedSteps.has(step.id);
          const isCurrent = step.id === currentStep;
          return (
            <div 
              key={step.id}
              className={`flex flex-col items-center text-xs transition-colors ${
                isCurrent ? "text-rose-400" : isCompleted ? "text-green-400" : "text-slate-500"
              }`}
            >
              <div className={`w-7 h-7 rounded-full flex items-center justify-center mb-1 ${
                isCurrent ? "bg-rose-500/20 border border-rose-500" : 
                isCompleted ? "bg-green-500/20 border border-green-500" : 
                "bg-slate-700/50"
              }`}>
                {isCompleted ? <Check className="w-4 h-4" /> : <StepIcon className="w-4 h-4" />}
              </div>
              <span className="hidden sm:block">{step.label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function TestQRPlayPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [currentStep, setCurrentStep] = useState<WizardStep>("video");
  const [completedSteps, setCompletedSteps] = useState<Set<WizardStep>>(new Set());
  
  const [videoSource, setVideoSource] = useState<VideoSource | null>(null);
  const [textLayers, setTextLayers] = useState<TextLayerConfig[]>(createDefaultPlayLayers());
  const [textBackdrop, setTextBackdrop] = useState<TextBackdrop>("soft");
  const [activeLayerIndex, setActiveLayerIndex] = useState(0);
  
  const [isPublishing, setIsPublishing] = useState(false);
  const [publishProgress, setPublishProgress] = useState<{ step: ProgressStep; status: ProgressStatus } | null>(null);
  const [publishResult, setPublishResult] = useState<{ packetId?: string; shareUrl?: string; error?: string } | null>(null);

  const memberId = user?.id?.toString() || "demo-user";

  function canProceed(): boolean {
    switch (currentStep) {
      case "video":
        return videoSource !== null;
      case "text":
        return true;
      case "preview":
        return videoSource !== null;
      case "publish":
        return publishResult?.packetId !== undefined;
      default:
        return false;
    }
  }

  function goNext() {
    const stepIndex = WIZARD_STEPS.findIndex(s => s.id === currentStep);
    if (stepIndex < WIZARD_STEPS.length - 1) {
      setCompletedSteps(prev => new Set(Array.from(prev).concat(currentStep)));
      setCurrentStep(WIZARD_STEPS[stepIndex + 1].id);
    }
  }

  function goBack() {
    const stepIndex = WIZARD_STEPS.findIndex(s => s.id === currentStep);
    if (stepIndex > 0) {
      setCurrentStep(WIZARD_STEPS[stepIndex - 1].id);
    }
  }

  function updateLayer(index: number, updated: TextLayerConfig) {
    const next = [...textLayers];
    next[index] = { ...updated, backdrop: textBackdrop };
    setTextLayers(next);
  }

  async function handlePublish() {
    if (!videoSource) {
      toast({ title: "No video selected", variant: "destructive" });
      return;
    }

    setIsPublishing(true);
    setPublishProgress(null);
    setPublishResult(null);

    try {
      const result = await createMemberPlayPacket({
        memberId,
        videoSource,
        textLayers: textLayers.map(l => ({ ...l, backdrop: textBackdrop })),
        textBackdrop,
        playSettings: { muted: true, loop: true, controls: "minimal" },
        source: { entryPoint: "test" },
        onProgress: (step, status) => {
          setPublishProgress({ step, status });
        }
      });

      if (result.success) {
        setPublishResult({
          packetId: result.packetId,
          shareUrl: result.shareUrl
        });
        toast({
          title: "Published successfully!",
          description: `Packet ID: ${result.packetId}`
        });
      } else {
        setPublishResult({ error: result.error });
        toast({
          title: "Publish failed",
          description: result.error,
          variant: "destructive"
        });
      }
    } catch (err: any) {
      setPublishResult({ error: err.message });
      toast({
        title: "Error",
        description: err.message,
        variant: "destructive"
      });
    } finally {
      setIsPublishing(false);
    }
  }

  return (
    <>
      <SEO 
        title="Test QR Play | QR Gear"
        description="Test the QR Play video wizard"
      />
      
      <div className="page-wrap">
        <div className="container mobile-compact mobile-compact-stack max-w-4xl mx-auto">
          <Card className="glass-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2" data-testid="text-page-title">
                <Play className="h-5 w-5 text-rose-400" />
                QR Play Wizard
                <Badge variant="secondary" className="ml-2">Test</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <WizardProgressBar 
                currentStep={currentStep} 
                completedSteps={completedSteps} 
              />

              {currentStep === "video" && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 mb-4">
                    <Video className="h-5 w-5 text-rose-400" />
                    <h3 className="font-semibold">Choose Video Source</h3>
                  </div>
                  
                  <p className="text-sm text-muted-foreground mb-4">
                    Upload your own video (MP4, WebM, MOV up to 100MB) or link to an external video (YouTube, Vimeo, or direct link).
                  </p>

                  <VideoSourcePicker
                    memberId={memberId}
                    value={videoSource}
                    onChange={setVideoSource}
                    onError={(err) => toast({ title: "Error", description: err, variant: "destructive" })}
                    data-testid="video-source-picker"
                  />

                  {videoSource && (
                    <div className="mt-4 p-3 bg-green-500/10 border border-green-500/30 rounded-lg flex items-center gap-2">
                      <Check className="h-4 w-4 text-green-500" />
                      <span className="text-sm text-green-400">
                        Video source selected: {videoSource.type === "upload" ? "Uploaded video" : `${videoSource.platform || "External"} link`}
                      </span>
                    </div>
                  )}
                </div>
              )}

              {currentStep === "text" && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 mb-4">
                    <Type className="h-5 w-5 text-rose-400" />
                    <h3 className="font-semibold">Text Overlay</h3>
                  </div>

                  <p className="text-sm text-muted-foreground mb-4">
                    Add text that appears over your video. Use backdrops for better readability on moving content.
                  </p>

                  <div className="mb-4">
                    <label className="text-sm text-muted-foreground mb-2 block">Text Backdrop (all layers)</label>
                    <div className="flex gap-2">
                      {(["off", "soft", "strong"] as TextBackdrop[]).map(option => (
                        <Button
                          key={option}
                          size="sm"
                          variant={textBackdrop === option ? "default" : "outline"}
                          className="flex-1 capitalize"
                          onClick={() => setTextBackdrop(option)}
                          data-testid={`btn-global-backdrop-${option}`}
                        >
                          {option}
                        </Button>
                      ))}
                    </div>
                  </div>

                  <div className="flex gap-2 mb-4">
                    {textLayers.map((layer, i) => (
                      <Button
                        key={layer.id}
                        size="sm"
                        variant={activeLayerIndex === i ? "default" : "outline"}
                        className="flex-1"
                        onClick={() => setActiveLayerIndex(i)}
                        data-testid={`btn-layer-${layer.id}`}
                      >
                        {layer.label}
                        {layer.text && <span className="ml-1 opacity-60">*</span>}
                      </Button>
                    ))}
                  </div>

                  {textLayers[activeLayerIndex] && (
                    <CanvasTextLayer
                      layer={{ ...textLayers[activeLayerIndex], backdrop: textBackdrop }}
                      onChange={(l) => updateLayer(activeLayerIndex, l)}
                      compact={false}
                    />
                  )}
                </div>
              )}

              {currentStep === "preview" && videoSource && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 mb-4">
                    <Eye className="h-5 w-5 text-rose-400" />
                    <h3 className="font-semibold">Preview</h3>
                  </div>

                  <p className="text-sm text-muted-foreground mb-4">
                    Preview how your video will appear with text overlays.
                  </p>

                  <VideoPlaySkin
                    videoSource={videoSource}
                    textLayers={textLayers.map(l => ({ ...l, backdrop: textBackdrop }))}
                    editable={false}
                    autoPlay={false}
                    loop={true}
                  />
                </div>
              )}

              {currentStep === "publish" && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 mb-4">
                    <Send className="h-5 w-5 text-rose-400" />
                    <h3 className="font-semibold">Publish</h3>
                  </div>

                  {!publishResult?.packetId ? (
                    <>
                      <p className="text-sm text-muted-foreground mb-4">
                        Create your QR Play packet and publish it to your member library.
                      </p>

                      <div className="bg-slate-800/50 rounded-lg p-4 mb-4">
                        <h4 className="font-medium mb-2">Summary</h4>
                        <ul className="text-sm text-muted-foreground space-y-1">
                          <li>Video: {videoSource?.type === "upload" ? videoSource.fileName || "Uploaded" : videoSource?.platform || "External"}</li>
                          <li>Title: {textLayers.find(l => l.id === "title")?.text || "(none)"}</li>
                          <li>Tagline: {textLayers.find(l => l.id === "tagline")?.text || "(none)"}</li>
                          <li>Backdrop: {textBackdrop}</li>
                        </ul>
                      </div>

                      {publishProgress && (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          <span>
                            {publishProgress.step === "packet" && "Creating packet..."}
                            {publishProgress.step === "share_card" && "Generating share card..."}
                            {publishProgress.step === "publish" && "Publishing to library..."}
                          </span>
                        </div>
                      )}

                      <Button
                        className="w-full"
                        onClick={handlePublish}
                        disabled={isPublishing || !videoSource}
                        data-testid="btn-publish"
                      >
                        {isPublishing ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin mr-2" />
                            Publishing...
                          </>
                        ) : (
                          <>
                            <Sparkles className="h-4 w-4 mr-2" />
                            Publish QR Play
                          </>
                        )}
                      </Button>
                    </>
                  ) : (
                    <div className="space-y-4">
                      <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <Check className="h-5 w-5 text-green-500" />
                          <span className="font-medium text-green-400">Published Successfully!</span>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          Your QR Play packet has been created and published to your library.
                        </p>
                      </div>

                      <div className="bg-slate-800/50 rounded-lg p-4">
                        <h4 className="font-medium mb-2">Details</h4>
                        <div className="text-sm space-y-1">
                          <p><span className="text-muted-foreground">Packet ID:</span> {publishResult.packetId}</p>
                          <p><span className="text-muted-foreground">Share URL:</span> {publishResult.shareUrl}</p>
                        </div>
                      </div>

                      <Button
                        className="w-full"
                        variant="outline"
                        onClick={() => window.open(publishResult.shareUrl, "_blank")}
                        data-testid="btn-view-packet"
                      >
                        <ExternalLink className="h-4 w-4 mr-2" />
                        View Published Packet
                      </Button>
                    </div>
                  )}

                  {publishResult?.error && (
                    <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
                      <p className="text-sm text-red-400">{publishResult.error}</p>
                    </div>
                  )}
                </div>
              )}

              <div className="flex justify-between mt-6 pt-4 border-t border-slate-700">
                <Button
                  variant="outline"
                  onClick={goBack}
                  disabled={currentStep === "video"}
                  data-testid="btn-back"
                >
                  <ChevronLeft className="h-4 w-4 mr-1" />
                  Back
                </Button>

                {currentStep !== "publish" && (
                  <Button
                    onClick={goNext}
                    disabled={!canProceed()}
                    data-testid="btn-next"
                  >
                    Next
                    <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
