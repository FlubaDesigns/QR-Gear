import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { ChevronLeft, ChevronRight, Layers, DollarSign, X } from "lucide-react";
import { SimpleWizardProgressBar } from "@/features/shared/components/wizardSteps/WizardProgressBars";
import { useWizardContext } from './WizardContext';
import { AdvancedWizardStepContent } from './AdvancedWizardStepContent';

export function AdvancedWizard() {
  const {
    capabilities,
    user,
    simpleStep, setSimpleStep,
    selectedChannel,
    selectedProductType,
    currentPacketId, setCurrentPacketId,
    runningEarnings,
    earningsPulse,
    qrType, setQrType,
    productGraphic, setProductGraphic,
    urlGraphic, setUrlGraphic,
    currentPlacement,
    qrBasicMockup,
    publishedPacketId,
    qrPlusMockup,
    qrCanvasMockup,
    qrPlayMockup,
    composeMockup,
    contentRightsConfirmed,
    setContentRightsConfirmed,
    handleSimpleNext,
    handleSimpleBack,
    canSimpleProceed,
    setViewMode,
    simpleTitle, setSimpleTitle,
    simpleDescription, setSimpleDescription,
  } = useWizardContext();

  const sharePacketId = publishedPacketId || currentPacketId || '';
  const getShareKitData = () => ({
    packetId: sharePacketId,
    shareUrl: `/p/${sharePacketId}`,
    title: simpleTitle || 'QR Gear Product',
    description: simpleDescription || '',
    memberId: user?.id || '',
    itemImage: qrCanvasMockup || qrBasicMockup || qrPlusMockup || qrPlayMockup || composeMockup || productGraphic || '',
    previewUrl: productGraphic || urlGraphic || '',
    retailPrice: selectedProductType?.retailPrice || 0,
    channelName: selectedChannel?.name || '',
  });

  const FINAL_CONFIRM_STEPS = ['qr-basic-confirm', 'qr-plus-confirm', 'canvas-confirm', 'play-save-choice', 'compose-confirm'];

  const handleCreateAnother = () => {
    setSimpleStep('channel');
    setCurrentPacketId(null);
    setSimpleTitle('');
    setSimpleDescription('');
    setQrType('');
    setContentRightsConfirmed(false);
    setUrlGraphic('');
    setProductGraphic('');
  };

  const handleBackToDashboard = () => {
    setSimpleStep('channel');
    setViewMode('index');
    setCurrentPacketId(null);
    setSimpleTitle('');
    setSimpleDescription('');
    setQrType('');
    setContentRightsConfirmed(false);
    setUrlGraphic('');
    setProductGraphic('');
  };

  if (capabilities.requiresAuth && !user) {
    return (
      <Card className="bg-slate-800/50 border-slate-700">
        <CardHeader className="pb-1 pt-3 flex flex-row items-center justify-between gap-2">
          <p className="text-xs text-slate-400 flex items-center gap-1">
            <Layers className="w-3 h-3" />
            {capabilities.label}
          </p>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setViewMode('index')}
            className="text-white/50 hover:text-white"
            aria-label="Close wizard"
            data-testid="advanced-close-unauth"
          >
            <X className="w-4 h-4" />
          </Button>
        </CardHeader>
        <CardContent className="p-4 pt-1 text-white/80">
          <p className="text-lg font-semibold text-white mb-2">Sign in required</p>
          <p className="text-sm text-white/70 mb-4">
            Advanced Builder needs your account so we can load your channels and save your setup.
          </p>
          <Button className="bg-blue-600 hover:bg-blue-500" onClick={() => setViewMode('index')} data-testid="advanced-back-to-home">
            Back to Home
          </Button>
        </CardContent>
      </Card>
    );
  }

  const canProceed = canSimpleProceed();

  return (
    <Card className="bg-slate-800/50 border-slate-700">
      <CardHeader className="pb-1 pt-3 flex flex-row items-center justify-between gap-2">
        <p className="text-xs text-blue-400 flex items-center gap-1">
          <Layers className="w-3 h-3" />
          {capabilities.label}
        </p>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setViewMode('index')}
          className="text-white/50 hover:text-white"
          aria-label="Close wizard"
          data-testid="button-advanced-close"
        >
          <X className="w-4 h-4" />
        </Button>
      </CardHeader>
      <CardContent className="p-4 pt-1">
        {(() => {
          const getTierInfo = () => {
            if (['play-upload', 'play-preview', 'play-save-choice'].includes(simpleStep)) {
              return { label: 'QR Play', color: 'text-purple-400 bg-purple-500/10 border-purple-500/20' };
            }
            if (['canvas-upload', 'canvas-crop', 'canvas-preview', 'canvas-save-choice', 'canvas-confirm', 'url-bg-pick', 'url-bg-crop', 'url-title', 'url-description', 'url-preview', 'url-publish'].includes(simpleStep)) {
              return { label: 'QR Canvas', color: 'text-blue-400 bg-blue-500/10 border-blue-500/20' };
            }
            if (['text-choice', 'text-edit-header', 'text-edit-footer', 'placement-config', 'shirt-preview', 'qr-plus-mockup', 'qr-plus-save-choice', 'qr-plus-confirm'].includes(simpleStep)) {
              return { label: 'QR Plus', color: 'text-orange-400 bg-orange-500/10 border-orange-500/20' };
            }
            if (['qr-basic-type', 'qr-basic-input', 'qr-basic-mockup', 'qr-basic-save-choice', 'qr-basic-confirm'].includes(simpleStep)) {
              return { label: 'QR Basic', color: 'text-slate-300 bg-slate-500/10 border-slate-500/20' };
            }
            if (['compose-pick-items', 'compose-mode', 'compose-durations', 'compose-order', 'compose-hosting', 'compose-mockup', 'compose-preview', 'compose-publish', 'compose-confirm'].includes(simpleStep)) {
              return { label: 'QR Compose', color: 'text-amber-400 bg-amber-500/10 border-amber-500/20' };
            }
            return { label: 'QR Basic', color: 'text-slate-300 bg-slate-500/10 border-slate-500/20' };
          };
          const tier = getTierInfo();
          return tier ? (
            <div className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full border mb-2 ${tier.color}`} data-testid="badge-advanced-tier-label">
              {tier.label}
            </div>
          ) : null;
        })()}
        <SimpleWizardProgressBar currentStep={simpleStep} currentPlacement={currentPlacement} />
        {capabilities.showEarnings && runningEarnings > 0 && (
          <div className={`flex items-center justify-center gap-2 mb-3 py-1.5 px-3 rounded-full bg-green-500/10 border border-green-500/20 mx-auto w-fit animate-in fade-in duration-500 transition-all ${earningsPulse ? 'scale-110 border-green-400/60 bg-green-500/20' : ''}`} data-testid="badge-advanced-potential-earnings">
            <DollarSign className="w-3.5 h-3.5 text-green-400" />
            <span className="text-green-400 font-bold text-sm">
              ${runningEarnings.toFixed(2)} potential earnings
            </span>
          </div>
        )}

          <AdvancedWizardStepContent
            sharePacketId={sharePacketId}
            getShareKitData={getShareKitData}
            onCreateAnother={handleCreateAnother}
            onBackToDashboard={handleBackToDashboard}
          />

        {!FINAL_CONFIRM_STEPS.includes(simpleStep) && (
          <div className="sticky bottom-0 flex flex-wrap gap-3 justify-between pt-4 pb-2 border-t border-slate-700 bg-slate-800/95 backdrop-blur-sm -mx-6 px-6 z-10 mt-4">
            <Button
              variant="outline"
              onClick={handleSimpleBack}
              disabled={simpleStep === 'channel'}
              className="flex-1 min-w-[100px] sm:flex-none"
              data-testid="button-advanced-back"
            >
              <ChevronLeft className="w-4 h-4 mr-1" />
              Back
            </Button>
            
            {simpleStep !== 'url-publish' && (
              <Button
                onClick={handleSimpleNext}
                disabled={!canProceed}
                className={`flex-1 min-w-[100px] sm:flex-none transition-all duration-300 ${
                  canProceed 
                    ? "bg-blue-500 hover:bg-blue-600 shadow-lg shadow-blue-500/40" 
                    : "bg-slate-600"
                }`}
                style={canProceed ? { animation: "glow 1.2s ease-in-out infinite" } : undefined}
                data-testid="button-advanced-next"
              >
                Next
                <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
