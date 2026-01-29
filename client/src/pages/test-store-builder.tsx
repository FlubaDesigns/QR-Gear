import { useState, useEffect } from "react";
import { Link } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Store, Package, DollarSign, QrCode, Layers, Image, ChevronDown, ChevronUp, Check, Save, Loader2 } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import { AdminAuthProvider } from "@/features/shared/AdminAuthContext";
import { StoreBuilderHarness } from "@/features/storeBuilder/StoreBuilderHarness";

interface StoreData { id: string; name: string; roleType: string; }
interface ProductBlueprint { id: number; title: string; }
interface AllowedProduct { blueprintId: number; title: string; }

function StoreProductAssignment() {
  const { toast } = useToast();
  const [expanded, setExpanded] = useState(false);
  const [selectedStoreId, setSelectedStoreId] = useState<string>("");
  const [selectedProducts, setSelectedProducts] = useState<Set<number>>(new Set());
  const [hasChanges, setHasChanges] = useState(false);

  const { data: stores = [] } = useQuery<StoreData[]>({
    queryKey: ["/api/test/stores"],
    queryFn: async () => { const res = await fetch("/api/test/stores"); return res.json(); },
  });
  const memberStores = stores.filter(s => s.roleType === "member");

  const { data: blueprints = [] } = useQuery<ProductBlueprint[]>({
    queryKey: ["/api/test/printify/local-blueprints"],
    queryFn: async () => { const res = await fetch("/api/test/printify/local-blueprints"); const d = await res.json(); return d.blueprints || []; },
  });

  const { data: allowedData } = useQuery({
    queryKey: ["/api/test/stores", selectedStoreId, "allowed-products"],
    queryFn: async () => { if (!selectedStoreId) return { products: [] }; const res = await fetch(`/api/test/stores/${selectedStoreId}/allowed-products`); return res.json(); },
    enabled: !!selectedStoreId,
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
        return { blueprintId, title: bp?.title || `Product ${blueprintId}`, addedAt: new Date().toISOString() };
      });
      const res = await fetch(`/api/test/stores/${selectedStoreId}/allowed-products`, { method: "POST", body: JSON.stringify({ products }), headers: { "Content-Type": "application/json" } });
      if (!res.ok) throw new Error("Failed to save");
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Saved", description: `${selectedProducts.size} products assigned` });
      setHasChanges(false);
      queryClient.invalidateQueries({ queryKey: ["/api/test/stores", selectedStoreId, "allowed-products"] });
    },
  });

  const toggleProduct = (id: number) => {
    setSelectedProducts(prev => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next; });
    setHasChanges(true);
  };

  return (
    <div className="glass-card mt-4">
      <button onClick={() => setExpanded(!expanded)} className="w-full flex items-center justify-between text-left" data-testid="btn-toggle-assign">
        <span className="glass-title text-base flex items-center gap-2"><Package className="h-4 w-4 text-blue-400" /> Assign Products to Store</span>
        {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
      </button>
      {expanded && (
        <div className="mt-4 space-y-3">
          <Select value={selectedStoreId} onValueChange={setSelectedStoreId}>
            <SelectTrigger data-testid="select-store"><SelectValue placeholder="Select member store..." /></SelectTrigger>
            <SelectContent>{memberStores.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
          </Select>
          {selectedStoreId && (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-64 overflow-y-auto">
                {blueprints.map(bp => (
                  <label key={bp.id} className="flex items-center gap-2 p-2 rounded border cursor-pointer hover:bg-accent/10">
                    <Checkbox checked={selectedProducts.has(bp.id)} onCheckedChange={() => toggleProduct(bp.id)} />
                    <span className="text-xs truncate">{bp.title}</span>
                  </label>
                ))}
              </div>
              <div className="flex gap-2">
                <Button size="sm" onClick={() => saveMutation.mutate()} disabled={!hasChanges || saveMutation.isPending} data-testid="btn-save-products">
                  {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  Save ({selectedProducts.size})
                </Button>
                <Button size="sm" variant="outline" onClick={() => setSelectedProducts(new Set(blueprints.map(b => b.id)))} data-testid="btn-select-all">Select All</Button>
                <Button size="sm" variant="outline" onClick={() => setSelectedProducts(new Set())} data-testid="btn-clear-all">Clear</Button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

export default function TestStoreBuilderPage() {
  return (
    <AdminAuthProvider apiBase="/api/test">
      <div className="page-wrap">
        <div className="container mobile-compact mobile-compact-stack">

          <div className="glass-card">
            <h1 className="glass-title text-lg mb-4 flex items-center gap-2" data-testid="text-page-title">
              <Store className="h-5 w-5 text-blue-400" />
              Store Builder
            </h1>
            <div className="flex flex-col gap-3">
              <Link href="/test-products" className="block">
                <button className="qr-btn qr-btn--primary qr-btn--touch qr-btn--full" data-testid="link-test-products">
                  <Package className="h-5 w-5" />
                  Products
                </button>
              </Link>
              <Link href="/test-pricing" className="block">
                <button className="qr-btn qr-btn--outline qr-btn--touch qr-btn--full" data-testid="link-test-pricing">
                  <DollarSign className="h-5 w-5" />
                  Pricing
                </button>
              </Link>
              <Link href="/admin/library?tab=graphics" className="block">
                <button className="qr-btn qr-btn--outline qr-btn--touch qr-btn--full" data-testid="link-graphics-library">
                  <QrCode className="h-5 w-5" />
                  Graphics
                </button>
              </Link>
              <Link href="/admin/library?tab=templates" className="block">
                <button className="qr-btn qr-btn--outline qr-btn--touch qr-btn--full" data-testid="link-templates-library">
                  <Layers className="h-5 w-5" />
                  Templates
                </button>
              </Link>
              <Link href="/admin/library" className="block">
                <button className="qr-btn qr-btn--outline qr-btn--touch qr-btn--full" data-testid="link-full-library">
                  <Image className="h-5 w-5" />
                  Library
                </button>
              </Link>
            </div>
          </div>

          <StoreProductAssignment />
          <StoreBuilderHarness />
        </div>
      </div>
    </AdminAuthProvider>
  );
}
