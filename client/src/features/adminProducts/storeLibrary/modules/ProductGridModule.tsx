import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { CollapsibleModule } from "@/features/shared/components/CollapsibleModule";
import {
  StoreProductSkin,
  StoreProductItem,
  StoreProductViewToggle,
  StoreProductViewLayout,
} from "@/features/shared/components/skins/StoreProductSkin";
import { useStoreLibraryContext, ProductInfo } from "../StoreLibraryContext";
import { adminFetch } from "@/lib/adminFetch";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

function productToSkinItem(product: ProductInfo): StoreProductItem {
  return {
    id: product.id,
    name: product.name,
    imageUrl: product.imageUrl || "",
    subtitle: product.baseProductId ? `Product: ${product.baseProductId}` : undefined,
    colorCount: product.enabledColors?.length,
    sizes: product.enabledSizes,
    publishStatus: product.publishStatus ?? null,
    lastPublishedAt: product.lastPublishedAt ?? null,
    publishError: product.publishError ?? null,
    printifyProductId: product.printifyProductId ?? null,
  };
}

export function ProductGridModule() {
  const [viewLayout, setViewLayout] = useState<StoreProductViewLayout>("grid");
  const [pendingDeleteItem, setPendingDeleteItem] = useState<StoreProductItem | null>(null);
  const [republishingIds, setRepublishingIds] = useState<Set<string>>(new Set());

  const {
    selectedStore,
    selectedChannel,
    selectedProducts,
    addToSelection,
    removeFromSelection,
  } = useStoreLibraryContext();
  const { toast } = useToast();

  const productsQueryKey = `/api/admin/stores/${selectedStore?.id}/channels/${selectedChannel?.name}/products`;

  const { data: products = [], isLoading, error } = useQuery<ProductInfo[]>({
    queryKey: [productsQueryKey],
    enabled: !!selectedStore && !!selectedChannel?.name,
  });

  const deleteMutation = useMutation({
    mutationFn: (instanceId: string) =>
      adminFetch(`/catalog-instances/${instanceId}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [productsQueryKey] });
      toast({ title: "Item removed from store" });
      setPendingDeleteItem(null);
    },
    onError: (err: Error) => {
      toast({ title: "Delete failed", description: err.message, variant: "destructive" });
      setPendingDeleteItem(null);
    },
  });

  const republishMutation = useMutation({
    mutationFn: (instanceId: string) =>
      adminFetch(`/qrg/republish/${instanceId}`, { method: "POST" }),
    onMutate: (instanceId: string) => {
      setRepublishingIds((prev) => new Set(prev).add(instanceId));
    },
    onSuccess: (_data, instanceId) => {
      setRepublishingIds((prev) => {
        const next = new Set(prev);
        next.delete(instanceId);
        return next;
      });
      queryClient.invalidateQueries({ queryKey: [productsQueryKey] });
      toast({ title: "Republish queued", description: "The product is being synced to Printify." });
    },
    onError: (err: Error, instanceId) => {
      setRepublishingIds((prev) => {
        const next = new Set(prev);
        next.delete(instanceId);
        return next;
      });
      toast({ title: "Republish failed", description: err.message, variant: "destructive" });
    },
  });

  if (!selectedStore || !selectedChannel) {
    return null;
  }

  const selectedIds = new Set(selectedProducts.map((p) => p.id));

  const handleSelect = (item: StoreProductItem) => {
    const product = products.find((p) => p.id === item.id);
    if (!product) return;
    if (selectedIds.has(product.id)) {
      removeFromSelection(product.id);
    } else {
      addToSelection(product);
    }
  };

  const handleDeleteRequest = (item: StoreProductItem) => {
    setPendingDeleteItem(item);
  };

  const handleDeleteConfirm = () => {
    if (!pendingDeleteItem) return;
    deleteMutation.mutate(pendingDeleteItem.id);
  };

  const handleRepublish = (item: StoreProductItem) => {
    if (republishingIds.has(item.id)) return;
    republishMutation.mutate(item.id);
  };

  const skinItems = products.map(productToSkinItem);

  const viewToggle = (
    <StoreProductViewToggle layout={viewLayout} onChange={setViewLayout} />
  );

  return (
    <>
      <CollapsibleModule
        title="Products"
        badge={products.length > 0 ? `${products.length} items` : undefined}
        defaultOpen={true}
        headerRight={viewToggle}
      >
        {isLoading ? (
          <div className="flex items-center justify-center py-8" data-testid="loader-products">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : error ? (
          <div className="text-sm text-destructive p-2" data-testid="error-products">
            Failed to load products
          </div>
        ) : (
          <StoreProductSkin
            items={skinItems}
            selectedIds={selectedIds}
            onSelect={handleSelect}
            onDelete={handleDeleteRequest}
            onRepublish={handleRepublish}
            republishingIds={republishingIds}
            layout={viewLayout}
            onLayoutChange={setViewLayout}
            showViewToggle={false}
            gridHeight="400px"
            emptyMessage="No products assigned to this channel yet"
          />
        )}
      </CollapsibleModule>

      <AlertDialog
        open={!!pendingDeleteItem}
        onOpenChange={(open) => { if (!open) setPendingDeleteItem(null); }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove from store?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove <strong>{pendingDeleteItem?.name}</strong> from this channel. The
              underlying packet and template are not deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              data-testid="button-confirm-delete"
              className="bg-destructive text-destructive-foreground"
            >
              {deleteMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Remove"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
