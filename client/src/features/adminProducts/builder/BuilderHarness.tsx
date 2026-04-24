import { useState, useRef, useCallback } from "react";
import { ChevronDown, ChevronRight, CheckCircle2, Circle, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BuilderProvider, useBuilderContext } from "./BuilderContext";
import type { BuilderState } from "./types";
import { StateModule } from "./modules/StateModule";
import { PlacementModule } from "./modules/PlacementModule";
import { ProductGraphicTextModule } from "./modules/ProductGraphicTextModule";
import { URLContentModule } from "./modules/URLContentModule";
import { PlayContentModule } from "./modules/PlayContentModule";
import { BasicsContentModule } from "./modules/BasicsContentModule";
import { ComposeContentModule } from "./modules/ComposeContentModule";
import { CreateGraphicsModule } from "./modules/CreateGraphicsModule";
import { LoadTemplateModule } from "./modules/LoadTemplateModule";
import { LoadSavedModule } from "./modules/LoadSavedModule";
import { BuilderCommandStrip } from "./modules/BuilderStickyBar";
import { BuilderSummaryCard } from "./modules/BuilderSummaryCard";
import { BuilderBottomBar } from "./modules/BuilderBottomBar";
import { DraftResumeHandler } from "./modules/DraftResumeHandler";
import { InlineDebugBoundary } from "@/debug/InlineDebugBoundary";
import { CollapseAllProvider } from "@/features/shared/components/CollapsibleModule";

type SectionKey = "product" | "design" | "qr" | "layout" | "output";

interface SectionDef {
  key: SectionKey;
  label: string;
  number: number;
}

const SECTIONS: SectionDef[] = [
  { key: "product", label: "Product", number: 1 },
  { key: "design", label: "Design", number: 2 },
  { key: "qr", label: "QR Content", number: 3 },
  { key: "layout", label: "Layout", number: 4 },
  { key: "output", label: "Output", number: 5 },
];

const QR_LABEL: Record<string, string> = {
  qr_canvas: "QR Canvas",
  qr_basics: "QR Basics",
  qr_plus: "QR Plus",
  qr_play: "QR Play",
  qr_compose: "QR Compose",
};

type SectionStatus = "complete" | "partial" | "missing";

function getSectionStatus(key: SectionKey, state: BuilderState): SectionStatus {
  switch (key) {
    case "product":
      if (state.selectedProduct && state.qrProductState) return "complete";
      if (state.selectedProduct) return "partial";
      return "missing";
    case "design": {
      const has = !!(
        state.content?.graphicLayoutMode ||
        state.loadedTemplate ||
        state.loadedGraphic ||
        state.loadedBackground
      );
      if (has) return "complete";
      return state.selectedProduct ? "partial" : "missing";
    }
    case "qr": {
      const c = state.content;
      const mode = state.qrProductState;
      const has =
        mode === "qr_play"
          ? !!(c?.playMediaSource || c?.playMediaUrl)
          : mode === "qr_compose"
          ? !!(c?.composeMode)
          : !!(c?.url);
      if (has) return "complete";
      return state.selectedProduct ? "partial" : "missing";
    }
    case "layout":
      if ((state.selectedPlacements?.length || 0) > 0) return "complete";
      return state.selectedProduct ? "partial" : "missing";
    case "output": {
      const s = state.sessionStatus;
      if (s === "artifact_ready" || s === "committed") return "complete";
      if (state.activePacketId) return "partial";
      return state.selectedProduct ? "partial" : "missing";
    }
  }
}

