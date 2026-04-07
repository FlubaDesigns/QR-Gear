import { createContext, useContext, useState, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useMembersContext } from "@/features/members/MembersContext";
import { useMemberAuth } from "@/features/members/MemberAuthContext";
import { type TextStyleConfig, defaultTextStyle } from "@/features/shared/components/TextStyleEditor";
import { type PlacementConfig } from "@/features/shared/components/PlacementPicker";
import { type LandingPageConfig, defaultLandingPage } from "@/features/shared/components/LandingPageEditor";
import {
  type WizardStep, type SimpleWizardStep, type QRBasicSaveOption, type QRPlusSaveOption,
  type QRCanvasSaveOption, type QRPlaySaveOption, type PlayVideoSource, type UrlSourceChoice,
  type LibraryChoice, type PlacementGraphicChoice, type QRBasicInputType, type PlacementOption,
  type QRType, type WizardTier, type TextLayoutChoice,
  type GraphicLocation, type GraphicSize, type ViewMode,
  type AllowedProduct, type ProductItem,
  WIZARD_STEPS,
} from "@/features/shared/components/wizardSteps";
import type { ComposeMode } from "@/features/shared/components/wizardSteps/ComposeSteps";
import type { WizardContextType } from "./wizard-context-types";
import { capabilitiesForTier } from "@/features/shared/builder-capabilities";
import { computeCanSimpleProceed, computeCanProceed } from "./wizard-context-helpers";
import {
  executeGeneratePreviewQrCode,
  executeCreatePacketForProduct,
  executeUpdatePacket,
  executeSimplePublish,
  executeSaveCanvasToLibrary,
  executeVideoFileUpload,
  executeSavePlayToLibrary,
  executeFetchPublishedCanvasPlayItems,
  executeGenerateProductMockup,
  executeHandleProductSelect,
  executeHandlePublish,
} from "./wizard-context-actions";
import { executeSimpleNext, executeSimpleBack } from "./wizard-context-navigation";

export type { WizardContextType };

const WizardContext = createContext<WizardContextType | null>(null);

export function useWizardContext() {
  const ctx = useContext(WizardContext);
  if (!ctx) throw new Error('useWizardContext must be used within WizardProvider');
  return ctx;
}

