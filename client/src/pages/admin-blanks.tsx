import { useState, useEffect, useMemo, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  Box, Save, Loader2, Search, Filter, Flag, Globe, Layers, Check, X, Trash2,
  Plus, Pencil, BookOpen, ArrowRight, Link2, Unlink, Copy, Star, ArrowRightLeft, ArrowLeftRight
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import AdminShell from "@/components/AdminShell";
import { SharedViewer } from "@/features/shared/components/SharedViewer";
import {
  ProductSelectCardSkin,
  type ProductSelectItem,
} from "@/features/shared/components/skins/ProductSelectCardSkin";
import type { ScrollViewItem } from "@/features/shared/components/views/ScrollView";

interface CatalogProduct {
  id: number;
  title: string;
  description?: string;
  brand?: string;
  model?: string;
  imageUrl?: string;
  image_url?: string;
  thumbnailUrl?: string;
  madeInUSA?: boolean;
  blueprintId?: number;
  printProviderId?: number;
  minPrice?: string;
  maxPrice?: string;
  colorCount?: number;
  availableColors?: Array<{ name: string; hex?: string }>;
  availableSizes?: string[];
  fulfillmentProvider?: string;
}

interface CatalogCategory {
  name: string;
  items: CatalogProduct[];
  count: number;
}

interface AdminCatalog {
  id: string;
  name: string;
  description: string;
  blankIds: string[];
  blankTiers?: Record<string, string>;
  tierConfig?: Record<string, { displayName?: string; description?: string; tagline?: string }>;
  blankDescriptions?: Record<string, string>;
  createdAt: string;
  updatedAt?: string;
}

interface CatalogAssignments {
  member: string | null;
  public: string | null;
  external: string | null;
  marketplace: string | null;
  platform: string | null;
}

interface PricingSettings {
  markupPercent: number;
  markupFixed: number;
  memberProfitShare: number;
}

function catalogToSelectItem(p: CatalogProduct, pricing: PricingSettings, customDescription?: string): ProductSelectItem {
  const cost = p.minPrice ? parseFloat(p.minPrice) : null;
  const retailPrice = cost !== null
    ? Math.ceil((cost * (1 + pricing.markupPercent / 100) + pricing.markupFixed) * 100) / 100
    : null;
  const imageUrl = p.imageUrl || p.image_url || p.thumbnailUrl || null;
  return {
    id: String(p.id),
    name: p.title || "",
    price: retailPrice,
    cost: cost,
    manufacturer: p.brand || null,
    madeInUSA: p.madeInUSA ?? false,
    primaryImageUrl: imageUrl,
    description: customDescription ?? p.description ?? p.model ?? null,
    originalDescription: p.description ?? null,
    colorsAvailable: (p.availableColors || []).map(c => ({ name: c.name, hex: c.hex })),
    sizesAvailable: p.availableSizes || [],
    defaultColor: (p.availableColors || []).length > 0 ? p.availableColors![0].name : null,
  };
}

type LocationFilter = "all" | "usa" | "other";
type PageTab = "blanks" | "catalogs";
type ProviderFilter = "printify" | "printful";

interface PrintfulProduct {
  docId: string;
  id: number;
  title: string;
  brand: string | null;
  model: string | null;
  image: string | null;
  variantCount: number;
  category: string;
  description: string | null;
  type: string | null;
}

interface ProviderMapping {
  printifyBlueprintId: number;
  printfulProductId: number;
  source?: string;
}

const SECTIONS = [
  { key: "member" as const, label: "Member", desc: "What members see in their wizards" },
  { key: "public" as const, label: "Public", desc: "What the storefront shows" },
  { key: "external" as const, label: "External", desc: "For external partner sites" },
  { key: "marketplace" as const, label: "Marketplace", desc: "For selling on eBay, Etsy, Amazon" },
  { key: "platform" as const, label: "Platform", desc: "Internal platform selection" },
];

function CatalogsTab({ onOpenCatalog }: { onOpenCatalog: (catalogId: string) => void }) {
  const { toast } = useToast();
  const [editingCatalog, setEditingCatalog] = useState<AdminCatalog | null>(null);
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [editName, setEditName] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [bulkCopySource, setBulkCopySource] = useState<string | null>(null);
  const [bulkCopyTarget, setBulkCopyTarget] = useState<string>("");

  const { data: catalogsData, isLoading: loadingCatalogs } = useQuery<{ catalogs: AdminCatalog[] }>({
    queryKey: ["/api/admin/catalogs"],
  });

  const { data: assignments, isLoading: loadingAssignments } = useQuery<CatalogAssignments>({
    queryKey: ["/api/admin/catalog-assignments"],
  });

  const catalogs = catalogsData?.catalogs || [];

  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/admin/catalogs", { name: newName.trim(), description: newDesc.trim() });
      return res.json();
    },
    onSuccess: (data) => {
      toast({ title: "Catalog created", description: data.name });
      setNewName("");
      setNewDesc("");
      setShowCreate(false);
      queryClient.invalidateQueries({ queryKey: ["/api/admin/catalogs"] });
    },
    onError: (err: any) => {
      toast({ title: "Failed to create catalog", description: err.message || "Unknown error", variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, name, description }: { id: string; name: string; description: string }) => {
      const res = await apiRequest("PATCH", `/api/admin/catalogs/${id}`, { name, description });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Catalog updated" });
      setEditingCatalog(null);
      queryClient.invalidateQueries({ queryKey: ["/api/admin/catalogs"] });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("DELETE", `/api/admin/catalogs/${id}`);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Catalog deleted" });
      setConfirmDelete(null);
      queryClient.invalidateQueries({ queryKey: ["/api/admin/catalogs"] });
    },
    onError: (err: any) => toast({ title: "Cannot delete", description: err.message, variant: "destructive" }),
  });

  const assignMutation = useMutation({
    mutationFn: async (updates: Partial<CatalogAssignments>) => {
      const res = await apiRequest("PUT", "/api/admin/catalog-assignments", updates);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Section updated" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/catalog-assignments"] });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const duplicateMutation = useMutation({
    mutationFn: async (catalogId: string) => {
      const res = await apiRequest("POST", `/api/admin/catalogs/${catalogId}/duplicate`);
      return res.json();
    },
    onSuccess: (data) => {
      toast({ title: "Catalog duplicated", description: data.name });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/catalogs"] });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const { data: defaultsData } = useQuery<{ defaultCatalogId: string | null }>({
    queryKey: ["/api/admin/catalog-defaults"],
  });

  const setDefaultMutation = useMutation({
    mutationFn: async (catalogId: string | null) => {
      const res = await apiRequest("PUT", "/api/admin/catalog-defaults", { defaultCatalogId: catalogId });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Default catalog updated" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/catalog-defaults"] });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const bulkCopyMutation = useMutation({
    mutationFn: async ({ sourceId, targetId }: { sourceId: string; targetId: string }) => {
      const source = catalogs.find(c => c.id === sourceId);
      const blankIds = source?.blankIds || [];
      const res = await apiRequest("POST", `/api/admin/catalogs/${sourceId}/bulk-copy`, { targetCatalogId: targetId, blankIds });
      return res.json();
    },
    onSuccess: (data) => {
      toast({ title: "Blanks copied", description: `${data.added} new blanks added, ${data.total} total` });
      setBulkCopySource(null);
      setBulkCopyTarget("");
      queryClient.invalidateQueries({ queryKey: ["/api/admin/catalogs"] });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const defaultCatalogId = defaultsData?.defaultCatalogId || null;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2 text-xl">
            <BookOpen className="h-6 w-6" />
            Catalogs
          </CardTitle>
          <Button onClick={() => setShowCreate(true)} disabled={showCreate} data-testid="button-create-catalog">
            <Plus className="h-5 w-5" /> New Catalog
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {showCreate && (
            <div className="p-4 border rounded-md space-y-3 bg-muted/50">
              <Input
                placeholder="Catalog name..."
                value={newName}
                onChange={e => setNewName(e.target.value)}
                className="text-base h-12"
                data-testid="input-catalog-name"
                onKeyDown={e => { if (e.key === "Enter" && newName.trim()) createMutation.mutate(); }}
              />
              <Input
                placeholder="Description (optional)..."
                value={newDesc}
                onChange={e => setNewDesc(e.target.value)}
                className="text-base h-12"
                data-testid="input-catalog-desc"
              />
              <div className="flex gap-3">
                <Button onClick={() => createMutation.mutate()} disabled={!newName.trim() || createMutation.isPending} data-testid="button-save-catalog">
                  {createMutation.isPending ? <Loader2 className="h-5 w-5 animate-spin" /> : <Save className="h-5 w-5" />}
                  Create
                </Button>
                <Button variant="outline" onClick={() => { setShowCreate(false); setNewName(""); setNewDesc(""); }} data-testid="button-cancel-catalog">
                  Cancel
                </Button>
              </div>
            </div>
          )}

          {loadingCatalogs ? (
            <div className="space-y-3">
              {[1, 2].map(i => <Skeleton key={i} className="h-24 w-full" />)}
            </div>
          ) : catalogs.length === 0 ? (
            <div className="text-center py-12">
              <BookOpen className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-50" />
              <p className="text-lg text-muted-foreground">No catalogs yet. Create one to curate blanks.</p>
            </div>
          ) : (
            catalogs.map(cat => {
              const isEditing = editingCatalog?.id === cat.id;
              const assignedSections = SECTIONS.filter(s => assignments?.[s.key] === cat.id);

              return (
                <div key={cat.id} className="p-4 border rounded-md space-y-3" data-testid={`catalog-${cat.id}`}>
                  {isEditing ? (
                    <div className="space-y-3">
                      <Input value={editName} onChange={e => setEditName(e.target.value)} className="text-base h-12" data-testid="input-edit-name" />
                      <Input value={editDesc} onChange={e => setEditDesc(e.target.value)} placeholder="Description..." className="text-base h-12" data-testid="input-edit-desc" />
                      <div className="flex gap-3">
                        <Button onClick={() => updateMutation.mutate({ id: cat.id, name: editName, description: editDesc })} disabled={updateMutation.isPending} data-testid="button-save-edit">
                          {updateMutation.isPending ? <Loader2 className="h-5 w-5 animate-spin" /> : <Save className="h-5 w-5" />} Save
                        </Button>
                        <Button variant="outline" onClick={() => setEditingCatalog(null)} data-testid="button-cancel-edit">Cancel</Button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="flex items-start justify-between gap-3 flex-wrap">
                        <div className="space-y-2">
                          <div className="flex items-center gap-2 flex-wrap">
                            <Button
                              size="lg"
                              onClick={() => onOpenCatalog(cat.id)}
                              data-testid={`open-catalog-${cat.id}`}
                            >
                              <Layers className="h-5 w-5" /> {cat.name}
                            </Button>
                            {defaultCatalogId === cat.id && (
                              <Badge variant="default" className="text-sm"><Star className="h-3 w-3" /> Default</Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <Badge variant="secondary" className="text-sm">{cat.blankIds?.length || 0} blanks</Badge>
                            {cat.blankTiers && (() => {
                              const counts = { good: 0, better: 0, best: 0 };
                              Object.values(cat.blankTiers).forEach(t => { if (t in counts) counts[t as keyof typeof counts]++; });
                              const total = counts.good + counts.better + counts.best;
                              if (total === 0) return null;
                              return (
                                <>
                                  {counts.good > 0 && <Badge className="text-xs bg-blue-600 text-white">{counts.good} Good</Badge>}
                                  {counts.better > 0 && <Badge className="text-xs bg-amber-500 text-white">{counts.better} Better</Badge>}
                                  {counts.best > 0 && <Badge className="text-xs bg-emerald-600 text-white">{counts.best} Best</Badge>}
                                </>
                              );
                            })()}
                            {assignedSections.map(s => (
                              <Badge key={s.key} variant="default" className="text-sm">
                                <Link2 className="h-3 w-3" /> {s.label}
                              </Badge>
                            ))}
                          </div>
                          {cat.description && <p className="text-base text-muted-foreground">{cat.description}</p>}
                        </div>
                        <div className="flex items-center gap-2 flex-wrap">
                          {defaultCatalogId !== cat.id ? (
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => setDefaultMutation.mutate(cat.id)}
                              title="Set as default"
                              data-testid={`default-catalog-${cat.id}`}
                            >
                              <Star className="h-5 w-5" />
                            </Button>
                          ) : (
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => setDefaultMutation.mutate(null)}
                              title="Remove as default"
                              data-testid={`undefault-catalog-${cat.id}`}
                            >
                              <Star className="h-5 w-5 fill-current" />
                            </Button>
                          )}
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => duplicateMutation.mutate(cat.id)}
                            disabled={duplicateMutation.isPending}
                            title="Duplicate catalog"
                            data-testid={`duplicate-catalog-${cat.id}`}
                          >
                            <Copy className="h-5 w-5" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => setBulkCopySource(bulkCopySource === cat.id ? null : cat.id)}
                            title="Copy blanks to another catalog"
                            data-testid={`bulk-copy-catalog-${cat.id}`}
                          >
                            <ArrowRightLeft className="h-5 w-5" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => { setEditingCatalog(cat); setEditName(cat.name); setEditDesc(cat.description); }}
                            data-testid={`edit-catalog-${cat.id}`}
                          >
                            <Pencil className="h-5 w-5" />
                          </Button>
                          {confirmDelete === cat.id ? (
                            <div className="flex items-center gap-2">
                              <Button variant="destructive" onClick={() => deleteMutation.mutate(cat.id)} disabled={deleteMutation.isPending} data-testid={`confirm-delete-catalog-${cat.id}`}>
                                {deleteMutation.isPending ? <Loader2 className="h-5 w-5 animate-spin" /> : "Yes, Delete"}
                              </Button>
                              <Button variant="ghost" onClick={() => setConfirmDelete(null)} data-testid={`cancel-delete-catalog-${cat.id}`}>No</Button>
                            </div>
                          ) : (
                            <Button size="icon" variant="ghost" onClick={() => setConfirmDelete(cat.id)} data-testid={`delete-catalog-${cat.id}`}>
                              <Trash2 className="h-5 w-5" />
                            </Button>
                          )}
                        </div>
                      </div>
                      {bulkCopySource === cat.id && (
                        <div className="p-3 border rounded-md bg-muted/50 space-y-2">
                          <p className="text-base font-medium">Copy all blanks from "{cat.name}" to:</p>
                          <div className="flex items-center gap-3 flex-wrap">
                            <select
                              value={bulkCopyTarget}
                              onChange={e => setBulkCopyTarget(e.target.value)}
                              className="text-base bg-background border rounded-md px-3 py-2"
                              data-testid={`select-bulk-target-${cat.id}`}
                            >
                              <option value="">Select target catalog...</option>
                              {catalogs.filter(c => c.id !== cat.id).map(c => (
                                <option key={c.id} value={c.id}>{c.name} ({c.blankIds?.length || 0} blanks)</option>
                              ))}
                            </select>
                            <Button
                              onClick={() => bulkCopyTarget && bulkCopyMutation.mutate({ sourceId: cat.id, targetId: bulkCopyTarget })}
                              disabled={!bulkCopyTarget || bulkCopyMutation.isPending}
                              data-testid={`button-bulk-copy-${cat.id}`}
                            >
                              {bulkCopyMutation.isPending ? <Loader2 className="h-5 w-5 animate-spin" /> : <Copy className="h-5 w-5" />}
                              Copy
                            </Button>
                            <Button variant="outline" onClick={() => { setBulkCopySource(null); setBulkCopyTarget(""); }}>Cancel</Button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-xl">
            <ArrowRight className="h-6 w-6" />
            Section Assignments
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {loadingAssignments ? (
            <Skeleton className="h-40 w-full" />
          ) : (
            SECTIONS.map(section => {
              const currentId = assignments?.[section.key] || "";
              return (
                <div key={section.key} className="p-4 border rounded-md space-y-2" data-testid={`assignment-${section.key}`}>
                  <p className="text-lg font-medium">{section.label}</p>
                  <p className="text-base text-muted-foreground">{section.desc}</p>
                  <div className="flex items-center gap-3 flex-wrap">
                    <select
                      value={currentId}
                      onChange={e => {
                        const val = e.target.value || null;
                        assignMutation.mutate({ [section.key]: val });
                      }}
                      className="text-base bg-background border rounded-md px-3 py-2 min-w-[200px]"
                      data-testid={`select-assignment-${section.key}`}
                    >
                      <option value="">None</option>
                      {catalogs.map(cat => (
                        <option key={cat.id} value={cat.id}>{cat.name} ({cat.blankIds?.length || 0})</option>
                      ))}
                    </select>
                    {currentId && (
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => assignMutation.mutate({ [section.key]: null })}
                        data-testid={`unassign-${section.key}`}
                      >
                        <Unlink className="h-5 w-5" />
                      </Button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function AdminBlanks() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<PageTab>("blanks");
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [locationFilter, setLocationFilter] = useState<LocationFilter>("all");
  const [selectedCatalogId, setSelectedCatalogId] = useState<string | null>(null);
  const [defaultLoaded, setDefaultLoaded] = useState(false);
  const [providerFilter, setProviderFilter] = useState<ProviderFilter>("printify");

  const { data: categories = [], isLoading: loadingPrintifyCatalog } = useQuery<CatalogCategory[]>({
    queryKey: ["/api/printify/catalog", "blanks"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/printify/catalog");
      const d = await res.json();
      return Array.isArray(d) ? d : [];
    },
  });

  const { data: printfulProducts = [], isLoading: loadingPrintfulCatalog } = useQuery<PrintfulProduct[]>({
    queryKey: ["/api/admin/catalog/printful"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/admin/catalog/printful");
      const d = await res.json();
      return Array.isArray(d) ? d : [];
    },
  });

  const { data: mappingsData } = useQuery<{ firestoreMappings: ProviderMapping[]; hardcodedMappings: ProviderMapping[] }>({
    queryKey: ["/api/admin/catalog/printful-mappings"],
  });

  const mappedPrintifyIds = useMemo(() => {
    const set = new Set<number>();
    if (mappingsData) {
      mappingsData.firestoreMappings.forEach(m => set.add(m.printifyBlueprintId));
      mappingsData.hardcodedMappings.forEach(m => set.add(m.printifyBlueprintId));
    }
    return set;
  }, [mappingsData]);

  const mappedPrintfulIds = useMemo(() => {
    const set = new Set<number>();
    if (mappingsData) {
      mappingsData.firestoreMappings.forEach(m => set.add(m.printfulProductId));
      mappingsData.hardcodedMappings.forEach(m => set.add(m.printfulProductId));
    }
    return set;
  }, [mappingsData]);

  const loadingCatalog = providerFilter === "printify" ? loadingPrintifyCatalog : loadingPrintfulCatalog;

  const { data: catalogsData } = useQuery<{ catalogs: AdminCatalog[] }>({
    queryKey: ["/api/admin/catalogs"],
  });

  const { data: defaultsData } = useQuery<{ defaultCatalogId: string | null }>({
    queryKey: ["/api/admin/catalog-defaults"],
  });

  const { data: pricingData } = useQuery<PricingSettings>({
    queryKey: ["/api/admin/pricing-settings"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/admin/pricing-settings");
      const d = await res.json();
      return {
        markupPercent: d.markupPercent ?? d.globalMarkupPercent ?? 25,
        markupFixed: d.markupFixed ?? d.globalMarkupFixed ?? 0,
        memberProfitShare: d.memberProfitShare ?? 0.25,
      };
    },
  });
  const pricing: PricingSettings = pricingData || { markupPercent: 25, markupFixed: 0, memberProfitShare: 0.25 };

  const catalogs = catalogsData?.catalogs || [];
  const activeCatalog = selectedCatalogId ? catalogs.find(c => c.id === selectedCatalogId) : null;
  const validSelectedCatalogId = activeCatalog ? selectedCatalogId : null;
  const catalogBlankSet = useMemo(() => new Set(activeCatalog?.blankIds?.map(String) || []), [activeCatalog]);

  const printifyProducts = useMemo(() => {
    const items: CatalogProduct[] = [];
    const seen = new Set<number>();
    for (const cat of categories) {
      for (const item of (cat.items || [])) {
        if (!seen.has(item.id)) {
          seen.add(item.id);
          items.push({ ...item, fulfillmentProvider: 'printify' });
        }
      }
    }
    return items;
  }, [categories]);

  const printfulAsCatalogProducts = useMemo(() => {
    return printfulProducts.map((p): CatalogProduct => ({
      id: p.id,
      title: p.title,
      description: p.description || undefined,
      brand: p.brand || undefined,
      model: p.model || undefined,
      imageUrl: p.image || undefined,
      minPrice: (p as any).minPrice || undefined,
      maxPrice: (p as any).maxPrice || undefined,
      fulfillmentProvider: 'printful',
    }));
  }, [printfulProducts]);

  const allProducts = useMemo(() => {
    return providerFilter === "printful" ? printfulAsCatalogProducts : printifyProducts;
  }, [providerFilter, printifyProducts, printfulAsCatalogProducts]);

  const productMap = useMemo(() => {
    const map = new Map<string, CatalogProduct>();
    allProducts.forEach(p => map.set(String(p.id), p));
    return map;
  }, [allProducts]);

  const printfulCategories = useMemo(() => {
    const catMap = new Map<string, CatalogProduct[]>();
    printfulAsCatalogProducts.forEach(p => {
      const pf = printfulProducts.find(pp => pp.id === p.id);
      const cat = pf?.category || 'Other';
      if (!catMap.has(cat)) catMap.set(cat, []);
      catMap.get(cat)!.push(p);
    });
    return Array.from(catMap.entries()).map(([name, items]) => ({ name, items, count: items.length }));
  }, [printfulAsCatalogProducts, printfulProducts]);

  const activeCategories = providerFilter === "printful" ? printfulCategories : categories;

  const categoryNames = useMemo(() => {
    return ["all", ...activeCategories.map(c => c.name)];
  }, [activeCategories]);

  useEffect(() => {
    if (!defaultLoaded && defaultsData?.defaultCatalogId && catalogs.length > 0) {
      const exists = catalogs.find(c => c.id === defaultsData.defaultCatalogId);
      if (exists) {
        setSelectedCatalogId(defaultsData.defaultCatalogId);
      }
      setDefaultLoaded(true);
    }
  }, [defaultsData, catalogs, defaultLoaded]);

  const addBlanksMutation = useMutation({
    mutationFn: async ({ catalogId, blankIds }: { catalogId: string; blankIds: string[] }) => {
      const res = await apiRequest("POST", `/api/admin/catalogs/${catalogId}/blanks`, { blankIds });
      return res.json();
    },
    onSuccess: (data) => {
      toast({ title: "Added to catalog", description: `${data.count} total blanks` });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/catalogs"] });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const removeBlanksMutation = useMutation({
    mutationFn: async ({ catalogId, blankIds }: { catalogId: string; blankIds: string[] }) => {
      const res = await apiRequest("DELETE", `/api/admin/catalogs/${catalogId}/blanks`, { blankIds });
      return res.json();
    },
    onSuccess: (data) => {
      toast({ title: "Removed from catalog", description: `${data.count} remaining` });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/catalogs"] });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const setBlankTierMutation = useMutation({
    mutationFn: async ({ catalogId, blankId, tier }: { catalogId: string; blankId: string; tier: string | null }) => {
      const res = await apiRequest("PUT", `/api/admin/catalogs/${catalogId}/blank-tier`, { blankId, tier });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/catalogs"] });
    },
    onError: (err: any) => toast({ title: "Error setting tier", description: err.message, variant: "destructive" }),
  });

  const saveDescriptionMutation = useMutation({
    mutationFn: async ({ catalogId, blankId, description }: { catalogId: string; blankId: string; description: string }) => {
      const res = await apiRequest("PUT", `/api/admin/catalogs/${catalogId}/blank-description`, { blankId, description });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Description saved" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/catalogs"] });
    },
    onError: (err: any) => toast({ title: "Error saving description", description: err.message, variant: "destructive" }),
  });

  const getBlankKey = useCallback((id: string) => {
    return providerFilter === "printful" ? `pf:${id}` : id;
  }, [providerFilter]);

  const handleDescriptionSave = useCallback(async (id: string, description: string) => {
    if (!validSelectedCatalogId) {
      toast({ title: "Select a catalog first", variant: "destructive" });
      return;
    }
    const blankKey = getBlankKey(id);
    await saveDescriptionMutation.mutateAsync({ catalogId: validSelectedCatalogId, blankId: blankKey, description });
  }, [validSelectedCatalogId, getBlankKey, saveDescriptionMutation, toast]);

  const isInCatalog = useCallback((id: string) => {
    const key = getBlankKey(id);
    return catalogBlankSet.has(key);
  }, [getBlankKey, catalogBlankSet]);

  const toggleItem = useCallback((id: string) => {
    if (!validSelectedCatalogId) {
      toast({ title: "Select a catalog first", description: "Choose a catalog from the dropdown to add or remove blanks.", variant: "destructive" });
      return;
    }
    const key = getBlankKey(id);
    if (catalogBlankSet.has(key)) {
      removeBlanksMutation.mutate({ catalogId: validSelectedCatalogId, blankIds: [key] });
    } else {
      addBlanksMutation.mutate({ catalogId: validSelectedCatalogId, blankIds: [key] });
    }
  }, [validSelectedCatalogId, catalogBlankSet, addBlanksMutation, removeBlanksMutation, toast, getBlankKey]);

  const filtered = useMemo(() => {
    let items = allProducts;
    if (categoryFilter !== "all") {
      const cat = activeCategories.find(c => c.name === categoryFilter);
      if (cat) {
        const catIds = new Set(cat.items.map(i => i.id));
        items = items.filter(p => catIds.has(p.id));
      }
    }
    if (locationFilter === "usa") items = items.filter(p => p.madeInUSA);
    if (locationFilter === "other") items = items.filter(p => !p.madeInUSA);
    if (search) {
      const q = search.toLowerCase();
      items = items.filter(p =>
        (p.title || "").toLowerCase().includes(q) ||
        (p.brand || "").toLowerCase().includes(q) ||
        (p.description || "").toLowerCase().includes(q)
      );
    }
    return items;
  }, [allProducts, categories, categoryFilter, locationFilter, search]);

  const blankDescriptions = activeCatalog?.blankDescriptions || {};

  const selectItemMap = useMemo(() => {
    const map = new Map<string, ProductSelectItem>();
    filtered.forEach(p => {
      const blankKey = p.fulfillmentProvider === 'printful' ? `pf:${p.id}` : String(p.id);
      const customDesc = blankDescriptions[blankKey];
      map.set(String(p.id), catalogToSelectItem(p, pricing, customDesc));
    });
    return map;
  }, [filtered, pricing, blankDescriptions]);

  const scrollItems: ScrollViewItem[] = useMemo(() =>
    filtered.map(p => ({
      id: String(p.id),
      imageUrl: p.imageUrl || p.image_url || p.thumbnailUrl || "",
      title: p.title || "",
      subtitle: p.brand,
      minPrice: p.minPrice,
      maxPrice: p.maxPrice,
      colorCount: p.colorCount,
      madeInUSA: p.madeInUSA,
    })),
    [filtered]
  );

  const blankTiers = activeCatalog?.blankTiers || {};

  const handleTierChange = useCallback((blankId: string, tier: string | null) => {
    if (!validSelectedCatalogId) return;
    setBlankTierMutation.mutate({ catalogId: validSelectedCatalogId, blankId, tier });
  }, [validSelectedCatalogId, setBlankTierMutation]);

  const renderCatalogCard = useCallback(
    (scrollItem: ScrollViewItem, _isSelected: boolean, _onSelect: () => void) => {
      const selectItem = selectItemMap.get(String(scrollItem.id));
      if (!selectItem) return null;
      const selected = isInCatalog(String(scrollItem.id));
      const blankKey = getBlankKey(String(scrollItem.id));
      const itemTier = blankTiers[blankKey] as "good" | "better" | "best" | undefined;
      const hasMappingBadge = providerFilter === "printify"
        ? mappedPrintifyIds.has(Number(scrollItem.id))
        : mappedPrintfulIds.has(Number(scrollItem.id));
      return (
        <div className="relative">
          <ProductSelectCardSkin
            item={selectItem}
            isSelected={selected}
            onSelect={(id) => toggleItem(id)}
            tier={itemTier || null}
            onTierChange={(blankId, tier) => handleTierChange(getBlankKey(blankId), tier)}
            showTierControls={!!validSelectedCatalogId}
            editableDescription={!!validSelectedCatalogId}
            onDescriptionSave={handleDescriptionSave}
            descriptionSaving={saveDescriptionMutation.isPending}
          />
          {hasMappingBadge && (
            <div className="absolute top-2 right-2 z-10">
              <Badge className="bg-violet-600 text-white text-[10px] px-1.5 py-0.5 gap-0.5">
                <ArrowLeftRight className="h-3 w-3" />
                M
              </Badge>
            </div>
          )}
        </div>
      );
    },
    [selectItemMap, toggleItem, isInCatalog, blankTiers, handleTierChange, validSelectedCatalogId, providerFilter, mappedPrintifyIds, mappedPrintfulIds, getBlankKey, handleDescriptionSave, saveDescriptionMutation.isPending]
  );

  const allProductMap = useMemo(() => {
    const map = new Map<string, CatalogProduct>();
    printifyProducts.forEach(p => map.set(String(p.id), p));
    printfulAsCatalogProducts.forEach(p => map.set(`pf:${p.id}`, p));
    return map;
  }, [printifyProducts, printfulAsCatalogProducts]);

  const catalogProductsWithKeys = useMemo(() => {
    return Array.from(catalogBlankSet)
      .map(id => {
        const product = allProductMap.get(id);
        return product ? { product, catalogKey: id, isPrintful: id.startsWith('pf:') } : null;
      })
      .filter(Boolean) as { product: CatalogProduct; catalogKey: string; isPrintful: boolean }[];
  }, [catalogBlankSet, allProductMap]);

  const catalogProducts = useMemo(() => catalogProductsWithKeys.map(c => c.product), [catalogProductsWithKeys]);

  const handleOpenCatalog = useCallback((catalogId: string) => {
    setSelectedCatalogId(catalogId);
    setActiveTab("blanks");
  }, []);

  return (
    <AdminShell title="Blanks" subtitle="Manage base products and catalogs" icon={Box}>
      <div className="space-y-5">
        <div className="flex gap-3">
          <Button
            variant={activeTab === "blanks" ? "default" : "outline"}
            onClick={() => setActiveTab("blanks")}
            data-testid="tab-blanks"
          >
            <Box className="h-5 w-5" /> Blanks
          </Button>
          <Button
            variant={activeTab === "catalogs" ? "default" : "outline"}
            onClick={() => setActiveTab("catalogs")}
            data-testid="tab-catalogs"
          >
            <BookOpen className="h-5 w-5" /> Catalogs
          </Button>
        </div>

        {activeTab === "catalogs" ? (
          <CatalogsTab onOpenCatalog={handleOpenCatalog} />
        ) : (
          <>
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-muted-foreground">Provider:</span>
              <Button
                variant={providerFilter === "printify" ? "default" : "outline"}
                size="sm"
                onClick={() => { setProviderFilter("printify"); setCategoryFilter("all"); setSearch(""); }}
                data-testid="provider-printify"
              >
                Printify
              </Button>
              <Button
                variant={providerFilter === "printful" ? "default" : "outline"}
                size="sm"
                onClick={() => { setProviderFilter("printful"); setCategoryFilter("all"); setSearch(""); }}
                data-testid="provider-printful"
              >
                Printful
              </Button>
              {providerFilter === "printful" && (
                <Badge variant="secondary" className="text-xs">
                  {printfulProducts.length} products synced
                </Badge>
              )}
            </div>

            {catalogs.length > 0 && (
              <div className="space-y-2">
                <p className="text-base font-medium text-muted-foreground">
                  {validSelectedCatalogId ? "Switch catalog:" : "Select a catalog to edit:"}
                </p>
                <select
                  value={selectedCatalogId || ""}
                  onChange={e => setSelectedCatalogId(e.target.value || null)}
                  className="text-base bg-background border rounded-md px-3 py-2.5 w-full"
                  data-testid="select-catalog-dropdown"
                >
                  <option value="">Browse all blanks (no catalog selected)</option>
                  {catalogs.map(cat => (
                    <option key={cat.id} value={cat.id}>{cat.name} ({cat.blankIds?.length || 0} blanks)</option>
                  ))}
                </select>
              </div>
            )}

            {validSelectedCatalogId && activeCatalog ? (
              <>
                <Card className="border-primary/30 bg-primary/5">
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-center justify-between gap-3 flex-wrap">
                      <div className="flex items-center gap-3">
                        <Layers className="h-6 w-6 text-primary" />
                        <span className="text-lg font-semibold">{activeCatalog.name}</span>
                        <Badge variant="secondary" className="text-sm">{activeCatalog.blankIds?.length || 0} blanks</Badge>
                      </div>
                      <Button
                        variant="outline"
                        onClick={() => setSelectedCatalogId(null)}
                        data-testid="button-clear-catalog"
                      >
                        <X className="h-5 w-5" /> Done
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                {catalogProductsWithKeys.length > 0 && (
                  <div className="flex-1 overflow-hidden">
                    <ScrollArea className="w-full h-full">
                      <div className="space-y-3 pr-4">
                        {catalogProductsWithKeys.map(({ product: p, catalogKey, isPrintful }) => {
                          const selectItem = selectItemMap.get(String(p.id));
                          if (!selectItem) return null;
                          return (
                            <div key={catalogKey} className="relative">
                              <ProductSelectCardSkin
                                item={selectItem}
                                isSelected={false}
                                onSelect={(id) => toggleItem(id)}
                                tier={blankTiers[catalogKey] as "good" | "better" | "best" | undefined || null}
                                onTierChange={(blankId, tier) => handleTierChange(getBlankKey(blankId), tier)}
                                showTierControls={!!validSelectedCatalogId}
                                editableDescription={!!validSelectedCatalogId}
                                onDescriptionSave={handleDescriptionSave}
                                descriptionSaving={saveDescriptionMutation.isPending}
                              />
                              {isPrintful && (
                                <div className="absolute top-2 right-2 z-10">
                                  <Badge className="bg-indigo-600 text-white text-[9px] px-1 py-0">PF</Badge>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                      <ScrollBar />
                    </ScrollArea>
                  </div>
                )}
              </>
            ) : (
              <>
                <div className="space-y-3">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                    <Input
                      placeholder="Search by name, brand, or description..."
                      value={search}
                      onChange={e => setSearch(e.target.value)}
                      className="pl-10 text-base h-12"
                      data-testid="input-search-blanks"
                    />
                  </div>

                  <div className="flex flex-wrap items-center gap-3">
                    <Filter className="h-5 w-5 text-muted-foreground shrink-0" />
                    <select
                      value={categoryFilter}
                      onChange={e => setCategoryFilter(e.target.value)}
                      className="text-base bg-background border rounded-md px-3 py-2"
                      data-testid="select-category-filter"
                    >
                      {categoryNames.map(name => (
                        <option key={name} value={name}>
                          {name === "all" ? `All Categories (${allProducts.length})` : `${name} (${activeCategories.find(c => c.name === name)?.count || 0})`}
                        </option>
                      ))}
                    </select>

                    {([
                      { value: "all" as LocationFilter, label: "All Locations", icon: null },
                      { value: "usa" as LocationFilter, label: "USA Made", icon: Flag },
                      { value: "other" as LocationFilter, label: "Global", icon: Globe },
                    ]).map(f => (
                      <Badge
                        key={f.value}
                        variant={locationFilter === f.value ? "default" : "outline"}
                        className="cursor-pointer text-sm py-1.5 px-3"
                        onClick={() => setLocationFilter(f.value)}
                        data-testid={`filter-location-${f.value}`}
                      >
                        {f.icon && <f.icon className="w-4 h-4" />}
                        {f.label}
                      </Badge>
                    ))}
                  </div>

                  <div className="flex items-center gap-3 flex-wrap">
                    <Badge variant="secondary" className="text-sm py-1 px-3">{filtered.length} blanks shown</Badge>
                    {!validSelectedCatalogId && (
                      <p className="text-sm text-muted-foreground">Select a catalog above to start adding blanks</p>
                    )}
                  </div>
                </div>

                {loadingCatalog ? (
                  <div className="space-y-4">
                    {Array.from({ length: 4 }).map((_, i) => (
                      <Skeleton key={i} className="h-28 w-full rounded-md" />
                    ))}
                  </div>
                ) : filtered.length === 0 ? (
                  <Card className="p-8 text-center">
                    <p className="text-lg text-muted-foreground">
                      {allProducts.length === 0
                        ? (providerFilter === "printful"
                          ? "No Printful products synced yet. Run a Printful catalog sync first."
                          : "No products in catalog yet. Sync your Printify catalog first from the Products page.")
                        : "No products match your search or filters."}
                    </p>
                  </Card>
                ) : (
                  <SharedViewer
                    mode="scroll"
                    scrollProps={{
                      items: scrollItems,
                      selectedId: null,
                      emptyMessage: "No products match the current filters.",
                      layout: "vertical",
                      gridHeight: "calc(100vh - 200px)",
                      renderItem: renderCatalogCard,
                    }}
                  />
                )}
              </>
            )}
          </>
        )}
      </div>
    </AdminShell>
  );
}
