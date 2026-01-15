import { QrCode, Type, ExternalLink, Sparkles } from "lucide-react";
import { CollapsibleModule } from "@/features/shared/components/CollapsibleModule";
import { Card } from "@/components/ui/card";
import { useBuilderContext } from "../BuilderContext";
import { QR_PRODUCT_STATES } from "../types";
import type { QRProductState } from "../types";

const STATE_ICONS: Record<string, typeof QrCode> = {
  plain_qr: QrCode,
  qr_header_footer: Type,
  qr_url: ExternalLink,
  qr_url_decorated: Sparkles,
  dynamic: Sparkles,
};

export function StateModule() {
  const { state, setQRProductState } = useBuilderContext();

  if (state.sourceType !== "custom" || !state.selectedProduct) {
    return null;
  }

  return (
    <CollapsibleModule
      title="QR Product Type"
      icon={<QrCode className="h-4 w-4" />}
      className="bg-muted/30"
      defaultOpen
    >
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">
          Choose how your QR code will work and look.
        </p>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {QR_PRODUCT_STATES.map((qrState) => {
            const Icon = STATE_ICONS[qrState.id] || QrCode;
            const isSelected = state.qrProductState === qrState.id;
            
            return (
              <Card
                key={qrState.id}
                className={`p-3 cursor-pointer hover-elevate transition-all ${
                  isSelected ? "ring-2 ring-primary bg-primary/5" : ""
                }`}
                onClick={() => setQRProductState(qrState.id as QRProductState)}
                data-testid={`state-${qrState.id}`}
              >
                <div className="flex items-start gap-3">
                  <div className={`p-2 rounded-md ${isSelected ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm">{qrState.label}</p>
                    <p className="text-xs text-muted-foreground">{qrState.description}</p>
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
      </div>
    </CollapsibleModule>
  );
}
