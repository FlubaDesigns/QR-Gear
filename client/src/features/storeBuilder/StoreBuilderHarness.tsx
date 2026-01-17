import { useState, useEffect } from "react";
import { Store, Building2, Globe, ChevronRight, Loader2, Package, QrCode, Link as LinkIcon } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useAdminAuth } from "@/features/shared/AdminAuthContext";
import { CollapsibleModule } from "@/features/shared/components/CollapsibleModule";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CustomDropdown } from "@/components/ui/custom-dropdown";
import type { PartnerStore } from "@shared/schema";

interface ProductPackage {
  templateId?: string;
  graphicsId?: string;
  qrContent?: string;
  productName?: string;
  compositeUrl?: string;
  qrOnlyUrl?: string;
}

type StoreType = "internal" | "external" | null;

function PackagePreviewModule({ productPackage }: { productPackage: ProductPackage | null }) {
  if (!productPackage) {
    return (
      <CollapsibleModule
        title="Product Package"
        icon={<Package className="h-4 w-4" />}
        className="bg-muted/30"
        defaultOpen
      >
        <div className="p-4 text-center glass-button rounded-lg">
          <p className="glass-body" data-testid="text-no-package">
            No product package loaded. Save a product from the Products Builder first.
          </p>
        </div>
      </CollapsibleModule>
    );
  }

  return (
    <CollapsibleModule
      title="Product Package"
      icon={<Package className="h-4 w-4" />}
      className="bg-muted/30"
      defaultOpen
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          {productPackage.compositeUrl && (
            <div className="space-y-2">
              <p className="text-sm font-medium">Composite</p>
              <img
                src={productPackage.compositeUrl}
                alt="Composite"
                className="w-full h-32 object-contain rounded-lg border"
                data-testid="img-composite"
              />
            </div>
          )}
          {productPackage.qrOnlyUrl && (
            <div className="space-y-2">
              <p className="text-sm font-medium">QR Only</p>
              <img
                src={productPackage.qrOnlyUrl}
                alt="QR Only"
                className="w-full h-32 object-contain rounded-lg border"
                data-testid="img-qr-only"
              />
            </div>
          )}
        </div>

        {productPackage.qrContent && (
          <div className="p-3 bg-primary/5 rounded-lg flex items-center gap-2">
            <LinkIcon className="h-4 w-4 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-xs text-muted-foreground">QR Content</p>
              <p className="text-sm font-mono truncate" data-testid="text-qr-content">
                {productPackage.qrContent}
              </p>
            </div>
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          {productPackage.templateId && (
            <Badge variant="outline" data-testid="badge-template">
              Template: {productPackage.templateId.slice(0, 8)}...
            </Badge>
          )}
          {productPackage.graphicsId && (
            <Badge variant="outline" data-testid="badge-graphics">
              Graphics: {productPackage.graphicsId.slice(0, 8)}...
            </Badge>
          )}
        </div>
      </div>
    </CollapsibleModule>
  );
}

function StoreAssignmentModule({ 
  onStoreSelect,
  isSaving,
  productPackage,
}: { 
  onStoreSelect: (store: PartnerStore, channel: string) => void;
  isSaving: boolean;
  productPackage: ProductPackage | null;
}) {
  const { apiBase } = useAdminAuth();
  
  const [selectedType, setSelectedType] = useState<StoreType>(null);
  const [selectedStoreId, setSelectedStoreId] = useState<string | null>(null);
  const [selectedChannel, setSelectedChannel] = useState<string | null>(null);

  const { data: stores = [], isLoading } = useQuery<PartnerStore[]>({
    queryKey: [`${apiBase}/partner-stores`],
  });

  const filteredStores = stores.filter((store) => {
    if (selectedType === "internal") return store.isInternal === true;
    if (selectedType === "external") return store.isInternal === false;
    return true;
  });

  const selectedStore = stores.find((s) => s.id === selectedStoreId);
  const channels = selectedStore?.availableSegments || [];

  const handleConfirm = () => {
    if (selectedStore && selectedChannel) {
      onStoreSelect(selectedStore, selectedChannel);
    }
  };

  const storeOptions = filteredStores.map(store => ({
    value: store.id,
    label: store.name,
    icon: <Store className="h-4 w-4 flex-shrink-0" />,
  }));

  const canConfirm = selectedStore && selectedChannel && productPackage;

  return (
    <CollapsibleModule
      title="Store Assignment"
      icon={<Store className="h-4 w-4" />}
      className="bg-muted/30"
      defaultOpen
    >
      <div className="space-y-4">
        <div className="space-y-2">
          <p className="text-sm font-medium">Store Type</p>
          <div className="grid grid-cols-2 gap-3">
            <Card
              className={`p-4 cursor-pointer hover-elevate transition-all ${
                selectedType === "internal"
                  ? "ring-2 ring-primary bg-primary/10"
                  : ""
              }`}
              onClick={() => {
                setSelectedType("internal");
                setSelectedStoreId(null);
                setSelectedChannel(null);
              }}
              data-testid="store-type-internal"
            >
              <div className="flex flex-col items-center text-center gap-2">
                <Building2 className="h-6 w-6" />
                <span className="font-medium">Internal</span>
                <span className="text-xs text-muted-foreground">QR Gear stores</span>
              </div>
            </Card>
            <Card
              className={`p-4 cursor-pointer hover-elevate transition-all ${
                selectedType === "external"
                  ? "ring-2 ring-primary bg-primary/10"
                  : ""
              }`}
              onClick={() => {
                setSelectedType("external");
                setSelectedStoreId(null);
                setSelectedChannel(null);
              }}
              data-testid="store-type-external"
            >
              <div className="flex flex-col items-center text-center gap-2">
                <Globe className="h-6 w-6" />
                <span className="font-medium">External</span>
                <span className="text-xs text-muted-foreground">Partner stores</span>
              </div>
            </Card>
          </div>
        </div>

        {selectedType && (
          <div className="space-y-2">
            <p className="text-sm font-medium">Select Store</p>
            {isLoading ? (
              <p className="text-sm text-muted-foreground">Loading stores...</p>
            ) : filteredStores.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No {selectedType} stores found
              </p>
            ) : (
              <CustomDropdown
                value={selectedStoreId || ""}
                onChange={(val) => {
                  setSelectedStoreId(val);
                  setSelectedChannel(null);
                }}
                options={storeOptions}
                placeholder="Choose a store..."
                data-testid="store-select"
              />
            )}
          </div>
        )}

        {selectedStore && (
          <div className="space-y-2">
            <p className="text-sm font-medium">Select Channel</p>
            {channels.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No channels available for this store
              </p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {channels.map((channel) => (
                  <Badge
                    key={channel}
                    variant={selectedChannel === channel ? "default" : "outline"}
                    className={`cursor-pointer h-10 px-4 text-sm ${
                      selectedChannel === channel ? "" : "hover-elevate"
                    }`}
                    onClick={() => setSelectedChannel(channel)}
                    data-testid={`channel-${channel}`}
                  >
                    {channel}
                  </Badge>
                ))}
              </div>
            )}
          </div>
        )}

        {canConfirm && (
          <div className="pt-2 border-t space-y-3">
            <div className="p-3 bg-primary/5 rounded-md">
              <p className="text-sm">
                <span className="font-medium">Assigning to: </span>
                {selectedStore.name} &rarr; {selectedChannel}
              </p>
            </div>
            <Button
              className="w-full h-12"
              onClick={handleConfirm}
              disabled={isSaving}
              data-testid="confirm-store-assignment"
            >
              {isSaving ? (
                <Loader2 className="h-5 w-5 mr-2 animate-spin" />
              ) : (
                <Store className="h-5 w-5 mr-2" />
              )}
              {isSaving ? "Assigning..." : `Assign to ${selectedChannel}`}
              {!isSaving && <ChevronRight className="h-4 w-4 ml-2" />}
            </Button>
          </div>
        )}

        {!productPackage && selectedStore && selectedChannel && (
          <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-md">
            <p className="text-sm text-amber-700 dark:text-amber-300">
              Load a product package first before assigning to a store.
            </p>
          </div>
        )}
      </div>
    </CollapsibleModule>
  );
}

