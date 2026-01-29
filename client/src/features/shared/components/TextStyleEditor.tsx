import { useState } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { FontPicker } from "@/components/ui/font-picker";
import { ChevronDown, ChevronRight } from "lucide-react";
import { TextStyleViewer } from "./TextStyleViewer";

export interface TextStyleConfig {
  text: string;
  enabled: boolean;
  fontFamily: string;
  fontSize: string;
  color: string;
  warpPreset: string;
  letterSpacing: number;
  strokeColor: string;
  strokeWidth: number;
  verticalOffset: number;
  horizontalOffset: number;
}

export const FONT_FAMILIES = [
  "Arial",
  "Helvetica", 
  "Times New Roman",
  "Georgia",
  "Verdana",
  "Courier New",
  "Impact",
  "Comic Sans MS",
  "Trebuchet MS",
  "Palatino Linotype",
];

export const FONT_SIZES = ["72", "96", "120", "144", "168", "192", "216", "240", "280", "320"];

export const WARP_PRESETS = [
  { value: "straight", label: "Straight" },
  { value: "arc-up", label: "Arc Up" },
  { value: "arc-down", label: "Arc Down" },
];

export const defaultTextStyle: TextStyleConfig = {
  text: "",
  enabled: false,
  fontFamily: "Arial",
  fontSize: "144",
  color: "#FFFFFF",
  warpPreset: "straight",
  letterSpacing: 0,
  strokeColor: "",
  strokeWidth: 0,
  verticalOffset: 100,
  horizontalOffset: 100,
};

interface TextStyleEditorProps {
  label: string;
  sublabel?: string;
  maxLength: number;
  style: TextStyleConfig;
  onChange: (updates: Partial<TextStyleConfig>) => void;
  testIdPrefix: string;
  showPositionControls?: boolean;
  showPreview?: boolean;
  previewBackgroundColor?: string;
  previewBackgroundImage?: string;
  defaultCollapsed?: boolean;
}

export function TextStyleEditor({ 
  label, 
  sublabel,
  maxLength, 
  style, 
  onChange, 
  testIdPrefix,
  showPositionControls = true,
  showPreview = true,
  previewBackgroundColor,
  previewBackgroundImage,
  defaultCollapsed = true,
}: TextStyleEditorProps) {
  const [isCollapsed, setIsCollapsed] = useState(defaultCollapsed);
  const [controlsOpen, setControlsOpen] = useState(false);

  const hasContent = style.enabled && style.text;

  return (
    <div className="bg-background rounded-lg border overflow-hidden">
      <div 
        className="flex items-center justify-between min-h-[48px] px-4 py-2 cursor-pointer hover:bg-muted/30 transition-colors"
        onClick={() => setIsCollapsed(!isCollapsed)}
        data-testid={`toggle-${testIdPrefix}-collapse`}
      >
        <div className="flex items-center gap-2 min-w-0 flex-1">
          {isCollapsed ? (
            <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
          ) : (
            <ChevronDown className="h-4 w-4 text-muted-foreground flex-shrink-0" />
          )}
          <div className="min-w-0 flex-1">
            <span className="font-semibold text-base">{label}</span>
            {sublabel && (
              <span className="text-xs text-muted-foreground ml-2 hidden sm:inline">{sublabel}</span>
            )}
          </div>
          {hasContent && (
            <span className="text-xs bg-primary/20 text-primary px-2 py-0.5 rounded-full flex-shrink-0 max-w-[80px] truncate">
              {style.text.substring(0, 15)}{style.text.length > 15 ? "..." : ""}
            </span>
          )}
        </div>
        <div 
          className="min-w-[48px] min-h-[48px] flex items-center justify-center"
          onClick={(e) => e.stopPropagation()}
        >
          <Switch
            id={`${testIdPrefix}-enabled`}
            checked={style.enabled}
            onCheckedChange={(checked) => {
              onChange({ enabled: checked });
              if (checked && isCollapsed) {
                setIsCollapsed(false);
              }
            }}
            className="scale-125"
            data-testid={`switch-${testIdPrefix}`}
          />
        </div>
      </div>
      
      {!isCollapsed && style.enabled && (
        <div className="space-y-4 p-4 pt-0">
          {showPreview && (
            <TextStyleViewer 
              style={style} 
              backgroundColor={previewBackgroundColor}
              backgroundImage={previewBackgroundImage}
            />
          )}

          <textarea
            name={`${testIdPrefix}-text`}
            id={`${testIdPrefix}-text-input`}
            placeholder={`Enter ${label.toLowerCase()} (max ${maxLength} chars). Press Enter for new line.`}
            value={style.text}
            onChange={(e) => onChange({ text: e.target.value.slice(0, maxLength) })}
            maxLength={maxLength}
            inputMode="text"
            enterKeyHint="done"
            autoComplete="on"
            autoCorrect="on"
            autoCapitalize="sentences"
            spellCheck={true}
            rows={2}
            style={{ touchAction: 'manipulation' }}
            className="w-full text-base min-h-[48px] px-3 py-2 border rounded-md bg-background resize-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            data-testid={`input-${testIdPrefix}-text`}
          />

          <div 
            className="flex items-center gap-2 cursor-pointer select-none py-2 border-t border-border/50"
            onClick={() => setControlsOpen(!controlsOpen)}
            data-testid={`toggle-${testIdPrefix}-controls`}
          >
            {controlsOpen ? (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            )}
            <span className="text-sm font-medium text-muted-foreground">Style Controls</span>
          </div>

          {controlsOpen && (
            <div className="space-y-4">
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

              {showPositionControls && (
                <div className="pt-3 border-t border-border/50">
                  <p className="text-sm font-medium mb-3 text-muted-foreground">Position</p>
                  <div className="space-y-4">
                    <div>
                      <Label className="text-sm mb-1.5 block text-muted-foreground">
                        Y Position: {style.verticalOffset ?? 50}% <span className="text-xs">(0=bottom, 100=top)</span>
                      </Label>
                      <div className="min-h-[48px] flex items-center py-2">
                        <input
                          type="range"
                          min="0"
                          max="100"
                          value={style.verticalOffset ?? 50}
                          onChange={(e) => onChange({ verticalOffset: Number(e.target.value) })}
                          className="w-full h-6 accent-primary cursor-pointer"
                          style={{ touchAction: 'none' }}
                          data-testid={`slider-${testIdPrefix}-vertical`}
                        />
                      </div>
                    </div>
                    <div>
                      <Label className="text-sm mb-1.5 block text-muted-foreground">
                        X Position: {style.horizontalOffset ?? 50}% <span className="text-xs">(0=left, 100=right)</span>
                      </Label>
                      <div className="min-h-[48px] flex items-center py-2">
                        <input
                          type="range"
                          min="0"
                          max="100"
                          value={style.horizontalOffset ?? 50}
                          onChange={(e) => onChange({ horizontalOffset: Number(e.target.value) })}
                          className="w-full h-6 accent-primary cursor-pointer"
                          style={{ touchAction: 'none' }}
                          data-testid={`slider-${testIdPrefix}-horizontal`}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
