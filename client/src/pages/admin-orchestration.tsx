import { useLocation, Link } from "wouter";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import {
  ArrowLeft,
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
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { MasterProduct, ChannelConfig } from "@shared/schema";

type ProductType = "hat" | "shirt" | "mug" | "bag" | "other";
type ProductStatus = "draft" | "active" | "paused" | "archived";

export default function AdminOrchestration() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<MasterProduct | null>(null);

  const { data: products = [], isLoading: productsLoading, refetch: refetchProducts } = useQuery<MasterProduct[]>({
    queryKey: ["/api/admin/orchestration/master-products"],
  });

  const { data: channelConfigs = [], isLoading: configsLoading } = useQuery<ChannelConfig[]>({
    queryKey: ["/api/admin/orchestration/channel-configs"],
  });

  const { data: healthData, isLoading: healthLoading } = useQuery<{adapters: {channel: string; isHealthy: boolean; lastCheck: string | null}[]}>({
    queryKey: ["/api/admin/orchestration/health"],
    refetchInterval: 60000,
  });

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
    <div className="min-h-screen bg-background">
      <div className="bg-slate-900 dark:bg-slate-950 text-white">
        <div className="container max-w-6xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                onClick={() => navigate("/admin")}
                className="text-white hover:bg-white/10 min-h-12 min-w-12 p-3"
                data-testid="button-back"
              >
                <ArrowLeft className="h-6 w-6" />
                <span className="sr-only">Back to Admin</span>
              </Button>
              <div>
                <h1 className="text-xl font-bold font-heading" data-testid="text-page-title">
                  Multi-Provider Orchestration
                </h1>
                <p className="text-xs text-slate-400">
                  Manage products across Printify, Printful, Etsy, eBay, Amazon
                </p>
              </div>
            </div>
            <Button
              onClick={() => refetchProducts()}
              variant="outline"
              className="h-12 border-slate-600 text-slate-300 hover:bg-slate-800"
              data-testid="button-refresh"
            >
              <RefreshCw className="h-5 w-5 mr-2" />
              Refresh
            </Button>
          </div>
        </div>
      </div>

      <main className="container max-w-6xl mx-auto py-6 px-4">
        <nav className="mb-4 text-sm" aria-label="Breadcrumb">
          <Link href="/" className="text-muted-foreground hover:text-foreground">Home</Link>
          <span className="text-muted-foreground mx-2">/</span>
          <Link href="/admin" className="text-muted-foreground hover:text-foreground">Admin</Link>
          <span className="text-muted-foreground mx-2">/</span>
          <span className="text-foreground font-medium">Orchestration</span>
        </nav>

        <Tabs defaultValue="products" className="w-full">
          <TabsList className="grid w-full grid-cols-3 mb-6 gap-1 h-auto p-1">
            <TabsTrigger value="products" className="!min-h-[48px] text-base px-4 py-3" data-testid="tab-products">
              <Package className="w-5 h-5 mr-2" />
              <span className="hidden sm:inline">Products</span>
            </TabsTrigger>
            <TabsTrigger value="channels" className="!min-h-[48px] text-base px-4 py-3" data-testid="tab-channels">
              <Globe className="w-5 h-5 mr-2" />
              <span className="hidden sm:inline">Channels</span>
            </TabsTrigger>
            <TabsTrigger value="health" className="!min-h-[48px] text-base px-4 py-3" data-testid="tab-health">
              <Activity className="w-5 h-5 mr-2" />
              <span className="hidden sm:inline">Health</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="products" className="space-y-4">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <h2 className="text-lg font-semibold">Master Products</h2>
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

          <TabsContent value="health" className="space-y-4">
            <h2 className="text-lg font-semibold">Provider Health Status</h2>
            {healthLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : !healthData?.adapters || healthData.adapters.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <Activity className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                  <h3 className="text-lg font-medium mb-2">No Adapters Loaded</h3>
                  <p className="text-muted-foreground">
                    Provider adapters will appear here once configured.
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
                {healthData.adapters.map((adapter) => (
                  <Card key={adapter.channel} data-testid={`card-health-${adapter.channel}`}>
                    <CardContent className="p-5">
                      <div className="flex items-center justify-between gap-2 mb-3">
                        <span className="font-semibold text-lg capitalize">{adapter.channel}</span>
                        {adapter.isHealthy ? (
                          <Badge className="bg-green-600 min-h-8 px-3">
                            <CheckCircle className="w-4 h-4 mr-1" />
                            Healthy
                          </Badge>
                        ) : (
                          <Badge variant="destructive" className="min-h-8 px-3">
                            <XCircle className="w-4 h-4 mr-1" />
                            Unhealthy
                          </Badge>
                        )}
                      </div>
                      <div className="text-sm text-muted-foreground space-y-1">
                        <p>Status: <span className={adapter.isHealthy ? "text-green-600" : "text-destructive"}>{adapter.isHealthy ? "Online" : "Offline"}</span></p>
                        {adapter.lastCheck ? (
                          <p>Last check: {new Date(adapter.lastCheck).toLocaleString()}</p>
                        ) : (
                          <p>Last check: Never</p>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}

function CreateProductForm({
  onSubmit,
  isPending,
}: {
  onSubmit: (data: { title: string; description: string; productType: string; tags: string[] }) => void;
  isPending: boolean;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [productType, setProductType] = useState<ProductType>("hat");
  const [tagsInput, setTagsInput] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const tags = tagsInput.split(",").map((t) => t.trim()).filter(Boolean);
    onSubmit({ title, description, productType, tags });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="title">Title</Label>
        <Input
          id="title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Product title"
          className="h-12"
          required
          data-testid="input-title"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Product description"
          rows={3}
          data-testid="input-description"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="productType">Product Type</Label>
        <Select value={productType} onValueChange={(v) => setProductType(v as ProductType)}>
          <SelectTrigger className="h-12" data-testid="select-product-type">
            <SelectValue placeholder="Select type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="hat">Hat</SelectItem>
            <SelectItem value="shirt">Shirt</SelectItem>
            <SelectItem value="mug">Mug</SelectItem>
            <SelectItem value="bag">Bag</SelectItem>
            <SelectItem value="other">Other</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="tags">Tags (comma separated)</Label>
        <Input
          id="tags"
          value={tagsInput}
          onChange={(e) => setTagsInput(e.target.value)}
          placeholder="summer, marketing, promo"
          className="h-12"
          data-testid="input-tags"
        />
      </div>
      <DialogFooter>
        <Button type="submit" disabled={isPending || !title} className="h-12 w-full" data-testid="button-submit-create">
          {isPending ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <Plus className="w-5 h-5 mr-2" />}
          Create Product
        </Button>
      </DialogFooter>
    </form>
  );
}

function EditProductForm({
  product,
  onSubmit,
  isPending,
  onCancel,
}: {
  product: MasterProduct;
  onSubmit: (data: Partial<MasterProduct>) => void;
  isPending: boolean;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState(product.title);
  const [description, setDescription] = useState(product.description || "");
  const [status, setStatus] = useState<ProductStatus>(product.status as ProductStatus);
  const [baseCost, setBaseCost] = useState(product.baseCost || "");
  const [retailPrice, setRetailPrice] = useState(product.retailPrice || "");
  const [tagsInput, setTagsInput] = useState((product.tags || []).join(", "));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const tags = tagsInput.split(",").map((t) => t.trim()).filter(Boolean);
    onSubmit({
      title,
      description: description || null,
      status,
      baseCost: baseCost || null,
      retailPrice: retailPrice || null,
      tags,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label>SKU</Label>
        <Input value={product.sku} disabled className="h-12 font-mono bg-muted" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="edit-title">Title</Label>
        <Input
          id="edit-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="h-12"
          required
          data-testid="input-edit-title"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="edit-description">Description</Label>
        <Textarea
          id="edit-description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          data-testid="input-edit-description"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="edit-status">Status</Label>
        <Select value={status} onValueChange={(v) => setStatus(v as ProductStatus)}>
          <SelectTrigger className="h-12" data-testid="select-edit-status">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="paused">Paused</SelectItem>
            <SelectItem value="archived">Archived</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="edit-baseCost">Base Cost ($)</Label>
          <Input
            id="edit-baseCost"
            value={baseCost}
            onChange={(e) => setBaseCost(e.target.value)}
            type="number"
            step="0.01"
            className="h-12"
            placeholder="0.00"
            data-testid="input-edit-baseCost"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="edit-retailPrice">Retail Price ($)</Label>
          <Input
            id="edit-retailPrice"
            value={retailPrice}
            onChange={(e) => setRetailPrice(e.target.value)}
            type="number"
            step="0.01"
            className="h-12"
            placeholder="0.00"
            data-testid="input-edit-retailPrice"
          />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="edit-tags">Tags (comma separated)</Label>
        <Input
          id="edit-tags"
          value={tagsInput}
          onChange={(e) => setTagsInput(e.target.value)}
          className="h-12"
          data-testid="input-edit-tags"
        />
      </div>
      <DialogFooter className="gap-2 sm:gap-0">
        <Button type="button" variant="outline" onClick={onCancel} className="h-12" data-testid="button-cancel-edit">
          Cancel
        </Button>
        <Button type="submit" disabled={isPending || !title} className="h-12" data-testid="button-submit-edit">
          {isPending ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <Edit2 className="w-5 h-5 mr-2" />}
          Save Changes
        </Button>
      </DialogFooter>
    </form>
  );
}
