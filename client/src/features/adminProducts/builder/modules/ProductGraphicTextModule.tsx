import { useRef, useState, useCallback, useEffect } from "react";
import { Type, Move, Maximize2, Upload, X, ImageIcon, MessageSquare, Loader2 } from "lucide-react";
import { CollapsibleModule } from "@/features/shared/components/CollapsibleModule";
import { useBuilderContext } from "../BuilderContext";
import { TextStyleEditor, type TextStyleConfig, defaultTextStyle } from "@/features/shared/components/TextStyleEditor";
import { GraphicPreviewView } from "@/features/shared/components/skins/GraphicPreviewView";
import { Slider } from "@/components/ui/slider";
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

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const headers = await getAuthHeaders();
      const [foldersRes, imagesRes, croppedRes, bgRes] = await Promise.all([
        fetch(`${apiBase}/images/folders`, { headers }),
        fetch(`${apiBase}/images${activeFolder ? `?folder=${encodeURIComponent(activeFolder)}` : ''}`, { headers }),
        fetch(`${apiBase}/background-assets?type=cropped`, { headers }),
        fetch(`${apiBase}/background-assets?type=background`, { headers }),
      ]);
      const folderList = foldersRes.ok ? await foldersRes.json() : [];
      const adminImages = imagesRes.ok ? await imagesRes.json() : [];
      const cropped = croppedRes.ok ? await croppedRes.json() : [];
      const backgrounds = bgRes.ok ? await bgRes.json() : [];
      setFolders(folderList);
      const bgImages = [...cropped, ...backgrounds].map((img: any) => ({
        ...img,
        folder: '_backgrounds',
      }));
      if (activeFolder === '_backgrounds') {
        setImages(bgImages);
      } else if (activeFolder) {
        setImages(adminImages);
      } else {
        setImages([...adminImages, ...bgImages]);
      }
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
    }
  }, [open, loadData]);

  const allFolders = [...folders];
  if (!allFolders.includes('_backgrounds')) allFolders.push('_backgrounds');

  const folderLabel = (f: string) => f === '_backgrounds' ? 'Backgrounds' : f;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>Choose from Library</DialogTitle>
        </DialogHeader>

        {!activeFolder && allFolders.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-3">
            {allFolders.map((f) => (
              <button
                key={f}
                onClick={() => setActiveFolder(f)}
                className="qr-btn qr-btn--outline text-xs px-3 py-1.5"
                data-testid={`picker-folder-${f}`}
              >
                {folderLabel(f)}
              </button>
            ))}
          </div>
        )}

        {activeFolder && (
          <button
            onClick={() => setActiveFolder(null)}
            className="text-sm text-blue-400 mb-2 flex items-center gap-1"
            data-testid="button-picker-back"
          >
            <span>&larr;</span> All Images
          </button>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : images.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            No images found. Upload images in the Asset Library &gt; Images tab first.
          </p>
        ) : (
          <div className="grid grid-cols-3 gap-2 overflow-y-auto max-h-[50vh] p-1">
            {images.map((img) => {
              const url = img.proxyUrl || img.publicUrl || img.storageUrl;
              return (
                <div
                  key={img.id}
                  onClick={() => {
                    onSelect(url);
                    onClose();
                  }}
                  className="cursor-pointer rounded-md overflow-hidden border border-white/10 hover:ring-2 hover:ring-blue-400 transition-all"
                  data-testid={`library-image-${img.id}`}
                >
                  <img
                    src={url}
                    alt={img.name}
                    className="w-full aspect-square object-cover bg-black/20"
                    loading="lazy"
                  />
                  <div className="text-[10px] text-white/70 p-1 truncate bg-black/40">
                    {img.name}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export function ProductGraphicTextModule() {
  const { state, setContent } = useBuilderContext();
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [libraryTarget, setLibraryTarget] = useState<"header" | "footer" | null>(null);
  const adminAreaFileRef = useRef<HTMLInputElement>(null);

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

  const posX = state.content.qrPositionX ?? 50;
  const posY = state.content.qrPositionY ?? 50;
  const sizeVal = state.content.qrSizePercent ?? 50;
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
                onValueChange={([v]) => setContent({ qrSizePercent: v })}
                min={20}
                max={80}
                step={1}
                data-testid="slider-admin-qr-size"
              />
            </div>

            <div className="text-center pt-1">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setContent({ qrPositionX: 50, qrPositionY: 50, qrSizePercent: 50 })}
                data-testid="button-admin-reset-qr-position"
              >
                Reset to Center
              </Button>
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
                    onClick={() => setContent({ areaImageMode: "behind-qr" })}
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
                    onClick={() => setContent({ areaImageMode: "replace-qr" })}
                    className={`flex-1 min-h-[36px] rounded-sm text-xs font-medium transition-colors ${
                      adminAreaImageMode === "replace-qr"
                        ? "bg-background text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                    data-testid="button-admin-area-mode-replace"
                  >
                    Replace QR
                  </button>
                </div>
                <div className="flex gap-2">
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
              <div
                onClick={() => adminAreaFileRef.current?.click()}
                className="border-2 border-dashed rounded-md p-4 flex flex-col items-center gap-1.5 cursor-pointer hover:bg-muted/30 transition-colors"
                data-testid="dropzone-admin-area-image"
              >
                <Upload className="h-6 w-6 text-muted-foreground" />
                <p className="text-xs text-muted-foreground">Upload an image for the center area</p>
                <p className="text-xs text-muted-foreground/60">Logo, graphic, or photo</p>
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
    </CollapsibleModule>
  );
}
