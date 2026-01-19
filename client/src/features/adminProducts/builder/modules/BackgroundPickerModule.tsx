import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Image, Loader2, Check, Crop, ImagePlus, ChevronLeft, ChevronRight, Video, Link2, Upload } from "lucide-react";
import { CollapsibleModule } from "@/features/shared/components/CollapsibleModule";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
type VideoInputType = "url" | "upload";

function ImagePicker() {
  const { state, loadBackground, setContent } = useBuilderContext();
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>("cropped");
  const [cropAsset, setCropAsset] = useState<BackgroundAsset | null>(null);
  const [cropDialogOpen, setCropDialogOpen] = useState(false);
  const [viewerIndex, setViewerIndex] = useState(0);
  
  useEffect(() => {
    setViewerIndex(0);
  }, [activeTab]);

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
  
  const safeViewerIndex = sourceBackgrounds.length > 0 
    ? Math.min(viewerIndex, sourceBackgrounds.length - 1) 
    : 0;

  const handleSelectCropped = (bg: BackgroundAsset) => {
    setSelectedId(bg.id);
    const bgUrl = bg.proxyUrl || bg.storageUrl;
    
    loadBackground({
      id: bg.id,
      name: bg.name,
      url: bgUrl,
    });
    
    setContent({ 
      backgroundType: "image", 
      videoUrl: "",
      ...(state.qrProductState === "qr_dynamics" ? { url: bgUrl } : {})
    });
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

  const currentSourceImage = sourceBackgrounds[safeViewerIndex];

  return (
    <>
      <div className="space-y-3">
        <div className="flex gap-2">
          <Button
            type="button"
            variant={activeTab === "cropped" ? "default" : "outline"}
            size="default"
            onClick={() => setActiveTab("cropped")}
            className="flex-1 min-h-[48px]"
            data-testid="tab-cropped"
          >
            <Check className="h-4 w-4 mr-2" />
            Cropped
          </Button>
          <Button
            type="button"
            variant={activeTab === "background" ? "default" : "outline"}
            size="default"
            onClick={() => setActiveTab("background")}
            className="flex-1 min-h-[48px]"
            data-testid="tab-background"
          >
            <Image className="h-4 w-4 mr-2" />
            Source
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
                  No cropped backgrounds. Use Source tab to crop.
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
                  No source images found. Upload in Library first.
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
                      {safeViewerIndex + 1} of {sourceBackgrounds.length}
                    </p>
                  </div>

                  <button
                    type="button"
                    className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white min-h-[48px] min-w-[48px] h-12 w-12 rounded-md flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    onClick={() => setViewerIndex(Math.max(0, safeViewerIndex - 1))}
                    disabled={safeViewerIndex === 0}
                    data-testid="button-prev-source"
                  >
                    <ChevronLeft className="h-6 w-6" />
                  </button>

                  <button
                    type="button"
                    className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white min-h-[48px] min-w-[48px] h-12 w-12 rounded-md flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    onClick={() => setViewerIndex(Math.min(sourceBackgrounds.length - 1, safeViewerIndex + 1))}
                    disabled={safeViewerIndex >= sourceBackgrounds.length - 1}
                    data-testid="button-next-source"
                  >
                    <ChevronRight className="h-6 w-6" />
                  </button>
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

      <ProductCropDialog
        asset={cropAsset}
        open={cropDialogOpen}
        onOpenChange={setCropDialogOpen}
        onCropComplete={handleCropComplete}
      />
    </>
  );
}

function VideoPicker() {
  const { state, setContent } = useBuilderContext();
  const [inputType, setInputType] = useState<VideoInputType>("url");
  const [isUploading, setIsUploading] = useState(false);

  const handleUrlChange = (url: string) => {
    setContent({ videoUrl: url, backgroundType: "video" });
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("video/")) {
      return;
    }

    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("type", "video");

      const response = await fetch("/api/test/upload-media", {
        method: "POST",
        body: formData,
      });

      if (response.ok) {
        const data = await response.json();
        setContent({ videoUrl: data.url, backgroundType: "video" });
      }
    } catch (error) {
      console.error("Upload failed:", error);
    } finally {
      setIsUploading(false);
    }
  };

  const videoUrl = state.content?.videoUrl || "";
  const isValidUrl = videoUrl && (videoUrl.startsWith("http") || videoUrl.startsWith("/"));

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Button
          type="button"
          variant={inputType === "url" ? "default" : "outline"}
          size="default"
          onClick={() => setInputType("url")}
          className="flex-1 min-h-[48px]"
          data-testid="tab-video-url"
        >
          <Link2 className="h-4 w-4 mr-2" />
          Paste URL
        </Button>
        <Button
          type="button"
          variant={inputType === "upload" ? "default" : "outline"}
          size="default"
          onClick={() => setInputType("upload")}
          className="flex-1 min-h-[48px]"
          data-testid="tab-video-upload"
        >
          <Upload className="h-4 w-4 mr-2" />
          Upload
        </Button>
      </div>

      {inputType === "url" ? (
        <div className="space-y-2">
          <Label htmlFor="video-url" className="text-sm text-muted-foreground">
            Enter video URL (YouTube, Vimeo, or direct MP4 link)
          </Label>
          <Input
            id="video-url"
            placeholder="https://youtube.com/watch?v=... or https://example.com/video.mp4"
            value={videoUrl}
            onChange={(e) => handleUrlChange(e.target.value)}
            inputMode="text"
            className="min-h-[48px] text-base"
            data-testid="input-video-url"
          />
        </div>
      ) : (
        <div className="space-y-2">
          <Label className="text-sm text-muted-foreground">
            Upload a video file (MP4, WebM, MOV)
          </Label>
          <div className="border-2 border-dashed rounded-md p-6 text-center hover:border-primary/50 transition-colors">
            <input
              type="file"
              accept="video/*"
              onChange={handleFileUpload}
              className="hidden"
              id="video-upload"
              disabled={isUploading}
            />
            <label 
              htmlFor="video-upload" 
              className="cursor-pointer flex flex-col items-center gap-2"
            >
              {isUploading ? (
                <>
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  <span className="text-sm text-muted-foreground">Uploading...</span>
                </>
              ) : (
                <>
                  <Video className="h-8 w-8 text-muted-foreground" />
                  <span className="text-sm font-medium">Click to upload video</span>
                  <span className="text-xs text-muted-foreground">Max 100MB</span>
                </>
              )}
            </label>
          </div>
        </div>
      )}

      {isValidUrl && (
        <div className="p-3 bg-primary/5 rounded-md border">
          <p className="text-sm font-medium">Video Ready</p>
          <p className="text-xs text-muted-foreground truncate">{videoUrl}</p>
        </div>
      )}
    </div>
  );
}

export function BackgroundPickerModule() {
  const { state } = useBuilderContext();

  const isCanvasOrDynamics = state.qrProductState === "qr_canvas" || state.qrProductState === "qr_dynamics";
  const isPlayMode = state.qrProductState === "qr_play";

  if (!state.selectedProduct || (!isCanvasOrDynamics && !isPlayMode)) {
    return null;
  }

  if (isPlayMode) {
    return (
      <CollapsibleModule
        title="Video"
        icon={<Video className="h-4 w-4" />}
        className="bg-muted/30"
        defaultOpen
      >
        <p className="text-sm text-muted-foreground mb-3">
          Add a video that plays on the QR landing page.
        </p>
        <VideoPicker />
      </CollapsibleModule>
    );
  }

  return (
    <CollapsibleModule
      title="Background"
      icon={<Image className="h-4 w-4" />}
      className="bg-muted/30"
      defaultOpen
    >
      <ImagePicker />
    </CollapsibleModule>
  );
}
