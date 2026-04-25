import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DollarSign,
  Banknote,
  CheckCircle,
  Clock,
  AlertCircle,
  ExternalLink,
  RefreshCw,
  ArrowRight,
  CircleDollarSign,
} from "lucide-react";
import { getAuthHeaders } from "@/features/shared/components/wizardSteps";
import { memberFetch } from "@/lib/memberFetch";

interface ConnectStatus {
  connected: boolean;
  payoutsEnabled: boolean;
  chargesEnabled: boolean;
  onboardingComplete: boolean;
  accountId: string | null;
  profitSharePercent: number;
  requirements?: string[];
}

interface EarningsSummary {
  total: number;
  pending: number;
  paid: number;
  profitShare: number;
}

interface PayoutsViewProps {
  memberId: string;
}

export function PayoutsView({ memberId }: PayoutsViewProps) {
  const queryClient = useQueryClient();
  const [connectError, setConnectError] = useState<string | null>(null);

  // Detect return from Stripe onboarding
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('connect_return') === 'true') {
      // Refresh status after returning from Stripe
      queryClient.invalidateQueries({ queryKey: ['/api/connect/status', memberId] });
      // Clean up URL
      const url = new URL(window.location.href);
      url.searchParams.delete('connect_return');
      window.history.replaceState({}, '', url.toString());
    }
    if (params.get('connect_error')) {
      setConnectError('Onboarding link expired. Please try connecting again.');
      const url = new URL(window.location.href);
      url.searchParams.delete('connect_error');
      window.history.replaceState({}, '', url.toString());
    }
  }, [memberId, queryClient]);

  const { data: status, isLoading: statusLoading, refetch: refetchStatus } = useQuery<ConnectStatus>({
    queryKey: ['/api/connect/status', memberId],
    queryFn: async () => {
      const headers = await getAuthHeaders();
      const res = await fetch(`/api/connect/status/${memberId}`, { headers });
      if (!res.ok) throw new Error('Failed to load Connect status');
      return res.json();
    },
    enabled: !!memberId,
    staleTime: 30_000,
  });

  const { data: earnings } = useQuery<EarningsSummary>({
    queryKey: ['/api/members', memberId, 'earnings'],
    queryFn: async () => {
      if (!memberId) return { total: 0, pending: 0, paid: 0, profitShare: 25 };
      return memberFetch<EarningsSummary>(`/${memberId}/earnings`).catch(() => ({ total: 0, pending: 0, paid: 0, profitShare: 25 }));
    },
    enabled: !!memberId,
  });

  const onboardMutation = useMutation({
    mutationFn: async () => {
      const headers = await getAuthHeaders();
      const res = await fetch('/api/connect/onboard', {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || 'Failed to start onboarding');
      }
      return res.json() as Promise<{ url: string }>;
    },
    onSuccess: (data) => {
      window.location.href = data.url;
    },
    onError: (err: any) => {
      setConnectError(err.message);
    },
  });

  const dashboardMutation = useMutation({
    mutationFn: async () => {
      const headers = await getAuthHeaders();
      const res = await fetch(`/api/connect/dashboard-link/${memberId}`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || 'Failed to get dashboard link');
      }
      return res.json() as Promise<{ url: string }>;
    },
    onSuccess: (data) => {
      window.open(data.url, '_blank', 'noopener,noreferrer');
    },
    onError: (err: any) => {
      setConnectError(err.message);
    },
  });

  if (statusLoading) {
    return (
      <div className="space-y-4">
        <div className="h-32 bg-slate-800/50 rounded-lg animate-pulse" />
        <div className="h-24 bg-slate-800/50 rounded-lg animate-pulse" />
      </div>
    );
  }

  const profitPercent = status?.profitSharePercent ? Math.round(status.profitSharePercent * 100) : 25;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-white flex items-center gap-2">
          <Banknote className="w-6 h-6 text-emerald-400" />
          Payouts
        </h2>
        <p className="text-slate-400 mt-1 text-sm">
          Connect your bank account to receive your {profitPercent}% profit share automatically when products sell.
        </p>
      </div>

      {connectError && (
        <div className="flex items-start gap-3 bg-red-900/30 border border-red-500/40 rounded-md p-4">
          <AlertCircle className="w-5 h-5 text-red-400 mt-0.5 shrink-0" />
          <p className="text-red-300 text-sm">{connectError}</p>
        </div>
      )}

      {/* Connect Status Card */}
      {!status?.connected && (
        <Card className="bg-slate-800/50 border-slate-700">
          <CardContent className="p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-slate-700 flex items-center justify-center">
                <CircleDollarSign className="w-6 h-6 text-slate-400" />
              </div>
              <div>
                <p className="text-white font-semibold">Bank Account Not Connected</p>
                <p className="text-slate-400 text-sm">Your earnings are tracked but not yet paid out automatically.</p>
              </div>
            </div>

            <div className="bg-slate-700/40 rounded-md p-4 space-y-2">
              <p className="text-slate-300 text-sm font-medium">How it works:</p>
              <ul className="text-slate-400 text-sm space-y-1.5">
                <li className="flex items-start gap-2">
                  <ArrowRight className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />
                  Connect your bank account securely through Stripe (takes ~2 minutes)
                </li>
                <li className="flex items-start gap-2">
                  <ArrowRight className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />
                  Every time one of your products sells, {profitPercent}% transfers to your account automatically
                </li>
                <li className="flex items-start gap-2">
                  <ArrowRight className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />
                  Stripe deposits funds to your bank on a regular schedule (typically 2 business days)
                </li>
              </ul>
            </div>

            <Button
              onClick={() => onboardMutation.mutate()}
              disabled={onboardMutation.isPending}
              className="bg-emerald-600 text-white w-full"
              data-testid="button-connect-stripe"
            >
              {onboardMutation.isPending ? (
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Banknote className="w-4 h-4 mr-2" />
              )}
              {onboardMutation.isPending ? 'Redirecting to Stripe...' : 'Connect Bank Account'}
            </Button>
          </CardContent>
        </Card>
      )}

      {status?.connected && !status.onboardingComplete && (
        <Card className="bg-amber-900/20 border-amber-500/40">
          <CardContent className="p-6 space-y-4">
            <div className="flex items-center gap-3">
              <Clock className="w-8 h-8 text-amber-400" />
              <div>
                <p className="text-white font-semibold">Onboarding In Progress</p>
                <p className="text-slate-400 text-sm">Stripe needs a little more information before payouts can go live.</p>
              </div>
            </div>

            {status.requirements && status.requirements.length > 0 && (
              <div className="bg-amber-900/20 rounded-md p-3 space-y-1">
                <p className="text-amber-300 text-xs font-medium uppercase tracking-wide">Items still required:</p>
                {status.requirements.map((req) => (
                  <p key={req} className="text-amber-200 text-sm">{req.replace(/_/g, ' ')}</p>
                ))}
              </div>
            )}

            <div className="flex gap-3">
              <Button
                onClick={() => onboardMutation.mutate()}
                disabled={onboardMutation.isPending}
                className="bg-amber-600 text-white flex-1"
                data-testid="button-resume-onboarding"
              >
                {onboardMutation.isPending ? (
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <ExternalLink className="w-4 h-4 mr-2" />
                )}
                Resume Setup
              </Button>
              <Button
                variant="ghost"
                onClick={() => refetchStatus()}
                className="text-slate-400 hover:text-white"
                data-testid="button-refresh-status"
              >
                <RefreshCw className="w-4 h-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {status?.connected && status.onboardingComplete && (
        <Card className="bg-emerald-900/20 border-emerald-500/40">
          <CardContent className="p-6 space-y-4">
            <div className="flex items-center gap-3">
              <CheckCircle className="w-8 h-8 text-emerald-400" />
              <div>
                <p className="text-white font-semibold">Payouts Active</p>
                <p className="text-slate-400 text-sm">
                  Your {profitPercent}% profit share transfers automatically on every sale.
                </p>
              </div>
              <Badge className="ml-auto bg-emerald-700/60 text-emerald-200 border-0">Live</Badge>
            </div>

            <Button
              onClick={() => dashboardMutation.mutate()}
              disabled={dashboardMutation.isPending}
              variant="ghost"
              className="text-emerald-400 hover:text-emerald-300 w-full border border-emerald-700/50"
              data-testid="button-stripe-dashboard"
            >
              {dashboardMutation.isPending ? (
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <ExternalLink className="w-4 h-4 mr-2" />
              )}
              Open Stripe Dashboard
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Earnings Summary */}
      <Card className="bg-slate-800/50 border-slate-700">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-green-400" />
            Earnings Summary
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center">
              <p className="text-2xl font-bold text-white">${(earnings?.total || 0).toFixed(2)}</p>
              <p className="text-slate-400 text-xs mt-1">Total Earned</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-amber-400">${(earnings?.pending || 0).toFixed(2)}</p>
              <p className="text-slate-400 text-xs mt-1">Pending</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-emerald-400">${(earnings?.paid || 0).toFixed(2)}</p>
              <p className="text-slate-400 text-xs mt-1">Paid Out</p>
            </div>
          </div>

          {!status?.connected && (
            <div className="mt-4 p-3 bg-slate-700/40 rounded-md">
              <p className="text-slate-400 text-sm text-center">
                Connect your bank account above to start receiving automatic payouts.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
