import { useState, useRef, useEffect, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Type, Upload, Trash2, Plus, Move, Loader2 } from "lucide-react";

interface TextLayer {
  id: string;
  text: string;
  x: number;
  y: number;
  fontSize: number;
  fontFamily: string;
  color: string;
  bold: boolean;
}

interface ImageDesignerProps {
  onImageReady: (imageDataUrl: string) => void;
  isUploading?: boolean;
}

const PRESET_TEMPLATES = [
  {
    id: "business-blue",
    name: "Business Blue",
    gradient: "linear-gradient(135deg, #1e3a5f 0%, #2d5a87 100%)",
  },
  {
    id: "modern-dark",
    name: "Modern Dark", 
    gradient: "linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)",
  },
  {
    id: "warm-sunset",
    name: "Warm Sunset",
    gradient: "linear-gradient(135deg, #ff6b35 0%, #f7931e 100%)",
  },
  {
    id: "fresh-green",
    name: "Fresh Green",
    gradient: "linear-gradient(135deg, #11998e 0%, #38ef7d 100%)",
  },
  {
    id: "royal-purple",
    name: "Royal Purple",
    gradient: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
  },
  {
    id: "clean-white",
    name: "Clean White",
    gradient: "linear-gradient(135deg, #ffffff 0%, #f0f0f0 100%)",
  },
];

const FONT_OPTIONS = [
  { value: "Inter", label: "Inter" },
  { value: "Arial", label: "Arial" },
  { value: "Georgia", label: "Georgia" },
  { value: "Times New Roman", label: "Times New Roman" },
  { value: "Courier New", label: "Courier New" },
  { value: "Verdana", label: "Verdana" },
];

const CANVAS_WIDTH = 600;
const CANVAS_HEIGHT = 400;

