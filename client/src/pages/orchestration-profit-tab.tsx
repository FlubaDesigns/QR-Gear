import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useQuery } from "@tanstack/react-query";
import {
  Loader2,
  RefreshCw,
  Route,
  DollarSign,
  Activity,
  CheckCircle,
  XCircle,
} from "lucide-react";
import type { ProfitDashboard } from "./orchestration-types";

export function ProfitTabContent() {
  const { data: profitDashboard, isLoading: profitLoading, refetch: refetchProfit } = useQuery<ProfitDashboard>({
    queryKey: ["/api/admin/orchestration/profit/dashboard"],
  });

  return (
    <>
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
    </>
  );
}
