import { Link } from "wouter";
import { StoreProductCard } from "@/features/storefront/ProductCard";
import type { StoreProduct } from "@/features/storefront/types";
import { Button } from "@/components/ui/button";

export default function FeaturedProducts({ products, isLoading, error, onRetry, collectionHref }: {
  products: StoreProduct[] | undefined;
  isLoading: boolean;
  error: Error | null;
  onRetry: () => void;
  collectionHref: string;
}) {
  return (
    <section className="home-section" aria-labelledby="featured-products-title">
      <div className="row">
        <div className="section-header">
          <h2 id="featured-products-title">Explore QR Gear</h2>
          <p>Browse designs from our store. Choose a product to see its available colors and sizes.</p>
        </div>
        {isLoading ? (
          <p role="status">Loading store products...</p>
        ) : error ? (
          <div role="alert" className="space-y-3">
            <p>{error.message}</p>
            <Button variant="outline" onClick={onRetry}>Retry loading products</Button>
          </div>
        ) : products?.length ? (
          <div className="layout__split-3" data-testid="homepage-store-products">
            {products.slice(0, 6).map(product => <StoreProductCard key={product.id} product={product} />)}
          </div>
        ) : (
          <p>No products are currently available in this collection.</p>
        )}
        <div className="section-cta">
          <Link href={collectionHref}>
            <Button data-testid="button-view-all-products">View the Collection</Button>
          </Link>
        </div>
      </div>
    </section>
  );
}
