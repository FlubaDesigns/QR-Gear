import { useQuery } from "@tanstack/react-query";
import { useParams, useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, ArrowLeft, CheckCircle, Clock, ExternalLink, RefreshCw, QrCode } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import SEO from "@/components/SEO";

interface ClaimedInstance {
  id: string;
  claimCode: string;
  productName: string;
  productDescription?: string;
  previewImageUrl?: string;
  ownerEmail: string;
  hostingExpiresAt: string;
  status: string;
  claimedAt: string;
  instanceUrl?: string;
  qrgId?: string;
}

export default function MyItemPage() {
  const { instanceId } = useParams<{ instanceId: string }>();
  const [, setLocation] = useLocation();
  const { user, isLoading: authLoading } = useAuth();

  const { data, isLoading, error } = useQuery<{ instance: ClaimedInstance; isActive: boolean }>({
    queryKey: ['/api/claimed-instances', instanceId],
    enabled: !!instanceId && !!user,
  });

  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center">
            <h1 className="text-xl font-bold mb-2">Sign In Required</h1>
            <p className="text-muted-foreground mb-4">Please sign in to view your item.</p>
            <Button onClick={() => setLocation('/login')} data-testid="button-sign-in">
              Sign In
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error || !data?.instance) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center">
            <h1 className="text-xl font-bold mb-2">Item Not Found</h1>
            <p className="text-muted-foreground mb-4">
              This item doesn't exist or you don't have access to it.
            </p>
            <Button onClick={() => setLocation('/account')} data-testid="button-back-account">
              <ArrowLeft className="mr-2 h-4 w-4" />
              My Account
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const instance = data.instance;
  const isActive = data.isActive;
  const expiresAt = new Date(instance.hostingExpiresAt);
  const now = new Date();
  const daysRemaining = Math.max(0, Math.ceil((expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));

  return (
    <>
      <SEO title={`${instance.productName} — My QR Item | QR Gear`} />
      <div className="min-h-screen bg-background">
        <div className="max-w-2xl mx-auto p-4 py-8 space-y-6">

          <div className="flex items-center gap-3">
            <Button
              size="icon"
              variant="ghost"
              onClick={() => setLocation('/account')}
              data-testid="button-back"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-xl font-bold text-foreground">{instance.productName}</h1>
              {instance.qrgId && (
                <p className="text-xs text-muted-foreground font-mono">{instance.qrgId}</p>
              )}
            </div>
          </div>

          {instance.previewImageUrl && (
            <Card>
              <CardContent className="p-4 flex justify-center">
                <img
                  src={instance.previewImageUrl}
                  alt={instance.productName}
                  className="max-h-64 object-contain rounded-md"
                  data-testid="img-item-preview"
                />
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <QrCode className="h-4 w-4 text-primary" />
                Hosting Status
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Status</span>
                {isActive ? (
                  <Badge className="gap-1">
                    <CheckCircle className="h-3 w-3" />
                    Active
                  </Badge>
                ) : (
                  <Badge variant="destructive" className="gap-1">
                    Expired
                  </Badge>
                )}
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Days Remaining</span>
                <span className="text-sm font-semibold text-foreground" data-testid="text-days-remaining">
                  {daysRemaining} days
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Expires</span>
                <span className="text-sm text-foreground" data-testid="text-expires">
                  {expiresAt.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Activated</span>
                <span className="text-sm text-foreground">
                  {new Date(instance.claimedAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
                </span>
              </div>

              {daysRemaining < 60 && isActive && (
                <div className="bg-amber-500/10 border border-amber-500/20 rounded-md p-3">
                  <p className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    Your hosting expires soon. Renew to keep your QR content live.
                  </p>
                </div>
              )}

              {!isActive && (
                <div className="bg-destructive/10 border border-destructive/20 rounded-md p-3">
                  <p className="text-xs text-destructive">
                    Your hosting has expired. Renew to restore your QR content.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          <div className="space-y-2">
            {instance.instanceUrl && (
              <Button
                className="w-full"
                onClick={() => window.open(instance.instanceUrl, '_blank')}
                data-testid="button-view-live"
              >
                <ExternalLink className="h-4 w-4 mr-2" />
                View Live Page
              </Button>
            )}

            <Button
              variant="outline"
              className="w-full"
              onClick={() => setLocation(`/renew/${instanceId}`)}
              data-testid="button-renew"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Renew Hosting
            </Button>

            <Button
              variant="ghost"
              className="w-full"
              onClick={() => setLocation('/account')}
              data-testid="button-my-items"
            >
              All My QR Items
            </Button>
          </div>

        </div>
      </div>
    </>
  );
}
