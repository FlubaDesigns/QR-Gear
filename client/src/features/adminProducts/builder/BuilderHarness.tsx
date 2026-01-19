import { useCallback, useState } from "react";
import { BuilderProvider } from "./BuilderContext";
import { StateModule } from "./modules/StateModule";
import { PlacementModule } from "./modules/PlacementModule";
import { URLContentModule } from "./modules/URLContentModule";
import { PlayContentModule } from "./modules/PlayContentModule";
import { CreateGraphicsModule } from "./modules/CreateGraphicsModule";
import { PricingModule } from "./modules/PricingModule";
import { InlineDebugBoundary } from "@/debug/InlineDebugBoundary";
import type { PricingBreakdown } from "./types";

function BuilderModules() {
  const [currentPricing, setCurrentPricing] = useState<PricingBreakdown | null>(null);

  const handlePricingCalculated = useCallback((pricing: PricingBreakdown | null) => {
    setCurrentPricing(pricing);
  }, []);

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
      
      {/* Step 3: URL Settings (Background, Title, Description, Top/Bottom Text) */}
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
      
      {/* Step 6: Pricing Breakdown */}
      <InlineDebugBoundary label="PricingModule">
        <PricingModule onPricingCalculated={handlePricingCalculated} />
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
