import { BuilderProvider } from "./BuilderContext";
import { StateModule } from "./modules/StateModule";
import { URLContentModule } from "./modules/URLContentModule";
import { PlacementModule } from "./modules/PlacementModule";
import { TextConfigModule } from "./modules/TextConfigModule";
import { PreviewModule } from "./modules/PreviewModule";
import { CreateGraphicsModule } from "./modules/CreateGraphicsModule";
import { InlineDebugBoundary } from "@/debug/InlineDebugBoundary";

function BuilderModules() {
  return (
    <div className="space-y-4">
      {/* Step 1: Product Type & QR State Selection */}
      <InlineDebugBoundary label="StateModule">
        <StateModule />
      </InlineDebugBoundary>
      
      {/* Step 2: Placement (with Graphic/QR toggle for QR Plus) */}
      <InlineDebugBoundary label="PlacementModule">
        <PlacementModule />
      </InlineDebugBoundary>
      
      {/* Step 3: Text Options (Header/Footer) */}
      <InlineDebugBoundary label="TextConfigModule">
        <TextConfigModule />
      </InlineDebugBoundary>
      
      {/* Step 4: URL Content (Background + Title/Description + Preview) */}
      <InlineDebugBoundary label="URLContentModule">
        <URLContentModule />
      </InlineDebugBoundary>
      
      {/* Step 5: Preview */}
      <InlineDebugBoundary label="PreviewModule">
        <PreviewModule />
      </InlineDebugBoundary>
      
      {/* Step 6: Create Graphics */}
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
