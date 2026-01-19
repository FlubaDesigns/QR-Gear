import { useState } from "react";
import { Type, ChevronDown, ChevronRight } from "lucide-react";
import { CollapsibleModule } from "@/features/shared/components/CollapsibleModule";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { FontPicker } from "@/components/ui/font-picker";
import { useBuilderContext } from "../BuilderContext";
import { FONT_FAMILIES, FONT_SIZES, WARP_PRESETS, type TextStyleConfig } from "../types";
import { ColorSwatchPicker, getContrastQRColor } from "@/features/shared/components/ColorSwatchPicker";
import { GraphicPreviewView } from "@/features/shared/components/skins/GraphicPreviewView";

interface TextBlockProps {
  label: string;
  maxLength: number;
  style: TextStyleConfig;
  onChange: (updates: Partial<TextStyleConfig>) => void;
  testIdPrefix: string;
  defaultOpen?: boolean;
}

function TextBlock({ label, maxLength, style, onChange, testIdPrefix, defaultOpen = false }: TextBlockProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  
  return (
    <div className="bg-background rounded-lg border">
      <div 
        className="mobile-compact-module-header flex items-center cursor-pointer select-none"
        onClick={() => setIsOpen(!isOpen)}
        data-testid={`collapsible-${testIdPrefix}`}
      >
        {isOpen ? (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        )}
        <Label className="font-semibold text-base flex-1 cursor-pointer">{label}</Label>
        <div 
          className="min-w-[48px] min-h-[48px] flex items-center justify-center"
          onClick={(e) => e.stopPropagation()}
        >
          <Switch
            id={`${testIdPrefix}-enabled`}
            checked={style.enabled}
            onCheckedChange={(checked) => onChange({ enabled: checked })}
            className="scale-125"
            data-testid={`switch-${testIdPrefix}`}
          />
        </div>
      </div>
      
      {isOpen && style.enabled && (
        <div className="mobile-compact-module-content space-y-4">
          <Input
            type="text"
            placeholder={`Enter ${label.toLowerCase()} (max ${maxLength} chars)`}
            value={style.text}
            onChange={(e) => onChange({ text: e.target.value.slice(0, maxLength) })}
            maxLength={maxLength}
            inputMode="text"
            autoComplete="off"
            autoCorrect="on"
            spellCheck={true}
            enterKeyHint="done"
            className="text-base min-h-[48px]"
            data-testid={`input-${testIdPrefix}-text`}
          />
          
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-sm mb-1.5 block text-muted-foreground">Font</Label>
              <FontPicker
                value={style.fontFamily}
                onChange={(font) => onChange({ fontFamily: font })}
                fonts={FONT_FAMILIES}
                previewText={style.text || "QR Gear"}
                data-testid={`select-${testIdPrefix}-font`}
              />
            </div>
            <div>
              <Label className="text-sm mb-1.5 block text-muted-foreground">Size</Label>
              <select
                className="w-full min-h-[48px] px-3 border rounded-md text-sm bg-background"
                value={style.fontSize}
                onChange={(e) => onChange({ fontSize: e.target.value })}
                data-testid={`select-${testIdPrefix}-size`}
              >
                {FONT_SIZES.map((size) => (
                  <option key={size} value={size}>{size}pt</option>
                ))}
              </select>
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-sm mb-1.5 block text-muted-foreground">Color</Label>
              <div className="flex gap-2">
                <input
                  type="color"
                  value={style.color}
                  onChange={(e) => onChange({ color: e.target.value })}
                  className="w-12 min-h-[48px] border rounded-md cursor-pointer"
                  data-testid={`input-${testIdPrefix}-color`}
                />
                <Input
                  value={style.color}
                  onChange={(e) => onChange({ color: e.target.value })}
                  className="flex-1 min-h-[48px] font-mono text-sm"
                  placeholder="#000000"
                />
              </div>
            </div>
            <div>
              <Label className="text-sm mb-1.5 block text-muted-foreground">Warp Style</Label>
              <select
                className="w-full min-h-[48px] px-3 border rounded-md text-sm bg-background"
                value={style.warpPreset}
                onChange={(e) => onChange({ warpPreset: e.target.value })}
                data-testid={`select-${testIdPrefix}-warp`}
              >
                {WARP_PRESETS.map((preset) => (
                  <option key={preset.value} value={preset.value}>{preset.label}</option>
                ))}
              </select>
            </div>
          </div>
          
          <div>
            <Label className="text-sm mb-1.5 block text-muted-foreground">
              Letter Spacing: {style.letterSpacing}px
            </Label>
            <div className="min-h-[48px] flex items-center py-2">
              <input
                type="range"
                min="-10"
                max="50"
                value={style.letterSpacing}
                onChange={(e) => onChange({ letterSpacing: Number(e.target.value) })}
                className="w-full h-6 accent-primary cursor-pointer"
                style={{ touchAction: 'none' }}
                data-testid={`slider-${testIdPrefix}-spacing`}
              />
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-sm mb-1.5 block text-muted-foreground">Stroke Color</Label>
              <div className="flex gap-2">
                <input
                  type="color"
                  value={style.strokeColor || "#ffffff"}
                  onChange={(e) => onChange({ strokeColor: e.target.value })}
                  className="w-12 min-h-[48px] border rounded-md cursor-pointer"
                  data-testid={`input-${testIdPrefix}-stroke-color`}
                />
                <Input
                  value={style.strokeColor}
                  onChange={(e) => onChange({ strokeColor: e.target.value })}
                  className="flex-1 min-h-[48px] font-mono text-sm"
                  placeholder="None"
                />
              </div>
            </div>
            <div>
              <Label className="text-sm mb-1.5 block text-muted-foreground">
                Stroke Width: {style.strokeWidth}px
              </Label>
              <div className="min-h-[48px] flex items-center py-2">
                <input
                  type="range"
                  min="0"
                  max="20"
                  value={style.strokeWidth}
                  onChange={(e) => onChange({ strokeWidth: Number(e.target.value) })}
                  className="w-full h-6 accent-primary cursor-pointer"
                  style={{ touchAction: 'none' }}
                  data-testid={`slider-${testIdPrefix}-stroke`}
                />
              </div>
            </div>
          </div>

          {/* Position Controls */}
          <div className="pt-3 border-t border-border/50">
            <p className="text-sm font-medium mb-3 text-muted-foreground">Position</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-sm mb-1.5 block text-muted-foreground">
                  Distance from QR: {style.verticalOffset ?? 20}%
                </Label>
                <div className="min-h-[48px] flex items-center py-2">
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={style.verticalOffset ?? 20}
                    onChange={(e) => onChange({ verticalOffset: Number(e.target.value) })}
                    className="w-full h-6 accent-primary cursor-pointer"
                    style={{ touchAction: 'none' }}
                    data-testid={`slider-${testIdPrefix}-vertical`}
                  />
                </div>
              </div>
              <div>
                <Label className="text-sm mb-1.5 block text-muted-foreground">
                  Horizontal: {style.horizontalOffset ?? 0 > 0 ? `+${style.horizontalOffset ?? 0}` : style.horizontalOffset ?? 0}%
                </Label>
                <div className="min-h-[48px] flex items-center py-2">
                  <input
                    type="range"
                    min="-50"
                    max="50"
                    value={style.horizontalOffset ?? 0}
                    onChange={(e) => onChange({ horizontalOffset: Number(e.target.value) })}
                    className="w-full h-6 accent-primary cursor-pointer"
                    style={{ touchAction: 'none' }}
                    data-testid={`slider-${testIdPrefix}-horizontal`}
                  />
                </div>
              </div>
            </div>
          </div>
          
          {style.text && (
            <div className="p-4 bg-muted/50 rounded-md border text-center overflow-hidden">
              <div 
                style={{ 
                  fontFamily: style.fontFamily, 
                  fontSize: `${Math.min(parseInt(style.fontSize) * 0.25, 48)}px`,
                  color: style.color,
                  letterSpacing: `${style.letterSpacing * 0.1}px`,
                  textShadow: style.strokeColor && style.strokeWidth > 0 
                    ? `0 0 ${style.strokeWidth}px ${style.strokeColor}` 
                    : undefined,
                  fontWeight: 'bold',
                }}
              >
                {style.text}
              </div>
              <div className="text-xs text-muted-foreground mt-2">
                Warp: {WARP_PRESETS.find(p => p.value === style.warpPreset)?.label || style.warpPreset}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function TextConfigModule() {
  const { state, setContent, setSelectedColor } = useBuilderContext();
  
  const needsTextConfig = state.qrProductState === "qr_plus" || 
                          state.qrProductState === "qr_canvas" || 
                          state.qrProductState === "qr_play" || 
                          state.qrProductState === "qr_dynamics";
  
  if (!needsTextConfig || !state.selectedProduct || !state.content) {
    return null;
  }

  const headerStyle = state.content.headerStyle || { text: "Hello", enabled: true, fontFamily: "Courier New", fontSize: "280", color: "#FFFFFF", warpPreset: "straight", letterSpacing: 0, strokeColor: "", strokeWidth: 0, verticalOffset: 50, horizontalOffset: 50 };
  const footerStyle = state.content.footerStyle || { text: "World!", enabled: true, fontFamily: "Courier New", fontSize: "280", color: "#FFFFFF", warpPreset: "straight", letterSpacing: 0, strokeColor: "#FF0000", strokeWidth: 20, verticalOffset: 50, horizontalOffset: 50 };

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
        
        <TextBlock
          label="Top Text (Header)"
          maxLength={35}
          style={headerStyle}
          onChange={updateHeaderStyle}
          testIdPrefix="header"
        />
        
        <TextBlock
          label="Bottom Text (Footer)"
          maxLength={40}
          style={footerStyle}
          onChange={updateFooterStyle}
          testIdPrefix="footer"
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
