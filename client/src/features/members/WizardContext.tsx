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
  SIMPLE_WIZARD_STEPS, QR_BASIC_STEPS, QR_PLUS_STEPS, QR_PLAY_STEPS, QR_COMPOSE_STEPS, WIZARD_STEPS,
  isQRBasicStep, isQRPlusStep, isQRPlayStep, isQRComposeStep,
  generateQRCodeUrl,
  getDefaultPacketTitle,
  getDefaultPacketDescription,
} from "@/features/shared/components/wizardSteps";
import type { ComposeMode } from "@/features/shared/components/wizardSteps/ComposeSteps";

export interface WizardContextType {
  user: any;
  authLoading: boolean;
  isAuthenticated: boolean;
  api: ReturnType<typeof useMembersContext>['api'];

  viewMode: ViewMode;
  setViewMode: React.Dispatch<React.SetStateAction<ViewMode>>;
  currentStep: WizardStep;
  setCurrentStep: React.Dispatch<React.SetStateAction<WizardStep>>;
  simpleStep: SimpleWizardStep;
  setSimpleStep: React.Dispatch<React.SetStateAction<SimpleWizardStep>>;
  completedSteps: Set<WizardStep>;
  setCompletedSteps: React.Dispatch<React.SetStateAction<Set<WizardStep>>>;
  wizardTier: WizardTier;
  setWizardTier: React.Dispatch<React.SetStateAction<WizardTier>>;
  publishCount: number;
  setPublishCount: React.Dispatch<React.SetStateAction<number>>;
  showUnlockPrompt: 'advanced' | 'studio' | null;
  setShowUnlockPrompt: React.Dispatch<React.SetStateAction<'advanced' | 'studio' | null>>;
  selectedChannel: { id: string; name: string } | null;
  setSelectedChannel: React.Dispatch<React.SetStateAction<{ id: string; name: string } | null>>;
  isCreatingChannel: boolean;
  setIsCreatingChannel: React.Dispatch<React.SetStateAction<boolean>>;
  newChannelName: string;
  setNewChannelName: React.Dispatch<React.SetStateAction<string>>;

  simpleTitle: string;
  setSimpleTitle: React.Dispatch<React.SetStateAction<string>>;
  simpleDescription: string;
  setSimpleDescription: React.Dispatch<React.SetStateAction<string>>;
  titleVertical: number;
  setTitleVertical: React.Dispatch<React.SetStateAction<number>>;
  titleHorizontal: number;
  setTitleHorizontal: React.Dispatch<React.SetStateAction<number>>;
  titleColor: string;
  setTitleColor: React.Dispatch<React.SetStateAction<string>>;
  titleSize: string;
  setTitleSize: React.Dispatch<React.SetStateAction<string>>;
  titleFont: string;
  setTitleFont: React.Dispatch<React.SetStateAction<string>>;
  descVertical: number;
  setDescVertical: React.Dispatch<React.SetStateAction<number>>;
  descHorizontal: number;
  setDescHorizontal: React.Dispatch<React.SetStateAction<number>>;
  descColor: string;
  setDescColor: React.Dispatch<React.SetStateAction<string>>;
  descSize: string;
  setDescSize: React.Dispatch<React.SetStateAction<string>>;
  descFont: string;
  setDescFont: React.Dispatch<React.SetStateAction<string>>;

  selectedProductType: AllowedProduct | null;
  setSelectedProductType: React.Dispatch<React.SetStateAction<AllowedProduct | null>>;
  selectedColor: string;
  setSelectedColor: React.Dispatch<React.SetStateAction<string>>;
  selectedShirtSize: string;
  setSelectedShirtSize: React.Dispatch<React.SetStateAction<string>>;
  graphicLocation: GraphicLocation;
  setGraphicLocation: React.Dispatch<React.SetStateAction<GraphicLocation>>;
  graphicSize: GraphicSize;
  setGraphicSize: React.Dispatch<React.SetStateAction<GraphicSize>>;
  wantsHeaderFooter: boolean | null;
  setWantsHeaderFooter: React.Dispatch<React.SetStateAction<boolean | null>>;

  currentPacketId: string | null;
  setCurrentPacketId: React.Dispatch<React.SetStateAction<string | null>>;
  runningEarnings: number;
  setRunningEarnings: React.Dispatch<React.SetStateAction<number>>;
  earningsPulse: boolean;
  setEarningsPulse: React.Dispatch<React.SetStateAction<boolean>>;

  selectedProduct: ProductItem | null;
  setSelectedProduct: React.Dispatch<React.SetStateAction<ProductItem | null>>;
  placementConfigs: Record<string, PlacementConfig>;
  setPlacementConfigs: React.Dispatch<React.SetStateAction<Record<string, PlacementConfig>>>;
  qrType: QRType;
  setQrType: React.Dispatch<React.SetStateAction<QRType>>;
  qrDestination: string;
  setQrDestination: React.Dispatch<React.SetStateAction<string>>;
  channelName: string;
  setChannelName: React.Dispatch<React.SetStateAction<string>>;
  isPublishing: boolean;
  setIsPublishing: React.Dispatch<React.SetStateAction<boolean>>;

  headerStyle: TextStyleConfig;
  setHeaderStyle: React.Dispatch<React.SetStateAction<TextStyleConfig>>;
  footerStyle: TextStyleConfig;
  setFooterStyle: React.Dispatch<React.SetStateAction<TextStyleConfig>>;
  productGraphic: string;
  setProductGraphic: React.Dispatch<React.SetStateAction<string>>;
  originalUrlGraphic: string;
  setOriginalUrlGraphic: React.Dispatch<React.SetStateAction<string>>;
  urlGraphic: string;
  setUrlGraphic: React.Dispatch<React.SetStateAction<string>>;
  showBackgroundLibrary: boolean;
  setShowBackgroundLibrary: React.Dispatch<React.SetStateAction<boolean>>;
  landingPage: LandingPageConfig;
  setLandingPage: React.Dispatch<React.SetStateAction<LandingPageConfig>>;
  videoUrl: string;
  setVideoUrl: React.Dispatch<React.SetStateAction<string>>;

  textLayoutChoice: TextLayoutChoice;
  setTextLayoutChoice: React.Dispatch<React.SetStateAction<TextLayoutChoice>>;
  selectedPlacements: PlacementOption[];
  setSelectedPlacements: React.Dispatch<React.SetStateAction<PlacementOption[]>>;
  wantsText: boolean | null;
  setWantsText: React.Dispatch<React.SetStateAction<boolean | null>>;
  qrGraphic: string;
  setQrGraphic: React.Dispatch<React.SetStateAction<string>>;
  isGeneratingQr: boolean;
  setIsGeneratingQr: React.Dispatch<React.SetStateAction<boolean>>;
  urlSourceChoice: UrlSourceChoice;
  setUrlSourceChoice: React.Dispatch<React.SetStateAction<UrlSourceChoice>>;
  libraryChoice: LibraryChoice;
  setLibraryChoice: React.Dispatch<React.SetStateAction<LibraryChoice>>;

  currentPlacementIndex: number;
  setCurrentPlacementIndex: React.Dispatch<React.SetStateAction<number>>;
  placementGraphicChoice: PlacementGraphicChoice;
  setPlacementGraphicChoice: React.Dispatch<React.SetStateAction<PlacementGraphicChoice>>;
  placementSize: GraphicSize;
  setPlacementSize: React.Dispatch<React.SetStateAction<GraphicSize>>;
  perPlacementConfigs: Record<PlacementOption, { graphicChoice: PlacementGraphicChoice; size: GraphicSize }>;
  setPerPlacementConfigs: React.Dispatch<React.SetStateAction<Record<PlacementOption, { graphicChoice: PlacementGraphicChoice; size: GraphicSize }>>>;
  perPlacementSizes: Record<PlacementOption, GraphicSize>;
  setPerPlacementSizes: React.Dispatch<React.SetStateAction<Record<PlacementOption, GraphicSize>>>;

