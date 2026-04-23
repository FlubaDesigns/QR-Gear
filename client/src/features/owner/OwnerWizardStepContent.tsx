import { Button } from "@/components/ui/button";
import { ChevronLeft, ShoppingCart, DollarSign, Crown, Sparkles, QrCode, Type, ImagePlus, Play, Check, Layers, Loader2 } from "lucide-react";
import { ProductPickerStep, ColorPickerStep, SizePickerStep, getProductFriendlyName, TierPickerStep } from "@/features/shared/components/wizardSteps/ProductSteps";
import { GraphicSizeStep, PlacementCountStep, PlacementConfigStep } from "@/features/shared/components/wizardSteps/PlacementSteps";
import { LayoutModeChoiceStep, TextLayoutChoiceStep, HeaderTextEditStep, FooterTextEditStep } from "@/features/shared/components/wizardSteps/TextSteps";
import { GenerateGraphicStep } from "@/features/shared/components/wizardSteps/TypeAndSurfaceSteps";
import { QRBasicTypeStep, QRBasicInputStep, QRBasicMockupStep } from "@/features/shared/components/wizardSteps/QRBasicSteps";
import { QRPlusMockupStep } from "@/features/shared/components/wizardSteps/QRPlusSteps";
import { ShirtPreviewStep } from "@/features/shared/components/wizardSteps/PreviewAndPublishSteps";
import { generateQRCodeUrl } from "@/features/shared/components/wizardSteps";
import { type TextStyleConfig } from "@/features/shared/components/TextStyleEditor";
import type { AllowedProduct, SimpleWizardStep, QRType, GraphicLocation, GraphicSize, PlacementOption, TextLayoutChoice, QRBasicInputType, PlacementGraphicChoice } from "@/features/shared/components/wizardSteps/wizardTypes";
import { OwnerCostSummary } from "./OwnerWizardComponents";
import { Users } from "lucide-react";

interface OwnerWizardStepContentProps {
  simpleStep: SimpleWizardStep;
  selectedProductType: AllowedProduct | null;
  selectedColor: string;
  selectedShirtSize: string;
  selectedPlacements: PlacementOption[];
  graphicLocation: GraphicLocation;
  graphicSize: GraphicSize;
  qrType: QRType;
  textLayoutChoice: TextLayoutChoice;
  headerStyle: TextStyleConfig;
  footerStyle: TextStyleConfig;
  currentPlacement: string;
  currentPlacementIndex: number;
  placementGraphicChoice: PlacementGraphicChoice;
  qrBasicInputType: QRBasicInputType;
  qrBasicContent: string;
  qrBasicMockup: string;
  qrPlusMockup: string;
  qrPositionX: number;
  qrPositionY: number;
  qrSizePercent: number;
  areaImageUrl: string;
  areaImageMode: "behind-qr";
  graphicLayoutMode: "zone" | "freeform";
  isGeneratingBasicMockup: boolean;
  isGeneratingPlusMockup: boolean;
  isGeneratingRealMockup: boolean;
  realMockupUrl: string | null;
  lifestyleMockupUrl: string | null;
  tempPacketId: string | null;
  runningCost: number;
  wantsHeaderFooter: boolean | null;
  pricingSettings: any;
  placementCostExtra: number;
  textLineCost: number;
  sizeCostBonuses: Record<string, number>;
  allowedTypes: QRType[];
  allTypeDefinitions: Array<{ id: QRType; label: string; description: string; icon: any; color: string; requiresMember: boolean }>;
  preSelectedType: QRType;
  minTierIndex: number;
  textLines: number;

  setSelectedColor: (c: string) => void;
  setSelectedShirtSize: (s: string) => void;
  setQrType: (t: QRType) => void;
  setSelectedPlacements: (fn: (prev: PlacementOption[]) => PlacementOption[]) => void;
  setGraphicSize: (s: GraphicSize) => void;
  setWantsHeaderFooter: (v: boolean) => void;
  setHeaderStyle: (s: TextStyleConfig) => void;
  setFooterStyle: (s: TextStyleConfig) => void;
  setTextLayoutChoice: (c: TextLayoutChoice) => void;
  setPlacementGraphicChoice: (c: PlacementGraphicChoice) => void;
  setQrBasicInputType: (t: QRBasicInputType) => void;
  setQrBasicContent: (c: string) => void;
  setQrPositionX: (x: number) => void;
  setQrPositionY: (y: number) => void;
  setQrSizePercent: (s: number) => void;
  setAreaImageUrl: (u: string) => void;
  setAreaImageMode: (m: "behind-qr") => void;
  setGraphicLayoutMode: (m: "zone" | "freeform") => void;
  setRunningCost: (fn: (prev: number) => number) => void;
  setCostPulse: (v: boolean) => void;
  setSimpleStep: (s: SimpleWizardStep) => void;

