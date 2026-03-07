import { useState, useEffect, useMemo, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  Box, Save, Loader2, Search, Filter, Flag, Globe, Layers, Check, X, Trash2,
  Plus, Pencil, BookOpen, ArrowRight, Link2, Unlink
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
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
  createdAt: string;
  updatedAt?: string;
}

interface CatalogAssignments {
  member: string | null;
  public: string | null;
  external: string | null;
  platform: string | null;
}

function catalogToSelectItem(p: CatalogProduct): ProductSelectItem {
  const minPrice = p.minPrice ? parseFloat(p.minPrice) : null;
  const imageUrl = p.imageUrl || p.image_url || p.thumbnailUrl || null;
  return {
    id: String(p.id),
    name: p.title || "",
    price: minPrice,
    cost: null,
    manufacturer: p.brand || null,
    madeInUSA: p.madeInUSA ?? false,
    primaryImageUrl: imageUrl,
    description: p.description || p.model || null,
    colorsAvailable: (p.availableColors || []).map(c => ({ name: c.name, hex: c.hex })),
    sizesAvailable: p.availableSizes || [],
    defaultColor: (p.availableColors || []).length > 0 ? p.availableColors![0].name : null,
  };
}

type LocationFilter = "all" | "usa" | "other";
type PageTab = "blanks" | "catalogs";

const SECTIONS = [
  { key: "member" as const, label: "Member", desc: "What members see in their wizards" },
  { key: "public" as const, label: "Public", desc: "What the storefront shows" },
  { key: "external" as const, label: "External", desc: "For selling on eBay, Etsy, etc." },
  { key: "platform" as const, label: "Platform", desc: "Internal platform selection" },
];

