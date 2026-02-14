import { QrCode, Type, ExternalLink, Sparkles, Package } from "lucide-react";
import { CollapsibleModule } from "@/features/shared/components/CollapsibleModule";
import { Card } from "@/components/ui/card";
import { useBuilderContext } from "../BuilderContext";
import { QR_PRODUCT_STATES } from "../types";
import { ProductsModule } from "./ProductsModule";
import type { QRProductState } from "../types";

const STATE_ICONS: Record<string, typeof QrCode> = {
  qr_basics: QrCode,
  qr_plus: Type,
  qr_canvas: ExternalLink,
  qr_play: Sparkles,
  qr_compose: Sparkles,
};

export function StateModule() {
  const { state, setQRProductState } = useBuilderContext();

  return (
    <CollapsibleModule
      title="Product Configuration"
      icon={<Package className="h-4 w-4" />}
      className="bg-muted/30"
      defaultOpen
    >
      <div className="space-y-6">
        {/* Product Category & Selection - always show */}
        <ProductsModule />

        {/* QR Product Type - only show after product selected */}
        {state.selectedProduct && (
          <div className="space-y-3 pt-4 border-t">
            <div className="flex items-center gap-2">
              <QrCode className="h-4 w-4 text-muted-foreground" />
              <p className="text-sm font-medium">QR Product Type</p>
            </div>
            <p className="text-sm text-muted-foreground">
              Choose how your QR code will work and look.
            </p>
            
            <div className="grid grid-cols-1 gap-3">
              {QR_PRODUCT_STATES.map((qrState) => {
                const Icon = STATE_ICONS[qrState.id] || QrCode;
                const isSelected = state.qrProductState === qrState.id;
                
                return (
                  <Card
                    key={qrState.id}
                    className={`p-4 cursor-pointer hover-elevate transition-all ${
                      isSelected ? "ring-2 ring-primary bg-primary/5" : ""
                    }`}
                    onClick={() => setQRProductState(qrState.id as QRProductState)}
                    data-testid={`state-${qrState.id}`}
                  >
                    <div className="flex items-center gap-4">
                      <div className={`p-3 rounded-lg ${isSelected ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
                        <Icon className="h-6 w-6" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-base">{qrState.label}</p>
                        <p className="text-sm text-muted-foreground mt-0.5">{qrState.description}</p>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>

            {state.qrProductState && (
              <div className="p-3 bg-primary/5 rounded-md border">
                <p className="text-sm">
                  <span className="font-medium">Selected: </span>
                  {QR_PRODUCT_STATES.find(s => s.id === state.qrProductState)?.label}
                </p>
              </div>
            )}

            {state.qrProductState === "qr_compose" && (
              <p className="text-sm text-muted-foreground mt-2" data-testid="text-compose-hint">
                Compose flow will appear below after product selection.
              </p>
            )}
          </div>
        )}
      </div>
    </CollapsibleModule>
  );
}
