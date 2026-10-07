import { DeleteBuildDialog, PendingAssetDeletions } from '@/features/shared/components/DeleteBuildDialog';
import { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Plus, Eye, Trash2, Video, Info, X } from "lucide-react";
import AdminShell from "@/components/AdminShell";
import AdminSectionSubNav from "@/components/admin/AdminSectionSubNav";
import { BUILD_SUBNAV } from "@/components/admin/adminNavConfig";
import { useAuth } from "@/hooks/useAuth";
import { adminFetch } from "@/lib/adminFetch";

import { GRF_VIDEO_ACCEPT_TYPES, GRF_VIDEO_FORMAT_LABELS, GRF_VIDEO_MAX_MB, GRF_VIDEO_MEDIA_TYPE, validateVideoUpload } from '@shared/GRF_engine';
import { GRAPHICS_QK } from '@/features/adminLibrary/shared/grfQueryKeys';

interface GrfVideoAsset {
  id: string;
  grfId: string;
  name: string;
  description: string | null;
  publicUrl: string;
  mimeType: string;
  channel: string;
  purpose: string;
  channelName: string | null;
  purposeName: string | null;
  tags: string[] | null;
  isActive: boolean;
  createdAt: string | null;
}

const VIDEOS_QK = [...GRAPHICS_QK, { mediaType: GRF_VIDEO_MEDIA_TYPE }];

