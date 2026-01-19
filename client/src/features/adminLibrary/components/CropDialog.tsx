import { CropUtility, type CropAsset } from "@/features/shared/components/utilities/CropUtility";
import { useLibraryContext } from "../LibraryContext";
import { getImageUrl } from "../shared/imageUtils";
import type { LibraryAssetWithProxy } from "../shared/types";

interface CropDialogProps {
  asset: LibraryAssetWithProxy | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CropDialog({ asset, open, onOpenChange }: CropDialogProps) {
  const { api } = useLibraryContext();

  const cropAsset: CropAsset | null = asset ? {
    id: asset.id,
    name: asset.name,
    imageUrl: getImageUrl(asset),
  } : null;

  const handleSave = async (imageData: string, sourceAsset: CropAsset) => {
    await api.uploadAsset({
      name: `cropped_${sourceAsset.name}`,
      assetType: "cropped",
      imageData,
      mimeType: "image/jpeg",
      sourceAssetId: sourceAsset.id,
    });
    api.invalidateAssets("source");
    api.invalidateAssets("cropped");
    api.invalidateAssets("background");
  };

  return (
    <CropUtility
      asset={cropAsset}
      open={open}
      onOpenChange={onOpenChange}
      onSave={handleSave}
      fetchImageBlob={api.fetchImageBlob}
      aspectRatio={9 / 16}
      title="Crop Image"
    />
  );
}
