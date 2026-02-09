import { useState, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Package, Check, DollarSign } from "lucide-react";
import { type AllowedProduct, SHIRT_COLORS, SHIRT_SIZES, type PlacementOption } from "./wizardTypes";

export type WizardContextType = 'member' | 'owner';

export function ProductPickerStep({
  selectedProduct,
  onSelect,
  context = 'member'
}: {
  selectedProduct: AllowedProduct | null;
  onSelect: (product: AllowedProduct) => void;
  context?: WizardContextType;
}) {
  const [zoomedImage, setZoomedImage] = useState<{ url: string; title: string; product: AllowedProduct } | null>(null);
  const { data: productsData, isLoading } = useQuery<{ products: AllowedProduct[] }>({
    queryKey: ["/api/members/allowed-products"],
  });
  
  const products = productsData?.products || [];
  
  if (isLoading) {
    return (
      <div className="text-center py-8">
        <Loader2 className="w-8 h-8 animate-spin mx-auto text-slate-400" />
        <p className="text-slate-400 mt-2">Loading products...</p>
      </div>
    );
  }
  
  if (products.length === 0) {
    return (
      <div className="text-center py-8 space-y-3">
        <Package className="w-12 h-12 mx-auto text-slate-500" />
        <h2 className="text-lg font-bold text-white">No Products Available</h2>
        <p className="text-slate-400 text-sm">Contact admin to unlock products for you.</p>
      </div>
    );
  }
  
  return (
    <div className="space-y-2 animate-in fade-in slide-in-from-right-5 duration-300">
      <div className="text-center">
        <h2 className="text-base font-bold text-white mb-0.5">Pick Your Product</h2>
        <p className="text-slate-400 text-xs">Tap image to zoom</p>
      </div>
      
      <div className="max-h-[45vh] overflow-y-auto pr-1 space-y-1.5">
        {products.map((product) => (
          <button
            key={product.blueprintId}
            onClick={() => onSelect(product)}
            className={`w-full flex items-center gap-3 p-2 rounded-xl border-2 transition-all text-left ${
              selectedProduct?.blueprintId === product.blueprintId
                ? 'border-orange-500 bg-orange-500/15'
                : 'border-slate-600 bg-slate-800/50 hover:border-slate-500'
            }`}
            data-testid={`button-product-${product.blueprintId}`}
          >
            {product.imageUrl ? (
              <img 
                src={product.imageUrl} 
                alt={product.title}
                className="w-14 h-14 rounded-lg object-cover bg-white flex-shrink-0 cursor-zoom-in"
                onClick={(e) => {
                  e.stopPropagation();
                  setZoomedImage({ url: product.imageUrl!, title: product.title, product });
                }}
                data-testid={`img-product-${product.blueprintId}`}
              />
            ) : (
              <div className="w-14 h-14 rounded-lg bg-slate-700 flex items-center justify-center flex-shrink-0">
                <Package className="w-7 h-7 text-slate-500" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-white font-medium text-sm truncate">{product.title}</p>
              {product.brand && (
                <p className="text-xs text-slate-400">{product.brand}</p>
              )}
              {context === 'member' && product.memberEarnings && (
                <p className="text-xs text-green-400">Earn ${product.memberEarnings.toFixed(2)}</p>
              )}
              {context === 'owner' && product.retailPrice && (
                <p className="text-xs text-blue-400">${product.retailPrice.toFixed(2)}</p>
              )}
            </div>
            {selectedProduct?.blueprintId === product.blueprintId && (
              <Check className="w-5 h-5 text-orange-500 flex-shrink-0" />
            )}
          </button>
        ))}
      </div>

      {zoomedImage && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={() => setZoomedImage(null)}
          data-testid="overlay-product-zoom"
        >
          <div 
            className="relative max-w-[85vw] max-h-[80vh] animate-in zoom-in-90 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={zoomedImage.url}
              alt={zoomedImage.title}
              className="w-full h-auto max-h-[60vh] object-contain rounded-xl shadow-2xl"
            />
            <p className="text-white text-center text-sm font-medium mt-3 mb-3">{zoomedImage.title}</p>
            <Button
              onClick={() => {
                onSelect(zoomedImage.product);
                setZoomedImage(null);
              }}
              className="w-full bg-green-500 hover:bg-green-600 shadow-lg shadow-green-500/40 transition-all duration-300"
              style={{ animation: "glow 1.2s ease-in-out infinite" }}
              data-testid="button-zoom-select"
            >
              <Check className="w-4 h-4 mr-2" />
              Select This Product
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export function ProductCongratsStep({
  productName,
  earnings
}: {
  productName: string;
  earnings: number;
}) {
  const [showAmount, setShowAmount] = useState(false);
  
  useEffect(() => {
    const timer = setTimeout(() => setShowAmount(true), 300);
    return () => clearTimeout(timer);
  }, []);
  
  return (
    <div className="flex flex-col items-center justify-center py-4 space-y-4 animate-in fade-in slide-in-from-right-5 duration-300">
      <div className="relative">
        <div className="absolute inset-0 bg-green-500/20 rounded-full blur-3xl animate-pulse" />
        <div className="relative bg-gradient-to-br from-green-500 to-emerald-600 rounded-full p-4">
          <DollarSign className="w-12 h-12 text-white" />
        </div>
      </div>
      
      <div className="text-center space-y-3">
        <h2 className="text-lg font-bold text-white">
          Congratulations!
        </h2>
        <p className="text-slate-300">
          You selected the <span className="text-white font-semibold">{productName}</span>
        </p>
      </div>
      
      <div className={`transition-all duration-700 ${showAmount ? 'opacity-100 scale-100' : 'opacity-0 scale-75'}`}>
        <div className="bg-slate-800/80 rounded-2xl p-6 border border-green-500/30">
          <p className="text-slate-400 text-sm mb-2">Starting potential earnings</p>
          <div className="text-3xl font-bold text-green-400">
            ${(earnings || 0).toFixed(2)}+
          </div>
          <p className="text-slate-500 text-xs mt-2">As you add options, you earn more!</p>
        </div>
      </div>
    </div>
  );
}

export function ColorPickerStep({
  selectedColor,
  onSelect,
  context = 'member'
}: {
  selectedColor: string;
  onSelect: (color: string) => void;
  context?: WizardContextType;
}) {
  return (
    <div className="text-center space-y-6 animate-in fade-in slide-in-from-right-5 duration-300">
      <div>
        <h2 className="text-lg font-bold text-white mb-2">Choose Your Color</h2>
        <p className="text-slate-400">What color would you like?</p>
      </div>
      
      <div className="flex justify-center items-center gap-2 max-w-[280px] mx-auto">
        {SHIRT_COLORS.map((color) => (
          <button
            key={color.id}
            onClick={() => onSelect(color.id)}
            className={`flex-1 aspect-square max-w-[48px] rounded-full border-3 transition-all ${
              selectedColor === color.id
                ? 'border-orange-500 scale-110'
                : 'border-slate-600 hover:border-slate-400'
            }`}
            style={{ backgroundColor: color.hex }}
            title={color.name}
            data-testid={`button-color-${color.id}`}
          />
        ))}
      </div>
      
      {selectedColor && (
        <p className="text-white font-medium">
          {SHIRT_COLORS.find(c => c.id === selectedColor)?.name}
        </p>
      )}
      
      <div className="mt-4 p-4 bg-slate-800/50 rounded-lg max-w-md mx-auto">
        <p className="text-slate-400 text-sm">
          {context === 'member'
            ? "This color creates your product's display image. Your customers can still choose their own color and size when they order."
            : "This is your product's display color. You can pick a different color and size at checkout."}
        </p>
      </div>
    </div>
  );
}

export function SizePickerStep({
  selectedSize,
  selectedColor,
  baseEarnings = 0,
  sizeEarningsBonuses,
  onSelect,
  onEarningsAnimate,
  selectedPlacements = [],
  context = 'member'
}: {
  selectedSize: string;
  selectedColor: string;
  baseEarnings?: number;
  sizeEarningsBonuses: Record<string, number>;
  onSelect: (size: string) => void;
  onEarningsAnimate?: (amount: number) => void;
  selectedPlacements?: string[];
  context?: WizardContextType;
}) {
  const [floatingEarning, setFloatingEarning] = useState<{ amount: number; key: number; x: number; y: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const colorHex = SHIRT_COLORS.find(c => c.id === selectedColor)?.hex || '#1a1a1a';
  
  const sizeScales: Record<string, number> = {
    'XS': 0.7,
    'S': 0.8,
    'M': 0.9,
    'L': 1.0,
    'XL': 1.1,
    '2XL': 1.2,
    '3XL': 1.3,
  };
  const scale = sizeScales[selectedSize] || 0.9;
  const shirtWidth = Math.round(120 * scale);
  const shirtHeight = Math.round(140 * scale);
  
  return (
    <div ref={containerRef} className="text-center space-y-3 animate-in fade-in slide-in-from-right-5 duration-300 relative">
      <div>
        <h2 className="text-xl font-bold text-white mb-1">What Size?</h2>
        <p className="text-slate-400 text-sm">
          {context === 'member' ? 'For preview - customers pick their own size' : 'Pick your size'}
        </p>
      </div>
      
      {floatingEarning && (
        <div
          key={floatingEarning.key}
          className="absolute pointer-events-none z-20"
          style={{ left: floatingEarning.x, top: floatingEarning.y }}
        >
          <div className={`animate-cash-to-top font-bold text-xl flex items-center gap-1 rounded-full px-4 py-1.5 shadow-xl whitespace-nowrap ${
            context === 'owner'
              ? 'text-blue-200 bg-blue-500/30 border-2 border-blue-400/60 shadow-blue-400/40'
              : 'text-green-200 bg-green-500/30 border-2 border-green-400/60 shadow-green-400/40'
          }`}>
            <DollarSign className="w-4 h-4" />
            +${floatingEarning.amount.toFixed(2)}
          </div>
        </div>
      )}
      
      <div className="flex justify-center items-end h-[130px]">
        <svg 
          width={shirtWidth * 1.0} 
          height={shirtHeight * 1.0} 
          viewBox="0 0 120 140" 
          className="drop-shadow-lg transition-all duration-300"
        >
          <path
            d="M20,35 L35,20 L50,25 L60,20 L70,25 L85,20 L100,35 L95,55 L85,50 L85,120 L35,120 L35,50 L25,55 Z"
            fill={colorHex}
            stroke="#444"
            strokeWidth="2"
          />
        </svg>
          {selectedPlacements.length > 0 && (
            <p className="text-slate-400 text-xs mt-1">
              {selectedPlacements.map(p => p.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())).join(', ')}
            </p>
          )}
      </div>
      
      <div className="flex flex-wrap justify-center gap-3 max-w-md mx-auto">
        {SHIRT_SIZES.map((size) => {
          const bonus = sizeEarningsBonuses[size] || 0;
          const totalForSize = baseEarnings + bonus;
          return (
            <button
              key={size}
              onClick={(e) => {
                if (size !== selectedSize) {
                  const btnRect = e.currentTarget.getBoundingClientRect();
                  const containerRect = containerRef.current?.getBoundingClientRect();
                  if (containerRect) {
                    const x = btnRect.left - containerRect.left + btnRect.width / 2 - 50;
                    const y = btnRect.top - containerRect.top - 10;
                    setFloatingEarning({ amount: bonus, key: Date.now(), x, y });
                    setTimeout(() => setFloatingEarning(null), 1500);
                  }
                }
                onSelect(size);
              }}
              className={`w-16 h-20 rounded-lg border-2 font-bold transition-all flex flex-col items-center justify-center ${
                selectedSize === size
                  ? 'border-orange-500 bg-orange-500/15 text-orange-400'
                  : 'border-slate-600 bg-slate-800/50 text-white hover:border-slate-400'
              }`}
              data-testid={`button-size-${size}`}
            >
              <span className="text-lg">{size}</span>
              <span className={`text-[10px] ${selectedSize === size ? 'text-orange-400' : context === 'owner' ? 'text-blue-400/70' : 'text-green-400/70'}`}>
                +${bonus.toFixed(2)}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
