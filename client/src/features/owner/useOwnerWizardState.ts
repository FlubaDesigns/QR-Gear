import { readOwnerCheckoutDraft, saveOwnerCheckoutDraft, clearOwnerCheckoutDraft } from '@/lib/ownerCheckoutDraft';
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
  const [restoration] = useState(() => {
    try { return { draft: readOwnerCheckoutDraft(), error: '' }; }
    catch (error: any) {
      console.error('[OwnerBuild] Restore failed:', error.message);
      return { draft: null, error: error.message || 'Your checkout design could not be restored.' };
    }
  });
  const restored = restoration.draft;
  const selection = restored?.selection;
  const [checkoutRestored, setCheckoutRestored] = useState(!!restored);
  const [simpleStep, setSimpleStep] = useState<SimpleWizardStep>(selection ? (selection.qrType === 'qr-plus' ? 'qr-plus-mockup' : 'qr-basic-mockup') : 'product');
  const [selectedProductType, setSelectedProductType] = useState<AllowedProduct | null>(selection?.selectedProductType ?? null);
  const [selectedColor, setSelectedColor] = useState(selection?.selectedColor ?? '');
  const [selectedShirtSize, setSelectedShirtSize] = useState(selection?.selectedShirtSize ?? '');
  const [graphicLocation, setGraphicLocation] = useState<GraphicLocation>(selection?.graphicLocation ?? '');
  const [graphicSize, setGraphicSize] = useState<GraphicSize>(selection?.graphicSize ?? '');
  const [perPlacementSizes, setPerPlacementSizes] = useState<Record<string, GraphicSize>>(selection?.perPlacementSizes ?? {});
  const [wantsHeaderFooter, setWantsHeaderFooter] = useState<boolean | null>(selection?.wantsHeaderFooter ?? null);
  const [qrType, setQrType] = useState<QRType>(selection?.qrType ?? preSelectedType);
  const [runningCost, setRunningCost] = useState(restored?.runningCost ?? 0);
  const [costPulse, setCostPulse] = useState(false);
  const [selectedPlacements, setSelectedPlacements] = useState<PlacementOption[]>(selection?.selectedPlacements ?? []);
  const [textLayoutChoice, setTextLayoutChoice] = useState<TextLayoutChoice>(selection?.textLayoutChoice ?? '');
  const [headerStyle, setHeaderStyle] = useState<TextStyleConfig>(selection?.headerStyle ?? { ...defaultTextStyle });
  const [footerStyle, setFooterStyle] = useState<TextStyleConfig>(selection?.footerStyle ?? { ...defaultTextStyle });
  const [currentPlacementIndex, setCurrentPlacementIndex] = useState(selection?.currentPlacementIndex ?? 0);
  const [placementGraphicChoice, setPlacementChoiceState] = useState<PlacementGraphicChoice>(selection?.placementGraphicChoice ?? '');
  const [perPlacementConfigs, setPerPlacementConfigs] = useState<Record<string, { graphicChoice: PlacementGraphicChoice }>>(selection?.perPlacementConfigs ?? {});
  const setPlacementGraphicChoice = (value: React.SetStateAction<PlacementGraphicChoice>) => {
    const choice = typeof value === 'function' ? value(placementGraphicChoice) : value;
    setPlacementChoiceState(choice);
    if (choice && selectedPlacements[currentPlacementIndex]) setPerPlacementConfigs(previous => ({ ...previous, [selectedPlacements[currentPlacementIndex]]: { graphicChoice: choice } }));
  };

  const [qrBasicInputType, setQrBasicInputType] = useState<QRBasicInputType>(selection?.qrBasicInputType ?? '');
  const [qrBasicContent, setQrBasicContent] = useState(selection?.qrBasicContent ?? '');
  const [qrBasicMockup, setQrBasicMockup] = useState('');
  const [isGeneratingBasicMockup, setIsGeneratingBasicMockup] = useState(false);
  const [qrPositionX, setQrPositionX] = useState(selection?.qrPositionX ?? 50);
  const [qrPositionY, setQrPositionY] = useState(selection?.qrPositionY ?? 50);
  const [qrSizePercent, setQrSizePercent] = useState(selection?.qrSizePercent ?? 75);
  const [areaImageUrl, setAreaImageUrl] = useState(selection?.areaImageUrl ?? '');
  const [areaImageMode, setAreaImageMode] = useState<"behind-qr">(selection?.areaImageMode ?? 'behind-qr');
  const [graphicLayoutMode, setGraphicLayoutMode] = useState<"zone" | "freeform">(selection?.graphicLayoutMode ?? 'zone');

  const [qrPlusMockup, setQrPlusMockup] = useState('');
  const [isGeneratingPlusMockup, setIsGeneratingPlusMockup] = useState(false);

  const [showMemberPitch, setShowMemberPitch] = useState(false);
  const [showCheckoutCard, setShowCheckoutCard] = useState(false);
  const [pendingPostTypeStep, setPendingPostTypeStep] = useState<string | null>(null);
  const [isCheckingOut, setIsCheckingOut] = useState(false);

  const [tempPacketId, setTempPacketId] = useState<string | null>(restored?.prepared.build.packetId ?? null);
  const [realMockupUrl, setRealMockupUrl] = useState<string | null>(restored?.prepared.preview.mockupUrl ?? null);
  const [lifestyleMockupUrl, setLifestyleMockupUrl] = useState<string | null>(restored?.prepared.preview.lifestyleMockupUrl ?? null);
  const [isGeneratingRealMockup, setIsGeneratingRealMockup] = useState(false);
  const [buildError, setBuildError] = useState(restoration.error);
  const [quotedPricing, setQuotedPricing] = useState<any>(restored?.prepared.build.pricing ?? null);
  const prepared = useRef<{ key: string; build: any; preview?: any } | null>(restored?.prepared ?? null);
  const generating = useRef(false);

  const [guidedQueue, setGuidedQueue] = useState<string[]>(isGuided && !restored ? ['welcome', 'product'] : []);
  const [guidedSeenSteps, setGuidedSeenSteps] = useState<Set<string>>(new Set(restored ? ['qr-basic-mockup', 'qr-plus-mockup'] : isGuided ? ['product'] : []));

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
    markupPercent: number;
    additionalPlacementCost: number;
    textLineUpcharge: number;
    sizeUpcharges: Record<string, number>;
    baseRetailPrice: number;
  }>({
    queryKey: ['/api/pricing-settings'],
    staleTime: 5 * 60 * 1000,
  });

  const currentPlacement = selectedPlacements[currentPlacementIndex] || 'front';
  const markup = 1 + (pricingSettings?.markupPercent ?? 0) / 100;
  const placementCostExtra = Math.round((pricingSettings?.additionalPlacementCost ?? 0) * markup * 100) / 100;
  const textLineCost = Math.round((pricingSettings?.textLineUpcharge ?? 0) * markup * 100) / 100;
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
    selectedColor, selectedShirtSize, selectedPlacements, graphicSize, perPlacementSizes, perPlacementConfigs,
    packetType: qrType, qrBasicContent, qrBasicInputType,
    headerStyle: { ...headerStyle, enabled: wantsHeaderFooter === true && ['header', 'both'].includes(textLayoutChoice) },
    footerStyle: { ...footerStyle, enabled: wantsHeaderFooter === true && ['footer', 'both'].includes(textLayoutChoice) },
    qrPositionX, qrPositionY, qrSizePercent, areaImageUrl, areaImageMode, graphicLayoutMode,
  };
  const inputKey = JSON.stringify(buildInput);
  const latestKey = useRef(inputKey);
  latestKey.current = inputKey;
  const previousInputKey = useRef(inputKey);
  useEffect(() => {
    if (previousInputKey.current === inputKey) return;
    previousInputKey.current = inputKey;
    setCheckoutRestored(false);
    try { clearOwnerCheckoutDraft(); }
    catch (error: any) { console.error('[OwnerBuild] Draft cleanup failed:', error.message); }
    setRealMockupUrl(null); setLifestyleMockupUrl(null); setTempPacketId(null); setQuotedPricing(null); setBuildError('');
  }, [inputKey]);

  useEffect(() => {
    const resume = () => { setIsCheckingOut(false); setCheckoutRestored(!!prepared.current?.preview); };
    window.addEventListener('pageshow', resume);
    return () => window.removeEventListener('pageshow', resume);
  }, []);

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
      const draft = {
        version: 1 as const, inputKey, prepared: { ...entry, preview: entry.preview }, runningCost,
        selection: { selectedProductType, selectedColor, selectedShirtSize, graphicLocation,
          graphicSize, perPlacementSizes, perPlacementConfigs, wantsHeaderFooter, qrType, selectedPlacements,
          textLayoutChoice, headerStyle, footerStyle, currentPlacementIndex, placementGraphicChoice,
          qrBasicInputType, qrBasicContent, qrPositionX, qrPositionY, qrSizePercent,
          areaImageUrl, areaImageMode, graphicLayoutMode },
      };
      saveOwnerCheckoutDraft(draft);
      const data = await request('checkout', { packetId: entry.build.packetId }, entry.build.buildToken);
      if (!data.url) throw new Error('Checkout did not return a payment page. Please try again.');
      const sessionId = new URL(data.url).pathname.split('/').find(part => part.startsWith('cs_'));
      saveOwnerCheckoutDraft({ ...draft, sessionId });
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
    setPerPlacementSizes({}); setPerPlacementConfigs({}); setGraphicSize('');
    setRunningCost(product.retailPrice || 0);
    setCostPulse(true);
    setTimeout(() => setCostPulse(false), 600);
  };

  return {
    checkoutRestored,
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