  qrBasicInputType: QRBasicInputType;
  setQrBasicInputType: React.Dispatch<React.SetStateAction<QRBasicInputType>>;
  qrBasicContent: string;
  setQrBasicContent: React.Dispatch<React.SetStateAction<string>>;
  qrBasicMockup: string;
  setQrBasicMockup: React.Dispatch<React.SetStateAction<string>>;
  isGeneratingBasicMockup: boolean;
  setIsGeneratingBasicMockup: React.Dispatch<React.SetStateAction<boolean>>;
  qrBasicSaveChoice: QRBasicSaveOption;
  setQrBasicSaveChoice: React.Dispatch<React.SetStateAction<QRBasicSaveOption>>;
  isQrBasicSaving: boolean;
  setIsQrBasicSaving: React.Dispatch<React.SetStateAction<boolean>>;

  canvasSaveChoice: QRCanvasSaveOption;
  setCanvasSaveChoice: React.Dispatch<React.SetStateAction<QRCanvasSaveOption>>;
  isCanvasSaving: boolean;
  setIsCanvasSaving: React.Dispatch<React.SetStateAction<boolean>>;
  publishedPacketId: string | null;
  setPublishedPacketId: React.Dispatch<React.SetStateAction<string | null>>;
  publishedQrGraphicUrl: string | null;
  setPublishedQrGraphicUrl: React.Dispatch<React.SetStateAction<string | null>>;
  publishedProductGraphicUrl: string | null;
  setPublishedProductGraphicUrl: React.Dispatch<React.SetStateAction<string | null>>;

  playVideoSource: PlayVideoSource;
  setPlayVideoSource: React.Dispatch<React.SetStateAction<PlayVideoSource>>;
  playVideoUrl: string;
  setPlayVideoUrl: React.Dispatch<React.SetStateAction<string>>;
  isUploadingVideo: boolean;
  setIsUploadingVideo: React.Dispatch<React.SetStateAction<boolean>>;
  videoUploadError: string | null;
  setVideoUploadError: React.Dispatch<React.SetStateAction<string | null>>;
  videoUploadProgress: number;
  setVideoUploadProgress: React.Dispatch<React.SetStateAction<number>>;
  videoUploadSuccess: boolean;
  setVideoUploadSuccess: React.Dispatch<React.SetStateAction<boolean>>;
  playSaveChoice: QRPlaySaveOption;
  setPlaySaveChoice: React.Dispatch<React.SetStateAction<QRPlaySaveOption>>;
  isPlaySaving: boolean;
  setIsPlaySaving: React.Dispatch<React.SetStateAction<boolean>>;

  qrPlusMockup: string;
  setQrPlusMockup: React.Dispatch<React.SetStateAction<string>>;
  isGeneratingPlusMockup: boolean;
  setIsGeneratingPlusMockup: React.Dispatch<React.SetStateAction<boolean>>;
  qrPlusSaveChoice: QRPlusSaveOption;
  setQrPlusSaveChoice: React.Dispatch<React.SetStateAction<QRPlusSaveOption>>;
  isQrPlusSaving: boolean;
  setIsQrPlusSaving: React.Dispatch<React.SetStateAction<boolean>>;

  qrCanvasMockup: string;
  setQrCanvasMockup: React.Dispatch<React.SetStateAction<string>>;
  isGeneratingCanvasMockup: boolean;
  setIsGeneratingCanvasMockup: React.Dispatch<React.SetStateAction<boolean>>;

  qrPlayMockup: string;
  setQrPlayMockup: React.Dispatch<React.SetStateAction<string>>;
  isGeneratingPlayMockup: boolean;
  setIsGeneratingPlayMockup: React.Dispatch<React.SetStateAction<boolean>>;

  composeItems: Array<{
    packetId: string;
    name: string;
    thumbnailUrl: string;
    type: 'qr-canvas' | 'qr-play';
    durationSeconds: number;
    order: number;
  }>;
  setComposeItems: React.Dispatch<React.SetStateAction<Array<{
    packetId: string;
    name: string;
    thumbnailUrl: string;
    type: 'qr-canvas' | 'qr-play';
    durationSeconds: number;
    order: number;
  }>>>;
  composeMode: ComposeMode | '';
  setComposeMode: React.Dispatch<React.SetStateAction<ComposeMode | ''>>;
  composeHostingTerm: '1-year' | '3-year' | '5-year' | '';
  setComposeHostingTerm: React.Dispatch<React.SetStateAction<'1-year' | '3-year' | '5-year' | ''>>;
  composeMockup: string;
  setComposeMockup: React.Dispatch<React.SetStateAction<string>>;
  isGeneratingComposeMockup: boolean;
  setIsGeneratingComposeMockup: React.Dispatch<React.SetStateAction<boolean>>;
  publishedCanvasPlayItems: any[];
  setPublishedCanvasPlayItems: React.Dispatch<React.SetStateAction<any[]>>;
  isLoadingPublishedItems: boolean;
  setIsLoadingPublishedItems: React.Dispatch<React.SetStateAction<boolean>>;
  composeInstanceId: string | null;
  setComposeInstanceId: React.Dispatch<React.SetStateAction<string | null>>;

  currentPlacement: PlacementOption;

  pricingSettings: {
    memberProfitShare: number;
    additionalPlacementCost: number;
    textLineUpcharge: number;
    sizeUpcharges: Record<string, number>;
    baseRetailPrice: number;
  } | undefined;
  placementEarningsBonus: number;
  textLineEarningsBonus: number;
  sizeEarningsIncrement: number;

  unlockedTiers: { simple: boolean; advanced: boolean; studio: boolean };
  incrementPublishCount: () => void;

  generatePreviewQrCode: () => Promise<string>;
  createPacketForProduct: (product: AllowedProduct) => Promise<string | null>;
  updatePacket: (updates: Record<string, any>) => Promise<boolean>;
  saveQrBasicToPacket: () => Promise<boolean>;
  saveQrPlusToPacket: () => Promise<boolean>;
  saveCanvasToLibrary: () => Promise<boolean>;
  handleVideoFileUpload: (file: File) => Promise<void>;
  savePlayToLibrary: () => Promise<void>;
  fetchPublishedCanvasPlayItems: () => Promise<void>;
  handlePlayDone: () => void;
  handleCanvasDone: () => void;
  handleProductSelect: (product: AllowedProduct) => Promise<void>;
  generateProductMockupForType: (type: string, setMockup: (url: string) => void) => Promise<void>;
  handleSimplePublish: () => Promise<void>;

  handleSimpleNext: () => Promise<void>;
  handleSimpleBack: () => void;
  contentRightsConfirmed: boolean;
  setContentRightsConfirmed: (v: boolean) => void;

  canSimpleProceed: () => boolean;

