import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import UsaFlag from "@/components/UsaFlag";
import { Palette, Ruler, Factory, DollarSign } from "lucide-react";
import { ProductLightbox, ProductLightboxData } from "./ProductLightbox";

export interface ProductSkinProps {
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
  onClick?: () => void;
  className?: string;
}

export function ProductSkin({
  id,
  title,
  brand,
  image,
  price,
  priceRange,
  madeInUSA,
  colors,
  sizes,
  description,
  onClick,
  className = "",
}: ProductSkinProps) {
  const [lightboxOpen, setLightboxOpen] = useState(false);

  const colorCount = Array.isArray(colors) ? colors.length : colors;
  // Show the higher cost (max) as "Cost" - what we pay the provider
  const costDisplay = priceRange 
    ? `$${priceRange.max.toFixed(2)}`
    : price 
      ? `$${price.toFixed(2)}`
      : null;

  const handleClick = () => {
    if (onClick) {
      onClick();
    } else {
      setLightboxOpen(true);
    }
  };

  const lightboxData: ProductLightboxData = {
    id,
    title,
    brand,
    image,
    price,
    priceRange,
    madeInUSA,
    colors,
    sizes,
    description,
  };

  return (
    <>
      <Card 
        className={`overflow-hidden cursor-pointer hover-elevate transition-all ${className}`}
        onClick={handleClick}
        data-testid={`card-product-skin-${id}`}
      >
        <div className="relative aspect-square bg-muted">
          <img 
            src={image} 
            alt={title}
            className="w-full h-full object-contain"
            data-testid={`img-product-${id}`}
          />
          {madeInUSA && (
            <div className="absolute top-2 right-2">
              <Badge variant="secondary" className="gap-1 bg-background/90 backdrop-blur-sm text-xs">
                <UsaFlag className="w-3 h-2" />
                USA
              </Badge>
            </div>
          )}
        </div>

        <CardContent className="p-3 space-y-2">
          <h3 className="font-medium text-sm line-clamp-2" data-testid={`text-product-title-${id}`}>
            {title}
          </h3>

          {brand && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Factory className="w-3 h-3" />
              <span>{brand}</span>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2">
            {costDisplay && (
              <div className="text-sm font-semibold">
                Cost: {costDisplay}
              </div>
            )}

            {colorCount !== undefined && colorCount > 0 && (
              <Badge variant="outline" className="gap-1 text-xs">
                <Palette className="w-3 h-3" />
                {colorCount}
              </Badge>
            )}

            {sizes && sizes.length > 0 && (
              <Badge variant="outline" className="gap-1 text-xs">
                <Ruler className="w-3 h-3" />
                {sizes.length}
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>

      <ProductLightbox 
        open={lightboxOpen} 
        onOpenChange={setLightboxOpen} 
        product={lightboxData}
      />
    </>
  );
}
