import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Sparkles, X, ArrowRight, Store, Package, DollarSign,
  QrCode, Type, ImagePlus, Play, TrendingUp, Check,
  Palette, Ruler, Loader2, PartyPopper, Lightbulb
} from "lucide-react";
import { ChannelStep } from "@/features/shared/components/wizardSteps/ChannelStep";
import { ProductPickerStep, ColorPickerStep, SizePickerStep } from "@/features/shared/components/wizardSteps/ProductSteps";
import { calculateSizeEarningsBonuses } from "@/features/shared/components/wizardSteps";
import type { QRType } from "@/features/shared/components/wizardSteps/wizardTypes";
import { useWizardContext } from './WizardContext';
import { db } from "@/lib/firebase";
import { doc, getDoc, setDoc } from "firebase/firestore";

type TutorialStep =
  | 'bb-welcome'
  | 'bb-channels'
  | 'action-channel'
  | 'bb-channel-congrats'
  | 'bb-pricing'
  | 'action-product'
  | 'bb-product-congrats'
  | 'bb-zones'
  | 'action-color'
  | 'bb-color-congrats'
  | 'bb-earnings'
  | 'action-size'
  | 'bb-size-congrats'
  | 'bb-qr-intro'
  | 'bb-qr-basic'
  | 'bb-qr-plus'
  | 'bb-qr-canvas'
  | 'bb-qr-play'
  | 'bb-qr-congrats'
  | 'bb-whats-next'
  | 'bb-finish';

