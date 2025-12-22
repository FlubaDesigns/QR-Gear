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
  ArrowRight,
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
  ZoomIn,
  Shirt,
  Target,
  RotateCw,
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
import { useAuth } from "@/hooks/useAuth";

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

const COLOR_MAP: Record<string, string> = {
  white: "#ffffff",
  black: "#000000",
  navy: "#001f3f",
  red: "#e53935",
  blue: "#1e88e5",
  green: "#43a047",
  grey: "#9e9e9e",
  gray: "#9e9e9e",
  charcoal: "#36454f",
  heather: "#b4b4b4",
  maroon: "#800000",
  orange: "#ff9800",
  yellow: "#ffeb3b",
  pink: "#e91e63",
  purple: "#9c27b0",
  tan: "#d2b48c",
  brown: "#795548",
  khaki: "#c3b091",
  cream: "#fffdd0",
  ivory: "#fffff0",
  gold: "#ffd700",
  silver: "#c0c0c0",
  aqua: "#00bcd4",
  teal: "#009688",
  coral: "#ff7f50",
  mint: "#98ff98",
  olive: "#808000",
  burgundy: "#800020",
  sand: "#c2b280",
  slate: "#708090",
  forest: "#228b22",
  royal: "#4169e1",
  sky: "#87ceeb",
  light: "#f5f5f5",
  dark: "#333333",
};

function getSwatchColor(colorName: string): string {
  const lower = colorName.toLowerCase();
  for (const [key, value] of Object.entries(COLOR_MAP)) {
    if (lower.includes(key)) return value;
  }
  return "#cccccc";
}

function IconDisplay({ iconName, className }: { iconName: string; className?: string }) {
  const Icon = ICON_MAP[iconName] || Tag;
  return <Icon className={className} />;
}

function ColorSwatch({ hex, className = "" }: { hex: string; className?: string }) {
  return (
    <div 
      className={`w-5 h-5 rounded-full border flex-shrink-0 ${className}`}
      ref={(el) => { if (el) el.style.backgroundColor = hex; }}
    />
  );
}

