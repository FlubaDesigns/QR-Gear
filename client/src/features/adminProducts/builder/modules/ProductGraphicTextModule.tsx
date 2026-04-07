import { useRef, useState, useCallback, useEffect } from "react";
import { Type, Move, Maximize2, Upload, X, ImageIcon, MessageSquare, Loader2, FolderOpen, FolderPlus, Trash2, Check, Save } from "lucide-react";
import { CollapsibleModule } from "@/features/shared/components/CollapsibleModule";
import { useBuilderContext } from "../BuilderContext";
import { TextStyleEditor, type TextStyleConfig, defaultTextStyle } from "@/features/shared/components/TextStyleEditor";
import { GraphicPreviewView } from "@/features/shared/components/skins/GraphicPreviewView";
import { ScrollGridView } from "@/features/shared/components/views/ScrollGridView";
import { ModalView } from "@/features/shared/components/views/ModalView";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useAdminAuth } from "@/features/shared/AdminAuthContext";
import {
  MIN_SAFE_QR_SIZE_PERCENT,
  FORCE_BLOCK_REPLACE_QR,
  clampQrPercent,
  sanitizeQrReadableContent,
  getQrSafetyAssessment,
  getQrSafetyClasses,
} from "@/features/adminProducts/shared/qrSafety";

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
      delete headers["Content-Type"];
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
  const [libraryTarget, setLibraryTarget] = useState<"header" | "footer" | "area" | null>(null);
  const [saveImageDataUrl, setSaveImageDataUrl] = useState<string | null>(null);
  const adminAreaFileRef = useRef<HTMLInputElement>(null);

  const openLibraryFor = useCallback((target: "header" | "footer" | "area") => {
    setLibraryTarget(target);
    setLibraryOpen(true);
  }, []);

  const handleLibrarySelect = useCallback((url: string) => {
    if (libraryTarget === "header") {
      setContent({ headerStyle: { ...((state.content?.headerStyle as TextStyleConfig) || headerDefaultStyle), imageUrl: url, mode: "image" } });
    } else if (libraryTarget === "footer") {
      setContent({ footerStyle: { ...((state.content?.footerStyle as TextStyleConfig) || footerDefaultStyle), imageUrl: url, mode: "image" } });
    } else if (libraryTarget === "area") {
      setContent({ areaImageUrl: url, areaImageMode: state.content?.areaImageMode || 'behind-qr' });
    }
  }, [libraryTarget, state.content, setContent]);

  const showGraphicText = state.qrProductState === "qr_plus" ||
                          state.qrProductState === "qr_canvas" || 
                          state.qrProductState === "qr_play" || 
                          state.qrProductState === "qr_compose";

  if (!showGraphicText || !state.selectedProduct || !state.content) {
    return null;
  }

  const posX = state.content.qrPositionX ?? 50;
  const posY = state.content.qrPositionY ?? 0;
  const sizeVal = state.content.qrSizePercent ?? 85;
  const adminAreaImageUrl = state.content.areaImageUrl || '';
  const adminAreaImageMode = state.content.areaImageMode || 'behind-qr';
  const areaOffX = state.content.areaImageOffsetX ?? 50;
  const areaOffY = state.content.areaImageOffsetY ?? 50;
  const areaSc = state.content.areaImageScale ?? 100;

  const handleAdminAreaImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = () => {
      setContent({ areaImageUrl: reader.result as string, areaImageMode: adminAreaImageMode });
    };
    reader.readAsDataURL(file);
    if (adminAreaFileRef.current) adminAreaFileRef.current.value = "";
  };

  const hasHeaderContent = (state.content.headerStyle as TextStyleConfig)?.enabled;
  const hasFooterContent = (state.content.footerStyle as TextStyleConfig)?.enabled;
  const showPreview = hasHeaderContent || hasFooterContent || !!adminAreaImageUrl || state.content.subBottomEnabled;

  const qrSafety = getQrSafetyAssessment({
    qrSizePercent: sizeVal,
    areaImageMode: adminAreaImageUrl ? adminAreaImageMode : undefined,
    subBottomEnabled: state.content.subBottomEnabled,
    headerEnabled: !!hasHeaderContent,
    footerEnabled: !!hasFooterContent,
  });

  const qrSafetyClasses = getQrSafetyClasses(qrSafety.status);

  const safeSetContent = (updates: Partial<typeof state.content>) => {
    setContent(sanitizeQrReadableContent(updates));
  };

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

        <div className="mt-4 pt-4 border-t">
          <p className="text-xs text-muted-foreground mb-3 font-medium">QR Code Position & Size</p>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-sm flex items-center gap-1.5">
                  <Move className="w-3.5 h-3.5" /> Left / Right
                </Label>
                <span className="text-xs text-muted-foreground" data-testid="text-admin-qr-pos-x">{posX}%</span>
              </div>
              <Slider
                value={[posX]}
                onValueChange={([v]) => setContent({ qrPositionX: v })}
                min={0}
                max={100}
                step={1}
                data-testid="slider-admin-qr-position-x"
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-sm flex items-center gap-1.5">
                  <Move className="w-3.5 h-3.5" /> Up / Down
                </Label>
                <span className="text-xs text-muted-foreground" data-testid="text-admin-qr-pos-y">{posY}%</span>
              </div>
              <Slider
                value={[posY]}
                onValueChange={([v]) => setContent({ qrPositionY: v })}
                min={0}
                max={100}
                step={1}
                data-testid="slider-admin-qr-position-y"
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-sm flex items-center gap-1.5">
                  <Maximize2 className="w-3.5 h-3.5" /> QR Size
                </Label>
                <span className="text-xs text-muted-foreground" data-testid="text-admin-qr-size">{sizeVal}%</span>
              </div>
              <Slider
                value={[sizeVal]}
                onValueChange={([v]) => safeSetContent({ qrSizePercent: v })}
                min={MIN_SAFE_QR_SIZE_PERCENT}
                max={100}
                step={1}
                data-testid="slider-admin-qr-size"
              />
              <p className="text-[11px] text-muted-foreground mt-1">
                Minimum enforced for readability: {MIN_SAFE_QR_SIZE_PERCENT}%
              </p>
            </div>

            <div className="text-center pt-1">
              <Button
                variant="outline"
                size="sm"
                onClick={() => safeSetContent({ qrPositionX: 50, qrPositionY: 0, qrSizePercent: 85 })}
                data-testid="button-admin-reset-qr-position"
              >
                Reset to Default
              </Button>
            </div>

            <div
              className={`mt-3 rounded-lg border p-3 space-y-2 ${qrSafetyClasses.wrap}`}
              data-testid="panel-admin-qr-safety"
            >
              <div className="flex items-center justify-between gap-2">
                <Label className="text-sm font-medium">QR Safety Meter</Label>
                <span
                  className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${qrSafetyClasses.badge}`}
                  data-testid="badge-admin-qr-safety"
                >
                  {qrSafety.label}
                </span>
              </div>

              <p
                className={`text-xs ${qrSafetyClasses.text}`}
                data-testid="text-admin-qr-safety-summary"
              >
                {qrSafety.summary}
              </p>

              {qrSafety.status !== "replace" && (
                <div className="space-y-1" data-testid="bar-admin-qr-safety-score">
                  <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                    <span>Readability Score</span>
                    <span>{qrSafety.score}/100</span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-black/20">
                    <div
                      className={`h-full transition-all ${
                        qrSafety.status === "safe"
                          ? "bg-emerald-500"
                          : qrSafety.status === "caution"
                            ? "bg-amber-400"
                            : "bg-red-500"
                      }`}
                      style={{ width: `${qrSafety.score}%` }}
                    />
                  </div>
                </div>
              )}

              {!!qrSafety.tips.length && (
                <ul
                  className="list-disc pl-4 space-y-1 text-[11px] text-muted-foreground"
                  data-testid="list-admin-qr-safety-tips"
                >
                  {qrSafety.tips.map((tip, idx) => (
                    <li key={`${tip}-${idx}`}>{tip}</li>
                  ))}
                </ul>
              )}
            </div>

            <div className="mt-2 rounded-md border border-blue-500/20 bg-blue-500/10 p-2">
              <p className="text-[11px] text-blue-100" data-testid="text-admin-qr-guardrail-notice">
                Readability guardrails are active. QR size cannot go below {MIN_SAFE_QR_SIZE_PERCENT}%
                {FORCE_BLOCK_REPLACE_QR ? ", and QR replacement mode is disabled" : ""} to protect scan reliability.
              </p>
            </div>
          </div>

          <div className="pt-3 border-t space-y-3">
            <input
              ref={adminAreaFileRef}
              type="file"
              accept="image/*"
              onChange={handleAdminAreaImageUpload}
              className="hidden"
              data-testid="input-admin-area-image-file"
            />
            <div className="flex items-center gap-2">
              <ImageIcon className="w-4 h-4 text-muted-foreground" />
              <Label className="text-sm font-medium">Center Image</Label>
            </div>

            {adminAreaImageUrl ? (
              <div className="space-y-2">
                <div className="border rounded-md p-2 bg-muted/30">
                  <img
                    src={adminAreaImageUrl}
                    alt="Area image"
                    className="w-full max-h-[100px] object-contain rounded"
                    data-testid="img-admin-area-preview"
                  />
                </div>
                <div className="flex gap-1 p-1 bg-muted rounded-md" data-testid="toggle-admin-area-mode">
                  <button
                    type="button"
                    onClick={() => safeSetContent({ areaImageMode: "behind-qr" })}
                    className={`flex-1 min-h-[36px] rounded-sm text-xs font-medium transition-colors ${
                      adminAreaImageMode === "behind-qr"
                        ? "bg-background text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                    data-testid="button-admin-area-mode-behind"
                  >
                    Behind QR
                  </button>
                  <button
                    type="button"
                    disabled={FORCE_BLOCK_REPLACE_QR}
                    onClick={() => {
                      if (!FORCE_BLOCK_REPLACE_QR) safeSetContent({ areaImageMode: "replace-qr" });
                    }}
                    className={`flex-1 min-h-[36px] rounded-sm text-xs font-medium transition-colors ${
                      FORCE_BLOCK_REPLACE_QR
                        ? "opacity-40 cursor-not-allowed text-muted-foreground"
                        : adminAreaImageMode === "replace-qr"
                          ? "bg-background text-foreground shadow-sm"
                          : "text-muted-foreground hover:text-foreground"
                    }`}
                    data-testid="button-admin-area-mode-replace"
                  >
                    Replace QR {FORCE_BLOCK_REPLACE_QR ? "(locked)" : ""}
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => adminAreaFileRef.current?.click()}
                    data-testid="button-admin-replace-area-image"
                  >
                    <Upload className="h-4 w-4 mr-1" />
                    Replace
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => openLibraryFor("area")}
                    data-testid="button-admin-area-library"
                  >
                    <FolderOpen className="h-4 w-4 mr-1" />
                    Library
                  </Button>
                  {adminAreaImageUrl.startsWith("data:") && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setSaveImageDataUrl(adminAreaImageUrl)}
                      data-testid="button-admin-save-area-to-library"
                    >
                      <Save className="h-4 w-4 mr-1" />
                      Save
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setContent({ areaImageUrl: '', areaImageOffsetX: 50, areaImageOffsetY: 50, areaImageScale: 100 })}
                    data-testid="button-admin-remove-area-image"
                  >
                    <X className="h-4 w-4 mr-1" />
                    Remove
                  </Button>
                </div>
                <div className="pt-2 space-y-3">
                  <p className="text-xs font-medium text-muted-foreground">Image Position & Size</p>
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <Label className="text-sm flex items-center gap-1.5">
                        <Move className="w-3.5 h-3.5" /> Left / Right
                      </Label>
                      <span className="text-xs text-muted-foreground" data-testid="text-admin-area-pos-x">{areaOffX}%</span>
                    </div>
                    <Slider
                      value={[areaOffX]}
                      onValueChange={([v]) => setContent({ areaImageOffsetX: v })}
                      min={0}
                      max={100}
                      step={1}
                      data-testid="slider-admin-area-offset-x"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <Label className="text-sm flex items-center gap-1.5">
                        <Move className="w-3.5 h-3.5" /> Up / Down
                      </Label>
                      <span className="text-xs text-muted-foreground" data-testid="text-admin-area-pos-y">{areaOffY}%</span>
                    </div>
                    <Slider
                      value={[areaOffY]}
                      onValueChange={([v]) => setContent({ areaImageOffsetY: v })}
                      min={0}
                      max={100}
                      step={1}
                      data-testid="slider-admin-area-offset-y"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <Label className="text-sm flex items-center gap-1.5">
                        <Maximize2 className="w-3.5 h-3.5" /> Size
                      </Label>
                      <span className="text-xs text-muted-foreground" data-testid="text-admin-area-scale">{areaSc}%</span>
                    </div>
                    <Slider
                      value={[areaSc]}
                      onValueChange={([v]) => setContent({ areaImageScale: v })}
                      min={20}
                      max={200}
                      step={1}
                      data-testid="slider-admin-area-scale"
                    />
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex gap-2">
                <div
                  onClick={() => adminAreaFileRef.current?.click()}
                  className="flex-1 border-2 border-dashed rounded-md p-4 flex flex-col items-center gap-1.5 cursor-pointer hover:bg-muted/30 transition-colors"
                  data-testid="dropzone-admin-area-image"
                >
                  <Upload className="h-6 w-6 text-muted-foreground" />
                  <p className="text-xs text-muted-foreground font-medium">Upload</p>
                  <p className="text-xs text-muted-foreground/60">PNG, JPG, SVG</p>
                </div>
                <div
                  onClick={() => openLibraryFor("area")}
                  className="flex-1 border-2 border-dashed rounded-md p-4 flex flex-col items-center gap-1.5 cursor-pointer hover:bg-muted/30 transition-colors"
                  data-testid="dropzone-admin-area-library"
                >
                  <FolderOpen className="h-6 w-6 text-muted-foreground" />
                  <p className="text-xs text-muted-foreground font-medium">Library</p>
                  <p className="text-xs text-muted-foreground/60">Your images</p>
                </div>
              </div>
            )}
          </div>
        </div>
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
