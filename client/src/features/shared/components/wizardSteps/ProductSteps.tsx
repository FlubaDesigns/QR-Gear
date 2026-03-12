import { useState, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Package, Check, DollarSign, X, Ruler, Palette, ShoppingBag, Crown, Star, Award, Pencil } from "lucide-react";
import { type AllowedProduct, SHIRT_COLORS, SHIRT_SIZES, type PlacementOption } from "./wizardTypes";

export type WizardContextType = 'member' | 'owner' | 'public' | 'external' | 'platform';

export function getProductFriendlyName(title?: string | null): string {
  if (!title) return 'product';
  const lower = title.toLowerCase();
  const keywords: [string, string][] = [
    ['hoodie', 'hoodie'],
    ['sweatshirt', 'sweatshirt'],
    ['tank top', 'tank top'],
    ['tank', 'tank top'],
    ['long sleeve', 'long sleeve'],
    ['polo', 'polo'],
    ['jersey', 'jersey'],
    ['jacket', 'jacket'],
    ['cap', 'cap'],
    ['hat', 'hat'],
    ['beanie', 'beanie'],
    ['tote', 'tote bag'],
    ['bag', 'bag'],
    ['mug', 'mug'],
    ['tumbler', 'tumbler'],
    ['bottle', 'bottle'],
    ['phone case', 'phone case'],
    ['case', 'case'],
    ['sticker', 'sticker'],
    ['poster', 'poster'],
    ['canvas', 'canvas'],
    ['pillow', 'pillow'],
    ['blanket', 'blanket'],
    ['towel', 'towel'],
    ['apron', 'apron'],
    ['onesie', 'onesie'],
    ['dress', 'dress'],
    ['shorts', 'shorts'],
    ['jogger', 'joggers'],
    ['legging', 'leggings'],
    ['t-shirt', 'shirt'],
    ['tee', 'shirt'],
    ['shirt', 'shirt'],
  ];
  for (const [keyword, friendly] of keywords) {
    if (lower.includes(keyword)) return friendly;
  }
  return 'product';
}

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
  const [editingPickerDesc, setEditingPickerDesc] = useState(false);
  const [pickerDescDraft, setPickerDescDraft] = useState("");
  const sectionMap: Record<string, string> = { member: 'member', public: 'public', external: 'external', platform: 'platform' };
  const sectionParam = sectionMap[context || ''] ? `?section=${sectionMap[context || '']}` : '';
  const {
    data: productsData,
    isLoading,
    error
  } = useQuery<{ products: AllowedProduct[]; source?: string }>({
    queryKey: ["/api/members/allowed-products", context],
    queryFn: async () => {
      const res = await fetch(`/api/members/allowed-products${sectionParam}`);
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(`Failed to load products (${res.status}): ${text || res.statusText}`);
      }
      return res.json();
    },
    staleTime: 300000,
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

  if (error) {
    return (
      <div className="text-center py-8 space-y-3">
        <Package className="w-12 h-12 mx-auto text-red-400" />
        <h2 className="text-lg font-bold text-white" data-testid="text-product-picker-error">Product Picker Error</h2>
        <p className="text-slate-400 text-sm">
          {error instanceof Error ? error.message : 'Failed to load products'}
        </p>
        <p className="text-slate-500 text-xs" data-testid="text-error-endpoint">
          Endpoint: /api/members/allowed-products{sectionParam}
        </p>
      </div>
    );
  }

  if (products.length === 0) {
    return (
      <div className="text-center py-8 space-y-3">
        <Package className="w-12 h-12 mx-auto text-slate-500" />
        <h2 className="text-lg font-bold text-white" data-testid="text-no-products">No Products Available</h2>
        <p className="text-slate-400 text-sm">
          No products are currently enabled for this section.
        </p>
        <p className="text-slate-500 text-xs">
          An admin needs to enable products in the catalog.
          {context === 'member' && ' Go to Admin \u2192 Blanks \u2192 Catalogs to assign products.'}
        </p>
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
                loading="lazy"
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
              {product.retailPrice != null && (
                <p className="text-base font-bold text-emerald-400">${product.retailPrice.toFixed(2)}</p>
              )}
              {context === 'member' && product.memberEarnings != null && (
                <p className="text-xs text-green-400">Earn ${product.memberEarnings.toFixed(2)}</p>
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
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={() => { setZoomedImage(null); setEditingPickerDesc(false); setPickerDescDraft(""); }}
          data-testid="overlay-product-zoom"
        >
          <div 
            className="relative w-[90vw] max-w-md max-h-[90vh] overflow-y-auto bg-slate-900 rounded-2xl border border-slate-700 shadow-2xl animate-in zoom-in-90 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => { setZoomedImage(null); setEditingPickerDesc(false); setPickerDescDraft(""); }}
              className="absolute top-3 right-3 z-10 bg-black/50 rounded-full p-1.5"
              data-testid="button-close-lightbox"
            >
              <X className="w-5 h-5 text-white" />
            </button>

            <div className="bg-white rounded-t-2xl p-4 flex items-center justify-center min-h-[200px]">
              <img
                src={zoomedImage.url}
                alt={zoomedImage.title}
                className="max-h-[40vh] w-auto object-contain"
              />
            </div>

            <div className="p-4 space-y-3">
              <h3 className="text-lg font-bold text-white">{zoomedImage.title}</h3>

              <div className="flex flex-wrap gap-2 items-center">
                {zoomedImage.product.retailPrice != null && (
                  <span className="text-2xl font-bold text-emerald-400">${zoomedImage.product.retailPrice.toFixed(2)}</span>
                )}
                {context === 'member' && zoomedImage.product.memberEarnings != null && (
                  <Badge variant="secondary" className="bg-green-500/15 text-green-400 border-green-500/30">
                    <DollarSign className="w-3 h-3 mr-1" />
                    Earn ${zoomedImage.product.memberEarnings.toFixed(2)}
                  </Badge>
                )}
              </div>

              {zoomedImage.product.brand && (
                <p className="text-xs text-slate-400">{zoomedImage.product.brand}</p>
              )}

              {context === 'member' ? (
                <div className="space-y-2">
                  {editingPickerDesc ? (
                    <>
                      <Textarea
                        value={pickerDescDraft}
                        onChange={(e) => setPickerDescDraft(e.target.value)}
                        className="text-sm min-h-[80px] bg-slate-800 border-slate-600 text-white"
                        placeholder="Customize the product description..."
                        data-testid="textarea-picker-member-desc"
                      />
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          className="bg-green-600 text-white"
                          onClick={() => {
                            if (zoomedImage) {
                              setZoomedImage({
                                ...zoomedImage,
                                product: { ...zoomedImage.product, customDescription: pickerDescDraft },
                              });
                            }
                            setEditingPickerDesc(false);
                          }}
                          data-testid="button-save-picker-member-desc"
                        >
                          Done
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-slate-300 border-slate-600"
                          onClick={() => setEditingPickerDesc(false)}
                        >
                          Cancel
                        </Button>
                      </div>
                    </>
                  ) : (
                    <div
                      className="group cursor-pointer rounded-lg border border-dashed border-slate-600 p-2"
                      onClick={() => {
                        setPickerDescDraft(zoomedImage.product.customDescription || zoomedImage.product.description || "");
                        setEditingPickerDesc(true);
                      }}
                      data-testid="button-edit-picker-member-desc"
                    >
                      <div className="flex items-start gap-2">
                        <Pencil className="w-3.5 h-3.5 mt-0.5 text-slate-400 shrink-0" />
                        {(zoomedImage.product.customDescription || zoomedImage.product.description) ? (
                          <p className="text-sm text-slate-300">{zoomedImage.product.customDescription || zoomedImage.product.description}</p>
                        ) : (
                          <p className="text-sm text-slate-500 italic">Tap to add your product description...</p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                zoomedImage.product.description && (
                  <p className="text-sm text-slate-300">{zoomedImage.product.description}</p>
                )
              )}

              {(() => {
                const colorList = zoomedImage.product.availableColors || [];
                return colorList.length > 0 ? (
                  <div className="space-y-1.5">
                    <p className="text-xs text-slate-400 flex items-center gap-1">
                      <Palette className="w-3 h-3" />
                      {colorList.length} colors
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {colorList.map((c, i) => (
                        <div
                          key={i}
                          className="w-5 h-5 rounded-full border border-slate-600"
                          style={{ backgroundColor: c.hex || "#888" }}
                          title={c.name}
                        />
                      ))}
                    </div>
                  </div>
                ) : null;
              })()}

              {(() => {
                const sizeList = zoomedImage.product.sizes || zoomedImage.product.availableSizes || [];
                return sizeList.length > 0 ? (
                  <div className="space-y-1.5">
                    <p className="text-xs text-slate-400 flex items-center gap-1">
                      <Ruler className="w-3 h-3" />
                      Sizes
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {sizeList.map((s: string) => (
                        <Badge key={s} variant="outline" className="text-xs text-slate-300 border-slate-600">
                          {s}
                        </Badge>
                      ))}
                    </div>
                  </div>
                ) : null;
              })()}

              {zoomedImage.product.placements && zoomedImage.product.placements.length > 0 && (
                <p className="text-xs text-slate-400">
                  Print areas: {zoomedImage.product.placements.map((pl: any) => pl.title || pl.id).join(', ')}
                </p>
              )}

              <Button
                onClick={() => {
                  const productToSelect = { ...zoomedImage.product };
                  onSelect(productToSelect);
                  setZoomedImage(null);
                  setEditingPickerDesc(false);
                }}
                className="w-full bg-green-600 text-white min-h-12 text-base"
                data-testid="button-zoom-select"
              >
                <Check className="w-4 h-4 mr-2" />
                Select This Product
              </Button>
            </div>
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
  context = 'member',
  productName
}: {
  selectedColor: string;
  onSelect: (color: string) => void;
  context?: WizardContextType;
  productName?: string;
}) {
  const itemName = productName || 'product';
  return (
    <div className="text-center space-y-6 animate-in fade-in slide-in-from-right-5 duration-300">
      <div>
        <h2 className="text-lg font-bold text-white mb-2">Choose Your Color</h2>
        <p className="text-slate-400">What color {itemName} would you like?</p>
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
            ? `This color creates your ${itemName}'s display image. Your customers can still choose their own color and size when they order.`
            : `Pick the color you want for your ${itemName}. This is what you'll receive!`}
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
  context = 'member',
  productName
}: {
  selectedSize: string;
  selectedColor: string;
  baseEarnings?: number;
  sizeEarningsBonuses: Record<string, number>;
  onSelect: (size: string) => void;
  onEarningsAnimate?: (amount: number) => void;
  selectedPlacements?: string[];
  context?: WizardContextType;
  productName?: string;
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
          {context === 'member' ? `For preview - customers pick their own ${productName || 'product'} size` : `Pick your ${productName || 'product'} size`}
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
                  const btnRect = (e.currentTarget as HTMLElement).getBoundingClientRect();
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
              className={`w-20 h-24 rounded-lg border-2 font-bold transition-all flex flex-col items-center justify-center ${
                selectedSize === size
                  ? 'border-orange-500 bg-orange-500/15 text-orange-400'
                  : 'border-slate-600 bg-slate-800/50 text-white hover:border-slate-400'
              }`}
              data-testid={`button-size-${size}`}
            >
              <span className="text-2xl">{size}</span>
              <span className={`text-xs ${selectedSize === size ? 'text-orange-400' : context === 'owner' ? 'text-blue-400/70' : 'text-green-400/70'}`}>
                +${bonus.toFixed(2)}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

interface TierProduct {
  blueprintId: number;
  title: string;
  imageUrl: string;
  brand?: string;
  category?: string;
  retailPrice?: number;
  memberEarnings?: number;
  description?: string;
  originalDescription?: string;
  adminDescription?: string;
  fulfillmentProvider?: string;
  cost?: number;
  availableColors?: Array<{ name: string; hex?: string }>;
  availableSizes?: string[];
}

interface TierGroup {
  tier: string;
  displayName: string;
  description: string;
  tagline: string;
  products: TierProduct[];
}

interface TierProductsResponse {
  hasTiers: boolean;
  catalogId: string;
  catalogName: string;
  tiers: Record<string, Record<string, TierGroup>>;
  tierConfig: Record<string, { displayName?: string; description?: string; tagline?: string }>;
}

const TIER_ICONS: Record<string, typeof Star> = {
  good: Star,
  better: Award,
  best: Crown,
};

const TIER_CARD_STYLES: Record<string, { border: string; bg: string; glow: string; accent: string }> = {
  good: {
    border: "border-blue-500",
    bg: "bg-blue-500/10",
    glow: "bg-blue-500/20",
    accent: "text-blue-400",
  },
  better: {
    border: "border-amber-500",
    bg: "bg-amber-500/10",
    glow: "bg-amber-500/20",
    accent: "text-amber-400",
  },
  best: {
    border: "border-emerald-500",
    bg: "bg-emerald-500/10",
    glow: "bg-emerald-500/20",
    accent: "text-emerald-400",
  },
};

export function TierPickerStep({
  selectedProduct,
  onSelect,
  context = "member",
}: {
  selectedProduct: AllowedProduct | null;
  onSelect: (product: AllowedProduct) => void;
  context?: WizardContextType;
}) {
  const [selectedTier, setSelectedTier] = useState<string | null>(null);
  const [previewProduct, setPreviewProduct] = useState<{ tp: TierProduct; product: AllowedProduct } | null>(null);
  const [editingMemberDesc, setEditingMemberDesc] = useState(false);
  const [memberDescDraft, setMemberDescDraft] = useState("");

  const sectionMap: Record<string, string> = { member: "member", public: "public", external: "external", platform: "platform", owner: "member" };
  const sectionParam = sectionMap[context] || "member";
  const { data: tierData, isLoading: loadingTiers, isError: tierError } = useQuery<TierProductsResponse>({
    queryKey: ["/api/members/tier-products", sectionParam],
    queryFn: async () => {
      const res = await fetch(`/api/members/tier-products?section=${sectionParam}`);
      if (!res.ok) throw new Error("Failed to load tiers");
      return res.json();
    },
    staleTime: 300000,
    retry: false,
  });

  if (loadingTiers) {
    return (
      <div className="text-center py-8">
        <Loader2 className="w-8 h-8 animate-spin mx-auto text-slate-400" />
        <p className="text-slate-400 mt-2">Loading options...</p>
      </div>
    );
  }

  const hasTiers = (tierData?.hasTiers && !tierError) || false;

  const allCategories = tierData?.tiers ? Object.keys(tierData.tiers) : [];
  const firstCategory = allCategories[0] || "";
  const categoryTiers = tierData?.tiers?.[firstCategory] || {};
  const tierOrder = ["good", "better", "best"];
  const availableTiers = tierOrder.filter((t) => categoryTiers[t]?.products?.length > 0);

  if (!hasTiers) {
    return (
      <ProductPickerStep
        selectedProduct={selectedProduct}
        onSelect={onSelect}
        context={context}
      />
    );
  }

  if (selectedTier && categoryTiers[selectedTier]) {
    const tierProducts = categoryTiers[selectedTier].products;
    return (
      <div className="space-y-3 animate-in fade-in slide-in-from-right-5 duration-300">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setSelectedTier(null)}
            className="text-slate-300 border-slate-600"
            data-testid="button-back-to-tiers"
          >
            Back to tiers
          </Button>
          <Badge className={`text-sm ${
            selectedTier === "good" ? "bg-blue-600 text-white" :
            selectedTier === "better" ? "bg-amber-500 text-white" :
            "bg-emerald-600 text-white"
          }`}>
            {categoryTiers[selectedTier].displayName}
          </Badge>
        </div>
        <p className="text-sm text-slate-400">{categoryTiers[selectedTier].description}</p>
        <div className="max-h-[45vh] overflow-y-auto pr-1 space-y-1.5">
          {tierProducts.map((tp) => {
            const product: AllowedProduct = {
              blueprintId: tp.blueprintId,
              title: tp.title,
              imageUrl: tp.imageUrl,
              brand: tp.brand,
              retailPrice: tp.retailPrice,
              memberEarnings: tp.memberEarnings,
              fulfillmentProvider: (tp.fulfillmentProvider as 'printify' | 'printful') || 'printify',
              availableColors: tp.availableColors?.map(c => ({ name: c.name, hex: c.hex || '' })),
              availableSizes: tp.availableSizes,
            } as AllowedProduct;
            const isSelected = selectedProduct?.blueprintId === tp.blueprintId;
            return (
              <button
                key={tp.blueprintId}
                onClick={() => setPreviewProduct({ tp, product })}
                className={`w-full flex items-center gap-3 p-2 rounded-xl border-2 transition-all text-left ${
                  isSelected
                    ? "border-orange-500 bg-orange-500/15"
                    : "border-slate-600 bg-slate-800/50 hover:border-slate-500"
                }`}
                data-testid={`button-tier-product-${tp.blueprintId}`}
              >
                {tp.imageUrl ? (
                  <img
                    src={tp.imageUrl}
                    alt={tp.title}
                    loading="lazy"
                    className="w-14 h-14 rounded-lg object-cover bg-white flex-shrink-0"
                  />
                ) : (
                  <div className="w-14 h-14 rounded-lg bg-slate-700 flex items-center justify-center flex-shrink-0">
                    <Package className="w-7 h-7 text-slate-500" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-white font-medium text-sm truncate">{tp.title}</p>
                  {tp.retailPrice != null && (
                    <p className="text-base font-bold text-white">${tp.retailPrice.toFixed(2)}</p>
                  )}
                  {context === "member" && tp.memberEarnings != null && (
                    <p className="text-xs text-green-400">Earn ${tp.memberEarnings.toFixed(2)}</p>
                  )}
                </div>
                {isSelected && <Check className="w-5 h-5 text-orange-500 flex-shrink-0" />}
              </button>
            );
          })}
        </div>

        {previewProduct && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm animate-in fade-in duration-200"
            onClick={() => { setPreviewProduct(null); setEditingMemberDesc(false); setMemberDescDraft(""); }}
            data-testid="overlay-tier-product-preview"
          >
            <div
              className="relative w-[90vw] max-w-md max-h-[90vh] overflow-y-auto bg-slate-900 rounded-2xl border border-slate-700 shadow-2xl animate-in zoom-in-90 duration-200"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={() => { setPreviewProduct(null); setEditingMemberDesc(false); setMemberDescDraft(""); }}
                className="absolute top-3 right-3 z-10 bg-black/50 rounded-full p-1.5"
                data-testid="button-close-tier-lightbox"
              >
                <X className="w-5 h-5 text-white" />
              </button>

              <div className="bg-white rounded-t-2xl p-4 flex items-center justify-center min-h-[200px]">
                {previewProduct.tp.imageUrl ? (
                  <img
                    src={previewProduct.tp.imageUrl}
                    alt={previewProduct.tp.title}
                    className="max-h-[40vh] w-auto object-contain"
                  />
                ) : (
                  <Package className="w-16 h-16 text-slate-400" />
                )}
              </div>

              <div className="p-4 space-y-3">
                <h3 className="text-lg font-bold text-white">{previewProduct.tp.title}</h3>

                <div className="flex flex-wrap gap-2 items-center">
                  {previewProduct.tp.retailPrice != null && (
                    <span className="text-2xl font-bold text-emerald-400">${previewProduct.tp.retailPrice.toFixed(2)}</span>
                  )}
                  {context === "member" && previewProduct.tp.memberEarnings != null && (
                    <Badge variant="secondary" className="bg-green-500/15 text-green-400 border-green-500/30">
                      <DollarSign className="w-3 h-3 mr-1" />
                      Earn ${previewProduct.tp.memberEarnings.toFixed(2)}
                    </Badge>
                  )}
                </div>

                {context === "member" ? (
                  <div className="space-y-2">
                    {editingMemberDesc ? (
                      <>
                        <Textarea
                          value={memberDescDraft}
                          onChange={(e) => setMemberDescDraft(e.target.value)}
                          className="text-sm min-h-[80px] bg-slate-800 border-slate-600 text-white"
                          placeholder="Customize the product description..."
                          data-testid="textarea-member-desc"
                        />
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            className="bg-green-600 text-white"
                            onClick={() => {
                              if (previewProduct) {
                                setPreviewProduct({
                                  ...previewProduct,
                                  product: { ...previewProduct.product, customDescription: memberDescDraft },
                                });
                              }
                              setEditingMemberDesc(false);
                            }}
                            data-testid="button-save-member-desc"
                          >
                            Done
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-slate-300 border-slate-600"
                            onClick={() => setEditingMemberDesc(false)}
                          >
                            Cancel
                          </Button>
                        </div>
                      </>
                    ) : (
                      <div
                        className="group cursor-pointer rounded-lg border border-dashed border-slate-600 p-2"
                        onClick={() => {
                          setMemberDescDraft(previewProduct.product.customDescription || previewProduct.tp.description || "");
                          setEditingMemberDesc(true);
                        }}
                        data-testid="button-edit-member-desc"
                      >
                        <div className="flex items-start gap-2">
                          <Pencil className="w-3.5 h-3.5 mt-0.5 text-slate-400 shrink-0" />
                          {(previewProduct.product.customDescription || previewProduct.tp.description) ? (
                            <p className="text-sm text-slate-300">{previewProduct.product.customDescription || previewProduct.tp.description}</p>
                          ) : (
                            <p className="text-sm text-slate-500 italic">Tap to add your product description...</p>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  previewProduct.tp.description && (
                    <p className="text-sm text-slate-300">{previewProduct.tp.description}</p>
                  )
                )}

                {previewProduct.tp.brand && (
                  <p className="text-xs text-slate-400">{previewProduct.tp.brand}</p>
                )}

                {(() => {
                  const colorList = previewProduct.tp.availableColors || previewProduct.product.availableColors || [];
                  return colorList.length > 0 ? (
                    <div className="space-y-1.5">
                      <p className="text-xs text-slate-400 flex items-center gap-1">
                        <Palette className="w-3 h-3" />
                        {colorList.length} colors
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {colorList.map((c, i) => (
                          <div
                            key={i}
                            className="w-5 h-5 rounded-full border border-slate-600"
                            style={{ backgroundColor: c.hex || "#888" }}
                            title={c.name}
                          />
                        ))}
                      </div>
                    </div>
                  ) : null;
                })()}

                {(() => {
                  const sizeList = previewProduct.tp.availableSizes || previewProduct.product.availableSizes || [];
                  return sizeList.length > 0 ? (
                    <div className="space-y-1.5">
                      <p className="text-xs text-slate-400 flex items-center gap-1">
                        <Ruler className="w-3 h-3" />
                        Sizes
                      </p>
                      <div className="flex flex-wrap gap-1">
                        {sizeList.map((s: string) => (
                          <Badge key={s} variant="outline" className="text-xs text-slate-300 border-slate-600">
                            {s}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  ) : null;
                })()}

                <Button
                  onClick={() => {
                    const productToSelect = { ...previewProduct.product };
                    if (previewProduct.product.customDescription) {
                      productToSelect.customDescription = previewProduct.product.customDescription;
                    }
                    if (!productToSelect.description && previewProduct.tp.description) {
                      productToSelect.description = previewProduct.tp.description;
                    }
                    onSelect(productToSelect);
                    setPreviewProduct(null);
                    setEditingMemberDesc(false);
                    setMemberDescDraft("");
                  }}
                  className="w-full bg-green-600 text-white min-h-12 text-base"
                  data-testid="button-tier-lightbox-select"
                >
                  <Check className="w-4 h-4 mr-2" />
                  Select This Product
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3 animate-in fade-in slide-in-from-right-5 duration-300">
      <div className="text-center">
        <h2 className="text-lg font-bold text-white mb-1">Choose Your Tier</h2>
        <p className="text-slate-400 text-sm">From premium to boutique — pick your level</p>
      </div>

      <div className="space-y-3">
        {availableTiers.map((tierKey) => {
          const group = categoryTiers[tierKey];
          const style = TIER_CARD_STYLES[tierKey];
          const Icon = TIER_ICONS[tierKey];
          return (
            <button
              key={tierKey}
              onClick={() => setSelectedTier(tierKey)}
              className={`w-full p-4 rounded-xl border-2 transition-all text-left relative overflow-visible ${style.border} ${style.bg} hover:scale-[1.01]`}
              data-testid={`button-tier-${tierKey}`}
            >
              <div className="flex items-start gap-3">
                <div className={`rounded-full p-2 ${style.glow}`}>
                  <Icon className={`w-6 h-6 ${style.accent}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className={`text-lg font-bold ${style.accent}`}>
                    {group.displayName}
                  </h3>
                  {group.tagline && (
                    <p className="text-sm text-slate-300 mt-0.5">{group.tagline}</p>
                  )}
                  {group.description && (
                    <p className="text-xs text-slate-400 mt-1">{group.description}</p>
                  )}
                  <div className="flex items-center gap-2 mt-2">
                    <Badge variant="secondary" className="text-xs">
                      {group.products.length} {group.products.length === 1 ? "product" : "products"}
                    </Badge>
                    {group.products.slice(0, 3).map((tp) => (
                      tp.imageUrl && (
                        <img
                          key={tp.blueprintId}
                          src={tp.imageUrl}
                          alt=""
                          className="w-8 h-8 rounded-md object-cover bg-white border border-slate-600"
                          loading="lazy"
                        />
                      )
                    ))}
                    {group.products.length > 3 && (
                      <span className="text-xs text-slate-500">+{group.products.length - 3} more</span>
                    )}
                  </div>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
