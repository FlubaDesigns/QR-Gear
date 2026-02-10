import { useEffect, useRef } from "react";
import { Card } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import { useSiteContext, notifyParent } from "./SiteContext";
import { ChannelProductsView } from "./ChannelProductsView";
import { ProgramSeriesView } from "./ProgramSeriesView";
import { CreateProductView } from "./CreateProductView";

export function SiteWidget() {
  const { session, isLoading, error } = useSiteContext();
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (containerRef.current) {
      const resizeObserver = new ResizeObserver((entries) => {
        for (const entry of entries) {
          notifyParent('height', { height: entry.contentRect.height + 40 });
        }
      });
      resizeObserver.observe(containerRef.current);
      return () => resizeObserver.disconnect();
    }
  }, []);

  useEffect(() => {
    if (session?.ok) {
      notifyParent('ready', { viewType: session.viewType });
    }
  }, [session]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[300px] bg-background">
        <div className="text-center space-y-4">
          <Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" />
          <p className="text-sm text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (error || !session || !session.ok) {
    return (
      <div className="flex items-center justify-center min-h-[300px] bg-background">
        <Card className="p-8 max-w-md text-center space-y-4">
          <h2 className="text-xl font-semibold text-destructive">Widget Unavailable</h2>
          <p className="text-sm text-muted-foreground">
            {session?.error || error?.message || "Unable to load widget. Please check your authentication token."}
          </p>
        </Card>
      </div>
    );
  }

  const renderView = () => {
    switch (session.viewType) {
      case 'channel_products':
        return <ChannelProductsView />;
      case 'program_series':
        return <ProgramSeriesView />;
      case 'create_product':
        return <CreateProductView />;
      default:
        return <ChannelProductsView />;
    }
  };

  return (
    <div ref={containerRef} className="p-4 bg-background min-h-[300px]" data-testid="site-widget-container">
      {renderView()}

      <div className="mt-4 pt-3 border-t text-center text-xs text-muted-foreground">
        Powered by <span className="font-medium text-primary">QR Gear</span>
      </div>
    </div>
  );
}
