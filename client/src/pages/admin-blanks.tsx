import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Box, Save, Loader2, Check, Search, Filter } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import AdminShell from "@/components/AdminShell";

interface CatalogItem {
  id: string;
  title: string;
  provider: "printify" | "printful";
}

interface AllowedProduct {
  blueprintId: number;
  title: string;
  addedAt: string;
  provider?: string;
}

export default function AdminBlanks() {
  const { toast } = useToast();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [hasChanges, setHasChanges] = useState(false);
  const [search, setSearch] = useState("");
  const [providerFilter, setProviderFilter] = useState<"all" | "printify" | "printful">("all");

  const { data: printifyItems = [], isLoading: loadingPrintify } = useQuery<CatalogItem[]>({
    queryKey: ["/api/printify/local-blueprints", "blanks"],
    queryFn: async () => {
      const res = await fetch("/api/printify/local-blueprints");
      const d = await res.json();
      const bps = d.blueprints || d || [];
      return (Array.isArray(bps) ? bps : []).map((bp: any) => ({
        id: String(bp.id),
        title: bp.title || `Printify #${bp.id}`,
        provider: "printify" as const,
      }));
    },
  });

  const { data: printfulItems = [], isLoading: loadingPrintful } = useQuery<CatalogItem[]>({
    queryKey: ["/api/admin/catalog/printful-products", "blanks"],
    queryFn: async () => {
      try {
        const res = await fetch("/api/admin/catalog/printful-products");
        if (!res.ok) return [];
        const d = await res.json();
        const items = d.products || d || [];
        return (Array.isArray(items) ? items : []).map((p: any) => ({
          id: `pf_${p.id || p.product_id}`,
          title: p.title || p.name || `Printful #${p.id}`,
          provider: "printful" as const,
        }));
      } catch { return []; }
    },
  });

  const allItems: CatalogItem[] = [...printifyItems, ...printfulItems];

  const { data: allowedData, isLoading: loadingAllowed } = useQuery({
    queryKey: ["/api/members/allowed-products"],
    queryFn: async () => {
      const res = await fetch("/api/members/allowed-products");
      return res.json();
    },
  });

  useEffect(() => {
    if (allowedData?.products) {
      const ids = new Set<string>(
        allowedData.products.map((p: AllowedProduct) => String(p.blueprintId))
      );
      setSelectedIds(ids);
      setHasChanges(false);
    }
  }, [allowedData]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const products = Array.from(selectedIds).map(id => {
        const item = allItems.find(i => i.id === id);
        return {
          blueprintId: isNaN(Number(id)) ? id : Number(id),
          title: item?.title || `Product ${id}`,
          provider: item?.provider || "printify",
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
      toast({ title: "Blanks saved", description: `${selectedIds.size} products available for members` });
      setHasChanges(false);
      queryClient.invalidateQueries({ queryKey: ["/api/members/allowed-products"] });
    },
    onError: (err: any) => {
      toast({ title: "Save failed", description: err.message, variant: "destructive" });
    },
  });

  const toggleItem = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
    setHasChanges(true);
  };

  const filtered = allItems.filter(item => {
    if (providerFilter !== "all" && item.provider !== providerFilter) return false;
    if (search && !item.title.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const selectAllFiltered = () => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      filtered.forEach(item => next.add(item.id));
      return next;
    });
    setHasChanges(true);
  };

  const clearAll = () => {
    setSelectedIds(new Set());
    setHasChanges(true);
  };

  const isLoading = loadingPrintify || loadingPrintful || loadingAllowed;
  const printifyCount = printifyItems.length;
  const printfulCount = printfulItems.length;

  return (
    <AdminShell title="Blanks" subtitle="Set up base products for members to customize" icon={Box}>
      <div className="space-y-4">
        <Card className="p-4">
          <p className="text-sm text-muted-foreground">
            Choose which blank products members can use in their sandbox. Members will be able to add their own QR codes, graphics, and text to these items.
          </p>
          <div className="flex flex-wrap gap-2 mt-3">
            <Badge variant="secondary">Printify: {printifyCount}</Badge>
            <Badge variant="secondary">Printful: {printfulCount}</Badge>
            <Badge variant="secondary">Total: {allItems.length}</Badge>
          </div>
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
          <div className="flex items-center gap-1">
            <Filter className="h-4 w-4 text-muted-foreground" />
            {(["all", "printify", "printful"] as const).map(f => (
              <Button
                key={f}
                size="sm"
                variant={providerFilter === f ? "default" : "outline"}
                onClick={() => setProviderFilter(f)}
                className="toggle-elevate"
                data-testid={`button-filter-${f}`}
              >
                {f === "all" ? "All" : f.charAt(0).toUpperCase() + f.slice(1)}
              </Button>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary">{selectedIds.size} selected</Badge>
          <Button size="sm" variant="outline" onClick={selectAllFiltered} data-testid="button-select-all-blanks">
            Select All Shown
          </Button>
          <Button size="sm" variant="outline" onClick={clearAll} data-testid="button-clear-all-blanks">
            Clear All
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
        ) : filtered.length === 0 ? (
          <Card className="p-8 text-center">
            <p className="text-muted-foreground">
              {allItems.length === 0
                ? "No products in catalog yet. Sync your Printify or Printful catalog first from the Products page."
                : "No products match your search or filter."}
            </p>
          </Card>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {filtered.map(item => {
              const isSelected = selectedIds.has(item.id);
              return (
                <label
                  key={item.id}
                  className={`flex items-center gap-3 p-3 rounded-md border cursor-pointer transition-colors ${
                    isSelected ? "border-primary bg-primary/5" : "border-border"
                  } hover-elevate`}
                  data-testid={`card-blank-${item.id}`}
                >
                  <Checkbox
                    checked={isSelected}
                    onCheckedChange={() => toggleItem(item.id)}
                    data-testid={`checkbox-blank-${item.id}`}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{item.title}</div>
                    <Badge variant="outline" className="mt-1 text-[10px]">
                      {item.provider === "printify" ? "Printify" : "Printful"}
                    </Badge>
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
