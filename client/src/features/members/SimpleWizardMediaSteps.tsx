import { SurfacePickerStep } from "@/features/shared/components/wizardSteps/TypeAndSurfaceSteps";
import { QRCanvasExplainerStep, UrlSourceChoiceStep, SimpleBackgroundStep, QRCanvasSaveChoiceStep, QRCanvasConfirmStep, SimplePreviewStep, SimplePublishStep } from "@/features/shared/components/wizardSteps/CanvasSteps";
import { PlayVideoSourceStep, PlayPreviewStep, PlayPublishStep, PlayPublishedStep } from "@/features/shared/components/wizardSteps/PlaySteps";
import { ComposeModePicker, ComposePickItemsStep, ComposeDurationsStep, ComposeOrderStep, ComposeHostingStep, ComposePreviewStep, ComposePublishStep, ComposeConfirmStep, ComposeExplainerCard, PlatformAcknowledgementCard } from "@/features/shared/components/wizardSteps/ComposeSteps";
import { UrlTitleStep, UrlDescriptionStep } from "@/features/shared/components/wizardSteps/PreviewAndPublishSteps";
import { QRPlusMockupStep } from "@/features/shared/components/wizardSteps/QRPlusSteps";
import { ShareKitHandoff } from "@/features/shared/components/ShareKitHandoff";
import { generateQRCodeUrl } from "@/features/shared/components/wizardSteps";
import { ContentRightsCheckbox } from "@/features/shared/components/ContentRightsCheckbox";
import { useWizardContext } from './WizardContext';

export function SimpleWizardMediaSteps() {
  const {
    user,
    api,
    simpleStep, setSimpleStep,
    selectedProductType,
    selectedColor,
    selectedShirtSize,
    graphicSize,
    currentPacketId, setCurrentPacketId,
    qrType, setQrType,
    isPublishing,
    headerStyle,
    footerStyle,
    productGraphic, setProductGraphic,
    originalUrlGraphic, setOriginalUrlGraphic,
    urlGraphic, setUrlGraphic,
    videoUrl, setVideoUrl,
    textLayoutChoice,
    qrGraphic, setQrGraphic,
    urlSourceChoice, setUrlSourceChoice,
    libraryChoice, setLibraryChoice,
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
    publishedPacketId,
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
    selectedChannel,
    qrBasicMockup,
    qrPlusSaveChoice,
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

  return (
    <>
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
              
              const isPrintful = selectedProductType?.fulfillmentProvider === 'printful';
              if (selectedProductType?.blueprintId && (selectedProductType?.printProviderId || isPrintful) && selectedColor) {
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
                  fulfillmentProvider: isPrintful ? 'printful' : 'printify',
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
              console.error('[Simple QR Plus] Error generating mockup:', error);
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
              onBackToDashboard={handleBackToDashboard}
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
              onBackToDashboard={handleBackToDashboard}
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
              onBackToDashboard={handleBackToDashboard}
            />
          )}
        </div>
      )}
    </>
  );
}
