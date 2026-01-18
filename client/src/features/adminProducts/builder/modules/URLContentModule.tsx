import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Image, Loader2, Check, Crop, Trash2, X, Type, FileText, Link2, RefreshCw } from "lucide-react";
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

type TabType = "backgrounds" | "cropped";

export function URLContentModule() {
  const { state, loadBackground, setContent } = useBuilderContext();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<TabType>("cropped");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [lightboxAsset, setLightboxAsset] = useState<BackgroundAsset | null>(null);
  const [cropDialogOpen, setCropDialogOpen] = useState(false);
  const [cropAsset, setCropAsset] = useState<BackgroundAsset | null>(null);

  // Play mode uses PlayContentModule for media selection, not background picker
  const needsUrlContent = state.qrProductState === "qr_canvas" || 
                          state.qrProductState === "qr_dynamics" ||
                          state.qrProductState === "qr_plus";

  // Hooks must be called unconditionally (Rules of Hooks)
  const { data: croppedBackgrounds = [], isLoading: loadingCropped } = useQuery<BackgroundAsset[]>({
    queryKey: ["/api/test/background-assets", "cropped"],
    queryFn: async () => {
      const res = await fetch("/api/test/background-assets?type=cropped");
      if (!res.ok) return [];
      return res.json();
    },
    enabled: needsUrlContent && !!state.selectedProduct,
  });

  const { data: backgrounds = [], isLoading: loadingBackgrounds } = useQuery<BackgroundAsset[]>({
    queryKey: ["/api/test/background-assets", "background"],
    queryFn: async () => {
      const res = await fetch("/api/test/background-assets?type=background");
      if (!res.ok) return [];
      return res.json();
    },
    enabled: needsUrlContent && !!state.selectedProduct && activeTab === "backgrounds",
  });

  // Early return AFTER all hooks
  if (!needsUrlContent || !state.selectedProduct) {
    return null;
  }

  const handleSelectCropped = (bg: BackgroundAsset) => {
    setSelectedId(bg.id);
    const bgUrl = bg.proxyUrl || bg.storageUrl;
    loadBackground({
      id: bg.id,
      name: bg.name,
      url: bgUrl,
    });
    if (state.qrProductState === "qr_dynamics" || state.qrProductState === "qr_plus") {
      setContent({ 
        backgroundType: "image", 
        url: bgUrl 
      });
    } else {
      setContent({ backgroundType: "image" });
    }
  };

  const handleOpenLightbox = (bg: BackgroundAsset) => {
    setLightboxAsset(bg);
  };

  const handleCloseLightbox = () => {
    setLightboxAsset(null);
  };

  const handleCropFromLightbox = () => {
    if (lightboxAsset) {
      setCropAsset(lightboxAsset);
      setCropDialogOpen(true);
      setLightboxAsset(null);
    }
  };

  const handleDeleteFromLightbox = async () => {
    if (!lightboxAsset) return;
    
    if (!confirm(`Delete "${lightboxAsset.name}"?`)) return;
    
    try {
      const res = await fetch(`/api/test/background-assets/${lightboxAsset.id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        queryClient.invalidateQueries({ queryKey: ["/api/test/background-assets"] });
        setLightboxAsset(null);
      }
    } catch (error) {
      console.error("Delete failed:", error);
    }
  };

  const handleCropComplete = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/test/background-assets", "cropped"] });
    setActiveTab("cropped");
  };

  const handleClearBackground = () => {
    setSelectedId(null);
    loadBackground(null);
    if (state.qrProductState === "qr_dynamics" || state.qrProductState === "qr_plus") {
      setContent({ backgroundType: undefined, url: "" });
    } else {
      setContent({ backgroundType: undefined });
    }
  };

  const backgroundUrl = state.loadedBackground?.url;
  const hasContent = state.content.title || state.content.description || backgroundUrl;
  
  const needsDestinationUrl = state.qrProductState === "qr_canvas";

  return (
    <CollapsibleModule
      title="URL Content"
      icon={<FileText className="h-4 w-4" />}
      className="bg-muted/30"
      defaultOpen
    >
      <div className="space-y-6">
        {/* Section 1: Background Picker */}
        <div className="space-y-3">
          <p className="text-sm font-medium">Background Image</p>
          
          {/* Tabs */}
          <div className="flex gap-2">
            <Button
              type="button"
              variant={activeTab === "cropped" ? "default" : "outline"}
              size="default"
              onClick={() => setActiveTab("cropped")}
              className="flex-1 min-h-[44px]"
              data-testid="tab-cropped-backgrounds"
            >
              Cropped Backgrounds
            </Button>
            <Button
              type="button"
              variant={activeTab === "backgrounds" ? "default" : "outline"}
              size="default"
              onClick={() => setActiveTab("backgrounds")}
              className="flex-1 min-h-[44px]"
              data-testid="tab-background-images"
            >
              Background Images
            </Button>
          </div>

          {/* Cropped Backgrounds Tab - Select Only */}
          {activeTab === "cropped" && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Select a ready-to-use cropped background
              </p>
              
              {loadingCropped ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin" data-testid="loader-cropped" />
                </div>
              ) : croppedBackgrounds.length === 0 ? (
                <div className="text-center py-6 border rounded-md bg-muted/20">
                  <Image className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm text-muted-foreground">
                    No cropped backgrounds yet. Crop one from Background Images.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-2">
                  {croppedBackgrounds.map((bg) => {
                    const isSelected = selectedId === bg.id || state.loadedBackground?.id === bg.id;
                    return (
                      <button
                        key={bg.id}
                        type="button"
                        onClick={() => handleSelectCropped(bg)}
                        className={`relative aspect-[9/16] rounded-md overflow-hidden border-2 transition-all ${
                          isSelected ? "border-primary ring-2 ring-primary/30" : "border-border hover:border-primary/50"
                        }`}
                        data-testid={`button-select-cropped-${bg.id}`}
                      >
                        <img
                          src={bg.thumbnailUrl || bg.proxyUrl || bg.storageUrl}
                          alt={bg.name}
                          className="w-full h-full object-cover"
                        />
                        {isSelected && (
                          <div className="absolute inset-0 bg-primary/20 flex items-center justify-center">
                            <Check className="h-6 w-6 text-primary" />
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Background Images Tab - Lightbox with Crop/Delete */}
          {activeTab === "backgrounds" && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Click an image to view, crop, or delete
              </p>
              
              {loadingBackgrounds ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin" data-testid="loader-backgrounds" />
                </div>
              ) : backgrounds.length === 0 ? (
                <div className="text-center py-6 border rounded-md bg-muted/20">
                  <Image className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm text-muted-foreground">
                    No background images found. Upload in Library.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-2">
                  {backgrounds.map((bg) => (
                    <button
                      key={bg.id}
                      type="button"
                      onClick={() => handleOpenLightbox(bg)}
                      className="relative aspect-square rounded-md overflow-hidden border border-border hover:border-primary/50 transition-all"
                      data-testid={`button-open-lightbox-${bg.id}`}
                    >
                      <img
                        src={bg.thumbnailUrl || bg.proxyUrl || bg.storageUrl}
                        alt={bg.name}
                        className="w-full h-full object-cover"
                      />
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Current Background Preview */}
          {state.loadedBackground && (
            <div className="p-3 bg-primary/5 rounded-md border space-y-2">
              <div className="flex items-start gap-3">
                <div className="w-12 h-16 rounded overflow-hidden border flex-shrink-0">
                  <img
                    src={state.loadedBackground.url}
                    alt={state.loadedBackground.name}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">Background Selected</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {state.loadedBackground.name}
                  </p>
                </div>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleClearBackground}
                className="w-full"
                data-testid="button-clear-background"
              >
                <RefreshCw className="h-3.5 w-3.5 mr-2" />
                Change Background
              </Button>
            </div>
          )}
        </div>

        {/* Section 2: Destination URL (for Canvas/Play modes) */}
        {needsDestinationUrl && (
          <div className="space-y-2 pt-4 border-t">
            <Label htmlFor="destination-url" className="flex items-center gap-2">
              <Link2 className="h-3.5 w-3.5" />
              Destination URL
            </Label>
            <Input
              id="destination-url"
              type="text"
              inputMode="url"
              autoCorrect="off"
              spellCheck={false}
              placeholder="https://example.com"
              value={state.content.url || ""}
              onChange={(e) => setContent({ url: e.target.value })}
              className="min-h-[44px]"
              data-testid="input-destination-url"
            />
            <p className="text-xs text-muted-foreground">
              Where users go when they scan the QR code
            </p>
          </div>
        )}

        {/* Section 3: Title & Description */}
        <div className="space-y-4 pt-4 border-t">
          <p className="text-sm font-medium">Landing Page Content</p>
          
          <div className="space-y-2">
            <Label htmlFor="url-content-title" className="flex items-center gap-2">
              <Type className="h-3.5 w-3.5" />
              Title
            </Label>
            <Input
              id="url-content-title"
              placeholder="Enter title for the landing page"
              value={state.content.title}
              onChange={(e) => setContent({ title: e.target.value })}
              maxLength={50}
              className="min-h-[44px]"
              data-testid="input-url-content-title"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="url-content-description">Description</Label>
            <textarea
              id="url-content-description"
              placeholder="Enter description text"
              value={state.content.description}
              onChange={(e) => setContent({ description: e.target.value })}
              maxLength={200}
              rows={3}
              className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              data-testid="input-url-content-description"
            />
          </div>
        </div>

        {/* Section 3: Landing Page Viewer */}
        {hasContent && (
          <div className="space-y-3 pt-4 border-t">
            <p className="text-sm font-medium">Landing Page Preview</p>
            <div className="flex justify-center">
              <div 
                className="relative w-[180px] aspect-[9/16] rounded-lg overflow-hidden border-2 border-border shadow-lg"
                style={{
                  background: backgroundUrl 
                    ? `url(${backgroundUrl}) center/cover` 
                    : 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
                }}
              >
                {/* Dark overlay for text readability */}
                <div className="absolute inset-0 bg-black/30" />
                
                {/* Header text - styled like graphic with position */}
                {state.content.headerStyle?.enabled && state.content.headerStyle.text && (
                  <div 
                    className="absolute left-0 right-0 px-2 z-10"
                    style={{
                      top: `${Math.max(2, 40 - (state.content.headerStyle.verticalOffset ?? 20) * 0.38)}%`,
                      transform: `translateX(${(state.content.headerStyle.horizontalOffset ?? 0) * 0.5}%)`,
                      textAlign: 'center',
                    }}
                  >
                    <span 
                      style={{ 
                        fontFamily: state.content.headerStyle.fontFamily, 
                        fontSize: `${Math.max(8, Math.min(parseInt(state.content.headerStyle.fontSize) * 0.06, 14))}px`,
                        color: state.content.headerStyle.color,
                        letterSpacing: `${state.content.headerStyle.letterSpacing * 0.02}px`,
                        textShadow: state.content.headerStyle.strokeColor && state.content.headerStyle.strokeWidth > 0 
                          ? `0 0 ${Math.max(1, state.content.headerStyle.strokeWidth * 0.15)}px ${state.content.headerStyle.strokeColor}` 
                          : "0 1px 3px rgba(0,0,0,0.7)",
                        fontWeight: 'bold',
                        whiteSpace: 'nowrap',
                        display: 'inline-block',
                        maxWidth: '100%',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {state.content.headerStyle.text}
                    </span>
                  </div>
                )}

                {/* Footer text - styled like graphic with position */}
                {state.content.footerStyle?.enabled && state.content.footerStyle.text && (
                  <div 
                    className="absolute left-0 right-0 px-2 z-10"
                    style={{
                      bottom: `${Math.max(2, 40 - (state.content.footerStyle.verticalOffset ?? 20) * 0.38)}%`,
                      transform: `translateX(${(state.content.footerStyle.horizontalOffset ?? 0) * 0.5}%)`,
                      textAlign: 'center',
                    }}
                  >
                    <span 
                      style={{ 
                        fontFamily: state.content.footerStyle.fontFamily, 
                        fontSize: `${Math.max(8, Math.min(parseInt(state.content.footerStyle.fontSize) * 0.06, 14))}px`,
                        color: state.content.footerStyle.color,
                        letterSpacing: `${state.content.footerStyle.letterSpacing * 0.02}px`,
                        textShadow: state.content.footerStyle.strokeColor && state.content.footerStyle.strokeWidth > 0 
                          ? `0 0 ${Math.max(1, state.content.footerStyle.strokeWidth * 0.15)}px ${state.content.footerStyle.strokeColor}` 
                          : "0 1px 3px rgba(0,0,0,0.7)",
                        fontWeight: 'bold',
                        whiteSpace: 'nowrap',
                        display: 'inline-block',
                        maxWidth: '100%',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {state.content.footerStyle.text}
                    </span>
                  </div>
                )}
                
                {/* Content overlay - Title & Description */}
                <div className="absolute inset-0 flex flex-col justify-end p-3">
                  {state.content.title && (
                    <h3 className="text-white text-sm font-bold mb-1 drop-shadow-lg">
                      {state.content.title}
                    </h3>
                  )}
                  {state.content.description && (
                    <p className="text-white/90 text-xs leading-tight drop-shadow-md line-clamp-3">
                      {state.content.description}
                    </p>
                  )}
                </div>

                {/* Placeholder when no background */}
                {!backgroundUrl && (
                  <div className="absolute top-1/3 left-0 right-0 text-center">
                    <Image className="h-8 w-8 mx-auto text-white/30 mb-2" />
                    <p className="text-white/50 text-xs">No background selected</p>
                  </div>
                )}
              </div>
            </div>
            <p className="text-xs text-center text-muted-foreground">
              This is how your landing page will appear when the QR is scanned
            </p>
          </div>
        )}
      </div>

      {/* Lightbox Modal */}
      {lightboxAsset && (
        <div 
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
          onClick={handleCloseLightbox}
        >
          <div 
            className="relative bg-background rounded-lg max-w-2xl w-full max-h-[90vh] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close button */}
            <button
              type="button"
              onClick={handleCloseLightbox}
              className="absolute top-2 right-2 z-10 bg-black/50 hover:bg-black/70 text-white h-10 w-10 rounded-full flex items-center justify-center"
              data-testid="button-close-lightbox"
            >
              <X className="h-5 w-5" />
            </button>

            {/* Image */}
            <div className="aspect-video bg-muted flex items-center justify-center">
              <img
                src={lightboxAsset.proxyUrl || lightboxAsset.storageUrl}
                alt={lightboxAsset.name}
                className="max-h-full max-w-full object-contain"
              />
            </div>

            {/* Info and actions */}
            <div className="p-4 space-y-3">
              <p className="font-medium truncate">{lightboxAsset.name}</p>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="default"
                  size="default"
                  onClick={handleCropFromLightbox}
                  className="flex-1 min-h-[44px]"
                  data-testid="button-lightbox-crop"
                >
                  <Crop className="h-4 w-4 mr-2" />
                  Crop (9:16)
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  size="default"
                  onClick={handleDeleteFromLightbox}
                  className="min-h-[44px]"
                  data-testid="button-lightbox-delete"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Crop Dialog */}
      <ProductCropDialog
        asset={cropAsset}
        open={cropDialogOpen}
        onOpenChange={setCropDialogOpen}
        onCropComplete={handleCropComplete}
      />
    </CollapsibleModule>
  );
}
