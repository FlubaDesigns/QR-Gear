import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";

type PricingPreview = {dryRun:boolean; previewToken:string; productsUpdated:number; productsToUpdate:number; markupPercent:number; markupFixed:number; products:Array<{id:string;title:string;currentPrice:number;customerPrice:number;restoreInsideLabel:boolean}>; blocked:Array<{id:string;title:string;reason:string}>};
export function RepricingTabContent() {
  const [preview, setPreview] = useState<PricingPreview | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const run = useMutation({
    mutationFn: async (token?: string) => {
      const response = await apiRequest("POST", "/api/admin/pricing-settings/sync", token ? {previewToken:token} : {});
      return response.json() as Promise<PricingPreview>;
    },
    onMutate: () => {setResult(null);},
    onSuccess: data => {
      setPreview(data.dryRun ? data : null);
      if (!data.dryRun) {setResult(`Applied saved pricing to ${data.productsUpdated} products and their linked packets.`); void queryClient.invalidateQueries();}
    },
    onError: () => setPreview(null),
  });
  return <div className="space-y-4">
    <h2 className="text-lg font-semibold">Reprice Saved Products</h2>
    <p>Uses the same saved pricing settings and preview/apply service as Admin Pricing. Review every proposed price before applying.</p>
    <div className="flex gap-3 flex-wrap"><Button className="min-h-12" disabled={run.isPending} onClick={() => run.mutate(undefined)} data-testid="button-preview-repricing">{run.isPending ? "Checking…" : "Preview Saved Pricing"}</Button><Button asChild variant="outline" className="min-h-12"><a href="/admin/pricing">Edit Pricing Settings</a></Button></div>
    {run.error && <p role="alert" className="text-destructive">Pricing was not applied: {run.error.message}</p>}
    {result && <p role="status">{result}</p>}
    {preview && <>
      <p>Saved markup: {preview.markupPercent}% + ${preview.markupFixed.toFixed(2)}. {preview.productsToUpdate} products would change; {preview.blocked.length} need attention.</p>
      {preview.products.map(p => <Card key={p.id}><CardContent className="p-4"><h3 className="font-medium">{p.title}</h3><p>${p.currentPrice.toFixed(2)} → ${p.customerPrice.toFixed(2)}</p>{p.restoreInsideLabel && <p>Restore required inside label</p>}</CardContent></Card>)}
      {preview.blocked.map(p => <p key={p.id} role="alert" className="text-destructive">{p.title}: {p.reason}</p>)}
      <Button className="min-h-12" disabled={run.isPending || preview.blocked.length > 0 || preview.productsToUpdate === 0} onClick={() => run.mutate(preview.previewToken)} data-testid="button-run-repricing">Apply Previewed Pricing</Button>
      <p className="text-sm text-muted-foreground">A changed product or pricing setting invalidates this preview. External marketplace prices are published separately.</p>
    </>}
  </div>;
}
