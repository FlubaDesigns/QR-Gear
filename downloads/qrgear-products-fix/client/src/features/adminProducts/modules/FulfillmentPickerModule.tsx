import { useState } from "react";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Store, RefreshCw } from "lucide-react";
import { CollapsibleModule } from "@/features/shared/components/CollapsibleModule";
import { useToast } from "@/hooks/use-toast";
import type { FulfillmentProvider } from "../shared/types";

interface FulfillmentPickerModuleProps {
  providers: FulfillmentProvider[];
  selectedProviders: string[];
  onSelectionChange: (providers: string[]) => void;
  productCount?: { filtered: number; total: number };
  apiBase?: string;
}

export function FulfillmentPickerModule({
  providers,
  selectedProviders,
  onSelectionChange,
  productCount,
  apiBase = "/api/admin",
}: FulfillmentPickerModuleProps) {
  const { toast } = useToast();
  const [syncing, setSyncing] = useState<string | null>(null);
  const fulfillmentProviders = providers.filter((p) => p.role === "fulfillment");

  const handleSync = async (providerId: string) => {
    setSyncing(providerId);
    try {
      let endpoint = "";
      if (providerId === "printful") {
        endpoint = `${apiBase}/catalog/sync-printful`;
      } else if (providerId === "printify") {
        endpoint = `${apiBase}/printify/sync`;
      }
      
      if (!endpoint) {
        toast({ title: "Sync not available", description: `No sync endpoint for ${providerId}` });
        return;
      }

      const res = await fetch(endpoint, { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        toast({ 
          title: "Catalog Synced", 
          description: data.message || `${providerId} catalog synced successfully` 
        });
      } else {
        const err = await res.text();
        toast({ title: "Sync Failed", description: err, variant: "destructive" });
      }
    } catch (e: any) {
      toast({ title: "Sync Error", description: e.message, variant: "destructive" });
    } finally {
      setSyncing(null);
    }
  };

  const handleProviderChange = (providerId: string) => {
    onSelectionChange([providerId]);
  };

  const currentProvider = selectedProviders.length > 0 ? selectedProviders[0] : "printify";

  return (
    <CollapsibleModule
      title="Fulfillment"
      icon={<Store className="h-4 w-4" />}
      className="bg-muted/30"
    >
      <div className="flex flex-wrap items-center gap-4">
        <RadioGroup 
          value={currentProvider} 
          onValueChange={handleProviderChange}
          className="flex flex-wrap items-center gap-4"
        >
          {fulfillmentProviders.map((provider) => (
            <div key={provider.id} className="flex items-center gap-2">
              <RadioGroupItem
                id={`provider-${provider.id}`}
                value={provider.id}
                data-testid={`radio-provider-${provider.id}`}
              />
              <Label
                htmlFor={`provider-${provider.id}`}
                className={`text-sm cursor-pointer ${
                  currentProvider === provider.id
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
              {provider.configured && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => handleSync(provider.id)}
                  disabled={syncing === provider.id}
                  className="h-6 px-2 text-xs"
                  data-testid={`btn-sync-${provider.id}`}
                >
                  <RefreshCw className={`h-3 w-3 mr-1 ${syncing === provider.id ? "animate-spin" : ""}`} />
                  {syncing === provider.id ? "Syncing..." : "Sync"}
                </Button>
              )}
            </div>
          ))}
        </RadioGroup>
        {productCount && (
          <span className="text-xs text-muted-foreground ml-auto">
            Showing {productCount.filtered} of {productCount.total} products
          </span>
        )}
      </div>
    </CollapsibleModule>
  );
}

export default FulfillmentPickerModule;
