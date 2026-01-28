import { useQuery } from "@tanstack/react-query";
import { useParams, useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, ArrowLeft } from "lucide-react";

interface LandingPageData {
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

export default function ProductLanding() {
  const params = useParams();
  const slug = params.slug as string;
  const [, setLocation] = useLocation();

  const { data, isLoading, error } = useQuery<{ success: boolean; landingPage: LandingPageData }>({
    queryKey: ['/api/test/landing', slug],
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
  // For Play mode, no snapshot needed - just show video
  const hasSnapshot = !isPlayMode && !!landingPage?.landingPageSnapshotUrl;

  if (error || !data?.success || (!hasSnapshot && !hasPlayMedia)) {
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
      </div>
    );
  }

  if (hasPlayMedia && landingPage.playMediaUrl) {
    const mediaUrl = landingPage.playMediaUrl;
    const isYouTube = isYouTubeUrl(mediaUrl);
    const isVimeo = isVimeoUrl(mediaUrl);
    const isEmbed = isYouTube || isVimeo;

    return (
      <div className="min-h-screen flex items-center justify-center bg-black">
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
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-black">
      <img
        src={landingPage!.landingPageSnapshotUrl!}
        alt="QR Landing"
        className="max-w-full max-h-screen object-contain"
        data-testid="img-landing-snapshot"
      />
    </div>
  );
}
