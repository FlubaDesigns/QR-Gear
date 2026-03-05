import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Box, Save, Loader2, Check, Search } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import AdminShell from "@/components/AdminShell";

interface ProductBlueprint {
  id: number;
  title: string;
  images?: string[];
}

interface AllowedProduct {
  blueprintId: number;
  title: string;
  addedAt: string;
}

export default function AdminBlanks() {
  const { toast } = useToast();
  const [selectedProducts, setSelectedProducts] = useState<Set<number>>(new Set());
  const [hasChanges, setHasChanges] = useState(false);
  const [search, setSearch] = useState("");

  const { data: blueprints = [], isLoading: loadingBlueprints } = useQuery<ProductBlueprint[]>({
    queryKey: ["/api/printify/local-blueprints"],
    queryFn: async () => {
      const res = await fetch("/api/printify/local-blueprints");
      const d = await res.json();
      return d.blueprints || [];
    },
  });

  const { data: allowedData, isLoading: loadingAllowed } = useQuery({
    queryKey: ["/api/members/allowed-products"],
    queryFn: async () => {
      const res = await fetch("/api/members/allowed-products");
      return res.json();
    },
  });

  useEffect(() => {
    if (allowedData?.products) {
      setSelectedProducts(new Set<number>(allowedData.products.map((p: AllowedProduct) => p.blueprintId)));
      setHasChanges(false);
    }
  }, [allowedData]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const products = Array.from(selectedProducts).map(blueprintId => {
        const bp = blueprints.find(b => b.id === blueprintId);
        return {
          blueprintId,
          title: bp?.title || `Product ${blueprintId}`,
          addedAt: new Date().toISOString(),
        };
      });
      const res = await fetch("/api/members/allowed-products", {
        method: "POST",
        body: JSON.stringify({ products }),
        headers: { "Content-Type": "application/json" },
      });
      if (!res.ok) throw new Error("Failed to save");
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Blanks saved", description: `${selectedProducts.size} products available for members` });
      setHasChanges(false);
      queryClient.invalidateQueries({ queryKey: ["/api/members/allowed-products"] });
    },
    onError: (err: any) => {
      toast({ title: "Save failed", description: err.message, variant: "destructive" });
    },
  });

  const toggleProduct = (id: number) => {
    setSelectedProducts(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
    setHasChanges(true);
  };

  const selectAll = () => {
    setSelectedProducts(new Set(filteredBlueprints.map(b => b.id)));
    setHasChanges(true);
  };

  const clearAll = () => {
    setSelectedProducts(new Set());
    setHasChanges(true);
  };

  const filteredBlueprints = blueprints.filter(bp =>
    !search || bp.title.toLowerCase().includes(search.toLowerCase())
  );

  const isLoading = loadingBlueprints || loadingAllowed;

  return (
    <AdminShell title="Blanks" subtitle="Set up base products for members to customize" icon={Box}>
      <div className="space-y-4">
        <Card className="p-4">
          <p className="text-sm text-muted-foreground">
            Choose which blank products members can use in their sandbox. Members will be able to add their own QR codes, graphics, and text to these items.
          </p>
        </Card>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search products..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9"
              data-testid="input-search-blanks"
            />
          </div>
          <Badge variant="secondary">{selectedProducts.size} selected</Badge>
          <Button size="sm" variant="outline" onClick={selectAll} data-testid="button-select-all-blanks">
            Select All
          </Button>
          <Button size="sm" variant="outline" onClick={clearAll} data-testid="button-clear-all-blanks">
            Clear
          </Button>
          <Button
            size="sm"
            onClick={() => saveMutation.mutate()}
            disabled={!hasChanges || saveMutation.isPending}
            data-testid="button-save-blanks"
          >
            {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save
          </Button>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : filteredBlueprints.length === 0 ? (
          <Card className="p-8 text-center">
            <p className="text-muted-foreground">
              {blueprints.length === 0
                ? "No products in catalog yet. Sync your Printify catalog first from the Products page."
                : "No products match your search."}
            </p>
          </Card>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {filteredBlueprints.map(bp => {
              const isSelected = selectedProducts.has(bp.id);
              return (
                <label
                  key={bp.id}
                  className={`flex items-center gap-3 p-3 rounded-md border cursor-pointer transition-colors ${
                    isSelected
                      ? "border-primary bg-primary/5"
                      : "border-border"
                  } hover-elevate`}
                  data-testid={`card-blank-${bp.id}`}
                >
                  <Checkbox
                    checked={isSelected}
                    onCheckedChange={() => toggleProduct(bp.id)}
                    data-testid={`checkbox-blank-${bp.id}`}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{bp.title}</div>
                    <div className="text-xs text-muted-foreground">ID: {bp.id}</div>
                  </div>
                  {isSelected && <Check className="h-4 w-4 text-primary shrink-0" />}
                </label>
              );
            })}
          </div>
        )}
      </div>
    </AdminShell>
  );
}
