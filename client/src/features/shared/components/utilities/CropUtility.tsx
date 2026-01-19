import { useState, useRef, useCallback, useEffect } from "react";
import ReactCrop, { type Crop, centerCrop, makeAspectCrop } from "react-image-crop";
import "react-image-crop/dist/ReactCrop.css";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

export interface CropAsset {
  id: string;
  name: string;
  imageUrl: string;
}

export interface CropUtilityProps {
  asset: CropAsset | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (croppedImageData: string, sourceAsset: CropAsset) => Promise<void>;
  fetchImageBlob?: (url: string) => Promise<string>;
  aspectRatio?: number;
  title?: string;
}

export function CropUtility({ 
  asset, 
  open, 
  onOpenChange,
  onSave,
  fetchImageBlob,
  aspectRatio = 9 / 16,
  title = "Crop Image",
}: CropUtilityProps) {
  const { toast } = useToast();
  const [cropImageBlobUrl, setCropImageBlobUrl] = useState<string | null>(null);
  const [cropImageLoading, setCropImageLoading] = useState(false);
  const [cropSaving, setCropSaving] = useState(false);
  const cropImgRef = useRef<HTMLImageElement>(null);
  const [crop, setCrop] = useState<Crop | undefined>();

  const loadImage = useCallback(async (assetToLoad: CropAsset) => {
    setCrop(undefined);
    setCropImageBlobUrl(null);
    setCropImageLoading(true);
    try {
      if (fetchImageBlob) {
        const blobUrl = await fetchImageBlob(assetToLoad.imageUrl);
        setCropImageBlobUrl(blobUrl);
      } else {
        setCropImageBlobUrl(assetToLoad.imageUrl);
      }
    } catch (err) {
      console.error("[CropUtility] Failed to load image:", err);
      toast({ title: "Failed to load image", variant: "destructive" });
      onOpenChange(false);
    } finally {
      setCropImageLoading(false);
    }
  }, [fetchImageBlob, toast, onOpenChange]);

  useEffect(() => {
    if (open && asset && !cropImageBlobUrl && !cropImageLoading) {
      loadImage(asset);
    }
    if (!open) {
      if (cropImageBlobUrl && fetchImageBlob) {
        URL.revokeObjectURL(cropImageBlobUrl);
      }
      setCropImageBlobUrl(null);
      setCrop(undefined);
    }
  }, [open, asset, cropImageBlobUrl, cropImageLoading, loadImage, fetchImageBlob]);

  const onCropImageLoad = useCallback((e: React.SyntheticEvent<HTMLImageElement>) => {
    const { width, height } = e.currentTarget;
    const newCrop = centerCrop(makeAspectCrop({ unit: "%", width: 90 }, aspectRatio, width, height), width, height);
    setCrop(newCrop as Crop);
  }, [aspectRatio]);

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

      await onSave(imageData, asset);
      toast({ title: "Cropped image saved" });
      onOpenChange(false);
    } catch (error: unknown) {
      const err = error as Error;
      toast({ title: "Save failed", description: err.message, variant: "destructive" });
    } finally {
      setCropSaving(false);
    }
  };

  const aspectLabel = aspectRatio === 9/16 ? "9:16" : aspectRatio === 16/9 ? "16:9" : `${aspectRatio.toFixed(2)}`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>{title} ({aspectLabel} ratio)</DialogTitle>
        </DialogHeader>
        <div className="flex items-center justify-center min-h-[400px]">
          {cropImageLoading ? (
            <Loader2 className="h-8 w-8 animate-spin" />
          ) : cropImageBlobUrl ? (
            <ReactCrop crop={crop} onChange={(_, percentCrop) => setCrop(percentCrop)} aspect={aspectRatio}>
              <img ref={cropImgRef} src={cropImageBlobUrl} alt="Crop" onLoad={onCropImageLoad} style={{ maxHeight: "60vh" }} />
            </ReactCrop>
          ) : null}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} data-testid="button-crop-cancel">Cancel</Button>
          <Button onClick={handleSaveCrop} disabled={cropSaving || !crop} data-testid="button-crop-save">
            {cropSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Save Cropped Image
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
