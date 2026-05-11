// VVSS 1·3·1·0 — SlideView (folder tabs) / flat card skins / no popup Shape
// Three folders driven by GRF engine constants: Source, Cropped, Background.
// Background folder adds an optional crop step before selection.
// Source folder adds a crop-mint step so uploads can be cropped into derivatives.

import { useState, useRef, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, RefreshCw, Upload, ImageIcon, Check, Crop } from "lucide-react";
import { Button } from "@/components/ui/button";
import { adminFetch } from "@/lib/adminFetch";
import { auth } from "@/lib/firebase";
import { ScrollGridView } from "./views/ScrollGridView";
import { CropUtility, type CropAsset } from "./utilities/CropUtility";
import { useToast } from "@/hooks/use-toast";
import {
  GRF_FILTER_ORIGINALS,
  GRF_FILTER_CROPPED,
  GRF_FILTER_BACKGROUNDS,
  normalizeMimeType,
} from "@shared/GRF_engine";
import {
  ORIGINALS_QK,
  CROPPED_QK,
  BACKGROUNDS_QK,
} from "@/features/adminLibrary/shared/grfQueryKeys";

// ── Types ─────────────────────────────────────────────────────────────────────

interface GrfAsset {
  id: string;
  grfId: string;
  name: string;
  publicUrl: string;
  mimeType: string;
  isActive: boolean;
  originalFilename?: string;
  sourceGrfId?: string | null;
}

export interface SelectedBackground {
  id: string;
  name: string;
  url: string;
}

export interface GRFImagePickerProps {
  selectedId?: string | null;
  onSelect: (background: SelectedBackground) => void;
  onClear?: () => void;
  currentBackground?: SelectedBackground | null;
  enabled?: boolean;
}

type Tab = "source" | "cropped" | "background";
type CropMode = "source" | "background";

const TABS: Tab[] = ["source", "cropped", "background"];

const TAB_LABEL: Record<Tab, string> = {
  source: "Source",
  cropped: "Cropped",
  background: "Background",
};

// ── Grid item shape ────────────────────────────────────────────────────────────

interface PickerItem {
  id: string;
  name: string;
  imageUrl: string;
  _raw: GrfAsset;
}

function assetToPickerItem(asset: GrfAsset): PickerItem {
  return {
    id: asset.grfId,
    name: asset.name,
    imageUrl: asset.publicUrl,
    _raw: asset,
  };
}

// ── Component ─────────────────────────────────────────────────────────────────

