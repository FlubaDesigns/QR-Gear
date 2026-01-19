import { useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Image as ImageIcon } from "lucide-react";
import { useLibraryContext } from "../LibraryContext";
import { ViewerEngine } from "@/features/shared/components/ViewerEngine";
import { BackgroundCardSkin, BackgroundDetailSkin } from "@/features/shared/components/skins";
import type { SkinItem } from "@/features/shared/components/skins/types";
import type { LibraryAssetWithProxy } from "../shared/types";
import { getImageUrl } from "../shared/imageUtils";

function assetToSkinItem(asset: LibraryAssetWithProxy): SkinItem {
  return {
    id: asset.id,
    name: asset.name,
    primaryImage: getImageUrl(asset),
  };
}

export default function BackgroundsTab() {
  const { api } = useLibraryContext();
  const { toast } = useToast();

  const { data: assets = [], isLoading } = useQuery<LibraryAssetWithProxy[]>({
    queryKey: api.getQueryKey("background"),
    queryFn: () => api.fetchAssets("background"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.deleteAsset(id),
    onSuccess: () => {
      toast({ title: "Image deleted" });
      api.invalidateAssets("background");
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
          <h3 className="text-lg font-semibold">{assets.length} Background Images</h3>
          <p className="text-sm text-muted-foreground">Archived originals from cropped source images</p>
        </div>
      </div>

      {assets.length === 0 ? (
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
        <ViewerEngine
          items={skinItems}
          CardSkin={BackgroundCardSkin}
          DetailSkin={BackgroundDetailSkin}
          actions={{
            onDelete: handleDelete,
          }}
          isActionPending={deleteMutation.isPending}
          confirmAction={{
            type: "delete",
            title: "Delete this background?",
            description: "This will permanently delete this background image. This action cannot be undone.",
          }}
        />
      )}
    </>
  );
}
