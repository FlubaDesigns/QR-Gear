import type {
  SimpleWizardStep, QRType, PlacementOption, GraphicSize,
  PlacementGraphicChoice, QRBasicInputType, UrlSourceChoice,
  LibraryChoice, QRBasicSaveOption, QRPlusSaveOption,
  QRCanvasSaveOption, QRPlaySaveOption, PlayVideoSource,
  TextLayoutChoice, WizardStep, AllowedProduct,
} from "@/features/shared/components/wizardSteps";
import {
  SIMPLE_WIZARD_STEPS, QR_BASIC_STEPS, QR_PLUS_STEPS, QR_PLAY_STEPS, QR_COMPOSE_STEPS, WIZARD_STEPS,
  isQRPlusStep, isQRPlayStep,
} from "@/features/shared/components/wizardSteps";
import type { ComposeMode } from "@/features/shared/components/wizardSteps/ComposeSteps";

export function computeCanSimpleProceed(
  simpleStep: SimpleWizardStep,
  state: {
    selectedChannel: { id: string; name: string } | null;
    selectedProductType: AllowedProduct | null;
    selectedColor: string;
    selectedShirtSize: string;
    qrType: QRType;
    graphicSize: string;
    wantsHeaderFooter: boolean | null;
    textLayoutChoice: TextLayoutChoice;
    selectedPlacements: PlacementOption[];
    placementGraphicChoice: PlacementGraphicChoice;
    libraryChoice: LibraryChoice;
    urlGraphic: string;
    simpleTitle: string;
    qrBasicInputType: QRBasicInputType;
    qrBasicContent: string;
    qrBasicSaveChoice: QRBasicSaveOption;
    qrPlusSaveChoice: QRPlusSaveOption;
    canvasSaveChoice: QRCanvasSaveOption;
    playVideoUrl: string;
    isUploadingVideo: boolean;
    composeItems: Array<any>;
    composeMode: ComposeMode | '';
    composeHostingTerm: string;
    isGeneratingComposeMockup: boolean;
    isPublishing: boolean;
  }
): boolean {
  switch (simpleStep) {
    case 'channel': return state.selectedChannel !== null;
    case 'product': return state.selectedProductType !== null;
    case 'product-congrats': return true;
    case 'color': return state.selectedColor !== '';
    case 'size': return state.selectedShirtSize !== '';
    case 'type': return state.qrType !== '';
    case 'graphic-size': return state.graphicSize !== '';
    case 'generate': return state.wantsHeaderFooter !== null;
    case 'text-choice': return state.textLayoutChoice !== '';
    case 'placement-count': return state.selectedPlacements.length > 0;
    case 'text-edit-header': return true;
    case 'text-edit-footer': return true;
    case 'placement-config': return state.placementGraphicChoice !== '';
    case 'shirt-preview': return true;
    case 'url-explainer': return true;
    case 'url-source-choice': return state.libraryChoice !== '';
    case 'url-library-pick': return state.urlGraphic !== '';
    case 'url-title': return state.simpleTitle.trim() !== '';
    case 'url-description': return true;
    case 'url-preview': return true;
    case 'url-publish': return true;
    case 'qr-basic-type': return state.qrBasicInputType !== '';
    case 'qr-basic-input': {
      if (state.qrBasicContent.trim() === '') return false;
      if (state.qrBasicInputType === 'url') {
        try { new URL(state.qrBasicContent); } catch { return false; }
      }
      return true;
    }
    case 'qr-basic-mockup': return true;
    case 'qr-basic-save-choice': return state.qrBasicSaveChoice !== '';
    case 'qr-basic-confirm': return true;
    case 'qr-plus-mockup': return true;
    case 'qr-plus-save-choice': return state.qrPlusSaveChoice !== '';
    case 'qr-plus-confirm': return true;
    case 'canvas-mockup': return true;
    case 'play-mockup': return true;
    case 'canvas-save-choice': return state.canvasSaveChoice !== '';
    case 'canvas-confirm': return true;
    case 'play-video-source': return state.playVideoUrl !== '' && !state.isUploadingVideo;
    case 'play-preview': return true;
    case 'play-publish': return true;
    case 'play-save-choice': return true;
    case 'compose-pick-items': return state.composeItems.length >= 2;
    case 'compose-mode': return state.composeMode !== '';
    case 'compose-durations': return true;
    case 'compose-order': return true;
    case 'compose-hosting': return state.composeHostingTerm !== '';
    case 'compose-mockup': return !state.isGeneratingComposeMockup;
    case 'compose-preview': return true;
    case 'compose-publish': return !state.isPublishing;
    case 'compose-confirm': return true;
    default: return false;
  }
}

export function computeCanProceed(
  currentStep: WizardStep,
  state: {
    selectedChannel: { id: string; name: string } | null;
    selectedProduct: any;
    selectedPlacements: PlacementOption[];
  }
): boolean {
  switch (currentStep) {
    case 'channel': return state.selectedChannel !== null;
    case 'product': return state.selectedProduct !== null;
    case 'placement': return state.selectedPlacements.length > 0;
    case 'header-footer': return true;
    case 'background': return true;
    case 'landing-page': return true;
    case 'preview': return true;
    case 'publish': return true;
    default: return false;
  }
}

