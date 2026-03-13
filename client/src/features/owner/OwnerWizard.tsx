import { useEffect } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { ChevronLeft, ChevronRight, ShoppingCart, Tag, X, QrCode, Type, ImagePlus, Play, Sparkles, Loader2 } from "lucide-react";
import { SimpleWizardProgressBar } from "@/features/shared/components/wizardSteps/WizardProgressBars";
import type { QRType, SimpleWizardStep } from "@/features/shared/components/wizardSteps/wizardTypes";
import { OWNER_CAPABILITIES } from "@/features/shared/builder-capabilities";
import { GUIDED_CARDS, GUIDED_STEP_MAP, GuidedCard, OwnerCostSummary, MemberConversionPitch } from "./OwnerWizardComponents";
import { OwnerWizardStepContent } from "./OwnerWizardStepContent";
import { useOwnerWizardNav } from "./useOwnerWizardNav";
import { useOwnerWizardState } from "./useOwnerWizardState";

export function OwnerWizard() {
  const params = new URLSearchParams(window.location.search);
  const rawType = params.get('type') || '';
  const isGuided = params.get('guided') === 'true';
  const TYPE_ALIASES: Record<string, string> = {
    'basic': 'qr-basic', 'plus': 'qr-plus', 'canvas': 'qr-canvas',
    'play': 'qr-play', 'compose': 'qr-compose',
  };
  const minTier = TYPE_ALIASES[rawType] || rawType;
  const [, navigate] = useLocation();

  const TIER_ORDER: QRType[] = ['qr-basic', 'qr-plus', 'qr-canvas', 'qr-play', 'qr-compose'];
  const minTierIndex = TIER_ORDER.indexOf(minTier as QRType);
  const preSelectedType = (minTierIndex >= 0 ? minTier : '') as QRType;

  const state = useOwnerWizardState(preSelectedType, isGuided);
  const {
    simpleStep, setSimpleStep,
    selectedProductType, selectedColor, selectedShirtSize,
    selectedPlacements, graphicLocation, graphicSize,
    qrType, textLayoutChoice, headerStyle, footerStyle,
    currentPlacementIndex, placementGraphicChoice,
    qrBasicInputType, qrBasicContent, qrBasicMockup,
    qrPositionX, qrPositionY, qrSizePercent,
    areaImageUrl, areaImageMode,
    qrPlusMockup, isGeneratingBasicMockup, isGeneratingPlusMockup,
    wantsHeaderFooter, perPlacementSizes,
    showMemberPitch, setShowMemberPitch,
    showCheckoutCard, isCheckingOut,
    tempPacketId, realMockupUrl, lifestyleMockupUrl, isGeneratingRealMockup,
    runningCost, costPulse, currentPlacement,
    placementCostExtra, textLineCost, textLines, sizeCostBonuses,
    pricingSettings,
    guidedQueue, setGuidedQueue, guidedSeenSteps, setGuidedSeenSteps,
    pendingPostTypeStep, setPendingPostTypeStep,
    updateTempPacket, generateRealMockup, handlePublicCheckout, handleProductSelect,
  } = state;

  useEffect(() => {
    if (!isGuided) return;
    if (!guidedSeenSteps.has(simpleStep)) {
      const cards = GUIDED_STEP_MAP[simpleStep];
      if (cards) {
        setGuidedQueue([...cards]);
      }
      setGuidedSeenSteps(prev => new Set(prev).add(simpleStep));
    }
  }, [simpleStep, isGuided]);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'instant' });
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  };

  const handleGuidedContinue = () => {
    scrollToTop();
    if (guidedQueue[0] === 'checkout') {
      setGuidedQueue([]);
      state.setShowCheckoutCard(false);
      handlePublicCheckout();
      return;
    }
    if (guidedQueue[0]?.startsWith('type-confirm-')) {
      setGuidedQueue([]);
      if (pendingPostTypeStep) {
        setSimpleStep(pendingPostTypeStep as SimpleWizardStep);
        setPendingPostTypeStep(null);
      }
      return;
    }
    if (guidedQueue.length <= 1) {
      setGuidedQueue([]);
    } else {
      setGuidedQueue(prev => prev.slice(1));
    }
  };

  const allowedTypes = minTierIndex >= 0
    ? TIER_ORDER.slice(minTierIndex)
    : TIER_ORDER;

  const allTypeDefinitions = [
    { id: 'qr-basic' as QRType, label: 'QR Basic', description: 'Just the QR code - simple and clean', icon: QrCode, color: 'bg-slate-600', requiresMember: false },
    { id: 'qr-plus' as QRType, label: 'QR Plus', description: 'QR code with header and footer text', icon: Type, color: 'bg-blue-600', requiresMember: false },
    { id: 'qr-canvas' as QRType, label: 'QR Canvas', description: 'QR code with a custom background image', icon: ImagePlus, color: 'bg-purple-600', requiresMember: true },
    { id: 'qr-play' as QRType, label: 'QR Play', description: 'QR code that opens a video', icon: Play, color: 'bg-rose-600', requiresMember: true },
    { id: 'qr-compose' as QRType, label: 'QR Compose', description: 'Build a rotating playlist', icon: Sparkles, color: 'bg-amber-600', requiresMember: true },
  ];

  const { canProceed, isFinalStep, handleNext, handleBack, getTierInfo } = useOwnerWizardNav(
    {
      simpleStep, selectedProductType, selectedColor, selectedShirtSize,
      selectedPlacements, graphicSize, qrType, textLayoutChoice, headerStyle,
      footerStyle, currentPlacementIndex, placementGraphicChoice, qrBasicInputType,
      qrBasicContent, wantsHeaderFooter, preSelectedType, perPlacementSizes,
      isGuided, showCheckoutCard, showMemberPitch, tempPacketId, isCheckingOut,
      runningCost, realMockupUrl, lifestyleMockupUrl, currentPlacement, sizeCostBonuses,
    },
    {
      setSimpleStep, setWantsHeaderFooter: state.setWantsHeaderFooter,
      setCurrentPlacementIndex: state.setCurrentPlacementIndex,
      setGraphicSize: state.setGraphicSize,
      setPlacementGraphicChoice: state.setPlacementGraphicChoice,
      setPerPlacementSizes: state.setPerPlacementSizes,
      setIsGeneratingBasicMockup: state.setIsGeneratingBasicMockup,
      setIsGeneratingPlusMockup: state.setIsGeneratingPlusMockup,
      setQrBasicMockup: state.setQrBasicMockup,
      setQrPlusMockup: state.setQrPlusMockup,
      setShowCheckoutCard: state.setShowCheckoutCard,
      setShowMemberPitch: state.setShowMemberPitch,
      setGuidedQueue, setPendingPostTypeStep,
      updateTempPacket, generateRealMockup, handlePublicCheckout,
    }
  );

  const tier = getTierInfo();

  if (showMemberPitch) {
    const memberEarnings = (selectedProductType?.memberEarnings || 5);
    return (
      <Card className="bg-slate-800/50 border-slate-700">
        <CardHeader className="pb-1 pt-3 flex flex-row items-center justify-between gap-2">
          <p className="text-xs text-slate-400 flex items-center gap-1">
            <ShoppingCart className="w-3 h-3" />
            {OWNER_CAPABILITIES.label}
          </p>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/')}
            className="text-white/50 hover:text-white"
            aria-label="Back to home"
            data-testid="owner-back-home-pitch"
          >
            <X className="w-4 h-4" />
          </Button>
        </CardHeader>
        <CardContent className="p-4 pt-1 space-y-4">
          <OwnerCostSummary
            basePrice={selectedProductType?.retailPrice || 0}
            sizeCost={sizeCostBonuses[selectedShirtSize] || 0}
            placementCost={Math.max(0, selectedPlacements.length - 1) * placementCostExtra}
            textCost={textLines * textLineCost}
            total={runningCost}
          />
          <MemberConversionPitch
            earnings={memberEarnings}
            onSignUp={() => navigate(`/members?tempPacketId=${tempPacketId || ''}&wizard=super-simple`)}
            onSkip={handlePublicCheckout}
          />
          <div className="flex gap-3 flex-wrap justify-between pt-2 border-t border-slate-700">
            <Button variant="outline" onClick={() => setShowMemberPitch(false)} data-testid="button-back-from-pitch">
              <ChevronLeft className="w-4 h-4 mr-1" />
              Back
            </Button>
            <Button
              onClick={handlePublicCheckout}
              disabled={isCheckingOut || !tempPacketId}
              className="bg-blue-500 hover:bg-blue-600"
              data-testid="button-add-to-cart"
            >
              {isCheckingOut ? (
                <>
                  <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <ShoppingCart className="w-4 h-4 mr-1" />
                  Buy Now — ${runningCost.toFixed(2)}
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-slate-800/50 border-slate-700">
      <CardHeader className="pb-1 pt-3 flex flex-row items-center justify-between gap-2">
        <p className="text-xs text-slate-400 flex items-center gap-1">
          <ShoppingCart className="w-3 h-3" />
          {OWNER_CAPABILITIES.label}
        </p>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate('/')}
          className="text-white/50 hover:text-white"
          aria-label="Back to home"
          data-testid="owner-back-home"
        >
          <X className="w-4 h-4" />
        </Button>
      </CardHeader>
      <CardContent className="p-4 pt-1">
        {guidedQueue.length === 0 && (
          <>
            {tier && (
              <div className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full border mb-2 ${tier.color}`} data-testid="badge-tier-label">
                {tier.label}
              </div>
            )}
            <SimpleWizardProgressBar currentStep={simpleStep} currentPlacement={currentPlacement} />
            {runningCost > 0 && (
              <div className={`flex items-center justify-center gap-2 mb-3 py-1.5 px-3 rounded-full bg-blue-500/10 border border-blue-500/20 mx-auto w-fit transition-all ${costPulse ? 'scale-110 border-blue-400/60 bg-blue-500/20' : ''}`} data-testid="badge-running-cost">
                <Tag className="w-3.5 h-3.5 text-blue-400" />
                <span className="text-blue-400 font-bold text-sm">
                  ${runningCost.toFixed(2)} estimated cost
                </span>
              </div>
            )}
          </>
        )}

        <div className="min-h-[350px]" id="wizard-step-content">
          {guidedQueue.length > 0 && GUIDED_CARDS[guidedQueue[0]] ? (
            <GuidedCard
              data={GUIDED_CARDS[guidedQueue[0]]}
              onContinue={handleGuidedContinue}
            />
          ) : (
            <OwnerWizardStepContent
              simpleStep={simpleStep}
              selectedProductType={selectedProductType}
              selectedColor={selectedColor}
              selectedShirtSize={selectedShirtSize}
              selectedPlacements={selectedPlacements}
              graphicLocation={graphicLocation}
              graphicSize={graphicSize}
              qrType={qrType}
              textLayoutChoice={textLayoutChoice}
              headerStyle={headerStyle}
              footerStyle={footerStyle}
              currentPlacement={currentPlacement}
              currentPlacementIndex={currentPlacementIndex}
              placementGraphicChoice={placementGraphicChoice}
              qrBasicInputType={qrBasicInputType}
              qrBasicContent={qrBasicContent}
              qrBasicMockup={qrBasicMockup}
              qrPlusMockup={qrPlusMockup}
              qrPositionX={qrPositionX}
              qrPositionY={qrPositionY}
              qrSizePercent={qrSizePercent}
              areaImageUrl={areaImageUrl}
              areaImageMode={areaImageMode}
              isGeneratingBasicMockup={isGeneratingBasicMockup}
              isGeneratingPlusMockup={isGeneratingPlusMockup}
              isGeneratingRealMockup={isGeneratingRealMockup}
              realMockupUrl={realMockupUrl}
              lifestyleMockupUrl={lifestyleMockupUrl}
              tempPacketId={tempPacketId}
              runningCost={runningCost}
              wantsHeaderFooter={wantsHeaderFooter}
              pricingSettings={pricingSettings}
              placementCostExtra={placementCostExtra}
              textLineCost={textLineCost}
              sizeCostBonuses={sizeCostBonuses}
              allowedTypes={allowedTypes}
              allTypeDefinitions={allTypeDefinitions}
              preSelectedType={preSelectedType}
              minTierIndex={minTierIndex}
              textLines={textLines}
              setSelectedColor={state.setSelectedColor}
              setSelectedShirtSize={state.setSelectedShirtSize}
              setQrType={state.setQrType}
              setSelectedPlacements={state.setSelectedPlacements}
              setGraphicSize={state.setGraphicSize}
              setWantsHeaderFooter={state.setWantsHeaderFooter}
              setHeaderStyle={state.setHeaderStyle}
              setFooterStyle={state.setFooterStyle}
              setTextLayoutChoice={state.setTextLayoutChoice}
              setPlacementGraphicChoice={state.setPlacementGraphicChoice}
              setQrBasicInputType={state.setQrBasicInputType}
              setQrBasicContent={state.setQrBasicContent}
              setQrPositionX={state.setQrPositionX}
              setQrPositionY={state.setQrPositionY}
              setQrSizePercent={state.setQrSizePercent}
              setAreaImageUrl={state.setAreaImageUrl}
              setAreaImageMode={state.setAreaImageMode}
              setRunningCost={state.setRunningCost}
              setCostPulse={state.setCostPulse}
              setSimpleStep={setSimpleStep}
              handleProductSelect={handleProductSelect}
              navigate={navigate}
            />
          )}
        </div>

        {guidedQueue.length === 0 && (
        <div className="sticky bottom-0 flex flex-wrap gap-3 justify-between pt-4 pb-2 border-t border-slate-700 bg-slate-800/95 backdrop-blur-sm -mx-6 px-6 z-10 mt-4">
          {simpleStep !== 'product' && (
          <Button
            variant="outline"
            onClick={handleBack}
            className="flex-1 min-w-[100px] sm:flex-none"
            data-testid="button-owner-back"
          >
            <ChevronLeft className="w-4 h-4 mr-1" />
            Back
          </Button>
          )}

          {simpleStep !== 'generate' && simpleStep !== 'qr-basic-type' && simpleStep !== ('compose-explain' as SimpleWizardStep) && (
            <Button
              onClick={handleNext}
              disabled={!canProceed}
              className={`flex-1 min-w-[100px] sm:flex-none transition-all duration-300 ${
                canProceed
                  ? isFinalStep
                    ? "bg-blue-500 hover:bg-blue-600 shadow-lg shadow-blue-500/40"
                    : "bg-green-500 hover:bg-green-600 shadow-lg shadow-green-500/40"
                  : "bg-slate-600"
              }`}
              style={canProceed ? { animation: "glow 1.2s ease-in-out infinite" } : undefined}
              data-testid="button-owner-next"
            >
              {isFinalStep ? (
                <>
                  <ShoppingCart className="w-4 h-4 mr-1" />
                  Add to Cart
                </>
              ) : (
                <>
                  Next
                  <ChevronRight className="w-4 h-4 ml-1" />
                </>
              )}
            </Button>
          )}
        </div>
        )}
      </CardContent>
    </Card>
  );
}

export default OwnerWizard;
