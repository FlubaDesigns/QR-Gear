import { useState, useEffect, Component } from "react";
import type { ReactNode, ErrorInfo } from "react";
import { useLocation } from "wouter";
import { Layers } from "lucide-react";
import { ScrollGridView } from "@/features/shared/components/views/ScrollGridView";
import { SinglePaneViewer } from "@/features/shared/components/viewers/SinglePaneViewer";
import { TemplateCardSkin } from "@/features/shared/components/skins/TemplateSkin";
import { TemplateShape } from "@/features/shared/components/shapes/TemplateShape";
import { DeleteTemplateDialog } from "@/features/shared/components/DeleteTemplateDialog";
import { useTemplateLibrary, templateToSkinItem } from "@/features/shared/templateLibrary";

// Fix 5: Error boundary so crashes are recoverable
class TemplatesBoundary extends Component<
  { children: ReactNode },
  { hasError: boolean; error: Error | null }
> {
  state = { hasError: false, error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[TemplatesTab] CRASH:", error.message, error.stack);
    console.error("[TemplatesTab] Component stack:", info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-6 bg-destructive/10 border border-destructive rounded-lg">
          <h3 className="font-bold text-lg mb-2">Templates Error</h3>
          <p className="text-sm mb-2">{this.state.error?.message}</p>
          <pre className="text-xs overflow-auto max-h-40 bg-black/20 p-2 rounded">
            {this.state.error?.stack}
          </pre>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            className="mt-3 px-4 py-2 bg-primary text-primary-foreground rounded"
            data-testid="button-retry-templates"
          >
            Retry
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

// VVSS 1·1·1·1: SinglePaneViewer → ScrollGridView → TemplateCardSkin → TemplateShape.
function TemplatesTabInner() {
  const [, navigate] = useLocation();
  const { data: templates = [], isLoading, error } = useTemplateLibrary();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const items = templates.map(templateToSkinItem);
  const selectedIndex = items.findIndex(item => item.id === selectedId);
  const selectedItem = items[selectedIndex] ?? null;
  useEffect(() => { if (selectedId && !templates.some(item => item.id === selectedId)) setSelectedId(null); }, [templates, selectedId]);
  return (
    <SinglePaneViewer>
      {error && <div className="p-4 border border-destructive rounded-md" role="alert">Failed to load templates: {error.message}</div>}
      <h3 className="text-lg font-semibold mb-4" data-testid="text-template-count">{templates.length} Templates</h3>
      <ScrollGridView items={items} isLoading={isLoading} columns="grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5" height="auto" footer={null}
        emptyMessage="No saved product templates yet." emptyIcon={<Layers className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />}
        renderItem={item => <TemplateCardSkin item={item} onClick={() => setSelectedId(item.id)} />} />
      <TemplateShape open={!!selectedItem} item={selectedItem} onClose={() => setSelectedId(null)}
        hasPrev={selectedIndex > 0} hasNext={selectedIndex >= 0 && selectedIndex < items.length - 1}
        onPrev={() => { if (selectedIndex > 0) setSelectedId(items[selectedIndex - 1].id); }}
        onNext={() => { if (selectedIndex >= 0 && selectedIndex < items.length - 1) setSelectedId(items[selectedIndex + 1].id); }}
        itemIndex={Math.max(0, selectedIndex)} totalItems={items.length} isActionPending={!!deleteId}
        actions={{ onSelect: id => navigate(`/admin/products?template=${encodeURIComponent(id)}`), onDelete: setDeleteId }} />
      <DeleteTemplateDialog templateId={deleteId} onClose={() => setDeleteId(null)} onDeleted={id => { if (selectedId === id) setSelectedId(null); }} />
    </SinglePaneViewer>
  );
}

export default function TemplatesTab() {
  return <TemplatesBoundary><TemplatesTabInner /></TemplatesBoundary>;
}