export function getSimpleBackStep(
  simpleStep: SimpleWizardStep,
  state: {
    qrType: QRType;
    wantsHeaderFooter: boolean | null;
    textLayoutChoice: TextLayoutChoice;
    currentPlacementIndex: number;
    selectedPlacements: PlacementOption[];
    perPlacementSizes: Record<PlacementOption, GraphicSize>;
    composeMode: ComposeMode | '';
    user: any;
  }
): { step: SimpleWizardStep | null; sideEffects?: Record<string, any> } {
  if (simpleStep === 'compose-explainer' || simpleStep === 'platform-acknowledge') {
    return { step: 'canvas-fork' };
  }
  if (simpleStep === 'qr-basic-type') {
    return { step: 'generate' };
  }
  if (simpleStep === 'qr-basic-input') {
    return { step: 'qr-basic-type' };
  }
  if (simpleStep === 'qr-basic-mockup') {
    return { step: 'qr-basic-input' };
  }
  if (simpleStep === 'qr-basic-save-choice') {
    return { step: 'qr-basic-mockup' };
  }
  if (simpleStep === 'qr-basic-confirm') {
    return { step: 'qr-basic-save-choice' };
  }
  if (simpleStep === 'qr-plus-mockup') {
    return { step: 'canvas-fork' };
  }
  if (simpleStep === 'qr-plus-save-choice') {
    return { step: 'qr-plus-mockup' };
  }
  if (simpleStep === 'qr-plus-confirm') {
    return { step: 'qr-plus-save-choice' };
  }
  if (simpleStep === 'play-video-source') {
    return { step: 'canvas-fork' };
  }
  if (simpleStep === 'play-preview') {
    return { step: 'play-video-source' };
  }
  if (simpleStep === 'play-mockup') {
    return { step: 'play-preview' };
  }
  if (simpleStep === 'play-publish') {
    return { step: state.user?.id ? 'play-mockup' : 'play-preview' };
  }
  if (simpleStep === 'play-save-choice') {
    return { step: null };
  }
  if (simpleStep === 'compose-pick-items') {
    return { step: 'canvas-fork' };
  }
  if (simpleStep === 'compose-mode') {
    return { step: 'compose-pick-items' };
  }
  if (simpleStep === 'compose-durations') {
    return { step: 'compose-mode' };
  }
  if (simpleStep === 'compose-order') {
    if (state.composeMode === 'scan-to-reveal') {
      return { step: 'compose-mode' };
    } else {
      return { step: 'compose-durations' };
    }
  }
  if (simpleStep === 'compose-hosting') {
    return { step: 'compose-order' };
  }
  if (simpleStep === 'compose-mockup') {
    return { step: 'compose-hosting' };
  }
  if (simpleStep === 'compose-preview') {
    return { step: 'compose-mockup' };
  }
  if (simpleStep === 'compose-publish') {
    return { step: 'compose-preview' };
  }
  if (simpleStep === 'compose-confirm') {
    return { step: null };
  }
  if (simpleStep === 'canvas-fork') {
    if (state.wantsHeaderFooter) {
      return { step: 'shirt-preview' };
    } else {
      return { step: 'generate' };
    }
  }
  if (simpleStep === 'canvas-mockup') {
    return { step: 'url-preview' };
  }
  if (simpleStep === 'url-publish') {
    return { step: state.user?.id ? 'canvas-mockup' : 'url-preview' };
  }
  if (simpleStep === 'url-explainer') {
    return { step: 'canvas-fork' };
  }
  if (simpleStep === 'graphic-size' && state.currentPlacementIndex > 0) {
    return {
      step: 'graphic-size',
      sideEffects: {
        decrementPlacementIndex: true,
        restoreGraphicSize: state.perPlacementSizes[state.selectedPlacements[state.currentPlacementIndex - 1]] || '',
      }
    };
  }

  const stepsArray = state.qrType === 'qr-basic' ? QR_BASIC_STEPS
    : state.qrType === 'qr-plus' ? QR_PLUS_STEPS
    : state.qrType === 'qr-play' ? QR_PLAY_STEPS
    : state.qrType === 'qr-compose' ? QR_COMPOSE_STEPS
    : SIMPLE_WIZARD_STEPS;
  const currentIndex = stepsArray.findIndex(s => s.id === simpleStep);
  if (currentIndex > 0) {
    return { step: stepsArray[currentIndex - 1].id };
  }
  return { step: null };
}

export function getPlayDoneResets() {
  return {
    simpleStep: 'channel' as SimpleWizardStep,
    viewMode: 'index' as const,
    currentPacketId: null,
    simpleTitle: '',
    simpleDescription: '',
    qrType: '' as QRType,
    contentRightsConfirmed: false,
    playVideoUrl: '',
    playVideoSource: '' as PlayVideoSource,
    videoUrl: '',
    playSaveChoice: '' as QRPlaySaveOption,
    videoUploadError: null,
    videoUploadProgress: 0,
    videoUploadSuccess: false,
  };
}

export function getCanvasDoneResets() {
  return {
    viewMode: 'index' as const,
    simpleStep: 'channel' as SimpleWizardStep,
    currentPacketId: null,
    simpleTitle: '',
    simpleDescription: '',
    qrType: '' as QRType,
    contentRightsConfirmed: false,
    urlGraphic: '',
    productGraphic: '',
    canvasSaveChoice: '' as QRCanvasSaveOption,
    publishedPacketId: null,
    publishedQrGraphicUrl: null,
    publishedProductGraphicUrl: null,
  };
}

export function getStepsArrayForType(qrType: QRType) {
  if (qrType === 'qr-basic') return QR_BASIC_STEPS;
  if (qrType === 'qr-plus') return QR_PLUS_STEPS;
  if (qrType === 'qr-play') return QR_PLAY_STEPS;
  if (qrType === 'qr-compose') return QR_COMPOSE_STEPS;
  return SIMPLE_WIZARD_STEPS;
}

export { WIZARD_STEPS, SIMPLE_WIZARD_STEPS, QR_BASIC_STEPS, QR_PLUS_STEPS, QR_PLAY_STEPS, QR_COMPOSE_STEPS, isQRPlusStep, isQRPlayStep };
