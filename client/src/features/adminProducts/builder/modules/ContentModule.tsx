import { useState } from "react";
import { Link2, Type, FileText } from "lucide-react";
import { CollapsibleModule } from "@/features/shared/components/CollapsibleModule";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { SharedViewer } from "@/features/shared/components/SharedViewer";
import { useBuilderContext } from "../BuilderContext";
import { ContentViewerControls } from "../components/ContentViewerControls";

export function ContentModule() {
  const { state, setContent } = useBuilderContext();
  const [basicsMode, setBasicsMode] = useState<"text" | "url">("text");

  // Play mode uses PlayContentModule for media, not this URL input
  const needsUrl = state.qrProductState === "qr_canvas" || 
                   state.qrProductState === "qr_dynamics";

  // Play mode has its own content module (PlayContentModule)
  const needsOverlay = state.qrProductState === "qr_dynamics" || 
                       state.qrProductState === "qr_plus";

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
              {state.qrProductState === "qr_dynamics" ? "Background URL" : "Destination URL"}
            </Label>
            <Input
              id="content-url"
              type="text"
              inputMode="text"
              autoCorrect="off"
              spellCheck={false}
              placeholder={state.qrProductState === "qr_dynamics" 
                ? "https://example.com/image.jpg" 
                : "https://example.com"}
              value={state.content.url}
              onChange={(e) => setContent({ url: e.target.value })}
              data-testid="input-content-url"
            />
            {state.qrProductState === "qr_dynamics" && (
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
              <textarea
                id="content-description"
                inputMode="text"
                autoComplete="off"
                placeholder="Enter description text (voice input supported)"
                value={state.content.description}
                onChange={(e) => setContent({ description: e.target.value })}
                maxLength={200}
                rows={3}
                className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                data-testid="input-content-description"
              />
            </div>
          </>
        )}

        {state.qrProductState === "qr_basics" && (
          <div className="space-y-4">
            <div className="flex gap-3">
              <Button
                type="button"
                variant={basicsMode === "text" ? "default" : "outline"}
                size="lg"
                onClick={() => setBasicsMode("text")}
                className="flex-1 h-14 text-base"
                data-testid="button-basics-text"
              >
                <Type className="h-5 w-5 mr-2" />
                Text
              </Button>
              <Button
                type="button"
                variant={basicsMode === "url" ? "default" : "outline"}
                size="lg"
                onClick={() => setBasicsMode("url")}
                className="flex-1 h-14 text-base"
                data-testid="button-basics-url"
              >
                <Link2 className="h-5 w-5 mr-2" />
                URL
              </Button>
            </div>

            {basicsMode === "text" ? (
              <div className="space-y-2">
                <Label htmlFor="plain-text-content" className="flex items-center gap-2">
                  <Type className="h-3.5 w-3.5" />
                  Text to Encode
                </Label>
                <textarea
                  id="plain-text-content"
                  name="plain-text-content"
                  inputMode="text"
                  enterKeyHint="done"
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="sentences"
                  spellCheck={false}
                  aria-label="Text to encode in QR code - voice input supported"
                  placeholder="Tap here to type or use voice input"
                  value={state.content.url}
                  onChange={(e) => setContent({ url: e.target.value })}
                  onInput={(e) => setContent({ url: (e.target as HTMLTextAreaElement).value })}
                  maxLength={500}
                  rows={4}
                  className="flex min-h-[120px] w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 resize-none"
                  data-testid="input-plain-text-content"
                />
                <p className="text-sm text-muted-foreground">
                  Tap the field, then use your keyboard's microphone button for voice input.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                <Label htmlFor="plain-url-content" className="flex items-center gap-2">
                  <Link2 className="h-3.5 w-3.5" />
                  URL to Encode
                </Label>
                <input
                  id="plain-url-content"
                  type="text"
                  inputMode="text"
                  autoComplete="off"
                  autoCorrect="off"
                  spellCheck={false}
                  enterKeyHint="done"
                  placeholder="Tap here, then use keyboard microphone"
                  value={state.content.url}
                  onChange={(e) => setContent({ url: e.target.value })}
                  className="flex h-12 min-h-[48px] w-full rounded-md border border-input bg-background px-3 py-2 ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  style={{ fontSize: '16px' }}
                  data-testid="input-plain-url-content"
                />
                <p className="text-xs text-muted-foreground">
                  Scanning will open this URL directly
                </p>
              </div>
            )}

          </div>
        )}

        {state.qrProductState === "qr_dynamics" && state.content.url && (
          <div className="space-y-3">
            <ContentViewerControls
              content={state.content}
              onContentChange={setContent}
            />
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
          </div>
        )}

        {(state.content.url || state.content.title) && (
          <div className="p-3 bg-primary/5 rounded-md border">
            <p className="text-sm font-medium">Content Ready</p>
            <p className="text-xs text-muted-foreground">
              {state.content.url && (
                state.qrProductState === "qr_basics" 
                  ? (basicsMode === "text" 
                      ? `Text: ${state.content.url.substring(0, 40)}${state.content.url.length > 40 ? "..." : ""}`
                      : `URL: ${state.content.url.substring(0, 40)}${state.content.url.length > 40 ? "..." : ""}`)
                  : `URL: ${state.content.url.substring(0, 40)}${state.content.url.length > 40 ? "..." : ""}`
              )}
              {state.content.title && ` • Title: ${state.content.title}`}
            </p>
          </div>
        )}
      </div>
    </CollapsibleModule>
  );
}
