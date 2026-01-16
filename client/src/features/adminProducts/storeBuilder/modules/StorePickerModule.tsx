import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Store, Plus, ChevronDown, ChevronRight } from "lucide-react";
import { useState } from "react";
import { useStoreBuilderContext } from "../StoreBuilderContext";

const MOCK_STORES = [
  { id: "store-1", name: "QR Gear Main", permissions: ["all"], productLimit: 50, products: [] },
  { id: "store-2", name: "Kingdom Connects", permissions: ["qr_basics", "qr_plus"], productLimit: 15, products: [] },
];

export function StorePickerModule() {
  const { step, currentStore, setCurrentStore, setStep } = useStoreBuilderContext();
  const [expanded, setExpanded] = useState(step === "store");

  if (step !== "store" && !currentStore) return null;

  const handleSelectStore = (store: typeof MOCK_STORES[0]) => {
    setCurrentStore(store);
    setStep("channel");
  };

  return (
    <div className="border rounded-lg p-3" data-testid="module-store-picker">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 w-full text-left font-medium"
        data-testid="toggle-store-picker"
      >
        {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        <Store className="h-4 w-4" />
        <span className="flex-1">Select Store</span>
        {currentStore && (
          <Badge variant="secondary">{currentStore.name}</Badge>
        )}
      </button>

      {expanded && (
        <div className="mt-3 space-y-2">
          {MOCK_STORES.map(store => (
            <button
              key={store.id}
              type="button"
              onClick={() => handleSelectStore(store)}
              className={`w-full p-3 rounded-lg border text-left transition-all ${
                currentStore?.id === store.id
                  ? "border-primary bg-primary/10"
                  : "border-border hover:border-primary/50"
              }`}
              data-testid={`button-store-${store.id}`}
            >
              <div className="font-medium">{store.name}</div>
              <div className="text-sm text-muted-foreground">
                {store.productLimit} products max
              </div>
            </button>
          ))}
          <Button variant="outline" className="w-full" data-testid="button-create-store">
            <Plus className="h-4 w-4 mr-2" />
            Create New Store
          </Button>
        </div>
      )}
    </div>
  );
}
