import { TextPreviewView } from "./skins/TextPreviewView";
import type { TextStyleConfig } from "./TextStyleEditor";

export interface TextStyleViewerProps {
  style: TextStyleConfig;
  backgroundColor?: string;
  backgroundImage?: string;
  className?: string;
  showLabel?: boolean;
  label?: string;
}

export function TextStyleViewer({ 
  style, 
  backgroundColor,
  backgroundImage,
  className = "",
  showLabel = true,
  label = "Live Preview",
}: TextStyleViewerProps) {
  return (
    <div className={`space-y-2 ${className}`}>
      {showLabel && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span>{label}</span>
        </div>
      )}
      <TextPreviewView 
        style={style} 
        backgroundColor={backgroundColor}
        backgroundImage={backgroundImage}
      />
    </div>
  );
}
