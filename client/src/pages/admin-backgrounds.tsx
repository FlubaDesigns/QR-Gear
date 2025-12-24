import { useState } from "react";
import { useLocation, Link } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
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
  DialogClose,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { ArrowLeft, Loader2, Plus, Pencil, Trash2, Check, X, Image, FolderOpen } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

interface QrTemplate {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
  thumbnailUrl: string;
  fullImageUrl: string;
  storageUrl: string;
  priceUpcharge: string;
  isActive: boolean;
  isFeatured: boolean;
  sortOrder: number;
  createdAt: string;
}

interface LibraryAsset {
  id: string;
  ownerType: string;
  userId: string | null;
  assetType: string;
  mediaType: string;
  name: string;
  originalName: string;
  description: string | null;
  fileName: string;
  storageUrl: string;
  publicUrl: string;
  category: string | null;
  season: string | null;
  event: string | null;
  tags: string | null;
  sortOrder: number;
  usageCount: number;
  isActive: boolean;
  isFeatured: boolean;
  createdAt: string;
  updatedAt: string;
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
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<QrTemplate | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    category: "custom",
    priceUpcharge: "0",
    isActive: true,
    isFeatured: false,
  });
  const [uploading, setUploading] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  const { data: templates = [], isLoading } = useQuery<QrTemplate[]>({
    queryKey: ["/api/admin/templates"],
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await apiRequest("POST", "/api/admin/templates", data);
      return await response.json();
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Template created successfully." });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/templates"] });
      handleCloseDialog();
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to create template.", variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const response = await apiRequest("PUT", `/api/admin/templates/${id}`, data);
      return await response.json();
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Template updated successfully." });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/templates"] });
      handleCloseDialog();
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update template.", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiRequest("DELETE", `/api/admin/templates/${id}`, {});
      return await response.json();
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Template deleted successfully." });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/templates"] });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to delete template.", variant: "destructive" });
    },
  });

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setEditingTemplate(null);
    setFormData({
      name: "",
      description: "",
      category: "custom",
      priceUpcharge: "0",
      isActive: true,
      isFeatured: false,
    });
    setImageFile(null);
    setImagePreview(null);
  };

  const handleOpenCreate = () => {
    setEditingTemplate(null);
    setFormData({
      name: "",
      description: "",
      category: "custom",
      priceUpcharge: "0",
      isActive: true,
      isFeatured: false,
    });
    setImageFile(null);
    setImagePreview(null);
    setIsDialogOpen(true);
  };

  const handleOpenEdit = (template: QrTemplate) => {
    setEditingTemplate(template);
    setFormData({
      name: template.name,
      description: template.description || "",
      category: template.category || "custom",
      priceUpcharge: template.priceUpcharge,
      isActive: template.isActive,
      isFeatured: template.isFeatured,
    });
    setImagePreview(template.thumbnailUrl);
    setIsDialogOpen(true);
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      const reader = new FileReader();
      reader.onload = (e) => {
        setImagePreview(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async () => {
    if (!editingTemplate && !imageFile) {
      toast({ title: "Error", description: "Please upload an image.", variant: "destructive" });
      return;
    }

    setUploading(true);

    try {
      let imageUrls = {
        thumbnailUrl: editingTemplate?.thumbnailUrl || "",
        fullImageUrl: editingTemplate?.fullImageUrl || "",
        storageUrl: editingTemplate?.storageUrl || "",
      };

      if (imageFile) {
        const reader = new FileReader();
        const base64 = await new Promise<string>((resolve, reject) => {
          reader.onload = () => {
            const result = reader.result as string;
            resolve(result.split(",")[1]);
          };
          reader.onerror = reject;
          reader.readAsDataURL(imageFile);
        });

        const uploadResponse = await apiRequest("POST", "/api/images/upload", {
          imageData: base64,
          originalName: imageFile.name,
          mimeType: imageFile.type,
        });
        const uploadData = await uploadResponse.json();
        imageUrls = {
          thumbnailUrl: uploadData.directUrl,
          fullImageUrl: uploadData.directUrl,
          storageUrl: uploadData.directUrl,
        };
      }

      const templateData = {
        name: formData.name,
        description: formData.description || null,
        category: formData.category,
        thumbnailUrl: imageUrls.thumbnailUrl,
        fullImageUrl: imageUrls.fullImageUrl,
        storageUrl: imageUrls.storageUrl,
        priceUpcharge: formData.priceUpcharge,
        isActive: formData.isActive,
        isFeatured: formData.isFeatured,
      };

      if (editingTemplate) {
        updateMutation.mutate({ id: editingTemplate.id, data: templateData });
      } else {
        createMutation.mutate(templateData);
      }
    } catch (error) {
      toast({ title: "Error", description: "Failed to upload image.", variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const handleToggleActive = (template: QrTemplate) => {
    updateMutation.mutate({ id: template.id, data: { isActive: !template.isActive } });
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
          <h2 className="text-lg font-semibold">Pre-designed Templates</h2>
          <p className="text-sm text-muted-foreground">Curated backgrounds for QR Gift designs (Featured Collection)</p>
        </div>
        <Button size="sm" onClick={handleOpenCreate} data-testid="button-add-template">
          <Plus className="h-4 w-4 mr-2" />
          Add Template
        </Button>
      </div>

      {templates.length === 0 ? (
        <Card className="text-center py-12">
          <CardContent>
            <Image className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p className="text-muted-foreground">No templates uploaded yet.</p>
            <p className="text-sm text-muted-foreground">Upload beautiful backgrounds for customer gift designs.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {templates.map((template) => (
            <Card key={template.id} className={`overflow-hidden ${!template.isActive ? "opacity-50" : ""}`} data-testid={`card-template-${template.id}`}>
              <div className="aspect-square relative">
                <img
                  src={template.thumbnailUrl}
                  alt={template.name}
                  className="w-full h-full object-cover"
                />
                {template.isFeatured && (
                  <Badge className="absolute top-2 left-2">Featured</Badge>
                )}
                {!template.isActive && (
                  <Badge variant="secondary" className="absolute top-2 right-2">Inactive</Badge>
                )}
              </div>
              <CardContent className="p-3">
                <p className="font-medium truncate">{template.name}</p>
                <div className="flex items-center justify-between gap-2 mt-1">
                  <Badge variant="outline" className="text-xs">{template.category}</Badge>
                  {parseFloat(template.priceUpcharge) > 0 && (
                    <span className="text-xs text-muted-foreground">+${template.priceUpcharge}</span>
                  )}
                </div>
                <div className="flex gap-1 mt-3">
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1"
                    onClick={() => handleOpenEdit(template)}
                    data-testid={`button-edit-template-${template.id}`}
                  >
                    <Pencil className="h-3 w-3" />
                  </Button>
                  <Button
                    size="sm"
                    variant={template.isActive ? "default" : "secondary"}
                    onClick={() => handleToggleActive(template)}
                    data-testid={`button-toggle-active-${template.id}`}
                  >
                    {template.isActive ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => deleteMutation.mutate(template.id)}
                    data-testid={`button-delete-template-${template.id}`}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingTemplate ? "Edit Template" : "Add New Template"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="template-image">Background Image</Label>
              {imagePreview && (
                <div className="aspect-video rounded-md overflow-hidden mb-2">
                  <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
                </div>
              )}
              <Input
                id="template-image"
                type="file"
                accept="image/*"
                onChange={handleImageChange}
                title="Recommended: 4500 × 5400 px (portrait), 300 DPI for best print quality"
                data-testid="input-template-image"
              />
              <p className="text-xs text-muted-foreground">Recommended: 4500 × 5400 px, 300 DPI</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="template-name">Name</Label>
              <Input
                id="template-name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., John 3:16"
                data-testid="input-template-name"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="template-description">Description</Label>
              <Textarea
                id="template-description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Brief description of the template..."
                rows={2}
                data-testid="textarea-template-description"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="template-category">Category</Label>
                <select
                  id="template-category"
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  className="w-full h-9 rounded-md border bg-background px-3 text-sm"
                  data-testid="select-template-category"
                >
                  {TEMPLATE_CATEGORIES.map((cat) => (
                    <option key={cat.value} value={cat.value}>{cat.label}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="template-upcharge">Price Upcharge ($)</Label>
                <Input
                  id="template-upcharge"
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.priceUpcharge}
                  onChange={(e) => setFormData({ ...formData, priceUpcharge: e.target.value })}
                  data-testid="input-template-upcharge"
                />
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Switch
                  id="template-active"
                  checked={formData.isActive}
                  onCheckedChange={(checked) => setFormData({ ...formData, isActive: checked })}
                />
                <Label htmlFor="template-active">Active</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  id="template-featured"
                  checked={formData.isFeatured}
                  onCheckedChange={(checked) => setFormData({ ...formData, isFeatured: checked })}
                />
                <Label htmlFor="template-featured">Featured</Label>
              </div>
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Cancel</Button>
            </DialogClose>
            <Button
              onClick={handleSubmit}
              disabled={uploading || createMutation.isPending || updateMutation.isPending || !formData.name}
              data-testid="button-save-template"
            >
              {(uploading || createMutation.isPending || updateMutation.isPending) && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              {editingTemplate ? "Update" : "Create"}
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
      toast({ title: "Success", description: "Background updated successfully." });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/library/admin"] });
      handleCloseDialog();
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update background.", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiRequest("DELETE", `/api/admin/library/${id}`, {});
      return await response.json();
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Background deleted successfully." });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/library/admin"] });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to delete background.", variant: "destructive" });
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
      isActive: asset.isActive,
      isFeatured: asset.isFeatured,
    });
    setImagePreview(asset.publicUrl);
    setIsDialogOpen(true);
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith("image/")) {
        toast({ title: "Error", description: "Please select an image file.", variant: "destructive" });
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
      toast({ title: "Error", description: "Please upload an image.", variant: "destructive" });
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

        toast({ title: "Success", description: "Background uploaded successfully." });
        queryClient.invalidateQueries({ queryKey: ["/api/admin/library/admin"] });
        handleCloseDialog();
      }
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Failed to save background.", variant: "destructive" });
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
        <Button size="sm" onClick={handleOpenCreate} data-testid="button-add-library-background">
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
                <div className="flex gap-1 mt-3">
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1"
                    onClick={() => handleOpenEdit(asset)}
                    data-testid={`button-edit-library-bg-${asset.id}`}
                  >
                    <Pencil className="h-3 w-3" />
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => deleteMutation.mutate(asset.id)}
                    data-testid={`button-delete-library-bg-${asset.id}`}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingAsset ? "Edit Background" : "Add Library Background"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {!editingAsset && (
              <div className="space-y-2">
                <Label htmlFor="library-bg-image">Background Image</Label>
                {imagePreview && (
                  <div className="aspect-video rounded-md overflow-hidden mb-2">
                    <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
                  </div>
                )}
                <Input
                  id="library-bg-image"
                  type="file"
                  accept="image/*"
                  onChange={handleImageChange}
                  title="Recommended: 4500 × 5400 px (portrait), 300 DPI for best print quality"
                  data-testid="input-library-bg-image"
                />
                <p className="text-xs text-muted-foreground">Recommended: 4500 × 5400 px, 300 DPI</p>
              </div>
            )}

            {editingAsset && imagePreview && (
              <div className="aspect-video rounded-md overflow-hidden">
                <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="library-bg-name">Name</Label>
              <Input
                id="library-bg-name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Background name"
                data-testid="input-library-bg-name"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="library-bg-description">Description</Label>
              <Textarea
                id="library-bg-description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Optional description..."
                rows={2}
                data-testid="input-library-bg-description"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Season</Label>
                <Select
                  value={formData.season}
                  onValueChange={(value) => setFormData({ ...formData, season: value })}
                >
                  <SelectTrigger data-testid="select-library-bg-season">
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
                <Label>Event</Label>
                <Select
                  value={formData.event}
                  onValueChange={(value) => setFormData({ ...formData, event: value })}
                >
                  <SelectTrigger data-testid="select-library-bg-event">
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

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Switch
                  id="library-bg-active"
                  checked={formData.isActive}
                  onCheckedChange={(checked) => setFormData({ ...formData, isActive: checked })}
                />
                <Label htmlFor="library-bg-active">Active</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  id="library-bg-featured"
                  checked={formData.isFeatured}
                  onCheckedChange={(checked) => setFormData({ ...formData, isFeatured: checked })}
                />
                <Label htmlFor="library-bg-featured">Featured</Label>
              </div>
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Cancel</Button>
            </DialogClose>
            <Button
              onClick={handleSubmit}
              disabled={uploading || updateMutation.isPending || !formData.name}
              data-testid="button-save-library-bg"
            >
              {(uploading || updateMutation.isPending) && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              {editingAsset ? "Update" : "Upload"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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
    <div className="min-h-screen">
      <div className="bg-slate-900 dark:bg-slate-950 text-white">
        <div className="container max-w-6xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigate("/admin")}
                className="text-white hover:bg-white/10"
                data-testid="button-back"
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div className="flex items-center gap-2">
                <Image className="h-6 w-6 text-amber-400" />
                <div>
                  <h1 className="text-xl font-bold font-heading" data-testid="text-page-title">
                    Backgrounds
                  </h1>
                  <p className="text-xs text-slate-400">
                    Manage background images
                  </p>
                </div>
              </div>
            </div>
            {user && (
              <div className="flex items-center gap-3">
                <div className="text-right hidden sm:block">
                  <p className="text-xs text-slate-400">Logged in as</p>
                  <p className="text-sm font-medium">{user.email || user.id}</p>
                </div>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={copyUserId}
                  className="font-mono text-xs border-slate-600 text-slate-300 hover:bg-slate-800"
                  data-testid="button-copy-user-id"
                >
                  Copy ID
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>

      <main className="container max-w-6xl mx-auto py-6 px-4">
        <nav className="mb-4 text-sm" aria-label="Breadcrumb">
          <Link href="/admin" className="text-muted-foreground hover:text-foreground" data-testid="link-breadcrumb-admin">Admin</Link>
          <span className="text-muted-foreground mx-2">/</span>
          <span className="text-foreground font-medium" aria-current="page" data-testid="text-breadcrumb-current">Backgrounds</span>
        </nav>

        <Tabs defaultValue="templates" className="space-y-4">
          <TabsList>
            <TabsTrigger value="templates" data-testid="tab-templates">
              <Image className="h-4 w-4 mr-2" />
              Templates
            </TabsTrigger>
            <TabsTrigger value="library" data-testid="tab-library">
              <FolderOpen className="h-4 w-4 mr-2" />
              Library
            </TabsTrigger>
          </TabsList>
          <TabsContent value="templates">
            <TemplatesContent />
          </TabsContent>
          <TabsContent value="library">
            <LibraryBackgroundsContent />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
