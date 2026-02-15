import { useState, useMemo, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useLibraryContext } from "../LibraryContext";
import { ImageUploader } from "@/features/shared/components/utilities/ImageUploader";
import { CropUtility, type CropAsset } from "@/features/shared/components/utilities/CropUtility";
import { GridView, type GridViewItem } from "@/features/shared/components/views/GridView";
import { SingleView } from "@/features/shared/components/views/SingleView";
import { CropDeleteSkin } from "@/features/shared/components/skins/CropDeleteSkin";
import type { LibraryAssetWithProxy } from "../shared/types";
import { getImageUrl } from "../shared/imageUtils";

function assetToGridItem(asset: LibraryAssetWithProxy): GridViewItem {
  return {
    id: asset.id,
    name: asset.name,
    imageUrl: getImageUrl(asset),
    dimensions: asset.width && asset.height ? `${asset.width}x${asset.height}` : undefined,
  };
}

export default function SourceImagesTab() {
  const { api } = useLibraryContext();
  const { toast } = useToast();
  
  const [selectedItem, setSelectedItem] = useState<GridViewItem | null>(null);
  const [singleViewOpen, setSingleViewOpen] = useState(false);
  const [cropDialogOpen, setCropDialogOpen] = useState(false);
  const [assetToCrop, setAssetToCrop] = useState<CropAsset | null>(null);

  const { data: assets = [], isLoading } = useQuery<LibraryAssetWithProxy[]>({
    queryKey: api.getQueryKey("source"),
    queryFn: () => api.fetchAssets("source"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.deleteAsset(id),
    onSuccess: () => {
      toast({ title: "Image deleted" });
      api.invalidateAssets("source");
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

  const handleCropComplete = useCallback((croppedDataUrl: string) => {
    if (!assetToCrop) return;
    const sourceAsset = assetToCrop;
    setCropDialogOpen(false);
    setAssetToCrop(null);

    const imageData = croppedDataUrl.includes(',')
      ? croppedDataUrl.split(',')[1]
      : croppedDataUrl;

    toast({ title: "Saving cropped image..." });
    api.uploadAsset({
      name: `cropped_${sourceAsset.name}`,
      assetType: "cropped",
      imageData,
      mimeType: "image/jpeg",
      sourceAssetId: sourceAsset.id,
    }).then(() => {
      toast({ title: "Cropped image saved" });
      api.invalidateAssets("source");
      api.invalidateAssets("cropped");
      api.invalidateAssets("background");
    }).catch((err: Error) => {
      toast({ title: "Save failed", description: err.message, variant: "destructive" });
    });
  }, [assetToCrop, api, toast]);

  const handleDelete = (id: string) => {
    deleteMutation.mutate(id);
  };

  const handleUploadSingle = async (params: { name: string; imageData: string; mimeType: string }) => {
    await api.uploadAsset({
      name: params.name,
      assetType: "source",
      imageData: params.imageData,
      mimeType: params.mimeType,
    });
    api.invalidateAssets("source");
  };

  const handleUploadZip = async (params: { name: string; imageData: string; mimeType: string }) => {
    const result = await api.uploadZip({
      name: params.name,
      assetType: "source",
      imageData: params.imageData,
      mimeType: params.mimeType,
    });
    api.invalidateAssets("source");
    return result;
  };

  return (
    <>
      <ImageUploader
        onUploadSingle={handleUploadSingle}
        onUploadZip={handleUploadZip}
        title="Upload Source Images"
        description="ZIP files are extracted server-side. Original ZIP saved to archive."
      />

      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold">{assets.length} Source Images</h3>
      </div>

      <GridView
        items={gridItems}
        onSelect={handleSelect}
        isLoading={isLoading}
        emptyMessage="No source images uploaded yet."
      />

      <SingleView
        item={selectedItem ? {
          id: selectedItem.id,
          name: selectedItem.name,
          imageUrl: selectedItem.imageUrl,
          dimensions: selectedItem.dimensions,
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
      </SingleView>

      <CropUtility
        asset={assetToCrop}
        open={cropDialogOpen}
        onOpenChange={(open) => {
          setCropDialogOpen(open);
          if (!open) setAssetToCrop(null);
        }}
        onCropComplete={handleCropComplete}
        fetchImageBlob={api.fetchImageBlob}
        aspectRatio={9 / 16}
        title="Crop Image"
        allowCropToggle={false}
      />
    </>
  );
}
