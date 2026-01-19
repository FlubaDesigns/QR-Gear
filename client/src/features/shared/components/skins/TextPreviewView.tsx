interface TextStyle {
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

export interface TextPreviewViewProps {
  style: TextStyle;
  backgroundColor?: string;
  backgroundImage?: string;
  className?: string;
}

export function TextPreviewView({ 
  style, 
  backgroundColor = '#1a1a2e',
  backgroundImage,
  className = "",
}: TextPreviewViewProps) {
  if (!style.enabled || !style.text) {
    return (
      <div 
        className={`w-full h-24 rounded-lg border-2 border-dashed border-border flex items-center justify-center ${className}`}
        style={{ 
          backgroundColor,
          backgroundImage: backgroundImage ? `url(${backgroundImage})` : undefined,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
        data-testid="text-preview-empty"
      >
        <span className="text-muted-foreground text-sm">Enter text to preview</span>
      </div>
    );
  }

  const baseFontSize = parseInt(style.fontSize) || 144;
  const scaleFactor = 0.15;
  const fontSize = Math.max(12, Math.min(baseFontSize * scaleFactor, 36));
  
  const getWarpTransform = () => {
    if (style.warpPreset === "arc-up") {
      return "perspective(200px) rotateX(-5deg)";
    } else if (style.warpPreset === "arc-down") {
      return "perspective(200px) rotateX(5deg)";
    }
    return "none";
  };

  const textShadow = style.strokeWidth > 0 && style.strokeColor
    ? `0 0 ${style.strokeWidth}px ${style.strokeColor}, 0 0 ${style.strokeWidth * 2}px ${style.strokeColor}`
    : undefined;

  return (
    <div 
      className={`w-full h-24 rounded-lg overflow-hidden border-2 border-border flex items-center justify-center ${className}`}
      style={{ 
        backgroundColor,
        backgroundImage: backgroundImage ? `url(${backgroundImage})` : undefined,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}
      data-testid="text-preview-view"
    >
      <span 
        style={{ 
          fontFamily: style.fontFamily, 
          fontSize: `${fontSize}px`,
          color: style.color,
          letterSpacing: `${style.letterSpacing}px`,
          textShadow,
          transform: getWarpTransform(),
          whiteSpace: 'nowrap',
        }}
      >
        {style.text}
      </span>
    </div>
  );
}
