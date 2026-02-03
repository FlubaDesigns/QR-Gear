import { useState, useRef, useCallback, useEffect } from "react";
import ReactCrop, { type Crop, centerCrop, makeAspectCrop } from "react-image-crop";
import "react-image-crop/dist/ReactCrop.css";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Upload, Crop as CropIcon, Maximize, Check, X } from "lucide-react";

export interface CropAsset {
  id: string;
  name: string;
  imageUrl: string;
}

export interface CropUtilityProps {
  asset?: CropAsset | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave?: (croppedImageData: string, sourceAsset?: CropAsset) => Promise<void>;
  onCropComplete?: (croppedImageUrl: string) => void;
  fetchImageBlob?: (url: string) => Promise<string>;
  aspectRatio?: number;
  title?: string;
  allowUpload?: boolean;
  allowCropToggle?: boolean;
}

function centerAspectCrop(mediaWidth: number, mediaHeight: number, aspect: number): Crop {
  return centerCrop(
    makeAspectCrop({ unit: "%", width: 90 }, aspect, mediaWidth, mediaHeight),
    mediaWidth,
    mediaHeight
  );
}

export function CropUtility({ 
  asset, 
  open, 
  onOpenChange,
  onSave,
  onCropComplete,
  fetchImageBlob,
  aspectRatio = 9 / 16,
  title = "Crop Image",
  allowUpload = false,
  allowCropToggle = false,
}: CropUtilityProps) {
  const { toast } = useToast();
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [imageLoading, setImageLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [useCrop, setUseCrop] = useState(true);
  const [crop, setCrop] = useState<Crop | undefined>();
  const imgRef = useRef<HTMLImageElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadAssetImage = useCallback(async (assetToLoad: CropAsset) => {
    setCrop(undefined);
    setImageSrc(null);
    setImageLoading(true);
    try {
      if (fetchImageBlob) {
        const blobUrl = await fetchImageBlob(assetToLoad.imageUrl);
        setImageSrc(blobUrl);
      } else {
        setImageSrc(assetToLoad.imageUrl);
      }
    } catch (err) {
      console.error("[CropUtility] Failed to load image:", err);
      toast({ title: "Failed to load image", variant: "destructive" });
      onOpenChange(false);
    } finally {
      setImageLoading(false);
    }
  }, [fetchImageBlob, toast, onOpenChange]);

  useEffect(() => {
    if (open && asset && !imageSrc && !imageLoading) {
      loadAssetImage(asset);
    }
    if (!open) {
      if (imageSrc && fetchImageBlob) {
        URL.revokeObjectURL(imageSrc);
      }
      setImageSrc(null);
      setCrop(undefined);
      setUseCrop(true);
    }
  }, [open, asset, imageSrc, imageLoading, loadAssetImage, fetchImageBlob]);

  const onSelectFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const reader = new FileReader();
      reader.addEventListener("load", () => {
        setImageSrc(reader.result?.toString() || "");
      });
      reader.readAsDataURL(e.target.files[0]);
    }
  };

  const onImageLoad = useCallback((e: React.SyntheticEvent<HTMLImageElement>) => {
    const { width, height } = e.currentTarget;
    if (useCrop) {
      setCrop(centerAspectCrop(width, height, aspectRatio));
    }
  }, [aspectRatio, useCrop]);

  const handleToggleCrop = (checked: boolean) => {
    setUseCrop(checked);
    if (checked && imgRef.current) {
      const { width, height } = imgRef.current;
      setCrop(centerAspectCrop(width, height, aspectRatio));
    } else {
      setCrop(undefined);
    }
  };

  const getCroppedImage = useCallback((): { dataUrl: string; blob: Promise<Blob | null> } | null => {
    if (!imgRef.current) return null;
    const image = imgRef.current;

    if (!useCrop || !crop) {
      return {
        dataUrl: imageSrc || "",
        blob: Promise.resolve(null),
      };
    }

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

    const dataUrl = canvas.toDataURL("image/jpeg", 0.92);
    const blob = new Promise<Blob | null>((resolve) => 
      canvas.toBlob((b) => resolve(b), "image/jpeg", 0.92)
    );

    return { dataUrl, blob };
  }, [crop, imageSrc, useCrop]);

  const handleConfirm = async () => {
    const result = getCroppedImage();
    if (!result) return;

    if (onCropComplete) {
      onCropComplete(result.dataUrl);
      onOpenChange(false);
      return;
    }

    if (onSave) {
      setSaving(true);
      try {
        const blob = await result.blob;
        if (!blob && useCrop) {
          toast({ title: "Failed to generate cropped image", variant: "destructive" });
          return;
        }

        let imageData: string;
        if (blob) {
          const reader = new FileReader();
          imageData = await new Promise<string>((resolve, reject) => {
            reader.onload = () => {
              const base64 = (reader.result as string).split(',')[1];
              resolve(base64);
            };
            reader.onerror = reject;
            reader.readAsDataURL(blob);
          });
        } else {
          imageData = result.dataUrl.split(',')[1] || result.dataUrl;
        }

        await onSave(imageData, asset || undefined);
        toast({ title: "Image saved" });
        onOpenChange(false);
      } catch (error: unknown) {
        const err = error as Error;
        toast({ title: "Save failed", description: err.message, variant: "destructive" });
      } finally {
        setSaving(false);
      }
    }
  };

  const aspectLabel = aspectRatio === 9/16 ? "9:16" : aspectRatio === 16/9 ? "16:9" : `${aspectRatio.toFixed(2)}`;
  const showUploadUI = allowUpload && !imageSrc && !asset;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>{title} {!showUploadUI && `(${aspectLabel} ratio)`}</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col items-center justify-center min-h-[300px]">
          {imageLoading ? (
            <Loader2 className="h-8 w-8 animate-spin" />
          ) : showUploadUI ? (
            <div className="w-full text-center">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={onSelectFile}
                className="hidden"
                data-testid="input-crop-upload"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="w-full min-h-48 border-2 border-dashed border-muted-foreground/30 rounded-xl flex flex-col items-center justify-center gap-4 hover:border-primary/50 hover:bg-muted/30 transition-colors cursor-pointer"
                data-testid="button-upload-image"
              >
                <Upload className="w-12 h-12 text-muted-foreground" />
                <div>
                  <p className="font-medium">Tap to upload your image</p>
                  <p className="text-sm text-muted-foreground">JPG, PNG, or GIF</p>
                </div>
              </button>
            </div>
          ) : imageSrc ? (
            <div className="w-full space-y-4">
              {allowCropToggle && (
                <div className="flex items-center justify-between gap-4 p-4 bg-muted/30 rounded-lg">
                  <div className="flex items-center gap-3">
                    {useCrop ? (
                      <CropIcon className="w-5 h-5 text-primary" />
                    ) : (
                      <Maximize className="w-5 h-5 text-muted-foreground" />
                    )}
                    <div>
                      <Label htmlFor="crop-toggle" className="font-medium cursor-pointer">
                        {useCrop ? `Crop for mobile (${aspectLabel})` : "Use full image"}
                      </Label>
                      <p className="text-xs text-muted-foreground">
                        {useCrop 
                          ? "Drag the box to select the area you want" 
                          : "Your entire image will be shown, scaled to fit"
                        }
                      </p>
                    </div>
                  </div>
                  <Switch
                    id="crop-toggle"
                    checked={useCrop}
                    onCheckedChange={handleToggleCrop}
                    data-testid="switch-crop-toggle"
                  />
                </div>
              )}

              <div className="relative rounded-lg overflow-hidden bg-black/10 flex items-center justify-center">
                {useCrop ? (
                  <ReactCrop
                    crop={crop}
                    onChange={(_, percentCrop) => setCrop(percentCrop)}
                    aspect={aspectRatio}
                    className="max-h-[60vh]"
                  >
                    <img
                      ref={imgRef}
                      src={imageSrc}
                      alt="Crop preview"
                      onLoad={onImageLoad}
                      className="max-w-full max-h-[60vh] mx-auto"
                      data-testid="img-crop-preview"
                    />
                  </ReactCrop>
                ) : (
                  <img
                    ref={imgRef}
                    src={imageSrc}
                    alt="Full preview"
                    onLoad={onImageLoad}
                    className="max-w-full max-h-[60vh] mx-auto"
                    data-testid="img-full-preview"
                  />
                )}
              </div>
            </div>
          ) : null}
        </div>

        <DialogFooter className="flex-row gap-2">
          <Button 
            variant="outline" 
            onClick={() => onOpenChange(false)} 
            className="flex-1 h-12"
            data-testid="button-crop-cancel"
          >
            <X className="h-4 w-4 mr-2" />
            Cancel
          </Button>
          {allowUpload && imageSrc && (
            <Button
              variant="outline"
              onClick={() => {
                setImageSrc(null);
                setCrop(undefined);
              }}
              className="flex-1 h-12"
              data-testid="button-choose-different"
            >
              Choose Different
            </Button>
          )}
          {imageSrc && (
            <Button 
              onClick={handleConfirm} 
              disabled={saving || (useCrop && !crop)} 
              className="flex-1 h-12"
              data-testid="button-crop-save"
            >
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              <Check className="h-4 w-4 mr-2" />
              {onSave ? "Save" : "Crop"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
