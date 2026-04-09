import { QrCode, Type, ExternalLink, Sparkles, Package } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { CollapsibleModule } from "@/features/shared/components/CollapsibleModule";
import { Card } from "@/components/ui/card";
import { useBuilderContext } from "../BuilderContext";
import { QR_PRODUCT_STATES } from "../types";
import { ProductsModule } from "./ProductsModule";
import { useIsMobile } from "@/hooks/use-mobile";
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
  const isMobile = useIsMobile();

  const selectedQrLabel = QR_PRODUCT_STATES.find(s => s.id === state.qrProductState)?.label;

  const badge = (state.selectedProduct || state.qrProductState) ? (
    <div className="flex items-center gap-1.5 flex-wrap">
      {state.selectedProduct && (
        <Badge variant="secondary" className="text-xs max-w-[140px] truncate">
          {state.selectedProduct.title}
        </Badge>
      )}
      {selectedQrLabel && (
        <Badge variant="outline" className="text-xs">
          {selectedQrLabel}
        </Badge>
      )}
    </div>
  ) : undefined;

  return (
    <CollapsibleModule
      title="Product Configuration"
      icon={<Package className="h-4 w-4" />}
      badge={badge}
      className="bg-muted/30"
      defaultOpen={!isMobile}
    >
      <div className="space-y-6">
        <ProductsModule />

        {state.selectedProduct && (
          <div className="space-y-3 pt-4 border-t">
            <div className="flex items-center gap-2">
              <QrCode className="h-4 w-4 text-muted-foreground" />
              <p className="text-sm font-medium">QR Product Type</p>
            </div>
            <p className="text-sm text-muted-foreground">
              Choose how your QR code will work and look.
            </p>

            <div className="grid grid-cols-1 gap-2">
              {QR_PRODUCT_STATES.map((qrState) => {
                const Icon = STATE_ICONS[qrState.id] || QrCode;
                const isSelected = state.qrProductState === qrState.id;

                return (
                  <Card
                    key={qrState.id}
                    className={`cursor-pointer hover-elevate transition-all ${
                      isSelected ? "ring-2 ring-primary bg-primary/5" : ""
                    }`}
                    onClick={() => setQRProductState(qrState.id as QRProductState)}
                    data-testid={`state-${qrState.id}`}
                  >
                    <div className="flex items-center gap-3 p-3">
                      <div className={`p-2 rounded-md flex-shrink-0 ${isSelected ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
                        <Icon className="h-5 w-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm">{qrState.label}</p>
                        {!isMobile && (
                          <p className="text-xs text-muted-foreground mt-0.5 leading-snug">{qrState.description}</p>
                        )}
                      </div>
                      {isSelected && (
                        <Badge variant="default" className="flex-shrink-0 text-xs">
                          Selected
                        </Badge>
                      )}
                    </div>
                  </Card>
                );
              })}
            </div>

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
