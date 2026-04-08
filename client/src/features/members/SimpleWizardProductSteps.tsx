import { ChannelStep } from "@/features/shared/components/wizardSteps/ChannelStep";
import { ProductCongratsStep, ColorPickerStep, SizePickerStep, getProductFriendlyName, TierPickerStep } from "@/features/shared/components/wizardSteps/ProductSteps";
import { GraphicSizeStep, PlacementCountStep, PlacementConfigStep } from "@/features/shared/components/wizardSteps/PlacementSteps";
import { TextLayoutChoiceStep, HeaderTextEditStep, FooterTextEditStep } from "@/features/shared/components/wizardSteps/TextSteps";
import { TypePickerStep, GenerateGraphicStep } from "@/features/shared/components/wizardSteps/TypeAndSurfaceSteps";
import { QRBasicTypeStep, QRBasicInputStep, QRBasicMockupStep, QRBasicSaveChoiceStep, QRBasicConfirmStep } from "@/features/shared/components/wizardSteps/QRBasicSteps";
import { QRPlusMockupStep, QRPlusSaveChoiceStep, QRPlusConfirmStep } from "@/features/shared/components/wizardSteps/QRPlusSteps";
import { ShirtPreviewStep } from "@/features/shared/components/wizardSteps/PreviewAndPublishSteps";
import { ShareKitHandoff } from "@/features/shared/components/ShareKitHandoff";
import { calculateSizeEarningsBonuses } from "@/features/shared/components/wizardSteps";
import { useWizardContext } from './WizardContext';

export function SimpleWizardProductSteps() {
  const {
    user,
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
    headerStyle, setHeaderStyle,
    footerStyle, setFooterStyle,
    productGraphic, setProductGraphic,
    textLayoutChoice, setTextLayoutChoice,
    selectedPlacements, setSelectedPlacements,
    qrGraphic, setQrGraphic,
    currentPlacementIndex,
    placementGraphicChoice, setPlacementGraphicChoice,
    currentPlacement,
    qrBasicInputType, setQrBasicInputType,
    qrBasicContent, setQrBasicContent,
    qrBasicMockup, setQrBasicMockup,
    isGeneratingBasicMockup,
    qrBasicSaveChoice, setQrBasicSaveChoice,
    isQrBasicSaving,
    qrPlusMockup, setQrPlusMockup,
    isGeneratingPlusMockup,
    qrPlusSaveChoice, setQrPlusSaveChoice,
    isQrPlusSaving,
    handleProductSelect,
    pricingSettings,
    placementEarningsBonus,
    textLineEarningsBonus,
    setViewMode,
    contentRightsConfirmed, setContentRightsConfirmed,
    urlGraphic, setUrlGraphic,
    qrPositionX, setQrPositionX,
    qrPositionY, setQrPositionY,
    qrSizePercent, setQrSizePercent,
    areaImageUrl, setAreaImageUrl,
    areaImageMode, setAreaImageMode,
    publishedPacketId,
    qrCanvasMockup, qrPlayMockup, composeMockup,
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
          onAreaImageUrlChange={setAreaImageUrl}
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
              onBackToDashboard={handleBackToDashboard}
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
              onBackToDashboard={handleBackToDashboard}
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
          qrPositionX={qrPositionX}
          qrPositionY={qrPositionY}
          qrSizePercent={qrSizePercent}
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
          qrPositionX={qrPositionX}
          qrPositionY={qrPositionY}
          qrSizePercent={qrSizePercent}
          areaImageUrl={areaImageUrl}
          areaImageMode={areaImageMode}
        />
      )}
    </>
  );
}
