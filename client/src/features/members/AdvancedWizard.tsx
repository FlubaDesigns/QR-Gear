import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { ChevronLeft, ChevronRight, Layers, DollarSign, X } from "lucide-react";
import { SimpleWizardProgressBar } from "@/features/shared/components/wizardSteps/WizardProgressBars";
import { ChannelStep } from "@/features/shared/components/wizardSteps/ChannelStep";
import { ProductPickerStep, ProductCongratsStep, ColorPickerStep, SizePickerStep, getProductFriendlyName } from "@/features/shared/components/wizardSteps/ProductSteps";
import { GraphicSizeStep, PlacementCountStep, PlacementConfigStep } from "@/features/shared/components/wizardSteps/PlacementSteps";
import { TextLayoutChoiceStep, HeaderTextEditStep, FooterTextEditStep } from "@/features/shared/components/wizardSteps/TextSteps";
import { TypePickerStep, SurfacePickerStep, GenerateGraphicStep } from "@/features/shared/components/wizardSteps/TypeAndSurfaceSteps";
import { QRBasicTypeStep, QRBasicInputStep, QRBasicMockupStep, QRBasicSaveChoiceStep, QRBasicConfirmStep } from "@/features/shared/components/wizardSteps/QRBasicSteps";
import { QRPlusMockupStep, QRPlusSaveChoiceStep, QRPlusConfirmStep } from "@/features/shared/components/wizardSteps/QRPlusSteps";
import { QRCanvasExplainerStep, UrlSourceChoiceStep, SimpleBackgroundStep, QRCanvasSaveChoiceStep, QRCanvasConfirmStep, SimplePreviewStep, SimplePublishStep } from "@/features/shared/components/wizardSteps/CanvasSteps";
import { PlayVideoSourceStep, PlayPreviewStep, PlayPublishStep, PlayPublishedStep } from "@/features/shared/components/wizardSteps/PlaySteps";
import { ComposeModePicker, ComposePickItemsStep, ComposeDurationsStep, ComposeOrderStep, ComposeHostingStep, ComposePreviewStep, ComposePublishStep, ComposeConfirmStep, ComposeExplainerCard, PlatformAcknowledgementCard } from "@/features/shared/components/wizardSteps/ComposeSteps";
import { ShirtPreviewStep, UrlTitleStep, UrlDescriptionStep } from "@/features/shared/components/wizardSteps/PreviewAndPublishSteps";
import { ShareKitHandoff } from "@/features/shared/components/ShareKitHandoff";
import { calculateSizeEarningsBonuses, generateQRCodeUrl } from "@/features/shared/components/wizardSteps";
import { ContentRightsCheckbox } from "@/features/shared/components/ContentRightsCheckbox";
import { useWizardContext } from './WizardContext';

