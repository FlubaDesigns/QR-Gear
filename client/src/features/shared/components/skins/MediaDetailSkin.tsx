import { Button } from "@/components/ui/button";
import { X, Image as ImageIcon, ZoomIn } from "lucide-react";

export interface MediaDetailItem {
  id: string;
  title: string;
  mediaUrl: string;
  mediaType?: "image" | "video";
  altText?: string;
  dimensions?: string;
  metadata?: Record<string, string>;
}

export interface MediaDetailSkinProps {
  item: MediaDetailItem;
  onClose: () => void;
  onAction?: (item: MediaDetailItem, action: string) => void;
  actions?: Array<{ label: string; action: string; variant?: "default" | "destructive" | "outline" }>;
}

export function MediaDetailSkin({ item, onClose, onAction, actions }: MediaDetailSkinProps) {
  const isVideo = item.mediaType === "video";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
      data-testid="overlay-media-detail"
    >
      <div
        className="relative w-[95vw] max-w-2xl max-h-[95vh] flex flex-col bg-slate-900 rounded-2xl border border-slate-700 shadow-2xl animate-in zoom-in-90 duration-200 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-3 right-3 z-10 bg-black/50 rounded-full p-1.5"
          data-testid="button-close-media-detail"
        >
          <X className="w-5 h-5 text-white" />
        </button>

        <div className="flex-1 flex items-center justify-center bg-black min-h-[300px] max-h-[70vh] overflow-hidden">
          {item.mediaUrl ? (
            isVideo ? (
              <video
                src={item.mediaUrl}
                controls
                className="max-w-full max-h-full object-contain"
                data-testid="media-video-player"
              />
            ) : (
              <img
                src={item.mediaUrl}
                alt={item.altText || item.title}
                className="max-w-full max-h-full object-contain"
                data-testid="media-image-preview"
              />
            )
          ) : (
            <ImageIcon className="w-16 h-16 text-slate-600" />
          )}
        </div>

        <div className="p-3 space-y-2">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <h3 className="text-sm font-medium text-white truncate">{item.title}</h3>
            {item.dimensions && (
              <span className="text-xs text-slate-400">{item.dimensions}</span>
            )}
          </div>

          {item.metadata && Object.keys(item.metadata).length > 0 && (
            <div className="flex flex-wrap gap-3">
              {Object.entries(item.metadata).map(([key, val]) => (
                <span key={key} className="text-[10px] text-slate-500">{key}: {val}</span>
              ))}
            </div>
          )}

          {actions && actions.length > 0 && (
            <div className="flex flex-wrap gap-2 pt-1">
              {actions.map((a) => (
                <Button
                  key={a.action}
                  variant={a.variant || "default"}
                  size="sm"
                  onClick={() => onAction?.(item, a.action)}
                  data-testid={`button-media-action-${a.action}`}
                >
                  {a.label}
                </Button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
