import { useState, useCallback, useEffect } from "react";
import { Type, Upload, X, ImageIcon, MessageSquare, Loader2, FolderOpen, FolderPlus, Trash2, Check, Save } from "lucide-react";
import { CollapsibleModule } from "@/features/shared/components/CollapsibleModule";
import { useBuilderContext } from "../BuilderContext";
import { TextStyleEditor, type TextStyleConfig, defaultTextStyle } from "@/features/shared/components/TextStyleEditor";
import { GraphicPreviewView } from "@/features/shared/components/skins/GraphicPreviewView";
import { ScrollGridView } from "@/features/shared/components/views/ScrollGridView";
import { ModalView } from "@/features/shared/components/views/ModalView";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useAdminAuth } from "@/features/shared/AdminAuthContext";

const headerDefaultStyle: TextStyleConfig = { ...defaultTextStyle, text: "", enabled: false };
const footerDefaultStyle: TextStyleConfig = { ...defaultTextStyle, text: "", enabled: false };

interface LibraryImage {
  id: string;
  name: string;
  folder: string;
  storageUrl: string;
  proxyUrl?: string;
  publicUrl?: string;
}

function ImageLibraryDialog({
  open,
  onClose,
  onSelect,
}: {
  open: boolean;
  onClose: () => void;
  onSelect: (url: string) => void;
}) {
  const { apiBase, getAuthHeaders } = useAdminAuth();
  const [images, setImages] = useState<LibraryImage[]>([]);
  const [folders, setFolders] = useState<string[]>([]);
  const [activeFolder, setActiveFolder] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedImage, setSelectedImage] = useState<LibraryImage | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [showNewFolder, setShowNewFolder] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const headers = await getAuthHeaders();
      const [foldersRes, imagesRes] = await Promise.all([
        fetch(`${apiBase}/images/folders`, { headers }),
        fetch(`${apiBase}/images${activeFolder ? `?folder=${encodeURIComponent(activeFolder)}` : ''}`, { headers }),
      ]);
      const folderList = foldersRes.ok ? await foldersRes.json() : [];
      const adminImages = imagesRes.ok ? await imagesRes.json() : [];
      setFolders(folderList);
      setImages(adminImages);
    } catch {
      setImages([]);
      setFolders([]);
    } finally {
      setLoading(false);
    }
  }, [apiBase, getAuthHeaders, activeFolder]);

  useEffect(() => {
    if (open) {
      loadData();
    } else {
      setActiveFolder(null);
      setSelectedImage(null);
      setShowNewFolder(false);
      setNewFolderName("");
    }
  }, [open, loadData]);

  const handleDelete = async (id: string) => {
    setDeleting(true);
    try {
      const headers = await getAuthHeaders();
      await fetch(`${apiBase}/images/${id}`, { method: 'DELETE', headers });
      setSelectedImage(null);
      loadData();
    } catch (e) {
      console.error("Delete failed:", e);
    } finally {
      setDeleting(false);
    }
  };

  const [folderError, setFolderError] = useState<string | null>(null);

  const handleCreateFolder = async () => {
    const trimmed = newFolderName.trim();
    if (!trimmed) return;
    setFolderError(null);

    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`${apiBase}/images/folders`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: trimmed }),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        setFolderError(`Failed to create folder: ${errData.error || res.statusText}`);
        return;
      }
      const foldersRes = await fetch(`${apiBase}/images/folders`, { headers });
      const serverFolders = foldersRes.ok ? await foldersRes.json() : [];
      setFolders(serverFolders);
      setActiveFolder(trimmed);
      setShowNewFolder(false);
      setNewFolderName("");
    } catch (e) {
      console.error("Create folder failed:", e);
      setFolderError(`Failed to create folder: ${e instanceof Error ? e.message : "Network error"}`);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="w-[95vw] max-w-lg max-h-[90vh] flex flex-col p-4">
        <DialogHeader className="pb-2">
          <DialogTitle className="text-lg">
            {activeFolder ? activeFolder : "Choose from Library"}
          </DialogTitle>
        </DialogHeader>

        {activeFolder ? (
          <button
            onClick={() => setActiveFolder(null)}
            className="qr-btn qr-btn--outline qr-btn--touch text-sm mb-3 self-start"
            data-testid="button-picker-back"
          >
            &larr; All Folders
          </button>
        ) : (
          <div className="space-y-2 mb-3">
            <div className="grid grid-cols-2 gap-2">
              {folders.map((f) => (
                <button
                  key={f}
                  onClick={() => setActiveFolder(f)}
                  className="qr-btn qr-btn--outline qr-btn--touch min-h-[48px] flex items-center justify-center gap-2 text-sm font-medium capitalize"
                  data-testid={`picker-folder-${f}`}
                >
                  <FolderOpen className="h-4 w-4" />
                  {f}
                </button>
              ))}
            </div>

            {showNewFolder ? (
              <div className="flex gap-2">
                <Input
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  placeholder="Folder name"
                  className="flex-1"
                  autoFocus
                  onKeyDown={(e) => e.key === 'Enter' && handleCreateFolder()}
                  data-testid="input-new-folder-name"
                />
                <Button size="sm" onClick={handleCreateFolder} disabled={!newFolderName.trim()} data-testid="button-confirm-new-folder">
                  <Check className="h-4 w-4" />
                </Button>
                <Button size="sm" variant="outline" onClick={() => { setShowNewFolder(false); setNewFolderName(""); setFolderError(null); }} data-testid="button-cancel-new-folder">
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <button
                onClick={() => setShowNewFolder(true)}
                className="qr-btn qr-btn--outline qr-btn--touch w-full min-h-[48px] flex items-center justify-center gap-2 text-sm"
                data-testid="button-new-folder"
              >
                <FolderPlus className="h-4 w-4" />
                New Folder
              </button>
            )}
            {folderError && (
              <p className="text-sm text-red-500 mt-1" data-testid="text-folder-error">{folderError}</p>
            )}
          </div>
        )}

        {activeFolder && (
          <ScrollGridView
            items={images.map(img => ({ ...img, id: img.id }))}
            columns="grid-cols-2"
            height="55vh"
            emptyMessage="No images in this folder"
            emptyIcon={<ImageIcon className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />}
            isLoading={loading}
            renderItem={(img) => {
              const url = img.proxyUrl || img.publicUrl || img.storageUrl;
              return (
                <button
                  type="button"
                  onClick={() => setSelectedImage(img as LibraryImage)}
                  className="w-full rounded-lg overflow-hidden border-2 border-white/10 active:border-blue-400 active:scale-[0.97] transition-all bg-black/10 text-left"
                  data-testid={`library-image-${img.id}`}
                >
                  <img
                    src={url}
                    alt={img.name}
                    className="w-full aspect-[4/3] object-cover"
                    loading="lazy"
                  />
                  <div className="text-xs text-foreground/80 px-2 py-1.5 truncate font-medium">
                    {img.name}
                  </div>
                </button>
              );
            }}
            footer={null}
          />
        )}

        {!activeFolder && !loading && folders.length === 0 && !showNewFolder && (
          <div className="text-center py-8">
            <ImageIcon className="h-10 w-10 mx-auto mb-3 text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">No folders yet.</p>
            <p className="text-xs text-muted-foreground/70 mt-1">Create a folder to organize your images.</p>
          </div>
        )}
      </DialogContent>

      <ModalView
        open={!!selectedImage}
        onOpenChange={() => setSelectedImage(null)}
        title={selectedImage?.name || "Image Preview"}
        maxWidth="max-w-sm"
      >
        {selectedImage && (
          <>
            <img
              src={selectedImage.proxyUrl || selectedImage.publicUrl || selectedImage.storageUrl}
              alt={selectedImage.name}
              className="w-full max-h-[50vh] object-contain bg-black/20"
              data-testid="img-picker-preview"
            />
            <div className="p-4 space-y-3">
              <p className="text-sm font-medium text-center truncate">{selectedImage.name}</p>
              <Button
                className="w-full"
                size="lg"
                onClick={() => {
                  const url = selectedImage.proxyUrl || selectedImage.publicUrl || selectedImage.storageUrl;
                  onSelect(url);
                  setSelectedImage(null);
                  onClose();
                }}
                data-testid="button-picker-select"
              >
                <Check className="h-5 w-5 mr-2" />
                Use This Image
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="w-full text-red-400"
                onClick={() => handleDelete(selectedImage.id)}
                disabled={deleting}
                data-testid="button-picker-delete"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                {deleting ? "Deleting..." : "Delete"}
              </Button>
            </div>
          </>
        )}
      </ModalView>
    </Dialog>
  );
}

