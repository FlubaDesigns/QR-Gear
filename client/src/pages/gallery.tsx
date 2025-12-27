import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import SEO from "@/components/SEO";
import Navbar from "@/components/Navbar";
import BreadcrumbTrail from "@/components/BreadcrumbTrail";
import { Link } from "wouter";
import { Sparkles, ArrowRight, Flag } from "lucide-react";
import type { QrDesign, Product } from "@shared/schema";

interface GalleryDesign extends QrDesign {
  product?: Product;
}

export default function Gallery() {
  const { data: designs, isLoading } = useQuery<GalleryDesign[]>({
    queryKey: ["/api/gallery"],
  });

  const { data: products } = useQuery<Product[]>({
    queryKey: ["/api/products"],
  });

  const getProductForDesign = (design: GalleryDesign) => {
    if (design.product) return design.product;
    return products?.find(p => p.id === design.productId);
  };

  return (
    <div className="min-h-screen bg-background">
      <SEO
        title="Design Gallery - QR Code Merchandise Inspiration"
        description="Browse our gallery of custom QR code merchandise designs. Get inspired by real creations from our community. USA options available."
        keywords="QR code designs, custom merchandise gallery, QR gear examples, promotional product ideas"
        ogType="website"
      />
      <Navbar />
      <BreadcrumbTrail />
      
      <main className="container mx-auto px-4 py-8 max-w-7xl">
        <div className="text-center mb-12">
          <Badge variant="secondary" className="mb-4">
            <Sparkles className="w-3 h-3 mr-1" />
            Community Showcase
          </Badge>
          <h1 className="text-3xl md:text-4xl font-bold mb-4">
            Design Gallery
          </h1>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Get inspired by real QR code merchandise designs shared by our community. 
            Every design features high-quality printing. USA products available.
          </p>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {[...Array(8)].map((_, i) => (
              <Card key={i} className="overflow-hidden">
                <Skeleton className="aspect-square w-full" />
                <CardContent className="p-4">
                  <Skeleton className="h-5 w-3/4 mb-2" />
                  <Skeleton className="h-4 w-1/2" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : designs && designs.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {designs.map((design) => {
              const product = getProductForDesign(design);
              return (
                <Card 
                  key={design.id} 
                  className="overflow-hidden hover-elevate group"
                  data-testid={`card-gallery-design-${design.id}`}
                >
                  <div className="aspect-square bg-muted relative overflow-hidden">
                    {design.previewUrl ? (
                      <img
                        src={design.previewUrl}
                        alt={design.galleryTitle || design.name}
                        className="w-full h-full object-cover transition-transform group-hover:scale-105"
                        loading="lazy"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                        No Preview
                      </div>
                    )}
                    {design.madeInUSA && (
                      <Badge 
                        variant="secondary" 
                        className="absolute top-2 right-2 gap-1"
                      >
                        <Flag className="w-3 h-3" />
                        USA
                      </Badge>
                    )}
                  </div>
                  <CardContent className="p-4">
                    <h3 className="font-semibold mb-1 line-clamp-1">
                      {design.galleryTitle || design.name}
                    </h3>
                    {design.galleryDescription && (
                      <p className="text-sm text-muted-foreground line-clamp-2 mb-2">
                        {design.galleryDescription}
                      </p>
                    )}
                    {product && (
                      <p className="text-xs text-muted-foreground">
                        On {product.name}
                      </p>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-16">
            <Sparkles className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <h2 className="text-xl font-semibold mb-2">Gallery Coming Soon</h2>
            <p className="text-muted-foreground mb-6 max-w-md mx-auto">
              Be the first to share your design! Create a custom QR code product and 
              choose to share it with the community.
            </p>
            <Link href="/creator">
              <Button data-testid="button-create-design">
                Create Your Design
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </Link>
          </div>
        )}

        <div className="mt-16 text-center">
          <h2 className="text-2xl font-bold mb-4">Ready to Create Your Own?</h2>
          <p className="text-muted-foreground mb-6 max-w-xl mx-auto">
            Design your custom QR code merchandise in minutes. Choose from shirts, hats, 
            mugs, bags and more - all made in the USA.
          </p>
          <Link href="/creator">
            <Button size="lg" data-testid="button-start-creating">
              Start Creating
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </Link>
        </div>
      </main>
    </div>
  );
}
