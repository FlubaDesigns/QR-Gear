import { Link2, Type, FileText } from "lucide-react";
import { CollapsibleModule } from "@/features/shared/components/CollapsibleModule";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { SharedViewer } from "@/features/shared/components/SharedViewer";
import { useBuilderContext } from "../BuilderContext";

export function ContentModule() {
  const { state, setContent } = useBuilderContext();

  const needsUrl = state.qrProductState === "qr_url" || 
                   state.qrProductState === "qr_url_decorated" || 
                   state.qrProductState === "dynamic";

  const needsOverlay = state.qrProductState === "dynamic" || 
                       state.qrProductState === "qr_header_footer" ||
                       state.qrProductState === "qr_url_decorated";

  if (!state.qrProductState || !state.selectedProduct) {
    return null;
  }

  return (
    <CollapsibleModule
      title="Content"
      icon={<FileText className="h-4 w-4" />}
      className="bg-muted/30"
      defaultOpen
    >
      <div className="space-y-4">
        {needsUrl && (
          <div className="space-y-2">
            <Label htmlFor="content-url" className="flex items-center gap-2">
              <Link2 className="h-3.5 w-3.5" />
              {state.qrProductState === "dynamic" ? "Background URL" : "Destination URL"}
            </Label>
            <Input
              id="content-url"
              type="url"
              placeholder={state.qrProductState === "dynamic" 
                ? "https://example.com/image.jpg" 
                : "https://example.com"}
              value={state.content.url}
              onChange={(e) => setContent({ url: e.target.value })}
              data-testid="input-content-url"
            />
            {state.qrProductState === "dynamic" && (
              <p className="text-xs text-muted-foreground">
                Enter an image or video URL for the landing page background
              </p>
            )}
          </div>
        )}

        {needsOverlay && (
          <>
            <div className="space-y-2">
              <Label htmlFor="content-title" className="flex items-center gap-2">
                <Type className="h-3.5 w-3.5" />
                Title
              </Label>
              <Input
                id="content-title"
                placeholder="Enter title text"
                value={state.content.title}
                onChange={(e) => setContent({ title: e.target.value })}
                maxLength={50}
                data-testid="input-content-title"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="content-description">Description</Label>
              <Textarea
                id="content-description"
                placeholder="Enter description text"
                value={state.content.description}
                onChange={(e) => setContent({ description: e.target.value })}
                maxLength={200}
                rows={3}
                data-testid="input-content-description"
              />
            </div>
          </>
        )}

        {state.qrProductState === "plain_qr" && (
          <div className="space-y-2">
            <Label htmlFor="plain-text-content" className="flex items-center gap-2">
              <Type className="h-3.5 w-3.5" />
              QR Content
            </Label>
            <Textarea
              id="plain-text-content"
              placeholder="Enter text or URL to encode in QR"
              value={state.content.url}
              onChange={(e) => setContent({ url: e.target.value })}
              maxLength={500}
              rows={3}
              data-testid="input-plain-text-content"
            />
            <p className="text-xs text-muted-foreground">
              This text will be encoded directly in the QR code
            </p>
          </div>
        )}

        {state.qrProductState === "dynamic" && state.content.url && (
          <div className="space-y-2">
            <Label>Preview</Label>
            <SharedViewer
              mode="content"
              contentProps={{
                backgroundUrl: state.content.url,
                backgroundType: state.content.backgroundType,
                title: state.content.title,
                description: state.content.description,
                overlayPosition: state.content.overlayPosition,
                overlayColor: state.content.overlayColor,
                overlayFontFamily: state.content.overlayFontFamily,
                placeholder: "Enter a background URL above",
              }}
            />
          </div>
        )}

        {(state.content.url || state.content.title) && (
          <div className="p-3 bg-primary/5 rounded-md border">
            <p className="text-sm font-medium">Content Ready</p>
            <p className="text-xs text-muted-foreground">
              {state.content.url && `URL: ${state.content.url.substring(0, 40)}${state.content.url.length > 40 ? "..." : ""}`}
              {state.content.title && ` • Title: ${state.content.title}`}
            </p>
          </div>
        )}
      </div>
    </CollapsibleModule>
  );
}
