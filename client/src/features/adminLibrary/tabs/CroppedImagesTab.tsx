import { useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Loader2, Trash2, Crop as CropIcon } from "lucide-react";
import { SmartImage } from "@/components/SmartImage";
import type { BackgroundAssetWithProxy } from "../shared/types";

export default function CroppedImagesTab() {
  const { toast } = useToast();

  const { data: assets = [], isLoading, refetch } = useQuery<BackgroundAssetWithProxy[]>({
    queryKey: ["/api/admin/background-assets", "cropped"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/admin/background-assets?type=cropped");
      return res.json();
    },
    staleTime: 0,
    retry: 2,
  });

  useEffect(() => {
    refetch();
  }, [refetch]);

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/admin/background-assets/${id}`);
    },
    onSuccess: () => {
      toast({ title: "Image deleted" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/background-assets", "cropped"] });
    },
    onError: (error: any) => {
      toast({ title: "Delete failed", description: error.message, variant: "destructive" });
    },
  });

  if (isLoading) {
    return (
      <div className="text-center py-12">
        <Loader2 className="h-8 w-8 mx-auto animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold">{assets.length} Cropped Images</h3>
          <p className="text-sm text-muted-foreground">9:16 cropped images ready for product design</p>
        </div>
      </div>

      {assets.length === 0 ? (
        <Card className="text-center py-12">
          <CardContent>
            <CropIcon className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p className="text-muted-foreground">No cropped images yet.</p>
            <p className="text-sm text-muted-foreground mt-2">Cropped images appear here after you crop source images in the product builder.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
          {assets.map((asset) => (
            <Card key={asset.id} className="overflow-hidden" data-testid={`card-cropped-${asset.id}`}>
              <div className="aspect-[9/16] relative">
                <SmartImage asset={asset} alt={asset.name} className="w-full h-full object-cover" />
              </div>
              <CardContent className="p-2">
                <p className="text-xs truncate">{asset.name}</p>
                <Button
                  size="sm"
                  variant="ghost"
                  className="w-full mt-1 text-destructive hover:text-destructive"
                  onClick={() => deleteMutation.mutate(asset.id)}
                  data-testid={`button-delete-cropped-${asset.id}`}
                >
                  <Trash2 className="h-3 w-3 mr-1" />
                  Delete
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
