import { Image } from "lucide-react";
import type { TextStyleConfig } from "../TextStyleEditor";

export interface LandingPageViewProps {
  titleStyle?: TextStyleConfig;
  descriptionStyle?: TextStyleConfig;
  backgroundImage?: string;
  className?: string;
}

export function LandingPageView({ 
  titleStyle,
  descriptionStyle,
  backgroundImage,
  className = "",
}: LandingPageViewProps) {
  const hasContent = !!(titleStyle?.text || descriptionStyle?.text);

  const getTextStyles = (style: TextStyleConfig) => {
    const scale = 0.08;
    const fontSize = Math.max(8, parseInt(style.fontSize) * scale);
    
    return {
      fontFamily: style.fontFamily,
      fontSize: `${fontSize}px`,
      color: style.color,
      letterSpacing: `${style.letterSpacing * 0.05}px`,
      textShadow: style.strokeColor && style.strokeWidth > 0
        ? `0 0 ${style.strokeWidth * 0.3}px ${style.strokeColor}`
        : undefined,
      fontWeight: 'bold' as const,
    };
  };

  const getPositionStyles = (style: TextStyleConfig) => {
    const y = 100 - (style.verticalOffset ?? 50);
    const x = style.horizontalOffset ?? 50;
    
    return {
      top: `${y}%`,
      left: `${x < 50 ? x * 2 : 5}%`,
      right: `${x > 50 ? (100 - x) * 2 : 5}%`,
      textAlign: (x < 40 ? 'left' : x > 60 ? 'right' : 'center') as 'left' | 'right' | 'center',
      transform: 'translateY(-50%)',
    };
  };

  return (
    <div 
      className={`relative w-[180px] aspect-[9/16] rounded-lg overflow-hidden border-2 border-border shadow-lg ${className}`}
      style={{
        background: backgroundImage 
          ? `url(${backgroundImage}) center/cover` 
          : 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
      }}
      data-testid="landing-page-view"
    >
      <div className="absolute inset-0 bg-black/30" />
      
      {titleStyle?.enabled && titleStyle.text && (
        <div 
          className="absolute px-2"
          style={getPositionStyles(titleStyle)}
        >
          <h3 
            className="drop-shadow-lg"
            style={getTextStyles(titleStyle)}
            data-testid="text-landing-title"
          >
            {titleStyle.text}
          </h3>
        </div>
      )}
      
      {descriptionStyle?.enabled && descriptionStyle.text && (
        <div 
          className="absolute px-2"
          style={getPositionStyles(descriptionStyle)}
        >
          <p 
            className="drop-shadow-md leading-tight"
            style={getTextStyles(descriptionStyle)}
            data-testid="text-landing-description"
          >
            {descriptionStyle.text}
          </p>
        </div>
      )}

      {!backgroundImage && !hasContent && (
        <div className="absolute top-1/3 left-0 right-0 text-center">
          <Image className="h-8 w-8 mx-auto text-white/30 mb-2" />
          <p className="text-white/50 text-xs">No background selected</p>
        </div>
      )}
    </div>
  );
}