interface ProductVariantDialogProps {
  product: Product;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function ProductVariantDialog({ product, open, onOpenChange }: ProductVariantDialogProps) {
  const { toast } = useToast();
  
  // Get sizes and colors from product's stored data
  const sizes = Array.isArray(product.availableSizes) ? product.availableSizes as string[] : [];
  const colors = Array.isArray(product.availableColors) 
    ? (product.availableColors as Array<{name: string; hex: string}>)
    : [];
  
  // Local state for enabled sizes/colors (defaults to ALL enabled)
  const [enabledSizes, setEnabledSizes] = useState<Set<string>>(new Set(sizes));
  const [enabledColors, setEnabledColors] = useState<Set<string>>(new Set(colors.map(c => c.name)));
  const [saving, setSaving] = useState(false);
  
  // Reset state when dialog opens
  useEffect(() => {
    if (open) {
      // Load from product metadata if saved, otherwise default all ON
      const savedSizes = (product.metadata as any)?.enabledSizes;
      const savedColors = (product.metadata as any)?.enabledColors;
      
      if (savedSizes && Array.isArray(savedSizes)) {
        setEnabledSizes(new Set(savedSizes));
      } else {
        setEnabledSizes(new Set(sizes));
      }
      
      if (savedColors && Array.isArray(savedColors)) {
        setEnabledColors(new Set(savedColors));
      } else {
        setEnabledColors(new Set(colors.map(c => c.name)));
      }
    }
  }, [open, product, sizes, colors]);
  
  const toggleSize = (size: string) => {
    setEnabledSizes(prev => {
      const next = new Set(prev);
      if (next.has(size)) {
        next.delete(size);
      } else {
        next.add(size);
      }
      return next;
    });
  };
  
  const toggleColor = (colorName: string) => {
    setEnabledColors(prev => {
      const next = new Set(prev);
      if (next.has(colorName)) {
        next.delete(colorName);
      } else {
        next.add(colorName);
      }
      return next;
    });
  };
  
  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/products/${product.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          metadata: {
            ...(product.metadata as object || {}),
            enabledSizes: Array.from(enabledSizes),
            enabledColors: Array.from(enabledColors),
          },
        }),
      });
      if (!res.ok) throw new Error("Failed to save");
      toast({ title: "Success", description: "Product options saved." });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/products"] });
      onOpenChange(false);
    } catch (error) {
      toast({ title: "Error", description: "Failed to save options.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Configure {product.name}</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6 py-4">
          {/* Size Switches */}
          {sizes.length > 0 && (
            <div>
              <Label className="text-sm font-medium mb-3 block">Available Sizes</Label>
              <div className="flex flex-wrap gap-3">
                {sizes.map((size) => (
                  <div key={size} className="flex items-center gap-2 bg-muted/50 px-3 py-2 rounded">
                    <Switch
                      id={`dlg-size-${product.id}-${size}`}
                      checked={enabledSizes.has(size)}
                      onCheckedChange={() => toggleSize(size)}
                    />
                    <Label htmlFor={`dlg-size-${product.id}-${size}`} className="text-sm cursor-pointer">
                      {size}
                    </Label>
                  </div>
                ))}
              </div>
            </div>
          )}
          
          {/* Color Switches */}
          {colors.length > 0 && (
            <div>
              <Label className="text-sm font-medium mb-3 block">Available Colors</Label>
              <div className="flex flex-wrap gap-3">
                {colors.map((color) => (
                  <div key={color.name} className="flex items-center gap-2 bg-muted/50 px-3 py-2 rounded">
                    <Switch
                      id={`dlg-color-${product.id}-${color.name}`}
                      checked={enabledColors.has(color.name)}
                      onCheckedChange={() => toggleColor(color.name)}
                    />
                    <ColorSwatch hex={color.hex || getSwatchColor(color.name)} />
                    <Label htmlFor={`dlg-color-${product.id}-${color.name}`} className="text-sm cursor-pointer">
                      {color.name}
                    </Label>
                  </div>
                ))}
              </div>
            </div>
          )}
          
          {sizes.length === 0 && colors.length === 0 && (
            <div className="text-center text-muted-foreground py-4">
              No sizes or colors available. Sync this product from Printify first.
            </div>
          )}
        </div>
        
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Cancel</Button>
          </DialogClose>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Save Options
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface PartnerStoreProductVariantDialogProps {
  product: Product;
  partnerStoreId: string;
  partnerStoreName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  existingConfig?: { enabledSizes?: string[] | null; enabledColors?: string[] | null };
}

function PartnerStoreProductVariantDialog({ 
  product, 
  partnerStoreId, 
  partnerStoreName,
  open, 
  onOpenChange,
  existingConfig
}: PartnerStoreProductVariantDialogProps) {
  const { toast } = useToast();
  
  const sizes = Array.isArray(product.availableSizes) ? product.availableSizes as string[] : [];
  const colors = Array.isArray(product.availableColors) 
    ? (product.availableColors as Array<{name: string; hex: string}>)
    : [];
  
  const [enabledSizes, setEnabledSizes] = useState<Set<string>>(new Set(sizes));
  const [enabledColors, setEnabledColors] = useState<Set<string>>(new Set(colors.map(c => c.name)));
  const [saving, setSaving] = useState(false);
  
  useEffect(() => {
    if (open) {
      if (existingConfig?.enabledSizes && Array.isArray(existingConfig.enabledSizes)) {
        setEnabledSizes(new Set(existingConfig.enabledSizes));
      } else {
        setEnabledSizes(new Set(sizes));
      }
      
      if (existingConfig?.enabledColors && Array.isArray(existingConfig.enabledColors)) {
        setEnabledColors(new Set(existingConfig.enabledColors));
      } else {
        setEnabledColors(new Set(colors.map(c => c.name)));
      }
    }
  }, [open, existingConfig, sizes, colors]);
  
  const toggleSize = (size: string) => {
    setEnabledSizes(prev => {
      const next = new Set(prev);
      if (next.has(size)) next.delete(size);
      else next.add(size);
      return next;
    });
  };
  
  const toggleColor = (colorName: string) => {
    setEnabledColors(prev => {
      const next = new Set(prev);
      if (next.has(colorName)) next.delete(colorName);
      else next.add(colorName);
      return next;
    });
  };
  
  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/partner-stores/${partnerStoreId}/products/${product.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          enabledSizes: Array.from(enabledSizes),
          enabledColors: Array.from(enabledColors),
        }),
      });
      if (!res.ok) throw new Error("Failed to save");
      toast({ title: "Success", description: `Product options saved for ${partnerStoreName}.` });
      onOpenChange(false);
    } catch (error) {
      toast({ title: "Error", description: "Failed to save options.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Configure {product.name}</DialogTitle>
          <p className="text-sm text-muted-foreground">For: {partnerStoreName}</p>
        </DialogHeader>
        
        <div className="space-y-6 py-4">
          {sizes.length > 0 && (
            <div>
              <Label className="text-sm font-medium mb-3 block">Available Sizes</Label>
              <div className="flex flex-wrap gap-3">
                {sizes.map((size) => (
                  <div key={size} className="flex items-center gap-2 bg-muted/50 px-3 py-2 rounded">
                    <Switch
                      id={`ps-size-${product.id}-${size}`}
                      checked={enabledSizes.has(size)}
                      onCheckedChange={() => toggleSize(size)}
                    />
                    <Label htmlFor={`ps-size-${product.id}-${size}`} className="text-sm cursor-pointer">
                      {size}
                    </Label>
                  </div>
                ))}
              </div>
            </div>
          )}
          
          {colors.length > 0 && (
            <div>
              <Label className="text-sm font-medium mb-3 block">Available Colors</Label>
              <div className="flex flex-wrap gap-3">
                {colors.map((color) => (
                  <div key={color.name} className="flex items-center gap-2 bg-muted/50 px-3 py-2 rounded">
                    <Switch
                      id={`ps-color-${product.id}-${color.name}`}
                      checked={enabledColors.has(color.name)}
                      onCheckedChange={() => toggleColor(color.name)}
                    />
                    <ColorSwatch hex={color.hex || getSwatchColor(color.name)} />
                    <Label htmlFor={`ps-color-${product.id}-${color.name}`} className="text-sm cursor-pointer">
                      {color.name}
                    </Label>
                  </div>
                ))}
              </div>
            </div>
          )}
          
          {sizes.length === 0 && colors.length === 0 && (
            <div className="text-center text-muted-foreground py-4">
              No sizes or colors available. Sync this product from Printify first.
            </div>
          )}
        </div>
        
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Cancel</Button>
          </DialogClose>
          <Button onClick={handleSave} disabled={saving} data-testid="button-save-partner-product-options">
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Save Options
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ProductOptionsEditor({ product, onUpdate }: { product: Product; onUpdate: () => void }) {
  const { toast } = useToast();
  const sizes = Array.isArray(product.availableSizes) ? product.availableSizes as string[] : [];
  const colors = Array.isArray(product.availableColors) 
    ? (product.availableColors as Array<{name: string; hex: string}>)
    : [];
  
  const savedEnabledSizes = (product.metadata as any)?.enabledSizes as string[] | undefined;
  const savedEnabledColors = (product.metadata as any)?.enabledColors as string[] | undefined;
  
  // Default: all sizes and colors ON
  const [enabledSizes, setEnabledSizes] = useState<Set<string>>(
    new Set(savedEnabledSizes || sizes)
  );
  const [enabledColors, setEnabledColors] = useState<Set<string>>(
    new Set(savedEnabledColors || colors.map(c => c.name))
  );
  const [saving, setSaving] = useState(false);
  
  const colorHexMap: Record<string, string> = {};
  colors.forEach(c => { colorHexMap[c.name] = c.hex; });
  
  const toggleSize = async (size: string) => {
    const newSizes = new Set(enabledSizes);
    if (newSizes.has(size)) {
      newSizes.delete(size);
    } else {
      newSizes.add(size);
    }
    setEnabledSizes(newSizes);
    await saveChanges(Array.from(newSizes), Array.from(enabledColors));
  };
  
  const toggleColor = async (colorName: string) => {
    const newColors = new Set(enabledColors);
    if (newColors.has(colorName)) {
      newColors.delete(colorName);
    } else {
      newColors.add(colorName);
    }
    setEnabledColors(newColors);
    await saveChanges(Array.from(enabledSizes), Array.from(newColors));
  };
  
  const saveChanges = async (newSizes: string[], newColors: string[]) => {
    setSaving(true);
    try {
      await apiRequest("PATCH", `/api/admin/products/${product.id}/options`, {
        enabledSizes: newSizes,
        enabledColors: newColors,
      });
      onUpdate();
    } catch (error) {
      toast({ title: "Error", description: "Failed to save.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };
  
  if (sizes.length === 0 && colors.length === 0) {
    return <div className="text-sm text-muted-foreground">No sizes/colors - sync from Printify</div>;
  }
  
  return (
    <div className="space-y-3">
      {sizes.length > 0 && (
        <div>
          <Label className="text-sm font-medium mb-2 block">
            Sizes {saving && <Loader2 className="w-3 h-3 inline animate-spin ml-1" />}
          </Label>
          <div className="flex flex-wrap gap-2">
            {sizes.map(size => (
              <div key={size} className="flex items-center gap-2 bg-muted/50 px-3 py-1.5 rounded">
                <Switch
                  id={`size-${product.id}-${size}`}
                  checked={enabledSizes.has(size)}
                  onCheckedChange={() => toggleSize(size)}
                  disabled={saving}
                  data-testid={`switch-size-${product.id}-${size}`}
                />
                <Label htmlFor={`size-${product.id}-${size}`} className="text-sm cursor-pointer">
                  {size}
                </Label>
              </div>
            ))}
          </div>
        </div>
      )}
      {colors.length > 0 && (
        <div>
          <Label className="text-sm font-medium mb-2 block">
            Colors {saving && <Loader2 className="w-3 h-3 inline animate-spin ml-1" />}
          </Label>
          <div className="flex flex-wrap gap-2">
            {colors.map(color => (
              <div key={color.name} className="flex items-center gap-2 bg-muted/50 px-3 py-1.5 rounded">
                <Switch
                  id={`color-${product.id}-${color.name}`}
                  checked={enabledColors.has(color.name)}
                  onCheckedChange={() => toggleColor(color.name)}
                  disabled={saving}
                  data-testid={`switch-color-${product.id}-${color.name}`}
                />
                <ColorSwatch hex={color.hex || getSwatchColor(color.name)} className="w-4 h-4" />
                <Label htmlFor={`color-${product.id}-${color.name}`} className="text-sm cursor-pointer">
                  {color.name}
                </Label>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
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

interface CatalogItem {
  id: number;
  title: string;
  brand: string;
  model: string;
  imageUrl: string | null;
  madeInUSA: boolean;
  usaProviderCount: number;
  otherCountries: string[];
}

interface CatalogCategory {
  name: string;
  items: CatalogItem[];
  count: number;
  usaCount: number;
  otherCount: number;
}

interface CatalogDetails {
  blueprint: { id: number; title: string; brand: string; description: string };
  selectedProvider: { id: number; title: string };
  madeInUSA: boolean;
  colors: string[];
  sizes: string[];
  basePrice: number;
  imageUrl: string | null;
}

// Store segments for adding products
const STORE_SEGMENTS = [
  "Kingdom Connects",
  "Holiday", 
  "Dynamic",
  "Custom",
  "Religious",
  "Business",
];

// QR Placement options
const QR_PLACEMENTS = [
  { id: "front-chest", label: "Front Chest", Icon: Shirt },
  { id: "front-center", label: "Front Center", Icon: Target },
  { id: "back", label: "Back", Icon: ArrowLeft },
  { id: "left-shoulder", label: "Left Shoulder", Icon: ArrowLeft },
  { id: "right-shoulder", label: "Right Shoulder", Icon: ArrowRight },
  { id: "wrap-around", label: "Wrap Around", Icon: RotateCw },
];

// Staged product interface for cart
interface StagedProduct {
  id: string;
  blueprintId: number;
  printProviderId: number;
  name: string;
  description: string;
  basePrice: number;
  imageUrl: string | null;
  manufacturer: string;
  madeInUSA: boolean;
  placement: string;
  headerEnabled: boolean;
  footerEnabled: boolean;
  colors: string[];
  sizes: string[];
  brand: string;
  model: string;
}

function AddFromPrintifyPanel({ onSuccess }: { onSuccess: () => void }) {
  const { toast } = useToast();
  
  // Step 1: Store Segment
  const [selectedSegment, setSelectedSegment] = useState<string>("");
  
  // KC Placements (when Kingdom Connects selected) - can select multiple
  const [kcPlacements, setKcPlacements] = useState<string[]>([]);
  
  // KC Business Slug (optional - can be used with any placement)
  // Note: kcBusinessSlug removed - business context comes from KC via URL params when they embed/link
  
  // Staging cart - accumulate products before saving
  const [stagedProducts, setStagedProducts] = useState<StagedProduct[]>([]);
  
  // Step 2: Product Category
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  
  // Step 3: Made-in filter
  const [locationFilter, setLocationFilter] = useState<"all" | "usa" | "other">("all");
  
  // Step 4: Item selection
  const [selectedItemId, setSelectedItemId] = useState<number | null>(null);
  const [catalogDetails, setCatalogDetails] = useState<CatalogDetails | null>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  
  // Step 5: QR Placement
  const [selectedPlacement, setSelectedPlacement] = useState<string>("front-chest");
  
  // Step 6: Header/Footer text
  const [headerEnabled, setHeaderEnabled] = useState(false);
  const [headerText, setHeaderText] = useState("");
  const [footerEnabled, setFooterEnabled] = useState(false);
  const [footerText, setFooterText] = useState("");
  
  // Image zoom modal
  const [zoomedImage, setZoomedImage] = useState<{url: string; title: string} | null>(null);
  
  // Selected sizes and colors for the current item (admin can toggle which to offer)
  const [enabledSizes, setEnabledSizes] = useState<Set<string>>(new Set());
  const [enabledColors, setEnabledColors] = useState<Set<string>>(new Set());
  
  // Cache for item details (prices, colors, sizes)
  const [itemDetails, setItemDetails] = useState<Record<number, {
    basePrice: number;
    colors: string[];
    sizes: string[];
    providerId?: number;
    providerName?: string;
    error?: boolean;
  }>>({});

  // Fetch categorized catalog with images
  const { data: catalog = [], isLoading: loadingCatalog } = useQuery<CatalogCategory[]>({
    queryKey: ["/api/admin/printify/catalog"],
  });

  // Get items for selected category, filtered by location
  const categoryData = catalog.find(c => c.name === selectedCategory);
  const allCategoryItems = categoryData?.items || [];
  const categoryItems = allCategoryItems.filter(item => {
    if (locationFilter === "usa") return item.madeInUSA;
    if (locationFilter === "other") return !item.madeInUSA;
    return true;
  });
  const selectedItem = categoryItems.find(item => item.id === selectedItemId);

  // Fetch details when item selected
  async function fetchItemDetails(itemId: number) {
    setLoadingDetails(true);
    try {
      const res = await fetch(`/api/admin/printify/catalog/${itemId}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch details");
      const data = await res.json();
      setCatalogDetails(data);
      // Cache the details for this item (check for basePrice existence, not truthiness - 0 is valid)
      if (data.basePrice !== undefined) {
        setItemDetails(prev => ({ 
          ...prev, 
          [itemId]: {
            basePrice: data.basePrice,
            colors: data.colors || [],
            sizes: data.sizes || [],
            providerId: data.selectedProvider?.id,
            providerName: data.selectedProvider?.title,
          }
        }));
      }
      // Always initialize sizes/colors from response
      setEnabledSizes(new Set(data.sizes || []));
      setEnabledColors(new Set(data.colors || []));
    } catch (error) {
      toast({ title: "Error", description: "Failed to load product details.", variant: "destructive" });
    } finally {
      setLoadingDetails(false);
    }
  }

  // Track loading state for batch fetches
  const [fetchingBatch, setFetchingBatch] = useState(false);
  
  // Auto-fetch details when category changes using batch endpoint
  useEffect(() => {
    if (!selectedCategory || allCategoryItems.length === 0) return;
    
    // Get items that don't have cached details
    const itemsToFetch = allCategoryItems.filter(item => !itemDetails[item.id]);
    
    if (itemsToFetch.length === 0) return;
    
    const fetchBatchDetails = async () => {
      setFetchingBatch(true);
      
      // Fetch in batches of 20 (server limit)
      const batchSize = 20;
      for (let i = 0; i < itemsToFetch.length; i += batchSize) {
        const batch = itemsToFetch.slice(i, i + batchSize);
        const blueprintIds = batch.map(item => item.id);
        
        try {
          const res = await fetch("/api/admin/printify/catalog/batch-details", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ blueprintIds }),
          });
          
          if (res.ok) {
            const results = await res.json();
            setItemDetails(prev => {
              const next = { ...prev };
              for (const [id, data] of Object.entries(results)) {
                const d = data as any;
                next[parseInt(id)] = {
                  basePrice: d.basePrice || 0,
                  colors: d.colors || [],
                  sizes: d.sizes || [],
                  providerId: d.providerId,
                  providerName: d.providerName,
                  error: d.error,
                };
              }
              return next;
            });
          }
        } catch {
          // Silently fail for batch
        }
      }
      
      setFetchingBatch(false);
    };
    
    fetchBatchDetails();
  }, [selectedCategory, allCategoryItems.length]);

  // Calculate upcharges
  const headerUpcharge = headerEnabled && headerText.trim() ? 2 : 0;
  const footerUpcharge = footerEnabled && footerText.trim() ? 2 : 0;
  const totalUpcharge = headerUpcharge + footerUpcharge;

  // Add to staging cart (not saving to DB yet)
  function addToStagingCart() {
    if (!catalogDetails || !selectedItem) return;
    
    const staged: StagedProduct = {
      id: `${Date.now()}-${selectedItem.id}`,
      blueprintId: catalogDetails.blueprint.id,
      printProviderId: catalogDetails.selectedProvider.id,
      name: selectedItem.title,
      description: catalogDetails.blueprint.description || "",
      basePrice: catalogDetails.basePrice,
      imageUrl: selectedItem.imageUrl || catalogDetails.imageUrl,
      manufacturer: catalogDetails.selectedProvider.title,
      madeInUSA: catalogDetails.madeInUSA,
      placement: selectedPlacement,
      headerEnabled,
      footerEnabled,
      colors: catalogDetails.colors,
      sizes: catalogDetails.sizes,
      brand: selectedItem.brand,
      model: selectedItem.model,
    };
    
    setStagedProducts(prev => [...prev, staged]);
    toast({ title: "Added to Cart", description: `${selectedItem.title} added. Keep adding or save all.` });
    
    // Reset item selection but keep segment/KC slug
    setSelectedCategory("");
    setLocationFilter("all");
    setSelectedItemId(null);
    setCatalogDetails(null);
    setSelectedPlacement("front-chest");
    setHeaderEnabled(false);
    setHeaderText("");
    setFooterEnabled(false);
    setFooterText("");
  }
  
  function removeFromStagingCart(id: string) {
    setStagedProducts(prev => prev.filter(p => p.id !== id));
  }

  // Save all staged products mutation
  const saveAllMutation = useMutation({
    mutationFn: async () => {
      if (stagedProducts.length === 0) throw new Error("No products to save");
      
      // Determine KC business URL if applicable
      // Business slug comes from KC via URL params when they link to QR Gear, not from admin
      const kcBusinessUrl = null;
      
      // Save each product
      const results = await Promise.all(
        stagedProducts.map(product => 
          apiRequest("POST", "/api/admin/products/from-printify", {
            blueprintId: product.blueprintId,
            printProviderId: product.printProviderId,
            name: product.name,
            description: product.description,
            category: selectedSegment,
            basePrice: product.basePrice,
            imageUrl: product.imageUrl,
            manufacturer: product.manufacturer,
            madeInUSA: product.madeInUSA,
            availablePlacements: [product.placement],
            availableColors: product.colors,
            availableSizes: product.sizes,
            metadata: { 
              brand: product.brand, 
              model: product.model,
              defaultPlacement: product.placement,
              headerTextEnabled: product.headerEnabled,
              footerTextEnabled: product.footerEnabled,
              kcPlacements: selectedSegment === "Kingdom Connects" ? kcPlacements : null,
            },
          })
        )
      );
      return results;
    },
    onSuccess: () => {
      const count = stagedProducts.length;
      toast({ 
        title: "Products Saved!", 
        description: `${count} product(s) added to ${selectedSegment}.` 
      });
      resetForm();
      onSuccess();
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to save products.", variant: "destructive" });
    },
  });

  function resetForm() {
    setSelectedSegment("");
    setKcPlacements([]);
    setStagedProducts([]);
    setSelectedCategory("");
    setLocationFilter("all");
    setSelectedItemId(null);
    setCatalogDetails(null);
    setSelectedPlacement("front-chest");
    setHeaderEnabled(false);
    setHeaderText("");
    setFooterEnabled(false);
    setFooterText("");
  }

  function handleSegmentChange(segment: string) {
    setSelectedSegment(segment);
    // Clear KC fields when changing away from Kingdom Connects
    if (segment !== "Kingdom Connects") {
      setKcPlacements([]);
    }
  }
  
  function toggleKcPlacement(placement: string) {
    setKcPlacements(prev => 
      prev.includes(placement) 
        ? prev.filter(p => p !== placement)
        : [...prev, placement]
    );
  }

  function handleCategoryChange(category: string) {
    setSelectedCategory(category);
    setSelectedItemId(null);
    setCatalogDetails(null);
    setLocationFilter("all");
  }

  function handleLocationFilterChange(filter: "all" | "usa" | "other") {
    setLocationFilter(filter);
    setSelectedItemId(null);
    setCatalogDetails(null);
  }

  function handleItemChange(itemId: string) {
    const id = parseInt(itemId);
    setSelectedItemId(id);
    fetchItemDetails(id);
    
    // Initialize enabled sizes/colors from cached details (all enabled by default)
    const details = itemDetails[id];
    if (details) {
      setEnabledSizes(new Set(details.sizes || []));
      setEnabledColors(new Set(details.colors || []));
    }
  }

  const canAddToCart = selectedItem && selectedSegment && catalogDetails && !loadingDetails;
  // For KC products, require at least one placement selected
  const kcPlacementValid = selectedSegment !== "Kingdom Connects" || kcPlacements.length > 0;
  const canSaveAll = stagedProducts.length > 0 && selectedSegment && kcPlacementValid;

  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Plus className="h-5 w-5" />
          Add Product from Printify
        </CardTitle>
        <CardDescription>Pick a product type, select an item, choose store segment, then add</CardDescription>
      </CardHeader>
      <CardContent>
        {loadingCatalog ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin" />
            <span className="ml-2">Loading Printify catalog...</span>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Staging Cart Display */}
            {stagedProducts.length > 0 && (
              <div className="p-3 bg-accent/20 rounded-md border space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium">
                    Staging Cart ({stagedProducts.length} item{stagedProducts.length !== 1 ? 's' : ''})
                  </Label>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setStagedProducts([])}
                    data-testid="clear-staging-cart"
                  >
                    <X className="h-3 w-3 mr-1" /> Clear All
                  </Button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {stagedProducts.map((p) => (
                    <div key={p.id} className="flex items-center gap-1 bg-background rounded px-2 py-1 text-xs border">
                      {p.imageUrl && <img src={p.imageUrl} alt="" className="w-6 h-6 rounded object-contain" />}
                      <span className="truncate max-w-24">{p.name}</span>
                      <button
                        onClick={() => removeFromStagingCart(p.id)}
                        className="text-destructive hover:bg-destructive/10 rounded p-0.5"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
                <Button
                  onClick={() => saveAllMutation.mutate()}
                  disabled={!canSaveAll || saveAllMutation.isPending}
                  className="w-full"
                  data-testid="save-all-products"
                >
                  {saveAllMutation.isPending ? (
                    <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Saving...</>
                  ) : (
                    <><Check className="h-4 w-4 mr-2" /> Save All to {selectedSegment || "Store"}</>
                  )}
                </Button>
              </div>
            )}

            {/* Step 1: Store Segment */}
            <div className="space-y-2">
              <Label>1. Store Segment</Label>
              <select
                className="w-full p-3 border rounded-md bg-background"
                value={selectedSegment}
                onChange={(e) => handleSegmentChange(e.target.value)}
                data-testid="select-store-segment"
              >
                <option value="">-- Select store segment --</option>
                {STORE_SEGMENTS.map((seg) => (
                  <option key={seg} value={seg}>{seg}</option>
                ))}
              </select>
            </div>
            
            {/* KC Placement Selection - Switches for multiple placements */}
            {selectedSegment === "Kingdom Connects" && (
              <div className="space-y-3 p-3 bg-card/50 rounded-md border border-border">
                <Label className="text-lg font-bold text-[var(--accent)]">Where on Kingdom Connects?</Label>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="kc-homepage" className="text-sm cursor-pointer">Homepage (General KC Store)</Label>
                    <Switch
                      id="kc-homepage"
                      checked={kcPlacements.includes("homepage")}
                      onCheckedChange={() => toggleKcPlacement("homepage")}
                      data-testid="switch-kc-homepage"
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label htmlFor="kc-dashboard" className="text-sm cursor-pointer">Dashboard (User's Dashboard)</Label>
                    <Switch
                      id="kc-dashboard"
                      checked={kcPlacements.includes("dashboard")}
                      onCheckedChange={() => toggleKcPlacement("dashboard")}
                      data-testid="switch-kc-dashboard"
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label htmlFor="kc-static" className="text-sm cursor-pointer">Static Page (Business/Church Listing)</Label>
                    <Switch
                      id="kc-static"
                      checked={kcPlacements.includes("static_page")}
                      onCheckedChange={() => toggleKcPlacement("static_page")}
                      data-testid="switch-kc-static-page"
                    />
                  </div>
                </div>
                
                {/* Selected placements summary */}
                {kcPlacements.length > 0 && (
                  <p className="text-xs text-muted-foreground pt-2 border-t border-border">
                    Product will appear on: {kcPlacements.map(p => 
                      p === "homepage" ? "Homepage" : p === "dashboard" ? "Dashboard" : "Static Pages"
                    ).join(", ")}
                  </p>
                )}
              </div>
            )}

            {/* Step 2: Product Type - show after segment selected (and at least one KC placement if KC) */}
            {selectedSegment && (selectedSegment !== "Kingdom Connects" || kcPlacements.length > 0) && (
              <div className="space-y-2">
                <Label>2. Product Type</Label>
                <select
                  className="w-full p-3 border rounded-md bg-background"
                  value={selectedCategory}
                  onChange={(e) => handleCategoryChange(e.target.value)}
                  data-testid="select-product-category"
                >
                  <option value="">-- Select product type --</option>
                  {catalog.map((cat) => (
                    <option key={cat.name} value={cat.name}>
                      {cat.name} ({cat.count} items)
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Step 3: Made-in Filter */}
            {selectedCategory && categoryData && (
              <div className="space-y-2">
                <Label>3. Where It's Made</Label>
                <div className="flex gap-2 flex-wrap">
                  <Button
                    variant={locationFilter === "all" ? "default" : "outline"}
                    size="sm"
                    onClick={() => handleLocationFilterChange("all")}
                    data-testid="filter-all"
                  >
                    All ({allCategoryItems.length})
                  </Button>
                  <Button
                    variant={locationFilter === "usa" ? "default" : "outline"}
                    size="sm"
                    onClick={() => handleLocationFilterChange("usa")}
                    data-testid="filter-usa"
                  >
                    <Flag className="h-4 w-4 mr-1" /> Made in USA ({categoryData.usaCount})
                  </Button>
                  <Button
                    variant={locationFilter === "other" ? "default" : "outline"}
                    size="sm"
                    onClick={() => handleLocationFilterChange("other")}
                    data-testid="filter-other"
                  >
                    Made Elsewhere ({categoryData.otherCount})
                  </Button>
                </div>
              </div>
            )}

            {/* Step 4: Item Selection - Full Row List with Details */}
            {selectedCategory && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>4. Select Item ({categoryItems.length} available)</Label>
                  {fetchingBatch && categoryItems.some(item => !itemDetails[item.id]) && (
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      Loading details...
                    </span>
                  )}
                </div>
                <div className="max-h-96 overflow-y-auto border rounded-md bg-muted/30">
                  <div className="divide-y">
                    {categoryItems.map((item) => {
                      const details = itemDetails[item.id];
                      const isSelected = selectedItemId === item.id;
                      
                      return (
                        <div
                          key={item.id}
                          className={`flex items-start gap-3 p-3 cursor-pointer transition-all ${
                            isSelected 
                              ? "bg-primary/10 border-l-4 border-l-primary" 
                              : "bg-background hover-elevate"
                          }`}
                          onClick={() => handleItemChange(String(item.id))}
                          data-testid={`item-row-${item.id}`}
                        >
                          {/* Thumbnail */}
                          <div 
                            className="relative w-16 h-16 flex-shrink-0 cursor-pointer"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (item.imageUrl) {
                                setZoomedImage({ url: item.imageUrl, title: item.title });
                              }
                            }}
                          >
                            {item.imageUrl ? (
                              <img
                                src={item.imageUrl}
                                alt={item.title}
                                className="w-full h-full object-contain rounded bg-white border"
                              />
                            ) : (
                              <div className="w-full h-full rounded bg-muted flex items-center justify-center border">
                                <Package className="h-6 w-6 text-muted-foreground" />
                              </div>
                            )}
                            {isSelected && (
                              <div className="absolute -top-1 -left-1 p-0.5 bg-primary rounded-full">
                                <Check className="h-3 w-3 text-primary-foreground" />
                              </div>
                            )}
                          </div>
                          
                          {/* Item Details */}
                          <div className="flex-1 min-w-0 space-y-1">
                            {/* Title & Brand */}
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-medium text-sm">{item.title}</span>
                              {item.madeInUSA && <Flag className="h-3 w-3 text-primary" />}
                            </div>
                            <div className="text-xs text-muted-foreground">{item.brand}</div>
                            
                            {/* Cost */}
                            <div className="text-sm font-semibold text-primary">
                              {details?.basePrice !== undefined && details.basePrice !== null
                                ? `Our Cost: $${details.basePrice.toFixed(2)}`
                                : details?.error
                                  ? "Price unavailable"
                                  : "Loading..."
                              }
                            </div>
                            
                            {/* Sizes */}
                            {details?.sizes && details.sizes.length > 0 && (
                              <div className="flex items-center gap-1 flex-wrap">
                                <span className="text-xs text-muted-foreground">Sizes:</span>
                                {details.sizes.slice(0, 8).map((size) => (
                                  <Badge key={size} variant="outline" className="text-xs px-1 py-0">
                                    {size}
                                  </Badge>
                                ))}
                                {details.sizes.length > 8 && (
                                  <span className="text-xs text-muted-foreground">+{details.sizes.length - 8} more</span>
                                )}
                              </div>
                            )}
                            
                            {/* Colors */}
                            {details?.colors && details.colors.length > 0 && (
                              <div className="flex items-center gap-1 flex-wrap">
                                <span className="text-xs text-muted-foreground">Colors:</span>
                                {details.colors.slice(0, 6).map((color) => (
                                  <Badge key={color} variant="secondary" className="text-xs px-1 py-0">
                                    {color}
                                  </Badge>
                                ))}
                                {details.colors.length > 6 && (
                                  <span className="text-xs text-muted-foreground">+{details.colors.length - 6} more</span>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
            
            {/* Image Zoom Modal */}
            <Dialog open={!!zoomedImage} onOpenChange={() => setZoomedImage(null)}>
              <DialogContent className="max-w-2xl p-4">
                <DialogHeader className="sr-only">
                  <DialogTitle>{zoomedImage?.title || "Image Preview"}</DialogTitle>
                </DialogHeader>
                {zoomedImage && (
                  <div 
                    className="space-y-3 cursor-pointer" 
                    onClick={() => setZoomedImage(null)}
                  >
                    <img
                      src={zoomedImage.url}
                      alt={zoomedImage.title}
                      className="w-full h-auto rounded bg-white max-h-[70vh] object-contain"
                    />
                    <div className="text-center">
                      <p className="font-medium">{zoomedImage.title}</p>
                      <p className="text-sm text-muted-foreground">Tap image to close</p>
                    </div>
                  </div>
                )}
              </DialogContent>
            </Dialog>

            {/* Row 4: Selected Item Preview with Image, Sizes, Colors */}
            {selectedItem && (
              <div className="p-4 bg-muted rounded-md space-y-3">
                <div className="flex items-start gap-4">
                  {selectedItem.imageUrl ? (
                    <img 
                      src={selectedItem.imageUrl} 
                      alt={selectedItem.title} 
                      className="w-24 h-24 rounded-md object-contain border bg-white"
                    />
                  ) : (
                    <div className="w-24 h-24 rounded-md bg-muted-foreground/20 flex items-center justify-center">
                      <Package className="h-8 w-8 text-muted-foreground" />
                    </div>
                  )}
                  <div className="flex-1">
                    <div className="font-medium text-lg flex items-center gap-2">
                      {selectedItem.title}
                      {selectedItem.madeInUSA && <Flag className="h-4 w-4 text-primary" />}
                    </div>
                    <div className="text-sm text-muted-foreground">{selectedItem.brand}</div>
                    {!selectedItem.madeInUSA && selectedItem.otherCountries.length > 0 && (
                      <div className="text-sm text-muted-foreground">
                        Ships from: {selectedItem.otherCountries.join(", ")}
                      </div>
                    )}
                  </div>
                </div>

                {loadingDetails ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading sizes, colors, and pricing...
                  </div>
                ) : catalogDetails && (
                  <div className="space-y-3">
                    {/* Price and location badges */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="secondary">${catalogDetails.basePrice.toFixed(2)} base</Badge>
                      {catalogDetails.madeInUSA && (
                        <Badge className="gap-1">
                          <Flag className="h-3 w-3" /> Made in USA
                        </Badge>
                      )}
                    </div>

                    {/* Sizes - Checkboxes */}
                    {catalogDetails.sizes.length > 0 && (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="text-xs font-medium text-muted-foreground">
                            SIZES TO OFFER ({enabledSizes.size} of {catalogDetails.sizes.length})
                          </div>
                          <div className="flex gap-2">
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="h-6 text-xs"
                              onClick={() => setEnabledSizes(new Set(catalogDetails.sizes))}
                            >
                              All
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="h-6 text-xs"
                              onClick={() => setEnabledSizes(new Set())}
                            >
                              None
                            </Button>
                          </div>
                        </div>
                        <div className="flex gap-2 flex-wrap">
                          {catalogDetails.sizes.map((size) => {
                            const isEnabled = enabledSizes.has(size);
                            return (
                              <div 
                                key={size} 
                                className={`flex items-center gap-1.5 px-2 py-1 rounded border cursor-pointer transition-all ${
                                  isEnabled 
                                    ? "bg-primary/10 border-primary" 
                                    : "bg-muted/50 border-transparent opacity-50"
                                }`}
                                onClick={() => {
                                  const next = new Set(enabledSizes);
                                  if (isEnabled) next.delete(size);
                                  else next.add(size);
                                  setEnabledSizes(next);
                                }}
                              >
                                <Checkbox checked={isEnabled} />
                                <span className="text-sm">{size}</span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Colors - Swatches with Checkboxes */}
                    {catalogDetails.colors.length > 0 && (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="text-xs font-medium text-muted-foreground">
                            COLORS TO OFFER ({enabledColors.size} of {catalogDetails.colors.length})
                          </div>
                          <div className="flex gap-2">
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="h-6 text-xs"
                              onClick={() => setEnabledColors(new Set(catalogDetails.colors))}
                            >
                              All
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="h-6 text-xs"
                              onClick={() => setEnabledColors(new Set())}
                            >
                              None
                            </Button>
                          </div>
                        </div>
                        <div className="flex gap-2 flex-wrap">
                          {catalogDetails.colors.map((color) => {
                            const swatchColor = getSwatchColor(color);
                            const isEnabled = enabledColors.has(color);
                            return (
                              <div 
                                key={color} 
                                className={`flex items-center gap-1.5 px-2 py-1 rounded border cursor-pointer transition-all ${
                                  isEnabled 
                                    ? "bg-primary/10 border-primary" 
                                    : "bg-muted/50 border-transparent opacity-50"
                                }`}
                                title={color}
                                onClick={() => {
                                  const next = new Set(enabledColors);
                                  if (isEnabled) next.delete(color);
                                  else next.add(color);
                                  setEnabledColors(next);
                                }}
                              >
                                <Checkbox checked={isEnabled} />
                                <ColorSwatch hex={swatchColor} />
                                <span className="text-xs max-w-20 truncate">{color}</span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Step 5: QR Placement */}
            {selectedItem && catalogDetails && (
              <div className="space-y-2">
                <Label>5. QR Code Placement</Label>
                <div className="flex gap-2 flex-wrap">
                  {QR_PLACEMENTS.map((placement) => {
                    const PlacementIcon = placement.Icon;
                    return (
                      <Button
                        key={placement.id}
                        variant={selectedPlacement === placement.id ? "default" : "outline"}
                        size="sm"
                        onClick={() => setSelectedPlacement(placement.id)}
                        data-testid={`placement-${placement.id}`}
                      >
                        <PlacementIcon className="h-4 w-4 mr-1" /> {placement.label}
                      </Button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Step 6: Header Text (Optional) */}
            {selectedItem && catalogDetails && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>6. Header Text (Optional, +$2)</Label>
                  {!headerEnabled ? (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setHeaderEnabled(true)}
                      data-testid="add-header-text"
                    >
                      <Plus className="h-3 w-3 mr-1" /> Add Header
                    </Button>
                  ) : (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => { setHeaderEnabled(false); setHeaderText(""); }}
                      data-testid="remove-header-text"
                    >
                      <X className="h-3 w-3 mr-1" /> Remove
                    </Button>
                  )}
                </div>
                {headerEnabled && (
                  <div className="flex items-center gap-2">
                    <Input
                      value={headerText}
                      onChange={(e) => setHeaderText(e.target.value.slice(0, 20))}
                      placeholder="Text above QR (20 chars max)"
                      maxLength={20}
                      className="flex-1"
                      data-testid="input-header-text"
                    />
                    <span className="text-xs text-muted-foreground">{headerText.length}/20</span>
                  </div>
                )}
              </div>
            )}

            {/* Step 7: Footer Text (Optional) */}
            {selectedItem && catalogDetails && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>7. Footer Text (Optional, +$2)</Label>
                  {!footerEnabled ? (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setFooterEnabled(true)}
                      data-testid="add-footer-text"
                    >
                      <Plus className="h-3 w-3 mr-1" /> Add Footer
                    </Button>
                  ) : (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => { setFooterEnabled(false); setFooterText(""); }}
                      data-testid="remove-footer-text"
                    >
                      <X className="h-3 w-3 mr-1" /> Remove
                    </Button>
                  )}
                </div>
                {footerEnabled && (
                  <div className="flex items-center gap-2">
                    <Input
                      value={footerText}
                      onChange={(e) => setFooterText(e.target.value.slice(0, 30))}
                      placeholder="Text below QR (30 chars max)"
                      maxLength={30}
                      className="flex-1"
                      data-testid="input-footer-text"
                    />
                    <span className="text-xs text-muted-foreground">{footerText.length}/30</span>
                  </div>
                )}
              </div>
            )}

            {/* Price Summary & Add to Cart Button */}
            {selectedItem && catalogDetails && (
              <div className="p-4 bg-primary/5 rounded-md border space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium">Ready to Add</div>
                    <div className="text-sm text-muted-foreground">
                      {selectedItem.title} → {selectedSegment}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-bold">
                      ${(catalogDetails.basePrice + totalUpcharge).toFixed(2)}
                    </div>
                    {totalUpcharge > 0 && (
                      <div className="text-xs text-muted-foreground">
                        Base ${catalogDetails.basePrice.toFixed(2)} + ${totalUpcharge} text
                      </div>
                    )}
                  </div>
                </div>
                <Button 
                  onClick={addToStagingCart}
                  disabled={!canAddToCart}
                  className="w-full"
                  data-testid="button-add-to-cart"
                >
                  <Plus className="h-4 w-4 mr-2" /> Add to Cart
                </Button>
                <p className="text-xs text-center text-muted-foreground">
                  Add more items or click "Save All" above when done
                </p>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ProductsTab() {
  const { toast } = useToast();
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [configProductId, setConfigProductId] = useState<string | null>(null);
  
  type AdminProduct = Product & { categoryIds?: string[] };
  
  const { data: products = [], isLoading, refetch } = useQuery<AdminProduct[]>({
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
    <div className="space-y-6">
      {/* Add from Printify Panel - simple dropdowns */}
      <AddFromPrintifyPanel onSuccess={() => refetch()} />

      {/* Master Product Catalog */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4 flex-wrap">
          <div>
            <CardTitle>QR Gear Product Catalog</CardTitle>
            <CardDescription>
              All products added to QR Gear. Enable/disable and assign tags here. 
              To add products to a specific partner store (like Kingdom Connects), go to the Partners tab.
            </CardDescription>
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
          <div className="space-y-4">
            {products.map((product) => (
              <Card key={product.id} className="p-4">
                <div className="flex items-start gap-4">
                  {product.imageUrl && (
                    <img src={product.imageUrl} alt="" className="w-20 h-20 rounded object-cover flex-shrink-0" />
                  )}
                  <div className="flex-1 space-y-3">
                    <div className="flex items-center justify-between gap-4 flex-wrap">
                      <div>
                        <div className="font-medium text-lg">{product.name}</div>
                        <div className="text-sm text-muted-foreground">
                          {product.category} {product.madeInUSA && <Badge variant="outline" className="ml-2 text-xs">USA Made</Badge>}
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <div className="text-sm text-muted-foreground">Base Price</div>
                          <div className="font-medium">${product.basePrice}</div>
                        </div>
                        <div className="text-right">
                          <div className="text-sm text-muted-foreground">Markup</div>
                          <div className="font-medium">{product.markupPercent || 0}%</div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Label className="text-sm">Enabled</Label>
                          <Switch
                            checked={product.isEnabled || false}
                            onCheckedChange={(enabled) => toggleMutation.mutate({ id: product.id, enabled })}
                            disabled={toggleMutation.isPending}
                          />
                        </div>
                      </div>
                    </div>
                    
                    {/* Sizes & Colors with Switches */}
                    <ProductOptionsEditor product={product} onUpdate={() => refetch()} />
                    
                    {/* Tags */}
                    <div>
                      <Label className="text-sm font-medium mb-2 block">Tags</Label>
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
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </CardContent>
      </Card>
    </div>
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
  const [loadingStoreProducts, setLoadingStoreProducts] = useState(false);
  const [storeProductConfigs, setStoreProductConfigs] = useState<Record<string, { enabledSizes?: string[] | null; enabledColors?: string[] | null }>>({});
  const [configDialogProduct, setConfigDialogProduct] = useState<Product | null>(null);
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
    setSelectedProducts([]);
    setStoreProductConfigs({});
    setLoadingStoreProducts(true);
    setIsDialogOpen(true);
    try {
      const res = await fetch(`/api/admin/partner-stores/${store.id}/products`);
      const storeProducts = await res.json();
      setSelectedProducts(storeProducts.map((p: { productId: string }) => p.productId));
      const configs: Record<string, { enabledSizes?: string[] | null; enabledColors?: string[] | null }> = {};
      storeProducts.forEach((p: { productId: string; enabledSizes?: string[] | null; enabledColors?: string[] | null }) => {
        configs[p.productId] = { enabledSizes: p.enabledSizes, enabledColors: p.enabledColors };
      });
      setStoreProductConfigs(configs);
    } catch {
      setSelectedProducts([]);
    } finally {
      setLoadingStoreProducts(false);
    }
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
          <CardTitle className="text-2xl text-[var(--accent)]">Partner Stores</CardTitle>
          <CardDescription>
            External partners who can embed QR Gear products on their websites.
            Each partner gets their own mini-store showing only the products you assign to them.
            Add products to your catalog first (Products tab), then assign them here.
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
              <Label>Assign Products to This Partner</Label>
              <p className="text-xs text-muted-foreground mb-2">
                Check the products from your QR Gear catalog that should appear on this partner's embedded store.
                Only enabled products from the Products tab are shown here.
              </p>
              <div className="border rounded-md p-3 max-h-64 overflow-y-auto">
                {loadingStoreProducts ? (
                  <div className="flex items-center justify-center py-4">
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                    <span className="ml-2 text-sm text-muted-foreground">Loading assigned products...</span>
                  </div>
                ) : products && products.filter(p => p.isEnabled).length > 0 ? (
                  <div className="grid gap-1">
                    {products.filter(p => p.isEnabled).map(product => {
                      const isSelected = selectedProducts.includes(product.id);
                      
                      return (
                        <div
                          key={product.id}
                          className={`flex items-center gap-3 p-2 rounded cursor-pointer ${isSelected ? 'bg-primary/10 border border-primary/30' : 'hover:bg-muted/50'}`}
                          onClick={() => {
                            if (isSelected && editingStore) {
                              setConfigDialogProduct(product);
                            } else {
                              toggleProduct(product.id);
                            }
                          }}
                          data-testid={`row-product-${product.id}`}
                        >
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={() => toggleProduct(product.id)}
                            onClick={(e) => e.stopPropagation()}
                            data-testid={`checkbox-product-${product.id}`}
                          />
                          <span className="text-sm font-medium flex-1">{product.name}</span>
                          <span className="text-xs text-muted-foreground">{product.blueprintId ? 'Printify' : 'Custom'}</span>
                          <span className="text-sm font-medium">${product.basePrice}</span>
                          {isSelected && (
                            <Badge variant="default" className="text-xs">Selected</Badge>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No products in catalog yet. Add products in the Products tab first.
                  </p>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                {selectedProducts.length} product(s) will appear on this partner's store
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

      {configDialogProduct && editingStore && (
        <PartnerStoreProductVariantDialog
          product={configDialogProduct}
          partnerStoreId={editingStore.id}
          partnerStoreName={editingStore.name}
          open={!!configDialogProduct}
          onOpenChange={(open) => {
            if (!open) setConfigDialogProduct(null);
          }}
          existingConfig={storeProductConfigs[configDialogProduct.id]}
        />
      )}
    </Card>
  );
}

export default function Admin() {
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
      {/* Admin-specific header - distinct from main site */}
      <div className="bg-slate-900 dark:bg-slate-950 text-white">
        <div className="container max-w-6xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigate("/")}
                className="text-white hover:bg-white/10"
                data-testid="button-back"
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div className="flex items-center gap-2">
                <Settings className="h-6 w-6 text-amber-400" />
                <div>
                  <h1 className="text-xl font-bold font-heading" data-testid="text-page-title">
                    QR Gear Admin
                  </h1>
                  <p className="text-xs text-slate-400">
                    Manage products, pricing, and content
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
