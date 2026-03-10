import { useState, useEffect } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
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
  Loader2,
  RefreshCw,
} from "lucide-react";
import AdminShell from "@/components/AdminShell";
import {
  Category,
  CategoryInput,
  getCategories,
  createCategory,
  updateCategory,
  deleteCategory,
  seedDefaultCategories,
} from "@/lib/categories";
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

function IconDisplay({ iconName, className }: { iconName: string; className?: string }) {
  const Icon = ICON_MAP[iconName] || Tag;
  return <Icon className={className} />;
}

function CategoriesContent() {
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
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" className="h-12 px-4" onClick={loadCategories} disabled={loading}>
            <RefreshCw className={`h-5 w-5 mr-2 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          {categories.length === 0 && !loading && (
            <Button variant="outline" className="h-12 px-4" onClick={handleSeedDefaults} disabled={saving}>
              Seed Defaults
            </Button>
          )}
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button className="h-12 px-4" onClick={openCreateDialog}>
                <Plus className="h-5 w-5 mr-2" />
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
                        className="h-12 w-12"
                        onClick={() => setFormData({ ...formData, icon: iconName })}
                      >
                        <IconDisplay iconName={iconName} className="h-5 w-5" />
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
                      <Button variant="ghost" size="icon" className="h-12 w-12" onClick={() => openEditDialog(category)}>
                        <Pencil className="h-5 w-5" />
                      </Button>
                      <Dialog
                        open={deleteConfirmId === category.id}
                        onOpenChange={(open) => setDeleteConfirmId(open ? category.id : null)}
                      >
                        <DialogTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-12 w-12">
                            <Trash2 className="h-5 w-5 text-destructive" />
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

export default function AdminCategories() {
  const { user } = useAuth();
  const { toast } = useToast();

  const copyUserId = () => {
    if (user?.id) {
      navigator.clipboard.writeText(user.id);
      toast({ title: "User ID copied to clipboard" });
    }
  };

  const actionButtons = user ? (
    <div className="flex items-center gap-3">
      <div className="text-right hidden sm:block">
        <p className="text-xs text-slate-400">Logged in as</p>
        <p className="text-sm font-medium">{user.email || user.id}</p>
      </div>
      <Button 
        variant="outline" 
        onClick={copyUserId}
        className="font-mono text-xs h-12 px-4"
        data-testid="button-copy-user-id"
      >
        Copy ID
      </Button>
    </div>
  ) : undefined;

  return (
    <AdminShell
      title="Templates"
      subtitle="Manage category templates"
      icon={Tag}
      backHref="/admin"
      backLabel="Back"
      actions={actionButtons}
    >
      <CategoriesContent />
    </AdminShell>
  );
}
