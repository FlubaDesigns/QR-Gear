import { useQuery, useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Crop as CropIcon } from "lucide-react";
import { useLibraryContext } from "../LibraryContext";
import { AssetGrid } from "../components/AssetGrid";
import { SharedViewer } from "@/features/shared/components/SharedViewer";
import type { LibraryAssetWithProxy } from "../shared/types";

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

  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold">{assets.length} Cropped Images</h3>
          <p className="text-sm text-muted-foreground">9:16 cropped images ready for product design</p>
        </div>
      </div>

      <SharedViewer mode="grid">
        <AssetGrid
          assets={assets}
          isLoading={isLoading}
          emptyIcon={<CropIcon className="h-12 w-12 mx-auto mb-4 opacity-50" />}
          emptyMessage="No cropped images yet."
          emptySubMessage="Cropped images appear here after you crop source images."
          aspectRatio="portrait"
          actions={["delete"]}
          onDelete={(asset) => deleteMutation.mutate(asset.id)}
        />
      </SharedViewer>
    </>
  );
}
