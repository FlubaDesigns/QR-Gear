import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Upload } from "lucide-react";

export interface UploadParams {
  name: string;
  imageData: string;
  mimeType: string;
  assetType?: string;
}

export interface ImageUploaderProps {
  onUploadSingle?: (params: UploadParams) => Promise<void>;
  onUploadZip?: (params: UploadParams) => Promise<{ extractedCount: number }>;
  onUploadComplete?: () => void;
  assetType?: string;
  title?: string;
  description?: string;
  showZipUpload?: boolean;
  showImageUpload?: boolean;
  acceptTypes?: string;
  maxSizeMB?: number;
}

export function ImageUploader({
  onUploadSingle,
  onUploadZip,
  onUploadComplete,
  assetType = "source",
  title = "Upload Images",
  description = "Upload images to your library",
  showZipUpload = true,
  showImageUpload = true,
  acceptTypes = "image/*",
  maxSizeMB = 25,
}: ImageUploaderProps) {
  const { toast } = useToast();
  const [uploading, setUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<string>("");

  const handleZipUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!onUploadZip) return;
    
    const file = e.target.files?.[0];
    if (!file || !file.name.endsWith(".zip")) {
      toast({ title: "Please select a ZIP file", variant: "destructive" });
      return;
    }

    setUploading(true);
    setUploadStatus("Uploading ZIP...");

    try {
      const reader = new FileReader();
      const base64 = await new Promise<string>((resolve, reject) => {
        reader.onload = () => resolve((reader.result as string).split(",")[1]);
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(file);
      });

      const result = await onUploadZip({
        name: file.name,
        imageData: base64,
        mimeType: "application/zip",
        assetType,
      });

      toast({ 
        title: "ZIP uploaded", 
        description: `${result.extractedCount} images extracted` 
      });
      onUploadComplete?.();

    } catch (error: unknown) {
      const err = error as Error;
      toast({ title: "Upload failed", description: err.message, variant: "destructive" });
    } finally {
      setUploading(false);
      setUploadStatus("");
      e.target.value = "";
    }
  };

  const handleSingleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!onUploadSingle) return;
    
    const files = e.target.files;
    if (!files?.length) return;

    setUploading(true);
    let successCount = 0;

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        
        if (file.size > maxSizeMB * 1024 * 1024) {
          toast({ 
            title: `File too large: ${file.name}`, 
            description: `Max size is ${maxSizeMB}MB`,
            variant: "destructive" 
          });
          continue;
        }

        setUploadStatus(`Uploading ${i + 1} of ${files.length}: ${file.name}`);

        const reader = new FileReader();
        const base64 = await new Promise<string>((resolve, reject) => {
          reader.onload = () => resolve((reader.result as string).split(",")[1]);
          reader.onerror = () => reject(reader.error);
          reader.readAsDataURL(file);
        });

        try {
          await onUploadSingle({
            name: file.name.replace(/\.[^/.]+$/, ""),
            imageData: base64,
            mimeType: file.type || "image/png",
            assetType,
          });
          successCount++;
        } catch {
          // Continue with next file
        }
      }

      toast({ title: `Uploaded ${successCount} of ${files.length} images` });
      onUploadComplete?.();

    } catch (error: unknown) {
      const err = error as Error;
      toast({ title: "Upload failed", description: err.message, variant: "destructive" });
    } finally {
      setUploading(false);
      setUploadStatus("");
      e.target.value = "";
    }
  };

  const showBothInputs = showZipUpload && showImageUpload && onUploadZip && onUploadSingle;

  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Upload className="h-5 w-5" />
          {title}
        </CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className={`grid gap-4 ${showBothInputs ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1'}`}>
          {showZipUpload && onUploadZip && (
            <div className="space-y-2">
              <Label htmlFor="zip-upload">ZIP File (Bulk)</Label>
              <Input 
                id="zip-upload" 
                type="file" 
                accept=".zip" 
                onChange={handleZipUpload} 
                disabled={uploading} 
                className="h-12" 
                data-testid="input-zip-upload" 
              />
            </div>
          )}
          {showImageUpload && onUploadSingle && (
            <div className="space-y-2">
              <Label htmlFor="images-upload">Individual Images</Label>
              <Input 
                id="images-upload" 
                type="file" 
                accept={acceptTypes}
                multiple 
                onChange={handleSingleUpload} 
                disabled={uploading} 
                className="h-12" 
                data-testid="input-images-upload" 
              />
            </div>
          )}
        </div>
        <p className="text-sm text-muted-foreground">
          Max {maxSizeMB}MB per image. Supported: JPG, PNG, WebP, HEIC
        </p>
        {uploading && (
          <div className="flex items-center gap-2 p-3 bg-muted rounded-md">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-sm">{uploadStatus}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
