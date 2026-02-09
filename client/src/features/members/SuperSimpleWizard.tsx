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
  | 'bb-qr-types'
  | 'action-qr-type'
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
  'bb-qr-types',
  'action-qr-type',
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
  'bb-qr-types': {
    icon: <QrCode className="w-8 h-8" />,
    title: "The Secret Sauce",
    lines: [
      { text: "This is what makes QR Gear different from everything else." },
      { text: "QR Basic: A clean code that links anywhere you want." },
      { text: "QR Plus: Add custom header and footer text." },
      { text: "QR Canvas: A background image behind your QR code.", highlight: true },
      { text: "QR Play: Your QR code opens a video. Yeah, a video." },
    ],
    tip: "Start with Basic or Plus. You can always level up later.",
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

function TutorialTypePicker({
  selectedType,
  onSelect,
}: {
  selectedType: QRType;
  onSelect: (type: QRType) => void;
}) {
  const types = [
    {
      id: 'qr-basic' as QRType,
      label: 'QR Basic',
      description: 'Just the QR code \u2014 simple and clean',
      icon: QrCode,
      color: 'bg-slate-600',
    },
    {
      id: 'qr-plus' as QRType,
      label: 'QR Plus',
      description: 'QR code with header and footer text',
      icon: Type,
      color: 'bg-blue-600',
    },
    {
      id: 'qr-canvas' as QRType,
      label: 'QR Canvas',
      description: 'QR code with a custom background image',
      icon: ImagePlus,
      color: 'bg-purple-600',
    },
    {
      id: 'qr-play' as QRType,
      label: 'QR Play',
      description: 'QR code that opens a video',
      icon: Play,
      color: 'bg-rose-600',
    },
  ];

  return (
    <div className="animate-in fade-in slide-in-from-right-5 duration-300">
      <div className="text-center mb-3">
        <h2 className="text-lg font-bold text-white mb-2">Pick Your QR Type</h2>
        <p className="text-slate-400">You can always change this later</p>
      </div>
      <div className="grid grid-cols-1 gap-3 max-w-md mx-auto">
        {types.map((type) => (
          <button
            key={type.id}
            onClick={() => onSelect(type.id)}
            className={`p-4 rounded-xl border-2 transition-all flex items-center gap-4 ${
              selectedType === type.id
                ? 'border-white bg-white/10'
                : 'border-slate-600 bg-slate-800/50 hover:border-slate-500'
            }`}
            data-testid={`button-type-${type.id}`}
          >
            <div className={`w-12 h-12 rounded-full ${type.color} flex items-center justify-center flex-shrink-0`}>
              <type.icon className="w-6 h-6 text-white" />
            </div>
            <div className="text-left flex-1">
              <h3 className="font-bold text-white">{type.label}</h3>
              <p className="text-slate-400 text-sm">{type.description}</p>
            </div>
            {selectedType === type.id && (
              <Check className="w-6 h-6 text-green-400 flex-shrink-0" />
            )}
          </button>
        ))}
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
      case 'action-qr-type': return !!qrType;
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
          return (
            <BlackboardCard
              data={{
                icon: <QrCode className="w-8 h-8" />,
                title: "You're On Fire!",
                lines: [
                  { text: `You picked ${typeLabel} \u2014 great choice!` },
                  { text: `Product base: $${base.toFixed(2)}` },
                  ...(sizeBonus > 0 ? [{ text: `+ Size bonus: +$${sizeBonus.toFixed(2)}` }] : []),
                  { text: `Your earnings per sale: $${currentTotal.toFixed(2)}`, highlight: true },
                  { text: "In the full builder, adding text, graphics, and extras can push that number even higher." },
                ],
                tip: "You've gone from zero to a real product with real earnings. Not bad for a tutorial!",
              }}
              onContinue={goNext}
            />
          );
        })()}

        {isBlackboard && !['bb-channel-congrats', 'bb-product-congrats', 'bb-color-congrats', 'bb-size-congrats', 'bb-qr-congrats'].includes(tutorialStep) && BLACKBOARD_CONTENT[tutorialStep] && (
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

        {tutorialStep === 'action-qr-type' && (
          <div className="max-w-sm mx-auto space-y-4 animate-in fade-in duration-300">
            <TutorialTypePicker
              selectedType={qrType}
              onSelect={setQrType}
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
      </div>
    </div>
  );
}
