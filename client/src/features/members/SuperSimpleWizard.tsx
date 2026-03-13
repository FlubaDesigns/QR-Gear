import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  Sparkles, X, Package, DollarSign,
  QrCode, TrendingUp, Check,
  Palette, Loader2,
  ChevronLeft, ChevronRight
} from "lucide-react";
import { useMemberAuth } from "@/features/members/MemberAuthContext";
import { useQueryClient } from "@tanstack/react-query";
import { SimpleWizardProgressBar } from "@/features/shared/components/wizardSteps/WizardProgressBars";
import { calculateSizeEarningsBonuses } from "@/features/shared/components/wizardSteps";
import type { QRType } from "@/features/shared/components/wizardSteps/wizardTypes";
import { useWizardContext } from './WizardContext';
import { db } from "@/lib/firebase";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { BlackboardCard, BLACKBOARD_CONTENT, QRTypeBlackboard, QR_TYPE_CARDS, type BlackboardData } from './wizard-blackboard';
import { WizardSignInGate, PRE_STEP_BLACKBOARDS, POST_STEP_BLACKBOARDS, FINAL_CONFIRM_STEPS } from './wizard-sign-in-gate';
import { WizardProductSteps } from './wizard-steps-product';
import { WizardMediaSteps } from './wizard-steps-media';