  handleProductSelect: (product: AllowedProduct) => void;
  navigate: (path: string) => void;
}

export function OwnerWizardStepContent(props: OwnerWizardStepContentProps) {
  const {
    simpleStep, selectedProductType, selectedColor, selectedShirtSize,
    selectedPlacements, graphicLocation, graphicSize, qrType,
    textLayoutChoice, headerStyle, footerStyle, currentPlacement,
    currentPlacementIndex, placementGraphicChoice, qrBasicInputType,
    qrBasicContent, qrBasicMockup, qrPlusMockup, qrPositionX, qrPositionY,
    qrSizePercent, areaImageUrl, areaImageMode, graphicLayoutMode, isGeneratingBasicMockup,
    isGeneratingPlusMockup, isGeneratingRealMockup, realMockupUrl,
    lifestyleMockupUrl, tempPacketId, runningCost, wantsHeaderFooter,
    pricingSettings, placementCostExtra, textLineCost, sizeCostBonuses,
    allowedTypes, allTypeDefinitions, preSelectedType, minTierIndex, textLines,
    setSelectedColor, setSelectedShirtSize, setQrType, setSelectedPlacements,
    setGraphicSize, setWantsHeaderFooter, setHeaderStyle, setFooterStyle,
    setTextLayoutChoice, setPlacementGraphicChoice, setQrBasicInputType,
    setQrBasicContent, setQrPositionX, setQrPositionY, setQrSizePercent,
    setAreaImageUrl, setAreaImageMode, setGraphicLayoutMode, setRunningCost, setCostPulse,
    setSimpleStep, handleProductSelect, navigate,
  } = props;

  return (
    <>
      {simpleStep === 'product' && (
        <TierPickerStep
          selectedProduct={selectedProductType}
          onSelect={handleProductSelect}
          context="owner"
        />
      )}

      {simpleStep === 'product-congrats' && selectedProductType && (
        <div className="flex flex-col items-center justify-center py-4 space-y-4 animate-in fade-in slide-in-from-right-5 duration-300">
          <div className="relative">
            <div className="absolute inset-0 bg-blue-500/20 rounded-full blur-3xl animate-pulse" />
            <div className="relative bg-gradient-to-br from-blue-500 to-cyan-600 rounded-full p-4">
              <ShoppingCart className="w-12 h-12 text-white" />
            </div>
          </div>
          <div className="text-center space-y-3">
            <h2 className="text-lg font-bold text-white">Great Choice!</h2>
            <p className="text-slate-300">
              You selected the <span className="text-white font-semibold">{selectedProductType.title}</span>
            </p>
          </div>
          <div className="bg-slate-800/80 rounded-2xl p-6 border border-blue-500/30">
            <p className="text-slate-400 text-sm mb-2">Starting price</p>
            <div className="text-3xl font-bold text-blue-400" data-testid="text-starting-price">
              ${(selectedProductType.retailPrice || pricingSettings?.baseRetailPrice || 29.99).toFixed(2)}
            </div>
            <p className="text-slate-500 text-xs mt-2">Final price may vary with options you choose</p>
          </div>
        </div>
      )}

      {simpleStep === 'color' && (
        <ColorPickerStep
          selectedColor={selectedColor}
          onSelect={setSelectedColor}
          context="owner"
          productName={getProductFriendlyName(selectedProductType?.title)}
        />
      )}

      {simpleStep === 'size' && (
        <SizePickerStep
          selectedSize={selectedShirtSize}
          selectedColor={selectedColor}
          baseEarnings={runningCost}
          sizeEarningsBonuses={sizeCostBonuses}
          selectedPlacements={selectedPlacements}
          context="owner"
          productName={getProductFriendlyName(selectedProductType?.title)}
          onSelect={(size) => {
            const oldBonus = sizeCostBonuses[selectedShirtSize] || 0;
            const newBonus = sizeCostBonuses[size] || 0;
            const costDiff = newBonus - oldBonus;
            setSelectedShirtSize(size);
            if (selectedShirtSize && costDiff !== 0) {
              setRunningCost(prev => prev + costDiff);
            } else if (!selectedShirtSize) {
              setRunningCost(prev => prev + newBonus);
            }
            setCostPulse(true);
            setTimeout(() => setCostPulse(false), 600);
          }}
        />
      )}

      {simpleStep === 'type' && (
        <div className="animate-in fade-in slide-in-from-right-5 duration-300">
          <div className="text-center mb-3">
            <h2 className="text-lg font-bold text-white mb-2">What do you want to create?</h2>
            <p className="text-slate-400">Choose the type of QR experience</p>
            {minTierIndex > 0 && (
              <p className="text-xs text-amber-400 mt-1">Based on your selection, showing {allowedTypes.length} options</p>
            )}
          </div>
          <div className="grid grid-cols-1 gap-3 max-w-md mx-auto">
            {allTypeDefinitions
              .filter(t => allowedTypes.includes(t.id))
              .map((type) => {
                return (
                  <button
                    key={type.id}
                    onClick={() => setQrType(type.id)}
                    className={`p-4 rounded-xl border-2 transition-all flex items-center gap-4 ${
                      qrType === type.id
                        ? 'border-white bg-white/10'
                        : 'border-slate-600 bg-slate-800/50 hover:border-slate-500'
                    }`}
                    data-testid={`button-type-${type.id}`}
                  >
                    <div className={`w-12 h-12 rounded-full ${type.color} flex items-center justify-center flex-shrink-0`}>
                      <type.icon className="w-6 h-6 text-white" />
                    </div>
                    <div className="text-left flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-bold text-white">{type.label}</h3>
                        {type.requiresMember && (
                          <span className="text-xs font-medium px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 border border-amber-500/30">
                            Members
                          </span>
                        )}
                      </div>
                      <p className="text-slate-400 text-sm">{type.description}</p>
                    </div>
                    {qrType === type.id && (
                      <Check className="w-6 h-6 text-green-400 flex-shrink-0" />
                    )}
                  </button>
                );
              })}
          </div>
        </div>
      )}

      {simpleStep === ('compose-explain' as SimpleWizardStep) && (
        <div className="animate-in fade-in slide-in-from-right-5 duration-300 text-center space-y-4 py-4">
          <div className="relative mx-auto w-fit">
            <div className="absolute inset-0 bg-amber-500/20 rounded-full blur-3xl animate-pulse" />
            <div className="relative bg-gradient-to-br from-amber-500 to-orange-600 rounded-full p-4">
              <Layers className="w-12 h-12 text-white" />
            </div>
          </div>
          <div className="space-y-2">
            <h2 className="text-lg font-bold text-white">QR Compose</h2>
            <p className="text-slate-300 text-sm max-w-sm mx-auto">
              QR Compose lets you build a rotating playlist from multiple QR experiences. One scan, many moments - on a schedule you control.
            </p>
          </div>
          <div className="bg-slate-800/80 rounded-xl p-4 border border-slate-600 text-left space-y-3 max-w-sm mx-auto">
            <div className="flex items-start gap-3">
              <Sparkles className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
              <p className="text-slate-300 text-sm">Combine Canvas, Play, and Basic QR items into one rotating playlist</p>
            </div>
            <div className="flex items-start gap-3">
              <QrCode className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
              <p className="text-slate-300 text-sm">One QR code shows different content at different times</p>
            </div>
            <div className="flex items-start gap-3">
              <Layers className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
              <p className="text-slate-300 text-sm">You need at least 2 published moments to start composing</p>
            </div>
          </div>

          <div className="text-left max-w-sm mx-auto space-y-3">
            <h3 className="text-white font-bold text-sm text-center">Two ways to get there</h3>

            <div className="bg-blue-500/10 rounded-xl p-4 border border-blue-500/20 space-y-2">
              <div className="flex items-center gap-2 flex-wrap">
                <ShoppingCart className="w-4 h-4 text-blue-400 flex-shrink-0" />
                <h4 className="text-blue-400 font-bold text-sm">Keep buying</h4>
              </div>
              <p className="text-slate-300 text-sm">
                Build and purchase at least 2 products. Each one becomes a moment. Once you have 2, you can compose them into a rotating playlist.
              </p>
            </div>

            <div className="text-center text-slate-500 text-xs font-medium">or</div>

            <div className="bg-gradient-to-br from-amber-900/30 to-orange-900/30 rounded-xl p-4 border border-amber-500/30 space-y-2">
              <div className="flex items-center gap-2 flex-wrap">
                <Crown className="w-4 h-4 text-amber-400 flex-shrink-0" />
                <h4 className="text-amber-400 font-bold text-sm">Become a member</h4>
              </div>
              <p className="text-slate-300 text-sm mb-2">
                Members get everything owners get, plus:
              </p>
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <DollarSign className="w-3.5 h-3.5 text-green-400 flex-shrink-0" />
                  <span className="text-slate-300 text-xs">Earn money every time someone buys your design</span>
                </div>
                <div className="flex items-center gap-2">
                  <Layers className="w-3.5 h-3.5 text-green-400 flex-shrink-0" />
                  <span className="text-slate-300 text-xs">Save designs to your personal library</span>
                </div>
                <div className="flex items-center gap-2">
                  <Users className="w-3.5 h-3.5 text-green-400 flex-shrink-0" />
                  <span className="text-slate-300 text-xs">Share products on social media with built-in tools</span>
                </div>
                <div className="flex items-center gap-2">
                  <Sparkles className="w-3.5 h-3.5 text-green-400 flex-shrink-0" />
                  <span className="text-slate-300 text-xs">Access advanced builder tools and templates</span>
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-col items-center gap-2 max-w-sm mx-auto">
            <Button
              onClick={() => {
                setQrType('' as QRType);
                setSimpleStep('type');
              }}
              className="w-full bg-blue-500 hover:bg-blue-600 font-bold"
              data-testid="button-compose-build-first"
            >
              <Sparkles className="w-4 h-4 mr-2" />
              Build Your First Moment
            </Button>
            <Button
              onClick={() => navigate(`/members?tempPacketId=${tempPacketId || ''}&wizard=super-simple`)}
              variant="outline"
              className="w-full border-amber-500/40 text-amber-400"
              data-testid="button-compose-become-member"
            >
              <Crown className="w-4 h-4 mr-2" />
              Become a Member
            </Button>
            <Button
              onClick={() => {
                setQrType('' as QRType);
                setSimpleStep('type');
              }}
              variant="ghost"
              className="text-slate-400"
              data-testid="button-compose-back-to-types"
            >
              <ChevronLeft className="w-4 h-4 mr-1" />
              Pick a different type
            </Button>
          </div>
        </div>
      )}

      {simpleStep === 'placement-count' && (
        <PlacementCountStep
          selected={selectedPlacements}
          onToggle={(placement) => {
            const isRemoving = selectedPlacements.includes(placement);
            if (isRemoving) {
              if (selectedPlacements.length > 1) {
                setRunningCost(prev => prev - placementCostExtra);
              }
              setSelectedPlacements(prev => prev.filter(p => p !== placement));
            } else {
              if (selectedPlacements.length >= 1) {
                setRunningCost(prev => prev + placementCostExtra);
              }
              setSelectedPlacements(prev => [...prev, placement]);
            }
          }}
          selectedColor={selectedColor}
          placementEarningsBonus={placementCostExtra}
          productPlacements={selectedProductType?.placements}
          context="owner"
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
            context="owner"
            onYes={() => {
              setWantsHeaderFooter(true);
              if (!preSelectedType || preSelectedType === 'qr-basic' || preSelectedType === 'qr-plus') {
                setQrType('qr-plus');
              }
              setSimpleStep('layout-mode');
            }}
            onNo={() => {
              setWantsHeaderFooter(false);
              if (!preSelectedType || preSelectedType === 'qr-basic' || preSelectedType === 'qr-plus') {
                if (qrType !== 'qr-plus') {
                  setQrType('qr-basic');
                }
                setSimpleStep('qr-basic-type');
              } else {
                setSimpleStep('shirt-preview');
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

      {simpleStep === 'text-choice' && (
        <div className="space-y-2">
          <TextLayoutChoiceStep
            selected={textLayoutChoice}
            textLineEarningsBonus={textLineCost}
            context="owner"
            onSelect={(choice) => {
              const prevLines = textLayoutChoice === 'both' ? 2 : (textLayoutChoice === 'header' || textLayoutChoice === 'footer') ? 1 : 0;
              const newLines = choice === 'both' ? 2 : 1;
              const diff = newLines - prevLines;
              if (diff !== 0) {
                setRunningCost(prev => prev + (diff * textLineCost));
              }
              setTextLayoutChoice(choice);
            }}
          />
        </div>
      )}

      {simpleStep === 'text-edit-header' && (
        <HeaderTextEditStep
          selectedColor={selectedColor}
          graphicSize={graphicSize}
          graphicLocation={graphicLocation}
          headerStyle={headerStyle}
          onHeaderChange={setHeaderStyle}
          earningsPerLine={textLineCost}
          context="owner"
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
          earningsPerLine={textLineCost}
          context="owner"
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
          graphicLayoutMode={graphicLayoutMode}
        />
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
        <div className="space-y-4">
          {isGeneratingBasicMockup || isGeneratingRealMockup ? (
            <div className="flex flex-col items-center justify-center py-8 space-y-4 animate-in fade-in duration-300">
              <div className="relative">
                <div className="absolute inset-0 bg-blue-500/20 rounded-full blur-3xl animate-pulse" />
                <Loader2 className="w-16 h-16 text-blue-400 animate-spin relative" />
              </div>
              <div className="text-center space-y-2">
                <h3 className="text-white font-bold">Generating Your Product Mockup</h3>
                <p className="text-slate-400 text-sm">Creating a realistic preview of your design on the actual product...</p>
                <p className="text-slate-500 text-xs">This may take 10-20 seconds</p>
              </div>
            </div>
          ) : realMockupUrl ? (
            <div className="space-y-3 animate-in fade-in duration-300">
              <h2 className="text-lg font-bold text-white text-center">Your Product Mockup</h2>
              <p className="text-slate-400 text-sm text-center">Here's how your design will look on the actual product</p>
              <div className="flex justify-center gap-3 flex-wrap">
                <img src={realMockupUrl} alt="Product mockup" className="max-w-[280px] rounded-xl border border-slate-600 shadow-lg" data-testid="img-real-mockup-basic" />
                {lifestyleMockupUrl && (
                  <img src={lifestyleMockupUrl} alt="Lifestyle mockup" className="max-w-[280px] rounded-xl border border-slate-600 shadow-lg" data-testid="img-lifestyle-mockup-basic" />
                )}
              </div>
              {tempPacketId && (
                <p className="text-center text-xs text-slate-500">Packet ID: {tempPacketId}</p>
              )}
            </div>
          ) : (
            <QRBasicMockupStep
              mockupUrl={qrBasicMockup || generateQRCodeUrl(qrBasicContent, 300)}
              isLoading={false}
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
          <OwnerCostSummary
            basePrice={selectedProductType?.retailPrice || 0}
            sizeCost={sizeCostBonuses[selectedShirtSize] || 0}
            placementCost={Math.max(0, selectedPlacements.length - 1) * placementCostExtra}
            textCost={textLines * textLineCost}
            total={runningCost}
          />
        </div>
      )}

      {simpleStep === 'qr-plus-mockup' && (
        <div className="space-y-4">
          {isGeneratingPlusMockup || isGeneratingRealMockup ? (
            <div className="flex flex-col items-center justify-center py-8 space-y-4 animate-in fade-in duration-300">
              <div className="relative">
                <div className="absolute inset-0 bg-blue-500/20 rounded-full blur-3xl animate-pulse" />
                <Loader2 className="w-16 h-16 text-blue-400 animate-spin relative" />
              </div>
              <div className="text-center space-y-2">
                <h3 className="text-white font-bold">Generating Your Product Mockup</h3>
                <p className="text-slate-400 text-sm">Creating a realistic preview with your text and QR design...</p>
                <p className="text-slate-500 text-xs">This may take 10-20 seconds</p>
              </div>
            </div>
          ) : realMockupUrl ? (
            <div className="space-y-3 animate-in fade-in duration-300">
              <h2 className="text-lg font-bold text-white text-center">Your Product Mockup</h2>
              <p className="text-slate-400 text-sm text-center">Here's how your design will look on the actual product</p>
              <div className="flex justify-center gap-3 flex-wrap">
                <img src={realMockupUrl} alt="Product mockup" className="max-w-[280px] rounded-xl border border-slate-600 shadow-lg" data-testid="img-real-mockup-plus" />
                {lifestyleMockupUrl && (
                  <img src={lifestyleMockupUrl} alt="Lifestyle mockup" className="max-w-[280px] rounded-xl border border-slate-600 shadow-lg" data-testid="img-lifestyle-mockup-plus" />
                )}
              </div>
              {tempPacketId && (
                <p className="text-center text-xs text-slate-500">Packet ID: {tempPacketId}</p>
              )}
            </div>
          ) : (
            <QRPlusMockupStep
              mockupUrl={qrPlusMockup}
              isLoading={false}
              selectedColor={selectedColor}
              selectedSize={selectedShirtSize}
              headerText={headerStyle.text}
              footerText={footerStyle.text}
            />
          )}
          <OwnerCostSummary
            basePrice={selectedProductType?.retailPrice || 0}
            sizeCost={sizeCostBonuses[selectedShirtSize] || 0}
            placementCost={Math.max(0, selectedPlacements.length - 1) * placementCostExtra}
            textCost={textLines * textLineCost}
            total={runningCost}
          />
        </div>
      )}
    </>
  );
}
