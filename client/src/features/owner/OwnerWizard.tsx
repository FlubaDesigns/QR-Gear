import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { ChevronLeft, ChevronRight, ShoppingCart, DollarSign, Crown, Tag, Users, Sparkles, X, QrCode, Type, ImagePlus, Play, Check, Layers } from "lucide-react";
import { SimpleWizardProgressBar } from "@/features/shared/components/wizardSteps/WizardProgressBars";
import { ProductPickerStep, ColorPickerStep, SizePickerStep } from "@/features/shared/components/wizardSteps/ProductSteps";
import { GraphicSizeStep, PlacementCountStep, PlacementConfigStep } from "@/features/shared/components/wizardSteps/PlacementSteps";
import { TextLayoutChoiceStep, HeaderTextEditStep, FooterTextEditStep } from "@/features/shared/components/wizardSteps/TextSteps";
import { GenerateGraphicStep } from "@/features/shared/components/wizardSteps/TypeAndSurfaceSteps";
import { QRBasicTypeStep, QRBasicInputStep, QRBasicMockupStep } from "@/features/shared/components/wizardSteps/QRBasicSteps";
import { QRPlusMockupStep } from "@/features/shared/components/wizardSteps/QRPlusSteps";
import { ShirtPreviewStep } from "@/features/shared/components/wizardSteps/PreviewAndPublishSteps";
import { generateQRCodeUrl } from "@/features/shared/components/wizardSteps";
import { type TextStyleConfig, defaultTextStyle } from "@/features/shared/components/TextStyleEditor";
import type { AllowedProduct, SimpleWizardStep, QRType, GraphicLocation, GraphicSize, PlacementOption, TextLayoutChoice, QRBasicInputType, PlacementGraphicChoice } from "@/features/shared/components/wizardSteps/wizardTypes";
import { SHIRT_SIZES, SIMPLE_WIZARD_STEPS, QR_BASIC_STEPS, QR_PLUS_STEPS } from "@/features/shared/components/wizardSteps/wizardTypes";

const OWNER_WIZARD_STEPS = SIMPLE_WIZARD_STEPS.filter(s => s.id !== 'channel');
const OWNER_BASIC_STEPS = QR_BASIC_STEPS.filter(s => s.id !== 'channel');
const OWNER_PLUS_STEPS = QR_PLUS_STEPS.filter(s => s.id !== 'channel');

function OwnerCostSummary({ basePrice, sizeCost, placementCost, textCost, total }: {
  basePrice: number; sizeCost: number; placementCost: number; textCost: number; total: number;
}) {
  return (
    <div className="bg-slate-800/80 rounded-xl p-4 border border-slate-600 space-y-2">
      <h3 className="text-white font-bold text-sm mb-3">Cost Breakdown</h3>
      <div className="flex justify-between gap-2 text-sm">
        <span className="text-slate-400">Base product</span>
        <span className="text-white">${basePrice.toFixed(2)}</span>
      </div>
      {sizeCost > 0 && (
        <div className="flex justify-between gap-2 text-sm">
          <span className="text-slate-400">Size upcharge</span>
          <span className="text-white">+${sizeCost.toFixed(2)}</span>
        </div>
      )}
      {placementCost > 0 && (
        <div className="flex justify-between gap-2 text-sm">
          <span className="text-slate-400">Extra placements</span>
          <span className="text-white">+${placementCost.toFixed(2)}</span>
        </div>
      )}
      {textCost > 0 && (
        <div className="flex justify-between gap-2 text-sm">
          <span className="text-slate-400">Text customization</span>
          <span className="text-white">+${textCost.toFixed(2)}</span>
        </div>
      )}
      <div className="border-t border-slate-600 pt-2 mt-2">
        <div className="flex justify-between gap-2">
          <span className="text-white font-bold">Total</span>
          <span className="text-blue-400 font-bold text-lg">${total.toFixed(2)}</span>
        </div>
      </div>
    </div>
  );
}

