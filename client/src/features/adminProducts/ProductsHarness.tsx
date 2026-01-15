import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ProductsProvider } from "./ProductsContext";
import { SyncModule } from "./modules/SyncModule";

interface ProductsHarnessProps {
  showHeader?: boolean;
}

export function ProductsHarness({ showHeader = true }: ProductsHarnessProps) {
  const [tab, setTab] = useState<string>("catalog");

  return (
    <ProductsProvider>
      <div className="space-y-6">
        {showHeader && (
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">Products</h1>
              <p className="text-muted-foreground">
                Manage products, sync catalog, and configure pricing.
              </p>
            </div>
          </div>
        )}

        <Tabs value={tab} onValueChange={setTab} className="w-full">
          <TabsList className="h-auto flex flex-wrap gap-2 p-2 bg-muted/50">
            <TabsTrigger value="catalog" className="flex-1 min-w-[120px]">
              Catalog
            </TabsTrigger>
            <TabsTrigger value="sync" className="flex-1 min-w-[120px]">
              Sync
            </TabsTrigger>
          </TabsList>

          <TabsContent value="catalog" className="mt-6">
            <div className="text-center py-12 text-muted-foreground">
              Catalog module coming soon...
            </div>
          </TabsContent>

          <TabsContent value="sync" className="mt-6">
            <SyncModule />
          </TabsContent>
        </Tabs>
      </div>
    </ProductsProvider>
  );
}

export default ProductsHarness;