export function StoreBuilderHarness() {
  const [productPackage, setProductPackage] = useState<ProductPackage | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<{ type: "success" | "error"; message: string } | null>(null);

  useEffect(() => {
    const savedPackage = sessionStorage.getItem("productPackage");
    if (savedPackage) {
      try {
        setProductPackage(JSON.parse(savedPackage));
      } catch (e) {
        console.error("Failed to parse product package:", e);
      }
    }
  }, []);

  const handleStoreSelect = async (store: PartnerStore, channel: string) => {
    if (!productPackage) return;

    setIsSaving(true);
    setSaveStatus(null);

    try {
      const response = await fetch("/api/test/partner-stores/" + store.id + "/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productIds: [productPackage.templateId || productPackage.graphicsId].filter(Boolean),
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to assign to store");
      }

      const result = await response.json();
      setSaveStatus({
        type: "success",
        message: `Assigned to ${store.name} / ${channel} (${result.synced} products)`,
      });
    } catch (error: any) {
      setSaveStatus({
        type: "error",
        message: error.message || "Failed to assign to store",
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <PackagePreviewModule productPackage={productPackage} />
      <StoreAssignmentModule
        onStoreSelect={handleStoreSelect}
        isSaving={isSaving}
        productPackage={productPackage}
      />

      {saveStatus && (
        <div
          className={`p-3 rounded-md border flex items-center gap-2 ${
            saveStatus.type === "success"
              ? "bg-green-50 border-green-200 text-green-800 dark:bg-green-950 dark:border-green-800 dark:text-green-200"
              : "bg-red-50 border-red-200 text-red-800 dark:bg-red-950 dark:border-red-800 dark:text-red-200"
          }`}
          data-testid="store-save-status"
        >
          <span className="text-sm font-medium">{saveStatus.message}</span>
        </div>
      )}
    </div>
  );
}
