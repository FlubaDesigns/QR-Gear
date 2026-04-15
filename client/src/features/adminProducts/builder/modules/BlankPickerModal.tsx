import { useCallback } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Search, Filter, Flag, Globe, X, Layers, ArrowRight } from "lucide-react";
import { AdminCatalogBlankSkin } from "@/features/shared/components/skins/AdminCatalogBlankSkin";
import { BlankPickerRowSkin } from "@/features/shared/components/skins/BlankPickerRowSkin";
import {
  useAdminBlanksController,
  type LocationFilter,
} from "@/features/adminProducts/controllers/useAdminBlanksController";
import type { TierValue } from "@/features/shared/components/skins/ProductSelectCardSkin";

interface BlankPickerModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function BlankPickerInner({ onOpenChange }: { onOpenChange: (open: boolean) => void }) {
  const {
    loadingCatalog,
    catalogs,
    activeCatalog,
    hasCatalogSelected,
    selectedCatalogId,
    setSelectedCatalogId,
    sourceCatalogId,
    setSourceCatalogId,
    search,
    setSearch,
    locationFilter,
    setLocationFilter,
    scrollItems,
    sourceItemMap,
    onAddToCatalog,
    onTierChange,
    catalogBlankSet,
    catalogItems,
    removeBlanksMutation,
    allProductMap,
    resolveBlankKey,
    blankTiers,
    filteredCount,
    totalProductCount,
  } = useAdminBlanksController();

  const validTargetId = hasCatalogSelected ? selectedCatalogId : null;
  const targetName = activeCatalog?.name ?? "catalog";

  const renderRow = useCallback(
    (scrollItem: { id: string | number }) => {
      const id = String(scrollItem.id);
      const selectItem = sourceItemMap.get(id);
      if (!selectItem) return null;
      const product = allProductMap.get(id) || allProductMap.get(`pf:${id}`);
      const blankKey = product ? resolveBlankKey(id, product) : id;
      const inTarget = catalogBlankSet.has(blankKey);
      const itemTier = (blankTiers[blankKey] as TierValue) || null;

      return (
        <BlankPickerRowSkin
          key={id}
          item={selectItem as any}
          isSelected={inTarget}
          onSelect={() => { if (validTargetId && !inTarget) onAddToCatalog(blankKey); }}
          tier={itemTier}
          onTierChange={validTargetId ? (tier) => onTierChange(blankKey, tier) : undefined}
          showTierControls={!!validTargetId && inTarget}
          selectLabel={validTargetId ? `Add to ${targetName}` : undefined}
          selectedLabel={validTargetId ? `In ${targetName}` : undefined}
          disableWhenSelected={!!validTargetId}
        />
      );
    },
    [sourceItemMap, allProductMap, catalogBlankSet, onAddToCatalog, onTierChange, validTargetId, targetName, resolveBlankKey, blankTiers]
  );

  return (
    <div className="flex flex-col h-full">

      {/* Drag handle — mobile only */}
      <div className="sm:hidden flex justify-center pt-3 pb-1 flex-shrink-0">
        <div className="w-10 h-1 rounded-full bg-muted-foreground/30" />
      </div>

      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b flex-shrink-0">
        <DialogTitle className="text-base font-semibold">Add Blank to Catalog</DialogTitle>
        <Button size="icon" variant="ghost" onClick={() => onOpenChange(false)} data-testid="modal-blank-picker-close">
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Scrollable body — everything scrolls together */}
      <div className="flex-1 overflow-y-auto overscroll-contain">
        <div className="p-4 space-y-4">

