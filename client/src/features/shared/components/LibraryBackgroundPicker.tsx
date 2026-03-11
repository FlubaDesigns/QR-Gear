import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Image, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useAdminAuth } from "@/features/shared/AdminAuthContext";
import { SkinGridViewer } from "./SkinGridViewer";
import { CropUtility, type CropAsset } from "./utilities/CropUtility";
import { BackgroundCardSkin, BackgroundDetailSkin, CroppedImageCardSkin, CroppedImageDetailSkin } from "./skins";
import type { SkinItem } from "./skins/types";

interface BackgroundAsset {
  id: string;
  name: string;
  storageUrl: string;
  proxyUrl?: string;
  thumbnailUrl?: string;
}

export interface SelectedBackground {
  id: string;
  name: string;
  url: string;
}

export interface LibraryBackgroundPickerProps {
  apiBase: string;
  selectedId?: string | null;
  onSelect: (background: SelectedBackground) => void;
  onClear?: () => void;
  currentBackground?: SelectedBackground | null;
  enabled?: boolean;
  showSourceTab?: boolean;
}

type TabType = "cropped" | "backgrounds";

function assetToSkinItem(asset: BackgroundAsset): SkinItem {
  const imageUrl = asset.thumbnailUrl || 
    (asset.proxyUrl && asset.proxyUrl !== "/api/library-files/" ? asset.proxyUrl : null) || 
    asset.storageUrl;
  return {
    id: asset.id,
    name: asset.name,
    primaryImage: imageUrl,
  };
}

