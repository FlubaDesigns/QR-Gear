import { useState } from "react";
import { Type, Palette, Move, Maximize2, ChevronDown, ChevronUp, Eye, EyeOff, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";

export type TextBackdrop = "off" | "soft" | "strong";

export type TextLayerConfig = {
  id: string;
  label: string;
  text: string;
  x: number;
  y: number;
  width: number;
  fontSize: number;
  color: string;
  fontFamily?: string;
  fontWeight?: number;
  textAlign?: "left" | "center" | "right";
  visible: boolean;
  backdrop?: TextBackdrop;
};

export const defaultTextLayer = (id: string, label: string): TextLayerConfig => ({
  id,
  label,
  text: "",
  x: 50,
  y: 50,
  width: 80,
  fontSize: 24,
  color: "#FFFFFF",
  fontFamily: "Inter",
  fontWeight: 600,
  textAlign: "center",
  visible: true,
  backdrop: "off",
});

type ControlMode = "size" | "color" | "position" | "width" | "backdrop" | null;

interface CanvasTextLayerProps {
  layer: TextLayerConfig;
  onChange: (layer: TextLayerConfig) => void;
  onRemove?: () => void;
  compact?: boolean;
  className?: string;
}

export function CanvasTextLayer({ 
  layer, 
  onChange, 
  onRemove,
  compact = false,
  className 
}: CanvasTextLayerProps) {
  const [activeControl, setActiveControl] = useState<ControlMode>(null);
  const [isExpanded, setIsExpanded] = useState(!compact);

  function update<K extends keyof TextLayerConfig>(key: K, value: TextLayerConfig[K]) {
    onChange({ ...layer, [key]: value });
  }

  function toggleControl(mode: ControlMode) {
    setActiveControl(activeControl === mode ? null : mode);
  }

  const controlButtons = [
    { mode: "size" as ControlMode, icon: Type, label: "Size" },
    { mode: "color" as ControlMode, icon: Palette, label: "Color" },
    { mode: "position" as ControlMode, icon: Move, label: "Pos" },
    { mode: "width" as ControlMode, icon: Maximize2, label: "Width" },
    { mode: "backdrop" as ControlMode, icon: Square, label: "BG" },
  ];

  return (
    <div className={cn(
      "rounded-lg border bg-card transition-all",
      !layer.visible && "opacity-50",
      className
    )}>
      <div 
        className="flex items-center gap-2 p-3 cursor-pointer"
        onClick={() => compact && setIsExpanded(!isExpanded)}
      >
        <Button
          size="icon"
          variant="ghost"
          className="h-7 w-7 shrink-0"
          onClick={(e) => {
            e.stopPropagation();
            update("visible", !layer.visible);
          }}
          data-testid={`toggle-visibility-${layer.id}`}
        >
          {layer.visible ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
        </Button>
        
        <span className="text-sm font-medium flex-1">{layer.label}</span>
        
        {compact && (
          <Button size="icon" variant="ghost" className="h-7 w-7">
            {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </Button>
        )}
      </div>

      {(!compact || isExpanded) && (
        <div className="px-3 pb-3 space-y-3">
          <Input
            value={layer.text}
            onChange={(e) => update("text", e.target.value)}
            placeholder={`Enter ${layer.label.toLowerCase()}...`}
            className="text-sm"
            data-testid={`input-text-${layer.id}`}
          />

          <div className="flex gap-1">
            {controlButtons.map(({ mode, icon: Icon, label }) => (
              <Button
                key={mode}
                size="sm"
                variant={activeControl === mode ? "default" : "outline"}
                className="flex-1 h-8 text-xs gap-1"
                onClick={() => toggleControl(mode)}
                data-testid={`btn-control-${mode}-${layer.id}`}
              >
                <Icon className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">{label}</span>
              </Button>
            ))}
          </div>

          {activeControl && (
            <div className="pt-2 border-t">
              {activeControl === "size" && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>Font Size</span>
                    <span className="font-mono">{layer.fontSize}px</span>
                  </div>
                  <Slider
                    value={[layer.fontSize]}
                    onValueChange={([v]) => update("fontSize", v)}
                    min={12}
                    max={120}
                    step={1}
                    data-testid={`slider-fontsize-${layer.id}`}
                  />
                </div>
              )}

              {activeControl === "color" && (
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={layer.color}
                    onChange={(e) => update("color", e.target.value)}
                    className="h-9 w-12 rounded border cursor-pointer"
                    data-testid={`input-color-${layer.id}`}
                  />
                  <Input
                    value={layer.color}
                    onChange={(e) => update("color", e.target.value)}
                    className="flex-1 font-mono text-xs uppercase"
                    maxLength={7}
                    data-testid={`input-colorhex-${layer.id}`}
                  />
                  <div className="flex gap-1">
                    {["#FFFFFF", "#000000", "#FF0000", "#00FF00", "#0000FF", "#FFFF00"].map(c => (
                      <button
                        key={c}
                        className="h-6 w-6 rounded border hover-elevate"
                        style={{ backgroundColor: c }}
                        onClick={() => update("color", c)}
                        data-testid={`btn-quickcolor-${c.slice(1)}-${layer.id}`}
                      />
                    ))}
                  </div>
                </div>
              )}

              {activeControl === "position" && (
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">X Position (%)</label>
                    <Input
                      type="number"
                      value={layer.x}
                      onChange={(e) => update("x", Number(e.target.value))}
                      min={0}
                      max={100}
                      className="font-mono"
                      data-testid={`input-x-${layer.id}`}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">Y Position (%)</label>
                    <Input
                      type="number"
                      value={layer.y}
                      onChange={(e) => update("y", Number(e.target.value))}
                      min={0}
                      max={100}
                      className="font-mono"
                      data-testid={`input-y-${layer.id}`}
                    />
                  </div>
                </div>
              )}

              {activeControl === "width" && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>Text Width</span>
                    <span className="font-mono">{layer.width}%</span>
                  </div>
                  <Slider
                    value={[layer.width]}
                    onValueChange={([v]) => update("width", v)}
                    min={20}
                    max={100}
                    step={1}
                    data-testid={`slider-width-${layer.id}`}
                  />
                </div>
              )}

              {activeControl === "backdrop" && (
                <div className="space-y-2">
                  <div className="text-xs text-muted-foreground mb-2">Text Backdrop</div>
                  <div className="flex gap-2">
                    {(["off", "soft", "strong"] as TextBackdrop[]).map(option => (
                      <Button
                        key={option}
                        size="sm"
                        variant={(layer.backdrop || "off") === option ? "default" : "outline"}
                        className="flex-1 capitalize"
                        onClick={() => update("backdrop", option)}
                        data-testid={`btn-backdrop-${option}-${layer.id}`}
                      >
                        {option}
                      </Button>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {layer.backdrop === "soft" && "Semi-transparent background for readability"}
                    {layer.backdrop === "strong" && "Solid background for maximum contrast"}
                    {(!layer.backdrop || layer.backdrop === "off") && "No background behind text"}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

interface CanvasTextStackProps {
  layers: TextLayerConfig[];
  onChange: (layers: TextLayerConfig[]) => void;
  maxLayers?: number;
  compact?: boolean;
  className?: string;
}

export function CanvasTextStack({
  layers,
  onChange,
  maxLayers = 4,
  compact = false,
  className
}: CanvasTextStackProps) {
  function updateLayer(index: number, updated: TextLayerConfig) {
    const next = [...layers];
    next[index] = updated;
    onChange(next);
  }

  function addLayer() {
    if (layers.length >= maxLayers) return;
    const id = `text-${Date.now()}`;
    onChange([...layers, defaultTextLayer(id, `Text ${layers.length + 1}`)]);
  }

  function removeLayer(index: number) {
    onChange(layers.filter((_, i) => i !== index));
  }

  return (
    <div className={cn("space-y-2", className)}>
      {layers.map((layer, i) => (
        <CanvasTextLayer
          key={layer.id}
          layer={layer}
          onChange={(l) => updateLayer(i, l)}
          onRemove={layers.length > 1 ? () => removeLayer(i) : undefined}
          compact={compact}
        />
      ))}
      
      {layers.length < maxLayers && (
        <Button
          variant="outline"
          size="sm"
          className="w-full"
          onClick={addLayer}
          data-testid="btn-add-text-layer"
        >
          <Type className="h-4 w-4 mr-2" />
          Add Text Layer
        </Button>
      )}
    </div>
  );
}

interface CanvasTextPreviewProps {
  layers: TextLayerConfig[];
  containerWidth: number;
  containerHeight: number;
  className?: string;
}

function getBackdropStyles(backdrop: TextBackdrop | undefined): React.CSSProperties {
  switch (backdrop) {
    case "soft":
      return {
        backgroundColor: "rgba(0, 0, 0, 0.5)",
        padding: "0.5em 1em",
        borderRadius: "0.25em",
      };
    case "strong":
      return {
        backgroundColor: "rgba(0, 0, 0, 0.85)",
        padding: "0.5em 1em",
        borderRadius: "0.25em",
      };
    default:
      return {};
  }
}

export function CanvasTextPreview({
  layers,
  containerWidth,
  containerHeight,
  className
}: CanvasTextPreviewProps) {
  return (
    <div className={cn("relative overflow-hidden", className)} style={{ width: containerWidth, height: containerHeight }}>
      {layers.filter(l => l.visible && l.text).map(layer => {
        const left = (layer.x / 100) * containerWidth;
        const top = (layer.y / 100) * containerHeight;
        const width = (layer.width / 100) * containerWidth;
        const backdropStyles = getBackdropStyles(layer.backdrop);
        
        return (
          <div
            key={layer.id}
            className="absolute pointer-events-none"
            style={{
              left,
              top,
              width,
              transform: "translate(-50%, -50%)",
              fontSize: layer.fontSize,
              color: layer.color,
              fontFamily: layer.fontFamily || "Inter",
              fontWeight: layer.fontWeight || 600,
              textAlign: layer.textAlign || "center",
              textShadow: layer.backdrop === "off" || !layer.backdrop 
                ? "0 2px 4px rgba(0,0,0,0.5)" 
                : "none",
              lineHeight: 1.2,
              wordWrap: "break-word",
              ...backdropStyles,
            }}
            data-testid={`preview-text-${layer.id}`}
          >
            {layer.text}
          </div>
        );
      })}
    </div>
  );
}
