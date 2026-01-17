import { Type } from "lucide-react";
import { CollapsibleModule } from "@/features/shared/components/CollapsibleModule";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { FontPicker } from "@/components/ui/font-picker";
import { useBuilderContext } from "../BuilderContext";
import { FONT_FAMILIES, FONT_SIZES, WARP_PRESETS, type TextStyleConfig } from "../types";

interface TextBlockProps {
  label: string;
  maxLength: number;
  style: TextStyleConfig;
  onChange: (updates: Partial<TextStyleConfig>) => void;
  testIdPrefix: string;
}

function TextBlock({ label, maxLength, style, onChange, testIdPrefix }: TextBlockProps) {
  return (
    <div className="space-y-3 p-4 bg-background rounded-lg border">
      <div className="flex items-center justify-between min-h-[48px]">
        <Label htmlFor={`${testIdPrefix}-enabled`} className="font-semibold text-base">
          {label}
        </Label>
        <div className="min-w-[48px] min-h-[48px] flex items-center justify-center">
          <Switch
            id={`${testIdPrefix}-enabled`}
            checked={style.enabled}
            onCheckedChange={(checked) => onChange({ enabled: checked })}
            className="scale-125"
            data-testid={`switch-${testIdPrefix}`}
          />
        </div>
      </div>
      
      {style.enabled && (
        <div className="space-y-4">
          <Input
            placeholder={`Enter ${label.toLowerCase()} (max ${maxLength} chars)`}
            value={style.text}
            onChange={(e) => onChange({ text: e.target.value.slice(0, maxLength) })}
            maxLength={maxLength}
            inputMode="text"
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
  const { state, setContent } = useBuilderContext();
  
  const needsTextConfig = state.qrProductState === "qr_plus" || 
                          state.qrProductState === "qr_canvas" || 
                          state.qrProductState === "qr_play" || 
                          state.qrProductState === "qr_dynamics";
  
  if (!needsTextConfig || !state.selectedProduct) {
    return null;
  }

  const updateHeaderStyle = (updates: Partial<TextStyleConfig>) => {
    setContent({
      headerStyle: { ...state.content.headerStyle, ...updates }
    });
  };

  const updateFooterStyle = (updates: Partial<TextStyleConfig>) => {
    setContent({
      footerStyle: { ...state.content.footerStyle, ...updates }
    });
  };

  return (
    <CollapsibleModule
      title="Text Options"
      icon={<Type className="h-4 w-4" />}
      className="bg-muted/30"
      defaultOpen
    >
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Add custom header and footer text with fancy styling options.
        </p>
        
        <TextBlock
          label="Top Text (Header)"
          maxLength={35}
          style={state.content.headerStyle}
          onChange={updateHeaderStyle}
          testIdPrefix="header"
        />
        
        <TextBlock
          label="Bottom Text (Footer)"
          maxLength={40}
          style={state.content.footerStyle}
          onChange={updateFooterStyle}
          testIdPrefix="footer"
        />

        {(state.content.headerStyle.enabled || state.content.footerStyle.enabled) && (
          <div className="p-3 bg-primary/5 rounded-md border">
            <p className="text-sm font-medium">Text Configuration</p>
            <p className="text-xs text-muted-foreground">
              {state.content.headerStyle.enabled && state.content.headerStyle.text && 
                `Header: "${state.content.headerStyle.text}"`}
              {state.content.headerStyle.enabled && state.content.headerStyle.text && 
               state.content.footerStyle.enabled && state.content.footerStyle.text && " • "}
              {state.content.footerStyle.enabled && state.content.footerStyle.text && 
                `Footer: "${state.content.footerStyle.text}"`}
            </p>
          </div>
        )}
      </div>
    </CollapsibleModule>
  );
}
