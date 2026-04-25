import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Image, RefreshCw, ChevronLeft, ChevronRight, X, ImageIcon, Layers } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { adminFetch } from "@/lib/adminFetch";
import { ScrollGridView } from "./views/ScrollGridView";
import { ModalView } from "./views/ModalView";
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
  selectedId,
  onSelect,
  onClear,
  currentBackground,
  enabled = true,
  showSourceTab = true,
}: LibraryBackgroundPickerProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<TabType>("cropped");
  const [cropDialogOpen, setCropDialogOpen] = useState(false);
  const [assetToCrop, setAssetToCrop] = useState<CropAsset | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [croppedSelectedIndex, setCroppedSelectedIndex] = useState<number | null>(null);
  const [croppedShowPrimary, setCroppedShowPrimary] = useState(true);

  const [bgSelectedIndex, setBgSelectedIndex] = useState<number | null>(null);
  const [bgShowPrimary, setBgShowPrimary] = useState(true);
  const [bgShowConfirm, setBgShowConfirm] = useState(false);

  const { data: croppedBackgrounds = [], isLoading: loadingCropped } = useQuery<BackgroundAsset[]>({
    queryKey: ["/api/admin/background-assets", "cropped"],
    queryFn: () => adminFetch<BackgroundAsset[]>("/background-assets?type=cropped").catch(() => []),
    enabled,
  });

  const { data: backgrounds = [], isLoading: loadingBackgrounds } = useQuery<BackgroundAsset[]>({
    queryKey: ["/api/admin/background-assets", "background"],
    queryFn: () => adminFetch<BackgroundAsset[]>("/background-assets?type=background").catch(() => []),
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
      await adminFetch(`/background-assets/${id}`, { method: "DELETE" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/background-assets"] });
      toast({ title: "Image deleted" });
    } catch (error) {
      console.error("Delete failed:", error);
      toast({ title: "Delete failed", variant: "destructive" });
    } finally {
      setDeleting(false);
    }
  };

  const handleSaveCrop = async (imageData: string, sourceAsset?: CropAsset) => {
    if (!sourceAsset) return;

    await adminFetch("/background-assets", {
      method: "POST",
      json: {
        name: `cropped_${sourceAsset.name}`,
        assetType: "cropped",
        imageData,
        mimeType: "image/jpeg",
        sourceAssetId: sourceAsset.id,
      },
    });

    queryClient.invalidateQueries({ queryKey: ["/api/admin/background-assets", "cropped"] });
    setActiveTab("cropped");
  };

  const fetchImageBlob = async (url: string): Promise<string> => {
    const response = await fetch(url);
    if (!response.ok) throw new Error("Failed to fetch image");
    const blob = await response.blob();
    return URL.createObjectURL(blob);
  };

  const croppedSelected = croppedSelectedIndex !== null ? croppedItems[croppedSelectedIndex] : null;
  const croppedHasPrev = croppedSelectedIndex !== null && croppedSelectedIndex > 0;
  const croppedHasNext = croppedSelectedIndex !== null && croppedSelectedIndex < croppedItems.length - 1;
  const croppedDisplayImage = croppedSelected
    ? (croppedShowPrimary ? croppedSelected.primaryImage : croppedSelected.secondaryImage) || croppedSelected.primaryImage || croppedSelected.secondaryImage
    : null;

  const bgSelected = bgSelectedIndex !== null ? backgroundItems[bgSelectedIndex] : null;
  const bgHasPrev = bgSelectedIndex !== null && bgSelectedIndex > 0;
  const bgHasNext = bgSelectedIndex !== null && bgSelectedIndex < backgroundItems.length - 1;
  const bgDisplayImage = bgSelected
    ? (bgShowPrimary ? bgSelected.primaryImage : bgSelected.secondaryImage) || bgSelected.primaryImage || bgSelected.secondaryImage
    : null;

  const renderDetailModal = (
    items: SkinItem[],
    selIndex: number | null,
    setSelIndex: (i: number | null) => void,
    showPrim: boolean,
    setShowPrim: (v: boolean) => void,
    displayImg: string | null | undefined,
    selected: SkinItem | null,
    hPrev: boolean,
    hNext: boolean,
    DetailSkin: typeof CroppedImageDetailSkin | typeof BackgroundDetailSkin,
    actions: Record<string, any>,
    isPending: boolean,
  ) => {
    const doPrev = () => { if (hPrev && selIndex !== null) { setSelIndex(selIndex - 1); setShowPrim(true); } };
    const doNext = () => { if (hNext && selIndex !== null) { setSelIndex(selIndex + 1); setShowPrim(true); } };
    const doClose = () => { setSelIndex(null); setShowPrim(true); };
    const hasSec = selected?.secondaryImage && selected?.primaryImage;

    return (
      <ModalView
        open={selIndex !== null}
        onOpenChange={(open) => !open && doClose()}
        title={selected?.name || "Item Preview"}
        showCloseButton={false}
      >
        <div className="relative">
          <Button variant="secondary" size="icon" className="absolute top-2 right-2 z-10 bg-black/50 hover:bg-black/70" onClick={doClose} data-testid="button-gallery-close">
            <X className="h-5 w-5 text-white" />
          </Button>
          <div className="relative aspect-square sm:aspect-video bg-muted flex items-center justify-center">
            {displayImg ? (
              <img src={displayImg} alt={selected?.name || "Preview"} className="max-w-full max-h-full object-contain" data-testid="img-gallery-preview" />
            ) : (
              <ImageIcon className="h-24 w-24 text-muted-foreground" />
            )}
            {hPrev && (
              <Button variant="secondary" size="icon" className="absolute left-2 top-1/2 -translate-y-1/2" onClick={doPrev} data-testid="button-gallery-prev">
                <ChevronLeft className="h-5 w-5" />
              </Button>
            )}
            {hNext && (
              <Button variant="secondary" size="icon" className="absolute right-2 top-1/2 -translate-y-1/2" onClick={doNext} data-testid="button-gallery-next">
                <ChevronRight className="h-5 w-5" />
              </Button>
            )}
            {hasSec && (
              <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-2">
                <Button variant={showPrim ? "default" : "secondary"} size="sm" onClick={() => setShowPrim(true)} data-testid="button-show-composite">Composite</Button>
                <Button variant={!showPrim ? "default" : "secondary"} size="sm" onClick={() => setShowPrim(false)} data-testid="button-show-qr">QR Only</Button>
              </div>
            )}
            <div className="absolute bottom-2 right-2 text-xs text-muted-foreground bg-background/80 px-2 py-1 rounded">
              {(selIndex ?? 0) + 1} / {items.length}
            </div>
          </div>
          <div className="p-4 border-t flex flex-col items-center">
            {selected && (
              <DetailSkin
                item={selected}
                actions={actions}
                isActionPending={isPending}
                onClose={doClose}
                onPrev={doPrev}
                onNext={doNext}
                hasPrev={hPrev}
                hasNext={hNext}
              />
            )}
          </div>
        </div>
      </ModalView>
    );
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
            <>
              <ScrollGridView
                items={croppedItems}
                columns="grid-cols-3"
                height="auto"
                emptyMessage="No items to display."
                emptyIcon={<Layers className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />}
                footer={null}
                renderItem={(item, index) => (
                  <CroppedImageCardSkin
                    item={item}
                    actions={{ onSelect: handleSelectCropped }}
                    onClick={() => setCroppedSelectedIndex(index)}
                    isSelected={selectedId === item.id}
                  />
                )}
              />
              {renderDetailModal(
                croppedItems, croppedSelectedIndex, setCroppedSelectedIndex,
                croppedShowPrimary, setCroppedShowPrimary, croppedDisplayImage,
                croppedSelected, croppedHasPrev, croppedHasNext,
                CroppedImageDetailSkin, { onSelect: handleSelectCropped }, false,
              )}
            </>
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
            <>
              <ScrollGridView
                items={backgroundItems}
                columns="grid-cols-3"
                height="auto"
                emptyMessage="No items to display."
                emptyIcon={<Layers className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />}
                footer={null}
                renderItem={(item, index) => (
                  <BackgroundCardSkin
                    item={item}
                    actions={{ onCrop: handleCrop, onDelete: handleDelete }}
                    onClick={() => setBgSelectedIndex(index)}
                  />
                )}
              />
              {renderDetailModal(
                backgroundItems, bgSelectedIndex, setBgSelectedIndex,
                bgShowPrimary, setBgShowPrimary, bgDisplayImage,
                bgSelected, bgHasPrev, bgHasNext,
                BackgroundDetailSkin, { onCrop: handleCrop, onDelete: () => setBgShowConfirm(true) }, deleting,
              )}
            </>
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

      <AlertDialog open={bgShowConfirm} onOpenChange={setBgShowConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this image?</AlertDialogTitle>
            <AlertDialogDescription>This will permanently delete this background image.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-confirm-cancel">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => { if (bgSelected) handleDelete(bgSelected.id); setBgShowConfirm(false); }}
              className="bg-destructive hover:bg-destructive/90"
              data-testid="button-confirm-action"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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
