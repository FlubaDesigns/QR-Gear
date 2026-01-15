import { BuilderProvider } from "./BuilderContext";
import { SourceModule } from "./modules/SourceModule";

export function BuilderHarness() {
  return (
    <BuilderProvider>
      <div className="space-y-4">
        <SourceModule />
      </div>
    </BuilderProvider>
  );
}
