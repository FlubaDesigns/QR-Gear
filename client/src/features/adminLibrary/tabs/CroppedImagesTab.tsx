import { useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import { Crop as CropIcon } from "lucide-react";
import { useLibraryContext } from "../LibraryContext";
import { AssetGrid } from "../components/AssetGrid";
import type { LibraryAssetWithProxy } from "../shared/types";

export default function CroppedImagesTab() {
  const { api, apiBase } = useLibraryContext();
  const { toast } = useToast();

  const { data: assets = [], isLoading, refetch } = useQuery<LibraryAssetWithProxy[]>({
    queryKey: [apiBase, "assets", "cropped"],
    queryFn: () => api.fetchAssets("cropped"),
    staleTime: 0,
    retry: 2,
  });

  useEffect(() => { refetch(); }, [refetch]);

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.deleteAsset(id),
    onSuccess: () => {
      toast({ title: "Image deleted" });
      queryClient.invalidateQueries({ queryKey: [apiBase, "assets", "cropped"] });
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
    </>
  );
}
