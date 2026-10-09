import AdminShell from "@/components/AdminShell";
import AdminSectionSubNav from "@/components/admin/AdminSectionSubNav";
import { SELL_SUBNAV } from "@/components/admin/adminNavConfig";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useQuery } from "@tanstack/react-query";
import { Package, RefreshCw, Globe, Activity, Route, DollarSign, Layers, TrendingUp, BarChart } from "lucide-react";
import { BundlesTab } from "./orchestration-bundles-tab";
import { RoutingTabContent } from "./orchestration-routing-tab";
import { ProfitTabContent } from "./orchestration-profit-tab";
import { RepricingTabContent } from "./orchestration-repricing-tab";
import { AnalyticsTabContent } from "./orchestration-analytics-tab";
import { HealthTabContent } from "./orchestration-health-tab";

export default function AdminOrchestration() {
  const { data, isLoading: productsLoading, error: productsError, refetch: refetchProducts } = useQuery<{products: Array<{id:string;title:string;qrgCode:string|null;status:string;price:number|null;sourceSessionId:string|null;issues:string[]}>}>({
    queryKey: ["/api/admin/orchestration/catalog"],
  });
  const products = data?.products;
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
            <div className="flex gap-3 items-center flex-wrap">
              <h2 className="text-lg font-semibold">Saved Products{products ? ` (${products.length})` : ""}</h2>
              <Button asChild className="min-h-12"><a href="/admin/store-builder">Manage Products</a></Button>
              <Button asChild variant="outline" className="min-h-12"><a href="/admin/marketplaces">Marketplace Publishing</a></Button>
              <Button asChild variant="outline" className="min-h-12"><a href="/admin/library">Graphics, BLD &amp; Assembly Registry</a></Button>
            </div>
            {productsError ? <p role="alert">Products could not be loaded: {productsError.message}</p> : productsLoading ? <p>Loading saved products…</p> : products?.length === 0 ? <p>No saved products.</p> : products?.map(product => <Card key={product.id} data-testid={`card-product-${product.id}`}>
              <CardContent className="p-4 space-y-2">
                <h3 className="font-semibold">{product.title}</h3>
                <p>{product.qrgCode || "QRG identity unavailable"} · {product.status} · {product.price === null ? "Price unavailable" : `$${product.price.toFixed(2)}`}</p>
                {product.issues.map(issue => <p key={issue} role="alert" className="text-destructive">{issue}</p>)}
                {product.sourceSessionId && <Button asChild variant="outline" className="min-h-12"><a href={`/admin/products?resume=${encodeURIComponent(product.sourceSessionId)}`}>Open Saved Build</a></Button>}
              </CardContent>
            </Card>)}
          </TabsContent>

          <TabsContent value="bundles" className="space-y-4">
            <BundlesTab />
          </TabsContent>

          <TabsContent value="channels" className="space-y-4">
            <h2 className="text-lg font-semibold">Sales Channels</h2>
            <p>Manage the saved store destinations and connected seller accounts used by publishing.</p>
            <div className="flex gap-3 flex-wrap">
              <Button asChild className="min-h-12"><a href="/admin/store-builder">Store Channels</a></Button>
              <Button asChild variant="outline" className="min-h-12"><a href="/admin/marketplaces">Marketplace Accounts &amp; Listings</a></Button>
            </div>
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
