import { useState } from "react";
import { Rocket, Link2, Clock, Store, Layout, Image, Layers, Loader2, Check, ExternalLink } from "lucide-react";
import { CollapsibleModule } from "@/features/shared/components/CollapsibleModule";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useBuilderContext } from "../BuilderContext";

interface PublishResult {
  id: string;
  slug: string;
  url: string;
  createdAt: string;
}

export function PublishModule() {
  const { state } = useBuilderContext();
  const { toast } = useToast();
  const [publishResult, setPublishResult] = useState<PublishResult | null>(null);

  const publishMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/dynamic-pages/create", {
        title: state.content.title || "Untitled",
        description: state.content.description || "",
        backgroundUrl: state.content.url,
        backgroundType: state.content.backgroundType,
        overlayPosition: state.content.overlayPosition,
        overlayColor: state.content.overlayColor,
        overlayFontFamily: state.content.overlayFontFamily,
        productId: state.selectedProduct?.id,
        qrState: state.qrProductState,
      });
      return response.json();
    },
    onSuccess: (data: PublishResult) => {
      setPublishResult(data);
      toast({
        title: "Published!",
        description: "Your content is now live",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Publish failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const canPublish = state.qrProductState === "qr_dynamics" && state.content.url;

  if (!canPublish && !publishResult) {
    return null;
  }

  const handleSaveAction = (action: string) => {
    toast({ 
      title: action, 
      description: "Use the Save Options cards below to save your design" 
    });
  };

  return (
    <CollapsibleModule
      title="Publish"
      icon={<Rocket className="h-4 w-4" />}
      className="bg-primary/5"
      defaultOpen
    >
      <div className="space-y-4">
        {!publishResult ? (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Generate a unique URL for your dynamic content. This will create a 
              live landing page accessible from any QR code.
            </p>
            <Button
              onClick={() => publishMutation.mutate()}
              disabled={publishMutation.isPending}
              className="w-full"
              data-testid="button-create-publish"
            >
              {publishMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Rocket className="h-4 w-4 mr-2" />
                  Create &amp; Publish
                </>
              )}
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="p-3 bg-green-500/10 border border-green-500/30 rounded-lg space-y-2">
              <div className="flex items-center gap-2 text-green-600">
                <Check className="h-4 w-4" />
                <span className="font-medium text-sm">Published Successfully!</span>
              </div>
              
              <div className="space-y-1">
                <Label className="text-xs flex items-center gap-1">
                  <Link2 className="h-3 w-3" />
                  Live URL
                </Label>
                <div className="flex items-center gap-2">
                  <code className="flex-1 text-xs bg-background p-2 rounded border truncate">
                    {publishResult.url}
                  </code>
                  <Button
                    size="icon"
                    variant="outline"
                    onClick={() => window.open(publishResult.url, "_blank")}
                    data-testid="button-open-url"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>

              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Clock className="h-3 w-3" />
                Created: {new Date(publishResult.createdAt).toLocaleString()}
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium">Quick Actions</Label>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleSaveAction("Store")}
                  data-testid="button-add-to-store"
                >
                  <Store className="h-3.5 w-3.5 mr-1.5" />
                  Store
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleSaveAction("Templates")}
                  data-testid="button-save-template"
                >
                  <Layout className="h-3.5 w-3.5 mr-1.5" />
                  Templates
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleSaveAction("Graphics")}
                  data-testid="button-save-graphics"
                >
                  <Image className="h-3.5 w-3.5 mr-1.5" />
                  Graphics
                </Button>
                <Button
                  variant="default"
                  size="sm"
                  onClick={() => handleSaveAction("Save All")}
                  data-testid="button-save-all"
                >
                  <Layers className="h-3.5 w-3.5 mr-1.5" />
                  All
                </Button>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Use the Save Options section below for full save functionality.
              </p>
            </div>

            <Button
              variant="ghost"
              size="sm"
              className="w-full"
              onClick={() => setPublishResult(null)}
              data-testid="button-create-another"
            >
              Create Another
            </Button>
          </div>
        )}
      </div>
    </CollapsibleModule>
  );
}