export function GRFImagePicker({
  selectedId,
  onSelect,
  onClear,
  currentBackground,
  enabled = true,
}: GRFImagePickerProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [activeTab, setActiveTab] = useState<Tab>("background");
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [cropOpen, setCropOpen] = useState(false);
  const [cropAsset, setCropAsset] = useState<CropAsset | null>(null);
  const [cropMode, setCropMode] = useState<CropMode>("background");
  const [pendingBg, setPendingBg] = useState<GrfAsset | null>(null);

  // Proxy Firebase Storage images through our server so the canvas can read
  // pixel data without hitting a CORS taint security error.
  const fetchImageBlob = useCallback(async (url: string): Promise<string> => {
    const token = await auth.currentUser?.getIdToken();
    const proxyUrl = `/api/admin/proxy-image?url=${encodeURIComponent(url)}`;
    const res = await fetch(proxyUrl, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) throw new Error(`proxy-image ${res.status}`);
    const blob = await res.blob();
    return URL.createObjectURL(blob);
  }, []);

  // ── Queries — all three load eagerly so tab switching is instant ───────────

  const { data: sourceAssets = [], isLoading: loadingSource } = useQuery<GrfAsset[]>({
    queryKey: ORIGINALS_QK,
    queryFn: () =>
      adminFetch<GrfAsset[]>(
        `/graphics?channel=${GRF_FILTER_ORIGINALS.channel}&purpose=${GRF_FILTER_ORIGINALS.purpose}`
      ),
    enabled,
  });

  const { data: croppedAssets = [], isLoading: loadingCropped } = useQuery<GrfAsset[]>({
    queryKey: CROPPED_QK,
    queryFn: () =>
      adminFetch<GrfAsset[]>(
        `/graphics?channel=${GRF_FILTER_CROPPED.channel}&purpose=${GRF_FILTER_CROPPED.purpose}`
      ),
    enabled,
  });

  const { data: bgAssets = [], isLoading: loadingBg } = useQuery<GrfAsset[]>({
    queryKey: BACKGROUNDS_QK,
    queryFn: () =>
      adminFetch<GrfAsset[]>(
        `/graphics?channel=${GRF_FILTER_BACKGROUNDS.channel}&purpose=${GRF_FILTER_BACKGROUNDS.purpose}`
      ),
    enabled,
  });

  // ── Upload (Source folder) ─────────────────────────────────────────────────

  const handleFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      if (fileInputRef.current) fileInputRef.current.value = "";

      const mimeType = normalizeMimeType(file.type || "image/jpeg");
      const filename = file.name;

      setUploading(true);
      try {
        const dataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });

        await adminFetch("/library/upload-source", {
          method: "POST",
          json: {
            imageUrl: dataUrl,
            mimeType,
            name: filename,
            originalFilename: filename,
          },
        });

        toast({ title: "Uploaded", description: filename });
        queryClient.invalidateQueries({ queryKey: ORIGINALS_QK });
        setActiveTab("source");
      } catch (err: unknown) {
        const error = err as Error;
        console.error("[GRFImagePicker] Upload failed:", error.message);
        toast({
          title: "Upload failed",
          description: error.message,
          variant: "destructive",
        });
      } finally {
        setUploading(false);
      }
    },
    [toast, queryClient]
  );

  // ── Source crop (crop-mint → creates cropped derivative + background) ──────

  const handleStartSourceCrop = (asset: GrfAsset) => {
    setCropMode("source");
    setCropAsset({ id: asset.grfId, name: asset.name, imageUrl: asset.publicUrl });
    setCropOpen(true);
    console.log("[GRFImagePicker] Starting source crop for:", asset.grfId);
  };

  const handleSaveSourceCrop = async (croppedDataUrl: string, sourceAsset?: CropAsset) => {
    if (!sourceAsset) {
      console.error("[GRFImagePicker] handleSaveSourceCrop: no sourceAsset");
      return;
    }

    const raw = sourceAssets.find((a) => a.grfId === sourceAsset.id);
    const grfId = raw?.grfId || sourceAsset.id;
    const origMime = raw?.mimeType || "image/jpeg";
    const origName = raw?.name || raw?.originalFilename || sourceAsset.name;
    const origUrl = raw?.publicUrl || sourceAsset.imageUrl;

    const croppedImageData = croppedDataUrl.startsWith("data:")
      ? croppedDataUrl.replace(/^data:[^;]+;base64,/, "")
      : croppedDataUrl;

    setSaving(true);
    try {
      await adminFetch("/library/crop-mint", {
        method: "POST",
        json: {
          croppedImageData,
          croppedMimeType: "image/jpeg",
          originalMimeType: origMime,
          originalPublicUrl: origUrl,
          sourceGrfId: grfId,
        },
      });

      toast({ title: "Crop saved", description: `Cropped derivative and background created from "${origName}".` });
      queryClient.invalidateQueries({ queryKey: ORIGINALS_QK });
      queryClient.invalidateQueries({ queryKey: CROPPED_QK });
      queryClient.invalidateQueries({ queryKey: BACKGROUNDS_QK });
      setCropOpen(false);
      setCropAsset(null);
    } catch (err: unknown) {
      const error = err as Error;
      console.error("[GRFImagePicker] Crop-mint failed:", error.message);
      toast({ title: "Crop failed", description: error.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  // ── Background selection handlers ──────────────────────────────────────────

  const handleSelectDirect = (asset: GrfAsset) => {
    onSelect({ id: asset.grfId, name: asset.name, url: asset.publicUrl });
  };

  const handleSelectBackground = (asset: GrfAsset) => {
    setCropMode("background");
    setPendingBg(asset);
    setCropAsset({ id: asset.grfId, name: asset.name, imageUrl: asset.publicUrl });
    setCropOpen(true);
  };

  const handleCropComplete = (resultUrl: string) => {
    if (cropMode === "background" && pendingBg) {
      onSelect({ id: pendingBg.grfId, name: pendingBg.name, url: resultUrl });
      setPendingBg(null);
    }
  };

  const handleCropClose = (open: boolean) => {
    setCropOpen(open);
    if (!open) {
      setCropAsset(null);
      setPendingBg(null);
    }
  };

  // ── Grid renderer ──────────────────────────────────────────────────────────

  const renderGrid = (assets: GrfAsset[], isLoading: boolean, tab: Tab) => {
    const items: PickerItem[] = assets.map(assetToPickerItem);

    return (
      <ScrollGridView
        items={items}
        isLoading={isLoading}
        columns="grid-cols-3"
        height="240px"
        emptyMessage={`No ${TAB_LABEL[tab].toLowerCase()} images found.`}
        footer={null}
        renderItem={(item) => {
          const isSelected = selectedId === item.id;
          const handleClick = () =>
            tab === "background"
              ? handleSelectBackground(item._raw)
              : handleSelectDirect(item._raw);

          return (
            <div
              className={`relative rounded-md overflow-hidden cursor-pointer ring-2 transition-all ${
                isSelected
                  ? "ring-primary"
                  : "ring-transparent hover:ring-white/40"
              }`}
              onClick={handleClick}
              data-testid={`card-${tab}-${item.id}`}
            >
              {item.imageUrl ? (
                <>
                  <img
                    src={item.imageUrl}
                    alt={item.name}
                    className={`w-full object-cover ${
                      tab === "cropped" ? "aspect-[9/16]" : "aspect-square"
                    }`}
                    loading="lazy"
                  />
                  {isSelected && (
                    <div className="absolute inset-0 bg-primary/20 flex items-center justify-center">
                      <div className="bg-primary rounded-full p-0.5">
                        <Check className="h-3 w-3 text-primary-foreground" />
                      </div>
                    </div>
                  )}
                  {tab === "source" && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleStartSourceCrop(item._raw);
                      }}
                      className="absolute top-1 right-1 bg-black/60 hover:bg-black/80 text-white rounded p-1 transition-colors"
                      title="Crop this image"
                      data-testid={`button-crop-source-${item.id}`}
                    >
                      <Crop className="h-3 w-3" />
                    </button>
                  )}
                  <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-[10px] px-1 py-0.5 truncate">
                    {item.name}
                  </div>
                </>
              ) : (
                <div className="flex items-center justify-center bg-muted aspect-square">
                  <ImageIcon className="h-6 w-6 text-muted-foreground" />
                </div>
              )}
            </div>
          );
        }}
      />
    );
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-3" data-testid="grf-image-picker">
      <p className="text-xs font-medium text-muted-foreground">Background Image</p>

      {/* Folder tab bar */}
      <div className="flex gap-1 border-b">
        {TABS.map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            className={`px-3 py-1.5 text-xs font-medium transition-colors rounded-t-sm -mb-px border-x border-t ${
              activeTab === tab
                ? "border-border bg-background text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
            data-testid={`tab-${tab}`}
          >
            {TAB_LABEL[tab]}
          </button>
        ))}
      </div>

      {/* Folder content */}
      <div>
        {activeTab === "source" && (
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs text-muted-foreground">
                Click the crop icon on any image to crop it into a background.
              </p>
              <div className="flex-shrink-0">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  className="hidden"
                  data-testid="input-picker-upload"
                />
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  data-testid="button-picker-upload"
                >
                  {uploading ? (
                    <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                  ) : (
                    <Upload className="h-3.5 w-3.5 mr-1.5" />
                  )}
                  Upload
                </Button>
              </div>
            </div>
            {renderGrid(sourceAssets, loadingSource, "source")}
          </div>
        )}

        {activeTab === "cropped" && renderGrid(croppedAssets, loadingCropped, "cropped")}

        {activeTab === "background" && renderGrid(bgAssets, loadingBg, "background")}
      </div>

      {/* Current selection banner */}
      {currentBackground && (
        <div className="p-3 bg-primary/5 rounded-md border space-y-2">
          <div className="flex items-start gap-3">
            <div className="w-10 h-14 rounded overflow-hidden border flex-shrink-0">
              <img
                src={currentBackground.url}
                alt={currentBackground.name}
                className="w-full h-full object-cover"
                data-testid="img-current-background"
              />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium">Selected</p>
              <p
                className="text-xs text-muted-foreground truncate"
                title={currentBackground.name}
              >
                {currentBackground.name}
              </p>
            </div>
          </div>
          {onClear && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onClear}
              className="w-full"
              data-testid="button-clear-background"
            >
              <RefreshCw className="h-3.5 w-3.5 mr-2" />
              Clear
            </Button>
          )}
        </div>
      )}

      {/* Unified crop dialog — used for both source crop-mint and background adjust */}
      <CropUtility
        asset={cropAsset}
        open={cropOpen}
        onOpenChange={handleCropClose}
        onSave={cropMode === "source" ? handleSaveSourceCrop : undefined}
        onCropComplete={cropMode === "background" ? handleCropComplete : undefined}
        isSaving={saving}
        allowCropToggle
        aspectRatio={9 / 16}
        title={cropMode === "source" ? "Crop Source Image" : "Adjust Background"}
        fetchImageBlob={fetchImageBlob}
      />
    </div>
  );
}