function CatalogsTab({ allProducts, productMap }: { allProducts: CatalogProduct[]; productMap: Map<string, CatalogProduct> }) {
  const { toast } = useToast();
  const [editingCatalog, setEditingCatalog] = useState<AdminCatalog | null>(null);
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [editName, setEditName] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [addingBlanksTo, setAddingBlanksTo] = useState<string | null>(null);
  const [blankSearch, setBlankSearch] = useState("");
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const { data: catalogsData, isLoading: loadingCatalogs } = useQuery<{ catalogs: AdminCatalog[] }>({
    queryKey: ["/api/admin/catalogs"],
    queryFn: async () => {
      const res = await fetch("/api/admin/catalogs");
      if (!res.ok) throw new Error("Failed to fetch catalogs");
      return res.json();
    },
  });

  const { data: assignments, isLoading: loadingAssignments } = useQuery<CatalogAssignments>({
    queryKey: ["/api/admin/catalog-assignments"],
    queryFn: async () => {
      const res = await fetch("/api/admin/catalog-assignments");
      if (!res.ok) throw new Error("Failed to fetch assignments");
      return res.json();
    },
  });

  const catalogs = catalogsData?.catalogs || [];

  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/admin/catalogs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName.trim(), description: newDesc.trim() }),
      });
      if (!res.ok) throw new Error("Failed to create catalog");
      return res.json();
    },
    onSuccess: (data) => {
      toast({ title: "Catalog created", description: data.name });
      setNewName("");
      setNewDesc("");
      setShowCreate(false);
      queryClient.invalidateQueries({ queryKey: ["/api/admin/catalogs"] });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, name, description }: { id: string; name: string; description: string }) => {
      const res = await fetch(`/api/admin/catalogs/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, description }),
      });
      if (!res.ok) throw new Error("Failed to update catalog");
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
      const res = await fetch(`/api/admin/catalogs/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to delete");
      }
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Catalog deleted" });
      setConfirmDelete(null);
      queryClient.invalidateQueries({ queryKey: ["/api/admin/catalogs"] });
    },
    onError: (err: any) => toast({ title: "Cannot delete", description: err.message, variant: "destructive" }),
  });

  const addBlanksMutation = useMutation({
    mutationFn: async ({ catalogId, blankIds }: { catalogId: string; blankIds: string[] }) => {
      const res = await fetch(`/api/admin/catalogs/${catalogId}/blanks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ blankIds }),
      });
      if (!res.ok) throw new Error("Failed to add blanks");
      return res.json();
    },
    onSuccess: (data) => {
      toast({ title: "Blanks added", description: `${data.count} total in catalog` });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/catalogs"] });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const removeBlanksMutation = useMutation({
    mutationFn: async ({ catalogId, blankIds }: { catalogId: string; blankIds: string[] }) => {
      const res = await fetch(`/api/admin/catalogs/${catalogId}/blanks`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ blankIds }),
      });
      if (!res.ok) throw new Error("Failed to remove blanks");
      return res.json();
    },
    onSuccess: (data) => {
      toast({ title: "Blank removed", description: `${data.count} remaining` });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/catalogs"] });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const assignMutation = useMutation({
    mutationFn: async (updates: Partial<CatalogAssignments>) => {
      const res = await fetch("/api/admin/catalog-assignments", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      if (!res.ok) throw new Error("Failed to save assignments");
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Section assignment saved" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/catalog-assignments"] });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const getBlankInfo = (blankId: string) => {
    return productMap.get(blankId);
  };

  const filteredBlanks = useMemo(() => {
    if (!blankSearch) return allProducts.slice(0, 50);
    const q = blankSearch.toLowerCase();
    return allProducts.filter(p =>
      (p.title || "").toLowerCase().includes(q) ||
      (p.brand || "").toLowerCase().includes(q)
    ).slice(0, 50);
  }, [allProducts, blankSearch]);

  const addingCatalog = addingBlanksTo ? catalogs.find(c => c.id === addingBlanksTo) : null;
  const addingBlankSet = new Set(addingCatalog?.blankIds?.map(String) || []);

  if (addingBlanksTo && addingCatalog) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2 flex-wrap">
          <Button size="sm" variant="outline" onClick={() => { setAddingBlanksTo(null); setBlankSearch(""); }} data-testid="button-back-catalogs">
            <X className="h-4 w-4" /> Back
          </Button>
          <h3 className="text-lg font-semibold">Add Blanks to "{addingCatalog.name}"</h3>
          <Badge variant="secondary">{addingCatalog.blankIds?.length || 0} in catalog</Badge>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search blanks..."
            value={blankSearch}
            onChange={e => setBlankSearch(e.target.value)}
            className="pl-9"
            data-testid="input-search-add-blanks"
          />
        </div>

        {addingCatalog.blankIds?.length > 0 && (
          <Card className="p-3">
            <p className="text-xs text-muted-foreground mb-2">Currently in this catalog:</p>
            <ScrollArea className="w-full">
              <div className="flex gap-2 pb-2">
                {addingCatalog.blankIds.map(bId => {
                  const info = getBlankInfo(bId);
                  return (
                    <div key={bId} className="flex-shrink-0 w-24 relative group rounded-md overflow-hidden border bg-muted" data-testid={`catalog-blank-${bId}`}>
                      <div className="aspect-square flex items-center justify-center p-1">
                        {info?.imageUrl ? (
                          <img src={info.imageUrl} alt={info.title} className="w-full h-full object-contain" loading="lazy" />
                        ) : (
                          <Box className="h-6 w-6 text-muted-foreground" />
                        )}
                      </div>
                      <div className="px-1 pb-1">
                        <p className="text-[9px] leading-tight line-clamp-2">{info?.title || `#${bId}`}</p>
                      </div>
                      <button
                        className="absolute top-0.5 right-0.5 bg-destructive text-destructive-foreground rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                        style={{ visibility: "visible" }}
                        onClick={() => removeBlanksMutation.mutate({ catalogId: addingBlanksTo!, blankIds: [bId] })}
                        data-testid={`remove-blank-${bId}`}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  );
                })}
              </div>
              <ScrollBar orientation="horizontal" />
            </ScrollArea>
          </Card>
        )}

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
          {filteredBlanks.map(p => {
            const isInCatalog = addingBlankSet.has(String(p.id));
            return (
              <button
                key={p.id}
                onClick={() => {
                  if (isInCatalog) {
                    removeBlanksMutation.mutate({ catalogId: addingBlanksTo!, blankIds: [String(p.id)] });
                  } else {
                    addBlanksMutation.mutate({ catalogId: addingBlanksTo!, blankIds: [String(p.id)] });
                  }
                }}
                className={`rounded-md border p-2 text-left transition-colors ${isInCatalog ? "border-primary bg-primary/10" : "border-border hover-elevate"}`}
                data-testid={`add-blank-${p.id}`}
              >
                <div className="aspect-square flex items-center justify-center mb-1">
                  {(p.imageUrl || p.image_url || p.thumbnailUrl) ? (
                    <img src={p.imageUrl || p.image_url || p.thumbnailUrl} alt={p.title} className="w-full h-full object-contain" loading="lazy" />
                  ) : (
                    <Box className="h-8 w-8 text-muted-foreground" />
                  )}
                </div>
                <p className="text-xs line-clamp-2 leading-tight">{p.title}</p>
                <div className="flex items-center gap-1 mt-1">
                  {isInCatalog && <Check className="h-3 w-3 text-primary" />}
                  {p.madeInUSA && <Flag className="h-3 w-3 text-blue-500" />}
                  {p.brand && <span className="text-[10px] text-muted-foreground truncate">{p.brand}</span>}
                </div>
              </button>
            );
          })}
        </div>

        {filteredBlanks.length === 0 && (
          <Card className="p-8 text-center">
            <p className="text-muted-foreground">No blanks match your search.</p>
          </Card>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2">
            <BookOpen className="h-5 w-5" />
            Catalogs
          </CardTitle>
          <Button size="sm" onClick={() => setShowCreate(true)} disabled={showCreate} data-testid="button-create-catalog">
            <Plus className="h-4 w-4" /> New Catalog
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {showCreate && (
            <div className="p-3 border rounded-md space-y-2 bg-muted/50">
              <Input
                placeholder="Catalog name..."
                value={newName}
                onChange={e => setNewName(e.target.value)}
                data-testid="input-catalog-name"
                onKeyDown={e => { if (e.key === "Enter" && newName.trim()) createMutation.mutate(); }}
              />
              <Input
                placeholder="Description (optional)..."
                value={newDesc}
                onChange={e => setNewDesc(e.target.value)}
                data-testid="input-catalog-desc"
              />
              <div className="flex gap-2">
                <Button size="sm" onClick={() => createMutation.mutate()} disabled={!newName.trim() || createMutation.isPending} data-testid="button-save-catalog">
                  {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  Create
                </Button>
                <Button size="sm" variant="outline" onClick={() => { setShowCreate(false); setNewName(""); setNewDesc(""); }} data-testid="button-cancel-catalog">
                  Cancel
                </Button>
              </div>
            </div>
          )}

          {loadingCatalogs ? (
            <div className="space-y-2">
              {[1, 2].map(i => <Skeleton key={i} className="h-20 w-full" />)}
            </div>
          ) : catalogs.length === 0 ? (
            <div className="text-center py-8">
              <BookOpen className="h-12 w-12 mx-auto mb-3 text-muted-foreground opacity-50" />
              <p className="text-muted-foreground">No catalogs yet. Create one to curate blanks.</p>
            </div>
          ) : (
            catalogs.map(cat => {
              const isEditing = editingCatalog?.id === cat.id;
              const assignedSections = SECTIONS.filter(s => assignments?.[s.key] === cat.id);

              return (
                <div key={cat.id} className="p-4 border rounded-md space-y-2" data-testid={`catalog-${cat.id}`}>
                  {isEditing ? (
                    <div className="space-y-2">
                      <Input value={editName} onChange={e => setEditName(e.target.value)} data-testid="input-edit-name" />
                      <Input value={editDesc} onChange={e => setEditDesc(e.target.value)} placeholder="Description..." data-testid="input-edit-desc" />
                      <div className="flex gap-2">
                        <Button size="sm" onClick={() => updateMutation.mutate({ id: cat.id, name: editName, description: editDesc })} disabled={updateMutation.isPending} data-testid="button-save-edit">
                          {updateMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => setEditingCatalog(null)} data-testid="button-cancel-edit">Cancel</Button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <div className="flex items-center gap-2 min-w-0">
                          <h4 className="font-medium truncate">{cat.name}</h4>
                          <Badge variant="secondary">{cat.blankIds?.length || 0} blanks</Badge>
                          {assignedSections.map(s => (
                            <Badge key={s.key} variant="default" className="text-xs">
                              <Link2 className="h-3 w-3" /> {s.label}
                            </Badge>
                          ))}
                        </div>
                        <div className="flex items-center gap-1">
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => { setEditingCatalog(cat); setEditName(cat.name); setEditDesc(cat.description); }}
                            data-testid={`edit-catalog-${cat.id}`}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => setAddingBlanksTo(cat.id)} data-testid={`manage-blanks-${cat.id}`}>
                            <Layers className="h-4 w-4" /> Blanks
                          </Button>
                          {confirmDelete === cat.id ? (
                            <div className="flex items-center gap-1">
                              <Button size="sm" variant="destructive" onClick={() => deleteMutation.mutate(cat.id)} disabled={deleteMutation.isPending} data-testid={`confirm-delete-catalog-${cat.id}`}>
                                {deleteMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Delete"}
                              </Button>
                              <Button size="sm" variant="ghost" onClick={() => setConfirmDelete(null)} data-testid={`cancel-delete-catalog-${cat.id}`}>No</Button>
                            </div>
                          ) : (
                            <Button size="icon" variant="ghost" onClick={() => setConfirmDelete(cat.id)} data-testid={`delete-catalog-${cat.id}`}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </div>
                      {cat.description && <p className="text-sm text-muted-foreground">{cat.description}</p>}

                      {cat.blankIds?.length > 0 && (
                        <ScrollArea className="w-full">
                          <div className="flex gap-1.5 pb-2">
                            {cat.blankIds.slice(0, 12).map(bId => {
                              const info = getBlankInfo(bId);
                              return (
                                <div key={bId} className="flex-shrink-0 w-16 rounded-md overflow-hidden border bg-muted" data-testid={`preview-blank-${bId}`}>
                                  <div className="aspect-square flex items-center justify-center p-0.5">
                                    {info?.imageUrl ? (
                                      <img src={info.imageUrl} alt={info.title} className="w-full h-full object-contain" loading="lazy" />
                                    ) : (
                                      <Box className="h-5 w-5 text-muted-foreground" />
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                            {cat.blankIds.length > 12 && (
                              <div className="flex-shrink-0 w-16 rounded-md border bg-muted flex items-center justify-center">
                                <span className="text-xs text-muted-foreground">+{cat.blankIds.length - 12}</span>
                              </div>
                            )}
                          </div>
                          <ScrollBar orientation="horizontal" />
                        </ScrollArea>
                      )}
                    </>
                  )}
                </div>
              );
            })
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ArrowRight className="h-5 w-5" />
            Section Assignments
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {loadingAssignments ? (
            <Skeleton className="h-40 w-full" />
          ) : (
            SECTIONS.map(section => {
              const currentId = assignments?.[section.key] || "";
              return (
                <div key={section.key} className="flex items-center gap-3 p-3 border rounded-md flex-wrap" data-testid={`assignment-${section.key}`}>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium">{section.label}</p>
                    <p className="text-xs text-muted-foreground">{section.desc}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <select
                      value={currentId}
                      onChange={e => {
                        const val = e.target.value || null;
                        assignMutation.mutate({ [section.key]: val });
                      }}
                      className="text-sm bg-background border rounded-md px-2 py-1.5 min-w-[160px]"
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
                        <Unlink className="h-4 w-4" />
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
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [hasChanges, setHasChanges] = useState(false);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [locationFilter, setLocationFilter] = useState<LocationFilter>("all");

  const { data: categories = [], isLoading: loadingCatalog } = useQuery<CatalogCategory[]>({
    queryKey: ["/api/printify/catalog", "blanks"],
    queryFn: async () => {
      const res = await fetch("/api/printify/catalog");
      const d = await res.json();
      return Array.isArray(d) ? d : [];
    },
  });

  const { data: allowedData, isLoading: loadingAllowed } = useQuery({
    queryKey: ["/api/members/allowed-products"],
    queryFn: async () => {
      const res = await fetch("/api/members/allowed-products");
      return res.json();
    },
  });

  const allProducts = useMemo(() => {
    const items: CatalogProduct[] = [];
    const seen = new Set<number>();
    for (const cat of categories) {
      for (const item of (cat.items || [])) {
        if (!seen.has(item.id)) {
          seen.add(item.id);
          items.push(item);
        }
      }
    }
    return items;
  }, [categories]);

  const productMap = useMemo(() => {
    const map = new Map<string, CatalogProduct>();
    allProducts.forEach(p => map.set(String(p.id), p));
    return map;
  }, [allProducts]);

  const categoryNames = useMemo(() => {
    return ["all", ...categories.map(c => c.name)];
  }, [categories]);

  useEffect(() => {
    if (allowedData?.products) {
      setSelectedIds(new Set<string>(
        allowedData.products.map((p: any) => String(p.blueprintId))
      ));
      setHasChanges(false);
    }
  }, [allowedData]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const products = Array.from(selectedIds).map(id => {
        const item = productMap.get(id);
        const imageUrl = item?.imageUrl || item?.image_url || item?.thumbnailUrl || "";
        return {
          blueprintId: Number(id),
          title: item?.title || `Product ${id}`,
          provider: item?.fulfillmentProvider || "printify",
          imageUrl,
          colors: (item?.availableColors || []).map(c => c.name),
          sizes: item?.availableSizes || [],
          printProviderId: item?.printProviderId || null,
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

  const toggleItem = useCallback((id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
    setHasChanges(true);
  }, []);

  const filtered = useMemo(() => {
    let items = allProducts;
    if (categoryFilter !== "all") {
      const cat = categories.find(c => c.name === categoryFilter);
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

  const selectAllFiltered = () => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      filtered.forEach(item => next.add(String(item.id)));
      return next;
    });
    setHasChanges(true);
  };

  const clearAll = () => {
    setSelectedIds(new Set());
    setHasChanges(true);
  };

  const selectItemMap = useMemo(() => {
    const map = new Map<string, ProductSelectItem>();
    filtered.forEach(p => map.set(String(p.id), catalogToSelectItem(p)));
    return map;
  }, [filtered]);

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

  const renderCatalogCard = useCallback(
    (scrollItem: ScrollViewItem, _isSelected: boolean, _onSelect: () => void) => {
      const selectItem = selectItemMap.get(String(scrollItem.id));
      if (!selectItem) return null;
      const isSelected = selectedIds.has(String(scrollItem.id));
      return (
        <ProductSelectCardSkin
          item={selectItem}
          isSelected={isSelected}
          onSelect={(id) => toggleItem(id)}
        />
      );
    },
    [selectItemMap, selectedIds, toggleItem]
  );

  const selectedProducts = useMemo(() => {
    return Array.from(selectedIds)
      .map(id => productMap.get(id))
      .filter(Boolean) as CatalogProduct[];
  }, [selectedIds, productMap]);

  const isLoading = loadingCatalog || loadingAllowed;

  return (
    <AdminShell title="Blanks" subtitle="Manage base products and catalogs" icon={Box}>
      <div className="space-y-4">
        <div className="flex gap-2">
          <Button
            variant={activeTab === "blanks" ? "default" : "outline"}
            size="sm"
            onClick={() => setActiveTab("blanks")}
            data-testid="tab-blanks"
          >
            <Box className="h-4 w-4" /> Blanks
          </Button>
          <Button
            variant={activeTab === "catalogs" ? "default" : "outline"}
            size="sm"
            onClick={() => setActiveTab("catalogs")}
            data-testid="tab-catalogs"
          >
            <BookOpen className="h-4 w-4" /> Catalogs
          </Button>
        </div>

        {activeTab === "catalogs" ? (
          <CatalogsTab allProducts={allProducts} productMap={productMap} />
        ) : (
          <>
            {selectedProducts.length > 0 && (
              <Card className="p-3 space-y-2">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-primary" />
                    <span className="text-sm font-medium">{selectedProducts.length} Selected</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={clearAll}
                      data-testid="button-clear-selected"
                    >
                      <Trash2 className="h-3 w-3" /> Clear
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => saveMutation.mutate()}
                      disabled={!hasChanges || saveMutation.isPending}
                      data-testid="button-save-blanks-top"
                    >
                      {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                      Save
                    </Button>
                  </div>
                </div>
                <ScrollArea className="w-full">
                  <div className="flex gap-2 pb-2">
                    {selectedProducts.map(p => (
                      <div
                        key={p.id}
                        className="flex-shrink-0 w-28 relative group rounded-md overflow-hidden border bg-muted"
                        data-testid={`selected-thumb-${p.id}`}
                      >
                        <div className="aspect-square flex items-center justify-center p-1">
                          {p.imageUrl ? (
                            <img src={p.imageUrl} alt={p.title} className="w-full h-full object-contain" loading="lazy" />
                          ) : (
                            <Box className="h-8 w-8 text-muted-foreground" />
                          )}
                        </div>
                        <div className="px-1 pb-1">
                          <p className="text-[10px] leading-tight line-clamp-2 text-foreground">{p.title}</p>
                        </div>
                        <button
                          className="absolute top-1 right-1 bg-destructive text-destructive-foreground rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                          style={{ visibility: "visible" }}
                          onClick={() => toggleItem(String(p.id))}
                          data-testid={`button-remove-${p.id}`}
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                  <ScrollBar orientation="horizontal" />
                </ScrollArea>
              </Card>
            )}

            <div className="space-y-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by name, brand, or description..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="pl-9"
                  data-testid="input-search-blanks"
                />
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Filter className="h-4 w-4 text-muted-foreground shrink-0" />
                <select
                  value={categoryFilter}
                  onChange={e => setCategoryFilter(e.target.value)}
                  className="text-sm bg-background border rounded-md px-2 py-1.5"
                  data-testid="select-category-filter"
                >
                  {categoryNames.map(name => (
                    <option key={name} value={name}>
                      {name === "all" ? `All Categories (${allProducts.length})` : `${name} (${categories.find(c => c.name === name)?.count || 0})`}
                    </option>
                  ))}
                </select>

                {([
                  { value: "all" as LocationFilter, label: "All", icon: null },
                  { value: "usa" as LocationFilter, label: "USA", icon: Flag },
                  { value: "other" as LocationFilter, label: "Global", icon: Globe },
                ]).map(f => (
                  <Badge
                    key={f.value}
                    variant={locationFilter === f.value ? "default" : "outline"}
                    className="cursor-pointer text-xs"
                    onClick={() => setLocationFilter(f.value)}
                    data-testid={`filter-location-${f.value}`}
                  >
                    {f.icon && <f.icon className="w-3 h-3" />}
                    {f.label}
                  </Badge>
                ))}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Button size="sm" variant="outline" onClick={selectAllFiltered} data-testid="button-select-all-blanks">
                  Select All ({filtered.length})
                </Button>
                <Badge variant="secondary">{selectedIds.size} selected</Badge>
                {hasChanges && (
                  <Button
                    size="sm"
                    onClick={() => saveMutation.mutate()}
                    disabled={saveMutation.isPending}
                    data-testid="button-save-blanks"
                  >
                    {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    Save ({selectedIds.size})
                  </Button>
                )}
              </div>
            </div>

            {isLoading ? (
              <div className="flex gap-3 overflow-hidden">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="flex-shrink-0 w-[calc(50vw-3rem)] max-w-[180px] aspect-[9/16] rounded-lg" />
                ))}
              </div>
            ) : filtered.length === 0 ? (
              <Card className="p-8 text-center">
                <p className="text-muted-foreground">
                  {allProducts.length === 0
                    ? "No products in catalog yet. Sync your Printify catalog first from the Products page."
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
      </div>
    </AdminShell>
  );
}
