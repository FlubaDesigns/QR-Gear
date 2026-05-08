import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Upload } from "lucide-react";

export interface UploadParams {
  name: string;
  originalFilename: string;
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
  maxSizeMB = 50,
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

    const fileName = file.name;
    const blobUrl = URL.createObjectURL(file);
    e.target.value = "";

    let base64: string;
    try {
      console.log("[ImageUploader] Reading ZIP from blob URL:", fileName);
      const resp = await fetch(blobUrl);
      const arrayBuffer = await resp.arrayBuffer();
      base64 = arrayBufferToBase64(arrayBuffer);
      console.log("[ImageUploader] ZIP read complete, base64 length:", base64.length);
    } catch (readErr) {
      console.error("[ImageUploader] ZIP read failed:", readErr);
      toast({ title: "Could not read file", description: "Try selecting the file again", variant: "destructive" });
      return;
    } finally {
      URL.revokeObjectURL(blobUrl);
    }

    setUploading(true);
    setUploadStatus("Uploading ZIP...");

    try {
      const result = await onUploadZip({
        name: fileName,
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
    }
  };

  const arrayBufferToBase64 = (buffer: ArrayBuffer): string => {
    const bytes = new Uint8Array(buffer);
    let binary = "";
    const chunkSize = 8192;
    for (let i = 0; i < bytes.length; i += chunkSize) {
      const chunk = bytes.subarray(i, Math.min(i + chunkSize, bytes.length));
      binary += String.fromCharCode(...Array.from(chunk));
    }
    return btoa(binary);
  };

  const readViaFileReader = (file: File): Promise<ArrayBuffer> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as ArrayBuffer);
      reader.onerror = () => reject(reader.error || new Error("FileReader failed"));
      reader.readAsArrayBuffer(file);
    });
  };

  const readViaBlobUrl = async (file: File): Promise<ArrayBuffer> => {
    const url = URL.createObjectURL(file);
    try {
      const resp = await fetch(url);
      return await resp.arrayBuffer();
    } finally {
      URL.revokeObjectURL(url);
    }
  };

  const readFileAsBase64 = async (file: File): Promise<{ name: string; base64: string; mimeType: string }> => {
    let arrayBuffer: ArrayBuffer | null = null;

    try {
      arrayBuffer = await file.arrayBuffer();
      console.log("[ImageUploader] Read via arrayBuffer() for", file.name);
    } catch (err1) {
      console.warn("[ImageUploader] arrayBuffer() failed for", file.name, "trying FileReader...", err1 instanceof Error ? err1.message : err1);
      try {
        arrayBuffer = await readViaFileReader(file);
        console.log("[ImageUploader] Read via FileReader for", file.name);
      } catch (err2) {
        console.warn("[ImageUploader] FileReader failed for", file.name, "trying blob URL...", err2 instanceof Error ? err2.message : err2);
        try {
          arrayBuffer = await readViaBlobUrl(file);
          console.log("[ImageUploader] Read via blob URL for", file.name);
        } catch (err3) {
          console.error("[ImageUploader] All read methods failed for", file.name, err3 instanceof Error ? err3.message : err3);
          throw new Error(`Could not read ${file.name}. Please try selecting the file again.`);
        }
      }
    }

    const base64 = arrayBufferToBase64(arrayBuffer);
    console.log("[ImageUploader] Read complete for", file.name, "base64 length:", base64.length);
    return { name: file.name, base64, mimeType: file.type || "image/png" };
  };

  const handleSingleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!onUploadSingle) return;
    
    const files = e.target.files;
    if (!files?.length) return;

    console.log("[ImageUploader] Starting upload of", files.length, "files");

    const tooLarge: string[] = [];
    const validFiles: File[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      console.log("[ImageUploader] Capturing file:", file.name, "size:", file.size, "type:", file.type);
      if (file.size > maxSizeMB * 1024 * 1024) {
        console.warn("[ImageUploader] File too large:", file.name, file.size);
        tooLarge.push(file.name);
        continue;
      }
      validFiles.push(file);
    }

    const readResults: { name: string; base64: string; mimeType: string }[] = [];
    for (const file of validFiles) {
      try {
        const result = await readFileAsBase64(file);
        readResults.push(result);
      } catch (readErr) {
        console.error("[ImageUploader] Read failed for", file.name, readErr);
        toast({
          title: `Could not read: ${file.name}`,
          description: "Try selecting the file again",
          variant: "destructive",
        });
      }
    }

    e.target.value = "";

    if (tooLarge.length > 0) {
      toast({
        title: `${tooLarge.length} file(s) too large`,
        description: `Max size is ${maxSizeMB}MB`,
        variant: "destructive",
      });
    }

    if (readResults.length === 0) {
      console.log("[ImageUploader] No files to upload after reading");
      return;
    }

    setUploading(true);
    let successCount = 0;

    try {
      for (let i = 0; i < readResults.length; i++) {
        const { name, base64, mimeType } = readResults[i];
        setUploadStatus(`Uploading ${i + 1} of ${readResults.length}: ${name}`);

        try {
          console.log("[ImageUploader] Calling onUploadSingle for", name);
          await onUploadSingle({
            name: name.replace(/\.[^/.]+$/, ""),
            originalFilename: name,
            imageData: base64,
            mimeType,
            assetType,
          });
          console.log("[ImageUploader] Upload success:", name);
          successCount++;
        } catch (uploadErr) {
          const msg = uploadErr instanceof Error ? uploadErr.message : "Unknown error";
          console.error("[ImageUploader] Upload failed for", name, ":", msg, uploadErr);
          toast({
            title: `Failed to upload: ${name}`,
            description: msg,
            variant: "destructive",
          });
        }
      }

      console.log("[ImageUploader] Batch complete:", successCount, "/", readResults.length);
      toast({ title: `Uploaded ${successCount} of ${readResults.length} images` });
      onUploadComplete?.();

    } catch (error: unknown) {
      const err = error as Error;
      console.error("[ImageUploader] Batch upload error:", err.message, err.stack);
      toast({ title: "Upload failed", description: err.message, variant: "destructive" });
    } finally {
      setUploading(false);
      setUploadStatus("");
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
