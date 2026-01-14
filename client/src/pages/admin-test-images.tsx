import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, RefreshCw } from "lucide-react";
import { SmartImage } from "@/components/SmartImage";
import { auth } from "@/lib/firebase";

interface TestAsset {
  id: string;
  name: string;
  publicUrl: string;
  proxyUrl?: string;
  storageUrl: string;
}

export default function AdminTestImagesPage() {
  const [assets, setAssets] = useState<TestAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [debugInfo, setDebugInfo] = useState<string>("");

  const fetchAssets = async () => {
    setLoading(true);
    setError(null);
    setDebugInfo("");
    try {
      const token = await auth.currentUser?.getIdToken();
      const res = await fetch("/api/admin/background-assets?type=source", {
        headers: token ? { "Authorization": `Bearer ${token}` } : {},
        credentials: "include",
      });
      if (!res.ok) throw new Error(`Failed: ${res.status}`);
      const data = await res.json();
      setAssets(data);
      setDebugInfo(`Fetched ${data.length} assets. First asset: ${JSON.stringify(data[0] || {}, null, 2)}`);
    } catch (err: unknown) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAssets();
  }, []);

  return (
    <div className="container mx-auto p-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2">
          <CardTitle>ADMIN Image Display Test (Same as test-images)</CardTitle>
          <Button onClick={fetchAssets} disabled={loading} variant="outline" data-testid="button-refresh">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Refresh
          </Button>
        </CardHeader>
        <CardContent>
          {loading && <div className="text-center py-8"><Loader2 className="h-8 w-8 animate-spin mx-auto" /></div>}
          
          {error && <div className="text-destructive p-4 rounded bg-destructive/10">{error}</div>}
          
          {debugInfo && (
            <div className="mb-4 p-3 bg-muted rounded text-xs font-mono whitespace-pre-wrap overflow-auto max-h-40">
              {debugInfo}
            </div>
          )}
          
          {!loading && !error && assets.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">No images found in database</div>
          )}
          
          {!loading && assets.length > 0 && (
            <div className="space-y-6">
              <p className="text-sm text-muted-foreground">Found {assets.length} images. Using SmartImage component:</p>
              
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {assets.slice(0, 8).map((asset) => (
                  <div key={asset.id} className="space-y-2">
                    <div className="aspect-square bg-muted rounded overflow-hidden border">
                      <SmartImage 
                        asset={asset}
                        alt={asset.name}
                        className="w-full h-full object-cover"
                        showErrorState={true}
                        retryOnError={true}
                      />
                    </div>
                    <p className="text-xs truncate font-medium">{asset.name}</p>
                    <p className="text-xs text-muted-foreground truncate">{asset.proxyUrl || asset.publicUrl}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
