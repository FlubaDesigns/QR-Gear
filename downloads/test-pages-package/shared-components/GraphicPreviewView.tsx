import { QrCode } from "lucide-react";

interface TextOverlay {
  text: string;
  enabled: boolean;
  fontFamily: string;
  fontSize: string;
  color: string;
  warpPreset: string;
  letterSpacing: number;
  strokeColor: string;
  strokeWidth: number;
  verticalOffset?: number;
  horizontalOffset?: number;
}

export interface GraphicPreviewViewProps {
  backgroundColor?: string;
  backgroundImage?: string;
  headerStyle?: TextOverlay;
  footerStyle?: TextOverlay;
  showQRCode?: boolean;
  aspectRatio?: "square" | "portrait";
  className?: string;
}

function TextOverlayDisplay({ 
  style, 
  position 
}: { 
  style: TextOverlay;
  position: "top" | "bottom";
}) {
  if (!style.enabled || !style.text) return null;

  const baseFontSize = parseInt(style.fontSize) || 144;
  const scaleFactor = 0.08;
  const fontSize = Math.max(10, Math.min(baseFontSize * scaleFactor, 20));
  
  const getWarpTransform = () => {
    if (style.warpPreset === "arc-up") {
      return "perspective(200px) rotateX(-5deg)";
    } else if (style.warpPreset === "arc-down") {
      return "perspective(200px) rotateX(5deg)";
    }
    return "none";
  };

  const verticalOffset = style.verticalOffset ?? 20;
  const horizontalOffset = style.horizontalOffset ?? 0;

  return (
    <div 
      className="absolute left-0 right-0 text-center px-1"
      style={{ 
        transform: getWarpTransform(),
        [position === "top" ? "top" : "bottom"]: `${verticalOffset * 0.5}%`,
        marginLeft: `${horizontalOffset}%`,
      }}
    >
      <span 
        style={{ 
          fontFamily: style.fontFamily, 
          fontSize: `${fontSize}px`,
          color: style.color,
          letterSpacing: `${style.letterSpacing * 0.03}px`,
          textShadow: style.strokeColor && style.strokeWidth > 0 
            ? `0 0 ${Math.max(1, style.strokeWidth * 0.2)}px ${style.strokeColor}` 
            : "0 1px 2px rgba(0,0,0,0.5)",
          fontWeight: 'bold',
          whiteSpace: 'nowrap',
          display: 'inline-block',
          maxWidth: '100%',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}
      >
        {style.text}
      </span>
    </div>
  );
}

function SampleQRCode({ bgColor }: { bgColor?: string }) {
  // If dark background, use white QR. If light background, use black QR.
  const isDark = bgColor ? getLuminance(bgColor) < 0.5 : true;
  const qrColor = isDark ? "text-white" : "text-black";
  
  return (
    <div className="absolute inset-0 flex items-center justify-center">
      <div className="w-14 h-14 flex items-center justify-center">
        <QrCode className={`w-12 h-12 ${qrColor}`} />
      </div>
    </div>
  );
}

function getLuminance(hex: string): number {
  const rgb = hex.replace("#", "").match(/.{2}/g);
  if (!rgb) return 0;
  const [r, g, b] = rgb.map((c) => parseInt(c, 16) / 255);
  const toLinear = (c: number) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
}

export function GraphicPreviewView({
  backgroundColor = '#1a1a2e',
  backgroundImage,
  headerStyle,
  footerStyle,
  showQRCode = true,
  aspectRatio = "square",
  className = "",
}: GraphicPreviewViewProps) {
  const aspectClass = aspectRatio === "portrait" ? "aspect-[9/16]" : "aspect-square";
  
  const getBackground = () => {
    if (backgroundImage) {
      return `url(${backgroundImage}) center/cover`;
    }
    return backgroundColor;
  };

  return (
    <div 
      className={`relative w-[160px] ${aspectClass} rounded-lg overflow-hidden border-2 border-border shadow-lg ${className}`}
      style={{ background: getBackground() }}
      data-testid="graphic-preview-view"
    >
      {headerStyle && (
        <TextOverlayDisplay style={headerStyle} position="top" />
      )}
      
      {showQRCode && <SampleQRCode bgColor={backgroundColor} />}
      
      {footerStyle && (
        <TextOverlayDisplay style={footerStyle} position="bottom" />
      )}
    </div>
  );
}
