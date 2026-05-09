import { Loader2, Check, ChevronRight } from "lucide-react";
import { StoreBuilderProvider, useStoreBuilder } from "./StoreBuilderContext";
import { StoreBuilderOverview } from "./StoreBuilderOverview";
import { StoreBuilderProductDetail } from "./StoreBuilderProductDetail";
import { StoreBuilderAssignment } from "./StoreBuilderAssignment";
import { HeroImageLightbox } from "./StoreBuilderComponents";
import { TemplatePickerSkin } from "@/features/shared/components/skins";
import { ImageModalView } from "@/features/shared/components/views/ModalView";
import { Button } from "@/components/ui/button";

function StepIndicator() {
  const { productPackage, selectedStore, selectedChannel, saveStatus } = useStoreBuilder();

  const activeStep = !productPackage ? 0 : !selectedStore || !selectedChannel ? 1 : 2;

  const steps = [
    { label: "Load", done: activeStep > 0 },
    { label: "Configure", done: activeStep > 1 },
    { label: "Assign", done: saveStatus?.type === "success" },
  ];

  return (
    <div className="flex items-center gap-0" aria-label="Progress">
      {steps.map((step, i) => {
        const isActive = i === activeStep && saveStatus?.type !== "success";
        const isDone = step.done;
        return (
          <div key={step.label} className="flex items-center">
            <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              isDone
                ? "bg-primary/10 text-primary"
                : isActive
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground"
            }`}>
              {isDone ? <Check className="h-3 w-3" /> : <span>{i + 1}</span>}
              {step.label}
            </div>
            {i < steps.length - 1 && (
              <ChevronRight className="h-3.5 w-3.5 text-muted-foreground mx-0.5" />
            )}
          </div>
        );
      })}
    </div>
  );
}

function StoreBuilderContent() {
  const ctx = useStoreBuilder();

  if (ctx.isLoadingPacket) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin" />
        <span className="ml-3">Loading package...</span>
      </div>
    );
  }

  if (!ctx.productPackage) {
    return (
      <>
        <StoreBuilderOverview />
        <TemplatePickerSkin
          isOpen={ctx.templatePickerOpen}
          onClose={() => ctx.setTemplatePickerOpen(false)}
          onSelect={ctx.handleTemplateSelect}
          fetchTemplates={ctx.fetchTemplates}
        />
      </>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <StepIndicator />
        <StoreBuilderOverview compact />
      </div>

      <StoreBuilderProductDetail />

      <StoreBuilderAssignment />

      {ctx.saveStatus && (
        <div
          className={`p-4 rounded-md border ${
            ctx.saveStatus.type === "success"
              ? "border-border bg-muted/40"
              : "border-destructive/40 bg-destructive/5"
          }`}
          data-testid="store-save-status"
        >
          <span className={`text-base font-medium block mb-3 ${
            ctx.saveStatus.type === "error" ? "text-destructive" : "text-foreground"
          }`}>
            {ctx.saveStatus.message}
          </span>
          {ctx.saveStatus.type === "success" && (
            <div className="flex flex-col gap-3">
              <Button
                variant="outline"
                className="w-full"
                onClick={ctx.handleClearAfterAssign}
                data-testid="button-clear-after-assign"
              >
                Clear &amp; New
              </Button>
              <Button
                className="w-full"
                onClick={ctx.handleViewInStore}
                data-testid="button-view-store"
              >
                View in Store
              </Button>
            </div>
          )}
        </div>
      )}

      <HeroImageLightbox
        isOpen={ctx.lightboxOpen}
        onClose={() => ctx.setLightboxOpen(false)}
        productPackage={ctx.productPackage}
        configuration={ctx.configuration}
        mockups={ctx.mockups}
        onSelectColor={ctx.setDefaultColor}
      />

      <ImageModalView
        imageUrl={ctx.thumbnailLightbox}
        onClose={() => ctx.setThumbnailLightbox(null)}
      />

      <TemplatePickerSkin
        isOpen={ctx.templatePickerOpen}
        onClose={() => ctx.setTemplatePickerOpen(false)}
        onSelect={ctx.handleTemplateSelect}
        fetchTemplates={ctx.fetchTemplates}
      />
    </div>
  );
}

export function StoreBuilderHarness() {
  return (
    <StoreBuilderProvider>
      <StoreBuilderContent />
    </StoreBuilderProvider>
  );
}

export default StoreBuilderHarness;
