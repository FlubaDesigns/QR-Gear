/**
 * ChannelHubView — renders a channel landing page (e.g. USA 250 hub).
 *
 * Route: /shop/:storeType/:storeName/:channel
 *        e.g. /shop/internal/qrgear/usa250
 *
 * Responsibilities:
 *  - Channel identity block (title, intro) from config
 *  - Collection tiles driven by config (slugs + labels + descriptions)
 *  - Product count badges (bridged via segmentValue → Firestore segment field)
 *  - Optional all-products section below
 */

import { useMemo } from "react";
import { Link } from "wouter";
import { ArrowLeft, ArrowRight, Flag, QrCode } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import StorefrontLayout from "@/components/StorefrontLayout";
import { StoreProductCard } from "./ProductCard";
import { getChannelConfig } from "@/data/shopHierarchy";
import type { StoreResponse } from "./types";

interface ChannelHubViewProps {
  storeType: string;
  storeName: string;
  /** URL channel slug, e.g. "usa250" */
  channelSlug: string;
  /** Channel display name from API (fallback when config not found) */
  channelNameFromApi?: string | null;
  data: StoreResponse | undefined;
}

export function ChannelHubView({
  storeType,
  storeName,
  channelSlug,
  channelNameFromApi,
  data,
}: ChannelHubViewProps) {
  const storeBasePath = `/shop/${storeType}/${storeName}`;
  const hubPath = `${storeBasePath}/${channelSlug}`;

  const channelConfig = getChannelConfig(storeName, channelSlug);

  // Count products per collection.
  // Bridge: products carry Firestore `segment` values; config maps those to slugs via segmentValue.
  const collectionCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    (data?.products || []).forEach((p) => {
      if (p.segment) counts[p.segment] = (counts[p.segment] || 0) + 1;
    });
    return counts;
  }, [data?.products]);

  const label = channelConfig?.label ?? channelNameFromApi ?? channelSlug;
  const intro = channelConfig?.intro ?? "";
  const collections = channelConfig?.collections ?? [];

  return (
    <StorefrontLayout>
      <div className="container max-w-6xl py-8 px-4">
        {/* Back to store root */}
        <Link href={storeBasePath}>
          <Button variant="ghost" className="mb-6" data-testid="button-back-store">
            <ArrowLeft className="mr-2 h-5 w-5" />
            Back to QR Gear
          </Button>
        </Link>

        {/* Channel identity */}
        <div className="text-center mb-10">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2">
            QR Gear
          </p>
          <div className="inline-flex items-center gap-3 mb-3">
            <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
              <Flag className="h-6 w-6 text-primary" />
            </div>
            <h1
              className="text-3xl md:text-4xl font-bold"
              data-testid="text-channel-title"
            >
              {label.toUpperCase()}
            </h1>
          </div>
          {intro && (
            <p className="text-muted-foreground max-w-xl mx-auto">{intro}</p>
          )}
        </div>

        {/* Collection tiles — driven by config */}
        {collections.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-12">
            {collections.map((col) => {
              // Bridge: count is keyed by Firestore segmentValue, not URL slug
              const count = collectionCounts[col.segmentValue] || 0;
              return (
                <Link key={col.slug} href={`${hubPath}/${col.slug}`}>
                  <Card
                    className="hover-elevate cursor-pointer h-full"
                    data-testid={`card-collection-${col.slug}`}
                  >
                    <CardContent className="p-5 flex flex-col gap-2">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <h3 className="font-semibold text-base">{col.label}</h3>
                        {count > 0 && (
                          <Badge
                            variant="secondary"
                            data-testid={`badge-count-${col.slug}`}
                          >
                            {count}
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground flex-1">
                        {col.description}
                      </p>
                      <div className="flex items-center gap-1 text-xs text-primary mt-1">
                        Browse <ArrowRight className="h-3 w-3" />
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>
        )}

        {/* All products in this channel */}
        {(data?.products.length ?? 0) > 0 && (
          <>
            <div className="mb-6">
              <h2 className="text-xl font-semibold text-foreground">All Products</h2>
              <p className="text-sm text-muted-foreground">
                Browse everything in this channel
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {data!.products.map((p) => (
                <StoreProductCard key={p.id} product={p} />
              ))}
            </div>
          </>
        )}

        {(data?.products.length ?? 0) === 0 && (
          <Card className="max-w-md mx-auto">
            <CardContent className="py-12 text-center">
              <QrCode className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-lg text-muted-foreground mb-2">Products coming soon</p>
              <p className="text-sm text-muted-foreground">
                This channel is being stocked. Check back soon.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </StorefrontLayout>
  );
}
