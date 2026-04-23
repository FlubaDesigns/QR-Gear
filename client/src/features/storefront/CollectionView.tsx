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

import { Link } from "wouter";
import { ArrowLeft, QrCode } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import StorefrontLayout from "@/components/StorefrontLayout";
import { StoreProductCard } from "./ProductCard";
import { getChannelConfig, getCollectionConfig } from "@/data/shopHierarchy";
import type { StoreResponse } from "./types";

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

  return (
    <StorefrontLayout>
      <div className="container max-w-6xl py-8 px-4">
        {/* Back to channel hub */}
        <Link href={hubPath}>
          <Button variant="ghost" className="mb-6" data-testid="button-back-channel">
            <ArrowLeft className="mr-2 h-5 w-5" />
            Back to {channelLabel}
          </Button>
        </Link>

        {/* Breadcrumb context */}
        <div className="text-center mb-8">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2">
            QR Gear &rsaquo; {channelLabel}
          </p>
          <h1
            className="text-3xl md:text-4xl font-bold mb-2"
            data-testid="text-collection-title"
          >
            {collectionLabel}
          </h1>
          {collectionDescription && (
            <p className="text-sm text-muted-foreground max-w-xl mx-auto">
              {collectionDescription}
            </p>
          )}
        </div>

        {/* Product grid — pre-filtered by API */}
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
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {products.map((product) => (
              <StoreProductCard key={product.id} product={product} />
            ))}
          </div>
        )}
      </div>
    </StorefrontLayout>
  );
}
