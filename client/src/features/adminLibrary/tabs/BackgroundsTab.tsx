import { useQuery, useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Image as ImageIcon } from "lucide-react";
import { useLibraryContext } from "../LibraryContext";
import { AssetGrid } from "../components/AssetGrid";
import { SharedViewer } from "@/features/shared/components/SharedViewer";
import type { LibraryAssetWithProxy } from "../shared/types";

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

  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold">{assets.length} Background Images</h3>
          <p className="text-sm text-muted-foreground">Archived originals from cropped source images</p>
        </div>
      </div>

      <SharedViewer mode="grid">
        <AssetGrid
          assets={assets}
          isLoading={isLoading}
          emptyIcon={<ImageIcon className="h-12 w-12 mx-auto mb-4 opacity-50" />}
          emptyMessage="No background images yet."
          emptySubMessage="Original images move here after cropping."
          aspectRatio="square"
          actions={["delete"]}
          onDelete={(asset) => deleteMutation.mutate(asset.id)}
        />
      </SharedViewer>
    </>
  );
}
