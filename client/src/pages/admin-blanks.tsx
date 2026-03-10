import { useState, useMemo, useCallback } from "react";
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
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import AdminShell from "@/components/AdminShell";

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

type LocationFilter = "all" | "usa" | "other";
type PageTab = "blanks" | "catalogs";

const SECTIONS = [
  { key: "member" as const, label: "Member", desc: "What members see in their wizards" },
  { key: "public" as const, label: "Public", desc: "What the storefront shows" },
  { key: "external" as const, label: "External", desc: "For selling on eBay, Etsy, etc." },
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
                          <Button
                            size="lg"
                            onClick={() => onOpenCatalog(cat.id)}
                            data-testid={`open-catalog-${cat.id}`}
                          >
                            <Layers className="h-5 w-5" /> {cat.name}
                          </Button>
                          <div className="flex items-center gap-2 flex-wrap">
                            <Badge variant="secondary" className="text-sm">{cat.blankIds?.length || 0} blanks</Badge>
                            {assignedSections.map(s => (
                              <Badge key={s.key} variant="default" className="text-sm">
                                <Link2 className="h-3 w-3" /> {s.label}
                              </Badge>
                            ))}
                          </div>
                          {cat.description && <p className="text-base text-muted-foreground">{cat.description}</p>}
                        </div>
                        <div className="flex items-center gap-2">
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
  const [selectedCatalogId, setSelectedCatalogId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [locationFilter, setLocationFilter] = useState<LocationFilter>("all");

  const { data: categories = [], isLoading: loadingCatalog } = useQuery<CatalogCategory[]>({
    queryKey: ["/api/printify/catalog", "blanks"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/printify/catalog");
      const d = await res.json();
      return Array.isArray(d) ? d : [];
    },
  });

  const { data: catalogsData } = useQuery<{ catalogs: AdminCatalog[] }>({
    queryKey: ["/api/admin/catalogs"],
  });

  const catalogs = catalogsData?.catalogs || [];
  const activeCatalog = selectedCatalogId ? catalogs.find(c => c.id === selectedCatalogId) : null;
  const validSelectedCatalogId = activeCatalog ? selectedCatalogId : null;
  const catalogBlankSet = useMemo(() => new Set(activeCatalog?.blankIds?.map(String) || []), [activeCatalog]);

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

  const toggleBlankInCatalog = useCallback((productId: string) => {
    if (!validSelectedCatalogId) return;
    if (catalogBlankSet.has(productId)) {
      removeBlanksMutation.mutate({ catalogId: validSelectedCatalogId, blankIds: [productId] });
    } else {
      addBlanksMutation.mutate({ catalogId: validSelectedCatalogId, blankIds: [productId] });
    }
  }, [validSelectedCatalogId, catalogBlankSet, addBlanksMutation, removeBlanksMutation]);

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
          <div className="space-y-5">
            {validSelectedCatalogId && activeCatalog && (
              <Card className="border-primary/30 bg-primary/5">
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div className="flex items-center gap-3">
                      <Layers className="h-6 w-6 text-primary" />
                      <span className="text-lg font-semibold">Editing: {activeCatalog.name}</span>
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
                  <p className="text-base text-muted-foreground">
                    Tap any blank below to add or remove it from this catalog.
                  </p>
                </CardContent>
              </Card>
            )}

            {!validSelectedCatalogId && catalogs.length > 0 && (
              <div className="space-y-2">
                <p className="text-base font-medium text-muted-foreground">Select a catalog to edit, or browse all blanks:</p>
                <select
                  value=""
                  onChange={e => { if (e.target.value) setSelectedCatalogId(e.target.value); }}
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

              <div className="space-y-3">
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
                        {name === "all" ? `All Categories (${allProducts.length})` : `${name} (${categories.find(c => c.name === name)?.count || 0})`}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex flex-wrap items-center gap-3">
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
              </div>

              <div className="flex items-center gap-3 flex-wrap">
                <Badge variant="secondary" className="text-sm py-1 px-3">{filtered.length} blanks shown</Badge>
                {validSelectedCatalogId && (
                  <Badge variant="default" className="text-sm py-1 px-3">{catalogBlankSet.size} in catalog</Badge>
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
                    ? "No products in catalog yet. Sync your Printify catalog first from the Products page."
                    : "No products match your search or filters."}
                </p>
              </Card>
            ) : (
              <div className="space-y-3">
                {filtered.map(p => {
                  const img = p.imageUrl || p.image_url || p.thumbnailUrl;
                  const isInCatalog = validSelectedCatalogId ? catalogBlankSet.has(String(p.id)) : false;

                  return (
                    <button
                      key={p.id}
                      onClick={() => {
                        if (validSelectedCatalogId) {
                          toggleBlankInCatalog(String(p.id));
                        }
                      }}
                      disabled={!validSelectedCatalogId}
                      className={`w-full rounded-md border p-4 text-left flex gap-4 items-center transition-colors ${
                        isInCatalog
                          ? "border-primary bg-primary/10"
                          : validSelectedCatalogId
                            ? "border-border hover-elevate"
                            : "border-border opacity-80"
                      }`}
                      data-testid={`blank-item-${p.id}`}
                    >
                      <div className="w-20 h-20 flex-shrink-0 rounded-md overflow-hidden bg-muted flex items-center justify-center">
                        {img ? (
                          <img src={img} alt={p.title} className="w-full h-full object-contain" loading="lazy" />
                        ) : (
                          <Box className="h-10 w-10 text-muted-foreground" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0 space-y-1">
                        <p className="text-base font-medium leading-snug">{p.title}</p>
                        {p.brand && <p className="text-sm text-muted-foreground">{p.brand}</p>}
                        <div className="flex items-center gap-2 flex-wrap">
                          {p.madeInUSA && (
                            <Badge variant="outline" className="text-xs">
                              <Flag className="h-3 w-3" /> USA
                            </Badge>
                          )}
                          {p.minPrice && (
                            <span className="text-sm text-muted-foreground">from ${p.minPrice}</span>
                          )}
                          {p.colorCount && p.colorCount > 0 && (
                            <span className="text-sm text-muted-foreground">{p.colorCount} colors</span>
                          )}
                        </div>
                      </div>
                      {validSelectedCatalogId && (
                        <div className="flex-shrink-0">
                          {isInCatalog ? (
                            <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center">
                              <Check className="h-6 w-6 text-primary-foreground" />
                            </div>
                          ) : (
                            <div className="w-10 h-10 rounded-full border-2 border-muted-foreground/30 flex items-center justify-center">
                              <Plus className="h-5 w-5 text-muted-foreground" />
                            </div>
                          )}
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </AdminShell>
  );
}
