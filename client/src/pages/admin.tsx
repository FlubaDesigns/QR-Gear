import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import Navbar from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
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

export default function Admin() {
  const [, navigate] = useLocation();
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
        description: "Failed to load categories. Please check your Firestore connection.",
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
      toast({
        title: "Success",
        description: "Default categories have been added.",
      });
    } catch (error) {
      console.error("Error seeding categories:", error);
      toast({
        title: "Error",
        description: "Failed to seed default categories.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  }

  function openCreateDialog() {
    setEditingCategory(null);
    setFormData({
      name: "",
      description: "",
      icon: "Tag",
      isActive: true,
    });
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
      toast({
        title: "Error",
        description: "Category name is required.",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    try {
      if (editingCategory) {
        await updateCategory(editingCategory.id, formData);
        toast({
          title: "Success",
          description: `Category "${formData.name}" has been updated.`,
        });
      } else {
        await createCategory(formData);
        toast({
          title: "Success",
          description: `Category "${formData.name}" has been created.`,
        });
      }
      setIsDialogOpen(false);
      await loadCategories();
    } catch (error) {
      console.error("Error saving category:", error);
      toast({
        title: "Error",
        description: "Failed to save category.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    setSaving(true);
    try {
      await deleteCategory(id);
      toast({
        title: "Success",
        description: "Category has been deleted.",
      });
      setDeleteConfirmId(null);
      await loadCategories();
    } catch (error) {
      console.error("Error deleting category:", error);
      toast({
        title: "Error",
        description: "Failed to delete category.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleActive(category: Category) {
    try {
      await updateCategory(category.id, { isActive: !category.isActive });
      await loadCategories();
    } catch (error) {
      console.error("Error toggling category:", error);
      toast({
        title: "Error",
        description: "Failed to update category.",
        variant: "destructive",
      });
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <main className="container max-w-5xl mx-auto py-8 px-4">
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
              Manage categories and product settings
            </p>
          </div>
        </div>

        <Card className="mb-8">
          <CardHeader className="flex flex-row items-center justify-between gap-4">
            <CardTitle data-testid="text-categories-title">Product Categories</CardTitle>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={loadCategories}
                disabled={loading}
                data-testid="button-refresh-categories"
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
                Refresh
              </Button>
              {categories.length === 0 && !loading && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleSeedDefaults}
                  disabled={saving}
                  data-testid="button-seed-defaults"
                >
                  Seed Defaults
                </Button>
              )}
              <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" onClick={openCreateDialog} data-testid="button-add-category">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Category
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle data-testid="text-dialog-title">
                      {editingCategory ? "Edit Category" : "Add Category"}
                    </DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label htmlFor="name">Name</Label>
                      <Input
                        id="name"
                        value={formData.name}
                        onChange={(e) =>
                          setFormData({ ...formData, name: e.target.value })
                        }
                        placeholder="e.g., Religious"
                        data-testid="input-category-name"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="description">Description</Label>
                      <Textarea
                        id="description"
                        value={formData.description}
                        onChange={(e) =>
                          setFormData({ ...formData, description: e.target.value })
                        }
                        placeholder="Brief description of this category"
                        data-testid="input-category-description"
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
                            data-testid={`button-icon-${iconName.toLowerCase()}`}
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
                        onCheckedChange={(checked) =>
                          setFormData({ ...formData, isActive: checked })
                        }
                        data-testid="switch-category-active"
                      />
                      <Label htmlFor="isActive">Active</Label>
                    </div>
                  </div>
                  <DialogFooter>
                    <DialogClose asChild>
                      <Button variant="outline" data-testid="button-cancel">
                        Cancel
                      </Button>
                    </DialogClose>
                    <Button
                      onClick={handleSubmit}
                      disabled={saving}
                      data-testid="button-save-category"
                    >
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
                <p className="text-sm">Click "Add Category" or "Seed Defaults" to get started.</p>
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
                    <TableRow key={category.id} data-testid={`row-category-${category.id}`}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab" />
                          <IconDisplay iconName={category.icon} className="h-5 w-5 text-primary" />
                        </div>
                      </TableCell>
                      <TableCell className="font-medium" data-testid={`text-category-name-${category.id}`}>
                        {category.name}
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-muted-foreground">
                        {category.description}
                      </TableCell>
                      <TableCell className="text-center">
                        <Switch
                          checked={category.isActive}
                          onCheckedChange={() => handleToggleActive(category)}
                          data-testid={`switch-status-${category.id}`}
                        />
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openEditDialog(category)}
                            data-testid={`button-edit-${category.id}`}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Dialog
                            open={deleteConfirmId === category.id}
                            onOpenChange={(open) =>
                              setDeleteConfirmId(open ? category.id : null)
                            }
                          >
                            <DialogTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                data-testid={`button-delete-${category.id}`}
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </DialogTrigger>
                            <DialogContent>
                              <DialogHeader>
                                <DialogTitle>Delete Category</DialogTitle>
                              </DialogHeader>
                              <p>
                                Are you sure you want to delete "{category.name}"? This
                                action cannot be undone.
                              </p>
                              <DialogFooter>
                                <DialogClose asChild>
                                  <Button variant="outline" data-testid="button-cancel-delete">
                                    Cancel
                                  </Button>
                                </DialogClose>
                                <Button
                                  variant="destructive"
                                  onClick={() => handleDelete(category.id)}
                                  disabled={saving}
                                  data-testid="button-confirm-delete"
                                >
                                  {saving && (
                                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                  )}
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
      </main>
    </div>
  );
}
