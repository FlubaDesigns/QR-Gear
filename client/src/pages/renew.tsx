import { checkoutAttemptId, releaseCheckoutAttempt } from '@/lib/checkoutAttempt';
import { useEffect, useState } from "react";
import { claimedItemLifecycle, type HostingStatusResponse } from '@shared/claimedItems';
import { useParams, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, AlertCircle, CheckCircle, Clock, CreditCard } from "lucide-react";

export default function RenewPage() {
  const { instanceId } = useParams<{ instanceId: string }>();
  const [, setLocation] = useLocation();
  const [selectedTier, setSelectedTier] = useState('');

  const searchParams = new URLSearchParams(window.location.search);
  const successSessionId = searchParams.get('session_id');

  const { data, isLoading, error, refetch } = useQuery<HostingStatusResponse>({
    queryKey: ['/api/buyer/instances', instanceId, 'public'],
    enabled: !!instanceId,
  });

  const selectedOffer = data?.renewalOptions.find(t => t.code === selectedTier);

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
      if (!selectedOffer) throw new Error('Choose a hosting term.');
      const scope = `hosting_renewal:${instanceId}`;
      const selection = { hostingTierCode: selectedOffer.code, expectedAmountCents: selectedOffer.amountCents };
      const response = await fetch(`/api/buyer/instances/${instanceId}/renew`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...selection, checkoutAttemptId: checkoutAttemptId(scope, selection) }),
      });
      if (!response.ok) { const error = await response.json(); if (error.code === 'checkout_expired') releaseCheckoutAttempt(scope, selection); throw new Error(error.error || 'Checkout failed'); }
      const result = await response.json();
      if (result.status === 'complete' && result.paymentStatus === 'paid') releaseCheckoutAttempt(scope, selection);
      return result as { url: string; sessionId: string };
    },
    onError: () => { setSelectedTier(''); refetch(); },
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
      <div className="flex items-center justify-center bg-gradient-to-br from-slate-900 to-slate-800">
        <Loader2 className="h-8 w-8 animate-spin text-white" />
      </div>
    );
  }

  if (error || !data?.instance) {
    return (
      <div className="flex items-center justify-center bg-gradient-to-br from-slate-900 to-slate-800 p-4">
        <Card className="max-w-md w-full">
          <CardHeader className="text-center">
            <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <CardTitle>Hosting Status Unavailable</CardTitle>
            <CardDescription>
              We could not load this QR item's hosting details. Please try again.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  const instance = data.instance;
  const isActive = data.isActive;
  const { hasTerm, isStatic, daysRemaining } = claimedItemLifecycle(instance);
  const expirationDate = hasTerm ? new Date(instance.hostingExpiresAt!) : null;

  if (verifyMutation.isSuccess) {
    return (
      <div className="flex items-center justify-center bg-gradient-to-br from-slate-900 to-slate-800 p-4">
        <Card className="max-w-md w-full">
          <CardHeader className="text-center">
            <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
            <CardTitle>Renewal Successful!</CardTitle>
            <CardDescription>
              Your QR hosting has been extended to the date shown below.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-green-500/10 rounded-lg p-4 text-center">
              <p className="text-sm text-muted-foreground">New Expiration Date</p>
              <p className="text-lg font-semibold text-green-500">
                {new Date(verifyMutation.data.newExpirationDate).toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric'
                }) || 'Not recorded'}
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
    <div className="flex items-center justify-center bg-gradient-to-br from-slate-900 to-slate-800 p-4">
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
            {isStatic ? 'This is a static QR item with no hosting term.' : !hasTerm ? 'No hosting expiration is recorded for this item.' : isActive
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
                {isStatic ? 'Static QR' : isActive ? 'Active' : hasTerm ? 'Expired' : 'Inactive'}
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Expiration</span>
              <span className={isActive ? '' : 'text-red-500'}>
                {expirationDate?.toLocaleDateString() || 'No hosting term'}
              </span>
            </div>

          </div>

          {data.renewalOptions.length > 0 ? <><div className="space-y-2">
            <label htmlFor="renewal-tier">Choose a hosting term</label>
            <select id="renewal-tier" className="w-full min-h-[48px] rounded-md border bg-background p-3" value={selectedTier} onChange={e => setSelectedTier(e.target.value)}>
              <option value="">Select a term</option>
              {data.renewalOptions.map(tier => <option key={tier.code} value={tier.code}>{tier.name} — {new Intl.NumberFormat('en-US', { style: 'currency', currency: tier.currency }).format(tier.amountCents / 100)}</option>)}
            </select>
          </div>

          <Button 
            className="w-full" 
            size="lg"
            onClick={() => renewMutation.mutate()}
            disabled={renewMutation.isPending || !!successSessionId || !selectedOffer}
            data-testid="btn-renew"
          >
            {renewMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <CreditCard className="h-4 w-4 mr-2" />
            )}
            {isActive ? 'Extend Hosting' : 'Renew Now'}
          </Button>
          </> : <p className="text-sm text-muted-foreground" data-testid="renewal-unavailable">
            {isStatic ? 'This item does not need hosting renewal.' : 'Renewal terms are not available yet. Your QR identity and saved content are preserved. Contact info@qrgear.com for help.'}
          </p>}

          {verifyMutation.isPending && <p role="status">Confirming your renewal payment…</p>}
          {verifyMutation.isError && <p role="alert" className="text-sm text-red-500 text-center">We could not confirm your renewal yet. Please refresh this page to check again before starting another payment.</p>}
          {renewMutation.isError && (
            <p className="text-sm text-red-500 text-center">
              {renewMutation.error?.message || 'Failed to start checkout. Please try again.'}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
