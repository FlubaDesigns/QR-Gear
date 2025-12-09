import { useQuery } from "@tanstack/react-query";
import { useParams } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Eye, Calendar, Building2 } from "lucide-react";

interface HostedImageInfo {
  id: string;
  title: string | null;
  description: string | null;
  businessName: string | null;
  businessLogo: string | null;
  views: number;
  createdAt: string;
}

export default function ViewImage() {
  const params = useParams();
  const imageId = params.id;

  const { data: imageInfo, isLoading, error } = useQuery<HostedImageInfo>({
    queryKey: ['/api/images/info', imageId],
    enabled: !!imageId,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-2xl w-full">
          <CardContent className="p-6 space-y-4">
            <Skeleton className="h-8 w-3/4" />
            <Skeleton className="aspect-square w-full rounded-lg" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-2/3" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error || !imageInfo) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="p-6 text-center">
            <h1 className="text-xl font-semibold text-foreground mb-2">Image Not Found</h1>
            <p className="text-muted-foreground">
              This image may have been removed or the link is invalid.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const imageUrl = `/api/images/${imageId}`;
  const formattedDate = new Date(imageInfo.createdAt).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-3xl mx-auto p-4 py-8">
        {imageInfo.businessName && (
          <div className="flex items-center gap-3 mb-6">
            {imageInfo.businessLogo ? (
              <img 
                src={imageInfo.businessLogo} 
                alt={imageInfo.businessName}
                className="h-12 w-12 rounded-full object-cover"
              />
            ) : (
              <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                <Building2 className="h-6 w-6 text-primary" />
              </div>
            )}
            <div>
              <h2 className="font-semibold text-lg text-foreground" data-testid="text-business-name">
                {imageInfo.businessName}
              </h2>
              <p className="text-sm text-muted-foreground">Shared via QR Gear</p>
            </div>
          </div>
        )}

        <Card className="overflow-hidden">
          <div className="relative bg-muted">
            <img
              src={imageUrl}
              alt={imageInfo.title || "Hosted image"}
              className="w-full h-auto max-h-[70vh] object-contain"
              data-testid="img-hosted-image"
            />
          </div>
          
          <CardContent className="p-6">
            {imageInfo.title && (
              <h1 className="text-2xl font-bold text-foreground mb-2" data-testid="text-image-title">
                {imageInfo.title}
              </h1>
            )}
            
            {imageInfo.description && (
              <p className="text-muted-foreground mb-4" data-testid="text-image-description">
                {imageInfo.description}
              </p>
            )}

            <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
              <div className="flex items-center gap-1.5">
                <Eye className="h-4 w-4" />
                <span data-testid="text-view-count">{imageInfo.views} views</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Calendar className="h-4 w-4" />
                <span data-testid="text-created-date">{formattedDate}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="mt-8 text-center">
          <p className="text-sm text-muted-foreground mb-2">
            Create your own QR codes with custom images
          </p>
          <a 
            href="/"
            className="text-primary hover:underline font-medium"
            data-testid="link-qrgear-home"
          >
            Visit QR Gear
          </a>
        </div>

        <footer className="mt-12 pt-6 border-t text-center">
          <p className="text-xs text-muted-foreground">
            Powered by{" "}
            <a href="/" className="text-primary hover:underline">QR Gear</a>
            {" "}- Custom QR Code Merchandise
          </p>
        </footer>
      </div>
    </div>
  );
}
