import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Store, Layers, Package, Palette, Send } from "lucide-react";
import { StoreBuilderProvider, useStoreBuilderContext } from "./StoreBuilderContext";
import { StorePickerModule } from "./modules/StorePickerModule";
import { ChannelPickerModule } from "./modules/ChannelPickerModule";
import { CatalogBrowserModule } from "./modules/CatalogBrowserModule";
import { ProductConfigureModule } from "./modules/ProductConfigureModule";
import { AssignmentModule } from "./modules/AssignmentModule";

function StoreBuilderInner() {
  const { step, currentStore, currentChannel } = useStoreBuilderContext();

  const steps = [
    { id: "store", label: "Store", icon: Store },
    { id: "channel", label: "Channel", icon: Layers },
    { id: "catalog", label: "Catalog", icon: Package },
    { id: "configure", label: "Configure", icon: Palette },
    { id: "assign", label: "Assign", icon: Send },
  ];

  const currentStepIndex = steps.findIndex(s => s.id === step);

  return (
    <Card data-testid="card-store-builder">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2" data-testid="title-store-builder">
          <Store className="h-5 w-5" />
          Store Builder
        </CardTitle>
        <div className="flex items-center gap-2 mt-2 flex-wrap">
          {steps.map((s, i) => {
            const Icon = s.icon;
            const isActive = s.id === step;
            const isComplete = i < currentStepIndex;
            return (
              <Badge
                key={s.id}
                variant={isActive ? "default" : isComplete ? "secondary" : "outline"}
                className="flex items-center gap-1"
                data-testid={`badge-step-${s.id}`}
              >
                <Icon className="h-3 w-3" />
                {s.label}
              </Badge>
            );
          })}
        </div>
        {(currentStore || currentChannel) && (
          <div className="flex gap-2 mt-2 text-sm text-muted-foreground">
            {currentStore && <span>Store: {currentStore.name}</span>}
            {currentChannel && <span>| Channel: {currentChannel.name}</span>}
          </div>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        <StorePickerModule />
        <ChannelPickerModule />
        <CatalogBrowserModule />
        <ProductConfigureModule />
        <AssignmentModule />
      </CardContent>
    </Card>
  );
}

export function StoreBuilderHarness() {
  return (
    <StoreBuilderProvider>
      <StoreBuilderInner />
    </StoreBuilderProvider>
  );
}

export default StoreBuilderHarness;
