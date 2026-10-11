import { productGraphicOptions } from '@shared/builderSnapshot';
import { renderProductGraphic, type RenderOptions } from '@/features/shared/graphics/productGraphicRenderer';
import { isAvailableProductVariant } from '@shared/storefrontTypes';
import { useState, useMemo, useRef, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { type TextStyleConfig, defaultTextStyle } from "@/features/shared/components/TextStyleEditor";
import type {
  AllowedProduct, SimpleWizardStep, QRType, GraphicLocation,
  GraphicSize, PlacementOption, TextLayoutChoice, QRBasicInputType,
  PlacementGraphicChoice,
} from "@/features/shared/components/wizardSteps/wizardTypes";

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
  const [graphicLayoutMode, setGraphicLayoutMode] = useState<"zone" | "freeform">("zone");

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
  const [buildError, setBuildError] = useState('');
  const [quotedPricing, setQuotedPricing] = useState<any>(null);
  const prepared = useRef<{ key: string; build: any; preview?: any } | null>(null);
  const generating = useRef(false);

  const [guidedQueue, setGuidedQueue] = useState<string[]>(isGuided ? ['welcome', 'product'] : []);
  const [guidedSeenSteps, setGuidedSeenSteps] = useState<Set<string>>(new Set(isGuided ? ['product'] : []));

  useEffect(() => {
    if (selectedShirtSize && !isAvailableProductVariant(selectedProductType?.availableVariants, selectedColor, selectedShirtSize)) setSelectedShirtSize('');
  }, [selectedProductType, selectedColor, selectedShirtSize]);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  }, [simpleStep]);

  const { data: pricingSettings, error: pricingError } = useQuery<{
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
  const placementCostExtra = pricingSettings?.additionalPlacementCost ?? 0;
  const textLineCost = pricingSettings?.textLineUpcharge ?? 0;
  const textLines = textLayoutChoice === 'both' ? 2 : (textLayoutChoice === 'header' || textLayoutChoice === 'footer') ? 1 : 0;

  const sizeCostBonuses = useMemo(() => {
    const upcharges = pricingSettings?.sizeUpcharges || {};
    const bonuses: Record<string, number> = {};
    for (const size of selectedProductType?.availableSizes ?? []) {
      bonuses[size] = upcharges[size] || 0;
    }
    return bonuses;
  }, [pricingSettings, selectedProductType]);

  const buildInput = {
    boundProduct: selectedProductType,
    title: selectedProductType?.title,
    selectedColor, selectedShirtSize, selectedPlacements, graphicSize, perPlacementSizes,
    packetType: qrType, qrBasicContent, qrBasicInputType,
    headerStyle: { ...headerStyle, enabled: wantsHeaderFooter === true && ['header', 'both'].includes(textLayoutChoice) },
    footerStyle: { ...footerStyle, enabled: wantsHeaderFooter === true && ['footer', 'both'].includes(textLayoutChoice) },
    qrPositionX, qrPositionY, qrSizePercent, areaImageUrl, areaImageMode, graphicLayoutMode,
  };
  const inputKey = JSON.stringify(buildInput);
  const latestKey = useRef(inputKey);
  latestKey.current = inputKey;
  useEffect(() => {
    setRealMockupUrl(null); setLifestyleMockupUrl(null); setTempPacketId(null); setQuotedPricing(null); setBuildError('');
  }, [inputKey]);

  async function request(path: string, body?: any, token?: string) {
    const res = await fetch(`/api/public/${path}`, { method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(token ? { 'X-QR-Build-Token': token } : {}) },
      body: JSON.stringify(body || {}),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Your build could not be saved. Please try again.');
    return data;
  }
  const generateRealMockup = async (): Promise<boolean> => {
    if (generating.current) return false;
    generating.current = true;
    setIsGeneratingRealMockup(true); setBuildError(''); setRealMockupUrl(null);
    try {
      let entry = prepared.current;
      if (!entry || entry.key !== inputKey) {
        const build = await request('builds', buildInput);
        for (const placement of build.builderSnapshot.layoutConfig.selectedPlacements) {
          if (['label_inside', 'label_outside'].includes(placement)) continue;
          const imageData = await renderProductGraphic(productGraphicOptions(build.builderSnapshot, build.qrContent, placement) as RenderOptions);
          await request(`builds/${build.packetId}/artwork`, { placement, imageData }, build.buildToken);
        }
        entry = { key: inputKey, build };
        prepared.current = entry;
      }
      if (!entry.preview) entry.preview = await request(`builds/${entry.build.packetId}/preview`, {}, entry.build.buildToken);
      if (latestKey.current !== inputKey) return false;
      const { pricing } = entry.build;
      const sizeCost = pricing.sizeUpcharges[selectedShirtSize];
      if (!Number.isFinite(sizeCost) || !entry.preview.mockupUrl) throw new Error('Your build is missing its price or product preview.');
      setQuotedPricing(pricing);
      setRunningCost(Math.round((pricing.customerPrice + sizeCost) * 100) / 100);
      setTempPacketId(entry.build.packetId);
      setRealMockupUrl(entry.preview.mockupUrl);
      setLifestyleMockupUrl(entry.preview.lifestyleMockupUrl || null);
      return true;
    } catch (err: any) {
      console.error('[OwnerBuild] Preview failed:', err);
      setBuildError(err.message);
      return false;
    } finally { generating.current = false; setIsGeneratingRealMockup(false); }
  };

  const handlePublicCheckout = async () => {
    if (isCheckingOut) return;
    setIsCheckingOut(true); setBuildError('');
    try {
      const entry = prepared.current;
      if (!entry?.preview || entry.key !== inputKey || !realMockupUrl) throw new Error('Preview your current design before checkout.');
      const data = await request('checkout', { packetId: entry.build.packetId }, entry.build.buildToken);
      if (!data.url) throw new Error('Checkout did not return a payment page. Please try again.');
      window.location.href = data.url;
    } catch (err: any) {
      console.error('[OwnerBuild] Checkout failed:', err);
      setBuildError(err.message);
      setIsCheckingOut(false);
    }
  };

  const handleProductSelect = (product: AllowedProduct) => {
    setSelectedProductType(product);
    setSelectedColor(''); setSelectedShirtSize(''); setSelectedPlacements([]);
    setPerPlacementSizes({}); setGraphicSize('');
    setRunningCost(product.retailPrice || 0);
    setCostPulse(true);
    setTimeout(() => setCostPulse(false), 600);
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
    graphicLayoutMode, setGraphicLayoutMode,
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
    buildError: buildError || pricingError?.message,
    quotedPricing,
    generateRealMockup,
    handlePublicCheckout,
    handleProductSelect,
  };
}
