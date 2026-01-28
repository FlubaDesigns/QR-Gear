import { BuilderProvider } from "./BuilderContext";
import { StateModule } from "./modules/StateModule";
import { PlacementModule } from "./modules/PlacementModule";
import { ProductGraphicTextModule } from "./modules/ProductGraphicTextModule";
import { URLContentModule } from "./modules/URLContentModule";
import { PlayContentModule } from "./modules/PlayContentModule";
import { CreateGraphicsModule } from "./modules/CreateGraphicsModule";
import { InlineDebugBoundary } from "@/debug/InlineDebugBoundary";

function BuilderModules() {
  return (
    <div className="mobile-compact-stack">
      {/* Step 1: Product Type & QR State Selection */}
      <InlineDebugBoundary label="StateModule">
        <StateModule />
      </InlineDebugBoundary>
      
      {/* Step 2: Placement Selection */}
      <InlineDebugBoundary label="PlacementModule">
        <PlacementModule />
      </InlineDebugBoundary>
      
      {/* Step 3: Product Graphic Text (Header/Footer for Canvas, Play, Dynamics - NOT Basics) */}
      <InlineDebugBoundary label="ProductGraphicTextModule">
        <ProductGraphicTextModule />
      </InlineDebugBoundary>
      
      {/* Step 4: URL Settings (Background, Title, Description for Canvas/Dynamics) */}
      <InlineDebugBoundary label="URLContentModule">
        <URLContentModule />
      </InlineDebugBoundary>
      
      {/* Step 4: Play Media (for QR Play mode) */}
      <InlineDebugBoundary label="PlayContentModule">
        <PlayContentModule />
      </InlineDebugBoundary>
      
      {/* Step 5: Create Graphics (generates QR, composite, calculates pricing, queues mockups) */}
      <InlineDebugBoundary label="CreateGraphicsModule">
        <CreateGraphicsModule />
      </InlineDebugBoundary>
    </div>
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
