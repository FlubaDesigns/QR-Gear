import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Image, Loader2, Check, Crop, ImagePlus } from "lucide-react";
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

type TabType = "cropped" | "source";

export function BackgroundPickerModule() {
  const { state, loadBackground, setContent } = useBuilderContext();
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>("cropped");
  const [cropAsset, setCropAsset] = useState<BackgroundAsset | null>(null);
  const [cropDialogOpen, setCropDialogOpen] = useState(false);

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
    enabled: activeTab === "source",
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

  if (!state.qrProductState || !state.selectedProduct || state.qrProductState !== "qr_dynamics") {
    return null;
  }

  const isLoading = activeTab === "cropped" ? loadingCropped : loadingSource;
  const backgrounds = activeTab === "cropped" ? croppedBackgrounds : sourceBackgrounds;

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
              Ready to Use
            </Button>
            <Button
              type="button"
              variant={activeTab === "source" ? "default" : "outline"}
              size="default"
              onClick={() => setActiveTab("source")}
              className="flex-1"
              data-testid="tab-source"
            >
              <Crop className="h-4 w-4 mr-2" />
              Crop New
            </Button>
          </div>

          <p className="text-sm text-muted-foreground">
            {activeTab === "cropped" 
              ? "Select a cropped background for your QR product"
              : "Select a source image to crop (9:16 ratio)"}
          </p>

          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin" data-testid="loader-backgrounds" />
            </div>
          ) : backgrounds.length === 0 ? (
            <div className="text-center py-6 border rounded-md bg-muted/20">
              <ImagePlus className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm text-muted-foreground" data-testid="text-no-backgrounds">
                {activeTab === "cropped" 
                  ? "No cropped backgrounds found. Upload and crop images in the Library first."
                  : "No source images found. Upload images in the Library."}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-2">
              {backgrounds.map((bg) => {
                const isSelected = activeTab === "cropped" && (selectedId === bg.id || state.loadedBackground?.id === bg.id);
                const imageUrl = bg.thumbnailUrl || bg.proxyUrl || bg.storageUrl;
                
                return (
                  <button
                    key={bg.id}
                    type="button"
                    onClick={() => activeTab === "cropped" ? handleSelectCropped(bg) : handleCropSource(bg)}
                    className={`relative aspect-[9/16] rounded-md overflow-hidden border-2 transition-all min-h-[96px] ${
                      isSelected 
                        ? "border-primary ring-2 ring-primary/30" 
                        : "border-transparent hover:border-primary/50"
                    }`}
                    data-testid={`button-background-${bg.id}`}
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
                    {activeTab === "source" && (
                      <div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                        <div className="bg-primary text-primary-foreground rounded-full p-2">
                          <Crop className="h-5 w-5" />
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
