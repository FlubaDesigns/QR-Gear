import { useEffect } from "react";
import { Package, CheckCircle } from "lucide-react";
import { CollapsibleModule } from "@/features/shared/components/CollapsibleModule";
import { Badge } from "@/components/ui/badge";
import { useBuilderContext } from "../BuilderContext";

export function FulfillmentModule() {
  const { state, setSourceType, setFulfillmentProvider } = useBuilderContext();

  useEffect(() => {
    if (!state.sourceType) {
      setSourceType("custom");
    }
  }, [state.sourceType, setSourceType]);

  useEffect(() => {
    if (state.sourceType === "custom" && !state.fulfillmentProvider) {
      setFulfillmentProvider("printify");
    }
  }, [state.sourceType, state.fulfillmentProvider, setFulfillmentProvider]);

  if (state.sourceType !== "custom") {
    return null;
  }

  return (
    <CollapsibleModule
      title="Fulfillment Center"
      icon={<Package className="h-4 w-4" />}
      className="bg-muted/30"
      defaultOpen
    >
      <div className="flex items-center gap-2 p-3 bg-primary/5 rounded-md border">
        <CheckCircle className="h-4 w-4 text-primary" />
        <span className="font-medium">Printify</span>
        <Badge variant="secondary" className="ml-auto">Active</Badge>
      </div>
    </CollapsibleModule>
  );
}
