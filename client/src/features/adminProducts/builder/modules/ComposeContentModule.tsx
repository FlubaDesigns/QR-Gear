import { useState, useEffect, useCallback } from "react";
import { Sparkles, ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CollapsibleModule } from "@/features/shared/components/CollapsibleModule";
import { useBuilderContext } from "../BuilderContext";
import { adminFetch } from "@/lib/adminFetch";
import {
  ComposePickItemsStep,
  ComposeModePicker,
  ComposeDurationsStep,
  ComposeOrderStep,
  ComposeHostingStep,
  ComposePreviewStep,
  ComposePublishStep,
  ComposeConfirmStep,
} from "@/features/shared/components/wizardSteps/ComposeSteps";
import type { ComposeMode } from "@/features/shared/components/wizardSteps/ComposeSteps";

const COMPOSE_STEPS = [
  'pick-items', 'mode', 'durations', 'order', 'hosting', 'preview', 'publish', 'confirm'
] as const;

const STEP_LABELS: Record<string, string> = {
  'pick-items': 'Pick Items',
  'mode': 'Rotation Mode',
  'durations': 'Durations',
  'order': 'Playlist Order',
  'hosting': 'Hosting Term',
  'preview': 'Preview',
  'publish': 'Publish',
  'confirm': 'Done',
};

