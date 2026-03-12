import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  Sparkles, X, ArrowRight, Store, Package, DollarSign,
  QrCode, Type, ImagePlus, Play, TrendingUp, Check,
  Palette, Ruler, Loader2, PartyPopper, Lightbulb,
  ChevronLeft, ChevronRight, Wand2, Eye, EyeOff
} from "lucide-react";
import { signInWithEmail, signInWithGoogle, signUpWithEmail } from "@/lib/firebase";
import { useQueryClient } from "@tanstack/react-query";
import { SimpleWizardProgressBar } from "@/features/shared/components/wizardSteps/WizardProgressBars";
import { ChannelStep } from "@/features/shared/components/wizardSteps/ChannelStep";
import { ProductPickerStep, ProductCongratsStep, ColorPickerStep, SizePickerStep, getProductFriendlyName, TierPickerStep } from "@/features/shared/components/wizardSteps/ProductSteps";
import { GraphicSizeStep, PlacementCountStep, PlacementConfigStep } from "@/features/shared/components/wizardSteps/PlacementSteps";
import { TextLayoutChoiceStep, HeaderTextEditStep, FooterTextEditStep } from "@/features/shared/components/wizardSteps/TextSteps";
import { TypePickerStep, SurfacePickerStep, GenerateGraphicStep } from "@/features/shared/components/wizardSteps/TypeAndSurfaceSteps";
import { QRBasicTypeStep, QRBasicInputStep, QRBasicMockupStep, QRBasicSaveChoiceStep, QRBasicConfirmStep } from "@/features/shared/components/wizardSteps/QRBasicSteps";
import { QRPlusMockupStep, QRPlusSaveChoiceStep, QRPlusConfirmStep } from "@/features/shared/components/wizardSteps/QRPlusSteps";
import { QRCanvasExplainerStep, UrlSourceChoiceStep, SimpleBackgroundStep, QRCanvasSaveChoiceStep, QRCanvasConfirmStep, SimplePreviewStep, SimplePublishStep } from "@/features/shared/components/wizardSteps/CanvasSteps";
import { PlayVideoSourceStep, PlayPreviewStep, PlayPublishStep, PlayPublishedStep } from "@/features/shared/components/wizardSteps/PlaySteps";
import { ComposeModePicker, ComposePickItemsStep, ComposeDurationsStep, ComposeOrderStep, ComposeHostingStep, ComposePreviewStep, ComposePublishStep, ComposeConfirmStep, ComposeExplainerCard, PlatformAcknowledgementCard } from "@/features/shared/components/wizardSteps/ComposeSteps";
import { ShirtPreviewStep, UrlTitleStep, UrlDescriptionStep } from "@/features/shared/components/wizardSteps/PreviewAndPublishSteps";
import { ShareKitHandoff } from "@/features/shared/components/ShareKitHandoff";
import { calculateSizeEarningsBonuses, generateQRCodeUrl } from "@/features/shared/components/wizardSteps";
import type { QRType } from "@/features/shared/components/wizardSteps/wizardTypes";
import { useWizardContext } from './WizardContext';
import { db } from "@/lib/firebase";
import { doc, getDoc, setDoc } from "firebase/firestore";

interface BlackboardData {
  icon: React.ReactNode;
  title: string;
  lines: { text: string; highlight?: boolean }[];
  tip?: string;
  buttonText?: string;
}

const BLACKBOARD_CONTENT: Record<string, BlackboardData> = {
  'bb-welcome': {
    icon: <Sparkles className="w-8 h-8" />,
    title: "Hey, You Made It!",
    lines: [
      { text: "You're about to build your first product." },
      { text: "It takes about 2 minutes. No art degree required.", highlight: true },
      { text: "We'll walk you through every single step." },
      { text: "Ready? Let's do this." },
    ],
    tip: "Seriously, this is going to be fun. We promise.",
    buttonText: "Let's Go!",
  },
  'bb-channels': {
    icon: <Store className="w-8 h-8" />,
    title: "First Up: Channels",
    lines: [
      { text: "A channel is your personal storefront — like having your own little shop inside QR Gear." },
      { text: "You can create channels for different themes, events, or brands.", highlight: true },
      { text: "All of your products live inside a channel. Customers browse your channel to see what you've made." },
      { text: "Think: \"Summer Promo,\" \"Tech Events,\" or just \"My Cool Stuff.\"" },
    ],
    tip: "You can have as many channels as you want. Start with one — you can always add more later.",
  },
  'bb-pricing': {
    icon: <DollarSign className="w-8 h-8" />,
    title: "Let's Talk Earnings",
    lines: [
      { text: "On the next page, you'll pick a product. Each one shows an earnings amount — that's your starting number." },
      { text: "That number only goes up from here.", highlight: true },
      { text: "1. Pick a bigger size — your earnings go up." },
      { text: "2. Add text or graphics — your earnings go up." },
      { text: "3. Choose a premium QR type — your earnings go up." },
      { text: "We handle manufacturing and shipping. You just design and collect." },
    ],
    tip: "Think of the product price as your starting line. Every customization is a bonus.",
  },
  'bb-zones': {
    icon: <Palette className="w-8 h-8" />,
    title: "Colors & Your Mockup",
    lines: [
      { text: "Pick a color for your product mockup." },
      { text: "This is what shoppers see when browsing your store." },
      { text: "Don't overthink it — customers pick their own color at checkout.", highlight: true },
      { text: "All colors, same price. No gotchas." },
    ],
  },
  'bb-earnings': {
    icon: <Ruler className="w-8 h-8" />,
    title: "Size Matters (For Your Wallet)",
    lines: [
      { text: "Bigger sizes cost a tiny bit more to make." },
      { text: "That extra cost gets passed to the customer." },
      { text: "Which means... bigger sizes = bigger earnings for you.", highlight: true },
      { text: "Pick any size for your mockup. Customers choose theirs at checkout." },
    ],
    tip: "Watch the +$ bonus on each size button — that's your extra earnings.",
  },
  'bb-qr-intro': {
    icon: <QrCode className="w-8 h-8" />,
    title: "The Secret Sauce",
    lines: [
      { text: "This is what makes QR Gear different from everything else." },
      { text: "There are four QR types, and each one adds more to the experience." },
      { text: "We're going to walk through each one so you can pick the right fit.", highlight: true },
      { text: "You can off-ramp at any point — or keep going to see what's next." },
    ],
    tip: "No pressure. You can always upgrade your QR type later.",
  },
  'bb-whats-next': {
    icon: <Lightbulb className="w-8 h-8" />,
    title: "Almost There!",
    lines: [
      { text: "After this tutorial, you'll jump into the real builder." },
      { text: "The builder lets you customize everything in detail." },
      { text: "Upload images, add text, preview your product live.", highlight: true },
      { text: "Don't worry — you can always edit before publishing." },
    ],
    tip: "Think of this tutorial as your warm-up lap. The race starts next.",
  },
  'bb-finish': {
    icon: <PartyPopper className="w-8 h-8" />,
    title: "You Did It!",
    lines: [
      { text: "You just completed the guided walkthrough." },
      { text: "From here on out, things get faster and quieter.", highlight: true },
      { text: "You're all set! Create another product anytime." },
      { text: "The training wheels are coming off. You've got this." },
    ],
    tip: "After your first publish, Advanced and Studio modes unlock too.",
    buttonText: "Start",
  },
};

function BlackboardCard({
  data,
  onContinue,
}: {
  data: BlackboardData;
  onContinue: () => void;
}) {
  return (
    <div
      className="flex flex-col items-center justify-center px-2 animate-in fade-in duration-500"
      style={{ minHeight: 'calc(70vh - 80px)' }}
      data-testid="tutorial-blackboard"
    >
      <div className="w-full max-w-sm">
        <div className="relative overflow-hidden rounded-2xl border border-emerald-500/20">
          <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-emerald-950/30 to-slate-900" />
          <div
            className="absolute inset-0 opacity-[0.03]"
            style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
            }}
          />

          <div className="relative p-6 space-y-5">
            <div className="flex justify-center">
              <div className="p-3 rounded-full bg-emerald-500/20 text-emerald-400">
                {data.icon}
              </div>
            </div>

            <h2 className="text-xl font-bold text-white text-center">{data.title}</h2>

            <div className="space-y-3">
              {data.lines.map((line, i) => (
                <p
                  key={i}
                  className={`text-sm leading-relaxed text-center ${
                    line.highlight
                      ? 'text-emerald-200 font-medium'
                      : 'text-slate-300'
                  }`}
                >
                  {line.text}
                </p>
              ))}
            </div>

            {data.tip && (
              <div className="bg-emerald-500/10 rounded-lg p-3 flex items-start gap-2">
                <Sparkles className="w-3.5 h-3.5 text-amber-400 mt-0.5 flex-shrink-0" />
                <p className="text-xs text-amber-200/80 leading-relaxed">{data.tip}</p>
              </div>
            )}
          </div>
        </div>

        <Button
          onClick={onContinue}
          className="w-full mt-5 bg-emerald-600 text-white py-6 text-lg font-semibold"
          data-testid="tutorial-continue"
        >
          {data.buttonText || 'Continue'}
          <ArrowRight className="w-5 h-5 ml-2" />
        </Button>
      </div>
    </div>
  );
}

