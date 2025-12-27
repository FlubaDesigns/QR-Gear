import { useState } from "react";
import { useLocation, Link } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import BreadcrumbTrail from "@/components/BreadcrumbTrail";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { ArrowLeft, Loader2, Plus, Pencil, Trash2, Video, Play, Pause } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import type { LibraryAsset } from "@shared/schema";

const SEASONS = [
  { value: "none", label: "No Season" },
  { value: "spring", label: "Spring" },
  { value: "summer", label: "Summer" },
  { value: "fall", label: "Fall" },
  { value: "winter", label: "Winter" },
];

const EVENTS = [
  { value: "none", label: "No Event" },
  { value: "christmas", label: "Christmas" },
  { value: "easter", label: "Easter" },
  { value: "thanksgiving", label: "Thanksgiving" },
  { value: "valentines", label: "Valentine's Day" },
  { value: "mothers-day", label: "Mother's Day" },
  { value: "fathers-day", label: "Father's Day" },
  { value: "independence-day", label: "Independence Day" },
  { value: "new-year", label: "New Year" },
  { value: "halloween", label: "Halloween" },
  { value: "graduation", label: "Graduation" },
  { value: "birthday", label: "Birthday" },
  { value: "wedding", label: "Wedding" },
  { value: "anniversary", label: "Anniversary" },
];

