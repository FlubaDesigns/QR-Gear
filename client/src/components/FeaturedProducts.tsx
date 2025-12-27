import { useState, useEffect } from "react";
import { Link } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { QRButton } from "@/components/QRButton";
import UsaFlag from "./UsaFlag";
import InstantMockupPreview from "./InstantMockupPreview";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, ShoppingCart, Check } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { Product } from "@shared/schema";
import baseShirtImage from "@assets/generated_images/white_t-shirt_mockup_template.png";

interface MockupsByColor {
  [color: string]: {
    front?: string;
    lifestyle?: string;  // Lifestyle mockup with model
    angles?: string[];
  };
}

interface ColorWithHex {
  name: string;
  hex?: string;
}

interface FeaturedProduct extends Omit<Product, 'defaultColor' | 'mockupsByColor'> {
  qrCodeUrl?: string | null;
  frontChestImage?: string | null;
  mockupsByColor?: MockupsByColor | null;
  defaultColor?: string | null;
  selectedColors?: string[] | null;
  defaultMockupImage?: string | null;
  availableColorsWithHex?: ColorWithHex[];
  isCustomizable?: boolean;
  retailPrice?: number; // Final price with markup and QR cost
}

function ProductCard({ 
  product, 
  onOpenQuickView 
}: { 
  product: FeaturedProduct; 
  onOpenQuickView: (product: FeaturedProduct) => void;
}) {
  const [selectedColor, setSelectedColor] = useState<string | null>(
    product.defaultColor || null
  );

  // Use availableColorsWithHex if provided, otherwise fallback to names only
  const colorsWithHex: ColorWithHex[] = product.availableColorsWithHex || 
    (product.selectedColors?.map(name => ({ name })) || 
    (product.mockupsByColor ? Object.keys(product.mockupsByColor).map(name => ({ name })) : []));
  
  const availableColors = colorsWithHex.map(c => c.name);
  
  // Create hex lookup map from data
  const colorHexMap: Record<string, string> = {};
  colorsWithHex.forEach(c => {
    if (c.hex) colorHexMap[c.name] = c.hex;
  });

  const getCurrentMockup = (): { url: string | null; isLifestyle: boolean } => {
    if (!product.mockupsByColor) return { url: null, isLifestyle: false };
    
    const color = selectedColor || product.defaultColor || availableColors[0];
    if (color && product.mockupsByColor[color]) {
      // Prefer lifestyle mockup (with model) over flat product shot
      if (product.mockupsByColor[color].lifestyle) {
        return { url: product.mockupsByColor[color].lifestyle!, isLifestyle: true };
      }
      if (product.mockupsByColor[color].front) {
        return { url: product.mockupsByColor[color].front!, isLifestyle: false };
      }
    }
    return { url: product.defaultMockupImage || null, isLifestyle: false };
  };

  const mockupResult = getCurrentMockup();
  const displayImage = mockupResult.url || product.imageUrl || "";

  return (
    <div 
      className="glass-card product-card hover-elevate cursor-pointer"
      data-testid={`card-product-${product.id}`}
      onClick={() => onOpenQuickView(product)}
    >
      <div className="product-card-image">
        <img
          src={displayImage}
          alt={product.name}
        />
        {!mockupResult.url && product.qrCodeUrl && (
          <img
            src={product.qrCodeUrl}
            alt="QR Code"
            className="product-card-qr-overlay"
          />
        )}
        {product.madeInUSA && (
          <span className="product-card-badge">
            <UsaFlag className="usa-flag-small" />
            USA
          </span>
        )}
      </div>
      
      {availableColors.length > 1 && (
        <div className="product-card-colors">
          {availableColors.slice(0, 5).map((color) => (
            <button
              key={color}
              className={`color-swatch ${selectedColor === color ? 'selected' : ''}`}
              style={{ backgroundColor: colorHexMap[color] || getColorHex(color) }}
              onClick={(e) => {
                e.stopPropagation();
                setSelectedColor(color);
              }}
              title={color}
              data-testid={`swatch-${color.toLowerCase().replace(/\s+/g, '-')}`}
            />
          ))}
          {availableColors.length > 5 && (
            <span className="color-swatch-more">+{availableColors.length - 5}</span>
          )}
        </div>
      )}
      
      <div className="product-card-content">
        <h3>{product.name}</h3>
        <p className="product-card-description">{product.description}</p>
        <div className="product-card-footer">
          <span className="product-card-price">
            {product.basePrice ? `From $${Number(product.basePrice).toFixed(2)}` : "Build to see price"}
          </span>
          <button 
            className="product-card-btn"
            data-testid={`button-customize-${product.id}`}
            onClick={(e) => {
              e.stopPropagation();
              onOpenQuickView(product);
            }}
          >
            View Options
          </button>
        </div>
      </div>
    </div>
  );
}

