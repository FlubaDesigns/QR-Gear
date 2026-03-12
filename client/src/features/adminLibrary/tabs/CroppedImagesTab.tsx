import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Crop as CropIcon } from "lucide-react";
import { useLibraryContext } from "../LibraryContext";
import { ScrollGridView } from "@/features/shared/components/views/ScrollGridView";
import { ItemModalView } from "@/features/shared/components/views/ModalView";
import type { GridViewItem } from "@/features/shared/components/views/index";
import { DeleteSkin } from "@/features/shared/components/skins/DeleteSkin";
import type { LibraryAssetWithProxy } from "../shared/types";
import { getImageUrl } from "../shared/imageUtils";

function assetToGridItem(asset: LibraryAssetWithProxy): GridViewItem {
  return {
    id: asset.id,
    name: asset.name,
    imageUrl: getImageUrl(asset),
  };
}

export default function CroppedImagesTab() {
  const { api } = useLibraryContext();
  const { toast } = useToast();
  
  const [selectedItem, setSelectedItem] = useState<GridViewItem | null>(null);
  const [singleViewOpen, setSingleViewOpen] = useState(false);

  const { data: assets = [], isLoading } = useQuery<LibraryAssetWithProxy[]>({
    queryKey: api.getQueryKey("cropped"),
    queryFn: () => api.fetchAssets("cropped"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.deleteAsset(id),
    onSuccess: () => {
      toast({ title: "Image deleted" });
      api.invalidateAssets("cropped");
      setSingleViewOpen(false);
      setSelectedItem(null);
    },
    onError: (error: Error) => {
      toast({ title: "Delete failed", description: error.message, variant: "destructive" });
    },
  });

  const gridItems = useMemo(() => assets.map(assetToGridItem), [assets]);

  const handleSelect = (item: GridViewItem) => {
    setSelectedItem(item);
    setSingleViewOpen(true);
  };

  const handleDelete = (id: string) => {
    deleteMutation.mutate(id);
  };

  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold">{assets.length} Cropped Images</h3>
          <p className="text-sm text-muted-foreground">9:16 cropped images ready for product design</p>
        </div>
      </div>

      {assets.length === 0 && !isLoading ? (
        <div className="text-center py-12 bg-muted/30 rounded-lg">
          <CropIcon className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <p className="text-muted-foreground" data-testid="text-no-cropped">
            No cropped images yet.
          </p>
          <p className="text-sm text-muted-foreground mt-1">
            Cropped images appear here after you crop source images.
          </p>
        </div>
      ) : (
        <ScrollGridView
          items={gridItems}
          renderItem={(item) => (
            <div
              className="relative rounded-lg overflow-hidden cursor-pointer hover:ring-2 hover:ring-white/50 transition-all"
              onClick={() => handleSelect(item)}
              data-testid={`card-grid-item-${item.id}`}
            >
              <img src={item.imageUrl} alt="" className="w-full h-auto" />
            </div>
          )}
          isLoading={isLoading}
          emptyMessage="No cropped images yet."
          columns="grid-cols-2 sm:grid-cols-3"
          height="auto"
          footer={null}
        />
      )}

      <ItemModalView
        item={selectedItem ? {
          id: selectedItem.id,
          name: selectedItem.name,
          imageUrl: selectedItem.imageUrl,
        } : null}
        open={singleViewOpen}
        onOpenChange={setSingleViewOpen}
      >
        <DeleteSkin
          itemId={selectedItem?.id || ''}
          onDelete={handleDelete}
          onClose={() => setSingleViewOpen(false)}
          isDeleting={deleteMutation.isPending}
        />
      </ItemModalView>
    </>
  );
}
