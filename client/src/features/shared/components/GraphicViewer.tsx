import { QrCode } from "lucide-react";
import { DEFAULT_FONT_SIZE_NUM } from "./TextStyleEditor";

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
}

interface GraphicViewerProps {
  backgroundColor?: string;
  backgroundImage?: string;
  headerStyle?: TextOverlay;
  footerStyle?: TextOverlay;
  showQRCode?: boolean;
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

  const baseFontSize = parseInt(style.fontSize) || DEFAULT_FONT_SIZE_NUM;
  const scaleFactor = 0.35;
  const fontSize = Math.max(8, Math.min(baseFontSize * scaleFactor, 28));
  
  const getWarpTransform = () => {
    if (style.warpPreset === "arc-up") {
      return "perspective(200px) rotateX(-5deg)";
    } else if (style.warpPreset === "arc-down") {
      return "perspective(200px) rotateX(5deg)";
    }
    return "none";
  };

  return (
    <div 
      className={`absolute left-0 right-0 text-center px-1 ${position === "top" ? "top-1" : "bottom-1"}`}
      style={{ transform: getWarpTransform() }}
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

function SampleQRCode() {
  return (
    <div className="absolute inset-0 flex items-center justify-center">
      <div className="bg-white p-2 rounded-md shadow-lg">
        <div className="w-16 h-16 bg-black/10 flex items-center justify-center rounded">
          <QrCode className="w-12 h-12 text-black" />
        </div>
      </div>
    </div>
  );
}

export function GraphicViewer({
  backgroundColor = '#1a1a2e',
  backgroundImage,
  headerStyle,
  footerStyle,
  showQRCode = true,
  className = "",
}: GraphicViewerProps) {
  const getBackground = () => {
    if (backgroundImage) {
      return `url(${backgroundImage}) center/cover`;
    }
    return backgroundColor;
  };

  return (
    <div 
      className={`relative w-[180px] aspect-[9/16] rounded-lg overflow-hidden border-2 border-border shadow-lg ${className}`}
      style={{ background: getBackground() }}
    >
      {headerStyle && (
        <TextOverlayDisplay style={headerStyle} position="top" />
      )}
      
      {showQRCode && <SampleQRCode />}
      
      {footerStyle && (
        <TextOverlayDisplay style={footerStyle} position="bottom" />
      )}
    </div>
  );
}
