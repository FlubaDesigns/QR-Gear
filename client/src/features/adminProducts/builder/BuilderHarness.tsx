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
  return (
    <div className="space-y-4">
      <InlineDebugBoundary label="StateModule">
        <StateModule />
      </InlineDebugBoundary>
      <InlineDebugBoundary label="PlacementModule">
        <PlacementModule />
      </InlineDebugBoundary>
      <InlineDebugBoundary label="ContentModule">
        <ContentModule />
      </InlineDebugBoundary>
      <InlineDebugBoundary label="TextConfigModule">
        <TextConfigModule />
      </InlineDebugBoundary>
      <InlineDebugBoundary label="BackgroundPickerModule">
        <BackgroundPickerModule />
      </InlineDebugBoundary>
      <InlineDebugBoundary label="PreviewModule">
        <PreviewModule />
      </InlineDebugBoundary>
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