          {/* Source / Target selectors */}
          {catalogs.length > 0 && (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <p className="text-sm font-medium text-muted-foreground">Adding to:</p>
                <select
                  value={selectedCatalogId || ""}
                  onChange={e => setSelectedCatalogId(e.target.value || null)}
                  className="w-full text-sm bg-background border rounded-md px-3 py-2.5"
                  data-testid="modal-select-target-catalog"
                >
                  <option value="">Select a catalog…</option>
                  {catalogs.map(cat => (
                    <option key={cat.id} value={cat.id}>{cat.name} ({cat.blankIds?.length || 0})</option>
                  ))}
                </select>
                {validTargetId && (
                  <p className="text-xs text-muted-foreground">
                    {catalogBlankSet.size} blank{catalogBlankSet.size !== 1 ? "s" : ""} in this catalog
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <p className="text-sm font-medium text-muted-foreground">Browse from:</p>
                <select
                  value={sourceCatalogId || ""}
                  onChange={e => setSourceCatalogId(e.target.value || null)}
                  className="w-full text-sm bg-background border rounded-md px-3 py-2.5"
                  data-testid="modal-select-source-catalog"
                >
                  <option value="">All Products</option>
                  {catalogs.map(cat => (
                    <option key={cat.id} value={cat.id}>{cat.name} ({cat.blankIds?.length || 0})</option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {/* No target hint */}
          {!validTargetId && catalogs.length > 0 && (
            <div className="flex items-center gap-2 p-3 rounded-md border bg-muted/30 text-sm text-muted-foreground">
              <ArrowRight className="h-4 w-4 shrink-0" />
              Select a target catalog above to start adding blanks.
            </div>
          )}

          {/* Target catalog strip */}
          {validTargetId && activeCatalog && catalogItems.length > 0 && (
            <Card className="border-primary/30 bg-primary/5 p-3 space-y-2">
              <div className="flex items-center gap-2 flex-wrap">
                <Layers className="h-4 w-4 text-primary" />
                <span className="text-sm font-semibold">{activeCatalog.name}</span>
                <Badge variant="secondary" className="text-xs">{activeCatalog.blankIds?.length || 0} blanks</Badge>
              </div>
              <ScrollArea className="w-full">
                <div className="flex gap-2 pb-2">
                  {catalogItems.map(item => (
                    <AdminCatalogBlankSkin
                      key={item.catalogKey}
                      item={item}
                      onRemove={key => {
                        if (!validTargetId) return;
                        removeBlanksMutation.mutate({ catalogId: validTargetId, blankIds: [key] });
                      }}
                      removing={removeBlanksMutation.isPending}
                    />
                  ))}
                </div>
                <ScrollBar orientation="horizontal" />
              </ScrollArea>
            </Card>
          )}

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search blanks…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9"
              data-testid="modal-input-search-blanks"
            />
          </div>

          {/* Location filter + count */}
          <div className="flex items-center gap-2 flex-wrap">
            <Filter className="h-4 w-4 text-muted-foreground shrink-0" />
            {([
              { value: "all" as LocationFilter, label: "All", icon: null },
              { value: "usa" as LocationFilter, label: "USA Made", icon: Flag },
              { value: "other" as LocationFilter, label: "Global", icon: Globe },
            ]).map(f => (
              <Badge
                key={f.value}
                variant={locationFilter === f.value ? "default" : "outline"}
                className="cursor-pointer"
                onClick={() => setLocationFilter(f.value)}
                data-testid={`modal-filter-location-${f.value}`}
              >
                {f.icon && <f.icon className="w-3.5 h-3.5 mr-1" />}
                {f.label}
              </Badge>
            ))}
            <Badge variant="secondary" className="ml-auto">{filteredCount} shown</Badge>
          </div>

          {/* Blank list */}
          {loadingCatalog ? (
            <div className="space-y-3">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="h-14 w-full rounded-md" />
              ))}
            </div>
          ) : filteredCount === 0 ? (
            <Card className="p-10 text-center">
              <p className="text-sm text-muted-foreground">
                {totalProductCount === 0 ? "No products synced yet." : "No products match your search or filters."}
              </p>
            </Card>
          ) : (
            <div className="divide-y divide-border rounded-md border" data-testid="modal-blank-list">
              {scrollItems.map(item => renderRow(item))}
            </div>
          )}

        </div>
      </div>

    </div>
  );
}

export function BlankPickerModal({ open, onOpenChange }: BlankPickerModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={[
          "p-0 overflow-hidden flex flex-col",
          // Desktop: centered dialog
          "sm:max-w-lg sm:w-[95vw] sm:max-h-[88vh] sm:rounded-lg",
          // Mobile: full-width bottom sheet anchored to bottom
          "max-sm:!fixed max-sm:!inset-x-0 max-sm:!bottom-0 max-sm:!top-auto",
          "max-sm:!translate-x-0 max-sm:!translate-y-0",
          "max-sm:!w-full max-sm:!max-w-full",
          "max-sm:!rounded-t-2xl max-sm:!rounded-b-none",
          "max-sm:!h-[92svh]",
        ].join(" ")}
      >
        <BlankPickerInner onOpenChange={onOpenChange} />
      </DialogContent>
    </Dialog>
  );
}
