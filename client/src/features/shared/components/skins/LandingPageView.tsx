import { Image, Loader2 } from "lucide-react";
import type { TextStyleConfig } from "../TextStyleEditor";
import { useLandingPagePreview } from "@/hooks/useLandingPagePreview";
import type { LandingPageTextStyle } from "@/features/shared/graphics/landingPageRenderer";

export interface LandingPageViewProps {
  titleStyle?: TextStyleConfig;
  descriptionStyle?: TextStyleConfig;
  backgroundImage?: string;
  className?: string;
}

function toRendererStyle(style?: TextStyleConfig): LandingPageTextStyle | null {
  if (!style || !style.enabled || !style.text) return null;
  return {
    text: style.text,
    enabled: style.enabled,
    fontFamily: style.fontFamily,
    fontSize: style.fontSize,
    color: style.color,
    letterSpacing: style.letterSpacing,
    strokeColor: style.strokeColor,
    strokeWidth: style.strokeWidth,
    verticalOffset: style.verticalOffset,
    horizontalOffset: style.horizontalOffset,
  };
}

export function LandingPageView({ 
  titleStyle,
  descriptionStyle,
  backgroundImage,
  className = "",
}: LandingPageViewProps) {
  const hasContent = !!(titleStyle?.text || descriptionStyle?.text || backgroundImage);

  const { dataUrl, isLoading } = useLandingPagePreview({
    backgroundUrl: backgroundImage || null,
    titleStyle: toRendererStyle(titleStyle),
    descriptionStyle: toRendererStyle(descriptionStyle),
    enabled: hasContent,
  });

  return (
    <div 
      className={`relative w-[180px] aspect-[9/16] rounded-lg overflow-hidden border-2 border-border shadow-lg ${className}`}
      data-testid="landing-page-view"
    >
      {dataUrl ? (
        <img
          src={dataUrl}
          alt="Landing page preview"
          className="w-full h-full object-contain"
          data-testid="img-landing-preview"
        />
      ) : isLoading ? (
        <div className="absolute inset-0 flex items-center justify-center bg-black/50">
          <Loader2 className="h-6 w-6 animate-spin text-white/60" />
        </div>
      ) : (
        <div 
          className="absolute inset-0"
          style={{
            background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
          }}
        >
          <div className="absolute top-1/3 left-0 right-0 text-center">
            <Image className="h-8 w-8 mx-auto text-white/30 mb-2" />
            <p className="text-white/50 text-xs">No background selected</p>
          </div>
        </div>
      )}
    </div>
  );
}
