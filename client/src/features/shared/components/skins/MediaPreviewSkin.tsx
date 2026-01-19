import { Play, Image, X } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface MediaPreviewSkinProps {
  mediaUrl?: string;
  mimeType?: string;
  onClear?: () => void;
  className?: string;
}

export function MediaPreviewSkin({
  mediaUrl,
  mimeType,
  onClear,
  className = "",
}: MediaPreviewSkinProps) {
  const isVideo = mimeType?.startsWith("video/");

  if (!mediaUrl) {
    return (
      <div 
        className={`border-2 border-dashed border-muted-foreground/30 rounded-lg p-8 text-center ${className}`}
        data-testid="media-preview-empty"
      >
        <div className="flex flex-col items-center gap-2 text-muted-foreground">
          {isVideo !== false ? (
            <Play className="h-8 w-8" />
          ) : (
            <Image className="h-8 w-8" />
          )}
          <p className="text-sm">No media selected</p>
        </div>
      </div>
    );
  }

  return (
    <div 
      className={`relative rounded-lg overflow-hidden border ${className}`}
      data-testid="media-preview-skin"
    >
      {isVideo ? (
        <video
          src={mediaUrl}
          controls
          playsInline
          preload="metadata"
          className="w-full max-h-[200px] object-contain bg-black"
          data-testid="media-video"
        />
      ) : (
        <img
          src={mediaUrl}
          alt="Media preview"
          className="w-full max-h-[200px] object-contain"
          data-testid="media-image"
        />
      )}
      
      {onClear && (
        <Button
          type="button"
          variant="destructive"
          size="icon"
          className="absolute top-2 right-2 h-8 w-8"
          onClick={onClear}
          data-testid="button-clear-media"
        >
          <X className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
}
