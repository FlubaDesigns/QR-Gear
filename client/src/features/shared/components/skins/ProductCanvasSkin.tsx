import { useState, useMemo } from "react";
import { Check, Palette, ShoppingCart, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  CanvasTextLayer, 
  CanvasTextPreview, 
  TextLayerConfig, 
  defaultTextLayer 
} from "../CanvasTextLayer";
import { cn } from "@/lib/utils";

export interface ProductCanvasItem {
  id: string;
  title: string;
  imageUrl: string;
  availableColors?: Array<{ name: string; hex: string }>;
  retailPrice?: number;
  memberEarnings?: number;
}

interface ProductCanvasSkinProps {
  product: ProductCanvasItem;
  onAddToCart?: (product: ProductCanvasItem, config: ProductCanvasConfig) => void;
  className?: string;
}

export interface ProductCanvasConfig {
  selectedColor: string;
  textLayers: TextLayerConfig[];
}

export function ProductCanvasSkin({ product, onAddToCart, className }: ProductCanvasSkinProps) {
  const [selectedColor, setSelectedColor] = useState(
    product.availableColors?.[0]?.name || "Default"
  );
  const [textLayers, setTextLayers] = useState<TextLayerConfig[]>([
    { ...defaultTextLayer("title", "Title"), text: "", y: 35 },
    { ...defaultTextLayer("tagline", "Tagline"), text: "", fontSize: 16, y: 65 },
  ]);
  const [activeLayerIndex, setActiveLayerIndex] = useState(0);
  const [isAdding, setIsAdding] = useState(false);

  const selectedColorHex = useMemo(() => {
    return product.availableColors?.find(c => c.name === selectedColor)?.hex || "#FFFFFF";
  }, [product.availableColors, selectedColor]);

  const hasText = textLayers.some(l => l.text.trim());

  async function handleAddToCart() {
    if (!onAddToCart) return;
    setIsAdding(true);
    await onAddToCart(product, { selectedColor, textLayers });
    setIsAdding(false);
  }

  return (
    <Card className={cn("overflow-hidden", className)}>
      <div className="grid md:grid-cols-2 gap-0">
        <div className="relative bg-muted aspect-square flex items-center justify-center overflow-hidden">
          <div 
            className="absolute inset-0 opacity-20"
            style={{ backgroundColor: selectedColorHex }}
          />
          
          <div className="relative w-full h-full">
            <img
              src={product.imageUrl}
              alt={product.title}
              className="w-full h-full object-contain"
              data-testid={`img-product-${product.id}`}
            />
            
            <CanvasTextPreview
              layers={textLayers}
              containerWidth={400}
              containerHeight={400}
              className="absolute inset-0 w-full h-full"
            />
          </div>

          {hasText && (
            <Badge className="absolute top-3 right-3 bg-green-600">
              <Check className="h-3 w-3 mr-1" />
              Custom Text
            </Badge>
          )}
        </div>

        <div className="p-4 flex flex-col gap-4">
          <div>
            <h3 className="font-semibold text-lg" data-testid={`text-product-title-${product.id}`}>
              {product.title}
            </h3>
            {product.retailPrice && (
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-2xl font-bold">${product.retailPrice.toFixed(2)}</span>
                {product.memberEarnings && product.memberEarnings > 0 && (
                  <Badge variant="secondary" className="text-green-600">
                    +${product.memberEarnings.toFixed(2)} earnings
                  </Badge>
                )}
              </div>
            )}
          </div>

          {product.availableColors && product.availableColors.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Palette className="h-4 w-4" />
                <span>Color: {selectedColor}</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {product.availableColors.slice(0, 12).map(({ name, hex }) => (
                  <button
                    key={name}
                    className={cn(
                      "h-8 w-8 rounded-full border-2 transition-transform hover:scale-110",
                      selectedColor === name ? "border-primary ring-2 ring-primary/30" : "border-transparent"
                    )}
                    style={{ backgroundColor: hex }}
                    onClick={() => setSelectedColor(name)}
                    title={name}
                    data-testid={`btn-color-${name.replace(/\s+/g, "-").toLowerCase()}`}
                  />
                ))}
                {product.availableColors.length > 12 && (
                  <Badge variant="outline" className="h-8 px-2">
                    +{product.availableColors.length - 12} more
                  </Badge>
                )}
              </div>
            </div>
          )}

          <div className="flex-1 space-y-2">
            <div className="flex gap-1">
              {textLayers.map((layer, i) => (
                <Button
                  key={layer.id}
                  size="sm"
                  variant={activeLayerIndex === i ? "default" : "outline"}
                  className="flex-1"
                  onClick={() => setActiveLayerIndex(i)}
                  data-testid={`btn-layer-${layer.id}`}
                >
                  {layer.label}
                  {layer.text && <Check className="h-3 w-3 ml-1" />}
                </Button>
              ))}
            </div>

            <CanvasTextLayer
              layer={textLayers[activeLayerIndex]}
              onChange={(updated) => {
                const next = [...textLayers];
                next[activeLayerIndex] = updated;
                setTextLayers(next);
              }}
              compact={false}
            />
          </div>

          <Button
            size="lg"
            className="w-full"
            onClick={handleAddToCart}
            disabled={isAdding}
            data-testid={`btn-add-to-cart-${product.id}`}
          >
            {isAdding ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <ShoppingCart className="h-4 w-4 mr-2" />
            )}
            Add to Cart
          </Button>
        </div>
      </div>
    </Card>
  );
}

interface ProductCanvasGridProps {
  products: ProductCanvasItem[];
  onSelectProduct?: (product: ProductCanvasItem) => void;
  selectedProductId?: string;
  className?: string;
}

export function ProductCanvasGrid({ 
  products, 
  onSelectProduct, 
  selectedProductId,
  className 
}: ProductCanvasGridProps) {
  return (
    <div className={cn("grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4", className)}>
      {products.map(product => (
        <Card
          key={product.id}
          className={cn(
            "overflow-hidden cursor-pointer hover-elevate transition-all",
            selectedProductId === product.id && "ring-2 ring-primary"
          )}
          onClick={() => onSelectProduct?.(product)}
          data-testid={`card-product-${product.id}`}
        >
          <div className="aspect-square bg-muted relative">
            <img
              src={product.imageUrl}
              alt={product.title}
              className="w-full h-full object-contain"
            />
            {selectedProductId === product.id && (
              <div className="absolute top-2 right-2">
                <Badge className="bg-primary">
                  <Check className="h-3 w-3" />
                </Badge>
              </div>
            )}
          </div>
          <div className="p-3">
            <h4 className="font-medium text-sm truncate">{product.title}</h4>
            {product.retailPrice && (
              <p className="text-sm text-muted-foreground">${product.retailPrice.toFixed(2)}</p>
            )}
          </div>
        </Card>
      ))}
    </div>
  );
}
