import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, RefreshCw } from "lucide-react";

interface TestAsset {
  id: string;
  name: string;
  publicUrl: string;
  proxyUrl: string;
  storageUrl: string;
}

export default function TestImagesPage() {
  const [assets, setAssets] = useState<TestAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAssets = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/test-images");
      if (!res.ok) throw new Error(`Failed: ${res.status}`);
      const data = await res.json();
      setAssets(data);
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
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Image Display Test (No Auth)</CardTitle>
          <Button onClick={fetchAssets} disabled={loading} variant="outline">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Refresh
          </Button>
        </CardHeader>
        <CardContent>
          {loading && <div className="text-center py-8"><Loader2 className="h-8 w-8 animate-spin mx-auto" /></div>}
          
          {error && <div className="text-destructive p-4 rounded bg-destructive/10">{error}</div>}
          
          {!loading && !error && assets.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">No images found in database</div>
          )}
          
          {!loading && assets.length > 0 && (
            <div className="space-y-6">
              <p className="text-sm text-muted-foreground">Found {assets.length} images. Testing direct display:</p>
              
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {assets.slice(0, 8).map((asset) => (
                  <div key={asset.id} className="space-y-2">
                    <div className="aspect-square bg-muted rounded overflow-hidden border">
                      <img 
                        src={asset.proxyUrl} 
                        alt={asset.name}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          target.style.display = 'none';
                          target.parentElement!.innerHTML = `<div class="flex items-center justify-center h-full text-destructive text-xs p-2">Failed to load</div>`;
                        }}
                        onLoad={() => console.log(`Loaded: ${asset.name}`)}
                      />
                    </div>
                    <p className="text-xs truncate">{asset.name}</p>
                    <p className="text-xs text-muted-foreground truncate">{asset.proxyUrl}</p>
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
