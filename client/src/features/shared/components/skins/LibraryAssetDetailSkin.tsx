import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Image, X } from "lucide-react";

export interface LibraryAssetDetailItem {
  id: string;
  title: string;
  previewUrl: string | null;
  assetType?: string;
  metadata?: Record<string, string>;
  createdAt?: string;
  dimensions?: string;
}

export interface LibraryAssetDetailSkinProps {
  item: LibraryAssetDetailItem;
  onClose: () => void;
  onAction?: (item: LibraryAssetDetailItem, action: string) => void;
  actions?: Array<{ label: string; action: string; variant?: "default" | "destructive" | "outline" }>;
}

export function LibraryAssetDetailSkin({ item, onClose, onAction, actions }: LibraryAssetDetailSkinProps) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
      data-testid="overlay-library-asset-detail"
    >
      <div
        className="relative w-[90vw] max-w-lg max-h-[90vh] overflow-y-auto bg-slate-900 rounded-2xl border border-slate-700 shadow-2xl animate-in zoom-in-90 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-3 right-3 z-10 bg-black/50 rounded-full p-1.5"
          data-testid="button-close-library-detail"
        >
          <X className="w-5 h-5 text-white" />
        </button>

        <div className="bg-muted rounded-t-2xl flex items-center justify-center min-h-[250px] p-4">
          {item.previewUrl ? (
            <img src={item.previewUrl} alt={item.title} className="max-h-[50vh] w-auto object-contain" />
          ) : (
            <Image className="w-16 h-16 text-muted-foreground" />
          )}
        </div>

        <div className="p-4 space-y-3">
          <h3 className="text-lg font-bold text-white">{item.title}</h3>

          <div className="flex flex-wrap gap-2 items-center">
            {item.assetType && (
              <Badge variant="secondary" className="text-xs">{item.assetType}</Badge>
            )}
            {item.dimensions && (
              <span className="text-xs text-slate-400">{item.dimensions}</span>
            )}
            {item.createdAt && (
              <span className="text-xs text-slate-500">{item.createdAt}</span>
            )}
          </div>

          {item.metadata && Object.keys(item.metadata).length > 0 && (
            <div className="space-y-1">
              {Object.entries(item.metadata).map(([key, val]) => (
                <div key={key} className="flex justify-between text-xs">
                  <span className="text-slate-500">{key}</span>
                  <span className="text-slate-300">{val}</span>
                </div>
              ))}
            </div>
          )}

          {actions && actions.length > 0 && (
            <div className="flex flex-wrap gap-2 pt-2">
              {actions.map((a) => (
                <Button
                  key={a.action}
                  variant={a.variant || "default"}
                  size="sm"
                  onClick={() => onAction?.(item, a.action)}
                  data-testid={`button-asset-action-${a.action}`}
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
