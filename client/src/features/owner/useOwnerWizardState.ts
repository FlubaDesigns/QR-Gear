import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { type TextStyleConfig, defaultTextStyle } from "@/features/shared/components/TextStyleEditor";
import type {
  AllowedProduct, SimpleWizardStep, QRType, GraphicLocation,
  GraphicSize, PlacementOption, TextLayoutChoice, QRBasicInputType,
  PlacementGraphicChoice,
} from "@/features/shared/components/wizardSteps/wizardTypes";
import { SHIRT_SIZES, SHIRT_COLORS } from "@/features/shared/components/wizardSteps/wizardTypes";

export function useOwnerWizardState(preSelectedType: QRType, isGuided: boolean) {
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
  const [qrSizePercent, setQrSizePercent] = useState(75);
  const [areaImageUrl, setAreaImageUrl] = useState('');
  const [areaImageMode, setAreaImageMode] = useState<"behind-qr">("behind-qr");

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
  const textLines = textLayoutChoice === 'both' ? 2 : (textLayoutChoice === 'header' || textLayoutChoice === 'footer') ? 1 : 0;

  const sizeCostBonuses = useMemo(() => {
    const defaultUpcharges: Record<string, number> = { 'S': 0, 'M': 2, 'L': 4, 'XL': 6, '2XL': 8, '3XL': 10 };
    const upcharges = pricingSettings?.sizeUpcharges || defaultUpcharges;
    const bonuses: Record<string, number> = {};
    for (const size of SHIRT_SIZES) {
      bonuses[size] = upcharges[size] || 0;
    }
    return bonuses;
  }, [pricingSettings]);

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
          headerStyle,
          footerStyle,
          textLayoutChoice,
          qrColor: (colorInfo?.textColor === '#FFFFFF') ? 'white' : 'black',
          fulfillmentProvider: selectedProductType.fulfillmentProvider || 'printify',
        }),
      });
      const data = await res.json();
      if (data.success && data.mockupUrl) {
        setRealMockupUrl(data.mockupUrl);
        setLifestyleMockupUrl(data.lifestyleMockupUrl || null);
        return true;
      }
      return false;
    } catch (err) {
      console.warn('[OwnerWizard] Mockup generation failed:', err);
      return false;
    } finally {
      setIsGeneratingRealMockup(false);
    }
  }, [selectedProductType, selectedColor, qrType, qrBasicContent, selectedPlacements, graphicSize, headerStyle, footerStyle, textLayoutChoice, tempPacketId]);

  const handlePublicCheckout = useCallback(async () => {
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
  }, [tempPacketId, isCheckingOut]);

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

  return {
    simpleStep, setSimpleStep,
    selectedProductType, setSelectedProductType,
    selectedColor, setSelectedColor,
    selectedShirtSize, setSelectedShirtSize,
    graphicLocation, setGraphicLocation,
    graphicSize, setGraphicSize,
    perPlacementSizes, setPerPlacementSizes,
    wantsHeaderFooter, setWantsHeaderFooter,
    qrType, setQrType,
    runningCost, setRunningCost,
    costPulse, setCostPulse,
    selectedPlacements, setSelectedPlacements,
    textLayoutChoice, setTextLayoutChoice,
    headerStyle, setHeaderStyle,
    footerStyle, setFooterStyle,
    currentPlacementIndex, setCurrentPlacementIndex,
    placementGraphicChoice, setPlacementGraphicChoice,
    qrBasicInputType, setQrBasicInputType,
    qrBasicContent, setQrBasicContent,
    qrBasicMockup, setQrBasicMockup,
    isGeneratingBasicMockup, setIsGeneratingBasicMockup,
    qrPositionX, setQrPositionX,
    qrPositionY, setQrPositionY,
    qrSizePercent, setQrSizePercent,
    areaImageUrl, setAreaImageUrl,
    areaImageMode, setAreaImageMode,
    qrPlusMockup, setQrPlusMockup,
    isGeneratingPlusMockup, setIsGeneratingPlusMockup,
    showMemberPitch, setShowMemberPitch,
    showCheckoutCard, setShowCheckoutCard,
    pendingPostTypeStep, setPendingPostTypeStep,
    isCheckingOut, setIsCheckingOut,
    tempPacketId, setTempPacketId,
    realMockupUrl, setRealMockupUrl,
    lifestyleMockupUrl, setLifestyleMockupUrl,
    isGeneratingRealMockup, setIsGeneratingRealMockup,
    guidedQueue, setGuidedQueue,
    guidedSeenSteps, setGuidedSeenSteps,
    pricingSettings,
    currentPlacement,
    placementCostExtra,
    textLineCost,
    textLines,
    sizeCostBonuses,
    createTempPacket,
    updateTempPacket,
    generateRealMockup,
    handlePublicCheckout,
    handleProductSelect,
  };
}
