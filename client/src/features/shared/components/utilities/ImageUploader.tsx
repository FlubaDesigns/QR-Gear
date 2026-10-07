import { useRef, useState } from "react";
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

  const showBothInputs = showZipUpload && showImageUpload;
  const uploadLock = useRef(false);
  const encodeFile = async (file: File) => {
    const bytes = new Uint8Array(await file.arrayBuffer());
    let binary = "";
    for (let i = 0; i < bytes.length; i += 8192) binary += String.fromCharCode(...Array.from(bytes.subarray(i, i + 8192)));
    return btoa(binary);
  };
  const uploadFiles = async (event: React.ChangeEvent<HTMLInputElement>, zip: boolean) => {
    const files = Array.from(event.target.files || []);
    event.target.value = "";
    if (uploadLock.current || !files.length || (zip ? !onUploadZip : !onUploadSingle)) return;
    uploadLock.current = true;
    setUploading(true);
    let completed = 0;
    try {
      for (let index = 0; index < files.length; index++) {
        const file = files[index];
        setUploadStatus(`Uploading ${index + 1} of ${files.length}: ${file.name}`);
        try {
          if (file.size > maxSizeMB * 1024 * 1024) throw new Error(`Max size is ${maxSizeMB} MB`);
          if (zip && !file.name.toLowerCase().endsWith('.zip')) throw new Error('Please select a ZIP file');
          const params = { name: file.name, originalFilename: file.name, imageData: await encodeFile(file), mimeType: zip ? 'application/zip' : file.type, assetType };
          if (zip) {
            const result = await onUploadZip!(params);
            toast({ title: 'ZIP uploaded', description: `${result.extractedCount} images extracted` });
          } else await onUploadSingle!(params);
          completed++;
        } catch (error) {
          toast({ title: `Could not upload ${file.name}`, description: error instanceof Error ? error.message : 'Upload failed', variant: 'destructive' });
        }
      }
      if (completed) {
        if (!zip) toast({ title: `Uploaded ${completed} of ${files.length} images` });
        onUploadComplete?.();
      }
    } finally {
      uploadLock.current = false;
      setUploading(false);
      setUploadStatus('');
    }
  };
  const handleZipUpload = (event: React.ChangeEvent<HTMLInputElement>) => uploadFiles(event, true);
  const handleSingleUpload = (event: React.ChangeEvent<HTMLInputElement>) => uploadFiles(event, false);

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
          Max {maxSizeMB}MB per image. Supported: JPG, PNG, WebP, SVG
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
