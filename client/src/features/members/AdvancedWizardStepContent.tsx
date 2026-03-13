import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Copy, Crosshair, SlidersHorizontal } from 'lucide-react';
import { ChannelStep } from '@/features/shared/components/wizardSteps/ChannelStep';
import { ProductCongratsStep, ColorPickerStep, SizePickerStep, getProductFriendlyName, TierPickerStep } from '@/features/shared/components/wizardSteps/ProductSteps';
import { GraphicSizeStep, PlacementCountStep, PlacementConfigStep } from '@/features/shared/components/wizardSteps/PlacementSteps';
import { TextLayoutChoiceStep, HeaderTextEditStep, FooterTextEditStep } from '@/features/shared/components/wizardSteps/TextSteps';
import { TypePickerStep, SurfacePickerStep, GenerateGraphicStep } from '@/features/shared/components/wizardSteps/TypeAndSurfaceSteps';
import { QRBasicTypeStep, QRBasicInputStep, QRBasicMockupStep, QRBasicSaveChoiceStep, QRBasicConfirmStep } from '@/features/shared/components/wizardSteps/QRBasicSteps';
import { QRPlusMockupStep, QRPlusSaveChoiceStep, QRPlusConfirmStep } from '@/features/shared/components/wizardSteps/QRPlusSteps';
import { QRCanvasExplainerStep, UrlSourceChoiceStep, SimpleBackgroundStep, QRCanvasSaveChoiceStep, QRCanvasConfirmStep, SimplePreviewStep, SimplePublishStep } from '@/features/shared/components/wizardSteps/CanvasSteps';
import { PlayVideoSourceStep, PlayPreviewStep, PlayPublishStep, PlayPublishedStep } from '@/features/shared/components/wizardSteps/PlaySteps';
import { ComposeModePicker, ComposePickItemsStep, ComposeDurationsStep, ComposeOrderStep, ComposeHostingStep, ComposePreviewStep, ComposePublishStep, ComposeConfirmStep, ComposeExplainerCard, PlatformAcknowledgementCard } from '@/features/shared/components/wizardSteps/ComposeSteps';
import { ShirtPreviewStep, UrlTitleStep, UrlDescriptionStep } from '@/features/shared/components/wizardSteps/PreviewAndPublishSteps';
import { ShareKitHandoff } from '@/features/shared/components/ShareKitHandoff';
import { calculateSizeEarningsBonuses, generateQRCodeUrl } from '@/features/shared/components/wizardSteps';
import { getPrintAreaDims, GRAPHIC_CENTER, getPlacementLabel } from '@/features/shared/components/wizardSteps/wizardTypes';
import { ContentRightsCheckbox } from '@/features/shared/components/ContentRightsCheckbox';
import { useWizardContext } from './WizardContext';

