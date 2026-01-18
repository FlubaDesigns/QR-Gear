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

interface ProductColor {
  hex: string;
  name: string;
}

interface ProductPackage {
  packetId?: string;
  templateId?: string;
  graphicsId?: string;
  qrContent?: string;
  productName?: string;
  productDescription?: string;
  productImageUrl?: string;
  compositeUrl?: string;
  qrOnlyUrl?: string;
  headerText?: string;
  footerText?: string;
  colors?: ProductColor[];
  sizes?: string[];
  availablePlacements?: string[];
  placements?: string[];
  basePrice?: string;
  customerPrice?: string;
  qrProductState?: string;
  blueprintId?: number;
  printProviderId?: number;
  pricing?: {
    baseProductCost: number;
    placementCost: number;
    textUpcharge: number;
    hostingCost: number;
    subtotal: number;
    markupAmount: number;
    customerPrice: number;
    hostingTierCode?: string;
  };
}

type StoreType = "internal" | "external" | null;

function PackagePreviewModule({ productPackage, isLoading }: { productPackage: ProductPackage | null; isLoading?: boolean }) {
  if (isLoading) {
    return (
      <CollapsibleModule
        title="Product Package"
        icon={<Package className="h-4 w-4" />}
        className="bg-muted/30"
        defaultOpen
      >
        <div className="p-4 text-center flex items-center justify-center gap-2">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span>Loading package from database...</span>
        </div>
      </CollapsibleModule>
    );
  }

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
        {productPackage.productName && (
          <div className="p-3 bg-primary/10 rounded-lg">
            <p className="text-lg font-semibold" data-testid="text-product-name">
              {productPackage.productName}
            </p>
            {productPackage.productDescription && (
              <p className="text-sm text-muted-foreground mt-1">
                {productPackage.productDescription}
              </p>
            )}
            {productPackage.qrProductState && (
              <Badge variant="secondary" className="mt-2">
                {productPackage.qrProductState.replace('qr_', '').toUpperCase()}
              </Badge>
            )}
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          {(productPackage.productImageUrl || productPackage.compositeUrl) && (
            <div className="space-y-2">
              <p className="text-sm font-medium">Product Image</p>
              <img
                src={productPackage.productImageUrl || productPackage.compositeUrl}
                alt="Product"
                className="w-full h-32 object-contain rounded-lg border"
                data-testid="img-composite"
              />
            </div>
          )}
          {productPackage.qrOnlyUrl && (
            <div className="space-y-2">
              <p className="text-sm font-medium">QR Code</p>
              <img
                src={productPackage.qrOnlyUrl}
                alt="QR Code"
                className="w-full h-32 object-contain rounded-lg border bg-white"
                data-testid="img-qr-only"
              />
            </div>
          )}
        </div>

        {productPackage.qrContent && (
          <div className="p-3 bg-blue-50 dark:bg-blue-950/50 rounded-lg border border-blue-200 dark:border-blue-800">
            <div className="flex items-center gap-2">
              <LinkIcon className="h-4 w-4 flex-shrink-0 text-blue-600" />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-blue-700 dark:text-blue-300">QR Content (URL/Text)</p>
                <p className="text-sm font-mono break-all" data-testid="text-qr-content">
                  {productPackage.qrContent}
                </p>
              </div>
            </div>
          </div>
        )}

        {(productPackage.headerText || productPackage.footerText) && (
          <div className="p-3 bg-purple-50 dark:bg-purple-950/50 rounded-lg border border-purple-200 dark:border-purple-800">
            <p className="text-xs font-medium text-purple-700 dark:text-purple-300 mb-2">Custom Text</p>
            {productPackage.headerText && (
              <p className="text-sm"><span className="font-medium">Header:</span> {productPackage.headerText}</p>
            )}
            {productPackage.footerText && (
              <p className="text-sm"><span className="font-medium">Footer:</span> {productPackage.footerText}</p>
            )}
          </div>
        )}

        {productPackage.colors && productPackage.colors.length > 0 && (
          <div className="p-3 bg-muted/50 rounded-lg">
            <p className="text-xs font-medium mb-2">Available Colors ({productPackage.colors.length})</p>
            <div className="flex flex-wrap gap-2">
              {productPackage.colors.map((color, idx) => (
                <div 
                  key={idx} 
                  className="flex items-center gap-1 px-2 py-1 bg-background rounded border text-xs"
                  data-testid={`color-${idx}`}
                >
                  <div 
                    className="w-4 h-4 rounded-full border" 
                    style={{ backgroundColor: color.hex }}
                  />
                  <span>{color.name}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {productPackage.sizes && productPackage.sizes.length > 0 && (
          <div className="p-3 bg-muted/50 rounded-lg">
            <p className="text-xs font-medium mb-2">Available Sizes ({productPackage.sizes.length})</p>
            <div className="flex flex-wrap gap-1">
              {productPackage.sizes.map((size, idx) => (
                <Badge key={idx} variant="outline" className="text-xs" data-testid={`size-${idx}`}>
                  {size}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {productPackage.placements && productPackage.placements.length > 0 && (
          <div className="p-3 bg-muted/50 rounded-lg">
            <p className="text-xs font-medium mb-2">Selected Placements</p>
            <div className="flex flex-wrap gap-1">
              {productPackage.placements.map((placement, idx) => (
                <Badge key={idx} variant="secondary" className="text-xs capitalize">
                  {placement}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {productPackage.pricing && (
          <div className="p-3 bg-green-50 dark:bg-green-950/50 rounded-lg border border-green-200 dark:border-green-800">
            <p className="text-xs font-semibold text-green-700 dark:text-green-300 mb-2">Pricing Breakdown</p>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span>Base Price</span>
                <span>${productPackage.pricing.baseProductCost.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>Extra Placements</span>
                <span>{productPackage.pricing.placementCost > 0 ? `+$${productPackage.pricing.placementCost.toFixed(2)}` : '$0.00'}</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>Text Lines</span>
                <span>{productPackage.pricing.textUpcharge > 0 ? `+$${productPackage.pricing.textUpcharge.toFixed(2)}` : '$0.00'}</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>Hosting</span>
                <span>{productPackage.pricing.hostingCost > 0 ? `+$${productPackage.pricing.hostingCost.toFixed(2)}` : '$0.00'}</span>
              </div>
              <div className="flex justify-between border-t pt-1">
                <span>Subtotal</span>
                <span>${productPackage.pricing.subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>Markup</span>
                <span>+${productPackage.pricing.markupAmount.toFixed(2)}</span>
              </div>
              <div className="flex justify-between border-t pt-1 font-semibold text-green-700 dark:text-green-300">
                <span>Customer Price</span>
                <span>${productPackage.pricing.customerPrice.toFixed(2)}</span>
              </div>
            </div>
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          {productPackage.packetId && (
            <Badge variant="secondary" data-testid="badge-packet">
              Packet: {productPackage.packetId.slice(0, 8)}...
            </Badge>
          )}
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
  const [isLoadingPacket, setIsLoadingPacket] = useState(false);
  const [saveStatus, setSaveStatus] = useState<{ type: "success" | "error"; message: string } | null>(null);

  useEffect(() => {
    // Check for packetId in URL first
    const urlParams = new URLSearchParams(window.location.search);
    const packetId = urlParams.get("packetId");
    
    if (packetId) {
      setIsLoadingPacket(true);
      fetch(`/api/test/packets/${packetId}`)
        .then(res => {
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          return res.json();
        })
        .then(data => {
          if (data.success && data.packet) {
            const packet = data.packet;
            setProductPackage({
              packetId: packet.id,
              qrContent: packet.qrContent,
              productName: packet.productName,
              productDescription: packet.productDescription,
              productImageUrl: packet.productImageUrl,
              compositeUrl: packet.compositeUrl,
              qrOnlyUrl: packet.qrOnlyUrl,
              headerText: packet.headerText,
              footerText: packet.footerText,
              colors: packet.colors || [],
              sizes: packet.sizes || [],
              availablePlacements: packet.availablePlacements || [],
              placements: packet.placements || [],
              basePrice: packet.basePrice,
              customerPrice: packet.customerPrice,
              qrProductState: packet.qrProductState,
              blueprintId: packet.blueprintId,
              printProviderId: packet.printProviderId,
              pricing: packet.pricing,
            });
          }
        })
        .catch(err => {
          console.error("Failed to load packet:", err);
          setSaveStatus({ type: "error", message: `Failed to load packet: ${err.message}` });
        })
        .finally(() => {
          setIsLoadingPacket(false);
        });
      return;
    }

    // Fallback to sessionStorage
    const savedPackage = sessionStorage.getItem("productPackage");
    if (savedPackage) {
      try {
        const parsed = JSON.parse(savedPackage);
        // Validate package has at least one ID for linking
        if (!parsed.templateId && !parsed.graphicsId && !parsed.packetId) {
          console.warn("Stale package without IDs found, clearing");
          sessionStorage.removeItem("productPackage");
          setProductPackage(null);
        } else {
          setProductPackage(parsed);
        }
      } catch (e) {
        console.error("Failed to parse product package:", e);
        sessionStorage.removeItem("productPackage");
      }
    }
  }, []);

  const handleStoreSelect = async (store: PartnerStore, channel: string) => {
    if (!productPackage) return;
    
    // Validate package has required IDs (packetId, templateId, or graphicsId)
    if (!productPackage.packetId && !productPackage.templateId && !productPackage.graphicsId) {
      setSaveStatus({
        type: "error",
        message: "Package missing IDs. Please use 'Create Graphics' in Products Builder first.",
      });
      return;
    }

    setIsSaving(true);
    setSaveStatus(null);

    try {
      const response = await fetch("/api/test/store-product-links", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          storeId: store.id,
          storeName: store.name,
          channel,
          packetId: productPackage.packetId,
          templateId: productPackage.templateId,
          graphicsId: productPackage.graphicsId,
          qrContent: productPackage.qrContent,
          productName: productPackage.productName,
          compositeUrl: productPackage.compositeUrl,
          qrOnlyUrl: productPackage.qrOnlyUrl,
          pricing: productPackage.pricing,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to assign to store");
      }

      const result = await response.json();
      setSaveStatus({
        type: "success",
        message: `Linked to ${store.name} / ${channel}`,
      });
      
      sessionStorage.removeItem("productPackage");
      setProductPackage(null);
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
      <PackagePreviewModule productPackage={productPackage} isLoading={isLoadingPacket} />
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