function getSectionSummary(key: SectionKey, state: BuilderState): string {
  switch (key) {
    case "product": {
      if (!state.selectedProduct) return "No product selected";
      const qrLabel = QR_LABEL[state.qrProductState] || state.qrProductState;
      return [state.selectedProduct.title, qrLabel].filter(Boolean).join(" · ");
    }
    case "design":
      if (state.loadedTemplate) return `Template: ${state.loadedTemplate.name || "loaded"}`;
      if (state.content?.graphicLayoutMode === "zone") return "Zone layout set";
      if (state.content?.graphicLayoutMode === "freeform") return "Freeform layout set";
      if (state.loadedGraphic) return "Graphic loaded";
      if (state.loadedBackground) return "Background loaded";
      return "Not configured";
    case "qr": {
      const c = state.content;
      const mode = state.qrProductState;
      if (mode === "qr_play") return c?.playMediaSource || c?.playMediaUrl ? "Media set" : "Not set";
      if (mode === "qr_compose") return c?.composeMode ? `Compose: ${c.composeMode}` : "Not set";
      if (c?.url) {
        const u = c.url;
        return u.length > 38 ? u.substring(0, 35) + "…" : u;
      }
      return "Not set";
    }
    case "layout": {
      const count = state.selectedPlacements?.length || 0;
      if (count === 0) return "No placements selected";
      const color = state.selectedColor?.name;
      return `${count} placement${count > 1 ? "s" : ""}${color ? ` · ${color}` : ""}`;
    }
    case "output":
      if (state.sessionStatus === "committed") return "Saved as catalog instance";
      if (state.sessionStatus === "artifact_ready") return "Packet ready";
      if (state.activePacketId) return "Packet created";
      return "Ready to generate";
  }
}

function SectionStatusIcon({ status }: { status: SectionStatus }) {
  if (status === "complete")
    return <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400 flex-shrink-0" />;
  if (status === "partial")
    return <Circle className="h-4 w-4 text-amber-500 flex-shrink-0" />;
  return <AlertTriangle className="h-4 w-4 text-muted-foreground/50 flex-shrink-0" />;
}

interface AccordionSectionProps {
  sectionKey: SectionKey;
  number: number;
  label: string;
  summary: string;
  status: SectionStatus;
  isOpen: boolean;
  onToggle: () => void;
  onNext?: () => void;
  nextLabel?: string;
  sectionRef: React.RefObject<HTMLDivElement>;
  children: React.ReactNode;
}

