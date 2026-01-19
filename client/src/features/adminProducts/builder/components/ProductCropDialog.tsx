import { useState, useRef, useCallback, useEffect } from "react";
import ReactCrop, { type Crop, centerCrop, makeAspectCrop } from "react-image-crop";
import "react-image-crop/dist/ReactCrop.css";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useAdminAuth } from "@/features/shared/AdminAuthContext";
import { Loader2 } from "lucide-react";

interface BackgroundAsset {
  id: string;
  name: string;
  storageUrl: string;
  proxyUrl?: string;
  thumbnailUrl?: string;
}

interface ProductCropDialogProps {
  asset: BackgroundAsset | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCropComplete?: () => void;
}

export function ProductCropDialog({ asset, open, onOpenChange, onCropComplete }: ProductCropDialogProps) {
  const { toast } = useToast();
  const { apiBase } = useAdminAuth();
  const [cropImageBlobUrl, setCropImageBlobUrl] = useState<string | null>(null);
  const [cropImageLoading, setCropImageLoading] = useState(false);
  const [cropSaving, setCropSaving] = useState(false);
  const cropImgRef = useRef<HTMLImageElement>(null);
  const [crop, setCrop] = useState<Crop | undefined>();

  const loadImage = useCallback(async (assetToLoad: BackgroundAsset) => {
    setCrop(undefined);
    setCropImageBlobUrl(null);
    setCropImageLoading(true);
    try {
      const imageUrl = assetToLoad.proxyUrl || assetToLoad.storageUrl;
      const response = await fetch(imageUrl);
      if (!response.ok) throw new Error("Failed to fetch image");
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      setCropImageBlobUrl(blobUrl);
    } catch (err) {
      console.error("[ProductCropDialog] Failed to load image:", err);
      toast({ title: "Failed to load image", variant: "destructive" });
      onOpenChange(false);
    } finally {
      setCropImageLoading(false);
    }
  }, [toast, onOpenChange]);

  useEffect(() => {
    if (open && asset && !cropImageBlobUrl && !cropImageLoading) {
      loadImage(asset);
    }
    if (!open) {
      if (cropImageBlobUrl) {
        URL.revokeObjectURL(cropImageBlobUrl);
      }
      setCropImageBlobUrl(null);
      setCrop(undefined);
    }
  }, [open, asset, cropImageBlobUrl, cropImageLoading, loadImage]);

  const onCropImageLoad = useCallback((e: React.SyntheticEvent<HTMLImageElement>) => {
    const { width, height } = e.currentTarget;
    const newCrop = centerCrop(makeAspectCrop({ unit: "%", width: 90 }, 9 / 16, width, height), width, height);
    setCrop(newCrop as Crop);
  }, []);

  const getCroppedImageBlob = useCallback(async (): Promise<Blob | null> => {
    if (!cropImgRef.current || !crop) return null;
    const image = cropImgRef.current;
    const canvas = document.createElement("canvas");
    const scaleX = image.naturalWidth / image.width;
    const scaleY = image.naturalHeight / image.height;
    const cropX = (crop.x / 100) * image.width * scaleX;
    const cropY = (crop.y / 100) * image.height * scaleY;
    const cropWidth = (crop.width / 100) * image.width * scaleX;
    const cropHeight = (crop.height / 100) * image.height * scaleY;
    canvas.width = cropWidth;
    canvas.height = cropHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(image, cropX, cropY, cropWidth, cropHeight, 0, 0, cropWidth, cropHeight);
    return new Promise((resolve) => canvas.toBlob((blob) => resolve(blob), "image/jpeg", 0.92));
  }, [crop]);

  const handleSaveCrop = async () => {
    if (!asset || !crop) return;
    setCropSaving(true);
    try {
      const blob = await getCroppedImageBlob();
      if (!blob) {
        toast({ title: "Failed to generate cropped image", variant: "destructive" });
        return;
      }
      const reader = new FileReader();
      const base64Promise = new Promise<string>((resolve, reject) => {
        reader.onload = () => {
          const result = reader.result as string;
          const base64 = result.split(',')[1];
          resolve(base64);
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
      const imageData = await base64Promise;

      const response = await fetch(`${apiBase}/background-assets`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: `cropped_${asset.name}`,
          assetType: "cropped",
          imageData,
          mimeType: "image/jpeg",
          sourceAssetId: asset.id,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to save cropped image");
      }

      toast({ title: "Cropped image saved", description: "Image is now ready to use" });
      onCropComplete?.();
    } catch (error: unknown) {
      const err = error as Error;
      toast({ title: "Save failed", description: err.message, variant: "destructive" });
    } finally {
      setCropSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Crop Image (9:16 ratio)</DialogTitle>
        </DialogHeader>
        <div className="flex items-center justify-center min-h-[400px]">
          {cropImageLoading ? (
            <Loader2 className="h-8 w-8 animate-spin" data-testid="loader-crop" />
          ) : cropImageBlobUrl ? (
            <ReactCrop crop={crop} onChange={(_, percentCrop) => setCrop(percentCrop)} aspect={9 / 16}>
              <img ref={cropImgRef} src={cropImageBlobUrl} alt="Crop" onLoad={onCropImageLoad} style={{ maxHeight: "60vh" }} />
            </ReactCrop>
          ) : null}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} className="min-h-12" data-testid="button-cancel-crop">
            Cancel
          </Button>
          <Button onClick={handleSaveCrop} disabled={cropSaving || !crop} className="min-h-12" data-testid="button-save-crop">
            {cropSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Save Cropped Image
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
