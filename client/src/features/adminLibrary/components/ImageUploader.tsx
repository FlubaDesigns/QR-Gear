import { useState } from "react";
import { Nexus } from "@/lib/nexus";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import { Loader2, Upload, Check, X } from "lucide-react";
import { useLibraryContext } from "../LibraryContext";

type UploadItem = {
  id: string;
  name: string;
  previewUrl: string;
  status: "pending" | "uploading" | "success" | "error";
  error?: string;
};

interface ImageUploaderProps {
  assetType?: "source" | "cropped";
  onUploadComplete?: () => void;
}

export function ImageUploader({ assetType = "source", onUploadComplete }: ImageUploaderProps) {
  const { apiBase } = useLibraryContext();
  const { toast } = useToast();
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({ current: 0, total: 0, fileName: "" });
  const [uploadItems, setUploadItems] = useState<UploadItem[]>([]);

  const uploadImage = async (name: string, base64: string, mimeType: string): Promise<void> => {
    const response = await fetch(`${apiBase}/admin/background-assets`, {
      method: "POST",
      body: JSON.stringify({ name, assetType, imageData: base64, mimeType: mimeType || "image/png" }),
    });
    if (!response.ok) throw new Error(`Server error ${response.status}`);
  };

  const handleZipUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !file.name.endsWith(".zip")) {
      toast({ title: "Please select a ZIP file", variant: "destructive" });
      return;
    }
    setUploading(true);
    try {
      Nexus.info("ZIP_UPLOAD", `Starting ZIP upload: ${file.name}`);
      const JSZipModule = await import("jszip");
      const zip = await JSZipModule.default.loadAsync(file);
      const imageFiles: { name: string; blob: Blob }[] = [];
      for (const filename of Object.keys(zip.files)) {
        const entry = zip.files[filename];
        if (entry.dir) continue;
        const ext = filename.toLowerCase().split(".").pop();
        if (["jpg", "jpeg", "png", "webp", "heic", "heif"].includes(ext || "")) {
          imageFiles.push({ name: filename.split("/").pop() || filename, blob: await entry.async("blob") });
        }
      }
      if (imageFiles.length === 0) {
        toast({ title: "No images found in ZIP", variant: "destructive" });
        return;
      }
      setUploadProgress({ current: 0, total: imageFiles.length, fileName: "Preparing..." });
      const items: UploadItem[] = imageFiles.map((img, idx) => ({
        id: `zip-${idx}`, name: img.name, previewUrl: URL.createObjectURL(img.blob), status: "pending",
      }));
      setUploadItems(items);
      let successCount = 0;
      for (let i = 0; i < imageFiles.length; i++) {
        const { name, blob } = imageFiles[i];
        setUploadProgress({ current: i, total: imageFiles.length, fileName: name });
        setUploadItems((prev) => prev.map((item, idx) => (idx === i ? { ...item, status: "uploading" } : item)));
        if (blob.size > 25 * 1024 * 1024) {
          setUploadItems((prev) => prev.map((item, idx) => (idx === i ? { ...item, status: "error", error: "Too large" } : item)));
          continue;
        }
        try {
          const reader = new FileReader();
          const base64 = await new Promise<string>((resolve, reject) => {
            reader.onload = () => resolve((reader.result as string).split(",")[1]);
            reader.onerror = () => reject(reader.error);
            reader.readAsDataURL(blob);
          });
          await uploadImage(name.replace(/\.[^/.]+$/, ""), base64, blob.type);
          successCount++;
          setUploadItems((prev) => prev.map((item, idx) => (idx === i ? { ...item, status: "success" } : item)));
        } catch (err: unknown) {
          const error = err as Error;
          setUploadItems((prev) => prev.map((item, idx) => (idx === i ? { ...item, status: "error", error: error.message } : item)));
        }
        setUploadProgress({ current: i + 1, total: imageFiles.length, fileName: name });
      }
      toast({ title: `Uploaded ${successCount} of ${imageFiles.length} images` });
      queryClient.invalidateQueries({ queryKey: [`${apiBase}/admin/background-assets`, assetType] });
      onUploadComplete?.();
    } catch (error: unknown) {
      const err = error as Error;
      toast({ title: "Upload failed", description: err.message, variant: "destructive" });
    } finally {
      setUploading(false);
      setUploadProgress({ current: 0, total: 0, fileName: "" });
      setTimeout(() => { setUploadItems((prev) => { prev.forEach((item) => URL.revokeObjectURL(item.previewUrl)); return []; }); }, 3000);
      e.target.value = "";
    }
  };

  const handleSingleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files?.length) return;
    setUploading(true);
    setUploadProgress({ current: 0, total: files.length, fileName: "Preparing..." });
    const items: UploadItem[] = Array.from(files).map((file, idx) => ({
      id: `single-${idx}`, name: file.name, previewUrl: URL.createObjectURL(file), status: "pending",
    }));
    setUploadItems(items);
    let successCount = 0;
    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        setUploadProgress({ current: i, total: files.length, fileName: file.name });
        setUploadItems((prev) => prev.map((item, idx) => (idx === i ? { ...item, status: "uploading" } : item)));
        try {
          const reader = new FileReader();
          const base64 = await new Promise<string>((resolve) => {
            reader.onload = () => resolve((reader.result as string).split(",")[1]);
            reader.readAsDataURL(file);
          });
          await uploadImage(file.name.replace(/\.[^/.]+$/, ""), base64, file.type);
          successCount++;
          setUploadItems((prev) => prev.map((item, idx) => (idx === i ? { ...item, status: "success" } : item)));
        } catch (err: unknown) {
          const error = err as Error;
          setUploadItems((prev) => prev.map((item, idx) => (idx === i ? { ...item, status: "error", error: error.message } : item)));
        }
        setUploadProgress({ current: i + 1, total: files.length, fileName: file.name });
      }
      toast({ title: `Uploaded ${successCount} of ${files.length} images` });
      queryClient.invalidateQueries({ queryKey: [`${apiBase}/admin/background-assets`, assetType] });
      onUploadComplete?.();
    } catch (error: unknown) {
      const err = error as Error;
      toast({ title: "Upload failed", description: err.message, variant: "destructive" });
    } finally {
      setUploading(false);
      setUploadProgress({ current: 0, total: 0, fileName: "" });
      setTimeout(() => { setUploadItems((prev) => { prev.forEach((item) => URL.revokeObjectURL(item.previewUrl)); return []; }); }, 3000);
      e.target.value = "";
    }
  };

  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Upload className="h-5 w-5" />Upload Images</CardTitle>
        <CardDescription>Upload a ZIP file or select individual images.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="zip-upload">ZIP File (Bulk)</Label>
            <Input id="zip-upload" type="file" accept=".zip" onChange={handleZipUpload} disabled={uploading} className="h-12" data-testid="input-zip-upload" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="images-upload">Individual Images</Label>
            <Input id="images-upload" type="file" accept="image/*" multiple onChange={handleSingleUpload} disabled={uploading} className="h-12" data-testid="input-images-upload" />
          </div>
        </div>
        <p className="text-sm text-muted-foreground">Max 25MB per image. Supported: JPG, PNG, WebP, HEIC</p>
        {uploadItems.length > 0 && (
          <div className="space-y-3 pt-2">
            <div className="flex items-center gap-2">
              {uploading && <Loader2 className="h-4 w-4 animate-spin" />}
              <span className="font-medium">
                {uploading ? `Uploading ${uploadProgress.current} of ${uploadProgress.total}...` : `Complete: ${uploadItems.filter((i) => i.status === "success").length} of ${uploadItems.length}`}
              </span>
            </div>
            <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
              <div className="bg-primary h-full transition-all duration-300" style={{ width: `${(uploadProgress.current / uploadProgress.total) * 100}%` }} />
            </div>
            <div className="grid grid-cols-6 sm:grid-cols-8 md:grid-cols-10 lg:grid-cols-12 gap-2 max-h-48 overflow-y-auto p-1">
              {uploadItems.map((item) => (
                <div key={item.id} className="relative aspect-square rounded overflow-hidden border">
                  <img src={item.previewUrl} alt={item.name} className="w-full h-full object-cover" />
                  <div className={`absolute inset-0 flex items-center justify-center ${item.status === "pending" ? "bg-background/50" : item.status === "uploading" ? "bg-primary/20" : item.status === "success" ? "bg-green-500/30" : "bg-destructive/40"}`}>
                    {item.status === "pending" && <div className="w-3 h-3 rounded-full bg-muted-foreground/50" />}
                    {item.status === "uploading" && <Loader2 className="h-4 w-4 animate-spin text-primary" />}
                    {item.status === "success" && <Check className="h-4 w-4 text-green-600" />}
                    {item.status === "error" && <X className="h-4 w-4 text-destructive" />}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