function AccordionSection({
  sectionKey,
  number,
  label,
  summary,
  status,
  isOpen,
  onToggle,
  onNext,
  nextLabel,
  sectionRef,
  children,
}: AccordionSectionProps) {
  return (
    <div className="border-b" data-testid={`section-${sectionKey}`} ref={sectionRef}>
      <button
        type="button"
        className="w-full flex items-center gap-3 px-4 py-4 text-left hover-elevate transition-colors"
        onClick={onToggle}
        data-testid={`section-header-${sectionKey}`}
      >
        <span className="flex-shrink-0 w-6 h-6 rounded-full bg-muted flex items-center justify-center text-xs font-bold text-muted-foreground">
          {number}
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold leading-tight">{label}</p>
          {!isOpen && (
            <p className="text-xs text-muted-foreground leading-tight mt-0.5 truncate">{summary}</p>
          )}
        </div>
        <SectionStatusIcon status={status} />
        {isOpen ? (
          <ChevronDown className="h-4 w-4 text-muted-foreground flex-shrink-0" />
        ) : (
          <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
        )}
      </button>

      {isOpen && (
        <div className="pb-2">
          {children}
          {onNext && nextLabel && (
            <div className="px-4 pt-2 pb-3">
              <Button
                variant="outline"
                className="w-full"
                onClick={onNext}
                data-testid={`button-next-${sectionKey}`}
              >
                Next → {nextLabel}
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function BuilderModules() {
  const { state } = useBuilderContext();

  const [openSection, setOpenSection] = useState<SectionKey | null>("product");
  const [savedOpen, setSavedOpen] = useState(false);
  const [templateOpen, setTemplateOpen] = useState(false);

  const productRef = useRef<HTMLDivElement>(null);
  const designRef = useRef<HTMLDivElement>(null);
  const qrRef = useRef<HTMLDivElement>(null);
  const layoutRef = useRef<HTMLDivElement>(null);
  const outputRef = useRef<HTMLDivElement>(null);

  const sectionRefs: Record<SectionKey, React.RefObject<HTMLDivElement>> = {
    product: productRef,
    design: designRef,
    qr: qrRef,
    layout: layoutRef,
    output: outputRef,
  };

  const openAndScroll = useCallback((key: SectionKey) => {
    setOpenSection(key);
    setTimeout(() => {
      sectionRefs[key].current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 50);
  }, []);

  const handleToggle = (key: SectionKey) => {
    if (openSection === key) {
      setOpenSection(null);
    } else {
      openAndScroll(key);
    }
  };

  const handleNext = (currentKey: SectionKey) => {
    const idx = SECTIONS.findIndex((s) => s.key === currentKey);
    if (idx < SECTIONS.length - 1) {
      openAndScroll(SECTIONS[idx + 1].key);
    }
  };

  const handleOpenOutput = useCallback(() => {
    openAndScroll("output");
    setTimeout(() => {
      document.getElementById("builder-create-section")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 100);
  }, [openAndScroll]);

  return (
    <CollapseAllProvider>
      <BuilderBottomBar onOpenOutput={handleOpenOutput} />

      <div className="pb-24">
        <DraftResumeHandler />

        <BuilderCommandStrip
          onOpenSaved={() => setSavedOpen(true)}
          onOpenTemplates={() => setTemplateOpen(true)}
          onOpenOutput={handleOpenOutput}
        />

        <BuilderSummaryCard />

        <LoadSavedModule open={savedOpen} onOpenChange={setSavedOpen} hideCard />
        <LoadTemplateModule open={templateOpen} onOpenChange={setTemplateOpen} hideCard />

        {SECTIONS.map((section) => {
          const idx = SECTIONS.indexOf(section);
          const nextSection = SECTIONS[idx + 1];
          const isOpen = openSection === section.key;
          const status = getSectionStatus(section.key, state);
          const summary = getSectionSummary(section.key, state);

          return (
            <AccordionSection
              key={section.key}
              sectionKey={section.key}
              number={section.number}
              label={section.label}
              summary={summary}
              status={status}
              isOpen={isOpen}
              onToggle={() => handleToggle(section.key)}
              onNext={nextSection ? () => handleNext(section.key) : undefined}
              nextLabel={nextSection?.label}
              sectionRef={sectionRefs[section.key]}
            >
              {section.key === "product" && (
                <InlineDebugBoundary label="StateModule">
                  <StateModule />
                </InlineDebugBoundary>
              )}

              {section.key === "design" && (
                <InlineDebugBoundary label="ProductGraphicTextModule">
                  <ProductGraphicTextModule />
                </InlineDebugBoundary>
              )}

              {section.key === "qr" && (
                <>
                  <InlineDebugBoundary label="BasicsContentModule">
                    <BasicsContentModule />
                  </InlineDebugBoundary>
                  <InlineDebugBoundary label="URLContentModule">
                    <URLContentModule />
                  </InlineDebugBoundary>
                  <InlineDebugBoundary label="PlayContentModule">
                    <PlayContentModule />
                  </InlineDebugBoundary>
                  <InlineDebugBoundary label="ComposeContentModule">
                    <ComposeContentModule />
                  </InlineDebugBoundary>
                </>
              )}

              {section.key === "layout" && (
                <InlineDebugBoundary label="PlacementModule">
                  <PlacementModule />
                </InlineDebugBoundary>
              )}

              {section.key === "output" && (
                <div id="builder-create-section">
                  <InlineDebugBoundary label="CreateGraphicsModule">
                    <CreateGraphicsModule />
                  </InlineDebugBoundary>
                </div>
              )}
            </AccordionSection>
          );
        })}
      </div>
    </CollapseAllProvider>
  );
}

export function BuilderHarness() {
  return (
    <BuilderProvider>
      <InlineDebugBoundary label="BuilderModules">
        <BuilderModules />
      </InlineDebugBoundary>
    </BuilderProvider>
  );
}
