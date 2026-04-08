import type { TextStyleConfig } from "@/features/shared/components/TextStyleEditor";
import type { PlacementConfig } from "@/features/shared/components/PlacementPicker";
import type { LandingPageConfig } from "@/features/shared/components/LandingPageEditor";
import type {
  WizardStep, SimpleWizardStep, QRBasicSaveOption, QRPlusSaveOption,
  QRCanvasSaveOption, QRPlaySaveOption, PlayVideoSource, UrlSourceChoice,
  LibraryChoice, PlacementGraphicChoice, QRBasicInputType, PlacementOption,
  QRType, WizardTier, TextLayoutChoice,
  GraphicLocation, GraphicSize, ViewMode,
  AllowedProduct, ProductItem,
} from "@/features/shared/components/wizardSteps";
import type { ComposeMode } from "@/features/shared/components/wizardSteps/ComposeSteps";
import type { useMembersContext } from "@/features/members/MembersContext";
import type { BuilderCapabilities } from "@/features/shared/builder-capabilities";

export interface WizardContextType {
  capabilities: BuilderCapabilities;
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
  qrPositionX: number;
  setQrPositionX: React.Dispatch<React.SetStateAction<number>>;
  qrPositionY: number;
  setQrPositionY: React.Dispatch<React.SetStateAction<number>>;
  qrSizePercent: number;
  setQrSizePercent: React.Dispatch<React.SetStateAction<number>>;
  areaImageUrl: string;
  setAreaImageUrl: React.Dispatch<React.SetStateAction<string>>;
  areaImageMode: "behind-qr";
  setAreaImageMode: React.Dispatch<React.SetStateAction<"behind-qr">>;
  graphicLayoutMode: "zone" | "freeform";
  setGraphicLayoutMode: React.Dispatch<React.SetStateAction<"zone" | "freeform">>;
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
  pendingVideoFile: File | null;
  setPendingVideoFile: React.Dispatch<React.SetStateAction<File | null>>;
  showSignInToPublish: boolean;
  setShowSignInToPublish: React.Dispatch<React.SetStateAction<boolean>>;

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