function MemberConversionPitch({ earnings, onSignUp, onSkip }: {
  earnings: number; onSignUp: () => void; onSkip: () => void;
}) {
  return (
    <div className="bg-gradient-to-br from-amber-900/30 to-orange-900/30 rounded-xl p-5 border border-amber-500/30 space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="bg-amber-500/20 rounded-full p-2">
          <Crown className="w-6 h-6 text-amber-400" />
        </div>
        <div>
          <h3 className="text-white font-bold">Turn This Into Income</h3>
          <p className="text-amber-200/70 text-sm">Your design could earn you money</p>
        </div>
      </div>
      <div className="bg-slate-800/60 rounded-lg p-3 space-y-2">
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-green-400" />
          <span className="text-slate-300 text-sm">Sell this design to others</span>
        </div>
        <div className="flex items-center gap-2">
          <DollarSign className="w-4 h-4 text-green-400" />
          <span className="text-slate-300 text-sm">Earn up to ${earnings.toFixed(2)} per sale</span>
        </div>
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-green-400" />
          <span className="text-slate-300 text-sm">Save designs to your personal library</span>
        </div>
      </div>
      <div className="flex gap-3 flex-wrap">
        <Button onClick={onSignUp} className="flex-1 bg-amber-500 hover:bg-amber-600 text-black font-bold" data-testid="button-become-member">
          <Crown className="w-4 h-4 mr-2" />
          Become a Member
        </Button>
        <Button variant="ghost" onClick={onSkip} className="text-slate-400" data-testid="button-skip-member">
          Maybe later
        </Button>
      </div>
    </div>
  );
}

