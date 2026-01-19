import { Eye } from "lucide-react";
import { CollapsibleModule } from "@/features/shared/components/CollapsibleModule";
import { GraphicViewer } from "@/features/shared/components/GraphicViewer";
import { useBuilderContext } from "../BuilderContext";

export function PreviewModule() {
  const { state } = useBuilderContext();

  const needsPreview = state.qrProductState === "qr_plus" || 
                       state.qrProductState === "qr_canvas" || 
                       state.qrProductState === "qr_play" || 
                       state.qrProductState === "qr_dynamics";
  
  if (!needsPreview || !state.selectedProduct) {
    return null;
  }

  const hasBackground = state.qrProductState === "qr_canvas" || state.qrProductState === "qr_dynamics";
  const hasVideo = state.qrProductState === "qr_play";
  const backgroundUrl = state.loadedBackground?.url;
  const videoUrl = state.content.videoUrl;
  const swatchColor = state.selectedColor?.hex || '#1a1a2e';

  return (
    <CollapsibleModule
      title="Preview"
      icon={<Eye className="h-4 w-4" />}
      className="bg-muted/30"
      defaultOpen
    >
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">
          Live preview of your QR product composite
        </p>

        {state.selectedColor && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <div 
              className="w-4 h-4 rounded-full border border-border shadow-sm"
              style={{ backgroundColor: swatchColor }}
            />
            <span>Swatch: {state.selectedColor.name || swatchColor}</span>
          </div>
        )}

        <div className="flex justify-center">
          <GraphicViewer
            backgroundColor={swatchColor}
            backgroundImage={hasBackground ? backgroundUrl : undefined}
            headerStyle={state.content.headerStyle}
            footerStyle={state.content.footerStyle}
            showQRCode={true}
          />
        </div>

        {hasVideo && videoUrl && (
          <div className="p-2 bg-muted/30 rounded border text-xs">
            <div className="font-medium text-muted-foreground">Video</div>
            <div className="text-foreground truncate">{videoUrl}</div>
          </div>
        )}

        {hasBackground && (
          <div className="p-2 bg-muted/30 rounded border text-xs">
            <div className="font-medium text-muted-foreground">Background</div>
            <div className={backgroundUrl ? "text-foreground truncate" : "text-muted-foreground/50"}>
              {state.loadedBackground?.name || "No background selected"}
            </div>
          </div>
        )}

        {(state.content.title || state.content.description) && (
          <div className="mt-4 pt-4 border-t">
            <p className="text-sm font-medium mb-3 flex items-center gap-2">
              <span className="text-purple-600 dark:text-purple-400">Landing Page Preview</span>
            </p>
            <div 
              className="p-4 rounded-lg border-2 border-purple-200 dark:border-purple-800 bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-950/30 dark:to-pink-950/30"
            >
              {state.content.title && (
                <h3 className="text-lg font-bold text-purple-900 dark:text-purple-100 mb-2">
                  {state.content.title}
                </h3>
              )}
              {state.content.description && (
                <p className="text-sm text-purple-700 dark:text-purple-300">
                  {state.content.description}
                </p>
              )}
              <div className="mt-3 pt-3 border-t border-purple-200 dark:border-purple-700">
                <p className="text-xs text-purple-500 dark:text-purple-400">
                  URL will be auto-generated when you create graphics
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </CollapsibleModule>
  );
}
