import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQuery } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import {
  Plus,
  Loader2,
  Trash2,
  Layers,
  Play,
  Pause,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { MasterProduct } from "@shared/schema";
import type { ProductBundle } from "./orchestration-types";

export function BundlesTab() {
  const { toast } = useToast();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);

  const { data: bundles = [], isLoading } = useQuery<ProductBundle[]>({
    queryKey: ["/api/admin/orchestration/bundles"],
  });

  const { data: masterProducts = [] } = useQuery<MasterProduct[]>({
    queryKey: ["/api/admin/orchestration/master-products"],
  });

  const createBundleMutation = useMutation({
    mutationFn: async (data: Partial<ProductBundle>) => {
      return apiRequest("POST", "/api/admin/orchestration/bundles", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/orchestration/bundles"] });
      setCreateDialogOpen(false);
      toast({ title: "Bundle Created" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const toggleBundleMutation = useMutation({
    mutationFn: async (bundleId: string) => {
      return apiRequest("POST", `/api/admin/orchestration/bundles/${bundleId}/toggle`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/orchestration/bundles"] });
      toast({ title: "Bundle Updated" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const deleteBundleMutation = useMutation({
    mutationFn: async (bundleId: string) => {
      return apiRequest("DELETE", `/api/admin/orchestration/bundles/${bundleId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/orchestration/bundles"] });
      toast({ title: "Bundle Deleted" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <h2 className="text-lg font-semibold">Product Bundles</h2>
        <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button className="h-12" data-testid="button-create-bundle">
              <Plus className="w-5 h-5 mr-2" />
              Create Bundle
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Create Bundle</DialogTitle>
              <DialogDescription>
                Create a product bundle for cross-selling and discounts.
              </DialogDescription>
            </DialogHeader>
            <BundleForm
              masterProducts={masterProducts}
              onSubmit={(data) => createBundleMutation.mutate(data)}
              isPending={createBundleMutation.isPending}
            />
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : bundles.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Layers className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-medium mb-2">No Bundles</h3>
            <p className="text-muted-foreground mb-4">
              Create product bundles to offer discounts and cross-sell.
            </p>
            <Button onClick={() => setCreateDialogOpen(true)} className="h-12">
              <Plus className="w-5 h-5 mr-2" />
              Create First Bundle
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {bundles.map((bundle) => (
            <Card key={bundle.id} data-testid={`card-bundle-${bundle.id}`}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <Badge variant={bundle.isActive ? "default" : "secondary"}>
                        {bundle.isActive ? "Active" : "Inactive"}
                      </Badge>
                      <Badge variant="outline">{bundle.bundleType}</Badge>
                      <Badge variant="outline">{bundle.pricingType}</Badge>
                    </div>
                    <h3 className="font-semibold text-lg">{bundle.name}</h3>
                    {bundle.description && (
                      <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
                        {bundle.description}
                      </p>
                    )}
                    <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground flex-wrap">
                      {bundle.pricingType === "discount_percent" && bundle.discountPercent && (
                        <span>{bundle.discountPercent}% off</span>
                      )}
                      {bundle.pricingType === "fixed_price" && bundle.fixedPrice && (
                        <span>${bundle.fixedPrice} bundle price</span>
                      )}
                      {bundle.pricingType === "discount_amount" && bundle.discountAmount && (
                        <span>${bundle.discountAmount} off</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <Button
                      variant="outline"
                      onClick={() => toggleBundleMutation.mutate(bundle.id)}
                      className="h-12 px-4"
                      data-testid={`button-toggle-bundle-${bundle.id}`}
                      aria-label={bundle.isActive ? "Pause bundle" : "Activate bundle"}
                    >
                      {bundle.isActive ? <Pause className="w-5 h-5 mr-2" /> : <Play className="w-5 h-5 mr-2" />}
                      {bundle.isActive ? "Pause" : "Activate"}
                    </Button>
                    <Button
                      variant="destructive"
                      onClick={() => deleteBundleMutation.mutate(bundle.id)}
                      className="h-12 px-4"
                      data-testid={`button-delete-bundle-${bundle.id}`}
                      aria-label="Delete bundle"
                    >
                      <Trash2 className="w-5 h-5 mr-2" />
                      Delete
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function BundleForm({
  masterProducts,
  onSubmit,
  isPending,
}: {
  masterProducts: MasterProduct[];
  onSubmit: (data: Partial<ProductBundle>) => void;
  isPending: boolean;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [bundleType, setBundleType] = useState("fixed");
  const [pricingType, setPricingType] = useState("discount_percent");
  const [discountPercent, setDiscountPercent] = useState("10");
  const [fixedPrice, setFixedPrice] = useState("");
  const [discountAmount, setDiscountAmount] = useState("");
  const [selectedProducts, setSelectedProducts] = useState<string[]>([]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      name,
      description: description || null,
      bundleType,
      pricingType,
      discountPercent: pricingType === "discount_percent" ? discountPercent : null,
      fixedPrice: pricingType === "fixed_price" ? fixedPrice : null,
      discountAmount: pricingType === "discount_amount" ? discountAmount : null,
      isActive: true,
      items: selectedProducts.map((id, idx) => ({
        masterProductId: id,
        displayOrder: idx,
        quantity: 1,
      })) as any[],
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="bundle-name">Bundle Name</Label>
        <Input
          id="bundle-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="h-12"
          required
          data-testid="input-bundle-name"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="bundle-description">Description</Label>
        <Textarea
          id="bundle-description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
          data-testid="input-bundle-description"
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Bundle Type</Label>
          <Select value={bundleType} onValueChange={setBundleType}>
            <SelectTrigger className="h-12" data-testid="select-bundle-type">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="fixed">Fixed Bundle</SelectItem>
              <SelectItem value="pick">Pick N Items</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Pricing Type</Label>
          <Select value={pricingType} onValueChange={setPricingType}>
            <SelectTrigger className="h-12" data-testid="select-pricing-type">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="discount_percent">Percent Discount</SelectItem>
              <SelectItem value="fixed_price">Fixed Price</SelectItem>
              <SelectItem value="discount_amount">Amount Off</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      {pricingType === "discount_percent" && (
        <div className="space-y-2">
          <Label htmlFor="discount-percent">Discount Percent (%)</Label>
          <Input
            id="discount-percent"
            type="number"
            value={discountPercent}
            onChange={(e) => setDiscountPercent(e.target.value)}
            className="h-12"
            min="1"
            max="100"
            data-testid="input-discount-percent"
          />
        </div>
      )}
      {pricingType === "fixed_price" && (
        <div className="space-y-2">
          <Label htmlFor="fixed-price">Bundle Price ($)</Label>
          <Input
            id="fixed-price"
            type="number"
            step="0.01"
            value={fixedPrice}
            onChange={(e) => setFixedPrice(e.target.value)}
            className="h-12"
            data-testid="input-fixed-price"
          />
        </div>
      )}
      {pricingType === "discount_amount" && (
        <div className="space-y-2">
          <Label htmlFor="discount-amount">Discount Amount ($)</Label>
          <Input
            id="discount-amount"
            type="number"
            step="0.01"
            value={discountAmount}
            onChange={(e) => setDiscountAmount(e.target.value)}
            className="h-12"
            data-testid="input-discount-amount"
          />
        </div>
      )}
      <div className="space-y-2">
        <Label>Products in Bundle</Label>
        <div className="border rounded-md p-2 max-h-48 overflow-y-auto">
          {masterProducts.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-2">No products available</p>
          ) : (
            masterProducts.map((product) => (
              <label 
                key={product.id} 
                className="flex items-center gap-2 p-2 hover-elevate rounded cursor-pointer min-h-12"
                data-testid={`label-bundle-product-${product.id}`}
              >
                <input
                  type="checkbox"
                  checked={selectedProducts.includes(product.id)}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setSelectedProducts([...selectedProducts, product.id]);
                    } else {
                      setSelectedProducts(selectedProducts.filter((id) => id !== product.id));
                    }
                  }}
                  className="w-5 h-5"
                  data-testid={`checkbox-bundle-product-${product.id}`}
                />
                <span className="text-sm">{product.title}</span>
                <span className="text-xs text-muted-foreground ml-auto">{product.sku}</span>
              </label>
            ))
          )}
        </div>
      </div>
      <DialogFooter>
        <Button type="submit" disabled={isPending || !name || selectedProducts.length < 2} className="h-12" data-testid="button-submit-bundle">
          {isPending ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <Plus className="w-5 h-5 mr-2" />}
          Create Bundle
        </Button>
      </DialogFooter>
    </form>
  );
}
