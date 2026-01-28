import { useQuery } from "@tanstack/react-query";
import { useParams, useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, ArrowLeft } from "lucide-react";

interface LandingPageData {
  qrContent: string | null;
}

export default function ProductLanding() {
  const params = useParams();
  const slug = params.slug as string;
  const [, setLocation] = useLocation();

  const { data, isLoading, error } = useQuery<{ success: boolean; landingPage: LandingPageData }>({
    queryKey: ['/api/test/landing', slug],
    enabled: !!slug,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !data?.success) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center">
            <h1 className="text-2xl font-bold mb-2">Page Not Found</h1>
            <p className="text-muted-foreground mb-4">
              This page doesn't exist or has been removed.
            </p>
            <Button onClick={() => setLocation("/")} data-testid="button-back-home">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Home
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const landing = data.landingPage;

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <p className="text-lg break-all text-center max-w-lg" data-testid="text-url">
        {landing.qrContent}
      </p>
    </div>
  );
}
