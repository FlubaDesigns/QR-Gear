import { useMemo, useCallback } from "react";
import type { SimpleWizardStep, QRType, GraphicSize, PlacementOption, TextLayoutChoice, PlacementGraphicChoice } from "@/features/shared/components/wizardSteps/wizardTypes";
import { SIMPLE_WIZARD_STEPS, QR_BASIC_STEPS, QR_PLUS_STEPS } from "@/features/shared/components/wizardSteps/wizardTypes";
import { generateQRCodeUrl } from "@/features/shared/components/wizardSteps";
import { GUIDED_CARDS } from "./OwnerWizardComponents";
import type { TextStyleConfig } from "@/features/shared/components/TextStyleEditor";

const OWNER_WIZARD_STEPS = SIMPLE_WIZARD_STEPS.filter(s => s.id !== 'channel');
const OWNER_BASIC_STEPS = QR_BASIC_STEPS.filter(s => s.id !== 'channel');
const OWNER_PLUS_STEPS = QR_PLUS_STEPS.filter(s => s.id !== 'channel');

interface NavState {
  simpleStep: SimpleWizardStep;
  selectedProductType: any;
  selectedColor: string;
  selectedShirtSize: string;
  selectedPlacements: PlacementOption[];
  graphicSize: GraphicSize;
  qrType: QRType;
  textLayoutChoice: TextLayoutChoice;
  headerStyle: TextStyleConfig;
  footerStyle: TextStyleConfig;
  currentPlacementIndex: number;
  placementGraphicChoice: string;
  qrBasicInputType: string;
  qrBasicContent: string;
  wantsHeaderFooter: boolean | null;
  preSelectedType: QRType;
  perPlacementSizes: Record<string, GraphicSize>;
  isGuided: boolean;
  showCheckoutCard: boolean;
  showMemberPitch: boolean;
  tempPacketId: string | null;
  isCheckingOut: boolean;
  runningCost: number;
  realMockupUrl: string | null;
  lifestyleMockupUrl: string | null;
  currentPlacement: string;
  sizeCostBonuses: Record<string, number>;
}

interface NavSetters {
  setSimpleStep: (step: SimpleWizardStep) => void;
  setWantsHeaderFooter: (v: boolean | null) => void;
  setCurrentPlacementIndex: (fn: ((prev: number) => number) | number) => void;
  setGraphicSize: (v: GraphicSize) => void;
  setPlacementGraphicChoice: (v: PlacementGraphicChoice) => void;
  setPerPlacementSizes: (fn: (prev: Record<string, GraphicSize>) => Record<string, GraphicSize>) => void;
  setIsGeneratingBasicMockup: (v: boolean) => void;
  setIsGeneratingPlusMockup: (v: boolean) => void;
  setQrBasicMockup: (v: string) => void;
  setQrPlusMockup: (v: string) => void;
  setShowCheckoutCard: (v: boolean) => void;
  setShowMemberPitch: (v: boolean) => void;
  setGuidedQueue: (v: string[] | ((prev: string[]) => string[])) => void;
  setPendingPostTypeStep: (v: string | null) => void;
  updateTempPacket: (updates: Record<string, any>) => void;
  generateRealMockup: () => Promise<boolean>;
  handlePublicCheckout: () => void;
}

