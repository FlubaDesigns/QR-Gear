import { Sparkles } from 'lucide-react';
import AdminShell from '@/components/AdminShell';
import { ProductsHarness } from '@/features/adminProducts/ProductsHarness';

export default function AdminAiBuilder() {
  return <AdminShell title="AI Product Builder" icon={Sparkles}>
    <p className="mb-4 text-sm text-muted-foreground">Choose a product or resume a draft, describe your idea, then review the AI suggestion. Save and Generate use your current product build.</p>
    <ProductsHarness aiBuilder showHeader={false} />
  </AdminShell>;
}
