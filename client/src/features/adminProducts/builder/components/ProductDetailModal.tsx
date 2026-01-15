import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DollarSign, Palette, Check } from "lucide-react";
import UsaFlag from "@/components/UsaFlag";
import type { CatalogProduct } from "../types";

interface ProductDetailModalProps {
  product: CatalogProduct | null;
  open: boolean;
  onClose: () => void;
  onSelect: (product: CatalogProduct) => void;
}

export function ProductDetailModal({ product, open, onClose, onSelect }: ProductDetailModalProps) {
  const handleSelect = () => {
    if (product) {
      onSelect(product);
      onClose();
    }
  };

  return (
    <Dialog open={open && !!product} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-w-sm mx-auto">
        {product && (
          <>
            <DialogHeader>
              <DialogTitle className="text-lg">{product.title}</DialogTitle>
            </DialogHeader>
            
            <div className="space-y-4">
              <div className="relative aspect-square bg-muted rounded-lg overflow-hidden">
                {product.imageUrl && (
                  <img
                    src={product.imageUrl}
                    alt={product.title}
                    className="w-full h-full object-cover"
                  />
                )}
                {product.madeInUSA && (
                  <div className="absolute top-2 right-2">
                    <UsaFlag className="w-6 h-6" />
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">{product.brand}</p>
                {product.model && (
                  <p className="text-xs text-muted-foreground">Model: {product.model}</p>
                )}
              </div>

              <div className="flex flex-wrap gap-2">
                {product.minPrice && (
                  <Badge variant="secondary" className="text-sm">
                    <DollarSign className="w-3.5 h-3.5 mr-1" />
                    {product.minPrice}
                    {product.maxPrice && product.maxPrice !== product.minPrice && ` - ${product.maxPrice}`}
                  </Badge>
                )}
                {(product.colorCount ?? 0) > 0 && (
                  <Badge variant="outline" className="text-sm">
                    <Palette className="w-3.5 h-3.5 mr-1" />
                    {product.colorCount} colors
                  </Badge>
                )}
              </div>

              <Button
                className="w-full"
                size="lg"
                onClick={handleSelect}
                data-testid="button-select-product"
              >
                <Check className="w-4 h-4 mr-2" />
                Select This Product
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
