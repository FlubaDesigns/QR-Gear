/**
 * shop-segment.tsx — route delegator
 *
 * Handles three route shapes:
 *   /shop/:storeType/:storeName                       → StoreRootView
 *   /shop/:storeType/:storeName/:channel              → ChannelHubView
 *   /shop/:storeType/:storeName/:channel/:collection  → CollectionView
 *
 * This file is responsible for:
 *   1. Route parameter parsing / mode detection
 *   2. Single shared API call (when products are needed)
 *   3. Loading / error states
 *   4. Delegating rendering to the appropriate view component
 *
 * It does NOT carry inline rendering for store root, channel hub, or collection pages.
 * It does NOT hard-code any USA 250 or collection-specific logic.
 *
 * Hierarchy (locked):
 *   internal → qrgear → usa250 → monuments / armed-forces / founding-fathers
 */

import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "wouter";
import { Loader2, Store, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import StorefrontLayout from "@/components/StorefrontLayout";
import { getStoreConfig } from "@/data/shopHierarchy";
import { StoreRootView } from "@/features/storefront/StoreRootView";
import { ChannelHubView } from "@/features/storefront/ChannelHubView";
import { CollectionView } from "@/features/storefront/CollectionView";
import { StoreProductCard } from "@/features/storefront/ProductCard";
import type { StoreResponse } from "@/features/storefront/types";

export default function ShopSegmentPage() {
  // Params cover both route shapes:
  //   2-param: /shop/:storeType/:storeName
  //   3-param: /shop/:storeType/:storeName/:segment     (channel hub)
  //   4-param: /shop/:storeType/:storeName/:channel/:collection
  const params = useParams<{
    storeType: string;
    storeName: string;
    segment?: string;
    channel?: string;
    collection?: string;
  }>();

  const storeType = params.storeType || "internal";
  const storeName = decodeURIComponent(params.storeName || "");

  // 4-param route: channel + collection are explicit
  const channelParam = params.channel ? decodeURIComponent(params.channel) : undefined;
  const collectionParam = params.collection ? decodeURIComponent(params.collection) : undefined;

  // 3-param route: segment carries the channel slug for internal stores
  const segmentParam = params.segment ? decodeURIComponent(params.segment) : undefined;

  // ── Mode detection ──────────────────────────────────────────────────────────
  //
  // isCollectionMode: 4-param URL — specific collection inside a channel
  // isChannelHubMode: 3-param URL on an internal store — channel landing page
  // isStoreRootMode:  2-param URL for a known internal store — store parent page
  // isGenericMode:    everything else (external stores, unknown segment, etc.)
  //
  const isCollectionMode = !!channelParam && !!collectionParam;
  const isChannelHubMode =
    !isCollectionMode &&
    storeType.toLowerCase() === "internal" &&
    !!segmentParam;
  const storeConfig = !isCollectionMode && !isChannelHubMode
    ? getStoreConfig(storeName)
    : undefined;
  const isStoreRootMode =
    !isCollectionMode && !isChannelHubMode && storeType.toLowerCase() === "internal" && !!storeConfig;
  const isGenericMode = !isCollectionMode && !isChannelHubMode && !isStoreRootMode;

  // Resolve the active channel slug (used by ChannelHubView + CollectionView)
  const activeChannel = channelParam ?? (isChannelHubMode ? segmentParam : undefined);

  // ── Store root: no API call needed — config drives the landing page ─────────
  if (!storeName) {
    return (
      <StorefrontLayout>
        <div className="container max-w-6xl py-16 px-4 text-center">
          <Store className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
          <h1 className="text-2xl font-bold mb-2">Store Not Found</h1>
          <p className="text-muted-foreground mb-4">
            Please select a valid store to browse.
          </p>
          <Link href="/">
            <Button data-testid="button-go-home">
              <ArrowLeft className="mr-2 h-5 w-5" />
              Back to Home
            </Button>
          </Link>
        </div>
      </StorefrontLayout>
    );
  }

  if (isStoreRootMode) {
    return <StoreRootView storeConfig={storeConfig!} />;
  }

  // ── API call for channel hub + collection + generic modes ──────────────────
  return <ShopDataFetcher
    storeType={storeType}
    storeName={storeName}
    channelParam={channelParam}
    collectionParam={collectionParam}
    segmentParam={segmentParam}
    activeChannel={activeChannel}
    isCollectionMode={isCollectionMode}
    isChannelHubMode={isChannelHubMode}
    isGenericMode={isGenericMode}
  />;
}

// Separated so the API call only runs when actually needed (not for StoreRootView)
interface FetcherProps {
  storeType: string;
  storeName: string;
  channelParam?: string;
  collectionParam?: string;
  segmentParam?: string;
  activeChannel?: string;
  isCollectionMode: boolean;
  isChannelHubMode: boolean;
  isGenericMode: boolean;
}

function ShopDataFetcher({
  storeType,
  storeName,
  channelParam,
  collectionParam,
  segmentParam,
  activeChannel,
  isCollectionMode,
  isChannelHubMode,
  isGenericMode,
}: FetcherProps) {
  const apiUrl = (() => {
    const base = `/api/store/${storeType}/${encodeURIComponent(storeName)}`;
    if (isCollectionMode && activeChannel && collectionParam) {
      return `${base}?channel=${encodeURIComponent(activeChannel)}&collection=${encodeURIComponent(collectionParam)}`;
    }
    if (isChannelHubMode && activeChannel) {
      return `${base}?channel=${encodeURIComponent(activeChannel)}`;
    }
    if (segmentParam) {
      return `${base}?segment=${encodeURIComponent(segmentParam)}`;
    }
    return base;
  })();

  const { data, isLoading, error } = useQuery<StoreResponse>({
    queryKey: [
      "/api/store",
      storeType,
      storeName,
      activeChannel ?? null,
      collectionParam ?? null,
      segmentParam ?? null,
    ],
    queryFn: async () => {
      const res = await fetch(apiUrl);
      if (!res.ok) throw new Error("Failed to load store products");
      return res.json();
    },
  });

  if (isLoading) {
    return (
      <StorefrontLayout>
        <div className="container max-w-6xl py-8 px-4 flex items-center justify-center min-h-[400px]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <span className="ml-3 text-muted-foreground">Loading products...</span>
        </div>
      </StorefrontLayout>
    );
  }

  if (error) {
    return (
      <StorefrontLayout>
        <div className="container max-w-6xl py-16 px-4 text-center">
          <Store className="h-16 w-16 mx-auto mb-4 text-destructive" />
          <h1 className="text-2xl font-bold mb-2">Error Loading Store</h1>
          <p className="text-muted-foreground mb-4">{(error as Error).message}</p>
          <Link href="/">
            <Button data-testid="button-go-home-error">
              <ArrowLeft className="mr-2 h-5 w-5" />
              Back to Home
            </Button>
          </Link>
        </div>
      </StorefrontLayout>
    );
  }

  // ── Delegate to the correct view ──────────────────────────────────────────

  if (isCollectionMode && activeChannel && collectionParam) {
    return (
      <CollectionView
        storeType={storeType}
        storeName={storeName}
        channelSlug={activeChannel}
        collectionSlug={collectionParam}
        data={data}
      />
    );
  }

  if (isChannelHubMode && activeChannel) {
    return (
      <ChannelHubView
        storeType={storeType}
        storeName={storeName}
        channelSlug={activeChannel}
        channelNameFromApi={data?.channelName}
        data={data}
      />
    );
  }

  // Generic fallback: external store or store with a segment param we don't know
  const displayTitle = segmentParam ? `${storeName} — ${segmentParam}` : storeName;
  const products = data?.products ?? [];

  return (
    <StorefrontLayout>
      <div className="container max-w-6xl py-8 px-4">
        <Link href="/">
          <Button variant="ghost" className="mb-6" data-testid="button-back-home">
            <ArrowLeft className="mr-2 h-5 w-5" />
            Back to Home
          </Button>
        </Link>
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-3 mb-4">
            <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
              <Store className="h-6 w-6 text-primary" />
            </div>
            <h1 className="text-3xl md:text-4xl font-bold">{displayTitle}</h1>
          </div>
          {segmentParam && (
            <p className="text-muted-foreground">
              Showing products in the &ldquo;{segmentParam}&rdquo; section
            </p>
          )}
        </div>
        {products.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            No products available yet. Check back soon.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {products.map((p) => (
              <StoreProductCard key={p.id} product={p} />
            ))}
          </div>
        )}
      </div>
    </StorefrontLayout>
  );
}
