import { QrCode, Link2, Type, Loader2, Check, ShoppingBag, Library, Move, Maximize2 } from "lucide-react";
import { PlaceholderPreview } from "@/features/shared/components/ZonePreview";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import type { QRBasicInputType, QRBasicSaveOption, GraphicSize } from "./wizardTypes";
import { SHIRT_COLORS, generateQRCodeUrl, getPrintAreaDims } from "./wizardTypes";
import { useProductGraphicPreview } from "@/hooks/useProductGraphicPreview";

function isValidUrl(urlString: string): boolean {
  if (!urlString.trim()) return false;
  if (urlString.includes(' ')) return false;
  if (!urlString.includes('.')) return false;
  return true;
}

export function QRBasicTypeStep({
  selectedType,
  onSelect,
  selectedColor,
  graphicSize
}: {
  selectedType: QRBasicInputType;
  onSelect: (type: QRBasicInputType) => void;
  selectedColor: string;
  graphicSize: GraphicSize;
}) {
  const colorHex = SHIRT_COLORS.find(c => c.id === selectedColor)?.hex || '#1a1a1a';
  
  const outlineSize = getPrintAreaDims('front', graphicSize);
  
  return (
    <div className="text-center space-y-4 animate-in fade-in slide-in-from-right-5 duration-300">
      <div>
        <h2 className="text-lg font-bold text-white mb-2">What should the QR code link to?</h2>
        <p className="text-slate-400">Choose what people see when they scan</p>
      </div>
      
      {/* Shirt with QR code sized to match step 6 graphic size */}
      <div className="flex justify-center py-1">
        <svg width="140" height="165" viewBox="0 0 180 210" className="drop-shadow-lg">
          <path
            d="M30,52 L52,30 L75,37 L90,30 L105,37 L128,30 L150,52 L142,82 L127,75 L127,180 L53,180 L53,75 L38,82 Z"
            fill={colorHex}
            stroke="#444"
            strokeWidth="2"
          />
          {/* QR code fills the graphic area based on step 6 size */}
          {(() => {
            const qrSize = Math.min(outlineSize.w, outlineSize.h) - 2;
            const qrX = 90 - qrSize/2;
            const qrY = 90 - qrSize/2;
            const cellSize = qrSize / 7;
            return (
              <g>
                <rect x={qrX} y={qrY} width={qrSize} height={qrSize} fill="white" rx="2" />
                <rect x={qrX + cellSize * 0.5} y={qrY + cellSize * 0.5} width={cellSize * 2} height={cellSize * 2} fill="#333" />
                <rect x={qrX + cellSize * 4.5} y={qrY + cellSize * 0.5} width={cellSize * 2} height={cellSize * 2} fill="#333" />
                <rect x={qrX + cellSize * 0.5} y={qrY + cellSize * 4.5} width={cellSize * 2} height={cellSize * 2} fill="#333" />
                <rect x={qrX + cellSize * 3} y={qrY + cellSize * 3} width={cellSize} height={cellSize} fill="#333" />
                <rect x={qrX + cellSize * 0.8} y={qrY + cellSize * 0.8} width={cellSize * 1.4} height={cellSize * 1.4} fill="white" />
                <rect x={qrX + cellSize * 4.8} y={qrY + cellSize * 0.8} width={cellSize * 1.4} height={cellSize * 1.4} fill="white" />
                <rect x={qrX + cellSize * 0.8} y={qrY + cellSize * 4.8} width={cellSize * 1.4} height={cellSize * 1.4} fill="white" />
                <rect x={qrX + cellSize * 1.1} y={qrY + cellSize * 1.1} width={cellSize * 0.8} height={cellSize * 0.8} fill="#333" />
                <rect x={qrX + cellSize * 5.1} y={qrY + cellSize * 1.1} width={cellSize * 0.8} height={cellSize * 0.8} fill="#333" />
                <rect x={qrX + cellSize * 1.1} y={qrY + cellSize * 5.1} width={cellSize * 0.8} height={cellSize * 0.8} fill="#333" />
              </g>
            );
          })()}
        </svg>
      </div>
      
      <div className="grid grid-cols-1 gap-4 max-w-sm mx-auto">
        <button
          onClick={() => onSelect('url')}
          className={`p-5 rounded-xl border-2 transition-all text-left ${
            selectedType === 'url'
              ? 'border-blue-500 bg-blue-500/20'
              : 'border-slate-600 bg-slate-800/50 hover:border-slate-400'
          }`}
          data-testid="button-qr-basic-url"
        >
          <div className="flex items-center gap-4">
            <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
              selectedType === 'url' ? 'bg-blue-500' : 'bg-slate-700'
            }`}>
              <Link2 className="w-6 h-6 text-white" />
            </div>
            <div className="flex-1">
              <h3 className="font-bold text-white text-lg">Website Link (URL)</h3>
              <p className="text-slate-400 text-sm">Opens a webpage when scanned</p>
            </div>
            {selectedType === 'url' && <Check className="w-6 h-6 text-blue-400" />}
          </div>
        </button>
        
        <button
          onClick={() => onSelect('text')}
          className={`p-5 rounded-xl border-2 transition-all text-left ${
            selectedType === 'text'
              ? 'border-purple-500 bg-purple-500/20'
              : 'border-slate-600 bg-slate-800/50 hover:border-slate-400'
          }`}
          data-testid="button-qr-basic-text"
        >
          <div className="flex items-center gap-4">
            <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
              selectedType === 'text' ? 'bg-purple-500' : 'bg-slate-700'
            }`}>
              <Type className="w-6 h-6 text-white" />
            </div>
            <div className="flex-1">
              <h3 className="font-bold text-white text-lg">Text Message</h3>
              <p className="text-slate-400 text-sm">Shows text when scanned (up to 2000 characters)</p>
            </div>
            {selectedType === 'text' && <Check className="w-6 h-6 text-purple-400" />}
          </div>
        </button>
      </div>
    </div>
  );
}

