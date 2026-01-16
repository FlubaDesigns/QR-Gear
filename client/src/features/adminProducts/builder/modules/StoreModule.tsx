import { useState } from "react";
import { Store, Building2, Globe, ChevronRight, Loader2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { CollapsibleModule } from "@/features/shared/components/CollapsibleModule";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { PartnerStore } from "@shared/schema";
import type { SaveTarget } from "./SaveOptionsModule";

interface StoreModuleProps {
  saveTarget: SaveTarget;
  onStoreSelect?: (store: PartnerStore, segment: string) => void;
  isSaving?: boolean;
}

type StoreType = "internal" | "external" | null;

export function StoreModule({ saveTarget, onStoreSelect, isSaving }: StoreModuleProps) {
  const [selectedType, setSelectedType] = useState<StoreType>(null);
  const [selectedStoreId, setSelectedStoreId] = useState<string | null>(null);
  const [selectedSegment, setSelectedSegment] = useState<string | null>(null);

  const { data: stores = [], isLoading } = useQuery<PartnerStore[]>({
    queryKey: ["/api/admin/partner-stores"],
  });

  const filteredStores = stores.filter((store) => {
    if (selectedType === "internal") return store.isInternal === true;
    if (selectedType === "external") return store.isInternal === false;
    return true;
  });

  const selectedStore = stores.find((s) => s.id === selectedStoreId);
  const segments = selectedStore?.availableSegments || [];

  const handleConfirm = () => {
    if (selectedStore && selectedSegment && onStoreSelect) {
      onStoreSelect(selectedStore, selectedSegment);
    }
  };

  const canConfirm = selectedStore && selectedSegment;

  return (
    <CollapsibleModule
      title="Choose Store"
      icon={<Store className="h-4 w-4" />}
      className="bg-muted/30"
      defaultOpen
    >
      <div className="space-y-4">
        {/* Step 1: Store Type */}
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
                setSelectedSegment(null);
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
                setSelectedSegment(null);
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

        {/* Step 2: Store Selection */}
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
              <Select
                value={selectedStoreId || ""}
                onValueChange={(val) => {
                  setSelectedStoreId(val);
                  setSelectedSegment(null);
                }}
              >
                <SelectTrigger data-testid="store-select">
                  <SelectValue placeholder="Choose a store..." />
                </SelectTrigger>
                <SelectContent>
                  {filteredStores.map((store) => (
                    <SelectItem key={store.id} value={store.id}>
                      {store.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        )}

        {/* Step 3: Segment/Channel Selection */}
        {selectedStore && (
          <div className="space-y-2">
            <p className="text-sm font-medium">Select Channel</p>
            {segments.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No channels available for this store
              </p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {segments.map((segment) => (
                  <Badge
                    key={segment}
                    variant={selectedSegment === segment ? "default" : "outline"}
                    className={`cursor-pointer h-10 px-4 text-sm ${
                      selectedSegment === segment ? "" : "hover-elevate"
                    }`}
                    onClick={() => setSelectedSegment(segment)}
                    data-testid={`segment-${segment}`}
                  >
                    {segment}
                  </Badge>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Summary & Confirm */}
        {canConfirm && (
          <div className="pt-2 border-t space-y-3">
            <div className="p-3 bg-primary/5 rounded-md">
              <p className="text-sm">
                <span className="font-medium">Saving to: </span>
                {selectedStore.name} &rarr; {selectedSegment}
              </p>
              {saveTarget === "all" && (
                <p className="text-xs text-muted-foreground mt-1">
                  Also saving as Template and Graphic Set
                </p>
              )}
            </div>
            <Button
              className="w-full h-12"
              onClick={handleConfirm}
              disabled={isSaving}
              data-testid="confirm-store-save"
            >
              {isSaving ? (
                <Loader2 className="h-5 w-5 mr-2 animate-spin" />
              ) : (
                <Store className="h-5 w-5 mr-2" />
              )}
              {isSaving ? "Saving..." : `Save to ${selectedSegment}`}
              {!isSaving && <ChevronRight className="h-4 w-4 ml-2" />}
            </Button>
          </div>
        )}
      </div>
    </CollapsibleModule>
  );
}
