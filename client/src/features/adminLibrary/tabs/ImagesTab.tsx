import { useState, useMemo, useCallback, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useAdminAuth } from "@/features/shared/AdminAuthContext";
import { ScrollGridView } from "@/features/shared/components/views/ScrollGridView";
import { ItemModalView } from "@/features/shared/components/views/ModalView";
import type { GridViewItem } from "@/features/shared/components/views/index";
import { FolderPlus, Upload, Trash2, FolderOpen, ArrowLeft, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface AdminImage {
  id: string;
  name: string;
  folder: string;
  mimeType: string;
  sizeBytes: number;
  storageUrl: string;
  publicUrl: string;
  proxyUrl: string;
  isActive: boolean;
}

function imageToGridItem(img: AdminImage): GridViewItem {
  return {
    id: img.id,
    name: img.name,
    imageUrl: img.proxyUrl || img.publicUrl,
  };
}

export default function ImagesTab() {
  const { apiBase, getAuthHeaders } = useAdminAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [activeFolder, setActiveFolder] = useState<string | null>(null);
  const [selectedItem, setSelectedItem] = useState<GridViewItem | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [newFolderOpen, setNewFolderOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [uploading, setUploading] = useState(false);

  const foldersQuery = useQuery<string[]>({
    queryKey: ["admin-images", "folders"],
    queryFn: async () => {
      const headers = await getAuthHeaders();
      const res = await fetch(`${apiBase}/images/folders`, { headers });
      if (!res.ok) throw new Error("Failed to fetch folders");
      return res.json();
    },
  });

  const imagesQuery = useQuery<AdminImage[]>({
    queryKey: ["admin-images", "list", activeFolder || "all"],
    queryFn: async () => {
      const headers = await getAuthHeaders();
      const url = activeFolder
        ? `${apiBase}/images?folder=${encodeURIComponent(activeFolder)}`
        : `${apiBase}/images`;
      const res = await fetch(url, { headers });
      if (!res.ok) throw new Error("Failed to fetch images");
      return res.json();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const headers = await getAuthHeaders();
      const res = await fetch(`${apiBase}/images/${id}`, {
        method: "DELETE",
        headers,
      });
      if (!res.ok) throw new Error("Delete failed");
    },
    onSuccess: () => {
      toast({ title: "Image deleted" });
      queryClient.invalidateQueries({ queryKey: ["admin-images"] });
      setModalOpen(false);
      setSelectedItem(null);
    },
    onError: (err: Error) => {
      toast({ title: "Delete failed", description: err.message, variant: "destructive" });
    },
  });

  const handleUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files?.length) return;
    setUploading(true);

    try {
      const headers = await getAuthHeaders();
      for (const file of Array.from(files)) {
        const reader = new FileReader();
        const base64 = await new Promise<string>((resolve, reject) => {
          reader.onload = () => {
            const result = reader.result as string;
            resolve(result.split(",")[1]);
          };
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });

        const res = await fetch(`${apiBase}/images`, {
          method: "POST",
          headers: { "Content-Type": "application/json", ...headers },
          body: JSON.stringify({
            name: file.name,
            imageData: base64,
            mimeType: file.type,
            folder: activeFolder || "general",
          }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: "Upload failed" }));
          throw new Error(err.error);
        }
      }
      toast({ title: `Uploaded ${files.length} image${files.length > 1 ? "s" : ""}` });
      queryClient.invalidateQueries({ queryKey: ["admin-images"] });
    } catch (err: any) {
      toast({ title: "Upload failed", description: err.message, variant: "destructive" });
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }, [apiBase, getAuthHeaders, activeFolder, toast, queryClient]);

  const handleCreateFolder = useCallback(async () => {
    const name = newFolderName.trim();
    if (!name) return;
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`${apiBase}/images/folders`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        toast({ title: "Failed to create folder", description: errData.error || res.statusText, variant: "destructive" });
        return;
      }
      queryClient.invalidateQueries({ queryKey: ["/api/admin/images/folders"] });
      setActiveFolder(name);
      setNewFolderOpen(false);
      setNewFolderName("");
      toast({ title: `Folder "${name}" created` });
    } catch (e) {
      console.error("Create folder failed:", e);
      toast({ title: "Failed to create folder", description: e instanceof Error ? e.message : "Network error", variant: "destructive" });
    }
  }, [newFolderName, toast, apiBase, getAuthHeaders, queryClient]);

  const images = imagesQuery.data || [];
  const folders = foldersQuery.data || [];
  const gridItems = useMemo(() => images.map(imageToGridItem), [images]);

  const handleSelect = (item: GridViewItem) => {
    setSelectedItem(item);
    setModalOpen(true);
  };

  return (
    <div>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={handleUpload}
        data-testid="input-image-upload"
      />

      <div className="flex items-center gap-2 mb-4 flex-wrap">
        {activeFolder && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setActiveFolder(null)}
            data-testid="button-back-all-folders"
          >
            <ArrowLeft className="h-4 w-4 mr-1" />
            All Folders
          </Button>
        )}
        <Button
          variant="outline"
          size="sm"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          data-testid="button-upload-images"
        >
          {uploading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Upload className="h-4 w-4 mr-1" />}
          Upload
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setNewFolderOpen(true)}
          data-testid="button-new-folder"
        >
          <FolderPlus className="h-4 w-4 mr-1" />
          New Folder
        </Button>
      </div>

      {!activeFolder && (
        <>
          <h3 className="text-base font-semibold mb-3">
            {folders.length > 0 ? "Folders" : "No folders yet — create one to organize your images"}
          </h3>
          {folders.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
              {folders.map((folder) => (
                <button
                  key={folder}
                  onClick={() => setActiveFolder(folder)}
                  className="qr-btn qr-btn--outline qr-btn--touch flex flex-col items-center justify-center gap-1 py-4"
                  data-testid={`folder-${folder}`}
                >
                  <FolderOpen className="h-6 w-6" />
                  <span className="text-sm font-medium capitalize">{folder}</span>
                </button>
              ))}
            </div>
          )}

          <h3 className="text-base font-semibold mb-3">All Images ({images.length})</h3>
        </>
      )}

      {activeFolder && (
        <h3 className="text-base font-semibold mb-3 capitalize">
          {activeFolder} ({images.length} images)
        </h3>
      )}

      <ScrollGridView
        items={gridItems}
        renderItem={(item) => (
          <div
            className="relative rounded-lg overflow-hidden cursor-pointer hover:ring-2 hover:ring-white/50 transition-all"
            onClick={() => handleSelect(item)}
            data-testid={`card-image-${item.id}`}
          >
            <img src={item.imageUrl} alt={item.name} className="w-full aspect-square object-cover" loading="lazy" />
            <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-xs p-1 truncate">
              {item.name}
            </div>
          </div>
        )}
        isLoading={imagesQuery.isLoading}
        emptyMessage={activeFolder ? `No images in "${activeFolder}" yet. Upload some!` : "No images uploaded yet."}
        columns="grid-cols-3 sm:grid-cols-4"
        height="auto"
        footer={null}
      />

      <ItemModalView
        item={selectedItem ? {
          id: selectedItem.id,
          name: selectedItem.name,
          imageUrl: selectedItem.imageUrl,
        } : null}
        open={modalOpen}
        onOpenChange={setModalOpen}
      >
        <div className="flex gap-2 mt-4">
          <Button
            variant="destructive"
            size="sm"
            onClick={() => selectedItem && deleteMutation.mutate(selectedItem.id)}
            disabled={deleteMutation.isPending}
            data-testid="button-delete-image"
          >
            <Trash2 className="h-4 w-4 mr-1" />
            {deleteMutation.isPending ? "Deleting..." : "Delete"}
          </Button>
        </div>
      </ItemModalView>

      <Dialog open={newFolderOpen} onOpenChange={setNewFolderOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Create New Folder</DialogTitle>
          </DialogHeader>
          <Input
            placeholder="Folder name (e.g. logos, headers)"
            value={newFolderName}
            onChange={(e) => setNewFolderName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleCreateFolder()}
            data-testid="input-folder-name"
          />
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setNewFolderOpen(false)} data-testid="button-cancel-folder">
              Cancel
            </Button>
            <Button onClick={handleCreateFolder} disabled={!newFolderName.trim()} data-testid="button-create-folder">
              Create
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
