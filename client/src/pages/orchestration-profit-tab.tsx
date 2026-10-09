import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";

export function ProfitTabContent() {
  const { data, error, isLoading, refetch } = useQuery<{
    paidOrders: number; revenue: number | null; netProfit: number | null; note: string;
    products: Array<{id:string; title:string; price:number|null; cost:number|null; estimatedContribution:number|null}>;
  }>({ queryKey: ["/api/admin/orchestration/profit/dashboard"] });
  const money = (value: number | null) => value === null ? "Not recorded" : `$${value.toFixed(2)}`;
  return <div className="space-y-4">
    <div className="flex items-center gap-4 flex-wrap"><h2 className="text-lg font-semibold">Profit &amp; Product Costs</h2><Button variant="outline" className="min-h-12" onClick={() => refetch()}>Refresh</Button></div>
    {error ? <p role="alert">Profit could not be loaded: {error.message}</p> : isLoading ? <p>Loading profit data…</p> : data && <>
      <div className="grid gap-4 sm:grid-cols-3">
        <Card><CardContent className="p-4"><p>Paid store orders</p><strong>{data.paidOrders}</strong></CardContent></Card>
        <Card><CardContent className="p-4"><p>Recorded revenue</p><strong data-testid="text-total-revenue">{money(data.revenue)}</strong></CardContent></Card>
        <Card><CardContent className="p-4"><p>Realized net profit</p><strong data-testid="text-net-profit">{money(data.netProfit)}</strong></CardContent></Card>
      </div>
      <p className="text-sm text-muted-foreground">{data.note}</p>
      <h3 className="font-semibold">Saved product estimates ({data.products.length})</h3>
      <p className="text-sm text-muted-foreground">Base selling price minus saved production, artwork, hosting, label and shipping costs. Payment and marketplace fees are excluded. Size increases are applied at checkout.</p>
      {data.products.map(p => <Card key={p.id}><CardContent className="p-4 space-y-2"><h4 className="font-medium">{p.title}</h4><div className="flex flex-wrap gap-4 text-sm"><span>Price: {money(p.price)}</span><span>Saved cost: {money(p.cost)}</span><span>Estimated contribution: {money(p.estimatedContribution)}</span></div></CardContent></Card>)}
    </>}
  </div>;
}
