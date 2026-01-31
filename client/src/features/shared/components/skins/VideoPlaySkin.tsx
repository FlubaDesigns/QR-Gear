import { useState, useRef, useEffect } from "react";
import { Play, Pause, Volume2, VolumeX, Maximize, ExternalLink, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CanvasTextPreview, TextLayerConfig, defaultTextLayer } from "../CanvasTextLayer";
import { CanvasTextLayer } from "../CanvasTextLayer";
import { VideoSource } from "../VideoSourcePicker";
import { cn } from "@/lib/utils";

interface VideoPlaySkinProps {
  videoSource: VideoSource;
  textLayers?: TextLayerConfig[];
  onTextLayersChange?: (layers: TextLayerConfig[]) => void;
  editable?: boolean;
  autoPlay?: boolean;
  loop?: boolean;
  className?: string;
}

export function VideoPlaySkin({
  videoSource,
  textLayers = [],
  onTextLayersChange,
  editable = false,
  autoPlay = false,
  loop = true,
  className
}: VideoPlaySkinProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [showControls, setShowControls] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [activeLayerIndex, setActiveLayerIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerSize, setContainerSize] = useState({ width: 400, height: 400 });

  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        setContainerSize({
          width: entry.contentRect.width,
          height: entry.contentRect.height
        });
      }
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (videoSource.type === "upload" && videoRef.current) {
      if (autoPlay) {
        videoRef.current.play().catch(() => {});
      }
    }
  }, [videoSource, autoPlay]);

  function togglePlay() {
    if (!videoRef.current) return;
    if (isPlaying) {
      videoRef.current.pause();
    } else {
      videoRef.current.play().catch(() => {});
    }
    setIsPlaying(!isPlaying);
  }

  function toggleMute() {
    if (!videoRef.current) return;
    videoRef.current.muted = !isMuted;
    setIsMuted(!isMuted);
  }

  function handleFullscreen() {
    if (!containerRef.current) return;
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      containerRef.current.requestFullscreen();
    }
  }

  function handleExternalOpen() {
    if (videoSource.externalUrl) {
      window.open(videoSource.externalUrl, "_blank");
    }
  }

  function updateLayer(index: number, updated: TextLayerConfig) {
    const next = [...textLayers];
    next[index] = updated;
    onTextLayersChange?.(next);
  }

  const isExternal = videoSource.type === "external";
  const isEmbeddable = isExternal && (videoSource.platform === "youtube" || videoSource.platform === "vimeo");

  function getEmbedUrl(): string | null {
    if (!videoSource.externalUrl) return null;
    
    if (videoSource.platform === "youtube") {
      const match = videoSource.externalUrl.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
      if (match) return `https://www.youtube.com/embed/${match[1]}?autoplay=0&rel=0`;
    }
    
    if (videoSource.platform === "vimeo") {
      const match = videoSource.externalUrl.match(/vimeo\.com\/(?:video\/)?(\d+)/);
      if (match) return `https://player.vimeo.com/video/${match[1]}?autoplay=0`;
    }
    
    return null;
  }

  return (
    <Card className={cn("overflow-hidden", className)}>
      <div className="grid md:grid-cols-2 gap-0">
        <div 
          ref={containerRef}
          className="relative bg-black aspect-square flex items-center justify-center overflow-hidden"
          onMouseEnter={() => setShowControls(true)}
          onMouseLeave={() => !isPlaying && setShowControls(true)}
        >
          {isExternal && isEmbeddable ? (
            <iframe
              src={getEmbedUrl() || undefined}
              className="w-full h-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              data-testid="video-embed"
            />
          ) : isExternal && !isEmbeddable ? (
            <div className="relative w-full h-full">
              {videoSource.posterUrl && (
                <img 
                  src={videoSource.posterUrl} 
                  alt="Video poster" 
                  className="w-full h-full object-cover"
                />
              )}
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/40">
                <Button
                  size="lg"
                  className="rounded-full w-16 h-16"
                  onClick={handleExternalOpen}
                  data-testid="btn-open-external"
                >
                  <ExternalLink className="w-8 h-8" />
                </Button>
                <p className="text-white text-sm mt-3">Opens in {videoSource.platform || "external player"}</p>
              </div>
              
              <CanvasTextPreview
                layers={textLayers}
                containerWidth={containerSize.width}
                containerHeight={containerSize.height}
                className="absolute inset-0 w-full h-full pointer-events-none"
              />
            </div>
          ) : (
            <>
              {isLoading && videoSource.posterUrl && (
                <img 
                  src={videoSource.posterUrl} 
                  alt="Video poster" 
                  className="absolute inset-0 w-full h-full object-cover"
                />
              )}
              
              <video
                ref={videoRef}
                src={videoSource.videoUrl}
                poster={videoSource.posterUrl}
                loop={loop}
                muted={isMuted}
                playsInline
                className="w-full h-full object-contain"
                onLoadStart={() => setIsLoading(true)}
                onLoadedData={() => setIsLoading(false)}
                onPlay={() => setIsPlaying(true)}
                onPause={() => setIsPlaying(false)}
                data-testid="video-player"
              />

              <CanvasTextPreview
                layers={textLayers}
                containerWidth={containerSize.width}
                containerHeight={containerSize.height}
                className="absolute inset-0 w-full h-full pointer-events-none"
              />

              {showControls && (
                <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-black/80 to-transparent">
                  <div className="flex items-center gap-2">
                    <Button
                      size="icon"
                      variant="ghost"
                      className="text-white hover:bg-white/20"
                      onClick={togglePlay}
                      data-testid="btn-play-pause"
                    >
                      {isLoading ? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                      ) : isPlaying ? (
                        <Pause className="w-5 h-5" />
                      ) : (
                        <Play className="w-5 h-5" />
                      )}
                    </Button>
                    
                    <Button
                      size="icon"
                      variant="ghost"
                      className="text-white hover:bg-white/20"
                      onClick={toggleMute}
                      data-testid="btn-mute"
                    >
                      {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
                    </Button>

                    <div className="flex-1" />

                    <Button
                      size="icon"
                      variant="ghost"
                      className="text-white hover:bg-white/20"
                      onClick={handleFullscreen}
                      data-testid="btn-fullscreen"
                    >
                      <Maximize className="w-5 h-5" />
                    </Button>
                  </div>
                </div>
              )}

              {!isPlaying && !isLoading && (
                <Button
                  size="icon"
                  className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-16 h-16 rounded-full bg-white/20 backdrop-blur hover:bg-white/30"
                  onClick={togglePlay}
                  data-testid="btn-play-center"
                >
                  <Play className="w-8 h-8 text-white" />
                </Button>
              )}
            </>
          )}

          {videoSource.type === "upload" && (
            <Badge className="absolute top-3 right-3" variant="secondary">
              {videoSource.duration 
                ? `${Math.floor(videoSource.duration / 60)}:${String(videoSource.duration % 60).padStart(2, "0")}`
                : "Video"
              }
            </Badge>
          )}
        </div>

        {editable && (
          <div className="p-4 flex flex-col gap-4 max-h-[400px] overflow-y-auto">
            <div>
              <h3 className="font-semibold text-lg" data-testid="text-video-title">
                Text Overlay
              </h3>
              <p className="text-sm text-muted-foreground mt-1">
                Add text that appears over the video
              </p>
            </div>

            <div className="flex gap-1">
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
                layer={textLayers[activeLayerIndex]}
                onChange={(l) => updateLayer(activeLayerIndex, l)}
                compact={false}
              />
            )}
          </div>
        )}
      </div>
    </Card>
  );
}

export function createDefaultPlayLayers(): TextLayerConfig[] {
  return [
    { ...defaultTextLayer("title", "Title"), text: "", y: 30, backdrop: "soft" },
    { ...defaultTextLayer("tagline", "Tagline"), text: "", fontSize: 16, y: 70, backdrop: "soft" },
  ];
}
