import { useState, useEffect } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, AlertCircle, CheckCircle, Clock, CreditCard } from "lucide-react";

interface BuyerInstance {
  instanceId: string;
  buyerEmail: string;
  hostingExpiresAt: string;
  status: string;
  destinationUrl: string;
  packetId: string;
}

export default function RenewPage() {
  const { instanceId } = useParams<{ instanceId: string }>();
  const [, setLocation] = useLocation();
  const [sessionId, setSessionId] = useState<string | null>(null);

  const searchParams = new URLSearchParams(window.location.search);
  const successSessionId = searchParams.get('session_id');

  const { data, isLoading, error, refetch } = useQuery<{ instance: BuyerInstance; isActive: boolean }>({
    queryKey: ['/api/buyer/instances', instanceId],
    enabled: !!instanceId,
  });

  const verifyMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/buyer/instances/${instanceId}/verify-renewal`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: successSessionId }),
      });
      if (!response.ok) throw new Error('Verification failed');
      return response.json();
    },
    onSuccess: () => {
      refetch();
    },
  });

  const renewMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/buyer/instances/${instanceId}/renew`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!response.ok) throw new Error('Checkout failed');
      return response.json() as Promise<{ url: string; sessionId: string }>;
    },
    onSuccess: (data) => {
      if (data.url) {
        window.location.href = data.url;
      }
    },
  });

  useEffect(() => {
    if (successSessionId && !verifyMutation.isPending && !verifyMutation.isSuccess) {
      verifyMutation.mutate();
    }
  }, [successSessionId]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 to-slate-800">
        <Loader2 className="h-8 w-8 animate-spin text-white" />
      </div>
    );
  }

  if (error || !data?.instance) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 to-slate-800 p-4">
        <Card className="max-w-md w-full">
          <CardHeader className="text-center">
            <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <CardTitle>Instance Not Found</CardTitle>
            <CardDescription>
              This QR code is not associated with a valid hosting instance.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  const instance = data.instance;
  const isActive = data.isActive;
  const expirationDate = new Date(instance.hostingExpiresAt);
  const now = new Date();
  const daysRemaining = Math.ceil((expirationDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

  if (verifyMutation.isSuccess) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 to-slate-800 p-4">
        <Card className="max-w-md w-full">
          <CardHeader className="text-center">
            <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
            <CardTitle>Renewal Successful!</CardTitle>
            <CardDescription>
              Your QR hosting has been extended for 3 more years.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-green-500/10 rounded-lg p-4 text-center">
              <p className="text-sm text-muted-foreground">New Expiration Date</p>
              <p className="text-lg font-semibold text-green-500">
                {new Date(instance.hostingExpiresAt).toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric'
                })}
              </p>
            </div>
            <Button 
              className="w-full" 
              onClick={() => setLocation('/')}
              data-testid="btn-go-home"
            >
              Go to Homepage
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 to-slate-800 p-4">
      <Card className="max-w-md w-full">
        <CardHeader className="text-center">
          {isActive ? (
            <Clock className="h-12 w-12 text-yellow-500 mx-auto mb-4" />
          ) : (
            <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          )}
          <CardTitle>
            {isActive ? 'QR Hosting Status' : 'QR Hosting Expired'}
          </CardTitle>
          <CardDescription>
            {isActive 
              ? `Your hosting is active but will expire in ${daysRemaining} days`
              : 'Your QR code is no longer showing your content'
            }
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Status</span>
              <Badge variant={isActive ? "default" : "destructive"}>
                {isActive ? 'Active' : 'Expired'}
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Expiration</span>
              <span className={isActive ? '' : 'text-red-500'}>
                {expirationDate.toLocaleDateString()}
              </span>
            </div>
            {instance.buyerEmail && (
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Email</span>
                <span className="truncate max-w-[180px]">{instance.buyerEmail}</span>
              </div>
            )}
          </div>

          <div className="bg-slate-800/50 rounded-lg p-4 text-center">
            <p className="text-2xl font-bold text-white mb-1">$4.99</p>
            <p className="text-sm text-muted-foreground">for 3 years of hosting</p>
          </div>

          <Button 
            className="w-full" 
            size="lg"
            onClick={() => renewMutation.mutate()}
            disabled={renewMutation.isPending}
            data-testid="btn-renew"
          >
            {renewMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <CreditCard className="h-4 w-4 mr-2" />
            )}
            {isActive ? 'Extend Hosting' : 'Renew Now'}
          </Button>

          {renewMutation.isError && (
            <p className="text-sm text-red-500 text-center">
              Failed to start checkout. Please try again.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
