import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  Sparkles, X, DollarSign,
  Loader2,
  ChevronLeft, ChevronRight
} from "lucide-react";
import { useMemberAuth } from "@/features/members/MemberAuthContext";
import { useQueryClient } from "@tanstack/react-query";
import { SimpleWizardProgressBar } from "@/features/shared/components/wizardSteps/WizardProgressBars";
import { useWizardContext } from './WizardContext';
import { BlackboardCard, BLACKBOARD_CONTENT, QRTypeBlackboard } from './wizard-blackboard';
import { WizardSignInGate, FINAL_CONFIRM_STEPS } from './wizard-sign-in-gate';
import { WizardProductSteps } from './wizard-steps-product';
import { WizardMediaSteps } from './wizard-steps-media';
import { useSuperSimpleTutorial } from './useSuperSimpleTutorial';

export function SuperSimpleWizard() {
  const {
    capabilities,
    user,
    simpleStep, setSimpleStep,
    selectedChannel, setSelectedChannel,
    selectedProductType,
    selectedColor,
    selectedShirtSize,
    graphicSize,
    qrType, setQrType,
    isPublishing,
    productGraphic, setProductGraphic,
    originalUrlGraphic,
    urlGraphic, setUrlGraphic,
    currentPlacement,
    qrBasicMockup,
    qrPlusMockup,
    qrCanvasMockup,
    qrPlayMockup,
    composeMockup,
    publishedPacketId,
    currentPacketId, setCurrentPacketId,
    runningEarnings,
    earningsPulse,
    showSignInToPublish, setShowSignInToPublish,
    pendingVideoFile, setPendingVideoFile,
    playVideoUrl, setPlayVideoUrl,
    simpleTitle, setSimpleTitle,
    simpleDescription, setSimpleDescription,
    contentRightsConfirmed,
    setContentRightsConfirmed,
    pricingSettings,
    handleSimpleNext,
    handleSimpleBack,
    canSimpleProceed,
    setViewMode,
    setWizardTier,
  } = useWizardContext();

  const { getAuthHeaders: getMemberAuthHeaders } = useMemberAuth();
  const queryClient = useQueryClient();
  const autoPublishTriggered = useRef(false);

  useEffect(() => {
    if (showSignInToPublish && user?.id && !autoPublishTriggered.current) {
      autoPublishTriggered.current = true;
      setShowSignInToPublish(false);

      (async () => {
        try {
          const authHeaders = await getMemberAuthHeaders();

          if (selectedChannel?.id === 'temp-channel') {
            const channelRes = await fetch(`/api/members/${user.id}/channels`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', ...authHeaders },
              body: JSON.stringify({ name: selectedChannel.name || 'My Products' }),
            });
            if (channelRes.ok) {
              const channelData = await channelRes.json();
              const realId = channelData.id || channelData.channelId;
              setSelectedChannel({ id: realId, name: selectedChannel.name || 'My Products' });
            }
          }

          if (pendingVideoFile && playVideoUrl?.startsWith('blob:')) {
            const formData = new FormData();
            formData.append('file', pendingVideoFile);
            formData.append('storeType', 'member');
            const uploadRes = await fetch(`/api/members/${user.id}/videos/upload`, {
              method: 'POST',
              headers: { ...authHeaders },
              body: formData,
            });
            if (uploadRes.ok) {
              const uploadData = await uploadRes.json();
              if (uploadData.url) {
                setPlayVideoUrl(uploadData.url);
              }
            }
            setPendingVideoFile(null);
          }
        } catch (err) {
          console.error('[Wizard] Post-auth setup error:', err);
        }

        handleSimpleNext();
      })();
    }
    if (!showSignInToPublish) {
      autoPublishTriggered.current = false;
    }
  }, [showSignInToPublish, user?.id]);

  const tutorial = useSuperSimpleTutorial({
    userId: user?.id,
    simpleStep,
    selectedChannel,
    selectedProductType,
    selectedColor,
    selectedShirtSize,
    qrType,
    pricingSettings,
    handleSimpleNext,
    setQrType,
  });

  const {
    isShowingBlackboard, currentBlackboardId,
    showQrTypeCards, showQrCongrats, setShowQrCongrats,
    showFinishBlackboard, setShowFinishBlackboard,
    checkingTutorial, qrTypeExploreStep,
    handleBlackboardContinue, handleQrTypeChosen, handleQrTypeShowMore,
    handleSuperNext, getCongratsBlackboard, getQrCongratsBlackboard,
    setBlackboardQueue, setPendingAdvance,
  } = tutorial;

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

  if (checkingTutorial) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-400" />
      </div>
    );
  }

  if (showFinishBlackboard) {
    return (
      <Card className="bg-slate-800/50 border-slate-700">
        <CardHeader className="pb-1 pt-3 flex flex-row items-center justify-between gap-2">
          <p className="text-xs text-emerald-400 flex items-center gap-1">
            <Sparkles className="w-3 h-3" />
            {capabilities.label}
          </p>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setViewMode('index')}
            className="text-white/50 hover:text-white"
            aria-label="Close wizard"
            data-testid="super-simple-close-finish"
          >
            <X className="w-4 h-4" />
          </Button>
        </CardHeader>
        <CardContent className="p-4 pt-1">
          <BlackboardCard
            data={BLACKBOARD_CONTENT['bb-finish']}
            onContinue={() => {
              setShowFinishBlackboard(false);
              setViewMode('index');
            }}
          />
        </CardContent>
      </Card>
    );
  }

  const canProceed = canSimpleProceed();

  return (
    <Card className="bg-slate-800/50 border-slate-700">
      <CardHeader className="pb-1 pt-3 flex flex-row items-center justify-between gap-2">
        <p className="text-xs text-emerald-400 flex items-center gap-1">
          <Sparkles className="w-3 h-3" />
          {capabilities.label}
        </p>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setViewMode('index')}
          className="text-white/50 hover:text-white"
          aria-label="Close wizard"
          data-testid="super-simple-close"
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
          return !isShowingBlackboard && !showQrTypeCards && !showQrCongrats && tier ? (
            <div className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full border mb-2 ${tier.color}`} data-testid="badge-tier-label">
              {tier.label}
            </div>
          ) : null;
        })()}

        {!isShowingBlackboard && !showQrTypeCards && !showQrCongrats && (
          <SimpleWizardProgressBar currentStep={simpleStep} currentPlacement={currentPlacement} />
        )}

        {capabilities.showEarnings && !isShowingBlackboard && !showQrTypeCards && !showQrCongrats && runningEarnings > 0 && (
          <div className={`flex items-center justify-center gap-2 mb-3 py-1.5 px-3 rounded-full bg-emerald-500/10 border border-emerald-500/20 mx-auto w-fit animate-in fade-in duration-500 transition-all ${earningsPulse ? 'scale-110 border-emerald-400/60 bg-emerald-500/20' : ''}`} data-testid="badge-potential-earnings">
            <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
            <span className="text-emerald-400 font-bold text-sm">
              ${runningEarnings.toFixed(2)} potential earnings
            </span>
          </div>
        )}

        <div className="min-h-[350px]" id="wizard-step-content">
          {isShowingBlackboard && currentBlackboardId && (() => {
            const congratsData = getCongratsBlackboard(currentBlackboardId);
            if (congratsData) {
              return <BlackboardCard data={congratsData} onContinue={handleBlackboardContinue} />;
            }
            const staticData = BLACKBOARD_CONTENT[currentBlackboardId];
            if (staticData) {
              return <BlackboardCard data={staticData} onContinue={handleBlackboardContinue} />;
            }
            return null;
          })()}

          {showQrCongrats && !isShowingBlackboard && (
            <BlackboardCard
              data={getQrCongratsBlackboard()}
              onContinue={() => {
                setShowQrCongrats(false);
                setBlackboardQueue(['bb-whats-next']);
                setPendingAdvance(true);
              }}
            />
          )}

          {showQrTypeCards && !isShowingBlackboard && !showQrCongrats && (
            <QRTypeBlackboard
              step={qrTypeExploreStep}
              onChoose={handleQrTypeChosen}
              onContinue={handleQrTypeShowMore}
            />
          )}

          {!isShowingBlackboard && !showQrTypeCards && !showQrCongrats && (
            <>
              {showSignInToPublish && (
                <WizardSignInGate
                  onSuccess={() => {}}
                  onCancel={() => setShowSignInToPublish(false)}
                />
              )}

              <WizardProductSteps
                sharePacketId={sharePacketId}
                getShareKitData={getShareKitData}
                onCreateAnother={handleCreateAnother}
                onBackToDashboard={handleBackToDashboard}
              />
              <WizardMediaSteps
                sharePacketId={sharePacketId}
                getShareKitData={getShareKitData}
                onCreateAnother={handleCreateAnother}
                onBackToDashboard={handleBackToDashboard}
              />
            </>
          )}
        </div>

        {!isShowingBlackboard && !showQrTypeCards && !showQrCongrats && !showSignInToPublish && !FINAL_CONFIRM_STEPS.includes(simpleStep) && (
          <div className="sticky bottom-0 flex flex-wrap gap-3 justify-between pt-4 pb-2 border-t border-slate-700 bg-slate-800/95 backdrop-blur-sm -mx-6 px-6 z-10 mt-4">
            <Button
              variant="outline"
              onClick={handleSimpleBack}
              disabled={simpleStep === 'channel'}
              className="flex-1 min-w-[100px] sm:flex-none"
              data-testid="button-simple-back"
            >
              <ChevronLeft className="w-4 h-4 mr-1" />
              Back
            </Button>

            {simpleStep !== 'url-publish' && (
              <Button
                onClick={handleSuperNext}
                disabled={!canProceed}
                className={`flex-1 min-w-[100px] sm:flex-none transition-all duration-300 ${
                  canProceed
                    ? "bg-emerald-500 hover:bg-emerald-600 shadow-lg shadow-emerald-500/40"
                    : "bg-slate-600"
                }`}
                style={canProceed ? { animation: "glow 1.2s ease-in-out infinite" } : undefined}
                data-testid="button-simple-next"
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
