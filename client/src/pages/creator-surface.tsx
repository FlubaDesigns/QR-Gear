import { useParams, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Loader2, ShoppingBag, Store, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

interface CreatorItem {
  id: string;
  title: string;
  description: string;
  itemImage: string | null;
  retailPrice: number | null;
  qrType: string | null;
  status: string;
}

interface CreatorSurfaceData {
  success: boolean;
  profile: {
    storeName: string;
    fullName: string;
    creatorSlug: string;
    memberId: string;
  };
  items: CreatorItem[];
  channelName?: string | null;
}

export default function CreatorSurface() {
  const params = useParams<{ creatorSlug: string }>();
  const creatorSlug = params.creatorSlug || "";

  const { data, isLoading, isError } = useQuery<CreatorSurfaceData>({
    queryKey: ["/api/public/creator", creatorSlug],
    queryFn: async () => {
      const res = await fetch(`/api/public/creator/${encodeURIComponent(creatorSlug)}`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as any).error || "Creator not found");
      }
      return res.json();
    },
    enabled: !!creatorSlug,
    retry: false,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-400" />
      </div>
    );
  }

  if (isError || !data?.profile) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center gap-4 text-center px-4">
        <Store className="w-16 h-16 text-slate-600" />
        <h1 className="text-2xl font-bold text-white">Creator not found</h1>
        <p className="text-slate-400">The link you followed may be expired or incorrect.</p>
        <Button variant="outline" asChild>
          <Link href="/">Go to QR Gear</Link>
        </Button>
      </div>
    );
  }

  const { profile, items, channelName } = data;
  const displayName = profile.storeName || profile.fullName;
  const publishedItems = items.filter((item) => item.status === "published");

  return (
    <div className="min-h-screen bg-slate-950">
      <div className="bg-gradient-to-b from-slate-900 to-slate-950 border-b border-slate-800">
        <div className="max-w-4xl mx-auto px-4 py-8">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-2">
              <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-xs">
                QR Gear Creator
              </Badge>
              <h1
                className="text-3xl font-bold text-white"
                data-testid="text-creator-store-name"
              >
                {displayName}
              </h1>
              {channelName && (
                <p className="text-slate-400 text-sm">{channelName}</p>
              )}
            </div>
            <Button
              variant="outline"
              size="sm"
              className="border-slate-700 text-slate-300"
              asChild
            >
              <Link href="/">
                <ArrowLeft className="w-4 h-4 mr-1" />
                QR Gear
              </Link>
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-8">
        {publishedItems.length === 0 ? (
          <div className="text-center py-16 text-slate-500">
            <ShoppingBag className="w-12 h-12 mx-auto mb-3 opacity-40" />
            <p className="text-lg">No products available yet.</p>
            <p className="text-sm mt-1">Check back soon.</p>
          </div>
        ) : (
          <>
            <p className="text-slate-400 text-sm mb-6">
              {publishedItems.length}{" "}
              {publishedItems.length === 1 ? "product" : "products"}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {publishedItems.map((item) => (
                <Link key={item.id} href={`/p/${item.id}`}>
                  <Card
                    className="bg-slate-800/50 border-slate-700 hover-elevate cursor-pointer"
                    data-testid={`card-creator-item-${item.id}`}
                  >
                    {item.itemImage ? (
                      <div className="aspect-square bg-slate-900">
                        <img
                          src={item.itemImage}
                          alt={item.title}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    ) : (
                      <div className="aspect-square bg-slate-900 flex items-center justify-center">
                        <ShoppingBag className="w-12 h-12 text-slate-700" />
                      </div>
                    )}
                    <CardContent className="p-3">
                      <p className="text-white font-medium text-sm leading-snug line-clamp-2">
                        {item.title}
                      </p>
                      {item.retailPrice != null && (
                        <p className="text-emerald-400 text-sm font-semibold mt-1">
                          ${item.retailPrice.toFixed(2)}
                        </p>
                      )}
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          </>
        )}
      </div>

      <div className="border-t border-slate-800 mt-8">
        <div className="max-w-4xl mx-auto px-4 py-6 text-center">
          <p className="text-slate-600 text-xs">
            Powered by{" "}
            <Link href="/" className="text-slate-500 hover:text-slate-400">
              QR Gear
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
