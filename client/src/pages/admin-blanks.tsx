import { useState, useCallback } from "react";
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
import AdminSectionSubNav from "@/components/admin/AdminSectionSubNav";
import { BUILD_SUBNAV } from "@/components/admin/adminNavConfig";
import { ScrollGridView } from "@/features/shared/components/views/ScrollGridView";
import {
  AdminSourceBlankSkin,
} from "@/features/shared/components/skins/AdminSourceBlankSkin";
import {
  AdminCatalogBlankSkin,
} from "@/features/shared/components/skins/AdminCatalogBlankSkin";
import type { ScrollViewItem } from "@/features/shared/components/views/index";
import { useAdminBlanksController, type CatalogProduct, type AdminCatalog, type PricingSettings, type CatalogCategory, type LocationFilter, type ProviderFilter } from "@/features/adminProducts/controllers/useAdminBlanksController";

interface CatalogAssignments {
  member: string | null;
  public: string | null;
  external: string | null;
  marketplace: string | null;
  platform: string | null;
}

type PageTab = "blanks" | "catalogs";

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
  const [activeTab, setActiveTab] = useState<PageTab>("blanks");

  const ctrl = useAdminBlanksController();
  const {
    loadingCatalog, catalogs, activeCatalog, hasCatalogSelected,
    selectedCatalogId, setSelectedCatalogId,
    sourceCatalogId, setSourceCatalogId, sourceCatalog,
    providerFilter, setProviderFilter,
    search, setSearch, categoryFilter, setCategoryFilter,
    locationFilter, setLocationFilter, categoryNames,
    catalogItems, sourceItemMap, scrollItems, blankTiers,
    onAddToCatalog, onToggleItem, onSaveDescription, onSaveTitle, onTierChange,
    getItemMappingBadge, resolveBlankKey,
    allProductMap, catalogBlankSet, removeBlanksMutation, saveDescriptionMutation, saveTitleMutation,
    totalProductCount, filteredCount, categoryCounts,
  } = ctrl;

  const validSelectedCatalogId = hasCatalogSelected ? selectedCatalogId : null;
  const targetName = activeCatalog?.name ?? "target";

  const renderCatalogCard = useCallback(
    (scrollItem: ScrollViewItem) => {
      const selectItem = sourceItemMap.get(String(scrollItem.id));
      if (!selectItem) return null;
      const product = allProductMap.get(String(scrollItem.id)) || allProductMap.get(`pf:${scrollItem.id}`);
      const blankKey = product ? resolveBlankKey(String(scrollItem.id), product) : String(scrollItem.id);
      const inTarget = catalogBlankSet.has(blankKey);
      const itemTier = blankTiers[blankKey] as "good" | "better" | "best" | undefined;
      const hasMappingBadge = getItemMappingBadge(String(scrollItem.id));

      const handleSelect = () => {
        if (validSelectedCatalogId) {
          if (!inTarget) onAddToCatalog(blankKey);
          // Already in target — do nothing; remove via the strip below
        } else {
          onToggleItem(String(scrollItem.id), product);
        }
      };

      return (
        <div className="relative">
          <AdminSourceBlankSkin
            item={selectItem as any}
            isSelected={inTarget}
            onSelect={handleSelect}
            tier={itemTier || null}
            onTierChange={(_blankId: string, tier: string | null) => onTierChange(blankKey, tier)}
            showTierControls={!!validSelectedCatalogId && inTarget}
            editableDescription={!!validSelectedCatalogId}
            onDescriptionSave={(id: string, desc: string) => onSaveDescription(id, desc, blankKey)}
            descriptionSaving={saveDescriptionMutation.isPending}
            editableTitle={!!validSelectedCatalogId}
            onTitleSave={(id: string, title: string) => onSaveTitle(id, title, blankKey)}
            titleSaving={saveTitleMutation.isPending}
            selectLabel={validSelectedCatalogId ? `Add to ${targetName}` : undefined}
            selectedLabel={validSelectedCatalogId ? `✓ In ${targetName}` : undefined}
            disableWhenSelected={!!validSelectedCatalogId}
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
    [sourceItemMap, allProductMap, catalogBlankSet, onAddToCatalog, onToggleItem, blankTiers, onTierChange,
     validSelectedCatalogId, targetName, getItemMappingBadge, onSaveDescription, saveDescriptionMutation.isPending,
     onSaveTitle, saveTitleMutation.isPending, resolveBlankKey]
  );

  const handleOpenCatalog = useCallback((catalogId: string) => {
    setSelectedCatalogId(catalogId);
    setActiveTab("blanks");
  }, [setSelectedCatalogId]);

  return (
    <AdminShell title="Blanks" subtitle="Manage base products and catalogs" icon={Box} sectionNav={<AdminSectionSubNav items={BUILD_SUBNAV} />}>
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
            {/* Provider filter */}
            <div className="flex items-center gap-2 flex-wrap">
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
                  {totalProductCount} products synced
                </Badge>
              )}
            </div>

            {/* Source → Target selectors */}
            {catalogs.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <p className="text-sm font-medium text-muted-foreground">Browse from:</p>
                  <select
                    value={sourceCatalogId || ""}
                    onChange={e => setSourceCatalogId(e.target.value || null)}
                    className="text-base bg-background border rounded-md px-3 py-2.5 w-full"
                    data-testid="select-source-catalog"
                  >
                    <option value="">All Products</option>
                    {catalogs.map(cat => (
                      <option key={cat.id} value={cat.id}>
                        {cat.name} ({cat.blankIds?.length || 0})
                      </option>
                    ))}
                  </select>
                  {sourceCatalog && (
                    <p className="text-xs text-muted-foreground">
                      Showing {filteredCount} of {sourceCatalog.blankIds?.length || 0} blanks
                    </p>
                  )}
                </div>

                <div className="space-y-1">
                  <p className="text-sm font-medium text-muted-foreground">Adding to:</p>
                  <select
                    value={selectedCatalogId || ""}
                    onChange={e => setSelectedCatalogId(e.target.value || null)}
                    className="text-base bg-background border rounded-md px-3 py-2.5 w-full"
                    data-testid="select-target-catalog"
                  >
                    <option value="">Select a catalog…</option>
                    {catalogs.map(cat => (
                      <option key={cat.id} value={cat.id}>
                        {cat.name} ({cat.blankIds?.length || 0})
                      </option>
                    ))}
                  </select>
                  {validSelectedCatalogId && (
                    <p className="text-xs text-muted-foreground">
                      {catalogBlankSet.size} blank{catalogBlankSet.size !== 1 ? "s" : ""} in this catalog
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Target catalog strip */}
            {validSelectedCatalogId && activeCatalog && (
              <Card className="border-primary/30 bg-primary/5">
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Layers className="h-5 w-5 text-primary" />
                      <span className="text-base font-semibold">{activeCatalog.name}</span>
                      <Badge variant="secondary" className="text-sm">{activeCatalog.blankIds?.length || 0} blanks</Badge>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setSelectedCatalogId(null)}
                      data-testid="button-clear-catalog"
                    >
                      <X className="h-4 w-4" /> Clear
                    </Button>
                  </div>
                  {catalogItems.length > 0 ? (
                    <ScrollArea className="w-full">
                      <div className="flex gap-2 pb-2">
                        {catalogItems.map((item) => (
                          <AdminCatalogBlankSkin
                            key={item.catalogKey}
                            item={item}
                            onRemove={(key) => {
                              if (!validSelectedCatalogId) return;
                              removeBlanksMutation.mutate({ catalogId: validSelectedCatalogId, blankIds: [key] });
                            }}
                            removing={removeBlanksMutation.isPending}
                          />
                        ))}
                      </div>
                      <ScrollBar orientation="horizontal" />
                    </ScrollArea>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      No blanks yet — tap "Add to {activeCatalog.name}" on any item below.
                    </p>
                  )}
                </CardContent>
              </Card>
            )}

            {/* No target selected hint */}
            {!validSelectedCatalogId && catalogs.length > 0 && (
              <div className="flex items-center gap-2 p-3 rounded-md border bg-muted/30 text-sm text-muted-foreground">
                <ArrowRight className="h-4 w-4 shrink-0" />
                Select a target catalog above to start adding blanks.
              </div>
            )}

            {/* Search + filters */}
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
                      {name === "all" ? `All Categories (${totalProductCount})` : `${name} (${categoryCounts[name] || 0})`}
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

              <Badge variant="secondary" className="text-sm py-1 px-3">
                {filteredCount} blank{filteredCount !== 1 ? "s" : ""} shown
              </Badge>
            </div>

            {/* Item grid — always shows scrollItems, card action changes based on target */}
            {loadingCatalog ? (
              <div className="space-y-4">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-28 w-full rounded-md" />
                ))}
              </div>
            ) : filteredCount === 0 ? (
              <Card className="p-8 text-center">
                <p className="text-lg text-muted-foreground">
                  {totalProductCount === 0
                    ? (providerFilter === "printful"
                      ? "No Printful products synced yet. Run a Printful catalog sync first."
                      : "No products in catalog yet. Sync your Printify catalog first from the Products page.")
                    : "No products match your search or filters."}
                </p>
              </Card>
            ) : (
              <ScrollGridView
                items={scrollItems}
                renderItem={(item) => renderCatalogCard(item as ScrollViewItem)}
                height="calc(100vh - 200px)"
                emptyMessage="No products match the current filters."
                footer={null}
              />
            )}
          </>
        )}
      </div>
    </AdminShell>
  );
}
