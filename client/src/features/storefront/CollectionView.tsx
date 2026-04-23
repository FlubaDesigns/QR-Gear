/**
 * CollectionView — renders a specific collection page under a channel.
 *
 * Route: /shop/:storeType/:storeName/:channel/:collection
 *        e.g. /shop/internal/qrgear/usa250/armed-forces
 *
 * Responsibilities:
 *  - Breadcrumb context: QR Gear › Channel › Collection
 *  - Collection title + description from config
 *  - Filtered product grid (products already filtered by API)
 *  - Back navigation to channel hub
 */

import { QrCode } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import StorefrontLayout from "@/components/StorefrontLayout";
import { StoreProductCard } from "./ProductCard";
import { StorefrontBreadcrumb } from "./StorefrontBreadcrumb";
import { getChannelConfig, getCollectionConfig } from "@/data/shopHierarchy";
import type { StoreResponse } from "./types";
import armedForcesImg from "@assets/collection_armed_forces.png";
import monumentsImg from "@assets/collection_monuments.png";
import foundingFathersImg from "@assets/collection_founding_fathers.png";

const COLLECTION_HERO_IMAGES: Record<string, string> = {
  "armed-forces": armedForcesImg,
  "monuments": monumentsImg,
  "founding-fathers": foundingFathersImg,
};

interface CollectionViewProps {
  storeType: string;
  storeName: string;
  /** URL channel slug, e.g. "usa250" */
  channelSlug: string;
  /** URL collection slug, e.g. "armed-forces" */
  collectionSlug: string;
  data: StoreResponse | undefined;
}

export function CollectionView({
  storeType,
  storeName,
  channelSlug,
  collectionSlug,
  data,
}: CollectionViewProps) {
  const storeBasePath = `/shop/${storeType}/${storeName}`;
  const hubPath = `${storeBasePath}/${channelSlug}`;

  const channelConfig = getChannelConfig(storeName, channelSlug);
  const collectionConfig = getCollectionConfig(storeName, channelSlug, collectionSlug);

  const channelLabel = channelConfig?.label ?? channelSlug;
  const collectionLabel = collectionConfig?.label ?? collectionSlug;
  const collectionDescription = collectionConfig?.description ?? "";

  const products = data?.products ?? [];
  const heroImage = COLLECTION_HERO_IMAGES[collectionSlug];

  return (
    <StorefrontLayout>
      {/* Collection hero image */}
      {heroImage ? (
        <div className="relative w-full overflow-hidden" style={{ minHeight: "280px" }}>
          <img
            src={heroImage}
            alt={collectionLabel}
            className="absolute inset-0 w-full h-full object-cover"
            data-testid="img-collection-hero"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-black/55 via-black/50 to-black/70" />
          <div className="relative z-10 flex flex-col items-center justify-center text-center px-6 py-16">
            <h1
              className="text-3xl md:text-4xl font-bold text-white tracking-tight mb-2"
              data-testid="text-collection-title"
            >
              {collectionLabel}
            </h1>
            {collectionDescription && (
              <p className="text-base text-white/80 max-w-xl leading-relaxed">
                {collectionDescription}
              </p>
            )}
          </div>
        </div>
      ) : null}

      <div className="container max-w-6xl py-8 px-4">
        {/* Breadcrumb */}
        <StorefrontBreadcrumb
          crumbs={[
            { label: "QR Gear", href: storeBasePath },
            { label: channelLabel, href: hubPath },
            { label: collectionLabel },
          ]}
        />

        {/* Collection header — only show text version when there's no hero image */}
        {!heroImage && (
          <div className="text-center mb-10">
            <h1
              className="text-3xl md:text-4xl font-bold mb-2"
              data-testid="text-collection-title"
            >
              {collectionLabel}
            </h1>
            {collectionDescription && (
              <p className="text-base text-muted-foreground max-w-xl mx-auto leading-relaxed">
                {collectionDescription}
              </p>
            )}
          </div>
        )}

        {/* Product grid — browse-only, tap to go to product page */}
        {products.length === 0 ? (
          <Card className="max-w-md mx-auto">
            <CardContent className="py-12 text-center">
              <QrCode className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-lg text-muted-foreground mb-2">
                No products available yet
              </p>
              <p className="text-sm text-muted-foreground">
                Check back soon for new QR Gear products!
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-5">
            {products.map((product) => (
              <StoreProductCard key={product.id} product={product} />
            ))}
          </div>
        )}
      </div>
    </StorefrontLayout>
  );
}
