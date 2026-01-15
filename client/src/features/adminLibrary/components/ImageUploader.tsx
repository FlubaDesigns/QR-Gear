import { useState } from "react";
import { Nexus } from "@/lib/nexus";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Upload } from "lucide-react";
import { useLibraryContext } from "../LibraryContext";

interface ImageUploaderProps {
  assetType?: "source" | "cropped";
  onUploadComplete?: () => void;
}

export function ImageUploader({ assetType = "source", onUploadComplete }: ImageUploaderProps) {
  const { api } = useLibraryContext();
  const { toast } = useToast();
  const [uploading, setUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<string>("");

  const handleZipUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !file.name.endsWith(".zip")) {
      toast({ title: "Please select a ZIP file", variant: "destructive" });
      return;
    }

    setUploading(true);
    setUploadStatus("Uploading ZIP to server...");

    try {
      Nexus.info("ZIP_UPLOAD", `Sending ZIP to server: ${file.name}`);

      const reader = new FileReader();
      const base64 = await new Promise<string>((resolve, reject) => {
        reader.onload = () => resolve((reader.result as string).split(",")[1]);
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(file);
      });

      const result = await api.uploadZip({
        name: file.name,
        assetType,
        imageData: base64,
        mimeType: "application/zip",
      });

      Nexus.info("ZIP_UPLOAD", `Server extracted ${result.extractedCount} images`);
      toast({ 
        title: "ZIP uploaded successfully", 
        description: `${result.extractedCount} images extracted to library` 
      });

      api.invalidateAssets(assetType);
      onUploadComplete?.();

    } catch (error: unknown) {
      const err = error as Error;
      Nexus.captureError(err, "ZIP_UPLOAD");
      toast({ title: "Upload failed", description: err.message, variant: "destructive" });
    } finally {
      setUploading(false);
      setUploadStatus("");
      e.target.value = "";
    }
  };

  const handleSingleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files?.length) return;

    setUploading(true);
    let successCount = 0;

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        setUploadStatus(`Uploading ${i + 1} of ${files.length}: ${file.name}`);

        const reader = new FileReader();
        const base64 = await new Promise<string>((resolve, reject) => {
          reader.onload = () => resolve((reader.result as string).split(",")[1]);
          reader.onerror = () => reject(reader.error);
          reader.readAsDataURL(file);
        });

        try {
          await api.uploadAsset({
            name: file.name.replace(/\.[^/.]+$/, ""),
            assetType,
            imageData: base64,
            mimeType: file.type || "image/png",
          });
          successCount++;
        } catch {
          // Continue with next file
        }
      }

      toast({ title: `Uploaded ${successCount} of ${files.length} images` });
      api.invalidateAssets(assetType);
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

  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Upload className="h-5 w-5" />
          Upload Images
        </CardTitle>
        <CardDescription>
          ZIP files are extracted server-side. Original ZIP saved to archive.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
          <div className="space-y-2">
            <Label htmlFor="images-upload">Individual Images</Label>
            <Input 
              id="images-upload" 
              type="file" 
              accept="image/*" 
              multiple 
              onChange={handleSingleUpload} 
              disabled={uploading} 
              className="h-12" 
              data-testid="input-images-upload" 
            />
          </div>
        </div>
        <p className="text-sm text-muted-foreground">
          Max 25MB per image. Supported: JPG, PNG, WebP, HEIC
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