const QR_TYPE_CARDS: Record<string, {
  type: QRType;
  icon: React.ReactNode;
  iconBg: string;
  title: string;
  lines: { text: string; highlight?: boolean }[];
  tip: string;
  nextStep: string;
}> = {
  'bb-qr-basic': {
    type: 'qr-basic',
    icon: <QrCode className="w-8 h-8" />,
    iconBg: 'bg-slate-600',
    title: "QR Basic",
    lines: [
      { text: "The simplest option. A clean QR code that links anywhere you want." },
      { text: "No internet connection needed to scan — the destination is baked right into the code." },
      { text: "Perfect for linking to a website, menu, social profile, or contact info.", highlight: true },
      { text: "It's free of platform fees and works forever. Simple, reliable, done." },
    ],
    tip: "Great for getting started. You can always upgrade to a fancier type later.",
    nextStep: 'bb-qr-plus',
  },
  'bb-qr-plus': {
    type: 'qr-plus',
    icon: <Type className="w-8 h-8" />,
    iconBg: 'bg-blue-600',
    title: "QR Plus",
    lines: [
      { text: "Everything in Basic, plus custom header and footer text printed right on the product." },
      { text: "Like QR Basic, the content is baked right into the code — no server needed.", highlight: true },
      { text: "Add a tagline above, a call-to-action below. Make your merchandise say something." },
      { text: "People see your message before they even scan. That's powerful." },
    ],
    tip: "This is the sweet spot for most creators. Professional look, easy setup.",
    nextStep: 'bb-qr-canvas',
  },
  'bb-qr-canvas': {
    type: 'qr-canvas',
    icon: <ImagePlus className="w-8 h-8" />,
    iconBg: 'bg-purple-600',
    title: "QR Canvas",
    lines: [
      { text: "Now we're cooking. When someone scans, they see a full-screen image moment." },
      { text: "Upload a photo, design, or artwork — it becomes the landing experience.", highlight: true },
      { text: "Think product launches, event flyers, portfolio pieces, or promotional images." },
      { text: "Your QR code becomes a window into something visual and memorable." },
    ],
    tip: "Canvas moments are great for visual storytelling. Show, don't just link.",
    nextStep: 'bb-qr-play',
  },
  'bb-qr-play': {
    type: 'qr-play',
    icon: <Play className="w-8 h-8" />,
    iconBg: 'bg-rose-600',
    title: "QR Play",
    lines: [
      { text: "The showstopper. When someone scans, they watch a video." },
      { text: "Upload your own video or link one — it plays right on the landing page.", highlight: true },
      { text: "Perfect for tutorials, behind-the-scenes, music videos, product demos, or personal messages." },
      { text: "Imagine handing someone a t-shirt that plays a video. That's QR Play." },
    ],
    tip: "Video gets 10x more engagement than static content. Just saying.",
    nextStep: 'bb-qr-congrats',
  },
};

