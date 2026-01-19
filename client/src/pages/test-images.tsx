import { useState, useEffect } from "react";
import { Loader2, RefreshCw } from "lucide-react";
import { SmartImage } from "@/components/SmartImage";

interface TestAsset {
  id: string;
  name: string;
  publicUrl: string;
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
    <div className="page-wrap">
      <div className="container mobile-compact mobile-compact-stack">
        <div className="glass-card">
          <h1 className="glass-title text-lg flex items-center gap-2 mb-4" data-testid="text-page-title">
            Image Display Test
          </h1>
          <button 
            className="qr-btn qr-btn--primary qr-btn--touch qr-btn--full qr-btn--xl"
            onClick={fetchAssets} 
            disabled={loading} 
            data-testid="button-refresh"
          >
            {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <RefreshCw className="h-5 w-5" />}
            Refresh
          </button>
        </div>

        <div className="glass-card">
          {loading && <div className="text-center py-8"><Loader2 className="h-8 w-8 animate-spin mx-auto text-blue-400" /></div>}
          
          {error && <div className="text-red-400 p-4 rounded bg-red-500/10 text-base">{error}</div>}
          
          {!loading && !error && assets.length === 0 && (
            <div className="text-center py-8 text-blue-200 text-base">No images found in database</div>
          )}
          
          {!loading && assets.length > 0 && (
            <div className="space-y-4">
              <p className="text-base text-blue-200">Found {assets.length} images:</p>
              
              <div className="grid grid-cols-2 gap-3">
                {assets.slice(0, 8).map((asset) => (
                  <div key={asset.id} className="space-y-2">
                    <div className="aspect-square bg-slate-800/50 rounded-lg overflow-hidden border border-blue-500/20">
                      <SmartImage 
                        asset={asset}
                        alt={asset.name}
                        className="w-full h-full object-cover"
                        showErrorState={true}
                        retryOnError={true}
                      />
                    </div>
                    <p className="text-base truncate text-blue-100">{asset.name}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
