import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, ScanLine } from "lucide-react";
import { PUBLIC_SHOP_PATH } from "@shared/navigation";
import type { StoreProduct } from "@/features/storefront/types";
import { buildProductGallery, type ProductMediaSource } from "@/features/storefront-shared/buildProductGallery";

export default function Hero({ product, isLoading, catalogError }: {
  product?: StoreProduct;
  isLoading: boolean;
  catalogError: Error | null;
}) {
  // Use the same saved product and cache as its storefront detail page.
  const { data: detail, error, refetch } = useQuery<StoreProduct & Pick<ProductMediaSource, "landingPageSnapshotUrl">>({
    queryKey: ["/api/store/product", product?.id],
    enabled: !!product,
    queryFn: async () => {
      const res = await fetch(`/api/store/product/${product!.id}`);
      if (!res.ok) throw new Error("The scan preview could not be loaded.");
      const result = await res.json();
      if (result.id !== product!.id) throw new Error("The scan preview does not match this product.");
      return result;
    },
  });
  const image = product ? buildProductGallery(product, product.defaultColor)[0]?.url : null;

  return (
    <section className="hero" aria-labelledby="home-title" data-hero-layout="split" data-mobile-media="below">
      <div className="row">
        <div className="layout__split-2">
          <div className="hero__text">
            <p className="kicker">Physical gear. Digital world.</p>
            <h1 id="home-title">Wear the story.<br /><span>Share it with a scan.</span></h1>
            <p className="hero__sub">Your memories, your message, your creativity. Put them on real gear with a QR code that opens something worth sharing.</p>
            <div className="hero__actions btn-row">
              <Link href="/build?guided=true" className="qr-btn qr-btn--accent" data-testid="button-create-qr-gear">Create Your Gear <ArrowRight aria-hidden="true" /></Link>
              <Link href={PUBLIC_SHOP_PATH} className="btn btn-secondary" data-testid="button-shop-gear">Shop Gear <ArrowRight aria-hidden="true" /></Link>
            </div>
            <p className="hero__note"><ScanLine aria-hidden="true" /> Point your phone camera. Tap the link. Discover more.</p>
          </div>
          <div className="hero__media">
            {product && image ? (
              <figure className="hero__experience">
                <Link href={`/shop/product/${product.id}`} className="hero__product" aria-label={`View ${product.name}`}>
                  <img src={image} alt={product.name} fetchPriority="high" data-testid="img-hero-product" />
                  <span className="hero__product-label">The gear you wear</span>
                </Link>
                <div className="hero__phone">
                  <div className="hero__phone-top"><ScanLine aria-hidden="true" /> The story it opens</div>
                  {detail?.landingPageSnapshotUrl ? (
                    <Link href={`/shop/product/${product.id}`} aria-label={`Explore the QR experience for ${product.name}`}>
                      <img src={detail.landingPageSnapshotUrl} alt={`Actual QR destination artwork for ${product.name}`} data-testid="img-hero-destination" />
                    </Link>
                  ) : error ? (
                    <div className="hero__preview-status" role="alert"><p>{error.message}</p><button onClick={() => void refetch()}>Retry preview</button></div>
                  ) : (
                    <p className="hero__preview-status" role="status">{detail ? "No destination preview is available for this design." : "Loading its QR experience…"}</p>
                  )}
                  <span className="hero__phone-bottom">One scan. A whole story.</span>
                </div>
                <figcaption><span>From the collection</span><Link href={`/shop/product/${product.id}`}>{product.name} <ArrowRight aria-hidden="true" /></Link></figcaption>
              </figure>
            ) : (
              <div className="hero__unavailable" role="status"><ScanLine aria-hidden="true" /><p>{isLoading ? "Loading a real QR Gear experience…" : catalogError ? "The featured experience is unavailable. You can retry the collection below." : "New QR Gear experiences are on their way."}</p></div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
