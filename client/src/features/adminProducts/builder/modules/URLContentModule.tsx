import { FileText, Plus, Trash2 } from "lucide-react";
import { CollapsibleModule } from "@/features/shared/components/CollapsibleModule";
import { Button } from "@/components/ui/button";
import { useBuilderContext } from "../BuilderContext";
import { GRFImagePicker, type SelectedBackground } from "@/features/shared/components/GRFImagePicker";
import { TextStyleEditor, type TextStyleConfig, defaultTextStyle } from "@/features/shared/components/TextStyleEditor";
import { LandingPageViewer } from "@/features/shared/components/LandingPageViewer";

const DEFAULT_BLOCK: TextStyleConfig = {
  ...defaultTextStyle,
  enabled: true,
  verticalOffset: 80,
  horizontalOffset: 50,
};

export function URLContentModule() {
  const { state, loadBackground, setContent } = useBuilderContext();

  const needsUrlContent = state.qrProductState === "qr_canvas";

  if (!needsUrlContent || !state.selectedProduct || !state.content) {
    return null;
  }

  const blocks: TextStyleConfig[] = (state.content.landingTextBlocks as TextStyleConfig[]) || [];

  const handleSelectBackground = (background: SelectedBackground) => {
    loadBackground({
      id: background.id,
      name: background.name,
      url: background.url,
    });
    setContent({ backgroundType: "image" });
  };

  const handleClearBackground = () => {
    loadBackground(null);
    setContent({ backgroundType: undefined });
  };

  const addBlock = () => {
    const newBlock: TextStyleConfig = {
      ...DEFAULT_BLOCK,
      verticalOffset: Math.max(10, 80 - blocks.length * 15),
    };
    setContent({ landingTextBlocks: [...blocks, newBlock] });
  };

  const removeBlock = (index: number) => {
    setContent({ landingTextBlocks: blocks.filter((_, i) => i !== index) });
  };

  const updateBlock = (index: number, updates: Partial<TextStyleConfig>) => {
    const updated = blocks.map((b, i) =>
      i === index ? { ...b, ...updates } : b
    );
    setContent({ landingTextBlocks: updated });
  };

  const backgroundUrl = state.loadedBackground?.url;
  const hasPreview = !!(backgroundUrl || blocks.some((b) => b.enabled && b.text));

  return (
    <CollapsibleModule
      title="URL Settings"
      icon={<FileText className="h-4 w-4" />}
      className="bg-muted/30"
      defaultOpen
    >
      <div className="space-y-3 sm:space-y-6">
        <div className="space-y-3 sm:space-y-4">
          <p className="text-sm font-medium">Landing Page Content</p>
          <p className="text-xs text-muted-foreground">
            Configure the landing page background and text blocks
          </p>

          <GRFImagePicker
            selectedId={state.loadedBackground?.id}
            onSelect={handleSelectBackground}
            onClear={handleClearBackground}
            currentBackground={state.loadedBackground}
            enabled={!!state.selectedProduct}
          />

          <div className="space-y-2">
            {blocks.map((block, index) => (
              <div key={index} className="relative">
                <TextStyleEditor
                  label={`Text Block ${index + 1}`}
                  sublabel="Landing page text"
                  maxLength={200}
                  style={block}
                  onChange={(updates) => updateBlock(index, updates)}
                  testIdPrefix={`landing-block-${index}`}
                  showPositionControls={true}
                  showPreview={false}
                  defaultCollapsed={false}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => removeBlock(index)}
                  className="absolute top-2 right-12 h-8 w-8 text-muted-foreground hover:text-destructive"
                  data-testid={`button-remove-block-${index}`}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}

            {blocks.length === 0 && (
              <div className="border-2 border-dashed rounded-md p-4 text-center">
                <p className="text-sm text-muted-foreground">
                  No text blocks yet. Add one to display text on your landing page.
                </p>
              </div>
            )}

            <Button
              type="button"
              variant="outline"
              onClick={addBlock}
              className="w-full"
              data-testid="button-add-text-block"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Text Block
            </Button>
          </div>
        </div>

        {hasPreview && (
          <div className="space-y-3 pt-4 border-t">
            <p className="text-sm font-medium">Landing Page Preview</p>
            <LandingPageViewer
              textBlocks={blocks}
              backgroundImage={backgroundUrl}
              caption="This is how your landing page will appear when the QR is scanned"
            />
          </div>
        )}
      </div>
    </CollapsibleModule>
  );
}
