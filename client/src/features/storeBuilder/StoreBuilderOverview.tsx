import { Package, Layers, RefreshCw } from "lucide-react";
import { Card } from "@/components/ui/card";
import { TemplatePickerSkin } from "@/features/shared/components/skins";
import type { ProductPackage } from "./store-builder-types";

interface TemplateItem {
  id: string;
  name: string;
  primaryImage?: string | null;
  secondaryImage?: string | null;
  productName?: string | null;
  packetId?: string | null;
  qrMode?: string | null;
  colorCount?: number;
  sizeCount?: number;
}

interface StoreBuilderOverviewProps {
  productPackage: ProductPackage | null;
  templatePickerOpen: boolean;
  onTemplatePickerOpen: () => void;
  onTemplatePickerClose: () => void;
  onTemplateSelect: (packetId: string) => void;
  fetchTemplates: () => Promise<TemplateItem[]>;
  onRefreshPacket: () => void;
  onNavigateProducts: () => void;
}

export function StoreBuilderOverview({
  productPackage,
  templatePickerOpen,
  onTemplatePickerOpen,
  onTemplatePickerClose,
  onTemplateSelect,
  fetchTemplates,
  onRefreshPacket,
  onNavigateProducts,
}: StoreBuilderOverviewProps) {
  if (!productPackage) {
    return (
      <>
        <Card className="p-4">
          <div className="text-center py-6">
            <Package className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
            <h3 className="text-base font-semibold mb-2">No Product Package Loaded</h3>
            <p className="text-muted-foreground mb-4 text-sm">
              Load from your library or create a new product.
            </p>
            <div className="flex flex-col gap-3">
              <button
                onClick={onTemplatePickerOpen}
                className="qr-btn qr-btn--primary qr-btn--xl qr-btn--full"
                data-testid="button-load-templates"
              >
                <Layers className="h-5 w-5" />
                Load Template
              </button>
              <button
                onClick={onNavigateProducts}
                className="qr-btn qr-btn--outline qr-btn--xl qr-btn--full"
                data-testid="button-go-products"
              >
                <Package className="h-5 w-5" />
                Create New in Products
              </button>
            </div>
          </div>
        </Card>
        <TemplatePickerSkin
          isOpen={templatePickerOpen}
          onClose={onTemplatePickerClose}
          onSelect={onTemplateSelect}
          fetchTemplates={fetchTemplates}
        />
      </>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {productPackage.packetId && (
        <button
          onClick={onRefreshPacket}
          className="qr-btn qr-btn--outline qr-btn--touch qr-btn--full"
          data-testid="button-refresh-packet"
        >
          <RefreshCw className="h-5 w-5" />
          Refresh Packet
        </button>
      )}
      <button
        onClick={onTemplatePickerOpen}
        className="qr-btn qr-btn--primary qr-btn--touch qr-btn--full"
        data-testid="button-load-templates"
      >
        <Layers className="h-5 w-5" />
        Load Template
      </button>
    </div>
  );
}
