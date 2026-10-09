import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";

export function RoutingTabContent() {
  const { data, error, isLoading, refetch } = useQuery<{products:Array<{id:string;title:string;provider:string|null;packetId:string|null;issues:string[]}>}>({queryKey:["/api/admin/orchestration/catalog"]});
  return <div className="space-y-4">
    <div className="flex gap-3 flex-wrap items-center"><h2 className="text-lg font-semibold">Saved Fulfillment Routing</h2><Button variant="outline" className="min-h-12" onClick={() => refetch()}>Refresh</Button><Button asChild className="min-h-12"><a href="/admin/orders">Orders &amp; Fulfillment</a></Button></div>
    <p>Checkout uses each product’s saved provider, exact size/color variant, registered print artwork and inside label. Verified payment triggers the existing Printful order handoff. Orders shows submission failures, retry and shipping updates.</p>
    <p className="text-sm text-muted-foreground">These are saved product checks. Checkout verifies the selected size/color and provider print area before payment. Products are never switched to another supplier automatically.</p>
    {error ? <p role="alert">Routing could not be loaded: {error.message}</p> : isLoading ? <p>Loading saved routing…</p> : data?.products.map(p => <Card key={p.id}><CardContent className="p-4 space-y-2"><h3 className="font-medium">{p.title}</h3><p>Saved provider: {p.provider || "Missing"}</p><p className="text-sm break-all">Packet: {p.packetId || "Missing"}</p>{p.issues.length ? p.issues.map(issue => <p key={issue} role="alert" className="text-destructive">{issue}</p>) : <p>Packet, provider, price and inside-label references agree.</p>}</CardContent></Card>)}
  </div>;
}
