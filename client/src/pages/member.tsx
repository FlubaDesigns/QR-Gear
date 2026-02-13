import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Store, 
  Package, 
  Layers, 
  Plus, 
  ChevronRight, 
  Loader2,
  QrCode,
  Eye
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import SEO from "@/components/SEO";
import { SkinGridViewer } from "@/features/shared/components/SkinGridViewer";
import { GraphicsCardSkin, GraphicsDetailSkin } from "@/features/shared/components/skins/GraphicsSkin";
import type { SkinItem } from "@/features/shared/components/skins/types";

interface MemberStore {
  id: string;
  name: string;
  roleType: string;
  isActive: boolean;
  channelCount: number;
  createdAt: string;
}

interface ChannelData {
  id: string;
  name: string;
  storeId: string;
}

interface StoreProductLink {
  id: string;
  storeId: string;
  storeName: string;
  channel: string;
  collection: string | null;
  packetId: string | null;
  productName: string;
  compositeUrl: string;
  qrOnlyUrl: string;
  qrContent: string;
  createdAt: string;
}

export default function MemberPage() {
  const { user, isLoading: authLoading } = useAuth();
  const [, setLocation] = useLocation();
  const [selectedStoreId, setSelectedStoreId] = useState<string | null>(null);
  const [selectedChannel, setSelectedChannel] = useState<string | null>(null);

  const { data: storesData, isLoading: storesLoading } = useQuery<MemberStore[]>({
    queryKey: ["/api/test/stores", "member"],
    queryFn: async () => {
      const res = await fetch("/api/test/stores?roleType=member");
      const data = await res.json();
      return data || [];
    },
  });

  const stores = storesData || [];
  const selectedStore = stores.find(s => s.id === selectedStoreId);

  const { data: channelsData, isLoading: channelsLoading } = useQuery<ChannelData[]>({
    queryKey: ["/api/test/stores", selectedStoreId, "channels"],
    queryFn: async () => {
      if (!selectedStoreId) return [];
      const res = await fetch(`/api/test/stores/${selectedStoreId}/channels`);
      const data = await res.json();
      return Array.isArray(data) ? data : [];
    },
    enabled: !!selectedStoreId,
  });

  const channels = channelsData || [];

  const { data: productsData, isLoading: productsLoading } = useQuery<StoreProductLink[]>({
    queryKey: ["/api/test/stores", selectedStoreId, "channels", selectedChannel, "products"],
    queryFn: async () => {
      if (!selectedStoreId || !selectedChannel) return [];
      const res = await fetch(`/api/test/stores/${selectedStoreId}/channels/${selectedChannel}/products`);
      const data = await res.json();
      return data.products || [];
    },
    enabled: !!selectedStoreId && !!selectedChannel,
  });

  const products = productsData || [];

  const productItems: SkinItem[] = products.map(p => ({
    id: p.id,
    packetId: p.packetId || undefined,
    name: p.productName || "Untitled Product",
    primaryImage: p.compositeUrl,
    secondaryImage: p.qrOnlyUrl,
    qrContent: p.qrContent,
    createdAt: p.createdAt,
  }));

  const { data: collectionsData } = useQuery<string[]>({
    queryKey: ["/api/test/stores", selectedStoreId, "channels", selectedChannel, "collections"],
    queryFn: async () => {
      if (!selectedStoreId || !selectedChannel) return [];
      const res = await fetch(`/api/test/stores/${selectedStoreId}/channels/${selectedChannel}/collections`);
      const data = await res.json();
      return data.collections || [];
    },
    enabled: !!selectedStoreId && !!selectedChannel,
  });

  const collections = collectionsData || [];

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="page-wrap">
        <div className="container mobile-compact">
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground mb-4">Please log in to access your member dashboard.</p>
              <Link href="/login">
                <Button>Log In</Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <>
      <SEO 
        title="Member Dashboard | QR Gear"
        description="Manage your stores, channels, and products"
      />
      <div className="page-wrap">
        <div className="container mobile-compact mobile-compact-stack">
          <div className="glass-card">
            <h1 className="glass-title text-xl mb-2 flex items-center gap-2" data-testid="text-page-title">
              <Store className="h-6 w-6 text-blue-400" />
              Member Dashboard
            </h1>
            <p className="text-muted-foreground text-sm mb-4">
              Manage your stores, channels, and products
            </p>

            <div className="flex flex-wrap gap-2 mb-4">
              <Link href="/admin/test-products">
                <Button size="sm" data-testid="link-create-product">
                  <Plus className="h-4 w-4 mr-1" />
                  Create Product
                </Button>
              </Link>
              <Link href="/admin/test-store-builder">
                <Button variant="outline" size="sm" data-testid="link-store-builder-quick">
                  <Eye className="h-4 w-4 mr-1" />
                  Store Builder
                </Button>
              </Link>
              <Link href="/admin/test-dynamics">
                <Button variant="outline" size="sm" data-testid="link-dynamics">
                  <Layers className="h-4 w-4 mr-1" />
                  QR Dynamics
                </Button>
              </Link>
            </div>
          </div>

          <Tabs defaultValue="stores" className="w-full">
            <TabsList className="w-full grid grid-cols-2">
              <TabsTrigger value="stores" data-testid="tab-stores">
                <Store className="h-4 w-4 mr-1" />
                My Stores
              </TabsTrigger>
              <TabsTrigger value="products" data-testid="tab-products">
                <Package className="h-4 w-4 mr-1" />
                Products
              </TabsTrigger>
            </TabsList>

            <TabsContent value="stores" className="mt-4 space-y-4">
              {storesLoading ? (
                <div className="text-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                </div>
              ) : stores.length === 0 ? (
                <Card>
                  <CardContent className="py-8 text-center">
                    <Store className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                    <p className="text-muted-foreground mb-4">No member stores yet.</p>
                    <p className="text-sm text-muted-foreground">
                      Create a product and assign it to a member store to get started.
                    </p>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-3">
                  {stores.map(store => (
                    <Card 
                      key={store.id} 
                      className={`cursor-pointer transition-colors ${selectedStoreId === store.id ? "ring-2 ring-primary" : ""}`}
                      onClick={() => {
                        setSelectedStoreId(store.id);
                        setSelectedChannel(null);
                      }}
                      data-testid={`store-card-${store.id}`}
                    >
                      <CardContent className="py-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium">{store.name}</p>
                            <p className="text-sm text-muted-foreground">
                              {store.channelCount} channel{store.channelCount !== 1 ? "s" : ""}
                            </p>
                          </div>
                          <ChevronRight className="h-5 w-5 text-muted-foreground" />
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}

              {selectedStore && (
                <div className="space-y-3">
                  <h3 className="font-medium flex items-center gap-2">
                    <Layers className="h-4 w-4" />
                    Channels in {selectedStore.name}
                  </h3>
                  {channelsLoading ? (
                    <div className="text-center py-4">
                      <Loader2 className="h-5 w-5 animate-spin mx-auto text-muted-foreground" />
                    </div>
                  ) : channels.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No channels yet.</p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {channels.map(channel => (
                        <Button
                          key={channel.id || channel.name}
                          variant={selectedChannel === channel.name ? "default" : "outline"}
                          size="sm"
                          onClick={() => setSelectedChannel(channel.name)}
                          data-testid={`channel-btn-${channel.name}`}
                        >
                          {channel.name}
                        </Button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {selectedStore && selectedChannel && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="font-medium flex items-center gap-2">
                      <Package className="h-4 w-4" />
                      Products in {selectedChannel}
                    </h3>
                    {collections.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {collections.map(coll => (
                          <Badge key={coll} variant="secondary" className="text-xs">
                            {coll}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                  {productsLoading ? (
                    <div className="text-center py-4">
                      <Loader2 className="h-5 w-5 animate-spin mx-auto text-muted-foreground" />
                    </div>
                  ) : products.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No products in this channel yet.</p>
                  ) : (
                    <SkinGridViewer
                      items={productItems}
                      CardSkin={GraphicsCardSkin}
                      DetailSkin={GraphicsDetailSkin}
                      actions={{
                        onEdit: (id) => {
                          const product = products.find(p => p.id === id);
                          if (product?.packetId) {
                            setLocation(`/admin/test-store-builder?packetId=${product.packetId}`);
                          }
                        },
                      }}
                      gridColumns="grid-cols-2 sm:grid-cols-3"
                    />
                  )}
                </div>
              )}
            </TabsContent>

            <TabsContent value="products" className="mt-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <QrCode className="h-5 w-5" />
                    Quick Actions
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Link href="/admin/test-products" className="block">
                    <Button className="w-full justify-start" variant="outline" data-testid="link-products-builder">
                      <Plus className="h-4 w-4 mr-2" />
                      Create New Product
                    </Button>
                  </Link>
                  <Link href="/admin/test-store-builder" className="block">
                    <Button className="w-full justify-start" variant="outline" data-testid="link-store-builder">
                      <Eye className="h-4 w-4 mr-2" />
                      Store Builder
                    </Button>
                  </Link>
                  <Link href="/admin/test-dynamics" className="block">
                    <Button className="w-full justify-start" variant="outline" data-testid="link-dynamics-page">
                      <Layers className="h-4 w-4 mr-2" />
                      QR Dynamics Setup
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </>
  );
}