export function ComposeContentModule() {
  const { state, setContent } = useBuilderContext();
  const [availableItems, setAvailableItems] = useState<any[]>([]);
  const [isLoadingItems, setIsLoadingItems] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);

  const composeStep = state.content.composeStep || '';
  const composeItems = state.content.composeItems || [];
  const composeMode = state.content.composeMode || '';
  const composeHostingTerm = state.content.composeHostingTerm || '';
  const composeMockup = state.content.composeMockup || '';
  const composeInstanceId = state.content.composeInstanceId || null;

  const currentStepIndex = composeStep ? COMPOSE_STEPS.indexOf(composeStep as any) : -1;

  useEffect(() => {
    if (state.qrProductState !== "qr_compose" || !state.selectedProduct) return;
    if (composeStep === 'pick-items' && availableItems.length === 0 && !isLoadingItems) {
      fetchAvailableItems();
    }
  }, [composeStep, state.qrProductState, state.selectedProduct]);

  if (state.qrProductState !== "qr_compose" || !state.selectedProduct) {
    return null;
  }

  const fetchAvailableItems = async () => {
    setIsLoadingItems(true);
    try {
      const data = await adminFetch<{ items: any[] }>("/published-compose-items");
      setAvailableItems(data.items || []);
    } catch {
      try {
        const data = await adminFetch<any>("/packets?status=published&types=qr-canvas,qr-play");
        setAvailableItems(data.packets || data.items || data || []);
      } catch (altErr) {
        console.error('[ComposeModule] Error fetching items:', altErr);
      }
    } finally {
      setIsLoadingItems(false);
    }
  };

  const startCompose = () => {
    setContent({ composeStep: 'pick-items' });
    if (availableItems.length === 0) {
      fetchAvailableItems();
    }
  };

  const handleToggleItem = (item: any) => {
    const id = item.packetId || item.id;
    const isSelected = composeItems.some(i => i.packetId === id);
    if (isSelected) {
      setContent({
        composeItems: composeItems
          .filter(i => i.packetId !== id)
          .map((i, idx) => ({ ...i, order: idx })),
      });
    } else {
      setContent({
        composeItems: [...composeItems, {
          packetId: id,
          name: item.title || item.name || 'Untitled',
          thumbnailUrl: item.thumbnailUrl || item.urlGraphic || item.qrCanvasMockup || item.qrPlayMockup || '',
          type: (item.packetType === 'qr-play' ? 'qr-play' : 'qr-canvas') as 'qr-canvas' | 'qr-play',
          durationSeconds: 86400,
          order: composeItems.length,
        }],
      });
    }
  };

  const handleUpdateDuration = (packetId: string, seconds: number) => {
    setContent({
      composeItems: composeItems.map(i =>
        i.packetId === packetId ? { ...i, durationSeconds: seconds } : i
      ),
    });
  };

  const handleMoveUp = (packetId: string) => {
    const idx = composeItems.findIndex(i => i.packetId === packetId);
    if (idx <= 0) return;
    const newItems = [...composeItems];
    [newItems[idx - 1], newItems[idx]] = [newItems[idx], newItems[idx - 1]];
    setContent({ composeItems: newItems.map((i, j) => ({ ...i, order: j })) });
  };

  const handleMoveDown = (packetId: string) => {
    const idx = composeItems.findIndex(i => i.packetId === packetId);
    if (idx < 0 || idx >= composeItems.length - 1) return;
    const newItems = [...composeItems];
    [newItems[idx], newItems[idx + 1]] = [newItems[idx + 1], newItems[idx]];
    setContent({ composeItems: newItems.map((i, j) => ({ ...i, order: j })) });
  };

  const handleRemoveItem = (packetId: string) => {
    setContent({
      composeItems: composeItems
        .filter(i => i.packetId !== packetId)
        .map((i, idx) => ({ ...i, order: idx })),
    });
  };

  const canGoNext = (): boolean => {
    switch (composeStep) {
      case 'pick-items': return composeItems.length >= 2;
      case 'mode': return composeMode !== '';
      case 'durations': return true;
      case 'order': return true;
      case 'hosting': return composeHostingTerm !== '';
      case 'preview': return true;
      case 'publish': return !isPublishing;
      case 'confirm': return false;
      default: return false;
    }
  };

  const goNext = async () => {
    if (composeStep === 'mode' && composeMode === 'scan-to-reveal') {
      setContent({ composeStep: 'order' });
      return;
    }
    if (composeStep === 'publish') {
      await handlePublish();
      return;
    }
    const nextIdx = currentStepIndex + 1;
    if (nextIdx < COMPOSE_STEPS.length) {
      setContent({ composeStep: COMPOSE_STEPS[nextIdx] });
    }
  };

  const goBack = () => {
    if (composeStep === 'order' && composeMode === 'scan-to-reveal') {
      setContent({ composeStep: 'mode' });
      return;
    }
    if (currentStepIndex > 0) {
      setContent({ composeStep: COMPOSE_STEPS[currentStepIndex - 1] });
    } else {
      setContent({ composeStep: '' });
    }
  };

  const handlePublish = async () => {
    setIsPublishing(true);
    try {
      const payload = {
        qrType: 'qr-compose',
        composeItems,
        composeMode: composeMode || 'auto-rotate',
        composeHostingTerm: composeHostingTerm || '1-year',
        productId: state.selectedProduct?.id,
        blueprintId: state.selectedProduct?.blueprintId,
        color: state.selectedColor?.name || '',
        colorHex: state.selectedColor?.hex || '',
      };
      const result = await adminFetch<any>("/compose/publish", {
        method: "POST",
        json: payload,
      });
      setContent({
        composeInstanceId: result.instanceId || result.composeInstanceId || null,
        composeStep: 'confirm',
      });
    } catch (error) {
      console.error('[ComposeModule] Publish error:', error);
    } finally {
      setIsPublishing(false);
    }
  };

  return (
    <CollapsibleModule
      title="QR Compose"
      icon={<Sparkles className="h-4 w-4" />}
      className="bg-muted/30"
      defaultOpen
    >
      <div className="space-y-4">
        {!composeStep && (
          <div className="text-center py-6 space-y-4">
            <div className="w-14 h-14 rounded-full bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center mx-auto">
              <Sparkles className="w-7 h-7 text-white" />
            </div>
            <div>
              <h3 className="text-lg font-bold mb-1" data-testid="text-compose-title">Build a Rotating Playlist</h3>
              <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                Select from your published Canvas and Play items to create a QR that shows different content over time.
              </p>
            </div>
            <Button
              onClick={startCompose}
              className="bg-gradient-to-r from-amber-500 to-orange-500"
              data-testid="button-start-compose"
            >
              <Sparkles className="w-4 h-4 mr-2" />
              Start Composing
            </Button>
          </div>
        )}

        {composeStep && composeStep !== 'confirm' && (
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs text-muted-foreground" data-testid="text-compose-step-label">
              Step {currentStepIndex + 1} of {COMPOSE_STEPS.length}: {STEP_LABELS[composeStep] || composeStep}
            </p>
            <div className="flex gap-1">
              {COMPOSE_STEPS.map((step, idx) => (
                <div
                  key={step}
                  className={`w-2 h-2 rounded-full ${
                    idx < currentStepIndex ? 'bg-amber-500' :
                    idx === currentStepIndex ? 'bg-amber-400 ring-2 ring-amber-400/30' :
                    'bg-muted'
                  }`}
                />
              ))}
            </div>
          </div>
        )}

        <div className="bg-slate-900/50 rounded-xl p-4 border border-slate-700/50">
          {composeStep === 'pick-items' && (
            <ComposePickItemsStep
              availableItems={availableItems}
              selectedItems={composeItems}
              onToggleItem={handleToggleItem}
              isLoading={isLoadingItems}
            />
          )}

          {composeStep === 'mode' && (
            <ComposeModePicker
              selected={composeMode as ComposeMode | ''}
              onSelect={(mode) => setContent({ composeMode: mode })}
            />
          )}

          {composeStep === 'durations' && (
            <ComposeDurationsStep
              items={composeItems}
              onUpdateDuration={handleUpdateDuration}
            />
          )}

          {composeStep === 'order' && (
            <ComposeOrderStep
              items={composeItems}
              onMoveUp={handleMoveUp}
              onMoveDown={handleMoveDown}
              onRemove={handleRemoveItem}
            />
          )}

          {composeStep === 'hosting' && (
            <ComposeHostingStep
              selected={composeHostingTerm}
              onSelect={(term) => setContent({ composeHostingTerm: term })}
            />
          )}

          {composeStep === 'preview' && (
            <ComposePreviewStep
              items={composeItems}
              hostingTerm={composeHostingTerm || '1-year'}
              mockupUrl={composeMockup}
              isLoadingMockup={false}
              selectedColor={state.selectedColor?.name || ''}
              selectedSize="M"
              composeMode={composeMode as ComposeMode}
            />
          )}

          {composeStep === 'publish' && (
            <ComposePublishStep
              isPublishing={isPublishing}
              itemCount={composeItems.length}
            />
          )}

          {composeStep === 'confirm' && (
            <ComposeConfirmStep
              instanceId={composeInstanceId}
              resolverUrl={composeInstanceId ? `/qr/d/${composeInstanceId}` : null}
              itemCount={composeItems.length}
            />
          )}
        </div>

        {composeStep && composeStep !== 'confirm' && (
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={goBack}
              className="flex-1"
              data-testid="button-compose-back"
            >
              <ChevronLeft className="w-4 h-4 mr-1" />
              Back
            </Button>
            <Button
              onClick={goNext}
              disabled={!canGoNext()}
              className="flex-1 bg-gradient-to-r from-amber-500 to-orange-500"
              data-testid="button-compose-next"
            >
              {composeStep === 'publish' ? (
                isPublishing ? (
                  <><Loader2 className="w-4 h-4 mr-1 animate-spin" /> Publishing...</>
                ) : 'Publish Now'
              ) : (
                <>Next <ChevronRight className="w-4 h-4 ml-1" /></>
              )}
            </Button>
          </div>
        )}

        {composeStep === 'confirm' && (
          <Button
            variant="outline"
            onClick={() => {
              setContent({
                composeItems: [],
                composeMode: '',
                composeHostingTerm: '',
                composeStep: '',
                composeMockup: '',
                composeInstanceId: null,
              });
            }}
            className="w-full"
            data-testid="button-compose-new"
          >
            Create Another Compose
          </Button>
        )}
      </div>
    </CollapsibleModule>
  );
}
