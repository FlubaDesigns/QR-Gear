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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Loader2, Trash2, Check, X, Upload, Crop as CropIcon, ImagePlus, RefreshCw } from "lucide-react";
import { SmartImage } from "@/components/SmartImage";
import { getImageSrc, fetchImageAsBlob } from "@/lib/imageLoader";
import type { BackgroundAssetWithProxy } from "../shared/types";

type UploadItem = {
  id: string;
  name: string;
  previewUrl: string;
  status: 'pending' | 'uploading' | 'success' | 'error';
  error?: string;
};

export default function SourceImagesTab() {
  const { toast } = useToast();
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({ current: 0, total: 0, fileName: '' });
  const [uploadItems, setUploadItems] = useState<UploadItem[]>([]);
  const [cropDialogOpen, setCropDialogOpen] = useState(false);
  const [imageToCrop, setImageToCrop] = useState<BackgroundAssetWithProxy | null>(null);
  const [cropImageBlobUrl, setCropImageBlobUrl] = useState<string | null>(null);
  const [cropImageLoading, setCropImageLoading] = useState(false);
  const [cropSaving, setCropSaving] = useState(false);
  const cropImgRef = useRef<HTMLImageElement>(null);
  const [crop, setCrop] = useState<Crop | undefined>();

  const { data: assets = [], isLoading, refetch, isError } = useQuery<BackgroundAssetWithProxy[]>({
    queryKey: ["/api/admin/background-assets", "source"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/admin/background-assets?type=source");
      return res.json();
    },
    staleTime: 0,
    retry: 2,
  });

  useEffect(() => {
    refetch();
  }, [refetch]);

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/admin/background-assets/${id}`);
    },
    onSuccess: () => {
      toast({ title: "Image deleted" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/background-assets", "source"] });
    },
    onError: (error: any) => {
      toast({ title: "Delete failed", description: error.message, variant: "destructive" });
    },
  });

  const [syncing, setSyncing] = useState(false);
  const handleSyncFromStorage = async () => {
    setSyncing(true);
    try {
      const res = await apiRequest("POST", "/api/admin/background-assets/sync", {
        folder: "libraries/backgrounds/raw"
      });
      const result = await res.json();
      toast({ 
        title: "Sync Complete", 
        description: `Scanned ${result.scanned} files, created ${result.created} new records` 
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/background-assets", "source"] });
    } catch (error: any) {
      toast({ title: "Sync failed", description: error.message, variant: "destructive" });
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
    } catch (err) {
      toast({ title: "Failed to load image", variant: "destructive" });
      setCropDialogOpen(false);
    } finally {
      setCropImageLoading(false);
    }
  };

  const onCropImageLoad = useCallback((e: React.SyntheticEvent<HTMLImageElement>) => {
    const { width, height } = e.currentTarget;
    const aspectRatio = 9 / 16;
    const newCrop = centerCrop(
      makeAspectCrop({ unit: '%', width: 90 }, aspectRatio, width, height),
      width, height
    );
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

    return new Promise((resolve) => {
      canvas.toBlob((blob) => resolve(blob), "image/jpeg", 0.92);
    });
  }, [crop]);

  const handleSaveCrop = async () => {
    if (!imageToCrop || !crop) return;
    
    setCropSaving(true);
    try {
      const blob = await getCroppedImageBlob();
      if (!blob) {
        toast({ title: "Failed to generate cropped image", variant: "destructive" });
        return;
      }

      const formData = new FormData();
      const croppedName = `cropped_${imageToCrop.name}`;
      formData.append("file", blob, croppedName);
      formData.append("name", croppedName);
      formData.append("assetType", "cropped");
      formData.append("sourceAssetId", imageToCrop.id);

      const token = await auth.currentUser?.getIdToken();
      const response = await fetch("/api/admin/background-assets", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || "Upload failed");
      }

      toast({ title: "Cropped image saved", description: "Image added to Cropped Images tab" });
      setCropDialogOpen(false);
      setImageToCrop(null);
      queryClient.invalidateQueries({ queryKey: ["/api/admin/background-assets", "cropped"] });
    } catch (error: any) {
      toast({ title: "Save failed", description: error.message, variant: "destructive" });
    } finally {
      setCropSaving(false);
    }
  };

  const handleZipUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    Nexus.info("ZIP_UPLOAD", `Starting ZIP upload: ${file.name}`, { size: file.size });

    if (!file.name.endsWith('.zip')) {
      Nexus.warn("ZIP_UPLOAD", "File rejected - not a ZIP file", { fileName: file.name });
      toast({ title: "Please select a ZIP file", variant: "destructive" });
      return;
    }

    setUploading(true);
    try {
      Nexus.info("ZIP_UPLOAD", "Loading JSZip module...");
      const JSZipModule = await import('jszip');
      const JSZip = JSZipModule.default;
      
      Nexus.info("ZIP_UPLOAD", "Parsing ZIP file...", { fileName: file.name, size: file.size });
      const zip = await JSZip.loadAsync(file);
      
      const allFiles = Object.keys(zip.files);
      Nexus.info("ZIP_UPLOAD", `ZIP parsed - found ${allFiles.length} entries`, { entries: allFiles.slice(0, 10) });
      
      const imageFiles: { name: string; blob: Blob }[] = [];
      
      for (const filename of allFiles) {
        const zipEntry = zip.files[filename];
        if (zipEntry.dir) {
          Nexus.info("ZIP_UPLOAD", `Skipping directory: ${filename}`);
          continue;
        }
        const ext = filename.toLowerCase().split('.').pop();
        if (['jpg', 'jpeg', 'png', 'webp', 'heic', 'heif'].includes(ext || '')) {
          Nexus.info("ZIP_UPLOAD", `Extracting image: ${filename}`, { ext });
          const blob = await zipEntry.async('blob');
          imageFiles.push({ name: filename.split('/').pop() || filename, blob });
          Nexus.info("ZIP_UPLOAD", `Extracted ${filename}`, { blobSize: blob.size, blobType: blob.type });
        } else {
          Nexus.info("ZIP_UPLOAD", `Skipping non-image: ${filename}`, { ext });
        }
      }

      Nexus.info("ZIP_UPLOAD", `Found ${imageFiles.length} images to upload`);
      setUploadProgress({ current: 0, total: imageFiles.length, fileName: 'Preparing...' });

      if (imageFiles.length === 0) {
        Nexus.warn("ZIP_UPLOAD", "No valid images found in ZIP");
        toast({ title: "No images found in ZIP", description: "ZIP must contain JPG, PNG, WebP, or HEIC files", variant: "destructive" });
        return;
      }

      const items: UploadItem[] = imageFiles.map((img, idx) => ({
        id: `zip-${idx}`,
        name: img.name,
        previewUrl: URL.createObjectURL(img.blob),
        status: 'pending' as const,
      }));
      setUploadItems(items);

      let successCount = 0;
      let failedNames: string[] = [];
      
      for (let i = 0; i < imageFiles.length; i++) {
        const { name, blob } = imageFiles[i];
        setUploadProgress({ current: i, total: imageFiles.length, fileName: name });
        
        setUploadItems(prev => prev.map((item, idx) => 
          idx === i ? { ...item, status: 'uploading' as const } : item
        ));
        
        if (blob.size > 25 * 1024 * 1024) {
          Nexus.warn("ZIP_UPLOAD", `Skipping oversized file: ${name}`, { size: blob.size, maxSize: 25 * 1024 * 1024 });
          failedNames.push(`${name} (too large)`);
          setUploadItems(prev => prev.map((item, idx) => 
            idx === i ? { ...item, status: 'error' as const, error: 'Too large' } : item
          ));
          setUploadProgress({ current: i + 1, total: imageFiles.length, fileName: name });
          continue;
        }
        
        try {
          Nexus.info("ZIP_UPLOAD", `Converting to base64: ${name}`, { blobSize: blob.size });
          const reader = new FileReader();
          const base64 = await new Promise<string>((resolve, reject) => {
            reader.onload = () => {
              const result = reader.result as string;
              if (result && result.includes(',')) {
                resolve(result.split(',')[1]);
              } else {
                reject(new Error('Invalid base64 result'));
              }
            };
            reader.onerror = () => reject(reader.error);
            reader.readAsDataURL(blob);
          });
          
          const fileSizeMB = (blob.size / (1024 * 1024)).toFixed(2);
          Nexus.info("ZIP_UPLOAD", `Uploading: ${name} (${fileSizeMB}MB)`, { base64Length: base64.length, mimeType: blob.type });

          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 120000);
          
          const token = await auth.currentUser?.getIdToken();
          
          try {
            const response = await fetch("/api/admin/background-assets", {
              method: "POST",
              headers: { 
                "Content-Type": "application/json",
                ...(token ? { "Authorization": `Bearer ${token}` } : {}),
              },
              body: JSON.stringify({
                name: name.replace(/\.[^/.]+$/, ''),
                assetType: 'source',
                imageData: base64,
                mimeType: blob.type || 'image/png',
                fromZip: true,
              }),
              signal: controller.signal,
            });
            clearTimeout(timeoutId);
            
            if (!response.ok) {
              const errText = await response.text();
              throw new Error(`Server error ${response.status}: ${errText.slice(0, 100)}`);
            }
            
            Nexus.info("ZIP_UPLOAD", `Upload success: ${name}`, { status: response.status });
            successCount++;
            setUploadItems(prev => prev.map((item, idx) => 
              idx === i ? { ...item, status: 'success' as const } : item
            ));
          } catch (fetchErr: any) {
            clearTimeout(timeoutId);
            if (fetchErr.name === 'AbortError') {
              throw new Error('Upload timed out (2 min)');
            }
            throw fetchErr;
          }
        } catch (err: any) {
          Nexus.captureError(err, "ZIP_UPLOAD", { fileName: name, step: "upload" });
          failedNames.push(`${name} (${err.message || 'upload error'})`);
          setUploadItems(prev => prev.map((item, idx) => 
            idx === i ? { ...item, status: 'error' as const, error: err.message } : item
          ));
        }

        setUploadProgress({ current: i + 1, total: imageFiles.length, fileName: name });
      }

      setUploadProgress({ current: imageFiles.length, total: imageFiles.length, fileName: 'Complete!' });
      Nexus.info("ZIP_UPLOAD", `Upload complete: ${successCount}/${imageFiles.length} success`, { failed: failedNames });

      if (failedNames.length > 0) {
        toast({ 
          title: `Uploaded ${successCount} of ${imageFiles.length} images`, 
          description: `Failed: ${failedNames.slice(0, 3).join(', ')}${failedNames.length > 3 ? '...' : ''}`,
          variant: failedNames.length === imageFiles.length ? "destructive" : "default"
        });
      } else {
        toast({ title: `Uploaded ${successCount} images successfully` });
      }
      queryClient.invalidateQueries({ queryKey: ["/api/admin/background-assets", "source"] });
    } catch (error: any) {
      Nexus.captureError(error, "ZIP_UPLOAD", { step: "main", fileName: file.name });
      toast({ title: "Upload failed", description: error.message, variant: "destructive" });
    } finally {
      setUploading(false);
      setUploadProgress({ current: 0, total: 0, fileName: '' });
      setTimeout(() => {
        setUploadItems(prev => {
          prev.forEach(item => URL.revokeObjectURL(item.previewUrl));
          return [];
        });
      }, 3000);
      e.target.value = '';
    }
  };

  const handleSingleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files?.length) return;

    setUploading(true);
    setUploadProgress({ current: 0, total: files.length, fileName: 'Preparing...' });

    const items: UploadItem[] = Array.from(files).map((file, idx) => ({
      id: `single-${idx}`,
      name: file.name,
      previewUrl: URL.createObjectURL(file),
      status: 'pending' as const,
    }));
    setUploadItems(items);

    let successCount = 0;

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        setUploadProgress({ current: i, total: files.length, fileName: file.name });
        
        setUploadItems(prev => prev.map((item, idx) => 
          idx === i ? { ...item, status: 'uploading' as const } : item
        ));

        try {
          const reader = new FileReader();
          const base64 = await new Promise<string>((resolve) => {
            reader.onload = () => resolve((reader.result as string).split(',')[1]);
            reader.readAsDataURL(file);
          });

          await apiRequest("POST", "/api/admin/background-assets", {
            name: file.name.replace(/\.[^/.]+$/, ''),
            assetType: 'source',
            imageData: base64,
            mimeType: file.type,
          });

          successCount++;
          setUploadItems(prev => prev.map((item, idx) => 
            idx === i ? { ...item, status: 'success' as const } : item
          ));
        } catch (err: any) {
          setUploadItems(prev => prev.map((item, idx) => 
            idx === i ? { ...item, status: 'error' as const, error: err.message } : item
          ));
        }

        setUploadProgress({ current: i + 1, total: files.length, fileName: file.name });
      }

      toast({ title: `Uploaded ${successCount} of ${files.length} images` });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/background-assets", "source"] });
    } catch (error: any) {
      toast({ title: "Upload failed", description: error.message, variant: "destructive" });
    } finally {
      setUploading(false);
      setUploadProgress({ current: 0, total: 0, fileName: '' });
      setTimeout(() => {
        setUploadItems(prev => {
          prev.forEach(item => URL.revokeObjectURL(item.previewUrl));
          return [];
        });
      }, 3000);
      e.target.value = '';
    }
  };

  if (isLoading) {
    return (
      <div className="text-center py-12">
        <Loader2 className="h-8 w-8 mx-auto animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <>
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Upload Source Images
          </CardTitle>
          <CardDescription>
            Upload a ZIP file with multiple images or select individual files. These are your original backgrounds.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between mb-4">
            <Button 
              variant="outline" 
              onClick={handleSyncFromStorage}
              disabled={syncing}
              data-testid="button-sync-storage"
            >
              {syncing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
              Sync from Storage
            </Button>
            <span className="text-sm text-muted-foreground">
              Import existing files from storage folder
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="zip-upload" className="text-base font-medium">ZIP File (Bulk Upload)</Label>
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
              <Label htmlFor="images-upload" className="text-base font-medium">Individual Images</Label>
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
          <p className="text-sm text-muted-foreground">Max 25MB per image. Supported: JPG, PNG, WebP, HEIC</p>
          
          {uploadItems.length > 0 && (
            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {uploading && <Loader2 className="h-4 w-4 animate-spin" />}
                  <span className="font-medium">
                    {uploading 
                      ? `Uploading ${uploadProgress.current} of ${uploadProgress.total}...`
                      : `Upload complete: ${uploadItems.filter(i => i.status === 'success').length} of ${uploadItems.length} succeeded`
                    }
                  </span>
                </div>
                {uploadProgress.fileName && uploading && (
                  <span className="text-sm text-muted-foreground truncate max-w-48">
                    {uploadProgress.fileName}
                  </span>
                )}
              </div>
              
              <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                <div 
                  className="bg-primary h-full transition-all duration-300"
                  style={{ width: `${(uploadProgress.current / uploadProgress.total) * 100}%` }}
                />
              </div>
              
              <div className="grid grid-cols-6 sm:grid-cols-8 md:grid-cols-10 lg:grid-cols-12 gap-2 max-h-48 overflow-y-auto p-1">
                {uploadItems.map((item) => (
                  <div 
                    key={item.id} 
                    className="relative aspect-square rounded overflow-hidden border"
                    data-testid={`upload-thumb-${item.id}`}
                  >
                    <img 
                      src={item.previewUrl} 
                      alt={item.name}
                      className="w-full h-full object-cover"
                    />
                    <div className={`absolute inset-0 flex items-center justify-center ${
                      item.status === 'pending' ? 'bg-background/50' :
                      item.status === 'uploading' ? 'bg-primary/20' :
                      item.status === 'success' ? 'bg-green-500/30' :
                      'bg-destructive/40'
                    }`}>
                      {item.status === 'pending' && (
                        <div className="w-3 h-3 rounded-full bg-muted-foreground/50" />
                      )}
                      {item.status === 'uploading' && (
                        <Loader2 className="h-4 w-4 animate-spin text-primary" />
                      )}
                      {item.status === 'success' && (
                        <Check className="h-4 w-4 text-green-600" />
                      )}
                      {item.status === 'error' && (
                        <X className="h-4 w-4 text-destructive" />
                      )}
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

      {assets.length === 0 ? (
        <Card className="text-center py-12">
          <CardContent>
            <ImagePlus className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p className="text-muted-foreground">No source images uploaded yet.</p>
            <p className="text-sm text-muted-foreground mt-2">Upload a ZIP file or select images above.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
          {assets.map((asset) => (
            <Card key={asset.id} className="overflow-hidden" data-testid={`card-source-${asset.id}`}>
              <div className="aspect-square relative">
                <SmartImage asset={asset} alt={asset.name} className="w-full h-full object-cover" />
              </div>
              <CardContent className="p-2 space-y-1">
                <p className="text-xs truncate">{asset.name}</p>
                <div className="flex gap-1">
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1"
                    onClick={() => handleOpenCrop(asset)}
                    data-testid={`button-crop-${asset.id}`}
                  >
                    <CropIcon className="h-3 w-3 mr-1" />
                    Crop
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-destructive hover:text-destructive"
                    onClick={() => deleteMutation.mutate(asset.id)}
                    data-testid={`button-delete-source-${asset.id}`}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={cropDialogOpen} onOpenChange={(open) => !cropSaving && setCropDialogOpen(open)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Crop Image (9:16 Aspect Ratio)</DialogTitle>
          </DialogHeader>
          {cropImageLoading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : cropImageBlobUrl ? (
            <div className="space-y-4">
              <div className="flex justify-center bg-muted rounded-lg p-4">
                <ReactCrop
                  crop={crop}
                  onChange={(_, percentCrop) => setCrop(percentCrop)}
                  aspect={9 / 16}
                  className="max-h-[60vh]"
                >
                  <img
                    ref={cropImgRef}
                    src={cropImageBlobUrl}
                    alt="Crop preview"
                    onLoad={onCropImageLoad}
                    className="max-h-[60vh] object-contain"
                  />
                </ReactCrop>
              </div>
              <p className="text-sm text-muted-foreground text-center">
                Drag to adjust the crop area. The cropped image will be saved at 9:16 aspect ratio.
              </p>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setCropDialogOpen(false)}
                  disabled={cropSaving}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleSaveCrop}
                  disabled={cropSaving || !crop || cropImageLoading}
                  data-testid="button-save-crop"
                >
                  {cropSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Save Cropped Image
                </Button>
              </DialogFooter>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}
