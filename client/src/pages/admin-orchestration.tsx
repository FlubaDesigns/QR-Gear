import AdminShell from "@/components/AdminShell";
import AdminSectionSubNav from "@/components/admin/AdminSectionSubNav";
import { SELL_SUBNAV } from "@/components/admin/adminNavConfig";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import {
  Package,
  Plus,
  RefreshCw,
  Trash2,
  Edit2,
  Globe,
  Store,
  Activity,
  CheckCircle,
  XCircle,
  Clock,
  Loader2,
  Route,
  Zap,
  DollarSign,
  Layers,
  TrendingUp,
  BarChart,
  Upload,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import type { MasterProduct, ChannelConfig } from "@shared/schema";
import type { ProductStatus } from "./orchestration-types";
import { CreateProductForm, EditProductForm } from "./orchestration-product-forms";
import { BundlesTab } from "./orchestration-bundles-tab";
import { BulkPublishDialog } from "./orchestration-bulk-publish";
import { RoutingTabContent } from "./orchestration-routing-tab";
import { ProfitTabContent } from "./orchestration-profit-tab";
import { RepricingTabContent } from "./orchestration-repricing-tab";
import { AnalyticsTabContent } from "./orchestration-analytics-tab";
import { HealthTabContent } from "./orchestration-health-tab";

export default function AdminOrchestration() {
  const { toast } = useToast();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<MasterProduct | null>(null);

  const { data: productsData, isLoading: productsLoading, refetch: refetchProducts } = useQuery({
    queryKey: ["/api/admin/orchestration/master-products"],
  });
  const products: MasterProduct[] = Array.isArray(productsData)
    ? productsData
    : (productsData as any)?.products ?? [];

  const { data: channelConfigsData, isLoading: configsLoading } = useQuery({
    queryKey: ["/api/admin/orchestration/channel-configs"],
  });
  const channelConfigs: ChannelConfig[] = Array.isArray(channelConfigsData)
    ? channelConfigsData
    : (channelConfigsData as any)?.configs ?? [];

  const createProductMutation = useMutation({
    mutationFn: async (data: { title: string; description: string; productType: string; tags: string[] }) => {
      return apiRequest("POST", "/api/admin/orchestration/master-products", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/orchestration/master-products"] });
      setCreateDialogOpen(false);
      toast({ title: "Product Created", description: "Master product created successfully" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const deleteProductMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/admin/orchestration/master-products/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/orchestration/master-products"] });
      toast({ title: "Product Deleted" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const updateProductMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<MasterProduct> }) => {
      return apiRequest("PATCH", `/api/admin/orchestration/master-products/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/orchestration/master-products"] });
      setEditingProduct(null);
      toast({ title: "Product Updated" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const getStatusBadge = (status: ProductStatus) => {
    switch (status) {
      case "active":
        return <Badge className="bg-green-600"><CheckCircle className="w-3 h-3 mr-1" />Active</Badge>;
      case "draft":
        return <Badge variant="secondary"><Clock className="w-3 h-3 mr-1" />Draft</Badge>;
      case "paused":
        return <Badge variant="outline"><XCircle className="w-3 h-3 mr-1" />Paused</Badge>;
      case "archived":
        return <Badge variant="destructive">Archived</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  return (
    <AdminShell
      title="Multi-Provider Orchestration"
      subtitle="Manage products across Printify, Printful, Etsy, eBay, Amazon"
      icon={Layers}
      sectionNav={<AdminSectionSubNav items={SELL_SUBNAV} />}
      actions={
        <Button
          onClick={() => refetchProducts()}
          variant="outline"
          className="qr-touch-48"
          data-testid="button-refresh"
        >
          <RefreshCw className="h-5 w-5 mr-2" />
          Refresh
        </Button>
      }
    >
        <Tabs defaultValue="products" className="w-full">
          <TabsList className="grid w-full grid-cols-4 sm:grid-cols-8 mb-6 gap-1 h-auto p-1">
            <TabsTrigger value="products" className="!min-h-[48px] text-base px-4 py-3" data-testid="tab-products">
              <Package className="w-5 h-5 mr-2" />
              <span className="hidden sm:inline">Products</span>
            </TabsTrigger>
            <TabsTrigger value="bundles" className="!min-h-[48px] text-base px-4 py-3" data-testid="tab-bundles">
              <Layers className="w-5 h-5 mr-2" />
              <span className="hidden sm:inline">Bundles</span>
            </TabsTrigger>
            <TabsTrigger value="channels" className="!min-h-[48px] text-base px-4 py-3" data-testid="tab-channels">
              <Globe className="w-5 h-5 mr-2" />
              <span className="hidden sm:inline">Channels</span>
            </TabsTrigger>
            <TabsTrigger value="routing" className="!min-h-[48px] text-base px-4 py-3" data-testid="tab-routing">
              <Route className="w-5 h-5 mr-2" />
              <span className="hidden sm:inline">Routing</span>
            </TabsTrigger>
            <TabsTrigger value="profit" className="!min-h-[48px] text-base px-4 py-3" data-testid="tab-profit">
              <DollarSign className="w-5 h-5 mr-2" />
              <span className="hidden sm:inline">Profit</span>
            </TabsTrigger>
            <TabsTrigger value="repricing" className="!min-h-[48px] text-base px-4 py-3" data-testid="tab-repricing">
              <TrendingUp className="w-5 h-5 mr-2" />
              <span className="hidden sm:inline">Repricing</span>
            </TabsTrigger>
            <TabsTrigger value="analytics" className="!min-h-[48px] text-base px-4 py-3" data-testid="tab-analytics">
              <BarChart className="w-5 h-5 mr-2" />
              <span className="hidden sm:inline">Analytics</span>
            </TabsTrigger>
            <TabsTrigger value="health" className="!min-h-[48px] text-base px-4 py-3" data-testid="tab-health">
              <Activity className="w-5 h-5 mr-2" />
              <span className="hidden sm:inline">Health</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="products" className="space-y-4">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <h2 className="text-lg font-semibold">Master Products</h2>
              <div className="flex gap-2 flex-wrap">
                <BulkPublishDialog products={products} channelConfigs={channelConfigs} />
                <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
                  <DialogTrigger asChild>
                    <Button className="h-12" data-testid="button-create-product">
                      <Plus className="w-5 h-5 mr-2" />
                      Create Product
                    </Button>
                  </DialogTrigger>
                <DialogContent className="sm:max-w-md">
                  <DialogHeader>
                    <DialogTitle>Create Master Product</DialogTitle>
                    <DialogDescription>
                      Create a provider-agnostic product to publish across channels.
                    </DialogDescription>
                  </DialogHeader>
                  <CreateProductForm
                    onSubmit={(data) => createProductMutation.mutate(data)}
                    isPending={createProductMutation.isPending}
                  />
                </DialogContent>
                </Dialog>
              </div>
            </div>

            {productsLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : products.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <Package className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                  <h3 className="text-lg font-medium mb-2">No Master Products</h3>
                  <p className="text-muted-foreground mb-4">
                    Create your first provider-agnostic product to get started.
                  </p>
                  <Button onClick={() => setCreateDialogOpen(true)} className="h-12">
                    <Plus className="w-5 h-5 mr-2" />
                    Create First Product
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4">
                {products.map((product) => (
                  <Card key={product.id} data-testid={`card-product-${product.id}`}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-4 flex-wrap">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <code className="text-xs bg-muted px-2 py-0.5 rounded font-mono">
                              {product.sku}
                            </code>
                            {getStatusBadge(product.status as ProductStatus)}
                            <Badge variant="outline">{product.productType}</Badge>
                          </div>
                          <h3 className="font-semibold text-lg truncate">{product.title}</h3>
                          {product.description && (
                            <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
                              {product.description}
                            </p>
                          )}
                          <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground flex-wrap">
                            {product.baseCost && (
                              <span>Cost: ${product.baseCost}</span>
                            )}
                            {product.retailPrice && (
                              <span>Retail: ${product.retailPrice}</span>
                            )}
                            {product.tags && product.tags.length > 0 && (
                              <span>Tags: {product.tags.join(", ")}</span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            className="min-h-12 min-w-12 px-3"
                            onClick={() => setEditingProduct(product)}
                            data-testid={`button-edit-${product.id}`}
                          >
                            <Edit2 className="h-5 w-5" />
                            <span className="sr-only">Edit</span>
                          </Button>
                          <Button
                            variant="destructive"
                            className="min-h-12 min-w-12 px-3"
                            onClick={() => {
                              if (confirm("Delete this product?")) {
                                deleteProductMutation.mutate(product.id);
                              }
                            }}
                            data-testid={`button-delete-${product.id}`}
                          >
                            <Trash2 className="h-5 w-5" />
                            <span className="sr-only">Delete</span>
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            {editingProduct && (
              <Dialog open={!!editingProduct} onOpenChange={() => setEditingProduct(null)}>
                <DialogContent className="sm:max-w-md">
                  <DialogHeader>
                    <DialogTitle>Edit Product</DialogTitle>
                    <DialogDescription>
                      Update product details. SKU cannot be changed.
                    </DialogDescription>
                  </DialogHeader>
                  <EditProductForm
                    product={editingProduct}
                    onSubmit={(data) => updateProductMutation.mutate({ id: editingProduct.id, data })}
                    isPending={updateProductMutation.isPending}
                    onCancel={() => setEditingProduct(null)}
                  />
                </DialogContent>
              </Dialog>
            )}
          </TabsContent>

          <TabsContent value="bundles" className="space-y-4">
            <BundlesTab />
          </TabsContent>

          <TabsContent value="channels" className="space-y-4">
            <h2 className="text-lg font-semibold">Channel Configurations</h2>
            {configsLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : channelConfigs.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <Globe className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                  <h3 className="text-lg font-medium mb-2">No Channels Configured</h3>
                  <p className="text-muted-foreground">
                    Add channel configurations to start publishing.
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {channelConfigs.map((config) => (
                  <Card key={config.id} data-testid={`card-channel-${config.channelType}`}>
                    <CardHeader className="pb-2">
                      <CardTitle className="flex items-center justify-between gap-2">
                        <span className="flex items-center gap-2">
                          <Store className="w-5 h-5" />
                          {config.displayName}
                        </span>
                        <Badge variant={config.isEnabled ? "default" : "secondary"}>
                          {config.isEnabled ? "Enabled" : "Disabled"}
                        </Badge>
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-sm space-y-1">
                        <p><span className="text-muted-foreground">Type:</span> {config.channelType}</p>
                        {config.shopId && (
                          <p><span className="text-muted-foreground">Shop ID:</span> {config.shopId}</p>
                        )}
                        {config.lastHealthCheck && (
                          <p><span className="text-muted-foreground">Last Check:</span> {new Date(config.lastHealthCheck).toLocaleString()}</p>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="routing" className="space-y-4">
            <RoutingTabContent />
          </TabsContent>

          <TabsContent value="profit" className="space-y-4">
            <ProfitTabContent />
          </TabsContent>

          <TabsContent value="repricing" className="space-y-4">
            <RepricingTabContent />
          </TabsContent>

          <TabsContent value="analytics" className="space-y-4">
            <AnalyticsTabContent />
          </TabsContent>

          <TabsContent value="health" className="space-y-4">
            <HealthTabContent />
          </TabsContent>
        </Tabs>
    </AdminShell>
  );
}