export function WizardProvider({ children }: { children: React.ReactNode }) {
  const { user: apiUser, firebaseUser, isLoading: authLoading, isAuthenticated } = useAuth();
  const user = useMemo(() => {
    if (apiUser) return apiUser;
    if (firebaseUser) return { id: firebaseUser.uid, email: firebaseUser.email, displayName: firebaseUser.displayName } as any;
    return null;
  }, [apiUser, firebaseUser?.uid]);
  const { toast } = useToast();
  const { api } = useMembersContext();
  const { apiBase, getAuthHeaders: getMemberAuthHeaders } = useMemberAuth();

  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('wizard') ? 'wizard' : 'index';
  });
  const [currentStep, setCurrentStep] = useState<WizardStep>('channel');
  const [simpleStep, setSimpleStep] = useState<SimpleWizardStep>('channel');
  const [completedSteps, setCompletedSteps] = useState<Set<WizardStep>>(new Set());
  const [wizardTier, setWizardTier] = useState<WizardTier>(() => {
    const params = new URLSearchParams(window.location.search);
    const w = params.get('wizard');
    if (w === 'super-simple' || w === 'simple' || w === 'advanced' || w === 'studio') return w;
    return 'simple';
  });
  const [publishCount, setPublishCount] = useState(0);
  const [showUnlockPrompt, setShowUnlockPrompt] = useState<'advanced' | 'studio' | null>(null);
  const [selectedChannel, setSelectedChannel] = useState<{ id: string; name: string } | null>(null);
  const [isCreatingChannel, setIsCreatingChannel] = useState(false);
  const [newChannelName, setNewChannelName] = useState('');

  const [simpleTitle, setSimpleTitle] = useState('');
  const [simpleDescription, setSimpleDescription] = useState('');
  const [titleVertical, setTitleVertical] = useState(30);
  const [titleHorizontal, setTitleHorizontal] = useState(50);
  const [titleColor, setTitleColor] = useState('#ffffff');
  const [titleSize, setTitleSize] = useState('18px');
  const [titleFont, setTitleFont] = useState('Arial');
  const [descVertical, setDescVertical] = useState(20);
  const [descHorizontal, setDescHorizontal] = useState(50);
  const [descColor, setDescColor] = useState('#e2e8f0');
  const [descSize, setDescSize] = useState('14px');
  const [descFont, setDescFont] = useState('Arial');

  const [selectedProductType, setSelectedProductType] = useState<AllowedProduct | null>(null);
  const [selectedColor, setSelectedColor] = useState<string>('');
  const [selectedShirtSize, setSelectedShirtSize] = useState<string>('');
  const [graphicLocation, setGraphicLocation] = useState<GraphicLocation>('');
  const [graphicSize, setGraphicSize] = useState<GraphicSize>('');
  const [wantsHeaderFooter, setWantsHeaderFooter] = useState<boolean | null>(null);

  const [currentPacketId, setCurrentPacketId] = useState<string | null>(null);
  const [runningEarnings, setRunningEarnings] = useState<number>(0);
  const [earningsPulse, setEarningsPulse] = useState(false);

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

  const placementEarningsBonus = (pricingSettings?.additionalPlacementCost || 4) * (pricingSettings?.memberProfitShare || 0.25);
  const textLineEarningsBonus = (pricingSettings?.textLineUpcharge || 2) * (pricingSettings?.memberProfitShare || 0.25);
  const sizeEarningsIncrement = (pricingSettings?.sizeUpcharges?.['M'] || 2) * (pricingSettings?.memberProfitShare || 0.25);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  }, [simpleStep]);

  useEffect(() => {
    if (user?.id) {
      const count = parseInt(localStorage.getItem(`publish_count_${user.id}`) || '0', 10);
      setPublishCount(count);
      if (count === 0) {
        setWizardTier('simple');
      }
    }
  }, [user?.id]);

  const incrementPublishCount = () => {
    if (user?.id) {
      const newCount = publishCount + 1;
      localStorage.setItem(`publish_count_${user.id}`, String(newCount));
      setPublishCount(newCount);

      if (newCount === 1) {
        setShowUnlockPrompt('advanced');
      } else if (newCount === 2) {
        setShowUnlockPrompt('studio');
      }
    }
  };

  const unlockedTiers = {
    simple: true,
    advanced: publishCount >= 1,
    studio: publishCount >= 2
  };

  const capabilities = useMemo(() => capabilitiesForTier(wizardTier), [wizardTier]);

  const [selectedProduct, setSelectedProduct] = useState<ProductItem | null>(null);
  const [placementConfigs, setPlacementConfigs] = useState<Record<string, PlacementConfig>>({});
  const [qrType, setQrType] = useState<QRType>('');
  const [qrPositionX, setQrPositionX] = useState<number>(50);
  const [qrPositionY, setQrPositionY] = useState<number>(0);
  const [qrSizePercent, setQrSizePercent] = useState<number>(42);
  const [areaImageUrl, setAreaImageUrl] = useState<string>('');
  const [areaImageMode, setAreaImageMode] = useState<"replace-qr" | "behind-qr">("behind-qr");
  const [qrDestination, setQrDestination] = useState<string>('');
  const [channelName, setChannelName] = useState<string>('My Products');
  const [isPublishing, setIsPublishing] = useState(false);
  const [pendingVideoFile, setPendingVideoFile] = useState<File | null>(null);
  const [showSignInToPublish, setShowSignInToPublish] = useState(false);

  const [headerStyle, setHeaderStyle] = useState<TextStyleConfig>({ ...defaultTextStyle });
  const [footerStyle, setFooterStyle] = useState<TextStyleConfig>({ ...defaultTextStyle });
  const [productGraphic, setProductGraphic] = useState<string>('');
  const [originalUrlGraphic, setOriginalUrlGraphic] = useState<string>('');
  const [urlGraphic, setUrlGraphic] = useState<string>('');
  const [showBackgroundLibrary, setShowBackgroundLibrary] = useState(false);
  const [landingPage, setLandingPage] = useState<LandingPageConfig>({ ...defaultLandingPage });
  const [videoUrl, setVideoUrl] = useState<string>('');

  const [textLayoutChoice, setTextLayoutChoice] = useState<TextLayoutChoice>('');
  const [selectedPlacements, setSelectedPlacements] = useState<PlacementOption[]>([]);
  const [wantsText, setWantsText] = useState<boolean | null>(null);
  const [qrGraphic, setQrGraphic] = useState<string>('');
  const [isGeneratingQr, setIsGeneratingQr] = useState(false);
  const [urlSourceChoice, setUrlSourceChoice] = useState<UrlSourceChoice>('');
  const [libraryChoice, setLibraryChoice] = useState<LibraryChoice>('');

  const [currentPlacementIndex, setCurrentPlacementIndex] = useState<number>(0);
  const [placementGraphicChoice, setPlacementGraphicChoice] = useState<PlacementGraphicChoice>('');
  const [placementSize, setPlacementSize] = useState<GraphicSize>('');
  const [perPlacementConfigs, setPerPlacementConfigs] = useState<Record<PlacementOption, {
    graphicChoice: PlacementGraphicChoice;
    size: GraphicSize;
  }>>({} as any);
  const [perPlacementSizes, setPerPlacementSizes] = useState<Record<PlacementOption, GraphicSize>>({} as any);

  const [qrBasicInputType, setQrBasicInputType] = useState<QRBasicInputType>('');
  const [qrBasicContent, setQrBasicContent] = useState<string>('');
  const [qrBasicMockup, setQrBasicMockup] = useState<string>('');
  const [isGeneratingBasicMockup, setIsGeneratingBasicMockup] = useState(false);
  const [qrBasicSaveChoice, setQrBasicSaveChoice] = useState<QRBasicSaveOption>('');
  const [isQrBasicSaving, setIsQrBasicSaving] = useState(false);

  const [canvasSaveChoice, setCanvasSaveChoice] = useState<QRCanvasSaveOption>('');
  const [isCanvasSaving, setIsCanvasSaving] = useState(false);
  const [publishedPacketId, setPublishedPacketId] = useState<string | null>(null);
  const [publishedQrGraphicUrl, setPublishedQrGraphicUrl] = useState<string | null>(null);
  const [publishedProductGraphicUrl, setPublishedProductGraphicUrl] = useState<string | null>(null);

  const [playVideoSource, setPlayVideoSource] = useState<PlayVideoSource>('');
  const [playVideoUrl, setPlayVideoUrl] = useState<string>('');
  const [isUploadingVideo, setIsUploadingVideo] = useState(false);
  const [videoUploadError, setVideoUploadError] = useState<string | null>(null);
  const [videoUploadProgress, setVideoUploadProgress] = useState<number>(0);
  const [videoUploadSuccess, setVideoUploadSuccess] = useState(false);
  const [playSaveChoice, setPlaySaveChoice] = useState<QRPlaySaveOption>('');
  const [isPlaySaving, setIsPlaySaving] = useState(false);

  const [qrPlusMockup, setQrPlusMockup] = useState<string>('');
  const [isGeneratingPlusMockup, setIsGeneratingPlusMockup] = useState(false);
  const [qrPlusSaveChoice, setQrPlusSaveChoice] = useState<QRPlusSaveOption>('');
  const [isQrPlusSaving, setIsQrPlusSaving] = useState(false);

  const [qrCanvasMockup, setQrCanvasMockup] = useState<string>('');
  const [isGeneratingCanvasMockup, setIsGeneratingCanvasMockup] = useState(false);

  const [qrPlayMockup, setQrPlayMockup] = useState<string>('');
  const [isGeneratingPlayMockup, setIsGeneratingPlayMockup] = useState(false);

  const [composeItems, setComposeItems] = useState<Array<{
    packetId: string;
    name: string;
    thumbnailUrl: string;
    type: 'qr-canvas' | 'qr-play';
    durationSeconds: number;
    order: number;
  }>>([]);
  const [composeMode, setComposeMode] = useState<ComposeMode | ''>('');
  const [composeHostingTerm, setComposeHostingTerm] = useState<'1-year' | '3-year' | '5-year' | ''>('');
  const [composeMockup, setComposeMockup] = useState<string>('');
  const [isGeneratingComposeMockup, setIsGeneratingComposeMockup] = useState(false);
  const [publishedCanvasPlayItems, setPublishedCanvasPlayItems] = useState<any[]>([]);
  const [isLoadingPublishedItems, setIsLoadingPublishedItems] = useState(false);
  const [composeInstanceId, setComposeInstanceId] = useState<string | null>(null);
  const [contentRightsConfirmed, setContentRightsConfirmed] = useState(false);

  const currentPlacement = selectedPlacements[currentPlacementIndex] || 'front' as PlacementOption;

  const actionCtx = {
    user, toast, api, apiBase, getMemberAuthHeaders, incrementPublishCount, pricingSettings,
    selectedChannel, selectedProductType, selectedColor, selectedShirtSize, selectedPlacements,
    perPlacementConfigs, perPlacementSizes, graphicSize, textLayoutChoice, headerStyle, footerStyle,
    qrType, qrDestination, qrGraphic, productGraphic, urlGraphic, originalUrlGraphic, videoUrl,
    playVideoUrl, qrBasicInputType, qrBasicContent, qrBasicMockup, qrBasicSaveChoice,
    qrPlusMockup, qrPlusSaveChoice, qrCanvasMockup, qrPlayMockup, composeMockup, composeItems,
    composeMode, composeHostingTerm, qrPositionX, qrPositionY, qrSizePercent, areaImageUrl,
    areaImageMode, runningEarnings, currentPacketId, simpleTitle, simpleDescription, pendingVideoFile,
    canvasSaveChoice, publishedProductGraphicUrl, publishedQrGraphicUrl, playSaveChoice,
    selectedProduct, landingPage, currentPlacement, currentPlacementIndex, wantsHeaderFooter,
    placementGraphicChoice, placementSize, isPublishing, simpleStep,
    setIsPublishing, setShowSignInToPublish, setSelectedChannel, setPlayVideoUrl, setPendingVideoFile,
    setPublishedPacketId, setCurrentPacketId, setComposeInstanceId, setSimpleStep, setViewMode,
    setPublishedQrGraphicUrl, setPublishedProductGraphicUrl, setSimpleTitle, setSimpleDescription,
    setQrType, setContentRightsConfirmed, setUrlGraphic, setProductGraphic, setQrGraphic,
    setIsCanvasSaving, setIsPlaySaving, setIsLoadingPublishedItems, setPublishedCanvasPlayItems,
    setSelectedProductType, setVideoUploadError, setVideoUploadSuccess, setIsUploadingVideo,
    setVideoUploadProgress, setVideoUrl, setIsGeneratingBasicMockup, setQrBasicMockup,
    setIsGeneratingPlayMockup, setQrPlayMockup, setIsGeneratingCanvasMockup, setQrCanvasMockup,
    setIsGeneratingComposeMockup, setComposeMockup, setRunningEarnings, setCurrentPlacementIndex,
    setGraphicSize, setPerPlacementSizes, setPlacementGraphicChoice, setPlacementSize,
    setPerPlacementConfigs, setCompletedSteps, setQrBasicInputType, setQrBasicContent,
    setQrBasicSaveChoice, setQrPlusMockup, setQrPlusSaveChoice,
    setComposeItems, setComposeMode, setComposeHostingTerm,
  };

  const generatePreviewQrCode = async () => {
    return executeGeneratePreviewQrCode(actionCtx);
  };

  const createPacketForProduct = async (product: AllowedProduct) => {
    return executeCreatePacketForProduct(actionCtx, product);
  };

  const updatePacket = async (updates: Record<string, any>) => {
    return executeUpdatePacket(actionCtx, updates);
  };

  const handleSimplePublish = async () => {
    return executeSimplePublish(actionCtx);
  };

  const saveCanvasToLibrary = async () => {
    return executeSaveCanvasToLibrary(actionCtx);
  };

  const handleVideoFileUpload = async (file: File) => {
    return executeVideoFileUpload(actionCtx, file);
  };

  const savePlayToLibrary = async () => {
    return executeSavePlayToLibrary(actionCtx);
  };

  const fetchPublishedCanvasPlayItems = async () => {
    return executeFetchPublishedCanvasPlayItems(actionCtx);
  };

  const generateProductMockupForType = async (type: string, setMockup: (url: string) => void) => {
    return executeGenerateProductMockup(actionCtx, type, setMockup);
  };

  const handleProductSelect = async (product: AllowedProduct) => {
    return executeHandleProductSelect(actionCtx, product);
  };

  const saveQrBasicToPacket = async () => {
    if (!user?.id) return false;
    setIsQrBasicSaving(true);
    try {
      await handleSimplePublish();
      return true;
    } finally {
      setIsQrBasicSaving(false);
    }
  };

  const saveQrPlusToPacket = async () => {
    if (!user?.id) {
      console.error('[QR Plus Save] Missing user');
      return false;
    }
    setIsQrPlusSaving(true);
    try {
      await handleSimplePublish();
      return true;
    } finally {
      setIsQrPlusSaving(false);
    }
  };

  const handlePlayDone = () => {
    setSimpleStep('channel');
    setViewMode('index');
    setCurrentPacketId(null);
    setSimpleTitle('');
    setSimpleDescription('');
    setQrType('');
    setContentRightsConfirmed(false);
    setPlayVideoUrl('');
    setPlayVideoSource('');
    setVideoUrl('');
    setPlaySaveChoice('');
    setVideoUploadError(null);
    setVideoUploadProgress(0);
    setVideoUploadSuccess(false);
  };

  const handleCanvasDone = () => {
    setViewMode('index');
    setSimpleStep('channel');
    setCurrentPacketId(null);
    setSimpleTitle('');
    setSimpleDescription('');
    setQrType('');
    setContentRightsConfirmed(false);
    setUrlGraphic('');
    setProductGraphic('');
    setCanvasSaveChoice('');
    setPublishedPacketId(null);
    setPublishedQrGraphicUrl(null);
    setPublishedProductGraphicUrl(null);
  };

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
    const el = document.getElementById('wizard-step-content');
    if (el) el.scrollTop = 0;
    const card = el?.closest('.overflow-auto, .overflow-y-auto, .overflow-scroll');
    if (card) card.scrollTop = 0;
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  }, [simpleStep]);

  useEffect(() => {
    if (simpleStep === 'canvas-fork' && user?.id) {
      fetchPublishedCanvasPlayItems();
    }
  }, [simpleStep, user?.id]);

  const navCtx = {
    ...actionCtx,
    saveQrBasicToPacket,
    saveQrPlusToPacket,
    handleSimplePublish,
    saveCanvasToLibrary,
    handlePlayDone,
    handleCanvasDone,
    generateProductMockupForType,
    fetchPublishedCanvasPlayItems,
    updatePacket,
  };

  const handleSimpleNext = async () => {
    return executeSimpleNext(navCtx);
  };

  const handleSimpleBack = () => {
    return executeSimpleBack(navCtx);
  };

  const canSimpleProceed = () => {
    return computeCanSimpleProceed(simpleStep, {
      selectedChannel, selectedProductType, selectedColor, selectedShirtSize,
      qrType, graphicSize, wantsHeaderFooter, textLayoutChoice, selectedPlacements,
      placementGraphicChoice, libraryChoice, urlGraphic, simpleTitle,
      qrBasicInputType, qrBasicContent, qrBasicSaveChoice, qrPlusSaveChoice,
      canvasSaveChoice, playVideoUrl, isUploadingVideo, composeItems,
      composeMode, composeHostingTerm, isGeneratingComposeMockup, isPublishing,
    });
  };

  const handleStepClick = (step: WizardStep) => {
    const stepIndex = WIZARD_STEPS.findIndex(s => s.id === step);
    const currentIndex = WIZARD_STEPS.findIndex(s => s.id === currentStep);
    if (stepIndex <= currentIndex || completedSteps.has(step)) {
      setCurrentStep(step);
    }
  };

  const handleNext = () => {
    const currentIndex = WIZARD_STEPS.findIndex(s => s.id === currentStep);
    if (currentIndex < WIZARD_STEPS.length - 1) {
      setCompletedSteps(prev => new Set([...Array.from(prev), currentStep]));
      setCurrentStep(WIZARD_STEPS[currentIndex + 1].id);
    }
  };

  const handleBack = () => {
    const currentIndex = WIZARD_STEPS.findIndex(s => s.id === currentStep);
    if (currentIndex > 0) {
      setCurrentStep(WIZARD_STEPS[currentIndex - 1].id);
    }
  };

  const handlePublish = async () => {
    return executeHandlePublish({
      ...actionCtx,
      setCompletedSteps,
    });
  };

  const canProceed = () => {
    return computeCanProceed(currentStep, {
      selectedChannel, selectedProduct, selectedPlacements,
    });
  };

  const value: WizardContextType = {
    capabilities,
    user, authLoading, isAuthenticated, api,
    viewMode, setViewMode, currentStep, setCurrentStep,
    simpleStep, setSimpleStep, completedSteps, setCompletedSteps,
    wizardTier, setWizardTier, publishCount, setPublishCount,
    showUnlockPrompt, setShowUnlockPrompt,
    selectedChannel, setSelectedChannel,
    isCreatingChannel, setIsCreatingChannel,
    newChannelName, setNewChannelName,
    simpleTitle, setSimpleTitle, simpleDescription, setSimpleDescription,
    titleVertical, setTitleVertical, titleHorizontal, setTitleHorizontal,
    titleColor, setTitleColor, titleSize, setTitleSize, titleFont, setTitleFont,
    descVertical, setDescVertical, descHorizontal, setDescHorizontal,
    descColor, setDescColor, descSize, setDescSize, descFont, setDescFont,
    selectedProductType, setSelectedProductType,
    selectedColor, setSelectedColor, selectedShirtSize, setSelectedShirtSize,
    graphicLocation, setGraphicLocation, graphicSize, setGraphicSize,
    wantsHeaderFooter, setWantsHeaderFooter,
    currentPacketId, setCurrentPacketId,
    runningEarnings, setRunningEarnings, earningsPulse, setEarningsPulse,
    selectedProduct, setSelectedProduct, placementConfigs, setPlacementConfigs,
    qrType, setQrType, qrPositionX, setQrPositionX, qrPositionY, setQrPositionY,
    qrSizePercent, setQrSizePercent, areaImageUrl, setAreaImageUrl,
    areaImageMode, setAreaImageMode, qrDestination, setQrDestination,
    channelName, setChannelName, isPublishing, setIsPublishing,
    headerStyle, setHeaderStyle, footerStyle, setFooterStyle,
    productGraphic, setProductGraphic, originalUrlGraphic, setOriginalUrlGraphic,
    urlGraphic, setUrlGraphic, showBackgroundLibrary, setShowBackgroundLibrary,
    landingPage, setLandingPage, videoUrl, setVideoUrl,
    textLayoutChoice, setTextLayoutChoice,
    selectedPlacements, setSelectedPlacements,
    wantsText, setWantsText, qrGraphic, setQrGraphic,
    isGeneratingQr, setIsGeneratingQr,
    urlSourceChoice, setUrlSourceChoice, libraryChoice, setLibraryChoice,
    currentPlacementIndex, setCurrentPlacementIndex,
    placementGraphicChoice, setPlacementGraphicChoice,
    placementSize, setPlacementSize,
    perPlacementConfigs, setPerPlacementConfigs,
    perPlacementSizes, setPerPlacementSizes,
    qrBasicInputType, setQrBasicInputType,
    qrBasicContent, setQrBasicContent, qrBasicMockup, setQrBasicMockup,
    isGeneratingBasicMockup, setIsGeneratingBasicMockup,
    qrBasicSaveChoice, setQrBasicSaveChoice, isQrBasicSaving, setIsQrBasicSaving,
    canvasSaveChoice, setCanvasSaveChoice, isCanvasSaving, setIsCanvasSaving,
    publishedPacketId, setPublishedPacketId,
    publishedQrGraphicUrl, setPublishedQrGraphicUrl,
    publishedProductGraphicUrl, setPublishedProductGraphicUrl,
    playVideoSource, setPlayVideoSource, playVideoUrl, setPlayVideoUrl,
    isUploadingVideo, setIsUploadingVideo,
    videoUploadError, setVideoUploadError,
    videoUploadProgress, setVideoUploadProgress,
    videoUploadSuccess, setVideoUploadSuccess,
    playSaveChoice, setPlaySaveChoice, isPlaySaving, setIsPlaySaving,
    qrPlusMockup, setQrPlusMockup,
    isGeneratingPlusMockup, setIsGeneratingPlusMockup,
    qrPlusSaveChoice, setQrPlusSaveChoice, isQrPlusSaving, setIsQrPlusSaving,
    qrCanvasMockup, setQrCanvasMockup,
    isGeneratingCanvasMockup, setIsGeneratingCanvasMockup,
    qrPlayMockup, setQrPlayMockup,
    isGeneratingPlayMockup, setIsGeneratingPlayMockup,
    composeItems, setComposeItems, composeMode, setComposeMode,
    composeHostingTerm, setComposeHostingTerm,
    composeMockup, setComposeMockup,
    isGeneratingComposeMockup, setIsGeneratingComposeMockup,
    publishedCanvasPlayItems, setPublishedCanvasPlayItems,
    isLoadingPublishedItems, setIsLoadingPublishedItems,
    composeInstanceId, setComposeInstanceId,
    contentRightsConfirmed, setContentRightsConfirmed,
    currentPlacement,
    pricingSettings, placementEarningsBonus, textLineEarningsBonus, sizeEarningsIncrement,
    unlockedTiers, incrementPublishCount,
    generatePreviewQrCode, createPacketForProduct, updatePacket,
    saveQrBasicToPacket, saveQrPlusToPacket, saveCanvasToLibrary,
    handleVideoFileUpload, savePlayToLibrary, fetchPublishedCanvasPlayItems,
    handlePlayDone, handleCanvasDone, handleProductSelect,
    generateProductMockupForType, handleSimplePublish,
    pendingVideoFile, setPendingVideoFile,
    showSignInToPublish, setShowSignInToPublish,
    handleSimpleNext, handleSimpleBack, canSimpleProceed,
    handleStepClick, handleNext, handleBack, handlePublish, canProceed,
  };

  return <WizardContext.Provider value={value}>{children}</WizardContext.Provider>;
}
