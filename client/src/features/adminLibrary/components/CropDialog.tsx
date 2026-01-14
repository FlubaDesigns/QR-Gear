import { useState, useRef, useCallback } from "react";
import ReactCrop, { type Crop, centerCrop, makeAspectCrop } from "react-image-crop";
import "react-image-crop/dist/ReactCrop.css";
import { auth } from "@/lib/firebase";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import { Loader2 } from "lucide-react";
import { getImageSrc, fetchImageAsBlob } from "@/lib/imageLoader";
import { useLibraryContext } from "../LibraryContext";
import type { LibraryAssetWithProxy } from "../shared/types";

interface CropDialogProps {
  asset: LibraryAssetWithProxy | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CropDialog({ asset, open, onOpenChange }: CropDialogProps) {
  const { apiBase } = useLibraryContext();
  const { toast } = useToast();
  const [cropImageBlobUrl, setCropImageBlobUrl] = useState<string | null>(null);
  const [cropImageLoading, setCropImageLoading] = useState(false);
  const [cropSaving, setCropSaving] = useState(false);
  const cropImgRef = useRef<HTMLImageElement>(null);
  const [crop, setCrop] = useState<Crop | undefined>();

  const loadImage = useCallback(async (assetToLoad: LibraryAssetWithProxy) => {
    setCrop(undefined);
    setCropImageBlobUrl(null);
    setCropImageLoading(true);
    try {
      const url = await fetchImageAsBlob(getImageSrc(assetToLoad));
      setCropImageBlobUrl(url);
    } catch {
      toast({ title: "Failed to load image", variant: "destructive" });
      onOpenChange(false);
    } finally {
      setCropImageLoading(false);
    }
  }, [toast, onOpenChange]);

  const handleOpenChange = useCallback((newOpen: boolean) => {
    if (newOpen && asset) {
      loadImage(asset);
    } else if (!newOpen) {
      setCropImageBlobUrl(null);
      setCrop(undefined);
    }
    onOpenChange(newOpen);
  }, [asset, loadImage, onOpenChange]);

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
      const formData = new FormData();
      formData.append("file", blob, `cropped_${asset.name}`);
      formData.append("name", `cropped_${asset.name}`);
      formData.append("assetType", "cropped");
      formData.append("sourceAssetId", asset.id);
      const token = await auth.currentUser?.getIdToken();
      const response = await fetch(`${apiBase}/admin/background-assets`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || "Upload failed");
      }
      toast({ title: "Cropped image saved", description: "Image added to Cropped Images tab" });
      onOpenChange(false);
      queryClient.invalidateQueries({ queryKey: [`${apiBase}/admin/background-assets`, "cropped"] });
    } catch (error: unknown) {
      const err = error as Error;
      toast({ title: "Save failed", description: err.message, variant: "destructive" });
    } finally {
      setCropSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Crop Image (9:16 ratio)</DialogTitle>
        </DialogHeader>
        <div className="flex items-center justify-center min-h-[400px]">
          {cropImageLoading ? (
            <Loader2 className="h-8 w-8 animate-spin" />
          ) : cropImageBlobUrl ? (
            <ReactCrop crop={crop} onChange={(_, percentCrop) => setCrop(percentCrop)} aspect={9 / 16}>
              <img ref={cropImgRef} src={cropImageBlobUrl} alt="Crop" onLoad={onCropImageLoad} style={{ maxHeight: "60vh" }} />
            </ReactCrop>
          ) : null}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSaveCrop} disabled={cropSaving || !crop}>
            {cropSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Save Cropped Image
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
