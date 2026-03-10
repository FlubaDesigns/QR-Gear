import { useRef } from "react";
import { Type, Move, Maximize2, Upload, X, ImageIcon } from "lucide-react";
import { CollapsibleModule } from "@/features/shared/components/CollapsibleModule";
import { useBuilderContext } from "../BuilderContext";
import { TextStyleEditor, type TextStyleConfig, defaultTextStyle } from "@/features/shared/components/TextStyleEditor";
import { GraphicPreviewView } from "@/features/shared/components/skins/GraphicPreviewView";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

const headerDefaultStyle: TextStyleConfig = { ...defaultTextStyle, text: "", enabled: false };
const footerDefaultStyle: TextStyleConfig = { ...defaultTextStyle, text: "", enabled: false };

export function ProductGraphicTextModule() {
  const { state, setContent } = useBuilderContext();

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
  const adminAreaFileRef = useRef<HTMLInputElement>(null);
  const adminAreaImageUrl = state.content.areaImageUrl || '';
  const adminAreaImageMode = state.content.areaImageMode || 'behind-qr';

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
        />
        
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
        />

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
                    onClick={() => setContent({ areaImageUrl: '' })}
                    data-testid="button-admin-remove-area-image"
                  >
                    <X className="h-4 w-4 mr-1" />
                    Remove
                  </Button>
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
        
        {((state.content.headerStyle as TextStyleConfig)?.enabled || (state.content.footerStyle as TextStyleConfig)?.enabled || adminAreaImageUrl) && (
          <div className="mt-4 pt-4 border-t flex flex-col items-center">
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
            />
            <p className="text-xs text-muted-foreground mt-2 text-center">
              This is how your product graphic will appear
            </p>
          </div>
        )}
      </div>
    </CollapsibleModule>
  );
}
