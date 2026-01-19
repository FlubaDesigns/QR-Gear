import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { ImagePlus } from "lucide-react";
import { useLibraryContext } from "../LibraryContext";
import { ImageUploader } from "../components/ImageUploader";
import { CropDialog } from "../components/CropDialog";
import { ViewerEngine } from "@/features/shared/components/ViewerEngine";
import { SourceImageCardSkin, SourceImageDetailSkin } from "@/features/shared/components/skins";
import type { SkinItem } from "@/features/shared/components/skins/types";
import type { LibraryAssetWithProxy } from "../shared/types";
import { getImageUrl } from "../shared/imageUtils";

function assetToSkinItem(asset: LibraryAssetWithProxy): SkinItem {
  return {
    id: asset.id,
    name: asset.name,
    primaryImage: getImageUrl(asset),
    dimensions: asset.width && asset.height ? `${asset.width}x${asset.height}` : undefined,
  };
}

export default function SourceImagesTab() {
  const { api } = useLibraryContext();
  const { toast } = useToast();
  const [cropDialogOpen, setCropDialogOpen] = useState(false);
  const [assetToCrop, setAssetToCrop] = useState<LibraryAssetWithProxy | null>(null);

  const { data: assets = [], isLoading } = useQuery<LibraryAssetWithProxy[]>({
    queryKey: api.getQueryKey("source"),
    queryFn: () => api.fetchAssets("source"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.deleteAsset(id),
    onSuccess: () => {
      toast({ title: "Image deleted" });
      api.invalidateAssets("source");
    },
    onError: (error: Error) => {
      toast({ title: "Delete failed", description: error.message, variant: "destructive" });
    },
  });

  const skinItems = useMemo(() => assets.map(assetToSkinItem), [assets]);

  const handleCrop = (id: string) => {
    const asset = assets.find(a => a.id === id);
    if (asset) {
      setAssetToCrop(asset);
      setCropDialogOpen(true);
    }
  };

  const handleDelete = (id: string) => {
    deleteMutation.mutate(id);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <>
      <ImageUploader assetType="source" />

      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold">{assets.length} Source Images</h3>
      </div>

      {assets.length === 0 ? (
        <div className="text-center py-12 bg-muted/30 rounded-lg">
          <ImagePlus className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <p className="text-muted-foreground" data-testid="text-no-source">
            No source images uploaded yet.
          </p>
          <p className="text-sm text-muted-foreground mt-1">
            Upload a ZIP file or select images above.
          </p>
        </div>
      ) : (
        <ViewerEngine
          items={skinItems}
          CardSkin={SourceImageCardSkin}
          DetailSkin={SourceImageDetailSkin}
          actions={{
            onCrop: handleCrop,
            onDelete: handleDelete,
          }}
          isActionPending={deleteMutation.isPending}
          confirmAction={{
            type: "delete",
            title: "Delete this image?",
            description: "This will permanently delete this source image. This action cannot be undone.",
          }}
        />
      )}

      <CropDialog
        asset={assetToCrop}
        open={cropDialogOpen}
        onOpenChange={(open) => {
          setCropDialogOpen(open);
          if (!open) setAssetToCrop(null);
        }}
      />
    </>
  );
}
