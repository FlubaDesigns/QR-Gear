import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  QrCode,
  ChevronRight,
  Check,
  DollarSign,
  Type,
  ImageIcon,
  Upload,
  X,
} from "lucide-react";
import { type TextStyleConfig } from "@/features/shared/components/TextStyleEditor";
import { GraphicPreviewView } from "@/features/shared/components/skins/GraphicPreviewView";
import { ZoneThumbnail } from "@/features/shared/components/ZonePreview";
import {
  type TextLayoutChoice,
  type GraphicSize,
  type GraphicLocation,
  SHIRT_COLORS,
  SHIRT_TEXT_COLORS,
  SHIRT_TEXT_SIZES,
  SHIRT_TEXT_FONTS,
} from "./wizardTypes";

function calculateAutoTextSize(text: string, baseSize: string, areaWidth: number): { lines: string[]; fontSize: number } {
  const sizeMap: Record<string, number> = { '12px': 4, '18px': 5.5, '24px': 7, '32px': 9 };
  const baseSvgSize = sizeMap[baseSize] || 3.5;
  const maxCharsPerLine = 20;

  if (!text) return { lines: [''], fontSize: baseSvgSize };

  let lines: string[];
  const hasNewline = text.includes('\n');
  if (hasNewline) {
    lines = text.split('\n').slice(0, 2);
  } else if (text.length > maxCharsPerLine) {
    const mid = Math.ceil(text.length / 2);
    const spaceIdx = text.lastIndexOf(' ', mid);
    const breakAt = spaceIdx > 0 ? spaceIdx : maxCharsPerLine;
    lines = [text.slice(0, breakAt).trim(), text.slice(breakAt).trim()];
  } else {
    lines = [text];
  }

  const longestLine = Math.max(...lines.map(l => l.length), 1);
  let effectiveSize = baseSvgSize;
  if (longestLine > 8) {
    effectiveSize = baseSvgSize * Math.max(0.5, 8 / longestLine);
  }

  return { lines, fontSize: Math.round(effectiveSize * 100) / 100 };
}

