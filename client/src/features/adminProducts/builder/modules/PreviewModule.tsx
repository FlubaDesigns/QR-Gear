import { Eye, QrCode } from "lucide-react";
import { CollapsibleModule } from "@/features/shared/components/CollapsibleModule";
import { useBuilderContext } from "../BuilderContext";
import { WARP_PRESETS } from "../types";

function TextPreview({ 
  style, 
  position 
}: { 
  style: { text: string; enabled: boolean; fontFamily: string; fontSize: string; color: string; warpPreset: string; letterSpacing: number; strokeColor: string; strokeWidth: number };
  position: "top" | "bottom";
}) {
  if (!style.enabled || !style.text) return null;

  const baseFontSize = parseInt(style.fontSize) || 144;
  const scaleFactor = 0.08;
  const fontSize = Math.max(10, Math.min(baseFontSize * scaleFactor, 20));
  
  const getWarpTransform = () => {
    if (style.warpPreset === "arc-up") {
      return "perspective(200px) rotateX(-5deg)";
    } else if (style.warpPreset === "arc-down") {
      return "perspective(200px) rotateX(5deg)";
    }
    return "none";
  };

  return (
    <div 
      className={`absolute left-0 right-0 text-center px-1 ${position === "top" ? "top-1" : "bottom-8"}`}
      style={{ transform: getWarpTransform() }}
    >
      <span 
        style={{ 
          fontFamily: style.fontFamily, 
          fontSize: `${fontSize}px`,
          color: style.color,
          letterSpacing: `${style.letterSpacing * 0.03}px`,
          textShadow: style.strokeColor && style.strokeWidth > 0 
            ? `0 0 ${Math.max(1, style.strokeWidth * 0.2)}px ${style.strokeColor}` 
            : "0 1px 2px rgba(0,0,0,0.5)",
          fontWeight: 'bold',
          whiteSpace: 'nowrap',
          display: 'inline-block',
          maxWidth: '100%',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}
      >
        {style.text}
      </span>
    </div>
  );
}

function QRCodePreview() {
  return (
    <div className="absolute inset-0 flex items-center justify-center">
      <div className="bg-white p-2 rounded-md shadow-lg">
        <div className="w-16 h-16 bg-black/10 flex items-center justify-center rounded">
          <QrCode className="w-12 h-12 text-black" />
        </div>
      </div>
    </div>
  );
}

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

        <div className="flex justify-center">
          <div 
            className="relative w-[180px] aspect-[9/16] rounded-lg overflow-hidden border-2 border-border shadow-lg"
            style={{
              background: hasBackground && backgroundUrl 
                ? `url(${backgroundUrl}) center/cover` 
                : hasVideo && videoUrl 
                  ? 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)'
                  : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            }}
          >
            {hasVideo && videoUrl && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                <div className="text-white text-xs text-center p-2">
                  <div className="w-8 h-8 mx-auto mb-1 border-2 border-white rounded-full flex items-center justify-center">
                    <div className="w-0 h-0 border-t-4 border-t-transparent border-b-4 border-b-transparent border-l-6 border-l-white ml-0.5" />
                  </div>
                  Video
                </div>
              </div>
            )}

            <TextPreview style={state.content.headerStyle} position="top" />
            
            <QRCodePreview />
            
            <TextPreview style={state.content.footerStyle} position="bottom" />

            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-2 pt-6">
              <div className="text-[10px] text-white/80 text-center space-y-0.5">
                <div className="font-semibold">{state.qrProductState?.replace("qr_", "QR ").replace("_", " ").toUpperCase()}</div>
                {state.selectedPlacements.length > 0 && (
                  <div className="text-white/60">
                    {state.selectedPlacements.length} placement{state.selectedPlacements.length > 1 ? "s" : ""}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="p-2 bg-muted/30 rounded border">
            <div className="font-medium text-muted-foreground">Header</div>
            <div className={state.content.headerStyle.enabled ? "text-foreground" : "text-muted-foreground/50"}>
              {state.content.headerStyle.enabled 
                ? state.content.headerStyle.text || "(empty)" 
                : "Disabled"}
            </div>
          </div>
          <div className="p-2 bg-muted/30 rounded border">
            <div className="font-medium text-muted-foreground">Footer</div>
            <div className={state.content.footerStyle.enabled ? "text-foreground" : "text-muted-foreground/50"}>
              {state.content.footerStyle.enabled 
                ? state.content.footerStyle.text || "(empty)" 
                : "Disabled"}
            </div>
          </div>
          {(hasBackground || hasVideo) && (
            <div className="p-2 bg-muted/30 rounded border col-span-2">
              <div className="font-medium text-muted-foreground">
                {hasVideo ? "Video" : "Background"}
              </div>
              <div className={backgroundUrl || videoUrl ? "text-foreground truncate" : "text-muted-foreground/50"}>
                {hasVideo 
                  ? (videoUrl || "No video selected")
                  : (state.loadedBackground?.name || "No background selected")}
              </div>
            </div>
          )}
        </div>
      </div>
    </CollapsibleModule>
  );
}
