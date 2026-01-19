import { LandingPageView } from "./skins/LandingPageView";

export interface LandingPageViewerProps {
  title?: string;
  description?: string;
  backgroundImage?: string;
  className?: string;
  caption?: string;
}

export function LandingPageViewer({ 
  title,
  description,
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
