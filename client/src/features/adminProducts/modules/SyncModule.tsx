import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Loader2, RefreshCw, Package } from "lucide-react";
import { useProductsContext } from "../ProductsContext";
import type { Product } from "../shared/types";

export function SyncModule() {
  const { api } = useProductsContext();
  const { toast } = useToast();
  const [lastSyncResult, setLastSyncResult] = useState<{ synced: number } | null>(null);

  const { data: products = [], isLoading } = useQuery<Product[]>({
    queryKey: api.getQueryKey("all"),
    queryFn: api.fetchProducts,
  });

  const syncMutation = useMutation({
    mutationFn: api.syncCatalog,
    onSuccess: (result) => {
      setLastSyncResult(result);
      toast({ title: "Sync complete", description: `Synced ${result.synced} products` });
      api.invalidateProducts();
    },
    onError: (error: Error) => {
      toast({ title: "Sync failed", description: error.message, variant: "destructive" });
    },
  });

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <RefreshCw className="h-5 w-5" />
            Printify Catalog Sync
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Sync products from Printify catalog. This will update local product data
            with the latest from Printify including prices, variants, and availability.
          </p>
          
          <div className="flex items-center gap-4">
            <Button
              onClick={() => syncMutation.mutate()}
              disabled={syncMutation.isPending}
              data-testid="button-sync-catalog"
            >
              {syncMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Sync Catalog
            </Button>
            
            {lastSyncResult && (
              <span className="text-sm text-muted-foreground">
                Last sync: {lastSyncResult.synced} products
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Current Products ({products.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : products.length === 0 ? (
            <p className="text-center py-8 text-muted-foreground">
              No products found. Run a sync to import from Printify.
            </p>
          ) : (
            <div className="space-y-2 max-h-[400px] overflow-y-auto">
              {products.slice(0, 20).map((product) => (
                <div
                  key={product.id}
                  className="flex items-center justify-between p-3 rounded-md bg-muted/50"
                  data-testid={`product-row-${product.id}`}
                >
                  <div>
                    <p className="font-medium text-sm">{product.name}</p>
                    {product.blueprintId && (
                      <p className="text-xs text-muted-foreground">
                        Blueprint: {product.blueprintId}
                      </p>
                    )}
                  </div>
                  {product.customerPrice && (
                    <span className="text-sm font-medium">
                      ${parseFloat(product.customerPrice).toFixed(2)}
                    </span>
                  )}
                </div>
              ))}
              {products.length > 20 && (
                <p className="text-center text-sm text-muted-foreground py-2">
                  ...and {products.length - 20} more products
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default SyncModule;
