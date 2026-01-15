import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { ImagePlus } from "lucide-react";
import { useLibraryContext } from "../LibraryContext";
import { AssetGrid } from "../components/AssetGrid";
import { ImageUploader } from "../components/ImageUploader";
import { CropDialog } from "../components/CropDialog";
import type { LibraryAssetWithProxy } from "../shared/types";

export default function SourceImagesTab() {
  const { api } = useLibraryContext();
  const { toast } = useToast();
  const [cropDialogOpen, setCropDialogOpen] = useState(false);
  const [imageToCrop, setImageToCrop] = useState<LibraryAssetWithProxy | null>(null);

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

  return (
    <>
      <ImageUploader assetType="source" />

      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold">{assets.length} Source Images</h3>
      </div>

      <AssetGrid
        assets={assets}
        isLoading={isLoading}
        emptyIcon={<ImagePlus className="h-12 w-12 mx-auto mb-4 opacity-50" />}
        emptyMessage="No source images uploaded yet."
        emptySubMessage="Upload a ZIP file or select images above."
        aspectRatio="square"
        actions={["crop", "delete"]}
        onCrop={(asset) => { setImageToCrop(asset); setCropDialogOpen(true); }}
        onDelete={(asset) => deleteMutation.mutate(asset.id)}
      />

      <CropDialog
        asset={imageToCrop}
        open={cropDialogOpen}
        onOpenChange={(open) => { setCropDialogOpen(open); if (!open) setImageToCrop(null); }}
      />
    </>
  );
}