  handleStepClick: (step: WizardStep) => void;
  handleNext: () => void;
  handleBack: () => void;
  handlePublish: () => Promise<void>;
  canProceed: () => boolean;
}

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

  const [selectedProduct, setSelectedProduct] = useState<ProductItem | null>(null);
  const [placementConfigs, setPlacementConfigs] = useState<Record<string, PlacementConfig>>({});
  const [qrType, setQrType] = useState<QRType>('');
  const [qrDestination, setQrDestination] = useState<string>('');
  const [channelName, setChannelName] = useState<string>('My Products');
  const [isPublishing, setIsPublishing] = useState(false);

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

  const generatePreviewQrCode = async () => {
    const previewUrl = `${window.location.origin}/preview/${Date.now()}`;
    const qrApiUrl = generateQRCodeUrl(previewUrl, 200);
    setQrGraphic(qrApiUrl);
    setProductGraphic(qrApiUrl);
    return qrApiUrl;
  };

  const createPacketForProduct = async (product: AllowedProduct) => {
    try {
      console.log('[Wizard] Creating packet for product:', {
        blueprintId: product.blueprintId,
        printProviderId: product.printProviderId,
        title: product.title,
        memberEarnings: product.memberEarnings,
        retailPrice: product.retailPrice,
        baseCost: product.baseCost,
      });

      const authHeaders = await getMemberAuthHeaders();
      const placeholderQrUrl = generateQRCodeUrl('placeholder', 200);

      const packetPayload = {
        memberId: user?.id,
        kind: 'qr_basic',
        background: { url: placeholderQrUrl },
        boundProduct: {
          blueprintId: product.blueprintId,
          printProviderId: product.printProviderId,
          title: product.title,
          imageUrl: product.imageUrl,
          memberEarnings: product.memberEarnings || 0,
          retailPrice: product.retailPrice || 0,
          baseCost: product.baseCost || 0,
        },
        metadata: {},
        source: { entryPoint: 'simple-wizard' },
        status: 'building',
      };

      const res = await fetch(`${apiBase}/${user?.id}/packets`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify(packetPayload),
      });

      if (res.ok) {
        const data = await res.json();
        console.log('[Wizard] Created packet on product select:', data.packetId);
        setCurrentPacketId(data.packetId);
        return data.packetId;
      } else {
        const errorData = await res.json();
        console.error('[Wizard] Packet creation failed:', errorData);
      }
    } catch (error) {
      console.error('[Wizard] Failed to create packet:', error);
    }
    return null;
  };

  const updatePacket = async (updates: Record<string, any>) => {
    if (!currentPacketId || !user?.id) {
      console.warn('[Wizard] No packet or user to update');
      return false;
    }
    try {
      const authHeaders = await getMemberAuthHeaders();
      const res = await fetch(`${apiBase}/${user.id}/packets/${currentPacketId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify(updates),
      });
      if (res.ok) {
        console.log('[Wizard] Updated packet:', currentPacketId, Object.keys(updates));
        return true;
      }
      console.error('[Wizard] Packet update failed:', await res.json());
      return false;
    } catch (error) {
      console.error('[Wizard] Failed to update packet:', error);
      return false;
    }
  };

  const handleSimplePublish = async () => {
    if (!user?.id) {
      toast({ title: 'Login required', description: 'You must be logged in to publish.', variant: 'destructive' });
      return;
    }
    if (!selectedChannel) {
      toast({ title: 'Select a channel', description: 'Go to My Channels and select or create one first.', variant: 'destructive' });
      return;
    }

    setIsPublishing(true);
    try {
      const authHeaders = await getMemberAuthHeaders();

      const textLines = textLayoutChoice === 'both' ? 2 : (textLayoutChoice === 'header' || textLayoutChoice === 'footer') ? 1 : 0;
      const textUpcharge = textLines * (pricingSettings?.textLineUpcharge || 2);
      const extraPlacements = Math.max(0, selectedPlacements.length - 1);
      const placementUpcharge = extraPlacements * (pricingSettings?.additionalPlacementCost || 4);

      const packetData: Record<string, any> = {
        packetType: qrType,
        title: simpleTitle,
        description: simpleDescription,
        channelId: selectedChannel.id,
        storeId: user.id,
        status: 'published',
        boundProduct: selectedProductType ? {
          blueprintId: selectedProductType.blueprintId,
          printProviderId: selectedProductType.printProviderId,
          title: selectedProductType.title,
          imageUrl: selectedProductType.imageUrl,
          memberEarnings: selectedProductType.memberEarnings || 0,
          retailPrice: selectedProductType.retailPrice || 0,
          baseCost: selectedProductType.baseCost || 0,
        } : null,
        selectedColor: selectedColor || null,
        selectedShirtSize: selectedShirtSize || null,
        selectedPlacements: selectedPlacements.length > 0 ? selectedPlacements : null,
        perPlacementConfigs: Object.keys(perPlacementConfigs).length > 0 ? perPlacementConfigs : null,
        perPlacementSizes: Object.keys(perPlacementSizes).length > 0 ? perPlacementSizes : null,
        graphicSize: graphicSize || null,
        textLayoutChoice: textLayoutChoice || null,
        headerText: headerStyle.enabled ? headerStyle.text : null,
        footerText: footerStyle.enabled ? footerStyle.text : null,
        headerStyle: headerStyle.enabled ? headerStyle : null,
        footerStyle: footerStyle.enabled ? footerStyle : null,
        qrType: qrType || null,
        qrDestination: qrDestination || null,
        qrGraphic: qrGraphic || null,
        productGraphic: productGraphic || null,
        background: urlGraphic || null,
        originalUrlGraphic: originalUrlGraphic || null,
        videoUrl: qrType === 'qr-play' ? (playVideoUrl || videoUrl) : null,
        qrBasicInputType: qrType === 'qr-basic' ? (qrBasicInputType || null) : null,
        qrBasicContent: qrType === 'qr-basic' ? (qrBasicContent || null) : null,
        qrBasicMockup: qrType === 'qr-basic' ? (qrBasicMockup || null) : null,
        qrBasicSaveChoice: qrType === 'qr-basic' ? (qrBasicSaveChoice || null) : null,
        qrPlusMockup: qrType === 'qr-plus' ? (qrPlusMockup || null) : null,
        qrPlusSaveChoice: qrType === 'qr-plus' ? (qrPlusSaveChoice || null) : null,
        qrCanvasMockup: qrType === 'qr-canvas' ? (qrCanvasMockup || null) : null,
        qrPlayMockup: qrType === 'qr-play' ? (qrPlayMockup || null) : null,
        composeMockup: qrType === 'qr-compose' ? (composeMockup || null) : null,
        composeItems: qrType === 'qr-compose' ? composeItems : null,
        composeMode: qrType === 'qr-compose' ? (composeMode || 'auto-rotate') : null,
        composeHostingTerm: qrType === 'qr-compose' ? (composeHostingTerm || null) : null,
        textLines,
        textUpcharge,
        placementUpcharge,
        memberEarnings: runningEarnings,
        source: { entryPoint: 'simple-wizard' },
        itemImage: qrType === 'qr-canvas' ? (qrCanvasMockup || productGraphic || null)
          : qrType === 'qr-basic' ? (qrBasicMockup || productGraphic || null)
          : qrType === 'qr-plus' ? (qrPlusMockup || productGraphic || null)
          : qrType === 'qr-play' ? (qrPlayMockup || productGraphic || null)
          : qrType === 'qr-compose' ? (composeMockup || productGraphic || null)
          : (productGraphic || null),
      };

      console.log('[UnifiedPublish] Publishing packet:', {
        existingPacketId: currentPacketId,
        qrType,
        blueprintId: selectedProductType?.blueprintId,
        color: selectedColor,
        placements: selectedPlacements,
        graphicSize,
        textLayout: textLayoutChoice,
        earnings: runningEarnings,
      });

      let result: any;

      if (currentPacketId) {
        packetData.existingPacketId = currentPacketId;
        const res = await fetch(`/api/members/${user.id}/products`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...authHeaders },
          body: JSON.stringify(packetData)
        });
        if (!res.ok) throw new Error('Failed to publish');
        result = await res.json();
      } else {
        const res = await fetch(`/api/members/${user.id}/products`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...authHeaders },
          body: JSON.stringify(packetData)
        });
        if (!res.ok) throw new Error('Failed to publish');
        result = await res.json();
      }

      const packetId = result.id || result.packetId || currentPacketId || null;
      setPublishedPacketId(packetId);
      setCurrentPacketId(packetId);
      incrementPublishCount();

      if (qrType === 'qr-compose') {
        setComposeInstanceId(result.composeInstanceId || null);
        setSimpleStep('compose-confirm');
      } else if (qrType === 'qr-play') {
        setSimpleStep('play-save-choice');
      } else if (qrType === 'qr-canvas') {
        setPublishedQrGraphicUrl(result.qrGraphic || null);
        setPublishedProductGraphicUrl(result.productGraphic || null);
        try {
          const saveAuthHeaders = await getMemberAuthHeaders();
          const assetsToSave: { url: string; assetType: string; name: string }[] = [];
          if (result.productGraphic) {
            assetsToSave.push({ url: result.productGraphic, assetType: 'graphic', name: `${simpleTitle || 'Canvas'} - Product Graphic` });
          }
          if (urlGraphic) {
            assetsToSave.push({ url: urlGraphic, assetType: 'background', name: `${simpleTitle || 'Canvas'} - Landing Page` });
          }
          if (result.qrGraphic) {
            assetsToSave.push({ url: result.qrGraphic, assetType: 'graphic', name: `${simpleTitle || 'Canvas'} - QR Code` });
          }
          for (const asset of assetsToSave) {
            try {
              await fetch(`/api/members/${user.id}/library`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', ...saveAuthHeaders },
                body: JSON.stringify({
                  publicUrl: asset.url,
                  storageUrl: asset.url,
                  assetType: asset.assetType,
                  mediaType: 'image',
                  name: asset.name,
                  fileName: asset.name.replace(/[^a-zA-Z0-9]/g, '_') + '.png'
                })
              });
            } catch (err) {
              console.error('[Canvas Auto-Save] Failed:', asset.assetType, err);
            }
          }
        } catch (saveErr) {
          console.error('[Canvas Auto-Save] Error:', saveErr);
        }
        setSimpleStep('canvas-confirm');
      } else if (qrType === 'qr-basic') {
        // QR Basic goes to confirm step (save already handled via saveQrBasicToPacket wrapper)
      } else if (qrType === 'qr-plus') {
        // QR Plus goes to confirm step (save already handled via saveQrPlusToPacket wrapper)
      } else {
        setViewMode('channels');
        setSimpleStep('channel');
        setCurrentPacketId(null);
        setSimpleTitle('');
        setSimpleDescription('');
        setQrType('');
        setContentRightsConfirmed(false);
        setUrlGraphic('');
        setProductGraphic('');
      }
    } catch (error) {
      console.error('Simple publish error:', error);
      toast({ title: 'Publish failed', description: 'Failed to publish. Please try again.', variant: 'destructive' });
    } finally {
      setIsPublishing(false);
    }
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

  const saveCanvasToLibrary = async () => {
    if (!user?.id) return false;

    setIsCanvasSaving(true);
    try {
      const authHeaders = await getMemberAuthHeaders();
      const assetsToSave: { url: string; assetType: string; name: string }[] = [];

      if ((canvasSaveChoice === 'item' || canvasSaveChoice === 'all') && publishedProductGraphicUrl) {
        assetsToSave.push({
          url: publishedProductGraphicUrl,
          assetType: 'graphic',
          name: `${simpleTitle || 'Canvas'} - Product Graphic`
        });
      }

      if ((canvasSaveChoice === 'landing' || canvasSaveChoice === 'all') && urlGraphic) {
        assetsToSave.push({
          url: urlGraphic,
          assetType: 'background',
          name: `${simpleTitle || 'Canvas'} - Landing Page`
        });
      }

      if (canvasSaveChoice === 'all' && publishedQrGraphicUrl) {
        assetsToSave.push({
          url: publishedQrGraphicUrl,
          assetType: 'graphic',
          name: `${simpleTitle || 'Canvas'} - QR Code`
        });
      }

      for (const asset of assetsToSave) {
        try {
          await fetch(`/api/members/${user.id}/library`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...authHeaders },
            body: JSON.stringify({
              publicUrl: asset.url,
              storageUrl: asset.url,
              assetType: asset.assetType,
              mediaType: 'image',
              name: asset.name,
              fileName: asset.name.replace(/[^a-zA-Z0-9]/g, '_') + '.png'
            })
          });
          console.log('[Canvas Save] Saved to library:', asset.assetType, asset.name);
        } catch (err) {
          console.error('[Canvas Save] Failed to save:', asset.assetType, err);
        }
      }

      return true;
    } finally {
      setIsCanvasSaving(false);
    }
  };

  const handleVideoFileUpload = async (file: File) => {
    const MAX_SIZE = 50 * 1024 * 1024;
    const MIN_SIZE = 10 * 1024;
    if (file.size > MAX_SIZE) {
      setVideoUploadError(`File is too large (${(file.size / 1024 / 1024).toFixed(1)}MB). Maximum size is 50MB. For larger videos, use the "Paste URL" option instead.`);
      return;
    }
    if (file.size < MIN_SIZE) {
      setVideoUploadError('This file is too small to be a valid video. Please select the actual video file from your camera roll.');
      return;
    }

    const rejectedExtensions = /\.(ts|m3u8|m3u)$/i;
    if (rejectedExtensions.test(file.name)) {
      setVideoUploadError('This file type (.ts stream) is not supported. Please select an MP4 or MOV video from your camera roll instead.');
      return;
    }

    if (file.type === 'video/mp2t' || file.type === 'video/mp2ts' || file.type === 'video/MP2T') {
      setVideoUploadError('Transport stream (.ts) files are not supported. Please select an MP4 or MOV video from your camera roll instead.');
      return;
    }

    const allowedTypes = ['video/mp4', 'video/webm', 'video/quicktime', 'video/3gpp', 'video/3gpp2', 'video/x-m4v', 'video/x-matroska'];
    const isVideo = file.type.startsWith('video/') || /\.(mp4|mov|webm|m4v|3gp)$/i.test(file.name);
    if (!isVideo && !allowedTypes.includes(file.type)) {
      setVideoUploadError('Please upload a video file (MP4, MOV, WebM, M4V, or 3GP).');
      return;
    }

    setVideoUploadError(null);
    setVideoUploadSuccess(false);
    setIsUploadingVideo(true);
    setVideoUploadProgress(0);

    try {
      const authHeaders = await getMemberAuthHeaders();
      const memberId = user?.id;
      if (!memberId) throw new Error('Not signed in');

      const mimeType = file.type || 'video/mp4';

      const formData = new FormData();
      formData.append('file', file);
      formData.append('storeType', 'member');

      const result = await new Promise<{ url: string }>((resolve, reject) => {
        const xhr = new XMLHttpRequest();

        xhr.upload.addEventListener('progress', (e) => {
          if (e.lengthComputable) {
            const pct = Math.round((e.loaded / e.total) * 100);
            setVideoUploadProgress(pct);
          }
        });

        xhr.addEventListener('load', () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            try {
              const data = JSON.parse(xhr.responseText);
              resolve(data);
            } catch {
              reject(new Error('Invalid server response'));
            }
          } else {
            let msg = 'Upload failed';
            try {
              const errData = JSON.parse(xhr.responseText);
              msg = errData.error || msg;
            } catch {}
            reject(new Error(msg));
          }
        });

        xhr.addEventListener('error', () => {
          reject(new Error('Network error - check your connection and try again'));
        });

        xhr.addEventListener('abort', () => {
          reject(new Error('Upload was cancelled'));
        });

        xhr.open('POST', `${apiBase}/${user.id}/media`);
        const authHeader = (authHeaders as any)['Authorization'];
        if (authHeader) {
          xhr.setRequestHeader('Authorization', authHeader);
        }
        xhr.send(formData);
      });

      setPlayVideoUrl(result.url);
      setVideoUrl(result.url);
      setVideoUploadSuccess(true);
      console.log('[QR Play] Video uploaded successfully:', result.url);

      try {
        const saveRes = await fetch(`/api/members/${memberId}/library/upload`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...authHeaders },
          body: JSON.stringify({
            assetType: 'video',
            name: `${simpleTitle || 'QR Play'} - Video`,
            imageData: 'data:text/plain;base64,' + btoa(result.url),
            mimeType: 'text/plain',
            originalName: `video-url-${Date.now()}.txt`,
          })
        });
        if (saveRes.ok) {
          console.log('[QR Play] Video auto-saved to member library');
        }
      } catch (libErr) {
        console.warn('[QR Play] Auto-save to library failed (non-blocking):', libErr);
      }
    } catch (error: any) {
      console.error('[QR Play] Video upload error:', error);
      setVideoUploadError(error?.message || 'Failed to upload video. Please try again.');
      setVideoUploadSuccess(false);
    } finally {
      setIsUploadingVideo(false);
    }
  };

  const savePlayToLibrary = async () => {
    if (!user?.id || playSaveChoice === 'skip') return;

    setIsPlaySaving(true);
    try {
      if (playVideoUrl && !playVideoUrl.startsWith('/api/member-files/')) {
        const authHeaders = await getMemberAuthHeaders();
        const res = await fetch(`/api/members/${user.id}/library/upload`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...authHeaders },
          body: JSON.stringify({
            assetType: 'video',
            name: `${simpleTitle || 'QR Play'} - Video`,
            imageData: 'data:text/plain;base64,' + btoa(playVideoUrl),
            mimeType: 'text/plain',
            originalName: `video-url-${Date.now()}.txt`,
          })
        });
      }
    } catch (error) {
      console.error('[QR Play] Save to library error:', error);
    } finally {
      setIsPlaySaving(false);
    }
  };

  const fetchPublishedCanvasPlayItems = async () => {
    if (!user?.id) return;
    setIsLoadingPublishedItems(true);
    try {
      const authHeaders = await getMemberAuthHeaders();
      const res = await fetch(`/api/members/${user.id}/published-items?types=qr-canvas,qr-play`, {
        headers: authHeaders
      });
      if (res.ok) {
        const data = await res.json();
        setPublishedCanvasPlayItems(data.items || []);
      }
    } catch (error) {
      console.error('[QR Compose] Error fetching published items:', error);
    } finally {
      setIsLoadingPublishedItems(false);
    }
  };

  const handlePlayDone = () => {
    setSimpleStep('channel');
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
    setViewMode('channels');
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

  const handleProductSelect = async (product: AllowedProduct) => {
    setSelectedProductType(product);
    if (!simpleTitle) {
      setSimpleTitle(getDefaultPacketTitle(product.title));
    }
    if (!simpleDescription) {
      setSimpleDescription(getDefaultPacketDescription(product.title));
    }
    await createPacketForProduct(product);
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

  const generateProductMockupForType = async (
    type: string,
    setMockup: (url: string) => void,
  ) => {
    try {
      const previewUrl = `${window.location.origin}/preview/${Date.now()}`;
      const qrApiUrl = generateQRCodeUrl(previewUrl, 200);
      setQrGraphic(qrApiUrl);
      console.log(`[${type}] Generated qrGraphic:`, qrApiUrl);

      console.log(`[${type}] Generating productGraphic with textLayoutChoice:`, textLayoutChoice);
      const productGraphicResult = await api.generateProductGraphic({
        qrUrl: previewUrl,
        headerStyle: headerStyle,
        footerStyle: footerStyle,
        textLayoutChoice: textLayoutChoice,
        qrColor: 'black',
      });

      let artworkForMockup = qrApiUrl;
      if (productGraphicResult.success && productGraphicResult.productGraphic) {
        setProductGraphic(productGraphicResult.productGraphic);
        artworkForMockup = productGraphicResult.productGraphic;
        console.log(`[${type}] Generated productGraphic (composite), length:`, productGraphicResult.productGraphic.length);
      } else {
        console.warn(`[${type}] productGraphic generation failed, using qrGraphic as fallback`);
        setProductGraphic(qrApiUrl);
      }

      if (selectedProductType?.blueprintId && selectedProductType?.printProviderId && selectedColor) {
        const effectiveQrSize = (graphicSize === 'small' || graphicSize === 'medium' || graphicSize === 'large') ? graphicSize : 'medium';
        console.log(`[${type}] Generating mockup with graphicSize:`, graphicSize, '→ effectiveQrSize:', effectiveQrSize);

        const mockupResult = await api.generateMockup({
          blueprintId: selectedProductType.blueprintId,
          printProviderId: selectedProductType.printProviderId,
          colorName: selectedColor,
          artworkUrl: artworkForMockup,
          placement: 'front',
          qrSize: effectiveQrSize,
        });

        const bestUrl = mockupResult.lifestyleMockupUrl || mockupResult.mockupUrl;
        if (mockupResult.success && bestUrl) {
          console.log(`[${type}] SUCCESS - Setting mockup to:`, bestUrl);
          setMockup(bestUrl);
        } else {
          console.warn(`[${type}] FAILED - Using QR fallback. Error:`, mockupResult.error);
          setMockup(qrApiUrl);
        }
      } else {
        console.warn(`[${type}] Missing product info for mockup`);
        setMockup(qrApiUrl);
      }
    } catch (error) {
      console.error(`[${type}] Error generating mockup:`, error);
      const fallbackUrl = generateQRCodeUrl('placeholder', 200);
      setMockup(fallbackUrl);
    }
  };

  const handleSimpleNext = async () => {
    window.scrollTo({ top: 0, behavior: 'instant' });
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
    if (simpleStep === 'product-congrats' && selectedProductType) {
      setRunningEarnings(prev => {
        if (prev === 0) {
          return selectedProductType.memberEarnings || 0;
        }
        return prev;
      });
    }

    if (simpleStep === 'qr-basic-type') {
      setSimpleStep('qr-basic-input');
      return;
    }
    if (simpleStep === 'qr-basic-input') {
      setIsGeneratingBasicMockup(true);
      try {
        const authHeaders = await getMemberAuthHeaders();

        const qrContent = qrBasicContent;
        const qrApiUrl = generateQRCodeUrl(qrContent, 1000);

        if (currentPacketId) {
          await updatePacket({
            urlContent: qrBasicInputType === 'url' ? qrContent : null,
            graphicUrl: qrApiUrl,
            textLayers: qrBasicInputType === 'text' ? [{ text: qrContent, type: 'content' }] : [],
            'boundProduct.color': selectedColor,
            'boundProduct.size': selectedShirtSize,
            'boundProduct.blueprintId': selectedProductType?.blueprintId,
            'boundProduct.printProviderId': selectedProductType?.printProviderId,
            'metadata.inputType': qrBasicInputType,
            'metadata.graphicSize': graphicSize,
            'metadata.placements': selectedPlacements,
            'metadata.perPlacementSizes': perPlacementSizes,
            status: 'draft',
          });
          console.log('[QR Basic] Updated packet with QR content:', currentPacketId);
        }

        if (selectedProductType?.blueprintId && selectedProductType?.printProviderId && selectedColor) {
          const effectiveQrSize = (graphicSize === 'small' || graphicSize === 'medium' || graphicSize === 'large') ? graphicSize : 'medium';
          console.log('[QR Basic] Generating mockup with graphicSize:', graphicSize, '→ effectiveQrSize:', effectiveQrSize);
          const mockupResult = await api.generateMockup({
            blueprintId: selectedProductType.blueprintId,
            printProviderId: selectedProductType.printProviderId,
            colorName: selectedColor,
            artworkUrl: qrApiUrl,
            placement: 'front',
            qrSize: effectiveQrSize,
          });

          const bestUrl = mockupResult.lifestyleMockupUrl || mockupResult.mockupUrl;
          if (mockupResult.success && bestUrl) {
            console.log('[QR Basic] Got mockup:', {
              lifestyle: !!mockupResult.lifestyleMockupUrl,
              flat: !!mockupResult.mockupUrl,
              fromCache: mockupResult.fromCache
            });
            setQrBasicMockup(bestUrl);
          } else {
            console.warn('[QR Basic] Mockup fetch failed:', mockupResult.error);
            setQrBasicMockup(qrApiUrl);
          }
        } else {
          console.warn('[QR Basic] Missing product info for mockup - blueprintId:', selectedProductType?.blueprintId, 'printProviderId:', selectedProductType?.printProviderId, 'color:', selectedColor);
          setQrBasicMockup(qrApiUrl);
        }
      } catch (error) {
        console.error('[QR Basic] Error generating mockup:', error);
        setQrBasicMockup(generateQRCodeUrl(qrBasicContent, 300));
      } finally {
        setIsGeneratingBasicMockup(false);
      }
      setSimpleStep('qr-basic-mockup');
      return;
    }
    if (simpleStep === 'qr-basic-mockup') {
      setSimpleStep('qr-basic-save-choice');
      return;
    }
    if (simpleStep === 'qr-basic-save-choice') {
      await saveQrBasicToPacket();
      setSimpleStep('qr-basic-confirm');
      return;
    }
    if (simpleStep === 'qr-basic-confirm') {
      setSimpleStep('channel');
      setCurrentPacketId(null);
      setQrBasicInputType('');
      setQrBasicContent('');
      setQrBasicMockup('');
      setQrBasicSaveChoice('');
      return;
    }

    if (simpleStep === 'qr-plus-mockup') {
      setSimpleStep('qr-plus-save-choice');
      return;
    }
    if (simpleStep === 'qr-plus-save-choice') {
      await saveQrPlusToPacket();
      setSimpleStep('qr-plus-confirm');
      return;
    }
    if (simpleStep === 'qr-plus-confirm') {
      setSimpleStep('channel');
      setCurrentPacketId(null);
      setQrPlusMockup('');
      setQrPlusSaveChoice('');
      return;
    }

    if (simpleStep === 'play-video-source') {
      setSimpleStep('play-preview');
      return;
    }
    if (simpleStep === 'play-preview') {
      setIsGeneratingPlayMockup(true);
      setSimpleStep('play-mockup');
      try {
        await generateProductMockupForType('qr-play', setQrPlayMockup);
      } finally {
        setIsGeneratingPlayMockup(false);
      }
      return;
    }
    if (simpleStep === 'play-mockup') {
      setSimpleStep('play-publish');
      return;
    }
    if (simpleStep === 'play-publish') {
      await handleSimplePublish();
      return;
    }
    if (simpleStep === 'play-save-choice') {
      handlePlayDone();
      return;
    }

    if (simpleStep === 'url-preview') {
      setIsGeneratingCanvasMockup(true);
      setSimpleStep('canvas-mockup');
      try {
        await generateProductMockupForType('qr-canvas', setQrCanvasMockup);
      } finally {
        setIsGeneratingCanvasMockup(false);
      }
      return;
    }
    if (simpleStep === 'canvas-mockup') {
      setSimpleStep('url-publish');
      return;
    }

    if (simpleStep === 'canvas-save-choice') {
      await saveCanvasToLibrary();
      setSimpleStep('canvas-confirm');
      return;
    }
    if (simpleStep === 'canvas-confirm') {
      handleCanvasDone();
      return;
    }

    if (simpleStep === 'compose-pick-items') {
      if (composeItems.length < 2) return;
      setSimpleStep('compose-mode');
      return;
    }
    if (simpleStep === 'compose-mode') {
      if (!composeMode) return;
      if (composeMode === 'scan-to-reveal') {
        setSimpleStep('compose-order');
      } else {
        setSimpleStep('compose-durations');
      }
      return;
    }
    if (simpleStep === 'compose-durations') {
      setSimpleStep('compose-order');
      return;
    }
    if (simpleStep === 'compose-order') {
      setSimpleStep('compose-hosting');
      return;
    }
    if (simpleStep === 'compose-hosting') {
      if (!composeHostingTerm) return;
      setIsGeneratingComposeMockup(true);
      setSimpleStep('compose-mockup');
      try {
        await generateProductMockupForType('qr-compose', setComposeMockup);
      } finally {
        setIsGeneratingComposeMockup(false);
      }
      return;
    }
    if (simpleStep === 'compose-mockup') {
      setSimpleStep('compose-preview');
      return;
    }
    if (simpleStep === 'compose-preview') {
      setSimpleStep('compose-publish');
      return;
    }
    if (simpleStep === 'compose-publish') {
      await handleSimplePublish();
      return;
    }
    if (simpleStep === 'compose-confirm') {
      setSimpleStep('channel');
      setCurrentPacketId(null);
      setComposeItems([]);
      setComposeMode('');
      setComposeHostingTerm('');
      setComposeMockup('');
      setComposeInstanceId(null);
      return;
    }

    const stepsArray = qrType === 'qr-basic' ? QR_BASIC_STEPS
      : qrType === 'qr-plus' ? QR_PLUS_STEPS
      : qrType === 'qr-play' ? QR_PLAY_STEPS
      : qrType === 'qr-compose' ? QR_COMPOSE_STEPS
      : SIMPLE_WIZARD_STEPS;
    const currentIndex = stepsArray.findIndex(s => s.id === simpleStep);

    if (simpleStep === 'placement-count') {
      setCurrentPlacementIndex(0);
      setGraphicSize('');
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
    }

    if (simpleStep === 'text-choice') {
      setSimpleStep(textLayoutChoice === 'footer' ? 'text-edit-footer' : 'text-edit-header');
      return;
    }

    if (simpleStep === 'text-edit-header') {
      if (textLayoutChoice === 'header') {
        setCurrentPlacementIndex(0);
        setPlacementGraphicChoice('');
        setPlacementSize('');
        const stepsArr = isQRPlusStep(simpleStep) ? QR_PLUS_STEPS : isQRPlayStep(simpleStep) ? QR_PLAY_STEPS : stepsArray;
        const pcIdx = stepsArr.findIndex(s => s.id === 'placement-config');
        if (pcIdx >= 0) {
          setSimpleStep('placement-config');
          return;
        }
      }
    }
    if (simpleStep === 'text-edit-footer') {
      setCurrentPlacementIndex(0);
      setPlacementGraphicChoice('');
      setPlacementSize('');
    }

    if (simpleStep === 'placement-config') {
      const savedSize = perPlacementSizes[currentPlacement] || 'medium';
      setPerPlacementConfigs(prev => ({
        ...prev,
        [currentPlacement]: {
          graphicChoice: placementGraphicChoice,
          size: savedSize
        }
      }));

      if (currentPlacementIndex < selectedPlacements.length - 1) {
        const nextPlacement = selectedPlacements[currentPlacementIndex + 1];
        setCurrentPlacementIndex(prev => prev + 1);
        setPlacementGraphicChoice('');
        setPlacementSize('');
        return;
      }
    }

    if (currentIndex < stepsArray.length - 1) {
      const nextStep = stepsArray[currentIndex + 1].id;
      setSimpleStep(nextStep);
    }
  };

  const handleSimpleBack = () => {
    window.scrollTo({ top: 0, behavior: 'instant' });
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
    if (simpleStep === 'compose-explainer' || simpleStep === 'platform-acknowledge') {
      setSimpleStep('canvas-fork');
      return;
    }

    if (simpleStep === 'qr-basic-type') {
      setSimpleStep('generate');
      return;
    }
    if (simpleStep === 'qr-basic-input') {
      setSimpleStep('qr-basic-type');
      return;
    }
    if (simpleStep === 'qr-basic-mockup') {
      setSimpleStep('qr-basic-input');
      return;
    }
    if (simpleStep === 'qr-basic-save-choice') {
      setSimpleStep('qr-basic-mockup');
      return;
    }
    if (simpleStep === 'qr-basic-confirm') {
      setSimpleStep('qr-basic-save-choice');
      return;
    }

    if (simpleStep === 'qr-plus-mockup') {
      setSimpleStep('canvas-fork');
      return;
    }
    if (simpleStep === 'qr-plus-save-choice') {
      setSimpleStep('qr-plus-mockup');
      return;
    }
    if (simpleStep === 'qr-plus-confirm') {
      setSimpleStep('qr-plus-save-choice');
      return;
    }

    if (simpleStep === 'play-video-source') {
      setSimpleStep('canvas-fork');
      return;
    }
    if (simpleStep === 'play-preview') {
      setSimpleStep('play-video-source');
      return;
    }
    if (simpleStep === 'play-mockup') {
      setSimpleStep('play-preview');
      return;
    }
    if (simpleStep === 'play-publish') {
      setSimpleStep('play-mockup');
      return;
    }
    if (simpleStep === 'play-save-choice') {
      return;
    }

    if (simpleStep === 'compose-pick-items') {
      setSimpleStep('canvas-fork');
      return;
    }
    if (simpleStep === 'compose-mode') {
      setSimpleStep('compose-pick-items');
      return;
    }
    if (simpleStep === 'compose-durations') {
      setSimpleStep('compose-mode');
      return;
    }
    if (simpleStep === 'compose-order') {
      if (composeMode === 'scan-to-reveal') {
        setSimpleStep('compose-mode');
      } else {
        setSimpleStep('compose-durations');
      }
      return;
    }
    if (simpleStep === 'compose-hosting') {
      setSimpleStep('compose-order');
      return;
    }
    if (simpleStep === 'compose-mockup') {
      setSimpleStep('compose-hosting');
      return;
    }
    if (simpleStep === 'compose-preview') {
      setSimpleStep('compose-mockup');
      return;
    }
    if (simpleStep === 'compose-publish') {
      setSimpleStep('compose-preview');
      return;
    }
    if (simpleStep === 'compose-confirm') {
      return;
    }

    if (simpleStep === 'canvas-fork') {
      if (wantsHeaderFooter) {
        setSimpleStep('shirt-preview');
      } else {
        setSimpleStep('generate');
      }
      return;
    }
    if (simpleStep === 'canvas-mockup') {
      setSimpleStep('url-preview');
      return;
    }
    if (simpleStep === 'url-publish') {
      setSimpleStep('canvas-mockup');
      return;
    }
    if (simpleStep === 'url-explainer') {
      setSimpleStep('canvas-fork');
      return;
    }

    if (simpleStep === 'graphic-size' && currentPlacementIndex > 0) {
      const prevPlacement = selectedPlacements[currentPlacementIndex - 1];
      setCurrentPlacementIndex(prev => prev - 1);
      setGraphicSize(perPlacementSizes[prevPlacement] || '');
      return;
    }

    const stepsArray = qrType === 'qr-basic' ? QR_BASIC_STEPS
      : qrType === 'qr-plus' ? QR_PLUS_STEPS
      : qrType === 'qr-play' ? QR_PLAY_STEPS
      : qrType === 'qr-compose' ? QR_COMPOSE_STEPS
      : SIMPLE_WIZARD_STEPS;
    const currentIndex = stepsArray.findIndex(s => s.id === simpleStep);
    if (currentIndex > 0) {
      setSimpleStep(stepsArray[currentIndex - 1].id);
    }
  };

  const canSimpleProceed = () => {
    switch (simpleStep) {
      case 'channel': return selectedChannel !== null;
      case 'product': return selectedProductType !== null;
      case 'product-congrats': return true;
      case 'color': return selectedColor !== '';
      case 'size': return selectedShirtSize !== '';
      case 'type': return qrType !== '';
      case 'graphic-size': return graphicSize !== '';
      case 'generate': return wantsHeaderFooter !== null;
      case 'text-choice': return textLayoutChoice !== '';
      case 'placement-count': return selectedPlacements.length > 0;
      case 'text-edit-header': return true;
      case 'text-edit-footer': return true;
      case 'placement-config': return placementGraphicChoice !== '';
      case 'shirt-preview': return true;
      case 'url-explainer': return true;
      case 'url-source-choice': return libraryChoice !== '';
      case 'url-library-pick': return urlGraphic !== '';
      case 'url-title': return simpleTitle.trim() !== '';
      case 'url-description': return true;
      case 'url-preview': return true;
      case 'url-publish': return true;
      case 'qr-basic-type': return qrBasicInputType !== '';
      case 'qr-basic-input': {
        if (qrBasicContent.trim() === '') return false;
        if (qrBasicInputType === 'url') {
          try { new URL(qrBasicContent); } catch { return false; }
        }
        return true;
      }
      case 'qr-basic-mockup': return true;
      case 'qr-basic-save-choice': return qrBasicSaveChoice !== '';
      case 'qr-basic-confirm': return true;
      case 'qr-plus-mockup': return true;
      case 'qr-plus-save-choice': return qrPlusSaveChoice !== '';
      case 'qr-plus-confirm': return true;
      case 'canvas-mockup': return true;
      case 'play-mockup': return true;
      case 'canvas-save-choice': return canvasSaveChoice !== '';
      case 'canvas-confirm': return true;
      case 'play-video-source': return playVideoUrl !== '' && !isUploadingVideo;
      case 'play-preview': return true;
      case 'play-publish': return true;
      case 'play-save-choice': return true;
      case 'compose-pick-items': return composeItems.length >= 2;
      case 'compose-mode': return composeMode !== '';
      case 'compose-durations': return true;
      case 'compose-order': return true;
      case 'compose-hosting': return composeHostingTerm !== '';
      case 'compose-mockup': return !isGeneratingComposeMockup;
      case 'compose-preview': return true;
      case 'compose-publish': return !isPublishing;
      case 'compose-confirm': return true;
      default: return false;
    }
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
    if (!user?.id || !selectedProduct || !selectedChannel) return;

    setIsPublishing(true);
    try {
      const authHeaders = await getMemberAuthHeaders();

      const textLines = textLayoutChoice === 'both' ? 2 : (textLayoutChoice === 'header' || textLayoutChoice === 'footer') ? 1 : 0;
      const textUpcharge = textLines * (pricingSettings?.textLineUpcharge || 2);
      const extraPlacements = Math.max(0, selectedPlacements.length - 1);
      const placementUpcharge = extraPlacements * (pricingSettings?.additionalPlacementCost || 4);
      const baseProductPrice = (selectedProduct as any).retailPrice || pricingSettings?.baseRetailPrice || 0;
      const calculatedBasePrice = baseProductPrice + textUpcharge + placementUpcharge;

      const productRes = await fetch(`/api/members/${user.id}/products`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify({
          printfulProductId: selectedProduct.productId,
          variantId: selectedProduct.id,
          qrType,
          qrDestination: qrDestination || landingPage.url || null,
          headerStyle: headerStyle.enabled ? headerStyle : null,
          footerStyle: footerStyle.enabled ? footerStyle : null,
          background: urlGraphic || null,
          landingPage: landingPage,
          videoUrl: videoUrl || null,
          channelId: selectedChannel.id,
          name: selectedProduct.name,
          price: calculatedBasePrice,
          textLines,
          textUpcharge,
          placementUpcharge,
          memberEarnings: runningEarnings
        })
      });

      if (!productRes.ok) throw new Error('Failed to create product');

      setCompletedSteps(prev => new Set<WizardStep>([...Array.from(prev), 'publish']));
      incrementPublishCount();
      setViewMode('channels');
    } catch (error) {
      console.error('Publish error:', error);
      toast({ title: 'Publish failed', description: 'Failed to publish. Please try again.', variant: 'destructive' });
    } finally {
      setIsPublishing(false);
    }
  };

  const canProceed = () => {
    switch (currentStep) {
      case 'channel': return selectedChannel !== null;
      case 'product': return selectedProduct !== null;
      case 'placement': return selectedPlacements.length > 0;
      case 'header-footer': return true;
      case 'background': return true;
      case 'landing-page': return true;
      case 'preview': return true;
      case 'publish': return true;
      default: return false;
    }
  };

  const value: WizardContextType = {
    user,
    authLoading,
    isAuthenticated,
    api,

    viewMode, setViewMode,
    currentStep, setCurrentStep,
    simpleStep, setSimpleStep,
    completedSteps, setCompletedSteps,
    wizardTier, setWizardTier,
    publishCount, setPublishCount,
    showUnlockPrompt, setShowUnlockPrompt,
    selectedChannel, setSelectedChannel,
    isCreatingChannel, setIsCreatingChannel,
    newChannelName, setNewChannelName,

    simpleTitle, setSimpleTitle,
    simpleDescription, setSimpleDescription,
    titleVertical, setTitleVertical,
    titleHorizontal, setTitleHorizontal,
    titleColor, setTitleColor,
    titleSize, setTitleSize,
    titleFont, setTitleFont,
    descVertical, setDescVertical,
    descHorizontal, setDescHorizontal,
    descColor, setDescColor,
    descSize, setDescSize,
    descFont, setDescFont,

    selectedProductType, setSelectedProductType,
    selectedColor, setSelectedColor,
    selectedShirtSize, setSelectedShirtSize,
    graphicLocation, setGraphicLocation,
    graphicSize, setGraphicSize,
    wantsHeaderFooter, setWantsHeaderFooter,

    currentPacketId, setCurrentPacketId,
    runningEarnings, setRunningEarnings,
    earningsPulse, setEarningsPulse,

    selectedProduct, setSelectedProduct,
    placementConfigs, setPlacementConfigs,
    qrType, setQrType,
    qrDestination, setQrDestination,
    channelName, setChannelName,
    isPublishing, setIsPublishing,

    headerStyle, setHeaderStyle,
    footerStyle, setFooterStyle,
    productGraphic, setProductGraphic,
    originalUrlGraphic, setOriginalUrlGraphic,
    urlGraphic, setUrlGraphic,
    showBackgroundLibrary, setShowBackgroundLibrary,
    landingPage, setLandingPage,
    videoUrl, setVideoUrl,

    textLayoutChoice, setTextLayoutChoice,
    selectedPlacements, setSelectedPlacements,
    wantsText, setWantsText,
    qrGraphic, setQrGraphic,
    isGeneratingQr, setIsGeneratingQr,
    urlSourceChoice, setUrlSourceChoice,
    libraryChoice, setLibraryChoice,

    currentPlacementIndex, setCurrentPlacementIndex,
    placementGraphicChoice, setPlacementGraphicChoice,
    placementSize, setPlacementSize,
    perPlacementConfigs, setPerPlacementConfigs,
    perPlacementSizes, setPerPlacementSizes,

    qrBasicInputType, setQrBasicInputType,
    qrBasicContent, setQrBasicContent,
    qrBasicMockup, setQrBasicMockup,
    isGeneratingBasicMockup, setIsGeneratingBasicMockup,
    qrBasicSaveChoice, setQrBasicSaveChoice,
    isQrBasicSaving, setIsQrBasicSaving,

    canvasSaveChoice, setCanvasSaveChoice,
    isCanvasSaving, setIsCanvasSaving,
    publishedPacketId, setPublishedPacketId,
    publishedQrGraphicUrl, setPublishedQrGraphicUrl,
    publishedProductGraphicUrl, setPublishedProductGraphicUrl,

    playVideoSource, setPlayVideoSource,
    playVideoUrl, setPlayVideoUrl,
    isUploadingVideo, setIsUploadingVideo,
    videoUploadError, setVideoUploadError,
    videoUploadProgress, setVideoUploadProgress,
    videoUploadSuccess, setVideoUploadSuccess,
    playSaveChoice, setPlaySaveChoice,
    isPlaySaving, setIsPlaySaving,

    qrPlusMockup, setQrPlusMockup,
    isGeneratingPlusMockup, setIsGeneratingPlusMockup,
    qrPlusSaveChoice, setQrPlusSaveChoice,
    isQrPlusSaving, setIsQrPlusSaving,

    qrCanvasMockup, setQrCanvasMockup,
    isGeneratingCanvasMockup, setIsGeneratingCanvasMockup,

    qrPlayMockup, setQrPlayMockup,
    isGeneratingPlayMockup, setIsGeneratingPlayMockup,

    composeItems, setComposeItems,
    composeMode, setComposeMode,
    composeHostingTerm, setComposeHostingTerm,
    composeMockup, setComposeMockup,
    isGeneratingComposeMockup, setIsGeneratingComposeMockup,
    publishedCanvasPlayItems, setPublishedCanvasPlayItems,
    isLoadingPublishedItems, setIsLoadingPublishedItems,
    composeInstanceId, setComposeInstanceId,

    contentRightsConfirmed,
    setContentRightsConfirmed,

    currentPlacement,

    pricingSettings,
    placementEarningsBonus,
    textLineEarningsBonus,
    sizeEarningsIncrement,

    unlockedTiers,
    incrementPublishCount,

    generatePreviewQrCode,
    createPacketForProduct,
    updatePacket,
    saveQrBasicToPacket,
    saveQrPlusToPacket,
    saveCanvasToLibrary,
    handleVideoFileUpload,
    savePlayToLibrary,
    fetchPublishedCanvasPlayItems,
    handlePlayDone,
    handleCanvasDone,
    handleProductSelect,
    generateProductMockupForType,
    handleSimplePublish,

    handleSimpleNext,
    handleSimpleBack,
    canSimpleProceed,

    handleStepClick,
    handleNext,
    handleBack,
    handlePublish,
    canProceed,
  };

  return <WizardContext.Provider value={value}>{children}</WizardContext.Provider>;
}