export function OwnerWizard() {
  const params = new URLSearchParams(window.location.search);
  const rawType = params.get('type') || '';
  const TYPE_ALIASES: Record<string, string> = {
    'basic': 'qr-basic', 'plus': 'qr-plus', 'canvas': 'qr-canvas',
    'play': 'qr-play', 'compose': 'qr-compose',
  };
  const minTier = TYPE_ALIASES[rawType] || rawType;
  const [, navigate] = useLocation();

  const [simpleStep, setSimpleStep] = useState<SimpleWizardStep>('product');
  const [selectedProductType, setSelectedProductType] = useState<AllowedProduct | null>(null);
  const [selectedColor, setSelectedColor] = useState('');
  const [selectedShirtSize, setSelectedShirtSize] = useState('');
  const [graphicLocation, setGraphicLocation] = useState<GraphicLocation>('');
  const [graphicSize, setGraphicSize] = useState<GraphicSize>('');
  const [wantsHeaderFooter, setWantsHeaderFooter] = useState<boolean | null>(null);
  const [qrType, setQrType] = useState<QRType>('');
  const [runningCost, setRunningCost] = useState(0);
  const [costPulse, setCostPulse] = useState(false);
  const [selectedPlacements, setSelectedPlacements] = useState<PlacementOption[]>([]);
  const [textLayoutChoice, setTextLayoutChoice] = useState<TextLayoutChoice>('');
  const [headerStyle, setHeaderStyle] = useState<TextStyleConfig>({ ...defaultTextStyle });
  const [footerStyle, setFooterStyle] = useState<TextStyleConfig>({ ...defaultTextStyle });
  const [currentPlacementIndex, setCurrentPlacementIndex] = useState(0);
  const [placementGraphicChoice, setPlacementGraphicChoice] = useState<PlacementGraphicChoice>('');

  const [qrBasicInputType, setQrBasicInputType] = useState<QRBasicInputType>('');
  const [qrBasicContent, setQrBasicContent] = useState('');
  const [qrBasicMockup, setQrBasicMockup] = useState('');
  const [isGeneratingBasicMockup, setIsGeneratingBasicMockup] = useState(false);

  const [qrPlusMockup, setQrPlusMockup] = useState('');
  const [isGeneratingPlusMockup, setIsGeneratingPlusMockup] = useState(false);

  const [showMemberPitch, setShowMemberPitch] = useState(false);

  const { data: pricingSettings } = useQuery<{
    memberProfitShare: number;
    additionalPlacementCost: number;
    textLineUpcharge: number;
    sizeUpcharges: Record<string, number>;
    baseRetailPrice: number;
  }>({
    queryKey: ['/api/test/pricing-settings'],
    staleTime: 5 * 60 * 1000,
  });

  const currentPlacement = selectedPlacements[currentPlacementIndex] || 'front';

  const placementCostExtra = pricingSettings?.additionalPlacementCost || 4;
  const textLineCost = pricingSettings?.textLineUpcharge || 2;

  const sizeCostBonuses = useMemo(() => {
    const defaultUpcharges: Record<string, number> = { 'S': 0, 'M': 2, 'L': 4, 'XL': 6, '2XL': 8, '3XL': 10 };
    const upcharges = pricingSettings?.sizeUpcharges || defaultUpcharges;
    const bonuses: Record<string, number> = {};
    for (const size of SHIRT_SIZES) {
      bonuses[size] = upcharges[size] || 0;
    }
    return bonuses;
  }, [pricingSettings]);

  const TIER_ORDER: QRType[] = ['qr-basic', 'qr-plus', 'qr-canvas', 'qr-play', 'qr-compose'];
  const minTierIndex = TIER_ORDER.indexOf(minTier as QRType);
  const allowedTypes = minTierIndex >= 0
    ? TIER_ORDER.slice(minTierIndex)
    : TIER_ORDER;

  const allTypeDefinitions = [
    { id: 'qr-basic' as QRType, label: 'QR Basic', description: 'Just the QR code - simple and clean', icon: QrCode, color: 'bg-slate-600', requiresMember: false },
    { id: 'qr-plus' as QRType, label: 'QR Plus', description: 'QR code with header and footer text', icon: Type, color: 'bg-blue-600', requiresMember: false },
    { id: 'qr-canvas' as QRType, label: 'QR Canvas', description: 'QR code with a custom background image', icon: ImagePlus, color: 'bg-purple-600', requiresMember: true },
    { id: 'qr-play' as QRType, label: 'QR Play', description: 'QR code that opens a video', icon: Play, color: 'bg-rose-600', requiresMember: true },
    { id: 'qr-compose' as QRType, label: 'QR Compose', description: 'Build a rotating playlist', icon: Sparkles, color: 'bg-amber-600', requiresMember: true },
  ];

  const handleProductSelect = (product: AllowedProduct) => {
    setSelectedProductType(product);
    const basePrice = product.retailPrice || pricingSettings?.baseRetailPrice || 29.99;
    setRunningCost(basePrice);
    setCostPulse(true);
    setTimeout(() => setCostPulse(false), 600);
  };

  const textLines = textLayoutChoice === 'both' ? 2 : (textLayoutChoice === 'header' || textLayoutChoice === 'footer') ? 1 : 0;

  const canProceed = (() => {
    switch (simpleStep) {
      case 'product': return !!selectedProductType;
      case 'product-congrats': return true;
      case 'color': return !!selectedColor;
      case 'size': return !!selectedShirtSize;
      case 'type': return !!qrType;
      case 'placement-count': return selectedPlacements.length > 0;
      case 'graphic-size': return !!graphicSize;
      case 'generate': return wantsHeaderFooter !== null;
      case 'text-choice': return !!textLayoutChoice;
      case 'text-edit-header': return !!headerStyle.text.trim();
      case 'text-edit-footer': return !!footerStyle.text.trim();
      case 'placement-config': return !!placementGraphicChoice;
      case 'shirt-preview': return true;
      case 'qr-basic-type': return !!qrBasicInputType;
      case 'qr-basic-input': return !!qrBasicContent.trim();
      case 'qr-basic-mockup': return true;
      case 'qr-plus-mockup': return true;
      case 'compose-explain' as SimpleWizardStep: return true;
      default: return false;
    }
  })();

  const getStepsArray = () => {
    if (qrType === 'qr-basic') return OWNER_BASIC_STEPS;
    if (qrType === 'qr-plus') return OWNER_PLUS_STEPS;
    return OWNER_WIZARD_STEPS;
  };

  const isFinalStep = simpleStep === 'qr-basic-mockup' || simpleStep === 'qr-plus-mockup';

  const handleNext = () => {
    if (simpleStep === 'product') {
      setSimpleStep('product-congrats');
      return;
    }
    if (simpleStep === 'product-congrats') {
      setSimpleStep('color');
      return;
    }
    if (simpleStep === 'color') {
      setSimpleStep('size');
      return;
    }
    if (simpleStep === 'size') {
      setSimpleStep('type');
      return;
    }
    if (simpleStep === 'type') {
      if (qrType === 'qr-compose') {
        setSimpleStep('compose-explain' as SimpleWizardStep);
        return;
      }
      setSimpleStep('placement-count');
      return;
    }
    if (simpleStep === ('compose-explain' as SimpleWizardStep)) {
      return;
    }
    if (simpleStep === 'placement-count') {
      setSimpleStep('graphic-size');
      return;
    }
    if (simpleStep === 'graphic-size') {
      setSimpleStep('generate');
      return;
    }
    if (simpleStep === 'text-choice') {
      if (textLayoutChoice === 'header' || textLayoutChoice === 'both') {
        setSimpleStep('text-edit-header');
      } else {
        setSimpleStep('text-edit-footer');
      }
      return;
    }
    if (simpleStep === 'text-edit-header') {
      if (textLayoutChoice === 'both') {
        setSimpleStep('text-edit-footer');
      } else {
        if (selectedPlacements.length > 1) {
          setCurrentPlacementIndex(0);
          setSimpleStep('placement-config');
        } else {
          setSimpleStep('shirt-preview');
        }
      }
      return;
    }
    if (simpleStep === 'text-edit-footer') {
      if (selectedPlacements.length > 1) {
        setCurrentPlacementIndex(0);
        setSimpleStep('placement-config');
      } else {
        setSimpleStep('shirt-preview');
      }
      return;
    }
    if (simpleStep === 'placement-config') {
      if (currentPlacementIndex < selectedPlacements.length - 1) {
        setCurrentPlacementIndex(prev => prev + 1);
        setPlacementGraphicChoice('');
      } else {
        setSimpleStep('shirt-preview');
      }
      return;
    }
    if (simpleStep === 'shirt-preview') {
      setIsGeneratingPlusMockup(true);
      const previewUrl = `${window.location.origin}/preview/${Date.now()}`;
      const qrApiUrl = generateQRCodeUrl(previewUrl, 1000);
      setQrPlusMockup(qrApiUrl);
      setIsGeneratingPlusMockup(false);
      setSimpleStep('qr-plus-mockup');
      return;
    }
    if (simpleStep === 'qr-basic-input') {
      setIsGeneratingBasicMockup(true);
      try {
        const qrApiUrl = generateQRCodeUrl(qrBasicContent, 1000);
        setQrBasicMockup(qrApiUrl);
      } finally {
        setIsGeneratingBasicMockup(false);
      }
      setSimpleStep('qr-basic-mockup');
      return;
    }
    if (simpleStep === 'qr-basic-mockup' || simpleStep === 'qr-plus-mockup') {
      setShowMemberPitch(true);
      return;
    }

    const stepsArray = getStepsArray();
    const currentIndex = stepsArray.findIndex(s => s.id === simpleStep);
    if (currentIndex < stepsArray.length - 1) {
      setSimpleStep(stepsArray[currentIndex + 1].id);
    }
  };

  const handleBack = () => {
    if (simpleStep === 'product') return;

    if (showMemberPitch) {
      setShowMemberPitch(false);
      return;
    }

    if (simpleStep === 'placement-config' && currentPlacementIndex > 0) {
      setCurrentPlacementIndex(prev => prev - 1);
      setPlacementGraphicChoice('');
      return;
    }

    if (simpleStep === 'qr-basic-type') {
      setSimpleStep('generate');
      setWantsHeaderFooter(null);
      return;
    }

    if (simpleStep === 'text-choice') {
      setSimpleStep('generate');
      setWantsHeaderFooter(null);
      return;
    }

    const backMap: Record<string, SimpleWizardStep> = {
      'product-congrats': 'product',
      'color': 'product-congrats',
      'size': 'color',
      'type': 'size',
      'compose-explain': 'type',
      'placement-count': 'type',
      'graphic-size': 'placement-count',
      'generate': 'graphic-size',
      'text-edit-header': 'text-choice',
      'text-edit-footer': textLayoutChoice === 'both' ? 'text-edit-header' : 'text-choice',
      'placement-config': textLayoutChoice === 'both' ? 'text-edit-footer' : (textLayoutChoice === 'footer' ? 'text-edit-footer' : 'text-edit-header'),
      'shirt-preview': selectedPlacements.length > 1 ? 'placement-config' : (textLayoutChoice === 'both' ? 'text-edit-footer' : (textLayoutChoice === 'footer' ? 'text-edit-footer' : 'text-edit-header')),
      'qr-basic-input': 'qr-basic-type',
      'qr-basic-mockup': 'qr-basic-input',
      'qr-plus-mockup': 'shirt-preview',
    };

    const prev = backMap[simpleStep];
    if (prev) {
      setSimpleStep(prev);
    }
  };

  const getTierInfo = () => {
    if (['text-choice', 'text-edit-header', 'text-edit-footer', 'placement-config', 'shirt-preview', 'qr-plus-mockup'].includes(simpleStep)) {
      return { label: 'QR Plus', color: 'text-blue-400 bg-blue-500/10 border-blue-500/20' };
    }
    if (['qr-basic-type', 'qr-basic-input', 'qr-basic-mockup'].includes(simpleStep)) {
      return { label: 'QR Basic', color: 'text-slate-300 bg-slate-500/10 border-slate-500/20' };
    }
    return null;
  };

  const tier = getTierInfo();

  if (showMemberPitch) {
    const memberEarnings = (selectedProductType?.memberEarnings || 5);
    return (
      <Card className="bg-slate-800/50 border-slate-700">
        <CardHeader className="pb-1 pt-3 flex flex-row items-center justify-between gap-2">
          <p className="text-xs text-slate-400 flex items-center gap-1">
            <ShoppingCart className="w-3 h-3" />
            Build Your Product
          </p>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/')}
            className="text-white/50 hover:text-white"
            aria-label="Back to home"
            data-testid="owner-back-home-pitch"
          >
            <X className="w-4 h-4" />
          </Button>
        </CardHeader>
        <CardContent className="p-4 pt-1 space-y-4">
          <OwnerCostSummary
            basePrice={selectedProductType?.retailPrice || 0}
            sizeCost={sizeCostBonuses[selectedShirtSize] || 0}
            placementCost={Math.max(0, selectedPlacements.length - 1) * placementCostExtra}
            textCost={textLines * textLineCost}
            total={runningCost}
          />
          <MemberConversionPitch
            earnings={memberEarnings}
            onSignUp={() => navigate('/register')}
            onSkip={() => navigate('/checkout')}
          />
          <div className="flex gap-3 flex-wrap justify-between pt-2 border-t border-slate-700">
            <Button variant="outline" onClick={() => setShowMemberPitch(false)} data-testid="button-back-from-pitch">
              <ChevronLeft className="w-4 h-4 mr-1" />
              Back
            </Button>
            <Button
              onClick={() => navigate('/checkout')}
              className="bg-blue-500 hover:bg-blue-600"
              data-testid="button-add-to-cart"
            >
              <ShoppingCart className="w-4 h-4 mr-1" />
              Add to Cart
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-slate-800/50 border-slate-700">
      <CardHeader className="pb-1 pt-3 flex flex-row items-center justify-between gap-2">
        <p className="text-xs text-slate-400 flex items-center gap-1">
          <ShoppingCart className="w-3 h-3" />
          Build Your Product
        </p>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate('/')}
          className="text-white/50 hover:text-white"
          aria-label="Back to home"
          data-testid="owner-back-home"
        >
          <X className="w-4 h-4" />
        </Button>
      </CardHeader>
      <CardContent className="p-4 pt-1">
        {tier && (
          <div className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full border mb-2 ${tier.color}`} data-testid="badge-tier-label">
            {tier.label}
          </div>
        )}
        <SimpleWizardProgressBar currentStep={simpleStep} />
        {runningCost > 0 && (
          <div className={`flex items-center justify-center gap-2 mb-3 py-1.5 px-3 rounded-full bg-blue-500/10 border border-blue-500/20 mx-auto w-fit transition-all ${costPulse ? 'scale-110 border-blue-400/60 bg-blue-500/20' : ''}`} data-testid="badge-running-cost">
            <Tag className="w-3.5 h-3.5 text-blue-400" />
            <span className="text-blue-400 font-bold text-sm">
              ${runningCost.toFixed(2)} estimated cost
            </span>
          </div>
        )}

        <div className="min-h-[350px]" id="wizard-step-content">
          {simpleStep === 'product' && (
            <ProductPickerStep
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
                          <h3 className="font-bold text-white">{type.label}</h3>
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
                    setQrType('');
                    setSimpleStep('type');
                  }}
                  className="w-full bg-blue-500 hover:bg-blue-600 font-bold"
                  data-testid="button-compose-build-first"
                >
                  <Sparkles className="w-4 h-4 mr-2" />
                  Build Your First Moment
                </Button>
                <Button
                  onClick={() => navigate('/register')}
                  variant="outline"
                  className="w-full border-amber-500/40 text-amber-400"
                  data-testid="button-compose-become-member"
                >
                  <Crown className="w-4 h-4 mr-2" />
                  Become a Member
                </Button>
                <Button
                  onClick={() => {
                    setQrType('');
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
                  setQrType('qr-plus');
                  setSimpleStep('text-choice');
                }}
                onNo={() => {
                  setWantsHeaderFooter(false);
                  if (qrType !== 'qr-plus') {
                    setQrType('qr-basic');
                  }
                  setSimpleStep('qr-basic-type');
                }}
              />
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
              <QRBasicMockupStep
                mockupUrl={qrBasicMockup || generateQRCodeUrl(qrBasicContent, 300)}
                isLoading={isGeneratingBasicMockup}
                selectedColor={selectedColor}
                selectedSize={selectedShirtSize}
                inputType={qrBasicInputType}
                content={qrBasicContent}
              />
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
              <QRPlusMockupStep
                mockupUrl={qrPlusMockup}
                isLoading={isGeneratingPlusMockup}
                selectedColor={selectedColor}
                selectedSize={selectedShirtSize}
                headerText={headerStyle.text}
                footerText={footerStyle.text}
              />
              <OwnerCostSummary
                basePrice={selectedProductType?.retailPrice || 0}
                sizeCost={sizeCostBonuses[selectedShirtSize] || 0}
                placementCost={Math.max(0, selectedPlacements.length - 1) * placementCostExtra}
                textCost={textLines * textLineCost}
                total={runningCost}
              />
            </div>
          )}
        </div>

        <div className="sticky bottom-0 flex flex-wrap gap-3 justify-between pt-4 pb-2 border-t border-slate-700 bg-slate-800/95 backdrop-blur-sm -mx-6 px-6 z-10 mt-4">
          <Button
            variant="outline"
            onClick={handleBack}
            disabled={simpleStep === 'product'}
            className="flex-1 min-w-[100px] sm:flex-none"
            data-testid="button-owner-back"
          >
            <ChevronLeft className="w-4 h-4 mr-1" />
            Back
          </Button>

          {simpleStep !== 'generate' && simpleStep !== 'qr-basic-type' && simpleStep !== ('compose-explain' as SimpleWizardStep) && (
            <Button
              onClick={handleNext}
              disabled={!canProceed}
              className={`flex-1 min-w-[100px] sm:flex-none transition-all duration-300 ${
                canProceed
                  ? isFinalStep
                    ? "bg-blue-500 hover:bg-blue-600 shadow-lg shadow-blue-500/40"
                    : "bg-green-500 hover:bg-green-600 shadow-lg shadow-green-500/40"
                  : "bg-slate-600"
              }`}
              style={canProceed ? { animation: "glow 1.2s ease-in-out infinite" } : undefined}
              data-testid="button-owner-next"
            >
              {isFinalStep ? (
                <>
                  <ShoppingCart className="w-4 h-4 mr-1" />
                  Add to Cart
                </>
              ) : (
                <>
                  Next
                  <ChevronRight className="w-4 h-4 ml-1" />
                </>
              )}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default OwnerWizard;