function PhoneMockup({ 
  background, 
  headerText,
  footerText,
  headerStyle,
  footerStyle,
  className = ""
}: { 
  background: string;
  headerText?: string;
  footerText?: string;
  headerStyle?: TextStyleConfig;
  footerStyle?: TextStyleConfig;
  className?: string;
}) {
  const getFontSize = (size: string) => {
    if (size === '12px' || size === 'sm') return '10px';
    if (size === '24px' || size === 'lg') return '16px';
    if (size === '32px' || size === 'xl') return '22px';
    return '12px';
  };

  return (
    <div className={`relative mx-auto ${className}`} style={{ width: '160px' }}>
      <div className="relative rounded-[1.5rem] border-4 border-slate-700 bg-black overflow-hidden shadow-2xl">
        <div className="absolute top-1.5 left-1/2 -translate-x-1/2 w-12 h-3 bg-slate-700 rounded-full z-10" />
        <div className="aspect-[9/19] relative">
          {background && (
            <img 
              src={background} 
              alt="Background" 
              className="absolute inset-0 w-full h-full object-cover"
            />
          )}
          <div className="absolute inset-0 flex flex-col items-center justify-center p-3">
            {headerStyle?.enabled && headerStyle?.mode === 'image' && headerStyle?.imageUrl ? (
              <div className="mb-1 px-1 max-w-full flex justify-center">
                <img
                  src={headerStyle.imageUrl}
                  alt="Header"
                  className="max-h-[30px] max-w-[120px] object-contain"
                  style={{ transform: `translateY(${(headerStyle.verticalOffset || 0) * 0.3}px)` }}
                />
              </div>
            ) : headerText && headerStyle?.enabled && (
              <div 
                className="text-center mb-1 px-1 max-w-full"
                style={{
                  color: headerStyle.color || '#ffffff',
                  fontSize: getFontSize(headerStyle.fontSize),
                  fontFamily: headerStyle.fontFamily || 'sans-serif',
                  fontWeight: 'bold',
                  textShadow: '0 1px 3px rgba(0,0,0,0.5)',
                  transform: `translateY(${(headerStyle.verticalOffset || 0) * 0.5}px)`
                }}
              >
                {headerText}
              </div>
            )}
            <div className="w-12 h-12 bg-white rounded-lg flex items-center justify-center flex-shrink-0">
              <QrCode className="w-9 h-9 text-slate-800" />
            </div>
            {footerStyle?.enabled && footerStyle?.mode === 'image' && footerStyle?.imageUrl ? (
              <div className="mt-1 px-1 max-w-full flex justify-center">
                <img
                  src={footerStyle.imageUrl}
                  alt="Footer"
                  className="max-h-[30px] max-w-[120px] object-contain"
                  style={{ transform: `translateY(${(footerStyle.verticalOffset || 0) * 0.3}px)` }}
                />
              </div>
            ) : footerText && footerStyle?.enabled && (
              <div 
                className="text-center mt-1 px-1 max-w-full"
                style={{
                  color: footerStyle.color || '#ffffff',
                  fontSize: getFontSize(footerStyle.fontSize),
                  fontFamily: footerStyle.fontFamily || 'sans-serif',
                  fontWeight: 'bold',
                  textShadow: '0 1px 3px rgba(0,0,0,0.5)',
                  transform: `translateY(${(footerStyle.verticalOffset || 0) * 0.5}px)`
                }}
              >
                {footerText}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

const TEXT_COLORS = ['#ffffff', '#000000', '#3b82f6', '#22c55e', '#f59e0b', '#ef4444'];
const TEXT_SIZES = [
  { id: 'sm', label: 'S', value: '12px' },
  { id: 'md', label: 'M', value: '18px' },
  { id: 'lg', label: 'L', value: '24px' },
  { id: 'xl', label: 'XL', value: '32px' }
];
const TEXT_FONTS = [
  { id: 'sans', label: 'Clean', family: 'Arial' },
  { id: 'bold', label: 'Bold', family: 'Impact' },
  { id: 'script', label: 'Script', family: 'Georgia' }
];

export function TextAskStep({ 
  background,
  onYes,
  onNo
}: { 
  background: string;
  onYes: () => void;
  onNo: () => void;
}) {
  return (
    <div className="text-center space-y-6">
      <div>
        <h2 className="text-lg font-bold text-white mb-2">Looking Good!</h2>
        <p className="text-slate-400">Would you like to add some text?</p>
      </div>

      <PhoneMockup background={background} />

      <div className="max-w-sm mx-auto grid grid-cols-2 gap-4">
        <Button
          size="lg"
          className="h-16 text-lg bg-green-600 hover:bg-green-700"
          onClick={onYes}
          data-testid="button-text-yes"
        >
          <Type className="w-5 h-5 mr-2" />
          Yes
        </Button>
        <Button
          size="lg"
          variant="outline"
          className="h-16 text-lg"
          onClick={onNo}
          data-testid="button-text-no"
        >
          <ChevronRight className="w-5 h-5 mr-2" />
          No, Skip
        </Button>
      </div>
    </div>
  );
}

export function TextLayoutChoiceStep({ 
  selected,
  onSelect,
  textLineEarningsBonus,
  context = 'member'
}: { 
  selected: TextLayoutChoice;
  onSelect: (choice: TextLayoutChoice) => void;
  textLineEarningsBonus: number;
  context?: 'member' | 'owner';
}) {
  const [floatingEarning, setFloatingEarning] = useState<{ amount: number; key: number; buttonId: string } | null>(null);

  const options = [
    {
      id: 'header' as TextLayoutChoice,
      label: 'Header Only',
      description: 'Text or image above the QR code',
      lines: 1,
    },
    {
      id: 'footer' as TextLayoutChoice,
      label: 'Footer Only', 
      description: 'Text or image below the QR code',
      lines: 1,
    },
    {
      id: 'both' as TextLayoutChoice,
      label: 'Header + Footer',
      description: 'Text or image above and below',
      lines: 2,
    }
  ];

  const handleSelect = (choice: TextLayoutChoice) => {
    const option = options.find(o => o.id === choice);
    if (option && choice !== selected) {
      setFloatingEarning({ amount: textLineEarningsBonus * option.lines, key: Date.now(), buttonId: choice });
    }
    onSelect(choice);
  };

  return (
    <div className="text-center space-y-2">
      <div>
        <h2 className="text-base font-bold text-white mb-0.5">Add Text or Image to Your Design</h2>
        <p className="text-slate-400 text-xs max-w-xs mx-auto">
          {context === 'member'
            ? 'Each text or image line earns you more per sale'
            : 'Pick where text or an image goes on your product — above the QR code, below it, or both. Each zone adds a small cost.'}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-2 max-w-sm mx-auto w-full overflow-hidden">
        {options.map((option) => (
          <button
            key={option.id}
            onClick={() => handleSelect(option.id)}
            className={`relative p-2 rounded-xl border-2 transition-all overflow-hidden ${
              selected === option.id
                ? 'border-orange-500 bg-orange-500/20 shadow-lg shadow-orange-500/20'
                : 'border-slate-600 bg-slate-800/50 hover:border-slate-500'
            }`}
            data-testid={`button-layout-${option.id}`}
          >
            {floatingEarning && floatingEarning.buttonId === option.id && (
              <div
                key={floatingEarning.key}
                className="absolute -top-2 left-1/2 -translate-x-1/2 pointer-events-none z-20"
              >
                <div className={`animate-bounce-up font-bold text-lg flex items-center gap-1 rounded-full px-3 py-1.5 shadow-xl ${
                  context === 'owner'
                    ? 'text-blue-200 bg-blue-500/30 border-2 border-blue-400/60 shadow-blue-400/40'
                    : 'text-green-200 bg-green-500/30 border-2 border-green-400/60 shadow-green-400/40'
                }`}>
                  <DollarSign className="w-4 h-4" />
                  +${floatingEarning.amount.toFixed(2)}
                </div>
              </div>
            )}
            <div className="flex items-center gap-2 min-w-0">
              <ZoneThumbnail
                showHeader={option.id === 'header' || option.id === 'both'}
                showFooter={option.id === 'footer' || option.id === 'both'}
                isSelected={selected === option.id}
                size="sm"
              />
              <div className="flex-1 text-left min-w-0 overflow-hidden">
                <p className={`font-semibold text-sm truncate ${selected === option.id ? 'text-orange-400' : 'text-white'}`}>{option.label}</p>
                <p className={`text-xs truncate ${selected === option.id ? 'text-orange-300/70' : 'text-slate-400'}`}>{option.description}</p>
              </div>
              <div className="text-right flex-shrink-0">
                <p className={`font-bold text-sm ${context === 'owner' ? 'text-blue-400' : 'text-green-400'}`}>+${(textLineEarningsBonus * option.lines).toFixed(2)}</p>
                <p className="text-slate-500 text-[10px]">{context === 'owner' ? 'added' : 'per sale'}</p>
              </div>
              {selected === option.id && (
                <Check className="w-4 h-4 text-orange-400 flex-shrink-0" />
              )}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

export function TextStyleSection({ 
  label,
  style,
  onStyleChange,
  testIdPrefix
}: {
  label: string;
  style: TextStyleConfig;
  onStyleChange: (style: TextStyleConfig) => void;
  testIdPrefix: string;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const currentMode = style.mode || 'text';

  const updateStyle = (updates: Partial<TextStyleConfig>) => {
    onStyleChange({ ...style, ...updates, enabled: true });
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = () => {
      updateStyle({ imageUrl: reader.result as string, mode: "image" });
    };
    reader.readAsDataURL(file);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <div className="space-y-3 p-3 bg-slate-800/50 rounded-xl border border-slate-700">
      <Label className="text-white font-medium text-sm">{label}</Label>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleImageUpload}
        className="hidden"
        data-testid={`input-${testIdPrefix}-file`}
      />

      <div className="flex gap-1 p-1 bg-slate-700 rounded-md" data-testid={`toggle-${testIdPrefix}-mode`}>
        <button
          type="button"
          onClick={() => updateStyle({ mode: "text" })}
          className={`flex-1 flex items-center justify-center gap-1.5 min-h-[36px] rounded-sm text-xs font-medium transition-colors ${
            currentMode === "text"
              ? "bg-slate-600 text-white shadow-sm"
              : "text-slate-400 hover:text-white"
          }`}
          data-testid={`button-${testIdPrefix}-mode-text`}
        >
          <Type className="h-3.5 w-3.5" />
          Text
        </button>
        <button
          type="button"
          onClick={() => updateStyle({ mode: "image" })}
          className={`flex-1 flex items-center justify-center gap-1.5 min-h-[36px] rounded-sm text-xs font-medium transition-colors ${
            currentMode === "image"
              ? "bg-slate-600 text-white shadow-sm"
              : "text-slate-400 hover:text-white"
          }`}
          data-testid={`button-${testIdPrefix}-mode-image`}
        >
          <ImageIcon className="h-3.5 w-3.5" />
          Image
        </button>
      </div>

      {currentMode === "image" ? (
        <div className="space-y-2">
          {style.imageUrl ? (
            <div>
              <div className="border border-slate-600 rounded-md p-2 bg-slate-700/50">
                <img
                  src={style.imageUrl}
                  alt="Uploaded"
                  className="w-full max-h-[100px] object-contain rounded"
                  data-testid={`img-${testIdPrefix}-preview`}
                />
              </div>
              <div className="flex gap-2 mt-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  data-testid={`button-${testIdPrefix}-replace-image`}
                >
                  <Upload className="h-3.5 w-3.5 mr-1" />
                  Replace
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => updateStyle({ imageUrl: "", mode: "text" })}
                  data-testid={`button-${testIdPrefix}-remove-image`}
                >
                  <X className="h-3.5 w-3.5 mr-1" />
                  Remove
                </Button>
              </div>
              <div className="space-y-2 mt-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-400 w-12">X Pos</span>
                  <input
                    type="range" min="0" max="100"
                    value={style.imageOffsetX ?? 50}
                    onChange={(e) => updateStyle({ imageOffsetX: Number(e.target.value) })}
                    className="flex-1 h-2 bg-slate-600 rounded-lg appearance-none cursor-pointer accent-green-500"
                    style={{ touchAction: 'none' }}
                    data-testid={`slider-${testIdPrefix}-image-offset-x`}
                  />
                  <span className="text-xs text-slate-500 w-8">{style.imageOffsetX ?? 50}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-400 w-12">Y Pos</span>
                  <input
                    type="range" min="0" max="100"
                    value={style.imageOffsetY ?? 50}
                    onChange={(e) => updateStyle({ imageOffsetY: Number(e.target.value) })}
                    className="flex-1 h-2 bg-slate-600 rounded-lg appearance-none cursor-pointer accent-green-500"
                    style={{ touchAction: 'none' }}
                    data-testid={`slider-${testIdPrefix}-image-offset-y`}
                  />
                  <span className="text-xs text-slate-500 w-8">{style.imageOffsetY ?? 50}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-400 w-12">Size</span>
                  <input
                    type="range" min="20" max="200"
                    value={style.imageScale ?? 100}
                    onChange={(e) => updateStyle({ imageScale: Number(e.target.value) })}
                    className="flex-1 h-2 bg-slate-600 rounded-lg appearance-none cursor-pointer accent-green-500"
                    style={{ touchAction: 'none' }}
                    data-testid={`slider-${testIdPrefix}-image-scale`}
                  />
                  <span className="text-xs text-slate-500 w-8">{style.imageScale ?? 100}%</span>
                </div>
              </div>
            </div>
          ) : (
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-slate-600 rounded-md p-4 flex flex-col items-center gap-1.5 cursor-pointer hover:bg-slate-700/30 transition-colors"
              data-testid={`dropzone-${testIdPrefix}-upload`}
            >
              <Upload className="h-6 w-6 text-slate-400" />
              <p className="text-xs text-slate-400">Tap to upload an image</p>
              <p className="text-[10px] text-slate-500">PNG, JPG, SVG, or WebP</p>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          <Input
            value={style.text || ''}
            onChange={(e) => updateStyle({ text: e.target.value })}
            placeholder={`Enter ${label.toLowerCase()}...`}
            className="bg-slate-700 border-slate-600 text-white h-10"
            data-testid={`input-${testIdPrefix}-text`}
          />
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400 w-12">Color</span>
            <div className="flex gap-1 flex-wrap">
              {TEXT_COLORS.map((color) => (
                <button
                  key={color}
                  onClick={() => updateStyle({ color })}
                  className={`w-6 h-6 rounded-full border-2 transition-all ${
                    style.color === color ? 'border-white scale-110' : 'border-slate-600'
                  }`}
                  style={{ backgroundColor: color }}
                  data-testid={`button-${testIdPrefix}-color-${color}`}
                />
              ))}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400 w-12">Size</span>
            <div className="flex gap-1">
              {TEXT_SIZES.map((size) => (
                <Button
                  key={size.id}
                  size="sm"
                  variant="outline"
                  onClick={() => updateStyle({ fontSize: size.value })}
                  className={`h-7 px-3 text-xs ${style.fontSize === size.value ? 'border-orange-500 text-orange-400 font-semibold' : ''}`}
                  data-testid={`button-${testIdPrefix}-size-${size.id}`}
                >
                  {size.label}
                </Button>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400 w-12">Font</span>
            <div className="flex gap-1">
              {TEXT_FONTS.map((font) => (
                <Button
                  key={font.id}
                  size="sm"
                  variant="outline"
                  onClick={() => updateStyle({ fontFamily: font.family })}
                  style={{ fontFamily: font.family }}
                  className={`h-7 px-2 text-xs ${style.fontFamily === font.family ? 'border-orange-500 text-orange-400 font-semibold' : ''}`}
                  data-testid={`button-${testIdPrefix}-font-${font.id}`}
                >
                  {font.label}
                </Button>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400 w-12">Y Pos</span>
            <input
              type="range" min="0" max="100"
              value={style.verticalOffset ?? 50}
              onChange={(e) => updateStyle({ verticalOffset: parseInt(e.target.value) })}
              className="flex-1 h-2 bg-slate-600 rounded-lg appearance-none cursor-pointer accent-green-500"
              data-testid={`slider-${testIdPrefix}-position`}
            />
            <span className="text-xs text-slate-500 w-8">{style.verticalOffset ?? 50}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400 w-12">X Pos</span>
            <input
              type="range" min="0" max="100"
              value={style.horizontalOffset ?? 50}
              onChange={(e) => updateStyle({ horizontalOffset: parseInt(e.target.value) })}
              className="flex-1 h-2 bg-slate-600 rounded-lg appearance-none cursor-pointer accent-green-500"
              data-testid={`slider-${testIdPrefix}-xposition`}
            />
            <span className="text-xs text-slate-500 w-8">{style.horizontalOffset ?? 50}</span>
          </div>
        </div>
      )}
    </div>
  );
}

export function TextEditStep({ 
  layout,
  background,
  headerStyle,
  footerStyle,
  onHeaderChange,
  onFooterChange
}: { 
  layout: TextLayoutChoice;
  background: string;
  headerStyle: TextStyleConfig;
  footerStyle: TextStyleConfig;
  onHeaderChange: (style: TextStyleConfig) => void;
  onFooterChange: (style: TextStyleConfig) => void;
}) {
  const showHeader = layout === 'header' || layout === 'both';
  const showFooter = layout === 'footer' || layout === 'both';

  return (
    <div className="space-y-4">
      <div className="text-center">
        <h2 className="text-xl font-bold text-white mb-1">Add Your Text</h2>
        <p className="text-slate-400 text-sm">Type your message and style it</p>
      </div>

      {showHeader && (
        <TextStyleSection
          label="Header Text"
          style={headerStyle}
          onStyleChange={onHeaderChange}
          testIdPrefix="header"
        />
      )}

      <div className="flex justify-center py-2">
        <PhoneMockup
          background={background}
          headerText={showHeader ? headerStyle.text : undefined}
          footerText={showFooter ? footerStyle.text : undefined}
          headerStyle={showHeader ? headerStyle : undefined}
          footerStyle={showFooter ? footerStyle : undefined}
        />
      </div>

      {showFooter && (
        <TextStyleSection
          label="Footer Text"
          style={footerStyle}
          onStyleChange={onFooterChange}
          testIdPrefix="footer"
        />
      )}
    </div>
  );
}

export { HeaderTextEditStep } from "./TextEditSteps";
export { FooterTextEditStep } from "./TextEditSteps";

/* HeaderTextEditStep and FooterTextEditStep moved to TextEditSteps.tsx */