function getColorHex(colorName: string): string {
  const colorMap: Record<string, string> = {
    'White': '#FFFFFF',
    'Black': '#000000',
    'Navy': '#000080',
    'Navy Blue': '#000080',
    'Royal Blue': '#4169E1',
    'Red': '#DC2626',
    'Heather Gray': '#9CA3AF',
    'Heather Grey': '#9CA3AF',
    'Sport Gray': '#6B7280',
    'Sport Grey': '#6B7280',
    'Dark Heather': '#374151',
    'Charcoal': '#36454F',
    'Natural': '#F5F5DC',
    'Sand': '#C2B280',
    'Forest Green': '#228B22',
    'Kelly Green': '#4CBB17',
    'Maroon': '#800000',
    'Orange': '#FF6B00',
    'Gold': '#FFD700',
    'Yellow': '#FFFF00',
    'Light Blue': '#ADD8E6',
    'Pink': '#FFC0CB',
    'Purple': '#800080',
    'Ash': '#B2BEB5',
  };
  return colorMap[colorName] || '#CCCCCC';
}

function ProductQuickView({ 
  product, 
  isOpen, 
  onClose,
  onMockupGenerated
}: { 
  product: FeaturedProduct | null;
  isOpen: boolean;
  onClose: () => void;
  onMockupGenerated: () => void;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedColor, setSelectedColor] = useState<string | null>(null);
  const [selectedSize, setSelectedSize] = useState<string | null>(null);
  const [generatingColor, setGeneratingColor] = useState<string | null>(null);
  const [localMockups, setLocalMockups] = useState<Record<string, { front?: string; lifestyle?: string }>>({});

  // Reset state when product changes or modal opens
  useEffect(() => {
    if (isOpen && product) {
      setSelectedColor(product.defaultColor || null);
      setSelectedSize(null);
      setLocalMockups(product.mockupsByColor || {});
      setGeneratingColor(null);
    }
  }, [isOpen, product]);

  // Use availableColorsWithHex if provided, otherwise fallback to names only
  const colorsWithHex: ColorWithHex[] = product?.availableColorsWithHex || 
    (product?.selectedColors?.map(name => ({ name })) || 
    (product?.mockupsByColor ? Object.keys(product.mockupsByColor).map(name => ({ name })) : []));
  
  const availableColors = colorsWithHex.map(c => c.name);
  
  // Create hex lookup map from data
  const colorHexMap: Record<string, string> = {};
  colorsWithHex.forEach(c => {
    if (c.hex) colorHexMap[c.name] = c.hex;
  });

  const availableSizes = product?.availableSizes || ['S', 'M', 'L', 'XL', '2XL'];

  const generateMockupMutation = useMutation({
    mutationFn: async ({ productId, color }: { productId: string; color: string }) => {
      const res = await apiRequest("POST", "/api/storefront/generate-mockup", {
        productId,
        color,
      });
      return res.json();
    },
    onSuccess: (data, variables) => {
      if (data.mockupUrl) {
        setLocalMockups(prev => ({
          ...prev,
          [variables.color]: { 
            front: data.mockupUrl,
            lifestyle: data.lifestyleMockupUrl || undefined
          }
        }));
        onMockupGenerated();
      }
      setGeneratingColor(null);
    },
    onError: (error: any) => {
      toast({
        title: "Mockup generation failed",
        description: error.message || "Please try again",
        variant: "destructive",
      });
      setGeneratingColor(null);
    },
  });

  const addToCartMutation = useMutation({
    mutationFn: async () => {
      if (!product || !selectedColor || !selectedSize) return;
      const res = await apiRequest("POST", "/api/cart", {
        productId: product.id,
        quantity: 1,
        selectedColor,
        selectedSize,
      });
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "Added to cart!",
        description: `${product?.name} (${selectedColor}, ${selectedSize})`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/cart"] });
      onClose();
    },
    onError: (error: any) => {
      toast({
        title: "Failed to add to cart",
        description: error.message || "Please try again",
        variant: "destructive",
      });
    },
  });

  const handleColorClick = (color: string) => {
    setSelectedColor(color);
    
    // Check if we have a mockup for this color
    const hasMockup = localMockups[color]?.front || product?.mockupsByColor?.[color]?.front;
    
    if (!hasMockup && product) {
      setGeneratingColor(color);
      generateMockupMutation.mutate({ productId: product.id, color });
    }
  };

  const getCurrentMockup = (): string | null => {
    if (!selectedColor) return product?.defaultMockupImage || product?.imageUrl || null;
    
    // Check local mockups first (newly generated) - prefer lifestyle
    if (localMockups[selectedColor]?.lifestyle) {
      return localMockups[selectedColor].lifestyle!;
    }
    if (localMockups[selectedColor]?.front) {
      return localMockups[selectedColor].front!;
    }
    
    // Then check product mockups - prefer lifestyle
    if (product?.mockupsByColor?.[selectedColor]?.lifestyle) {
      return product.mockupsByColor[selectedColor].lifestyle!;
    }
    if (product?.mockupsByColor?.[selectedColor]?.front) {
      return product.mockupsByColor[selectedColor].front!;
    }
    
    return product?.defaultMockupImage || product?.imageUrl || null;
  };

  if (!product) return null;

  const displayImage = getCurrentMockup() || product.imageUrl || "";
  const isGenerating = generatingColor === selectedColor;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogTitle className="text-xl font-bold">{product.name}</DialogTitle>
        <DialogDescription className="sr-only">
          Select color and size options for {product.name}
        </DialogDescription>
        
        <div className="grid md:grid-cols-2 gap-6 mt-4">
          <div className="relative">
            {(() => {
              const hasMockup = selectedColor && (localMockups[selectedColor]?.front || product.mockupsByColor?.[selectedColor]?.front);
              const hexColor = selectedColor ? (colorHexMap[selectedColor] || getColorHex(selectedColor)) : null;
              const qrArtworkBlack = product.frontChestImage || product.qrCodeUrl;
              const qrArtworkWhite = (product as any).frontChestImageWhite || null;
              
              if (!hasMockup && qrArtworkBlack && hexColor && selectedColor) {
                return (
                  <InstantMockupPreview
                    baseShirtUrl={baseShirtImage}
                    qrArtworkBlackUrl={qrArtworkBlack}
                    qrArtworkWhiteUrl={qrArtworkWhite}
                    colorHex={hexColor}
                    colorName={selectedColor}
                    placement="front-chest"
                    className="w-full max-h-[400px]"
                  />
                );
              }
              
              return (
                <>
                  {isGenerating && (
                    <div className="absolute inset-0 bg-background/80 flex items-center justify-center z-10 rounded-lg">
                      <div className="text-center">
                        <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2" />
                        <p className="text-sm text-muted-foreground">Generating HD mockup...</p>
                      </div>
                    </div>
                  )}
                  <img 
                    src={displayImage} 
                    alt={product.name}
                    className="w-full rounded-lg object-contain max-h-[400px]"
                  />
                </>
              );
            })()}
            {product.madeInUSA && (
              <span className="absolute top-2 right-2 bg-primary text-primary-foreground px-2 py-1 rounded text-xs flex items-center gap-1">
                <UsaFlag className="usa-flag-small" />
                Made in USA
              </span>
            )}
          </div>
          
          <div className="space-y-6">
            <div>
              <p className="text-muted-foreground">{product.description}</p>
              <p className="text-2xl font-bold mt-2">
                ${Number(product.basePrice || 0).toFixed(2)}
              </p>
            </div>
            
            <div>
              <h4 className="font-medium mb-3">Color: {selectedColor || 'Select a color'}</h4>
              <div className="flex flex-wrap gap-2">
                {availableColors.map((color: string) => {
                  const hasMockup = localMockups[color]?.front || product.mockupsByColor?.[color]?.front;
                  const hexColor = colorHexMap[color] || getColorHex(color);
                  return (
                    <button
                      key={color}
                      className={`w-10 h-10 rounded-full border-2 transition-all relative ${
                        selectedColor === color 
                          ? 'border-primary ring-2 ring-primary ring-offset-2' 
                          : 'border-border hover:border-primary/50'
                      }`}
                      style={{ backgroundColor: hexColor }}
                      onClick={() => handleColorClick(color)}
                      title={color}
                      disabled={generatingColor === color}
                      data-testid={`quickview-swatch-${color.toLowerCase().replace(/\s+/g, '-')}`}
                    >
                      {generatingColor === color && (
                        <Loader2 className="h-4 w-4 animate-spin absolute inset-0 m-auto text-white drop-shadow-md" />
                      )}
                      {hasMockup && generatingColor !== color && (
                        <Check className="h-3 w-3 absolute bottom-0 right-0 text-green-500 bg-white rounded-full" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
            
            <div>
              <h4 className="font-medium mb-3">Size: {selectedSize || 'Select a size'}</h4>
              <div className="flex flex-wrap gap-2">
                {availableSizes.map((size: string) => (
                  <button
                    key={size}
                    className={`min-w-[48px] h-12 px-4 rounded border-2 font-medium transition-all ${
                      selectedSize === size 
                        ? 'border-primary bg-primary text-primary-foreground' 
                        : 'border-border hover:border-primary/50'
                    }`}
                    onClick={() => setSelectedSize(size)}
                    data-testid={`quickview-size-${size.toLowerCase()}`}
                  >
                    {size}
                  </button>
                ))}
              </div>
            </div>
            
            <div className="pt-4 space-y-3">
              <Button
                className="w-full h-14 text-lg"
                disabled={!selectedColor || !selectedSize || addToCartMutation.isPending}
                onClick={() => addToCartMutation.mutate()}
                data-testid="button-add-to-cart"
              >
                {addToCartMutation.isPending ? (
                  <Loader2 className="h-5 w-5 animate-spin mr-2" />
                ) : (
                  <ShoppingCart className="h-5 w-5 mr-2" />
                )}
                Add to Cart
              </Button>
              
              {product.isCustomizable !== false && (
                <Link href={`/creator?product=${product.id}`}>
                  <Button variant="outline" className="w-full h-12" data-testid="button-customize-design">
                    Customize Design
                  </Button>
                </Link>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function FeaturedProducts() {
  const queryClient = useQueryClient();
  const [selectedProduct, setSelectedProduct] = useState<FeaturedProduct | null>(null);
  
  const { data: products = [], isLoading, refetch } = useQuery<FeaturedProduct[]>({
    queryKey: ["/api/products", { featured: true }],
    queryFn: async () => {
      const res = await fetch("/api/products?featured=true");
      if (!res.ok) throw new Error("Failed to fetch featured products");
      return res.json();
    },
  });

  if (isLoading) {
    return (
      <section className="home-section">
        <div className="container">
          <div className="section-header">
            <h2>Featured Products</h2>
            <p>Loading featured products...</p>
          </div>
          <div className="products-grid">
            {[1, 2, 3].map((i) => (
              <div key={i} className="glass-card product-card skeleton-card">
                <div className="product-card-image skeleton-image" />
                <div className="product-card-content">
                  <div className="skeleton-text" />
                  <div className="skeleton-text short" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    );
  }

  if (products.length === 0) {
    return null;
  }

  return (
    <section className="home-section">
      <div className="container">
        <div className="section-header">
          <h2>Featured Products</h2>
          <p>Explore our most popular QR code designs on premium products</p>
        </div>

        <div className="products-grid">
          {products.slice(0, 6).map((product) => (
            <ProductCard 
              key={product.id} 
              product={product} 
              onOpenQuickView={setSelectedProduct}
            />
          ))}
        </div>

        <div className="section-cta">
          <Link href="/gallery">
            <QRButton 
              variant="accent"
              data-testid="button-view-all-products"
            >
              View All Products
            </QRButton>
          </Link>
        </div>
      </div>
      
      <ProductQuickView 
        product={selectedProduct}
        isOpen={!!selectedProduct}
        onClose={() => setSelectedProduct(null)}
        onMockupGenerated={() => refetch()}
      />
    </section>
  );
}
