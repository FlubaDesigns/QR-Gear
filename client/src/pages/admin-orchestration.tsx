import AdminShell from "@/components/AdminShell";
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
  MapPin,
  TrendingUp,
  Play,
  Pause,
  Eye,
  AlertTriangle,
  BarChart,
  Smartphone,
  Monitor,
  Tablet,
  Upload,
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
import { Progress } from "@/components/ui/progress";
import type { MasterProduct, ChannelConfig } from "@shared/schema";
import { authFetch } from "@/features/adminAuth/authFetch";
import { useAdminAuth } from "@/features/shared/AdminAuthContext";

type ProductType = "hat" | "shirt" | "mug" | "bag" | "other";
type ProductStatus = "draft" | "active" | "paused" | "archived";

export default function AdminOrchestration() {
  const { toast } = useToast();
  const { getAuthHeaders } = useAdminAuth();
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

  interface QrAnalyticsSummary {
    totalScans: number;
    scansToday: number;
    scansThisWeek: number;
    scansThisMonth: number;
    uniqueProducts: number;
    topCountries: Array<{ country: string; scans: number }>;
    topDevices: Array<{ deviceType: string; scans: number }>;
  }

  interface ProductScanAnalytics {
    productId: string;
    productName: string;
    totalScans: number;
    scansToday: number;
    scansThisWeek: number;
    lastScanned: string | null;
  }

  interface ScanTrend {
    date: string;
    scans: number;
  }

  const { data: qrAnalyticsSummary, isLoading: qrAnalyticsLoading } = useQuery<QrAnalyticsSummary>({
    queryKey: ["/api/admin/orchestration/qr-analytics/summary"],
  });

  const { data: productScans = [], isLoading: productScansLoading } = useQuery<ProductScanAnalytics[]>({
    queryKey: ["/api/admin/orchestration/qr-analytics/products"],
  });

  const { data: scanTrends = [], isLoading: scanTrendsLoading } = useQuery<ScanTrend[]>({
    queryKey: ["/api/admin/orchestration/qr-analytics/trends"],
  });

  const getDeviceIcon = (deviceType: string) => {
    switch (deviceType?.toLowerCase()) {
      case "mobile":
        return <Smartphone className="w-4 h-4" />;
      case "tablet":
        return <Tablet className="w-4 h-4" />;
      default:
        return <Monitor className="w-4 h-4" />;
    }
  };

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
      const res = await apiRequest("POST", "/api/admin/orchestration/repricing/run", { dryRun });
      return res.json() as Promise<{ dryRun: boolean; productsAffected: number }>;
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
      const res = await apiRequest("POST", "/api/admin/orchestration/routing/route", params);
      return res.json() as Promise<RoutingResult>;
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
    <AdminShell
      title="Multi-Provider Orchestration"
      subtitle="Manage products across Printify, Printful, Etsy, eBay, Amazon"
      icon={Layers}
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

          <TabsContent value="analytics" className="space-y-4">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <h2 className="text-lg font-semibold">QR Scan Analytics</h2>
            </div>

            {qrAnalyticsLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                  <Card>
                    <CardContent className="p-4">
                      <p className="text-sm text-muted-foreground">Total Scans</p>
                      <p className="text-2xl font-bold" data-testid="text-total-scans">{qrAnalyticsSummary?.totalScans || 0}</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-4">
                      <p className="text-sm text-muted-foreground">Today</p>
                      <p className="text-2xl font-bold text-blue-600" data-testid="text-scans-today">{qrAnalyticsSummary?.scansToday || 0}</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-4">
                      <p className="text-sm text-muted-foreground">This Week</p>
                      <p className="text-2xl font-bold" data-testid="text-scans-week">{qrAnalyticsSummary?.scansThisWeek || 0}</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-4">
                      <p className="text-sm text-muted-foreground">This Month</p>
                      <p className="text-2xl font-bold" data-testid="text-scans-month">{qrAnalyticsSummary?.scansThisMonth || 0}</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-4">
                      <p className="text-sm text-muted-foreground">Products Tracked</p>
                      <p className="text-2xl font-bold" data-testid="text-unique-products">{qrAnalyticsSummary?.uniqueProducts || 0}</p>
                    </CardContent>
                  </Card>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base">Top Countries</CardTitle>
                    </CardHeader>
                    <CardContent>
                      {!qrAnalyticsSummary?.topCountries || qrAnalyticsSummary.topCountries.length === 0 ? (
                        <p className="text-sm text-muted-foreground py-4 text-center">
                          No geographic data available yet
                        </p>
                      ) : (
                        <div className="space-y-2">
                          {qrAnalyticsSummary.topCountries.map((entry, idx) => (
                            <div
                              key={idx}
                              className="flex items-center justify-between p-2 rounded-md bg-muted/30"
                            >
                              <span className="font-medium">{entry.country}</span>
                              <Badge variant="secondary">{entry.scans} scans</Badge>
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base">Device Types</CardTitle>
                    </CardHeader>
                    <CardContent>
                      {!qrAnalyticsSummary?.topDevices || qrAnalyticsSummary.topDevices.length === 0 ? (
                        <p className="text-sm text-muted-foreground py-4 text-center">
                          No device data available yet
                        </p>
                      ) : (
                        <div className="space-y-2">
                          {qrAnalyticsSummary.topDevices.map((entry, idx) => (
                            <div
                              key={idx}
                              className="flex items-center justify-between p-2 rounded-md bg-muted/30"
                            >
                              <div className="flex items-center gap-2">
                                {getDeviceIcon(entry.deviceType)}
                                <span className="font-medium capitalize">{entry.deviceType}</span>
                              </div>
                              <Badge variant="secondary">{entry.scans} scans</Badge>
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Product Scan Rankings</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {productScansLoading ? (
                      <div className="flex items-center justify-center py-8">
                        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                      </div>
                    ) : productScans.length === 0 ? (
                      <p className="text-sm text-muted-foreground py-6 text-center">
                        No product scans recorded yet. Scans will appear here as QR codes are used.
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {productScans.slice(0, 10).map((product, idx) => (
                          <div
                            key={product.productId}
                            className="p-3 rounded-md bg-muted/30 flex items-center justify-between gap-4"
                            data-testid={`product-scan-${product.productId}`}
                          >
                            <div className="flex items-center gap-3 flex-1 min-w-0">
                              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold">
                                {idx + 1}
                              </div>
                              <div className="min-w-0">
                                <p className="font-medium truncate">{product.productName}</p>
                                <p className="text-xs text-muted-foreground">
                                  {product.lastScanned ? `Last: ${new Date(product.lastScanned).toLocaleDateString()}` : 'No scans yet'}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-4 text-sm">
                              <div className="text-right">
                                <p className="font-bold">{product.totalScans}</p>
                                <p className="text-xs text-muted-foreground">total</p>
                              </div>
                              <div className="text-right">
                                <p className="font-medium text-blue-600">{product.scansToday}</p>
                                <p className="text-xs text-muted-foreground">today</p>
                              </div>
                              <div className="text-right">
                                <p className="font-medium">{product.scansThisWeek}</p>
                                <p className="text-xs text-muted-foreground">week</p>
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
                    <CardTitle className="text-base">Scan Trends (30 Days)</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {scanTrendsLoading ? (
                      <div className="flex items-center justify-center py-8">
                        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                      </div>
                    ) : scanTrends.length === 0 ? (
                      <p className="text-sm text-muted-foreground py-6 text-center">
                        No trend data available yet
                      </p>
                    ) : (
                      <div className="h-48 flex items-end gap-1">
                        {scanTrends.slice(-30).map((trend, idx) => {
                          const maxScans = Math.max(...scanTrends.map(t => t.scans), 1);
                          const height = (trend.scans / maxScans) * 100;
                          return (
                            <div
                              key={idx}
                              className="flex-1 bg-primary/20 hover:bg-primary/40 rounded-t transition-colors"
                              style={{ height: `${Math.max(height, 2)}%` }}
                              title={`${trend.date}: ${trend.scans} scans`}
                            />
                          );
                        })}
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
    </AdminShell>
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

interface ProductBundle {
  id: string;
  name: string;
  description: string | null;
  bundleType: string;
  displayImage: string | null;
  displayOrder: number | null;
  pricingType: string;
  discountPercent: string | null;
  fixedPrice: string | null;
  discountAmount: string | null;
  minItems: number | null;
  maxItems: number | null;
  isActive: boolean | null;
  displayLocations: string[] | null;
  triggerProductIds: string[] | null;
  startDate: string | null;
  endDate: string | null;
  createdAt: string;
  updatedAt: string;
  items?: BundleItem[];
}

interface BundleItem {
  id: string;
  bundleId: string;
  masterProductId: string | null;
  productId: number | null;
  displayOrder: number | null;
  quantity: number | null;
  isRequired: boolean | null;
  itemDiscountPercent: string | null;
}

function BundlesTab() {
  const { toast } = useToast();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editingBundle, setEditingBundle] = useState<ProductBundle | null>(null);

  const { data: bundles = [], isLoading, refetch } = useQuery<ProductBundle[]>({
    queryKey: ["/api/admin/orchestration/bundles"],
  });

  const { data: masterProducts = [] } = useQuery<MasterProduct[]>({
    queryKey: ["/api/admin/orchestration/master-products"],
  });

  const createBundleMutation = useMutation({
    mutationFn: async (data: Partial<ProductBundle>) => {
      return apiRequest("POST", "/api/admin/orchestration/bundles", data);
    },
    onSuccess: () => {
      toast({ title: "Bundle created successfully" });
      setCreateDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ["/api/admin/orchestration/bundles"] });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to create bundle", description: error.message, variant: "destructive" });
    },
  });

  const deleteBundleMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/admin/orchestration/bundles/${id}`);
    },
    onSuccess: () => {
      toast({ title: "Bundle deleted" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/orchestration/bundles"] });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to delete bundle", description: error.message, variant: "destructive" });
    },
  });

  const toggleBundleMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("POST", `/api/admin/orchestration/bundles/${id}/toggle`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/orchestration/bundles"] });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to toggle bundle", description: error.message, variant: "destructive" });
    },
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <h2 className="text-lg font-semibold">Cross-Sell Bundles</h2>
        <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button className="h-12" data-testid="button-create-bundle">
              <Plus className="w-5 h-5 mr-2" />
              Create Bundle
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Create Bundle</DialogTitle>
              <DialogDescription>
                Create a product bundle for cross-selling and discounts.
              </DialogDescription>
            </DialogHeader>
            <BundleForm
              masterProducts={masterProducts}
              onSubmit={(data) => createBundleMutation.mutate(data)}
              isPending={createBundleMutation.isPending}
            />
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : bundles.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Layers className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-medium mb-2">No Bundles</h3>
            <p className="text-muted-foreground mb-4">
              Create product bundles to offer discounts and cross-sell.
            </p>
            <Button onClick={() => setCreateDialogOpen(true)} className="h-12">
              <Plus className="w-5 h-5 mr-2" />
              Create First Bundle
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {bundles.map((bundle) => (
            <Card key={bundle.id} data-testid={`card-bundle-${bundle.id}`}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <Badge variant={bundle.isActive ? "default" : "secondary"}>
                        {bundle.isActive ? "Active" : "Inactive"}
                      </Badge>
                      <Badge variant="outline">{bundle.bundleType}</Badge>
                      <Badge variant="outline">{bundle.pricingType}</Badge>
                    </div>
                    <h3 className="font-semibold text-lg">{bundle.name}</h3>
                    {bundle.description && (
                      <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
                        {bundle.description}
                      </p>
                    )}
                    <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground flex-wrap">
                      {bundle.pricingType === "discount_percent" && bundle.discountPercent && (
                        <span>{bundle.discountPercent}% off</span>
                      )}
                      {bundle.pricingType === "fixed_price" && bundle.fixedPrice && (
                        <span>${bundle.fixedPrice} bundle price</span>
                      )}
                      {bundle.pricingType === "discount_amount" && bundle.discountAmount && (
                        <span>${bundle.discountAmount} off</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <Button
                      variant="outline"
                      onClick={() => toggleBundleMutation.mutate(bundle.id)}
                      className="h-12 px-4"
                      data-testid={`button-toggle-bundle-${bundle.id}`}
                      aria-label={bundle.isActive ? "Pause bundle" : "Activate bundle"}
                    >
                      {bundle.isActive ? <Pause className="w-5 h-5 mr-2" /> : <Play className="w-5 h-5 mr-2" />}
                      {bundle.isActive ? "Pause" : "Activate"}
                    </Button>
                    <Button
                      variant="destructive"
                      onClick={() => deleteBundleMutation.mutate(bundle.id)}
                      className="h-12 px-4"
                      data-testid={`button-delete-bundle-${bundle.id}`}
                      aria-label="Delete bundle"
                    >
                      <Trash2 className="w-5 h-5 mr-2" />
                      Delete
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function BundleForm({
  masterProducts,
  onSubmit,
  isPending,
}: {
  masterProducts: MasterProduct[];
  onSubmit: (data: Partial<ProductBundle>) => void;
  isPending: boolean;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [bundleType, setBundleType] = useState("fixed");
  const [pricingType, setPricingType] = useState("discount_percent");
  const [discountPercent, setDiscountPercent] = useState("10");
  const [fixedPrice, setFixedPrice] = useState("");
  const [discountAmount, setDiscountAmount] = useState("");
  const [selectedProducts, setSelectedProducts] = useState<string[]>([]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      name,
      description: description || null,
      bundleType,
      pricingType,
      discountPercent: pricingType === "discount_percent" ? discountPercent : null,
      fixedPrice: pricingType === "fixed_price" ? fixedPrice : null,
      discountAmount: pricingType === "discount_amount" ? discountAmount : null,
      isActive: true,
      items: selectedProducts.map((id, idx) => ({
        masterProductId: id,
        displayOrder: idx,
        quantity: 1,
      })) as any[],
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="bundle-name">Bundle Name</Label>
        <Input
          id="bundle-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="h-12"
          required
          data-testid="input-bundle-name"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="bundle-description">Description</Label>
        <Textarea
          id="bundle-description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
          data-testid="input-bundle-description"
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Bundle Type</Label>
          <Select value={bundleType} onValueChange={setBundleType}>
            <SelectTrigger className="h-12" data-testid="select-bundle-type">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="fixed">Fixed Bundle</SelectItem>
              <SelectItem value="pick">Pick N Items</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Pricing Type</Label>
          <Select value={pricingType} onValueChange={setPricingType}>
            <SelectTrigger className="h-12" data-testid="select-pricing-type">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="discount_percent">Percent Discount</SelectItem>
              <SelectItem value="fixed_price">Fixed Price</SelectItem>
              <SelectItem value="discount_amount">Amount Off</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      {pricingType === "discount_percent" && (
        <div className="space-y-2">
          <Label htmlFor="discount-percent">Discount Percent (%)</Label>
          <Input
            id="discount-percent"
            type="number"
            value={discountPercent}
            onChange={(e) => setDiscountPercent(e.target.value)}
            className="h-12"
            min="1"
            max="100"
            data-testid="input-discount-percent"
          />
        </div>
      )}
      {pricingType === "fixed_price" && (
        <div className="space-y-2">
          <Label htmlFor="fixed-price">Bundle Price ($)</Label>
          <Input
            id="fixed-price"
            type="number"
            step="0.01"
            value={fixedPrice}
            onChange={(e) => setFixedPrice(e.target.value)}
            className="h-12"
            data-testid="input-fixed-price"
          />
        </div>
      )}
      {pricingType === "discount_amount" && (
        <div className="space-y-2">
          <Label htmlFor="discount-amount">Discount Amount ($)</Label>
          <Input
            id="discount-amount"
            type="number"
            step="0.01"
            value={discountAmount}
            onChange={(e) => setDiscountAmount(e.target.value)}
            className="h-12"
            data-testid="input-discount-amount"
          />
        </div>
      )}
      <div className="space-y-2">
        <Label>Products in Bundle</Label>
        <div className="border rounded-md p-2 max-h-48 overflow-y-auto">
          {masterProducts.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-2">No products available</p>
          ) : (
            masterProducts.map((product) => (
              <label 
                key={product.id} 
                className="flex items-center gap-2 p-2 hover-elevate rounded cursor-pointer min-h-12"
                data-testid={`label-bundle-product-${product.id}`}
              >
                <input
                  type="checkbox"
                  checked={selectedProducts.includes(product.id)}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setSelectedProducts([...selectedProducts, product.id]);
                    } else {
                      setSelectedProducts(selectedProducts.filter((id) => id !== product.id));
                    }
                  }}
                  className="w-5 h-5"
                  data-testid={`checkbox-bundle-product-${product.id}`}
                />
                <span className="text-sm">{product.title}</span>
                <span className="text-xs text-muted-foreground ml-auto">{product.sku}</span>
              </label>
            ))
          )}
        </div>
      </div>
      <DialogFooter>
        <Button type="submit" disabled={isPending || !name || selectedProducts.length < 2} className="h-12" data-testid="button-submit-bundle">
          {isPending ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <Plus className="w-5 h-5 mr-2" />}
          Create Bundle
        </Button>
      </DialogFooter>
    </form>
  );
}

interface BulkPublishJob {
  jobId: string;
  status: "pending" | "running" | "completed" | "failed";
  totalItems: number;
  completedItems: number;
  successCount: number;
  failureCount: number;
  results: {
    productId: string;
    productTitle: string;
    channelType: string;
    success: boolean;
    listingId?: string;
    error?: string;
  }[];
  startedAt: string;
  completedAt?: string;
}

function BulkPublishDialog({
  products,
  channelConfigs,
}: {
  products: MasterProduct[];
  channelConfigs: ChannelConfig[];
}) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [selectedProducts, setSelectedProducts] = useState<string[]>([]);
  const [selectedChannels, setSelectedChannels] = useState<string[]>([]);
  const [activeJob, setActiveJob] = useState<BulkPublishJob | null>(null);
  const [polling, setPolling] = useState(false);

  const { getAuthHeaders } = useAdminAuth();

  const startBulkPublishMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/admin/orchestration/bulk-publish", {
        productIds: selectedProducts,
        channelTypes: selectedChannels,
      });
      return res.json() as Promise<{ jobId: string }>;
    },
    onSuccess: async (data: { jobId: string }) => {
      toast({ title: "Bulk publish started" });
      setPolling(true);
      pollJob(data.jobId);
    },
    onError: (error: Error) => {
      toast({ title: "Failed to start bulk publish", description: error.message, variant: "destructive" });
    },
  });

  const pollJob = async (jobId: string) => {
    try {
      const res = await authFetch(`/api/admin/orchestration/bulk-publish/${jobId}`, getAuthHeaders);
      const job: BulkPublishJob = await res.json();
      setActiveJob(job);
      
      if (job.status === "pending" || job.status === "running") {
        setTimeout(() => pollJob(jobId), 1000);
      } else {
        setPolling(false);
        queryClient.invalidateQueries({ queryKey: ["/api/admin/orchestration/master-products"] });
      }
    } catch (err) {
      console.error("Failed to poll job:", err);
      setPolling(false);
    }
  };

  const enabledChannels = channelConfigs.filter(c => c.isEnabled);
  const activeProducts = products.filter(p => p.status === "active");

  const toggleAllProducts = () => {
    if (selectedProducts.length === activeProducts.length) {
      setSelectedProducts([]);
    } else {
      setSelectedProducts(activeProducts.map(p => p.id));
    }
  };

  const toggleAllChannels = () => {
    if (selectedChannels.length === enabledChannels.length) {
      setSelectedChannels([]);
    } else {
      setSelectedChannels(enabledChannels.map(c => c.channelType));
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="h-12" data-testid="button-bulk-publish">
          <Upload className="w-5 h-5 mr-2" />
          Bulk Publish
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Bulk Publish Products</DialogTitle>
          <DialogDescription>
            Publish multiple products to multiple channels at once.
          </DialogDescription>
        </DialogHeader>
        
        {activeJob ? (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Badge variant={
                activeJob.status === "completed" ? "default" :
                activeJob.status === "failed" ? "destructive" :
                "secondary"
              }>
                {activeJob.status}
              </Badge>
              <span className="text-sm text-muted-foreground">
                {activeJob.completedItems} / {activeJob.totalItems} items
              </span>
            </div>
            
            {polling && (
              <div className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-sm">Publishing in progress...</span>
              </div>
            )}
            
            <Progress value={(activeJob.completedItems / activeJob.totalItems) * 100} />
            
            <div className="flex gap-4 text-sm">
              <span className="text-green-600">Success: {activeJob.successCount}</span>
              <span className="text-red-600">Failed: {activeJob.failureCount}</span>
            </div>
            
            {activeJob.results.length > 0 && (
              <div className="border rounded-md max-h-60 overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted sticky top-0">
                    <tr>
                      <th className="text-left p-2">Product</th>
                      <th className="text-left p-2">Channel</th>
                      <th className="text-left p-2">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activeJob.results.map((r, i) => (
                      <tr key={i} className="border-t">
                        <td className="p-2 truncate max-w-[150px]">{r.productTitle}</td>
                        <td className="p-2">{r.channelType}</td>
                        <td className="p-2">
                          {r.success ? (
                            <Badge variant="default">Published</Badge>
                          ) : (
                            <Badge variant="destructive" title={r.error}>Failed</Badge>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            
            {!polling && (
              <DialogFooter>
                <Button 
                  onClick={() => { setActiveJob(null); setSelectedProducts([]); setSelectedChannels([]); }}
                  className="h-12"
                  data-testid="button-bulk-publish-done"
                >
                  Done
                </Button>
              </DialogFooter>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between gap-2 mb-2">
                <Label>Select Products</Label>
                <Button 
                  variant="ghost" 
                  onClick={toggleAllProducts}
                  className="h-12"
                  data-testid="button-toggle-all-products"
                >
                  {selectedProducts.length === activeProducts.length ? "Deselect All" : "Select All"}
                </Button>
              </div>
              <div className="border rounded-md p-2 max-h-40 overflow-y-auto">
                {activeProducts.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-2">
                    No active products available
                  </p>
                ) : (
                  activeProducts.map((product) => (
                    <label 
                      key={product.id} 
                      className="flex items-center gap-2 p-2 hover-elevate rounded cursor-pointer min-h-12"
                      data-testid={`label-bulk-product-${product.id}`}
                    >
                      <input
                        type="checkbox"
                        checked={selectedProducts.includes(product.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedProducts([...selectedProducts, product.id]);
                          } else {
                            setSelectedProducts(selectedProducts.filter((id) => id !== product.id));
                          }
                        }}
                        className="w-5 h-5"
                        data-testid={`checkbox-bulk-product-${product.id}`}
                      />
                      <span className="text-sm flex-1 truncate">{product.title}</span>
                      <code className="text-xs text-muted-foreground">{product.sku}</code>
                    </label>
                  ))
                )}
              </div>
            </div>
            
            <div>
              <div className="flex items-center justify-between gap-2 mb-2">
                <Label>Select Channels</Label>
                <Button 
                  variant="ghost" 
                  onClick={toggleAllChannels}
                  className="h-12"
                  data-testid="button-toggle-all-channels"
                >
                  {selectedChannels.length === enabledChannels.length ? "Deselect All" : "Select All"}
                </Button>
              </div>
              <div className="border rounded-md p-2 max-h-40 overflow-y-auto">
                {enabledChannels.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-2">
                    No channels enabled
                  </p>
                ) : (
                  enabledChannels.map((config) => (
                    <label 
                      key={config.channelType} 
                      className="flex items-center gap-2 p-2 hover-elevate rounded cursor-pointer min-h-12"
                      data-testid={`label-bulk-channel-${config.channelType}`}
                    >
                      <input
                        type="checkbox"
                        checked={selectedChannels.includes(config.channelType)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedChannels([...selectedChannels, config.channelType]);
                          } else {
                            setSelectedChannels(selectedChannels.filter((t) => t !== config.channelType));
                          }
                        }}
                        className="w-5 h-5"
                        data-testid={`checkbox-bulk-channel-${config.channelType}`}
                      />
                      <span className="text-sm">{config.displayName}</span>
                    </label>
                  ))
                )}
              </div>
            </div>
            
            <div className="text-sm text-muted-foreground">
              Will publish {selectedProducts.length} products to {selectedChannels.length} channels
              ({selectedProducts.length * selectedChannels.length} total operations)
            </div>
            
            <DialogFooter>
              <Button 
                onClick={() => startBulkPublishMutation.mutate()}
                disabled={startBulkPublishMutation.isPending || selectedProducts.length === 0 || selectedChannels.length === 0}
                className="h-12"
                data-testid="button-start-bulk-publish"
              >
                {startBulkPublishMutation.isPending ? (
                  <Loader2 className="w-5 h-5 animate-spin mr-2" />
                ) : (
                  <Upload className="w-5 h-5 mr-2" />
                )}
                Start Publishing
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
