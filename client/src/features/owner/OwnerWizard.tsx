import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { ChevronLeft, ChevronRight, ShoppingCart, DollarSign, Crown, Tag, Users, Sparkles, X, QrCode, Type, ImagePlus, Play, Check, Layers, Loader2, ArrowRight, Palette, Crosshair, PenLine, PartyPopper } from "lucide-react";
import { SimpleWizardProgressBar } from "@/features/shared/components/wizardSteps/WizardProgressBars";
import { type TextStyleConfig, defaultTextStyle } from "@/features/shared/components/TextStyleEditor";
import type { AllowedProduct, SimpleWizardStep, QRType, GraphicLocation, GraphicSize, PlacementOption, TextLayoutChoice, QRBasicInputType, PlacementGraphicChoice } from "@/features/shared/components/wizardSteps/wizardTypes";
import { SHIRT_SIZES, SHIRT_COLORS, SIMPLE_WIZARD_STEPS, QR_BASIC_STEPS, QR_PLUS_STEPS } from "@/features/shared/components/wizardSteps/wizardTypes";
import { generateQRCodeUrl } from "@/features/shared/components/wizardSteps";
import { GUIDED_CARDS, GUIDED_STEP_MAP, GuidedCard, OwnerCostSummary, MemberConversionPitch } from "./OwnerWizardComponents";
import { OwnerWizardStepContent } from "./OwnerWizardStepContent";

const OWNER_WIZARD_STEPS = SIMPLE_WIZARD_STEPS.filter(s => s.id !== 'channel');
const OWNER_BASIC_STEPS = QR_BASIC_STEPS.filter(s => s.id !== 'channel');
const OWNER_PLUS_STEPS = QR_PLUS_STEPS.filter(s => s.id !== 'channel');

