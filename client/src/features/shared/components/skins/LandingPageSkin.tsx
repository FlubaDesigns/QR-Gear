import { Image } from "lucide-react";

export interface LandingPageSkinProps {
  title?: string;
  description?: string;
  backgroundImage?: string;
  className?: string;
}

export function LandingPageSkin({ 
  title,
  description,
  backgroundImage,
  className = "",
}: LandingPageSkinProps) {
  const hasContent = !!(title || description);

  return (
    <div 
      className={`relative w-[180px] aspect-[9/16] rounded-lg overflow-hidden border-2 border-border shadow-lg ${className}`}
      style={{
        background: backgroundImage 
          ? `url(${backgroundImage}) center/cover` 
          : 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
      }}
      data-testid="landing-page-skin"
    >
      <div className="absolute inset-0 bg-black/30" />
      
      <div className="absolute inset-0 flex flex-col justify-end p-3">
        {title && (
          <h3 className="text-white text-sm font-bold mb-1 drop-shadow-lg" data-testid="text-landing-title">
            {title}
          </h3>
        )}
        {description && (
          <p className="text-white/90 text-xs leading-tight drop-shadow-md line-clamp-3" data-testid="text-landing-description">
            {description}
          </p>
        )}
      </div>

      {!backgroundImage && !hasContent && (
        <div className="absolute top-1/3 left-0 right-0 text-center">
          <Image className="h-8 w-8 mx-auto text-white/30 mb-2" />
          <p className="text-white/50 text-xs">No background selected</p>
        </div>
      )}
    </div>
  );
}
