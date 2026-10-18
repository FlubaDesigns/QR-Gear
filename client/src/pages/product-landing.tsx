import { CLAIM_CODE_MAX_LENGTH, isClaimCode, normalizeClaimCode } from "@shared/claimCode";
import { renderLandingPage, type LandingPageTextStyle } from "@/features/shared/graphics/landingPageRenderer";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useParams, useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, ArrowLeft, Zap, ChevronDown, ChevronUp } from "lucide-react";

interface LandingPageData {
  landingTextBlocks?: LandingPageTextStyle[];
  titleStyle?: LandingPageTextStyle;
  descriptionStyle?: LandingPageTextStyle;
  landingPageSnapshotUrl: string | null;
  qrOnlyUrl: string | null;
  qrProductState: string;
  playMediaUrl: string | null;
  playMediaType: string | null;
  landingPageTitle: string | null;
  landingPageDescription: string | null;
  landingPageBackgroundUrl: string | null;
}

function isYouTubeUrl(url: string): boolean {
  return url.includes("youtube.com") || url.includes("youtu.be");
}

function isVimeoUrl(url: string): boolean {
  return url.includes("vimeo.com");
}

function getYouTubeEmbedUrl(url: string): string {
  const videoId = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\s]+)/)?.[1];
  return videoId ? `https://www.youtube.com/embed/${videoId}?autoplay=1` : url;
}

function getVimeoEmbedUrl(url: string): string {
  const videoId = url.match(/vimeo\.com\/(\d+)/)?.[1];
  return videoId ? `https://player.vimeo.com/video/${videoId}?autoplay=1` : url;
}

function ActivationPanel() {
  const [, setLocation] = useLocation();
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState("");

  function handleActivate() {
    const cleaned = normalizeClaimCode(code);
    if (isClaimCode(cleaned)) {
      setLocation(`/claim/${cleaned}`);
    }
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50">
      <div className="bg-slate-900/95 backdrop-blur border-t border-slate-700 shadow-2xl">
        {open ? (
          <div className="max-w-sm mx-auto p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Zap className="h-4 w-4 text-blue-400" />
                <span className="text-sm font-semibold text-white">Activate Your Item</span>
              </div>
              <Button
                size="icon"
                variant="ghost"
                onClick={() => setOpen(false)}
                className="h-7 w-7 text-slate-400"
                data-testid="button-close-activation"
              >
                <ChevronDown className="h-4 w-4" />
              </Button>
            </div>
            <p className="text-xs text-slate-400">
              Enter the activation code from your purchase email to activate the hosting term included with your purchase.
            </p>
            <div className="flex gap-2">
              <Input
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="Paste your full activation code"
                aria-label="Activation code"
                autoCapitalize="none"
                autoCorrect="off"
                className="bg-slate-800 border-slate-600 text-white placeholder:text-slate-500 font-mono tracking-widest text-center"
                maxLength={CLAIM_CODE_MAX_LENGTH}
                data-testid="input-activation-code"
                onKeyDown={(e) => e.key === 'Enter' && handleActivate()}
              />
              <Button
                onClick={handleActivate}
                disabled={!isClaimCode(code)}
                data-testid="button-activate"
              >
                Activate
              </Button>
            </div>
          </div>
        ) : (
          <div className="max-w-sm mx-auto px-4 py-3">
            <Button
              variant="ghost"
              className="w-full flex items-center justify-between text-slate-300 hover:text-white"
              onClick={() => setOpen(true)}
              data-testid="button-open-activation"
            >
              <span className="flex items-center gap-2 text-sm">
                <Zap className="h-4 w-4 text-blue-400" />
                Is this your item? Activate it
              </span>
              <ChevronUp className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function ProductLanding() {
  const params = useParams();
  const slug = (params.slug || (params.rest ? `QRG-${params.rest}` : '')) as string;
  const [, setLocation] = useLocation();

  const { data, isLoading, error } = useQuery<{ success: boolean; landingPage: LandingPageData }>({
    queryKey: ['/api/public/landing', slug],
    enabled: !!slug,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const landingPage = data?.landingPage;
  const isPlayMode = landingPage?.qrProductState === "qr_play";
  const hasPlayMedia = isPlayMode && landingPage?.playMediaUrl;
  const hasSavedCanvas = !isPlayMode && !!landingPage?.landingPageBackgroundUrl;
  const hasSnapshot = !isPlayMode && !!landingPage?.landingPageSnapshotUrl;

  if (error || !data?.success || (!hasSnapshot && !hasPlayMedia && !hasSavedCanvas)) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center">
            <h1 className="text-2xl font-bold mb-2">Page Not Found</h1>
            <p className="text-muted-foreground mb-4">
              This page doesn't exist or has been removed.
            </p>
            <Button onClick={() => setLocation("/")} data-testid="button-back-home">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Home
            </Button>
          </CardContent>
        </Card>
        <ActivationPanel />
      </div>
    );
  }

  if (hasPlayMedia && landingPage.playMediaUrl) {
    const mediaUrl = landingPage.playMediaUrl;
    const isYouTube = isYouTubeUrl(mediaUrl);
    const isVimeo = isVimeoUrl(mediaUrl);
    const isEmbed = isYouTube || isVimeo;

    return (
      <div className="min-h-screen flex items-center justify-center bg-black pb-14">
        {isEmbed ? (
          <iframe
            src={isYouTube ? getYouTubeEmbedUrl(mediaUrl) : getVimeoEmbedUrl(mediaUrl)}
            className="w-full h-screen max-w-4xl"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            data-testid="video-embed"
          />
        ) : (
          <video
            src={mediaUrl}
            controls
            autoPlay
            className="max-w-full max-h-screen"
            data-testid="video-player"
          >
            Your browser does not support the video tag.
          </video>
        )}
        <ActivationPanel />
      </div>
    );
  }

  if (!hasSnapshot && hasSavedCanvas) return <SavedCanvasLanding page={landingPage!} />;

  return (
    <div className="min-h-screen flex items-center justify-center bg-black pb-14">
      <img
        src={landingPage!.landingPageSnapshotUrl!}
        alt="QR Landing"
        className="max-w-full max-h-screen object-contain"
        data-testid="img-landing-snapshot"
      />
      <ActivationPanel />
    </div>
  );
}

/** Render the saved landing contract; physical print artwork is never a landing substitute. */
export function SavedCanvasLanding({ page }: { page: LandingPageData }) {
  const [image, setImage] = useState<string | null>(null), [failed, setFailed] = useState(false), [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true; setImage(null); setFailed(false);
    const style = (text: string | null): LandingPageTextStyle => ({ text: text || '', fontFamily: 'Arial', fontSize: '24px', color: '#ffffff' });
    renderLandingPage({ backgroundUrl: page.landingPageBackgroundUrl, textBlocks: page.landingTextBlocks,
      titleStyle: page.titleStyle || style(page.landingPageTitle), descriptionStyle: page.descriptionStyle || style(page.landingPageDescription) })
      .then(url => { if (active) setImage(url); }).catch(() => { if (active) setFailed(true); });
    return () => { active = false; };
  }, [page, retry]);
  return <div className="min-h-screen flex flex-col items-center justify-center bg-black text-white pb-14">
    {image ? <img src={image} alt={page.landingPageTitle || 'QR Canvas'} className="max-w-full max-h-screen object-contain" /> : failed ? <><p>The selected landing image could not load.</p><Button onClick={() => setRetry(n => n + 1)}>Retry</Button></> : <Loader2 aria-label="Loading landing page" className="animate-spin" />}
    <ActivationPanel />
  </div>;
}
