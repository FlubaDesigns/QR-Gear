import { useState } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { QRButton } from "@/components/QRButton";
import UsaFlag from "./UsaFlag";
import type { Product } from "@shared/schema";

interface MockupsByColor {
  [color: string]: {
    front?: string;
    angles?: string[];
  };
}

interface FeaturedProduct extends Product {
  qrCodeUrl?: string | null;
  frontChestImage?: string | null;
  mockupsByColor?: MockupsByColor | null;
  defaultColor?: string | null;
  selectedColors?: string[] | null;
  defaultMockupImage?: string | null;
}

function ProductCard({ product }: { product: FeaturedProduct }) {
  const [selectedColor, setSelectedColor] = useState<string | null>(
    product.defaultColor || null
  );

  const availableColors = product.selectedColors || 
    (product.mockupsByColor ? Object.keys(product.mockupsByColor) : []);

  const getCurrentMockup = (): string | null => {
    if (!product.mockupsByColor) return null;
    
    const color = selectedColor || product.defaultColor || availableColors[0];
    if (color && product.mockupsByColor[color]?.front) {
      return product.mockupsByColor[color].front!;
    }
    return product.defaultMockupImage || null;
  };

  const mockupImage = getCurrentMockup();
  const displayImage = mockupImage || product.imageUrl || "";

  return (
    <div 
      className="glass-card product-card hover-elevate"
      data-testid={`card-product-${product.id}`}
    >
      <div className="product-card-image">
        <img
          src={displayImage}
          alt={product.name}
        />
        {!mockupImage && product.qrCodeUrl && (
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
          {availableColors.map((color) => (
            <button
              key={color}
              className={`color-swatch ${selectedColor === color ? 'selected' : ''}`}
              style={{ backgroundColor: getColorHex(color) }}
              onClick={() => setSelectedColor(color)}
              title={color}
              data-testid={`swatch-${color.toLowerCase().replace(/\s+/g, '-')}`}
            />
          ))}
        </div>
      )}
      
      <div className="product-card-content">
        <h3>{product.name}</h3>
        <p className="product-card-description">{product.description}</p>
        <div className="product-card-footer">
          <span className="product-card-price">
            {product.basePrice ? `From $${Number(product.basePrice).toFixed(2)}` : "Build to see price"}
          </span>
          <Link href={`/creator?product=${product.id}`}>
            <button 
              className="product-card-btn"
              data-testid={`button-customize-${product.id}`}
            >
              Customize
            </button>
          </Link>
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

export default function FeaturedProducts() {
  const { data: products = [], isLoading } = useQuery<FeaturedProduct[]>({
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
            <ProductCard key={product.id} product={product} />
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
    </section>
  );
}
