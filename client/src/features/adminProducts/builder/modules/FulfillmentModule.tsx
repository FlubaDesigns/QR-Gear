import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Package, CheckCircle } from "lucide-react";
import { CollapsibleModule } from "@/features/shared/components/CollapsibleModule";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useBuilderContext } from "../BuilderContext";

const PROVIDER_LABELS: Record<string, string> = {
  printify: "Printify",
  printful: "Printful",
  apliiq: "Apliiq",
};

interface ProviderCounts {
  printify: number;
  printful: number;
}

export function FulfillmentModule() {
  const { state, activeProviders, setFulfillmentProvider, api } = useBuilderContext();

  const { data: providerCounts, isLoading } = useQuery<ProviderCounts>({
    queryKey: ["provider-counts", api.baseUrl],
    queryFn: async () => {
      const headers = await api.getAuthHeaders();
      const res = await fetch(`${api.baseUrl}/admin/provider-counts`, { headers });
      if (!res.ok) return { printify: 0, printful: 0 };
      return res.json();
    },
  });

  useEffect(() => {
    if (state.sourceType === "custom" && activeProviders.length > 0 && !state.fulfillmentProvider && providerCounts) {
      const providerWithItems = activeProviders.find(
        (p) => (providerCounts[p as keyof ProviderCounts] || 0) > 0
      );
      if (providerWithItems) {
        setFulfillmentProvider(providerWithItems);
      }
    }
  }, [state.sourceType, activeProviders, state.fulfillmentProvider, setFulfillmentProvider, providerCounts]);

  if (state.sourceType !== "custom") {
    return null;
  }

  if (activeProviders.length === 0) {
    return (
      <CollapsibleModule
        title="Fulfillment Center"
        icon={<Package className="h-4 w-4" />}
        className="bg-muted/30"
        defaultOpen
      >
        <p className="text-sm text-muted-foreground">
          No fulfillment centers are active. Enable at least one provider above.
        </p>
      </CollapsibleModule>
    );
  }

  const selectedProvider = state.fulfillmentProvider;
  const itemCount = selectedProvider ? (providerCounts?.[selectedProvider as keyof ProviderCounts] || 0) : 0;

  return (
    <CollapsibleModule
      title="Fulfillment Center"
      icon={<Package className="h-4 w-4" />}
      className="bg-muted/30"
      defaultOpen
    >
      <div className="space-y-3">
        {isLoading ? (
          <Skeleton className="h-10 w-full max-w-xs" />
        ) : selectedProvider ? (
          <div className="flex items-center gap-2 p-3 bg-primary/5 rounded-md border">
            <CheckCircle className="h-4 w-4 text-primary" />
            <span className="font-medium">{PROVIDER_LABELS[selectedProvider] || selectedProvider}</span>
            <Badge variant="secondary" className="ml-auto">
              {itemCount} products
            </Badge>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            Searching for available fulfillment centers...
          </p>
        )}
      </div>
    </CollapsibleModule>
  );
}