export function useOwnerWizardNav(state: NavState, setters: NavSetters) {
  const {
    simpleStep, selectedProductType, selectedColor, selectedShirtSize,
    selectedPlacements, graphicSize, qrType, textLayoutChoice, headerStyle,
    footerStyle, currentPlacementIndex, placementGraphicChoice, qrBasicInputType,
    qrBasicContent, wantsHeaderFooter, preSelectedType, perPlacementSizes,
    isGuided, showCheckoutCard, showMemberPitch, tempPacketId,
    runningCost, realMockupUrl, lifestyleMockupUrl, currentPlacement,
    sizeCostBonuses,
  } = state;

  const {
    setSimpleStep, setWantsHeaderFooter, setCurrentPlacementIndex, setGraphicSize,
    setPlacementGraphicChoice, setPerPlacementSizes, setIsGeneratingBasicMockup,
    setIsGeneratingPlusMockup, setQrBasicMockup, setQrPlusMockup, setShowCheckoutCard,
    setShowMemberPitch, setGuidedQueue, setPendingPostTypeStep, updateTempPacket,
    generateRealMockup, handlePublicCheckout,
  } = setters;

  const canProceed = useMemo(() => {
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
  }, [simpleStep, selectedProductType, selectedColor, selectedShirtSize, qrType,
      selectedPlacements, graphicSize, wantsHeaderFooter, textLayoutChoice,
      headerStyle, footerStyle, placementGraphicChoice, qrBasicInputType, qrBasicContent]);

  const getStepsArray = useCallback(() => {
    if (qrType === 'qr-basic') return OWNER_BASIC_STEPS;
    if (qrType === 'qr-plus') return OWNER_PLUS_STEPS;
    return OWNER_WIZARD_STEPS;
  }, [qrType]);

  const isFinalStep = simpleStep === 'qr-basic-mockup' || simpleStep === 'qr-plus-mockup';

  const handleNext = useCallback(() => {
    if (simpleStep === 'product') { setSimpleStep('product-congrats'); return; }
    if (simpleStep === 'product-congrats') { setSimpleStep('color'); return; }
    if (simpleStep === 'color') {
      updateTempPacket({ selectedColor });
      setSimpleStep('size');
      return;
    }
    if (simpleStep === 'size') {
      updateTempPacket({ selectedShirtSize, sizeCost: sizeCostBonuses[selectedShirtSize] || 0 });
      if (preSelectedType) {
        if (qrType === 'qr-compose') { setSimpleStep('compose-explain' as SimpleWizardStep); }
        else { setSimpleStep('placement-count'); }
      } else { setSimpleStep('type'); }
      return;
    }
    if (simpleStep === 'type') {
      updateTempPacket({ qrType });
      if (qrType === 'qr-compose') {
        if (isGuided) { setGuidedQueue(['type-confirm-compose']); setPendingPostTypeStep('compose-explain'); return; }
        setSimpleStep('compose-explain' as SimpleWizardStep);
        return;
      }
      if (isGuided) {
        const typeKey = qrType.replace('qr-', '');
        const cardId = `type-confirm-${typeKey}`;
        if (GUIDED_CARDS[cardId]) { setGuidedQueue([cardId]); setPendingPostTypeStep('placement-count'); return; }
      }
      setSimpleStep('placement-count');
      return;
    }
    if (simpleStep === ('compose-explain' as SimpleWizardStep)) { return; }
    if (simpleStep === 'placement-count') {
      updateTempPacket({ selectedPlacements });
      setCurrentPlacementIndex(0);
      setGraphicSize('' as GraphicSize);
      setSimpleStep('graphic-size');
      return;
    }
    if (simpleStep === 'graphic-size') {
      setPerPlacementSizes(prev => ({ ...prev, [currentPlacement]: graphicSize }));
      if (currentPlacementIndex < selectedPlacements.length - 1) {
        setCurrentPlacementIndex(prev => prev + 1);
        setGraphicSize('' as GraphicSize);
        return;
      }
      updateTempPacket({ graphicSize });
      setSimpleStep('generate');
      return;
    }
    if (simpleStep === 'text-choice') {
      if (textLayoutChoice === 'header' || textLayoutChoice === 'both') { setSimpleStep('text-edit-header'); }
      else { setSimpleStep('text-edit-footer'); }
      return;
    }
    if (simpleStep === 'text-edit-header') {
      if (textLayoutChoice === 'both') { setSimpleStep('text-edit-footer'); }
      else if (selectedPlacements.length > 1) { setCurrentPlacementIndex(0); setSimpleStep('placement-config'); }
      else { setSimpleStep('shirt-preview'); }
      return;
    }
    if (simpleStep === 'text-edit-footer') {
      if (selectedPlacements.length > 1) { setCurrentPlacementIndex(0); setSimpleStep('placement-config'); }
      else { setSimpleStep('shirt-preview'); }
      return;
    }
    if (simpleStep === 'placement-config') {
      if (currentPlacementIndex < selectedPlacements.length - 1) {
        setCurrentPlacementIndex(prev => prev + 1);
        setPlacementGraphicChoice('');
      } else { setSimpleStep('shirt-preview'); }
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
        if (!success) { setQrBasicMockup(generateQRCodeUrl(qrBasicContent, 1000)); }
      }).catch(() => {
        setQrBasicMockup(generateQRCodeUrl(qrBasicContent, 1000));
        setIsGeneratingBasicMockup(false);
      });
      return;
    }
    if (simpleStep === 'qr-basic-mockup' || simpleStep === 'qr-plus-mockup') {
      updateTempPacket({ totalCost: runningCost, mockupUrl: realMockupUrl, lifestyleMockupUrl, readyForCheckout: true });
      if (isGuided) { setGuidedQueue(['checkout']); setShowCheckoutCard(true); }
      else { handlePublicCheckout(); }
      return;
    }
    const stepsArray = getStepsArray();
    const currentIndex = stepsArray.findIndex(s => s.id === simpleStep);
    if (currentIndex < stepsArray.length - 1) {
      setSimpleStep(stepsArray[currentIndex + 1].id);
    }
  }, [simpleStep, selectedColor, selectedShirtSize, sizeCostBonuses, preSelectedType,
      qrType, isGuided, selectedPlacements, currentPlacementIndex, currentPlacement,
      graphicSize, textLayoutChoice, headerStyle, footerStyle, qrBasicInputType,
      qrBasicContent, runningCost, realMockupUrl, lifestyleMockupUrl, tempPacketId,
      updateTempPacket, generateRealMockup, handlePublicCheckout, getStepsArray,
      setSimpleStep, setCurrentPlacementIndex, setGraphicSize, setPerPlacementSizes,
      setPlacementGraphicChoice, setIsGeneratingBasicMockup, setIsGeneratingPlusMockup,
      setQrBasicMockup, setQrPlusMockup, setShowCheckoutCard, setGuidedQueue, setPendingPostTypeStep]);

  const handleBack = useCallback(() => {
    if (simpleStep === 'product') return;
    if (showCheckoutCard) { setShowCheckoutCard(false); setGuidedQueue([]); return; }
    if (showMemberPitch) { setShowMemberPitch(false); return; }
    if (simpleStep === 'graphic-size' && currentPlacementIndex > 0) {
      const prevPlacement = selectedPlacements[currentPlacementIndex - 1];
      setCurrentPlacementIndex(prev => prev - 1);
      setGraphicSize((perPlacementSizes[prevPlacement] || '') as GraphicSize);
      return;
    }
    if (simpleStep === 'placement-config' && currentPlacementIndex > 0) {
      setCurrentPlacementIndex(prev => prev - 1);
      setPlacementGraphicChoice('');
      return;
    }
    if (simpleStep === 'qr-basic-type') { setSimpleStep('generate'); setWantsHeaderFooter(null); return; }
    if (simpleStep === 'text-choice') { setSimpleStep('generate'); setWantsHeaderFooter(null); return; }

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
    if (prev) { setSimpleStep(prev); }
  }, [simpleStep, showCheckoutCard, showMemberPitch, currentPlacementIndex,
      selectedPlacements, perPlacementSizes, preSelectedType, textLayoutChoice,
      setSimpleStep, setWantsHeaderFooter, setCurrentPlacementIndex, setGraphicSize,
      setPlacementGraphicChoice, setShowCheckoutCard, setShowMemberPitch, setGuidedQueue]);

  const getTierInfo = useCallback(() => {
    if (['text-choice', 'text-edit-header', 'text-edit-footer', 'placement-config', 'shirt-preview', 'qr-plus-mockup'].includes(simpleStep)) {
      return { label: 'QR Plus', color: 'text-blue-400 bg-blue-500/10 border-blue-500/20' };
    }
    if (['qr-basic-type', 'qr-basic-input', 'qr-basic-mockup'].includes(simpleStep)) {
      return { label: 'QR Basic', color: 'text-slate-300 bg-slate-500/10 border-slate-500/20' };
    }
    return null;
  }, [simpleStep]);

  return { canProceed, isFinalStep, handleNext, handleBack, getTierInfo, getStepsArray };
}
