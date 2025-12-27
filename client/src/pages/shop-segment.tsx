import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, ArrowLeft, Store, Star, Sparkles, QrCode } from "lucide-react";
import BreadcrumbTrail from "@/components/BreadcrumbTrail";

interface StoreProduct {
  id: string;
  name: string;
  imageUrl: string | null;
  segment: string | null;
  isFeatured: boolean;
  isSeasonalPromo: boolean;
  templateVariant: string | null;
  createdAt: string;
}

interface StoreResponse {
  storeType: string;
  storeName: string;
  segment: string | null;
  products: StoreProduct[];
}

export default function ShopSegmentPage() {
  const params = useParams<{ storeType: string; storeName: string; segment?: string }>();
  
  const storeType = params.storeType || "Internal";
  const storeName = decodeURIComponent(params.storeName || "");
  const segment = params.segment ? decodeURIComponent(params.segment) : undefined;
  
  const apiUrl = segment 
    ? `/api/store/${storeType}/${encodeURIComponent(storeName)}?segment=${encodeURIComponent(segment)}`
    : `/api/store/${storeType}/${encodeURIComponent(storeName)}`;
  
  const { data, isLoading, error } = useQuery<StoreResponse>({
    queryKey: ["/api/store", storeType, storeName, segment],
    queryFn: async () => {
      const res = await fetch(apiUrl);
      if (!res.ok) throw new Error("Failed to load store products");
      return res.json();
    },
    enabled: !!storeName,
  });

  if (!storeName) {
    return (
      <div className="container max-w-6xl py-8 px-4">
        <div className="text-center py-16">
          <Store className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
          <h1 className="text-2xl font-bold mb-2">Store Not Found</h1>
          <p className="text-muted-foreground mb-4">Please select a valid store to browse.</p>
          <Link href="/">
            <Button className="h-12" data-testid="button-go-home">
              <ArrowLeft className="mr-2 h-5 w-5" />
              Back to Home
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="container max-w-6xl py-8 px-4">
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <span className="ml-3 text-muted-foreground">Loading products...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container max-w-6xl py-8 px-4">
        <div className="text-center py-16">
          <Store className="h-16 w-16 mx-auto mb-4 text-destructive" />
          <h1 className="text-2xl font-bold mb-2">Error Loading Store</h1>
          <p className="text-muted-foreground mb-4">{(error as Error).message}</p>
          <Link href="/">
            <Button className="h-12" data-testid="button-go-home-error">
              <ArrowLeft className="mr-2 h-5 w-5" />
              Back to Home
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  const displayTitle = segment 
    ? `${storeName} - ${segment}` 
    : storeName;

  return (
    <div className="container max-w-6xl py-8 px-4">
      <BreadcrumbTrail />
      <Link href="/">
        <Button 
          variant="ghost" 
          className="mb-6 h-12 px-4"
          data-testid="button-back-home"
        >
          <ArrowLeft className="mr-2 h-5 w-5" />
          Back to Home
        </Button>
      </Link>

      <div className="text-center mb-8">
        <div className="inline-flex items-center gap-3 mb-4">
          <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
            <Store className="h-6 w-6 text-primary" />
          </div>
          <h1 className="text-3xl md:text-4xl font-bold">{displayTitle}</h1>
        </div>
        {segment && (
          <p className="text-muted-foreground">
            Showing products in the "{segment}" section
          </p>
        )}
      </div>

      {data?.products.length === 0 ? (
        <Card className="max-w-md mx-auto">
          <CardContent className="py-12 text-center">
            <QrCode className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-lg text-muted-foreground mb-2">No products available yet</p>
            <p className="text-sm text-muted-foreground">
              Check back soon for new QR Gear products!
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {data?.products.map((product) => (
            <Link key={product.id} href={`/customs/${product.id}`}>
              <Card 
                className="hover-elevate cursor-pointer h-full flex flex-col overflow-hidden"
                data-testid={`card-product-${product.id}`}
              >
                <div className="aspect-square relative bg-muted">
                  {product.imageUrl ? (
                    <img 
                      src={product.imageUrl} 
                      alt={product.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <QrCode className="h-16 w-16 text-muted-foreground/50" />
                    </div>
                  )}
                  {(product.isFeatured || product.isSeasonalPromo) && (
                    <div className="absolute top-2 left-2 flex gap-1">
                      {product.isFeatured && (
                        <Badge variant="default" className="gap-1">
                          <Star className="h-3 w-3" />
                          Featured
                        </Badge>
                      )}
                      {product.isSeasonalPromo && (
                        <Badge variant="secondary" className="gap-1">
                          <Sparkles className="h-3 w-3" />
                          Promo
                        </Badge>
                      )}
                    </div>
                  )}
                </div>
                <CardContent className="flex-1 p-4">
                  <h3 className="font-semibold text-lg line-clamp-2" data-testid={`text-product-name-${product.id}`}>
                    {product.name}
                  </h3>
                  {product.templateVariant && (
                    <Badge variant="outline" className="mt-2 text-xs">
                      {product.templateVariant === "external-url" ? "External Link" :
                       product.templateVariant === "plain-text" ? "Text QR" :
                       product.templateVariant === "dynamics" ? "Dynamic" : "Hosted Image"}
                    </Badge>
                  )}
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
