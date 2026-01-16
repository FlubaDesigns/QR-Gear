import { ShoppingCart, Palette, Ruler, Check } from "lucide-react";
import { CollapsibleModule } from "@/features/shared/components/CollapsibleModule";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useBuilderContext } from "../BuilderContext";

export function AddToCartModule() {
  const { state } = useBuilderContext();
  const { toast } = useToast();

  const hasContent = state.content.url || state.content.title;
  const hasProduct = state.selectedProduct;
  const hasQRState = state.qrProductState;

  if (!hasProduct || !hasQRState || !hasContent) {
    return null;
  }

  const qrStateLabels: Record<string, string> = {
    qr_basics: "QR Basics",
    qr_plus: "QR Plus",
    qr_canvas: "QR Canvas",
    qr_play: "QR Play",
    qr_dynamics: "QR Dynamics™",
  };

  const handleAddToCart = () => {
    toast({
      title: "Added to Cart",
      description: `${state.selectedProduct?.title} with ${qrStateLabels[state.qrProductState!]} QR added to your cart.`,
    });
  };

  const handlePreview = () => {
    toast({
      title: "Preview",
      description: "Opening product preview...",
    });
  };

  return (
    <CollapsibleModule
      title="Ready to Order"
      icon={<ShoppingCart className="h-4 w-4" />}
      className="bg-green-500/10 border-green-500/20"
      defaultOpen
    >
      <div className="space-y-4">
        <div className="p-3 bg-background rounded-md border space-y-2">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Check className="h-4 w-4 text-green-500" />
            Order Summary
          </div>
          
          <div className="space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Product:</span>
              <span className="font-medium truncate max-w-[180px]">{state.selectedProduct?.title}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">QR Type:</span>
              <span className="font-medium">{qrStateLabels[state.qrProductState!]}</span>
            </div>
            {state.content.url && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Content:</span>
                <span className="font-medium truncate max-w-[180px]">
                  {state.content.url.substring(0, 25)}{state.content.url.length > 25 ? "..." : ""}
                </span>
              </div>
            )}
          </div>
        </div>

        <div className="space-y-3">
          <Label className="text-sm text-muted-foreground">Next: Choose color & size at checkout</Label>
          <div className="flex gap-3">
            <Button
              variant="outline"
              size="lg"
              className="flex-1 h-14 text-base"
              onClick={handlePreview}
              data-testid="button-preview-product"
            >
              Preview
            </Button>
            <Button
              size="lg"
              className="flex-1 h-14 text-base"
              onClick={handleAddToCart}
              data-testid="button-add-to-cart"
            >
              <ShoppingCart className="h-5 w-5 mr-2" />
              Add to Cart
            </Button>
          </div>
        </div>
      </div>
    </CollapsibleModule>
  );
}
