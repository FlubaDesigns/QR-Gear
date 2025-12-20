import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import Navbar from "@/components/Navbar";
import PageBreadcrumb from "@/components/PageBreadcrumb";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import {
  Plus,
  Pencil,
  Trash2,
  GripVertical,
  Church,
  Flag,
  Trophy,
  Briefcase,
  Music,
  Palette,
  Tag,
  ArrowLeft,
  Loader2,
  RefreshCw,
  Package,
  DollarSign,
  Image,
  Settings,
  Check,
  X,
  Store,
  Globe,
  Link,
} from "lucide-react";
import {
  Category,
  CategoryInput,
  getCategories,
  createCategory,
  updateCategory,
  deleteCategory,
  seedDefaultCategories,
} from "@/lib/categories";
import type { Product, AdminSettings, ProductCategory, PartnerStore } from "@shared/schema";
import { Checkbox } from "@/components/ui/checkbox";

const ICON_MAP: Record<string, typeof Tag> = {
  Church,
  Flag,
  Trophy,
  Briefcase,
  Music,
  Palette,
  Tag,
};

const ICON_OPTIONS = Object.keys(ICON_MAP);

function IconDisplay({ iconName, className }: { iconName: string; className?: string }) {
  const Icon = ICON_MAP[iconName] || Tag;
  return <Icon className={className} />;
}

