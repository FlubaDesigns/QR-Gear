import { useState, useRef, useCallback, useEffect } from "react";
import ReactCrop, { type Crop, centerCrop, makeAspectCrop } from "react-image-crop";
import "react-image-crop/dist/ReactCrop.css";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Nexus } from "@/lib/nexus";
import { auth } from "@/lib/firebase";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Loader2, Upload, ImagePlus, RefreshCw, Check, X } from "lucide-react";
import { getImageSrc, fetchImageAsBlob } from "@/lib/imageLoader";
import { useLibraryContext } from "../LibraryContext";
import { AssetGrid } from "../components/AssetGrid";
import type { BackgroundAssetWithProxy } from "../shared/types";

type UploadItem = {
  id: string;
  name: string;
  previewUrl: string;
  status: "pending" | "uploading" | "success" | "error";
  error?: string;
};

export default function SourceImagesTab() {
  const { apiBase } = useLibraryContext();
  const { toast } = useToast();
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({ current: 0, total: 0, fileName: "" });
  const [uploadItems, setUploadItems] = useState<UploadItem[]>([]);
  const [cropDialogOpen, setCropDialogOpen] = useState(false);
  const [imageToCrop, setImageToCrop] = useState<BackgroundAssetWithProxy | null>(null);
  const [cropImageBlobUrl, setCropImageBlobUrl] = useState<string | null>(null);
  const [cropImageLoading, setCropImageLoading] = useState(false);
  const [cropSaving, setCropSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const cropImgRef = useRef<HTMLImageElement>(null);
  const [crop, setCrop] = useState<Crop | undefined>();

  const { data: assets = [], isLoading, refetch } = useQuery<BackgroundAssetWithProxy[]>({
    queryKey: [`${apiBase}/admin/background-assets`, "source"],
    queryFn: async () => {
      const res = await apiRequest("GET", `${apiBase}/admin/background-assets?type=source`);
      return res.json();
    },
    staleTime: 0,
    retry: 2,
  });

  useEffect(() => { refetch(); }, [refetch]);

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `${apiBase}/admin/background-assets/${id}`);
    },
    onSuccess: () => {
      toast({ title: "Image deleted" });
      queryClient.invalidateQueries({ queryKey: [`${apiBase}/admin/background-assets`, "source"] });
    },
    onError: (error: Error) => {
      toast({ title: "Delete failed", description: error.message, variant: "destructive" });
    },
  });

  const handleSyncFromStorage = async () => {
    setSyncing(true);
    try {
      const res = await apiRequest("POST", `${apiBase}/admin/background-assets/sync`, { folder: "library/backgrounds/raw" });
      const result = await res.json();
      toast({ title: "Sync Complete", description: `Scanned ${result.scanned} files, created ${result.created} new records` });
      queryClient.invalidateQueries({ queryKey: [`${apiBase}/admin/background-assets`, "source"] });
    } catch (error: unknown) {
      const err = error as Error;
      toast({ title: "Sync failed", description: err.message, variant: "destructive" });
    } finally {
      setSyncing(false);
    }
  };

  const handleOpenCrop = async (asset: BackgroundAssetWithProxy) => {
    setImageToCrop(asset);
    setCrop(undefined);
    setCropImageBlobUrl(null);
    setCropDialogOpen(true);
    setCropImageLoading(true);
    try {
      const url = await fetchImageAsBlob(getImageSrc(asset));
      setCropImageBlobUrl(url);
    } catch {
      toast({ title: "Failed to load image", variant: "destructive" });
      setCropDialogOpen(false);
    } finally {
      setCropImageLoading(false);
    }
  };

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
    if (!imageToCrop || !crop) return;
    setCropSaving(true);
    try {
      const blob = await getCroppedImageBlob();
      if (!blob) { toast({ title: "Failed to generate cropped image", variant: "destructive" }); return; }
      const formData = new FormData();
      formData.append("file", blob, `cropped_${imageToCrop.name}`);
      formData.append("name", `cropped_${imageToCrop.name}`);
      formData.append("assetType", "cropped");
      formData.append("sourceAssetId", imageToCrop.id);
      const token = await auth.currentUser?.getIdToken();
      const response = await fetch(`${apiBase}/admin/background-assets`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      if (!response.ok) { const err = await response.json(); throw new Error(err.error || "Upload failed"); }
      toast({ title: "Cropped image saved", description: "Image added to Cropped Images tab" });
      setCropDialogOpen(false);
      setImageToCrop(null);
      queryClient.invalidateQueries({ queryKey: [`${apiBase}/admin/background-assets`, "cropped"] });
    } catch (error: unknown) {
      const err = error as Error;
      toast({ title: "Save failed", description: err.message, variant: "destructive" });
    } finally {
      setCropSaving(false);
    }
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
          const token = await auth.currentUser?.getIdToken();
          const response = await fetch(`${apiBase}/admin/background-assets`, {
            method: "POST",
            headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
            body: JSON.stringify({ name: name.replace(/\.[^/.]+$/, ""), assetType: "source", imageData: base64, mimeType: blob.type || "image/png", fromZip: true }),
          });
          if (!response.ok) throw new Error(`Server error ${response.status}`);
          successCount++;
          setUploadItems((prev) => prev.map((item, idx) => (idx === i ? { ...item, status: "success" } : item)));
        } catch (err: unknown) {
          const error = err as Error;
          setUploadItems((prev) => prev.map((item, idx) => (idx === i ? { ...item, status: "error", error: error.message } : item)));
        }
        setUploadProgress({ current: i + 1, total: imageFiles.length, fileName: name });
      }
      toast({ title: `Uploaded ${successCount} of ${imageFiles.length} images` });
      queryClient.invalidateQueries({ queryKey: [`${apiBase}/admin/background-assets`, "source"] });
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
          await apiRequest("POST", `${apiBase}/admin/background-assets`, { name: file.name.replace(/\.[^/.]+$/, ""), assetType: "source", imageData: base64, mimeType: file.type });
          successCount++;
          setUploadItems((prev) => prev.map((item, idx) => (idx === i ? { ...item, status: "success" } : item)));
        } catch (err: unknown) {
          const error = err as Error;
          setUploadItems((prev) => prev.map((item, idx) => (idx === i ? { ...item, status: "error", error: error.message } : item)));
        }
        setUploadProgress({ current: i + 1, total: files.length, fileName: file.name });
      }
      toast({ title: `Uploaded ${successCount} of ${files.length} images` });
      queryClient.invalidateQueries({ queryKey: [`${apiBase}/admin/background-assets`, "source"] });
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
    <>
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Upload className="h-5 w-5" />Upload Source Images</CardTitle>
          <CardDescription>Upload a ZIP file or select individual images. These are your original backgrounds.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between mb-4">
            <Button variant="outline" onClick={handleSyncFromStorage} disabled={syncing} data-testid="button-sync-storage">
              {syncing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
              Sync from Storage
            </Button>
            <span className="text-sm text-muted-foreground">Import existing files from storage</span>
          </div>
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
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {uploading && <Loader2 className="h-4 w-4 animate-spin" />}
                  <span className="font-medium">
                    {uploading ? `Uploading ${uploadProgress.current} of ${uploadProgress.total}...` : `Upload complete: ${uploadItems.filter((i) => i.status === "success").length} of ${uploadItems.length} succeeded`}
                  </span>
                </div>
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

      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold">{assets.length} Source Images</h3>
      </div>

      <AssetGrid
        assets={assets}
        isLoading={isLoading}
        emptyIcon={<ImagePlus className="h-12 w-12 mx-auto mb-4 opacity-50" />}
        emptyMessage="No source images uploaded yet."
        emptySubMessage="Upload a ZIP file or select images above."
        aspectRatio="square"
        actions={["crop", "delete"]}
        onCrop={handleOpenCrop}
        onDelete={(asset) => deleteMutation.mutate(asset.id)}
      />

      <Dialog open={cropDialogOpen} onOpenChange={setCropDialogOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader><DialogTitle>Crop Image (9:16 ratio)</DialogTitle></DialogHeader>
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
            <Button variant="outline" onClick={() => setCropDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveCrop} disabled={cropSaving || !crop}>
              {cropSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Save Cropped Image
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