export function SuperSimpleWizard() {
  const {
    user,
    api,
    simpleStep, setSimpleStep,
    selectedChannel, setSelectedChannel,
    isCreatingChannel, setIsCreatingChannel,
    newChannelName, setNewChannelName,
    selectedProductType,
    selectedColor, setSelectedColor,
    selectedShirtSize, setSelectedShirtSize,
    graphicLocation,
    graphicSize, setGraphicSize,
    wantsHeaderFooter, setWantsHeaderFooter,
    currentPacketId, setCurrentPacketId,
    runningEarnings, setRunningEarnings,
    earningsPulse, setEarningsPulse,
    qrType, setQrType,
    isPublishing,
    headerStyle, setHeaderStyle,
    footerStyle, setFooterStyle,
    productGraphic, setProductGraphic,
    originalUrlGraphic, setOriginalUrlGraphic,
    urlGraphic, setUrlGraphic,
    videoUrl, setVideoUrl,
    textLayoutChoice, setTextLayoutChoice,
    selectedPlacements, setSelectedPlacements,
    qrGraphic, setQrGraphic,
    urlSourceChoice, setUrlSourceChoice,
    libraryChoice, setLibraryChoice,
    currentPlacementIndex,
    placementGraphicChoice, setPlacementGraphicChoice,
    perPlacementConfigs,
    currentPlacement,
    qrBasicInputType, setQrBasicInputType,
    qrBasicContent, setQrBasicContent,
    qrBasicMockup, setQrBasicMockup,
    isGeneratingBasicMockup,
    qrBasicSaveChoice, setQrBasicSaveChoice,
    isQrBasicSaving,
    canvasSaveChoice, setCanvasSaveChoice,
    isCanvasSaving,
    publishedQrGraphicUrl,
    publishedProductGraphicUrl,
    playVideoUrl, setPlayVideoUrl,
    isUploadingVideo,
    videoUploadError,
    videoUploadProgress,
    videoUploadSuccess,
    qrPlusMockup, setQrPlusMockup,
    isGeneratingPlusMockup, setIsGeneratingPlusMockup,
    qrPlusSaveChoice, setQrPlusSaveChoice,
    isQrPlusSaving,
    qrCanvasMockup,
    isGeneratingCanvasMockup,
    qrPlayMockup,
    isGeneratingPlayMockup,
    composeItems, setComposeItems,
    composeMode, setComposeMode,
    composeHostingTerm, setComposeHostingTerm,
    composeMockup,
    isGeneratingComposeMockup,
    publishedCanvasPlayItems,
    isLoadingPublishedItems,
    composeInstanceId,
    pricingSettings,
    placementEarningsBonus,
    textLineEarningsBonus,
    handleProductSelect,
    handleVideoFileUpload,
    handleCanvasDone,
    handleSimplePublish,
    handleSimpleNext,
    handleSimpleBack,
    canSimpleProceed,
    fetchPublishedCanvasPlayItems,
    setViewMode,
    setWizardTier,
    simpleTitle, setSimpleTitle,
    simpleDescription, setSimpleDescription,
    titleVertical, setTitleVertical,
    titleHorizontal, setTitleHorizontal,
    titleColor, setTitleColor,
    titleSize, setTitleSize,
    titleFont, setTitleFont,
    descVertical, setDescVertical,
    descHorizontal, setDescHorizontal,
    descColor, setDescColor,
    descSize, setDescSize,
    descFont, setDescFont,
    contentRightsConfirmed,
    setContentRightsConfirmed,
    qrPositionX, setQrPositionX,
    qrPositionY, setQrPositionY,
    qrSizePercent, setQrSizePercent,
    areaImageUrl, setAreaImageUrl,
    areaImageMode, setAreaImageMode,
    publishedPacketId,
    showSignInToPublish, setShowSignInToPublish,
    pendingVideoFile, setPendingVideoFile,
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

  const [blackboardQueue, setBlackboardQueue] = useState<string[]>(['bb-welcome', 'bb-channels']);
  const [qrTypeExploreStep, setQrTypeExploreStep] = useState<string>('bb-qr-basic');
  const [showQrTypeCards, setShowQrTypeCards] = useState(false);
  const [seenSteps, setSeenSteps] = useState<Set<string>>(new Set(['channel']));
  const [pendingAdvance, setPendingAdvance] = useState(false);
  const [showFinishBlackboard, setShowFinishBlackboard] = useState(false);
  const [checkingTutorial, setCheckingTutorial] = useState(true);
  const [tutorialAlreadyDone, setTutorialAlreadyDone] = useState(false);
  const [showQrCongrats, setShowQrCongrats] = useState(false);

  useEffect(() => {
    if (!user?.id) {
      setCheckingTutorial(false);
      return;
    }
    const check = async () => {
      try {
        const docRef = doc(db, "member_profiles", user.id);
        const snap = await getDoc(docRef);
        if (snap.exists() && snap.data()?.tutorial_complete === true) {
          setTutorialAlreadyDone(true);
        }
      } catch {
      }
      setCheckingTutorial(false);
    };
    check();
  }, [user?.id]);

  useEffect(() => {
    if (tutorialAlreadyDone) {
      setBlackboardQueue([]);
      const allStepKeys = Object.keys(PRE_STEP_BLACKBOARDS).concat(Object.keys(POST_STEP_BLACKBOARDS));
      setSeenSteps(prev => {
        const next = new Set(prev);
        allStepKeys.forEach(k => next.add(k));
        return next;
      });
    }
  }, [tutorialAlreadyDone]);

  useEffect(() => {
    if (blackboardQueue.length === 0 && pendingAdvance) {
      setPendingAdvance(false);
      handleSimpleNext();
    }
  }, [blackboardQueue, pendingAdvance]);

  useEffect(() => {
    if (!seenSteps.has(simpleStep)) {
      const preCards = PRE_STEP_BLACKBOARDS[simpleStep];
      if (preCards) {
        setBlackboardQueue([...preCards]);
      }
      setSeenSteps(prev => new Set(prev).add(simpleStep));
    }
  }, [simpleStep]);

  const completeTutorial = async () => {
    try {
      if (user?.id) {
        await setDoc(
          doc(db, "member_profiles", user.id),
          { tutorial_complete: true, tutorial_completed_at: new Date().toISOString() },
          { merge: true }
        );
      }
    } catch (e) {
      console.error('Failed to save tutorial completion:', e);
    }
  };

  const handleBlackboardContinue = () => {
    if (blackboardQueue.length <= 1) {
      setBlackboardQueue([]);
      if (simpleStep === 'type' && blackboardQueue[0] === 'bb-qr-intro') {
        setShowQrTypeCards(true);
      }
    } else {
      setBlackboardQueue(prev => prev.slice(1));
    }
  };

  const handleQrTypeChosen = (type: QRType) => {
    setQrType(type);
    setShowQrTypeCards(false);
    setShowQrCongrats(true);
  };

  const handleQrTypeShowMore = () => {
    const card = QR_TYPE_CARDS[qrTypeExploreStep];
    if (card?.nextStep && QR_TYPE_CARDS[card.nextStep]) {
      setQrTypeExploreStep(card.nextStep);
    }
  };

  const handleSuperNext = async () => {
    if (FINAL_CONFIRM_STEPS.includes(simpleStep) && !seenSteps.has(`finish-${simpleStep}`)) {
      setSeenSteps(prev => new Set(prev).add(`finish-${simpleStep}`));
      await completeTutorial();
      setShowFinishBlackboard(true);
      return;
    }

    const postCards = POST_STEP_BLACKBOARDS[simpleStep];
    if (postCards && !seenSteps.has(`post-${simpleStep}`)) {
      setBlackboardQueue([...postCards]);
      setSeenSteps(prev => new Set(prev).add(`post-${simpleStep}`));
      setPendingAdvance(true);
      return;
    }
    await handleSimpleNext();
  };

  const getCongratsBlackboard = (stepId: string): BlackboardData | null => {
    switch (stepId) {
      case 'bb-channel-congrats':
        return {
          icon: <Check className="w-8 h-8" />,
          title: "Nice Work!",
          lines: [
            { text: selectedChannel
              ? `You picked "${selectedChannel.name}" — great choice!`
              : "You've got your channel set up!" },
            { text: "That's the first step in building your digital storefront.", highlight: true },
            { text: "Everything you create will live in this channel. Customers can browse it like a mini shop." },
            { text: "Next up: picking the product you want to sell. This is where it gets fun." },
          ],
          tip: "You're already ahead of most people. They're still reading the instructions.",
        };
      case 'bb-product-congrats':
        return {
          icon: <Package className="w-8 h-8" />,
          title: "Great Pick!",
          lines: [
            { text: selectedProductType
              ? `You chose the ${selectedProductType.title} — solid choice!`
              : "You've got your product locked in!" },
            { text: "Now you've got something real to work with.", highlight: true },
            { text: "Next we'll tailor it and make it uniquely yours — colors, size, and your own QR experience." },
            { text: "This is where your product starts to come alive." },
          ],
          tip: "Every choice you make from here adds your personal touch. Let's make it yours.",
        };
      case 'bb-color-congrats': {
        const base = selectedProductType?.memberEarnings || 0;
        return {
          icon: <Palette className="w-8 h-8" />,
          title: "Looking Good!",
          lines: [
            { text: selectedColor
              ? `Nice color choice! That's going to look great on your mockup.`
              : "Color is set!" },
            { text: `Your earnings so far: $${base.toFixed(2)} per sale`, highlight: true },
            { text: "Good news — color is free. It doesn't change the price at all." },
            { text: "But the next step will. Let's talk about size and how it bumps your earnings up." },
          ],
          tip: "That $" + base.toFixed(2) + " is just the floor. It's about to go higher.",
        };
      }
      case 'bb-size-congrats': {
        const base = selectedProductType?.memberEarnings || 0;
        const sizeBonuses = calculateSizeEarningsBonuses(
          pricingSettings?.sizeUpcharges,
          pricingSettings?.memberProfitShare || 0.25
        );
        const sizeBonus = sizeBonuses[selectedShirtSize] || 0;
        const newTotal = base + sizeBonus;
        return {
          icon: <TrendingUp className="w-8 h-8" />,
          title: "Cha-Ching!",
          lines: [
            { text: `Base earnings: $${base.toFixed(2)}` },
            { text: sizeBonus > 0
              ? `+ Size upgrade (${selectedShirtSize}): +$${sizeBonus.toFixed(2)}`
              : `Size (${selectedShirtSize}): no extra cost — same earnings` },
            { text: `= New total: $${newTotal.toFixed(2)} per sale`, highlight: true },
            { text: "See how that works? Every choice can add to your earnings." },
            { text: "Next up: your QR type. Some of those add even more value." },
          ],
        };
      }
      default:
        return null;
    }
  };

  const getQrCongratsBlackboard = (): BlackboardData => {
    const base = selectedProductType?.memberEarnings || 0;
    const sizeBonuses = calculateSizeEarningsBonuses(
      pricingSettings?.sizeUpcharges,
      pricingSettings?.memberProfitShare || 0.25
    );
    const sizeBonus = sizeBonuses[selectedShirtSize] || 0;
    const currentTotal = base + sizeBonus;
    const typeLabel = qrType === 'qr-basic' ? 'QR Basic' : qrType === 'qr-plus' ? 'QR Plus' : qrType === 'qr-canvas' ? 'QR Canvas' : qrType === 'qr-play' ? 'QR Play' : 'your QR type';
    const isPlatformType = qrType === 'qr-canvas' || qrType === 'qr-play';
    const isBasic = qrType === 'qr-basic';
    const isPlus = qrType === 'qr-plus';

    const getLines = () => {
      const shared = [
        { text: `You picked ${typeLabel} — great choice!` },
        { text: `Your earnings per sale: $${currentTotal.toFixed(2)}`, highlight: true as boolean },
      ];

      if (isBasic) {
        return [
          ...shared,
          { text: "QR Basic is simple and powerful. The QR code bakes your content right in — no server, no platform, no ongoing costs." },
          { text: "Someone scans it, they get your link, text, or contact info instantly. Done." },
          { text: "Want to level up later? QR Canvas and QR Play connect to a living platform where you can change what the QR shows — even after the shirt is printed." },
        ];
      }

      if (isPlus) {
        return [
          ...shared,
          { text: "QR Plus adds your custom header and footer text around the QR code — it makes the design pop and tells people what to expect when they scan." },
          { text: "Like Basic, the QR content is baked in. No server needed, no ongoing costs." },
          { text: "Ready for the next level? QR Canvas and QR Play connect to a living platform — you can update what the QR shows anytime, even after the shirt ships." },
        ];
      }

      return [
        ...shared,
        { text: "When you save this, you're creating a \"moment\" — a unique experience tied to your QR code." },
        { text: qrType === 'qr-canvas'
          ? "Your image becomes a living page anyone can see when they scan."
          : "Your video becomes a living page anyone can watch when they scan."
        },
        { text: "Here's the exciting part: save 2 or more moments and you unlock QR Compose.", highlight: true as boolean },
        { text: "QR Compose lets you build a rotating playlist — one QR code, many experiences. Imagine your shirt showing something different every time someone scans it." },
      ];
    };

    const getTip = () => {
      if (isBasic || isPlus) {
        return "Simple, reliable, and ready to sell. You can always explore Canvas and Play later to unlock even more possibilities.";
      }
      return "Every moment you save gets you closer to QR Compose. Think of it as building your collection.";
    };

    return {
      icon: <QrCode className="w-8 h-8" />,
      title: isPlatformType ? "Save the Moment!" : "Nice and Simple!",
      lines: getLines(),
      tip: getTip(),
    };
  };

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
            First Product Builder
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
  const isShowingBlackboard = blackboardQueue.length > 0;
  const currentBlackboardId = blackboardQueue[0] || null;

  return (
    <Card className="bg-slate-800/50 border-slate-700">
      <CardHeader className="pb-1 pt-3 flex flex-row items-center justify-between gap-2">
        <p className="text-xs text-emerald-400 flex items-center gap-1">
          <Sparkles className="w-3 h-3" />
          First Product Builder
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

        {!isShowingBlackboard && !showQrTypeCards && !showQrCongrats && runningEarnings > 0 && (
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
