import { useMemo } from "react";
import type { Product } from "@shared/schema";

interface ProductMockupProps {
  product: Product | null;
  qrCodeImage: string;
  qrCodeImageWhite?: string;
  placement: string;
  productColor: string;
  textAbove?: string;
  textBelow?: string;
}

function isColorDark(hex: string): boolean {
  const cleanHex = hex.replace('#', '');
  if (cleanHex.length !== 6) return false;
  const r = parseInt(cleanHex.substring(0, 2), 16) / 255;
  const g = parseInt(cleanHex.substring(2, 4), 16) / 255;
  const b = parseInt(cleanHex.substring(4, 6), 16) / 255;
  
  const toLinear = (c: number) => c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  const luminance = 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
  
  return luminance < 0.5;
}

type PlacementStyle = {
  position: { top?: string; left?: string; right?: string; bottom?: string };
  size: string;
  textSize: "xs" | "sm" | "base";
};

const apparelPlacements: Record<string, PlacementStyle> = {
  "front-chest": { position: { top: "35%", left: "50%" }, size: "35%", textSize: "xs" },
  "front-pocket": { position: { top: "30%", left: "30%" }, size: "18%", textSize: "xs" },
  "back": { position: { top: "35%", left: "50%" }, size: "45%", textSize: "sm" },
  "left-sleeve": { position: { top: "40%", left: "8%" }, size: "12%", textSize: "xs" },
  "right-sleeve": { position: { top: "40%", right: "8%", left: "auto" }, size: "12%", textSize: "xs" },
  "front-center": { position: { top: "40%", left: "50%" }, size: "40%", textSize: "sm" },
};

const headwearPlacements: Record<string, PlacementStyle> = {
  "front-center": { position: { top: "45%", left: "50%" }, size: "35%", textSize: "xs" },
  "side-left": { position: { top: "50%", left: "25%" }, size: "25%", textSize: "xs" },
  "side-right": { position: { top: "50%", right: "25%", left: "auto" }, size: "25%", textSize: "xs" },
  "back": { position: { top: "50%", left: "50%" }, size: "30%", textSize: "xs" },
};

const drinkwarePlacements: Record<string, PlacementStyle> = {
  "front-center": { position: { top: "45%", left: "50%" }, size: "50%", textSize: "sm" },
  "back": { position: { top: "45%", left: "50%" }, size: "50%", textSize: "sm" },
};

const bagsPlacements: Record<string, PlacementStyle> = {
  "front-center": { position: { top: "45%", left: "50%" }, size: "45%", textSize: "sm" },
  "back": { position: { top: "45%", left: "50%" }, size: "45%", textSize: "sm" },
};

const defaultPlacement: PlacementStyle = {
  position: { top: "45%", left: "50%" },
  size: "40%",
  textSize: "sm",
};

function getPlacementStyle(category: string, placement: string): PlacementStyle {
  switch (category.toLowerCase()) {
    case "apparel":
      return apparelPlacements[placement] || defaultPlacement;
    case "headwear":
      return headwearPlacements[placement] || defaultPlacement;
    case "drinkware":
      return drinkwarePlacements[placement] || defaultPlacement;
    case "bags":
      return bagsPlacements[placement] || defaultPlacement;
    default:
      return apparelPlacements[placement] || defaultPlacement;
  }
}

const textSizeClasses: Record<string, string> = {
  xs: "text-xs",
  sm: "text-sm",
  base: "text-base",
};

export default function ProductMockup({
  product,
  qrCodeImage,
  qrCodeImageWhite,
  placement,
  productColor,
  textAbove = "",
  textBelow = "",
}: ProductMockupProps) {
  const placementStyle = useMemo(() => {
    if (!product) return defaultPlacement;
    return getPlacementStyle(product.category, placement);
  }, [product, placement]);
  
  const productImageUrl = useMemo(() => {
    if (!product) return null;
    return product.imageUrl || "/placeholder-product.png";
  }, [product]);

  const selectedColorHex = useMemo(() => {
    if (!productColor || !product?.availableColors) return null;
    const colors = product.availableColors as Array<{ name: string; hex: string }>;
    const found = colors.find(c => c.name === productColor);
    return found?.hex || null;
  }, [productColor, product]);

  const activeQrImage = useMemo(() => {
    if (selectedColorHex && isColorDark(selectedColorHex) && qrCodeImageWhite) {
      return qrCodeImageWhite;
    }
    return qrCodeImage;
  }, [selectedColorHex, qrCodeImage, qrCodeImageWhite]);

  if (!product) {
    return (
      <div className="aspect-square bg-muted rounded-lg flex items-center justify-center">
        <p className="text-muted-foreground text-center px-4">
          Select a product to see preview
        </p>
      </div>
    );
  }

  const textSizeClass = textSizeClasses[placementStyle.textSize] || "text-sm";

  return (
    <div className="relative aspect-square bg-muted rounded-lg overflow-hidden" data-testid="product-mockup">
      {selectedColorHex && (
        <div 
          className="absolute inset-0 opacity-30 mix-blend-multiply"
          style={{ backgroundColor: selectedColorHex }}
        />
      )}
      
      <img
        src={productImageUrl || ""}
        alt={product.name}
        className="w-full h-full object-contain"
        data-testid="mockup-product-image"
      />
      
      {activeQrImage && (
        <div
          className="absolute flex flex-col items-center gap-0.5"
          style={{
            top: placementStyle.position.top,
            left: placementStyle.position.left,
            right: placementStyle.position.right,
            transform: placementStyle.position.left === "50%" ? "translate(-50%, -50%)" : 
                       placementStyle.position.right ? "translate(50%, -50%)" : "translate(0, -50%)",
            width: placementStyle.size,
          }}
          data-testid="mockup-qr-container"
        >
          {textAbove && (
            <span 
              className={`${textSizeClass} font-bold text-center w-full truncate bg-white/80 px-1 rounded text-black`}
              data-testid="mockup-text-above"
            >
              {textAbove}
            </span>
          )}
          
          <img
            src={activeQrImage}
            alt="QR Code"
            className="w-full h-auto shadow-md rounded-sm"
            data-testid="mockup-qr-code"
          />
          
          {textBelow && (
            <span 
              className={`${textSizeClass} font-bold text-center w-full truncate bg-white/80 px-1 rounded text-black`}
              data-testid="mockup-text-below"
            >
              {textBelow}
            </span>
          )}
        </div>
      )}
      
      <div className="absolute bottom-2 left-2 right-2">
        <div className="bg-black/60 text-white text-xs px-2 py-1 rounded text-center">
          {placement.split("-").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ")} Preview
        </div>
      </div>
    </div>
  );
}
