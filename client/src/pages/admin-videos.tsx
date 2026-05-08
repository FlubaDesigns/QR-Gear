import { useState } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
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
import { Loader2, Plus, Pencil, Archive, Video, Info } from "lucide-react";
import AdminShell from "@/components/AdminShell";
import AdminSectionSubNav from "@/components/admin/AdminSectionSubNav";
import { BUILD_SUBNAV } from "@/components/admin/adminNavConfig";
import { useAuth } from "@/hooks/useAuth";
import { adminFetch } from "@/lib/adminFetch";

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

const ACCEPTED_VIDEO_TYPES = "video/mp4,video/webm,video/quicktime";

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

  const { data: assets = [], isLoading, error } = useQuery<GrfVideoAsset[]>({
    queryKey: ["/api/admin/graphics", { mediaType: "2" }],
    queryFn: () => adminFetch<GrfVideoAsset[]>("/graphics?mediaType=2"),
  });

  const archiveMutation = useMutation({
    mutationFn: (grfId: string) =>
      adminFetch(`/graphics/${grfId}/archive`, { method: "PATCH" }),
    onSuccess: () => {
      toast({ title: "Video archived" });
      qc.invalidateQueries({ queryKey: ["/api/admin/graphics", { mediaType: "2" }] });
    },
    onError: (err: Error) => {
      toast({ title: "Failed to archive", description: err.message, variant: "destructive" });
    },
  });

  const handleCloseDialog = () => {
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

  const handleOpenEdit = (asset: GrfVideoAsset) => {
    setEditingAsset(asset);
    setFormName(asset.name);
    setFormDesc(asset.description || "");
    setVideoPreview(asset.publicUrl);
    setIsDialogOpen(true);
  };

  const handleVideoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("video/")) {
      toast({ title: "Please select a video file", variant: "destructive" });
      return;
    }
    setVideoFile(file);
    setVideoPreview(URL.createObjectURL(file));
  };

  const handleSubmit = async () => {
    if (!formName.trim()) {
      toast({ title: "Name is required", variant: "destructive" });
      return;
    }
    if (!editingAsset && !videoFile) {
      toast({ title: "Please select a video file", variant: "destructive" });
      return;
    }

    setUploading(true);
    try {
      if (editingAsset) {
        // For edits we can only update metadata — GRF IDs are immutable.
        // Re-mint a new GRF with a note, or just show a toast explaining.
        toast({
          title: "GRF assets are immutable",
          description: "Archive this video and mint a new one to replace it.",
          variant: "destructive",
        });
        handleCloseDialog();
        return;
      }

      if (!videoFile) return;

      const reader = new FileReader();
      const imageData = await new Promise<string>((resolve, reject) => {
        reader.onload = () => {
          const result = reader.result as string;
          resolve(result.split(",")[1]);
        };
        reader.onerror = reject;
        reader.readAsDataURL(videoFile);
      });

      // D1=1 input_build, D2=2 video, D3=3 url, D4=2 graphic, D5=1 mp4/webm
      const formatCode = videoFile.type === "video/webm" ? "2" : "1";
      await adminFetch("/graphics/save-grf", {
        method: "POST",
        json: {
          assetClass: "1",
          mediaType:  "2",
          channel:    "3",
          purpose:    "2",
          format:     formatCode,
          imageUrl: `data:${videoFile.type};base64,${imageData}`,
          name: formName.trim(),
          description: formDesc.trim() || null,
          mimeType: videoFile.type,
          originalFilename: videoFile.name,
        },
      });

      toast({ title: "Video minted as GRF asset (url/graphic)" });
      qc.invalidateQueries({ queryKey: ["/api/admin/graphics", { mediaType: "2" }] });
      handleCloseDialog();
    } catch (err: any) {
      toast({ title: "Upload failed", description: err.message, variant: "destructive" });
    } finally {
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
      subtitle="GRF-06-3 (url_artifact_asset) video backgrounds for QR landing pages"
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
          Videos are stored as GRF-06-3 (url_artifact_asset, Renderable) assets. To replace a video, archive the old one and mint a new asset.
        </p>
      </div>

      {error && (
        <div className="p-4 bg-destructive/10 border border-destructive rounded-lg mb-6" data-testid="error-videos">
          <p className="text-sm font-medium">Failed to load videos</p>
          <p className="text-xs text-muted-foreground">{(error as Error).message}</p>
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
            Mint a GRF-06-3 video asset to get started.
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
                      muted
                      loop
                      onMouseEnter={(e) => (e.target as HTMLVideoElement).play()}
                      onMouseLeave={(e) => {
                        const v = e.target as HTMLVideoElement;
                        v.pause();
                        v.currentTime = 0;
                      }}
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Video className="h-12 w-12 text-muted-foreground" />
                    </div>
                  )}
                  <div className="absolute top-2 right-2">
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
                      onClick={() => handleOpenEdit(asset)}
                      data-testid={`button-edit-video-${asset.grfId}`}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => archiveMutation.mutate(asset.grfId)}
                      disabled={archiveMutation.isPending}
                      data-testid={`button-archive-video-${asset.grfId}`}
                    >
                      <Archive className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-lg">
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
                data-testid="input-video-description"
              />
            </div>
            {!editingAsset && (
              <div>
                <Label htmlFor="video">Video File</Label>
                <Input
                  id="video"
                  type="file"
                  accept={ACCEPTED_VIDEO_TYPES}
                  onChange={handleVideoChange}
                  data-testid="input-video-file"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Supported: MP4, WebM, MOV
                </p>
              </div>
            )}
            {videoPreview && !videoPreview.startsWith("data:") && (
              <div className="aspect-video bg-muted rounded-md overflow-hidden">
                <video src={videoPreview} className="w-full h-full object-cover" controls />
              </div>
            )}
            {editingAsset && (
              <div
                className="flex items-start gap-2 rounded-md border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 px-3 py-2"
                data-testid="info-immutable"
              >
                <Info className="h-4 w-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
                <p className="text-xs text-amber-800 dark:text-amber-300">
                  GRF assets are immutable. Archive this video and mint a new one to replace it.
                </p>
              </div>
            )}
          </div>
          <DialogFooter className="gap-2">
            <DialogClose asChild>
              <Button variant="outline" data-testid="button-cancel-video">Cancel</Button>
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
