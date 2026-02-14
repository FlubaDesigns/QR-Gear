import { useState } from "react";
import { Type, Link2, FileText } from "lucide-react";
import { CollapsibleModule } from "@/features/shared/components/CollapsibleModule";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { useBuilderContext } from "../BuilderContext";

export function BasicsContentModule() {
  const { state, setContent } = useBuilderContext();
  const [basicsMode, setBasicsMode] = useState<"text" | "url">("text");

  if (state.qrProductState !== "qr_basics" || !state.selectedProduct || !state.content) {
    return null;
  }

  return (
    <CollapsibleModule
      title="QR Content"
      icon={<FileText className="h-4 w-4" />}
      className="bg-muted/30"
      defaultOpen
    >
      <div className="space-y-4">
        <div className="flex gap-3">
          <Button
            type="button"
            variant={basicsMode === "text" ? "default" : "outline"}
            size="lg"
            onClick={() => {
              setBasicsMode("text");
              setContent({ url: "" });
            }}
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
            onClick={() => {
              setBasicsMode("url");
              setContent({ url: "" });
            }}
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
            <Textarea
              id="plain-text-content"
              inputMode="text"
              autoComplete="off"
              placeholder="Enter text, phone number, email, or any info to encode in the QR"
              value={state.content.url || ""}
              onChange={(e) => setContent({ url: e.target.value })}
              rows={4}
              className="text-base"
              data-testid="input-basics-text"
            />
            <p className="text-xs text-muted-foreground">
              This text will be encoded directly into the QR code. Max ~300 characters recommended.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            <Label htmlFor="url-content" className="flex items-center gap-2">
              <Link2 className="h-3.5 w-3.5" />
              URL to Encode
            </Label>
            <Input
              id="url-content"
              type="url"
              inputMode="url"
              autoComplete="off"
              placeholder="https://example.com"
              value={state.content.url || ""}
              onChange={(e) => setContent({ url: e.target.value })}
              className="text-base h-12"
              data-testid="input-basics-url"
            />
            <p className="text-xs text-muted-foreground">
              The QR code will link directly to this URL when scanned.
            </p>
          </div>
        )}

        {state.content.url && (
          <div className="p-3 bg-primary/5 rounded-md border">
            <p className="text-sm font-medium">Content Ready</p>
            <p className="text-xs text-muted-foreground break-all">
              {basicsMode === "text" 
                ? `Text: ${state.content.url.substring(0, 60)}${state.content.url.length > 60 ? "..." : ""}`
                : `URL: ${state.content.url}`
              }
            </p>
          </div>
        )}
      </div>
    </CollapsibleModule>
  );
}
