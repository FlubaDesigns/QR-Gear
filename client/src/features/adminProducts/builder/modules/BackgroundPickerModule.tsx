import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Image, Loader2, Check } from "lucide-react";
import { CollapsibleModule } from "@/features/shared/components/CollapsibleModule";
import { useBuilderContext } from "../BuilderContext";

interface CroppedBackground {
  id: string;
  name: string;
  storageUrl: string;
  proxyUrl?: string;
  thumbnailUrl?: string;
}

export function BackgroundPickerModule() {
  const { state, loadBackground } = useBuilderContext();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const { data: backgrounds = [], isLoading } = useQuery<CroppedBackground[]>({
    queryKey: ["/api/test/background-assets", "cropped"],
    queryFn: async () => {
      const res = await fetch("/api/test/background-assets?type=cropped");
      if (!res.ok) throw new Error("Failed to fetch backgrounds");
      return res.json();
    },
  });

  const handleSelect = (bg: CroppedBackground) => {
    setSelectedId(bg.id);
    loadBackground({
      id: bg.id,
      name: bg.name,
      url: bg.proxyUrl || bg.storageUrl,
    });
  };

  if (!state.qrProductState || !state.selectedProduct) {
    return null;
  }

  return (
    <CollapsibleModule
      title="Background"
      icon={<Image className="h-4 w-4" />}
      className="bg-muted/30"
      defaultOpen
    >
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">
          Select a cropped background for your QR product
        </p>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin" data-testid="loader-backgrounds" />
          </div>
        ) : backgrounds.length === 0 ? (
          <div className="text-center py-6 border rounded-md bg-muted/20">
            <p className="text-sm text-muted-foreground" data-testid="text-no-backgrounds">
              No cropped backgrounds found. Upload and crop images in the Library first.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-2">
            {backgrounds.map((bg) => {
              const isSelected = selectedId === bg.id || state.loadedBackground?.id === bg.id;
              const imageUrl = bg.thumbnailUrl || bg.proxyUrl || bg.storageUrl;
              
              return (
                <button
                  key={bg.id}
                  type="button"
                  onClick={() => handleSelect(bg)}
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
  );
}
