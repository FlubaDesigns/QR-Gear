import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  QrCode, Check, DollarSign, Type, ImageIcon, Upload, X,
} from "lucide-react";
import { type TextStyleConfig } from "@/features/shared/components/TextStyleEditor";
import { GraphicPreviewView } from "@/features/shared/components/skins/GraphicPreviewView";
import { ZoneThumbnail } from "@/features/shared/components/ZonePreview";
import {
  type GraphicSize,
  type GraphicLocation,
  SHIRT_COLORS,
  SHIRT_TEXT_COLORS,
  SHIRT_TEXT_SIZES,
  SHIRT_TEXT_FONTS,
} from "./wizardTypes";

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
  const fileInputRef = useRef<HTMLInputElement>(null);
  const currentMode = headerStyle.mode || 'text';

  const updateHeader = (updates: Partial<TextStyleConfig>) => {
    onHeaderChange({ ...headerStyle, ...updates, enabled: true });
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = () => {
      updateHeader({ imageUrl: reader.result as string, mode: "image" });
    };
    reader.readAsDataURL(file);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const charCount = (headerStyle.text || '').length;

  const vOffset = headerStyle.verticalOffset ?? 50;
  const hOffset = headerStyle.horizontalOffset ?? 50;

  return (
    <div className="animate-in fade-in slide-in-from-right-5 duration-300 space-y-2 p-2">
      <div className="text-center">
        <h2 className="text-lg font-bold text-white mb-0" data-testid="text-header-title">Header</h2>
        <p className="text-slate-400 text-xs" data-testid="text-header-charcount">
          {currentMode === 'image' ? 'Image mode' : `${charCount}/40 characters`}
        </p>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleImageUpload}
        className="hidden"
        data-testid="input-header-file-upload"
      />

      <div className="flex justify-center">
        <GraphicPreviewView
          headerStyle={{ ...headerStyle, enabled: true, warpPreset: "straight" }}
          footerStyle={undefined}
          backgroundColor={colorHex}
          showQRCode={true}
          aspectRatio="portrait"
        />
      </div>

      <div className="flex gap-1 p-1 bg-slate-700 rounded-md" data-testid="toggle-header-mode">
        <button
          type="button"
          onClick={() => updateHeader({ mode: "text" })}
          className={`flex-1 flex items-center justify-center gap-1.5 min-h-[36px] rounded-sm text-xs font-medium transition-colors ${
            currentMode === "text"
              ? "bg-slate-600 text-white shadow-sm"
              : "text-slate-400 hover:text-white"
          }`}
          data-testid="button-header-mode-text"
        >
          <Type className="h-3.5 w-3.5" />
          Text
        </button>
        <button
          type="button"
          onClick={() => updateHeader({ mode: "image" })}
          className={`flex-1 flex items-center justify-center gap-1.5 min-h-[36px] rounded-sm text-xs font-medium transition-colors ${
            currentMode === "image"
              ? "bg-slate-600 text-white shadow-sm"
              : "text-slate-400 hover:text-white"
          }`}
          data-testid="button-header-mode-image"
        >
          <ImageIcon className="h-3.5 w-3.5" />
          Image
        </button>
      </div>

      {currentMode === "image" ? (
        <div className="space-y-2">
          {headerStyle.imageUrl ? (
            <div>
              <div className="border border-slate-600 rounded-md p-2 bg-slate-700/50">
                <img
                  src={headerStyle.imageUrl}
                  alt="Header image"
                  className="w-full max-h-[100px] object-contain rounded"
                  data-testid="img-header-image-preview"
                />
              </div>
              <div className="flex gap-2 mt-2">
                <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} data-testid="button-header-replace-image">
                  <Upload className="h-3.5 w-3.5 mr-1" />Replace
                </Button>
                <Button variant="outline" size="sm" onClick={() => updateHeader({ imageUrl: "", mode: "text" })} data-testid="button-header-remove-image">
                  <X className="h-3.5 w-3.5 mr-1" />Remove
                </Button>
              </div>
              <div className="space-y-2 mt-2">
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] text-slate-400 font-bold w-6">X</span>
                  <input type="range" min="0" max="100" value={headerStyle.horizontalOffset ?? 50}
                    onChange={(e) => updateHeader({ horizontalOffset: Number(e.target.value) })}
                    className="flex-1 touch-slider"
                    style={{ touchAction: 'none' }} data-testid="slider-header-image-offset-x" />
                  <span className="text-xs text-slate-500 w-8">{headerStyle.horizontalOffset ?? 50}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] text-slate-400 font-bold w-6">Y</span>
                  <input type="range" min="0" max="100" value={headerStyle.verticalOffset ?? 50}
                    onChange={(e) => updateHeader({ verticalOffset: Number(e.target.value) })}
                    className="flex-1 touch-slider"
                    style={{ touchAction: 'none' }} data-testid="slider-header-image-offset-y" />
                  <span className="text-xs text-slate-500 w-8">{headerStyle.verticalOffset ?? 50}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] text-slate-400 font-bold w-6">Size</span>
                  <input type="range" min="20" max="200" value={headerStyle.imageScale ?? 100}
                    onChange={(e) => updateHeader({ imageScale: Number(e.target.value) })}
                    className="flex-1 touch-slider"
                    style={{ touchAction: 'none' }} data-testid="slider-header-image-scale" />
                  <span className="text-xs text-slate-500 w-8">{headerStyle.imageScale ?? 100}%</span>
                </div>
              </div>
            </div>
          ) : (
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-slate-600 rounded-md p-4 flex flex-col items-center gap-1.5 cursor-pointer hover:bg-slate-700/30 transition-colors"
              data-testid="dropzone-header-upload"
            >
              <Upload className="h-6 w-6 text-slate-400" />
              <p className="text-xs text-slate-400">Tap to upload a header image</p>
              <p className="text-[10px] text-slate-500">PNG, JPG, SVG, or WebP</p>
            </div>
          )}
          {earningsPerLine > 0 && (
            <div className={`flex items-center gap-1 py-0.5 px-2 rounded-full animate-in fade-in duration-500 w-fit mx-auto ${
              context === 'owner' ? 'bg-blue-500/15 border border-blue-500/25' : 'bg-green-500/15 border border-green-500/25'
            }`} data-testid="badge-header-earnings">
              <DollarSign className={`w-3 h-3 ${context === 'owner' ? 'text-blue-400' : 'text-green-400'}`} />
              <span className={`font-bold text-xs ${context === 'owner' ? 'text-blue-400' : 'text-green-400'}`}>
                +${earningsPerLine.toFixed(2)} for this line
              </span>
            </div>
          )}
        </div>
      ) : (
        <>
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
                  +${earningsPerLine.toFixed(2)} for this line
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
                type="range" min="0" max="100" value={vOffset}
                onChange={(e) => updateHeader({ verticalOffset: Number(e.target.value) })}
                className="flex-1 touch-slider"
                style={{ touchAction: 'none' }} data-testid="slider-header-vertical" />
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] text-slate-400 font-bold w-3">X</span>
              <input
                type="range" min="0" max="100" value={hOffset}
                onChange={(e) => updateHeader({ horizontalOffset: Number(e.target.value) })}
                className="flex-1 touch-slider"
                style={{ touchAction: 'none' }} data-testid="slider-header-horizontal" />
            </div>
          </div>
        </>
      )}
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
  const fileInputRef = useRef<HTMLInputElement>(null);
  const currentMode = footerStyle.mode || 'text';

  const updateFooter = (updates: Partial<TextStyleConfig>) => {
    onFooterChange({ ...footerStyle, ...updates, enabled: true });
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = () => {
      updateFooter({ imageUrl: reader.result as string, mode: "image" });
    };
    reader.readAsDataURL(file);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const charCount = (footerStyle.text || '').length;

  const vOffset = footerStyle.verticalOffset ?? 50;
  const hOffset = footerStyle.horizontalOffset ?? 50;

  const headerHasContent = (headerStyle?.mode === 'image' && headerStyle?.imageUrl) || headerStyle?.text;

  return (
    <div className="animate-in fade-in slide-in-from-right-5 duration-300 space-y-2 p-2">
      <div className="text-center">
        <h2 className="text-lg font-bold text-white mb-0" data-testid="text-footer-title">Footer</h2>
        <p className="text-slate-400 text-xs" data-testid="text-footer-charcount">
          {currentMode === 'image' ? 'Image mode' : `${charCount}/40 characters`}
        </p>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleImageUpload}
        className="hidden"
        data-testid="input-footer-file-upload"
      />

      <div className="flex justify-center">
        <GraphicPreviewView
          headerStyle={headerHasContent ? { ...headerStyle, enabled: true, warpPreset: "straight" } : undefined}
          footerStyle={{ ...footerStyle, enabled: true, warpPreset: "straight" }}
          backgroundColor={colorHex}
          showQRCode={true}
          aspectRatio="portrait"
        />
      </div>

      <div className="flex gap-1 p-1 bg-slate-700 rounded-md" data-testid="toggle-footer-mode">
        <button
          type="button"
          onClick={() => updateFooter({ mode: "text" })}
          className={`flex-1 flex items-center justify-center gap-1.5 min-h-[36px] rounded-sm text-xs font-medium transition-colors ${
            currentMode === "text"
              ? "bg-slate-600 text-white shadow-sm"
              : "text-slate-400 hover:text-white"
          }`}
          data-testid="button-footer-mode-text"
        >
          <Type className="h-3.5 w-3.5" />
          Text
        </button>
        <button
          type="button"
          onClick={() => updateFooter({ mode: "image" })}
          className={`flex-1 flex items-center justify-center gap-1.5 min-h-[36px] rounded-sm text-xs font-medium transition-colors ${
            currentMode === "image"
              ? "bg-slate-600 text-white shadow-sm"
              : "text-slate-400 hover:text-white"
          }`}
          data-testid="button-footer-mode-image"
        >
          <ImageIcon className="h-3.5 w-3.5" />
          Image
        </button>
      </div>

      {currentMode === "image" ? (
        <div className="space-y-2">
          {footerStyle.imageUrl ? (
            <div>
              <div className="border border-slate-600 rounded-md p-2 bg-slate-700/50">
                <img
                  src={footerStyle.imageUrl}
                  alt="Footer image"
                  className="w-full max-h-[100px] object-contain rounded"
                  data-testid="img-footer-image-preview"
                />
              </div>
              <div className="flex gap-2 mt-2">
                <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} data-testid="button-footer-replace-image">
                  <Upload className="h-3.5 w-3.5 mr-1" />Replace
                </Button>
                <Button variant="outline" size="sm" onClick={() => updateFooter({ imageUrl: "", mode: "text" })} data-testid="button-footer-remove-image">
                  <X className="h-3.5 w-3.5 mr-1" />Remove
                </Button>
              </div>
              <div className="space-y-2 mt-2">
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] text-slate-400 font-bold w-6">X</span>
                  <input type="range" min="0" max="100" value={footerStyle.horizontalOffset ?? 50}
                    onChange={(e) => updateFooter({ horizontalOffset: Number(e.target.value) })}
                    className="flex-1 touch-slider"
                    style={{ touchAction: 'none' }} data-testid="slider-footer-image-offset-x" />
                  <span className="text-xs text-slate-500 w-8">{footerStyle.horizontalOffset ?? 50}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] text-slate-400 font-bold w-6">Y</span>
                  <input type="range" min="0" max="100" value={footerStyle.verticalOffset ?? 50}
                    onChange={(e) => updateFooter({ verticalOffset: Number(e.target.value) })}
                    className="flex-1 touch-slider"
                    style={{ touchAction: 'none' }} data-testid="slider-footer-image-offset-y" />
                  <span className="text-xs text-slate-500 w-8">{footerStyle.verticalOffset ?? 50}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] text-slate-400 font-bold w-6">Size</span>
                  <input type="range" min="20" max="200" value={footerStyle.imageScale ?? 100}
                    onChange={(e) => updateFooter({ imageScale: Number(e.target.value) })}
                    className="flex-1 touch-slider"
                    style={{ touchAction: 'none' }} data-testid="slider-footer-image-scale" />
                  <span className="text-xs text-slate-500 w-8">{footerStyle.imageScale ?? 100}%</span>
                </div>
              </div>
            </div>
          ) : (
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-slate-600 rounded-md p-4 flex flex-col items-center gap-1.5 cursor-pointer hover:bg-slate-700/30 transition-colors"
              data-testid="dropzone-footer-upload"
            >
              <Upload className="h-6 w-6 text-slate-400" />
              <p className="text-xs text-slate-400">Tap to upload a footer image</p>
              <p className="text-[10px] text-slate-500">PNG, JPG, SVG, or WebP</p>
            </div>
          )}
          {earningsPerLine > 0 && (
            <div className={`flex items-center gap-1 py-0.5 px-2 rounded-full animate-in fade-in duration-500 w-fit mx-auto ${
              context === 'owner' ? 'bg-blue-500/15 border border-blue-500/25' : 'bg-green-500/15 border border-green-500/25'
            }`} data-testid="badge-footer-earnings">
              <DollarSign className={`w-3 h-3 ${context === 'owner' ? 'text-blue-400' : 'text-green-400'}`} />
              <span className={`font-bold text-xs ${context === 'owner' ? 'text-blue-400' : 'text-green-400'}`}>
                +${earningsPerLine.toFixed(2)} for this line
              </span>
            </div>
          )}
        </div>
      ) : (
        <>
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
                type="range" min="0" max="100" value={vOffset}
                onChange={(e) => updateFooter({ verticalOffset: Number(e.target.value) })}
                className="flex-1 touch-slider"
                style={{ touchAction: 'none' }} data-testid="slider-footer-vertical" />
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] text-slate-400 font-bold w-3">X</span>
              <input
                type="range" min="0" max="100" value={hOffset}
                onChange={(e) => updateFooter({ horizontalOffset: Number(e.target.value) })}
                className="flex-1 touch-slider"
                style={{ touchAction: 'none' }} data-testid="slider-footer-horizontal" />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