export function AdvancedWizardStepContent({
  sharePacketId,
  getShareKitData,
  onCreateAnother,
  onBackToDashboard,
}: {
  sharePacketId: string;
  getShareKitData: () => any;
  onCreateAnother: () => void;
  onBackToDashboard: () => void;
}) {
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
    setCurrentPacketId,
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
    qrPositionX, setQrPositionX,
    qrPositionY, setQrPositionY,
    qrSizePercent, setQrSizePercent,
    areaImageUrl, setAreaImageUrl,
    areaImageMode, setAreaImageMode,
    pricingSettings,
    placementEarningsBonus,
    textLineEarningsBonus,
    handleProductSelect,
    handleVideoFileUpload,
    handleCanvasDone,
    handleSimplePublish,
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
    currentPacketId,
    perPlacementConfigs,
  } = useWizardContext();

  const [customFontSize, setCustomFontSize] = useState(18);
  const [placementOffsetX, setPlacementOffsetX] = useState(0);
  const [placementOffsetY, setPlacementOffsetY] = useState(0);

  return (
    <>
          {simpleStep === 'channel' && (
            <div className="space-y-4">
              <ChannelStep
                selectedChannel={selectedChannel}
                onSelect={setSelectedChannel}
                memberId={user.id}
                isCreatingChannel={isCreatingChannel}
                setIsCreatingChannel={setIsCreatingChannel}
                newChannelName={newChannelName}
                setNewChannelName={setNewChannelName}
              />
              {selectedChannel && currentPacketId && (
                <div className="border border-blue-500/20 bg-blue-500/5 rounded-md p-3" data-testid="panel-advanced-quick-start">
                  <div className="flex items-center gap-2 mb-2">
                    <Copy className="w-3.5 h-3.5 text-blue-400" />
                    <span className="text-xs font-medium text-blue-400">Quick Start</span>
                  </div>
                  <p className="text-xs text-white/60 mb-2">
                    Continue editing your current design or start fresh.
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-xs border-blue-500/30 text-blue-300"
                    onClick={() => setSimpleStep('product')}
                    data-testid="button-advanced-duplicate-design"
                  >
                    <Copy className="w-3 h-3 mr-1" />
                    Resume Current Design
                  </Button>
                </div>
              )}
            </div>
          )}
          
          {simpleStep === 'product' && (
            <TierPickerStep
              selectedProduct={selectedProductType}
              onSelect={handleProductSelect}
              context="member"
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
              qrPositionX={qrPositionX}
              qrPositionY={qrPositionY}
              qrSizePercent={qrSizePercent}
              onPositionXChange={setQrPositionX}
              onPositionYChange={setQrPositionY}
              onSizeChange={setQrSizePercent}
              areaImageUrl={areaImageUrl}
              areaImageMode={areaImageMode}
              onAreaImageUrlChange={setAreaImageUrl}
              onAreaImageModeChange={setAreaImageMode}
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
                  onCreateAnother={onCreateAnother}
                  onBackToDashboard={onBackToDashboard}
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
                  onCreateAnother={onCreateAnother}
                  onBackToDashboard={onBackToDashboard}
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
            <div className="space-y-4">
              <HeaderTextEditStep
                selectedColor={selectedColor}
                graphicSize={graphicSize}
                graphicLocation={graphicLocation}
                headerStyle={headerStyle}
                onHeaderChange={setHeaderStyle}
                earningsPerLine={textLineEarningsBonus}
              />
              <div className="border border-blue-500/20 bg-blue-500/5 rounded-md p-3" data-testid="panel-advanced-text-controls-header">
                <div className="flex items-center gap-2 mb-2">
                  <SlidersHorizontal className="w-3.5 h-3.5 text-blue-400" />
                  <span className="text-xs font-medium text-blue-400">Advanced Text Controls</span>
                </div>
                <div className="space-y-3">
                  <div>
                    <label className="text-xs text-white/60 mb-1 block">Font Size: {customFontSize}px</label>
                    <Slider
                      value={[customFontSize]}
                      onValueChange={([v]) => {
                        setCustomFontSize(v);
                        const sizeStr = `${v}px`;
                        setHeaderStyle(prev => ({ ...prev, fontSize: sizeStr }));
                      }}
                      min={10}
                      max={48}
                      step={1}
                      className="w-full"
                      data-testid="slider-advanced-header-font-size"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-white/60 mb-1 block">Vertical Offset: {headerStyle.verticalOffset || 0}%</label>
                    <Slider
                      value={[headerStyle.verticalOffset || 0]}
                      onValueChange={([v]) => {
                        setHeaderStyle(prev => ({ ...prev, verticalOffset: v }));
                      }}
                      min={-50}
                      max={50}
                      step={1}
                      className="w-full"
                      data-testid="slider-advanced-header-offset"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {simpleStep === 'text-edit-footer' && (
            <div className="space-y-4">
              <FooterTextEditStep
                selectedColor={selectedColor}
                graphicSize={graphicSize}
                graphicLocation={graphicLocation}
                footerStyle={footerStyle}
                onFooterChange={setFooterStyle}
                headerStyle={headerStyle}
                earningsPerLine={textLineEarningsBonus}
              />
              <div className="border border-blue-500/20 bg-blue-500/5 rounded-md p-3" data-testid="panel-advanced-text-controls-footer">
                <div className="flex items-center gap-2 mb-2">
                  <SlidersHorizontal className="w-3.5 h-3.5 text-blue-400" />
                  <span className="text-xs font-medium text-blue-400">Advanced Text Controls</span>
                </div>
                <div className="space-y-3">
                  <div>
                    <label className="text-xs text-white/60 mb-1 block">Font Size: {customFontSize}px</label>
                    <Slider
                      value={[customFontSize]}
                      onValueChange={([v]) => {
                        setCustomFontSize(v);
                        const sizeStr = `${v}px`;
                        setFooterStyle(prev => ({ ...prev, fontSize: sizeStr }));
                      }}
                      min={10}
                      max={48}
                      step={1}
                      className="w-full"
                      data-testid="slider-advanced-footer-font-size"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-white/60 mb-1 block">Vertical Offset: {footerStyle.verticalOffset || 0}%</label>
                    <Slider
                      value={[footerStyle.verticalOffset || 0]}
                      onValueChange={([v]) => {
                        setFooterStyle(prev => ({ ...prev, verticalOffset: v }));
                      }}
                      min={-50}
                      max={50}
                      step={1}
                      className="w-full"
                      data-testid="slider-advanced-footer-offset"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}
          
          {simpleStep === 'placement-config' && (
            <div className="space-y-4">
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
                qrPositionX={qrPositionX}
                qrPositionY={qrPositionY}
                qrSizePercent={qrSizePercent}
              />
              <div className="border border-blue-500/20 bg-blue-500/5 rounded-md p-3" data-testid="panel-advanced-placement-coords">
                <div className="flex items-center gap-2 mb-2">
                  <Crosshair className="w-3.5 h-3.5 text-blue-400" />
                  <span className="text-xs font-medium text-blue-400">Placement Coordinates</span>
                </div>
                {(() => {
                  const dims = getPrintAreaDims(currentPlacement, graphicSize);
                  const center = GRAPHIC_CENTER[currentPlacement as keyof typeof GRAPHIC_CENTER] || GRAPHIC_CENTER.front;
                  return (
                    <div className="space-y-3">
                      <div className="grid grid-cols-2 gap-3">
                        <div className="bg-slate-800/50 rounded p-2">
                          <span className="text-[10px] text-white/40 block mb-0.5">Print Area</span>
                          <span className="text-xs text-white/80 font-mono" data-testid="text-advanced-print-dims">{dims.w}" x {dims.h}"</span>
                        </div>
                        <div className="bg-slate-800/50 rounded p-2">
                          <span className="text-[10px] text-white/40 block mb-0.5">Center Point</span>
                          <span className="text-xs text-white/80 font-mono" data-testid="text-advanced-center-point">({center.x}, {center.y})</span>
                        </div>
                      </div>
                      <div>
                        <label className="text-xs text-white/60 mb-1 block">X Offset: {placementOffsetX}px</label>
                        <Slider
                          value={[placementOffsetX]}
                          onValueChange={([v]) => setPlacementOffsetX(v)}
                          min={-20}
                          max={20}
                          step={1}
                          className="w-full"
                          data-testid="slider-advanced-placement-x"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-white/60 mb-1 block">Y Offset: {placementOffsetY}px</label>
                        <Slider
                          value={[placementOffsetY]}
                          onValueChange={([v]) => setPlacementOffsetY(v)}
                          min={-20}
                          max={20}
                          step={1}
                          className="w-full"
                          data-testid="slider-advanced-placement-y"
                        />
                      </div>
                      <p className="text-[10px] text-white/30">
                        {getPlacementLabel(currentPlacement)} placement at ({center.x + placementOffsetX}, {center.y + placementOffsetY})
                      </p>
                    </div>
                  );
                })()}
              </div>
            </div>
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
              qrPositionX={qrPositionX}
              qrPositionY={qrPositionY}
              qrSizePercent={qrSizePercent}
              areaImageUrl={areaImageUrl}
              areaImageMode={areaImageMode}
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
                  
                  const isPrintfulAdv = selectedProductType?.fulfillmentProvider === 'printful';
                  if (selectedProductType?.blueprintId && (selectedProductType?.printProviderId || isPrintfulAdv) && selectedColor) {
                    const effectiveQrSize = (graphicSize === 'small' || graphicSize === 'medium' || graphicSize === 'large') ? graphicSize : 'medium';
                    
                    const artworkForMockup = productGraphicResult.success && productGraphicResult.productGraphic 
                      ? productGraphicResult.productGraphic 
                      : qrApiUrl;
                    
                    const mockupResult = await api.generateMockup({
                      blueprintId: selectedProductType.blueprintId,
                      printProviderId: selectedProductType.printProviderId || 99,
                      colorName: selectedColor,
                      artworkUrl: artworkForMockup,
                      placement: 'front',
                      qrSize: effectiveQrSize,
                      fulfillmentProvider: isPrintfulAdv ? 'printful' : 'printify',
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
                  onCreateAnother={onCreateAnother}
                  onBackToDashboard={onBackToDashboard}
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
                  onCreateAnother={onCreateAnother}
                  onBackToDashboard={onBackToDashboard}
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
                  onCreateAnother={onCreateAnother}
                  onBackToDashboard={onBackToDashboard}
                />
              )}
            </div>
          )}
    </>
  );
}
