import { useState } from "react";
import { FileText } from "lucide-react";
import { CollapsibleModule } from "@/features/shared/components/CollapsibleModule";
import { useBuilderContext } from "../BuilderContext";
import { useAdminAuth } from "@/features/shared/AdminAuthContext";
import { LibraryBackgroundPicker, type SelectedBackground } from "@/features/shared/components/LibraryBackgroundPicker";
import { TextStyleEditor, type TextStyleConfig, defaultTextStyle } from "@/features/shared/components/TextStyleEditor";
import { LandingPageViewer } from "@/features/shared/components/LandingPageViewer";

export function URLContentModule() {
  const { state, loadBackground, setContent } = useBuilderContext();
  const { apiBase } = useAdminAuth();

  const needsUrlContent = state.qrProductState === "qr_canvas";

  if (!needsUrlContent || !state.selectedProduct || !state.content) {
    return null;
  }

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

  const backgroundUrl = state.loadedBackground?.url;

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
            Configure the landing page background and text
          </p>

          <LibraryBackgroundPicker
            apiBase={apiBase}
            selectedId={state.loadedBackground?.id}
            onSelect={handleSelectBackground}
            onClear={handleClearBackground}
            currentBackground={state.loadedBackground}
            enabled={!!state.selectedProduct}
          />
          
          <TextStyleEditor
            label="URL Title"
            sublabel="Main heading on landing page"
            maxLength={50}
            style={(state.content.titleStyle as TextStyleConfig) || defaultTextStyle}
            onChange={(updates) => setContent({ 
              titleStyle: { 
                ...((state.content.titleStyle as TextStyleConfig) || defaultTextStyle), 
                ...updates 
              } 
            })}
            testIdPrefix="title"
            showPositionControls={true}
            showPreview={false}
          />
          
          <TextStyleEditor
            label="URL Description"
            sublabel="Supporting text on landing page"
            maxLength={200}
            style={(state.content.descriptionStyle as TextStyleConfig) || defaultTextStyle}
            onChange={(updates) => setContent({ 
              descriptionStyle: { 
                ...((state.content.descriptionStyle as TextStyleConfig) || defaultTextStyle), 
                ...updates 
              } 
            })}
            testIdPrefix="description"
            showPositionControls={true}
            showPreview={false}
          />
        </div>

        {(backgroundUrl || (state.content.titleStyle as TextStyleConfig)?.enabled || (state.content.descriptionStyle as TextStyleConfig)?.enabled) && (
          <div className="space-y-3 pt-4 border-t">
            <p className="text-sm font-medium">Landing Page Preview</p>
            <LandingPageViewer
              titleStyle={(state.content.titleStyle as TextStyleConfig)}
              descriptionStyle={(state.content.descriptionStyle as TextStyleConfig)}
              backgroundImage={backgroundUrl}
              caption="This is how your landing page will appear when the QR is scanned"
            />
          </div>
        )}
      </div>
    </CollapsibleModule>
  );
}