export function AdvancedWizard() {
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
    publishedPacketId,
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
    contentRightsConfirmed,
    setContentRightsConfirmed,
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

  if (!user) {
    return (
      <Card className="bg-slate-800/50 border-slate-700">
        <CardHeader className="pb-1 pt-3 flex flex-row items-center justify-between gap-2">
          <p className="text-xs text-slate-400 flex items-center gap-1">
            <Layers className="w-3 h-3" />
            Advanced Builder
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
          Advanced Builder
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
        {runningEarnings > 0 && (
          <div className={`flex items-center justify-center gap-2 mb-3 py-1.5 px-3 rounded-full bg-green-500/10 border border-green-500/20 mx-auto w-fit animate-in fade-in duration-500 transition-all ${earningsPulse ? 'scale-110 border-green-400/60 bg-green-500/20' : ''}`} data-testid="badge-advanced-potential-earnings">
            <DollarSign className="w-3.5 h-3.5 text-green-400" />
            <span className="text-green-400 font-bold text-sm">
              ${runningEarnings.toFixed(2)} potential earnings
            </span>
          </div>
        )}

        <div className="min-h-[350px]" id="wizard-step-content">
          {simpleStep === 'channel' && (
            <ChannelStep
              selectedChannel={selectedChannel}
              onSelect={setSelectedChannel}
              memberId={user.id}
              isCreatingChannel={isCreatingChannel}
              setIsCreatingChannel={setIsCreatingChannel}
              newChannelName={newChannelName}
              setNewChannelName={setNewChannelName}
            />
          )}
          
          {simpleStep === 'product' && (
            <ProductPickerStep
              selectedProduct={selectedProductType}
              onSelect={handleProductSelect}
            />
          )}
          
          {simpleStep === 'product-congrats' && selectedProductType && (
            <ProductCongratsStep
              productName={selectedProductType.title}
              earnings={selectedProductType.memberEarnings || 0}
            />
          )}
          
          {simpleStep === 'color' && (
            <ColorPickerStep
              selectedColor={selectedColor}
              onSelect={setSelectedColor}
              productName={getProductFriendlyName(selectedProductType?.title)}
            />
          )}
          
          {simpleStep === 'size' && (() => {
            const sizeEarningsBonuses = calculateSizeEarningsBonuses(
              pricingSettings?.sizeUpcharges,
              pricingSettings?.memberProfitShare || 0.25
            );
            return (
              <SizePickerStep
                selectedSize={selectedShirtSize}
                selectedColor={selectedColor}
                baseEarnings={runningEarnings}
                sizeEarningsBonuses={sizeEarningsBonuses}
                selectedPlacements={selectedPlacements}
                productName={getProductFriendlyName(selectedProductType?.title)}
                onSelect={(size) => {
                  const oldBonus = sizeEarningsBonuses[selectedShirtSize] || 0;
                  const newBonus = sizeEarningsBonuses[size] || 0;
                  const earningsDiff = newBonus - oldBonus;
                  
                  setSelectedShirtSize(size);
                  
                  const doUpdate = () => {
                    if (selectedShirtSize && earningsDiff !== 0) {
                      setRunningEarnings(prev => prev + earningsDiff);
                    } else if (!selectedShirtSize) {
                      setRunningEarnings(prev => prev + newBonus);
                    }
                    setEarningsPulse(true);
                    setTimeout(() => setEarningsPulse(false), 600);
                  };
                  
                  if (size !== selectedShirtSize) {
                    setTimeout(doUpdate, 1200);
                  } else {
                    doUpdate();
                  }
                }}
              />
            );
          })()}
          
          {simpleStep === 'type' && (
            <TypePickerStep 
              selectedType={qrType}
              onSelect={setQrType}
            />
          )}
          
          {simpleStep === 'graphic-size' && (
            <div className="space-y-2">
              <GraphicSizeStep
                selectedSize={graphicSize}
                selectedColor={selectedColor}
                currentPlacement={currentPlacement}
                onSelect={setGraphicSize}
              />
            </div>
          )}
          
          {simpleStep === 'generate' && (
            <div className="space-y-2">
              <GenerateGraphicStep
                selectedColor={selectedColor}
                graphicLocation={graphicLocation}
                graphicSize={graphicSize}
                onYes={() => {
                  setWantsHeaderFooter(true);
                  setQrType('qr-plus');
                  setSimpleStep('text-choice');
                }}
                onNo={() => {
                  setWantsHeaderFooter(false);
                  if (qrType === 'qr-basic') {
                    setSimpleStep('qr-basic-type');
                  } else {
                    setSimpleStep('canvas-fork');
                  }
                }}
              />
            </div>
          )}
          
          {simpleStep === 'qr-basic-type' && (
            <QRBasicTypeStep
              selectedType={qrBasicInputType}
              onSelect={(type) => {
                setQrBasicInputType(type);
                setSimpleStep('qr-basic-input');
              }}
              selectedColor={selectedColor}
              graphicSize={graphicSize}
            />
          )}
          
          {simpleStep === 'qr-basic-input' && (
            <QRBasicInputStep
              inputType={qrBasicInputType}
              content={qrBasicContent}
              onContentChange={setQrBasicContent}
              selectedColor={selectedColor}
              graphicSize={graphicSize}
            />
          )}
          
          {simpleStep === 'qr-basic-mockup' && (
            <QRBasicMockupStep
              mockupUrl={qrBasicMockup}
              isLoading={isGeneratingBasicMockup}
              selectedColor={selectedColor}
              selectedSize={selectedShirtSize}
              inputType={qrBasicInputType}
              content={qrBasicContent}
            />
          )}
          
          {simpleStep === 'qr-basic-save-choice' && (
            <QRBasicSaveChoiceStep
              selected={qrBasicSaveChoice}
              onSelect={(choice) => setQrBasicSaveChoice(choice)}
            />
          )}
          
          {simpleStep === 'qr-basic-confirm' && (
            <div className="space-y-4">
              <QRBasicConfirmStep
                saveChoice={qrBasicSaveChoice}
                mockupUrl={qrBasicMockup}
                qrContent={qrBasicContent}
                isSaving={isQrBasicSaving}
                onDone={() => {
                  setSimpleStep('channel');
                  setCurrentPacketId(null);
                  setQrBasicInputType('');
                  setQrBasicContent('');
                  setQrBasicMockup('');
                  setQrBasicSaveChoice('');
                }}
              />
              {sharePacketId && (
                <ShareKitHandoff
                  data={getShareKitData()}
                  onCreateAnother={handleCreateAnother}
                />
              )}
            </div>
          )}
          
          {simpleStep === 'qr-plus-mockup' && (
            <QRPlusMockupStep
              mockupUrl={qrPlusMockup}
              isLoading={isGeneratingPlusMockup}
              selectedColor={selectedColor}
              selectedSize={selectedShirtSize}
              headerText={headerStyle.text}
              footerText={footerStyle.text}
            />
          )}
          
          {simpleStep === 'qr-plus-save-choice' && (
            <QRPlusSaveChoiceStep
              selected={qrPlusSaveChoice}
              onSelect={(choice) => setQrPlusSaveChoice(choice)}
            />
          )}
          
          {simpleStep === 'qr-plus-confirm' && (
            <div className="space-y-4">
              <QRPlusConfirmStep
                saveChoice={qrPlusSaveChoice}
                mockupUrl={qrPlusMockup}
                productGraphicUrl={productGraphic}
                qrGraphicUrl={qrGraphic}
                isSaving={isQrPlusSaving}
                onDone={() => {
                  setSimpleStep('channel');
                  setCurrentPacketId(null);
                  setQrPlusMockup('');
                  setQrPlusSaveChoice('');
                  setQrGraphic('');
                  setProductGraphic('');
                }}
              />
              {sharePacketId && (
                <ShareKitHandoff
                  data={getShareKitData()}
                  onCreateAnother={handleCreateAnother}
                />
              )}
            </div>
          )}
          
          {simpleStep === 'text-choice' && (
            <div className="space-y-2">
              <TextLayoutChoiceStep
                selected={textLayoutChoice}
                textLineEarningsBonus={textLineEarningsBonus}
                onSelect={(choice) => {
                  const prevLines = textLayoutChoice === 'both' ? 2 : (textLayoutChoice === 'header' || textLayoutChoice === 'footer') ? 1 : 0;
                  const newLines = choice === 'both' ? 2 : 1;
                  const diff = newLines - prevLines;
                  if (diff !== 0) {
                    setRunningEarnings(prev => prev + (diff * textLineEarningsBonus));
                  }
                  setTextLayoutChoice(choice);
                }}
              />
            </div>
          )}
          
          {simpleStep === 'placement-count' && (
            <PlacementCountStep
              selected={selectedPlacements}
              onToggle={(placement) => {
                const isRemoving = selectedPlacements.includes(placement);
                const currentCount = selectedPlacements.length;
                
                if (isRemoving) {
                  if (currentCount > 1) {
                    setRunningEarnings(prev => prev - placementEarningsBonus);
                  }
                  setSelectedPlacements(prev => prev.filter(p => p !== placement));
                } else {
                  if (currentCount >= 1) {
                    setRunningEarnings(prev => prev + placementEarningsBonus);
                  }
                  setSelectedPlacements(prev => [...prev, placement]);
                }
              }}
              selectedColor={selectedColor}
              placementEarningsBonus={placementEarningsBonus}
              productPlacements={selectedProductType?.placements}
            />
          )}
          
          {simpleStep === 'text-edit-header' && (
            <HeaderTextEditStep
              selectedColor={selectedColor}
              graphicSize={graphicSize}
              graphicLocation={graphicLocation}
              headerStyle={headerStyle}
              onHeaderChange={setHeaderStyle}
              earningsPerLine={textLineEarningsBonus}
            />
          )}

          {simpleStep === 'text-edit-footer' && (
            <FooterTextEditStep
              selectedColor={selectedColor}
              graphicSize={graphicSize}
              graphicLocation={graphicLocation}
              footerStyle={footerStyle}
              onFooterChange={setFooterStyle}
              headerStyle={headerStyle}
              earningsPerLine={textLineEarningsBonus}
            />
          )}
          
          {simpleStep === 'placement-config' && (
            <PlacementConfigStep
              currentPlacement={currentPlacement}
              currentIndex={currentPlacementIndex}
              totalPlacements={selectedPlacements.length}
              graphicChoice={placementGraphicChoice}
              onGraphicChoiceChange={setPlacementGraphicChoice}
              headerStyle={headerStyle}
              footerStyle={footerStyle}
              textLayoutChoice={textLayoutChoice}
              selectedColor={selectedColor}
              graphicSize={graphicSize}
            />
          )}
          
          {simpleStep === 'shirt-preview' && (
            <ShirtPreviewStep
              selectedColor={selectedColor}
              graphicLocation={graphicLocation}
              graphicSize={graphicSize}
              headerStyle={headerStyle}
              footerStyle={footerStyle}
              textLayoutChoice={textLayoutChoice}
              selectedPlacements={selectedPlacements}
            />
          )}
          
          {simpleStep === 'compose-explainer' && (
            <ComposeExplainerCard
              publishedItemCount={publishedCanvasPlayItems.length}
              onCreateMoment={() => {
                setSimpleStep('canvas-fork');
              }}
              onBack={() => {
                setSimpleStep('canvas-fork');
              }}
            />
          )}
          
          {simpleStep === 'platform-acknowledge' && (
            <PlatformAcknowledgementCard
              momentCount={publishedCanvasPlayItems.length}
              onContinue={() => {
                setSimpleStep('canvas-fork');
              }}
              onManageMoments={() => {
                setViewMode('channels');
              }}
            />
          )}
          
          {simpleStep === 'canvas-fork' && (
            <SurfacePickerStep
              onCanvas={() => {
                setQrType('qr-canvas');
                setSimpleStep('url-explainer');
              }}
              onPlay={() => {
                setQrType('qr-play');
                setSimpleStep('play-video-source');
              }}
              onCompose={() => {
                if (publishedCanvasPlayItems.length < 2) {
                  setSimpleStep('compose-explainer');
                  return;
                }
                setQrType('qr-compose');
                fetchPublishedCanvasPlayItems();
                setSimpleStep('compose-pick-items');
              }}
              publishedItemCount={publishedCanvasPlayItems.length}
              onSkip={async () => {
                setQrType('qr-plus');
                setIsGeneratingPlusMockup(true);
                setSimpleStep('qr-plus-mockup');
                
                try {
                  const previewUrl = `${window.location.origin}/preview/${Date.now()}`;
                  const qrApiUrl = generateQRCodeUrl(previewUrl, 200);
                  setQrGraphic(qrApiUrl);
                  
                  const productGraphicResult = await api.generateProductGraphic({
                    qrUrl: previewUrl,
                    headerStyle: headerStyle,
                    footerStyle: footerStyle,
                    textLayoutChoice: textLayoutChoice,
                    qrColor: 'black',
                  });
                  
                  if (productGraphicResult.success && productGraphicResult.productGraphic) {
                    setProductGraphic(productGraphicResult.productGraphic);
                  } else {
                    setProductGraphic(qrApiUrl);
                  }
                  
                  if (selectedProductType?.blueprintId && selectedProductType?.printProviderId && selectedColor) {
                    const effectiveQrSize = (graphicSize === 'small' || graphicSize === 'medium' || graphicSize === 'large') ? graphicSize : 'medium';
                    
                    const artworkForMockup = productGraphicResult.success && productGraphicResult.productGraphic 
                      ? productGraphicResult.productGraphic 
                      : qrApiUrl;
                    
                    const mockupResult = await api.generateMockup({
                      blueprintId: selectedProductType.blueprintId,
                      printProviderId: selectedProductType.printProviderId,
                      colorName: selectedColor,
                      artworkUrl: artworkForMockup,
                      placement: 'front',
                      qrSize: effectiveQrSize,
                    });
                    
                    const bestUrl = mockupResult.lifestyleMockupUrl || mockupResult.mockupUrl;
                    
                    if (mockupResult.success && bestUrl) {
                      setQrPlusMockup(bestUrl);
                    } else {
                      setQrPlusMockup(qrApiUrl);
                    }
                  } else {
                    setQrPlusMockup(qrApiUrl);
                  }
                } catch (error) {
                  console.error('[Advanced QR Plus] Error generating mockup:', error);
                  const fallbackUrl = generateQRCodeUrl('placeholder', 200);
                  setQrPlusMockup(fallbackUrl);
                } finally {
                  setIsGeneratingPlusMockup(false);
                }
              }}
            />
          )}
          
          {simpleStep === 'url-explainer' && (
            <QRCanvasExplainerStep
              onUploadClick={() => {
                setUrlSourceChoice('upload');
                setSimpleStep('url-library-pick');
              }}
              onLibraryClick={() => {
                setUrlSourceChoice('library');
                setSimpleStep('url-source-choice');
              }}
            />
          )}
          
          {simpleStep === 'url-source-choice' && (
            <UrlSourceChoiceStep
              choice={libraryChoice}
              onChoiceChange={setLibraryChoice}
            />
          )}
          
          {simpleStep === 'url-library-pick' && user?.id && (
            <SimpleBackgroundStep
              memberId={user.id}
              background={urlGraphic}
              onBackgroundSelected={(croppedUrl, originalUrl, needsCrop) => {
                setUrlGraphic(croppedUrl);
                setOriginalUrlGraphic(originalUrl);
              }}
              onComplete={() => setSimpleStep('url-title')}
              initialSubStep={
                urlSourceChoice === 'upload' ? 'upload' :
                libraryChoice === 'personal' ? 'personal-library' :
                libraryChoice === 'common' ? 'common-library' : 'choice'
              }
              croppedOnly={libraryChoice === 'personal'}
            />
          )}
          
          {simpleStep === 'url-title' && (
            <UrlTitleStep
              title={simpleTitle}
              onTitleChange={setSimpleTitle}
              background={urlGraphic}
              description={simpleDescription}
              titleVertical={titleVertical}
              titleHorizontal={titleHorizontal}
              titleColor={titleColor}
              titleSize={titleSize}
              titleFont={titleFont}
              descVertical={descVertical}
              descHorizontal={descHorizontal}
              descColor={descColor}
              descSize={descSize}
              descFont={descFont}
              onTitleVerticalChange={setTitleVertical}
              onTitleHorizontalChange={setTitleHorizontal}
              onTitleColorChange={setTitleColor}
              onTitleSizeChange={setTitleSize}
              onTitleFontChange={setTitleFont}
            />
          )}
          
          {simpleStep === 'url-description' && (
            <UrlDescriptionStep
              title={simpleTitle}
              description={simpleDescription}
              onDescriptionChange={setSimpleDescription}
              background={urlGraphic}
              titleVertical={titleVertical}
              titleHorizontal={titleHorizontal}
              titleColor={titleColor}
              titleSize={titleSize}
              titleFont={titleFont}
              descVertical={descVertical}
              descHorizontal={descHorizontal}
              descColor={descColor}
              descSize={descSize}
              descFont={descFont}
              onDescVerticalChange={setDescVertical}
              onDescHorizontalChange={setDescHorizontal}
              onDescColorChange={setDescColor}
              onDescSizeChange={setDescSize}
              onDescFontChange={setDescFont}
            />
          )}
          
          {simpleStep === 'url-preview' && (
            <SimplePreviewStep
              background={urlGraphic}
              title={simpleTitle}
              description={simpleDescription}
              titleVertical={titleVertical}
              titleHorizontal={titleHorizontal}
              titleColor={titleColor}
              titleSize={titleSize}
              titleFont={titleFont}
              descVertical={descVertical}
              descHorizontal={descHorizontal}
              descColor={descColor}
              descSize={descSize}
              descFont={descFont}
              onGoBack={() => setSimpleStep('url-description')}
            />
          )}
          
          {simpleStep === 'canvas-mockup' && (
            <>
              <QRPlusMockupStep
                mockupUrl={qrCanvasMockup}
                isLoading={isGeneratingCanvasMockup}
                selectedColor={selectedColor}
                selectedSize={selectedShirtSize}
                headerText={headerStyle.enabled ? headerStyle.text : undefined}
                footerText={footerStyle.enabled ? footerStyle.text : undefined}
              />
              <div className="max-w-sm mx-auto mt-4">
                <ContentRightsCheckbox
                  confirmed={contentRightsConfirmed}
                  onToggle={() => setContentRightsConfirmed(!contentRightsConfirmed)}
                  contentType="image"
                />
              </div>
            </>
          )}
          
          {simpleStep === 'url-publish' && (
            <SimplePublishStep
              isPublishing={isPublishing}
              onPublish={handleSimplePublish}
              title={simpleTitle}
              description={simpleDescription}
              qrType={qrType}
              background={urlGraphic}
              titleVertical={titleVertical}
              titleHorizontal={titleHorizontal}
              titleColor={titleColor}
              titleSize={titleSize}
              titleFont={titleFont}
              descVertical={descVertical}
              descHorizontal={descHorizontal}
              descColor={descColor}
              descSize={descSize}
              descFont={descFont}
            />
          )}
          
          {simpleStep === 'canvas-save-choice' && (
            <QRCanvasSaveChoiceStep
              selected={canvasSaveChoice}
              onSelect={setCanvasSaveChoice}
            />
          )}
          
          {simpleStep === 'canvas-confirm' && (
            <div className="space-y-4">
              <QRCanvasConfirmStep
                saveChoice={'all'}
                productGraphicUrl={publishedProductGraphicUrl}
                backgroundUrl={urlGraphic}
                qrGraphicUrl={publishedQrGraphicUrl}
                isSaving={isCanvasSaving}
                onDone={handleCanvasDone}
              />
              {sharePacketId && (
                <ShareKitHandoff
                  data={getShareKitData()}
                  onCreateAnother={handleCreateAnother}
                />
              )}
            </div>
          )}
          
          {simpleStep === 'play-video-source' && (
            <PlayVideoSourceStep
              videoUrl={playVideoUrl}
              onVideoUrlChange={(url) => {
                setPlayVideoUrl(url);
                setVideoUrl(url);
              }}
              onFileUpload={handleVideoFileUpload}
              isUploading={isUploadingVideo}
              uploadError={videoUploadError}
              uploadProgress={videoUploadProgress}
              uploadSuccess={videoUploadSuccess}
              contentRightsConfirmed={contentRightsConfirmed}
              onContentRightsToggle={() => setContentRightsConfirmed(!contentRightsConfirmed)}
            />
          )}
          
          {simpleStep === 'play-preview' && (
            <PlayPreviewStep
              videoUrl={playVideoUrl}
              title={simpleTitle}
            />
          )}
          
          {simpleStep === 'play-mockup' && (
            <QRPlusMockupStep
              mockupUrl={qrPlayMockup}
              isLoading={isGeneratingPlayMockup}
              selectedColor={selectedColor}
              selectedSize={selectedShirtSize}
              headerText={headerStyle.enabled ? headerStyle.text : undefined}
              footerText={footerStyle.enabled ? footerStyle.text : undefined}
            />
          )}
          
          {simpleStep === 'play-publish' && (
            <PlayPublishStep
              videoUrl={playVideoUrl}
              isPublishing={isPublishing}
            />
          )}
          
          {simpleStep === 'play-save-choice' && (
            <div className="space-y-4">
              <PlayPublishedStep />
              {sharePacketId && (
                <ShareKitHandoff
                  data={getShareKitData()}
                  onCreateAnother={handleCreateAnother}
                />
              )}
            </div>
          )}
          
          {simpleStep === 'compose-mode' && (
            <ComposeModePicker
              selected={composeMode}
              onSelect={setComposeMode}
            />
          )}

          {simpleStep === 'compose-pick-items' && (
            <ComposePickItemsStep
              availableItems={publishedCanvasPlayItems}
              selectedItems={composeItems}
              onToggleItem={(item: any) => {
                const packetId = item.packetId || item.id;
                const existing = composeItems.find(i => i.packetId === packetId);
                if (existing) {
                  setComposeItems(prev => prev.filter(i => i.packetId !== packetId));
                } else {
                  setComposeItems(prev => [...prev, {
                    packetId,
                    name: item.title || item.name || 'Untitled',
                    thumbnailUrl: item.itemImage || item.qrCanvasMockup || item.qrPlayMockup || item.composeMockup || item.urlGraphic || item.thumbnailUrl || '',
                    type: item.packetType === 'qr-play' ? 'qr-play' : 'qr-canvas',
                    durationSeconds: 86400,
                    order: prev.length + 1,
                  }]);
                }
              }}
              isLoading={isLoadingPublishedItems}
            />
          )}

          {simpleStep === 'compose-durations' && (
            <ComposeDurationsStep
              items={composeItems}
              onUpdateDuration={(packetId, seconds) => {
                setComposeItems(prev => prev.map(i => 
                  i.packetId === packetId ? { ...i, durationSeconds: seconds } : i
                ));
              }}
            />
          )}

          {simpleStep === 'compose-order' && (
            <ComposeOrderStep
              items={composeItems}
              onMoveUp={(packetId) => {
                setComposeItems(prev => {
                  const idx = prev.findIndex(i => i.packetId === packetId);
                  if (idx <= 0) return prev;
                  const next = [...prev];
                  [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
                  return next.map((i, j) => ({ ...i, order: j + 1 }));
                });
              }}
              onMoveDown={(packetId) => {
                setComposeItems(prev => {
                  const idx = prev.findIndex(i => i.packetId === packetId);
                  if (idx < 0 || idx >= prev.length - 1) return prev;
                  const next = [...prev];
                  [next[idx], next[idx + 1]] = [next[idx + 1], next[idx]];
                  return next.map((i, j) => ({ ...i, order: j + 1 }));
                });
              }}
              onRemove={(packetId) => {
                setComposeItems(prev => prev.filter(i => i.packetId !== packetId).map((i, j) => ({ ...i, order: j + 1 })));
              }}
            />
          )}

          {simpleStep === 'compose-hosting' && (
            <ComposeHostingStep
              selected={composeHostingTerm}
              onSelect={setComposeHostingTerm}
            />
          )}

          {simpleStep === 'compose-mockup' && (
            <QRPlusMockupStep
              mockupUrl={composeMockup}
              isLoading={isGeneratingComposeMockup}
              selectedColor={selectedColor}
              selectedSize={selectedShirtSize}
              headerText={headerStyle.enabled ? headerStyle.text : undefined}
              footerText={footerStyle.enabled ? footerStyle.text : undefined}
            />
          )}

          {simpleStep === 'compose-preview' && (
            <ComposePreviewStep
              items={composeItems}
              hostingTerm={composeHostingTerm}
              mockupUrl={composeMockup}
              isLoadingMockup={isGeneratingComposeMockup}
              selectedColor={selectedColor}
              selectedSize={selectedShirtSize}
              composeMode={composeMode || 'auto-rotate'}
            />
          )}

          {simpleStep === 'compose-publish' && (
            <ComposePublishStep
              isPublishing={isPublishing}
              itemCount={composeItems.length}
            />
          )}

          {simpleStep === 'compose-confirm' && (
            <div className="space-y-4">
              <ComposeConfirmStep
                instanceId={composeInstanceId}
                resolverUrl={composeInstanceId ? `/qr/d/${composeInstanceId}` : null}
                itemCount={composeItems.length}
              />
              {sharePacketId && (
                <ShareKitHandoff
                  data={getShareKitData()}
                  onCreateAnother={handleCreateAnother}
                />
              )}
            </div>
          )}
        </div>

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
      </CardContent>
    </Card>
  );
}
