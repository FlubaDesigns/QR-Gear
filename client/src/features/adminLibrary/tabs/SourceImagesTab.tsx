import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import { ImagePlus } from "lucide-react";
import { useLibraryContext } from "../LibraryContext";
import { AssetGrid } from "../components/AssetGrid";
import { ImageUploader } from "../components/ImageUploader";
import { CropDialog } from "../components/CropDialog";
import type { LibraryAssetWithProxy } from "../shared/types";

export default function SourceImagesTab() {
  const { apiBase, apiFetch } = useLibraryContext();
  const { toast } = useToast();
  const [cropDialogOpen, setCropDialogOpen] = useState(false);
  const [imageToCrop, setImageToCrop] = useState<LibraryAssetWithProxy | null>(null);

  const { data: assets = [], isLoading, refetch } = useQuery<LibraryAssetWithProxy[]>({
    queryKey: [`${apiBase}/admin/background-assets`, "source"],
    queryFn: async () => {
      const res = await apiFetch(`${apiBase}/admin/background-assets?type=source`);
      if (!res.ok) throw new Error(`Failed: ${res.status}`);
      return res.json();
    },
    staleTime: 0,
    retry: 2,
  });

  useEffect(() => { refetch(); }, [refetch]);

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiFetch(`${apiBase}/admin/background-assets/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error(`Delete failed: ${res.status}`);
    },
    onSuccess: () => {
      toast({ title: "Image deleted" });
      queryClient.invalidateQueries({ queryKey: [`${apiBase}/admin/background-assets`, "source"] });
    },
    onError: (error: Error) => {
      toast({ title: "Delete failed", description: error.message, variant: "destructive" });
    },
  });

  const handleOpenCrop = (asset: LibraryAssetWithProxy) => {
    setImageToCrop(asset);
    setCropDialogOpen(true);
  };

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
        onCrop={handleOpenCrop}
        onDelete={(asset) => deleteMutation.mutate(asset.id)}
      />

      <CropDialog
        asset={imageToCrop}
        open={cropDialogOpen}
        onOpenChange={(open) => {
          setCropDialogOpen(open);
          if (!open) setImageToCrop(null);
        }}
      />
    </>
  );
}
