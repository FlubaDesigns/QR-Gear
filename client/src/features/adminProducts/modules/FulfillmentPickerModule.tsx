import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Store } from "lucide-react";
import type { FulfillmentProvider } from "../shared/types";

interface FulfillmentPickerModuleProps {
  providers: FulfillmentProvider[];
  selectedProviders: string[];
  onSelectionChange: (providers: string[]) => void;
  productCount?: { filtered: number; total: number };
}

export function FulfillmentPickerModule({
  providers,
  selectedProviders,
  onSelectionChange,
  productCount,
}: FulfillmentPickerModuleProps) {
  const fulfillmentProviders = providers.filter((p) => p.role === "fulfillment");

  const handleToggle = (providerId: string, checked: boolean) => {
    if (checked) {
      onSelectionChange([...selectedProviders, providerId]);
    } else {
      onSelectionChange(selectedProviders.filter((p) => p !== providerId));
    }
  };

  return (
    <Card className="bg-muted/30">
      <CardHeader className="py-3 px-4 space-y-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Store className="h-4 w-4" />
          Active Fulfillment Centers
        </CardTitle>
        <div className="flex flex-wrap items-center gap-4">
          {fulfillmentProviders.map((provider) => (
            <div key={provider.id} className="flex items-center gap-2">
              <Switch
                id={`provider-${provider.id}`}
                checked={selectedProviders.includes(provider.id)}
                onCheckedChange={(checked) => handleToggle(provider.id, checked)}
                data-testid={`switch-provider-${provider.id}`}
              />
              <Label
                htmlFor={`provider-${provider.id}`}
                className={`text-sm cursor-pointer ${
                  selectedProviders.includes(provider.id)
                    ? "font-medium"
                    : "text-muted-foreground"
                }`}
              >
                {provider.name}
              </Label>
              {provider.configured ? (
                <Badge
                  variant="outline"
                  className="text-[10px] px-1.5 py-0 bg-green-500/10 text-green-700 border-green-300"
                >
                  Active
                </Badge>
              ) : (
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0 opacity-50">
                  Not configured
                </Badge>
              )}
            </div>
          ))}
          {productCount && (
            <span className="text-xs text-muted-foreground ml-auto">
              Showing {productCount.filtered} of {productCount.total} products
            </span>
          )}
        </div>
      </CardHeader>
    </Card>
  );
}

export default FulfillmentPickerModule;
