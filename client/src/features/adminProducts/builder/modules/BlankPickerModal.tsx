import { useCallback } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Search, Filter, Flag, Globe, X, Layers, ArrowRight } from "lucide-react";
import { ScrollGridView } from "@/features/shared/components/views/ScrollGridView";
import { AdminSourceBlankSkin } from "@/features/shared/components/skins/AdminSourceBlankSkin";
import { AdminCatalogBlankSkin } from "@/features/shared/components/skins/AdminCatalogBlankSkin";
import {
  useAdminBlanksController,
  type LocationFilter,
} from "@/features/adminProducts/controllers/useAdminBlanksController";
import type { ScrollViewItem } from "@/features/shared/components/views/index";

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
    catalogBlankSet,
    catalogItems,
    removeBlanksMutation,
    allProductMap,
    resolveBlankKey,
    filteredCount,
    totalProductCount,
  } = useAdminBlanksController();

  const validTargetId = hasCatalogSelected ? selectedCatalogId : null;
  const targetName = activeCatalog?.name ?? "catalog";

  const renderCard = useCallback(
    (scrollItem: ScrollViewItem) => {
      const selectItem = sourceItemMap.get(String(scrollItem.id));
      if (!selectItem) return null;
      const product =
        allProductMap.get(String(scrollItem.id)) ||
        allProductMap.get(`pf:${scrollItem.id}`);
      const blankKey = product
        ? resolveBlankKey(String(scrollItem.id), product)
        : String(scrollItem.id);
      const inTarget = catalogBlankSet.has(blankKey);

      const handleSelect = () => {
        if (validTargetId && !inTarget) onAddToCatalog(blankKey);
      };

      return (
        <AdminSourceBlankSkin
          item={selectItem as any}
          isSelected={inTarget}
          onSelect={handleSelect}
          selectLabel={validTargetId ? `Add to ${targetName}` : undefined}
          selectedLabel={validTargetId ? `✓ In ${targetName}` : undefined}
          disableWhenSelected={!!validTargetId}
        />
      );
    },
    [sourceItemMap, allProductMap, catalogBlankSet, onAddToCatalog, validTargetId, targetName, resolveBlankKey]
  );

  return (
    <div className="flex flex-col max-h-[85vh]">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b flex-shrink-0">
        <DialogTitle className="text-base font-semibold">Add Blank to Catalog</DialogTitle>
        <Button
          size="icon"
          variant="ghost"
          onClick={() => onOpenChange(false)}
          data-testid="modal-blank-picker-close"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Scrollable body */}
      <div className="overflow-y-auto flex-1 p-4 space-y-4">

        {/* Source → Target selectors */}
        {catalogs.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground">Browse from:</p>
              <select
                value={sourceCatalogId || ""}
                onChange={e => setSourceCatalogId(e.target.value || null)}
                className="text-sm bg-background border rounded-md px-3 py-2 w-full"
                data-testid="modal-select-source-catalog"
              >
                <option value="">All Products</option>
                {catalogs.map(cat => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name} ({cat.blankIds?.length || 0})
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground">Adding to:</p>
              <select
                value={selectedCatalogId || ""}
                onChange={e => setSelectedCatalogId(e.target.value || null)}
                className="text-sm bg-background border rounded-md px-3 py-2 w-full"
                data-testid="modal-select-target-catalog"
              >
                <option value="">Select a catalog…</option>
                {catalogs.map(cat => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name} ({cat.blankIds?.length || 0})
                  </option>
                ))}
              </select>
              {validTargetId && (
                <p className="text-xs text-muted-foreground">
                  {catalogBlankSet.size} blank{catalogBlankSet.size !== 1 ? "s" : ""} in this catalog
                </p>
              )}
            </div>
          </div>
        )}

        {/* Target catalog strip */}
        {validTargetId && activeCatalog && catalogItems.length > 0 && (
          <Card className="border-primary/30 bg-primary/5 p-3 space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              <Layers className="h-4 w-4 text-primary" />
              <span className="text-sm font-semibold">{activeCatalog.name}</span>
              <Badge variant="secondary" className="text-xs">
                {activeCatalog.blankIds?.length || 0} blanks
              </Badge>
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

        {/* No target hint */}
        {!validTargetId && catalogs.length > 0 && (
          <div className="flex items-center gap-2 p-3 rounded-md border bg-muted/30 text-xs text-muted-foreground">
            <ArrowRight className="h-3.5 w-3.5 shrink-0" />
            Select a target catalog above to start adding blanks.
          </div>
        )}

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search blanks…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-8 text-sm"
            data-testid="modal-input-search-blanks"
          />
        </div>

        {/* Location filter + count */}
        <div className="flex items-center gap-2 flex-wrap">
          <Filter className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          {([
            { value: "all" as LocationFilter, label: "All", icon: null },
            { value: "usa" as LocationFilter, label: "USA Made", icon: Flag },
            { value: "other" as LocationFilter, label: "Global", icon: Globe },
          ]).map(f => (
            <Badge
              key={f.value}
              variant={locationFilter === f.value ? "default" : "outline"}
              className="cursor-pointer text-xs"
              onClick={() => setLocationFilter(f.value)}
              data-testid={`modal-filter-location-${f.value}`}
            >
              {f.icon && <f.icon className="w-3 h-3 mr-1" />}
              {f.label}
            </Badge>
          ))}
          <Badge variant="secondary" className="text-xs ml-auto">
            {filteredCount} shown
          </Badge>
        </div>

        {/* Blank grid */}
        {loadingCatalog ? (
          <div className="grid grid-cols-2 gap-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="aspect-[3/4] rounded-md" />
            ))}
          </div>
        ) : filteredCount === 0 ? (
          <Card className="p-8 text-center">
            <p className="text-sm text-muted-foreground">
              {totalProductCount === 0
                ? "No products synced yet."
                : "No products match your search or filters."}
            </p>
          </Card>
        ) : (
          <ScrollGridView
            items={scrollItems}
            renderItem={item => renderCard(item as ScrollViewItem)}
            height="45vh"
            emptyMessage="No products match the current filters."
            footer={null}
          />
        )}
      </div>
    </div>
  );
}

export function BlankPickerModal({ open, onOpenChange }: BlankPickerModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl w-[95vw] p-0 overflow-hidden">
        <BlankPickerInner onOpenChange={onOpenChange} />
      </DialogContent>
    </Dialog>
  );
}