export default function ImageDesigner({ onImageReady, isUploading = false }: ImageDesignerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [selectedTemplate, setSelectedTemplate] = useState<string>("business-blue");
  const [customBackground, setCustomBackground] = useState<string | null>(null);
  const [textLayers, setTextLayers] = useState<TextLayer[]>([
    {
      id: "1",
      text: "Your Text Here",
      x: CANVAS_WIDTH / 2,
      y: CANVAS_HEIGHT / 2,
      fontSize: 32,
      fontFamily: "Inter",
      color: "#ffffff",
      bold: true,
    },
  ]);
  const [selectedLayerId, setSelectedLayerId] = useState<string>("1");
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  const selectedLayer = textLayers.find((l) => l.id === selectedLayerId);

  const drawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    if (customBackground) {
      const img = new Image();
      img.onload = () => {
        ctx.drawImage(img, 0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
        drawTextLayers(ctx);
      };
      img.src = customBackground;
    } else {
      const template = PRESET_TEMPLATES.find((t) => t.id === selectedTemplate);
      if (template) {
        const gradient = ctx.createLinearGradient(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
        const colors = template.gradient.match(/#[a-fA-F0-9]{6}/g) || ["#1e3a5f", "#2d5a87"];
        gradient.addColorStop(0, colors[0]);
        gradient.addColorStop(1, colors[1] || colors[0]);
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
      }
      drawTextLayers(ctx);
    }
  }, [customBackground, selectedTemplate, textLayers]);

  const drawTextLayers = (ctx: CanvasRenderingContext2D) => {
    textLayers.forEach((layer) => {
      const fontWeight = layer.bold ? "bold" : "normal";
      ctx.font = `${fontWeight} ${layer.fontSize}px ${layer.fontFamily}`;
      ctx.fillStyle = layer.color;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      
      if (layer.color === "#ffffff" || layer.color.toLowerCase() === "#fff") {
        ctx.shadowColor = "rgba(0,0,0,0.5)";
        ctx.shadowBlur = 4;
        ctx.shadowOffsetX = 2;
        ctx.shadowOffsetY = 2;
      } else {
        ctx.shadowColor = "transparent";
        ctx.shadowBlur = 0;
      }
      
      ctx.fillText(layer.text, layer.x, layer.y);
      
      if (layer.id === selectedLayerId) {
        const metrics = ctx.measureText(layer.text);
        const padding = 8;
        ctx.strokeStyle = "#3b82f6";
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 5]);
        ctx.strokeRect(
          layer.x - metrics.width / 2 - padding,
          layer.y - layer.fontSize / 2 - padding,
          metrics.width + padding * 2,
          layer.fontSize + padding * 2
        );
        ctx.setLineDash([]);
      }
      
      ctx.shadowColor = "transparent";
    });
  };

  useEffect(() => {
    drawCanvas();
  }, [drawCanvas]);

  const handleCanvasMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const rect = canvas.getBoundingClientRect();
    const scaleX = CANVAS_WIDTH / rect.width;
    const scaleY = CANVAS_HEIGHT / rect.height;
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;

    for (const layer of textLayers) {
      const ctx = canvas.getContext("2d");
      if (!ctx) continue;
      
      ctx.font = `${layer.bold ? "bold" : "normal"} ${layer.fontSize}px ${layer.fontFamily}`;
      const metrics = ctx.measureText(layer.text);
      const padding = 8;
      
      if (
        x >= layer.x - metrics.width / 2 - padding &&
        x <= layer.x + metrics.width / 2 + padding &&
        y >= layer.y - layer.fontSize / 2 - padding &&
        y <= layer.y + layer.fontSize / 2 + padding
      ) {
        setSelectedLayerId(layer.id);
        setIsDragging(true);
        setDragOffset({ x: x - layer.x, y: y - layer.y });
        return;
      }
    }
  };

  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDragging || !selectedLayerId) return;
    
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const rect = canvas.getBoundingClientRect();
    const scaleX = CANVAS_WIDTH / rect.width;
    const scaleY = CANVAS_HEIGHT / rect.height;
    const x = (e.clientX - rect.left) * scaleX - dragOffset.x;
    const y = (e.clientY - rect.top) * scaleY - dragOffset.y;

    setTextLayers((layers) =>
      layers.map((layer) =>
        layer.id === selectedLayerId
          ? { ...layer, x: Math.max(50, Math.min(CANVAS_WIDTH - 50, x)), y: Math.max(30, Math.min(CANVAS_HEIGHT - 30, y)) }
          : layer
      )
    );
  };

  const handleCanvasMouseUp = () => {
    setIsDragging(false);
  };

  const handleBackgroundUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (event) => {
      setCustomBackground(event.target?.result as string);
      setSelectedTemplate("");
    };
    reader.readAsDataURL(file);
  };

  const addTextLayer = () => {
    const newId = Date.now().toString();
    setTextLayers((layers) => [
      ...layers,
      {
        id: newId,
        text: "New Text",
        x: CANVAS_WIDTH / 2,
        y: CANVAS_HEIGHT / 2 + layers.length * 40,
        fontSize: 24,
        fontFamily: "Inter",
        color: "#ffffff",
        bold: false,
      },
    ]);
    setSelectedLayerId(newId);
  };

  const removeTextLayer = (id: string) => {
    if (textLayers.length <= 1) return;
    setTextLayers((layers) => layers.filter((l) => l.id !== id));
    if (selectedLayerId === id) {
      setSelectedLayerId(textLayers[0].id);
    }
  };

  const updateSelectedLayer = (updates: Partial<TextLayer>) => {
    setTextLayers((layers) =>
      layers.map((layer) =>
        layer.id === selectedLayerId ? { ...layer, ...updates } : layer
      )
    );
  };

  const handleSaveImage = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const tempCanvas = document.createElement("canvas");
    tempCanvas.width = CANVAS_WIDTH;
    tempCanvas.height = CANVAS_HEIGHT;
    const tempCtx = tempCanvas.getContext("2d");
    if (!tempCtx) return;

    if (customBackground) {
      const img = new Image();
      img.onload = () => {
        tempCtx.drawImage(img, 0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
        textLayers.forEach((layer) => {
          const fontWeight = layer.bold ? "bold" : "normal";
          tempCtx.font = `${fontWeight} ${layer.fontSize}px ${layer.fontFamily}`;
          tempCtx.fillStyle = layer.color;
          tempCtx.textAlign = "center";
          tempCtx.textBaseline = "middle";
          if (layer.color === "#ffffff" || layer.color.toLowerCase() === "#fff") {
            tempCtx.shadowColor = "rgba(0,0,0,0.5)";
            tempCtx.shadowBlur = 4;
            tempCtx.shadowOffsetX = 2;
            tempCtx.shadowOffsetY = 2;
          }
          tempCtx.fillText(layer.text, layer.x, layer.y);
          tempCtx.shadowColor = "transparent";
        });
        onImageReady(tempCanvas.toDataURL("image/png"));
      };
      img.src = customBackground;
    } else {
      const template = PRESET_TEMPLATES.find((t) => t.id === selectedTemplate);
      if (template) {
        const gradient = tempCtx.createLinearGradient(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
        const colors = template.gradient.match(/#[a-fA-F0-9]{6}/g) || ["#1e3a5f", "#2d5a87"];
        gradient.addColorStop(0, colors[0]);
        gradient.addColorStop(1, colors[1] || colors[0]);
        tempCtx.fillStyle = gradient;
        tempCtx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
      }
      textLayers.forEach((layer) => {
        const fontWeight = layer.bold ? "bold" : "normal";
        tempCtx.font = `${fontWeight} ${layer.fontSize}px ${layer.fontFamily}`;
        tempCtx.fillStyle = layer.color;
        tempCtx.textAlign = "center";
        tempCtx.textBaseline = "middle";
        if (layer.color === "#ffffff" || layer.color.toLowerCase() === "#fff") {
          tempCtx.shadowColor = "rgba(0,0,0,0.5)";
          tempCtx.shadowBlur = 4;
          tempCtx.shadowOffsetX = 2;
          tempCtx.shadowOffsetY = 2;
        }
        tempCtx.fillText(layer.text, layer.x, layer.y);
        tempCtx.shadowColor = "transparent";
      });
      onImageReady(tempCanvas.toDataURL("image/png"));
    }
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-4">
          <div>
            <Label className="text-sm font-medium mb-2 block">Background Template</Label>
            <div className="grid grid-cols-3 gap-2">
              {PRESET_TEMPLATES.map((template) => (
                <button
                  key={template.id}
                  onClick={() => {
                    setSelectedTemplate(template.id);
                    setCustomBackground(null);
                  }}
                  className={`h-12 rounded-md border-2 transition-all ${
                    selectedTemplate === template.id && !customBackground
                      ? "border-primary ring-2 ring-primary/20"
                      : "border-transparent hover:border-muted-foreground/30"
                  }`}
                  style={{ background: template.gradient }}
                  title={template.name}
                  data-testid={`button-template-${template.id}`}
                />
              ))}
            </div>
          </div>

          <div>
            <Label className="text-sm font-medium mb-2 block">Or Upload Background</Label>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleBackgroundUpload}
              accept="image/*"
              className="hidden"
            />
            <Button
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              className="w-full"
              title="Recommended: 4500 × 5400 px (portrait), 300 DPI for best print quality"
              data-testid="button-upload-background"
            >
              <Upload className="w-4 h-4 mr-2" />
              {customBackground ? "Change Background" : "Upload Image"}
            </Button>
            <p className="text-xs text-muted-foreground mt-1">Print: 4500×5400px, 300 DPI, PNG, transparent bg</p>
          </div>

          <div className="border-t pt-4">
            <div className="flex items-center justify-between mb-2">
              <Label className="text-sm font-medium">Text Layers</Label>
              <Button variant="ghost" size="sm" onClick={addTextLayer} data-testid="button-add-text">
                <Plus className="w-4 h-4 mr-1" />
                Add Text
              </Button>
            </div>
            <div className="space-y-2 max-h-32 overflow-y-auto">
              {textLayers.map((layer, index) => (
                <div
                  key={layer.id}
                  className={`flex items-center gap-2 p-2 rounded-md cursor-pointer ${
                    selectedLayerId === layer.id ? "bg-primary/10" : "hover:bg-muted"
                  }`}
                  onClick={() => setSelectedLayerId(layer.id)}
                  data-testid={`layer-${layer.id}`}
                >
                  <Type className="w-4 h-4 text-muted-foreground" />
                  <span className="flex-1 text-sm truncate">{layer.text || `Layer ${index + 1}`}</span>
                  {textLayers.length > 1 && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={(e) => {
                        e.stopPropagation();
                        removeTextLayer(layer.id);
                      }}
                      data-testid={`button-remove-layer-${layer.id}`}
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {selectedLayer && (
            <div className="border-t pt-4 space-y-3">
              <div>
                <Label htmlFor="layer-text" className="text-sm">Text Content</Label>
                <Input
                  id="layer-text"
                  value={selectedLayer.text}
                  onChange={(e) => updateSelectedLayer({ text: e.target.value })}
                  data-testid="input-layer-text"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-sm">Font</Label>
                  <Select
                    value={selectedLayer.fontFamily}
                    onValueChange={(v) => updateSelectedLayer({ fontFamily: v })}
                  >
                    <SelectTrigger data-testid="select-font">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {FONT_OPTIONS.map((font) => (
                        <SelectItem key={font.value} value={font.value}>
                          {font.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-sm">Color</Label>
                  <div className="flex gap-1">
                    <Input
                      type="color"
                      value={selectedLayer.color}
                      onChange={(e) => updateSelectedLayer({ color: e.target.value })}
                      className="w-10 h-9 p-1"
                      data-testid="input-text-color"
                    />
                    <Input
                      type="text"
                      value={selectedLayer.color}
                      onChange={(e) => updateSelectedLayer({ color: e.target.value })}
                      className="flex-1"
                    />
                  </div>
                </div>
              </div>

              <div>
                <Label className="text-sm">Font Size: {selectedLayer.fontSize}px</Label>
                <Slider
                  value={[selectedLayer.fontSize]}
                  onValueChange={([v]) => updateSelectedLayer({ fontSize: v })}
                  min={12}
                  max={72}
                  step={1}
                  className="mt-2"
                  data-testid="slider-font-size"
                />
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant={selectedLayer.bold ? "default" : "outline"}
                  size="sm"
                  onClick={() => updateSelectedLayer({ bold: !selectedLayer.bold })}
                  data-testid="button-bold"
                >
                  <span className="font-bold">B</span>
                </Button>
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <Move className="w-3 h-3" />
                  Drag text on canvas to position
                </span>
              </div>
            </div>
          )}
        </div>

        <div className="space-y-3">
          <Label className="text-sm font-medium">Preview</Label>
          <Card className="overflow-hidden">
            <CardContent className="p-0">
              <canvas
                ref={canvasRef}
                width={CANVAS_WIDTH}
                height={CANVAS_HEIGHT}
                className="w-full h-auto cursor-move"
                onMouseDown={handleCanvasMouseDown}
                onMouseMove={handleCanvasMouseMove}
                onMouseUp={handleCanvasMouseUp}
                onMouseLeave={handleCanvasMouseUp}
                data-testid="canvas-designer"
              />
            </CardContent>
          </Card>
          
          <Button
            onClick={handleSaveImage}
            disabled={isUploading}
            className="w-full"
            data-testid="button-save-design"
          >
            {isUploading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Uploading...
              </>
            ) : (
              <>
                Save & Create QR Code
              </>
            )}
          </Button>

          <div className="flex items-center gap-2 p-3 bg-primary/10 rounded-md">
            <Badge variant="outline" className="text-xs">+$8.00</Badge>
            <span className="text-sm">Custom design + 1 year hosting</span>
          </div>
        </div>
      </div>
    </div>
  );
}
