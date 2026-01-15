import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Package } from "lucide-react";
import { CollapsibleModule } from "@/features/shared/components/CollapsibleModule";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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

  const sortedProviders = [...activeProviders].sort((a, b) => {
    const aCount = providerCounts?.[a as keyof ProviderCounts] || 0;
    const bCount = providerCounts?.[b as keyof ProviderCounts] || 0;
    return bCount - aCount;
  });

  useEffect(() => {
    if (state.sourceType === "custom" && sortedProviders.length > 0 && !state.fulfillmentProvider && providerCounts) {
      const providerWithItems = sortedProviders.find(
        (p) => (providerCounts[p as keyof ProviderCounts] || 0) > 0
      );
      if (providerWithItems) {
        setFulfillmentProvider(providerWithItems);
      }
    }
  }, [state.sourceType, sortedProviders, state.fulfillmentProvider, setFulfillmentProvider, providerCounts]);

  if (state.sourceType !== "custom") {
    return null;
  }

  if (sortedProviders.length === 0) {
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

  return (
    <CollapsibleModule
      title="Fulfillment Center"
      icon={<Package className="h-4 w-4" />}
      className="bg-muted/30"
      defaultOpen
    >
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">
          Select a fulfillment center to browse their product catalog.
        </p>
        {isLoading ? (
          <Skeleton className="h-10 w-full max-w-xs" />
        ) : (
          <Select
            value={state.fulfillmentProvider || ""}
            onValueChange={(value) => setFulfillmentProvider(value || null)}
          >
            <SelectTrigger className="w-full max-w-xs" data-testid="select-fulfillment-provider">
              <SelectValue placeholder="Select fulfillment center..." />
            </SelectTrigger>
            <SelectContent position="popper">
              {sortedProviders.map((providerId) => {
                const count = providerCounts?.[providerId as keyof ProviderCounts] || 0;
                return (
                  <SelectItem 
                    key={providerId} 
                    value={providerId}
                    data-testid={`option-provider-${providerId}`}
                  >
                    {PROVIDER_LABELS[providerId] || providerId} ({count} items)
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
        )}
      </div>
    </CollapsibleModule>
  );
}
