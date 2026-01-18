import { useQuery } from "@tanstack/react-query";
import { useParams } from "wouter";
import { Loader2, AlertCircle, Play, Volume2, VolumeX } from "lucide-react";
import { useState, useRef } from "react";

interface PacketData {
  id: string;
  playMediaUrl?: string;
  playMediaType?: string;
  productName?: string;
}

export default function PlayPage() {
  const { packetId } = useParams<{ packetId: string }>();
  const [isMuted, setIsMuted] = useState(true);
  const videoRef = useRef<HTMLVideoElement>(null);

  const { data, isLoading, error } = useQuery<{ packet: PacketData }>({
    queryKey: ["/api/test/packets", packetId],
    queryFn: async () => {
      const res = await fetch(`/api/test/packets/${packetId}`);
      if (!res.ok) throw new Error("Content not found");
      return res.json();
    },
    enabled: !!packetId,
  });

  const handleToggleMute = () => {
    if (videoRef.current) {
      videoRef.current.muted = !isMuted;
      setIsMuted(!isMuted);
    }
  };

  const handlePlayVideo = () => {
    if (videoRef.current) {
      videoRef.current.play();
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <Loader2 className="h-12 w-12 text-white animate-spin" />
      </div>
    );
  }

  if (error || !data?.packet) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center text-white p-4">
        <AlertCircle className="h-16 w-16 mb-4 text-red-500" />
        <h1 className="text-xl font-bold mb-2">Content Not Found</h1>
        <p className="text-gray-400 text-center">
          This content may have expired or been removed.
        </p>
      </div>
    );
  }

  const { packet } = data;
  const mediaUrl = packet.playMediaUrl;
  const mediaType = packet.playMediaType || "";
  const isVideo = mediaType.startsWith("video/") || 
                  mediaUrl?.includes("youtube") || 
                  mediaUrl?.includes("vimeo") ||
                  mediaUrl?.endsWith(".mp4") ||
                  mediaUrl?.endsWith(".webm");
  const isYouTube = mediaUrl?.includes("youtube.com") || mediaUrl?.includes("youtu.be");
  const isVimeo = mediaUrl?.includes("vimeo.com");

  if (!mediaUrl) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center text-white p-4">
        <AlertCircle className="h-16 w-16 mb-4 text-yellow-500" />
        <h1 className="text-xl font-bold mb-2">No Media Available</h1>
        <p className="text-gray-400 text-center">
          This content hasn't been configured yet.
        </p>
      </div>
    );
  }

  const getYouTubeEmbedUrl = (url: string) => {
    const match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\s]+)/);
    if (match) {
      return `https://www.youtube.com/embed/${match[1]}?autoplay=1&rel=0`;
    }
    return url;
  };

  const getVimeoEmbedUrl = (url: string) => {
    const match = url.match(/vimeo\.com\/(\d+)/);
    if (match) {
      return `https://player.vimeo.com/video/${match[1]}?autoplay=1`;
    }
    return url;
  };

  return (
    <div className="min-h-screen bg-black flex flex-col">
      <div className="flex-1 flex items-center justify-center relative">
        {isYouTube ? (
          <iframe
            src={getYouTubeEmbedUrl(mediaUrl)}
            className="w-full h-full absolute inset-0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            data-testid="play-youtube-embed"
          />
        ) : isVimeo ? (
          <iframe
            src={getVimeoEmbedUrl(mediaUrl)}
            className="w-full h-full absolute inset-0"
            allow="autoplay; fullscreen; picture-in-picture"
            allowFullScreen
            data-testid="play-vimeo-embed"
          />
        ) : isVideo ? (
          <div className="relative w-full h-full">
            <video
              ref={videoRef}
              src={mediaUrl}
              className="w-full h-full object-contain"
              autoPlay
              loop
              muted={isMuted}
              playsInline
              onClick={handlePlayVideo}
              data-testid="play-video"
            />
            <button
              onClick={handleToggleMute}
              className="absolute bottom-4 right-4 p-3 bg-black/50 rounded-full text-white hover:bg-black/70 transition-colors"
              data-testid="button-toggle-mute"
            >
              {isMuted ? <VolumeX className="h-6 w-6" /> : <Volume2 className="h-6 w-6" />}
            </button>
            <button
              onClick={handlePlayVideo}
              className="absolute inset-0 flex items-center justify-center bg-black/20 opacity-0 hover:opacity-100 transition-opacity"
              data-testid="button-play-overlay"
            >
              <Play className="h-16 w-16 text-white" />
            </button>
          </div>
        ) : (
          <img
            src={mediaUrl}
            alt="Content"
            className="max-w-full max-h-full object-contain"
            data-testid="play-image"
          />
        )}
      </div>
    </div>
  );
}
