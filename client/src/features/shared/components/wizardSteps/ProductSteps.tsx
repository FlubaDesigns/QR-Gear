import { useState, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Package, Check, DollarSign, X, Ruler, Palette, ShoppingBag, Crown, Star, Award, Pencil } from "lucide-react";
import { type AllowedProduct, SHIRT_COLORS, SHIRT_SIZES, type PlacementOption } from "./wizardTypes";
import { ScrollVerticalView } from "../views/ScrollVerticalView";
import { TierCardSkin, type TierItem } from "../skins/TierCardSkin";
import { WizardProductCardSkin, type WizardProductItem } from "../skins/WizardProductCardSkin";
import { MemberProductDetailSkin } from "../skins/MemberProductDetailSkin";
import { ReadOnlyProductDetailSkin } from "../skins/ReadOnlyProductDetailSkin";
import type { WizardMode } from "@shared/wizardProduct";

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

function toWizardMode(context: WizardContextType): WizardMode {
  if (context === 'owner') return 'owner';
  if (context === 'public' || context === 'external' || context === 'platform') return 'public';
  return 'member';
}

function toWizardProductItem(product: AllowedProduct): WizardProductItem {
  return {
    id: String(product.blueprintId),
    blueprintId: product.blueprintId,
    title: product.title,
    imageUrl: product.imageUrl || '',
    description: product.description,
    retailPrice: product.retailPrice,
    memberEarnings: product.memberEarnings,
    brand: product.brand || undefined,
    colorCount: product.availableColors?.length,
    sizeCount: product.availableSizes?.length,
  };
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
  const [detailProduct, setDetailProduct] = useState<AllowedProduct | null>(null);
  const mode = toWizardMode(context);
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

  const productItems: WizardProductItem[] = products.map(toWizardProductItem);
  const productLookup = new Map(products.map(p => [String(p.blueprintId), p]));

  return (
    <div className="space-y-2 animate-in fade-in slide-in-from-right-5 duration-300">
      <div className="text-center">
        <h2 className="text-base font-bold text-white mb-0.5">Pick Your Product</h2>
        <p className="text-slate-400 text-xs">Tap image to zoom</p>
      </div>

      <ScrollVerticalView
        items={productItems}
        height="45vh"
        maxItemWidth="100%"
        footer={null}
        renderItem={(item) => (
          <WizardProductCardSkin
            item={item}
            isSelected={selectedProduct?.blueprintId === item.blueprintId}
            mode={mode}
            onSelect={() => {
              const full = productLookup.get(String(item.blueprintId));
              if (full) onSelect(full);
            }}
            onOpenDetail={() => {
              const full = productLookup.get(String(item.blueprintId));
              if (full) setDetailProduct(full);
            }}
          />
        )}
      />

      {detailProduct && (
        mode === 'member' ? (
          <MemberProductDetailSkin
            product={detailProduct}
            onSelect={(p) => { onSelect(p); setDetailProduct(null); }}
            onClose={() => setDetailProduct(null)}
          />
        ) : (
          <ReadOnlyProductDetailSkin
            product={detailProduct}
            onSelect={(p) => { onSelect(p); setDetailProduct(null); }}
            onClose={() => setDetailProduct(null)}
          />
        )
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
  printProviderId?: number;
  providerProductId?: number;
  canonicalBlankKey?: string;
  title: string;
  imageUrl: string;
  brand?: string;
  category?: string;
  retailPrice?: number;
  memberEarnings?: number;
  memberPacketDescription?: string | null;
  description?: string;
  providerDescription?: string | null;
  adminCatalogDescription?: string | null;
  effectiveDescription?: string | null;
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

function tierProductToAllowedProduct(tp: TierProduct): AllowedProduct {
  return {
    blueprintId: tp.blueprintId,
    printProviderId: tp.printProviderId,
    providerProductId: tp.providerProductId || tp.printProviderId || tp.blueprintId,
    canonicalBlankKey: tp.canonicalBlankKey,
    title: tp.title,
    imageUrl: tp.imageUrl,
    brand: tp.brand,
    retailPrice: tp.retailPrice,
    memberEarnings: tp.memberEarnings,
    baseCost: tp.cost,
    fulfillmentProvider: (tp.fulfillmentProvider as 'printify' | 'printful') || 'printify',
    availableColors: tp.availableColors?.map(c => ({ name: c.name, hex: c.hex || '' })),
    availableSizes: tp.availableSizes,
    description: tp.description,
    providerDescription: tp.providerDescription || tp.originalDescription || null,
    adminCatalogDescription: tp.adminCatalogDescription || tp.adminDescription || null,
    memberPacketDescription: tp.memberPacketDescription || null,
    effectiveDescription: tp.effectiveDescription || null,
    originalDescription: tp.originalDescription,
    adminDescription: tp.adminDescription,
  } as AllowedProduct;
}

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
  const [detailProduct, setDetailProduct] = useState<AllowedProduct | null>(null);
  const mode = toWizardMode(context);

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
    const productItems: WizardProductItem[] = tierProducts.map(tp => toWizardProductItem(tierProductToAllowedProduct(tp)));
    const productLookup = new Map(tierProducts.map(tp => [String(tp.blueprintId), tierProductToAllowedProduct(tp)]));

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

        <ScrollVerticalView
          items={productItems}
          height="45vh"
          maxItemWidth="100%"
          footer={null}
          renderItem={(item) => (
            <WizardProductCardSkin
              item={item}
              isSelected={selectedProduct?.blueprintId === item.blueprintId}
              mode={mode}
              onSelect={() => {
                const full = productLookup.get(String(item.blueprintId));
                if (full) setDetailProduct(full);
              }}
              onOpenDetail={() => {
                const full = productLookup.get(String(item.blueprintId));
                if (full) setDetailProduct(full);
              }}
            />
          )}
        />

        {detailProduct && (
          mode === 'member' ? (
            <MemberProductDetailSkin
              product={detailProduct}
              onSelect={(p) => { onSelect(p); setDetailProduct(null); }}
              onClose={() => setDetailProduct(null)}
            />
          ) : (
            <ReadOnlyProductDetailSkin
              product={detailProduct}
              onSelect={(p) => { onSelect(p); setDetailProduct(null); }}
              onClose={() => setDetailProduct(null)}
            />
          )
        )}
      </div>
    );
  }

  const tierItems: TierItem[] = availableTiers.map(tierKey => {
    const group = categoryTiers[tierKey];
    return {
      id: tierKey,
      tierKey,
      displayName: group.displayName,
      tagline: group.tagline,
      description: group.description,
      productCount: group.products.length,
      previewImages: group.products.filter(tp => tp.imageUrl).slice(0, 3).map(tp => tp.imageUrl),
    };
  });

  return (
    <div className="space-y-3 animate-in fade-in slide-in-from-right-5 duration-300">
      <div className="text-center">
        <h2 className="text-lg font-bold text-white mb-1">Choose Your Tier</h2>
        <p className="text-slate-400 text-sm">From premium to boutique — pick your level</p>
      </div>

      <ScrollVerticalView
        items={tierItems}
        height="auto"
        maxItemWidth="100%"
        footer={null}
        renderItem={(item) => (
          <TierCardSkin
            item={item}
            onSelect={(key) => setSelectedTier(key)}
          />
        )}
      />
    </div>
  );
}
