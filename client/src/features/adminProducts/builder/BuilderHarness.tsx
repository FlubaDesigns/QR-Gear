import { BuilderProvider } from "./BuilderContext";
import { StateModule } from "./modules/StateModule";
import { ContentModule } from "./modules/ContentModule";
import { BackgroundPickerModule } from "./modules/BackgroundPickerModule";
import { PlacementModule } from "./modules/PlacementModule";
import { TextConfigModule } from "./modules/TextConfigModule";
import { PreviewModule } from "./modules/PreviewModule";
import { CreateGraphicsModule } from "./modules/CreateGraphicsModule";
import { InlineDebugBoundary } from "@/debug/InlineDebugBoundary";

function BuilderModules() {
  // QR Plus flow: State → Placement → Text → Background → Content → Preview → CreateGraphics
  // Other flows: State → Placement → Content → Text → Background → Preview → CreateGraphics
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
      
      {/* Step 4: Background Selection */}
      <InlineDebugBoundary label="BackgroundPickerModule">
        <BackgroundPickerModule />
      </InlineDebugBoundary>
      
      {/* Step 5: Content (Title/Description) */}
      <InlineDebugBoundary label="ContentModule">
        <ContentModule />
      </InlineDebugBoundary>
      
      {/* Step 6: Preview */}
      <InlineDebugBoundary label="PreviewModule">
        <PreviewModule />
      </InlineDebugBoundary>
      
      {/* Step 7: Create Graphics */}
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
