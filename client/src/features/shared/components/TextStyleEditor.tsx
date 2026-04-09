import { useState, useEffect, useRef } from "react";
import { NumericInput } from "@/components/ui/numeric-input";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { FontPicker } from "@/components/ui/font-picker";
import { ChevronDown, ChevronRight, Type, ImageIcon, Upload, X, FolderOpen, Save, Mic, MicOff } from "lucide-react";
import { TextStyleViewer } from "./TextStyleViewer";
import { useFonts, loadGoogleFonts } from "@/hooks/use-fonts";

export interface TextStyleConfig {
  text: string;
  enabled: boolean;
  fontFamily: string;
  fontSize: string;
  fontWeight?: string;
  color: string;
  warpPreset: string;
  letterSpacing: number;
  strokeColor: string;
  strokeWidth: number;
  verticalOffset: number;
  horizontalOffset: number;
  mode?: "text" | "image";
  imageUrl?: string;
  imageScale?: number;
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

export const FONT_SIZES = ["12", "16", "20", "24", "28", "32", "36", "42", "48", "56", "64", "72"];
export const DEFAULT_FONT_SIZE = "36";
export const DEFAULT_FONT_SIZE_NUM = 36;

export const WARP_PRESETS = [
  { value: "straight", label: "Straight" },
  { value: "arc-up", label: "Arc Up" },
  { value: "arc-down", label: "Arc Down" },
];

export const defaultTextStyle: TextStyleConfig = {
  text: "",
  enabled: false,
  fontFamily: "Arial",
  fontSize: DEFAULT_FONT_SIZE,
  fontWeight: "400",
  color: "#FFFFFF",
  warpPreset: "straight",
  letterSpacing: 0,
  strokeColor: "",
  strokeWidth: 0,
  verticalOffset: 10,
  horizontalOffset: 50,
  mode: "text",
  imageUrl: "",
  imageScale: 100,
};

const PRESET_COLORS = [
  '#ffffff', '#f0f0eb', '#d4d4d4', '#888888', '#444444', '#000000', '#dc2626', '#ea580c',
  '#ca8a04', '#16a34a', '#0d9488', '#2563eb', '#1e3a5f', '#7c3aed', '#db2777', '#b7952a',
];

function isValidHex(v: string): boolean {
  return /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/.test(v);
}

function normalizeHex(v: string): string {
  let s = v.trim();
  if (!s.startsWith('#')) s = '#' + s;
  if (/^#[0-9A-Fa-f]{3}$/.test(s)) {
    s = '#' + s[1] + s[1] + s[2] + s[2] + s[3] + s[3];
  }
  return s.toLowerCase();
}

interface ColorPickerRowProps {
  value: string;
  onChange: (hex: string) => void;
  testIdPrefix: string;
  label?: string;
}

function ColorPickerRow({ value, onChange, testIdPrefix, label = "Color" }: ColorPickerRowProps) {
  const [hexText, setHexText] = useState(value || '#000000');
  const isFocused = useRef(false);
  const nativeRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isFocused.current) {
      setHexText(value || '#000000');
    }
  }, [value]);

  const handleHexChange = (raw: string) => {
    setHexText(raw);
    const norm = normalizeHex(raw);
    if (isValidHex(norm)) onChange(norm);
  };

  const handleHexBlur = () => {
    isFocused.current = false;
    const norm = normalizeHex(hexText);
    if (isValidHex(norm)) {
      onChange(norm);
      setHexText(norm);
    } else {
      setHexText(value || '#000000');
    }
  };

  return (
    <div className="space-y-2">
      <Label className="text-sm text-muted-foreground block">{label}</Label>
      <div className="grid grid-cols-8 gap-1.5">
        {PRESET_COLORS.map((c) => (
          <button
            key={c}
            type="button"
            title={c}
            onClick={() => { onChange(c); setHexText(c); }}
            className={`w-full aspect-square rounded-sm border transition-transform hover:scale-110 ${
              (value || '').toLowerCase() === c ? 'ring-2 ring-ring ring-offset-1' : 'border-border/60'
            }`}
            style={{ backgroundColor: c }}
            data-testid={`swatch-${testIdPrefix}-${c.replace('#', '')}`}
          />
        ))}
      </div>
      <div className="flex items-center gap-2">
        <input
          ref={nativeRef}
          type="color"
          value={isValidHex(value || '') ? value : '#000000'}
          onChange={(e) => { onChange(e.target.value); setHexText(e.target.value); }}
          className="sr-only"
          data-testid={`input-${testIdPrefix}-native-color`}
        />
        <button
          type="button"
          onClick={() => nativeRef.current?.click()}
          className="flex items-center gap-1.5 shrink-0 min-h-[36px] px-3 border rounded-md text-sm bg-background hover-elevate"
          data-testid={`button-${testIdPrefix}-custom-color`}
        >
          <span
            className="w-4 h-4 rounded-sm border border-border/60 flex-shrink-0"
            style={{ backgroundColor: isValidHex(value || '') ? value : '#000000' }}
          />
          Custom
        </button>
        <input
          type="text"
          value={hexText}
          onChange={(e) => handleHexChange(e.target.value)}
          onFocus={() => { isFocused.current = true; }}
          onBlur={handleHexBlur}
          maxLength={7}
          spellCheck={false}
          placeholder="#000000"
          className="flex-1 min-h-[36px] px-3 border rounded-md font-mono text-sm bg-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          data-testid={`input-${testIdPrefix}-hex`}
        />
      </div>
    </div>
  );
}

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
  fonts?: string[];
  onPickFromLibrary?: () => void;
  onSaveToLibrary?: () => void;
  inline?: boolean;
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
  fonts: fontsProp,
  onPickFromLibrary,
  onSaveToLibrary,
  inline = false,
}: TextStyleEditorProps) {
  const [isCollapsed, setIsCollapsed] = useState(defaultCollapsed);
  const [controlsOpen, setControlsOpen] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    if (inline && !style.enabled) {
      onChange({ enabled: true });
    }
  }, [inline]);

  const startVoiceInput = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return;
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      return;
    }
    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = 'en-US';
    recognition.onresult = (e: any) => {
      const transcript = e.results[0][0].transcript;
      onChange({ text: (style.text + (style.text ? ' ' : '') + transcript).slice(0, maxLength) });
    };
    recognition.onend = () => setIsListening(false);
    recognition.onerror = () => setIsListening(false);
    recognitionRef.current = recognition;
    recognition.start();
    setIsListening(true);
  };
  const { fonts: dynamicFonts } = useFonts();
  const activeFonts = fontsProp || dynamicFonts;

  useEffect(() => {
    loadGoogleFonts(activeFonts);
  }, [activeFonts]);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const currentMode = style.mode || "text";
  const hasContent = style.enabled && (currentMode === "text" ? style.text : style.imageUrl);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = () => {
      onChange({ imageUrl: reader.result as string, mode: "image", enabled: true });
    };
    reader.readAsDataURL(file);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  if (inline) {
    return (
      <div className="space-y-4">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleImageUpload}
          className="hidden"
          data-testid={`input-${testIdPrefix}-file`}
        />
          <div className="flex gap-1 p-1 bg-muted rounded-md" data-testid={`toggle-${testIdPrefix}-mode`}>
            <button
              type="button"
              onClick={() => onChange({ mode: "text" })}
              className={`flex-1 flex items-center justify-center gap-2 min-h-[40px] rounded-sm text-sm font-medium transition-colors ${
                currentMode === "text"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              data-testid={`button-${testIdPrefix}-mode-text`}
            >
              <Type className="h-4 w-4" />
              Text
            </button>
            <button
              type="button"
              onClick={() => onChange({ mode: "image" })}
              className={`flex-1 flex items-center justify-center gap-2 min-h-[40px] rounded-sm text-sm font-medium transition-colors ${
                currentMode === "image"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              data-testid={`button-${testIdPrefix}-mode-image`}
            >
              <ImageIcon className="h-4 w-4" />
              Image
            </button>
          </div>

          {currentMode === "image" ? (
            <div className="space-y-3">
              {style.imageUrl ? (
                <div className="relative">
                  <div className="border rounded-md p-2 bg-muted/30">
                    <img
                      src={style.imageUrl}
                      alt="Uploaded"
                      className="w-full max-h-[150px] object-contain rounded"
                      data-testid={`img-${testIdPrefix}-preview`}
                    />
                  </div>
                  <div className="flex gap-2 mt-2 flex-wrap">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => fileInputRef.current?.click()}
                      data-testid={`button-${testIdPrefix}-replace-image`}
                    >
                      <Upload className="h-4 w-4 mr-1" />
                      Upload
                    </Button>
                    {onPickFromLibrary && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={onPickFromLibrary}
                        data-testid={`button-${testIdPrefix}-library-image`}
                      >
                        <FolderOpen className="h-4 w-4 mr-1" />
                        Library
                      </Button>
                    )}
                    {onSaveToLibrary && style.imageUrl?.startsWith("data:") && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={onSaveToLibrary}
                        data-testid={`button-${testIdPrefix}-save-to-library`}
                      >
                        <Save className="h-4 w-4 mr-1" />
                        Save
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onChange({ imageUrl: "", mode: "text" })}
                      data-testid={`button-${testIdPrefix}-remove-image`}
                    >
                      <X className="h-4 w-4 mr-1" />
                      Remove
                    </Button>
                  </div>
                  {showPositionControls && (
                    <div className="pt-3 border-t border-border/50 space-y-4">
                      <p className="text-sm font-medium text-muted-foreground">Image Scale</p>
                      <div>
                        <Label className="text-sm mb-1.5 block text-muted-foreground">Scale</Label>
                        <div className="flex items-center gap-2 min-h-[52px] py-3">
                          <input
                            type="range"
                            min="20"
                            max="200"
                            value={style.imageScale ?? 100}
                            onChange={(e) => onChange({ imageScale: Number(e.target.value) })}
                            className="flex-1 touch-slider"
                            style={{ touchAction: 'none' }}
                            data-testid={`slider-${testIdPrefix}-image-scale`}
                          />
                          <input
                            type="number"
                            value={style.imageScale ?? 100}
                            onChange={(e) => onChange({ imageScale: Number(e.target.value) })}
                            onBlur={(e) => onChange({ imageScale: Math.min(200, Math.max(20, Number(e.target.value) || 20)) })}
                            className="w-20 text-center text-base font-semibold border rounded-md px-1 min-h-[48px] bg-background"
                            data-testid={`input-${testIdPrefix}-image-scale-num`}
                          />
                          <span className="text-xs text-muted-foreground w-4">%</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex gap-2">
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="flex-1 border-2 border-dashed rounded-md p-4 flex flex-col items-center gap-1.5 cursor-pointer hover:bg-muted/30 transition-colors"
                    data-testid={`dropzone-${testIdPrefix}-upload`}
                  >
                    <Upload className="h-6 w-6 text-muted-foreground" />
                    <p className="text-xs text-muted-foreground font-medium">Upload</p>
                    <p className="text-xs text-muted-foreground/60">PNG, JPG, SVG</p>
                  </div>
                  {onPickFromLibrary && (
                    <div
                      onClick={onPickFromLibrary}
                      className="flex-1 border-2 border-dashed rounded-md p-4 flex flex-col items-center gap-1.5 cursor-pointer hover:bg-muted/30 transition-colors"
                      data-testid={`dropzone-${testIdPrefix}-library`}
                    >
                      <FolderOpen className="h-6 w-6 text-muted-foreground" />
                      <p className="text-xs text-muted-foreground font-medium">Library</p>
                      <p className="text-xs text-muted-foreground/60">Our images</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <>
              {showPreview && (
                <TextStyleViewer 
                  style={style} 
                  backgroundColor={previewBackgroundColor}
                  backgroundImage={previewBackgroundImage}
                />
              )}

              <div className="relative">
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
                  className="w-full text-base min-h-[48px] px-3 py-2 pr-10 border rounded-md bg-background resize-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  data-testid={`input-${testIdPrefix}-text`}
                />
                <button
                  type="button"
                  onClick={startVoiceInput}
                  className={`absolute right-2 top-2 p-1.5 rounded-md transition-colors ${isListening ? 'text-red-500 bg-red-500/10' : 'text-muted-foreground hover:text-foreground hover:bg-muted'}`}
                  data-testid={`button-${testIdPrefix}-voice`}
                >
                  {isListening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                </button>
              </div>
              <div className="flex justify-end">
                <span className="text-xs text-muted-foreground" data-testid={`text-${testIdPrefix}-charcount`}>
                  {style.text.length} / {maxLength}
                </span>
              </div>

              <ColorPickerRow
                value={style.color}
                onChange={(c) => onChange({ color: c })}
                testIdPrefix={testIdPrefix}
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
                <span className="text-sm font-medium text-muted-foreground">More Styles</span>
              </div>

          {controlsOpen && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label className="text-sm mb-1.5 block text-muted-foreground">Font</Label>
                  <FontPicker
                    value={style.fontFamily}
                    onChange={(font) => onChange({ fontFamily: font })}
                    fonts={activeFonts}
                    previewText={style.text || "QR Gear"}
                    data-testid={`select-${testIdPrefix}-font`}
                  />
                </div>
                <div>
                  <Label className="text-sm mb-1.5 block text-muted-foreground">Size</Label>
                  <div className="flex flex-col items-center gap-2 py-1">
                    <NumericInput
                      value={parseInt(style.fontSize, 10) || 36}
                      onChange={(v) => onChange({ fontSize: String(v) })}
                      min={12}
                      max={72}
                      defaultValue={36}
                      className="w-20 text-center text-base font-semibold border rounded-md px-1 min-h-[48px] bg-background"
                      data-testid={`input-${testIdPrefix}-size-num`}
                    />
                    <input
                      type="range"
                      min="12"
                      max="72"
                      value={parseInt(style.fontSize, 10) || 36}
                      onChange={(e) => onChange({ fontSize: e.target.value })}
                      style={{ writingMode: 'vertical-lr', direction: 'rtl', height: '120px', cursor: 'pointer', touchAction: 'none' } as React.CSSProperties}
                      data-testid={`slider-${testIdPrefix}-size`}
                    />
                    <span className="text-xs text-muted-foreground">pt</span>
                  </div>
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
              
              <div>
                <Label className="text-sm mb-1.5 block text-muted-foreground">Letter Spacing</Label>
                <div className="flex items-center gap-2 min-h-[52px] py-3">
                  <input
                    type="range"
                    min="-10"
                    max="50"
                    value={style.letterSpacing}
                    onChange={(e) => onChange({ letterSpacing: Number(e.target.value) })}
                    className="flex-1 touch-slider"
                    style={{ touchAction: 'none' }}
                    data-testid={`slider-${testIdPrefix}-spacing`}
                  />
                  <NumericInput
                    value={style.letterSpacing}
                    onChange={(v) => onChange({ letterSpacing: v })}
                    min={-10}
                    max={50}
                    defaultValue={0}
                    allowNegative={true}
                    className="w-20 text-center text-base font-semibold border rounded-md px-1 min-h-[48px] bg-background"
                    data-testid={`input-${testIdPrefix}-spacing-num`}
                  />
                  <span className="text-xs text-muted-foreground w-5">px</span>
                </div>
              </div>
              
              <div>
                <Label className="text-sm mb-1.5 block text-muted-foreground">Weight</Label>
                <div className="flex items-center gap-2 min-h-[52px] py-3">
                  <input
                    type="range"
                    min="100"
                    max="900"
                    step="100"
                    value={parseInt(style.fontWeight || '400', 10)}
                    onChange={(e) => onChange({ fontWeight: e.target.value })}
                    className="flex-1 touch-slider"
                    style={{ touchAction: 'none' }}
                    data-testid={`slider-${testIdPrefix}-weight`}
                  />
                  <span className="w-12 text-center text-base font-semibold tabular-nums" data-testid={`text-${testIdPrefix}-weight`}>
                    {parseInt(style.fontWeight || '400', 10)}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <ColorPickerRow
                    value={style.strokeColor || '#ffffff'}
                    onChange={(c) => onChange({ strokeColor: c })}
                    testIdPrefix={`${testIdPrefix}-stroke`}
                    label="Stroke Color"
                  />
                </div>
                <div>
                  <Label className="text-sm mb-1.5 block text-muted-foreground">Stroke Width</Label>
                  <div className="flex items-center gap-2 min-h-[52px] py-3">
                    <input
                      type="range"
                      min="0"
                      max="20"
                      value={style.strokeWidth}
                      onChange={(e) => onChange({ strokeWidth: Number(e.target.value) })}
                      className="flex-1 touch-slider"
                      style={{ touchAction: 'none' }}
                      data-testid={`slider-${testIdPrefix}-stroke`}
                    />
                    <NumericInput
                      value={style.strokeWidth}
                      onChange={(v) => onChange({ strokeWidth: v })}
                      min={0}
                      max={20}
                      defaultValue={0}
                      className="w-20 text-center text-base font-semibold border rounded-md px-1 min-h-[48px] bg-background"
                      data-testid={`input-${testIdPrefix}-stroke-num`}
                    />
                    <span className="text-xs text-muted-foreground w-5">px</span>
                  </div>
                </div>
              </div>

            </div>
          )}
            </>
          )}

          {showPositionControls && (
            <div className="pt-3 border-t border-border/50">
              <p className="text-sm font-medium mb-3 text-muted-foreground">Position</p>
              <div className="space-y-4">
                <div>
                  <Label className="text-sm mb-1.5 block text-muted-foreground">Left / Right</Label>
                  <div className="flex items-center gap-2 min-h-[52px] py-3">
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={style.horizontalOffset ?? 50}
                      onChange={(e) => onChange({ horizontalOffset: parseInt(e.target.value, 10) || 0 })}
                      className="flex-1 touch-slider"
                      style={{ touchAction: 'none' }}
                      data-testid={`slider-${testIdPrefix}-horizontal`}
                    />
                    <NumericInput
                      value={style.horizontalOffset ?? 50}
                      onChange={(v) => onChange({ horizontalOffset: v })}
                      min={0}
                      max={100}
                      defaultValue={50}
                      className="w-20 text-center text-base font-semibold border rounded-md px-1 min-h-[48px] bg-background"
                      data-testid={`input-${testIdPrefix}-horizontal-num`}
                    />
                    <span className="text-xs text-muted-foreground w-4">%</span>
                  </div>
                </div>
                <div>
                  <Label className="text-sm mb-1.5 block text-muted-foreground">Up / Down</Label>
                  <div className="flex items-center gap-2 min-h-[52px] py-3">
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={style.verticalOffset ?? 50}
                      onChange={(e) => onChange({ verticalOffset: parseInt(e.target.value, 10) || 0 })}
                      className="flex-1 touch-slider"
                      style={{ touchAction: 'none' }}
                      data-testid={`slider-${testIdPrefix}-vertical`}
                    />
                    <NumericInput
                      value={style.verticalOffset ?? 50}
                      onChange={(v) => onChange({ verticalOffset: v })}
                      min={0}
                      max={100}
                      defaultValue={50}
                      className="w-20 text-center text-base font-semibold border rounded-md px-1 min-h-[48px] bg-background"
                      data-testid={`input-${testIdPrefix}-vertical-num`}
                    />
                    <span className="text-xs text-muted-foreground w-4">%</span>
                  </div>
                </div>
              </div>
            </div>
          )}
      </div>
    );
  }

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
              {currentMode === "image" ? "Image" : style.text.substring(0, 15)}{currentMode === "text" && style.text.length > 15 ? "..." : ""}
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
              if (checked && isCollapsed) setIsCollapsed(false);
            }}
            className="scale-125"
            data-testid={`switch-${testIdPrefix}`}
          />
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleImageUpload}
        className="hidden"
        data-testid={`input-${testIdPrefix}-file`}
      />

      {style.enabled && style.mode === "image" && style.imageUrl && isCollapsed && (
        <div className="px-4 pb-3">
          <div className="border rounded-md p-2 bg-muted/30">
            <img
              src={style.imageUrl}
              alt="Zone graphic"
              className="w-full max-h-[100px] object-contain rounded"
              style={{ pointerEvents: "none" }}
              data-testid={`img-${testIdPrefix}-collapsed-preview`}
            />
          </div>
        </div>
      )}

      {!isCollapsed && style.enabled && (
        <div className="space-y-4 p-4 pt-0">
          <div className="flex gap-1 p-1 bg-muted rounded-md" data-testid={`toggle-${testIdPrefix}-mode`}>
            <button
              type="button"
              onClick={() => onChange({ mode: "text" })}
              className={`flex-1 flex items-center justify-center gap-2 min-h-[40px] rounded-sm text-sm font-medium transition-colors ${currentMode === "text" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
              data-testid={`button-${testIdPrefix}-mode-text`}
            >
              <Type className="h-4 w-4" />
              Text
            </button>
            <button
              type="button"
              onClick={() => onChange({ mode: "image" })}
              className={`flex-1 flex items-center justify-center gap-2 min-h-[40px] rounded-sm text-sm font-medium transition-colors ${currentMode === "image" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
              data-testid={`button-${testIdPrefix}-mode-image`}
            >
              <ImageIcon className="h-4 w-4" />
              Image
            </button>
          </div>

          {currentMode === "image" ? (
            <div className="space-y-3">
              {style.imageUrl ? (
                <div className="relative">
                  <div className="border rounded-md p-2 bg-muted/30">
                    <img src={style.imageUrl} alt="Uploaded" className="w-full max-h-[150px] object-contain rounded" data-testid={`img-${testIdPrefix}-preview`} />
                  </div>
                  <div className="flex gap-2 mt-2 flex-wrap">
                    <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} data-testid={`button-${testIdPrefix}-replace-image`}><Upload className="h-4 w-4 mr-1" />Upload</Button>
                    {onPickFromLibrary && <Button variant="outline" size="sm" onClick={onPickFromLibrary} data-testid={`button-${testIdPrefix}-library-image`}><FolderOpen className="h-4 w-4 mr-1" />Library</Button>}
                    {onSaveToLibrary && style.imageUrl?.startsWith("data:") && <Button variant="outline" size="sm" onClick={onSaveToLibrary} data-testid={`button-${testIdPrefix}-save-to-library`}><Save className="h-4 w-4 mr-1" />Save</Button>}
                    <Button variant="outline" size="sm" onClick={() => onChange({ imageUrl: "", mode: "text" })} data-testid={`button-${testIdPrefix}-remove-image`}><X className="h-4 w-4 mr-1" />Remove</Button>
                  </div>
                </div>
              ) : (
                <div className="flex gap-2">
                  <div onClick={() => fileInputRef.current?.click()} className="flex-1 border-2 border-dashed rounded-md p-4 flex flex-col items-center gap-1.5 cursor-pointer hover:bg-muted/30 transition-colors" data-testid={`dropzone-${testIdPrefix}-upload`}>
                    <Upload className="h-6 w-6 text-muted-foreground" />
                    <p className="text-xs text-muted-foreground font-medium">Upload</p>
                    <p className="text-xs text-muted-foreground/60">PNG, JPG, SVG</p>
                  </div>
                  {onPickFromLibrary && (
                    <div onClick={onPickFromLibrary} className="flex-1 border-2 border-dashed rounded-md p-4 flex flex-col items-center gap-1.5 cursor-pointer hover:bg-muted/30 transition-colors" data-testid={`dropzone-${testIdPrefix}-library`}>
                      <FolderOpen className="h-6 w-6 text-muted-foreground" />
                      <p className="text-xs text-muted-foreground font-medium">Library</p>
                      <p className="text-xs text-muted-foreground/60">Our images</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <>
              {showPreview && <TextStyleViewer style={style} backgroundColor={previewBackgroundColor} backgroundImage={previewBackgroundImage} />}
              <div className="relative">
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
                  className="w-full text-base min-h-[48px] px-3 py-2 pr-10 border rounded-md bg-background resize-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  data-testid={`input-${testIdPrefix}-text`}
                />
                <button
                  type="button"
                  onClick={startVoiceInput}
                  className={`absolute right-2 top-2 p-1.5 rounded-md transition-colors ${isListening ? 'text-red-500 bg-red-500/10' : 'text-muted-foreground hover:text-foreground hover:bg-muted'}`}
                  data-testid={`button-${testIdPrefix}-voice`}
                >
                  {isListening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                </button>
              </div>
              <div className="flex justify-end">
                <span className="text-xs text-muted-foreground" data-testid={`text-${testIdPrefix}-charcount`}>
                  {style.text.length} / {maxLength}
                </span>
              </div>
              <ColorPickerRow
                value={style.color}
                onChange={(c) => onChange({ color: c })}
                testIdPrefix={testIdPrefix}
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
                <span className="text-sm font-medium text-muted-foreground">More Styles</span>
              </div>
              {controlsOpen && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <Label className="text-sm mb-1.5 block text-muted-foreground">Font</Label>
                      <FontPicker
                        value={style.fontFamily}
                        onChange={(font) => onChange({ fontFamily: font })}
                        fonts={activeFonts}
                        previewText={style.text || "QR Gear"}
                        data-testid={`select-${testIdPrefix}-font`}
                      />
                    </div>
                    <div>
                      <Label className="text-sm mb-1.5 block text-muted-foreground">Size</Label>
                      <div className="flex flex-col items-center gap-2 py-1">
                        <NumericInput
                          value={parseInt(style.fontSize, 10) || 36}
                          onChange={(v) => onChange({ fontSize: String(v) })}
                          min={12}
                          max={72}
                          defaultValue={36}
                          className="w-20 text-center text-base font-semibold border rounded-md px-1 min-h-[48px] bg-background"
                          data-testid={`input-${testIdPrefix}-size-num`}
                        />
                        <input
                          type="range"
                          min="12"
                          max="72"
                          value={parseInt(style.fontSize, 10) || 36}
                          onChange={(e) => onChange({ fontSize: e.target.value })}
                          style={{ writingMode: 'vertical-lr', direction: 'rtl', height: '120px', cursor: 'pointer', touchAction: 'none' } as React.CSSProperties}
                          data-testid={`slider-${testIdPrefix}-size`}
                        />
                        <span className="text-xs text-muted-foreground">pt</span>
                      </div>
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
                  <div>
                    <Label className="text-sm mb-1.5 block text-muted-foreground">Letter Spacing</Label>
                    <div className="flex items-center gap-2 min-h-[52px] py-3">
                      <input
                        type="range"
                        min="-10"
                        max="50"
                        value={style.letterSpacing}
                        onChange={(e) => onChange({ letterSpacing: Number(e.target.value) })}
                        className="flex-1 touch-slider"
                        style={{ touchAction: 'none' }}
                        data-testid={`slider-${testIdPrefix}-spacing`}
                      />
                      <NumericInput
                        value={style.letterSpacing}
                        onChange={(v) => onChange({ letterSpacing: v })}
                        min={-10}
                        max={50}
                        defaultValue={0}
                        allowNegative={true}
                        className="w-20 text-center text-base font-semibold border rounded-md px-1 min-h-[48px] bg-background"
                        data-testid={`input-${testIdPrefix}-spacing-num`}
                      />
                      <span className="text-xs text-muted-foreground w-5">px</span>
                    </div>
                  </div>
                  <div>
                    <Label className="text-sm mb-1.5 block text-muted-foreground">Weight</Label>
                    <div className="flex items-center gap-2 min-h-[52px] py-3">
                      <input
                        type="range"
                        min="100"
                        max="900"
                        step="100"
                        value={parseInt(style.fontWeight || '400', 10)}
                        onChange={(e) => onChange({ fontWeight: e.target.value })}
                        className="flex-1 touch-slider"
                        style={{ touchAction: 'none' }}
                        data-testid={`slider-${testIdPrefix}-weight`}
                      />
                      <span className="w-12 text-center text-base font-semibold tabular-nums" data-testid={`text-${testIdPrefix}-weight`}>
                        {parseInt(style.fontWeight || '400', 10)}
                      </span>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <ColorPickerRow
                        value={style.strokeColor || '#ffffff'}
                        onChange={(c) => onChange({ strokeColor: c })}
                        testIdPrefix={`${testIdPrefix}-stroke`}
                        label="Stroke Color"
                      />
                    </div>
                    <div>
                      <Label className="text-sm mb-1.5 block text-muted-foreground">Stroke Width</Label>
                      <div className="flex items-center gap-2 min-h-[52px] py-3">
                        <input
                          type="range"
                          min="0"
                          max="20"
                          value={style.strokeWidth}
                          onChange={(e) => onChange({ strokeWidth: Number(e.target.value) })}
                          className="flex-1 touch-slider"
                          style={{ touchAction: 'none' }}
                          data-testid={`slider-${testIdPrefix}-stroke`}
                        />
                        <NumericInput
                          value={style.strokeWidth}
                          onChange={(v) => onChange({ strokeWidth: v })}
                          min={0}
                          max={20}
                          defaultValue={0}
                          className="w-20 text-center text-base font-semibold border rounded-md px-1 min-h-[48px] bg-background"
                          data-testid={`input-${testIdPrefix}-stroke-num`}
                        />
                        <span className="text-xs text-muted-foreground w-5">px</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}

          {showPositionControls && (
            <div className="pt-3 border-t border-border/50">
              <p className="text-sm font-medium mb-3 text-muted-foreground">Position</p>
              <div className="space-y-4">
                <div>
                  <Label className="text-sm mb-1.5 block text-muted-foreground">Left / Right</Label>
                  <div className="flex items-center gap-2 min-h-[52px] py-3">
                    <input type="range" min="0" max="100" value={style.horizontalOffset ?? 50} onChange={(e) => onChange({ horizontalOffset: parseInt(e.target.value, 10) || 0 })} className="flex-1 touch-slider" style={{ touchAction: 'none' }} data-testid={`slider-${testIdPrefix}-horizontal`} />
                    <NumericInput value={style.horizontalOffset ?? 50} onChange={(v) => onChange({ horizontalOffset: v })} min={0} max={100} defaultValue={50} className="w-20 text-center text-base font-semibold border rounded-md px-1 min-h-[48px] bg-background" data-testid={`input-${testIdPrefix}-horizontal-num`} />
                    <span className="text-xs text-muted-foreground w-4">%</span>
                  </div>
                </div>
                <div>
                  <Label className="text-sm mb-1.5 block text-muted-foreground">Up / Down</Label>
                  <div className="flex items-center gap-2 min-h-[52px] py-3">
                    <input type="range" min="0" max="100" value={style.verticalOffset ?? 50} onChange={(e) => onChange({ verticalOffset: parseInt(e.target.value, 10) || 0 })} className="flex-1 touch-slider" style={{ touchAction: 'none' }} data-testid={`slider-${testIdPrefix}-vertical`} />
                    <NumericInput value={style.verticalOffset ?? 50} onChange={(v) => onChange({ verticalOffset: v })} min={0} max={100} defaultValue={50} className="w-20 text-center text-base font-semibold border rounded-md px-1 min-h-[48px] bg-background" data-testid={`input-${testIdPrefix}-vertical-num`} />
                    <span className="text-xs text-muted-foreground w-4">%</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
