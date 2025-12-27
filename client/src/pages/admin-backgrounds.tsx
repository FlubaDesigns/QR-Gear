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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { ArrowLeft, Loader2, Plus, Pencil, Trash2, Check, X, Image, FolderOpen, Copy, ExternalLink } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import type { CustomDesign, LibraryAsset, PartnerStore } from "@shared/schema";

const TEMPLATE_CATEGORIES = [
  { value: "religious", label: "Religious" },
  { value: "business", label: "Business" },
  { value: "sports", label: "Sports" },
  { value: "entertainment", label: "Entertainment" },
  { value: "holiday", label: "Holiday" },
  { value: "custom", label: "Custom" },
];

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

function TemplatesContent() {
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [selectedDesign, setSelectedDesign] = useState<CustomDesign | null>(null);

  const { data: templates = [], isLoading } = useQuery<CustomDesign[]>({
    queryKey: ["/api/admin/library/templates"],
  });

  const removeFromLibraryMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiRequest("PUT", `/api/admin/custom-designs/${id}`, { savedToLibrary: false });
      return await response.json();
    },
    onSuccess: () => {
      toast({ 
        title: "Template Removed", 
        description: "The design has been removed from your library. It's still available in Product Builder.",
        duration: 4000,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/library/templates"] });
    },
    onError: (error: any) => {
      toast({ 
        title: "Remove Failed", 
        description: error?.message || "Couldn't remove the template. Please try again.", 
        variant: "destructive",
        duration: 5000,
      });
    },
  });

  const handleViewLandingPage = (design: CustomDesign) => {
    window.open(`/customs/${design.id}`, "_blank");
  };

  const handleDuplicate = (design: CustomDesign) => {
    toast({ 
      title: "Coming Soon", 
      description: "Duplicate functionality will open Product Builder with pre-filled data.",
      duration: 3000,
    });
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
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold">Saved Design Templates</h2>
          <p className="text-sm text-muted-foreground">
            Custom designs saved to library. Create new templates in Product Builder.
          </p>
        </div>
        <Button onClick={() => navigate("/admin/products")} data-testid="button-go-to-builder">
          <Plus className="h-4 w-4 mr-2" />
          Create in Builder
        </Button>
      </div>

      {templates.length === 0 ? (
        <Card className="text-center py-12">
          <CardContent>
            <Image className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p className="text-muted-foreground">No templates saved to library yet.</p>
            <p className="text-sm text-muted-foreground mt-2">
              Go to Product Builder and save designs with "Save to Library" option.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {templates.map((design) => (
            <Card key={design.id} className="overflow-hidden" data-testid={`card-template-${design.id}`}>
              <div className="aspect-video relative bg-muted">
                {design.backgroundImageUrl ? (
                  <img
                    src={design.backgroundImageUrl}
                    alt={design.productName}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Image className="h-8 w-8 opacity-30" />
                  </div>
                )}
                {design.isFeatured && (
                  <Badge className="absolute top-2 left-2">Featured</Badge>
                )}
                {design.isSeasonalPromo && (
                  <Badge variant="secondary" className="absolute top-2 right-2">Seasonal</Badge>
                )}
              </div>
              <CardContent className="p-4">
                <p className="font-medium truncate">{(design as any).projectName || design.productName}</p>
                <p className="text-sm text-muted-foreground truncate">{design.productName}</p>
                
                <div className="flex flex-wrap gap-1 mt-2">
                  {design.storeName && (
                    <Badge variant="outline" className="text-xs">{design.storeName}</Badge>
                  )}
                  {design.segment && (
                    <Badge variant="outline" className="text-xs">{design.segment}</Badge>
                  )}
                </div>
                
                {(design.topText !== null || design.bottomText !== null) && (
                  <div className="mt-2 text-xs text-muted-foreground">
                    {design.topText !== null && <p>Top: "{String((design.topText as Record<string, unknown>)?.text ?? "")}"</p>}
                    {design.bottomText !== null && <p>Bottom: "{String((design.bottomText as Record<string, unknown>)?.text ?? "")}"</p>}
                  </div>
                )}

                <div className="flex gap-2 mt-3">
                  <Button
                    variant="outline"
                    className="flex-1 min-h-12"
                    onClick={() => handleViewLandingPage(design)}
                    data-testid={`button-view-${design.id}`}
                  >
                    <ExternalLink className="h-4 w-4 mr-1" />
                    View
                  </Button>
                  <Button
                    size="icon"
                    variant="outline"
                    className="min-h-12 min-w-12"
                    onClick={() => handleDuplicate(design)}
                    data-testid={`button-duplicate-${design.id}`}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="destructive"
                    className="min-h-12 min-w-12"
                    onClick={() => removeFromLibraryMutation.mutate(design.id)}
                    disabled={removeFromLibraryMutation.isPending}
                    data-testid={`button-remove-library-${design.id}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={!!selectedDesign} onOpenChange={() => setSelectedDesign(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Template Details</DialogTitle>
          </DialogHeader>
          {selectedDesign && (
            <div className="space-y-4">
              {selectedDesign.backgroundImageUrl && (
                <div className="aspect-video rounded-md overflow-hidden">
                  <img 
                    src={selectedDesign.backgroundImageUrl} 
                    alt={selectedDesign.productName}
                    className="w-full h-full object-cover"
                  />
                </div>
              )}
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Product</p>
                  <p className="font-medium">{selectedDesign.productName}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Store</p>
                  <p className="font-medium">{selectedDesign.storeName || "—"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Segment</p>
                  <p className="font-medium">{selectedDesign.segment || "—"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Created</p>
                  <p className="font-medium">
                    {new Date(selectedDesign.createdAt).toLocaleDateString()}
                  </p>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedDesign(null)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function LibraryBackgroundsContent() {
  const { toast } = useToast();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingAsset, setEditingAsset] = useState<LibraryAsset | null>(null);
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
  const [filterSeason, setFilterSeason] = useState("all");
  const [filterEvent, setFilterEvent] = useState("all");

  const { data: assets = [], isLoading } = useQuery<LibraryAsset[]>({
    queryKey: ["/api/admin/library/admin", { assetType: "background", mediaType: "image" }],
    queryFn: async () => {
      const params = new URLSearchParams({ assetType: "background", mediaType: "image" });
      const response = await fetch(`/api/admin/library/admin?${params}`);
      if (!response.ok) throw new Error("Failed to fetch backgrounds");
      return response.json();
    },
  });

  const { data: stores = [] } = useQuery<PartnerStore[]>({
    queryKey: ["/api/admin/partner-stores"],
  });

  const allSegments = stores.reduce((acc, store) => {
    const segments = store.availableSegments || [];
    segments.forEach((s: string) => { if (!acc.includes(s)) acc.push(s); });
    return acc;
  }, [] as string[]);

  const filteredAssets = assets.filter((asset) => {
    if (filterSeason !== "all" && asset.season !== filterSeason) return false;
    if (filterEvent !== "all" && asset.event !== filterEvent) return false;
    return true;
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const response = await apiRequest("PUT", `/api/admin/library/${id}`, data);
      return await response.json();
    },
    onSuccess: () => {
      toast({ 
        title: "Background Updated", 
        description: "Your changes have been saved successfully.",
        duration: 4000,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/library/admin"] });
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
      const response = await apiRequest("DELETE", `/api/admin/library/${id}`, {});
      return await response.json();
    },
    onSuccess: () => {
      toast({ 
        title: "Background Deleted", 
        description: "The background has been removed from your library.",
        duration: 4000,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/library/admin"] });
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
    setIsDialogOpen(true);
  };

  const handleOpenEdit = (asset: LibraryAsset) => {
    setEditingAsset(asset);
    setFormData({
      name: asset.name,
      description: asset.description || "",
      category: asset.category || "",
      season: asset.season || "none",
      event: asset.event || "none",
      isActive: asset.isActive ?? true,
      isFeatured: asset.isFeatured ?? false,
      visibleStoreSlugs: asset.visibleStoreSlugs || [],
      visibleSegments: (asset.visibleSegments as { segments?: string[] })?.segments || [],
    });
    setImagePreview(asset.publicUrl);
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
      if (!file.type.startsWith("image/")) {
        toast({ 
          title: "Invalid File Type", 
          description: "Please select an image file (PNG, JPG, etc.).", 
          variant: "destructive",
          duration: 4000,
        });
        return;
      }
      setImageFile(file);
      const reader = new FileReader();
      reader.onload = (e) => {
        setImagePreview(e.target?.result as string);
      };
      reader.readAsDataURL(file);
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
      // Convert "none" back to null/empty for database storage
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
        const formDataObj = new FormData();
        formDataObj.append("file", imageFile);
        formDataObj.append("name", formData.name);
        formDataObj.append("description", formData.description);
        formDataObj.append("assetType", "background");
        formDataObj.append("mediaType", "image");
        formDataObj.append("category", formData.category);
        formDataObj.append("season", seasonValue || "");
        formDataObj.append("event", eventValue || "");

        const response = await fetch("/api/admin/library/upload", {
          method: "POST",
          body: formDataObj,
          credentials: "include",
        });

        if (!response.ok) {
          throw new Error("Failed to upload background");
        }

        toast({ 
          title: "Background Added", 
          description: `"${formData.name}" has been added to your library.`,
          duration: 4000,
        });
        queryClient.invalidateQueries({ queryKey: ["/api/admin/library/admin"] });
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
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold">Library Backgrounds</h2>
          <p className="text-sm text-muted-foreground">Organized by season and event for custom products</p>
        </div>
        <Button onClick={handleOpenCreate} data-testid="button-add-library-background">
          <Plus className="h-4 w-4 mr-2" />
          Add Background
        </Button>
      </div>

      <Card className="mb-4">
        <CardContent className="pt-4">
          <div className="flex flex-wrap gap-4">
            <div className="w-48">
              <Label>Filter by Season</Label>
              <Select value={filterSeason} onValueChange={setFilterSeason}>
                <SelectTrigger data-testid="select-filter-season">
                  <SelectValue placeholder="All Seasons" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Seasons</SelectItem>
                  {SEASONS.filter(s => s.value !== "none").map((s) => (
                    <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="w-48">
              <Label>Filter by Event</Label>
              <Select value={filterEvent} onValueChange={setFilterEvent}>
                <SelectTrigger data-testid="select-filter-event">
                  <SelectValue placeholder="All Events" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Events</SelectItem>
                  {EVENTS.filter(e => e.value !== "none").map((e) => (
                    <SelectItem key={e.value} value={e.value}>{e.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

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
                <img
                  src={asset.publicUrl}
                  alt={asset.name}
                  className="w-full h-full object-cover"
                />
                <div className="absolute top-2 right-2 flex gap-1 flex-wrap justify-end">
                  {asset.season && <Badge variant="secondary">{asset.season}</Badge>}
                  {asset.event && <Badge variant="outline">{asset.event}</Badge>}
                </div>
                {asset.isFeatured && (
                  <Badge className="absolute top-2 left-2">Featured</Badge>
                )}
              </div>
              <CardContent className="p-3">
                <p className="font-medium truncate">{asset.name}</p>
                {asset.description && (
                  <p className="text-xs text-muted-foreground truncate">{asset.description}</p>
                )}
                <div className="flex items-center justify-between mt-2">
                  <Badge variant={asset.isActive ? "default" : "secondary"}>
                    {asset.isActive ? "Active" : "Inactive"}
                  </Badge>
                  <span className="text-xs text-muted-foreground">Used {asset.usageCount}x</span>
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

      {/* Inline Form - replaces modal for better mobile experience */}
      {isDialogOpen && (
        <Card className="mb-6 border-2 border-primary/50">
          <CardHeader className="pb-4">
            <CardTitle className="text-xl">
              {editingAsset ? "Edit Background" : "Add Library Background"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Image Upload Section */}
            {!editingAsset && (
              <div className="space-y-3">
                <Label htmlFor="library-bg-image" className="text-base font-medium">Background Image</Label>
                {imagePreview && (
                  <div className="aspect-video max-w-md rounded-lg overflow-hidden border-2 border-border">
                    <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
                  </div>
                )}
                <Input
                  id="library-bg-image"
                  type="file"
                  accept="image/*"
                  onChange={handleImageChange}
                  className="h-12 text-base"
                  title="Recommended: 4500 × 5400 px (portrait), 300 DPI for best print quality"
                  data-testid="input-library-bg-image"
                />
                <p className="text-sm text-muted-foreground">Print: 4500×5400px, 300 DPI, PNG, transparent bg, RGB</p>
              </div>
            )}

            {editingAsset && imagePreview && (
              <div className="aspect-video max-w-md rounded-lg overflow-hidden border-2 border-border">
                <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
              </div>
            )}

            {/* Name Field */}
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

            {/* Description Field */}
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

            {/* Season and Event */}
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

            {/* Active/Featured Switches */}
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

            {/* Store Visibility */}
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

            {/* Segment Visibility */}
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

            {/* Action Buttons */}
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

export default function AdminBackgrounds() {
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();

  const copyUserId = () => {
    if (user?.id) {
      navigator.clipboard.writeText(user.id);
      toast({ title: "User ID copied to clipboard" });
    }
  };

  return (
    <div className="qr-admin-page">
      <BreadcrumbTrail />
      <div className="qr-admin-bar">
        <div className="qr-admin-bar__inner">
          <div className="qr-admin-bar__left">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate("/admin")}
              className="text-white hover:bg-white/10 qr-touch-48"
              data-testid="button-back"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <Image className="qr-admin-bar__icon" />
            <div>
              <h1 className="qr-admin-bar__title" data-testid="text-page-title">
                Library
              </h1>
              <p className="qr-admin-bar__subtitle">
                Manage templates and backgrounds
              </p>
            </div>
          </div>
          {user && (
            <div className="qr-admin-bar__right">
              <div className="text-right hidden sm:block">
                <p className="text-xs text-slate-400">Logged in as</p>
                <p className="text-sm font-medium">{user.email || user.id}</p>
              </div>
              <Button 
                variant="outline"
                onClick={copyUserId}
                className="font-mono text-xs border-slate-600 text-slate-300 hover:bg-slate-800 qr-touch-48"
                data-testid="button-copy-user-id"
              >
                Copy ID
              </Button>
            </div>
          )}
        </div>
      </div>

      <main className="qr-admin-main">
        <nav className="qr-admin-breadcrumb" aria-label="Breadcrumb">
          <Link href="/admin" data-testid="link-breadcrumb-admin">Admin</Link>
          <span className="qr-admin-breadcrumb__separator">/</span>
          <span className="qr-admin-breadcrumb__current" aria-current="page" data-testid="text-breadcrumb-current">Library</span>
        </nav>

        <Tabs defaultValue="templates" className="space-y-4">
          <TabsList>
            <TabsTrigger value="templates" data-testid="tab-templates">
              <Image className="h-4 w-4 mr-2" />
              Templates
            </TabsTrigger>
            <TabsTrigger value="backgrounds" data-testid="tab-backgrounds">
              <FolderOpen className="h-4 w-4 mr-2" />
              Backgrounds
            </TabsTrigger>
          </TabsList>
          <TabsContent value="templates">
            <TemplatesContent />
          </TabsContent>
          <TabsContent value="backgrounds">
            <LibraryBackgroundsContent />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