function QRTypeBlackboard({
  step,
  onChoose,
  onContinue,
}: {
  step: string;
  onChoose: (type: QRType) => void;
  onContinue: () => void;
}) {
  const card = QR_TYPE_CARDS[step];
  if (!card) return null;
  const isLast = step === 'bb-qr-play';

  return (
    <div
      className="flex flex-col items-center justify-center px-2 animate-in fade-in duration-500"
      style={{ minHeight: 'calc(70vh - 80px)' }}
      data-testid={`tutorial-qr-${card.type}`}
    >
      <div className="w-full max-w-sm">
        <div className="relative overflow-hidden rounded-2xl border border-emerald-500/20">
          <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-emerald-950/30 to-slate-900" />
          <div
            className="absolute inset-0 opacity-[0.03]"
            style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
            }}
          />

          <div className="relative p-6 space-y-5">
            <div className="flex justify-center">
              <div className={`p-3 rounded-full ${card.iconBg} text-white`}>
                {card.icon}
              </div>
            </div>

            <h2 className="text-xl font-bold text-white text-center">{card.title}</h2>

            <div className="space-y-3">
              {card.lines.map((line, i) => (
                <p
                  key={i}
                  className={`text-sm leading-relaxed text-center ${
                    line.highlight
                      ? 'text-emerald-200 font-medium'
                      : 'text-slate-300'
                  }`}
                >
                  {line.text}
                </p>
              ))}
            </div>

            <div className="bg-emerald-500/10 rounded-lg p-3 flex items-start gap-2">
              <Sparkles className="w-3.5 h-3.5 text-amber-400 mt-0.5 flex-shrink-0" />
              <p className="text-xs text-amber-200/80 leading-relaxed">{card.tip}</p>
            </div>
          </div>
        </div>

        <div className="mt-5 space-y-3">
          <Button
            onClick={() => onChoose(card.type)}
            className="w-full bg-emerald-600 text-white py-6 text-lg font-semibold"
            data-testid={`tutorial-choose-${card.type}`}
          >
            <Check className="w-5 h-5 mr-2" />
            Choose {card.title}
          </Button>
          {!isLast && (
            <Button
              onClick={onContinue}
              variant="outline"
              className="w-full py-5 text-base text-slate-300 border-slate-600"
              data-testid={`tutorial-show-more-${card.type}`}
            >
              Show Me More
              <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

const PRE_STEP_BLACKBOARDS: Record<string, string[]> = {
  'channel': ['bb-welcome', 'bb-channels'],
  'product': ['bb-pricing'],
  'color': ['bb-zones'],
  'size': ['bb-earnings'],
  'type': ['bb-qr-intro'],
};

const POST_STEP_BLACKBOARDS: Record<string, string[]> = {
  'channel': ['bb-channel-congrats'],
  'product-congrats': ['bb-product-congrats'],
  'color': ['bb-color-congrats'],
  'size': ['bb-size-congrats'],
};

const FINAL_CONFIRM_STEPS = ['qr-basic-confirm', 'qr-plus-confirm', 'canvas-confirm', 'play-save-choice', 'compose-confirm'];

function WizardSignInGate({ onSuccess, onCancel }: { onSuccess: () => void; onCancel: () => void }) {
  const [mode, setMode] = useState<'sign-in' | 'sign-up'>('sign-up');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const queryClient = useQueryClient();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    try {
      if (mode === 'sign-up') {
        await signUpWithEmail(email, password);
      } else {
        await signInWithEmail(email, password);
      }
      await queryClient.invalidateQueries({ queryKey: ['/api/auth/user'] });
      onSuccess();
    } catch (err: any) {
      if (err.code === 'auth/email-already-in-use') {
        setError('That email already has an account. Try signing in instead.');
      } else if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        setError('Invalid email or password');
      } else if (err.code === 'auth/weak-password') {
        setError('Password must be at least 6 characters');
      } else if (err.code === 'auth/too-many-requests') {
        setError('Too many attempts. Please try again later.');
      } else {
        setError(err.message || 'Something went wrong');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogle = async () => {
    setError('');
    setIsLoading(true);
    try {
      await signInWithGoogle();
      await queryClient.invalidateQueries({ queryKey: ['/api/auth/user'] });
      onSuccess();
    } catch (err: any) {
      if (err.code !== 'auth/popup-closed-by-user') {
        setError(err.message || 'Google sign in failed');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="text-center space-y-4">
      <div className="w-12 h-12 mx-auto mb-2 rounded-full bg-emerald-600/20 flex items-center justify-center">
        <Sparkles className="w-6 h-6 text-emerald-400" />
      </div>
      <h2 className="text-lg font-bold text-white">Your creation is ready!</h2>
      <p className="text-slate-400 text-sm">
        {mode === 'sign-up'
          ? 'Create a free account to publish it. Your work is saved right here — just sign up and it goes live.'
          : 'Sign in to publish your creation. Everything you built is right here waiting.'}
      </p>

      <form onSubmit={handleSubmit} className="space-y-3 text-left">
        {error && <div className="text-red-400 text-sm text-center bg-red-500/10 rounded-md p-2">{error}</div>}

        <div>
          <label className="text-slate-400 text-xs block mb-1">Email</label>
          <input
            type="email"
            autoComplete="email"
            className="w-full rounded-md bg-slate-800 border border-slate-600 text-white px-3 py-2 text-sm focus:outline-none focus:border-emerald-500"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            disabled={isLoading}
            data-testid="input-wizard-email"
          />
        </div>

        <div>
          <label className="text-slate-400 text-xs block mb-1">Password</label>
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              autoComplete={mode === 'sign-up' ? 'new-password' : 'current-password'}
              className="w-full rounded-md bg-slate-800 border border-slate-600 text-white px-3 py-2 text-sm pr-10 focus:outline-none focus:border-emerald-500"
              placeholder={mode === 'sign-up' ? 'Create a password' : 'Enter your password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={isLoading}
              data-testid="input-wizard-password"
            />
            <button
              type="button"
              className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400"
              onClick={() => setShowPassword(!showPassword)}
            >
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className="w-full rounded-md bg-emerald-500 hover:bg-emerald-600 text-white font-medium py-2 text-sm disabled:opacity-50 flex items-center justify-center gap-2"
          data-testid="button-wizard-auth-submit"
        >
          {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
          {mode === 'sign-up' ? 'Create Account & Publish' : 'Sign In & Publish'}
        </button>
      </form>

      <div className="flex items-center gap-2">
        <div className="flex-1 h-px bg-slate-700" />
        <span className="text-slate-500 text-xs">or</span>
        <div className="flex-1 h-px bg-slate-700" />
      </div>

      <button
        onClick={handleGoogle}
        disabled={isLoading}
        className="w-full rounded-md bg-slate-700 hover:bg-slate-600 text-white font-medium py-2 text-sm disabled:opacity-50"
        data-testid="button-wizard-google-auth"
      >
        Continue with Google
      </button>

      <p className="text-slate-500 text-xs">
        {mode === 'sign-up' ? (
          <>Already have an account?{' '}
            <button className="text-emerald-400 underline" onClick={() => { setMode('sign-in'); setError(''); }} data-testid="button-switch-to-signin">Sign in</button>
          </>
        ) : (
          <>Don't have an account?{' '}
            <button className="text-emerald-400 underline" onClick={() => { setMode('sign-up'); setError(''); }} data-testid="button-switch-to-signup">Create one</button>
          </>
        )}
      </p>

      <button
        onClick={onCancel}
        className="text-slate-500 text-xs underline"
        data-testid="button-wizard-auth-cancel"
      >
        Go back
      </button>
    </div>
  );
}

export function SuperSimpleWizard() {
  const {
    user,
    api,
    simpleStep, setSimpleStep,
    selectedChannel, setSelectedChannel,
    isCreatingChannel, setIsCreatingChannel,
    newChannelName, setNewChannelName,
    selectedProductType,
    selectedColor, setSelectedColor,
    selectedShirtSize, setSelectedShirtSize,
    graphicLocation,
    graphicSize, setGraphicSize,
    wantsHeaderFooter, setWantsHeaderFooter,
    currentPacketId, setCurrentPacketId,
    runningEarnings, setRunningEarnings,
    earningsPulse, setEarningsPulse,
    qrType, setQrType,
    isPublishing,
    headerStyle, setHeaderStyle,
    footerStyle, setFooterStyle,
    productGraphic, setProductGraphic,
    originalUrlGraphic, setOriginalUrlGraphic,
    urlGraphic, setUrlGraphic,
    videoUrl, setVideoUrl,
    textLayoutChoice, setTextLayoutChoice,
    selectedPlacements, setSelectedPlacements,
    qrGraphic, setQrGraphic,
    urlSourceChoice, setUrlSourceChoice,
    libraryChoice, setLibraryChoice,
    currentPlacementIndex,
    placementGraphicChoice, setPlacementGraphicChoice,
    perPlacementConfigs,
    currentPlacement,
    qrBasicInputType, setQrBasicInputType,
    qrBasicContent, setQrBasicContent,
    qrBasicMockup, setQrBasicMockup,
    isGeneratingBasicMockup,
    qrBasicSaveChoice, setQrBasicSaveChoice,
    isQrBasicSaving,
    canvasSaveChoice, setCanvasSaveChoice,
    isCanvasSaving,
    publishedQrGraphicUrl,
    publishedProductGraphicUrl,
    playVideoUrl, setPlayVideoUrl,
    isUploadingVideo,
    videoUploadError,
    videoUploadProgress,
    videoUploadSuccess,
    qrPlusMockup, setQrPlusMockup,
    isGeneratingPlusMockup, setIsGeneratingPlusMockup,
    qrPlusSaveChoice, setQrPlusSaveChoice,
    isQrPlusSaving,
    qrCanvasMockup,
    isGeneratingCanvasMockup,
    qrPlayMockup,
    isGeneratingPlayMockup,
    composeItems, setComposeItems,
    composeMode, setComposeMode,
    composeHostingTerm, setComposeHostingTerm,
    composeMockup,
    isGeneratingComposeMockup,
    publishedCanvasPlayItems,
    isLoadingPublishedItems,
    composeInstanceId,
    pricingSettings,
    placementEarningsBonus,
    textLineEarningsBonus,
    handleProductSelect,
    handleVideoFileUpload,
    handleCanvasDone,
    handleSimplePublish,
    handleSimpleNext,
    handleSimpleBack,
    canSimpleProceed,
    fetchPublishedCanvasPlayItems,
    setViewMode,
    setWizardTier,
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
    contentRightsConfirmed,
    setContentRightsConfirmed,
    qrPositionX, setQrPositionX,
    qrPositionY, setQrPositionY,
    qrSizePercent, setQrSizePercent,
    areaImageUrl, setAreaImageUrl,
    areaImageMode, setAreaImageMode,
    publishedPacketId,
    showSignInToPublish, setShowSignInToPublish,
  } = useWizardContext();

  const queryClient = useQueryClient();
  const autoPublishTriggered = useRef(false);

  useEffect(() => {
    if (showSignInToPublish && user?.id && !autoPublishTriggered.current) {
      autoPublishTriggered.current = true;
      setShowSignInToPublish(false);
      handleSimplePublish();
    }
    if (!showSignInToPublish) {
      autoPublishTriggered.current = false;
    }
  }, [showSignInToPublish, user?.id]);

  const [blackboardQueue, setBlackboardQueue] = useState<string[]>(['bb-welcome', 'bb-channels']);
  const [qrTypeExploreStep, setQrTypeExploreStep] = useState<string>('bb-qr-basic');
  const [showQrTypeCards, setShowQrTypeCards] = useState(false);
  const [seenSteps, setSeenSteps] = useState<Set<string>>(new Set(['channel']));
  const [pendingAdvance, setPendingAdvance] = useState(false);
  const [showFinishBlackboard, setShowFinishBlackboard] = useState(false);
  const [checkingTutorial, setCheckingTutorial] = useState(true);
  const [tutorialAlreadyDone, setTutorialAlreadyDone] = useState(false);
  const [showQrCongrats, setShowQrCongrats] = useState(false);

  useEffect(() => {
    if (!user?.id) {
      setCheckingTutorial(false);
      return;
    }
    const check = async () => {
      try {
        const docRef = doc(db, "member_profiles", user.id);
        const snap = await getDoc(docRef);
        if (snap.exists() && snap.data()?.tutorial_complete === true) {
          setTutorialAlreadyDone(true);
        }
      } catch {
      }
      setCheckingTutorial(false);
    };
    check();
  }, [user?.id]);

  useEffect(() => {
    if (tutorialAlreadyDone) {
      setBlackboardQueue([]);
      const allStepKeys = Object.keys(PRE_STEP_BLACKBOARDS).concat(Object.keys(POST_STEP_BLACKBOARDS));
      setSeenSteps(prev => {
        const next = new Set(prev);
        allStepKeys.forEach(k => next.add(k));
        return next;
      });
    }
  }, [tutorialAlreadyDone]);

  useEffect(() => {
    if (blackboardQueue.length === 0 && pendingAdvance) {
      setPendingAdvance(false);
      handleSimpleNext();
    }
  }, [blackboardQueue, pendingAdvance]);

  useEffect(() => {
    if (!seenSteps.has(simpleStep)) {
      const preCards = PRE_STEP_BLACKBOARDS[simpleStep];
      if (preCards) {
        setBlackboardQueue([...preCards]);
      }
      setSeenSteps(prev => new Set(prev).add(simpleStep));
    }
  }, [simpleStep]);

  const completeTutorial = async () => {
    try {
      if (user?.id) {
        await setDoc(
          doc(db, "member_profiles", user.id),
          { tutorial_complete: true, tutorial_completed_at: new Date().toISOString() },
          { merge: true }
        );
      }
    } catch (e) {
      console.error('Failed to save tutorial completion:', e);
    }
  };

  const handleBlackboardContinue = () => {
    if (blackboardQueue.length <= 1) {
      setBlackboardQueue([]);
      if (simpleStep === 'type' && blackboardQueue[0] === 'bb-qr-intro') {
        setShowQrTypeCards(true);
      }
    } else {
      setBlackboardQueue(prev => prev.slice(1));
    }
  };

  const handleQrTypeChosen = (type: QRType) => {
    setQrType(type);
    setShowQrTypeCards(false);
    setShowQrCongrats(true);
  };

  const handleQrTypeShowMore = () => {
    const card = QR_TYPE_CARDS[qrTypeExploreStep];
    if (card?.nextStep && QR_TYPE_CARDS[card.nextStep]) {
      setQrTypeExploreStep(card.nextStep);
    }
  };

  const handleSuperNext = async () => {
    if (FINAL_CONFIRM_STEPS.includes(simpleStep) && !seenSteps.has(`finish-${simpleStep}`)) {
      setSeenSteps(prev => new Set(prev).add(`finish-${simpleStep}`));
      await completeTutorial();
      setShowFinishBlackboard(true);
      return;
    }

    const postCards = POST_STEP_BLACKBOARDS[simpleStep];
    if (postCards && !seenSteps.has(`post-${simpleStep}`)) {
      setBlackboardQueue([...postCards]);
      setSeenSteps(prev => new Set(prev).add(`post-${simpleStep}`));
      setPendingAdvance(true);
      return;
    }
    await handleSimpleNext();
  };

  const getCongratsBlackboard = (stepId: string): BlackboardData | null => {
    switch (stepId) {
      case 'bb-channel-congrats':
        return {
          icon: <Check className="w-8 h-8" />,
          title: "Nice Work!",
          lines: [
            { text: selectedChannel
              ? `You picked "${selectedChannel.name}" — great choice!`
              : "You've got your channel set up!" },
            { text: "That's the first step in building your digital storefront.", highlight: true },
            { text: "Everything you create will live in this channel. Customers can browse it like a mini shop." },
            { text: "Next up: picking the product you want to sell. This is where it gets fun." },
          ],
          tip: "You're already ahead of most people. They're still reading the instructions.",
        };
      case 'bb-product-congrats':
        return {
          icon: <Package className="w-8 h-8" />,
          title: "Great Pick!",
          lines: [
            { text: selectedProductType
              ? `You chose the ${selectedProductType.title} — solid choice!`
              : "You've got your product locked in!" },
            { text: "Now you've got something real to work with.", highlight: true },
            { text: "Next we'll tailor it and make it uniquely yours — colors, size, and your own QR experience." },
            { text: "This is where your product starts to come alive." },
          ],
          tip: "Every choice you make from here adds your personal touch. Let's make it yours.",
        };
      case 'bb-color-congrats': {
        const base = selectedProductType?.memberEarnings || 0;
        return {
          icon: <Palette className="w-8 h-8" />,
          title: "Looking Good!",
          lines: [
            { text: selectedColor
              ? `Nice color choice! That's going to look great on your mockup.`
              : "Color is set!" },
            { text: `Your earnings so far: $${base.toFixed(2)} per sale`, highlight: true },
            { text: "Good news — color is free. It doesn't change the price at all." },
            { text: "But the next step will. Let's talk about size and how it bumps your earnings up." },
          ],
          tip: "That $" + base.toFixed(2) + " is just the floor. It's about to go higher.",
        };
      }
      case 'bb-size-congrats': {
        const base = selectedProductType?.memberEarnings || 0;
        const sizeBonuses = calculateSizeEarningsBonuses(
          pricingSettings?.sizeUpcharges,
          pricingSettings?.memberProfitShare || 0.25
        );
        const sizeBonus = sizeBonuses[selectedShirtSize] || 0;
        const newTotal = base + sizeBonus;
        return {
          icon: <TrendingUp className="w-8 h-8" />,
          title: "Cha-Ching!",
          lines: [
            { text: `Base earnings: $${base.toFixed(2)}` },
            { text: sizeBonus > 0
              ? `+ Size upgrade (${selectedShirtSize}): +$${sizeBonus.toFixed(2)}`
              : `Size (${selectedShirtSize}): no extra cost — same earnings` },
            { text: `= New total: $${newTotal.toFixed(2)} per sale`, highlight: true },
            { text: "See how that works? Every choice can add to your earnings." },
            { text: "Next up: your QR type. Some of those add even more value." },
          ],
        };
      }
      default:
        return null;
    }
  };

  const getQrCongratsBlackboard = (): BlackboardData => {
    const base = selectedProductType?.memberEarnings || 0;
    const sizeBonuses = calculateSizeEarningsBonuses(
      pricingSettings?.sizeUpcharges,
      pricingSettings?.memberProfitShare || 0.25
    );
    const sizeBonus = sizeBonuses[selectedShirtSize] || 0;
    const currentTotal = base + sizeBonus;
    const typeLabel = qrType === 'qr-basic' ? 'QR Basic' : qrType === 'qr-plus' ? 'QR Plus' : qrType === 'qr-canvas' ? 'QR Canvas' : qrType === 'qr-play' ? 'QR Play' : 'your QR type';
    const isPlatformType = qrType === 'qr-canvas' || qrType === 'qr-play';
    const isBasic = qrType === 'qr-basic';
    const isPlus = qrType === 'qr-plus';

    const getLines = () => {
      const shared = [
        { text: `You picked ${typeLabel} — great choice!` },
        { text: `Your earnings per sale: $${currentTotal.toFixed(2)}`, highlight: true as boolean },
      ];

      if (isBasic) {
        return [
          ...shared,
          { text: "QR Basic is simple and powerful. The QR code bakes your content right in — no server, no platform, no ongoing costs." },
          { text: "Someone scans it, they get your link, text, or contact info instantly. Done." },
          { text: "Want to level up later? QR Canvas and QR Play connect to a living platform where you can change what the QR shows — even after the shirt is printed." },
        ];
      }

      if (isPlus) {
        return [
          ...shared,
          { text: "QR Plus adds your custom header and footer text around the QR code — it makes the design pop and tells people what to expect when they scan." },
          { text: "Like Basic, the QR content is baked in. No server needed, no ongoing costs." },
          { text: "Ready for the next level? QR Canvas and QR Play connect to a living platform — you can update what the QR shows anytime, even after the shirt ships." },
        ];
      }

      return [
        ...shared,
        { text: "When you save this, you're creating a \"moment\" — a unique experience tied to your QR code." },
        { text: qrType === 'qr-canvas'
          ? "Your image becomes a living page anyone can see when they scan."
          : "Your video becomes a living page anyone can watch when they scan."
        },
        { text: "Here's the exciting part: save 2 or more moments and you unlock QR Compose.", highlight: true as boolean },
        { text: "QR Compose lets you build a rotating playlist — one QR code, many experiences. Imagine your shirt showing something different every time someone scans it." },
      ];
    };

    const getTip = () => {
      if (isBasic || isPlus) {
        return "Simple, reliable, and ready to sell. You can always explore Canvas and Play later to unlock even more possibilities.";
      }
      return "Every moment you save gets you closer to QR Compose. Think of it as building your collection.";
    };

    return {
      icon: <QrCode className="w-8 h-8" />,
      title: isPlatformType ? "Save the Moment!" : "Nice and Simple!",
      lines: getLines(),
      tip: getTip(),
    };
  };

  const sharePacketId = publishedPacketId || currentPacketId || '';
  const getShareKitData = () => ({
    packetId: sharePacketId,
    shareUrl: `/p/${sharePacketId}`,
    title: simpleTitle || 'QR Gear Product',
    description: simpleDescription || '',
    memberId: user?.id || '',
    itemImage: qrCanvasMockup || qrBasicMockup || qrPlusMockup || qrPlayMockup || composeMockup || productGraphic || '',
    previewUrl: productGraphic || urlGraphic || '',
    retailPrice: selectedProductType?.retailPrice || 0,
    channelName: selectedChannel?.name || '',
  });

  const handleCreateAnother = () => {
    setSimpleStep('channel');
    setCurrentPacketId(null);
    setSimpleTitle('');
    setSimpleDescription('');
    setQrType('');
    setContentRightsConfirmed(false);
    setUrlGraphic('');
    setProductGraphic('');
  };

  const handleBackToDashboard = () => {
    setSimpleStep('channel');
    setViewMode('index');
    setCurrentPacketId(null);
    setSimpleTitle('');
    setSimpleDescription('');
    setQrType('');
    setContentRightsConfirmed(false);
    setUrlGraphic('');
    setProductGraphic('');
  };


  if (checkingTutorial) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-400" />
      </div>
    );
  }

  if (showFinishBlackboard) {
    return (
      <Card className="bg-slate-800/50 border-slate-700">
        <CardHeader className="pb-1 pt-3 flex flex-row items-center justify-between gap-2">
          <p className="text-xs text-emerald-400 flex items-center gap-1">
            <Sparkles className="w-3 h-3" />
            First Product Builder
          </p>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setViewMode('index')}
            className="text-white/50 hover:text-white"
            aria-label="Close wizard"
            data-testid="super-simple-close-finish"
          >
            <X className="w-4 h-4" />
          </Button>
        </CardHeader>
        <CardContent className="p-4 pt-1">
          <BlackboardCard
            data={BLACKBOARD_CONTENT['bb-finish']}
            onContinue={() => {
              setShowFinishBlackboard(false);
              setViewMode('index');
            }}
          />
        </CardContent>
      </Card>
    );
  }

  const canProceed = canSimpleProceed();
  const isShowingBlackboard = blackboardQueue.length > 0;
  const currentBlackboardId = blackboardQueue[0] || null;

  return (
    <Card className="bg-slate-800/50 border-slate-700">
      <CardHeader className="pb-1 pt-3 flex flex-row items-center justify-between gap-2">
        <p className="text-xs text-emerald-400 flex items-center gap-1">
          <Sparkles className="w-3 h-3" />
          First Product Builder
        </p>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setViewMode('index')}
          className="text-white/50 hover:text-white"
          aria-label="Close wizard"
          data-testid="super-simple-close"
        >
          <X className="w-4 h-4" />
        </Button>
      </CardHeader>
      <CardContent className="p-4 pt-1">
        {(() => {
          const getTierInfo = () => {
            if (['play-upload', 'play-preview', 'play-save-choice'].includes(simpleStep)) {
              return { label: 'QR Play', color: 'text-purple-400 bg-purple-500/10 border-purple-500/20' };
            }
            if (['canvas-upload', 'canvas-crop', 'canvas-preview', 'canvas-save-choice', 'canvas-confirm', 'url-bg-pick', 'url-bg-crop', 'url-title', 'url-description', 'url-preview', 'url-publish'].includes(simpleStep)) {
              return { label: 'QR Canvas', color: 'text-blue-400 bg-blue-500/10 border-blue-500/20' };
            }
            if (['text-choice', 'text-edit-header', 'text-edit-footer', 'placement-config', 'shirt-preview', 'qr-plus-mockup', 'qr-plus-save-choice', 'qr-plus-confirm'].includes(simpleStep)) {
              return { label: 'QR Plus', color: 'text-orange-400 bg-orange-500/10 border-orange-500/20' };
            }
            if (['qr-basic-type', 'qr-basic-input', 'qr-basic-mockup', 'qr-basic-save-choice', 'qr-basic-confirm'].includes(simpleStep)) {
              return { label: 'QR Basic', color: 'text-slate-300 bg-slate-500/10 border-slate-500/20' };
            }
            if (['compose-pick-items', 'compose-mode', 'compose-durations', 'compose-order', 'compose-hosting', 'compose-mockup', 'compose-preview', 'compose-publish', 'compose-confirm'].includes(simpleStep)) {
              return { label: 'QR Compose', color: 'text-amber-400 bg-amber-500/10 border-amber-500/20' };
            }
            return { label: 'QR Basic', color: 'text-slate-300 bg-slate-500/10 border-slate-500/20' };
          };
          const tier = getTierInfo();
          return !isShowingBlackboard && !showQrTypeCards && !showQrCongrats && tier ? (
            <div className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full border mb-2 ${tier.color}`} data-testid="badge-tier-label">
              {tier.label}
            </div>
          ) : null;
        })()}

        {!isShowingBlackboard && !showQrTypeCards && !showQrCongrats && (
          <SimpleWizardProgressBar currentStep={simpleStep} currentPlacement={currentPlacement} />
        )}

        {!isShowingBlackboard && !showQrTypeCards && !showQrCongrats && runningEarnings > 0 && (
          <div className={`flex items-center justify-center gap-2 mb-3 py-1.5 px-3 rounded-full bg-emerald-500/10 border border-emerald-500/20 mx-auto w-fit animate-in fade-in duration-500 transition-all ${earningsPulse ? 'scale-110 border-emerald-400/60 bg-emerald-500/20' : ''}`} data-testid="badge-potential-earnings">
            <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
            <span className="text-emerald-400 font-bold text-sm">
              ${runningEarnings.toFixed(2)} potential earnings
            </span>
          </div>
        )}

        <div className="min-h-[350px]" id="wizard-step-content">
          {isShowingBlackboard && currentBlackboardId && (() => {
            const congratsData = getCongratsBlackboard(currentBlackboardId);
            if (congratsData) {
              return <BlackboardCard data={congratsData} onContinue={handleBlackboardContinue} />;
            }
            const staticData = BLACKBOARD_CONTENT[currentBlackboardId];
            if (staticData) {
              return <BlackboardCard data={staticData} onContinue={handleBlackboardContinue} />;
            }
            return null;
          })()}

          {showQrCongrats && !isShowingBlackboard && (
            <BlackboardCard
              data={getQrCongratsBlackboard()}
              onContinue={() => {
                setShowQrCongrats(false);
                setBlackboardQueue(['bb-whats-next']);
                setPendingAdvance(true);
              }}
            />
          )}

          {showQrTypeCards && !isShowingBlackboard && !showQrCongrats && (
            <QRTypeBlackboard
              step={qrTypeExploreStep}
              onChoose={handleQrTypeChosen}
              onContinue={handleQrTypeShowMore}
            />
          )}

          {!isShowingBlackboard && !showQrTypeCards && !showQrCongrats && (
            <>
              {showSignInToPublish ? (
                <WizardSignInGate
                  onSuccess={() => {}}
                  onCancel={() => setShowSignInToPublish(false)}
                />
              ) : (<>

              {simpleStep === 'channel' && user?.id && (
                <ChannelStep
                  selectedChannel={selectedChannel}
                  onSelect={setSelectedChannel}
                  memberId={user.id}
                  isCreatingChannel={isCreatingChannel}
                  setIsCreatingChannel={setIsCreatingChannel}
                  newChannelName={newChannelName}
                  setNewChannelName={setNewChannelName}
                />
              )}
              {simpleStep === 'channel' && !user?.id && (
                <div className="animate-in fade-in slide-in-from-right-5 duration-300">
                  <div className="text-center mb-6">
                    <h2 className="text-lg font-bold text-white mb-2">Choose Your Channel</h2>
                    <p className="text-sm text-white/60">Channels organize your products</p>
                  </div>
                  <div className="space-y-3">
                    <div
                      className="p-3 rounded-lg border border-emerald-500/50 bg-emerald-500/10 cursor-pointer"
                      onClick={() => setSelectedChannel({ id: 'temp-channel', name: newChannelName || 'My Products' })}
                      data-testid="channel-temp-default"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center">
                          <Store className="w-4 h-4 text-emerald-400" />
                        </div>
                        <div>
                          <p className="text-white font-medium text-sm">{newChannelName || 'My Products'}</p>
                          <p className="text-white/50 text-xs">Your first channel</p>
                        </div>
                        {selectedChannel && <Check className="w-4 h-4 text-emerald-400 ml-auto" />}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {simpleStep === 'product' && (
                <TierPickerStep
                  selectedProduct={selectedProductType}
                  onSelect={handleProductSelect}
                  context="member"
                />
              )}

              {simpleStep === 'product-congrats' && selectedProductType && (
                <ProductCongratsStep
                  productName={selectedProductType.title}
                  earnings={selectedProductType.memberEarnings || 0}
                />
              )}

              {simpleStep === 'color' && (
                <ColorPickerStep
                  selectedColor={selectedColor}
                  onSelect={setSelectedColor}
                  productName={getProductFriendlyName(selectedProductType?.title)}
                />
              )}

              {simpleStep === 'size' && (() => {
                const sizeEarningsBonuses = calculateSizeEarningsBonuses(
                  pricingSettings?.sizeUpcharges,
                  pricingSettings?.memberProfitShare || 0.25
                );
                return (
                  <SizePickerStep
                    selectedSize={selectedShirtSize}
                    selectedColor={selectedColor}
                    baseEarnings={runningEarnings}
                    sizeEarningsBonuses={sizeEarningsBonuses}
                    selectedPlacements={selectedPlacements}
                    productName={getProductFriendlyName(selectedProductType?.title)}
                    onSelect={(size) => {
                      const oldBonus = sizeEarningsBonuses[selectedShirtSize] || 0;
                      const newBonus = sizeEarningsBonuses[size] || 0;
                      const earningsDiff = newBonus - oldBonus;

                      setSelectedShirtSize(size);

                      const doUpdate = () => {
                        if (selectedShirtSize && earningsDiff !== 0) {
                          setRunningEarnings(prev => prev + earningsDiff);
                        } else if (!selectedShirtSize) {
                          setRunningEarnings(prev => prev + newBonus);
                        }
                        setEarningsPulse(true);
                        setTimeout(() => setEarningsPulse(false), 600);
                      };

                      if (size !== selectedShirtSize) {
                        setTimeout(doUpdate, 1200);
                      } else {
                        doUpdate();
                      }
                    }}
                  />
                );
              })()}

              {simpleStep === 'type' && (
                <TypePickerStep
                  selectedType={qrType}
                  onSelect={setQrType}
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
                    onYes={() => {
                      setWantsHeaderFooter(true);
                      setQrType('qr-plus');
                      setSimpleStep('text-choice');
                    }}
                    onNo={() => {
                      setWantsHeaderFooter(false);
                      if (qrType === 'qr-basic') {
                        setSimpleStep('qr-basic-type');
                      } else {
                        setSimpleStep('canvas-fork');
                      }
                    }}
                  />
                </div>
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
                <QRBasicMockupStep
                  mockupUrl={qrBasicMockup}
                  isLoading={isGeneratingBasicMockup}
                  selectedColor={selectedColor}
                  selectedSize={selectedShirtSize}
                  inputType={qrBasicInputType}
                  content={qrBasicContent}
                  qrPositionX={qrPositionX}
                  qrPositionY={qrPositionY}
                  qrSizePercent={qrSizePercent}
                  onPositionXChange={setQrPositionX}
                  onPositionYChange={setQrPositionY}
                  onSizeChange={setQrSizePercent}
                  areaImageUrl={areaImageUrl}
                  areaImageMode={areaImageMode}
                  onAreaImageUrlChange={setAreaImageUrl}
                  onAreaImageModeChange={setAreaImageMode}
                />
              )}

              {simpleStep === 'qr-basic-save-choice' && (
                <QRBasicSaveChoiceStep
                  selected={qrBasicSaveChoice}
                  onSelect={(choice) => setQrBasicSaveChoice(choice)}
                />
              )}

              {simpleStep === 'qr-basic-confirm' && (
                <div className="space-y-4">
                  <QRBasicConfirmStep
                    saveChoice={qrBasicSaveChoice}
                    mockupUrl={qrBasicMockup}
                    qrContent={qrBasicContent}
                    isSaving={isQrBasicSaving}
                    onDone={() => {
                      setSimpleStep('channel');
                      setViewMode('index');
                      setCurrentPacketId(null);
                      setQrBasicInputType('');
                      setQrBasicContent('');
                      setQrBasicMockup('');
                      setQrBasicSaveChoice('');
                    }}
                  />
                  {sharePacketId && (
                    <ShareKitHandoff
                      data={getShareKitData()}
                      onCreateAnother={handleCreateAnother}
                      onBackToDashboard={handleBackToDashboard}
                    />
                  )}
                </div>
              )}

              {simpleStep === 'qr-plus-mockup' && (
                <QRPlusMockupStep
                  mockupUrl={qrPlusMockup}
                  isLoading={isGeneratingPlusMockup}
                  selectedColor={selectedColor}
                  selectedSize={selectedShirtSize}
                  headerText={headerStyle.text}
                  footerText={footerStyle.text}
                />
              )}

              {simpleStep === 'qr-plus-save-choice' && (
                <QRPlusSaveChoiceStep
                  selected={qrPlusSaveChoice}
                  onSelect={(choice) => setQrPlusSaveChoice(choice)}
                />
              )}

              {simpleStep === 'qr-plus-confirm' && (
                <div className="space-y-4">
                  <QRPlusConfirmStep
                    saveChoice={qrPlusSaveChoice}
                    mockupUrl={qrPlusMockup}
                    productGraphicUrl={productGraphic}
                    qrGraphicUrl={qrGraphic}
                    isSaving={isQrPlusSaving}
                    onDone={() => {
                      setSimpleStep('channel');
                      setViewMode('index');
                      setCurrentPacketId(null);
                      setQrPlusMockup('');
                      setQrPlusSaveChoice('');
                      setQrGraphic('');
                      setProductGraphic('');
                    }}
                  />
                  {sharePacketId && (
                    <ShareKitHandoff
                      data={getShareKitData()}
                      onCreateAnother={handleCreateAnother}
                      onBackToDashboard={handleBackToDashboard}
                    />
                  )}
                </div>
              )}

              {simpleStep === 'text-choice' && (
                <div className="space-y-2">
                  <TextLayoutChoiceStep
                    selected={textLayoutChoice}
                    textLineEarningsBonus={textLineEarningsBonus}
                    onSelect={(choice) => {
                      const prevLines = textLayoutChoice === 'both' ? 2 : (textLayoutChoice === 'header' || textLayoutChoice === 'footer') ? 1 : 0;
                      const newLines = choice === 'both' ? 2 : 1;
                      const diff = newLines - prevLines;
                      if (diff !== 0) {
                        setRunningEarnings(prev => prev + (diff * textLineEarningsBonus));
                      }
                      setTextLayoutChoice(choice);
                    }}
                  />
                </div>
              )}

              {simpleStep === 'placement-count' && (
                <PlacementCountStep
                  selected={selectedPlacements}
                  onToggle={(placement) => {
                    const isRemoving = selectedPlacements.includes(placement);
                    const currentCount = selectedPlacements.length;

                    if (isRemoving) {
                      if (currentCount > 1) {
                        setRunningEarnings(prev => prev - placementEarningsBonus);
                      }
                      setSelectedPlacements(prev => prev.filter(p => p !== placement));
                    } else {
                      if (currentCount >= 1) {
                        setRunningEarnings(prev => prev + placementEarningsBonus);
                      }
                      setSelectedPlacements(prev => [...prev, placement]);
                    }
                  }}
                  selectedColor={selectedColor}
                  placementEarningsBonus={placementEarningsBonus}
                  productPlacements={selectedProductType?.placements}
                />
              )}

              {simpleStep === 'text-edit-header' && (
                <HeaderTextEditStep
                  selectedColor={selectedColor}
                  graphicSize={graphicSize}
                  graphicLocation={graphicLocation}
                  headerStyle={headerStyle}
                  onHeaderChange={setHeaderStyle}
                  earningsPerLine={textLineEarningsBonus}
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
                  earningsPerLine={textLineEarningsBonus}
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
                  qrPositionX={qrPositionX}
                  qrPositionY={qrPositionY}
                  qrSizePercent={qrSizePercent}
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
                  qrPositionX={qrPositionX}
                  qrPositionY={qrPositionY}
                  qrSizePercent={qrSizePercent}
                  areaImageUrl={areaImageUrl}
                  areaImageMode={areaImageMode}
                  perPlacementConfigs={perPlacementConfigs}
                />
              )}

              {simpleStep === 'compose-explainer' && (
                <ComposeExplainerCard
                  publishedItemCount={publishedCanvasPlayItems.length}
                  onCreateMoment={() => {
                    setSimpleStep('canvas-fork');
                  }}
                  onBack={() => {
                    setSimpleStep('canvas-fork');
                  }}
                />
              )}

              {simpleStep === 'platform-acknowledge' && (
                <PlatformAcknowledgementCard
                  momentCount={publishedCanvasPlayItems.length}
                  onContinue={() => {
                    setSimpleStep('canvas-fork');
                  }}
                  onManageMoments={() => {
                    setViewMode('channels');
                  }}
                />
              )}

              {simpleStep === 'canvas-fork' && (
                <SurfacePickerStep
                  onCanvas={() => {
                    setQrType('qr-canvas');
                    setSimpleStep('url-explainer');
                  }}
                  onPlay={() => {
                    setQrType('qr-play');
                    setSimpleStep('play-video-source');
                  }}
                  onCompose={() => {
                    if (publishedCanvasPlayItems.length < 2) {
                      setSimpleStep('compose-explainer');
                      return;
                    }
                    setQrType('qr-compose');
                    fetchPublishedCanvasPlayItems();
                    setSimpleStep('compose-pick-items');
                  }}
                  publishedItemCount={publishedCanvasPlayItems.length}
                  onSkip={async () => {
                    setQrType('qr-plus');
                    setIsGeneratingPlusMockup(true);
                    setSimpleStep('qr-plus-mockup');

                    try {
                      const previewUrl = `${window.location.origin}/preview/${Date.now()}`;
                      const qrApiUrl = generateQRCodeUrl(previewUrl, 200);
                      setQrGraphic(qrApiUrl);
                      console.log('[QR Plus] Generated qrGraphic:', qrApiUrl);

                      console.log('[QR Plus] Generating productGraphic with:');
                      console.log('[QR Plus]   textLayoutChoice:', textLayoutChoice);
                      console.log('[QR Plus]   headerStyle:', JSON.stringify({
                        text: headerStyle.text,
                        enabled: headerStyle.enabled,
                        color: headerStyle.color,
                        fontFamily: headerStyle.fontFamily,
                        fontSize: headerStyle.fontSize,
                      }));
                      console.log('[QR Plus]   footerStyle:', JSON.stringify({
                        text: footerStyle.text,
                        enabled: footerStyle.enabled,
                        color: footerStyle.color,
                        fontFamily: footerStyle.fontFamily,
                        fontSize: footerStyle.fontSize,
                      }));
                      const productGraphicResult = await api.generateProductGraphic({
                        qrUrl: previewUrl,
                        headerStyle: headerStyle,
                        footerStyle: footerStyle,
                        textLayoutChoice: textLayoutChoice,
                        qrColor: 'black',
                      });

                      console.log('[QR Plus] productGraphicResult:', JSON.stringify({
                        success: productGraphicResult.success,
                        hasProductGraphic: !!productGraphicResult.productGraphic,
                        productGraphicLength: productGraphicResult.productGraphic?.length || 0,
                        error: productGraphicResult.error,
                      }));

                      if (productGraphicResult.success && productGraphicResult.productGraphic) {
                        setProductGraphic(productGraphicResult.productGraphic);
                        console.log('[QR Plus] Generated productGraphic (composite), length:', productGraphicResult.productGraphic.length);
                      } else {
                        console.warn('[QR Plus] productGraphic generation failed, using qrGraphic as fallback');
                        console.warn('[QR Plus] Fallback reason - success:', productGraphicResult.success, 'hasGraphic:', !!productGraphicResult.productGraphic);
                        setProductGraphic(qrApiUrl);
                      }

                      const isPrintfulPlus = selectedProductType?.fulfillmentProvider === 'printful';
                      if (selectedProductType?.blueprintId && (selectedProductType?.printProviderId || isPrintfulPlus) && selectedColor) {
                        const effectiveQrSize = (graphicSize === 'small' || graphicSize === 'medium' || graphicSize === 'large') ? graphicSize : 'medium';
                        console.log('[QR Plus] Generating mockup with graphicSize:', graphicSize, '\u2192 effectiveQrSize:', effectiveQrSize, 'provider:', isPrintfulPlus ? 'printful' : 'printify');

                        const artworkForMockup = productGraphicResult.success && productGraphicResult.productGraphic
                          ? productGraphicResult.productGraphic
                          : qrApiUrl;

                        const mockupResult = await api.generateMockup({
                          blueprintId: selectedProductType.blueprintId,
                          printProviderId: selectedProductType.printProviderId || 99,
                          colorName: selectedColor,
                          artworkUrl: artworkForMockup,
                          placement: 'front',
                          qrSize: effectiveQrSize,
                          fulfillmentProvider: isPrintfulPlus ? 'printful' : 'printify',
                        });

                        console.log('[QR Plus] Mockup API Response:', JSON.stringify(mockupResult, null, 2));

                        const bestUrl = mockupResult.lifestyleMockupUrl || mockupResult.mockupUrl;

                        if (mockupResult.success && bestUrl) {
                          console.log('[QR Plus] SUCCESS - Setting qrPlusMockup to:', bestUrl);
                          setQrPlusMockup(bestUrl);
                        } else {
                          console.warn('[QR Plus] FAILED - Using QR fallback. Error:', mockupResult.error);
                          setQrPlusMockup(qrApiUrl);
                        }
                      } else {
                        console.warn('[QR Plus] Missing product info for mockup');
                        setQrPlusMockup(qrApiUrl);
                      }
                    } catch (error) {
                      console.error('[QR Plus] Error generating mockup:', error);
                      const fallbackUrl = generateQRCodeUrl('placeholder', 200);
                      setQrPlusMockup(fallbackUrl);
                    } finally {
                      setIsGeneratingPlusMockup(false);
                    }
                  }}
                />
              )}

              {simpleStep === 'url-explainer' && (
                <QRCanvasExplainerStep
                  onUploadClick={() => {
                    setUrlSourceChoice('upload');
                    setSimpleStep('url-library-pick');
                  }}
                  onLibraryClick={() => {
                    setUrlSourceChoice('library');
                    setSimpleStep('url-source-choice');
                  }}
                />
              )}

              {simpleStep === 'url-source-choice' && (
                <UrlSourceChoiceStep
                  choice={libraryChoice}
                  onChoiceChange={setLibraryChoice}
                />
              )}

              {simpleStep === 'url-library-pick' && (
                <SimpleBackgroundStep
                  memberId={user?.id || ''}
                  background={urlGraphic}
                  onBackgroundSelected={(croppedUrl, originalUrl, needsCrop) => {
                    setUrlGraphic(croppedUrl);
                    setOriginalUrlGraphic(originalUrl);
                  }}
                  onComplete={() => setSimpleStep('url-title')}
                  initialSubStep={
                    urlSourceChoice === 'upload' ? 'upload' :
                    libraryChoice === 'personal' ? 'personal-library' :
                    libraryChoice === 'common' ? 'common-library' : 'choice'
                  }
                  croppedOnly={libraryChoice === 'personal'}
                />
              )}

              {simpleStep === 'url-title' && (
                <UrlTitleStep
                  title={simpleTitle}
                  onTitleChange={setSimpleTitle}
                  background={urlGraphic}
                  description={simpleDescription}
                  titleVertical={titleVertical}
                  titleHorizontal={titleHorizontal}
                  titleColor={titleColor}
                  titleSize={titleSize}
                  titleFont={titleFont}
                  descVertical={descVertical}
                  descHorizontal={descHorizontal}
                  descColor={descColor}
                  descSize={descSize}
                  descFont={descFont}
                  onTitleVerticalChange={setTitleVertical}
                  onTitleHorizontalChange={setTitleHorizontal}
                  onTitleColorChange={setTitleColor}
                  onTitleSizeChange={setTitleSize}
                  onTitleFontChange={setTitleFont}
                />
              )}

              {simpleStep === 'url-description' && (
                <UrlDescriptionStep
                  title={simpleTitle}
                  description={simpleDescription}
                  onDescriptionChange={setSimpleDescription}
                  background={urlGraphic}
                  titleVertical={titleVertical}
                  titleHorizontal={titleHorizontal}
                  titleColor={titleColor}
                  titleSize={titleSize}
                  titleFont={titleFont}
                  descVertical={descVertical}
                  descHorizontal={descHorizontal}
                  descColor={descColor}
                  descSize={descSize}
                  descFont={descFont}
                  onDescVerticalChange={setDescVertical}
                  onDescHorizontalChange={setDescHorizontal}
                  onDescColorChange={setDescColor}
                  onDescSizeChange={setDescSize}
                  onDescFontChange={setDescFont}
                />
              )}

              {simpleStep === 'url-preview' && (
                <SimplePreviewStep
                  background={urlGraphic}
                  title={simpleTitle}
                  description={simpleDescription}
                  titleVertical={titleVertical}
                  titleHorizontal={titleHorizontal}
                  titleColor={titleColor}
                  titleSize={titleSize}
                  titleFont={titleFont}
                  descVertical={descVertical}
                  descHorizontal={descHorizontal}
                  descColor={descColor}
                  descSize={descSize}
                  descFont={descFont}
                  onGoBack={() => setSimpleStep('url-description')}
                />
              )}

              {simpleStep === 'canvas-mockup' && (
                <QRPlusMockupStep
                  mockupUrl={qrCanvasMockup}
                  isLoading={isGeneratingCanvasMockup}
                  selectedColor={selectedColor}
                  selectedSize={selectedShirtSize}
                  headerText={headerStyle.enabled ? headerStyle.text : undefined}
                  footerText={footerStyle.enabled ? footerStyle.text : undefined}
                />
              )}

              {simpleStep === 'url-publish' && (
                <SimplePublishStep
                  isPublishing={isPublishing}
                  onPublish={handleSimplePublish}
                  title={simpleTitle}
                  description={simpleDescription}
                  qrType={qrType}
                  background={urlGraphic}
                  titleVertical={titleVertical}
                  titleHorizontal={titleHorizontal}
                  titleColor={titleColor}
                  titleSize={titleSize}
                  titleFont={titleFont}
                  descVertical={descVertical}
                  descHorizontal={descHorizontal}
                  descColor={descColor}
                  descSize={descSize}
                  descFont={descFont}
                />
              )}

              {simpleStep === 'canvas-save-choice' && (
                <QRCanvasSaveChoiceStep
                  selected={canvasSaveChoice}
                  onSelect={setCanvasSaveChoice}
                />
              )}

              {simpleStep === 'canvas-confirm' && (
                <div className="space-y-4">
                  <QRCanvasConfirmStep
                    saveChoice={'all'}
                    productGraphicUrl={publishedProductGraphicUrl}
                    backgroundUrl={urlGraphic}
                    qrGraphicUrl={publishedQrGraphicUrl}
                    isSaving={isCanvasSaving}
                    onDone={handleCanvasDone}
                  />
                  {sharePacketId && (
                    <ShareKitHandoff
                      data={getShareKitData()}
                      onCreateAnother={handleCreateAnother}
                      onBackToDashboard={handleBackToDashboard}
                    />
                  )}
                </div>
              )}

              {simpleStep === 'play-video-source' && (
                <PlayVideoSourceStep
                  videoUrl={playVideoUrl}
                  onVideoUrlChange={(url) => {
                    setPlayVideoUrl(url);
                    setVideoUrl(url);
                  }}
                  onFileUpload={handleVideoFileUpload}
                  isUploading={isUploadingVideo}
                  uploadError={videoUploadError}
                  uploadProgress={videoUploadProgress}
                  uploadSuccess={videoUploadSuccess}
                  contentRightsConfirmed={contentRightsConfirmed}
                  onContentRightsToggle={() => setContentRightsConfirmed(!contentRightsConfirmed)}
                />
              )}

              {simpleStep === 'play-preview' && (
                <PlayPreviewStep
                  videoUrl={playVideoUrl}
                  title={simpleTitle}
                />
              )}

              {simpleStep === 'play-mockup' && (
                <QRPlusMockupStep
                  mockupUrl={qrPlayMockup}
                  isLoading={isGeneratingPlayMockup}
                  selectedColor={selectedColor}
                  selectedSize={selectedShirtSize}
                  headerText={headerStyle.enabled ? headerStyle.text : undefined}
                  footerText={footerStyle.enabled ? footerStyle.text : undefined}
                />
              )}

              {simpleStep === 'play-publish' && (
                <PlayPublishStep
                  videoUrl={playVideoUrl}
                  isPublishing={isPublishing}
                />
              )}

              {simpleStep === 'play-save-choice' && (
                <div className="space-y-4">
                  <PlayPublishedStep />
                  {sharePacketId && (
                    <ShareKitHandoff
                      data={getShareKitData()}
                      onCreateAnother={handleCreateAnother}
                      onBackToDashboard={handleBackToDashboard}
                    />
                  )}
                </div>
              )}

              {simpleStep === 'compose-mode' && (
                <ComposeModePicker
                  selected={composeMode}
                  onSelect={setComposeMode}
                />
              )}

              {simpleStep === 'compose-pick-items' && (
                <ComposePickItemsStep
                  availableItems={publishedCanvasPlayItems}
                  selectedItems={composeItems}
                  onToggleItem={(item: any) => {
                    const packetId = item.packetId || item.id;
                    const existing = composeItems.find(i => i.packetId === packetId);
                    if (existing) {
                      setComposeItems(prev => prev.filter(i => i.packetId !== packetId));
                    } else {
                      setComposeItems(prev => [...prev, {
                        packetId,
                        name: item.title || item.name || 'Untitled',
                        thumbnailUrl: item.itemImage || item.qrCanvasMockup || item.qrPlayMockup || item.composeMockup || item.urlGraphic || item.thumbnailUrl || '',
                        type: item.packetType === 'qr-play' ? 'qr-play' : 'qr-canvas',
                        durationSeconds: 86400,
                        order: prev.length + 1,
                      }]);
                    }
                  }}
                  isLoading={isLoadingPublishedItems}
                />
              )}

              {simpleStep === 'compose-durations' && (
                <ComposeDurationsStep
                  items={composeItems}
                  onUpdateDuration={(packetId, seconds) => {
                    setComposeItems(prev => prev.map(i =>
                      i.packetId === packetId ? { ...i, durationSeconds: seconds } : i
                    ));
                  }}
                />
              )}

              {simpleStep === 'compose-order' && (
                <ComposeOrderStep
                  items={composeItems}
                  onMoveUp={(packetId) => {
                    setComposeItems(prev => {
                      const idx = prev.findIndex(i => i.packetId === packetId);
                      if (idx <= 0) return prev;
                      const next = [...prev];
                      [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
                      return next.map((i, j) => ({ ...i, order: j + 1 }));
                    });
                  }}
                  onMoveDown={(packetId) => {
                    setComposeItems(prev => {
                      const idx = prev.findIndex(i => i.packetId === packetId);
                      if (idx < 0 || idx >= prev.length - 1) return prev;
                      const next = [...prev];
                      [next[idx], next[idx + 1]] = [next[idx + 1], next[idx]];
                      return next.map((i, j) => ({ ...i, order: j + 1 }));
                    });
                  }}
                  onRemove={(packetId) => {
                    setComposeItems(prev => prev.filter(i => i.packetId !== packetId).map((i, j) => ({ ...i, order: j + 1 })));
                  }}
                />
              )}

              {simpleStep === 'compose-hosting' && (
                <ComposeHostingStep
                  selected={composeHostingTerm}
                  onSelect={setComposeHostingTerm}
                />
              )}

              {simpleStep === 'compose-mockup' && (
                <QRPlusMockupStep
                  mockupUrl={composeMockup}
                  isLoading={isGeneratingComposeMockup}
                  selectedColor={selectedColor}
                  selectedSize={selectedShirtSize}
                  headerText={headerStyle.enabled ? headerStyle.text : undefined}
                  footerText={footerStyle.enabled ? footerStyle.text : undefined}
                />
              )}

              {simpleStep === 'compose-preview' && (
                <ComposePreviewStep
                  items={composeItems}
                  hostingTerm={composeHostingTerm}
                  mockupUrl={composeMockup}
                  isLoadingMockup={isGeneratingComposeMockup}
                  selectedColor={selectedColor}
                  selectedSize={selectedShirtSize}
                  composeMode={composeMode || 'auto-rotate'}
                />
              )}

              {simpleStep === 'compose-publish' && (
                <ComposePublishStep
                  isPublishing={isPublishing}
                  itemCount={composeItems.length}
                />
              )}

              {simpleStep === 'compose-confirm' && (
                <div className="space-y-4">
                  <ComposeConfirmStep
                    instanceId={composeInstanceId}
                    resolverUrl={composeInstanceId ? `/qr/d/${composeInstanceId}` : null}
                    itemCount={composeItems.length}
                  />
                  {sharePacketId && (
                    <ShareKitHandoff
                      data={getShareKitData()}
                      onCreateAnother={handleCreateAnother}
                      onBackToDashboard={handleBackToDashboard}
                    />
                  )}
                </div>
              )}
            </>)}
          )}
        </div>

        {!isShowingBlackboard && !showQrTypeCards && !showQrCongrats && !showSignInToPublish && !FINAL_CONFIRM_STEPS.includes(simpleStep) && (
          <div className="sticky bottom-0 flex flex-wrap gap-3 justify-between pt-4 pb-2 border-t border-slate-700 bg-slate-800/95 backdrop-blur-sm -mx-6 px-6 z-10 mt-4">
            <Button
              variant="outline"
              onClick={handleSimpleBack}
              disabled={simpleStep === 'channel'}
              className="flex-1 min-w-[100px] sm:flex-none"
              data-testid="button-simple-back"
            >
              <ChevronLeft className="w-4 h-4 mr-1" />
              Back
            </Button>

            {simpleStep !== 'url-publish' && (
              <Button
                onClick={handleSuperNext}
                disabled={!canProceed}
                className={`flex-1 min-w-[100px] sm:flex-none transition-all duration-300 ${
                  canProceed
                    ? "bg-emerald-500 hover:bg-emerald-600 shadow-lg shadow-emerald-500/40"
                    : "bg-slate-600"
                }`}
                style={canProceed ? { animation: "glow 1.2s ease-in-out infinite" } : undefined}
                data-testid="button-simple-next"
              >
                Next
                <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
