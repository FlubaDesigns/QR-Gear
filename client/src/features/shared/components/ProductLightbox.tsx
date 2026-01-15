import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import UsaFlag from "@/components/UsaFlag";
import { Palette, Ruler, Factory, DollarSign } from "lucide-react";

export interface ProductLightboxData {
  id: string | number;
  title: string;
  brand?: string;
  image: string;
  price?: number;
  priceRange?: { min: number; max: number };
  madeInUSA?: boolean;
  colors?: number | string[];
  sizes?: string[];
  description?: string;
}

interface ProductLightboxProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product: ProductLightboxData | null;
}

export function ProductLightbox({ open, onOpenChange, product }: ProductLightboxProps) {
  if (!product) return null;

  const colorCount = Array.isArray(product.colors) ? product.colors.length : product.colors;
  const priceDisplay = product.priceRange 
    ? `$${product.priceRange.min.toFixed(2)} - $${product.priceRange.max.toFixed(2)}`
    : product.price 
      ? `$${product.price.toFixed(2)}`
      : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] p-0 overflow-hidden" data-testid="dialog-product-lightbox">
        <ScrollArea className="max-h-[90vh]">
          <div className="p-6">
            <DialogHeader className="mb-4">
              <DialogTitle className="text-xl">{product.title}</DialogTitle>
            </DialogHeader>
            
            <div className="space-y-4">
              <div className="relative aspect-square w-full max-w-md mx-auto bg-muted rounded-lg overflow-hidden">
                <img 
                  src={product.image} 
                  alt={product.title}
                  className="w-full h-full object-contain"
                  data-testid="img-lightbox-product"
                />
                {product.madeInUSA && (
                  <div className="absolute top-2 right-2">
                    <Badge variant="secondary" className="gap-1 bg-background/90 backdrop-blur-sm">
                      <UsaFlag className="w-4 h-3" />
                      USA
                    </Badge>
                  </div>
                )}
              </div>

              <div className="space-y-3">
                {product.brand && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Factory className="w-4 h-4" />
                    <span className="font-medium">{product.brand}</span>
                  </div>
                )}

                {priceDisplay && (
                  <div className="flex items-center gap-2">
                    <DollarSign className="w-4 h-4 text-green-600" />
                    <span className="font-semibold text-lg">{priceDisplay}</span>
                  </div>
                )}

                {colorCount !== undefined && colorCount > 0 && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Palette className="w-4 h-4" />
                    <span>{colorCount} color{colorCount !== 1 ? 's' : ''} available</span>
                  </div>
                )}

                {product.sizes && product.sizes.length > 0 && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Ruler className="w-4 h-4" />
                    <div className="flex flex-wrap gap-1">
                      {product.sizes.map((size) => (
                        <Badge key={size} variant="outline" className="text-xs">
                          {size}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {product.description && (
                  <p className="text-sm text-muted-foreground mt-4">
                    {product.description}
                  </p>
                )}
              </div>
            </div>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
