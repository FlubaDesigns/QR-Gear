import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useQuery } from "@tanstack/react-query";
import {
  Loader2,
  Smartphone,
  Tablet,
  Monitor,
} from "lucide-react";
import type { QrAnalyticsSummary, ProductScanAnalytics, ScanTrend } from "./orchestration-types";

function getDeviceIcon(deviceType: string) {
  switch (deviceType?.toLowerCase()) {
    case "mobile":
      return <Smartphone className="w-4 h-4" />;
    case "tablet":
      return <Tablet className="w-4 h-4" />;
    default:
      return <Monitor className="w-4 h-4" />;
  }
}

export function AnalyticsTabContent() {
  const { data: qrAnalyticsSummary, isLoading: qrAnalyticsLoading } = useQuery<QrAnalyticsSummary>({
    queryKey: ["/api/admin/orchestration/qr-analytics/summary"],
  });

  const { data: productScans = [], isLoading: productScansLoading } = useQuery<ProductScanAnalytics[]>({
    queryKey: ["/api/admin/orchestration/qr-analytics/products"],
  });

  const { data: scanTrends = [], isLoading: scanTrendsLoading } = useQuery<ScanTrend[]>({
    queryKey: ["/api/admin/orchestration/qr-analytics/trends"],
  });

  return (
    <>
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
    </>
  );
}
