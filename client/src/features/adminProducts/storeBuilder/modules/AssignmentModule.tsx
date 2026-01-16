import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Send, ChevronDown, ChevronRight, Trash2, Package } from "lucide-react";
import { useState } from "react";
import { useStoreBuilderContext } from "../StoreBuilderContext";

export function AssignmentModule() {
  const { 
    step, 
    currentStore, 
    currentChannel, 
    configuredProducts, 
    removeConfiguredProduct,
    reset 
  } = useStoreBuilderContext();
  const [expanded, setExpanded] = useState(step === "assign");

  if (!currentStore || !currentChannel) return null;
  if (configuredProducts.length === 0 && step !== "assign") return null;

  const handleAssignToStore = () => {
    alert(`Would assign ${configuredProducts.length} products to ${currentStore.name} / ${currentChannel.name}`);
    reset();
  };

  return (
    <div className="border rounded-lg p-3" data-testid="module-assignment">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 w-full text-left font-medium"
        data-testid="toggle-assignment"
      >
        {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        <Send className="h-4 w-4" />
        <span className="flex-1">Assign to Store</span>
        {configuredProducts.length > 0 && (
          <Badge variant="default">{configuredProducts.length} ready</Badge>
        )}
      </button>

      {expanded && (
        <div className="mt-3 space-y-3">
          {configuredProducts.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              No products configured yet. Select a product from the catalog to get started.
            </p>
          ) : (
            <>
              <div className="space-y-2">
                {configuredProducts.map(product => (
                  <div
                    key={product.id}
                    className="flex items-center gap-3 p-3 border rounded-lg"
                    data-testid={`configured-product-${product.id}`}
                  >
                    <Package className="h-5 w-5 text-muted-foreground" />
                    <div className="flex-1">
                      <div className="font-medium text-sm">{product.baseProductName}</div>
                      <div className="flex gap-1 mt-1">
                        {product.isBlankCanvas ? (
                          <Badge variant="outline" className="text-xs">Blank Canvas</Badge>
                        ) : (
                          <Badge variant="secondary" className="text-xs">With Graphic</Badge>
                        )}
                        <Badge variant="secondary" className="text-xs">
                          {product.enabledColors.length} colors
                        </Badge>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removeConfiguredProduct(product.id)}
                      data-testid={`button-remove-${product.id}`}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                ))}
              </div>

              <div className="pt-2 border-t">
                <p className="text-sm text-muted-foreground mb-3">
                  Assign to: <strong>{currentStore.name}</strong> / <strong>{currentChannel.name}</strong>
                </p>
                <Button 
                  onClick={handleAssignToStore}
                  className="w-full"
                  data-testid="button-assign-products"
                >
                  <Send className="h-4 w-4 mr-2" />
                  Assign {configuredProducts.length} Product{configuredProducts.length > 1 ? 's' : ''} to Store
                </Button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
