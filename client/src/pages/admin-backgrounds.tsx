import { useState, useRef, useCallback, useEffect } from "react";
import ReactCrop, { type Crop, centerCrop, makeAspectCrop } from "react-image-crop";
import "react-image-crop/dist/ReactCrop.css";
import { useLocation, Link } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Nexus } from "@/lib/nexus";
import { auth } from "@/lib/firebase";
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
import { ArrowLeft, Loader2, Plus, Pencil, Trash2, Check, X, Image, FolderOpen, Copy, ExternalLink, Upload, Crop as CropIcon, ImagePlus } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import type { CustomDesign, LibraryAsset, PartnerStore, BackgroundAsset } from "@shared/schema";

// Extended type with proxy URL from backend
type BackgroundAssetWithProxy = BackgroundAsset & { proxyUrl: string | null };

// Authenticated Image component that fetches images with auth headers
function AuthenticatedImage({ src, alt, className }: { src: string; alt: string; className?: string }) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let isMounted = true;
    
    const fetchImage = async () => {
      try {
        const token = await auth.currentUser?.getIdToken();
        const response = await fetch(src, {
          headers: { Authorization: `Bearer ${token}` }
        });
        
        if (!response.ok) throw new Error('Failed to load image');
        
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        
        if (isMounted) {
          setBlobUrl(url);
          setLoading(false);
        }
      } catch (err) {
        if (isMounted) {
          setError(true);
          setLoading(false);
        }
      }
    };
    
    if (src) fetchImage();
    
    return () => {
      isMounted = false;
      if (blobUrl) URL.revokeObjectURL(blobUrl);
    };
  }, [src]);

  if (loading) {
    return (
      <div className={`flex items-center justify-center bg-muted ${className}`}>
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !blobUrl) {
    return (
      <div className={`flex items-center justify-center bg-muted ${className}`}>
        <Image className="h-6 w-6 text-muted-foreground" />
      </div>
    );
  }

  return <img src={blobUrl} alt={alt} className={className} />;
}

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
      const response = await apiRequest("GET", `/api/admin/library/admin?${params}`);
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

        // Get auth token for the request
        const token = await auth.currentUser?.getIdToken();
        
        const response = await fetch("/api/admin/library/upload", {
          method: "POST",
          body: formDataObj,
          credentials: "include",
          headers: token ? { "Authorization": `Bearer ${token}` } : {},
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

// Upload item type for tracking individual file uploads
type UploadItem = {
  id: string;
  name: string;
  previewUrl: string;
  status: 'pending' | 'uploading' | 'success' | 'error';
  error?: string;
};

// Source Images Content - Bulk upload original backgrounds
function SourceImagesContent() {
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
    staleTime: 0, // Always refetch on mount to ensure fresh data after auth
    retry: 2,
  });

  // Refetch when component mounts to ensure we have fresh data after auth
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

  // Open crop dialog for a source image
  const handleOpenCrop = async (asset: BackgroundAssetWithProxy) => {
    setImageToCrop(asset);
    setCrop(undefined);
    setCropImageBlobUrl(null);
    setCropDialogOpen(true);
    setCropImageLoading(true);
    
    try {
      const token = await auth.currentUser?.getIdToken();
      const response = await fetch(asset.proxyUrl || asset.imageUrl, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (!response.ok) throw new Error('Failed to load image');
      
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      setCropImageBlobUrl(url);
    } catch (err) {
      toast({ title: "Failed to load image", variant: "destructive" });
      setCropDialogOpen(false);
    } finally {
      setCropImageLoading(false);
    }
  };

  // Initialize crop when image loads
  const onCropImageLoad = useCallback((e: React.SyntheticEvent<HTMLImageElement>) => {
    const { width, height } = e.currentTarget;
    const aspectRatio = 9 / 16;
    const newCrop = centerCrop(
      makeAspectCrop({ unit: '%', width: 90 }, aspectRatio, width, height),
      width, height
    );
    setCrop(newCrop as Crop);
  }, []);

  // Generate cropped image data URL
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

  // Save cropped image
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

      // Create upload items with preview URLs
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
        
        // Mark current item as uploading
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

          // Use fetch with timeout for large files (2 min timeout)
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 120000);
          
          // Get auth token for the request
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
      // Clean up object URLs after a delay to let user see final state
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

    // Create upload items with preview URLs
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
        
        // Mark current item as uploading
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
      // Clean up object URLs after a delay
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
          
          {/* Visual upload progress with thumbnails */}
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
              
              {/* Progress bar */}
              <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                <div 
                  className="bg-primary h-full transition-all duration-300"
                  style={{ width: `${(uploadProgress.current / uploadProgress.total) * 100}%` }}
                />
              </div>
              
              {/* Thumbnail grid */}
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
                    {/* Status overlay */}
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
                <AuthenticatedImage src={asset.proxyUrl || asset.imageUrl} alt={asset.name} className="w-full h-full object-cover" />
              </div>
              <CardContent className="p-2">
                <p className="text-xs truncate">{asset.name}</p>
                <div className="flex gap-1 mt-1">
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1"
                    onClick={() => handleOpenCrop(asset)}
                    data-testid={`button-crop-source-${asset.id}`}
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

      {/* Crop Dialog */}
      <Dialog open={cropDialogOpen} onOpenChange={(open) => {
        if (!open && cropImageBlobUrl) {
          URL.revokeObjectURL(cropImageBlobUrl);
          setCropImageBlobUrl(null);
        }
        setCropDialogOpen(open);
      }}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Crop Image for 9:16 Ratio</DialogTitle>
          </DialogHeader>
          {imageToCrop && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Drag the selection box to choose the area you want. This will be saved to Cropped Images.
              </p>
              <div className="relative rounded-lg overflow-hidden bg-black/10 max-h-[60vh] min-h-[200px] flex items-center justify-center">
                {cropImageLoading ? (
                  <div className="text-center">
                    <Loader2 className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
                    <p className="text-sm text-muted-foreground mt-2">Loading image...</p>
                  </div>
                ) : cropImageBlobUrl ? (
                  <ReactCrop
                    crop={crop}
                    onChange={(_, percentCrop) => setCrop(percentCrop)}
                    aspect={9 / 16}
                  >
                    <img
                      ref={cropImgRef}
                      src={cropImageBlobUrl}
                      alt={imageToCrop.name}
                      onLoad={onCropImageLoad}
                      className="max-w-full max-h-[55vh] mx-auto"
                      data-testid="img-crop-preview"
                    />
                  </ReactCrop>
                ) : (
                  <p className="text-muted-foreground">Failed to load image</p>
                )}
              </div>
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
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

// Cropped Images Content - Stored cropped versions
function CroppedImagesContent() {
  const { toast } = useToast();

  const { data: assets = [], isLoading, refetch } = useQuery<BackgroundAssetWithProxy[]>({
    queryKey: ["/api/admin/background-assets", "cropped"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/admin/background-assets?type=cropped");
      return res.json();
    },
    staleTime: 0,
    retry: 2,
  });

  // Refetch on mount
  useEffect(() => {
    refetch();
  }, [refetch]);

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/admin/background-assets/${id}`);
    },
    onSuccess: () => {
      toast({ title: "Image deleted" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/background-assets", "cropped"] });
    },
    onError: (error: any) => {
      toast({ title: "Delete failed", description: error.message, variant: "destructive" });
    },
  });

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
          <h3 className="text-lg font-semibold">{assets.length} Cropped Images</h3>
          <p className="text-sm text-muted-foreground">9:16 cropped images ready for product design</p>
        </div>
      </div>

      {assets.length === 0 ? (
        <Card className="text-center py-12">
          <CardContent>
            <CropIcon className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p className="text-muted-foreground">No cropped images yet.</p>
            <p className="text-sm text-muted-foreground mt-2">Cropped images appear here after you crop source images in the product builder.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
          {assets.map((asset) => (
            <Card key={asset.id} className="overflow-hidden" data-testid={`card-cropped-${asset.id}`}>
              <div className="aspect-[9/16] relative">
                <AuthenticatedImage src={asset.proxyUrl || asset.imageUrl} alt={asset.name} className="w-full h-full object-cover" />
              </div>
              <CardContent className="p-2">
                <p className="text-xs truncate">{asset.name}</p>
                <Button
                  size="sm"
                  variant="ghost"
                  className="w-full mt-1 text-destructive hover:text-destructive"
                  onClick={() => deleteMutation.mutate(asset.id)}
                  data-testid={`button-delete-cropped-${asset.id}`}
                >
                  <Trash2 className="h-3 w-3 mr-1" />
                  Delete
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
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
          <TabsList className="grid grid-cols-2 h-auto gap-2 p-2 bg-muted/50">
            <TabsTrigger value="templates" className="h-14 text-base flex-col gap-1" data-testid="tab-templates">
              <Image className="h-5 w-5" />
              Templates
            </TabsTrigger>
            <TabsTrigger value="backgrounds" className="h-14 text-base flex-col gap-1" data-testid="tab-backgrounds">
              <FolderOpen className="h-5 w-5" />
              Backgrounds
            </TabsTrigger>
            <TabsTrigger value="source" className="h-14 text-base flex-col gap-1" data-testid="tab-source-images">
              <Upload className="h-5 w-5" />
              Source Images
            </TabsTrigger>
            <TabsTrigger value="cropped" className="h-14 text-base flex-col gap-1" data-testid="tab-cropped-images">
              <CropIcon className="h-5 w-5" />
              Cropped
            </TabsTrigger>
          </TabsList>
          <TabsContent value="templates">
            <TemplatesContent />
          </TabsContent>
          <TabsContent value="backgrounds">
            <LibraryBackgroundsContent />
          </TabsContent>
          <TabsContent value="source">
            <SourceImagesContent />
          </TabsContent>
          <TabsContent value="cropped">
            <CroppedImagesContent />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
