import { Type } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { CollapsibleModule } from "@/features/shared/components/CollapsibleModule";
import { useBuilderContext } from "../BuilderContext";
import { TextStyleEditor, type TextStyleConfig, defaultTextStyle } from "@/features/shared/components/TextStyleEditor";
import { GraphicPreviewView } from "@/features/shared/components/skins/GraphicPreviewView";

const headerDefaultStyle: TextStyleConfig = { ...defaultTextStyle, text: "", enabled: false };
const footerDefaultStyle: TextStyleConfig = { ...defaultTextStyle, text: "", enabled: false };

export function ProductGraphicTextModule() {
  const { state, setContent } = useBuilderContext();

  const showGraphicText = state.qrProductState === "qr_plus" ||
                          state.qrProductState === "qr_canvas" || 
                          state.qrProductState === "qr_play" || 
                          state.qrProductState === "qr_dynamics";

  if (!showGraphicText || !state.selectedProduct || !state.content) {
    return null;
  }

  return (
    <CollapsibleModule
      title="Product Graphic Text"
      icon={<Type className="h-4 w-4" />}
      className="bg-muted/30"
      defaultOpen
    >
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Add styled text to the top or bottom of your product graphic (+$2 per line)
        </p>

        <TextStyleEditor
          label="Top Text"
          sublabel="Appears at top of graphic"
          maxLength={30}
          style={(state.content.headerStyle as TextStyleConfig) || headerDefaultStyle}
          onChange={(updates) => setContent({ 
            headerStyle: { 
              ...((state.content.headerStyle as TextStyleConfig) || headerDefaultStyle), 
              ...updates 
            } 
          })}
          testIdPrefix="header"
          showPositionControls={true}
          previewBackgroundColor={state.selectedColor?.hex || '#1a1a2e'}
        />
        
        <TextStyleEditor
          label="Bottom Text"
          sublabel="Appears at bottom of graphic"
          maxLength={30}
          style={(state.content.footerStyle as TextStyleConfig) || footerDefaultStyle}
          onChange={(updates) => setContent({ 
            footerStyle: { 
              ...((state.content.footerStyle as TextStyleConfig) || footerDefaultStyle), 
              ...updates 
            } 
          })}
          testIdPrefix="footer"
          showPositionControls={true}
          previewBackgroundColor={state.selectedColor?.hex || '#1a1a2e'}
        />
        
        {((state.content.headerStyle as TextStyleConfig)?.enabled || (state.content.footerStyle as TextStyleConfig)?.enabled) && (
          <div className="mt-4 pt-4 border-t flex flex-col items-center">
            <p className="text-xs text-muted-foreground mb-2">Product Graphic Preview</p>
            <GraphicPreviewView
              backgroundColor={state.selectedColor?.hex || '#1a1a2e'}
              headerStyle={(state.content.headerStyle as TextStyleConfig) || headerDefaultStyle}
              footerStyle={(state.content.footerStyle as TextStyleConfig) || footerDefaultStyle}
              showQRCode={true}
              aspectRatio="square"
            />
            <p className="text-xs text-muted-foreground mt-2 text-center">
              This is how your product graphic will appear
            </p>
          </div>
        )}
      </div>
    </CollapsibleModule>
  );
}
