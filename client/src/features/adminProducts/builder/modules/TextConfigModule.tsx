import { Type } from "lucide-react";
import { CollapsibleModule } from "@/features/shared/components/CollapsibleModule";
import { useBuilderContext } from "../BuilderContext";
import { TextStyleEditor, defaultTextStyle, type TextStyleConfig } from "@/features/shared/components/TextStyleEditor";
import { ColorSwatchPicker, getContrastQRColor } from "@/features/shared/components/ColorSwatchPicker";
import { GraphicPreviewView } from "@/features/shared/components/skins/GraphicPreviewView";

export function TextConfigModule() {
  const { state, setContent, setSelectedColor } = useBuilderContext();
  
  const needsTextConfig = state.qrProductState === "qr_plus" || 
                          state.qrProductState === "qr_canvas" || 
                          state.qrProductState === "qr_play" || 
                          state.qrProductState === "qr_dynamics";
  
  if (!needsTextConfig || !state.selectedProduct || !state.content) {
    return null;
  }

  const headerStyle = (state.content.headerStyle as TextStyleConfig) || defaultTextStyle;
  const footerStyle = (state.content.footerStyle as TextStyleConfig) || defaultTextStyle;

  const hasAnyText = (headerStyle.enabled && headerStyle.text) || 
                     (footerStyle.enabled && footerStyle.text);

  return (
    <CollapsibleModule
      title="Product Text"
      icon={<Type className="h-4 w-4" />}
      className="bg-muted/30"
      defaultOpen
    >
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Add custom header and footer text with styling options.
        </p>

        {/* Product Color Selection */}
        {(state.selectedProduct as any)?.availableColors?.length > 0 && (
          <div className="p-4 bg-background rounded-lg border space-y-3">
            <ColorSwatchPicker
              label="Product Color (for preview)"
              colors={(state.selectedProduct as any).availableColors}
              selectedColor={state.selectedColor?.hex || null}
              onChange={(color) => setSelectedColor(color)}
              testIdPrefix="product-color"
            />
            {state.selectedColor && (
              <p className="text-xs text-muted-foreground">
                QR will use <strong>{getContrastQRColor(state.selectedColor.hex)}</strong> for best contrast
              </p>
            )}
          </div>
        )}
        
        <TextStyleEditor
          label="Top Text (Header)"
          sublabel="Appears above QR code"
          maxLength={35}
          style={headerStyle}
          onChange={(updates) => setContent({ 
            headerStyle: { ...headerStyle, ...updates } 
          })}
          testIdPrefix="header"
          showPositionControls={true}
          previewBackgroundColor={state.selectedColor?.hex || '#1a1a2e'}
        />
        
        <TextStyleEditor
          label="Bottom Text (Footer)"
          sublabel="Appears below QR code"
          maxLength={40}
          style={footerStyle}
          onChange={(updates) => setContent({ 
            footerStyle: { ...footerStyle, ...updates } 
          })}
          testIdPrefix="footer"
          showPositionControls={true}
          previewBackgroundColor={state.selectedColor?.hex || '#1a1a2e'}
        />

        {/* Combined Text Preview */}
        {hasAnyText && (
          <div className="mt-4 pt-4 border-t">
            <p className="text-sm font-medium mb-3 text-muted-foreground">Graphic Preview</p>
            <div className="flex justify-center">
              <GraphicPreviewView
                backgroundColor={state.selectedColor?.hex || '#ffffff'}
                headerStyle={headerStyle.enabled ? headerStyle : undefined}
                footerStyle={footerStyle.enabled ? footerStyle : undefined}
                showQRCode={true}
                aspectRatio="square"
              />
            </div>
          </div>
        )}
      </div>
    </CollapsibleModule>
  );
}
