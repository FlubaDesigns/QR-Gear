import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import { Loader2, Plus, Pencil, Trash2, FolderOpen, Upload, FileArchive } from "lucide-react";
import { SmartImage } from "@/components/SmartImage";
import { getImageSrc } from "@/lib/imageLoader";
import { SEASONS, EVENTS } from "../shared/constants";
import { useLibraryContext } from "../LibraryContext";
import type { BackgroundAssetWithProxy } from "../shared/types";
import type { PartnerStore } from "@shared/schema";

export default function LibraryBackgroundsTab() {
  const { apiBase } = useLibraryContext();
  const { toast } = useToast();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingAsset, setEditingAsset] = useState<BackgroundAssetWithProxy | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    category: "",
    season: "none",
    event: "none",
    isActive: true,
    isFeatured: false,
    visibleStoreSlugs: [] as string[],
    visibleSegments: [] as string[],
  });
  const [uploading, setUploading] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isZipFile, setIsZipFile] = useState(false);
  const [filterTag, setFilterTag] = useState("all");

  const { data: assets = [], isLoading } = useQuery<BackgroundAssetWithProxy[]>({
    queryKey: [`${apiBase}/admin/background-assets`, "source"],
    queryFn: async () => {
      const res = await fetch(`${apiBase}/admin/background-assets?type=source`);
      if (!res.ok) throw new Error(`Failed: ${res.status}`);
      return res.json();
    },
    staleTime: 0,
    retry: 2,
  });

  const { data: stores = [] } = useQuery<PartnerStore[]>({
    queryKey: [`${apiBase}/admin/partner-stores`],
  });

  const allSegments = stores.reduce((acc, store) => {
    const segments = store.availableSegments || [];
    segments.forEach((s: string) => { if (!acc.includes(s)) acc.push(s); });
    return acc;
  }, [] as string[]);

  const allTags = assets.reduce((acc, asset) => {
    const tags = asset.tags || [];
    tags.forEach((t: string) => { if (!acc.includes(t)) acc.push(t); });
    return acc;
  }, [] as string[]);

  const filteredAssets = assets.filter((asset) => {
    if (filterTag !== "all" && !(asset.tags || []).includes(filterTag)) return false;
    return true;
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const response = await fetch(`${apiBase}/admin/background-assets/${id}`, {
        method: "PUT",
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error(`Update failed: ${response.status}`);
      return await response.json();
    },
    onSuccess: () => {
      toast({ 
        title: "Background Updated", 
        description: "Your changes have been saved successfully.",
        duration: 4000,
      });
      queryClient.invalidateQueries({ queryKey: [`${apiBase}/admin/background-assets`] });
      handleCloseDialog();
    },
    onError: (error: any) => {
      toast({ 
        title: "Update Failed", 
        description: error?.message || "Something went wrong. Please try again.", 
        variant: "destructive",
        duration: 5000,
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`${apiBase}/admin/background-assets/${id}`, { method: "DELETE" });
      if (!response.ok) throw new Error(`Delete failed: ${response.status}`);
      return await response.json();
    },
    onSuccess: () => {
      toast({ 
        title: "Background Deleted", 
        description: "The background has been removed from your library.",
        duration: 4000,
      });
      queryClient.invalidateQueries({ queryKey: [`${apiBase}/admin/background-assets`] });
    },
    onError: (error: any) => {
      toast({ 
        title: "Delete Failed", 
        description: error?.message || "Couldn't remove the background. Please try again.", 
        variant: "destructive",
        duration: 5000,
      });
    },
  });

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setEditingAsset(null);
    setFormData({
      name: "",
      description: "",
      category: "",
      season: "none",
      event: "none",
      isActive: true,
      isFeatured: false,
      visibleStoreSlugs: [],
      visibleSegments: [],
    });
    setImageFile(null);
    setImagePreview(null);
    setIsZipFile(false);
  };

  const handleOpenCreate = () => {
    setEditingAsset(null);
    setFormData({
      name: "",
      description: "",
      category: "",
      season: "none",
      event: "none",
      isActive: true,
      isFeatured: false,
      visibleStoreSlugs: [],
      visibleSegments: [],
    });
    setImageFile(null);
    setImagePreview(null);
    setIsZipFile(false);
    setIsDialogOpen(true);
  };

  const handleOpenEdit = (asset: BackgroundAssetWithProxy) => {
    setEditingAsset(asset);
    setFormData({
      name: asset.name,
      description: "",
      category: "",
      season: "none",
      event: "none",
      isActive: asset.isActive ?? true,
      isFeatured: false,
      visibleStoreSlugs: [],
      visibleSegments: [],
    });
    setImagePreview(getImageSrc(asset));
    setIsDialogOpen(true);
  };

  const toggleStoreVisibility = (slug: string) => {
    setFormData(prev => ({
      ...prev,
      visibleStoreSlugs: prev.visibleStoreSlugs.includes(slug)
        ? prev.visibleStoreSlugs.filter(s => s !== slug)
        : [...prev.visibleStoreSlugs, slug]
    }));
  };

  const toggleSegmentVisibility = (segment: string) => {
    setFormData(prev => ({
      ...prev,
      visibleSegments: prev.visibleSegments.includes(segment)
        ? prev.visibleSegments.filter(s => s !== segment)
        : [...prev.visibleSegments, segment]
    }));
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const isZip = file.type === "application/zip" || file.type === "application/x-zip-compressed" || file.name.endsWith(".zip");
      
      if (!isZip && !file.type.startsWith("image/")) {
        toast({ 
          title: "Invalid File Type", 
          description: "Please select an image file (PNG, JPG) or a ZIP archive.", 
          variant: "destructive",
          duration: 4000,
        });
        return;
      }
      
      setImageFile(file);
      setIsZipFile(isZip);
      
      if (isZip) {
        setImagePreview(null);
        if (!formData.name) {
          setFormData(prev => ({ ...prev, name: file.name.replace(/\.zip$/i, "") }));
        }
      } else {
        const reader = new FileReader();
        reader.onload = (e) => {
          setImagePreview(e.target?.result as string);
        };
        reader.readAsDataURL(file);
      }
    }
  };

  const handleSubmit = async () => {
    if (!editingAsset && !imageFile) {
      toast({ 
        title: "Image Required", 
        description: "Please upload a background image before saving.", 
        variant: "destructive",
        duration: 4000,
      });
      return;
    }

    setUploading(true);

    try {
      const seasonValue = formData.season === "none" ? null : formData.season;
      const eventValue = formData.event === "none" ? null : formData.event;
      
      if (editingAsset) {
        await updateMutation.mutateAsync({
          id: editingAsset.id,
          data: {
            name: formData.name,
            description: formData.description || null,
            category: formData.category || null,
            season: seasonValue,
            event: eventValue,
            isActive: formData.isActive,
            isFeatured: formData.isFeatured,
            visibleStoreSlugs: formData.visibleStoreSlugs.length > 0 ? formData.visibleStoreSlugs : null,
            visibleSegments: formData.visibleSegments.length > 0 ? { segments: formData.visibleSegments } : null,
          },
        });
      } else if (imageFile) {
        const reader = new FileReader();
        const base64Promise = new Promise<string>((resolve, reject) => {
          reader.onload = () => {
            const result = reader.result as string;
            const base64 = result.split(',')[1];
            resolve(base64);
          };
          reader.onerror = reject;
          reader.readAsDataURL(imageFile);
        });
        const imageData = await base64Promise;
        
        const response = await fetch(`${apiBase}/admin/background-assets`, {
          method: "POST",
          body: JSON.stringify({
            name: formData.name || imageFile.name,
            assetType: "source",
            imageData,
            mimeType: imageFile.type,
            tags: formData.category ? [formData.category] : null,
          }),
        });

        if (!response.ok) {
          throw new Error("Failed to upload background");
        }

        toast({ 
          title: "Background Added", 
          description: `"${formData.name}" has been added to your library.`,
          duration: 4000,
        });
        queryClient.invalidateQueries({ queryKey: [`${apiBase}/admin/background-assets`] });
        handleCloseDialog();
      }
    } catch (error: any) {
      toast({ 
        title: "Upload Failed", 
        description: error.message || "Something went wrong. Please try again.", 
        variant: "destructive",
        duration: 5000,
      });
    } finally {
      setUploading(false);
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
      <div className="flex items-center justify-between mb-4 gap-2 flex-wrap">
        <div>
          <h2 className="text-lg font-semibold">
            Library Backgrounds
            <Badge variant="secondary" className="ml-2">{assets.length}</Badge>
          </h2>
          <p className="text-sm text-muted-foreground">Organized by season and event for custom products</p>
        </div>
        <Button onClick={handleOpenCreate} data-testid="button-add-library-background">
          <Plus className="h-4 w-4 mr-2" />
          Add Background
        </Button>
      </div>

      {allTags.length > 0 && (
        <Card className="mb-4">
          <CardContent className="pt-4">
            <div className="flex flex-wrap gap-4">
              <div className="w-48">
                <Label>Filter by Tag</Label>
                <Select value={filterTag} onValueChange={setFilterTag}>
                  <SelectTrigger data-testid="select-filter-tag">
                    <SelectValue placeholder="All Tags" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Tags</SelectItem>
                    {allTags.map((tag) => (
                      <SelectItem key={tag} value={tag}>{tag}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {filteredAssets.length === 0 ? (
        <Card className="text-center py-12">
          <CardContent>
            <FolderOpen className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p className="text-muted-foreground">
              {assets.length === 0 
                ? "No library backgrounds uploaded yet."
                : "No backgrounds match the current filters."}
            </p>
            {assets.length === 0 && (
              <Button className="mt-4" onClick={handleOpenCreate}>
                <Plus className="h-4 w-4 mr-2" />
                Add Background
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {filteredAssets.map((asset) => (
            <Card key={asset.id} className={`overflow-hidden ${!asset.isActive ? "opacity-50" : ""}`} data-testid={`card-library-bg-${asset.id}`}>
              <div className="aspect-square relative">
                <SmartImage
                  asset={asset as any}
                  alt={asset.name}
                  className="w-full h-full object-cover"
                />
                <div className="absolute top-2 right-2 flex gap-1 flex-wrap justify-end">
                  {(asset.tags || []).slice(0, 2).map((tag) => (
                    <Badge key={tag} variant="secondary">{tag}</Badge>
                  ))}
                </div>
              </div>
              <CardContent className="p-3">
                <p className="font-medium truncate">{asset.name}</p>
                <div className="flex items-center justify-between mt-2">
                  <Badge variant={asset.isActive ? "default" : "secondary"}>
                    {asset.isActive ? "Active" : "Inactive"}
                  </Badge>
                  {asset.width && asset.height && (
                    <span className="text-xs text-muted-foreground">{asset.width}x{asset.height}</span>
                  )}
                </div>
                <div className="flex gap-2 mt-3">
                  <Button
                    size="icon"
                    variant="outline"
                    className="flex-1 min-h-12"
                    onClick={() => handleOpenEdit(asset)}
                    data-testid={`button-edit-library-bg-${asset.id}`}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="destructive"
                    className="min-h-12 min-w-12"
                    onClick={() => deleteMutation.mutate(asset.id)}
                    data-testid={`button-delete-library-bg-${asset.id}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {isDialogOpen && (
        <Card className="mb-6 border-2 border-primary/50">
          <CardHeader className="pb-4">
            <CardTitle className="text-xl">
              {editingAsset ? "Edit Background" : "Add Library Background"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {!editingAsset && (
              <div className="space-y-3">
                <Label htmlFor="library-bg-image" className="text-base font-medium">Background Image or ZIP</Label>
                {imagePreview && (
                  <div className="aspect-video max-w-md rounded-lg overflow-hidden border-2 border-border">
                    <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
                  </div>
                )}
                {isZipFile && imageFile && (
                  <div className="flex items-center gap-3 p-4 rounded-lg border-2 border-dashed border-primary/50 bg-primary/5 max-w-md">
                    <FileArchive className="h-10 w-10 text-primary" />
                    <div>
                      <p className="font-medium">{imageFile.name}</p>
                      <p className="text-sm text-muted-foreground">
                        ZIP file - images will be extracted on upload
                      </p>
                    </div>
                  </div>
                )}
                <Input
                  id="library-bg-image"
                  type="file"
                  accept="image/*,.zip,application/zip,application/x-zip-compressed"
                  onChange={handleImageChange}
                  className="h-12 text-base"
                  title="Upload images or a ZIP archive containing multiple images"
                  data-testid="input-library-bg-image"
                />
                <p className="text-sm text-muted-foreground">
                  Single image (4500×5400px, PNG) or ZIP file with multiple images
                </p>
              </div>
            )}

            {editingAsset && imagePreview && (
              <div className="aspect-video max-w-md rounded-lg overflow-hidden border-2 border-border">
                <SmartImage src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="library-bg-name" className="text-base font-medium">Name</Label>
              <Input
                id="library-bg-name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Background name"
                className="h-12 text-base"
                data-testid="input-library-bg-name"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="library-bg-description" className="text-base font-medium">Description</Label>
              <Textarea
                id="library-bg-description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Optional description..."
                rows={3}
                className="text-base"
                data-testid="input-library-bg-description"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-base font-medium">Season</Label>
                <Select
                  value={formData.season}
                  onValueChange={(value) => setFormData({ ...formData, season: value })}
                >
                  <SelectTrigger className="h-12 text-base" data-testid="select-library-bg-season">
                    <SelectValue placeholder="Select season" />
                  </SelectTrigger>
                  <SelectContent>
                    {SEASONS.map((s) => (
                      <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-base font-medium">Event</Label>
                <Select
                  value={formData.event}
                  onValueChange={(value) => setFormData({ ...formData, event: value })}
                >
                  <SelectTrigger className="h-12 text-base" data-testid="select-library-bg-event">
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

            <div className="flex flex-wrap items-center gap-6">
              <div className="flex items-center gap-3">
                <Switch
                  id="library-bg-active"
                  checked={formData.isActive}
                  onCheckedChange={(checked) => setFormData({ ...formData, isActive: checked })}
                />
                <Label htmlFor="library-bg-active" className="text-base">Active</Label>
              </div>
              <div className="flex items-center gap-3">
                <Switch
                  id="library-bg-featured"
                  checked={formData.isFeatured}
                  onCheckedChange={(checked) => setFormData({ ...formData, isFeatured: checked })}
                />
                <Label htmlFor="library-bg-featured" className="text-base">Featured</Label>
              </div>
            </div>

            {stores.length > 0 && (
              <div className="space-y-3 border-t pt-4">
                <Label className="text-base font-medium">Visible to Stores</Label>
                <p className="text-sm text-muted-foreground">Leave all unchecked for visibility to all stores</p>
                <div className="flex flex-wrap gap-2">
                  {stores.filter(s => s.isActive).map((store) => (
                    <Button
                      key={store.slug}
                      type="button"
                      size="lg"
                      variant={formData.visibleStoreSlugs.includes(store.slug) ? "default" : "outline"}
                      onClick={() => toggleStoreVisibility(store.slug)}
                      data-testid={`button-visibility-store-${store.slug}`}
                    >
                      {store.name}
                    </Button>
                  ))}
                </div>
              </div>
            )}

            {allSegments.length > 0 && (
              <div className="space-y-3">
                <Label className="text-base font-medium">Visible to Segments</Label>
                <p className="text-sm text-muted-foreground">Leave all unchecked for visibility to all segments</p>
                <div className="flex flex-wrap gap-2">
                  {allSegments.map((segment) => (
                    <Button
                      key={segment}
                      type="button"
                      size="lg"
                      variant={formData.visibleSegments.includes(segment) ? "default" : "outline"}
                      onClick={() => toggleSegmentVisibility(segment)}
                      data-testid={`button-visibility-segment-${segment}`}
                    >
                      {segment}
                    </Button>
                  ))}
                </div>
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t">
              <Button
                variant="outline"
                size="lg"
                onClick={handleCloseDialog}
                className="w-full sm:w-auto"
              >
                Cancel
              </Button>
              <Button
                size="lg"
                onClick={handleSubmit}
                disabled={uploading || updateMutation.isPending || !formData.name || (!editingAsset && !imageFile)}
                className="w-full sm:w-auto"
                data-testid="button-save-library-bg"
              >
                {(uploading || updateMutation.isPending) && (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                )}
                {editingAsset ? "Update Background" : "Upload Background"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </>
  );
}
