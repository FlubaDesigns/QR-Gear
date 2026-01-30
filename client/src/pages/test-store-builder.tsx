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

function MemberProductLibrary() {
  const { toast } = useToast();
  const [expanded, setExpanded] = useState(false);
  const [selectedProducts, setSelectedProducts] = useState<Set<number>>(new Set());
  const [hasChanges, setHasChanges] = useState(false);

  const { data: blueprints = [] } = useQuery<ProductBlueprint[]>({
    queryKey: ["/api/test/printify/local-blueprints"],
    queryFn: async () => { const res = await fetch("/api/test/printify/local-blueprints"); const d = await res.json(); return d.blueprints || []; },
  });

  const { data: allowedData } = useQuery({
    queryKey: ["/api/members/allowed-products"],
    queryFn: async () => { const res = await fetch("/api/members/allowed-products"); return res.json(); },
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
      const res = await fetch("/api/members/allowed-products", { method: "POST", body: JSON.stringify({ products }), headers: { "Content-Type": "application/json" } });
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
    <div className="glass-card mt-4">
      <button onClick={() => setExpanded(!expanded)} className="w-full flex items-center justify-between text-left" data-testid="btn-toggle-member-library">
        <span className="glass-title text-base flex items-center gap-2"><Package className="h-4 w-4 text-green-400" /> Member Product Library</span>
        {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
      </button>
      {expanded && (
        <div className="mt-4 space-y-3">
          <p className="text-sm text-muted-foreground">Select products all members can use in their sandboxes:</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-64 overflow-y-auto">
            {blueprints.map(bp => (
              <label key={bp.id} className="flex items-center gap-2 p-2 rounded border cursor-pointer hover:bg-accent/10">
                <Checkbox checked={selectedProducts.has(bp.id)} onCheckedChange={() => toggleProduct(bp.id)} />
                <span className="text-xs truncate">{bp.title}</span>
              </label>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={() => saveMutation.mutate()} disabled={!hasChanges || saveMutation.isPending} data-testid="btn-save-member-library">
              {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Save ({selectedProducts.size})
            </Button>
            <Button size="sm" variant="outline" onClick={() => { setSelectedProducts(new Set(blueprints.map(b => b.id))); setHasChanges(true); }} data-testid="btn-select-all">Select All</Button>
            <Button size="sm" variant="outline" onClick={() => { setSelectedProducts(new Set()); setHasChanges(true); }} data-testid="btn-clear-all">Clear</Button>
          </div>
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

          <MemberProductLibrary />
          <StoreBuilderHarness />
        </div>
      </div>
    </AdminAuthProvider>
  );
}
