import { useQuery } from "@tanstack/react-query";
import { useParams } from "wouter";
import { nexusFetch } from "@/lib/nexusFetch";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { RefreshCw } from "lucide-react";
import BreadcrumbTrail from "@/components/BreadcrumbTrail";

interface DynamicPageInfo {
  title: string;
  description: string | null;
  image: {
    url: string;
    title: string | null;
  } | null;
}

export default function ViewDynamic() {
  const params = useParams();
  const slug = params.slug;

  const { data: pageInfo, isLoading, error } = useQuery<DynamicPageInfo>({
    queryKey: ['/api/dynamic', slug],
    queryFn: async () => {
      const res = await nexusFetch(`/api/dynamic/${slug}`, { source: "view-dynamic:load", tries: 3 });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to load page");
      }
      return res.json();
    },
    enabled: !!slug,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-2xl w-full">
          <CardContent className="p-6 space-y-4">
            <Skeleton className="h-8 w-3/4" />
            <Skeleton className="aspect-square w-full rounded-lg" />
            <Skeleton className="h-4 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error || !pageInfo) {
    const errorMessage = (error as any)?.message || "Page not found";
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="p-6 text-center">
            <RefreshCw className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <h1 className="text-xl font-semibold text-foreground mb-2">Page Not Available</h1>
            <p className="text-muted-foreground">
              {errorMessage.includes("expired") 
                ? "This dynamic page has expired."
                : "This page may have been removed or the link is invalid."}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <BreadcrumbTrail />
      <div className="max-w-3xl mx-auto p-4 py-8">
        <Card className="overflow-hidden">
          {pageInfo.image ? (
            <div className="relative bg-muted">
              <img
                src={pageInfo.image.url}
                alt={pageInfo.image.title || pageInfo.title}
                className="w-full h-auto max-h-[70vh] object-contain"
                data-testid="img-dynamic-content"
              />
            </div>
          ) : (
            <div className="aspect-video bg-muted flex items-center justify-center">
              <div className="text-center text-muted-foreground">
                <RefreshCw className="h-16 w-16 mx-auto mb-4 opacity-50" />
                <p className="text-lg font-medium">Content Coming Soon</p>
                <p className="text-sm">The owner hasn't uploaded an image yet.</p>
              </div>
            </div>
          )}
          
          <CardContent className="p-6">
            <h1 className="text-2xl font-bold text-foreground mb-2" data-testid="text-dynamic-title">
              {pageInfo.title}
            </h1>
            
            {pageInfo.description && (
              <p className="text-muted-foreground" data-testid="text-dynamic-description">
                {pageInfo.description}
              </p>
            )}

            <div className="mt-6 pt-4 border-t border-border">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <RefreshCw className="h-4 w-4" />
                <span>Dynamic QR Page - Content may change</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="mt-4 text-center">
          <p className="text-xs text-muted-foreground">
            Powered by <a href="/" className="text-primary hover:underline">QR Gear</a>
          </p>
        </div>
      </div>
    </div>
  );
}
