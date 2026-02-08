import { Loader2, Type, ShoppingBag, Library, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { type QRPlusSaveOption, SHIRT_COLORS } from "./wizardTypes";

export function QRPlusMockupStep({
  mockupUrl,
  isLoading,
  selectedColor,
  selectedSize,
  headerText,
  footerText
}: {
  mockupUrl: string;
  isLoading: boolean;
  selectedColor: string;
  selectedSize: string;
  headerText?: string;
  footerText?: string;
}) {
  const colorName = SHIRT_COLORS.find(c => c.id === selectedColor)?.name || selectedColor;
  
  // Debug: Log what we received
  console.log('[QRPlusMockupStep] Rendering with:', { 
    mockupUrl: mockupUrl?.substring(0, 60) || 'EMPTY', 
    isLoading, 
    selectedColor 
  });
  
  return (
    <div className="text-center space-y-6">
      <div>
        <h2 className="text-lg font-bold text-white mb-2">Your QR Plus Preview</h2>
        <p className="text-slate-400">Here's your shirt with the full graphic!</p>
      </div>
      
      {/* Debug info */}
      <div className="text-xs text-slate-500">
        Loading: {isLoading ? 'Yes' : 'No'} | URL: {mockupUrl ? mockupUrl.substring(0, 40) + '...' : 'None'}
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
            onError={(e) => console.error('[QRPlusMockupStep] Image failed to load:', mockupUrl)}
          />
          <div className="mt-4 flex items-center justify-center gap-4 text-sm text-slate-400">
            <span className="bg-slate-700 px-3 py-1 rounded-full">{colorName}</span>
            <span className="bg-slate-700 px-3 py-1 rounded-full">Size {selectedSize}</span>
          </div>
          {(headerText || footerText) && (
            <div className="mt-3 text-sm text-slate-500">
              {headerText && <p>Header: {headerText}</p>}
              {footerText && <p>Footer: {footerText}</p>}
            </div>
          )}
        </div>
      ) : (
        <div className="max-w-sm mx-auto bg-slate-800 rounded-xl p-8 border border-slate-700">
          <div className="w-32 h-40 mx-auto bg-slate-700 rounded-lg flex items-center justify-center mb-4">
            <Type className="w-12 h-12 text-slate-500" />
          </div>
          <p className="text-slate-400 text-sm">No mockup available</p>
        </div>
      )}
    </div>
  );
}

// QR Plus Step 2: Save to library prompt (reuses same options as QR Basic)
export function QRPlusSaveChoiceStep({
  selected,
  onSelect
}: {
  selected: QRPlusSaveOption;
  onSelect: (choice: QRPlusSaveOption) => void;
}) {
  const options: { id: QRPlusSaveOption; label: string; description: string; icon: React.ReactNode }[] = [
    { id: 'item', label: 'Save Item Only', description: 'Save the shirt design to your library', icon: <ShoppingBag className="w-8 h-8" /> },
    { id: 'graphic', label: 'Save Graphic Only', description: 'Save the graphic (with text) to reuse', icon: <Type className="w-8 h-8" /> },
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
            data-testid={`button-qr-plus-save-${option.id}`}
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

// QR Plus Step 3: Confirmation based on save choice
export function QRPlusConfirmStep({
  saveChoice,
  mockupUrl,
  productGraphicUrl,
  qrGraphicUrl,
  isSaving,
  onDone
}: {
  saveChoice: QRPlusSaveOption;
  mockupUrl: string | null;
  productGraphicUrl: string | null;
  qrGraphicUrl: string | null;
  isSaving: boolean;
  onDone: () => void;
}) {
  return (
    <div className="text-center space-y-6">
      <div>
        <div className="w-20 h-20 mx-auto bg-green-500 rounded-full flex items-center justify-center mb-4">
          <Check className="w-10 h-10 text-white" />
        </div>
        <h2 className="text-lg font-bold text-white mb-2">Saved!</h2>
        <p className="text-slate-400">Your QR Plus design has been saved to your library.</p>
      </div>
      
      {/* Always show all saved assets */}
      <div className="flex flex-wrap justify-center gap-4 max-w-md mx-auto">
        {mockupUrl && (
          <div className="bg-slate-800 rounded-xl p-3 border border-slate-700">
            <img src={mockupUrl} alt="Shirt mockup" className="w-28 h-28 object-contain mx-auto mb-2" />
            <p className="text-xs text-slate-400">Shirt Mockup</p>
          </div>
        )}
        {productGraphicUrl && (
          <div className="bg-slate-800 rounded-xl p-3 border border-slate-700">
            <img src={productGraphicUrl} alt="Product graphic" className="w-28 h-28 object-contain mx-auto mb-2" />
            <p className="text-xs text-slate-400">Product Graphic</p>
          </div>
        )}
        {qrGraphicUrl && (
          <div className="bg-slate-800 rounded-xl p-3 border border-slate-700">
            <img src={qrGraphicUrl} alt="QR code" className="w-28 h-28 object-contain mx-auto mb-2" />
            <p className="text-xs text-slate-400">QR Code</p>
          </div>
        )}
      </div>
      
      {/* Debug: Show what was saved */}
      <div className="text-xs text-slate-500 space-y-1">
        <p>Mockup: {mockupUrl ? '✓' : '✗'}</p>
        <p>Graphic: {productGraphicUrl ? '✓' : '✗'}</p>
        <p>QR Code: {qrGraphicUrl ? '✓' : '✗'}</p>
      </div>
      
      <Button
        onClick={onDone}
        disabled={isSaving}
        className="px-8 py-4 bg-green-600 hover:bg-green-700 text-lg"
        data-testid="button-qr-plus-done"
      >
        {isSaving ? <Loader2 className="w-5 h-5 mr-2 animate-spin" /> : null}
        Done
      </Button>
    </div>
  );
}