function CategoriesTab() {
  const { toast } = useToast();
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const [formData, setFormData] = useState<CategoryInput>({
    name: "",
    description: "",
    icon: "Tag",
    isActive: true,
  });

  useEffect(() => {
    loadCategories();
  }, []);

  async function loadCategories() {
    setLoading(true);
    try {
      const cats = await getCategories();
      setCategories(cats);
    } catch (error) {
      console.error("Error loading categories:", error);
      toast({
        title: "Error",
        description: "Failed to load categories.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }

  async function handleSeedDefaults() {
    setSaving(true);
    try {
      await seedDefaultCategories();
      await loadCategories();
      toast({ title: "Success", description: "Default categories added." });
    } catch (error) {
      toast({ title: "Error", description: "Failed to seed defaults.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  function openCreateDialog() {
    setEditingCategory(null);
    setFormData({ name: "", description: "", icon: "Tag", isActive: true });
    setIsDialogOpen(true);
  }

  function openEditDialog(category: Category) {
    setEditingCategory(category);
    setFormData({
      name: category.name,
      description: category.description,
      icon: category.icon,
      isActive: category.isActive,
    });
    setIsDialogOpen(true);
  }

  async function handleSubmit() {
    if (!formData.name.trim()) {
      toast({ title: "Error", description: "Name is required.", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      if (editingCategory) {
        await updateCategory(editingCategory.id, formData);
        toast({ title: "Success", description: `"${formData.name}" updated.` });
      } else {
        await createCategory(formData);
        toast({ title: "Success", description: `"${formData.name}" created.` });
      }
      setIsDialogOpen(false);
      await loadCategories();
    } catch (error) {
      toast({ title: "Error", description: "Failed to save.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    setSaving(true);
    try {
      await deleteCategory(id);
      toast({ title: "Success", description: "Category deleted." });
      setDeleteConfirmId(null);
      await loadCategories();
    } catch (error) {
      toast({ title: "Error", description: "Failed to delete.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-4">
        <div>
          <CardTitle data-testid="text-categories-title">Product Categories</CardTitle>
          <CardDescription>Manage product categories from Firestore</CardDescription>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={loadCategories} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          {categories.length === 0 && !loading && (
            <Button variant="outline" size="sm" onClick={handleSeedDefaults} disabled={saving}>
              Seed Defaults
            </Button>
          )}
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" onClick={openCreateDialog}>
                <Plus className="h-4 w-4 mr-2" />
                Add
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editingCategory ? "Edit Category" : "Add Category"}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Name</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g., Religious"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Icon</Label>
                  <div className="flex flex-wrap gap-2">
                    {ICON_OPTIONS.map((iconName) => (
                      <Button
                        key={iconName}
                        type="button"
                        variant={formData.icon === iconName ? "default" : "outline"}
                        size="icon"
                        onClick={() => setFormData({ ...formData, icon: iconName })}
                      >
                        <IconDisplay iconName={iconName} className="h-4 w-4" />
                      </Button>
                    ))}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    id="isActive"
                    checked={formData.isActive}
                    onCheckedChange={(checked) => setFormData({ ...formData, isActive: checked })}
                  />
                  <Label htmlFor="isActive">Active</Label>
                </div>
              </div>
              <DialogFooter>
                <DialogClose asChild>
                  <Button variant="outline">Cancel</Button>
                </DialogClose>
                <Button onClick={handleSubmit} disabled={saving}>
                  {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  {editingCategory ? "Update" : "Create"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : categories.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Tag className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No categories yet.</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12"></TableHead>
                <TableHead>Name</TableHead>
                <TableHead className="hidden md:table-cell">Description</TableHead>
                <TableHead className="w-24 text-center">Status</TableHead>
                <TableHead className="w-28 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {categories.map((category) => (
                <TableRow key={category.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <GripVertical className="h-4 w-4 text-muted-foreground" />
                      <IconDisplay iconName={category.icon} className="h-5 w-5 text-primary" />
                    </div>
                  </TableCell>
                  <TableCell className="font-medium">{category.name}</TableCell>
                  <TableCell className="hidden md:table-cell text-muted-foreground">
                    {category.description}
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge variant={category.isActive ? "default" : "secondary"}>
                      {category.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" onClick={() => openEditDialog(category)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Dialog
                        open={deleteConfirmId === category.id}
                        onOpenChange={(open) => setDeleteConfirmId(open ? category.id : null)}
                      >
                        <DialogTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Delete Category</DialogTitle>
                          </DialogHeader>
                          <p>Delete "{category.name}"? This cannot be undone.</p>
                          <DialogFooter>
                            <DialogClose asChild>
                              <Button variant="outline">Cancel</Button>
                            </DialogClose>
                            <Button variant="destructive" onClick={() => handleDelete(category.id)} disabled={saving}>
                              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                              Delete
                            </Button>
                          </DialogFooter>
                        </DialogContent>
                      </Dialog>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

function ProductTagEditor({
  productId,
  allCategories,
  assignedCategoryIds,
  isEditing,
  onEdit,
  onSave,
  onCancel,
  isSaving,
}: {
  productId: string;
  allCategories: ProductCategory[];
  assignedCategoryIds: string[];
  isEditing: boolean;
  onEdit: () => void;
  onSave: (categoryIds: string[]) => void;
  onCancel: () => void;
  isSaving: boolean;
}) {
  const [selectedIds, setSelectedIds] = useState<string[]>(assignedCategoryIds);

  useEffect(() => {
    setSelectedIds(assignedCategoryIds);
  }, [assignedCategoryIds, isEditing]);

  const toggleCategory = (id: string) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  if (!isEditing) {
    const assignedNames = allCategories
      .filter(c => assignedCategoryIds.includes(c.id))
      .map(c => c.name);
    return (
      <div className="flex items-center gap-2">
        <div className="flex flex-wrap gap-1 max-w-48">
          {assignedNames.length === 0 ? (
            <span className="text-muted-foreground text-sm">No tags</span>
          ) : (
            assignedNames.slice(0, 3).map(name => (
              <Badge key={name} variant="secondary" className="text-xs">{name}</Badge>
            ))
          )}
          {assignedNames.length > 3 && (
            <Badge variant="outline" className="text-xs">+{assignedNames.length - 3}</Badge>
          )}
        </div>
        <Button size="icon" variant="ghost" onClick={onEdit} data-testid={`button-edit-tags-${productId}`}>
          <Pencil className="w-3 h-3" />
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-2 min-w-64">
      <div className="flex flex-wrap gap-1 max-h-24 overflow-auto">
        {allCategories.map(cat => (
          <Badge
            key={cat.id}
            variant={selectedIds.includes(cat.id) ? "default" : "outline"}
            className="cursor-pointer text-xs"
            onClick={() => toggleCategory(cat.id)}
            data-testid={`badge-tag-${cat.slug}`}
          >
            {selectedIds.includes(cat.id) && <Check className="w-2 h-2 mr-1" />}
            {cat.name}
          </Badge>
        ))}
      </div>
      <div className="flex gap-2">
        <Button size="sm" onClick={() => onSave(selectedIds)} disabled={isSaving} data-testid="button-save-tags">
          {isSaving ? <Loader2 className="w-3 h-3 animate-spin" /> : "Save"}
        </Button>
        <Button size="sm" variant="ghost" onClick={onCancel} disabled={isSaving}>Cancel</Button>
      </div>
    </div>
  );
}

function ProductsTab() {
  const { toast } = useToast();
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  
  const { data: products = [], isLoading, refetch } = useQuery<Product[]>({
    queryKey: ["/api/admin/products"],
  });

  const { data: allCategories = [] } = useQuery<ProductCategory[]>({
    queryKey: ["/api/admin/product-categories"],
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, enabled }: { id: string; enabled: boolean }) => {
      return apiRequest("PATCH", `/api/admin/products/${id}/toggle`, { enabled });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/products"] });
      toast({ title: "Success", description: "Product updated." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update product.", variant: "destructive" });
    },
  });

  const syncCategoriesMutation = useMutation({
    mutationFn: async ({ productId, categoryIds }: { productId: string; categoryIds: string[] }) => {
      return apiRequest("POST", `/api/admin/products/${productId}/categories`, { categoryIds });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/products"] });
      toast({ title: "Success", description: "Product tags updated." });
      setEditingProductId(null);
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update tags.", variant: "destructive" });
    },
  });

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-4">
        <div>
          <CardTitle>Store Products</CardTitle>
          <CardDescription>Enable/disable products and set pricing</CardDescription>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isLoading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : products.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No products yet.</p>
            <p className="text-sm">Add products from the Printify catalog.</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Product</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Tags</TableHead>
                <TableHead className="text-right">Base Price</TableHead>
                <TableHead className="text-right">Markup %</TableHead>
                <TableHead className="w-24 text-center">Enabled</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {products.map((product) => (
                <TableRow key={product.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      {product.imageUrl && (
                        <img src={product.imageUrl} alt="" className="w-10 h-10 rounded object-cover" />
                      )}
                      <div>
                        <div className="font-medium">{product.name}</div>
                        {product.madeInUSA && (
                          <Badge variant="outline" className="text-xs">USA Made</Badge>
                        )}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>{product.category}</TableCell>
                  <TableCell>
                    <ProductTagEditor
                      productId={product.id}
                      allCategories={allCategories.filter(c => c.isActive)}
                      assignedCategoryIds={product.categoryIds || []}
                      isEditing={editingProductId === product.id}
                      onEdit={() => setEditingProductId(product.id)}
                      onSave={(categoryIds) => syncCategoriesMutation.mutate({ productId: product.id, categoryIds })}
                      onCancel={() => setEditingProductId(null)}
                      isSaving={syncCategoriesMutation.isPending}
                    />
                  </TableCell>
                  <TableCell className="text-right">${product.basePrice}</TableCell>
                  <TableCell className="text-right">{product.markupPercent || 0}%</TableCell>
                  <TableCell className="text-center">
                    <Switch
                      checked={product.isEnabled || false}
                      onCheckedChange={(enabled) => toggleMutation.mutate({ id: product.id, enabled })}
                      disabled={toggleMutation.isPending}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

function PricingTab() {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);

  const { data: settings, isLoading, refetch } = useQuery<AdminSettings>({
    queryKey: ["/api/admin/settings"],
  });

  const [formData, setFormData] = useState({
    globalMarkupPercent: "25",
    globalMarkupFixed: "0",
    globalQrProductionCost: "2",
    textAboveUpcharge: "2",
    textBelowUpcharge: "2",
    imageHostingUpcharge: "5",
    showPricesBeforeCustomization: false,
  });

  useEffect(() => {
    if (settings) {
      setFormData({
        globalMarkupPercent: settings.globalMarkupPercent || "25",
        globalMarkupFixed: settings.globalMarkupFixed || "0",
        globalQrProductionCost: settings.globalQrProductionCost || "2",
        textAboveUpcharge: settings.textAboveUpcharge || "2",
        textBelowUpcharge: settings.textBelowUpcharge || "2",
        imageHostingUpcharge: settings.imageHostingUpcharge || "5",
        showPricesBeforeCustomization: settings.showPricesBeforeCustomization || false,
      });
    }
  }, [settings]);

  async function handleSave() {
    setSaving(true);
    try {
      await apiRequest("PUT", "/api/admin/settings", formData);
      queryClient.invalidateQueries({ queryKey: ["/api/admin/settings"] });
      toast({ title: "Success", description: "Pricing settings saved." });
    } catch (error) {
      toast({ title: "Error", description: "Failed to save settings.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-12">
          <div className="flex items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Global Pricing Settings</CardTitle>
          <CardDescription>
            Set default markup and production costs. Individual products can override these.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="markupPercent">Default Markup (%)</Label>
              <Input
                id="markupPercent"
                type="number"
                value={formData.globalMarkupPercent}
                onChange={(e) => setFormData({ ...formData, globalMarkupPercent: e.target.value })}
              />
              <p className="text-xs text-muted-foreground">Applied to base price + QR cost</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="markupFixed">Fixed Markup ($)</Label>
              <Input
                id="markupFixed"
                type="number"
                value={formData.globalMarkupFixed}
                onChange={(e) => setFormData({ ...formData, globalMarkupFixed: e.target.value })}
              />
              <p className="text-xs text-muted-foreground">Added after percentage markup</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="qrCost">QR Production Cost ($)</Label>
              <Input
                id="qrCost"
                type="number"
                value={formData.globalQrProductionCost}
                onChange={(e) => setFormData({ ...formData, globalQrProductionCost: e.target.value })}
              />
              <p className="text-xs text-muted-foreground">Cost for QR code printing/embedding</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Premium Features Upcharges</CardTitle>
          <CardDescription>Additional charges for premium customization options</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-2">
              <Label htmlFor="textAbove">Text Above QR ($)</Label>
              <Input
                id="textAbove"
                type="number"
                value={formData.textAboveUpcharge}
                onChange={(e) => setFormData({ ...formData, textAboveUpcharge: e.target.value })}
              />
              <p className="text-xs text-muted-foreground">Max 20 characters</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="textBelow">Text Below QR ($)</Label>
              <Input
                id="textBelow"
                type="number"
                value={formData.textBelowUpcharge}
                onChange={(e) => setFormData({ ...formData, textBelowUpcharge: e.target.value })}
              />
              <p className="text-xs text-muted-foreground">Max 30 characters</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="imageHosting">Image Hosting ($)</Label>
              <Input
                id="imageHosting"
                type="number"
                value={formData.imageHostingUpcharge}
                onChange={(e) => setFormData({ ...formData, imageHostingUpcharge: e.target.value })}
              />
              <p className="text-xs text-muted-foreground">For custom image QR codes</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Display Settings</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="showPrices">Show prices before customization</Label>
              <p className="text-sm text-muted-foreground">
                {formData.showPricesBeforeCustomization 
                  ? "Prices shown on product cards" 
                  : "Customers see price after building their design"}
              </p>
            </div>
            <Switch
              id="showPrices"
              checked={formData.showPricesBeforeCustomization}
              onCheckedChange={(checked) => setFormData({ ...formData, showPricesBeforeCustomization: checked })}
            />
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving}>
          {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          Save Pricing Settings
        </Button>
      </div>
    </div>
  );
}

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

const TEMPLATE_CATEGORIES = [
  { value: "religious", label: "Religious" },
  { value: "business", label: "Business" },
  { value: "sports", label: "Sports" },
  { value: "entertainment", label: "Entertainment" },
  { value: "holiday", label: "Holiday" },
  { value: "custom", label: "Custom" },
];

function BackgroundsTab() {
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

  const handleToggleFeatured = (template: QrTemplate) => {
    updateMutation.mutate({ id: template.id, data: { isFeatured: !template.isFeatured } });
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-4">
        <div>
          <CardTitle>Pre-designed Templates</CardTitle>
          <CardDescription>Curated backgrounds for QR Gift designs (Line 2)</CardDescription>
        </div>
        <Button size="sm" onClick={handleOpenCreate} data-testid="button-add-template">
          <Plus className="h-4 w-4 mr-2" />
          Add Template
        </Button>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="text-center py-12">
            <Loader2 className="h-8 w-8 mx-auto animate-spin text-muted-foreground" />
          </div>
        ) : templates.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Image className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No templates uploaded yet.</p>
            <p className="text-sm">Upload beautiful backgrounds for customer gift designs.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {templates.map((template) => (
              <Card key={template.id} className={`overflow-hidden ${!template.isActive ? "opacity-50" : ""}`}>
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
      </CardContent>

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
                data-testid="input-template-image"
              />
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
    </Card>
  );
}

function ProductCategoriesTab() {
  const { toast } = useToast();
  
  const { data: categories, isLoading, refetch } = useQuery<ProductCategory[]>({
    queryKey: ["/api/admin/product-categories"],
  });

  const seedMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/admin/product-categories/seed");
      return res.json();
    },
    onSuccess: (data) => {
      refetch();
      toast({
        title: "Categories Seeded",
        description: `Created ${data.created} default product categories.`,
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to seed categories.",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/admin/product-categories/${id}`);
    },
    onSuccess: () => {
      refetch();
      toast({ title: "Deleted", description: "Category removed." });
    },
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      await apiRequest("PUT", `/api/admin/product-categories/${id}`, { isActive });
    },
    onSuccess: () => {
      refetch();
    },
  });

  const groupedCategories = {
    season: categories?.filter(c => c.taxonomyType === "season") || [],
    holiday: categories?.filter(c => c.taxonomyType === "holiday") || [],
    occasion: categories?.filter(c => c.taxonomyType === "occasion") || [],
    other: categories?.filter(c => c.taxonomyType === "other") || [],
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-4">
        <div>
          <CardTitle>Product Categories</CardTitle>
          <CardDescription>
            Organize products by seasons, holidays, and occasions
          </CardDescription>
        </div>
        <Button
          onClick={() => seedMutation.mutate()}
          disabled={seedMutation.isPending}
          data-testid="button-seed-categories"
        >
          {seedMutation.isPending ? (
            <Loader2 className="w-4 h-4 animate-spin mr-2" />
          ) : (
            <Plus className="w-4 h-4 mr-2" />
          )}
          Seed Defaults
        </Button>
      </CardHeader>
      <CardContent className="space-y-6">
        {(!categories || categories.length === 0) ? (
          <div className="text-center py-8 text-muted-foreground">
            <Tag className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>No product categories yet.</p>
            <p className="text-sm">Click "Seed Defaults" to add standard categories.</p>
          </div>
        ) : (
          <>
            {Object.entries(groupedCategories).map(([taxonomyType, cats]) => (
              cats.length > 0 && (
                <div key={taxonomyType}>
                  <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide mb-3">
                    {taxonomyType === "season" ? "Seasons" :
                     taxonomyType === "holiday" ? "Holidays" :
                     taxonomyType === "occasion" ? "Occasions" : "Other Themes"}
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {cats.map(cat => (
                      <Badge
                        key={cat.id}
                        variant={cat.isActive ? "default" : "outline"}
                        className="gap-2 px-3 py-1.5 cursor-pointer"
                        onClick={() => toggleMutation.mutate({ id: cat.id, isActive: !cat.isActive })}
                        data-testid={`badge-category-${cat.slug}`}
                      >
                        {cat.isActive ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />}
                        {cat.name}
                      </Badge>
                    ))}
                  </div>
                </div>
              )
            ))}
          </>
        )}
      </CardContent>
    </Card>
  );
}

function PartnerStoresTab() {
  const { toast } = useToast();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingStore, setEditingStore] = useState<PartnerStore | null>(null);
  const [selectedProducts, setSelectedProducts] = useState<string[]>([]);
  const [formData, setFormData] = useState({
    name: "",
    slug: "",
    description: "",
    logoUrl: "",
    websiteUrl: "",
    allowedOrigins: "",
    primaryColor: "#1e40af",
    accentColor: "#3b82f6",
    commissionPercent: "0",
    isActive: true,
  });

  const { data: stores, isLoading, refetch } = useQuery<PartnerStore[]>({
    queryKey: ["/api/admin/partner-stores"],
  });

  const { data: products } = useQuery<Product[]>({
    queryKey: ["/api/products"],
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const res = await apiRequest("POST", "/api/admin/partner-stores", {
        ...data,
        allowedOrigins: data.allowedOrigins ? data.allowedOrigins.split(",").map(s => s.trim()) : null,
      });
      return res.json();
    },
    onSuccess: (store) => {
      refetch();
      if (selectedProducts.length > 0) {
        syncProductsMutation.mutate({ storeId: store.id, productIds: selectedProducts });
      }
      setIsDialogOpen(false);
      toast({ title: "Success", description: "Partner store created." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to create store.", variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: typeof formData }) => {
      const res = await apiRequest("PUT", `/api/admin/partner-stores/${id}`, {
        ...data,
        allowedOrigins: data.allowedOrigins ? data.allowedOrigins.split(",").map(s => s.trim()) : null,
      });
      return res.json();
    },
    onSuccess: (store) => {
      refetch();
      syncProductsMutation.mutate({ storeId: store.id, productIds: selectedProducts });
      setIsDialogOpen(false);
      toast({ title: "Success", description: "Partner store updated." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update store.", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/admin/partner-stores/${id}`);
    },
    onSuccess: () => {
      refetch();
      toast({ title: "Deleted", description: "Partner store removed." });
    },
  });

  const syncProductsMutation = useMutation({
    mutationFn: async ({ storeId, productIds }: { storeId: string; productIds: string[] }) => {
      await apiRequest("POST", `/api/admin/partner-stores/${storeId}/products`, { productIds });
    },
  });

  function openCreateDialog() {
    setEditingStore(null);
    setFormData({
      name: "",
      slug: "",
      description: "",
      logoUrl: "",
      websiteUrl: "",
      allowedOrigins: "",
      primaryColor: "#1e40af",
      accentColor: "#3b82f6",
      commissionPercent: "0",
      isActive: true,
    });
    setSelectedProducts([]);
    setIsDialogOpen(true);
  }

  async function openEditDialog(store: PartnerStore) {
    setEditingStore(store);
    setFormData({
      name: store.name,
      slug: store.slug,
      description: store.description || "",
      logoUrl: store.logoUrl || "",
      websiteUrl: store.websiteUrl || "",
      allowedOrigins: Array.isArray(store.allowedOrigins) ? store.allowedOrigins.join(", ") : "",
      primaryColor: store.primaryColor || "#1e40af",
      accentColor: store.accentColor || "#3b82f6",
      commissionPercent: store.commissionPercent || "0",
      isActive: store.isActive ?? true,
    });
    try {
      const res = await fetch(`/api/admin/partner-stores/${store.id}/products`);
      const storeProducts = await res.json();
      setSelectedProducts(storeProducts.map((p: { productId: string }) => p.productId));
    } catch {
      setSelectedProducts([]);
    }
    setIsDialogOpen(true);
  }

  function handleSubmit() {
    if (!formData.name.trim()) {
      toast({ title: "Error", description: "Name is required.", variant: "destructive" });
      return;
    }
    const slug = formData.slug.trim() || formData.name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
    const dataWithSlug = { ...formData, slug };
    
    if (editingStore) {
      updateMutation.mutate({ id: editingStore.id, data: dataWithSlug });
    } else {
      createMutation.mutate(dataWithSlug);
    }
  }

  function toggleProduct(productId: string) {
    setSelectedProducts(prev =>
      prev.includes(productId) ? prev.filter(id => id !== productId) : [...prev, productId]
    );
  }

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-4">
        <div>
          <CardTitle>Partner Stores</CardTitle>
          <CardDescription>
            Configure embeddable mini-stores for partners like Kingdom Connects
          </CardDescription>
        </div>
        <Button onClick={openCreateDialog} data-testid="button-add-partner-store">
          <Plus className="w-4 h-4 mr-2" />
          Add Store
        </Button>
      </CardHeader>
      <CardContent>
        {(!stores || stores.length === 0) ? (
          <div className="text-center py-8 text-muted-foreground">
            <Store className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>No partner stores yet.</p>
            <p className="text-sm">Add a partner to enable embedded mini-stores on their site.</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Slug</TableHead>
                <TableHead>Website</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Commission</TableHead>
                <TableHead className="w-24">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {stores.map(store => (
                <TableRow key={store.id} data-testid={`row-partner-store-${store.id}`}>
                  <TableCell className="font-medium">{store.name}</TableCell>
                  <TableCell>
                    <code className="text-xs bg-muted px-1.5 py-0.5 rounded">{store.slug}</code>
                  </TableCell>
                  <TableCell>
                    {store.websiteUrl && (
                      <a href={store.websiteUrl} target="_blank" rel="noopener" className="text-primary hover:underline flex items-center gap-1">
                        <Globe className="w-3 h-3" />
                        Visit
                      </a>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant={store.isActive ? "default" : "secondary"}>
                      {store.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>
                  <TableCell>{store.commissionPercent}%</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => openEditDialog(store)}
                        data-testid={`button-edit-store-${store.id}`}
                      >
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => deleteMutation.mutate(store.id)}
                        data-testid={`button-delete-store-${store.id}`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingStore ? "Edit Partner Store" : "Add Partner Store"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="store-name">Store Name</Label>
                <Input
                  id="store-name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Kingdom Connects"
                  data-testid="input-store-name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="store-slug">Slug (URL path)</Label>
                <Input
                  id="store-slug"
                  value={formData.slug}
                  onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                  placeholder="kingdom-connects"
                  data-testid="input-store-slug"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="store-description">Description</Label>
              <Textarea
                id="store-description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Partner store description..."
                data-testid="input-store-description"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="store-logo">Logo URL</Label>
                <Input
                  id="store-logo"
                  value={formData.logoUrl}
                  onChange={(e) => setFormData({ ...formData, logoUrl: e.target.value })}
                  placeholder="https://..."
                  data-testid="input-store-logo"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="store-website">Website URL</Label>
                <Input
                  id="store-website"
                  value={formData.websiteUrl}
                  onChange={(e) => setFormData({ ...formData, websiteUrl: e.target.value })}
                  placeholder="https://kingdomconnects.com"
                  data-testid="input-store-website"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="store-origins">Allowed Origins (comma-separated)</Label>
              <Input
                id="store-origins"
                value={formData.allowedOrigins}
                onChange={(e) => setFormData({ ...formData, allowedOrigins: e.target.value })}
                placeholder="https://kingdomconnects.com, https://app.kingdomconnects.com"
                data-testid="input-store-origins"
              />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="store-primary-color">Primary Color</Label>
                <div className="flex gap-2">
                  <Input
                    id="store-primary-color"
                    type="color"
                    value={formData.primaryColor}
                    onChange={(e) => setFormData({ ...formData, primaryColor: e.target.value })}
                    className="w-12 h-9 p-1"
                    data-testid="input-store-primary-color"
                  />
                  <Input
                    value={formData.primaryColor}
                    onChange={(e) => setFormData({ ...formData, primaryColor: e.target.value })}
                    className="flex-1"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="store-accent-color">Accent Color</Label>
                <div className="flex gap-2">
                  <Input
                    id="store-accent-color"
                    type="color"
                    value={formData.accentColor}
                    onChange={(e) => setFormData({ ...formData, accentColor: e.target.value })}
                    className="w-12 h-9 p-1"
                    data-testid="input-store-accent-color"
                  />
                  <Input
                    value={formData.accentColor}
                    onChange={(e) => setFormData({ ...formData, accentColor: e.target.value })}
                    className="flex-1"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="store-commission">Commission %</Label>
                <Input
                  id="store-commission"
                  type="number"
                  min="0"
                  max="100"
                  value={formData.commissionPercent}
                  onChange={(e) => setFormData({ ...formData, commissionPercent: e.target.value })}
                  data-testid="input-store-commission"
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Switch
                id="store-active"
                checked={formData.isActive}
                onCheckedChange={(checked) => setFormData({ ...formData, isActive: checked })}
                data-testid="switch-store-active"
              />
              <Label htmlFor="store-active">Store Active</Label>
            </div>

            <div className="space-y-2">
              <Label>Products Available in Store</Label>
              <div className="border rounded-md p-3 max-h-48 overflow-y-auto">
                {products && products.length > 0 ? (
                  <div className="grid gap-2">
                    {products.filter(p => p.isEnabled).map(product => (
                      <label
                        key={product.id}
                        className="flex items-center gap-2 cursor-pointer hover:bg-muted/50 p-1 rounded"
                      >
                        <Checkbox
                          checked={selectedProducts.includes(product.id)}
                          onCheckedChange={() => toggleProduct(product.id)}
                          data-testid={`checkbox-product-${product.id}`}
                        />
                        <span className="text-sm">{product.name}</span>
                      </label>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No products available</p>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                {selectedProducts.length} product(s) selected
              </p>
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Cancel</Button>
            </DialogClose>
            <Button
              onClick={handleSubmit}
              disabled={createMutation.isPending || updateMutation.isPending || !formData.name}
              data-testid="button-save-store"
            >
              {(createMutation.isPending || updateMutation.isPending) && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              {editingStore ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

export default function Admin() {
  const [, navigate] = useLocation();

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <PageBreadcrumb currentPage="Admin Panel" />

      <main className="container max-w-6xl mx-auto py-8 px-4">
        <div className="flex items-center gap-4 mb-8">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/")}
            data-testid="button-back"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold font-heading" data-testid="text-page-title">
              Admin Dashboard
            </h1>
            <p className="text-muted-foreground">
              Manage products, pricing, and content
            </p>
          </div>
        </div>

        <Tabs defaultValue="products" className="space-y-6">
          <TabsList className="grid w-full grid-cols-6">
            <TabsTrigger value="products" className="gap-2">
              <Package className="h-4 w-4" />
              <span className="hidden sm:inline">Products</span>
            </TabsTrigger>
            <TabsTrigger value="pricing" className="gap-2">
              <DollarSign className="h-4 w-4" />
              <span className="hidden sm:inline">Pricing</span>
            </TabsTrigger>
            <TabsTrigger value="backgrounds" className="gap-2">
              <Image className="h-4 w-4" />
              <span className="hidden sm:inline">Backgrounds</span>
            </TabsTrigger>
            <TabsTrigger value="categories" className="gap-2">
              <Tag className="h-4 w-4" />
              <span className="hidden sm:inline">Templates</span>
            </TabsTrigger>
            <TabsTrigger value="product-tags" className="gap-2">
              <Tag className="h-4 w-4" />
              <span className="hidden sm:inline">Tags</span>
            </TabsTrigger>
            <TabsTrigger value="partners" className="gap-2">
              <Store className="h-4 w-4" />
              <span className="hidden sm:inline">Partners</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="products">
            <ProductsTab />
          </TabsContent>

          <TabsContent value="pricing">
            <PricingTab />
          </TabsContent>

          <TabsContent value="backgrounds">
            <BackgroundsTab />
          </TabsContent>

          <TabsContent value="categories">
            <CategoriesTab />
          </TabsContent>

          <TabsContent value="product-tags">
            <ProductCategoriesTab />
          </TabsContent>

          <TabsContent value="partners">
            <PartnerStoresTab />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
