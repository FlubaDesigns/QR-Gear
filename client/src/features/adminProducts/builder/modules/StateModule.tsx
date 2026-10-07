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
  const { state, setQRProductState, qrTypePreferenceSaving, qrTypePreferenceError, retryQRTypePreference } = useBuilderContext();
  const isMobile = useIsMobile();

  const badge = state.selectedProduct ? (
    <Badge variant="secondary" className="text-xs max-w-[140px] truncate">
      {state.selectedProduct.title}
    </Badge>
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

            <fieldset aria-label="QR Product Type" className="grid grid-cols-1 gap-2">
              {QR_PRODUCT_STATES.map((qrState) => {
                const Icon = STATE_ICONS[qrState.id] || QrCode;
                const isSelected = state.qrProductState === qrState.id;

                return (
                  <Card
                    key={qrState.id}
                    className={`cursor-pointer hover-elevate transition-all ${
                      isSelected ? "ring-2 ring-primary bg-primary/5" : ""
                    }`}
                    data-testid={`state-${qrState.id}`}
                  >
                    <label className="flex min-h-16 cursor-pointer items-center gap-3 p-3">
                      <div className={`p-2 rounded-md flex-shrink-0 ${isSelected ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
                        <Icon className="h-5 w-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm">{qrState.label}</p>
                        <p className="text-xs text-muted-foreground mt-0.5 leading-snug">{qrState.description}</p>
                      </div>
                      <input
                        type="radio"
                        name="qr-product-type"
                        value={qrState.id}
                        checked={isSelected}
                        onChange={() => setQRProductState(qrState.id as QRProductState)}
                        aria-label={qrState.label}
                        className="ml-auto h-6 w-6 flex-shrink-0 cursor-pointer accent-primary"
                        data-testid={`radio-${qrState.id}`}
                      />
                    </label>
                  </Card>
                );
              })}
            </fieldset>
            {qrTypePreferenceSaving && <p role="status" className="text-sm text-muted-foreground">Saving…</p>}
            {qrTypePreferenceError && (
              <div role="alert" className="flex items-center gap-2 text-sm text-destructive">
                <span>{qrTypePreferenceError}</span>
                <button type="button" className="min-h-12 px-3 underline" onClick={retryQRTypePreference}>Retry</button>
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
