import { BuilderProvider } from "./BuilderContext";
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
import { BuilderStickyBar } from "./modules/BuilderStickyBar";
import { DraftResumeHandler } from "./modules/DraftResumeHandler";
import { InlineDebugBoundary } from "@/debug/InlineDebugBoundary";
import { CollapseAllProvider } from "@/features/shared/components/CollapsibleModule";

function BuilderModules() {
  return (
    <CollapseAllProvider>
    <div className="mobile-compact-stack">
      {/* Resume draft from ?resume=<sessionId> URL param */}
      <DraftResumeHandler />

      {/* Sticky bar — selected product name + session badge, always visible */}
      <BuilderStickyBar />

      {/* Template loader — above everything so it populates all steps */}
      <InlineDebugBoundary label="LoadTemplateModule">
        <LoadTemplateModule />
      </InlineDebugBoundary>

      {/* Resume a previously created packet / committed build */}
      <InlineDebugBoundary label="LoadSavedModule">
        <LoadSavedModule />
      </InlineDebugBoundary>

      {/* Step 1: Product Type & QR State Selection */}
      <InlineDebugBoundary label="StateModule">
        <StateModule />
      </InlineDebugBoundary>
      
      {/* Step 2: Placement Selection */}
      <InlineDebugBoundary label="PlacementModule">
        <PlacementModule />
      </InlineDebugBoundary>
      
      {/* Step 3: Graphic Design (Header/Footer, QR, images, layout modes) */}
      <InlineDebugBoundary label="ProductGraphicTextModule">
        <ProductGraphicTextModule />
      </InlineDebugBoundary>
      
      {/* Step 4a: QR Basics Content (Text or URL for Basics mode) */}
      <InlineDebugBoundary label="BasicsContentModule">
        <BasicsContentModule />
      </InlineDebugBoundary>
      
      {/* Step 4b: URL Settings (Background, Title, Description for Canvas/Compose/Plus) */}
      <InlineDebugBoundary label="URLContentModule">
        <URLContentModule />
      </InlineDebugBoundary>
      
      {/* Step 4c: Play Media (for QR Play mode) */}
      <InlineDebugBoundary label="PlayContentModule">
        <PlayContentModule />
      </InlineDebugBoundary>
      
      {/* Step 4d: QR Compose (pick items, mode, durations, order, hosting, preview, publish) */}
      <InlineDebugBoundary label="ComposeContentModule">
        <ComposeContentModule />
      </InlineDebugBoundary>
      
      {/* Step 5: Create Graphics (generates QR, composite, calculates pricing, queues mockups) */}
      <InlineDebugBoundary label="CreateGraphicsModule">
        <CreateGraphicsModule />
      </InlineDebugBoundary>
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
