import { useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Crop as CropIcon } from "lucide-react";
import { useLibraryContext } from "../LibraryContext";
import { SkinGridViewer } from "@/features/shared/components/SkinGridViewer";
import { CroppedImageCardSkin, CroppedImageDetailSkin } from "@/features/shared/components/skins";
import type { SkinItem } from "@/features/shared/components/skins/types";
import type { LibraryAssetWithProxy } from "../shared/types";
import { getImageUrl } from "../shared/imageUtils";

function assetToSkinItem(asset: LibraryAssetWithProxy): SkinItem {
  return {
    id: asset.id,
    name: asset.name,
    primaryImage: getImageUrl(asset),
    isUsed: asset.isActive ?? undefined,
  };
}

export default function CroppedImagesTab() {
  const { api } = useLibraryContext();
  const { toast } = useToast();

  const { data: assets = [], isLoading } = useQuery<LibraryAssetWithProxy[]>({
    queryKey: api.getQueryKey("cropped"),
    queryFn: () => api.fetchAssets("cropped"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.deleteAsset(id),
    onSuccess: () => {
      toast({ title: "Image deleted" });
      api.invalidateAssets("cropped");
    },
    onError: (error: Error) => {
      toast({ title: "Delete failed", description: error.message, variant: "destructive" });
    },
  });

  const skinItems = useMemo(() => assets.map(assetToSkinItem), [assets]);

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
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold">{assets.length} Cropped Images</h3>
          <p className="text-sm text-muted-foreground">9:16 cropped images ready for product design</p>
        </div>
      </div>

      {assets.length === 0 ? (
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
        <SkinGridViewer
          items={skinItems}
          CardSkin={CroppedImageCardSkin}
          DetailSkin={CroppedImageDetailSkin}
          actions={{
            onDelete: handleDelete,
          }}
          isActionPending={deleteMutation.isPending}
          confirmAction={{
            type: "delete",
            title: "Delete this cropped image?",
            description: "This will permanently delete this cropped image. This action cannot be undone.",
          }}
        />
      )}
    </>
  );
}