export function LibraryBackgroundPicker({
  apiBase,
  selectedId,
  onSelect,
  onClear,
  currentBackground,
  enabled = true,
  showSourceTab = true,
}: LibraryBackgroundPickerProps) {
  const { toast } = useToast();
  const { getAuthHeaders } = useAdminAuth();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<TabType>("cropped");
  const [cropDialogOpen, setCropDialogOpen] = useState(false);
  const [assetToCrop, setAssetToCrop] = useState<CropAsset | null>(null);
  const [deleting, setDeleting] = useState(false);

  const { data: croppedBackgrounds = [], isLoading: loadingCropped } = useQuery<BackgroundAsset[]>({
    queryKey: [`${apiBase}/background-assets`, "cropped"],
    queryFn: async () => {
      const headers = await getAuthHeaders();
      const res = await fetch(`${apiBase}/background-assets?type=cropped`, { headers });
      if (!res.ok) return [];
      return res.json();
    },
    enabled,
  });

  const { data: backgrounds = [], isLoading: loadingBackgrounds } = useQuery<BackgroundAsset[]>({
    queryKey: [`${apiBase}/background-assets`, "background"],
    queryFn: async () => {
      const headers = await getAuthHeaders();
      const res = await fetch(`${apiBase}/background-assets?type=background`, { headers });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: enabled && showSourceTab && activeTab === "backgrounds",
  });

  const croppedItems = useMemo(() => croppedBackgrounds.map(assetToSkinItem), [croppedBackgrounds]);
  const backgroundItems = useMemo(() => backgrounds.map(assetToSkinItem), [backgrounds]);

  const handleSelectCropped = (id: string) => {
    const asset = croppedBackgrounds.find(bg => bg.id === id);
    if (asset) {
      onSelect({
        id: asset.id,
        name: asset.name,
        url: asset.proxyUrl || asset.storageUrl,
      });
    }
  };

  const handleCrop = (id: string) => {
    const asset = backgrounds.find(bg => bg.id === id);
    if (asset) {
      setAssetToCrop({
        id: asset.id,
        name: asset.name,
        imageUrl: asset.proxyUrl || asset.storageUrl,
      });
      setCropDialogOpen(true);
    }
  };

  const handleDelete = async (id: string) => {
    setDeleting(true);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`${apiBase}/background-assets/${id}`, { method: "DELETE", headers });
      if (res.ok) {
        queryClient.invalidateQueries({ queryKey: [`${apiBase}/background-assets`] });
        toast({ title: "Image deleted" });
      }
    } catch (error) {
      console.error("Delete failed:", error);
      toast({ title: "Delete failed", variant: "destructive" });
    } finally {
      setDeleting(false);
    }
  };

  const handleSaveCrop = async (imageData: string, sourceAsset?: CropAsset) => {
    if (!sourceAsset) return;
    
    const authHeaders = await getAuthHeaders();
    const response = await fetch(`${apiBase}/background-assets`, {
      method: "POST",
      headers: { ...authHeaders, "Content-Type": "application/json" },
      body: JSON.stringify({
        name: `cropped_${sourceAsset.name}`,
        assetType: "cropped",
        imageData,
        mimeType: "image/jpeg",
        sourceAssetId: sourceAsset.id,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to save cropped image");
    }

    queryClient.invalidateQueries({ queryKey: [`${apiBase}/background-assets`, "cropped"] });
    setActiveTab("cropped");
  };

  const fetchImageBlob = async (url: string): Promise<string> => {
    const response = await fetch(url);
    if (!response.ok) throw new Error("Failed to fetch image");
    const blob = await response.blob();
    return URL.createObjectURL(blob);
  };

  return (
    <div className="space-y-3">
      <p className="text-xs font-medium text-muted-foreground">Background Image</p>
      
      {showSourceTab && (
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant={activeTab === "cropped" ? "default" : "outline"}
            size="default"
            onClick={() => setActiveTab("cropped")}
            className="flex-1 min-w-[140px] min-h-[44px]"
            data-testid="tab-cropped-backgrounds"
          >
            Cropped
          </Button>
          <Button
            type="button"
            variant={activeTab === "backgrounds" ? "default" : "outline"}
            size="default"
            onClick={() => setActiveTab("backgrounds")}
            className="flex-1 min-w-[140px] min-h-[44px]"
            data-testid="tab-background-images"
          >
            Backgrounds
          </Button>
        </div>
      )}

      {activeTab === "cropped" && (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Select a ready-to-use cropped background
          </p>
          
          {loadingCropped ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin" data-testid="loader-cropped" />
            </div>
          ) : croppedItems.length === 0 ? (
            <div className="text-center py-6 border rounded-md bg-muted/20">
              <Image className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm text-muted-foreground">
                No cropped backgrounds yet.{showSourceTab ? " Crop one from Backgrounds tab." : ""}
              </p>
            </div>
          ) : (
            <SkinGridViewer
              items={croppedItems}
              CardSkin={CroppedImageCardSkin}
              DetailSkin={CroppedImageDetailSkin}
              actions={{ onSelect: handleSelectCropped }}
              gridColumns="grid-cols-3"
              selectedId={selectedId}
            />
          )}
        </div>
      )}

      {activeTab === "backgrounds" && showSourceTab && (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Click an image to view, crop, or delete
          </p>
          
          {loadingBackgrounds ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin" data-testid="loader-backgrounds" />
            </div>
          ) : backgroundItems.length === 0 ? (
            <div className="text-center py-6 border rounded-md bg-muted/20">
              <Image className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm text-muted-foreground">
                No background images found. Upload in Library.
              </p>
            </div>
          ) : (
            <SkinGridViewer
              items={backgroundItems}
              CardSkin={BackgroundCardSkin}
              DetailSkin={BackgroundDetailSkin}
              actions={{
                onCrop: handleCrop,
                onDelete: handleDelete,
              }}
              isActionPending={deleting}
              confirmAction={{
                type: "delete",
                title: "Delete this image?",
                description: "This will permanently delete this background image.",
              }}
            />
          )}
        </div>
      )}

      {currentBackground && (
        <div className="p-3 bg-primary/5 rounded-md border space-y-2">
          <div className="flex items-start gap-3">
            <div className="w-12 h-16 rounded overflow-hidden border flex-shrink-0">
              <img
                src={currentBackground.url}
                alt={currentBackground.name}
                className="w-full h-full object-cover"
              />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium">Background Selected</p>
              <p className="text-xs text-muted-foreground truncate">
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
              Change Background
            </Button>
          )}
        </div>
      )}

      <CropUtility
        asset={assetToCrop}
        open={cropDialogOpen}
        onOpenChange={(open) => {
          setCropDialogOpen(open);
          if (!open) setAssetToCrop(null);
        }}
        onSave={handleSaveCrop}
        fetchImageBlob={fetchImageBlob}
        aspectRatio={9 / 16}
        title="Crop Image"
      />
    </div>
  );
}
