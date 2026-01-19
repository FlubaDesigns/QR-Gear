import { LandingPageView } from "./skins/LandingPageView";
import type { TextStyleConfig } from "./TextStyleEditor";

export interface LandingPageViewerProps {
  title?: string;
  description?: string;
  titleStyle?: TextStyleConfig;
  descriptionStyle?: TextStyleConfig;
  backgroundImage?: string;
  className?: string;
  caption?: string;
}

export function LandingPageViewer({ 
  title,
  description,
  titleStyle,
  descriptionStyle,
  backgroundImage,
  className = "",
  caption,
}: LandingPageViewerProps) {
  return (
    <div className={`space-y-3 ${className}`}>
      <div className="flex justify-center">
        <LandingPageView
          title={title}
          description={description}
          titleStyle={titleStyle}
          descriptionStyle={descriptionStyle}
          backgroundImage={backgroundImage}
        />
      </div>
      {caption && (
        <p className="text-xs text-center text-muted-foreground">
          {caption}
        </p>
      )}
    </div>
  );
}
