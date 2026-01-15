import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Check, Image, Layers } from "lucide-react";
import { useProductsContext } from "../../ProductsContext";

export type PickerMode = "templates" | "backgrounds" | "cropped" | "graphics";

export interface LibraryAsset {
  id: string;
  name: string;
  url?: string;
  proxyUrl?: string;
  thumbnailUrl?: string;
  type: string;
  metadata?: Record<string, unknown>;
}

interface LibraryPickerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: PickerMode;
  onSelect: (asset: LibraryAsset) => void;
}

export function LibraryPickerDialog({ 
  open, 
  onOpenChange, 
  mode, 
  onSelect 
}: LibraryPickerDialogProps) {
  const { api } = useProductsContext();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [bgTab, setBgTab] = useState<"cropped" | "raw">("cropped");

  const assetType = mode === "backgrounds" 
    ? (bgTab === "cropped" ? "cropped" : "background")
    : mode === "cropped" 
    ? "cropped" 
    : mode === "graphics"
    ? "template"
    : "template";

  const { data: assets = [], isLoading } = useQuery<LibraryAsset[]>({
    queryKey: ["library", "picker", api.baseUrl, assetType],
    queryFn: async () => {
      const headers = await api.getAuthHeaders();
      const res = await fetch(`${api.baseUrl}/admin/background-assets?type=${assetType}`, { headers });
      if (!res.ok) throw new Error("Failed to fetch assets");
      return res.json();
    },
    enabled: open,
  });

  const handleConfirm = () => {
    const selected = assets.find(a => a.id === selectedId);
    if (selected) {
      onSelect(selected);
      onOpenChange(false);
      setSelectedId(null);
    }
  };

  const getTitle = () => {
    switch (mode) {
      case "templates": return "Select Product Template";
      case "graphics": return "Select Graphic Template";
      case "backgrounds": return "Select Background";
      case "cropped": return "Select Cropped Image";
      default: return "Select Asset";
    }
  };

  const getImageUrl = (asset: LibraryAsset): string => {
    return asset.proxyUrl || asset.thumbnailUrl || asset.url || "";
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>{getTitle()}</DialogTitle>
        </DialogHeader>

        {mode === "backgrounds" && (
          <Tabs value={bgTab} onValueChange={(v) => setBgTab(v as "cropped" | "raw")} className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="cropped" className="flex items-center gap-2">
                <Layers className="h-4 w-4" />
                Clipped
              </TabsTrigger>
              <TabsTrigger value="raw" className="flex items-center gap-2">
                <Image className="h-4 w-4" />
                Full (Raw)
              </TabsTrigger>
            </TabsList>
          </Tabs>
        )}

        <div className="flex-1 overflow-y-auto min-h-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : assets.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Image className="h-12 w-12 mb-4 opacity-50" />
              <p>No assets found</p>
              <p className="text-sm">Upload assets in the Library first</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 p-1">
              {assets.map((asset) => (
                <button
                  key={asset.id}
                  onClick={() => setSelectedId(asset.id)}
                  className={`relative aspect-square rounded-lg overflow-hidden border-2 transition-all ${
                    selectedId === asset.id 
                      ? "border-primary ring-2 ring-primary ring-offset-2" 
                      : "border-border hover:border-primary/50"
                  }`}
                  data-testid={`asset-${asset.id}`}
                >
                  <img
                    src={getImageUrl(asset)}
                    alt={asset.name}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = "/placeholder.png";
                    }}
                  />
                  {selectedId === asset.id && (
                    <div className="absolute inset-0 bg-primary/20 flex items-center justify-center">
                      <div className="bg-primary text-primary-foreground rounded-full p-1">
                        <Check className="h-4 w-4" />
                      </div>
                    </div>
                  )}
                  <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-2">
                    <p className="text-xs text-white truncate">{asset.name}</p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button 
            onClick={handleConfirm} 
            disabled={!selectedId}
            data-testid="button-confirm-selection"
          >
            Select
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
