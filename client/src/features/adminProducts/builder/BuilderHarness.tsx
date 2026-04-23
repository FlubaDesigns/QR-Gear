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
import { BuilderSummaryCard } from "./modules/BuilderSummaryCard";
import { BuilderBottomBar } from "./modules/BuilderBottomBar";
import { DraftResumeHandler } from "./modules/DraftResumeHandler";
import { InlineDebugBoundary } from "@/debug/InlineDebugBoundary";
import { CollapseAllProvider } from "@/features/shared/components/CollapsibleModule";

function BuilderModules() {
  return (
    <CollapseAllProvider>
      {/* Fixed mobile bottom action bar — outside scroll flow */}
      <BuilderBottomBar />

      <div className="mobile-compact-stack pb-20 md:pb-0">
        {/* Resume draft from ?resume=<sessionId> URL param */}
        <DraftResumeHandler />

        {/* Sticky bar — product name + session state + collapse all, always visible */}
        <BuilderStickyBar />

        {/* Read-only summary: hero thumbnail, QR type, store/channel, session status */}
        <BuilderSummaryCard />

        {/* Template / saved session loaders */}
        <InlineDebugBoundary label="LoadTemplateModule">
          <LoadTemplateModule />
        </InlineDebugBoundary>

        <InlineDebugBoundary label="LoadSavedModule">
          <LoadSavedModule />
        </InlineDebugBoundary>

        {/* Step 1: Product + QR type selection */}
        <InlineDebugBoundary label="StateModule">
          <StateModule />
        </InlineDebugBoundary>

        {/* Step 2: Graphic design (zones, freeform, area image) */}
        <InlineDebugBoundary label="ProductGraphicTextModule">
          <ProductGraphicTextModule />
        </InlineDebugBoundary>

        {/* Step 3: QR content (mode-specific) */}
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

        {/* Step 4: Layout / Placement (color, print method, placement positions) */}
        <InlineDebugBoundary label="PlacementModule">
          <PlacementModule />
        </InlineDebugBoundary>

        {/* Step 5: Create graphics → preview → save / commit */}
        <div id="builder-create-section">
          <InlineDebugBoundary label="CreateGraphicsModule">
            <CreateGraphicsModule />
          </InlineDebugBoundary>
        </div>
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