function VideosContent() {
  const { toast } = useToast();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingAsset, setEditingAsset] = useState<LibraryAsset | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    season: "none",
    event: "none",
    isActive: true,
    isFeatured: false,
  });
  const [uploading, setUploading] = useState(false);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoPreview, setVideoPreview] = useState<string | null>(null);
  const [filterSeason, setFilterSeason] = useState("none");
  const [filterEvent, setFilterEvent] = useState("none");

  const { data: assets = [], isLoading } = useQuery<LibraryAsset[]>({
    queryKey: ["/api/admin/library/admin", { assetType: "video", mediaType: "video" }],
    queryFn: async () => {
      const params = new URLSearchParams({ assetType: "video", mediaType: "video" });
      const response = await fetch(`/api/admin/library/admin?${params}`);
      if (!response.ok) throw new Error("Failed to fetch videos");
      return response.json();
    },
  });

  const filteredAssets = assets.filter((asset) => {
    if (filterSeason !== "none" && asset.season !== filterSeason) return false;
    if (filterEvent !== "none" && asset.event !== filterEvent) return false;
    return true;
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const response = await apiRequest("PUT", `/api/admin/library/${id}`, data);
      return await response.json();
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Video updated successfully." });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/library/admin"] });
      handleCloseDialog();
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update video.", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiRequest("DELETE", `/api/admin/library/${id}`, {});
      return await response.json();
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Video deleted successfully." });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/library/admin"] });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to delete video.", variant: "destructive" });
    },
  });

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setEditingAsset(null);
    setFormData({
      name: "",
      description: "",
      season: "none",
      event: "none",
      isActive: true,
      isFeatured: false,
    });
    setVideoFile(null);
    setVideoPreview(null);
  };

  const handleOpenCreate = () => {
    setEditingAsset(null);
    setFormData({
      name: "",
      description: "",
      season: "none",
      event: "none",
      isActive: true,
      isFeatured: false,
    });
    setVideoFile(null);
    setVideoPreview(null);
    setIsDialogOpen(true);
  };

  const handleOpenEdit = (asset: LibraryAsset) => {
    setEditingAsset(asset);
    setFormData({
      name: asset.name,
      description: asset.description || "",
      season: asset.season || "none",
      event: asset.event || "none",
      isActive: asset.isActive ?? true,
      isFeatured: asset.isFeatured ?? false,
    });
    setVideoPreview(asset.publicUrl);
    setIsDialogOpen(true);
  };

  const handleVideoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith("video/")) {
        toast({ title: "Error", description: "Please select a video file.", variant: "destructive" });
        return;
      }
      setVideoFile(file);
      setVideoPreview(URL.createObjectURL(file));
    }
  };

  const handleSubmit = async () => {
    if (!editingAsset && !videoFile) {
      toast({ title: "Error", description: "Please upload a video.", variant: "destructive" });
      return;
    }

    setUploading(true);

    try {
      if (editingAsset) {
        await updateMutation.mutateAsync({
          id: editingAsset.id,
          data: {
            name: formData.name,
            description: formData.description || null,
            season: formData.season === "none" ? null : formData.season,
            event: formData.event === "none" ? null : formData.event,
            isActive: formData.isActive,
            isFeatured: formData.isFeatured,
          },
        });
      } else if (videoFile) {
        const formDataObj = new FormData();
        formDataObj.append("file", videoFile);
        formDataObj.append("name", formData.name);
        formDataObj.append("description", formData.description);
        formDataObj.append("assetType", "video");
        formDataObj.append("mediaType", "video");
        if (formData.season !== "none") formDataObj.append("season", formData.season);
        if (formData.event !== "none") formDataObj.append("event", formData.event);

        const response = await fetch("/api/admin/library/upload", {
          method: "POST",
          body: formDataObj,
          credentials: "include",
        });

        if (!response.ok) {
          throw new Error("Failed to upload video");
        }

        toast({ title: "Success", description: "Video uploaded successfully." });
        queryClient.invalidateQueries({ queryKey: ["/api/admin/library/admin"] });
        handleCloseDialog();
      }
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Failed to save video.", variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 px-4 max-w-6xl">
      <div className="flex items-center gap-4 mb-6">
        <Link href="/admin">
          <Button variant="ghost" size="icon" className="h-12 w-12" data-testid="button-back">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-page-title">Video Library</h1>
          <p className="text-muted-foreground">Manage video backgrounds for QR landing pages</p>
        </div>
        <div className="ml-auto">
          <Button onClick={handleOpenCreate} data-testid="button-add-video">
            <Plus className="h-4 w-4 mr-2" />
            Add Video
          </Button>
        </div>
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4">
            <div className="w-48">
              <Label>Season</Label>
              <Select value={filterSeason} onValueChange={setFilterSeason}>
                <SelectTrigger data-testid="select-filter-season">
                  <SelectValue placeholder="All Seasons" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">All Seasons</SelectItem>
                  {SEASONS.filter(s => s.value !== "none").map((s) => (
                    <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="w-48">
              <Label>Event</Label>
              <Select value={filterEvent} onValueChange={setFilterEvent}>
                <SelectTrigger data-testid="select-filter-event">
                  <SelectValue placeholder="All Events" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">All Events</SelectItem>
                  {EVENTS.filter(e => e.value !== "none").map((e) => (
                    <SelectItem key={e.value} value={e.value}>{e.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredAssets.map((asset) => (
          <Card key={asset.id} className={!asset.isActive ? "opacity-60" : ""} data-testid={`card-video-${asset.id}`}>
            <CardContent className="p-4">
              <div className="aspect-video bg-muted rounded-md overflow-hidden mb-3 relative">
                {asset.publicUrl ? (
                  <video
                    src={asset.publicUrl}
                    className="w-full h-full object-cover"
                    muted
                    loop
                    onMouseEnter={(e) => (e.target as HTMLVideoElement).play()}
                    onMouseLeave={(e) => {
                      const video = e.target as HTMLVideoElement;
                      video.pause();
                      video.currentTime = 0;
                    }}
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Video className="h-12 w-12 text-muted-foreground" />
                  </div>
                )}
                <div className="absolute top-2 right-2 flex gap-1">
                  {asset.season && <Badge variant="secondary">{asset.season}</Badge>}
                  {asset.event && <Badge variant="outline">{asset.event}</Badge>}
                </div>
              </div>
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <h3 className="font-medium truncate" data-testid={`text-video-name-${asset.id}`}>{asset.name}</h3>
                  {asset.description && (
                    <p className="text-sm text-muted-foreground truncate">{asset.description}</p>
                  )}
                  <div className="flex items-center gap-2 mt-2">
                    <Badge variant={asset.isActive ? "default" : "secondary"}>
                      {asset.isActive ? "Active" : "Inactive"}
                    </Badge>
                    <span className="text-xs text-muted-foreground">Used {asset.usageCount}x</span>
                  </div>
                </div>
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-12 w-12"
                    onClick={() => handleOpenEdit(asset)}
                    data-testid={`button-edit-video-${asset.id}`}
                  >
                    <Pencil className="h-5 w-5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-12 w-12"
                    onClick={() => deleteMutation.mutate(asset.id)}
                    data-testid={`button-delete-video-${asset.id}`}
                  >
                    <Trash2 className="h-5 w-5" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {filteredAssets.length === 0 && (
        <Card className="p-8 text-center">
          <Video className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="font-medium mb-2">No Videos Found</h3>
          <p className="text-muted-foreground mb-4">
            {assets.length === 0
              ? "Upload your first video background to get started."
              : "No videos match the current filters."}
          </p>
          {assets.length === 0 && (
            <Button onClick={handleOpenCreate}>
              <Plus className="h-4 w-4 mr-2" />
              Add Video
            </Button>
          )}
        </Card>
      )}

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingAsset ? "Edit Video" : "Upload Video"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Video name"
                data-testid="input-video-name"
              />
            </div>
            <div>
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Optional description"
                data-testid="input-video-description"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Season</Label>
                <Select
                  value={formData.season}
                  onValueChange={(value) => setFormData({ ...formData, season: value })}
                >
                  <SelectTrigger data-testid="select-video-season">
                    <SelectValue placeholder="Select season" />
                  </SelectTrigger>
                  <SelectContent>
                    {SEASONS.map((s) => (
                      <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Event</Label>
                <Select
                  value={formData.event}
                  onValueChange={(value) => setFormData({ ...formData, event: value })}
                >
                  <SelectTrigger data-testid="select-video-event">
                    <SelectValue placeholder="Select event" />
                  </SelectTrigger>
                  <SelectContent>
                    {EVENTS.map((e) => (
                      <SelectItem key={e.value} value={e.value}>{e.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            {!editingAsset && (
              <div>
                <Label htmlFor="video">Video File</Label>
                <Input
                  id="video"
                  type="file"
                  accept="video/mp4,video/webm,video/quicktime"
                  onChange={handleVideoChange}
                  data-testid="input-video-file"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Supported formats: MP4, WebM, MOV (max 10MB)
                </p>
              </div>
            )}
            {videoPreview && (
              <div className="aspect-video bg-muted rounded-md overflow-hidden">
                <video
                  src={videoPreview}
                  className="w-full h-full object-cover"
                  controls
                />
              </div>
            )}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Switch
                  id="isActive"
                  checked={formData.isActive}
                  onCheckedChange={(checked) => setFormData({ ...formData, isActive: checked })}
                  data-testid="switch-video-active"
                />
                <Label htmlFor="isActive">Active</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  id="isFeatured"
                  checked={formData.isFeatured}
                  onCheckedChange={(checked) => setFormData({ ...formData, isFeatured: checked })}
                  data-testid="switch-video-featured"
                />
                <Label htmlFor="isFeatured">Featured</Label>
              </div>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <DialogClose asChild>
              <Button variant="outline" data-testid="button-cancel-video">Cancel</Button>
            </DialogClose>
            <Button
              onClick={handleSubmit}
              disabled={uploading || updateMutation.isPending}
              data-testid="button-save-video"
            >
              {(uploading || updateMutation.isPending) && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editingAsset ? "Save Changes" : "Upload Video"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
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

  return (
    <div className="min-h-screen">
      <BreadcrumbTrail />
      <VideosContent />
    </div>
  );
}
