import { Type } from "lucide-react";
import { CollapsibleModule } from "@/features/shared/components/CollapsibleModule";
import { TextStyleEditor, defaultTextStyle } from "@/features/shared/components/TextStyleEditor";
import { useBuilderContext } from "../BuilderContext";
import { type TextStyleConfig } from "../types";
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

  const headerStyle = state.content.headerStyle || { ...defaultTextStyle, text: "Hello", enabled: true };
  const footerStyle = state.content.footerStyle || { ...defaultTextStyle, text: "World!", enabled: true, strokeColor: "#FF0000", strokeWidth: 20 };

  const updateHeaderStyle = (updates: Partial<TextStyleConfig>) => {
    setContent({
      headerStyle: { ...headerStyle, ...updates }
    });
  };

  const updateFooterStyle = (updates: Partial<TextStyleConfig>) => {
    setContent({
      footerStyle: { ...footerStyle, ...updates }
    });
  };

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
          Add custom header and footer text with fancy styling options.
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
          maxLength={35}
          style={headerStyle}
          onChange={updateHeaderStyle}
          testIdPrefix="header"
          previewBackgroundColor={state.selectedColor?.hex}
        />
        
        <TextStyleEditor
          label="Bottom Text (Footer)"
          maxLength={40}
          style={footerStyle}
          onChange={updateFooterStyle}
          testIdPrefix="footer"
          previewBackgroundColor={state.selectedColor?.hex}
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
