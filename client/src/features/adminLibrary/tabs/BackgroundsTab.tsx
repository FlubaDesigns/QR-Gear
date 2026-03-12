import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Image as ImageIcon } from "lucide-react";
import { useLibraryContext } from "../LibraryContext";
import { CropUtility, type CropAsset } from "@/features/shared/components/utilities/CropUtility";
import { ScrollGridView } from "@/features/shared/components/views/ScrollGridView";
import { ItemModalView } from "@/features/shared/components/views/ModalView";
import type { GridViewItem } from "@/features/shared/components/views/index";
import { CropDeleteSkin } from "@/features/shared/components/skins/CropDeleteSkin";
import type { LibraryAssetWithProxy } from "../shared/types";
import { getImageUrl } from "../shared/imageUtils";

function assetToGridItem(asset: LibraryAssetWithProxy): GridViewItem {
  return {
    id: asset.id,
    name: asset.name,
    imageUrl: getImageUrl(asset),
  };
}

export default function BackgroundsTab() {
  const { api } = useLibraryContext();
  const { toast } = useToast();
  
  const [selectedItem, setSelectedItem] = useState<GridViewItem | null>(null);
  const [singleViewOpen, setSingleViewOpen] = useState(false);
  const [cropDialogOpen, setCropDialogOpen] = useState(false);
  const [assetToCrop, setAssetToCrop] = useState<CropAsset | null>(null);

  const { data: assets = [], isLoading } = useQuery<LibraryAssetWithProxy[]>({
    queryKey: api.getQueryKey("background"),
    queryFn: () => api.fetchAssets("background"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.deleteAsset(id),
    onSuccess: () => {
      toast({ title: "Image deleted" });
      api.invalidateAssets("background");
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

  const handleCrop = (id: string) => {
    const asset = assets.find(a => a.id === id);
    if (asset) {
      setAssetToCrop({
        id: asset.id,
        name: asset.name,
        imageUrl: getImageUrl(asset),
      });
      setSingleViewOpen(false);
      setCropDialogOpen(true);
    }
  };

  const handleSaveCrop = async (imageData: string, sourceAsset?: CropAsset) => {
    if (!sourceAsset) return;
    await api.uploadAsset({
      name: `cropped_${sourceAsset.name}`,
      assetType: "cropped",
      imageData,
      mimeType: "image/jpeg",
      sourceAssetId: sourceAsset.id,
    });
    api.invalidateAssets("cropped");
    api.invalidateAssets("background");
  };

  const handleDelete = (id: string) => {
    deleteMutation.mutate(id);
  };

  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold">{assets.length} Background Images</h3>
          <p className="text-sm text-muted-foreground">Archived originals from cropped source images</p>
        </div>
      </div>

      {assets.length === 0 && !isLoading ? (
        <div className="text-center py-12 bg-muted/30 rounded-lg">
          <ImageIcon className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <p className="text-muted-foreground" data-testid="text-no-backgrounds">
            No background images yet.
          </p>
          <p className="text-sm text-muted-foreground mt-1">
            Original images move here after cropping.
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
          emptyMessage="No background images yet."
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
        <CropDeleteSkin
          itemId={selectedItem?.id || ''}
          onCrop={handleCrop}
          onDelete={handleDelete}
          onClose={() => setSingleViewOpen(false)}
          isDeleting={deleteMutation.isPending}
        />
      </ItemModalView>

      <CropUtility
        asset={assetToCrop}
        open={cropDialogOpen}
        onOpenChange={(open) => {
          setCropDialogOpen(open);
          if (!open) setAssetToCrop(null);
        }}
        onSave={handleSaveCrop}
        fetchImageBlob={api.fetchImageBlob}
        aspectRatio={9 / 16}
        title="Crop Image"
      />
    </>
  );
}
