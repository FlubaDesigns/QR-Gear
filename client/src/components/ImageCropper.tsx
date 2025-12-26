import { useState, useRef, useCallback } from "react";
import ReactCrop, { type Crop, centerCrop, makeAspectCrop } from "react-image-crop";
import "react-image-crop/dist/ReactCrop.css";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Upload, Check, X, Crop as CropIcon, Maximize } from "lucide-react";

interface ImageCropperProps {
  onCropComplete: (croppedImageUrl: string) => void;
  onCancel?: () => void;
  aspectRatio?: number;
  defaultAspectRatio?: number;
}

function centerAspectCrop(
  mediaWidth: number,
  mediaHeight: number,
  aspect: number
): Crop {
  return centerCrop(
    makeAspectCrop(
      {
        unit: "%",
        width: 90,
      },
      aspect,
      mediaWidth,
      mediaHeight
    ),
    mediaWidth,
    mediaHeight
  );
}

export default function ImageCropper({
  onCropComplete,
  onCancel,
  defaultAspectRatio = 9 / 16,
}: ImageCropperProps) {
  const [imgSrc, setImgSrc] = useState("");
  const [crop, setCrop] = useState<Crop>();
  const [useCrop, setUseCrop] = useState(true);
  const imgRef = useRef<HTMLImageElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const onSelectFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const reader = new FileReader();
      reader.addEventListener("load", () => {
        setImgSrc(reader.result?.toString() || "");
      });
      reader.readAsDataURL(e.target.files[0]);
    }
  };

  const onImageLoad = useCallback(
    (e: React.SyntheticEvent<HTMLImageElement>) => {
      const { width, height } = e.currentTarget;
      if (useCrop) {
        setCrop(centerAspectCrop(width, height, defaultAspectRatio));
      }
    },
    [defaultAspectRatio, useCrop]
  );

  const handleToggleCrop = (checked: boolean) => {
    setUseCrop(checked);
    if (checked && imgRef.current) {
      const { width, height } = imgRef.current;
      setCrop(centerAspectCrop(width, height, defaultAspectRatio));
    } else {
      setCrop(undefined);
    }
  };

  const getCroppedImg = useCallback((): string => {
    if (!imgRef.current) return "";

    const image = imgRef.current;
    
    if (!useCrop || !crop) {
      return imgSrc;
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
    if (!ctx) return "";

    ctx.drawImage(
      image,
      cropX,
      cropY,
      cropWidth,
      cropHeight,
      0,
      0,
      cropWidth,
      cropHeight
    );

    return canvas.toDataURL("image/jpeg", 0.9);
  }, [crop, imgSrc, useCrop]);

  const handleConfirm = () => {
    const result = getCroppedImg();
    if (result) {
      onCropComplete(result);
    }
  };

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardContent className="p-6">
        {!imgSrc ? (
          <div className="text-center">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={onSelectFile}
              className="hidden"
              data-testid="input-image-upload"
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
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-4 p-4 bg-muted/30 rounded-lg">
              <div className="flex items-center gap-3">
                {useCrop ? (
                  <CropIcon className="w-5 h-5 text-primary" />
                ) : (
                  <Maximize className="w-5 h-5 text-muted-foreground" />
                )}
                <div>
                  <Label htmlFor="crop-toggle" className="font-medium cursor-pointer">
                    {useCrop ? "Crop for mobile (9:16)" : "Use full image"}
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    {useCrop 
                      ? "Drag the white box to select the area you want" 
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

            <div className="relative rounded-lg overflow-hidden bg-black/10">
              {useCrop ? (
                <ReactCrop
                  crop={crop}
                  onChange={(_, percentCrop) => setCrop(percentCrop)}
                  aspect={defaultAspectRatio}
                  className="max-h-[60vh]"
                >
                  <img
                    ref={imgRef}
                    src={imgSrc}
                    alt="Upload preview"
                    onLoad={onImageLoad}
                    className="max-w-full max-h-[60vh] mx-auto"
                    data-testid="img-crop-preview"
                  />
                </ReactCrop>
              ) : (
                <img
                  ref={imgRef}
                  src={imgSrc}
                  alt="Upload preview"
                  onLoad={onImageLoad}
                  className="max-w-full max-h-[60vh] mx-auto"
                  data-testid="img-full-preview"
                />
              )}
            </div>

            <div className="flex gap-3">
              {onCancel && (
                <Button
                  variant="outline"
                  onClick={onCancel}
                  className="flex-1 min-h-12"
                  data-testid="button-cancel-crop"
                >
                  <X className="w-4 h-4 mr-2" />
                  Cancel
                </Button>
              )}
              <Button
                onClick={() => {
                  setImgSrc("");
                  setCrop(undefined);
                }}
                variant="outline"
                className="flex-1 min-h-12"
                data-testid="button-choose-different"
              >
                Choose Different
              </Button>
              <Button
                onClick={handleConfirm}
                className="flex-1 min-h-12"
                data-testid="button-confirm-image"
              >
                <Check className="w-4 h-4 mr-2" />
                Use This Image
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