function SaveToLibraryDialog({
  open,
  onClose,
  imageDataUrl,
}: {
  open: boolean;
  onClose: () => void;
  imageDataUrl: string;
}) {
  const { apiBase, getAuthHeaders } = useAdminAuth();
  const [folders, setFolders] = useState<string[]>([]);
  const [selectedFolder, setSelectedFolder] = useState<string>("");
  const [imageName, setImageName] = useState("");
  const [saving, setSaving] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [showNewFolder, setShowNewFolder] = useState(false);

  useEffect(() => {
    if (!open) return;
    (async () => {
      try {
        const headers = await getAuthHeaders();
        const res = await fetch(`${apiBase}/images/folders`, { headers });
        const list = res.ok ? await res.json() : [];
        setFolders(list);
        setSelectedFolder((current) => current || list[0] || "");
      } catch { /* ignore */ }
    })();
  }, [open, apiBase, getAuthHeaders]);

  useEffect(() => {
    if (!open) {
      setSelectedFolder("");
      setImageName("");
      setNewFolderName("");
      setShowNewFolder(false);
    }
  }, [open]);

  const handleSave = async () => {
    if (!selectedFolder) return;
    const folder = selectedFolder;
    const name = imageName.trim() || `image-${Date.now()}`;
    setSaving(true);
    try {
      const headers = await getAuthHeaders();
      delete (headers as Record<string, string>)["Content-Type"];
      const mimeMatch = imageDataUrl.match(/data:([^;]+)/);
      const mimeType = mimeMatch ? mimeMatch[1] : "image/png";
      const resp64 = await fetch(imageDataUrl);
      const blob = await resp64.blob();
      const ext = mimeType.split("/")[1] || "png";
      const file = new File([blob], `${name}.${ext}`, { type: mimeType });
      const formData = new FormData();
      formData.append("file", file);
      formData.append("name", name);
      formData.append("folder", folder);
      const resp = await fetch(`${apiBase}/images`, {
        method: "POST",
        headers,
        body: formData,
      });
      if (!resp.ok) {
        const errData = await resp.json().catch(() => ({}));
        alert(`Save failed: ${errData.error || resp.statusText}`);
        return;
      }
      onClose();
    } catch (e) {
      console.error("Save to library failed:", e);
      alert(`Save failed: ${e instanceof Error ? e.message : "Unknown error"}`);
    } finally {
      setSaving(false);
    }
  };

  const [folderError2, setFolderError2] = useState<string | null>(null);

  const handleCreateFolder = async () => {
    const trimmed = newFolderName.trim();
    if (!trimmed) return;
    setFolderError2(null);

    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`${apiBase}/images/folders`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: trimmed }),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        setFolderError2(`Failed to create folder: ${errData.error || res.statusText}`);
        return;
      }
      const foldersRes = await fetch(`${apiBase}/images/folders`, { headers });
      const serverFolders = foldersRes.ok ? await foldersRes.json() : [];
      setFolders(serverFolders);
      setSelectedFolder(trimmed);
      setShowNewFolder(false);
      setNewFolderName("");
    } catch (e) {
      console.error("Create folder failed:", e);
      setFolderError2(`Failed to create folder: ${e instanceof Error ? e.message : "Network error"}`);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="w-[95vw] max-w-sm p-4">
        <DialogHeader>
          <DialogTitle>Save to Library</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div>
            <Label className="text-sm mb-1.5 block">Image Name</Label>
            <Input
              value={imageName}
              onChange={(e) => setImageName(e.target.value)}
              placeholder="My image"
              data-testid="input-save-image-name"
            />
          </div>
          <div>
            <Label className="text-sm mb-1.5 block">Folder</Label>
            <div className="grid grid-cols-2 gap-2">
              {folders.map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setSelectedFolder(f)}
                  className={`qr-btn qr-btn--touch min-h-[44px] text-sm capitalize ${
                    selectedFolder === f ? "qr-btn--primary" : "qr-btn--outline"
                  }`}
                  data-testid={`save-folder-${f}`}
                >
                  {f}
                </button>
              ))}
            </div>
            {showNewFolder ? (
              <div className="flex gap-2 mt-2">
                <Input
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  placeholder="Folder name"
                  className="flex-1"
                  autoFocus
                  onKeyDown={(e) => e.key === 'Enter' && handleCreateFolder()}
                  data-testid="input-save-new-folder"
                />
                <Button size="sm" onClick={handleCreateFolder} disabled={!newFolderName.trim()} data-testid="button-save-confirm-folder">
                  <Check className="h-4 w-4" />
                </Button>
                <Button size="sm" variant="outline" onClick={() => { setShowNewFolder(false); setNewFolderName(""); setFolderError2(null); }} data-testid="button-save-cancel-folder">
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setShowNewFolder(true)}
                className="qr-btn qr-btn--outline qr-btn--touch w-full min-h-[44px] text-sm mt-2 flex items-center justify-center gap-2"
                data-testid="button-save-new-folder"
              >
                <FolderPlus className="h-4 w-4" />
                New Folder
              </button>
            )}
            {folderError2 && (
              <p className="text-sm text-red-500 mt-1" data-testid="text-save-folder-error">{folderError2}</p>
            )}
          </div>
          <Button
            className="w-full"
            size="lg"
            onClick={handleSave}
            disabled={saving || !selectedFolder}
            data-testid="button-save-to-library"
          >
            <Save className="h-5 w-5 mr-2" />
            {saving ? "Saving..." : "Save to Library"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function ProductGraphicTextModule() {
  const { state, setContent } = useBuilderContext();
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [libraryTarget, setLibraryTarget] = useState<"header" | "footer" | null>(null);
  const [saveImageDataUrl, setSaveImageDataUrl] = useState<string | null>(null);

  const openLibraryFor = useCallback((target: "header" | "footer") => {
    setLibraryTarget(target);
    setLibraryOpen(true);
  }, []);

  const handleLibrarySelect = useCallback((url: string) => {
    if (libraryTarget === "header") {
      setContent({ headerStyle: { ...((state.content?.headerStyle as TextStyleConfig) || headerDefaultStyle), imageUrl: url, mode: "image" } });
    } else if (libraryTarget === "footer") {
      setContent({ footerStyle: { ...((state.content?.footerStyle as TextStyleConfig) || footerDefaultStyle), imageUrl: url, mode: "image" } });
    }
  }, [libraryTarget, state.content, setContent]);

  const showGraphicText = state.qrProductState === "qr_plus" ||
                          state.qrProductState === "qr_canvas" || 
                          state.qrProductState === "qr_play" || 
                          state.qrProductState === "qr_compose";

  if (!showGraphicText || !state.selectedProduct || !state.content) {
    return null;
  }

  const adminAreaImageUrl = state.content.areaImageUrl || '';

  const hasHeaderContent = (state.content.headerStyle as TextStyleConfig)?.enabled;
  const hasFooterContent = (state.content.footerStyle as TextStyleConfig)?.enabled;
  const showPreview = hasHeaderContent || hasFooterContent || !!adminAreaImageUrl || state.content.subBottomEnabled;

  return (
    <CollapsibleModule
      title="Product Graphic Text"
      icon={<Type className="h-4 w-4" />}
      className="bg-muted/30"
      defaultOpen
    >
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Add styled text to the top or bottom of your product graphic (+$2 per line)
        </p>

        <TextStyleEditor
          label="Top Text"
          sublabel="Appears at top of graphic"
          maxLength={40}
          style={(state.content.headerStyle as TextStyleConfig) || headerDefaultStyle}
          onChange={(updates) => setContent({ 
            headerStyle: { 
              ...((state.content.headerStyle as TextStyleConfig) || headerDefaultStyle), 
              ...updates 
            } 
          })}
          testIdPrefix="header"
          showPositionControls={true}
          previewBackgroundColor={state.selectedColor?.hex || '#1a1a2e'}
          onPickFromLibrary={() => openLibraryFor("header")}
          onSaveToLibrary={() => {
            const headerImg = (state.content.headerStyle as TextStyleConfig)?.imageUrl;
            if (headerImg?.startsWith("data:")) setSaveImageDataUrl(headerImg);
          }}
        />

        {showPreview && (
          <div className="flex flex-col items-center py-2">
            <p className="text-xs text-muted-foreground mb-2">Product Graphic Preview</p>
            <GraphicPreviewView
              backgroundColor={state.selectedColor?.hex || '#1a1a2e'}
              headerStyle={(state.content.headerStyle as TextStyleConfig) || headerDefaultStyle}
              footerStyle={(state.content.footerStyle as TextStyleConfig) || footerDefaultStyle}
              showQRCode={true}
              aspectRatio="portrait"
              qrPositionX={posX}
              qrPositionY={posY}
              qrSizePercent={sizeVal}
              areaImageUrl={adminAreaImageUrl}
              areaImageMode={adminAreaImageMode}
              areaImageOffsetX={areaOffX}
              areaImageOffsetY={areaOffY}
              areaImageScale={areaSc}
              subBottomEnabled={state.content.subBottomEnabled}
              subBottomText={state.content.subBottomText}
            />
            <p className="text-xs text-muted-foreground mt-2 text-center">
              This is how your product graphic will appear
            </p>
          </div>
        )}
        
        <TextStyleEditor
          label="Bottom Text"
          sublabel="Appears at bottom of graphic"
          maxLength={40}
          style={(state.content.footerStyle as TextStyleConfig) || footerDefaultStyle}
          onChange={(updates) => setContent({ 
            footerStyle: { 
              ...((state.content.footerStyle as TextStyleConfig) || footerDefaultStyle), 
              ...updates 
            } 
          })}
          testIdPrefix="footer"
          showPositionControls={true}
          previewBackgroundColor={state.selectedColor?.hex || '#1a1a2e'}
          onPickFromLibrary={() => openLibraryFor("footer")}
          onSaveToLibrary={() => {
            const footerImg = (state.content.footerStyle as TextStyleConfig)?.imageUrl;
            if (footerImg?.startsWith("data:")) setSaveImageDataUrl(footerImg);
          }}
        />

        <div className="mt-4 pt-4 border-t">
          <div className="flex items-center justify-between gap-2 mb-3">
            <div className="flex items-center gap-1.5">
              <MessageSquare className="w-3.5 h-3.5 text-muted-foreground" />
              <Label className="text-sm font-medium">Sub-Bottom CTA</Label>
            </div>
            <Switch
              checked={state.content.subBottomEnabled ?? false}
              onCheckedChange={(checked) => setContent({ subBottomEnabled: checked })}
              data-testid="switch-sub-bottom-enabled"
            />
          </div>
          <p className="text-xs text-muted-foreground mb-2">
            Small call-to-action text below the QR code (e.g. "Scan Me")
          </p>
          {state.content.subBottomEnabled && (
            <Input
              value={state.content.subBottomText || ''}
              onChange={(e) => setContent({ subBottomText: e.target.value })}
              placeholder="Scan Me"
              maxLength={30}
              data-testid="input-sub-bottom-text"
            />
          )}
        </div>

        {/* TODO: Middle zone controls (QR position/size, center image) commented out — not ready for production.
             See TODO.md item #3. These need to be broken out into their own module with proper UX
             before being re-enabled. The layout engine (graphicLayout.ts) still supports these values
             via defaults when not explicitly set by the user. */}

      </div>

      <ImageLibraryDialog
        open={libraryOpen}
        onClose={() => setLibraryOpen(false)}
        onSelect={handleLibrarySelect}
      />

      {saveImageDataUrl && (
        <SaveToLibraryDialog
          open={!!saveImageDataUrl}
          onClose={() => setSaveImageDataUrl(null)}
          imageDataUrl={saveImageDataUrl}
        />
      )}
    </CollapsibleModule>
  );
}
