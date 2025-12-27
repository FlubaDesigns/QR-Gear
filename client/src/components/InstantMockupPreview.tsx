import { useMemo, useRef, useEffect, useState } from "react";

interface InstantMockupPreviewProps {
  baseShirtUrl: string;
  qrArtworkBlackUrl: string;
  qrArtworkWhiteUrl?: string;
  colorHex: string;
  colorName: string;
  placement?: "front-chest" | "front-center" | "back";
  className?: string;
}

function isColorDark(hex: string): boolean {
  const cleanHex = hex.replace('#', '');
  const r = parseInt(cleanHex.substring(0, 2), 16) / 255;
  const g = parseInt(cleanHex.substring(2, 4), 16) / 255;
  const b = parseInt(cleanHex.substring(4, 6), 16) / 255;
  
  const toLinear = (c: number) => c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  const luminance = 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
  
  return luminance < 0.5;
}

export default function InstantMockupPreview({
  baseShirtUrl,
  qrArtworkBlackUrl,
  qrArtworkWhiteUrl,
  colorHex,
  colorName,
  placement = "front-chest",
  className = "",
}: InstantMockupPreviewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const placementConfig = useMemo(() => {
    switch (placement) {
      case "front-chest":
        return { x: 0.5, y: 0.35, scale: 0.25 };
      case "front-center":
        return { x: 0.5, y: 0.45, scale: 0.35 };
      case "back":
        return { x: 0.5, y: 0.4, scale: 0.4 };
      default:
        return { x: 0.5, y: 0.35, scale: 0.25 };
    }
  }, [placement]);

  const isDark = useMemo(() => isColorDark(colorHex), [colorHex]);
  
  const qrArtworkUrl = useMemo(() => {
    if (isDark && qrArtworkWhiteUrl) {
      return qrArtworkWhiteUrl;
    }
    return qrArtworkBlackUrl;
  }, [isDark, qrArtworkBlackUrl, qrArtworkWhiteUrl]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    setIsLoading(true);
    setError(null);

    const baseImage = new Image();
    baseImage.crossOrigin = "anonymous";
    
    const qrImage = new Image();
    qrImage.crossOrigin = "anonymous";

    let baseLoaded = false;
    let qrLoaded = false;

    const renderMockup = () => {
      if (!baseLoaded || !qrLoaded) return;

      const width = 400;
      const height = 400;
      canvas.width = width;
      canvas.height = height;

      ctx.clearRect(0, 0, width, height);

      ctx.fillStyle = colorHex;
      ctx.fillRect(0, 0, width, height);

      ctx.globalCompositeOperation = 'luminosity';
      ctx.drawImage(baseImage, 0, 0, width, height);

      ctx.globalCompositeOperation = 'multiply';
      ctx.fillStyle = colorHex;
      ctx.fillRect(0, 0, width, height);

      ctx.globalCompositeOperation = 'source-over';

      const qrWidth = width * placementConfig.scale;
      const qrHeight = qrWidth;
      const qrX = (width * placementConfig.x) - (qrWidth / 2);
      const qrY = (height * placementConfig.y) - (qrHeight / 2);

      ctx.drawImage(qrImage, qrX, qrY, qrWidth, qrHeight);

      setIsLoading(false);
    };

    baseImage.onload = () => {
      baseLoaded = true;
      renderMockup();
    };

    baseImage.onerror = () => {
      setError("Failed to load shirt image");
      setIsLoading(false);
    };

    qrImage.onload = () => {
      qrLoaded = true;
      renderMockup();
    };

    qrImage.onerror = () => {
      setError("Failed to load QR artwork");
      setIsLoading(false);
    };

    baseImage.src = baseShirtUrl;
    qrImage.src = qrArtworkUrl;

    return () => {
      baseImage.onload = null;
      baseImage.onerror = null;
      qrImage.onload = null;
      qrImage.onerror = null;
    };
  }, [baseShirtUrl, qrArtworkUrl, colorHex, placementConfig]);

  if (error) {
    return (
      <div className={`flex items-center justify-center bg-muted rounded-lg ${className}`} style={{ aspectRatio: '1/1' }}>
        <p className="text-sm text-muted-foreground">{error}</p>
      </div>
    );
  }

  return (
    <div className={`relative ${className}`} data-testid="instant-mockup-preview">
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-muted rounded-lg">
          <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
        </div>
      )}
      <canvas
        ref={canvasRef}
        className={`w-full h-auto rounded-lg ${isLoading ? 'opacity-0' : 'opacity-100'} transition-opacity`}
        style={{ aspectRatio: '1/1' }}
        data-testid="mockup-canvas"
      />
      <div className="absolute bottom-2 left-2 right-2">
        <div 
          className="text-xs px-2 py-1 rounded text-center"
          style={{ 
            backgroundColor: isDark ? 'rgba(255,255,255,0.8)' : 'rgba(0,0,0,0.6)',
            color: isDark ? '#000' : '#fff'
          }}
        >
          {colorName} - Instant Preview
        </div>
      </div>
    </div>
  );
}
