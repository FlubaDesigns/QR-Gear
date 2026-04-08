import { Button } from "@/components/ui/button";
import {
  Store, Check
} from "lucide-react";
import { ChannelStep } from "@/features/shared/components/wizardSteps/ChannelStep";
import { ProductCongratsStep, ColorPickerStep, SizePickerStep, getProductFriendlyName, TierPickerStep } from "@/features/shared/components/wizardSteps/ProductSteps";
import { GraphicSizeStep, PlacementCountStep, PlacementConfigStep } from "@/features/shared/components/wizardSteps/PlacementSteps";
import { LayoutModeChoiceStep, TextLayoutChoiceStep, HeaderTextEditStep, FooterTextEditStep } from "@/features/shared/components/wizardSteps/TextSteps";
import { TypePickerStep, GenerateGraphicStep } from "@/features/shared/components/wizardSteps/TypeAndSurfaceSteps";
import { QRBasicTypeStep, QRBasicInputStep, QRBasicMockupStep, QRBasicSaveChoiceStep, QRBasicConfirmStep } from "@/features/shared/components/wizardSteps/QRBasicSteps";
import { QRPlusMockupStep, QRPlusSaveChoiceStep, QRPlusConfirmStep } from "@/features/shared/components/wizardSteps/QRPlusSteps";
import { ShirtPreviewStep } from "@/features/shared/components/wizardSteps/PreviewAndPublishSteps";
import { ShareKitHandoff } from "@/features/shared/components/ShareKitHandoff";
import { calculateSizeEarningsBonuses } from "@/features/shared/components/wizardSteps";
import { useWizardContext } from './WizardContext';

export function WizardProductSteps({
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
    qrBasicMockup, setQrBasicMockup,
    isGeneratingBasicMockup,
    qrBasicSaveChoice, setQrBasicSaveChoice,
    isQrBasicSaving,
    qrPlusMockup, setQrPlusMockup,
    isGeneratingPlusMockup,
    qrPlusSaveChoice, setQrPlusSaveChoice,
    isQrPlusSaving,
    pricingSettings,
    placementEarningsBonus,
    textLineEarningsBonus,
    handleProductSelect,
    setViewMode,
    qrPositionX, setQrPositionX,
    qrPositionY, setQrPositionY,
    qrSizePercent, setQrSizePercent,
    areaImageUrl, setAreaImageUrl,
    areaImageMode, setAreaImageMode,
    graphicLayoutMode, setGraphicLayoutMode,
    showSignInToPublish,
  } = useWizardContext();

  return (
    <>
      {!showSignInToPublish && simpleStep === 'channel' && user?.id && (
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
      {simpleStep === 'channel' && !user?.id && (
        <div className="animate-in fade-in slide-in-from-right-5 duration-300">
          <div className="text-center mb-6">
            <h2 className="text-lg font-bold text-white mb-2">Choose Your Channel</h2>
            <p className="text-sm text-white/60">Channels organize your products</p>
          </div>
          <div className="space-y-3">
            <div
              className="p-3 rounded-lg border border-emerald-500/50 bg-emerald-500/10 cursor-pointer"
              onClick={() => setSelectedChannel({ id: 'temp-channel', name: newChannelName || 'My Products' })}
              data-testid="channel-temp-default"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center">
                  <Store className="w-4 h-4 text-emerald-400" />
                </div>
                <div>
                  <p className="text-white font-medium text-sm">{newChannelName || 'My Products'}</p>
                  <p className="text-white/50 text-xs">Your first channel</p>
                </div>
                {selectedChannel && <Check className="w-4 h-4 text-emerald-400 ml-auto" />}
              </div>
            </div>
          </div>
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
              setSimpleStep('layout-mode');
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

      {simpleStep === 'layout-mode' && (
        <div className="space-y-2">
          <LayoutModeChoiceStep
            selected={graphicLayoutMode}
            onSelect={(mode) => setGraphicLayoutMode(mode)}
          />
          <div className="flex justify-center pt-2">
            <button
              onClick={() => setSimpleStep('text-choice')}
              className="px-6 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg font-medium transition-colors"
              data-testid="button-layout-mode-next"
            >
              Next
            </button>
          </div>
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
              setViewMode('index');
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
              setViewMode('index');
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
        <HeaderTextEditStep
          selectedColor={selectedColor}
          graphicSize={graphicSize}
          graphicLocation={graphicLocation}
          headerStyle={headerStyle}
          onHeaderChange={setHeaderStyle}
          earningsPerLine={textLineEarningsBonus}
          graphicLayoutMode={graphicLayoutMode}
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
          graphicLayoutMode={graphicLayoutMode}
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
          perPlacementConfigs={perPlacementConfigs}
          graphicLayoutMode={graphicLayoutMode}
        />
      )}
    </>
  );
}
