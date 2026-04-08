import { ChannelStep } from "@/features/shared/components/wizardSteps/ChannelStep";
import { ProductCongratsStep, ColorPickerStep, SizePickerStep, getProductFriendlyName, TierPickerStep } from "@/features/shared/components/wizardSteps/ProductSteps";
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
import { calculateSizeEarningsBonuses } from "@/features/shared/components/wizardSteps";
import { generateBrandedQRDataUrl } from "@/components/BrandedQR";
import { ContentRightsCheckbox } from "@/features/shared/components/ContentRightsCheckbox";
import { useWizardContext } from './WizardContext';

export function SimpleWizardStepContent({
  sharePacketId,
  getShareKitData,
  onCreateAnother,
  onBackToDashboard,
  showContentRights,
}: {
  sharePacketId: string;
  getShareKitData: () => any;
  onCreateAnother: () => void;
  onBackToDashboard: () => void;
  showContentRights?: boolean;
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
    headerStyle, setHeaderStyle,
    footerStyle, setFooterStyle,
    productGraphic, setProductGraphic,
    qrGraphic, setQrGraphic,
    textLayoutChoice, setTextLayoutChoice,
    selectedPlacements, setSelectedPlacements,
    currentPlacementIndex,
    placementGraphicChoice, setPlacementGraphicChoice,
    perPlacementConfigs,
    currentPlacement,
    qrBasicInputType, setQrBasicInputType,
    qrBasicContent, setQrBasicContent,
    qrBasicMockup,
    isGeneratingBasicMockup,
    qrBasicSaveChoice, setQrBasicSaveChoice,
    isQrBasicSaving,
    qrPlusMockup, setQrPlusMockup,
    isGeneratingPlusMockup, setIsGeneratingPlusMockup,
    qrPlusSaveChoice, setQrPlusSaveChoice,
    isQrPlusSaving,
    isPublishing,
    handleProductSelect,
    handleVideoFileUpload,
    handleCanvasDone,
    handleSimplePublish,
    fetchPublishedCanvasPlayItems,
    setViewMode,
    pricingSettings,
    contentRightsConfirmed, setContentRightsConfirmed,
    urlSourceChoice, setUrlSourceChoice,
    libraryChoice, setLibraryChoice,
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
    urlGraphic, setUrlGraphic,
    originalUrlGraphic, setOriginalUrlGraphic,
    qrCanvasMockup,
    isGeneratingCanvasMockup,
    canvasSaveChoice, setCanvasSaveChoice,
    isCanvasSaving,
    publishedProductGraphicUrl,
    publishedQrGraphicUrl,
    playVideoUrl, setPlayVideoUrl,
    videoUrl, setVideoUrl,
    isUploadingVideo,
    videoUploadError,
    videoUploadProgress,
    videoUploadSuccess,
    qrPlayMockup,
    isGeneratingPlayMockup,
    publishedCanvasPlayItems,
    isLoadingPublishedItems,
    composeItems, setComposeItems,
    composeMode, setComposeMode,
    composeHostingTerm, setComposeHostingTerm,
    composeMockup,
    isGeneratingComposeMockup,
    composeInstanceId,
    qrPositionX, setQrPositionX,
    qrPositionY, setQrPositionY,
    qrSizePercent, setQrSizePercent,
    areaImageUrl, setAreaImageUrl,
    areaImageMode, setAreaImageMode,
    placementEarningsBonus,
    textLineEarningsBonus,
    publishedPacketId,
    currentPacketId,
  } = useWizardContext();

  return (
    <>
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
            onSelect={(size: string) => {
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
              if (size !== selectedShirtSize) setTimeout(doUpdate, 1200);
              else doUpdate();
            }}
          />
        );
      })()}

      {simpleStep === 'type' && (
        <TypePickerStep selectedType={qrType} onSelect={setQrType} />
      )}

      {simpleStep === 'graphic-size' && (
        <GraphicSizeStep
          selectedSize={graphicSize}
          selectedColor={selectedColor}
          currentPlacement={currentPlacement}
          onSelect={setGraphicSize}
        />
      )}

      {simpleStep === 'generate' && (
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
            if (qrType === 'qr-basic') setSimpleStep('qr-basic-type');
            else setSimpleStep('canvas-fork');
          }}
        />
      )}

      {simpleStep === 'qr-basic-type' && (
        <QRBasicTypeStep
          selectedType={qrBasicInputType}
          onSelect={(type: any) => {
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
          onAreaImageUrlChange={setAreaImageUrl}
        />
      )}

      {simpleStep === 'qr-basic-save-choice' && (
        <QRBasicSaveChoiceStep
          selected={qrBasicSaveChoice}
          onSelect={(choice: any) => setQrBasicSaveChoice(choice)}
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
              setViewMode('index');
              setCurrentPacketId(null);
              setQrBasicInputType('');
              setQrBasicContent('');
            }}
          />
          {sharePacketId && (
            <ShareKitHandoff data={getShareKitData()} onCreateAnother={onCreateAnother} onBackToDashboard={onBackToDashboard} />
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
          onSelect={(choice: any) => setQrPlusSaveChoice(choice)}
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
              setViewMode('index');
              setCurrentPacketId(null);
              setQrPlusMockup('');
              setQrPlusSaveChoice('');
              setQrGraphic('');
              setProductGraphic('');
            }}
          />
          {sharePacketId && (
            <ShareKitHandoff data={getShareKitData()} onCreateAnother={onCreateAnother} onBackToDashboard={onBackToDashboard} />
          )}
        </div>
      )}

      {simpleStep === 'text-choice' && (
        <TextLayoutChoiceStep
          selected={textLayoutChoice}
          textLineEarningsBonus={textLineEarningsBonus}
          onSelect={(choice: string) => {
            const prevLines = textLayoutChoice === 'both' ? 2 : (textLayoutChoice === 'header' || textLayoutChoice === 'footer') ? 1 : 0;
            const newLines = choice === 'both' ? 2 : 1;
            const diff = newLines - prevLines;
            if (diff !== 0) setRunningEarnings(prev => prev + (diff * textLineEarningsBonus));
            setTextLayoutChoice(choice as any);
          }}
        />
      )}

      {simpleStep === 'placement-count' && (
        <PlacementCountStep
          selected={selectedPlacements}
          onToggle={(placement: string) => {
            const isRemoving = selectedPlacements.includes(placement);
            const currentCount = selectedPlacements.length;
            if (isRemoving) {
              if (currentCount > 1) setRunningEarnings(prev => prev - placementEarningsBonus);
              setSelectedPlacements(prev => prev.filter(p => p !== placement));
            } else {
              if (currentCount >= 1) setRunningEarnings(prev => prev + placementEarningsBonus);
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
          selectedColor={selectedColor} graphicSize={graphicSize} graphicLocation={graphicLocation}
          headerStyle={headerStyle} onHeaderChange={setHeaderStyle} earningsPerLine={textLineEarningsBonus}
        />
      )}

      {simpleStep === 'text-edit-footer' && (
        <FooterTextEditStep
          selectedColor={selectedColor} graphicSize={graphicSize} graphicLocation={graphicLocation}
          footerStyle={footerStyle} onFooterChange={setFooterStyle} headerStyle={headerStyle}
          earningsPerLine={textLineEarningsBonus}
        />
      )}

      {simpleStep === 'placement-config' && (
        <PlacementConfigStep
          currentPlacement={currentPlacement} currentIndex={currentPlacementIndex}
          totalPlacements={selectedPlacements.length} graphicChoice={placementGraphicChoice}
          onGraphicChoiceChange={setPlacementGraphicChoice} headerStyle={headerStyle}
          footerStyle={footerStyle} textLayoutChoice={textLayoutChoice}
          selectedColor={selectedColor} graphicSize={graphicSize}
          qrPositionX={qrPositionX} qrPositionY={qrPositionY} qrSizePercent={qrSizePercent}
        />
      )}

      {simpleStep === 'shirt-preview' && (
        <ShirtPreviewStep
          selectedColor={selectedColor} graphicLocation={graphicLocation} graphicSize={graphicSize}
          headerStyle={headerStyle} footerStyle={footerStyle} textLayoutChoice={textLayoutChoice}
          selectedPlacements={selectedPlacements} qrPositionX={qrPositionX}
          qrPositionY={qrPositionY} qrSizePercent={qrSizePercent}
          areaImageUrl={areaImageUrl}
          perPlacementConfigs={perPlacementConfigs}
        />
      )}

      {simpleStep === 'compose-explainer' && (
        <ComposeExplainerCard
          publishedItemCount={publishedCanvasPlayItems.length}
          onCreateMoment={() => setSimpleStep('canvas-fork')}
          onBack={() => setSimpleStep('canvas-fork')}
        />
      )}

      {simpleStep === 'platform-acknowledge' && (
        <PlatformAcknowledgementCard
          momentCount={publishedCanvasPlayItems.length}
          onContinue={() => setSimpleStep('canvas-fork')}
          onManageMoments={() => setViewMode('channels')}
        />
      )}

      {simpleStep === 'canvas-fork' && (
        <SurfacePickerStep
          onCanvas={() => { setQrType('qr-canvas'); setSimpleStep('url-explainer'); }}
          onPlay={() => { setQrType('qr-play'); setSimpleStep('play-video-source'); }}
          onCompose={() => {
            if (publishedCanvasPlayItems.length < 2) { setSimpleStep('compose-explainer'); return; }
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
              const qrApiUrl = await generateBrandedQRDataUrl(previewUrl, 200);
              setQrGraphic(qrApiUrl);
              const productGraphicResult = await api.generateProductGraphic({
                qrUrl: previewUrl, headerStyle, footerStyle, textLayoutChoice, qrColor: 'black',
              });
              if (productGraphicResult.success && productGraphicResult.productGraphic) {
                setProductGraphic(productGraphicResult.productGraphic);
              } else {
                setProductGraphic(qrApiUrl);
              }
              const isPrintfulPlus = selectedProductType?.fulfillmentProvider === 'printful';
              if (selectedProductType?.blueprintId && (selectedProductType?.printProviderId || isPrintfulPlus) && selectedColor) {
                const effectiveQrSize = (graphicSize === 'small' || graphicSize === 'medium' || graphicSize === 'large') ? graphicSize : 'medium';
                const artworkForMockup = productGraphicResult.success && productGraphicResult.productGraphic
                  ? productGraphicResult.productGraphic : qrApiUrl;
                const mockupResult = await api.generateMockup({
                  blueprintId: selectedProductType.blueprintId,
                  printProviderId: selectedProductType.printProviderId || 99,
                  colorName: selectedColor, artworkUrl: artworkForMockup, placement: 'front',
                  qrSize: effectiveQrSize, fulfillmentProvider: isPrintfulPlus ? 'printful' : 'printify',
                });
                const bestUrl = mockupResult.lifestyleMockupUrl || mockupResult.mockupUrl;
                if (mockupResult.success && bestUrl) setQrPlusMockup(bestUrl);
                else setQrPlusMockup(qrApiUrl);
              } else {
                setQrPlusMockup(qrApiUrl);
              }
            } catch {
              setQrPlusMockup(await generateBrandedQRDataUrl('placeholder', 200));
            } finally {
              setIsGeneratingPlusMockup(false);
            }
          }}
        />
      )}

      {simpleStep === 'url-explainer' && (
        <QRCanvasExplainerStep
          onUploadClick={() => { setUrlSourceChoice('upload'); setSimpleStep('url-library-pick'); }}
          onLibraryClick={() => { setUrlSourceChoice('library'); setSimpleStep('url-source-choice'); }}
        />
      )}

      {simpleStep === 'url-source-choice' && (
        <UrlSourceChoiceStep choice={libraryChoice} onChoiceChange={setLibraryChoice} />
      )}

      {simpleStep === 'url-library-pick' && (
        <SimpleBackgroundStep
          memberId={user?.id || ''} background={urlGraphic}
          onBackgroundSelected={(croppedUrl: string, originalUrl: string) => { setUrlGraphic(croppedUrl); setOriginalUrlGraphic(originalUrl); }}
          onComplete={() => setSimpleStep('url-title')}
          initialSubStep={urlSourceChoice === 'upload' ? 'upload' : libraryChoice === 'personal' ? 'personal-library' : libraryChoice === 'common' ? 'common-library' : 'choice'}
          croppedOnly={libraryChoice === 'personal'}
        />
      )}

      {simpleStep === 'url-title' && (
        <UrlTitleStep
          title={simpleTitle} onTitleChange={setSimpleTitle} background={urlGraphic}
          description={simpleDescription}
          titleVertical={titleVertical} titleHorizontal={titleHorizontal}
          titleColor={titleColor} titleSize={titleSize} titleFont={titleFont}
          descVertical={descVertical} descHorizontal={descHorizontal}
          descColor={descColor} descSize={descSize} descFont={descFont}
          onTitleVerticalChange={setTitleVertical} onTitleHorizontalChange={setTitleHorizontal}
          onTitleColorChange={setTitleColor} onTitleSizeChange={setTitleSize}
          onTitleFontChange={setTitleFont}
        />
      )}

      {simpleStep === 'url-description' && (
        <UrlDescriptionStep
          title={simpleTitle} description={simpleDescription} onDescriptionChange={setSimpleDescription}
          background={urlGraphic}
          titleVertical={titleVertical} titleHorizontal={titleHorizontal}
          titleColor={titleColor} titleSize={titleSize} titleFont={titleFont}
          descVertical={descVertical} descHorizontal={descHorizontal}
          descColor={descColor} descSize={descSize} descFont={descFont}
          onDescVerticalChange={setDescVertical} onDescHorizontalChange={setDescHorizontal}
          onDescColorChange={setDescColor} onDescSizeChange={setDescSize}
          onDescFontChange={setDescFont}
        />
      )}

      {simpleStep === 'url-preview' && (
        <SimplePreviewStep
          background={urlGraphic} title={simpleTitle} description={simpleDescription}
          titleVertical={titleVertical} titleHorizontal={titleHorizontal}
          titleColor={titleColor} titleSize={titleSize} titleFont={titleFont}
          descVertical={descVertical} descHorizontal={descHorizontal}
          descColor={descColor} descSize={descSize} descFont={descFont}
          onGoBack={() => setSimpleStep('url-description')}
        />
      )}

      {simpleStep === 'canvas-mockup' && (
        <>
          <QRPlusMockupStep
            mockupUrl={qrCanvasMockup} isLoading={isGeneratingCanvasMockup}
            selectedColor={selectedColor} selectedSize={selectedShirtSize}
            headerText={headerStyle.enabled ? headerStyle.text : undefined}
            footerText={footerStyle.enabled ? footerStyle.text : undefined}
          />
          {showContentRights && (
            <div className="max-w-sm mx-auto mt-4">
              <ContentRightsCheckbox confirmed={contentRightsConfirmed} onToggle={() => setContentRightsConfirmed(!contentRightsConfirmed)} contentType="image" />
            </div>
          )}
        </>
      )}

      {simpleStep === 'url-publish' && (
        <SimplePublishStep
          isPublishing={isPublishing} onPublish={handleSimplePublish}
          title={simpleTitle} description={simpleDescription} qrType={qrType}
          background={urlGraphic}
          titleVertical={titleVertical} titleHorizontal={titleHorizontal}
          titleColor={titleColor} titleSize={titleSize} titleFont={titleFont}
          descVertical={descVertical} descHorizontal={descHorizontal}
          descColor={descColor} descSize={descSize} descFont={descFont}
        />
      )}

      {simpleStep === 'canvas-save-choice' && (
        <QRCanvasSaveChoiceStep selected={canvasSaveChoice} onSelect={setCanvasSaveChoice} />
      )}

      {simpleStep === 'canvas-confirm' && (
        <div className="space-y-4">
          <QRCanvasConfirmStep
            saveChoice={'all'} productGraphicUrl={publishedProductGraphicUrl}
            backgroundUrl={urlGraphic} qrGraphicUrl={publishedQrGraphicUrl}
            isSaving={isCanvasSaving} onDone={handleCanvasDone}
          />
          {sharePacketId && (
            <ShareKitHandoff data={getShareKitData()} onCreateAnother={onCreateAnother} onBackToDashboard={onBackToDashboard} />
          )}
        </div>
      )}

      {simpleStep === 'play-video-source' && (
        <PlayVideoSourceStep
          videoUrl={playVideoUrl}
          onVideoUrlChange={(url: string) => { setPlayVideoUrl(url); setVideoUrl(url); }}
          onFileUpload={handleVideoFileUpload}
          isUploading={isUploadingVideo} uploadError={videoUploadError}
          uploadProgress={videoUploadProgress} uploadSuccess={videoUploadSuccess}
          contentRightsConfirmed={contentRightsConfirmed}
          onContentRightsToggle={() => setContentRightsConfirmed(!contentRightsConfirmed)}
        />
      )}

      {simpleStep === 'play-preview' && (
        <PlayPreviewStep videoUrl={playVideoUrl} title={simpleTitle} />
      )}

      {simpleStep === 'play-mockup' && (
        <QRPlusMockupStep
          mockupUrl={qrPlayMockup} isLoading={isGeneratingPlayMockup}
          selectedColor={selectedColor} selectedSize={selectedShirtSize}
          headerText={headerStyle.enabled ? headerStyle.text : undefined}
          footerText={footerStyle.enabled ? footerStyle.text : undefined}
        />
      )}

      {simpleStep === 'play-publish' && (
        <PlayPublishStep videoUrl={playVideoUrl} isPublishing={isPublishing} />
      )}

      {simpleStep === 'play-save-choice' && (
        <div className="space-y-4">
          <PlayPublishedStep />
          {sharePacketId && (
            <ShareKitHandoff data={getShareKitData()} onCreateAnother={onCreateAnother} onBackToDashboard={onBackToDashboard} />
          )}
        </div>
      )}

      {simpleStep === 'compose-mode' && (
        <ComposeModePicker selected={composeMode} onSelect={setComposeMode} />
      )}

      {simpleStep === 'compose-pick-items' && (
        <ComposePickItemsStep
          availableItems={publishedCanvasPlayItems} selectedItems={composeItems}
          onToggleItem={(item: any) => {
            const packetId = item.packetId || item.id;
            const existing = composeItems.find(i => i.packetId === packetId);
            if (existing) {
              setComposeItems(prev => prev.filter(i => i.packetId !== packetId));
            } else {
              setComposeItems(prev => [...prev, {
                packetId, name: item.title || item.name || 'Untitled',
                thumbnailUrl: item.itemImage || item.qrCanvasMockup || item.qrPlayMockup || item.composeMockup || item.urlGraphic || item.thumbnailUrl || '',
                type: item.packetType === 'qr-play' ? 'qr-play' : 'qr-canvas',
                durationSeconds: 86400, order: prev.length + 1,
              }]);
            }
          }}
          isLoading={isLoadingPublishedItems}
        />
      )}

      {simpleStep === 'compose-durations' && (
        <ComposeDurationsStep
          items={composeItems}
          onUpdateDuration={(packetId: string, seconds: number) => {
            setComposeItems(prev => prev.map(i => i.packetId === packetId ? { ...i, durationSeconds: seconds } : i));
          }}
        />
      )}

      {simpleStep === 'compose-order' && (
        <ComposeOrderStep
          items={composeItems}
          onMoveUp={(packetId: string) => {
            setComposeItems(prev => {
              const idx = prev.findIndex(i => i.packetId === packetId);
              if (idx <= 0) return prev;
              const next = [...prev];
              [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
              return next.map((i, j) => ({ ...i, order: j + 1 }));
            });
          }}
          onMoveDown={(packetId: string) => {
            setComposeItems(prev => {
              const idx = prev.findIndex(i => i.packetId === packetId);
              if (idx < 0 || idx >= prev.length - 1) return prev;
              const next = [...prev];
              [next[idx], next[idx + 1]] = [next[idx + 1], next[idx]];
              return next.map((i, j) => ({ ...i, order: j + 1 }));
            });
          }}
          onRemove={(packetId: string) => {
            setComposeItems(prev => prev.filter(i => i.packetId !== packetId).map((i, j) => ({ ...i, order: j + 1 })));
          }}
        />
      )}

      {simpleStep === 'compose-hosting' && (
        <ComposeHostingStep selected={composeHostingTerm} onSelect={setComposeHostingTerm} />
      )}

      {simpleStep === 'compose-mockup' && (
        <QRPlusMockupStep
          mockupUrl={composeMockup} isLoading={isGeneratingComposeMockup}
          selectedColor={selectedColor} selectedSize={selectedShirtSize}
          headerText={headerStyle.enabled ? headerStyle.text : undefined}
          footerText={footerStyle.enabled ? footerStyle.text : undefined}
        />
      )}

      {simpleStep === 'compose-preview' && (
        <ComposePreviewStep
          items={composeItems} hostingTerm={composeHostingTerm}
          mockupUrl={composeMockup} isLoadingMockup={isGeneratingComposeMockup}
          selectedColor={selectedColor} selectedSize={selectedShirtSize}
          composeMode={composeMode || 'auto-rotate'}
        />
      )}

      {simpleStep === 'compose-publish' && (
        <ComposePublishStep isPublishing={isPublishing} itemCount={composeItems.length} />
      )}

      {simpleStep === 'compose-confirm' && (
        <div className="space-y-4">
          <ComposeConfirmStep
            instanceId={composeInstanceId}
            resolverUrl={composeInstanceId ? `/qr/d/${composeInstanceId}` : null}
            itemCount={composeItems.length}
          />
          {sharePacketId && (
            <ShareKitHandoff data={getShareKitData()} onCreateAnother={onCreateAnother} onBackToDashboard={onBackToDashboard} />
          )}
        </div>
      )}
    </>
  );
}
