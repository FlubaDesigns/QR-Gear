import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Loader2, Upload } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import type { MasterProduct, ChannelConfig } from "@shared/schema";
import type { BulkPublishJob } from "./orchestration-types";
import { adminFetch } from "@/lib/adminFetch";

export function BulkPublishDialog({
  products,
  channelConfigs,
}: {
  products: MasterProduct[];
  channelConfigs: ChannelConfig[];
}) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [selectedProducts, setSelectedProducts] = useState<string[]>([]);
  const [selectedChannels, setSelectedChannels] = useState<string[]>([]);
  const [activeJob, setActiveJob] = useState<BulkPublishJob | null>(null);
  const [polling, setPolling] = useState(false);


  const startBulkPublishMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/admin/orchestration/bulk-publish", {
        productIds: selectedProducts,
        channelTypes: selectedChannels,
      });
      return res.json() as Promise<{ jobId: string }>;
    },
    onSuccess: async (data: { jobId: string }) => {
      toast({ title: "Bulk publish started" });
      setPolling(true);
      pollJob(data.jobId);
    },
    onError: (error: Error) => {
      toast({ title: "Failed to start bulk publish", description: error.message, variant: "destructive" });
    },
  });

  const pollJob = async (jobId: string) => {
    try {
      const job: BulkPublishJob = await adminFetch<BulkPublishJob>(`/orchestration/bulk-publish/${jobId}`);
      setActiveJob(job);
      
      if (job.status === "pending" || job.status === "running") {
        setTimeout(() => pollJob(jobId), 1000);
      } else {
        setPolling(false);
        queryClient.invalidateQueries({ queryKey: ["/api/admin/orchestration/master-products"] });
      }
    } catch (err) {
      console.error("Failed to poll job:", err);
      setPolling(false);
    }
  };

  const enabledChannels = channelConfigs.filter(c => c.isEnabled);
  const activeProducts = products.filter(p => p.status === "active");

  const toggleAllProducts = () => {
    if (selectedProducts.length === activeProducts.length) {
      setSelectedProducts([]);
    } else {
      setSelectedProducts(activeProducts.map(p => p.id));
    }
  };

  const toggleAllChannels = () => {
    if (selectedChannels.length === enabledChannels.length) {
      setSelectedChannels([]);
    } else {
      setSelectedChannels(enabledChannels.map(c => c.channelType));
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="h-12" data-testid="button-bulk-publish">
          <Upload className="w-5 h-5 mr-2" />
          Bulk Publish
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Bulk Publish Products</DialogTitle>
          <DialogDescription>
            Publish multiple products to multiple channels at once.
          </DialogDescription>
        </DialogHeader>
        
        {activeJob ? (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Badge variant={
                activeJob.status === "completed" ? "default" :
                activeJob.status === "failed" ? "destructive" :
                "secondary"
              }>
                {activeJob.status}
              </Badge>
              <span className="text-sm text-muted-foreground">
                {activeJob.completedItems} / {activeJob.totalItems} items
              </span>
            </div>
            
            {polling && (
              <div className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-sm">Publishing in progress...</span>
              </div>
            )}
            
            <Progress value={(activeJob.completedItems / activeJob.totalItems) * 100} />
            
            <div className="flex gap-4 text-sm">
              <span className="text-green-600">Success: {activeJob.successCount}</span>
              <span className="text-red-600">Failed: {activeJob.failureCount}</span>
            </div>
            
            {activeJob.results.length > 0 && (
              <div className="border rounded-md max-h-60 overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted sticky top-0">
                    <tr>
                      <th className="text-left p-2">Product</th>
                      <th className="text-left p-2">Channel</th>
                      <th className="text-left p-2">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activeJob.results.map((r, i) => (
                      <tr key={i} className="border-t">
                        <td className="p-2 truncate max-w-[150px]">{r.productTitle}</td>
                        <td className="p-2">{r.channelType}</td>
                        <td className="p-2">
                          {r.success ? (
                            <Badge variant="default">Published</Badge>
                          ) : (
                            <Badge variant="destructive" title={r.error}>Failed</Badge>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            
            {!polling && (
              <DialogFooter>
                <Button 
                  onClick={() => { setActiveJob(null); setSelectedProducts([]); setSelectedChannels([]); }}
                  className="h-12"
                  data-testid="button-bulk-publish-done"
                >
                  Done
                </Button>
              </DialogFooter>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between gap-2 mb-2">
                <Label>Select Products</Label>
                <Button 
                  variant="ghost" 
                  onClick={toggleAllProducts}
                  className="h-12"
                  data-testid="button-toggle-all-products"
                >
                  {selectedProducts.length === activeProducts.length ? "Deselect All" : "Select All"}
                </Button>
              </div>
              <div className="border rounded-md p-2 max-h-40 overflow-y-auto">
                {activeProducts.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-2">
                    No active products available
                  </p>
                ) : (
                  activeProducts.map((product) => (
                    <label 
                      key={product.id} 
                      className="flex items-center gap-2 p-2 hover-elevate rounded cursor-pointer min-h-12"
                      data-testid={`label-bulk-product-${product.id}`}
                    >
                      <input
                        type="checkbox"
                        checked={selectedProducts.includes(product.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedProducts([...selectedProducts, product.id]);
                          } else {
                            setSelectedProducts(selectedProducts.filter((id) => id !== product.id));
                          }
                        }}
                        className="w-5 h-5"
                        data-testid={`checkbox-bulk-product-${product.id}`}
                      />
                      <span className="text-sm flex-1 truncate">{product.title}</span>
                      <code className="text-xs text-muted-foreground">{product.sku}</code>
                    </label>
                  ))
                )}
              </div>
            </div>
            
            <div>
              <div className="flex items-center justify-between gap-2 mb-2">
                <Label>Select Channels</Label>
                <Button 
                  variant="ghost" 
                  onClick={toggleAllChannels}
                  className="h-12"
                  data-testid="button-toggle-all-channels"
                >
                  {selectedChannels.length === enabledChannels.length ? "Deselect All" : "Select All"}
                </Button>
              </div>
              <div className="border rounded-md p-2 max-h-40 overflow-y-auto">
                {enabledChannels.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-2">
                    No channels enabled
                  </p>
                ) : (
                  enabledChannels.map((config) => (
                    <label 
                      key={config.channelType} 
                      className="flex items-center gap-2 p-2 hover-elevate rounded cursor-pointer min-h-12"
                      data-testid={`label-bulk-channel-${config.channelType}`}
                    >
                      <input
                        type="checkbox"
                        checked={selectedChannels.includes(config.channelType)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedChannels([...selectedChannels, config.channelType]);
                          } else {
                            setSelectedChannels(selectedChannels.filter((t) => t !== config.channelType));
                          }
                        }}
                        className="w-5 h-5"
                        data-testid={`checkbox-bulk-channel-${config.channelType}`}
                      />
                      <span className="text-sm">{config.displayName}</span>
                    </label>
                  ))
                )}
              </div>
            </div>
            
            <div className="text-sm text-muted-foreground">
              Will publish {selectedProducts.length} products to {selectedChannels.length} channels
              ({selectedProducts.length * selectedChannels.length} total operations)
            </div>
            
            <DialogFooter>
              <Button 
                onClick={() => startBulkPublishMutation.mutate()}
                disabled={startBulkPublishMutation.isPending || selectedProducts.length === 0 || selectedChannels.length === 0}
                className="h-12"
                data-testid="button-start-bulk-publish"
              >
                {startBulkPublishMutation.isPending ? (
                  <Loader2 className="w-5 h-5 animate-spin mr-2" />
                ) : (
                  <Upload className="w-5 h-5 mr-2" />
                )}
                Start Publishing
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
