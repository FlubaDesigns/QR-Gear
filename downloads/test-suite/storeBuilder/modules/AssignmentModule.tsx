import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Send, Trash2, Package, Loader2, Plus, CheckCircle } from "lucide-react";
import { CollapsibleModule } from "@/features/shared/components/CollapsibleModule";
import { useStoreBuilderContext } from "../StoreBuilderContext";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

export function AssignmentModule() {
  const {
    step,
    currentStore,
    currentChannel,
    configuredProducts,
    removeConfiguredProduct,
    setStep,
    reset,
  } = useStoreBuilderContext();
  const { toast } = useToast();
  const [assignmentSuccess, setAssignmentSuccess] = useState(false);

  const assignMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest(
        "POST",
        `/api/test/stores/${currentStore!.id}/channels/${currentChannel!.id}/products`,
        { products: configuredProducts }
      );
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Products Assigned",
        description: `${data.assigned} product(s) assigned to ${currentStore!.name} / ${currentChannel!.name}`,
      });
      setAssignmentSuccess(true);
      setTimeout(() => {
        reset();
        setAssignmentSuccess(false);
      }, 2000);
    },
    onError: (error: Error) => {
      toast({
        title: "Assignment Failed",
        description: error.message || "Could not assign products",
        variant: "destructive",
      });
    },
  });

  if (!currentStore || !currentChannel) {
    return null;
  }

  const handleAssign = () => {
    assignMutation.mutate();
  };

  const handleAddAnother = () => {
    setStep("catalog");
  };

  return (
    <CollapsibleModule
      title="Assign to Store"
      icon={<Send className="h-4 w-4" />}
      defaultOpen={step === "assign" || configuredProducts.length > 0}
      badge={configuredProducts.length > 0 ? (
        <Badge variant="default">{configuredProducts.length} ready</Badge>
      ) : undefined}
    >
      <div className="space-y-3">
        {configuredProducts.length === 0 ? (
          <div className="text-center py-6 text-muted-foreground">
            <Package className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No products configured yet</p>
            <p className="text-xs mt-1">Select a product from the catalog to get started</p>
          </div>
        ) : (
          <>
            <div className="space-y-2">
              {configuredProducts.map(product => (
                <div
                  key={product.id}
                  className="flex items-center gap-3 p-3 border rounded-lg"
                  data-testid={`configured-product-${product.id}`}
                >
                  <Package className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm truncate">{product.baseProductName}</div>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {product.isBlankCanvas ? (
                        <Badge variant="outline" className="text-xs">Blank Canvas</Badge>
                      ) : (
                        <Badge variant="secondary" className="text-xs">With Graphic</Badge>
                      )}
                      <Badge variant="secondary" className="text-xs">
                        {product.enabledColors.length} colors
                      </Badge>
                      <Badge variant="secondary" className="text-xs">
                        {product.enabledSizes.length} sizes
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

            <Button
              variant="outline"
              size="sm"
              className="w-full"
              onClick={handleAddAnother}
              data-testid="button-add-another"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Another Product
            </Button>

            <div className="pt-3 border-t">
              <p className="text-sm text-muted-foreground mb-3">
                Assign to: <strong>{currentStore.name}</strong> / <strong>{currentChannel.name}</strong>
              </p>
              <Button
                onClick={handleAssign}
                className="w-full"
                disabled={assignMutation.isPending || configuredProducts.length === 0 || assignmentSuccess}
                data-testid="button-assign-products"
              >
                {assignmentSuccess ? (
                  <>
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Assigned Successfully!
                  </>
                ) : assignMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Assigning...
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4 mr-2" />
                    Assign {configuredProducts.length} Product{configuredProducts.length !== 1 ? 's' : ''} to Store
                  </>
                )}
              </Button>
            </div>
          </>
        )}
      </div>
    </CollapsibleModule>
  );
}
