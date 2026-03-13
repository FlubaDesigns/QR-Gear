import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Loader2, Edit2 } from "lucide-react";
import type { MasterProduct } from "@shared/schema";
import type { ProductType, ProductStatus } from "./orchestration-types";

export function CreateProductForm({
  onSubmit,
  isPending,
}: {
  onSubmit: (data: { title: string; description: string; productType: string; tags: string[] }) => void;
  isPending: boolean;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [productType, setProductType] = useState<ProductType>("hat");
  const [tagsInput, setTagsInput] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const tags = tagsInput.split(",").map((t) => t.trim()).filter(Boolean);
    onSubmit({ title, description, productType, tags });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="title">Title</Label>
        <Input
          id="title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Product title"
          className="h-12"
          required
          data-testid="input-title"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Product description"
          rows={3}
          data-testid="input-description"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="productType">Product Type</Label>
        <Select value={productType} onValueChange={(v) => setProductType(v as ProductType)}>
          <SelectTrigger className="h-12" data-testid="select-product-type">
            <SelectValue placeholder="Select type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="hat">Hat</SelectItem>
            <SelectItem value="shirt">Shirt</SelectItem>
            <SelectItem value="mug">Mug</SelectItem>
            <SelectItem value="bag">Bag</SelectItem>
            <SelectItem value="other">Other</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="tags">Tags (comma separated)</Label>
        <Input
          id="tags"
          value={tagsInput}
          onChange={(e) => setTagsInput(e.target.value)}
          placeholder="summer, marketing, promo"
          className="h-12"
          data-testid="input-tags"
        />
      </div>
      <DialogFooter>
        <Button type="submit" disabled={isPending || !title} className="h-12 w-full" data-testid="button-submit-create">
          {isPending ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <Plus className="w-5 h-5 mr-2" />}
          Create Product
        </Button>
      </DialogFooter>
    </form>
  );
}

export function EditProductForm({
  product,
  onSubmit,
  isPending,
  onCancel,
}: {
  product: MasterProduct;
  onSubmit: (data: Partial<MasterProduct>) => void;
  isPending: boolean;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState(product.title);
  const [description, setDescription] = useState(product.description || "");
  const [status, setStatus] = useState<ProductStatus>(product.status as ProductStatus);
  const [baseCost, setBaseCost] = useState(product.baseCost || "");
  const [retailPrice, setRetailPrice] = useState(product.retailPrice || "");
  const [tagsInput, setTagsInput] = useState((product.tags || []).join(", "));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const tags = tagsInput.split(",").map((t) => t.trim()).filter(Boolean);
    onSubmit({
      title,
      description: description || null,
      status,
      baseCost: baseCost || null,
      retailPrice: retailPrice || null,
      tags,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label>SKU</Label>
        <Input value={product.sku} disabled className="h-12 font-mono bg-muted" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="edit-title">Title</Label>
        <Input
          id="edit-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="h-12"
          required
          data-testid="input-edit-title"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="edit-description">Description</Label>
        <Textarea
          id="edit-description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          data-testid="input-edit-description"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="edit-status">Status</Label>
        <Select value={status} onValueChange={(v) => setStatus(v as ProductStatus)}>
          <SelectTrigger className="h-12" data-testid="select-edit-status">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="paused">Paused</SelectItem>
            <SelectItem value="archived">Archived</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="edit-baseCost">Base Cost ($)</Label>
          <Input
            id="edit-baseCost"
            value={baseCost}
            onChange={(e) => setBaseCost(e.target.value)}
            type="number"
            step="0.01"
            className="h-12"
            placeholder="0.00"
            data-testid="input-edit-baseCost"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="edit-retailPrice">Retail Price ($)</Label>
          <Input
            id="edit-retailPrice"
            value={retailPrice}
            onChange={(e) => setRetailPrice(e.target.value)}
            type="number"
            step="0.01"
            className="h-12"
            placeholder="0.00"
            data-testid="input-edit-retailPrice"
          />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="edit-tags">Tags (comma separated)</Label>
        <Input
          id="edit-tags"
          value={tagsInput}
          onChange={(e) => setTagsInput(e.target.value)}
          className="h-12"
          data-testid="input-edit-tags"
        />
      </div>
      <DialogFooter className="gap-2 sm:gap-0">
        <Button type="button" variant="outline" onClick={onCancel} className="h-12" data-testid="button-cancel-edit">
          Cancel
        </Button>
        <Button type="submit" disabled={isPending || !title} className="h-12" data-testid="button-submit-edit">
          {isPending ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <Edit2 className="w-5 h-5 mr-2" />}
          Save Changes
        </Button>
      </DialogFooter>
    </form>
  );
}
