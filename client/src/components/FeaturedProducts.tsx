import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { QRButton } from "@/components/QRButton";
import UsaFlag from "./UsaFlag";
import type { Product } from "@shared/schema";

interface FeaturedProduct extends Product {
  qrCodeUrl?: string | null;
  frontChestImage?: string | null;
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
            <div 
              key={product.id} 
              className="glass-card product-card hover-elevate"
              data-testid={`card-product-${product.id}`}
            >
              <div className="product-card-image">
                <img
                  src={product.imageUrl || ""}
                  alt={product.name}
                />
                {product.qrCodeUrl && (
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
