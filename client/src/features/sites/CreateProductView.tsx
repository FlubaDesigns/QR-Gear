import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, ExternalLink, Lock } from "lucide-react";
import { useSiteContext, notifyParent } from "./SiteContext";
import { ChannelProductsView } from "./ChannelProductsView";

export function CreateProductView() {
  const { session } = useSiteContext();

  if (!session) return null;

  const { capabilities, display } = session;

  if (!capabilities.canCreate) {
    return (
      <div className="text-center py-12" data-testid="create-no-permission">
        <Lock className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
        <h3 className="font-semibold text-lg">Admin Access Required</h3>
        <p className="text-sm text-muted-foreground mt-1">
          Only authorized admins can create products for this channel.
        </p>
      </div>
    );
  }

  const handleLaunchWizard = () => {
    notifyParent('create_start', { channelId: session.channelId });
    const params = new URLSearchParams({
      channelId: session.channelId,
      entityType: session.entityType,
      entityId: session.entityId,
      storeId: session.storeId,
    });
    window.open(`/member?${params.toString()}`, '_blank');
  };

  return (
    <div data-testid="create-product-view" className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          {display.entityLogoUrl && (
            <img
              src={display.entityLogoUrl}
              alt={display.entityName || 'Store'}
              className="w-10 h-10 rounded-full object-cover"
            />
          )}
          <div>
            <h2 className="font-semibold text-lg" data-testid="text-create-heading">
              Create Products
            </h2>
            <p className="text-sm text-muted-foreground">
              {display.entityName || 'Your Channel'}
            </p>
          </div>
        </div>
      </div>

      <Card className="overflow-hidden">
        <CardContent className="p-6 text-center space-y-4">
          <div className="w-16 h-16 mx-auto bg-primary/10 rounded-full flex items-center justify-center">
            <Plus className="w-8 h-8 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold text-lg">Create a New Product</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Launch the product builder to design and publish a new item to your channel.
            </p>
          </div>
          <Button onClick={handleLaunchWizard} data-testid="button-launch-wizard">
            <ExternalLink className="w-4 h-4 mr-2" />
            Open Product Builder
          </Button>
        </CardContent>
      </Card>

      <div className="border-t pt-4 mt-4">
        <h3 className="font-medium text-sm text-muted-foreground mb-3">
          Existing Products in Channel
        </h3>
        <ChannelProductsView />
      </div>
    </div>
  );
}
