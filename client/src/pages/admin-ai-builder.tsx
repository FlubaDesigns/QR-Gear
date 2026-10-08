import { Sparkles } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AI_BUILD_RULES } from '@shared/aiProductBuilder';
import AdminShell from '@/components/AdminShell';
import { ProductsHarness } from '@/features/adminProducts/ProductsHarness';

export default function AdminAiBuilder() {
  return <AdminShell title="AI Product Builder" icon={Sparkles}>
    <p className="mb-4 text-sm text-muted-foreground">Choose a product or resume a draft, describe your idea, then review the AI suggestion. Save and Generate use your current product build.</p>
    <Tabs defaultValue="build">
      <TabsList className="mb-4 h-auto w-full">
        <TabsTrigger value="build" className="min-h-12 flex-1">Build</TabsTrigger>
        <TabsTrigger value="rules" className="min-h-12 flex-1">AI Build Rules</TabsTrigger>
      </TabsList>
      <TabsContent value="build" forceMount className="data-[state=inactive]:hidden">
        <ProductsHarness aiBuilder showHeader={false} />
      </TabsContent>
      <TabsContent value="rules">
        <section className="rounded-xl border p-4 space-y-4" aria-label="AI build rules">
          <h2 className="text-lg font-semibold">QRG is the single source of truth</h2>
          <p className="text-sm text-muted-foreground">These same rules are included in every AI build request.</p>
          <ol className="list-decimal pl-5 space-y-4">{AI_BUILD_RULES.map(rule => <li key={rule}>{rule}</li>)}</ol>
        </section>
      </TabsContent>
    </Tabs>
  </AdminShell>;
}
