import { useParams, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Loader2, ShoppingBag, Store, ArrowLeft, Instagram, Facebook, Youtube, MessageSquare } from "lucide-react";
import { SiTiktok } from "react-icons/si";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import SEO from "@/components/SEO";

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
    socialHandle?: string;
    primarySocial?: string;
  };
  items: CreatorItem[];
  channelName?: string | null;
}

const SOCIAL_ICONS: Record<string, JSX.Element> = {
  instagram: <Instagram className="w-4 h-4" />,
  facebook: <Facebook className="w-4 h-4" />,
  tiktok: <SiTiktok className="w-4 h-4" />,
  x: <MessageSquare className="w-4 h-4" />,
  youtube: <Youtube className="w-4 h-4" />,
};

const SOCIAL_URL_MAP: Record<string, (handle: string) => string> = {
  instagram: (h) => `https://instagram.com/${h.replace("@", "")}`,
  tiktok: (h) => `https://tiktok.com/@${h.replace("@", "")}`,
  x: (h) => `https://x.com/${h.replace("@", "")}`,
  youtube: (h) => `https://youtube.com/@${h.replace("@", "")}`,
  facebook: (h) => `https://facebook.com/${h.replace("@", "")}`,
};

function getInitials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join("");
}

export default function CreatorSurface() {
  const params = useParams<{ creatorSlug: string; channelId?: string }>();
  const creatorSlug = params.creatorSlug || "";
  const channelId = params.channelId || "";

  const apiUrl = channelId
    ? `/api/public/creator/${encodeURIComponent(creatorSlug)}?channel=${encodeURIComponent(channelId)}`
    : `/api/public/creator/${encodeURIComponent(creatorSlug)}`;

  const { data, isLoading, isError } = useQuery<CreatorSurfaceData>({
    queryKey: ["/api/public/creator", creatorSlug, channelId],
    queryFn: async () => {
      const res = await fetch(apiUrl);
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
      <>
        <SEO title="Creator Not Found | QR Gear" description="This creator page could not be found." />
        <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center gap-4 text-center px-4">
          <Store className="w-16 h-16 text-slate-600" />
          <h1 className="text-2xl font-bold text-white">Creator not found</h1>
          <p className="text-slate-400">The link you followed may be expired or incorrect.</p>
          <div className="flex gap-3 flex-wrap justify-center">
            <Button variant="outline" asChild>
              <Link href="/">Go to QR Gear</Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/shop/internal/qrgear">Browse Products</Link>
            </Button>
          </div>
        </div>
      </>
    );
  }

  const { profile, items, channelName } = data;
  const displayName = profile.storeName || profile.fullName;
  const initials = getInitials(displayName);
  const publishedItems = items.filter((item) => item.status === "published");
  const refParam = `?ref=${encodeURIComponent(profile.memberId)}`;
  const firstImage = publishedItems.find((i) => i.itemImage)?.itemImage || undefined;
  const pageTitle = channelName ? `${displayName} — ${channelName}` : displayName;
  const pageDescription = `Shop QR-powered products from ${displayName} on QR Gear.`;
  const socialPlatform = profile.primarySocial?.toLowerCase();
  const socialHandle = profile.socialHandle;
  const socialUrl =
    socialPlatform && socialHandle && SOCIAL_URL_MAP[socialPlatform]
      ? SOCIAL_URL_MAP[socialPlatform](socialHandle)
      : null;
  const socialIcon = socialPlatform ? SOCIAL_ICONS[socialPlatform] : null;

  return (
    <>
      <SEO
        title={pageTitle}
        description={pageDescription}
        ogImage={firstImage}
        ogType="website"
        ogUrl={typeof window !== "undefined" ? window.location.href : undefined}
      />

      <div className="min-h-screen bg-slate-950">
        {/* Header */}
        <div className="bg-gradient-to-b from-slate-900 to-slate-950 border-b border-slate-800">
          <div className="max-w-4xl mx-auto px-4 py-8">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="flex items-start gap-4">
                <Avatar className="w-14 h-14 shrink-0">
                  <AvatarFallback className="bg-emerald-900/60 text-emerald-300 text-lg font-bold">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <div className="space-y-1">
                  <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-xs">
                    QR Gear Creator
                  </Badge>
                  <h1
                    className="text-2xl font-bold text-white leading-tight"
                    data-testid="text-creator-store-name"
                  >
                    {displayName}
                  </h1>
                  <div className="flex items-center gap-3 flex-wrap">
                    {channelName && (
                      <span className="text-slate-400 text-sm">{channelName}</span>
                    )}
                    {socialUrl && socialHandle && (
                      <a
                        href={socialUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1.5 text-slate-400 hover:text-slate-200 text-sm transition-colors"
                        data-testid="link-creator-social"
                      >
                        {socialIcon}
                        <span>{socialHandle.startsWith("@") ? socialHandle : `@${socialHandle}`}</span>
                      </a>
                    )}
                  </div>
                </div>
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

        {/* Items Grid */}
        <div className="max-w-4xl mx-auto px-4 py-8">
          {publishedItems.length === 0 ? (
            <div className="text-center py-16 space-y-4">
              <ShoppingBag className="w-12 h-12 mx-auto text-slate-700 opacity-60" />
              <p className="text-slate-400 text-lg">No products available yet.</p>
              <p className="text-slate-500 text-sm">Check back soon, or browse the full QR Gear store.</p>
              <Button variant="outline" size="sm" className="border-slate-700 text-slate-300 mt-2" asChild>
                <Link href="/shop/internal/qrgear">Browse QR Gear</Link>
              </Button>
            </div>
          ) : (
            <>
              <p className="text-slate-400 text-sm mb-6">
                {publishedItems.length}{" "}
                {publishedItems.length === 1 ? "product" : "products"}
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                {publishedItems.map((item) => (
                  <Link key={item.id} href={`/p/${item.id}${refParam}`}>
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

        {/* Footer */}
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
    </>
  );
}
