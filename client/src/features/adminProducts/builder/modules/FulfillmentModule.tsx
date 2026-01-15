import { useEffect } from "react";
import { Package } from "lucide-react";
import { CollapsibleModule } from "@/features/shared/components/CollapsibleModule";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useBuilderContext } from "../BuilderContext";

const PROVIDER_LABELS: Record<string, string> = {
  printify: "Printify",
  printful: "Printful",
  apliiq: "Apliiq",
};

const PROVIDER_ORDER = ["printify", "printful", "apliiq"];

export function FulfillmentModule() {
  const { state, activeProviders, setFulfillmentProvider } = useBuilderContext();

  const sortedProviders = [...activeProviders].sort((a, b) => {
    const aIndex = PROVIDER_ORDER.indexOf(a);
    const bIndex = PROVIDER_ORDER.indexOf(b);
    return (aIndex === -1 ? 999 : aIndex) - (bIndex === -1 ? 999 : bIndex);
  });

  useEffect(() => {
    if (state.sourceType === "custom" && sortedProviders.length > 0 && !state.fulfillmentProvider) {
      setFulfillmentProvider(sortedProviders[0]);
    }
  }, [state.sourceType, sortedProviders, state.fulfillmentProvider, setFulfillmentProvider]);

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
        <Select
          value={state.fulfillmentProvider || ""}
          onValueChange={(value) => setFulfillmentProvider(value || null)}
        >
          <SelectTrigger className="w-full max-w-xs" data-testid="select-fulfillment-provider">
            <SelectValue placeholder="Select fulfillment center..." />
          </SelectTrigger>
          <SelectContent position="popper">
            {sortedProviders.map((providerId) => (
              <SelectItem 
                key={providerId} 
                value={providerId}
                data-testid={`option-provider-${providerId}`}
              >
                {PROVIDER_LABELS[providerId] || providerId}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </CollapsibleModule>
  );
}
