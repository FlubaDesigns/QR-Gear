import { useState, useEffect } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, AlertCircle, CheckCircle, QrCode, Smartphone, Shield, Clock } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

interface ClaimData {
  claimCode: string;
  productName: string;
  productDescription?: string;
  previewImageUrl?: string;
  packetType: string;
  status: string;
}

type ClaimStep = 'welcome' | 'auth' | 'confirm' | 'success';

export default function ClaimPage() {
  const { claimCode } = useParams<{ claimCode: string }>();
  const [, setLocation] = useLocation();
  const { user, isLoading: authLoading } = useAuth();
  const [step, setStep] = useState<ClaimStep>('welcome');
  const [instanceId, setInstanceId] = useState<string | null>(null);

  const { data, isLoading, error } = useQuery<{ valid: boolean; reason?: string; claimData?: ClaimData }>({
    queryKey: ['/api/claim/validate', claimCode],
    enabled: !!claimCode,
  });

  const claimMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/claim/${claimCode}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Failed to claim item');
      }
      return response.json();
    },
    onSuccess: (data) => {
      setInstanceId(data.instanceId);
      setStep('success');
    },
  });

  useEffect(() => {
    if (step === 'auth' && user) {
      setStep('confirm');
    }
  }, [step, user]);

  if (isLoading || authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 to-slate-800">
        <Loader2 className="h-8 w-8 animate-spin text-white" />
      </div>
    );
  }

  if (error || !data?.valid) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 to-slate-800 p-4">
        <Card className="max-w-md w-full">
          <CardHeader className="text-center">
            <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <CardTitle>Invalid Claim Code</CardTitle>
            <CardDescription>
              {data?.reason || "This claim code is not valid or has already been used."}
            </CardDescription>
          </CardHeader>
          <CardContent>
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

  const claimData = data.claimData!;

  if (step === 'welcome') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 to-slate-800 p-4">
        <Card className="max-w-md w-full">
          <CardHeader className="text-center">
            <QrCode className="h-12 w-12 text-blue-500 mx-auto mb-4" />
            <CardTitle>Activate Your QR Item</CardTitle>
            <CardDescription>
              You're about to activate your personalized QR experience
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {claimData.previewImageUrl && (
              <div className="relative rounded-lg overflow-hidden bg-slate-800/50">
                <img 
                  src={claimData.previewImageUrl} 
                  alt={claimData.productName}
                  className="w-full h-48 object-cover"
                />
              </div>
            )}

            <div className="text-center">
              <h3 className="text-lg font-semibold">{claimData.productName}</h3>
              {claimData.productDescription && (
                <p className="text-sm text-muted-foreground mt-1">{claimData.productDescription}</p>
              )}
              <Badge className="mt-2" variant="secondary">
                {claimData.packetType.replace('qr_', '').toUpperCase()}
              </Badge>
            </div>

            <div className="space-y-3 bg-slate-800/30 rounded-lg p-4">
              <div className="flex items-center gap-3">
                <Smartphone className="h-5 w-5 text-green-500" />
                <span className="text-sm">Control your QR from any device</span>
              </div>
              <div className="flex items-center gap-3">
                <Shield className="h-5 w-5 text-blue-500" />
                <span className="text-sm">Your content, your ownership</span>
              </div>
              <div className="flex items-center gap-3">
                <Clock className="h-5 w-5 text-yellow-500" />
                <span className="text-sm">First year of hosting is FREE</span>
              </div>
            </div>

            <Button 
              className="w-full" 
              size="lg"
              onClick={() => setStep(user ? 'confirm' : 'auth')}
              data-testid="btn-continue"
            >
              Continue to Activate
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (step === 'auth') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 to-slate-800 p-4">
        <Card className="max-w-md w-full">
          <CardHeader className="text-center">
            <Shield className="h-12 w-12 text-blue-500 mx-auto mb-4" />
            <CardTitle>Sign In to Continue</CardTitle>
            <CardDescription>
              Create an account or sign in to claim your QR item
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground text-center">
              Your account will be linked to this item for ownership and control.
            </p>
            
            <div className="flex flex-col gap-3">
              <Button 
                className="w-full" 
                onClick={() => setLocation(`/login?redirect=/claim/${claimCode}`)}
                data-testid="btn-login"
              >
                Sign In
              </Button>
              <Button 
                variant="outline"
                className="w-full" 
                onClick={() => setLocation(`/member?redirect=/claim/${claimCode}`)}
                data-testid="btn-register"
              >
                Create Account
              </Button>
            </div>

            <Button 
              variant="ghost"
              className="w-full" 
              onClick={() => setStep('welcome')}
              data-testid="btn-back"
            >
              Back
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (step === 'confirm') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 to-slate-800 p-4">
        <Card className="max-w-md w-full">
          <CardHeader className="text-center">
            <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
            <CardTitle>Ready to Activate</CardTitle>
            <CardDescription>
              Confirm to link this item to your account
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="bg-slate-800/50 rounded-lg p-4 space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Item</span>
                <span className="font-medium">{claimData.productName}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Account</span>
                <span className="font-medium truncate max-w-[180px]">{user?.email}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Free Hosting</span>
                <Badge variant="secondary">1 Year</Badge>
              </div>
            </div>

            <p className="text-xs text-muted-foreground text-center">
              By activating, you agree to our Terms of Service. After the first year, 
              hosting is $4.99 for 3 additional years.
            </p>

            <Button 
              className="w-full" 
              size="lg"
              onClick={() => claimMutation.mutate()}
              disabled={claimMutation.isPending}
              data-testid="btn-activate"
            >
              {claimMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <CheckCircle className="h-4 w-4 mr-2" />
              )}
              Activate My Item
            </Button>

            {claimMutation.isError && (
              <p className="text-sm text-red-500 text-center">
                {(claimMutation.error as Error).message}
              </p>
            )}

            <Button 
              variant="ghost"
              className="w-full" 
              onClick={() => setStep('welcome')}
              disabled={claimMutation.isPending}
              data-testid="btn-back"
            >
              Back
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (step === 'success') {
    const expirationDate = new Date();
    expirationDate.setFullYear(expirationDate.getFullYear() + 1);

    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 to-slate-800 p-4">
        <Card className="max-w-md w-full">
          <CardHeader className="text-center">
            <div className="relative mx-auto mb-4">
              <CheckCircle className="h-16 w-16 text-green-500" />
              <div className="absolute -bottom-1 -right-1 bg-green-500 rounded-full p-1">
                <QrCode className="h-4 w-4 text-white" />
              </div>
            </div>
            <CardTitle>Your Item is Live!</CardTitle>
            <CardDescription>
              {claimData.productName} is now active and linked to your account
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-4 text-center">
              <p className="text-sm text-green-400 mb-1">Free Hosting Until</p>
              <p className="text-lg font-semibold text-green-300">
                {expirationDate.toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric'
                })}
              </p>
            </div>

            <div className="space-y-3">
              <Button 
                className="w-full" 
                size="lg"
                onClick={() => setLocation('/dynamics')}
                data-testid="btn-open-dynamics"
              >
                <Smartphone className="h-4 w-4 mr-2" />
                Open QR Dynamics
              </Button>

              <Button 
                variant="outline"
                className="w-full"
                onClick={() => setLocation('/account')}
                data-testid="btn-view-items"
              >
                View My Items
              </Button>
            </div>

            <p className="text-xs text-muted-foreground text-center">
              You can customize your QR content, update destinations, 
              and manage your items from QR Dynamics.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return null;
}
