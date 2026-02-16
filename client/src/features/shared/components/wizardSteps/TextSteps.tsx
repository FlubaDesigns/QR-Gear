import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  QrCode,
  ChevronRight,
  Check,
  DollarSign,
  Type,
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
            {headerText && headerStyle?.enabled && (
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
            {footerText && footerStyle?.enabled && (
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
      description: 'Text above the QR code',
      lines: 1,
    },
    {
      id: 'footer' as TextLayoutChoice,
      label: 'Footer Only', 
      description: 'Text below the QR code',
      lines: 1,
    },
    {
      id: 'both' as TextLayoutChoice,
      label: 'Header + Footer',
      description: 'Text above and below',
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
        <h2 className="text-base font-bold text-white mb-0.5">Add Text to Your Design</h2>
        <p className="text-slate-400 text-xs max-w-xs mx-auto">
          {context === 'member'
            ? 'Each text line earns you more per sale'
            : 'Pick where text goes on your product — above the QR code, below it, or both. Each zone adds a small cost.'}
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
  const updateStyle = (updates: Partial<TextStyleConfig>) => {
    onStyleChange({ ...style, ...updates, enabled: true });
  };

  return (
    <div className="space-y-3 p-3 bg-slate-800/50 rounded-xl border border-slate-700">
      <Label className="text-white font-medium text-sm">{label}</Label>
      <Input
        value={style.text || ''}
        onChange={(e) => updateStyle({ text: e.target.value })}
        placeholder={`Enter ${label.toLowerCase()}...`}
        className="bg-slate-700 border-slate-600 text-white h-10"
        data-testid={`input-${testIdPrefix}-text`}
      />
      
      <div className="space-y-2">
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
            type="range"
            min="0"
            max="100"
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
            type="range"
            min="0"
            max="100"
            value={style.horizontalOffset ?? 50}
            onChange={(e) => updateStyle({ horizontalOffset: parseInt(e.target.value) })}
            className="flex-1 h-2 bg-slate-600 rounded-lg appearance-none cursor-pointer accent-green-500"
            data-testid={`slider-${testIdPrefix}-xposition`}
          />
          <span className="text-xs text-slate-500 w-8">{style.horizontalOffset ?? 50}</span>
        </div>
      </div>
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

export function HeaderTextEditStep({
  selectedColor,
  graphicSize,
  graphicLocation,
  headerStyle,
  onHeaderChange,
  earningsPerLine,
  context = 'member',
}: {
  selectedColor: string;
  graphicSize: GraphicSize;
  graphicLocation: GraphicLocation;
  headerStyle: TextStyleConfig;
  onHeaderChange: (style: TextStyleConfig) => void;
  earningsPerLine: number;
  context?: 'member' | 'owner';
}) {
  const colorHex = SHIRT_COLORS.find(c => c.id === selectedColor)?.hex || '#1a1a1a';

  const updateHeader = (updates: Partial<TextStyleConfig>) => {
    onHeaderChange({ ...headerStyle, ...updates, enabled: true });
  };

  const charCount = (headerStyle.text || '').length;

  const vOffset = headerStyle.verticalOffset ?? 50;
  const hOffset = headerStyle.horizontalOffset ?? 50;

  return (
    <div className="animate-in fade-in slide-in-from-right-5 duration-300 space-y-2 p-2">
      <div className="text-center">
        <h2 className="text-lg font-bold text-white mb-0" data-testid="text-header-title">Header Text</h2>
        <p className="text-slate-400 text-xs" data-testid="text-header-charcount">{charCount}/40 characters</p>
      </div>

      <div className="flex justify-center">
        <GraphicPreviewView
          headerStyle={{ ...headerStyle, enabled: true, warpPreset: "straight" }}
          footerStyle={undefined}
          backgroundColor={colorHex}
          showQRCode={true}
          aspectRatio="portrait"
        />
      </div>

      <textarea
        value={headerStyle.text || ''}
        onChange={(e) => {
          let val = e.target.value;
          if (val.length > 40) val = val.slice(0, 40);
          const lineArr = val.split('\n');
          if (lineArr.length > 2) val = lineArr.slice(0, 2).join('\n');
          updateHeader({ text: val });
        }}
        placeholder="Enter header text (max 40 chars, 2 lines)"
        maxLength={40}
        rows={2}
        className="w-full text-sm min-h-[40px] px-2 py-1.5 bg-slate-700 border border-slate-600 text-white rounded resize-none focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-500"
        data-testid="textarea-header-text"
      />
      <div className="flex items-center justify-between">
        <div className="text-xs text-slate-500">{charCount}/40</div>
        {earningsPerLine > 0 && (
          <div className={`flex items-center gap-1 py-0.5 px-2 rounded-full animate-in fade-in duration-500 ${
            context === 'owner' ? 'bg-blue-500/15 border border-blue-500/25' : 'bg-green-500/15 border border-green-500/25'
          }`} data-testid="badge-header-earnings">
            <DollarSign className={`w-3 h-3 ${context === 'owner' ? 'text-blue-400' : 'text-green-400'}`} />
            <span className={`font-bold text-xs ${context === 'owner' ? 'text-blue-400' : 'text-green-400'}`}>
              +${earningsPerLine.toFixed(2)} {context === 'owner' ? 'for this line' : 'for this line'}
            </span>
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-xs text-slate-500">Color:</span>
        {SHIRT_TEXT_COLORS.map((color) => (
          <button
            key={color}
            onClick={() => updateHeader({ color })}
            className={`w-5 h-5 rounded-full border-2 transition-all ${
              headerStyle.color === color ? 'border-white scale-110' : 'border-slate-600'
            }`}
            style={{ backgroundColor: color }}
            data-testid={`btn-header-color-${color.replace('#', '')}`}
          />
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-xs text-slate-500">Size:</span>
        {SHIRT_TEXT_SIZES.map((size) => (
          <Button
            key={size.id}
            size="sm"
            variant="outline"
            onClick={() => updateHeader({ fontSize: size.value })}
            className={`h-7 px-3 text-xs ${headerStyle.fontSize === size.value ? 'border-orange-500 text-orange-400 font-semibold' : ''}`}
            data-testid={`btn-header-size-${size.id}`}
          >
            {size.label}
          </Button>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-xs text-slate-500">Font:</span>
        {SHIRT_TEXT_FONTS.map((font) => (
          <Button
            key={font.id}
            size="sm"
            variant="outline"
            onClick={() => updateHeader({ fontFamily: font.family })}
            style={{ fontFamily: font.family }}
            className={`h-7 px-3 text-xs ${headerStyle.fontFamily === font.family ? 'border-orange-500 text-orange-400 font-semibold' : ''}`}
            data-testid={`btn-header-font-${font.id}`}
          >
            {font.label}
          </Button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] text-slate-400 font-bold w-3">Y</span>
          <input
            type="range"
            min="0"
            max="100"
            value={vOffset}
            onChange={(e) => updateHeader({ verticalOffset: Number(e.target.value) })}
            className="flex-1 h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer"
            style={{ touchAction: 'none' }}
            data-testid="slider-header-vertical"
          />
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] text-slate-400 font-bold w-3">X</span>
          <input
            type="range"
            min="0"
            max="100"
            value={hOffset}
            onChange={(e) => updateHeader({ horizontalOffset: Number(e.target.value) })}
            className="flex-1 h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer"
            style={{ touchAction: 'none' }}
            data-testid="slider-header-horizontal"
          />
        </div>
      </div>
    </div>
  );
}

export function FooterTextEditStep({
  selectedColor,
  graphicSize,
  graphicLocation,
  footerStyle,
  onFooterChange,
  headerStyle,
  earningsPerLine,
  context = 'member',
}: {
  selectedColor: string;
  graphicSize: GraphicSize;
  graphicLocation: GraphicLocation;
  footerStyle: TextStyleConfig;
  onFooterChange: (style: TextStyleConfig) => void;
  headerStyle: TextStyleConfig;
  earningsPerLine: number;
  context?: 'member' | 'owner';
}) {
  const colorHex = SHIRT_COLORS.find(c => c.id === selectedColor)?.hex || '#1a1a1a';

  const updateFooter = (updates: Partial<TextStyleConfig>) => {
    onFooterChange({ ...footerStyle, ...updates, enabled: true });
  };

  const charCount = (footerStyle.text || '').length;

  const vOffset = footerStyle.verticalOffset ?? 50;
  const hOffset = footerStyle.horizontalOffset ?? 50;

  return (
    <div className="animate-in fade-in slide-in-from-right-5 duration-300 space-y-2 p-2">
      <div className="text-center">
        <h2 className="text-lg font-bold text-white mb-0" data-testid="text-footer-title">Footer Text</h2>
        <p className="text-slate-400 text-xs" data-testid="text-footer-charcount">{charCount}/40 characters</p>
      </div>

      <div className="flex justify-center">
        <GraphicPreviewView
          headerStyle={headerStyle?.text ? { ...headerStyle, enabled: true, warpPreset: "straight" } : undefined}
          footerStyle={{ ...footerStyle, enabled: true, warpPreset: "straight" }}
          backgroundColor={colorHex}
          showQRCode={true}
          aspectRatio="portrait"
        />
      </div>

      <textarea
        value={footerStyle.text || ''}
        onChange={(e) => {
          let val = e.target.value;
          if (val.length > 40) val = val.slice(0, 40);
          const lineArr = val.split('\n');
          if (lineArr.length > 2) val = lineArr.slice(0, 2).join('\n');
          updateFooter({ text: val });
        }}
        placeholder="Enter footer text (max 40 chars, 2 lines)"
        maxLength={40}
        rows={2}
        className="w-full text-sm min-h-[40px] px-2 py-1.5 bg-slate-700 border border-slate-600 text-white rounded resize-none focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-500"
        data-testid="textarea-footer-text"
      />
      <div className="flex items-center justify-between">
        <div className="text-xs text-slate-500">{charCount}/40</div>
        {earningsPerLine > 0 && (
          <div className={`flex items-center gap-1 py-0.5 px-2 rounded-full animate-in fade-in duration-500 ${
            context === 'owner' ? 'bg-blue-500/15 border border-blue-500/25' : 'bg-green-500/15 border border-green-500/25'
          }`} data-testid="badge-footer-earnings">
            <DollarSign className={`w-3 h-3 ${context === 'owner' ? 'text-blue-400' : 'text-green-400'}`} />
            <span className={`font-bold text-xs ${context === 'owner' ? 'text-blue-400' : 'text-green-400'}`}>
              +${earningsPerLine.toFixed(2)} for this line
            </span>
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-1">
        <span className="text-xs text-slate-500">Color:</span>
        {SHIRT_TEXT_COLORS.map((color) => (
          <button
            key={color}
            onClick={() => updateFooter({ color })}
            className={`w-5 h-5 rounded-full border-2 transition-all ${
              footerStyle.color === color ? 'border-white scale-110' : 'border-slate-600'
            }`}
            style={{ backgroundColor: color }}
            data-testid={`btn-footer-color-${color.replace('#', '')}`}
          />
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-xs text-slate-500">Size:</span>
        {SHIRT_TEXT_SIZES.map((size) => (
          <Button
            key={size.id}
            size="sm"
            variant="outline"
            onClick={() => updateFooter({ fontSize: size.value })}
            className={`h-7 px-3 text-xs ${footerStyle.fontSize === size.value ? 'border-orange-500 text-orange-400 font-semibold' : ''}`}
            data-testid={`btn-footer-size-${size.id}`}
          >
            {size.label}
          </Button>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-xs text-slate-500">Font:</span>
        {SHIRT_TEXT_FONTS.map((font) => (
          <Button
            key={font.id}
            size="sm"
            variant="outline"
            onClick={() => updateFooter({ fontFamily: font.family })}
            style={{ fontFamily: font.family }}
            className={`h-7 px-3 text-xs ${footerStyle.fontFamily === font.family ? 'border-orange-500 text-orange-400 font-semibold' : ''}`}
            data-testid={`btn-footer-font-${font.id}`}
          >
            {font.label}
          </Button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] text-slate-400 font-bold w-3">Y</span>
          <input
            type="range"
            min="0"
            max="100"
            value={vOffset}
            onChange={(e) => updateFooter({ verticalOffset: Number(e.target.value) })}
            className="flex-1 h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer"
            style={{ touchAction: 'none' }}
            data-testid="slider-footer-vertical"
          />
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] text-slate-400 font-bold w-3">X</span>
          <input
            type="range"
            min="0"
            max="100"
            value={hOffset}
            onChange={(e) => updateFooter({ horizontalOffset: Number(e.target.value) })}
            className="flex-1 h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer"
            style={{ touchAction: 'none' }}
            data-testid="slider-footer-horizontal"
          />
        </div>
      </div>
    </div>
  );
}