export function QRBasicInputStep({
  inputType,
  content,
  onContentChange,
  selectedColor,
  graphicSize
}: {
  inputType: QRBasicInputType;
  content: string;
  onContentChange: (content: string) => void;
  selectedColor: string;
  graphicSize: GraphicSize;
}) {
  const colorHex = SHIRT_COLORS.find(c => c.id === selectedColor)?.hex || '#1a1a1a';
  const isUrl = inputType === 'url';
  const maxLength = isUrl ? 500 : 2000;
  const charCount = content.length;
  const urlError = isUrl && content.trim() !== '' && !isValidUrl(content);
  
  const outlineSize = getPrintAreaDims('front', graphicSize);
  
  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-lg font-bold text-white mb-2">
          {isUrl ? 'Enter Your Website Link' : 'Enter Your Message'}
        </h2>
        <p className="text-slate-400">
          {isUrl ? 'This opens when someone scans your QR code' : 'This text appears when someone scans your QR code'}
        </p>
      </div>
      
      {/* Shirt with dashed graphic area */}
      <div className="flex justify-center py-2">
        <svg width="140" height="160" viewBox="0 0 180 210" className="drop-shadow-lg">
          <path
            d="M30,52 L52,30 L75,37 L90,30 L105,37 L128,30 L150,52 L142,82 L127,75 L127,180 L53,180 L53,75 L38,82 Z"
            fill={colorHex}
            stroke="#444"
            strokeWidth="2"
          />
          {/* Dashed graphic area */}
          <rect
            x={90 - outlineSize.w/2}
            y={90 - outlineSize.h/2}
            width={outlineSize.w}
            height={outlineSize.h}
            fill="transparent"
            stroke="#64748b"
            strokeWidth="1.5"
            strokeDasharray="4 2"
            rx="3"
          />
          {/* QR icon in center */}
          <g transform="translate(82, 82)">
            <rect width="16" height="16" fill="white" rx="1" opacity="0.9" />
            <rect x="1" y="1" width="3" height="3" fill="#333" />
            <rect x="12" y="1" width="3" height="3" fill="#333" />
            <rect x="1" y="12" width="3" height="3" fill="#333" />
            <rect x="6" y="6" width="4" height="4" fill="#333" />
          </g>
        </svg>
      </div>
      
      <div className="max-w-md mx-auto space-y-3">
        {isUrl ? (
          <div className="space-y-2">
            <Label className="text-white font-medium">Website URL</Label>
            <Input
              value={content}
              onChange={(e) => onContentChange(e.target.value)}
              placeholder="https://example.com"
              className={`bg-slate-700 border-slate-600 text-white h-12 text-lg ${urlError ? 'border-red-500 focus:ring-red-500' : ''}`}
              data-testid="input-qr-basic-url"
            />
            {urlError ? (
              <p className="text-red-400 text-sm">Enter a valid link (e.g., example.com). No spaces allowed.</p>
            ) : (
              <p className="text-slate-500 text-xs text-right">{charCount} / {maxLength} characters</p>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            <Label className="text-white font-medium">Your Message</Label>
            <textarea
              value={content}
              onChange={(e) => {
                if (e.target.value.length <= maxLength) {
                  onContentChange(e.target.value);
                }
              }}
              placeholder="Enter your message here..."
              className="w-full h-40 bg-slate-700 border border-slate-600 text-white rounded-lg p-3 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
              data-testid="input-qr-basic-text"
            />
            <p className={`text-xs text-right ${charCount > maxLength * 0.9 ? 'text-amber-400' : 'text-slate-500'}`}>
              {charCount} / {maxLength} characters
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export function QRBasicMockupStep({
  mockupUrl,
  isLoading,
  selectedColor,
  selectedSize,
  inputType,
  content,
  qrPositionX,
  qrPositionY,
  qrSizePercent,
  onPositionXChange,
  onPositionYChange,
  onSizeChange,
}: {
  mockupUrl: string;
  isLoading: boolean;
  selectedColor: string;
  selectedSize: string;
  inputType: QRBasicInputType;
  content: string;
  qrPositionX?: number;
  qrPositionY?: number;
  qrSizePercent?: number;
  onPositionXChange?: (val: number) => void;
  onPositionYChange?: (val: number) => void;
  onSizeChange?: (val: number) => void;
}) {
  const colorName = SHIRT_COLORS.find(c => c.id === selectedColor)?.name || selectedColor;
  const showControls = onPositionXChange && onPositionYChange && onSizeChange;
  const posX = qrPositionX ?? 50;
  const posY = qrPositionY ?? 50;
  const sizeVal = qrSizePercent ?? 50;
  
  return (
    <div className="text-center space-y-4">
      <div>
        <h2 className="text-lg font-bold text-white mb-1">Your QR Shirt Preview</h2>
        <p className="text-slate-400 text-sm">
          {showControls ? "Adjust position and size below" : "Here's how your shirt will look!"}
        </p>
      </div>
      
      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-12">
          <Loader2 className="w-12 h-12 animate-spin text-blue-400 mb-4" />
          <p className="text-slate-400">Generating your preview...</p>
        </div>
      ) : mockupUrl ? (
        <div className="max-w-sm mx-auto">
          <img 
            src={mockupUrl} 
            alt="Shirt mockup preview" 
            className="w-full rounded-xl shadow-lg border border-slate-700"
          />
          <div className="mt-3 flex items-center justify-center gap-4 text-sm text-slate-400">
            <span className="bg-slate-700 px-3 py-1 rounded-full">{colorName}</span>
            <span className="bg-slate-700 px-3 py-1 rounded-full">Size {selectedSize}</span>
          </div>
        </div>
      ) : (
        <div className="max-w-sm mx-auto bg-slate-800 rounded-xl p-8 border border-slate-700">
          <PlaceholderPreview className="w-32 h-40 mx-auto mb-4" />
          <p className="text-slate-400 text-sm">
            {inputType === 'url' ? 'QR links to: ' : 'QR contains: '}
            <span className="text-white font-medium">
              {content.length > 50 ? content.substring(0, 50) + '...' : content}
            </span>
          </p>
        </div>
      )}

      {showControls && (
        <div className="space-y-3 px-2 pt-2 max-w-sm mx-auto text-left">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="text-sm text-slate-300 flex items-center gap-1.5">
                <Move className="w-3.5 h-3.5" /> Left / Right
              </Label>
              <span className="text-xs text-slate-500" data-testid="text-qr-pos-x">{posX}%</span>
            </div>
            <Slider
              value={[posX]}
              onValueChange={([v]) => onPositionXChange(v)}
              min={0}
              max={100}
              step={1}
              data-testid="slider-qr-position-x"
            />
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="text-sm text-slate-300 flex items-center gap-1.5">
                <Move className="w-3.5 h-3.5" /> Up / Down
              </Label>
              <span className="text-xs text-slate-500" data-testid="text-qr-pos-y">{posY}%</span>
            </div>
            <Slider
              value={[posY]}
              onValueChange={([v]) => onPositionYChange(v)}
              min={0}
              max={100}
              step={1}
              data-testid="slider-qr-position-y"
            />
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="text-sm text-slate-300 flex items-center gap-1.5">
                <Maximize2 className="w-3.5 h-3.5" /> QR Size
              </Label>
              <span className="text-xs text-slate-500" data-testid="text-qr-size">{sizeVal}%</span>
            </div>
            <Slider
              value={[sizeVal]}
              onValueChange={([v]) => onSizeChange(v)}
              min={20}
              max={80}
              step={1}
              data-testid="slider-qr-size"
            />
          </div>

          <div className="text-center pt-1">
            <Button
              variant="outline"
              size="sm"
              onClick={() => { onPositionXChange(50); onPositionYChange(50); onSizeChange(50); }}
              className="text-slate-300 border-slate-600"
              data-testid="button-reset-qr-position"
            >
              Reset to Center
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export function QRBasicSaveChoiceStep({
  selected,
  onSelect
}: {
  selected: QRBasicSaveOption;
  onSelect: (choice: QRBasicSaveOption) => void;
}) {
  const options: { id: QRBasicSaveOption; label: string; description: string; icon: React.ReactNode }[] = [
    { id: 'item', label: 'Save Item Only', description: 'Save the shirt design to your library', icon: <ShoppingBag className="w-8 h-8" /> },
    { id: 'graphic', label: 'Save Graphic Only', description: 'Save just the QR code graphic', icon: <QrCode className="w-8 h-8" /> },
    { id: 'both', label: 'Save Both', description: 'Save the shirt and the graphic separately', icon: <Library className="w-8 h-8" /> },
  ];
  
  return (
    <div className="text-center space-y-6">
      <div>
        <h2 className="text-lg font-bold text-white mb-2">What would you like to save?</h2>
        <p className="text-slate-400">Choose what to keep in your library</p>
      </div>
      
      <div className="grid gap-4 max-w-md mx-auto">
        {options.map((option) => (
          <button
            key={option.id}
            onClick={() => onSelect(option.id)}
            className={`p-4 rounded-xl border-2 transition-all text-left flex items-center gap-4 ${
              selected === option.id
                ? 'border-orange-500 bg-orange-500/10'
                : 'border-slate-600 bg-slate-800/50 hover:border-slate-500'
            }`}
            data-testid={`button-save-${option.id}`}
          >
            <div className={`w-14 h-14 rounded-full flex items-center justify-center ${
              selected === option.id ? 'bg-orange-500 text-white' : 'bg-slate-700 text-slate-300'
            }`}>
              {option.icon}
            </div>
            <div>
              <div className="font-semibold text-white">{option.label}</div>
              <div className="text-sm text-slate-400">{option.description}</div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

export function QRBasicConfirmStep({
  saveChoice,
  mockupUrl,
  qrContent,
  isSaving,
  onDone
}: {
  saveChoice: QRBasicSaveOption;
  mockupUrl: string | null;
  qrContent: string;
  isSaving: boolean;
  onDone: () => void;
}) {
  const getMessage = () => {
    switch (saveChoice) {
      case 'item':
        return { title: 'Item Saved!', description: 'Your shirt design has been saved to your library.' };
      case 'graphic':
        return { title: 'Graphic Saved!', description: 'Your QR code graphic has been saved to your library.' };
      case 'both':
        return { title: 'Both Saved!', description: 'Your shirt design and QR graphic have been saved to your library.' };
      default:
        return { title: 'Saved!', description: 'Your design has been saved.' };
    }
  };
  
  const message = getMessage();
  
  return (
    <div className="text-center space-y-6">
      <div>
        <div className="w-20 h-20 mx-auto bg-green-500 rounded-full flex items-center justify-center mb-4">
          <Check className="w-10 h-10 text-white" />
        </div>
        <h2 className="text-lg font-bold text-white mb-2">{message.title}</h2>
        <p className="text-slate-400">{message.description}</p>
      </div>
      
      {/* Show what was saved */}
      <div className="flex flex-wrap justify-center gap-4 max-w-md mx-auto">
        {(saveChoice === 'item' || saveChoice === 'both') && mockupUrl && (
          <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
            <img src={mockupUrl} alt="Saved item" className="w-32 h-32 object-contain mx-auto mb-2" />
            <p className="text-sm text-slate-400">Shirt Design</p>
          </div>
        )}
        {(saveChoice === 'graphic' || saveChoice === 'both') && (
          <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
            <img 
              src={generateQRCodeUrl(qrContent, 128)} 
              alt="QR Code" 
              className="w-32 h-32 object-contain mx-auto mb-2 bg-white rounded"
            />
            <p className="text-sm text-slate-400">QR Graphic</p>
          </div>
        )}
      </div>
      
      <Button
        onClick={onDone}
        disabled={isSaving}
        className="px-8 py-4 bg-green-600 hover:bg-green-700 text-lg"
        data-testid="button-qr-basic-done"
      >
        {isSaving ? <Loader2 className="w-5 h-5 mr-2 animate-spin" /> : null}
        Done
      </Button>
    </div>
  );
}

export function QRPositionStep({
  qrContent,
  qrColor = "black",
  qrPositionX,
  qrPositionY,
  qrSizePercent,
  onPositionXChange,
  onPositionYChange,
  onSizeChange,
  placement,
  headerStyle,
  footerStyle,
  backgroundColor,
}: {
  qrContent: string;
  qrColor?: "black" | "white";
  qrPositionX: number;
  qrPositionY: number;
  qrSizePercent: number;
  onPositionXChange: (val: number) => void;
  onPositionYChange: (val: number) => void;
  onSizeChange: (val: number) => void;
  placement?: string;
  headerStyle?: any;
  footerStyle?: any;
  backgroundColor?: string;
}) {
  const { dataUrl, isLoading } = useProductGraphicPreview({
    qrContent: qrContent || "https://qrgear.app",
    qrColor,
    headerStyle: headerStyle?.enabled !== false ? headerStyle : null,
    footerStyle: footerStyle?.enabled !== false ? footerStyle : null,
    backgroundColor,
    transparent: false,
    placement,
    qrPositionX,
    qrPositionY,
    qrSizePercent,
    enabled: true,
    debounceMs: 150,
  });

  return (
    <div className="space-y-4 animate-in fade-in slide-in-from-right-5 duration-300">
      <div className="text-center">
        <h2 className="text-lg font-bold text-white mb-1">Position Your QR Code</h2>
        <p className="text-slate-400 text-sm">Drag the sliders to move and resize</p>
      </div>

      <div className="flex justify-center">
        <div className="relative w-48 sm:w-56 aspect-[3/4] rounded-lg overflow-hidden border-2 border-slate-600 shadow-lg bg-slate-800">
          {isLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/40 z-10">
              <Loader2 className="w-6 h-6 animate-spin text-blue-400" />
            </div>
          )}
          {dataUrl ? (
            <img
              src={dataUrl}
              alt="QR position preview"
              className="w-full h-full object-contain"
              data-testid="img-qr-position-preview"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <QrCode className="w-12 h-12 text-slate-600" />
            </div>
          )}
        </div>
      </div>

      <div className="space-y-4 px-1">
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-sm text-slate-300 flex items-center gap-1.5">
              <Move className="w-3.5 h-3.5" /> Left / Right
            </Label>
            <span className="text-xs text-slate-500" data-testid="text-qr-pos-x">{qrPositionX}%</span>
          </div>
          <Slider
            value={[qrPositionX]}
            onValueChange={([v]) => onPositionXChange(v)}
            min={0}
            max={100}
            step={1}
            data-testid="slider-qr-position-x"
          />
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-sm text-slate-300 flex items-center gap-1.5">
              <Move className="w-3.5 h-3.5" /> Up / Down
            </Label>
            <span className="text-xs text-slate-500" data-testid="text-qr-pos-y">{qrPositionY}%</span>
          </div>
          <Slider
            value={[qrPositionY]}
            onValueChange={([v]) => onPositionYChange(v)}
            min={0}
            max={100}
            step={1}
            data-testid="slider-qr-position-y"
          />
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-sm text-slate-300 flex items-center gap-1.5">
              <Maximize2 className="w-3.5 h-3.5" /> QR Size
            </Label>
            <span className="text-xs text-slate-500" data-testid="text-qr-size">{qrSizePercent}%</span>
          </div>
          <Slider
            value={[qrSizePercent]}
            onValueChange={([v]) => onSizeChange(v)}
            min={20}
            max={80}
            step={1}
            data-testid="slider-qr-size"
          />
        </div>

        <div className="text-center">
          <Button
            variant="outline"
            size="sm"
            onClick={() => { onPositionXChange(50); onPositionYChange(50); onSizeChange(50); }}
            className="text-slate-300 border-slate-600"
            data-testid="button-reset-qr-position"
          >
            Reset to Center
          </Button>
        </div>
      </div>
    </div>
  );
}
