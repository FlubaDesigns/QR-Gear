import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Image, Loader2, Check, Crop, ImagePlus, ChevronLeft, ChevronRight } from "lucide-react";
import { CollapsibleModule } from "@/features/shared/components/CollapsibleModule";
import { Button } from "@/components/ui/button";
import { useBuilderContext } from "../BuilderContext";
import { ProductCropDialog } from "../components/ProductCropDialog";

interface BackgroundAsset {
  id: string;
  name: string;
  storageUrl: string;
  proxyUrl?: string;
  thumbnailUrl?: string;
}

type TabType = "cropped" | "background";

export function BackgroundPickerModule() {
  const { state, loadBackground, setContent } = useBuilderContext();
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>("cropped");
  const [cropAsset, setCropAsset] = useState<BackgroundAsset | null>(null);
  const [cropDialogOpen, setCropDialogOpen] = useState(false);
  const [viewerIndex, setViewerIndex] = useState(0);

  const { data: croppedBackgrounds = [], isLoading: loadingCropped } = useQuery<BackgroundAsset[]>({
    queryKey: ["/api/test/background-assets", "cropped"],
    queryFn: async () => {
      const res = await fetch("/api/test/background-assets?type=cropped");
      if (!res.ok) throw new Error("Failed to fetch backgrounds");
      return res.json();
    },
  });

  const { data: sourceBackgrounds = [], isLoading: loadingSource } = useQuery<BackgroundAsset[]>({
    queryKey: ["/api/test/background-assets", "background"],
    queryFn: async () => {
      const res = await fetch("/api/test/background-assets?type=background");
      if (!res.ok) throw new Error("Failed to fetch source images");
      return res.json();
    },
    enabled: activeTab === "background",
  });

  const handleSelectCropped = (bg: BackgroundAsset) => {
    setSelectedId(bg.id);
    const bgUrl = bg.proxyUrl || bg.storageUrl;
    
    loadBackground({
      id: bg.id,
      name: bg.name,
      url: bgUrl,
    });
    
    if (state.qrProductState === "qr_dynamics") {
      setContent({ url: bgUrl });
    }
  };

  const handleCropSource = (bg: BackgroundAsset) => {
    setCropAsset(bg);
    setCropDialogOpen(true);
  };

  const handleCropComplete = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/test/background-assets", "cropped"] });
    queryClient.invalidateQueries({ queryKey: ["/api/test/background-assets", "background"] });
    setCropDialogOpen(false);
    setCropAsset(null);
    setActiveTab("cropped");
  };

  const showForModes = ["qr_canvas", "qr_dynamics"];
  if (!state.qrProductState || !state.selectedProduct || !showForModes.includes(state.qrProductState)) {
    return null;
  }

  const currentSourceImage = sourceBackgrounds[viewerIndex];

  return (
    <>
      <CollapsibleModule
        title="Background"
        icon={<Image className="h-4 w-4" />}
        className="bg-muted/30"
        defaultOpen
      >
        <div className="space-y-3">
          <div className="flex gap-2">
            <Button
              type="button"
              variant={activeTab === "cropped" ? "default" : "outline"}
              size="default"
              onClick={() => setActiveTab("cropped")}
              className="flex-1"
              data-testid="tab-cropped"
            >
              <Check className="h-4 w-4 mr-2" />
              Cropped Background
            </Button>
            <Button
              type="button"
              variant={activeTab === "background" ? "default" : "outline"}
              size="default"
              onClick={() => setActiveTab("background")}
              className="flex-1"
              data-testid="tab-background"
            >
              <Image className="h-4 w-4 mr-2" />
              Background
            </Button>
          </div>

          {activeTab === "cropped" ? (
            <>
              <p className="text-sm text-muted-foreground">
                Select a cropped background for your QR product
              </p>

              {loadingCropped ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin" data-testid="loader-backgrounds" />
                </div>
              ) : croppedBackgrounds.length === 0 ? (
                <div className="text-center py-6 border rounded-md bg-muted/20">
                  <ImagePlus className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm text-muted-foreground" data-testid="text-no-cropped">
                    No cropped backgrounds found. Use the Background tab to crop images.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-2">
                  {croppedBackgrounds.map((bg) => {
                    const isSelected = selectedId === bg.id || state.loadedBackground?.id === bg.id;
                    const imageUrl = bg.thumbnailUrl || bg.proxyUrl || bg.storageUrl;
                    
                    return (
                      <button
                        key={bg.id}
                        type="button"
                        onClick={() => handleSelectCropped(bg)}
                        className={`relative aspect-[9/16] rounded-md overflow-hidden border-2 transition-all min-h-[96px] ${
                          isSelected 
                            ? "border-primary ring-2 ring-primary/30" 
                            : "border-transparent hover:border-primary/50"
                        }`}
                        data-testid={`button-cropped-${bg.id}`}
                      >
                        <img
                          src={imageUrl}
                          alt={bg.name}
                          className="w-full h-full object-cover"
                          loading="lazy"
                        />
                        {isSelected && (
                          <div className="absolute inset-0 bg-primary/20 flex items-center justify-center">
                            <div className="bg-primary text-primary-foreground rounded-full p-1">
                              <Check className="h-4 w-4" />
                            </div>
                          </div>
                        )}
                        <div className="absolute bottom-0 left-0 right-0 bg-black/60 px-1 py-0.5">
                          <p className="text-xs text-white truncate">{bg.name}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}

              {state.loadedBackground && (
                <div className="p-3 bg-primary/5 rounded-md border">
                  <p className="text-sm font-medium">Background Selected</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {state.loadedBackground.name}
                  </p>
                </div>
              )}
            </>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">
                Browse source images and crop to 9:16 ratio
              </p>

              {loadingSource ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin" data-testid="loader-source" />
                </div>
              ) : sourceBackgrounds.length === 0 ? (
                <div className="text-center py-6 border rounded-md bg-muted/20">
                  <ImagePlus className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm text-muted-foreground" data-testid="text-no-source">
                    No source images found. Upload images in the Library first.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="relative border rounded-md bg-muted/20 overflow-hidden">
                    <div className="aspect-video flex items-center justify-center p-4">
                      <img
                        src={currentSourceImage?.proxyUrl || currentSourceImage?.storageUrl}
                        alt={currentSourceImage?.name || "Source image"}
                        className="max-h-full max-w-full object-contain rounded"
                        data-testid="viewer-source-image"
                      />
                    </div>
                    
                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-3">
                      <p className="text-white text-sm font-medium truncate">
                        {currentSourceImage?.name}
                      </p>
                      <p className="text-white/70 text-xs">
                        {viewerIndex + 1} of {sourceBackgrounds.length}
                      </p>
                    </div>

                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white h-12 w-12"
                      onClick={() => setViewerIndex(Math.max(0, viewerIndex - 1))}
                      disabled={viewerIndex === 0}
                      data-testid="button-prev-source"
                    >
                      <ChevronLeft className="h-6 w-6" />
                    </Button>

                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white h-12 w-12"
                      onClick={() => setViewerIndex(Math.min(sourceBackgrounds.length - 1, viewerIndex + 1))}
                      disabled={viewerIndex >= sourceBackgrounds.length - 1}
                      data-testid="button-next-source"
                    >
                      <ChevronRight className="h-6 w-6" />
                    </Button>
                  </div>

                  <Button
                    type="button"
                    variant="default"
                    size="default"
                    className="w-full min-h-[48px]"
                    onClick={() => currentSourceImage && handleCropSource(currentSourceImage)}
                    disabled={!currentSourceImage}
                    data-testid="button-crop-source"
                  >
                    <Crop className="h-5 w-5 mr-2" />
                    Crop This Image (9:16)
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      </CollapsibleModule>

      <ProductCropDialog
        asset={cropAsset}
        open={cropDialogOpen}
        onOpenChange={setCropDialogOpen}
        onCropComplete={handleCropComplete}
      />
    </>
  );
}
