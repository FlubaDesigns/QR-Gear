import { SurfacePickerStep } from "@/features/shared/components/wizardSteps/TypeAndSurfaceSteps";
import { QRCanvasExplainerStep, UrlSourceChoiceStep, SimpleBackgroundStep, QRCanvasSaveChoiceStep, QRCanvasConfirmStep, SimplePreviewStep, SimplePublishStep } from "@/features/shared/components/wizardSteps/CanvasSteps";
import { PlayVideoSourceStep, PlayPreviewStep, PlayPublishStep, PlayPublishedStep } from "@/features/shared/components/wizardSteps/PlaySteps";
import { ComposeModePicker, ComposePickItemsStep, ComposeDurationsStep, ComposeOrderStep, ComposeHostingStep, ComposePreviewStep, ComposePublishStep, ComposeConfirmStep, ComposeExplainerCard, PlatformAcknowledgementCard } from "@/features/shared/components/wizardSteps/ComposeSteps";
import { QRPlusMockupStep } from "@/features/shared/components/wizardSteps/QRPlusSteps";
import { UrlTitleStep, UrlDescriptionStep } from "@/features/shared/components/wizardSteps/PreviewAndPublishSteps";
import { ShareKitHandoff } from "@/features/shared/components/ShareKitHandoff";
import { generateQRCodeUrl } from "@/features/shared/components/wizardSteps";
import { useWizardContext } from './WizardContext';

export function WizardMediaSteps({
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
    selectedProductType,
    selectedColor,
    selectedShirtSize,
    graphicSize,
    isPublishing,
    headerStyle,
    footerStyle,
    productGraphic, setProductGraphic,
    originalUrlGraphic, setOriginalUrlGraphic,
    urlGraphic, setUrlGraphic,
    videoUrl, setVideoUrl,
    textLayoutChoice,
    qrType, setQrType,
    qrGraphic, setQrGraphic,
    urlSourceChoice, setUrlSourceChoice,
    libraryChoice, setLibraryChoice,
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
    canvasSaveChoice, setCanvasSaveChoice,
    isCanvasSaving,
    publishedQrGraphicUrl,
    publishedProductGraphicUrl,
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
    contentRightsConfirmed,
    setContentRightsConfirmed,
    showSignInToPublish,
  } = useWizardContext();

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
              console.log('[QR Plus] Generated qrGraphic:', qrApiUrl);

              console.log('[QR Plus] Generating productGraphic with:');
              console.log('[QR Plus]   textLayoutChoice:', textLayoutChoice);
              console.log('[QR Plus]   headerStyle:', JSON.stringify({
                text: headerStyle.text,
                enabled: headerStyle.enabled,
                color: headerStyle.color,
                fontFamily: headerStyle.fontFamily,
                fontSize: headerStyle.fontSize,
              }));
              console.log('[QR Plus]   footerStyle:', JSON.stringify({
                text: footerStyle.text,
                enabled: footerStyle.enabled,
                color: footerStyle.color,
                fontFamily: footerStyle.fontFamily,
                fontSize: footerStyle.fontSize,
              }));
              const productGraphicResult = await api.generateProductGraphic({
                qrUrl: previewUrl,
                headerStyle: headerStyle,
                footerStyle: footerStyle,
                textLayoutChoice: textLayoutChoice,
                qrColor: 'black',
              });

              console.log('[QR Plus] productGraphicResult:', JSON.stringify({
                success: productGraphicResult.success,
                hasProductGraphic: !!productGraphicResult.productGraphic,
                productGraphicLength: productGraphicResult.productGraphic?.length || 0,
                error: productGraphicResult.error,
              }));

              if (productGraphicResult.success && productGraphicResult.productGraphic) {
                setProductGraphic(productGraphicResult.productGraphic);
                console.log('[QR Plus] Generated productGraphic (composite), length:', productGraphicResult.productGraphic.length);
              } else {
                console.warn('[QR Plus] productGraphic generation failed, using qrGraphic as fallback');
                console.warn('[QR Plus] Fallback reason - success:', productGraphicResult.success, 'hasGraphic:', !!productGraphicResult.productGraphic);
                setProductGraphic(qrApiUrl);
              }

              const isPrintfulPlus = selectedProductType?.fulfillmentProvider === 'printful';
              if (selectedProductType?.blueprintId && (selectedProductType?.printProviderId || isPrintfulPlus) && selectedColor) {
                const effectiveQrSize = (graphicSize === 'small' || graphicSize === 'medium' || graphicSize === 'large') ? graphicSize : 'medium';
                console.log('[QR Plus] Generating mockup with graphicSize:', graphicSize, '\u2192 effectiveQrSize:', effectiveQrSize, 'provider:', isPrintfulPlus ? 'printful' : 'printify');

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
                  fulfillmentProvider: isPrintfulPlus ? 'printful' : 'printify',
                });

                console.log('[QR Plus] Mockup API Response:', JSON.stringify(mockupResult, null, 2));

                const bestUrl = mockupResult.lifestyleMockupUrl || mockupResult.mockupUrl;

                if (mockupResult.success && bestUrl) {
                  console.log('[QR Plus] SUCCESS - Setting qrPlusMockup to:', bestUrl);
                  setQrPlusMockup(bestUrl);
                } else {
                  console.warn('[QR Plus] FAILED - Using QR fallback. Error:', mockupResult.error);
                  setQrPlusMockup(qrApiUrl);
                }
              } else {
                console.warn('[QR Plus] Missing product info for mockup');
                setQrPlusMockup(qrApiUrl);
              }
            } catch (error) {
              console.error('[QR Plus] Error generating mockup:', error);
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

      {simpleStep === 'url-library-pick' && (
        <SimpleBackgroundStep
          memberId={user?.id || ''}
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
        <QRPlusMockupStep
          mockupUrl={qrCanvasMockup}
          isLoading={isGeneratingCanvasMockup}
          selectedColor={selectedColor}
          selectedSize={selectedShirtSize}
          headerText={headerStyle.enabled ? headerStyle.text : undefined}
          footerText={footerStyle.enabled ? footerStyle.text : undefined}
        />
      )}

      {!showSignInToPublish && simpleStep === 'url-publish' && (
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

      {!showSignInToPublish && simpleStep === 'play-publish' && (
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

      {!showSignInToPublish && simpleStep === 'compose-publish' && (
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
