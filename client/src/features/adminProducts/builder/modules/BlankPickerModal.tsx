import { useCallback } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Search, Filter, Flag, Globe, X } from "lucide-react";
import { BlankPickerRowSkin } from "@/features/shared/components/skins/BlankPickerRowSkin";
import {
  useAdminBlanksController,
  type LocationFilter,
} from "@/features/adminProducts/controllers/useAdminBlanksController";

interface BlankPickerModalProps {
  targetCatalogId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function BlankPickerInner({ targetCatalogId, onOpenChange }: Pick<BlankPickerModalProps, "targetCatalogId" | "onOpenChange">) {
  const {
    loadingCatalog, loadError, reload, addBlanksMutation,
    catalogs,
    activeCatalog,
    hasCatalogSelected,
    selectedCatalogId,
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
    allProductMap,
    resolveBlankKey,
    filteredCount,
    totalProductCount,
  } = useAdminBlanksController({ targetCatalogId });

  const validTargetId = hasCatalogSelected ? selectedCatalogId : null;
  const targetName = activeCatalog?.name ?? "catalog";

  const renderRow = useCallback(
    (scrollItem: { id: string | number }) => {
      const id = String(scrollItem.id);
      const selectItem = sourceItemMap.get(id);
      if (!selectItem) return null;
      const product = allProductMap.get(id);
      const blankKey = product ? resolveBlankKey(id, product) : id;
      const inTarget = catalogBlankSet.has(blankKey);

      return (
        <BlankPickerRowSkin
          key={id}
          item={selectItem}
          isSelected={inTarget}
          selectDisabled={!validTargetId || addBlanksMutation.isPending}
          onSelect={() => { if (validTargetId && !inTarget && !addBlanksMutation.isPending) onAddToCatalog(blankKey); }}
          selectLabel={validTargetId ? "Add" : undefined}
          selectedLabel={validTargetId ? "Added" : undefined}
          disableWhenSelected={!!validTargetId}
        />
      );
    },
    [sourceItemMap, allProductMap, catalogBlankSet, onAddToCatalog, validTargetId, resolveBlankKey, addBlanksMutation.isPending]
  );

  return (
    <div className="flex flex-col h-full">

      {/* Drag handle — mobile only */}
      <div className="sm:hidden flex justify-center pt-3 pb-1 flex-shrink-0">
        <div className="w-10 h-1 rounded-full bg-muted-foreground/30" />
      </div>

      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b flex-shrink-0">
        <Button size="icon" className="h-12 w-12" aria-label="Close blank picker" variant="ghost" onClick={() => onOpenChange(false)} data-testid="modal-blank-picker-close">
          <X className="h-4 w-4" />
        </Button>
        <DialogTitle className="text-base font-semibold">Add Blank to {targetName}</DialogTitle>
      </div>

      {/* Scrollable body — everything scrolls together */}
      <div className="flex-1 overflow-y-auto overscroll-contain">
        <div className="p-4 space-y-4">

          {/* Destination comes from Products; only the source is selected here. */}
          {catalogs.length > 0 && (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <p className="text-sm font-medium text-muted-foreground">Browse from:</p>
                <select
                  value={sourceCatalogId || ""}
                  onChange={e => setSourceCatalogId(e.target.value || null)}
                  className="w-full text-sm bg-background border rounded-md px-3 py-2.5"
                  data-testid="modal-select-source-catalog"
                >
                  <option value="">All Products</option>
                  {catalogs.filter(cat => cat.id !== targetCatalogId).map(cat => (
                    <option key={cat.id} value={cat.id}>{cat.name} ({cat.blankIds?.length || 0})</option>
                  ))}
                </select>
              </div>
            </div>
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
          {loadError ? (<Card className="p-4" role="alert"><p>Could not load blanks: {loadError}</p><Button onClick={reload}>Retry</Button></Card>) : loadingCatalog ? (
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

export function BlankPickerModal({ targetCatalogId, open, onOpenChange }: BlankPickerModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={[
          "p-0 overflow-hidden flex flex-col [&>button]:hidden",
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
        <BlankPickerInner targetCatalogId={targetCatalogId} onOpenChange={onOpenChange} />
      </DialogContent>
    </Dialog>
  );
}