function VideosContent() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingAsset, setEditingAsset] = useState<GrfVideoAsset | null>(null);
  const [formName, setFormName] = useState("");
  const [formDesc, setFormDesc] = useState("");
  const [uploading, setUploading] = useState(false);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoPreview, setVideoPreview] = useState<string | null>(null);
  const uploadInFlight = useRef(false);
  useEffect(() => {
    if (!videoFile) { setVideoPreview(null); return; }
    const url = URL.createObjectURL(videoFile);
    setVideoPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [videoFile]);
  const previewUrl = editingAsset?.publicUrl || videoPreview;

  const { data: assets = [], isLoading, error, refetch } = useQuery<GrfVideoAsset[]>({
    queryKey: VIDEOS_QK,
    queryFn: () => adminFetch<GrfVideoAsset[]>(`/graphics?mediaType=${GRF_VIDEO_MEDIA_TYPE}`),
  });

  const [deleteId, setDeleteId] = useState<string | null>(null);

  const handleCloseDialog = () => {
    if (uploadInFlight.current) return;
    setIsDialogOpen(false);
    setEditingAsset(null);
    setFormName("");
    setFormDesc("");
    setVideoFile(null);
    setVideoPreview(null);
  };

  const handleOpenCreate = () => {
    setEditingAsset(null);
    setFormName("");
    setFormDesc("");
    setVideoFile(null);
    setVideoPreview(null);
    setIsDialogOpen(true);
  };

  const handleOpenView = (asset: GrfVideoAsset) => {
    setEditingAsset(asset);
    setFormName(asset.name);
    setFormDesc(asset.description || "");
    setVideoFile(null);
    setIsDialogOpen(true);
  };

  const handleVideoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try { validateVideoUpload(file.type, file.size); }
    catch (error) {
      e.target.value = "";
      setVideoFile(null);
      toast({ title: "Cannot upload this video", description: (error as Error).message, variant: "destructive" });
      return;
    }
    setVideoFile(file);
  };

  const handleSubmit = async () => {
    if (uploadInFlight.current || editingAsset) return;
    if (!formName.trim()) {
      toast({ title: "Name is required", variant: "destructive" });
      return;
    }
    if (!videoFile) {
      toast({ title: "Please select a video file", variant: "destructive" });
      return;
    }

    uploadInFlight.current = true;
    setUploading(true);
    try {
      const params = validateVideoUpload(videoFile.type, videoFile.size);
      const reader = new FileReader();
      const imageData = await new Promise<string>((resolve, reject) => {
        reader.onload = () => {
          const result = reader.result as string;
          resolve(result.split(",")[1]);
        };
        reader.onerror = () => reject(new Error("Could not read the selected video"));
        reader.onabort = () => reject(new Error("Video reading was canceled"));
        reader.readAsDataURL(videoFile);
      });

      await adminFetch("/graphics/save-grf", {
        method: "POST",
        json: {
          ...params,
          imageUrl: `data:${videoFile.type};base64,${imageData}`,
          name: formName.trim(),
          description: formDesc.trim() || null,
          mimeType: videoFile.type,
          originalFilename: videoFile.name,
        },
      });

      toast({ title: "Video uploaded" });
      qc.invalidateQueries({ queryKey: GRAPHICS_QK });
      uploadInFlight.current = false;
      handleCloseDialog();
    } catch (err: any) {
      toast({ title: "Upload failed", description: err.message, variant: "destructive" });
    } finally {
      uploadInFlight.current = false;
      setUploading(false);
    }
  };

  const addVideoButton = (
    <Button onClick={handleOpenCreate} data-testid="button-add-video">
      <Plus className="h-4 w-4 mr-2" />
      Add Video
    </Button>
  );

  return (
    <AdminShell
      title="Video Library"
      subtitle="Reusable videos for QR landing pages"
      icon={Video}
      backHref="/admin"
      backLabel="Back"
      actions={addVideoButton}
      sectionNav={<AdminSectionSubNav items={BUILD_SUBNAV} />}
    >
      <div
        className="flex items-start gap-2 rounded-md border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/30 px-3 py-2 mb-6"
        data-testid="info-grf-videos"
      >
        <Info className="h-4 w-4 text-blue-600 dark:text-blue-400 mt-0.5 shrink-0" />
        <p className="text-xs text-blue-800 dark:text-blue-300">
          Upload a video once and reuse its registered file. Deleting a video first shows the affected builds and files.
        </p>
      </div>

      <PendingAssetDeletions />

      {error && (
        <div className="p-4 bg-destructive/10 border border-destructive rounded-lg mb-6" data-testid="error-videos">
          <p className="text-sm font-medium">Failed to load videos</p>
          <p className="text-xs text-muted-foreground">{(error as Error).message}</p>
          <Button variant="outline" className="min-h-[44px] mt-2" onClick={() => refetch()}>Retry</Button>
        </div>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : assets.length === 0 && !error ? (
        <Card className="p-8 text-center">
          <Video className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="font-medium mb-2">No Videos Found</h3>
          <p className="text-muted-foreground mb-4">
            Upload a video to get started.
          </p>
          <Button onClick={handleOpenCreate}>
            <Plus className="h-4 w-4 mr-2" />
            Add Video
          </Button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {assets.map((asset) => (
            <Card key={asset.grfId} data-testid={`card-video-${asset.grfId}`}>
              <CardContent className="p-4">
                <div className="aspect-video bg-muted rounded-md overflow-hidden mb-3 relative">
                  {asset.publicUrl && !asset.publicUrl.startsWith("data:") ? (
                    <video
                      src={asset.publicUrl}
                      className="w-full h-full object-cover"
                      controls
                      playsInline
                      preload="metadata"
                      aria-label={`Play ${asset.name}`}
                      onError={() => toast({ title: "Video preview unavailable", description: asset.name, variant: "destructive" })}
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Video className="h-12 w-12 text-muted-foreground" />
                    </div>
                  )}
                  <div className="absolute top-2 right-2 pointer-events-none">
                    <Badge variant="secondary" className="font-mono text-xs">{asset.grfId}</Badge>
                  </div>
                </div>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium truncate" data-testid={`text-video-name-${asset.grfId}`}>{asset.name}</h3>
                    {asset.description && (
                      <p className="text-sm text-muted-foreground truncate">{asset.description}</p>
                    )}
                    <p className="text-xs text-muted-foreground mt-1">{asset.mimeType}</p>
                  </div>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-12 w-12"
                      aria-label={`View ${asset.name}`}
                      onClick={() => handleOpenView(asset)}
                      data-testid={`button-view-video-${asset.grfId}`}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-12 w-12"
                      aria-label={`Delete ${asset.name}`}
                      onClick={() => setDeleteId(asset.grfId)}
                      disabled={!!deleteId}
                      data-testid={`button-delete-video-${asset.grfId}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={isDialogOpen} onOpenChange={open => { if (!open) handleCloseDialog(); }}>
        <DialogContent showCloseButton={false} className="max-w-lg max-h-[90dvh] overflow-y-auto pt-16">
          <DialogClose asChild><Button variant="ghost" size="icon" disabled={uploading} className="absolute left-3 top-3 h-12 w-12" aria-label="Close video" data-testid="button-close-video"><X className="h-5 w-5" /></Button></DialogClose>
          <DialogHeader>
            <DialogTitle>{editingAsset ? "View Video" : "Upload Video"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="Video name"
                readOnly={!!editingAsset}
                disabled={uploading}
                data-testid="input-video-name"
              />
            </div>
            <div>
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formDesc}
                onChange={(e) => setFormDesc(e.target.value)}
                placeholder="Optional description"
                readOnly={!!editingAsset}
                disabled={uploading}
                data-testid="input-video-description"
              />
            </div>
            {!editingAsset && (
              <div>
                <Label htmlFor="video">Video File</Label>
                <Input
                  id="video"
                  type="file"
                  accept={GRF_VIDEO_ACCEPT_TYPES}
                  disabled={uploading}
                  onChange={handleVideoChange}
                  data-testid="input-video-file"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Supported: {GRF_VIDEO_FORMAT_LABELS}. Maximum {GRF_VIDEO_MAX_MB} MB.
                </p>
              </div>
            )}
            {previewUrl && !previewUrl.startsWith("data:") && (
              <div className="aspect-video bg-muted rounded-md overflow-hidden">
                <video src={previewUrl} className="w-full h-full object-contain" controls playsInline preload="metadata" onError={() => toast({ title: "Video preview unavailable", description: "This browser could not play the selected video.", variant: "destructive" })} />
              </div>
            )}
            {editingAsset && (
              <div
                className="flex items-start gap-2 rounded-md border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 px-3 py-2"
                data-testid="info-immutable"
              >
                <Info className="h-4 w-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
                <p className="text-xs text-amber-800 dark:text-amber-300">
                  This viewer is read-only. Upload a new video to replace the file; review affected builds before deleting the old one.
                </p>
              </div>
            )}
          </div>
          <DialogFooter className="gap-2">
            <DialogClose asChild>
              <Button variant="outline" disabled={uploading} className="min-h-[44px]" data-testid="button-cancel-video">{editingAsset ? "Close" : "Cancel"}</Button>
            </DialogClose>
            {!editingAsset && (
              <Button
                onClick={handleSubmit}
                disabled={uploading || !formName.trim() || !videoFile}
                data-testid="button-save-video"
              >
                {uploading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Upload Video
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <DeleteBuildDialog target={deleteId ? { kind: 'graphics', id: deleteId } : null} onClose={() => setDeleteId(null)} />
    </AdminShell>
  );
}

export default function AdminVideosPage() {
  const { user, isLoading: authLoading } = useAuth();
  const [, navigate] = useLocation();

  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!user) {
    navigate("/");
    return null;
  }

  return <VideosContent />;
}
