import { useEffect, useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { SiteProvider } from "@/features/sites/SiteContext";
import { SiteWidget } from "@/features/sites/SiteWidget";

export default function Widget() {
  const { toast } = useToast();
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tokenParam = params.get("token");

    if (tokenParam) {
      setToken(tokenParam);
    } else {
      toast({
        title: "Invalid Widget",
        description: "No authentication token provided",
        variant: "destructive",
      });
    }
  }, [toast]);

  if (!token) {
    return (
      <div className="flex items-center justify-center min-h-[300px] bg-background">
        <p className="text-sm text-muted-foreground">No token provided</p>
      </div>
    );
  }

  return (
    <SiteProvider token={token}>
      <SiteWidget />
    </SiteProvider>
  );
}
