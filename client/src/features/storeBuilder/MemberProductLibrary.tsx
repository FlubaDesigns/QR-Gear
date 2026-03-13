import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Package, Save, Loader2 } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import AdminSectionCard from "@/components/admin/AdminSectionCard";

interface ProductBlueprint { id: number; title: string; }
interface BareProduct { blueprintId: number; title: string; addedAt: string; }

export function MemberProductLibrary() {
  const { toast } = useToast();
  const [selectedProducts, setSelectedProducts] = useState<Set<number>>(new Set());
  const [hasChanges, setHasChanges] = useState(false);

  const { data: blueprints = [] } = useQuery<ProductBlueprint[]>({
    queryKey: ["/api/printify/local-blueprints"],
    queryFn: async () => { const res = await apiRequest("GET", "/api/printify/local-blueprints"); const d = await res.json(); return d.blueprints || []; },
  });

  const { data: allowedData } = useQuery({
    queryKey: ["/api/members/allowed-products"],
    queryFn: async () => { const res = await apiRequest("GET", "/api/members/allowed-products"); return res.json(); },
  });

  useEffect(() => {
    if (allowedData?.products) {
      setSelectedProducts(new Set<number>(allowedData.products.map((p: BareProduct) => p.blueprintId)));
      setHasChanges(false);
    }
  }, [allowedData]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const products = Array.from(selectedProducts).map(blueprintId => {
        const bp = blueprints.find(b => b.id === blueprintId);
        return { blueprintId, title: bp?.title || `Product ${blueprintId}`, addedAt: new Date().toISOString() };
      });
      const res = await apiRequest("POST", "/api/members/allowed-products", { products });
      if (!res.ok) throw new Error("Failed to save");
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Saved", description: `${selectedProducts.size} products in member library` });
      setHasChanges(false);
      queryClient.invalidateQueries({ queryKey: ["/api/members/allowed-products"] });
    },
  });

  const toggleProduct = (id: number) => {
    setSelectedProducts(prev => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next; });
    setHasChanges(true);
  };

  return (
    <AdminSectionCard
      title="Member Product Library"
      icon={Package}
      description="Select products all members can use in their sandboxes"
      actions={
        <div className="flex gap-1 flex-wrap">
          <Button size="sm" onClick={() => saveMutation.mutate()} disabled={!hasChanges || saveMutation.isPending} data-testid="button-save-member-library">
            {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save ({selectedProducts.size})
          </Button>
          <Button size="sm" variant="outline" onClick={() => { setSelectedProducts(new Set(blueprints.map(b => b.id))); setHasChanges(true); }} data-testid="button-select-all">All</Button>
          <Button size="sm" variant="outline" onClick={() => { setSelectedProducts(new Set()); setHasChanges(true); }} data-testid="button-clear-all">Clear</Button>
        </div>
      }
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-72 overflow-y-auto">
        {blueprints.map(bp => (
          <label key={bp.id} className="flex items-center gap-2 p-3 rounded-lg border cursor-pointer hover-elevate min-h-[48px]" data-testid={`label-product-${bp.id}`}>
            <Checkbox checked={selectedProducts.has(bp.id)} onCheckedChange={() => toggleProduct(bp.id)} />
            <span className="text-sm truncate">{bp.title}</span>
          </label>
        ))}
      </div>
    </AdminSectionCard>
  );
}
