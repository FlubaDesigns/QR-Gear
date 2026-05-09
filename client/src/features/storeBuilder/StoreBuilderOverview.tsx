import { Package, Layers, RefreshCw } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useStoreBuilder } from "./StoreBuilderContext";

export function StoreBuilderOverview({ compact = false }: { compact?: boolean }) {
  const { productPackage, templatePickerOpen, setTemplatePickerOpen, handleTemplateSelect, handleRefreshPacket, fetchTemplates } = useStoreBuilder();

  if (!productPackage) {
    return (
      <Card className="p-4">
        <div className="text-center py-6">
          <Package className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
          <h3 className="text-base font-semibold mb-2">No Product Package Loaded</h3>
          <p className="text-muted-foreground mb-4 text-sm">
            Load from your library or create a new product.
          </p>
          <div className="flex flex-col gap-3">
            <button
              onClick={() => setTemplatePickerOpen(true)}
              className="qr-btn qr-btn--primary qr-btn--xl qr-btn--full"
              data-testid="button-load-templates"
            >
              <Layers className="h-5 w-5" />
              Load Template
            </button>
          </div>
        </div>
      </Card>
    );
  }

  if (compact) {
    return (
      <div className="flex items-center gap-2">
        {productPackage.packetId && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefreshPacket}
            data-testid="button-refresh-packet"
          >
            <RefreshCw className="h-4 w-4 mr-1" />
            Refresh
          </Button>
        )}
        <Button
          size="sm"
          onClick={() => setTemplatePickerOpen(true)}
          data-testid="button-load-templates"
        >
          <Layers className="h-4 w-4 mr-1" />
          Load Template
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {productPackage.packetId && (
        <button
          onClick={handleRefreshPacket}
          className="qr-btn qr-btn--outline qr-btn--touch qr-btn--full"
          data-testid="button-refresh-packet"
        >
          <RefreshCw className="h-5 w-5" />
          Refresh Packet
        </button>
      )}
      <button
        onClick={() => setTemplatePickerOpen(true)}
        className="qr-btn qr-btn--primary qr-btn--touch qr-btn--full"
        data-testid="button-load-templates"
      >
        <Layers className="h-5 w-5" />
        Load Template
      </button>
    </div>
  );
}
