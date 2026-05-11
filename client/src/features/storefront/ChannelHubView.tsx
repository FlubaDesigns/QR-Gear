/**
 * ChannelHubView — renders a channel landing page (e.g. USA 250 hub).
 *
 * Route: /shop/:storeType/:storeName/:channel
 *        e.g. /shop/internal/qrgear/usa-250
 *
 * Responsibilities:
 *  - Channel header with hero image
 *  - Collection image-cards driven by config
 *  - Product count badges (bridged via segmentValue → Firestore segment field)
 */

import { useMemo } from "react";
import { Link } from "wouter";
import { ArrowRight, QrCode } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import StorefrontLayout from "@/components/StorefrontLayout";
import { getChannelConfig } from "@/data/shopHierarchy";
import { StorefrontBreadcrumb } from "./StorefrontBreadcrumb";
import type { StoreResponse } from "./types";
import channelHeaderImg from "@assets/usa250_header.png";
import armedForcesImg from "@assets/collection_armed_forces.png";
import monumentsImg from "@assets/collection_monuments.png";
import foundingFathersImg from "@assets/collection_founding_fathers.png";

const COLLECTION_IMAGES: Record<string, string> = {
  "armed-forces": armedForcesImg,
  "monuments": monumentsImg,
  "founding-fathers": foundingFathersImg,
};

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
  const collections = channelConfig?.collections ?? [];

  return (
    <StorefrontLayout>
      {/* ── Channel hero header ───────────────────────────────────────────────── */}
      <div className="relative w-full overflow-hidden" style={{ minHeight: "360px" }}>
        <img
          src={channelHeaderImg}
          alt={label}
          className="absolute inset-0 w-full h-full object-cover"
          data-testid="img-channel-header"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/55 via-black/50 to-black/65" />
        <div className="relative z-10 flex flex-col items-center justify-center text-center px-6 py-20">
          <h1
            className="text-4xl md:text-5xl font-bold text-white tracking-tight mb-3"
            data-testid="text-channel-title"
          >
            {label}
          </h1>
          <p className="text-base md:text-lg text-white/80 max-w-xl leading-relaxed mb-2">
            {channelConfig?.intro ?? "A tribute to American history, service, and legacy."}
          </p>
          <p className="text-sm text-white/60 italic">
            Wear the story. Scan the meaning.
          </p>
        </div>
      </div>

      <div className="container max-w-5xl py-10 px-4">
        {/* Breadcrumb */}
        <StorefrontBreadcrumb
          crumbs={[
            { label: "QR Gear", href: storeBasePath },
            { label: label },
          ]}
        />

        {/* Collection image-cards */}
        {collections.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
            {collections.map((col) => {
              const count = collectionCounts[col.segmentValue] || 0;
              const colImg = COLLECTION_IMAGES[col.slug];
              return (
                <Link key={col.slug} href={`${hubPath}/${col.slug}`}>
                  <div
                    className="relative rounded-md overflow-hidden cursor-pointer group"
                    style={{ minHeight: "260px" }}
                    data-testid={`card-collection-${col.slug}`}
                  >
                    {colImg ? (
                      <img
                        src={colImg}
                        alt={col.label}
                        className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                      />
                    ) : (
                      <div className="absolute inset-0 bg-muted" />
                    )}
                    {/* Dark overlay */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-black/20" />

                    {/* Text overlay — bottom aligned */}
                    <div className="relative z-10 flex flex-col justify-end h-full p-6" style={{ minHeight: "260px" }}>
                      {count > 0 && (
                        <Badge
                          variant="secondary"
                          className="self-start mb-3 text-xs"
                          data-testid={`badge-count-${col.slug}`}
                        >
                          {count} {count === 1 ? "item" : "items"}
                        </Badge>
                      )}
                      <h3
                        className="font-bold text-xl text-white leading-snug mb-1"
                        data-testid={`text-collection-label-${col.slug}`}
                      >
                        {col.label}
                      </h3>
                      <p className="text-sm text-white/80 leading-snug mb-3 font-medium">
                        {col.subtitle}
                      </p>
                      <div className="flex items-center gap-1.5 text-sm text-white font-semibold">
                        Shop Now <ArrowRight className="h-3.5 w-3.5" />
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}

        {collections.length === 0 && (
          <Card className="max-w-md mx-auto">
            <CardContent className="py-12 text-center">
              <QrCode className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-lg text-muted-foreground mb-2">Collections coming soon</p>
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