const TUTORIAL_FLOW: TutorialStep[] = [
  'bb-welcome',
  'bb-channels',
  'action-channel',
  'bb-channel-congrats',
  'bb-pricing',
  'action-product',
  'bb-product-congrats',
  'bb-zones',
  'action-color',
  'bb-color-congrats',
  'bb-earnings',
  'action-size',
  'bb-size-congrats',
  'bb-qr-intro',
  'bb-qr-basic',
  'bb-qr-plus',
  'bb-qr-canvas',
  'bb-qr-play',
  'bb-qr-congrats',
  'bb-whats-next',
  'bb-finish',
];

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
      { text: "A channel is your personal storefront \u2014 like having your own little shop inside QR Gear." },
      { text: "You can create channels for different themes, events, or brands.", highlight: true },
      { text: "All of your products live inside a channel. Customers browse your channel to see what you've made." },
      { text: "Think: \"Summer Promo,\" \"Tech Events,\" or just \"My Cool Stuff.\"" },
    ],
    tip: "You can have as many channels as you want. Start with one \u2014 you can always add more later.",
  },
  'bb-pricing': {
    icon: <DollarSign className="w-8 h-8" />,
    title: "Let's Talk Earnings",
    lines: [
      { text: "On the next page, you'll pick a product. Each one shows an earnings amount \u2014 that's your starting number." },
      { text: "That number only goes up from here.", highlight: true },
      { text: "1. Pick a bigger size \u2014 your earnings go up." },
      { text: "2. Add text or graphics \u2014 your earnings go up." },
      { text: "3. Choose a premium QR type \u2014 your earnings go up." },
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
      { text: "Don't overthink it \u2014 customers pick their own color at checkout.", highlight: true },
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
    tip: "Watch the +$ bonus on each size button \u2014 that's your extra earnings.",
  },
  'bb-qr-intro': {
    icon: <QrCode className="w-8 h-8" />,
    title: "The Secret Sauce",
    lines: [
      { text: "This is what makes QR Gear different from everything else." },
      { text: "There are four QR types, and each one adds more to the experience." },
      { text: "We're going to walk through each one so you can pick the right fit.", highlight: true },
      { text: "You can off-ramp at any point \u2014 or keep going to see what's next." },
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
      { text: "Don't worry \u2014 you can always edit before publishing." },
    ],
    tip: "Think of this tutorial as your warm-up lap. The race starts next.",
  },
  'bb-finish': {
    icon: <PartyPopper className="w-8 h-8" />,
    title: "You Nailed It!",
    lines: [
      { text: "Look at you \u2014 your product is all set up." },
      { text: "You picked a channel, a product, colors, size, and QR type." },
      { text: "Now the builder will let you fine-tune everything.", highlight: true },
      { text: "Go make something amazing. We'll be right here if you need us." },
    ],
    tip: "Pro tip: After your first publish, Advanced and Studio modes unlock.",
    buttonText: "Start Building!",
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
  nextStep: TutorialStep;
}> = {
  'bb-qr-basic': {
    type: 'qr-basic',
    icon: <QrCode className="w-8 h-8" />,
    iconBg: 'bg-slate-600',
    title: "QR Basic",
    lines: [
      { text: "The simplest option. A clean QR code that links anywhere you want." },
      { text: "No internet connection needed to scan \u2014 the destination is baked right into the code." },
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
      { text: "The QR code connects to your living platform \u2014 you can update where it points anytime.", highlight: true },
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
      { text: "Upload a photo, design, or artwork \u2014 it becomes the landing experience.", highlight: true },
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
      { text: "Upload your own video or link one \u2014 it plays right on the landing page.", highlight: true },
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
  step: TutorialStep;
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

export function SuperSimpleWizard() {
  const {
    selectedChannel, setSelectedChannel,
    selectedProductType,
    selectedColor, setSelectedColor,
    selectedShirtSize, setSelectedShirtSize,
    qrType, setQrType,
    runningEarnings,
    user,
    setWizardTier,
    setViewMode,
    isCreatingChannel, setIsCreatingChannel,
    newChannelName, setNewChannelName,
    handleProductSelect,
    pricingSettings,
    selectedPlacements,
    setSimpleStep,
  } = useWizardContext();

  const [tutorialStep, setTutorialStep] = useState<TutorialStep>('bb-welcome');
  const [checkingTutorial, setCheckingTutorial] = useState(true);
  const [tutorialAlreadyDone, setTutorialAlreadyDone] = useState(false);

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
        // If Firestore read fails, just show tutorial
      }
      setCheckingTutorial(false);
    };
    check();
  }, [user?.id]);

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center py-12 px-4">
        <div className="w-full max-w-sm text-center space-y-4">
          <Sparkles className="w-10 h-10 text-emerald-400 mx-auto" />
          <h2 className="text-xl font-bold text-white">Sign In Required</h2>
          <p className="text-slate-400 text-sm">
            The tutorial needs your account so we can save your progress.
          </p>
          <Button
            onClick={() => setViewMode('index')}
            className="bg-emerald-600 text-white"
            data-testid="super-simple-back-to-home"
          >
            Back to Home
          </Button>
        </div>
      </div>
    );
  }

  if (checkingTutorial) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-400" />
      </div>
    );
  }

  if (tutorialAlreadyDone) {
    return (
      <div className="flex flex-col items-center justify-center py-12 px-4">
        <div className="w-full max-w-sm text-center space-y-4">
          <Check className="w-10 h-10 text-emerald-400 mx-auto" />
          <h2 className="text-xl font-bold text-white">Tutorial Complete</h2>
          <p className="text-slate-400 text-sm">
            You've already finished the tutorial. Jump into the builder to create your next product!
          </p>
          <div className="flex flex-col gap-2">
            <Button
              onClick={() => {
                setSimpleStep('channel');
                setWizardTier('simple');
              }}
              className="w-full bg-emerald-600 text-white"
              data-testid="tutorial-go-to-builder"
            >
              Open Builder
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
            <Button
              variant="ghost"
              onClick={() => {
                setTutorialAlreadyDone(false);
                setTutorialStep('bb-welcome');
              }}
              className="text-slate-400"
              data-testid="tutorial-replay"
            >
              Replay Tutorial
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const currentIdx = TUTORIAL_FLOW.indexOf(tutorialStep);
  const progress = ((currentIdx + 1) / TUTORIAL_FLOW.length) * 100;

  const goNext = () => {
    if (currentIdx < TUTORIAL_FLOW.length - 1) {
      setTutorialStep(TUTORIAL_FLOW[currentIdx + 1]);
    }
  };

  const goBack = () => {
    if (currentIdx > 0) {
      setTutorialStep(TUTORIAL_FLOW[currentIdx - 1]);
    } else {
      setViewMode('index');
    }
  };

  const completeTutorial = async () => {
    try {
      await setDoc(
        doc(db, "member_profiles", user.id),
        { tutorial_complete: true, tutorial_completed_at: new Date().toISOString() },
        { merge: true }
      );
    } catch (e) {
      console.error('Failed to save tutorial completion:', e);
    }
    setSimpleStep('channel');
    setWizardTier('simple');
  };

  const canProceed = (() => {
    switch (tutorialStep) {
      case 'action-channel': return !!selectedChannel;
      case 'action-product': return !!selectedProductType;
      case 'action-color': return !!selectedColor;
      case 'action-size': return !!selectedShirtSize;
      default: return true;
    }
  })();

  const isBlackboard = tutorialStep.startsWith('bb-');

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2 px-1">
        <button
          onClick={goBack}
          className="text-white/50 hover:text-white text-sm flex items-center gap-1"
          data-testid="tutorial-back"
        >
          <ArrowRight className="w-4 h-4 rotate-180" />
          Back
        </button>
        <p className="text-xs text-emerald-400 font-medium flex items-center gap-1">
          <Sparkles className="w-3 h-3" />
          Tutorial {currentIdx + 1} / {TUTORIAL_FLOW.length}
        </p>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setViewMode('index')}
          className="text-white/50 hover:text-white"
          data-testid="tutorial-close"
        >
          <X className="w-4 h-4" />
        </Button>
      </div>

      <div className="w-full h-1.5 bg-slate-700 rounded-full overflow-hidden mx-auto max-w-sm">
        <div
          className="h-full bg-emerald-500 rounded-full transition-all duration-500"
          style={{ width: `${progress}%` }}
          data-testid="tutorial-progress"
        />
      </div>

      <div className="pt-2">
        {isBlackboard && tutorialStep === 'bb-channel-congrats' && (
          <BlackboardCard
            data={{
              icon: <Check className="w-8 h-8" />,
              title: "Nice Work!",
              lines: [
                { text: selectedChannel
                  ? `You picked "${selectedChannel.name}" \u2014 great choice!`
                  : "You've got your channel set up!" },
                { text: "That's the first step in building your digital storefront.", highlight: true },
                { text: "Everything you create will live in this channel. Customers can browse it like a mini shop." },
                { text: "Next up: picking the product you want to sell. This is where it gets fun." },
              ],
              tip: "You're already ahead of most people. They're still reading the instructions.",
            }}
            onContinue={goNext}
          />
        )}

        {isBlackboard && tutorialStep === 'bb-product-congrats' && (
          <BlackboardCard
            data={{
              icon: <Package className="w-8 h-8" />,
              title: "Great Pick!",
              lines: [
                { text: selectedProductType
                  ? `You chose the ${selectedProductType.title} \u2014 solid choice!`
                  : "You've got your product locked in!" },
                { text: "Now you've got something real to work with.", highlight: true },
                { text: "Next we'll tailor it and make it uniquely yours \u2014 colors, size, and your own QR experience." },
                { text: "This is where your product starts to come alive." },
              ],
              tip: "Every choice you make from here adds your personal touch. Let's make it yours.",
            }}
            onContinue={goNext}
          />
        )}

        {isBlackboard && tutorialStep === 'bb-color-congrats' && (() => {
          const base = selectedProductType?.memberEarnings || 0;
          return (
            <BlackboardCard
              data={{
                icon: <Palette className="w-8 h-8" />,
                title: "Looking Good!",
                lines: [
                  { text: selectedColor
                    ? `Nice color choice! That's going to look great on your mockup.`
                    : "Color is set!" },
                  { text: `Your earnings so far: $${base.toFixed(2)} per sale`, highlight: true },
                  { text: "Good news \u2014 color is free. It doesn't change the price at all." },
                  { text: "But the next step will. Let's talk about size and how it bumps your earnings up." },
                ],
                tip: "That $" + base.toFixed(2) + " is just the floor. It's about to go higher.",
              }}
              onContinue={goNext}
            />
          );
        })()}

        {isBlackboard && tutorialStep === 'bb-size-congrats' && (() => {
          const base = selectedProductType?.memberEarnings || 0;
          const sizeBonuses = calculateSizeEarningsBonuses(
            pricingSettings?.sizeUpcharges,
            pricingSettings?.memberProfitShare || 0.25
          );
          const sizeBonus = sizeBonuses[selectedShirtSize] || 0;
          const newTotal = base + sizeBonus;
          return (
            <BlackboardCard
              data={{
                icon: <TrendingUp className="w-8 h-8" />,
                title: "Cha-Ching!",
                lines: [
                  { text: `Base earnings: $${base.toFixed(2)}` },
                  { text: sizeBonus > 0
                    ? `+ Size upgrade (${selectedShirtSize}): +$${sizeBonus.toFixed(2)}`
                    : `Size (${selectedShirtSize}): no extra cost \u2014 same earnings` },
                  { text: `= New total: $${newTotal.toFixed(2)} per sale`, highlight: true },
                  { text: "See how that works? Every choice can add to your earnings." },
                  { text: "Next up: your QR type. Some of those add even more value." },
                ],
              }}
              onContinue={goNext}
            />
          );
        })()}

        {isBlackboard && tutorialStep === 'bb-qr-congrats' && (() => {
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
              { text: `You picked ${typeLabel} \u2014 great choice!` },
              { text: `Your earnings per sale: $${currentTotal.toFixed(2)}`, highlight: true },
            ];

            if (isBasic) {
              return [
                ...shared,
                { text: "QR Basic is simple and powerful. The QR code bakes your content right in \u2014 no server, no platform, no ongoing costs." },
                { text: "Someone scans it, they get your link, text, or contact info instantly. Done." },
                { text: "Want to level up later? QR Canvas and QR Play connect to a living platform where you can change what the QR shows \u2014 even after the shirt is printed." },
              ];
            }

            if (isPlus) {
              return [
                ...shared,
                { text: "QR Plus adds your custom header and footer text around the QR code \u2014 it makes the design pop and tells people what to expect when they scan." },
                { text: "Like Basic, the QR content is baked in. No server needed, no ongoing costs." },
                { text: "Ready for the next level? QR Canvas and QR Play connect to a living platform \u2014 you can update what the QR shows anytime, even after the shirt ships." },
              ];
            }

            return [
              ...shared,
              { text: "When you save this, you're creating a \"moment\" \u2014 a unique experience tied to your QR code." },
              { text: qrType === 'qr-canvas'
                ? "Your image becomes a living page anyone can see when they scan."
                : "Your video becomes a living page anyone can watch when they scan."
              },
              { text: "Here's the exciting part: save 2 or more moments and you unlock QR Compose.", highlight: true },
              { text: "QR Compose lets you build a rotating playlist \u2014 one QR code, many experiences. Imagine your shirt showing something different every time someone scans it." },
            ];
          };

          const getTip = () => {
            if (isBasic || isPlus) {
              return "Simple, reliable, and ready to sell. You can always explore Canvas and Play later to unlock even more possibilities.";
            }
            return "Every moment you save gets you closer to QR Compose. Think of it as building your collection.";
          };

          return (
            <BlackboardCard
              data={{
                icon: <QrCode className="w-8 h-8" />,
                title: isPlatformType ? "Save the Moment!" : "Nice and Simple!",
                lines: getLines(),
                tip: getTip(),
              }}
              onContinue={goNext}
            />
          );
        })()}

        {isBlackboard && ['bb-qr-basic', 'bb-qr-plus', 'bb-qr-canvas', 'bb-qr-play'].includes(tutorialStep) && (
          <QRTypeBlackboard
            step={tutorialStep}
            onChoose={(type) => {
              setQrType(type);
              setTutorialStep('bb-qr-congrats');
            }}
            onContinue={goNext}
          />
        )}

        {isBlackboard && !['bb-channel-congrats', 'bb-product-congrats', 'bb-color-congrats', 'bb-size-congrats', 'bb-qr-congrats', 'bb-qr-basic', 'bb-qr-plus', 'bb-qr-canvas', 'bb-qr-play'].includes(tutorialStep) && BLACKBOARD_CONTENT[tutorialStep] && (
          <BlackboardCard
            data={BLACKBOARD_CONTENT[tutorialStep]}
            onContinue={tutorialStep === 'bb-finish' ? completeTutorial : goNext}
          />
        )}

        {tutorialStep === 'action-channel' && (
          <div className="max-w-sm mx-auto space-y-4 animate-in fade-in duration-300">
            <ChannelStep
              selectedChannel={selectedChannel}
              onSelect={setSelectedChannel}
              memberId={user.id}
              isCreatingChannel={isCreatingChannel}
              setIsCreatingChannel={setIsCreatingChannel}
              newChannelName={newChannelName}
              setNewChannelName={setNewChannelName}
            />
            <Button
              onClick={goNext}
              disabled={!canProceed}
              className="w-full bg-emerald-600 text-white py-5 text-base font-semibold"
              data-testid="tutorial-next"
            >
              Next <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
          </div>
        )}

        {tutorialStep === 'action-product' && (
          <div className="max-w-sm mx-auto space-y-4 animate-in fade-in duration-300">
            <ProductPickerStep
              selectedProduct={selectedProductType}
              onSelect={handleProductSelect}
            />
            <Button
              onClick={goNext}
              disabled={!canProceed}
              className="w-full bg-emerald-600 text-white py-5 text-base font-semibold"
              data-testid="tutorial-next"
            >
              Next <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
          </div>
        )}

        {tutorialStep === 'action-color' && (
          <div className="max-w-sm mx-auto space-y-4 animate-in fade-in duration-300">
            <ColorPickerStep
              selectedColor={selectedColor}
              onSelect={setSelectedColor}
            />
            <Button
              onClick={goNext}
              disabled={!canProceed}
              className="w-full bg-emerald-600 text-white py-5 text-base font-semibold"
              data-testid="tutorial-next"
            >
              Next <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
          </div>
        )}

        {tutorialStep === 'action-size' && (() => {
          const sizeEarningsBonuses = calculateSizeEarningsBonuses(
            pricingSettings?.sizeUpcharges,
            pricingSettings?.memberProfitShare || 0.25
          );
          return (
            <div className="max-w-sm mx-auto space-y-4 animate-in fade-in duration-300">
              <SizePickerStep
                selectedSize={selectedShirtSize}
                selectedColor={selectedColor}
                baseEarnings={runningEarnings}
                sizeEarningsBonuses={sizeEarningsBonuses}
                selectedPlacements={selectedPlacements}
                onSelect={setSelectedShirtSize}
              />
              <Button
                onClick={goNext}
                disabled={!canProceed}
                className="w-full bg-emerald-600 text-white py-5 text-base font-semibold"
                data-testid="tutorial-next"
              >
                Next <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
            </div>
          );
        })()}

      </div>
    </div>
  );
}
