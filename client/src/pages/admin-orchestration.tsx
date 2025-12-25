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
  Route,
  Zap,
  DollarSign,
  MapPin,
  TrendingUp,
  Play,
  Pause,
  Eye,
  AlertTriangle,
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

  interface ProviderHealthStatus {
    providerType: string;
    displayName: string;
    isHealthy: boolean;
    responseTimeMs: number;
    lastCheck: string;
    errorMessage?: string;
    errorCode?: string;
    stats24h: {
      uptimePercent: number;
      avgResponseTime: number;
      totalChecks: number;
    };
  }

  interface HealthDashboard {
    providers: ProviderHealthStatus[];
    summary: {
      totalProviders: number;
      healthyProviders: number;
      unhealthyProviders: number;
      overallHealth: "healthy" | "degraded" | "critical";
    };
  }

  interface ProviderScore {
    providerId: number;
    providerName: string;
    blueprintId: number;
    costCents: number | null;
    isUSA: boolean;
    isHealthy: boolean;
    healthScore: number;
    responseTimeMs: number | null;
    combinedScore: number;
    reason: string;
  }

  interface RoutingResult {
    success: boolean;
    selectedProvider: ProviderScore | null;
    alternativeProviders: ProviderScore[];
    reason: string;
    timestamp: string;
  }

  interface RoutingStats {
    totalRoutings: number;
    byProvider: Record<string, number>;
    avgSelectedCost: number;
    routingTimestamp: string;
  }

  interface ProfitBreakdown {
    grossRevenue: number;
    productionCost: number;
    shippingCost: number;
    platformFees: number;
    paymentProcessingFees: number;
    netProfit: number;
    marginPercent: number;
  }

  interface ChannelProfitSummary {
    channel: string;
    channelType: "direct" | "marketplace" | "print_provider";
    orderCount: number;
    totalRevenue: number;
    totalCosts: number;
    totalProfit: number;
    averageMargin: number;
    averageOrderValue: number;
  }

  interface ProductProfitAnalysis {
    masterProductId: string;
    productName: string;
    sku: string;
    totalSold: number;
    totalRevenue: number;
    averageCost: number;
    averagePrice: number;
    marginPercent: number;
    profitPerUnit: number;
    recommendedPrice?: number;
    priceHealth: "excellent" | "good" | "marginal" | "loss";
  }

  interface ProfitAlert {
    type: "warning" | "critical";
    message: string;
    productId?: string;
    channel?: string;
  }

  interface ProfitDashboard {
    totalRevenue: number;
    totalCosts: number;
    totalProfit: number;
    overallMargin: number;
    channelSummaries: ChannelProfitSummary[];
    topProducts: ProductProfitAnalysis[];
    marginDistribution: {
      excellent: number;
      good: number;
      marginal: number;
      loss: number;
    };
    alerts: ProfitAlert[];
  }

  const { data: healthData, isLoading: healthLoading, refetch: refetchHealth } = useQuery<HealthDashboard>({
    queryKey: ["/api/admin/orchestration/provider-health"],
    refetchInterval: 60000,
  });

  const { data: routingStats, isLoading: routingStatsLoading } = useQuery<RoutingStats>({
    queryKey: ["/api/admin/orchestration/routing/stats"],
  });

  const { data: profitDashboard, isLoading: profitLoading, refetch: refetchProfit } = useQuery<ProfitDashboard>({
    queryKey: ["/api/admin/orchestration/profit/dashboard"],
  });

  interface RepricingStats {
    totalRules: number;
    activeRules: number;
    lastRunTime: string | null;
    productsAdjusted24h: number;
    avgPriceChange: number;
  }

  const { data: repricingStats, isLoading: repricingStatsLoading } = useQuery<RepricingStats>({
    queryKey: ["/api/admin/orchestration/repricing/stats"],
  });

  const { data: repricingRules = [], isLoading: repricingRulesLoading } = useQuery<any[]>({
    queryKey: ["/api/admin/orchestration/repricing/rules"],
  });

  const { data: repricingHistory = [], isLoading: repricingHistoryLoading } = useQuery<any[]>({
    queryKey: ["/api/admin/orchestration/repricing/history"],
  });

  const [createRuleDialogOpen, setCreateRuleDialogOpen] = useState(false);
  const [newRuleName, setNewRuleName] = useState("");
  const [newRuleDescription, setNewRuleDescription] = useState("");
  const [newRuleActionType, setNewRuleActionType] = useState("adjust_margin");
  const [newRuleTargetMargin, setNewRuleTargetMargin] = useState("");
  const [newRuleMarginThreshold, setNewRuleMarginThreshold] = useState("");

  const createRuleMutation = useMutation({
    mutationFn: async () => {
      const params: any = {
        name: newRuleName.trim(),
        description: newRuleDescription.trim() || undefined,
        actionType: newRuleActionType,
        conditions: {},
        actionParams: {},
      };
      if (newRuleMarginThreshold) {
        params.conditions.marginBelow = parseFloat(newRuleMarginThreshold);
      }
      if (newRuleTargetMargin) {
        params.actionParams.targetMarginPercent = parseFloat(newRuleTargetMargin);
      }
      return apiRequest("POST", "/api/admin/orchestration/repricing/rules", params);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/orchestration/repricing/rules"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/orchestration/repricing/stats"] });
      setCreateRuleDialogOpen(false);
      setNewRuleName("");
      setNewRuleDescription("");
      setNewRuleTargetMargin("");
      setNewRuleMarginThreshold("");
      toast({ title: "Rule Created", description: "Repricing rule created successfully" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const toggleRuleMutation = useMutation({
    mutationFn: async (ruleId: string) => {
      return apiRequest("POST", `/api/admin/orchestration/repricing/rules/${ruleId}/toggle`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/orchestration/repricing/rules"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/orchestration/repricing/stats"] });
      toast({ title: "Rule Updated" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const deleteRuleMutation = useMutation({
    mutationFn: async (ruleId: string) => {
      return apiRequest("DELETE", `/api/admin/orchestration/repricing/rules/${ruleId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/orchestration/repricing/rules"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/orchestration/repricing/stats"] });
      toast({ title: "Rule Deleted" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const runRepricingMutation = useMutation({
    mutationFn: async ({ dryRun }: { dryRun: boolean }) => {
      return apiRequest("POST", "/api/admin/orchestration/repricing/run", { dryRun });
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/orchestration/repricing/history"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/orchestration/repricing/stats"] });
      if (data.dryRun) {
        toast({
          title: "Preview Complete",
          description: `${data.productsAffected} products would be affected`,
        });
      } else {
        queryClient.invalidateQueries({ queryKey: ["/api/admin/orchestration/master-products"] });
        toast({
          title: "Repricing Complete",
          description: `${data.productsAffected} products updated`,
        });
      }
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const [routingBlueprintId, setRoutingBlueprintId] = useState("");
  const [routingPriority, setRoutingPriority] = useState<"cost" | "speed" | "balanced">("balanced");
  const [routingResult, setRoutingResult] = useState<RoutingResult | null>(null);

  const routeOrderMutation = useMutation({
    mutationFn: async (params: { blueprintId: number; prioritize: string }) => {
      return apiRequest("POST", "/api/admin/orchestration/routing/route", params);
    },
    onSuccess: (data) => {
      setRoutingResult(data);
      queryClient.invalidateQueries({ queryKey: ["/api/admin/orchestration/routing/stats"] });
      toast({
        title: "Routing Complete",
        description: data.success ? `Routed to ${data.selectedProvider?.providerName}` : data.reason,
      });
    },
    onError: (error) => {
      toast({
        title: "Routing Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const checkHealthMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/admin/orchestration/provider-health/check");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/orchestration/provider-health"] });
      toast({ title: "Health Check Complete", description: "All providers have been checked" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
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
          <TabsList className="grid w-full grid-cols-6 mb-6 gap-1 h-auto p-1">
            <TabsTrigger value="products" className="!min-h-[48px] text-base px-4 py-3" data-testid="tab-products">
              <Package className="w-5 h-5 mr-2" />
              <span className="hidden sm:inline">Products</span>
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

          <TabsContent value="routing" className="space-y-4">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <h2 className="text-lg font-semibold">Auto-Routing</h2>
              <Badge variant="outline" className="text-xs">
                {routingStats?.totalRoutings || 0} total routings
              </Badge>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <DollarSign className="w-4 h-4" />
                    Average Selected Cost
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold">
                    ${(routingStats?.avgSelectedCost || 0).toFixed(2)}
                  </p>
                  <p className="text-xs text-muted-foreground">Per routed order</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Clock className="w-4 h-4" />
                    Last Routing
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold">
                    {routingStats?.routingTimestamp 
                      ? new Date(routingStats.routingTimestamp).toLocaleTimeString() 
                      : "Never"}
                  </p>
                  <p className="text-xs text-muted-foreground">Most recent decision</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <MapPin className="w-4 h-4" />
                    Provider Distribution
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold">
                    {Object.keys(routingStats?.byProvider || {}).length}
                  </p>
                  <p className="text-xs text-muted-foreground">Active providers</p>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Route className="w-5 h-5" />
                  Route Order to Provider
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="space-y-2">
                    <Label htmlFor="blueprintId">Blueprint ID</Label>
                    <Input
                      id="blueprintId"
                      placeholder="e.g., 6 (Bella Canvas 3001)"
                      value={routingBlueprintId}
                      onChange={(e) => setRoutingBlueprintId(e.target.value)}
                      className="h-12"
                      data-testid="input-blueprint-id"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="priority">Priority</Label>
                    <Select value={routingPriority} onValueChange={(v) => setRoutingPriority(v as "cost" | "speed" | "balanced")}>
                      <SelectTrigger className="h-12" data-testid="select-priority">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="cost">Lowest Cost</SelectItem>
                        <SelectItem value="speed">Fastest (USA)</SelectItem>
                        <SelectItem value="balanced">Balanced</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-end">
                    <Button
                      onClick={() => {
                        const id = parseInt(routingBlueprintId);
                        if (!isNaN(id)) {
                          routeOrderMutation.mutate({ blueprintId: id, prioritize: routingPriority });
                        }
                      }}
                      disabled={routeOrderMutation.isPending || !routingBlueprintId}
                      className="h-12 w-full"
                      data-testid="button-route-order"
                    >
                      {routeOrderMutation.isPending ? (
                        <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                      ) : (
                        <Route className="w-5 h-5 mr-2" />
                      )}
                      Find Best Provider
                    </Button>
                  </div>
                </div>

                {routingResult && (
                  <div className="mt-4 p-4 rounded-lg border bg-muted/50">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="font-semibold flex items-center gap-2">
                        {routingResult.success ? (
                          <CheckCircle className="w-5 h-5 text-green-500" />
                        ) : (
                          <XCircle className="w-5 h-5 text-red-500" />
                        )}
                        Routing Result
                      </h4>
                      <Badge variant={routingResult.success ? "default" : "destructive"}>
                        {routingResult.success ? "Success" : "Failed"}
                      </Badge>
                    </div>

                    {routingResult.selectedProvider && (
                      <div className="space-y-3">
                        <div className="p-3 rounded border bg-background">
                          <div className="flex items-center justify-between gap-2 flex-wrap">
                            <div>
                              <p className="font-medium">{routingResult.selectedProvider.providerName}</p>
                              <p className="text-sm text-muted-foreground">
                                Provider ID: {routingResult.selectedProvider.providerId}
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="font-bold text-lg">
                                ${routingResult.selectedProvider.costCents ? (routingResult.selectedProvider.costCents / 100).toFixed(2) : 'N/A'}
                              </p>
                              <div className="flex items-center gap-2">
                                {routingResult.selectedProvider.isUSA && (
                                  <Badge variant="outline" className="text-xs">USA</Badge>
                                )}
                                <Badge variant={routingResult.selectedProvider.isHealthy ? "default" : "secondary"} className="text-xs">
                                  {routingResult.selectedProvider.healthScore.toFixed(0)}% uptime
                                </Badge>
                              </div>
                            </div>
                          </div>
                          <p className="text-xs text-muted-foreground mt-2">
                            {routingResult.selectedProvider.reason}
                          </p>
                        </div>

                        {routingResult.alternativeProviders.length > 0 && (
                          <div>
                            <p className="text-sm font-medium mb-2">Alternatives:</p>
                            <div className="space-y-2">
                              {routingResult.alternativeProviders.map((alt) => (
                                <div key={alt.providerId} className="p-2 rounded border bg-background/50 text-sm flex items-center justify-between gap-2">
                                  <span>{alt.providerName}</span>
                                  <span className="text-muted-foreground">
                                    ${alt.costCents ? (alt.costCents / 100).toFixed(2) : 'N/A'}
                                    {alt.isUSA && " (USA)"}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {!routingResult.success && (
                      <p className="text-sm text-muted-foreground">{routingResult.reason}</p>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="profit" className="space-y-4">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <h2 className="text-lg font-semibold">Profit Analytics</h2>
              <Button
                onClick={() => refetchProfit()}
                variant="outline"
                className="h-12"
                data-testid="button-refresh-profit"
              >
                <RefreshCw className="w-5 h-5 mr-2" />
                Refresh
              </Button>
            </div>

            {profitLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <>
                <div className="grid gap-4 md:grid-cols-4">
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium flex items-center gap-2">
                        <DollarSign className="w-4 h-4" />
                        Total Revenue
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-2xl font-bold" data-testid="text-total-revenue">
                        ${(profitDashboard?.totalRevenue || 0).toFixed(2)}
                      </p>
                      <p className="text-xs text-muted-foreground">All channels combined</p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium flex items-center gap-2">
                        <Activity className="w-4 h-4" />
                        Total Costs
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-2xl font-bold" data-testid="text-total-costs">
                        ${(profitDashboard?.totalCosts || 0).toFixed(2)}
                      </p>
                      <p className="text-xs text-muted-foreground">Production + fees</p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium flex items-center gap-2">
                        <CheckCircle className="w-4 h-4" />
                        Net Profit
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className={`text-2xl font-bold ${(profitDashboard?.totalProfit || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`} data-testid="text-net-profit">
                        ${(profitDashboard?.totalProfit || 0).toFixed(2)}
                      </p>
                      <p className="text-xs text-muted-foreground">Revenue minus costs</p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium flex items-center gap-2">
                        <Route className="w-4 h-4" />
                        Overall Margin
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className={`text-2xl font-bold ${(profitDashboard?.overallMargin || 0) >= 40 ? 'text-green-600' : (profitDashboard?.overallMargin || 0) >= 20 ? 'text-yellow-600' : 'text-red-600'}`} data-testid="text-overall-margin">
                        {(profitDashboard?.overallMargin || 0).toFixed(1)}%
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {(profitDashboard?.overallMargin || 0) >= 40 ? 'Healthy' : (profitDashboard?.overallMargin || 0) >= 20 ? 'Marginal' : 'Low'}
                      </p>
                    </CardContent>
                  </Card>
                </div>

                {profitDashboard?.alerts && profitDashboard.alerts.length > 0 && (
                  <Card className="border-yellow-500/50">
                    <CardHeader>
                      <CardTitle className="text-base flex items-center gap-2">
                        <XCircle className="w-5 h-5 text-yellow-500" />
                        Profit Alerts
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        {profitDashboard.alerts.map((alert, index) => (
                          <div 
                            key={index} 
                            className={`p-3 rounded-md ${alert.type === 'critical' ? 'bg-red-500/10 border border-red-500/30' : 'bg-yellow-500/10 border border-yellow-500/30'}`}
                            data-testid={`alert-profit-${index}`}
                          >
                            <p className={`text-sm ${alert.type === 'critical' ? 'text-red-400' : 'text-yellow-400'}`}>
                              {alert.message}
                            </p>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}

                <div className="grid gap-4 md:grid-cols-2">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Channel Performance</CardTitle>
                    </CardHeader>
                    <CardContent>
                      {!profitDashboard?.channelSummaries || profitDashboard.channelSummaries.length === 0 ? (
                        <p className="text-sm text-muted-foreground">No channel data yet. Complete some orders to see performance.</p>
                      ) : (
                        <div className="space-y-3">
                          {profitDashboard.channelSummaries.map((channel) => (
                            <div key={channel.channel} className="p-3 rounded-md bg-muted/30" data-testid={`channel-${channel.channel}`}>
                              <div className="flex items-center justify-between gap-2 mb-1">
                                <span className="font-medium capitalize">{channel.channel}</span>
                                <Badge variant={channel.channelType === 'marketplace' ? 'secondary' : 'outline'}>
                                  {channel.channelType}
                                </Badge>
                              </div>
                              <div className="grid grid-cols-3 gap-2 text-sm text-muted-foreground">
                                <div>
                                  <p className="font-medium text-foreground">{channel.orderCount}</p>
                                  <p>Orders</p>
                                </div>
                                <div>
                                  <p className="font-medium text-foreground">${channel.totalRevenue.toFixed(2)}</p>
                                  <p>Revenue</p>
                                </div>
                                <div>
                                  <p className={`font-medium ${channel.averageMargin >= 40 ? 'text-green-600' : channel.averageMargin >= 20 ? 'text-yellow-600' : 'text-red-600'}`}>
                                    {channel.averageMargin.toFixed(1)}%
                                  </p>
                                  <p>Margin</p>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Margin Health Distribution</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        <div className="flex items-center justify-between p-2 rounded bg-green-500/10">
                          <span className="text-sm">Excellent (60%+)</span>
                          <Badge variant="outline" className="bg-green-500/20 text-green-400">
                            {profitDashboard?.marginDistribution?.excellent || 0} products
                          </Badge>
                        </div>
                        <div className="flex items-center justify-between p-2 rounded bg-blue-500/10">
                          <span className="text-sm">Good (40-60%)</span>
                          <Badge variant="outline" className="bg-blue-500/20 text-blue-400">
                            {profitDashboard?.marginDistribution?.good || 0} products
                          </Badge>
                        </div>
                        <div className="flex items-center justify-between p-2 rounded bg-yellow-500/10">
                          <span className="text-sm">Marginal (20-40%)</span>
                          <Badge variant="outline" className="bg-yellow-500/20 text-yellow-400">
                            {profitDashboard?.marginDistribution?.marginal || 0} products
                          </Badge>
                        </div>
                        <div className="flex items-center justify-between p-2 rounded bg-red-500/10">
                          <span className="text-sm">Loss (&lt;20%)</span>
                          <Badge variant="outline" className="bg-red-500/20 text-red-400">
                            {profitDashboard?.marginDistribution?.loss || 0} products
                          </Badge>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Top Products by Margin</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {!profitDashboard?.topProducts || profitDashboard.topProducts.length === 0 ? (
                      <p className="text-sm text-muted-foreground py-6 text-center">No products configured yet. Create master products to see margin analysis.</p>
                    ) : (
                      <div className="space-y-2">
                        {profitDashboard.topProducts.slice(0, 5).map((product) => (
                          <div key={product.masterProductId} className="p-3 rounded-md bg-muted/30 flex items-center justify-between gap-4" data-testid={`product-profit-${product.masterProductId}`}>
                            <div className="flex-1 min-w-0">
                              <p className="font-medium truncate">{product.productName}</p>
                              <p className="text-xs text-muted-foreground">{product.sku}</p>
                            </div>
                            <div className="flex items-center gap-4 text-sm">
                              <div className="text-right">
                                <p className="font-medium">${product.averagePrice.toFixed(2)}</p>
                                <p className="text-xs text-muted-foreground">Price</p>
                              </div>
                              <div className="text-right">
                                <p className="font-medium">${product.averageCost.toFixed(2)}</p>
                                <p className="text-xs text-muted-foreground">Cost</p>
                              </div>
                              <div className="text-right">
                                <p className={`font-medium ${product.priceHealth === 'excellent' ? 'text-green-600' : product.priceHealth === 'good' ? 'text-blue-600' : product.priceHealth === 'marginal' ? 'text-yellow-600' : 'text-red-600'}`}>
                                  {product.marginPercent.toFixed(1)}%
                                </p>
                                <p className="text-xs text-muted-foreground">Margin</p>
                              </div>
                              <Badge variant={product.priceHealth === 'excellent' || product.priceHealth === 'good' ? 'default' : product.priceHealth === 'marginal' ? 'secondary' : 'destructive'}>
                                {product.priceHealth}
                              </Badge>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </>
            )}
          </TabsContent>

          <TabsContent value="repricing" className="space-y-4">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <h2 className="text-lg font-semibold">Auto-Repricing Rules</h2>
              <div className="flex items-center gap-2 flex-wrap">
                <Button
                  onClick={() => runRepricingMutation.mutate({ dryRun: true })}
                  disabled={runRepricingMutation.isPending}
                  variant="outline"
                  className="h-12"
                  data-testid="button-preview-repricing"
                >
                  {runRepricingMutation.isPending ? (
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  ) : (
                    <Eye className="w-5 h-5 mr-2" />
                  )}
                  Preview Changes
                </Button>
                <Button
                  onClick={() => runRepricingMutation.mutate({ dryRun: false })}
                  disabled={runRepricingMutation.isPending}
                  className="h-12"
                  data-testid="button-run-repricing"
                >
                  {runRepricingMutation.isPending ? (
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  ) : (
                    <Play className="w-5 h-5 mr-2" />
                  )}
                  Apply Rules
                </Button>
              </div>
            </div>

            {repricingStatsLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <Card>
                    <CardContent className="p-4">
                      <p className="text-sm text-muted-foreground">Total Rules</p>
                      <p className="text-2xl font-bold" data-testid="text-total-rules">{repricingStats?.totalRules || 0}</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-4">
                      <p className="text-sm text-muted-foreground">Active Rules</p>
                      <p className="text-2xl font-bold text-green-600" data-testid="text-active-rules">{repricingStats?.activeRules || 0}</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-4">
                      <p className="text-sm text-muted-foreground">Products Adjusted (24h)</p>
                      <p className="text-2xl font-bold" data-testid="text-products-adjusted">{repricingStats?.productsAdjusted24h || 0}</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-4">
                      <p className="text-sm text-muted-foreground">Avg Price Change</p>
                      <p className="text-2xl font-bold" data-testid="text-avg-change">${repricingStats?.avgPriceChange?.toFixed(2) || '0.00'}</p>
                    </CardContent>
                  </Card>
                </div>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between gap-4 pb-3">
                    <CardTitle className="text-base">Repricing Rules</CardTitle>
                    <Dialog open={createRuleDialogOpen} onOpenChange={setCreateRuleDialogOpen}>
                      <DialogTrigger asChild>
                        <Button className="h-12" data-testid="button-create-rule">
                          <Plus className="w-5 h-5 mr-2" />
                          Create Rule
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="sm:max-w-lg">
                        <DialogHeader>
                          <DialogTitle>Create Repricing Rule</DialogTitle>
                          <DialogDescription>
                            Set up automatic price adjustments based on conditions.
                          </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4 py-4">
                          <div className="space-y-2">
                            <Label htmlFor="rule-name">Rule Name</Label>
                            <Input
                              id="rule-name"
                              value={newRuleName}
                              onChange={(e) => setNewRuleName(e.target.value)}
                              placeholder="e.g., Protect Amazon Margins"
                              data-testid="input-rule-name"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="rule-description">Description</Label>
                            <Textarea
                              id="rule-description"
                              value={newRuleDescription}
                              onChange={(e) => setNewRuleDescription(e.target.value)}
                              placeholder="What this rule does..."
                              data-testid="input-rule-description"
                            />
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <Label htmlFor="action-type">Action Type</Label>
                              <Select value={newRuleActionType} onValueChange={setNewRuleActionType}>
                                <SelectTrigger id="action-type" data-testid="select-action-type">
                                  <SelectValue placeholder="Select action" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="adjust_margin">Adjust to Target Margin</SelectItem>
                                  <SelectItem value="increase_percent">Increase by Percent</SelectItem>
                                  <SelectItem value="decrease_percent">Decrease by Percent</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="target-margin">Target Margin %</Label>
                              <Input
                                id="target-margin"
                                type="number"
                                value={newRuleTargetMargin}
                                onChange={(e) => setNewRuleTargetMargin(e.target.value)}
                                placeholder="50"
                                data-testid="input-target-margin"
                              />
                            </div>
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="margin-threshold">Trigger When Margin Below %</Label>
                            <Input
                              id="margin-threshold"
                              type="number"
                              value={newRuleMarginThreshold}
                              onChange={(e) => setNewRuleMarginThreshold(e.target.value)}
                              placeholder="20"
                              data-testid="input-margin-threshold"
                            />
                          </div>
                        </div>
                        <DialogFooter>
                          <Button variant="outline" onClick={() => setCreateRuleDialogOpen(false)}>
                            Cancel
                          </Button>
                          <Button
                            onClick={() => createRuleMutation.mutate()}
                            disabled={createRuleMutation.isPending || !newRuleName.trim()}
                            data-testid="button-submit-rule"
                          >
                            {createRuleMutation.isPending ? (
                              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            ) : null}
                            Create Rule
                          </Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                  </CardHeader>
                  <CardContent>
                    {repricingRulesLoading ? (
                      <div className="flex items-center justify-center py-8">
                        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                      </div>
                    ) : !repricingRules || repricingRules.length === 0 ? (
                      <p className="text-sm text-muted-foreground py-6 text-center">
                        No repricing rules configured. Create a rule to automate price adjustments.
                      </p>
                    ) : (
                      <div className="space-y-3">
                        {repricingRules.map((rule: any) => (
                          <div
                            key={rule.id}
                            className={`p-4 rounded-md border ${rule.isActive ? 'border-green-500/30 bg-green-500/5' : 'border-muted bg-muted/20'}`}
                            data-testid={`rule-${rule.id}`}
                          >
                            <div className="flex items-center justify-between gap-4 flex-wrap">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <h4 className="font-medium">{rule.name}</h4>
                                  <Badge variant={rule.isActive ? 'default' : 'secondary'}>
                                    {rule.isActive ? 'Active' : 'Inactive'}
                                  </Badge>
                                </div>
                                <p className="text-sm text-muted-foreground mt-1">
                                  {rule.description || `${rule.actionType} - Priority ${rule.priority || 0}`}
                                </p>
                              </div>
                              <div className="flex items-center gap-2">
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="min-h-12 min-w-12"
                                  onClick={() => toggleRuleMutation.mutate(rule.id)}
                                  disabled={toggleRuleMutation.isPending}
                                  data-testid={`button-toggle-rule-${rule.id}`}
                                >
                                  {rule.isActive ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
                                </Button>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="min-h-12 min-w-12 text-destructive hover:text-destructive"
                                  onClick={() => deleteRuleMutation.mutate(rule.id)}
                                  disabled={deleteRuleMutation.isPending}
                                  data-testid={`button-delete-rule-${rule.id}`}
                                >
                                  <Trash2 className="w-5 h-5" />
                                </Button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Recent Price Changes</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {repricingHistoryLoading ? (
                      <div className="flex items-center justify-center py-8">
                        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                      </div>
                    ) : !repricingHistory || repricingHistory.length === 0 ? (
                      <p className="text-sm text-muted-foreground py-6 text-center">
                        No price changes recorded yet. Run the repricing engine to see history here.
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {repricingHistory.slice(0, 10).map((entry: any) => (
                          <div
                            key={entry.id}
                            className="p-3 rounded-md bg-muted/30 flex items-center justify-between gap-4"
                            data-testid={`history-${entry.id}`}
                          >
                            <div className="flex-1 min-w-0">
                              <p className="font-medium truncate">{entry.productTitle || 'Unknown Product'}</p>
                              <p className="text-xs text-muted-foreground">{entry.reason}</p>
                            </div>
                            <div className="flex items-center gap-4 text-sm">
                              <div className="text-right">
                                <p className="text-muted-foreground line-through">${parseFloat(entry.previousPrice || 0).toFixed(2)}</p>
                                <p className="font-medium text-green-600">${parseFloat(entry.newPrice || 0).toFixed(2)}</p>
                              </div>
                              <div className="text-right">
                                <p className="text-xs text-muted-foreground">
                                  {entry.previousMargin ? `${parseFloat(entry.previousMargin).toFixed(1)}%` : '-'}
                                </p>
                                <p className="text-xs font-medium">
                                  {entry.newMargin ? `${parseFloat(entry.newMargin).toFixed(1)}%` : '-'}
                                </p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </>
            )}
          </TabsContent>

          <TabsContent value="health" className="space-y-4">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <h2 className="text-lg font-semibold">Provider Health Status</h2>
              <Button
                onClick={() => checkHealthMutation.mutate()}
                disabled={checkHealthMutation.isPending}
                className="h-12"
                data-testid="button-check-health"
              >
                {checkHealthMutation.isPending ? (
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                ) : (
                  <RefreshCw className="w-5 h-5 mr-2" />
                )}
                Check All Providers
              </Button>
            </div>

            {healthData?.summary && (
              <Card className="mb-4">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between gap-4 flex-wrap">
                    <div className="flex items-center gap-3">
                      <div className={`w-4 h-4 rounded-full ${
                        healthData.summary.overallHealth === "healthy" ? "bg-green-500" :
                        healthData.summary.overallHealth === "degraded" ? "bg-yellow-500" : "bg-red-500"
                      }`} />
                      <span className="font-semibold text-lg capitalize">
                        System: {healthData.summary.overallHealth}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <CheckCircle className="w-4 h-4 text-green-500" />
                        {healthData.summary.healthyProviders} healthy
                      </span>
                      <span className="flex items-center gap-1">
                        <XCircle className="w-4 h-4 text-red-500" />
                        {healthData.summary.unhealthyProviders} down
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {healthLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : !healthData?.providers || healthData.providers.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <Activity className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                  <h3 className="text-lg font-medium mb-2">No Providers Loaded</h3>
                  <p className="text-muted-foreground mb-4">
                    Provider adapters will appear here once configured.
                  </p>
                  <Button 
                    onClick={() => checkHealthMutation.mutate()} 
                    className="h-12"
                    disabled={checkHealthMutation.isPending}
                  >
                    <RefreshCw className="w-5 h-5 mr-2" />
                    Run First Health Check
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
                {healthData.providers.map((provider) => (
                  <Card key={provider.providerType} data-testid={`card-health-${provider.providerType}`}>
                    <CardContent className="p-5">
                      <div className="flex items-center justify-between gap-2 mb-3">
                        <span className="font-semibold text-lg">{provider.displayName}</span>
                        {provider.isHealthy ? (
                          <Badge className="bg-green-600 min-h-8 px-3">
                            <CheckCircle className="w-4 h-4 mr-1" />
                            Healthy
                          </Badge>
                        ) : (
                          <Badge variant="destructive" className="min-h-8 px-3">
                            <XCircle className="w-4 h-4 mr-1" />
                            Down
                          </Badge>
                        )}
                      </div>
                      
                      <div className="text-sm space-y-2">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Response Time</span>
                          <span className={provider.responseTimeMs > 1000 ? "text-yellow-600" : "text-foreground"}>
                            {provider.responseTimeMs}ms
                          </span>
                        </div>
                        
                        {provider.stats24h.totalChecks > 0 && (
                          <>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">24h Uptime</span>
                              <span className={provider.stats24h.uptimePercent < 95 ? "text-yellow-600" : "text-green-600"}>
                                {provider.stats24h.uptimePercent}%
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Avg Response</span>
                              <span>{provider.stats24h.avgResponseTime}ms</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Checks (24h)</span>
                              <span>{provider.stats24h.totalChecks}</span>
                            </div>
                          </>
                        )}
                        
                        {provider.errorMessage && (
                          <div className="mt-2 p-2 bg-destructive/10 rounded text-xs text-destructive">
                            {provider.errorCode && <span className="font-mono mr-1">[{provider.errorCode}]</span>}
                            {provider.errorMessage}
                          </div>
                        )}
                        
                        <div className="pt-2 border-t text-xs text-muted-foreground">
                          Last check: {provider.lastCheck ? new Date(provider.lastCheck).toLocaleString() : "Never"}
                        </div>
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