export function OwnerWizard() {
  const params = new URLSearchParams(window.location.search);
  const rawType = params.get('type') || '';
  const isGuided = params.get('guided') === 'true';
  const TYPE_ALIASES: Record<string, string> = {
    'basic': 'qr-basic', 'plus': 'qr-plus', 'canvas': 'qr-canvas',
    'play': 'qr-play', 'compose': 'qr-compose',
  };
  const minTier = TYPE_ALIASES[rawType] || rawType;
  const [, navigate] = useLocation();

  const TIER_ORDER: QRType[] = ['qr-basic', 'qr-plus', 'qr-canvas', 'qr-play', 'qr-compose'];
  const minTierIndex = TIER_ORDER.indexOf(minTier as QRType);
  const preSelectedType = (minTierIndex >= 0 ? minTier : '') as QRType;

  const [simpleStep, setSimpleStep] = useState<SimpleWizardStep>('product');
  const [selectedProductType, setSelectedProductType] = useState<AllowedProduct | null>(null);
  const [selectedColor, setSelectedColor] = useState('');
  const [selectedShirtSize, setSelectedShirtSize] = useState('');
  const [graphicLocation, setGraphicLocation] = useState<GraphicLocation>('');
  const [graphicSize, setGraphicSize] = useState<GraphicSize>('');
  const [perPlacementSizes, setPerPlacementSizes] = useState<Record<string, GraphicSize>>({});
  const [wantsHeaderFooter, setWantsHeaderFooter] = useState<boolean | null>(null);
  const [qrType, setQrType] = useState<QRType>(preSelectedType);
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
  const [qrPositionX, setQrPositionX] = useState(50);
  const [qrPositionY, setQrPositionY] = useState(50);
  const [qrSizePercent, setQrSizePercent] = useState(50);
  const [areaImageUrl, setAreaImageUrl] = useState('');
  const [areaImageMode, setAreaImageMode] = useState<"replace-qr" | "behind-qr">("behind-qr");

  const [qrPlusMockup, setQrPlusMockup] = useState('');
  const [isGeneratingPlusMockup, setIsGeneratingPlusMockup] = useState(false);

  const [showMemberPitch, setShowMemberPitch] = useState(false);
  const [showCheckoutCard, setShowCheckoutCard] = useState(false);
  const [pendingPostTypeStep, setPendingPostTypeStep] = useState<string | null>(null);
  const [isCheckingOut, setIsCheckingOut] = useState(false);

  const [tempPacketId, setTempPacketId] = useState<string | null>(null);
  const [realMockupUrl, setRealMockupUrl] = useState<string | null>(null);
  const [lifestyleMockupUrl, setLifestyleMockupUrl] = useState<string | null>(null);
  const [isGeneratingRealMockup, setIsGeneratingRealMockup] = useState(false);
  const packetCreating = useRef(false);

  const [guidedQueue, setGuidedQueue] = useState<string[]>(isGuided ? ['welcome', 'product'] : []);
  const [guidedSeenSteps, setGuidedSeenSteps] = useState<Set<string>>(new Set(isGuided ? ['product'] : []));

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  }, [simpleStep]);

  useEffect(() => {
    if (!isGuided) return;
    if (!guidedSeenSteps.has(simpleStep)) {
      const cards = GUIDED_STEP_MAP[simpleStep];
      if (cards) {
        setGuidedQueue([...cards]);
      }
      setGuidedSeenSteps(prev => new Set(prev).add(simpleStep));
    }
  }, [simpleStep, isGuided]);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'instant' });
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  };

  const handleGuidedContinue = () => {
    scrollToTop();
    if (guidedQueue[0] === 'checkout') {
      setGuidedQueue([]);
      setShowCheckoutCard(false);
      handlePublicCheckout();
      return;
    }
    if (guidedQueue[0]?.startsWith('type-confirm-')) {
      setGuidedQueue([]);
      if (pendingPostTypeStep) {
        setSimpleStep(pendingPostTypeStep as SimpleWizardStep);
        setPendingPostTypeStep(null);
      }
      return;
    }
    if (guidedQueue.length <= 1) {
      setGuidedQueue([]);
    } else {
      setGuidedQueue(prev => prev.slice(1));
    }
  };

  const createTempPacket = useCallback(async (product: AllowedProduct) => {
    if (packetCreating.current || tempPacketId) return;
    packetCreating.current = true;
    try {
      const res = await fetch('/api/public/packets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          wizardType: 'owner',
          blueprintId: product.blueprintId,
          printProviderId: product.printProviderId,
          productTitle: product.title,
          retailPrice: product.retailPrice,
          fulfillmentProvider: product.fulfillmentProvider || 'printify',
        }),
      });
      const data = await res.json();
      if (data.success) {
        setTempPacketId(data.tempPacketId);
        console.log('[OwnerWizard] Temp packet created:', data.tempPacketId);
      }
    } catch (err) {
      console.warn('[OwnerWizard] Failed to create temp packet:', err);
    } finally {
      packetCreating.current = false;
    }
  }, [tempPacketId]);

  const updateTempPacket = useCallback(async (updates: Record<string, any>) => {
    if (!tempPacketId) return;
    try {
      await fetch(`/api/public/packets/${tempPacketId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
    } catch (err) {
      console.warn('[OwnerWizard] Failed to update temp packet:', err);
    }
  }, [tempPacketId]);

  const generateRealMockup = useCallback(async (): Promise<boolean> => {
    if (!selectedProductType) return false;
    setIsGeneratingRealMockup(true);
    try {
      const colorInfo = SHIRT_COLORS.find(c => c.id === selectedColor);
      const qrContent = qrType === 'qr-basic'
        ? qrBasicContent || 'https://example.com'
        : `${window.location.origin}/preview/${Date.now()}`;

      const res = await fetch('/api/public/generate-mockup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tempPacketId,
          blueprintId: selectedProductType.blueprintId,
          printProviderId: selectedProductType.printProviderId || 99,
          colorName: colorInfo?.name || selectedColor,
          colorHex: colorInfo?.hex || '#1a1a1a',
          placement: selectedPlacements[0] || 'front',
          qrSize: graphicSize || 'medium',
          qrUrl: qrContent,
          headerStyle: headerStyle,
          footerStyle: footerStyle,
          textLayoutChoice: textLayoutChoice,
          qrColor: (colorInfo?.textColor === '#FFFFFF') ? 'white' : 'black',
          fulfillmentProvider: selectedProductType.fulfillmentProvider || 'printify',
        }),
      });
      const data = await res.json();
      if (data.success && data.mockupUrl) {
        setRealMockupUrl(data.mockupUrl);
        setLifestyleMockupUrl(data.lifestyleMockupUrl || null);
        console.log('[OwnerWizard] Real mockup generated:', data.mockupUrl);
        return true;
      } else {
        console.warn('[OwnerWizard] Mockup generation returned:', data);
        return false;
      }
    } catch (err) {
      console.warn('[OwnerWizard] Mockup generation failed:', err);
      return false;
    } finally {
      setIsGeneratingRealMockup(false);
    }
  }, [selectedProductType, selectedColor, qrType, qrBasicContent, selectedPlacements, graphicSize, headerStyle, footerStyle, textLayoutChoice, tempPacketId]);

  const { data: pricingSettings } = useQuery<{
    memberProfitShare: number;
    additionalPlacementCost: number;
    textLineUpcharge: number;
    sizeUpcharges: Record<string, number>;
    baseRetailPrice: number;
  }>({
    queryKey: ['/api/pricing-settings'],
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
    createTempPacket(product);

    if (!product.placements || product.placements.length === 0) {
      const provider = product.fulfillmentProvider || 'printify';
      const params = new URLSearchParams({ provider });
      if (provider === 'printify') {
        if (product.blueprintId) params.set('blueprintId', String(product.blueprintId));
        if (product.printProviderId) params.set('printProviderId', String(product.printProviderId));
      } else {
        params.set('productId', String(product.blueprintId));
      }
      fetch(`/api/public/catalog/placements?${params}`)
        .then(r => r.json())
        .then(data => {
          if (data.placements && data.placements.length > 0) {
            setSelectedProductType(prev => prev ? { ...prev, placements: data.placements } : prev);
          }
        })
        .catch(err => console.warn('[OwnerWizard] Failed to fetch placements:', err));
    }
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
      case 'text-edit-header': return headerStyle.mode === 'image' ? !!headerStyle.imageUrl : !!headerStyle.text.trim();
      case 'text-edit-footer': return footerStyle.mode === 'image' ? !!footerStyle.imageUrl : !!footerStyle.text.trim();
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
      updateTempPacket({ selectedColor, colorHex: SHIRT_COLORS.find(c => c.id === selectedColor)?.hex });
      setSimpleStep('size');
      return;
    }
    if (simpleStep === 'size') {
      updateTempPacket({ selectedShirtSize, sizeCost: sizeCostBonuses[selectedShirtSize] || 0 });
      if (preSelectedType) {
        if (qrType === 'qr-compose') {
          setSimpleStep('compose-explain' as SimpleWizardStep);
        } else {
          setSimpleStep('placement-count');
        }
      } else {
        setSimpleStep('type');
      }
      return;
    }
    if (simpleStep === 'type') {
      updateTempPacket({ qrType });
      if (qrType === 'qr-compose') {
        if (isGuided) {
          setGuidedQueue(['type-confirm-compose']);
          setPendingPostTypeStep('compose-explain');
          return;
        }
        setSimpleStep('compose-explain' as SimpleWizardStep);
        return;
      }
      if (isGuided) {
        const typeKey = qrType.replace('qr-', '');
        const cardId = `type-confirm-${typeKey}`;
        if (GUIDED_CARDS[cardId]) {
          setGuidedQueue([cardId]);
          setPendingPostTypeStep('placement-count');
          return;
        }
      }
      setSimpleStep('placement-count');
      return;
    }
    if (simpleStep === ('compose-explain' as SimpleWizardStep)) {
      return;
    }
    if (simpleStep === 'placement-count') {
      updateTempPacket({ selectedPlacements });
      setCurrentPlacementIndex(0);
      setGraphicSize('');
      setSimpleStep('graphic-size');
      return;
    }
    if (simpleStep === 'graphic-size') {
      setPerPlacementSizes(prev => ({
        ...prev,
        [currentPlacement]: graphicSize
      }));
      if (currentPlacementIndex < selectedPlacements.length - 1) {
        setCurrentPlacementIndex(prev => prev + 1);
        setGraphicSize('');
        return;
      }
      updateTempPacket({ graphicSize });
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
      updateTempPacket({ headerStyle, footerStyle, textLayoutChoice });
      setIsGeneratingPlusMockup(true);
      setSimpleStep('qr-plus-mockup');
      generateRealMockup().then((success) => {
        setIsGeneratingPlusMockup(false);
        if (!success) {
          const previewUrl = `${window.location.origin}/preview/${Date.now()}`;
          setQrPlusMockup(generateQRCodeUrl(previewUrl, 1000));
        }
      }).catch(() => {
        const previewUrl = `${window.location.origin}/preview/${Date.now()}`;
        setQrPlusMockup(generateQRCodeUrl(previewUrl, 1000));
        setIsGeneratingPlusMockup(false);
      });
      return;
    }
    if (simpleStep === 'qr-basic-input') {
      updateTempPacket({ qrBasicInputType, qrBasicContent });
      setIsGeneratingBasicMockup(true);
      setSimpleStep('qr-basic-mockup');
      generateRealMockup().then((success) => {
        setIsGeneratingBasicMockup(false);
        if (!success) {
          setQrBasicMockup(generateQRCodeUrl(qrBasicContent, 1000));
        }
      }).catch(() => {
        setQrBasicMockup(generateQRCodeUrl(qrBasicContent, 1000));
        setIsGeneratingBasicMockup(false);
      });
      return;
    }
    if (simpleStep === 'qr-basic-mockup' || simpleStep === 'qr-plus-mockup') {
      updateTempPacket({
        totalCost: runningCost,
        mockupUrl: realMockupUrl,
        lifestyleMockupUrl,
        readyForCheckout: true,
      });
      if (isGuided) {
        setGuidedQueue(['checkout']);
        setShowCheckoutCard(true);
      } else {
        handlePublicCheckout();
      }
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

    if (showCheckoutCard) {
      setShowCheckoutCard(false);
      setGuidedQueue([]);
      return;
    }

    if (showMemberPitch) {
      setShowMemberPitch(false);
      return;
    }

    if (simpleStep === 'graphic-size' && currentPlacementIndex > 0) {
      const prevPlacement = selectedPlacements[currentPlacementIndex - 1];
      setCurrentPlacementIndex(prev => prev - 1);
      setGraphicSize(perPlacementSizes[prevPlacement] || '');
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
      'placement-count': preSelectedType ? 'size' : 'type',
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

  const handlePublicCheckout = async () => {
    if (!tempPacketId || isCheckingOut) return;
    setIsCheckingOut(true);
    try {
      const resp = await fetch('/api/public/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tempPacketId }),
      });
      const data = await resp.json();
      if (!resp.ok) {
        console.error('[OwnerWizard] Checkout error:', data.error);
        setIsCheckingOut(false);
        return;
      }
      if (data.url) {
        window.location.href = data.url;
      }
    } catch (err) {
      console.error('[OwnerWizard] Checkout failed:', err);
      setIsCheckingOut(false);
    }
  };

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
            onSignUp={() => navigate(`/members?tempPacketId=${tempPacketId || ''}&wizard=super-simple`)}
            onSkip={handlePublicCheckout}
          />
          <div className="flex gap-3 flex-wrap justify-between pt-2 border-t border-slate-700">
            <Button variant="outline" onClick={() => setShowMemberPitch(false)} data-testid="button-back-from-pitch">
              <ChevronLeft className="w-4 h-4 mr-1" />
              Back
            </Button>
            <Button
              onClick={handlePublicCheckout}
              disabled={isCheckingOut || !tempPacketId}
              className="bg-blue-500 hover:bg-blue-600"
              data-testid="button-add-to-cart"
            >
              {isCheckingOut ? (
                <>
                  <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <ShoppingCart className="w-4 h-4 mr-1" />
                  Buy Now — ${runningCost.toFixed(2)}
                </>
              )}
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
        {guidedQueue.length === 0 && (
          <>
            {tier && (
              <div className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full border mb-2 ${tier.color}`} data-testid="badge-tier-label">
                {tier.label}
              </div>
            )}
            <SimpleWizardProgressBar currentStep={simpleStep} currentPlacement={currentPlacement} />
            {runningCost > 0 && (
              <div className={`flex items-center justify-center gap-2 mb-3 py-1.5 px-3 rounded-full bg-blue-500/10 border border-blue-500/20 mx-auto w-fit transition-all ${costPulse ? 'scale-110 border-blue-400/60 bg-blue-500/20' : ''}`} data-testid="badge-running-cost">
                <Tag className="w-3.5 h-3.5 text-blue-400" />
                <span className="text-blue-400 font-bold text-sm">
                  ${runningCost.toFixed(2)} estimated cost
                </span>
              </div>
            )}
          </>
        )}

        <div className="min-h-[350px]" id="wizard-step-content">
          {guidedQueue.length > 0 && GUIDED_CARDS[guidedQueue[0]] ? (
            <GuidedCard
              data={GUIDED_CARDS[guidedQueue[0]]}
              onContinue={handleGuidedContinue}
            />
          ) : (
            <OwnerWizardStepContent
              simpleStep={simpleStep}
              selectedProductType={selectedProductType}
              selectedColor={selectedColor}
              selectedShirtSize={selectedShirtSize}
              selectedPlacements={selectedPlacements}
              graphicLocation={graphicLocation}
              graphicSize={graphicSize}
              qrType={qrType}
              textLayoutChoice={textLayoutChoice}
              headerStyle={headerStyle}
              footerStyle={footerStyle}
              currentPlacement={currentPlacement}
              currentPlacementIndex={currentPlacementIndex}
              placementGraphicChoice={placementGraphicChoice}
              qrBasicInputType={qrBasicInputType}
              qrBasicContent={qrBasicContent}
              qrBasicMockup={qrBasicMockup}
              qrPlusMockup={qrPlusMockup}
              qrPositionX={qrPositionX}
              qrPositionY={qrPositionY}
              qrSizePercent={qrSizePercent}
              areaImageUrl={areaImageUrl}
              areaImageMode={areaImageMode}
              isGeneratingBasicMockup={isGeneratingBasicMockup}
              isGeneratingPlusMockup={isGeneratingPlusMockup}
              isGeneratingRealMockup={isGeneratingRealMockup}
              realMockupUrl={realMockupUrl}
              lifestyleMockupUrl={lifestyleMockupUrl}
              tempPacketId={tempPacketId}
              runningCost={runningCost}
              wantsHeaderFooter={wantsHeaderFooter}
              pricingSettings={pricingSettings}
              placementCostExtra={placementCostExtra}
              textLineCost={textLineCost}
              sizeCostBonuses={sizeCostBonuses}
              allowedTypes={allowedTypes}
              allTypeDefinitions={allTypeDefinitions}
              preSelectedType={preSelectedType}
              minTierIndex={minTierIndex}
              textLines={textLines}
              setSelectedColor={setSelectedColor}
              setSelectedShirtSize={setSelectedShirtSize}
              setQrType={setQrType}
              setSelectedPlacements={setSelectedPlacements}
              setGraphicSize={setGraphicSize}
              setWantsHeaderFooter={setWantsHeaderFooter}
              setHeaderStyle={setHeaderStyle}
              setFooterStyle={setFooterStyle}
              setTextLayoutChoice={setTextLayoutChoice}
              setPlacementGraphicChoice={setPlacementGraphicChoice}
              setQrBasicInputType={setQrBasicInputType}
              setQrBasicContent={setQrBasicContent}
              setQrPositionX={setQrPositionX}
              setQrPositionY={setQrPositionY}
              setQrSizePercent={setQrSizePercent}
              setAreaImageUrl={setAreaImageUrl}
              setAreaImageMode={setAreaImageMode}
              setRunningCost={setRunningCost}
              setCostPulse={setCostPulse}
              setSimpleStep={setSimpleStep}
              handleProductSelect={handleProductSelect}
              navigate={navigate}
            />
          )}
        </div>

        {guidedQueue.length === 0 && (
        <div className="sticky bottom-0 flex flex-wrap gap-3 justify-between pt-4 pb-2 border-t border-slate-700 bg-slate-800/95 backdrop-blur-sm -mx-6 px-6 z-10 mt-4">
          {simpleStep !== 'product' && (
          <Button
            variant="outline"
            onClick={handleBack}
            className="flex-1 min-w-[100px] sm:flex-none"
            data-testid="button-owner-back"
          >
            <ChevronLeft className="w-4 h-4 mr-1" />
            Back
          </Button>
          )}

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
        )}
      </CardContent>
    </Card>
  );
}

export default OwnerWizard;
